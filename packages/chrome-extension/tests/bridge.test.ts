import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getBridgeEvents, initBridge, disposeBridge, type BridgeEvent } from "../src/bridge";

type RuntimeListener = (message: unknown, sender: chrome.runtime.MessageSender) => void;

interface ChromeMockState {
  listeners: RuntimeListener[];
  getActiveSessionId: () => string;
  dispatchRuntimeMessage: (message: unknown, tabId?: number) => void;
}

function createChromeMock(tabId: number = 7): ChromeMockState {
  const listeners: RuntimeListener[] = [];
  let activeSessionId = "";

  const runtimeOnMessage = {
    addListener(listener: RuntimeListener) {
      listeners.push(listener);
    },
    removeListener(listener: RuntimeListener) {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) {
        listeners.splice(idx, 1);
      }
    },
  };

  (globalThis as typeof globalThis & { chrome: typeof chrome }).chrome = {
    devtools: {
      inspectedWindow: {
        tabId,
        eval: (_expression: string, callback: (result?: unknown, exceptionInfo?: chrome.devtools.inspectedWindow.EvaluationExceptionInfo) => void) => {
          callback(undefined, undefined);
        },
      },
      network: {
        onNavigated: {
          addListener: () => {},
          removeListener: () => {},
        },
      },
      panels: {
        create: () => {},
        themeName: "default",
      },
    },
    runtime: {
      onMessage: runtimeOnMessage,
      sendMessage: () => {},
    },
    scripting: {
      executeScript: async (injection) => {
        activeSessionId = String(injection.args?.[1] ?? "");
      },
    },
  } as unknown as typeof chrome;

  return {
    listeners,
    getActiveSessionId: () => activeSessionId,
    dispatchRuntimeMessage: (message: unknown, messageTabId = tabId) => {
      listeners.forEach((listener) => {
        listener(message, { tab: { id: messageTabId } } as chrome.runtime.MessageSender);
      });
    },
  };
}

let mockState: ChromeMockState;

beforeEach(() => {
  mockState = createChromeMock();
});

afterEach(async () => {
  await disposeBridge();
});

describe("bridge communication protocol", () => {
  test("filters runtime messages by tab and session", async () => {
    const events: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });

    await initBridge("instance-main");
    const sessionId = mockState.getActiveSessionId();

    mockState.dispatchRuntimeMessage({
      channel: "RXDB_DEBUGGER_BRIDGE",
      sessionId,
      event: {
        type: "RXDB_CHANGE",
        payload: { collection: "heroes" },
      },
    }, 99);

    mockState.dispatchRuntimeMessage({
      channel: "RXDB_DEBUGGER_BRIDGE",
      sessionId: "stale-session",
      event: {
        type: "RXDB_CHANGE",
        payload: { collection: "heroes" },
      },
    });

    mockState.dispatchRuntimeMessage({
      channel: "RXDB_DEBUGGER_BRIDGE",
      sessionId,
      event: {
        type: "RXDB_CHANGE",
        payload: { collection: "heroes" },
      },
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "RXDB_CHANGE",
      payload: { collection: "heroes" },
    });

    subscription.unsubscribe();
  });

  test("removes runtime message listeners on dispose", async () => {
    await initBridge("instance-main");
    expect(mockState.listeners).toHaveLength(1);

    await disposeBridge();
    expect(mockState.listeners).toHaveLength(0);
  });

  test("does not duplicate events across reconnect cycles", async () => {
    await initBridge("instance-main");
    await disposeBridge();
    await initBridge("instance-main");

    const sessionId = mockState.getActiveSessionId();
    const events: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });

    mockState.dispatchRuntimeMessage({
      channel: "RXDB_DEBUGGER_BRIDGE",
      sessionId,
      event: {
        type: "RXDB_COLLECTIONS_CHANGED",
        payload: ["heroes"],
      },
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("RXDB_COLLECTIONS_CHANGED");

    subscription.unsubscribe();
  });

  test("supports batched runtime bridge payloads", async () => {
    const events: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });

    await initBridge("instance-main");
    const sessionId = mockState.getActiveSessionId();

    mockState.dispatchRuntimeMessage({
      channel: "RXDB_DEBUGGER_BRIDGE",
      sessionId,
      event: [
        {
          type: "RXDB_COLLECTIONS_CHANGED",
          payload: ["heroes"],
        },
        {
          type: "RXDB_DESTROYED",
          payload: null,
        },
      ],
    });

    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe("RXDB_COLLECTIONS_CHANGED");
    expect(events[1]?.type).toBe("RXDB_DESTROYED");

    subscription.unsubscribe();
  });
});
