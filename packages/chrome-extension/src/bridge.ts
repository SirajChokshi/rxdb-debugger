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
  event: BridgeEvent;
}

const BRIDGE_CHANNEL = "RXDB_DEBUGGER_BRIDGE";
const BRIDGE_TIMEOUT_MS = 15000;
const HEARTBEAT_INTERVAL_MS = 5000;
const COLLECTION_POLL_INTERVAL_MS = 2000;

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
    chrome.devtools.inspectedWindow.eval(expression, (result, exceptionInfo) => {
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

function parseRuntimeBridgeMessage(message: unknown, sessionId: string): BridgeEvent | null {
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
  if (!isBridgeEvent(envelope.event)) {
    return null;
  }
  return envelope.event;
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

    const event = parseRuntimeBridgeMessage(message, sessionId);
    if (!event) {
      return;
    }

    bridgeSubject?.next(event);
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
export async function initBridge(): Promise<void> {
  if (bridgeInitialized) return;
  bridgeInitialized = true;

  if (!bridgeSubject) {
    bridgeSubject = new ReplaySubject<BridgeEvent>(1);
  }

  const sessionId = createSessionId();
  activeSessionId = sessionId;

  try {
    attachRuntimeMessageListener(sessionId);

    // Inject the content script relay
    await injectContentScriptRelay(sessionId);

    // Inject the page-context bridge
    await injectPageBridge(sessionId);

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

  try {
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
  } catch (err) {
    console.warn("Failed to inject content script relay:", err);
  }
}

/**
 * Inject the page-context bridge via eval.
 * This subscribes to RxDB events and posts them via postMessage.
 */
async function injectPageBridge(sessionId: string): Promise<void> {
  const channelLiteral = JSON.stringify(BRIDGE_CHANNEL);
  const sessionLiteral = JSON.stringify(sessionId);
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
          channel: null,
          subscriptions: [],
          intervalId: null,
          heartbeat: 0,
          lastCollections: ''
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
        state.heartbeat = Date.now();
        return;
      }

      teardown();
      state.active = true;
      state.sessionId = sessionId;
      state.channel = channel;
      state.heartbeat = Date.now();
      state.lastCollections = '';

      function emit(type, payload) {
        root.postMessage({
          channel: channel,
          sessionId: sessionId,
          event: {
            type: type,
            payload: payload
          }
        }, '*');
      }

      function subscribeToCollections() {
        // Unsubscribe existing
        (state.subscriptions || []).forEach(function(subscription) {
          if (subscription && typeof subscription.unsubscribe === 'function') {
            subscription.unsubscribe();
          }
        });
        state.subscriptions = [];

        var db = root.__rxdb_handle;
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
        var db = root.__rxdb_handle;
        if (!db) {
          if (state.lastCollections !== '') {
            emit('RXDB_DESTROYED', null);
            state.lastCollections = '';
          }
          return;
        }

        var current = Object.keys(db.collections || {}).sort().join(',');
        if (current !== state.lastCollections) {
          state.lastCollections = current;
          emit('RXDB_COLLECTIONS_CHANGED', current ? current.split(',') : []);
          subscribeToCollections();
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
    evalInPage(`
      (function() {
        var state = window.__rxdb_debugger_bridge_state;
        if (!state || state.sessionId !== ${sessionLiteral}) return;
        state.heartbeat = Date.now();
      })();
    `).catch(() => {
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

  removeRuntimeMessageListener();
  const sessionId = activeSessionId;
  activeSessionId = null;

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
      state.channel = null;
      state.heartbeat = 0;
      state.lastCollections = '';
    })();
  `).catch(() => {
    // Page may have navigated, ignore
  });
}
