import { describe, expect, test } from "bun:test";
import { REPLICATION_STATE_BY_COLLECTION } from "rxdb/plugins/replication";
import { config, Observable, Subject } from "rxjs";
import { createDocumentsService } from "../src/documents";
import { createEventsService, type ChangeEvent, type EventsService } from "../src/events";
import { createHistoryService, type HistoryService } from "../src/history";
import { createReplicationService, type ReplicationStateSnapshot } from "../src/replication";
import { SharedAsyncInitializer } from "../src/shared-lifecycle.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function flushStoppedNotifications(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("core observable lifecycle", () => {
  test("keeps shared initializer disposed after in-flight startup resolves", async () => {
    const startup = deferred<void>();
    const lifecycle = new SharedAsyncInitializer();
    const release = lifecycle.retain();
    let startCount = 0;

    const firstStart = lifecycle.ensureStarted(async () => {
      startCount += 1;
      await startup.promise;
    });

    lifecycle.dispose();
    startup.resolve();
    await firstStart;

    await lifecycle.ensureStarted(async () => {
      startCount += 1;
    }, { force: true });

    release();

    expect(startCount).toBe(1);
  });

  test("does not subscribe to live document queries after the outer subscriber is disposed", async () => {
    const dbDeferred = deferred<unknown>();
    let querySubscribeCount = 0;
    let queryUnsubscribeCount = 0;

    const liveQuery$ = new Observable<unknown[]>((subscriber) => {
      querySubscribeCount += 1;
      subscriber.next([]);
      return () => {
        queryUnsubscribeCount += 1;
      };
    });

    const db = {
      collections: {
        heroes: {
          find: () => ({ $: liveQuery$ }),
        },
      },
    };

    const service = createDocumentsService(() => dbDeferred.promise as Promise<never>);
    const subscription = service.list("heroes", { live: true }).observe().subscribe();

    subscription.unsubscribe();
    dbDeferred.resolve(db);
    await flushMicrotasks();

    expect(querySubscribeCount).toBe(0);
    expect(queryUnsubscribeCount).toBe(0);
  });

  test("does not initialize collection event streams after the event subscriber is disposed", async () => {
    const dbDeferred = deferred<unknown>();
    let collectionSubscribeCount = 0;
    let collectionUnsubscribeCount = 0;

    const collection$ = new Observable<unknown>(() => {
      collectionSubscribeCount += 1;
      return () => {
        collectionUnsubscribeCount += 1;
      };
    });

    const db = {
      collections: {
        heroes: {
          $: collection$,
        },
      },
    };

    const service = createEventsService(() => dbDeferred.promise as Promise<never>);
    const subscription = service.stream().observe().subscribe();

    subscription.unsubscribe();
    dbDeferred.resolve(db);
    await flushMicrotasks();

    expect(collectionSubscribeCount).toBe(0);
    expect(collectionUnsubscribeCount).toBe(0);

    service.dispose();
  });

  test("keeps event infrastructure alive when a concurrent subscriber remains active", async () => {
    const dbDeferred = deferred<unknown>();
    const collectionEvents$ = new Subject<unknown>();
    const receivedEvents: ChangeEvent[] = [];
    let collectionSubscribeCount = 0;

    const collection$ = new Observable<unknown>((subscriber) => {
      collectionSubscribeCount += 1;
      return collectionEvents$.subscribe(subscriber);
    });

    const db = {
      collections: {
        heroes: {
          $: collection$,
        },
      },
    };

    const service = createEventsService(() => dbDeferred.promise as Promise<never>);
    const firstSubscription = service.stream().observe().subscribe();
    const secondSubscription = service.stream().observe().subscribe((event) => {
      receivedEvents.push(event);
    });

    firstSubscription.unsubscribe();
    dbDeferred.resolve(db);
    await flushMicrotasks();

    collectionEvents$.next({
      operation: "INSERT",
      documentId: "hero-1",
      documentData: { id: "hero-1" },
    });

    expect(collectionSubscribeCount).toBe(1);
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0]).toMatchObject({
      collection: "heroes",
      operation: "INSERT",
      documentId: "hero-1",
      data: { id: "hero-1" },
    });

    secondSubscription.unsubscribe();
    service.dispose();
  });

  test("does not start event infrastructure when all concurrent subscribers leave before startup resolves", async () => {
    const dbDeferred = deferred<unknown>();
    let collectionSubscribeCount = 0;

    const collection$ = new Observable<unknown>(() => {
      collectionSubscribeCount += 1;
    });

    const db = {
      collections: {
        heroes: {
          $: collection$,
        },
      },
    };

    const service = createEventsService(() => dbDeferred.promise as Promise<never>);
    const firstSubscription = service.stream().observe().subscribe();
    const secondSubscription = service.stream().observe().subscribe();

    firstSubscription.unsubscribe();
    secondSubscription.unsubscribe();
    dbDeferred.resolve(db);
    await flushMicrotasks();

    expect(collectionSubscribeCount).toBe(0);

    service.dispose();
  });

  test("keeps replication discovery alive when a concurrent subscriber remains active", async () => {
    const dbDeferred = deferred<unknown>();
    const active$ = new Subject<boolean>();
    const snapshots: ReplicationStateSnapshot[][] = [];
    const collection = {};
    const replicationState = {
      replicationIdentifier: "heroes-sync",
      live: true,
      active$,
      isPaused: () => false,
      isStopped: () => false,
    };
    const db = {
      collections: {
        heroes: collection,
      },
    };

    (REPLICATION_STATE_BY_COLLECTION as unknown as WeakMap<object, unknown[]>).set(
      collection,
      [replicationState],
    );

    const service = createReplicationService(() => dbDeferred.promise as Promise<never>);
    const firstSubscription = service.states({ live: true }).observe().subscribe();
    const secondSubscription = service.states({ live: true }).observe().subscribe((value) => {
      snapshots.push(value);
    });

    firstSubscription.unsubscribe();
    dbDeferred.resolve(db);
    await flushMicrotasks();

    active$.next(true);
    await flushMicrotasks();

    expect(snapshots.some((value) =>
      value.some((snapshot) =>
        snapshot.collection === "heroes"
        && snapshot.replicationIdentifier === "heroes-sync"
        && snapshot.isActive
      )
    )).toBe(true);

    secondSubscription.unsubscribe();
    service.dispose();
  });

  test("does not start replication discovery when all concurrent subscribers leave before startup resolves", async () => {
    const dbDeferred = deferred<unknown>();
    let activeSubscribeCount = 0;
    const active$ = new Observable<boolean>(() => {
      activeSubscribeCount += 1;
    });
    const collection = {};
    const replicationState = {
      replicationIdentifier: "heroes-sync",
      live: true,
      active$,
      isPaused: () => false,
      isStopped: () => false,
    };
    const db = {
      collections: {
        heroes: collection,
      },
    };

    (REPLICATION_STATE_BY_COLLECTION as unknown as WeakMap<object, unknown[]>).set(
      collection,
      [replicationState],
    );

    const service = createReplicationService(() => dbDeferred.promise as Promise<never>);
    const firstSubscription = service.states({ live: true }).observe().subscribe();
    const secondSubscription = service.states({ live: true }).observe().subscribe();

    firstSubscription.unsubscribe();
    secondSubscription.unsubscribe();
    dbDeferred.resolve(db);
    await flushMicrotasks();

    expect(activeSubscribeCount).toBe(0);

    service.dispose();
  });

  test("does not leak stopped replication snapshot subscribers after snapshot get", async () => {
    const previousHandler = config.onStoppedNotification;
    const stoppedKinds: string[] = [];
    config.onStoppedNotification = (notification) => {
      stoppedKinds.push(notification.kind);
    };

    try {
      const active$ = new Subject<boolean>();
      const collection = {};
      const replicationState = {
        replicationIdentifier: "heroes-sync",
        live: true,
        active$,
        isPaused: () => false,
        isStopped: () => false,
      };
      const db = {
        collections: {
          heroes: collection,
        },
      };

      (REPLICATION_STATE_BY_COLLECTION as unknown as WeakMap<object, unknown[]>).set(
        collection,
        [replicationState],
      );

      const service = createReplicationService(async () => db as never);

      await service.states().get();
      active$.next(true);
      await flushStoppedNotifications();

      expect(stoppedKinds).toEqual([]);

      service.dispose();
    } finally {
      config.onStoppedNotification = previousHandler;
    }
  });

  test("does not report replication initialization errors after unsubscribe", async () => {
    const previousHandler = config.onStoppedNotification;
    const stoppedKinds: string[] = [];
    const startup = deferred<never>();

    config.onStoppedNotification = (notification) => {
      stoppedKinds.push(notification.kind);
    };

    try {
      const service = createReplicationService(() => startup.promise);
      const subscription = service.states({ live: true }).observe().subscribe();

      subscription.unsubscribe();
      startup.reject(new Error("db failed"));
      await flushMicrotasks();
      await flushStoppedNotifications();

      expect(stoppedKinds).toEqual([]);

      service.dispose();
    } finally {
      config.onStoppedNotification = previousHandler;
    }
  });

  test("starts history tracking lazily and disposes its stream subscription", async () => {
    let streamSubscribeCount = 0;
    let streamUnsubscribeCount = 0;

    const eventsService = {
      stream() {
        return {
          get: async () => {
            throw new Error("not used");
          },
          observe: () =>
            new Observable<ChangeEvent>(() => {
              streamSubscribeCount += 1;
              return () => {
                streamUnsubscribeCount += 1;
              };
            }),
        };
      },
    } as EventsService;

    const history = createHistoryService(eventsService) as HistoryService & { dispose(): void };

    expect(streamSubscribeCount).toBe(0);

    await history.getAllVersions().get();

    expect(streamSubscribeCount).toBe(1);

    history.dispose();

    expect(streamUnsubscribeCount).toBe(1);
  });
});
