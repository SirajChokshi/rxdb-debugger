import { Observable, Subject } from "rxjs";
import { filter, map } from "rxjs/operators";

/**
 * Event types emitted by the bridge.
 */
export type BridgeEventType =
  | "RXDB_CHANGE"
  | "RXDB_COUNT_UPDATE"
  | "RXDB_COLLECTIONS_CHANGED"
  | "RXDB_DESTROYED";

/**
 * Change event payload matching the core ChangeEvent interface.
 */
export interface ChangeEventPayload {
  collection: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  documentId: string;
  documentData: Record<string, unknown> | null;
  previousDocumentData: Record<string, unknown> | null;
  timestamp: number;
}

/**
 * Bridge event structure.
 */
export interface BridgeEvent {
  type: BridgeEventType;
  payload: unknown;
}

const BRIDGE_CHANNEL = "RXDB_DEBUGGER_BRIDGE";

/**
 * How long the page-side bridge keeps running without hearing from the panel
 * before it tears itself down.
 */
export const BRIDGE_TIMEOUT_MS = 15000;

/**
 * Panel-side poll cadence. Each tick refreshes the page-side heartbeat and
 * drains the queued events, so this directly bounds UI update latency.
 */
export const BRIDGE_POLL_INTERVAL_MS = 1000;

/**
 * Page-side cadence for detecting collection set changes / database teardown.
 */
export const COLLECTION_POLL_INTERVAL_MS = 2000;

/**
 * Maximum number of events buffered page-side between drains. Bounds memory
 * if the panel stalls (e.g. hidden DevTools with throttled timers).
 */
export const MAX_PAGE_EVENT_QUEUE = 500;

const EVAL_TIMEOUT_MS = 2000;

const bridgeEventTypes = new Set<BridgeEventType>([
  "RXDB_CHANGE",
  "RXDB_COUNT_UPDATE",
  "RXDB_COLLECTIONS_CHANGED",
  "RXDB_DESTROYED",
]);

interface EvalExceptionInfoLike {
  isError?: boolean;
  isException?: boolean;
  value?: string;
  description?: string;
  code?: string;
}

/**
 * Evaluates an expression in the inspected page context.
 */
export function evalInPage<T>(expression: string): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Eval timed out"));
    }, EVAL_TIMEOUT_MS);

    chrome.devtools.inspectedWindow.eval(expression, (result, exceptionInfo) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);

      // exceptionInfo can be present with both flags false in some Chrome
      // versions; only treat it as a failure when a flag is actually set.
      const info = exceptionInfo as EvalExceptionInfoLike | undefined;
      if (info && (info.isError || info.isException || (!("isError" in info) && !("isException" in info)))) {
        reject(new Error(info.value || info.description || info.code || "Eval failed"));
      } else {
        resolve(result as T);
      }
    });
  });
}

/**
 * Evaluates an async expression by storing the result in a temp variable and polling.
 */
