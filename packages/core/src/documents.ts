import type {
  MangoQuery,
  MangoQuerySelector,
  MangoQuerySortPart,
  RxCollection,
  RxDatabase,
  RxDocument,
} from "rxdb/plugins/core";
import { Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { createQuery, type ExplorerQuery, type LiveOptions } from "./query.js";

/**
 * Options for listing documents.
 */
export interface ListOptions extends LiveOptions {
  /** Mango selector for filtering */
  selector?: MangoQuerySelector<unknown>;
  /** Sort specification */
  sort?: MangoQuerySortPart<unknown>[];
  /** Number of documents to skip */
  skip?: number;
  /** Maximum number of documents to return */
  limit?: number;
}

/**
 * Options for finding a document by ID.
 */
export interface FindByIdOptions extends LiveOptions {}

/**
 * Options for finding documents by IDs.
 */
export interface FindByIdsOptions extends LiveOptions {}

/**
 * A document result with its raw JSON data.
 */
export interface DocumentResult {
  /** The primary key value */
  id: string;
  /** The raw JSON document data */
  data: Record<string, unknown>;
}

/**
 * A single change in a document diff.
 */
export interface DiffChange {
  /** Path to the changed value (e.g., "address.street") */
  path: string;
  /** Type of change */
  type: "added" | "removed" | "changed";
  /** Old value (for removed and changed) */
  oldValue?: unknown;
  /** New value (for added and changed) */
  newValue?: unknown;
}

/**
 * Result of comparing two documents.
 */
export interface DiffResult {
  /** Whether the documents are equal */
  equal: boolean;
  /** List of changes between documents */
  changes: DiffChange[];
}

/**
 * Service for browsing and querying documents.
 */
export interface DocumentsService {
  /**
   * List documents from a collection with optional filtering, sorting, and pagination.
   */
  list(
    collectionName: string,
    options?: ListOptions,
  ): ExplorerQuery<DocumentResult[]>;

  /**
   * Find a single document by its primary key.
   */
  findById(
    collectionName: string,
    id: string,
    options?: FindByIdOptions,
  ): ExplorerQuery<DocumentResult | null>;

  /**
   * Find multiple documents by their primary keys.
   */
  findByIds(
    collectionName: string,
    ids: string[],
    options?: FindByIdsOptions,
  ): ExplorerQuery<DocumentResult[]>;

  /**
   * Get the total count of documents in a collection.
   */
  count(collectionName: string, options?: LiveOptions): ExplorerQuery<number>;

  /**
   * Compare two documents and return the differences.
   */
  compare(docA: DocumentResult, docB: DocumentResult): DiffResult;

  /**
   * Delete a document by its primary key.
   * Requires mutations to be enabled.
   */
  delete(collectionName: string, id: string): Promise<boolean>;

  /**
   * Update a document by patching it with new values.
   * Requires mutations to be enabled.
   */
  update(
    collectionName: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<DocumentResult>;

  /**
   * Insert a new document.
   * Requires mutations to be enabled.
   */
  insert(
    collectionName: string,
    data: Record<string, unknown>,
  ): Promise<DocumentResult>;
}

/**
 * Convert an RxDocument to a DocumentResult.
 */
function toDocumentResult(doc: RxDocument): DocumentResult {
  const data = doc.toJSON(true) as Record<string, unknown>;
  const primaryKey = doc.collection.schema.primaryPath;
  const id = String(data[primaryKey] ?? doc.primary);

  return { id, data };
}

/**
 * Get a collection from the database, throwing if not found.
 */
function getCollection(db: RxDatabase, name: string): RxCollection {
  const collection = db.collections[name] as RxCollection | undefined;
  if (!collection) {
    throw new Error(`Collection "${name}" not found`);
  }
  return collection;
}

/**
 * Deep compare two values and collect differences.
 */
function diffValues(
  a: unknown,
  b: unknown,
  path: string,
  changes: DiffChange[],
): void {
  if (a === b) {
    return;
  }

  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    if (a !== undefined && b === undefined) {
      changes.push({ path, type: "removed", oldValue: a });
    } else if (a === undefined && b !== undefined) {
      changes.push({ path, type: "added", newValue: b });
    } else {
      changes.push({ path, type: "changed", oldValue: a, newValue: b });
    }
    return;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      const itemPath = `${path}[${i}]`;
      if (i >= a.length) {
        changes.push({ path: itemPath, type: "added", newValue: b[i] });
      } else if (i >= b.length) {
        changes.push({ path: itemPath, type: "removed", oldValue: a[i] });
      } else {
        diffValues(a[i], b[i], itemPath, changes);
      }
    }
    return;
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    changes.push({ path, type: "changed", oldValue: a, newValue: b });
    return;
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);

  for (const key of allKeys) {
    const newPath = path ? `${path}.${key}` : key;
    if (!(key in objA)) {
      changes.push({ path: newPath, type: "added", newValue: objB[key] });
    } else if (!(key in objB)) {
      changes.push({ path: newPath, type: "removed", oldValue: objA[key] });
    } else {
      diffValues(objA[key], objB[key], newPath, changes);
    }
  }
}

