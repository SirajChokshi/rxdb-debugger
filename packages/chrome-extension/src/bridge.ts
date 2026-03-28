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

type RuntimeMessageListener = Parameters<typeof chrome.runtime.onMessage.addListener>[0];

interface RuntimeBridgeEnvelope {
  channel: string;
  sessionId: string;
  event: unknown;
}

const BRIDGE_CHANNEL = "RXDB_DEBUGGER_BRIDGE";
const BRIDGE_TIMEOUT_MS = 15000;
const HEARTBEAT_INTERVAL_MS = 5000;
const COLLECTION_POLL_INTERVAL_MS = 2000;
const EVAL_TIMEOUT_MS = 2000;
const EVENT_FLUSH_INTERVAL_MS = 16;
const MAX_PENDING_EVENTS = 2000;
const EVENT_BATCH_SIZE = 250;

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
let runtimeMessageListener: RuntimeMessageListener | null = null;

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

function parseRuntimeBridgeMessage(message: unknown, sessionId: string): BridgeEvent[] | null {
  if (typeof message !== "object" || message === null) {
    return null;
  }

  const envelope = message as Partial<RuntimeBridgeEnvelope>;
  if (envelope.channel !== BRIDGE_CHANNEL) {
    return null;
  }
  if (envelope.sessionId !== sessionId) {
    return null;
  }

  const { event } = envelope;
  if (isBridgeEvent(event)) {
    return [event];
  }
  if (Array.isArray(event)) {
    const events = event.filter((candidate): candidate is BridgeEvent => isBridgeEvent(candidate));
    if (events.length > 0) {
      return events;
    }
  }
  return null;
}

function removeRuntimeMessageListener(): void {
  if (!runtimeMessageListener) {
    return;
  }
  chrome.runtime.onMessage.removeListener(runtimeMessageListener);
  runtimeMessageListener = null;
}

function attachRuntimeMessageListener(sessionId: string): void {
  removeRuntimeMessageListener();
  const tabId = chrome.devtools.inspectedWindow.tabId;

  runtimeMessageListener = (message, sender) => {
    if (sender.tab?.id !== tabId) {
      return;
    }

    const events = parseRuntimeBridgeMessage(message, sessionId);
    if (!events) {
      return;
    }

    for (const event of events) {
      bridgeSubject?.next(event);
    }
  };

  chrome.runtime.onMessage.addListener(runtimeMessageListener);
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

/**
 * Initialize the event bridge.
 * Injects scripts into the page and sets up message listeners.
 */
export async function initBridge(instanceId: string): Promise<void> {
  if (bridgeInitialized) return;
  bridgeInitialized = true;

  if (!bridgeSubject) {
    bridgeSubject = new ReplaySubject<BridgeEvent>(1);
  }

  const sessionId = createSessionId();
  activeSessionId = sessionId;

  try {
    await injectContentScriptRelay(sessionId);
    attachRuntimeMessageListener(sessionId);

    // Inject the page-context bridge
    await injectPageBridge(sessionId, instanceId);

    // Start heartbeat to keep page bridge alive
    startHeartbeat(sessionId);
  } catch (error) {
    removeRuntimeMessageListener();
    activeSessionId = null;
    bridgeInitialized = false;
    throw error;
  }
}

/**
 * Inject the content script relay via chrome.scripting.executeScript.
 * This listens for postMessage events and forwards them to the extension.
 */
async function injectContentScriptRelay(sessionId: string): Promise<void> {
  const tabId = chrome.devtools.inspectedWindow.tabId;
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [BRIDGE_CHANNEL, sessionId],
    func: (channel: string, currentSessionId: string) => {
      interface RelayMessage {
        channel?: unknown;
        sessionId?: unknown;
        event?: unknown;
      }

      interface RelayState {
        channel: string;
        sessionId: string;
        listener: (event: MessageEvent) => void;
      }

      const relayWindow = window as typeof window & {
        __rxdb_debugger_relay_state?: RelayState;
      };

      const existingRelay = relayWindow.__rxdb_debugger_relay_state;
      if (existingRelay) {
        existingRelay.channel = channel;
        existingRelay.sessionId = currentSessionId;
        return;
      }

      const relayState: RelayState = {
        channel,
        sessionId: currentSessionId,
        listener: (event: MessageEvent) => {
          if (event.source !== window) {
            return;
          }
          if (typeof event.data !== "object" || event.data === null) {
            return;
          }

          const message = event.data as RelayMessage;
          if (message.channel !== relayState.channel) {
            return;
          }
          if (message.sessionId !== relayState.sessionId) {
            return;
          }

          chrome.runtime.sendMessage({
            channel: relayState.channel,
            sessionId: relayState.sessionId,
            event: message.event,
          });
        }
      };

      relayWindow.__rxdb_debugger_relay_state = relayState;
      window.addEventListener("message", relayState.listener);
    },
  });
}

/**
 * Inject the page-context bridge via eval.
 * This subscribes to RxDB events and posts them via postMessage.
 */
