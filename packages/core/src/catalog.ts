import type { RxCollection, RxDatabase, RxJsonSchema } from "rxdb/plugins/core";
import { combineLatest, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { createQuery, type ExplorerQuery, type LiveOptions } from "./query.js";

const COLLECTION_SYNC_INTERVAL_MS = 2000;

/**
 * Information about a single collection.
 */
export interface CollectionInfo {
  /** Collection name */
  name: string;
  /** Primary key field name */
  primaryKey: string;
  /** JSON Schema definition */
  schema: RxJsonSchema<unknown>;
  /** Schema version */
  schemaVersion: number;
  /** Index definitions */
  indexes: string[][];
  /** Current document count */
  count: number;
}

/**
 * Service for exploring database collections.
 */
export interface CatalogService {
  /**
   * Get information about all collections.
   */
  collections(options?: LiveOptions): ExplorerQuery<CollectionInfo[]>;

  /**
   * Get information about a specific collection.
   */
  collection(
    name: string,
    options?: LiveOptions,
  ): ExplorerQuery<CollectionInfo | null>;

  /**
   * Get collection names only.
   */
  collectionNames(): ExplorerQuery<string[]>;
}

/**
 * Extract static metadata from a collection (doesn't change at runtime).
 */
function getStaticCollectionInfo(
  collection: RxCollection,
): Omit<CollectionInfo, "count"> {
  const schema = collection.schema.jsonSchema;
  const primaryKey =
    typeof schema.primaryKey === "string"
      ? schema.primaryKey
      : (schema.primaryKey?.key ?? "id");

  const indexes: string[][] = [];
  if (schema.indexes) {
    for (const idx of schema.indexes) {
      if (typeof idx === "string") {
        indexes.push([idx]);
      } else if (Array.isArray(idx)) {
        indexes.push(idx as string[]);
      }
    }
  }

  return {
    name: collection.name,
    primaryKey,
    schema,
    schemaVersion: schema.version ?? 0,
    indexes,
  };
}

/**
 * Create an observable that emits CollectionInfo with live count updates.
 */
function createCollectionInfoObservable(
  collection: RxCollection,
): Observable<CollectionInfo> {
  const staticInfo = getStaticCollectionInfo(collection);

  return collection.count().$.pipe(
    map((count) => ({
      ...staticInfo,
      count,
    })),
  );
}

/**
 * Create an observable for all collections info with live count updates.
 * Re-subscribes when collections are added or removed at runtime.
 */
function createAllCollectionsObservable(
  db: RxDatabase,
): Observable<CollectionInfo[]> {
  return new Observable<CollectionInfo[]>((subscriber) => {
    let innerSub: { unsubscribe: () => void } | null = null;
    let lastCollectionKeys = "";

    const syncCollections = (): void => {
      const collectionEntries = Object.entries(db.collections);
      const nextKeys = collectionEntries
        .map(([name]) => name)
        .sort()
        .join(",");

      if (nextKeys === lastCollectionKeys && innerSub) {
        return;
      }

      lastCollectionKeys = nextKeys;
      innerSub?.unsubscribe();

      if (collectionEntries.length === 0) {
        subscriber.next([]);
        return;
      }

      const collectionInfos$ = collectionEntries.map(([_, collection]) =>
        createCollectionInfoObservable(collection as RxCollection),
      );

      innerSub = combineLatest(collectionInfos$)
        .pipe(map((infos) => infos.sort((a, b) => a.name.localeCompare(b.name))))
        .subscribe(subscriber);
    };

    syncCollections();
    const intervalId = setInterval(syncCollections, COLLECTION_SYNC_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      innerSub?.unsubscribe();
    };
  });
}

/**
 * Create the catalog service for a database.
 */
export function createCatalogService(
  getDb: () => Promise<RxDatabase>,
): CatalogService {
  return {
    collections(options: LiveOptions = {}): ExplorerQuery<CollectionInfo[]> {
      const source$ = new Observable<CollectionInfo[]>((subscriber) => {
        let innerSub: { unsubscribe: () => void } | null = null;

        getDb()
          .then((db) => {
            innerSub = createAllCollectionsObservable(db).subscribe(subscriber);
          })
          .catch((err) => subscriber.error(err));

        return () => {
          innerSub?.unsubscribe();
        };
      });

      return createQuery(source$, options);
    },

    collection(
      name: string,
      options: LiveOptions = {},
    ): ExplorerQuery<CollectionInfo | null> {
      const source$ = new Observable<CollectionInfo | null>((subscriber) => {
        let innerSub: { unsubscribe: () => void } | null = null;

        getDb()
          .then((db) => {
            const collection = db.collections[name] as RxCollection | undefined;
            if (!collection) {
              subscriber.next(null);
              subscriber.complete();
              return;
            }

            innerSub =
              createCollectionInfoObservable(collection).subscribe(subscriber);
          })
          .catch((err) => subscriber.error(err));

        return () => {
          innerSub?.unsubscribe();
        };
      });

      return createQuery(source$, options);
    },

    collectionNames(): ExplorerQuery<string[]> {
      const source$ = new Observable<string[]>((subscriber) => {
        let intervalId: ReturnType<typeof setInterval> | null = null;
        let lastKeys = "";

        getDb()
          .then((db) => {
            const emitNames = (): void => {
              const names = Object.keys(db.collections).sort();
              const nextKeys = names.join(",");
              if (nextKeys === lastKeys) {
                return;
              }
              lastKeys = nextKeys;
              subscriber.next(names);
            };

            emitNames();
            intervalId = setInterval(emitNames, COLLECTION_SYNC_INTERVAL_MS);
          })
          .catch((err) => subscriber.error(err));

        return () => {
          if (intervalId) {
            clearInterval(intervalId);
          }
        };
      });

      return createQuery(source$, { live: true });
    },
  };
}
