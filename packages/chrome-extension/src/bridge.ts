import { Observable, ReplaySubject } from "rxjs";
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
const BRIDGE_TIMEOUT_MS = 15000;
const HEARTBEAT_INTERVAL_MS = 5000;
const COLLECTION_POLL_INTERVAL_MS = 2000;
const EVAL_TIMEOUT_MS = 2000;

const bridgeEventTypes = new Set<BridgeEventType>([
  "RXDB_CHANGE",
  "RXDB_COUNT_UPDATE",
  "RXDB_COLLECTIONS_CHANGED",
  "RXDB_DESTROYED",
]);

/**
 * Evaluates an expression in the inspected page context.
 */
export function evalInPage<T>(expression: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Eval timed out"));
    }, EVAL_TIMEOUT_MS);

    chrome.devtools.inspectedWindow.eval(expression, (result, exceptionInfo) => {
      clearTimeout(timeoutId);
      if (exceptionInfo) {
        reject(new Error(exceptionInfo.value || "Eval failed"));
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
        window['${tempVar}'] = { done: true, error: e.message };
      }
    })();
  `);

  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const status = await evalInPage<{ done: boolean; value?: T; error?: string } | undefined>(
      `window['${tempVar}']`
    );
    
    if (status?.done) {
      await evalInPage(`delete window['${tempVar}']`);
      
      if (status.error) {
        throw new Error(status.error);
      }
      return status.value as T;
    }
    
    await new Promise(r => setTimeout(r, 50));
  }
  
  throw new Error("Timeout waiting for async result");
}

let bridgeSubject: ReplaySubject<BridgeEvent> | null = null;
let bridgeInitialized = false;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let activeSessionId: string | null = null;
let activeBridgeInstanceId: string | null = null;

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

/**
 * Get the shared bridge events observable.
 * Initializes the bridge on first call.
 */
export function getBridgeEvents(): Observable<BridgeEvent> {
  if (!bridgeSubject) {
    bridgeSubject = new ReplaySubject<BridgeEvent>(1);
  }
  return bridgeSubject.asObservable();
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

function publishBridgeEvents(events: unknown): void {
  if (!Array.isArray(events)) {
    return;
  }

  for (const event of events) {
    if (isBridgeEvent(event)) {
      bridgeSubject?.next(event);
    }
  }
}

async function drainBridgeEvents(sessionId: string): Promise<void> {
  const sessionLiteral = JSON.stringify(sessionId);
  const events = await evalInPage<unknown>(`
    (function() {
      var state = window.__rxdb_debugger_bridge_state;
      if (!state || state.sessionId !== ${sessionLiteral}) return [];
      state.heartbeat = Date.now();
      if (!Array.isArray(state.eventQueue) || state.eventQueue.length === 0) return [];
      var events = state.eventQueue.slice();
      state.eventQueue.length = 0;
      return events;
    })();
  `);

  publishBridgeEvents(events);
}

/**
 * Initialize the event bridge.
 * Injects a page-side bridge and polls its event queue from the DevTools panel.
 */
export async function initBridge(instanceId: string): Promise<void> {
  if (bridgeInitialized && activeBridgeInstanceId === instanceId) {
    return;
  }

  if (bridgeInitialized) {
    await disposeBridge();
  }

  bridgeInitialized = true;
  activeBridgeInstanceId = instanceId;

  if (!bridgeSubject) {
    bridgeSubject = new ReplaySubject<BridgeEvent>(1);
  }

  const sessionId = createSessionId();
  activeSessionId = sessionId;

  try {
    // Inject the page-context bridge
    await injectPageBridge(sessionId, instanceId);

    // Drain any events queued during injection before waiting for heartbeat.
    await drainBridgeEvents(sessionId).catch(() => {
      // Page may have navigated, ignore
    });

    // Start heartbeat to keep page bridge alive
    startHeartbeat(sessionId);
  } catch (error) {
    activeSessionId = null;
    activeBridgeInstanceId = null;
    bridgeInitialized = false;
    throw error;
  }
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

  await evalInPage(`
    (function() {
      var channel = ${channelLiteral};
      var sessionId = ${sessionLiteral};
      var bridgeTimeoutMs = ${bridgeTimeoutLiteral};
      var pollIntervalMs = ${pollIntervalLiteral};
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

      if (state.active && state.sessionId === sessionId) {
        if (state.instanceId !== ${instanceLiteral}) {
          teardown();
        } else {
        state.heartbeat = Date.now();
        return;
        }
      }

      teardown();
      state.active = true;
      state.sessionId = sessionId;
      state.instanceId = ${instanceLiteral};
      state.channel = channel;
      state.heartbeat = Date.now();
      state.lastCollections = '';
      state.lastDatabaseToken = '';

      function emit(type, payload) {
        state.eventQueue.push({
          type: type,
          payload: payload
        });
      }

      function getActiveDatabase() {
        var registry = root.__RXDB_DEBUGGER__;
        if (!registry || typeof registry.getInstanceHandle !== 'function') {
          return null;
        }
        return registry.getInstanceHandle(${instanceLiteral});
      }

      function subscribeToCollections(db) {
        // Unsubscribe existing
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

      function checkCollections() {
        var db = getActiveDatabase();
        if (!db) {
          if (state.lastCollections !== '') {
            emit('RXDB_DESTROYED', null);
            state.lastCollections = '';
            state.lastDatabaseToken = '';
          }
          return;
        }

        var currentToken = typeof db.token === 'string' ? db.token : '';
        var current = Object.keys(db.collections || {}).sort().join(',');
        var shouldResubscribe = current !== state.lastCollections || currentToken !== state.lastDatabaseToken;
        if (shouldResubscribe) {
          state.lastCollections = current;
          state.lastDatabaseToken = currentToken;
          emit('RXDB_COLLECTIONS_CHANGED', current ? current.split(',') : []);
          subscribeToCollections(db);
        }
      }

      function checkHeartbeat() {
        if (Date.now() - state.heartbeat > bridgeTimeoutMs) {
          // Panel disconnected, cleanup
          teardown();
        }
      }

      checkCollections();

      // Check for collection changes and heartbeat periodically
      state.intervalId = setInterval(function() {
        checkCollections();
        checkHeartbeat();
      }, pollIntervalMs);
    })();
  `);
}

/**
 * Start the heartbeat to keep the page bridge alive.
 */
function startHeartbeat(sessionId: string): void {
  if (heartbeatInterval) return;
  const sessionLiteral = JSON.stringify(sessionId);

  heartbeatInterval = setInterval(() => {
    drainBridgeEvents(sessionId).catch(() => {
      // Page may have navigated, ignore
    });
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Cleanup the bridge.
 */
export async function disposeBridge(): Promise<void> {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  const sessionId = activeSessionId;
  activeSessionId = null;
  activeBridgeInstanceId = null;

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
