import type {
  MangoQuery,
  MangoQuerySelector,
  RxCollection,
  RxDatabase,
  RxDocument,
} from "rxdb/plugins/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { createQuery, createStaticQuery, type ExplorerQuery, type LiveOptions } from "./query.js";

/**
 * Result of a query execution.
 */
export interface QueryResult {
  /** Returned documents */
  documents: QueryDocument[];
  /** Total count of matching documents */
  count: number;
  /** Query execution time in milliseconds */
  duration: number;
  /** Whether the query was executed in live mode */
  live: boolean;
}

/**
 * A document returned from a query.
 */
export interface QueryDocument {
  /** Document primary key */
  id: string;
  /** Document data */
  data: Record<string, unknown>;
}

/**
 * Query explanation (index usage analysis).
 */
export interface QueryExplanation {
  /** Whether an index is being used */
  usesIndex: boolean;
  /** Which index fields are used */
  indexFields: string[];
  /** Fields in selector not covered by index */
  uncoveredFields: string[];
  /** Estimated query efficiency */
  efficiency: "full-scan" | "partial-index" | "index-only";
  /** Suggestions for improvement */
  suggestions: string[];
  /** Whether query explicitly sets an index */
  hasManualIndex?: boolean;
  /** Index selected by the RxDB query planner */
  plannerIndex?: string[];
  /** Whether selector is fully satisfied by index according to runtime query plan */
  selectorSatisfiedByIndex?: boolean;
  /** Whether sort is fully satisfied by index according to runtime query plan */
  sortSatisfiedByIndex?: boolean;
  /** Query start range bounds from runtime query plan */
  startKeys?: Array<string | number | undefined>;
  /** Query end range bounds from runtime query plan */
  endKeys?: Array<string | number | undefined>;
  /** Whether start bound is inclusive */
  inclusiveStart?: boolean;
  /** Whether end bound is inclusive */
  inclusiveEnd?: boolean;
}

/**
 * Query execution options.
 */
export interface QueryExecuteOptions extends LiveOptions {
  /** Custom timeout in ms (default: 30000) */
  timeout?: number;
}

/**
 * Query history entry.
 */
export interface QueryHistoryEntry {
  /** Unique ID */
  id: string;
  /** Timestamp */
  timestamp: number;
  /** Collection name */
  collection: string;
  /** The query that was executed */
  query: MangoQuery<unknown>;
  /** Number of results */
  resultCount: number;
  /** Execution duration */
  duration: number;
  /** Whether it succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Service for executing and testing queries.
 */
export interface QueryService {
  /**
   * Execute a Mango query.
   */
  execute(
    collectionName: string,
    query: MangoQuery<unknown>,
    options?: QueryExecuteOptions,
  ): ExplorerQuery<QueryResult>;

  /**
   * Explain a query (analyze index usage).
   */
  explain(
    collectionName: string,
    query: MangoQuery<unknown>,
  ): ExplorerQuery<QueryExplanation>;

  /**
   * Get query execution history.
   */
  getHistory(options?: { limit?: number }): ExplorerQuery<QueryHistoryEntry[]>;