async function injectPageBridge(sessionId: string, instanceId: string): Promise<void> {
  const channelLiteral = JSON.stringify(BRIDGE_CHANNEL);
  const sessionLiteral = JSON.stringify(sessionId);
  const instanceLiteral = JSON.stringify(instanceId);
  const bridgeTimeoutLiteral = String(BRIDGE_TIMEOUT_MS);
  const pollIntervalLiteral = String(COLLECTION_POLL_INTERVAL_MS);
  const flushIntervalLiteral = String(EVENT_FLUSH_INTERVAL_MS);
  const maxPendingEventsLiteral = String(MAX_PENDING_EVENTS);
  const eventBatchSizeLiteral = String(EVENT_BATCH_SIZE);

  await evalInPage(`
    (function() {
      var channel = ${channelLiteral};
      var sessionId = ${sessionLiteral};
      var bridgeTimeoutMs = ${bridgeTimeoutLiteral};
      var pollIntervalMs = ${pollIntervalLiteral};
      var flushIntervalMs = ${flushIntervalLiteral};
      var maxPendingEvents = ${maxPendingEventsLiteral};
      var eventBatchSize = ${eventBatchSizeLiteral};
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
          flushTimerId: null,
          registryUnsubscribe: null,
          shouldPollCollections: false,
          heartbeat: 0,
          lastCollections: '',
          lastDatabaseToken: '',
          pendingEvents: []
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

        if (state.flushTimerId) {
          clearTimeout(state.flushTimerId);
          state.flushTimerId = null;
        }

        if (typeof state.registryUnsubscribe === 'function') {
          state.registryUnsubscribe();
        }
        state.registryUnsubscribe = null;
        state.shouldPollCollections = false;
        state.pendingEvents = [];
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
      state.pendingEvents = [];
      state.flushTimerId = null;
      state.registryUnsubscribe = null;
      state.shouldPollCollections = false;

      function flushEvents() {
        state.flushTimerId = null;

        if (!state.active || !Array.isArray(state.pendingEvents) || state.pendingEvents.length === 0) {
          return;
        }

        var batch = state.pendingEvents.splice(0, eventBatchSize);
        batch.forEach(function(event) {
          root.postMessage({
            channel: state.channel,
            sessionId: state.sessionId,
            event: event
          }, '*');
        });

        if (state.pendingEvents.length > 0) {
          state.flushTimerId = setTimeout(flushEvents, flushIntervalMs);
        }
      }

      function scheduleFlush() {
        if (state.flushTimerId) {
          return;
        }
        state.flushTimerId = setTimeout(flushEvents, flushIntervalMs);
      }

      function emit(type, payload) {
        if (!Array.isArray(state.pendingEvents)) {
          state.pendingEvents = [];
        }
        if (state.pendingEvents.length >= maxPendingEvents) {
          var overflow = state.pendingEvents.length - maxPendingEvents + 1;
          if (overflow > 0) {
            state.pendingEvents.splice(0, overflow);
          }
        }
        state.pendingEvents.push({
          type: type,
          payload: payload
        });
        scheduleFlush();
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
          if (state.subscriptions.length > 0) {
            subscribeToCollections(null);
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

      function setupRegistrySubscription() {
        var registry = root.__RXDB_DEBUGGER__;
        if (!registry || typeof registry.subscribe !== 'function') {
          return false;
        }

        try {
          var unsubscribe = registry.subscribe(function(change) {
            if (!state.active || state.sessionId !== sessionId) {
              return;
            }
            if (!change || typeof change !== 'object') {
              return;
            }
            checkCollections();
          });

          if (typeof unsubscribe === 'function') {
            state.registryUnsubscribe = unsubscribe;
            return true;
          }
        } catch (_error) {
          return false;
        }

        return false;
      }

      function checkHeartbeat() {
        if (Date.now() - state.heartbeat > bridgeTimeoutMs) {
          // Panel disconnected, cleanup
          teardown();
        }
      }

      checkCollections();
      state.shouldPollCollections = !setupRegistrySubscription();

      // Check for collection changes and heartbeat periodically
      state.intervalId = setInterval(function() {
        if (state.shouldPollCollections) {
          checkCollections();
        }
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
    evalInPage(`
      (function() {
        var state = window.__rxdb_debugger_bridge_state;
        if (!state || state.sessionId !== ${sessionLiteral}) return;
        state.heartbeat = Date.now();
      })();
    `)
      .catch(() => {
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

  removeRuntimeMessageListener();

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

      if (state.flushTimerId) {
        clearTimeout(state.flushTimerId);
        state.flushTimerId = null;
      }

      if (typeof state.registryUnsubscribe === 'function') {
        state.registryUnsubscribe();
      }

      state.active = false;
      state.sessionId = null;
      state.instanceId = null;
      state.channel = null;
      state.heartbeat = 0;
      state.lastCollections = '';
      state.lastDatabaseToken = '';
      state.pendingEvents = [];
      state.registryUnsubscribe = null;
      state.shouldPollCollections = false;
    })();
  `).catch(() => {
    // Page may have navigated, ignore
  });
}