export async function evalAsyncInPage<T>(asyncExpression: string, timeout = 5000): Promise<T> {
  const tempVar = `__rxdb_debugger_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  await evalInPage(`
    (async () => {
      try {
        const result = await (${asyncExpression});
        window['${tempVar}'] = { done: true, value: result };
      } catch (e) {
        window['${tempVar}'] = { done: true, error: String(e && e.message ? e.message : e) };
      }
    })();
  `);

  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const status = await evalInPage<{ done: boolean; value?: T; error?: string } | undefined>(
      `window['${tempVar}']`
    );

    if (status?.done) {
      await evalInPage(`delete window['${tempVar}']`).catch(() => {
        // Best-effort cleanup; the page may have navigated.
      });

      if (typeof status.error === "string") {
        throw new Error(status.error || "Eval failed");
      }
      return status.value as T;
    }

    await new Promise(r => setTimeout(r, 50));
  }

  // Best-effort cleanup so abandoned result slots don't accumulate on the page.
  evalInPage(`delete window['${tempVar}']`).catch(() => {});
  throw new Error("Timeout waiting for async result");
}

/**
 * Hot stream of events for the currently connected bridge session.
 * Completed and replaced on dispose. Intentionally a plain Subject: bridge
 * events are ephemeral facts, replaying the last one to late subscribers
 * caused phantom events and double-counted live counts.
 */
let bridgeSubject: Subject<BridgeEvent> | null = null;

/**
 * Stable lifecycle stream that survives connect/disconnect cycles. Only
 * carries inventory-level events (collections changed / database destroyed)
 * so shell UIs can refresh their database lists.
 */
const inventoryEventsSubject = new Subject<BridgeEvent>();

let bridgeInitialized = false;
let pollIntervalId: ReturnType<typeof setInterval> | null = null;
let activeSessionId: string | null = null;
let activeInstanceId: string | null = null;

/**
 * init/dispose are serialized through this chain so overlapping calls (rapid
 * instance switching, panel remounts) cannot interleave their page-side evals
 * and leave the heartbeat bound to a dead session.
 */
let operationChain: Promise<void> = Promise.resolve();

function enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationChain.then(operation, operation);
  operationChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function createSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isBridgeEvent(event: unknown): event is BridgeEvent {
  if (typeof event !== "object" || event === null) {
    return false;
  }

  const candidate = event as { type?: unknown };
  return (
    typeof candidate.type === "string"
    && bridgeEventTypes.has(candidate.type as BridgeEventType)
  );
}

function ensureBridgeSubject(): Subject<BridgeEvent> {
  if (!bridgeSubject || bridgeSubject.closed || bridgeSubject.isStopped) {
    bridgeSubject = new Subject<BridgeEvent>();
  }
  return bridgeSubject;
}

/**
 * Get the shared bridge events observable for the current session.
 */
export function getBridgeEvents(): Observable<BridgeEvent> {
  return ensureBridgeSubject().asObservable();
}

/**
 * Get a stable stream of inventory-level events (collection set changes and
 * database destruction). Unlike getBridgeEvents(), this stream is never
 * completed, so shell UIs can subscribe once and observe every session.
 */
export function getInventoryEvents(): Observable<BridgeEvent> {
  return inventoryEventsSubject.asObservable();
}

/**
 * Get change events for a specific collection.
 */
export function getCollectionChanges(collectionName: string): Observable<ChangeEventPayload> {
  return getBridgeEvents().pipe(
    filter((e): e is BridgeEvent & { payload: ChangeEventPayload } =>
      e.type === "RXDB_CHANGE" &&
      (e.payload as ChangeEventPayload)?.collection === collectionName
    ),
    map(e => e.payload)
  );
}

/**
 * Initialize the event bridge for a database instance.
 *
 * Safe to call concurrently and repeatedly:
 * - already initialized for the same instance: no-op
 * - initialized for a different instance: previous session is disposed first
 */
export function initBridge(instanceId: string): Promise<void> {
  return enqueueOperation(async () => {
    if (bridgeInitialized && activeInstanceId === instanceId) {
      return;
    }

    if (bridgeInitialized) {
      await disposeBridgeInternal();
    }

    ensureBridgeSubject();

    const sessionId = createSessionId();
    activeSessionId = sessionId;
    activeInstanceId = instanceId;
    bridgeInitialized = true;

    try {
      await injectPageBridge(sessionId, instanceId);
      startPolling(sessionId, instanceId);
    } catch (error) {
      activeSessionId = null;
      activeInstanceId = null;
      bridgeInitialized = false;
      throw error;
    }
  });
}

/**
 * Inject the page-context bridge via eval.
 * This subscribes to RxDB events and stores them in a page-side queue.
 */
async function injectPageBridge(sessionId: string, instanceId: string): Promise<void> {
  const channelLiteral = JSON.stringify(BRIDGE_CHANNEL);
  const sessionLiteral = JSON.stringify(sessionId);
  const instanceLiteral = JSON.stringify(instanceId);
  const bridgeTimeoutLiteral = String(BRIDGE_TIMEOUT_MS);
  const pollIntervalLiteral = String(COLLECTION_POLL_INTERVAL_MS);
  const maxQueueLiteral = String(MAX_PAGE_EVENT_QUEUE);

  await evalInPage(`
    (function() {
      var channel = ${channelLiteral};
      var sessionId = ${sessionLiteral};
      var instanceId = ${instanceLiteral};
      var bridgeTimeoutMs = ${bridgeTimeoutLiteral};
      var pollIntervalMs = ${pollIntervalLiteral};
      var maxQueueLength = ${maxQueueLiteral};
      var root = window;

      var state = root.__rxdb_debugger_bridge_state;
      if (!state) {
        state = {
          active: false,
          sessionId: null,
          instanceId: null,
          channel: null,
          subscriptions: [],
          intervalId: null,
          heartbeat: 0,
          lastCollections: '',
          lastDatabaseToken: '',
          eventQueue: []
        };
        root.__rxdb_debugger_bridge_state = state;
      }

      function teardown() {
        (state.subscriptions || []).forEach(function(subscription) {
          if (subscription && typeof subscription.unsubscribe === 'function') {
            subscription.unsubscribe();
          }
        });
        state.subscriptions = [];

        if (state.intervalId) {
          clearInterval(state.intervalId);
          state.intervalId = null;
        }

        state.active = false;
      }

      // Already running for this exact session+instance: just refresh the
      // heartbeat, nothing to rewire.
      if (state.active && state.sessionId === sessionId && state.instanceId === instanceId) {
        state.heartbeat = Date.now();
        return;
      }

      var isNewSession = state.sessionId !== sessionId;
      var previousCollections = state.lastCollections;
      var previousToken = state.lastDatabaseToken;
      teardown();

      state.active = true;
      state.sessionId = sessionId;
      state.instanceId = instanceId;
      state.channel = channel;
      state.heartbeat = Date.now();
      state.lastCollections = '';
      state.lastDatabaseToken = '';
      if (isNewSession) {
        // Drop events queued for a previous session/instance so they cannot
        // leak into this one. Same-session re-injection (self-heal) keeps the
        // queue because those events belong to this consumer.
        state.eventQueue = [];
      }

      function emit(type, payload) {
        state.eventQueue.push({
          type: type,
          payload: payload
        });
        // Bound memory if the panel stalls; drop oldest first.
        while (state.eventQueue.length > maxQueueLength) {
          state.eventQueue.shift();
        }
      }

      function getActiveDatabase() {
        var registry = root.__RXDB_DEBUGGER__;
        if (!registry || typeof registry.getInstanceHandle !== 'function') {
          return null;
        }
        return registry.getInstanceHandle(instanceId);
      }

      function subscribeToCollections(db) {
        (state.subscriptions || []).forEach(function(subscription) {
          if (subscription && typeof subscription.unsubscribe === 'function') {
            subscription.unsubscribe();
          }
        });
        state.subscriptions = [];

        if (!db || !db.collections) return;

        Object.entries(db.collections).forEach(function(entry) {
          var collectionName = entry[0];
          var collection = entry[1];

          if (collection && collection.$ && typeof collection.$.subscribe === 'function') {
            var sub = collection.$.subscribe(function(event) {
              if (!event || !event.operation) return;

              emit('RXDB_CHANGE', {
                collection: collectionName,
                operation: event.operation,
                documentId: event.documentId,
                documentData: event.documentData || null,
                previousDocumentData: event.previousDocumentData || null,
                timestamp: Date.now()
              });
            });
            state.subscriptions.push(sub);
          }
        });
      }

      function readDatabaseSnapshot() {
        var db = getActiveDatabase();
        if (!db) {
          return { db: null, token: '', collections: '' };
        }
        return {
          db: db,
          token: typeof db.token === 'string' && db.token !== '' ? db.token : '__unknown_token__',
          collections: Object.keys(db.collections || {}).sort().join(',')
        };
      }

      function checkCollections() {
        var snapshot = readDatabaseSnapshot();

        if (!snapshot.db) {
          // Emit destroyed once if we previously observed a database, even
          // one that had no collections yet.
          if (state.lastDatabaseToken !== '' || state.lastCollections !== '') {
            emit('RXDB_DESTROYED', null);
            state.lastCollections = '';
            state.lastDatabaseToken = '';
          }
          return;
        }

        var changed = snapshot.collections !== state.lastCollections
          || snapshot.token !== state.lastDatabaseToken;
        if (changed) {
          state.lastCollections = snapshot.collections;
          state.lastDatabaseToken = snapshot.token;
          emit('RXDB_COLLECTIONS_CHANGED', snapshot.collections ? snapshot.collections.split(',') : []);
          subscribeToCollections(snapshot.db);
        }
      }

      function checkHeartbeat() {
        if (Date.now() - state.heartbeat > bridgeTimeoutMs) {
          // Panel disconnected, cleanup. The panel re-injects on its next
          // successful poll, so this is recoverable.
          teardown();
        }
      }

      // For a fresh session, establish the baseline silently: the connecting
      // panel just fetched a snapshot of this database, so an initial
      // RXDB_COLLECTIONS_CHANGED would only produce a spurious refresh.
      // For a same-session re-injection (self-heal after the page bridge was
      // torn down), report anything that changed during the outage.
      var initial = readDatabaseSnapshot();
      state.lastCollections = initial.collections;
      state.lastDatabaseToken = initial.token;
      if (initial.db) {
        subscribeToCollections(initial.db);
      }

      if (!isNewSession) {
        var hadDatabase = previousToken !== '' || previousCollections !== '';
        if (!initial.db && hadDatabase) {
          emit('RXDB_DESTROYED', null);
        } else if (
          initial.db
          && (initial.collections !== previousCollections || initial.token !== previousToken)
        ) {
          emit('RXDB_COLLECTIONS_CHANGED', initial.collections ? initial.collections.split(',') : []);
        }
      }

      state.intervalId = setInterval(function() {
        checkCollections();
        checkHeartbeat();
      }, pollIntervalMs);
    })();
  `);
}

/**
 * Start the panel-side poll loop for a session. Each tick refreshes the
 * page-side heartbeat and drains queued events. If the page-side state is
 * missing or inactive (navigation, heartbeat timeout while DevTools was
 * hidden), the bridge re-injects itself.
 */
function startPolling(sessionId: string, instanceId: string): void {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  const sessionLiteral = JSON.stringify(sessionId);
  const subject = bridgeSubject;
  // In-flight tracking is scoped to this poll loop. With a shared module
  // flag, a slow eval from an already-disposed session would clear the flag
  // in its finally handler while the new session's eval was still running,
  // allowing two concurrent drains of the same page event queue.
  const pollState = { inFlight: false };

  pollIntervalId = setInterval(() => {
    // A previous tick is still awaiting its eval; don't pile up.
    if (pollState.inFlight || activeSessionId !== sessionId) {
      return;
    }
    pollState.inFlight = true;

    evalInPage<BridgeEvent[] | null>(`
      (function() {
        var state = window.__rxdb_debugger_bridge_state;
        if (!state || state.sessionId !== ${sessionLiteral} || !state.active) {
          return null;
        }
        state.heartbeat = Date.now();
        if (!Array.isArray(state.eventQueue) || state.eventQueue.length === 0) return [];
        var events = state.eventQueue.slice();
        state.eventQueue.length = 0;
        return events;
      })();
    `)
      .then(async (events) => {
        // The session may have been disposed/replaced while the eval was in
        // flight; drop the result instead of feeding a newer session's
        // subject with stale events.
        if (activeSessionId !== sessionId) {
          return;
        }

        if (events === null) {
          // Page bridge is gone (navigation without a panel remount, or
          // page-side heartbeat timeout). Re-inject to self-heal.
          await enqueueOperation(async () => {
            if (activeSessionId !== sessionId || activeInstanceId !== instanceId) {
              return;
            }
            await injectPageBridge(sessionId, instanceId);
          }).catch(() => {
            // Page may be mid-navigation; retry on the next tick.
          });
          return;
        }

        if (!Array.isArray(events)) {
          return;
        }

        for (const event of events) {
          if (!isBridgeEvent(event)) {
            continue;
          }
          subject?.next(event);
          if (event.type === "RXDB_COLLECTIONS_CHANGED" || event.type === "RXDB_DESTROYED") {
            inventoryEventsSubject.next(event);
          }
        }
      })
      .catch(() => {
        // Page may have navigated, ignore and retry on the next tick.
      })
      .finally(() => {
        pollState.inFlight = false;
      });
  }, BRIDGE_POLL_INTERVAL_MS);
}

async function disposeBridgeInternal(): Promise<void> {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }

  const sessionId = activeSessionId;
  activeSessionId = null;
  activeInstanceId = null;

  bridgeSubject?.complete();
  bridgeSubject = null;
  bridgeInitialized = false;

  if (!sessionId) {
    return;
  }

  const sessionLiteral = JSON.stringify(sessionId);
  // Cleanup page-side subscriptions for this specific bridge session.
  await evalInPage(`
    (function() {
      var state = window.__rxdb_debugger_bridge_state;
      if (!state || state.sessionId !== ${sessionLiteral}) return;

      (state.subscriptions || []).forEach(function(subscription) {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        }
      });
      state.subscriptions = [];

      if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
      }

      state.active = false;
      state.sessionId = null;
      state.instanceId = null;
      state.channel = null;
      state.heartbeat = 0;
      state.lastCollections = '';
      state.lastDatabaseToken = '';
      state.eventQueue = [];
    })();
  `).catch(() => {
    // Page may have navigated, ignore
  });
}

/**
 * Cleanup the bridge.
 */
export function disposeBridge(): Promise<void> {
  return enqueueOperation(disposeBridgeInternal);
}
