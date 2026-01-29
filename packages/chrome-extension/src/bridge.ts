import { Observable, Subject, ReplaySubject } from "rxjs";
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

let bridgeSubject: Subject<BridgeEvent> | null = null;
let bridgeInitialized = false;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

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

  // Listen for messages from the content script relay
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type?.startsWith("RXDB_")) {
      bridgeSubject?.next(msg as BridgeEvent);
    }
  });

  // Inject the content script relay
  await injectContentScriptRelay();

  // Inject the page-context bridge
  await injectPageBridge();

  // Start heartbeat to keep page bridge alive
  startHeartbeat();
}

/**
 * Inject the content script relay via chrome.scripting.executeScript.
 * This listens for postMessage events and forwards them to the extension.
 */
async function injectContentScriptRelay(): Promise<void> {
  const tabId = chrome.devtools.inspectedWindow.tabId;
  
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if ((window as unknown as { __rxdb_debugger_relay?: boolean }).__rxdb_debugger_relay) {
          return;
        }
        (window as unknown as { __rxdb_debugger_relay: boolean }).__rxdb_debugger_relay = true;
        
        window.addEventListener("message", (e) => {
          if (e.data?.type?.startsWith("RXDB_")) {
            chrome.runtime.sendMessage(e.data);
          }
        });
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
async function injectPageBridge(): Promise<void> {
  await evalInPage(`
    (function() {
      if (window.__rxdb_debugger_bridge) return;
      window.__rxdb_debugger_bridge = true;
      window.__rxdb_debugger_subscriptions = [];
      window.__rxdb_debugger_heartbeat = Date.now();
      window.__rxdb_debugger_lastCollections = '';

      function subscribeToCollections() {
        // Unsubscribe existing
        window.__rxdb_debugger_subscriptions.forEach(function(s) { s.unsubscribe(); });
        window.__rxdb_debugger_subscriptions = [];

        var db = window.__rxdb_handle;
        if (!db || !db.collections) return;

        Object.entries(db.collections).forEach(function(entry) {
          var name = entry[0];
          var col = entry[1];
          
          if (col && col.$) {
            var sub = col.$.subscribe(function(event) {
              window.postMessage({
                type: 'RXDB_CHANGE',
                payload: {
                  collection: name,
                  operation: event.operation,
                  documentId: event.documentId,
                  documentData: event.documentData || null,
                  previousDocumentData: event.previousDocumentData || null,
                  timestamp: Date.now()
                }
              }, '*');
            });
            window.__rxdb_debugger_subscriptions.push(sub);
          }
        });
      }

      function checkCollections() {
        var db = window.__rxdb_handle;
        if (!db) {
          if (window.__rxdb_debugger_lastCollections !== '') {
            window.postMessage({ type: 'RXDB_DESTROYED', payload: null }, '*');
            window.__rxdb_debugger_lastCollections = '';
          }
          return;
        }

        var current = Object.keys(db.collections || {}).sort().join(',');
        if (current !== window.__rxdb_debugger_lastCollections) {
          window.__rxdb_debugger_lastCollections = current;
          window.postMessage({ 
            type: 'RXDB_COLLECTIONS_CHANGED', 
            payload: current.split(',').filter(Boolean) 
          }, '*');
          subscribeToCollections();
        }
      }

      function checkHeartbeat() {
        if (Date.now() - window.__rxdb_debugger_heartbeat > 15000) {
          // Panel disconnected, cleanup
          window.__rxdb_debugger_subscriptions.forEach(function(s) { s.unsubscribe(); });
          window.__rxdb_debugger_subscriptions = [];
          window.__rxdb_debugger_bridge = false;
          clearInterval(window.__rxdb_debugger_interval);
        }
      }

      // Initial subscription
      subscribeToCollections();

      // Check for collection changes and heartbeat periodically
      window.__rxdb_debugger_interval = setInterval(function() {
        checkCollections();
        checkHeartbeat();
      }, 2000);
    })();
  `);
}

/**
 * Start the heartbeat to keep the page bridge alive.
 */
function startHeartbeat(): void {
  if (heartbeatInterval) return;
  
  heartbeatInterval = setInterval(() => {
    evalInPage("window.__rxdb_debugger_heartbeat = Date.now()").catch(() => {
      // Page may have navigated, ignore
    });
  }, 5000);
}

/**
 * Cleanup the bridge.
 */
export function disposeBridge(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  
  bridgeSubject?.complete();
  bridgeSubject = null;
  bridgeInitialized = false;
  
  // Cleanup page-side subscriptions
  evalInPage(`
    if (window.__rxdb_debugger_subscriptions) {
      window.__rxdb_debugger_subscriptions.forEach(function(s) { s.unsubscribe(); });
    }
    window.__rxdb_debugger_bridge = false;
    if (window.__rxdb_debugger_interval) {
      clearInterval(window.__rxdb_debugger_interval);
    }
  `).catch(() => {
    // Page may have navigated, ignore
  });
}
