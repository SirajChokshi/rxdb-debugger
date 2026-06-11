import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  BRIDGE_POLL_INTERVAL_MS,
  COLLECTION_POLL_INTERVAL_MS,
  disposeBridge,
  getBridgeEvents,
  getCollectionChanges,
  getInventoryEvents,
  initBridge,
  type BridgeEvent,
  type ChangeEventPayload,
} from "../src/bridge";
import { createRemoteDatabase } from "../src/remote-db";

type IntervalCallback = () => void;

interface FakeBridgeState {
  active: boolean;
  sessionId: string | null;
  instanceId: string | null;
  subscriptions: Array<{ unsubscribe(): void }>;
  intervalId: ReturnType<typeof setInterval> | null;
  heartbeat: number;
  lastCollections: string;
  lastDatabaseToken: string;
  eventQueue: BridgeEvent[];
}

interface FakePageWindow {
  __RXDB_DEBUGGER__?: {
    getInstanceHandle(instanceId: string): FakeDb | null;
  };
  __rxdb_debugger_bridge_state?: FakeBridgeState;
  [key: string]: unknown;
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
  readonly docs: Array<Record<string, unknown>>;
  schema: { jsonSchema: Record<string, unknown> };
  find(): { exec(): Promise<Array<{ toJSON(withMeta?: boolean): Record<string, unknown> }>> };
  findOne(primary: string): { exec(): Promise<{ toJSON(withMeta?: boolean): Record<string, unknown> } | null> };
  count(): { exec(): Promise<number> };
  emit(event: FakeCollectionEvent): void;
}

interface TestHarness {
  page: FakePageWindow;
  dbs: Record<string, FakeDb>;
  db: FakeDb;
  heroes: FakeCollection;
  villains: FakeCollection;
  runIntervals(delayMs: number): Promise<void>;
}

const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;
let intervalIdCounter = 0;
let intervals: Map<number, { delayMs: number; callback: IntervalCallback }>;

/**
 * Yield one macrotask so every microtask chain spawned by interval callbacks
 * (eval promises, drains, self-heal re-injections) fully settles.
 * Note: only setInterval is faked in these tests; setTimeout stays real.
 */
function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createFakeCollection(initialDocs: Array<Record<string, unknown>> = []): FakeCollection {
  const listeners: Array<(event: FakeCollectionEvent) => void> = [];
  const docs = [...initialDocs];
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
    docs,
    schema: { jsonSchema: { primaryKey: "id", version: 0, indexes: [] } },
    find() {
      return {
        exec: async () => docs.map((doc) => ({ toJSON: () => doc })),
      };
    },
    findOne(primary: string) {
      return {
        exec: async () => {
          const doc = docs.find((entry) => entry.id === primary);
          return doc ? { toJSON: () => doc } : null;
        },
      };
    },
    count() {
      return { exec: async () => docs.length };
    },
    emit(event: FakeCollectionEvent) {
      for (const listener of [...listeners]) {
        listener(event);
      }
    },
  };
}

/**
 * Only the bridge's own poll cadences are faked (driven via runIntervals).
 * Everything else (RxJS scheduler timers like debounceTime, which also go
 * through setInterval) keeps using real timers.
 */
const FAKED_INTERVAL_DELAYS: ReadonlySet<number> = new Set([
  BRIDGE_POLL_INTERVAL_MS,
  COLLECTION_POLL_INTERVAL_MS,
]);

