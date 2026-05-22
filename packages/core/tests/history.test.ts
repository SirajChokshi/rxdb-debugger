import { describe, expect, test } from "bun:test";
import { Subject } from "rxjs";
import { createHistoryService } from "../src/history.js";
import type { ChangeEvent, EventsService } from "../src/events.js";

function createMockEventsService(): {
  service: EventsService;
  emit: (event: ChangeEvent) => void;
} {
  const subject = new Subject<ChangeEvent>();
  const service: EventsService = {
    stream: () => ({
      get: () => Promise.reject(new Error("not implemented")),
      observe: () => subject.asObservable(),
    }),
    history: () => {
      throw new Error("not implemented");
    },
    count: () => {
      throw new Error("not implemented");
    },
    clear: () => {},
    pause: () => {},
    resume: () => {},
    isPaused: () => false,
    dispose: () => {
      subject.complete();
    },
  };

  return {
    service,
    emit: (event) => subject.next(event),
  };
}

describe("createHistoryService", () => {
  test("stores DELETE versions with null data", async () => {
    const { service, emit } = createMockEventsService();
    const history = createHistoryService(service);

    emit({
      id: "evt-1",
      timestamp: 1000,
      collection: "users",
      documentId: "user-1",
      operation: "DELETE",
      data: null,
      previousData: { name: "Ada" },
    });

    const versions = await history.getVersions("users", "user-1").get();
    expect(versions).toHaveLength(1);
    expect(versions[0]?.operation).toBe("DELETE");
    expect(versions[0]?.data).toBeNull();
  });

  test("stores INSERT versions with document data", async () => {
    const { service, emit } = createMockEventsService();
    const history = createHistoryService(service);

    emit({
      id: "evt-2",
      timestamp: 2000,
      collection: "users",
      documentId: "user-2",
      operation: "INSERT",
      data: { name: "Grace" },
      previousData: null,
    });

    const versions = await history.getVersions("users", "user-2").get();
    expect(versions[0]?.data).toEqual({ name: "Grace" });
  });
});
