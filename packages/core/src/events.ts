import type { RxChangeEvent, RxCollection, RxDatabase } from "rxdb/plugins/core";
import { Observable, Subject, BehaviorSubject } from "rxjs";
import { filter, map, take, takeUntil } from "rxjs/operators";
import { getDebuggerDatabaseExtensions } from "./database-extensions.js";
import { createStaticQuery, type ExplorerQuery } from "./query.js";
import { SharedAsyncInitializer } from "./shared-lifecycle.js";

/**
 * Types of document operations.
 */
export type OperationType = "INSERT" | "UPDATE" | "DELETE";

/**
 * A document change event.
 */
export interface ChangeEvent {
  /** Unique event ID */
  id: string;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Collection name */
  collection: string;
  /** Document primary key */
  documentId: string;
  /** Type of operation */
  operation: OperationType;
  /** Current document data (null for deletes) */
  data: Record<string, unknown> | null;
  /** Previous document data (null for inserts) */
  previousData: Record<string, unknown> | null;
}

/**
 * Options for event streaming.
 */
export interface EventStreamOptions {
  /** Filter to specific collections */
  collections?: string[];
  /** Filter to specific operations */
  operations?: OperationType[];
}

/**
 * Options for event history.
 */
export interface EventHistoryOptions {
  /** Maximum number of events to return */
  limit?: number;
  /** Filter to specific collections */
  collections?: string[];
  /** Filter to specific operations */
  operations?: OperationType[];
}

/**
 * Service for streaming and tracking document changes.
 */
export interface EventsService {
  /**
   * Subscribe to live document change events.
   */
  stream(options?: EventStreamOptions): ExplorerQuery<ChangeEvent>;

  /**
   * Get buffered event history.
   */
  history(options?: EventHistoryOptions): ExplorerQuery<ChangeEvent[]>;

  /**
   * Get current event count.
   */
  count(): ExplorerQuery<number>;

  /**
   * Clear event history buffer.
   */
  clear(): void;

  /**
   * Pause event collection.
   */
  pause(): void;

  /**
   * Resume event collection.
   */
  resume(): void;

  /**
   * Check if event collection is paused.
   */
  isPaused(): boolean;

  /**
   * Dispose the service and stop all subscriptions.
   */
  dispose(): void;
}

/**
 * Generate a unique event ID.
 */
function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Map RxDB operation to our operation type.
 */
function mapOperation(operation: string): OperationType {
  switch (operation) {
    case "INSERT":
      return "INSERT";
    case "UPDATE":
      return "UPDATE";
    case "DELETE":
      return "DELETE";
    default:
      return "UPDATE";
  }
}

/**
 * Convert an RxDB change event to our ChangeEvent format.
 */
function toChangeEvent(
  rxEvent: RxChangeEvent<unknown>,
  collectionName: string,
): ChangeEvent {
  const operation = mapOperation(rxEvent.operation);
  const documentData = rxEvent.documentData as Record<string, unknown> | undefined;
  const previousDocumentData = rxEvent.previousDocumentData as Record<string, unknown> | undefined;
  const eventWithEnd = rxEvent as { endTime?: number };

  return {
    id: generateEventId(),
    timestamp: eventWithEnd.endTime ?? Date.now(),
    collection: collectionName,
    documentId: rxEvent.documentId,
    operation,
    data: operation === "DELETE" ? null : (documentData ?? null),
    previousData: operation === "INSERT" ? null : (previousDocumentData ?? null),
  };
}

/**
 * Create the events service for a database.
 */