function installFakeIntervals(): void {
  intervals = new Map();
  // High offset so fake ids can never collide with real timer ids that
  // pass through to the original clearInterval.
  intervalIdCounter = 1_000_000;

  (globalThis as typeof globalThis & { setInterval: typeof setInterval }).setInterval = ((callback: TimerHandler, delay?: number, ...args: unknown[]) => {
    const delayMs = Number(delay ?? 0);
    if (!FAKED_INTERVAL_DELAYS.has(delayMs)) {
      return originalSetInterval(callback, delay as number, ...(args as []));
    }

    intervalIdCounter += 1;
    const id = intervalIdCounter;
    intervals.set(id, {
      delayMs,
      callback: () => {
        if (typeof callback === "function") {
          callback();
        }
      },
    });
    return id as unknown as ReturnType<typeof setInterval>;
  }) as typeof setInterval;

  (globalThis as typeof globalThis & { clearInterval: typeof clearInterval }).clearInterval = ((id?: ReturnType<typeof setInterval>) => {
    const numericId = Number(id);
    if (intervals.has(numericId)) {
      intervals.delete(numericId);
      return;
    }
    originalClearInterval(id);
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
            callback(undefined, {
              isException: true,
              value: error instanceof Error ? error.message : String(error),
            } as chrome.devtools.inspectedWindow.EvaluationExceptionInfo);
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

  const heroes = createFakeCollection([{ id: "hero-1", name: "Ada" }]);
  const villains = createFakeCollection();
  const db: FakeDb = {
    token: "db-token-1",
    collections: { heroes, villains },
  };

  const dbs: Record<string, FakeDb> = {
    "instance-1": db,
  };

  const page: FakePageWindow = {
    __RXDB_DEBUGGER__: {
      getInstanceHandle(instanceId: string) {
        return dbs[instanceId] ?? null;
      },
    },
  };

  installChromeMock(page);

  return {
    page,
    dbs,
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

      await settle();
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
  test("drains queued page bridge events from the inspected RxDB instance", async () => {
    const events: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });

    await initBridge("instance-1");

    expect(harness.heroes.subscribeCount).toBe(1);
    expect(harness.villains.subscribeCount).toBe(1);

    // Connecting establishes the baseline silently: no spurious initial
    // RXDB_COLLECTIONS_CHANGED for state the panel just fetched.
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);
    expect(events).toEqual([]);

    harness.heroes.emit({
      operation: "INSERT",
      documentId: "hero-1",
      documentData: { id: "hero-1", name: "Ada" },
      previousDocumentData: null,
    });

    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
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
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

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

    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

    expect(heroChanges).toHaveLength(1);
    expect(heroChanges[0]).toMatchObject({
      collection: "heroes",
      operation: "UPDATE",
      documentId: "hero-1",
    });

    subscription.unsubscribe();
  });

  test("does not replay past events to late subscribers", async () => {
    await initBridge("instance-1");

    harness.heroes.emit({
      operation: "INSERT",
      documentId: "hero-1",
      documentData: { id: "hero-1" },
    });
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

    // Subscribing after the event was drained must not deliver it again:
    // replaying stale changes caused phantom rows in the events panel and
    // double-counted live counts.
    const events: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });
    expect(events).toHaveLength(0);

    harness.heroes.emit({
      operation: "UPDATE",
      documentId: "hero-1",
      documentData: { id: "hero-1", power: "late" },
      previousDocumentData: { id: "hero-1" },
    });
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("RXDB_CHANGE");

    subscription.unsubscribe();
  });

  test("tears down page subscriptions and intervals on dispose", async () => {
    const events: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });

    await initBridge("instance-1");
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

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
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

    expect(events).toHaveLength(0);
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
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

    harness.heroes.emit({
      operation: "INSERT",
      documentId: "hero-2",
      documentData: { id: "hero-2" },
    });

    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

    expect(harness.heroes.subscribeCount).toBe(2);
    expect(harness.heroes.unsubscribeCount).toBe(1);
    expect(events.filter((event) => event.type === "RXDB_CHANGE")).toHaveLength(1);

    subscription.unsubscribe();
  });

  test("emits destroyed when the inspected instance disappears during collection polling", async () => {
    const events: BridgeEvent[] = [];
    const inventoryEvents: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });
    const inventorySubscription = getInventoryEvents().subscribe((event) => {
      inventoryEvents.push(event);
    });

    await initBridge("instance-1");
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

    harness.page.__RXDB_DEBUGGER__ = {
      getInstanceHandle: () => null,
    };

    await harness.runIntervals(COLLECTION_POLL_INTERVAL_MS);
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

    expect(events.at(-1)).toEqual({
      type: "RXDB_DESTROYED",
      payload: null,
    });
    expect(inventoryEvents.at(-1)).toEqual({
      type: "RXDB_DESTROYED",
      payload: null,
    });

    subscription.unsubscribe();
    inventorySubscription.unsubscribe();
  });

  test("emits collections changed when the collection set changes after connect", async () => {
    const events: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });

    await initBridge("instance-1");
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);
    expect(events).toEqual([]);

    const sidekicks = createFakeCollection();
    harness.db.collections.sidekicks = sidekicks;

    await harness.runIntervals(COLLECTION_POLL_INTERVAL_MS);
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

    expect(events).toEqual([
      {
        type: "RXDB_COLLECTIONS_CHANGED",
        payload: ["heroes", "sidekicks", "villains"],
      },
    ]);

    // The new collection's events are picked up after resubscription.
    sidekicks.emit({
      operation: "INSERT",
      documentId: "sidekick-1",
      documentData: { id: "sidekick-1" },
    });
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

    expect(events.at(-1)).toMatchObject({
      type: "RXDB_CHANGE",
      payload: { collection: "sidekicks", documentId: "sidekick-1" },
    });

    subscription.unsubscribe();
  });

  test("clears events queued for a previous session instead of leaking them", async () => {
    // Simulate leftovers from a previous panel session that was never
    // disposed cleanly (e.g. DevTools crashed): active page state with a
    // stale session id and queued events.
    harness.page.__rxdb_debugger_bridge_state = {
      active: true,
      sessionId: "stale-session",
      instanceId: "instance-1",
      subscriptions: [],
      intervalId: null,
      heartbeat: Date.now(),
      lastCollections: "heroes,villains",
      lastDatabaseToken: "db-token-1",
      eventQueue: [
        {
          type: "RXDB_CHANGE",
          payload: {
            collection: "heroes",
            operation: "INSERT",
            documentId: "stale-doc",
            documentData: { id: "stale-doc" },
            previousDocumentData: null,
            timestamp: Date.now() - 60000,
          },
        },
      ],
    };

    const events: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });

    await initBridge("instance-1");
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

    expect(events).toEqual([]);

    subscription.unsubscribe();
  });

  test("switching instances rewires the bridge and does not deliver old-instance events", async () => {
    const heroes2 = createFakeCollection();
    harness.dbs["instance-2"] = {
      token: "db-token-2",
      collections: { heroes: heroes2 },
    };

    await initBridge("instance-1");

    // Event queued for instance-1 but never drained before switching.
    harness.heroes.emit({
      operation: "INSERT",
      documentId: "hero-old",
      documentData: { id: "hero-old" },
    });

    await initBridge("instance-2");

    expect(harness.heroes.unsubscribeCount).toBe(1);
    expect(heroes2.subscribeCount).toBe(1);
    expect(harness.page.__rxdb_debugger_bridge_state?.instanceId).toBe("instance-2");

    const events: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });

    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);
    expect(events).toEqual([]);

    heroes2.emit({
      operation: "INSERT",
      documentId: "hero-new",
      documentData: { id: "hero-new" },
    });
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "RXDB_CHANGE",
      payload: { collection: "heroes", documentId: "hero-new" },
    });

    subscription.unsubscribe();
  });

  test("initBridge is idempotent for the same instance", async () => {
    await initBridge("instance-1");
    await initBridge("instance-1");
    await initBridge("instance-1");

    expect(harness.heroes.subscribeCount).toBe(1);
    expect(harness.heroes.unsubscribeCount).toBe(0);
  });

  test("self-heals when the page bridge state is lost (e.g. navigation)", async () => {
    const events: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });

    await initBridge("instance-1");
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);
    expect(harness.heroes.subscribeCount).toBe(1);

    // Page navigated: injected state is gone, subscriptions are dead.
    delete harness.page.__rxdb_debugger_bridge_state;

    // Next poll detects the missing state and re-injects.
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

    expect(harness.page.__rxdb_debugger_bridge_state?.active).toBe(true);
    expect(harness.heroes.subscribeCount).toBe(2);

    harness.heroes.emit({
      operation: "INSERT",
      documentId: "hero-after-heal",
      documentData: { id: "hero-after-heal" },
    });
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

    expect(events.at(-1)).toMatchObject({
      type: "RXDB_CHANGE",
      payload: { documentId: "hero-after-heal" },
    });

    subscription.unsubscribe();
  });

  test("concurrent init and dispose calls are serialized safely", async () => {
    const first = initBridge("instance-1");
    const disposed = disposeBridge();
    const second = initBridge("instance-1");

    await Promise.all([first, disposed, second]);

    // Exactly one live session at the end: page state active, and a single
    // working poll loop.
    expect(harness.page.__rxdb_debugger_bridge_state?.active).toBe(true);

    const events: BridgeEvent[] = [];
    const subscription = getBridgeEvents().subscribe((event) => {
      events.push(event);
    });

    harness.heroes.emit({
      operation: "INSERT",
      documentId: "hero-concurrent",
      documentData: { id: "hero-concurrent" },
    });
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

    expect(events).toHaveLength(1);
    subscription.unsubscribe();
  });
});

