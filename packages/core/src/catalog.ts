import type { RxCollection, RxDatabase, RxJsonSchema } from "rxdb/plugins/core";
import { combineLatest, Observable, of } from "rxjs";
import { map, startWith, switchMap } from "rxjs/operators";
import { getDebuggerDatabaseExtensions } from "./database-extensions.js";
import { createAsyncObservable, createQuery, type ExplorerQuery, type LiveOptions } from "./query.js";

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
 */
function createAllCollectionsObservable(
  db: RxDatabase,
): Observable<CollectionInfo[]> {
  const collectionEntries = Object.entries(db.collections);

  if (collectionEntries.length === 0) {
    return of([]);
  }

  const collectionInfos$ = collectionEntries.map(([_, collection]) =>
    createCollectionInfoObservable(collection as RxCollection),
  );

  return combineLatest(collectionInfos$).pipe(
    map((infos) => infos.sort((a, b) => a.name.localeCompare(b.name))),
  );
}

function createDynamicCollectionsObservable(
  db: RxDatabase,
): Observable<CollectionInfo[]> {
  const extensions = getDebuggerDatabaseExtensions(db);
  if (!extensions?.onCollectionsChanged) {
    return createAllCollectionsObservable(db);
  }

  return extensions.onCollectionsChanged.pipe(
    startWith(Object.keys(db.collections).sort()),
    switchMap(() => createAllCollectionsObservable(db)),
  );
}

/**
 * Create the catalog service for a database.
 */
export function createCatalogService(
  getDb: () => Promise<RxDatabase>,
): CatalogService {
  return {
    collections(options: LiveOptions = {}): ExplorerQuery<CollectionInfo[]> {
      const source$ = createAsyncObservable(async () =>
        createDynamicCollectionsObservable(await getDb())
      );

      return createQuery(source$, options);
    },

    collection(
      name: string,
      options: LiveOptions = {},
    ): ExplorerQuery<CollectionInfo | null> {
      const source$ = createAsyncObservable(async () => {
        const db = await getDb();
        const collection = db.collections[name] as RxCollection | undefined;
        if (!collection) {
          return of(null);
        }

        return createCollectionInfoObservable(collection);
      });

      return createQuery(source$, options);
    },

    collectionNames(): ExplorerQuery<string[]> {
      const source$ = new Observable<string[]>((subscriber) => {
        getDb()
          .then((db) => {
            const names = Object.keys(db.collections).sort();
            subscriber.next(names);
            subscriber.complete();
          })
          .catch((err) => subscriber.error(err));
      });

      return createQuery(source$);
    },
  };
}