export function createEventsService(
  getDb: () => Promise<RxDatabase>,
  bufferSize: number = 100,
): EventsService {
  const destroy$ = new Subject<void>();
  const paused$ = new BehaviorSubject<boolean>(false);
  const eventBuffer: ChangeEvent[] = [];
  const eventSubject = new Subject<ChangeEvent>();

  const lifecycle = new SharedAsyncInitializer();
  let collectionSubscriptions: { unsubscribe: () => void }[] = [];
  let extensionSubscriptions: { unsubscribe: () => void }[] = [];
  let watchedCollectionKey = "";

  const clearCollectionSubscriptions = (): void => {
    for (const sub of collectionSubscriptions) {
      sub.unsubscribe();
    }
    collectionSubscriptions = [];
  };

  const clearExtensionSubscriptions = (): void => {
    for (const sub of extensionSubscriptions) {
      sub.unsubscribe();
    }
    extensionSubscriptions = [];
  };

  const subscribeToCollections = (db: RxDatabase, shouldContinue: () => boolean): void => {
    const nextKey = Object.keys(db.collections).sort().join(",");
    if (nextKey === watchedCollectionKey) {
      return;
    }

    clearCollectionSubscriptions();
    watchedCollectionKey = nextKey;

    if (!shouldContinue()) {
      return;
    }

    for (const [name, collection] of Object.entries(db.collections)) {
      const col = collection as RxCollection;
      const sub = col.$.pipe(
        takeUntil(destroy$),
        filter(() => !paused$.value),
        map((event) => toChangeEvent(event, name)),
      ).subscribe((event) => {
        eventBuffer.push(event);
        while (eventBuffer.length > bufferSize) {
          eventBuffer.shift();
        }
        eventSubject.next(event);
      });
      collectionSubscriptions.push(sub);
    }
  };

  const initialize = async (force = false): Promise<void> => {
    await lifecycle.ensureStarted(async ({ shouldContinue }) => {
      const db = await getDb();
      if (!shouldContinue()) {
        return;
      }

      subscribeToCollections(db, shouldContinue);

      const extensions = getDebuggerDatabaseExtensions(db);
      if (extensions?.onCollectionsChanged) {
        const collectionsChangedSub = extensions.onCollectionsChanged
          .pipe(takeUntil(destroy$))
          .subscribe(() => {
            if (!shouldContinue()) {
              return;
            }
            subscribeToCollections(db, shouldContinue);
          });
        extensionSubscriptions.push(collectionsChangedSub);
      }

    }, { force });
  };

  return {
    stream(options: EventStreamOptions = {}): ExplorerQuery<ChangeEvent> {
      const { collections, operations } = options;

      const source$ = new Observable<ChangeEvent>((subscriber) => {
        let unsubscribed = false;
        const release = lifecycle.retain();
        const innerSub = eventSubject
          .pipe(
            filter((event) => {
              if (collections && !collections.includes(event.collection)) {
                return false;
              }
              if (operations && !operations.includes(event.operation)) {
                return false;
              }
              return true;
            }),
          )
          .subscribe(subscriber);

        initialize().catch((err) => {
          if (!unsubscribed && !subscriber.closed) {
            subscriber.error(err);
          }
        });

        return () => {
          innerSub.unsubscribe();
          unsubscribed = true;
          release();
        };
      });

      return {
        async get(): Promise<ChangeEvent> {
          return new Promise((resolve, reject) => {
            source$.pipe(take(1)).subscribe({
              next: resolve,
              error: reject,
            });
          });
        },
        observe(): Observable<ChangeEvent> {
          return source$;
        },
      };
    },

    history(options: EventHistoryOptions = {}): ExplorerQuery<ChangeEvent[]> {
      const { limit, collections, operations } = options;

      return createStaticQuery(async () => {
        await initialize(true);

        let events = [...eventBuffer];

        if (collections) {
          events = events.filter((e) => collections.includes(e.collection));
        }
        if (operations) {
          events = events.filter((e) => operations.includes(e.operation));
        }

        events.reverse();

        if (limit && limit > 0) {
          events = events.slice(0, limit);
        }

        return events;
      });
    },

    count(): ExplorerQuery<number> {
      return createStaticQuery(async () => {
        await initialize(true);
        return eventBuffer.length;
      });
    },

    clear(): void {
      eventBuffer.length = 0;
    },

    pause(): void {
      paused$.next(true);
    },

    resume(): void {
      paused$.next(false);
    },

    isPaused(): boolean {
      return paused$.value;
    },

    dispose(): void {
      lifecycle.dispose(() => {
        destroy$.next();
        destroy$.complete();
        paused$.complete();
        eventSubject.complete();
        watchedCollectionKey = "";
        clearCollectionSubscriptions();
        clearExtensionSubscriptions();
      });
    },
  };
}