describe("remote database live observables", () => {
  test("query.$ emits the initial result and refetches when change events arrive", async () => {
    await initBridge("instance-1");
    const remoteDb = await createRemoteDatabase("instance-1") as {
      collections: Record<string, {
        find(): { $: { subscribe(next: (docs: unknown[]) => void): { unsubscribe(): void } } };
      }>;
    };

    const emissions: unknown[][] = [];
    const subscription = remoteDb.collections.heroes!.find().$.subscribe((docs) => {
      emissions.push(docs);
    });

    await sleep(20);
    expect(emissions).toHaveLength(1);
    expect(emissions[0]).toHaveLength(1);

    // A document is added on the page and the change event is drained.
    harness.heroes.docs.push({ id: "hero-2", name: "Grace" });
    harness.heroes.emit({
      operation: "INSERT",
      documentId: "hero-2",
      documentData: { id: "hero-2", name: "Grace" },
    });
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);

    // Refetch happens after the debounce window.
    await sleep(250);

    expect(emissions).toHaveLength(2);
    expect(emissions[1]).toHaveLength(2);

    subscription.unsubscribe();
  });

  test("count().$ recounts from the page when change events arrive", async () => {
    await initBridge("instance-1");
    const remoteDb = await createRemoteDatabase("instance-1") as {
      collections: Record<string, {
        count(): { $: { subscribe(next: (count: number) => void): { unsubscribe(): void } } };
      }>;
    };

    const counts: number[] = [];
    const subscription = remoteDb.collections.heroes!.count().$.subscribe((count) => {
      counts.push(count);
    });

    // Initial count is emitted synchronously from the connect-time snapshot.
    expect(counts[0]).toBe(1);

    harness.heroes.docs.push({ id: "hero-2" });
    harness.heroes.emit({
      operation: "INSERT",
      documentId: "hero-2",
      documentData: { id: "hero-2" },
    });
    await harness.runIntervals(BRIDGE_POLL_INTERVAL_MS);
    await sleep(250);

    expect(counts.at(-1)).toBe(2);

    subscription.unsubscribe();
  });
});
