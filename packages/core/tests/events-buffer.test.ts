import { describe, expect, test } from "bun:test";
import { firstValueFrom, Subject, take, toArray } from "rxjs";
import { createEventsService } from "../src/events.js";
import type { RxCollection, RxDatabase } from "rxdb/plugins/core";

function createMockDb(collection: RxCollection): RxDatabase {
  return {
    collections: {
      items: collection,
    },
  } as unknown as RxDatabase;
}

describe("createEventsService", () => {
  test("history returns every buffered event after a burst", async () => {
    const subject = new Subject<{
      operation: string;
      documentId: string;
      documentData?: Record<string, unknown>;
      previousDocumentData?: Record<string, unknown>;
    }>();
    const collection = {
      name: "items",
      $: subject.asObservable(),
    } as unknown as RxCollection;

    const events = createEventsService(async () => createMockDb(collection), 10);
    await events.history().get();

    subject.next({ operation: "INSERT", documentId: "a", documentData: { id: "a" } });
    subject.next({ operation: "INSERT", documentId: "b", documentData: { id: "b" } });
    subject.next({ operation: "INSERT", documentId: "c", documentData: { id: "c" } });

    const buffered = await events.history().get();
    expect(buffered.length).toBe(3);
    expect(buffered.map((entry) => entry.documentId).sort()).toEqual(["a", "b", "c"]);
  });

  test("stream emits each event in a burst", async () => {
    const subject = new Subject<{
      operation: string;
      documentId: string;
      documentData?: Record<string, unknown>;
    }>();
    const collection = {
      name: "items",
      $: subject.asObservable(),
    } as unknown as RxCollection;

    const events = createEventsService(async () => createMockDb(collection), 10);
    await events.history().get();

    const pending = firstValueFrom(
      events.stream().observe().pipe(take(3), toArray()),
    );
    await Promise.resolve();
    await Promise.resolve();

    subject.next({ operation: "INSERT", documentId: "x", documentData: { id: "x" } });
    subject.next({ operation: "INSERT", documentId: "y", documentData: { id: "y" } });
    subject.next({ operation: "INSERT", documentId: "z", documentData: { id: "z" } });

    const received = await pending;
    expect(received.map((entry) => entry.documentId)).toEqual(["x", "y", "z"]);
  });
});