  /**
   * Clear query history.
   */
  clearHistory(): void;
}

/**
 * Generate a unique ID.
 */
function generateId(): string {
  return `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert RxDocument to QueryDocument.
 */
function toQueryDocument(doc: RxDocument): QueryDocument {
  const data = doc.toJSON(true) as Record<string, unknown>;
  const primaryKey = doc.collection.schema.primaryPath;
  const id = String(data[primaryKey] ?? doc.primary);
  return { id, data };
}

/**
 * Get collection or throw.
 */
function getCollection(db: RxDatabase, name: string): RxCollection {
  const collection = db.collections[name] as RxCollection | undefined;
  if (!collection) {
    throw new Error(`Collection "${name}" not found`);
  }
  return collection;
}

/**
 * Extract selector fields from a Mango query.
 */
function extractSelectorFields(selector: MangoQuerySelector<unknown> | undefined): string[] {
  if (!selector || typeof selector !== "object") {
    return [];
  }

  const fields: string[] = [];

  function traverse(obj: Record<string, unknown>, prefix: string = ""): void {
    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith("$")) {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === "object" && item !== null) {
              traverse(item as Record<string, unknown>, prefix);
            }
          }
        }
        continue;
      }

      const fullPath = prefix ? `${prefix}.${key}` : key;

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const keys = Object.keys(value);
        const hasOnlyOperators = keys.every((k) => k.startsWith("$"));
        if (hasOnlyOperators) {
          fields.push(fullPath);
        } else {
          traverse(value as Record<string, unknown>, fullPath);
        }
      } else {
        fields.push(fullPath);
      }
    }
  }

  traverse(selector as Record<string, unknown>);
  return [...new Set(fields)];
}

/**
 * Analyze query efficiency based on available indexes.
 */
function analyzeQueryEfficiency(
  selectorFields: string[],
  indexes: string[][],
  primaryKey: string,
): { usesIndex: boolean; indexFields: string[]; uncoveredFields: string[]; efficiency: QueryExplanation["efficiency"] } {
  if (selectorFields.length === 0) {
    return {
      usesIndex: false,
      indexFields: [],
      uncoveredFields: [],
      efficiency: "full-scan",
    };
  }

  const allIndexFields = new Set<string>();
  allIndexFields.add(primaryKey);
  for (const idx of indexes) {
    for (const field of idx) {
      allIndexFields.add(field);
    }
  }

  const coveredFields: string[] = [];
  const uncoveredFields: string[] = [];

  for (const field of selectorFields) {
    if (allIndexFields.has(field)) {
      coveredFields.push(field);
    } else {
      uncoveredFields.push(field);
    }
  }

  if (coveredFields.length === 0) {
    return {
      usesIndex: false,
      indexFields: [],
      uncoveredFields: selectorFields,
      efficiency: "full-scan",
    };
  }

  if (uncoveredFields.length === 0) {
    return {
      usesIndex: true,
      indexFields: coveredFields,
      uncoveredFields: [],
      efficiency: "index-only",
    };
  }

  return {
    usesIndex: true,
    indexFields: coveredFields,
    uncoveredFields,
    efficiency: "partial-index",
  };
}

/**
 * Generate suggestions for query improvement.
 */
function generateSuggestions(
  uncoveredFields: string[],
  efficiency: QueryExplanation["efficiency"],
  options: {
    sortSatisfiedByIndex?: boolean;
    hasManualIndex?: boolean;
  } = {},
): string[] {
  const suggestions: string[] = [];
  const { sortSatisfiedByIndex, hasManualIndex } = options;

  if (efficiency === "full-scan") {
    suggestions.push(
      "Consider adding an index on frequently queried fields.",
    );
  }

  if (uncoveredFields.length > 0) {
    suggestions.push(
      `Fields not covered by indexes: ${uncoveredFields.join(", ")}. Consider adding indexes.`,
    );
  }

  if (efficiency === "partial-index") {
    suggestions.push(
      "Query uses partial index coverage. A compound index may improve performance.",
    );
  }

  if (sortSatisfiedByIndex === false) {
    suggestions.push(
      "Sort order is not fully covered by index. Align compound index order with query sort order.",
    );
  }

  if (!hasManualIndex) {
    suggestions.push(
      "For critical hot-path queries, test explicit query.index values to compare planner choices.",
    );
  }

  return suggestions;
}

type RuntimePreparedQuery = {
  query?: {
    index?: string[];
  };
  queryPlan?: {
    index?: string[];
    selectorSatisfiedByIndex?: boolean;
    sortSatisfiedByIndex?: boolean;
    startKeys?: Array<string | number | undefined>;
    endKeys?: Array<string | number | undefined>;
    inclusiveStart?: boolean;
    inclusiveEnd?: boolean;
  };
};

type QueryWithPrepared = {
  getPreparedQuery?: () => RuntimePreparedQuery;
};

function getRuntimePreparedQuery(
  collection: RxCollection,
  query: MangoQuery<unknown>,
): RuntimePreparedQuery | null {
  const rxQuery = collection.find(query) as unknown as QueryWithPrepared;
  if (typeof rxQuery.getPreparedQuery !== "function") {
    return null;
  }

  try {
    return rxQuery.getPreparedQuery() ?? null;
  } catch {
    return null;
  }
}

/**
 * Create the query service for a database.
 */
export function createQueryService(
  getDb: () => Promise<RxDatabase>,
  maxHistorySize: number = 50,
): QueryService {
  const history: QueryHistoryEntry[] = [];

  const addToHistory = (entry: Omit<QueryHistoryEntry, "id" | "timestamp">): void => {
    history.push({
      ...entry,
      id: generateId(),
      timestamp: Date.now(),
    });
    while (history.length > maxHistorySize) {
      history.shift();
    }
  };

  return {
    execute(
      collectionName: string,
      query: MangoQuery<unknown>,
      options: QueryExecuteOptions = {},
    ): ExplorerQuery<QueryResult> {
      const { live = false } = options;

      const source$ = new Observable<QueryResult>((subscriber) => {
        let innerSub: { unsubscribe: () => void } | null = null;
        let disposed = false;
        const startTime = performance.now();

        getDb()
          .then((db) => {
            if (disposed || subscriber.closed) {
              return;
            }
            const collection = getCollection(db, collectionName);
            const rxQuery = collection.find(query);

            if (live) {
              innerSub = rxQuery.$.pipe(
                map((docs) => {
                  const duration = performance.now() - startTime;
                  const documents = docs.map(toQueryDocument);
                  return {
                    documents,
                    count: documents.length,
                    duration,
                    live: true,
                  };
                }),
              ).subscribe({
                next: (result) => {
                  addToHistory({
                    collection: collectionName,
                    query,
                    resultCount: result.count,
                    duration: result.duration,
                    success: true,
                  });
                  subscriber.next(result);
                },
                error: (err) => {
                  addToHistory({
                    collection: collectionName,
                    query,
                    resultCount: 0,
                    duration: performance.now() - startTime,
                    success: false,
                    error: err.message,
                  });
                  subscriber.error(err);
                },
              });
              if (disposed || subscriber.closed) {
                innerSub.unsubscribe();
                innerSub = null;
              }
            } else {
              rxQuery.exec().then((docs) => {
                if (disposed || subscriber.closed) {
                  return;
                }
                const duration = performance.now() - startTime;
                const documents = docs.map(toQueryDocument);
                const result: QueryResult = {
                  documents,
                  count: documents.length,
                  duration,
                  live: false,
                };
                addToHistory({
                  collection: collectionName,
                  query,
                  resultCount: result.count,
                  duration,
                  success: true,
                });
                subscriber.next(result);
                subscriber.complete();
              }).catch((err) => {
                if (disposed || subscriber.closed) {
                  return;
                }
                addToHistory({
                  collection: collectionName,
                  query,
                  resultCount: 0,
                  duration: performance.now() - startTime,
                  success: false,
                  error: err.message,
                });
                subscriber.error(err);
              });
            }
          })
          .catch((err) => {
            if (disposed || subscriber.closed) {
              return;
            }
            addToHistory({
              collection: collectionName,
              query,
              resultCount: 0,
              duration: performance.now() - startTime,
              success: false,
              error: err.message,
            });
            subscriber.error(err);
          });

        return () => {
          disposed = true;
          innerSub?.unsubscribe();
        };
      });

      return createQuery(source$, { live });
    },

    explain(
      collectionName: string,
      query: MangoQuery<unknown>,
    ): ExplorerQuery<QueryExplanation> {
      return createStaticQuery(async () => {
        const db = await getDb();
        const collection = getCollection(db, collectionName);
        const schema = collection.schema.jsonSchema;

        const primaryKey =
          typeof schema.primaryKey === "string"
            ? schema.primaryKey
            : ((schema.primaryKey as { key?: string })?.key ?? "id");

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

        const selectorFields = extractSelectorFields(query.selector);
        const analysis = analyzeQueryEfficiency(selectorFields, indexes, primaryKey);
        const prepared = getRuntimePreparedQuery(collection, query);
        const plannerIndex = Array.isArray(prepared?.queryPlan?.index)
          ? prepared?.queryPlan?.index
          : undefined;
        const selectorSatisfiedByIndex = prepared?.queryPlan?.selectorSatisfiedByIndex;
        const sortSatisfiedByIndex = prepared?.queryPlan?.sortSatisfiedByIndex;
        const hasManualIndex = Array.isArray(prepared?.query?.index) && prepared!.query!.index!.length > 0;

        let usesIndex = analysis.usesIndex;
        let indexFields = analysis.indexFields;
        let efficiency = analysis.efficiency;

        if (plannerIndex && plannerIndex.length > 0) {
          usesIndex = true;
          indexFields = plannerIndex;
          if (selectorSatisfiedByIndex === true && sortSatisfiedByIndex === true) {
            efficiency = "index-only";
          } else if (selectorSatisfiedByIndex === true) {
            efficiency = "partial-index";
          } else if (analysis.efficiency === "index-only") {
            efficiency = "partial-index";
          } else {
            efficiency = "full-scan";
          }
        }

        const suggestions = generateSuggestions(
          analysis.uncoveredFields,
          efficiency,
          {
            sortSatisfiedByIndex,
            hasManualIndex,
          },
        );

        return {
          usesIndex,
          indexFields,
          uncoveredFields: analysis.uncoveredFields,
          efficiency,
          suggestions,
          hasManualIndex,
          plannerIndex,
          selectorSatisfiedByIndex,
          sortSatisfiedByIndex,
          startKeys: prepared?.queryPlan?.startKeys,
          endKeys: prepared?.queryPlan?.endKeys,
          inclusiveStart: prepared?.queryPlan?.inclusiveStart,
          inclusiveEnd: prepared?.queryPlan?.inclusiveEnd,
        };
      });
    },

    getHistory(options: { limit?: number } = {}): ExplorerQuery<QueryHistoryEntry[]> {
      const { limit } = options;

      return createStaticQuery(() => {
        let result = [...history].reverse();
        if (limit && limit > 0) {
          result = result.slice(0, limit);
        }
        return result;
      });
    },

    clearHistory(): void {
      history.length = 0;
    },
  };
}
