import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getBridgeEvents, getCollectionChanges, initBridge, disposeBridge, type BridgeEvent, type ChangeEventPayload } from "../src/bridge";

const HEARTBEAT_INTERVAL_MS = 5000;
const COLLECTION_POLL_INTERVAL_MS = 2000;

type IntervalCallback = () => void;

interface FakePageWindow {
  __RXDB_DEBUGGER__?: {
    getInstanceHandle(instanceId: string): FakeDb | null;
  };
  __rxdb_debugger_bridge_state?: {
    active: boolean;
    sessionId: string | null;
    instanceId: string | null;
    subscriptions: Array<{ unsubscribe(): void }>;
    intervalId: ReturnType<typeof setInterval> | null;
    eventQueue: BridgeEvent[];
  };
}

interface FakeDb {
  token: string;
  collections: Record<string, FakeCollection>;
}

interface FakeCollectionEvent {
  operation: "INSERT" | "UPDATE" | "DELETE";
  documentId: string;
  documentData?: Record<string, unknown> | null;
  previousDocumentData?: Record<string, unknown> | null;
}

interface FakeCollection {
  readonly $: {
    subscribe(listener: (event: FakeCollectionEvent) => void): { unsubscribe(): void };
  };
  readonly subscribeCount: number;
  readonly unsubscribeCount: number;
  emit(event: FakeCollectionEvent): void;
}

interface TestHarness {
  page: FakePageWindow;
  db: FakeDb;
  heroes: FakeCollection;
  villains: FakeCollection;
  runIntervals(delayMs: number): Promise<void>;
}

const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;
let intervalIdCounter = 0;
let intervals: Map<number, { delayMs: number; callback: IntervalCallback }>;

function flushMicrotasks(): Promise<void> {
  return Promise.resolve().then(() => undefined);
}

function createFakeCollection(): FakeCollection {
  const listeners: Array<(event: FakeCollectionEvent) => void> = [];
  let subscribeCount = 0;
  let unsubscribeCount = 0;

  return {
    $: {
      subscribe(listener: (event: FakeCollectionEvent) => void) {
        subscribeCount += 1;
        listeners.push(listener);

        return {
          unsubscribe() {
            unsubscribeCount += 1;
            const idx = listeners.indexOf(listener);
            if (idx >= 0) {
              listeners.splice(idx, 1);
            }
          },
        };
      },
    },
    get subscribeCount() {
      return subscribeCount;
    },
    get unsubscribeCount() {
      return unsubscribeCount;
    },
    emit(event: FakeCollectionEvent) {
      for (const listener of [...listeners]) {
        listener(event);
      }
    },
  };
}

function installFakeIntervals(): void {
  intervals = new Map();
  intervalIdCounter = 0;

  (globalThis as typeof globalThis & { setInterval: typeof setInterval }).setInterval = ((callback: TimerHandler, delay?: number) => {
    intervalIdCounter += 1;
    const id = intervalIdCounter;
    intervals.set(id, {
      delayMs: Number(delay ?? 0),
      callback: () => {
        if (typeof callback === "function") {
          callback();
        }
      },
    });
    return id as unknown as ReturnType<typeof setInterval>;
  }) as typeof setInterval;

  (globalThis as typeof globalThis & { clearInterval: typeof clearInterval }).clearInterval = ((id?: ReturnType<typeof setInterval>) => {
    intervals.delete(Number(id));
  }) as typeof clearInterval;
}

function restoreFakeIntervals(): void {
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
  intervals.clear();
}

function evaluateInPage(page: FakePageWindow, expression: string): unknown {
  return Function("window", `"use strict"; let __result; __result = ${expression}; return __result;`)(page);
}