/**
 * Compare two document results.
 */
function compareDocuments(docA: DocumentResult, docB: DocumentResult): DiffResult {
  const changes: DiffChange[] = [];
  diffValues(docA.data, docB.data, "", changes);
  return {
    equal: changes.length === 0,
    changes,
  };
}

/**
 * Create the documents service for a database.
 */
export function createDocumentsService(
  getDb: () => Promise<RxDatabase>,
): DocumentsService {
  return {
    list(
      collectionName: string,
      options: ListOptions = {},
    ): ExplorerQuery<DocumentResult[]> {
      const { selector, sort, skip, limit, live = false } = options;

      const source$ = new Observable<DocumentResult[]>((subscriber) => {
        let innerSub: { unsubscribe: () => void } | null = null;

        getDb()
          .then((db) => {
            const collection = getCollection(db, collectionName);

            const query: MangoQuery<unknown> = {};
            if (selector) query.selector = selector;
            if (sort) query.sort = sort;
            if (skip !== undefined) query.skip = skip;
            if (limit !== undefined) query.limit = limit;

            const rxQuery = collection.find(query);
            const docs$ = rxQuery.$.pipe(
              map((docs) => docs.map(toDocumentResult)),
            );

            innerSub = docs$.subscribe(subscriber);
          })
          .catch((err) => subscriber.error(err));

        return () => {
          innerSub?.unsubscribe();
        };
      });

      return createQuery(source$, { live });
    },

    findById(
      collectionName: string,
      id: string,
      options: FindByIdOptions = {},
    ): ExplorerQuery<DocumentResult | null> {
      const { live = false } = options;

      const source$ = new Observable<DocumentResult | null>((subscriber) => {
        let innerSub: { unsubscribe: () => void } | null = null;

        getDb()
          .then((db) => {
            const collection = getCollection(db, collectionName);
            const doc$ = collection
              .findOne(id)
              .$.pipe(map((doc) => (doc ? toDocumentResult(doc) : null)));

            innerSub = doc$.subscribe(subscriber);
          })
          .catch((err) => subscriber.error(err));

        return () => {
          innerSub?.unsubscribe();
        };
      });

      return createQuery(source$, { live });
    },

    findByIds(
      collectionName: string,
      ids: string[],
      options: FindByIdsOptions = {},
    ): ExplorerQuery<DocumentResult[]> {
      const { live = false } = options;

      if (ids.length === 0) {
        return createQuery(of([]), { live: false });
      }

      const source$ = new Observable<DocumentResult[]>((subscriber) => {
        let innerSub: { unsubscribe: () => void } | null = null;

        getDb()
          .then((db) => {
            const collection = getCollection(db, collectionName);

            // findByIds returns a Map, not an array
            // We need to use the $ observable version
            const docs$ = collection.findByIds(ids).$.pipe(
              map((docMap) => {
                const results: DocumentResult[] = [];
                for (const id of ids) {
                  const doc = docMap.get(id);
                  if (doc) {
                    results.push(toDocumentResult(doc));
                  }
                }
                return results;
              }),
            );

            innerSub = docs$.subscribe(subscriber);
          })
          .catch((err) => subscriber.error(err));

        return () => {
          innerSub?.unsubscribe();
        };
      });

      return createQuery(source$, { live });
    },

    count(
      collectionName: string,
      options: LiveOptions = {},
    ): ExplorerQuery<number> {
      const { live = false } = options;

      const source$ = new Observable<number>((subscriber) => {
        let innerSub: { unsubscribe: () => void } | null = null;

        getDb()
          .then((db) => {
            const collection = getCollection(db, collectionName);
            innerSub = collection.count().$.subscribe(subscriber);
          })
          .catch((err) => subscriber.error(err));

        return () => {
          innerSub?.unsubscribe();
        };
      });

      return createQuery(source$, { live });
    },

    compare(docA: DocumentResult, docB: DocumentResult): DiffResult {
      return compareDocuments(docA, docB);
    },

    async delete(collectionName: string, id: string): Promise<boolean> {
      const db = await getDb();
      const collection = getCollection(db, collectionName);
      const doc = await collection.findOne(id).exec();
      if (!doc) {
        return false;
      }
      await doc.remove();
      return true;
    },

    async update(
      collectionName: string,
      id: string,
      patch: Record<string, unknown>,
    ): Promise<DocumentResult> {
      const db = await getDb();
      const collection = getCollection(db, collectionName);
      const doc = await collection.findOne(id).exec();
      if (!doc) {
        throw new Error(`Document "${id}" not found in collection "${collectionName}"`);
      }
      await doc.incrementalPatch(patch);
      const updatedDoc = await collection.findOne(id).exec();
      if (!updatedDoc) {
        throw new Error(`Document "${id}" not found after update`);
      }
      return toDocumentResult(updatedDoc);
    },

    async insert(
      collectionName: string,
      data: Record<string, unknown>,
    ): Promise<DocumentResult> {
      const db = await getDb();
      const collection = getCollection(db, collectionName);
      const doc = await collection.insert(data);
      return toDocumentResult(doc);
    },
  };
}
