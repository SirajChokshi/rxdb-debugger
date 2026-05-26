import { describe, expect, test } from "bun:test";
import { Observable } from "rxjs";
import { createDocumentsService } from "../src/documents";
import { createEventsService, type ChangeEvent, type EventsService } from "../src/events";
import { createHistoryService, type HistoryService } from "../src/history";

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

describe("core observable lifecycle", () => {
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