function installChromeMock(page: FakePageWindow, tabId = 7): void {
  (globalThis as typeof globalThis & { chrome: typeof chrome }).chrome = {
    devtools: {
      inspectedWindow: {
        tabId,
        eval: (expression: string, callback: (result?: unknown, exceptionInfo?: chrome.devtools.inspectedWindow.EvaluationExceptionInfo) => void) => {
          try {
            callback(evaluateInPage(page, expression), undefined);
          } catch (error) {
            callback(undefined, { value: error instanceof Error ? error.message : String(error) } as chrome.devtools.inspectedWindow.EvaluationExceptionInfo);
          }
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
      onMessage: {
        addListener: () => {},
        removeListener: () => {},
      },
      sendMessage: () => {},
    },
    scripting: {
      executeScript: async () => [],
    },
  } as unknown as typeof chrome;
}

function createHarness(): TestHarness {
  installFakeIntervals();

  const heroes = createFakeCollection();
  const villains = createFakeCollection();
  const db: FakeDb = {
    token: "db-token-1",
    collections: { heroes, villains },
  };
  const page: FakePageWindow = {
    __RXDB_DEBUGGER__: {
      getInstanceHandle(instanceId: string) {
        return instanceId === "instance-1" ? db : null;
      },
    },
  };

  installChromeMock(page);

  return {
    page,
    db,
    heroes,
    villains,
    async runIntervals(delayMs: number) {
      const callbacks = [...intervals.values()]
        .filter((entry) => entry.delayMs === delayMs)
        .map((entry) => entry.callback);

      for (const callback of callbacks) {
        callback();
      }

      await flushMicrotasks();
    },
  };
}

let harness: TestHarness;

beforeEach(() => {
  harness = createHarness();
});

afterEach(async () => {
  await disposeBridge();
  restoreFakeIntervals();
  delete (globalThis as typeof globalThis & { chrome?: typeof chrome }).chrome;
});

describe("bridge communication protocol", () => {
  test("drains queued events immediately after bridge initialization", async () => {
    const events: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });

    await initBridge("instance-1");

    expect(events).toEqual([
      {
        type: "RXDB_COLLECTIONS_CHANGED",
        payload: ["heroes", "villains"],
      },
    ]);

    subscription.unsubscribe();
  });

  test("drains queued page bridge events from the inspected RxDB instance", async () => {
    const events: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });

    await initBridge("instance-1");

    expect(harness.heroes.subscribeCount).toBe(1);
    expect(harness.villains.subscribeCount).toBe(1);

    await harness.runIntervals(HEARTBEAT_INTERVAL_MS);

    expect(events).toEqual([
      {
        type: "RXDB_COLLECTIONS_CHANGED",
        payload: ["heroes", "villains"],
      },
    ]);

    harness.heroes.emit({
      operation: "INSERT",
      documentId: "hero-1",
      documentData: { id: "hero-1", name: "Ada" },
      previousDocumentData: null,
    });

    await harness.runIntervals(HEARTBEAT_INTERVAL_MS);

    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      type: "RXDB_CHANGE",
      payload: {
        collection: "heroes",
        operation: "INSERT",
        documentId: "hero-1",
        documentData: { id: "hero-1", name: "Ada" },
        previousDocumentData: null,
      },
    });

    subscription.unsubscribe();
  });

  test("filters collection change streams by collection name", async () => {
    const heroChanges: ChangeEventPayload[] = [];
    const subscription = getCollectionChanges("heroes").subscribe((event) => {
      heroChanges.push(event);
    });

    await initBridge("instance-1");
    await harness.runIntervals(HEARTBEAT_INTERVAL_MS);

    harness.villains.emit({
      operation: "INSERT",
      documentId: "villain-1",
      documentData: { id: "villain-1" },
    });
    harness.heroes.emit({
      operation: "UPDATE",
      documentId: "hero-1",
      documentData: { id: "hero-1", power: "debugging" },
      previousDocumentData: { id: "hero-1" },
    });

    await harness.runIntervals(HEARTBEAT_INTERVAL_MS);

    expect(heroChanges).toHaveLength(1);
    expect(heroChanges[0]).toMatchObject({
      collection: "heroes",
      operation: "UPDATE",
      documentId: "hero-1",
    });

    subscription.unsubscribe();
  });

  test("tears down page subscriptions and intervals on dispose", async () => {
    const events: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });

    await initBridge("instance-1");
    await harness.runIntervals(HEARTBEAT_INTERVAL_MS);

    expect(harness.page.__rxdb_debugger_bridge_state?.active).toBe(true);
    expect(harness.heroes.unsubscribeCount).toBe(0);

    await disposeBridge();

    expect(harness.page.__rxdb_debugger_bridge_state?.active).toBe(false);
    expect(harness.page.__rxdb_debugger_bridge_state?.intervalId).toBeNull();
    expect(harness.heroes.unsubscribeCount).toBe(1);
    expect(harness.villains.unsubscribeCount).toBe(1);

    harness.heroes.emit({
      operation: "DELETE",
      documentId: "hero-1",
      previousDocumentData: { id: "hero-1" },
    });
    await harness.runIntervals(HEARTBEAT_INTERVAL_MS);

    expect(events).toHaveLength(1);
    subscription.unsubscribe();
  });

  test("reinitializes the bridge when connecting to a different instance", async () => {
    harness.page.__RXDB_DEBUGGER__ = {
      getInstanceHandle(instanceId: string) {
        if (instanceId === "instance-1") {
          return harness.db;
        }
        if (instanceId === "instance-2") {
          return {
            token: "db-token-2",
            collections: { sidekicks: createFakeCollection() },
          };
        }
        return null;
      },
    };

    await initBridge("instance-1");
    await disposeBridge();

    const events: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });

    await initBridge("instance-2");

    expect(events.at(-1)).toEqual({
      type: "RXDB_COLLECTIONS_CHANGED",
      payload: ["sidekicks"],
    });

    subscription.unsubscribe();
  });

  test("does not duplicate page subscriptions across reconnect cycles", async () => {
    await initBridge("instance-1");
    await disposeBridge();

    const events: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });

    await initBridge("instance-1");
    await harness.runIntervals(HEARTBEAT_INTERVAL_MS);

    harness.heroes.emit({
      operation: "INSERT",
      documentId: "hero-2",
      documentData: { id: "hero-2" },
    });

    await harness.runIntervals(HEARTBEAT_INTERVAL_MS);

    expect(harness.heroes.subscribeCount).toBe(2);
    expect(harness.heroes.unsubscribeCount).toBe(1);
    expect(events.filter((event) => event.type === "RXDB_CHANGE")).toHaveLength(1);

    subscription.unsubscribe();
  });

  test("emits destroyed when the inspected instance disappears during collection polling", async () => {
    const events: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });

    await initBridge("instance-1");
    await harness.runIntervals(HEARTBEAT_INTERVAL_MS);

    harness.page.__RXDB_DEBUGGER__ = {
      getInstanceHandle: () => null,
    };

    await harness.runIntervals(COLLECTION_POLL_INTERVAL_MS);
    await harness.runIntervals(HEARTBEAT_INTERVAL_MS);

    expect(events.at(-1)).toEqual({
      type: "RXDB_DESTROYED",
      payload: null,
    });

    subscription.unsubscribe();
  });
});
