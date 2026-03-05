import type { RxCollection, RxDatabase } from "rxdb/plugins/core";
import { BehaviorSubject } from "rxjs";
import { map } from "rxjs/operators";
import { createQuery, type ExplorerQuery } from "./query.js";

/**
 * Types of database operations.
 */
export type OperationTypeName =
  | "query"
  | "find"
  | "findOne"
  | "findByIds"
  | "insert"
  | "update"
  | "delete"
  | "count"
  | "bulkWrite"
  | "bulkInsert"
  | "bulkUpsert";

/**
 * Runtime query diagnostics based on prepared query plans.
 */
export interface QueryDiagnostics {
  /** Selector fields found in the query */
  selectorFields: string[];
  /** Sort fields found in the query */
  sortFields: string[];
  /** Whether query explicitly set `index` */
  hasManualIndex: boolean;
  /** Index fields picked by query planner */
  indexUsed: string[];
  /** Whether selector can be satisfied by index only */
  selectorSatisfiedByIndex: boolean;
  /** Whether sort can be satisfied by index only */
  sortSatisfiedByIndex: boolean;
  /** Query likely needs full scan / in-memory matcher */
  fullScanCandidate: boolean;
  /** Query likely needs in-memory re-sort */
  manualSortCandidate: boolean;
}

/**
 * Extra diagnostics for count operations.
 */
export interface CountDiagnostics extends QueryDiagnostics {
  /** Storage-reported count mode */
  countMode?: "fast" | "slow";
}

/**
 * Diagnostics for bulkWrite calls.
 */
export interface BulkWriteDiagnostics {
  /** RxDB write context */
  context: string;
  /** Number of write rows passed to storage */
  rowCount: number;
  /** Number of rows inferred as inserts */
  insertCount: number;
  /** Number of rows inferred as updates */
  updateCount: number;
  /** Number of rows inferred as deletes */
  deleteCount: number;
  /** Number of row-level write errors */
  errorCount: number;
}

/**
 * Diagnostics for findDocumentsById calls.
 */
export interface FindByIdsDiagnostics {
  /** Requested id count */
  requestedCount: number;
  /** Whether deleted documents were requested */
  withDeleted: boolean;
}

export interface QueryOperationDetails {
  kind: "query";
  query?: unknown;
  queryPlan?: unknown;
  diagnostics: QueryDiagnostics;
}

export interface CountOperationDetails {
  kind: "count";
  query?: unknown;
  queryPlan?: unknown;
  diagnostics: CountDiagnostics;
}

export interface BulkWriteOperationDetails {
  kind: "bulkWrite";
  diagnostics: BulkWriteDiagnostics;
}

export interface FindByIdsOperationDetails {
  kind: "findByIds";
  diagnostics: FindByIdsDiagnostics;
}

export type OperationDetails =
  | QueryOperationDetails
  | CountOperationDetails
  | BulkWriteOperationDetails
  | FindByIdsOperationDetails;

/**
 * A single operation log entry.
 */
export interface OperationLog {
  /** Unique operation ID */
  id: string;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Type of operation */
  type: OperationTypeName;
  /** Collection name */
  collection: string;
  /** Duration in milliseconds */
  duration: number;
  /** Number of results (for queries) or documents affected */
  resultCount?: number;
  /** Query or operation details */
  details?: unknown;
  /** Whether operation succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Aggregated performance metrics.
 */
export interface PerformanceMetrics {
  /** Total number of operations tracked */
  totalOperations: number;
  /** Operations broken down by type */
  operationsByType: Record<string, number>;
  /** Operations broken down by collection */
  operationsByCollection: Record<string, number>;
  /** Average operation duration in ms */
  averageDuration: number;
  /** Total duration of all operations in ms */
  totalDuration: number;
  /** Number of failed operations */
  failedOperations: number;
  /** Slowest operations (top 10) */
  slowestOperations: OperationLog[];
  /** Tracking start time */
  startedAt: number | null;
  /** Whether tracking is active */
  isTracking: boolean;
  /** Approximate operation throughput since tracking start */
  operationsPerSecond: number;
  /** Latency distribution snapshot in milliseconds */
  latency: {
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  };
  /** Query efficiency summary derived from runtime query plans */
  queryStats: {
    totalQueries: number;
    fullScanCandidates: number;
    manualSortCandidates: number;
    slowCounts: number;
    fastCounts: number;
  };
  /** Write pattern summary to detect non-batched writes */
  writeStats: {
    totalWrites: number;
    totalRows: number;
    singleRowWrites: number;
    averageRowsPerWrite: number;
  };
  /** Database profile relevant to performance behavior */
  profile: PerformanceProfile | null;
  /** Actionable recommendations derived from runtime data and profile */
  insights: PerformanceInsight[];
  /** Instrumentation setup state */
  instrumentation: {
    state: "idle" | "initializing" | "ready" | "error";
    error?: string;
  };
}

/**
 * Performance-relevant database profile.
 */
export interface PerformanceProfile {
  storageName: string | null;
  multiInstance: boolean | null;
  eventReduce: boolean | null;
  allowSlowCount: boolean | null;
  collectionCount: number;
  indexedCollections: number;
  totalIndexes: number;
}

/**
 * A recommendation generated by the performance service.
 */
export interface PerformanceInsight {
  id: string;
  severity: "info" | "warning" | "error";
  title: string;
  description: string;
  recommendation?: string;
}

/**
 * Service for tracking operation performance.
 */
export interface PerformanceService {
  /**
   * Start performance tracking.
   */
  start(): void;

  /**
   * Stop performance tracking.
   */
  stop(): void;

  /**
   * Check if tracking is active.
   */
  isTracking(): boolean;

  /**
   * Log an operation manually.
   */
  logOperation(log: Omit<OperationLog, "id" | "timestamp">): void;

  /**
   * Wrap an async operation with timing.
   */
  track<T>(
    type: OperationTypeName,
    collection: string,
    operation: () => Promise<T>,
    getResultCount?: (result: T) => number,
  ): Promise<T>;

  /**
   * Get aggregated metrics.
   */
  getMetrics(): ExplorerQuery<PerformanceMetrics>;

  /**
   * Get operation log.
   */
  getOperations(options?: { limit?: number }): ExplorerQuery<OperationLog[]>;

  /**
   * Get operations for a specific collection.
   */
  getOperationsByCollection(
    collection: string,
    options?: { limit?: number },
  ): ExplorerQuery<OperationLog[]>;

  /**
   * Get slow operations (above threshold).
   */
  getSlowOperations(thresholdMs?: number): ExplorerQuery<OperationLog[]>;

  /**
   * Clear all tracked data.
   */
  clear(): void;

  /**
   * Dispose instrumentation and release resources.
   */
  dispose(): void;
}

/**
 * Generate a unique operation ID.
 */
function generateOperationId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create the performance service.
 */
export function createPerformanceService(
  options:
    | number
    | {
      maxOperations?: number;
      getDb?: () => Promise<RxDatabase>;
    } = 500,
): PerformanceService {
  const maxOperations =
    typeof options === "number" ? options : (options.maxOperations ?? 500);
  const getDb =
    typeof options === "number" ? undefined : options.getDb;

  const operations: OperationLog[] = [];
  const tracking$ = new BehaviorSubject<boolean>(false);
  const revision$ = new BehaviorSubject<number>(0);
  let startedAt: number | null = null;
  let profile: PerformanceProfile | null = null;
  let instrumentationState: "idle" | "initializing" | "ready" | "error" = "idle";
  let instrumentationError: string | undefined;
  let teardownInstrumentation: Array<() => void> = [];
  let initializePromise: Promise<void> | null = null;

  const touch = (): void => {
    revision$.next(revision$.value + 1);
  };

  const addOperation = (log: Omit<OperationLog, "id" | "timestamp">): void => {
    if (!tracking$.value) return;

    const entry: OperationLog = {
      ...log,
      id: generateOperationId(),
      timestamp: Date.now(),
    };

    operations.push(entry);

    while (operations.length > maxOperations) {
      operations.shift();
    }
    touch();
  };

  const parseSchemaIndexes = (collection: RxCollection): number => {
    const schema = collection.schema.jsonSchema;
    if (!Array.isArray(schema.indexes)) {
      return 0;
    }
    return schema.indexes.length;
  };

  const updateProfile = (db: RxDatabase): void => {
    const collections = Object.values(db.collections) as RxCollection[];
    let totalIndexes = 0;
    let indexedCollections = 0;

    for (const collection of collections) {
      const count = parseSchemaIndexes(collection);
      totalIndexes += count;
      if (count > 0) {
        indexedCollections++;
      }
    }

    profile = {
      storageName:
        typeof (db.storage as { name?: unknown } | undefined)?.name === "string"
          ? (db.storage as { name: string }).name
          : null,
      multiInstance:
        typeof (db as { multiInstance?: unknown }).multiInstance === "boolean"
          ? Boolean((db as { multiInstance: boolean }).multiInstance)
          : null,
      eventReduce:
        typeof (db as { eventReduce?: unknown }).eventReduce === "boolean"
          ? Boolean((db as { eventReduce: boolean }).eventReduce)
          : null,
      allowSlowCount:
        typeof (db as { allowSlowCount?: unknown }).allowSlowCount === "boolean"
          ? Boolean((db as { allowSlowCount: boolean }).allowSlowCount)
          : null,
      collectionCount: collections.length,
      indexedCollections,
      totalIndexes,
    };
  };

  const toErrorMessage = (err: unknown): string =>
    err instanceof Error ? err.message : String(err);

  const extractSelectorFields = (selector: unknown): string[] => {
    if (!selector || typeof selector !== "object") {
      return [];
    }

    const fields: string[] = [];

    const traverse = (obj: Record<string, unknown>, prefix = ""): void => {
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith("$")) {
          if (Array.isArray(value)) {
            for (const item of value) {
              if (item && typeof item === "object") {
                traverse(item as Record<string, unknown>, prefix);
              }
            }
          }
          continue;
        }

        const fullPath = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === "object" && !Array.isArray(value)) {
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
    };

    traverse(selector as Record<string, unknown>);
    return [...new Set(fields)];
  };

  const extractSortFields = (sort: unknown): string[] => {
    if (!Array.isArray(sort)) {
      return [];
    }
    const fields: string[] = [];
    for (const item of sort) {
      if (!item || typeof item !== "object") continue;
      for (const key of Object.keys(item as Record<string, unknown>)) {
        fields.push(key);
      }
    }
    return [...new Set(fields)];
  };

  type PreparedQueryLike = {
    query?: {
      selector?: unknown;
      sort?: unknown;
      index?: unknown;
    };
    queryPlan?: {
      index?: unknown;
      selectorSatisfiedByIndex?: unknown;
      sortSatisfiedByIndex?: unknown;
      startKeys?: unknown;
      endKeys?: unknown;
      inclusiveStart?: unknown;
      inclusiveEnd?: unknown;
    };
  };

  const toQueryDiagnostics = (preparedQuery: PreparedQueryLike): QueryDiagnostics => {
    const selectorFields = extractSelectorFields(preparedQuery.query?.selector);
    const sortFields = extractSortFields(preparedQuery.query?.sort);
    const hasManualIndex =
      Array.isArray(preparedQuery.query?.index)
        ? preparedQuery.query!.index.length > 0
        : typeof preparedQuery.query?.index === "string";

    const indexUsed = Array.isArray(preparedQuery.queryPlan?.index)
      ? preparedQuery.queryPlan?.index.filter(
        (field): field is string => typeof field === "string",
      )
      : [];

    const selectorSatisfiedByIndex =
      preparedQuery.queryPlan?.selectorSatisfiedByIndex === true;
    const sortSatisfiedByIndex =
      preparedQuery.queryPlan?.sortSatisfiedByIndex === true;

    return {
      selectorFields,
      sortFields,
      hasManualIndex,
      indexUsed,
      selectorSatisfiedByIndex,
      sortSatisfiedByIndex,
      fullScanCandidate: selectorFields.length > 0 && !selectorSatisfiedByIndex,
      manualSortCandidate: sortFields.length > 0 && !sortSatisfiedByIndex,
    };
  };

  const classifyBulkWriteType = (details: BulkWriteDiagnostics): OperationTypeName => {
    const { rowCount, insertCount, updateCount, deleteCount } = details;

    if (rowCount === 1) {
      if (insertCount === 1) return "insert";
      if (updateCount === 1) return "update";
      if (deleteCount === 1) return "delete";
    }

    if (rowCount > 1) {
      if (insertCount === rowCount) return "bulkInsert";
      if (insertCount > 0 && updateCount > 0) return "bulkUpsert";
    }

    return "bulkWrite";
  };

  const toBulkWriteDiagnostics = (
    writeRows: unknown,
    context: unknown,
    errorCount: number,
  ): BulkWriteDiagnostics => {
    const rows = Array.isArray(writeRows) ? writeRows : [];
    let insertCount = 0;
    let updateCount = 0;
    let deleteCount = 0;

    for (const row of rows as Array<{ previous?: unknown; document?: { _deleted?: boolean } }>) {
      const hasPrevious = !!row.previous;
      const isDeleted = row.document?._deleted === true;

      if (!hasPrevious && !isDeleted) {
        insertCount++;
      } else if (hasPrevious && isDeleted) {
        deleteCount++;
      } else if (hasPrevious) {
        updateCount++;
      }
    }

    return {
      context: typeof context === "string" ? context : "unknown",
      rowCount: rows.length,
      insertCount,
      updateCount,
      deleteCount,
      errorCount,
    };
  };

  type StorageInstanceLike = {
    query?: (preparedQuery: PreparedQueryLike) => Promise<{ documents?: unknown[] }>;
    count?: (
      preparedQuery: PreparedQueryLike,
    ) => Promise<{ count?: number; mode?: "fast" | "slow" }>;
    findDocumentsById?: (ids: string[], withDeleted: boolean) => Promise<unknown[]>;
    bulkWrite?: (
      rows: unknown[],
      context: string,
    ) => Promise<{ error?: unknown[] }>;
  };

  const instrumentedStorages = new WeakMap<
    object,
    {
      refCount: number;
      originals: {
        query?: StorageInstanceLike["query"];
        count?: StorageInstanceLike["count"];
        findDocumentsById?: StorageInstanceLike["findDocumentsById"];
        bulkWrite?: StorageInstanceLike["bulkWrite"];
      };
    }
  >();

  const instrumentStorageInstance = (
    collectionName: string,
    storageInstance: StorageInstanceLike,
  ): (() => void) => {
    const storageRef = storageInstance as object;
    const existing = instrumentedStorages.get(storageRef);
    if (existing) {
      existing.refCount++;
      return () => {
        existing.refCount--;
        if (existing.refCount <= 0) {
          if (existing.originals.query) storageInstance.query = existing.originals.query;
          if (existing.originals.count) storageInstance.count = existing.originals.count;
          if (existing.originals.findDocumentsById) {
            storageInstance.findDocumentsById = existing.originals.findDocumentsById;
          }
          if (existing.originals.bulkWrite) {
            storageInstance.bulkWrite = existing.originals.bulkWrite;
          }
          instrumentedStorages.delete(storageRef);
        }
      };
    }

    const originals = {
      query: storageInstance.query,
      count: storageInstance.count,
      findDocumentsById: storageInstance.findDocumentsById,
      bulkWrite: storageInstance.bulkWrite,
    };
    instrumentedStorages.set(storageRef, { refCount: 1, originals });

    if (originals.query) {
      storageInstance.query = async (preparedQuery) => {
        const start = performance.now();
        let success = true;
        let error: string | undefined;
        let result: { documents?: unknown[] } | undefined;

        try {
          result = await originals.query!(preparedQuery);
          return result;
        } catch (err) {
          success = false;
          error = toErrorMessage(err);
          throw err;
        } finally {
          const diagnostics = toQueryDiagnostics(preparedQuery ?? {});
          addOperation({
            type: "query",
            collection: collectionName,
            duration: performance.now() - start,
            success,
            error,
            resultCount: Array.isArray(result?.documents) ? result.documents.length : undefined,
            details: {
              kind: "query",
              query: preparedQuery?.query,
              queryPlan: preparedQuery?.queryPlan,
              diagnostics,
            } satisfies QueryOperationDetails,
          });
        }
      };
    }

    if (originals.count) {
      storageInstance.count = async (preparedQuery) => {
        const start = performance.now();
        let success = true;
        let error: string | undefined;
        let result: { count?: number; mode?: "fast" | "slow" } | undefined;

        try {
          result = await originals.count!(preparedQuery);
          return result;
        } catch (err) {
          success = false;
          error = toErrorMessage(err);
          throw err;
        } finally {
          const diagnostics: CountDiagnostics = {
            ...toQueryDiagnostics(preparedQuery ?? {}),
            countMode: result?.mode,
          };

          addOperation({
            type: "count",
            collection: collectionName,
            duration: performance.now() - start,
            success,
            error,
            resultCount: typeof result?.count === "number" ? result.count : undefined,
            details: {
              kind: "count",
              query: preparedQuery?.query,
              queryPlan: preparedQuery?.queryPlan,
              diagnostics,
            } satisfies CountOperationDetails,
          });
        }
      };
    }

    if (originals.findDocumentsById) {
      storageInstance.findDocumentsById = async (ids, withDeleted) => {
        const start = performance.now();
        let success = true;
        let error: string | undefined;
        let result: unknown[] | undefined;

        try {
          result = await originals.findDocumentsById!(ids, withDeleted);
          return result;
        } catch (err) {
          success = false;
          error = toErrorMessage(err);
          throw err;
        } finally {
          addOperation({
            type: "findByIds",
            collection: collectionName,
            duration: performance.now() - start,
            success,
            error,
            resultCount: Array.isArray(result) ? result.length : undefined,
            details: {
              kind: "findByIds",
              diagnostics: {
                requestedCount: Array.isArray(ids) ? ids.length : 0,
                withDeleted: Boolean(withDeleted),
              } satisfies FindByIdsDiagnostics,
            } satisfies FindByIdsOperationDetails,
          });
        }
      };
    }

    if (originals.bulkWrite) {
      storageInstance.bulkWrite = async (rows, context) => {
        const start = performance.now();
        let success = true;
        let error: string | undefined;
        let result: { error?: unknown[] } | undefined;

        try {
          result = await originals.bulkWrite!(rows, context);
          return result;
        } catch (err) {
          success = false;
          error = toErrorMessage(err);
          throw err;
        } finally {
          const errorCount = Array.isArray(result?.error) ? result.error.length : 0;
          const diagnostics = toBulkWriteDiagnostics(rows, context, errorCount);
          addOperation({
            type: classifyBulkWriteType(diagnostics),
            collection: collectionName,
            duration: performance.now() - start,
            success: success && errorCount === 0,
            error,
            resultCount: Math.max(0, diagnostics.rowCount - diagnostics.errorCount),
            details: {
              kind: "bulkWrite",
              diagnostics,
            } satisfies BulkWriteOperationDetails,
          });
        }
      };
    }

    return () => {
      const state = instrumentedStorages.get(storageRef);
      if (!state) {
        return;
      }

      state.refCount--;
      if (state.refCount > 0) {
        return;
      }

      if (state.originals.query) storageInstance.query = state.originals.query;
      if (state.originals.count) storageInstance.count = state.originals.count;
      if (state.originals.findDocumentsById) {
        storageInstance.findDocumentsById = state.originals.findDocumentsById;
      }
      if (state.originals.bulkWrite) {
        storageInstance.bulkWrite = state.originals.bulkWrite;
      }

      instrumentedStorages.delete(storageRef);
    };
  };

  const initializeInstrumentation = async (): Promise<void> => {
    if (!getDb) {
      if (instrumentationState === "idle") {
        instrumentationState = "ready";
        touch();
      }
      return;
    }
    if (instrumentationState === "ready") {
      return;
    }
    if (initializePromise) {
      return initializePromise;
    }

    instrumentationState = "initializing";
    touch();

    initializePromise = (async () => {
      try {
        const db = await getDb();
        updateProfile(db);
        teardownInstrumentation = [];

        for (const [collectionName, collection] of Object.entries(db.collections)) {
          const rxCollection = collection as RxCollection & {
            storageInstance?: StorageInstanceLike;
          };
          const storageInstance = rxCollection.storageInstance;
          if (!storageInstance) {
            continue;
          }
          teardownInstrumentation.push(
            instrumentStorageInstance(collectionName, storageInstance),
          );
        }

        instrumentationState = "ready";
        instrumentationError = undefined;
      } catch (err) {
        instrumentationState = "error";
        instrumentationError = toErrorMessage(err);
      } finally {
        initializePromise = null;
        touch();
      }
    })();

    return initializePromise;
  };

  const asQueryDetails = (details: unknown): QueryOperationDetails | null => {
    if (!details || typeof details !== "object") return null;
    const kind = (details as { kind?: unknown }).kind;
    if (kind !== "query") return null;
    const diagnostics = (details as { diagnostics?: unknown }).diagnostics;
    if (!diagnostics || typeof diagnostics !== "object") return null;
    return details as QueryOperationDetails;
  };

  const asCountDetails = (details: unknown): CountOperationDetails | null => {
    if (!details || typeof details !== "object") return null;
    const kind = (details as { kind?: unknown }).kind;
    if (kind !== "count") return null;
    const diagnostics = (details as { diagnostics?: unknown }).diagnostics;
    if (!diagnostics || typeof diagnostics !== "object") return null;
    return details as CountOperationDetails;
  };

  const asBulkWriteDetails = (details: unknown): BulkWriteOperationDetails | null => {
    if (!details || typeof details !== "object") return null;
    const kind = (details as { kind?: unknown }).kind;
    if (kind !== "bulkWrite") return null;
    const diagnostics = (details as { diagnostics?: unknown }).diagnostics;
    if (!diagnostics || typeof diagnostics !== "object") return null;
    return details as BulkWriteOperationDetails;
  };

  const percentile = (sortedValues: number[], p: number): number => {
    if (sortedValues.length === 0) return 0;
    const index = Math.min(
      sortedValues.length - 1,
      Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1),
    );
    return sortedValues[index] ?? 0;
  };

  const buildInsights = (
    metricsBase: {
      failedOperations: number;
      totalOperations: number;
      queryStats: PerformanceMetrics["queryStats"];
      writeStats: PerformanceMetrics["writeStats"];
      latency: PerformanceMetrics["latency"];
    },
  ): PerformanceInsight[] => {
    const insights: PerformanceInsight[] = [];
    const currentProfile = profile;

    if (instrumentationState === "error") {
      insights.push({
        id: "instrumentation-error",
        severity: "error",
        title: "Instrumentation failed to initialize",
        description: instrumentationError ?? "Could not attach performance instrumentation.",
        recommendation: "Verify database initialization and retry starting performance tracking.",
      });
      return insights;
    }

    if (!tracking$.value) {
      insights.push({
        id: "tracking-disabled",
        severity: "info",
        title: "Performance tracking is not active",
        description: "Operation diagnostics are collected only while tracking is active.",
        recommendation: "Start tracking and run your app workflows to gather performance signals.",
      });
    }

    if (currentProfile?.eventReduce === false) {
      insights.push({
        id: "event-reduce",
        severity: "warning",
        title: "eventReduce is disabled",
        description:
          "Observed and recurring queries cannot use EventReduce optimizations.",
        recommendation:
          "Enable `eventReduce: true` when creating your RxDatabase for better reactive query performance.",
      });
    }

    if (currentProfile?.storageName?.toLowerCase().includes("localstorage")) {
      insights.push({
        id: "storage-localstorage",
        severity: "warning",
        title: "LocalStorage storage can become a bottleneck",
        description:
          "localStorage operations are synchronous and can block the main thread on heavier workloads.",
        recommendation:
          "For production browser workloads, prefer IndexedDB or OPFS-based storage.",
      });
    }

    if (
      metricsBase.writeStats.totalWrites >= 20 &&
      metricsBase.writeStats.singleRowWrites / Math.max(metricsBase.writeStats.totalWrites, 1) > 0.6
    ) {
      insights.push({
        id: "write-batching",
        severity: "warning",
        title: "Many writes are single-row operations",
        description:
          "Frequent single-row writes can increase storage transaction overhead.",
        recommendation:
          "Batch writes where possible with bulkInsert/bulkUpsert to reduce transaction overhead.",
      });
    }

    if (metricsBase.queryStats.fullScanCandidates > 0) {
      insights.push({
        id: "full-scan",
        severity: "warning",
        title: "Queries likely require full scans",
        description: `${metricsBase.queryStats.fullScanCandidates} query operations had selectors not fully satisfied by indexes.`,
        recommendation:
          "Add/adjust indexes for frequent selector fields or explicitly set query.index for hot paths.",
      });
    }

    if (metricsBase.queryStats.manualSortCandidates > 0) {
      insights.push({
        id: "manual-sort",
        severity: "warning",
        title: "Queries likely require in-memory sorting",
        description: `${metricsBase.queryStats.manualSortCandidates} query operations had sort orders not satisfied by indexes.`,
        recommendation:
          "Align compound index order with query sort order (RxDB appends primary key for deterministic sorting).",
      });
    }

    if (metricsBase.queryStats.slowCounts > 0) {
      insights.push({
        id: "slow-counts",
        severity: "warning",
        title: "Slow count operations detected",
        description:
          `${metricsBase.queryStats.slowCounts} count operations used slow mode and may scan data.`,
        recommendation:
          "Ensure count selectors are fully index-covered or use regular find queries plus result length when appropriate.",
      });
    }

    if (metricsBase.failedOperations > 0) {
      insights.push({
        id: "operation-failures",
        severity: "error",
        title: "Operation failures detected",
        description:
          `${metricsBase.failedOperations} of ${metricsBase.totalOperations} tracked operations failed.`,
        recommendation: "Inspect failed operation details to fix query/write errors before tuning performance.",
      });
    }

    if (metricsBase.latency.p95 > 100) {
      insights.push({
        id: "high-p95",
        severity: "info",
        title: "High tail latency",
        description: `p95 latency is ${metricsBase.latency.p95.toFixed(1)}ms.`,
        recommendation:
          "Focus on slowest repeated operations first (index coverage, batching, or storage/worker setup).",
      });
    }

    return insights;
  };

  const computeMetrics = (): PerformanceMetrics => {
    const operationsByType: Record<string, number> = {};
    const operationsByCollection: Record<string, number> = {};
    let totalDuration = 0;
    let failedOperations = 0;
    let totalQueries = 0;
    let fullScanCandidates = 0;
    let manualSortCandidates = 0;
    let slowCounts = 0;
    let fastCounts = 0;
    let totalWrites = 0;
    let totalWriteRows = 0;
    let singleRowWrites = 0;
    const durations: number[] = [];

    for (const op of operations) {
      operationsByType[op.type] = (operationsByType[op.type] ?? 0) + 1;
      operationsByCollection[op.collection] =
        (operationsByCollection[op.collection] ?? 0) + 1;
      totalDuration += op.duration;
      durations.push(op.duration);
      if (!op.success) {
        failedOperations++;
      }

      const queryDetails = asQueryDetails(op.details);
      if (queryDetails) {
        totalQueries++;
        if (queryDetails.diagnostics.fullScanCandidate) {
          fullScanCandidates++;
        }
        if (queryDetails.diagnostics.manualSortCandidate) {
          manualSortCandidates++;
        }
      }

      const countDetails = asCountDetails(op.details);
      if (countDetails) {
        totalQueries++;
        if (countDetails.diagnostics.fullScanCandidate) {
          fullScanCandidates++;
        }
        if (countDetails.diagnostics.manualSortCandidate) {
          manualSortCandidates++;
        }
        if (countDetails.diagnostics.countMode === "slow") {
          slowCounts++;
        }
        if (countDetails.diagnostics.countMode === "fast") {
          fastCounts++;
        }
      }

      const bulkWriteDetails = asBulkWriteDetails(op.details);
      if (bulkWriteDetails) {
        totalWrites++;
        totalWriteRows += bulkWriteDetails.diagnostics.rowCount;
        if (bulkWriteDetails.diagnostics.rowCount === 1) {
          singleRowWrites++;
        }
      }
    }

    const sortedDurations = [...durations].sort((a, b) => a - b);
    const elapsedSeconds = startedAt ? Math.max(1, (Date.now() - startedAt) / 1000) : 1;

    const latency = {
      min: sortedDurations[0] ?? 0,
      max: sortedDurations[sortedDurations.length - 1] ?? 0,
      p50: percentile(sortedDurations, 50),
      p95: percentile(sortedDurations, 95),
      p99: percentile(sortedDurations, 99),
    };

    const queryStats: PerformanceMetrics["queryStats"] = {
      totalQueries,
      fullScanCandidates,
      manualSortCandidates,
      slowCounts,
      fastCounts,
    };

    const writeStats: PerformanceMetrics["writeStats"] = {
      totalWrites,
      totalRows: totalWriteRows,
      singleRowWrites,
      averageRowsPerWrite: totalWrites > 0 ? totalWriteRows / totalWrites : 0,
    };

    const insights = buildInsights({
      failedOperations,
      totalOperations: operations.length,
      queryStats,
      writeStats,
      latency,
    });

    const slowestOperations = [...operations]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      totalOperations: operations.length,
      operationsByType,
      operationsByCollection,
      averageDuration:
        operations.length > 0 ? totalDuration / operations.length : 0,
      totalDuration,
      failedOperations,
      slowestOperations,
      startedAt,
      isTracking: tracking$.value,
      operationsPerSecond: operations.length / elapsedSeconds,
      latency,
      queryStats,
      writeStats,
      profile,
      insights,
      instrumentation: {
        state: instrumentationState,
        error: instrumentationError,
      },
    };
  };

  return {
    start(): void {
      if (!tracking$.value) {
        startedAt = Date.now();
        tracking$.next(true);
        touch();
      }
      void initializeInstrumentation();
    },

    stop(): void {
      tracking$.next(false);
      touch();
    },

    isTracking(): boolean {
      return tracking$.value;
    },

    logOperation(log: Omit<OperationLog, "id" | "timestamp">): void {
      addOperation(log);
    },

    async track<T>(
      type: OperationTypeName,
      collection: string,
      operation: () => Promise<T>,
      getResultCount?: (result: T) => number,
    ): Promise<T> {
      const start = performance.now();
      let success = true;
      let error: string | undefined;
      let result: T;
      let resultCount: number | undefined;

      try {
        result = await operation();
        if (getResultCount) {
          resultCount = getResultCount(result);
        }
      } catch (err) {
        success = false;
        error = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        const duration = performance.now() - start;
        addOperation({
          type,
          collection,
          duration,
          success,
          error,
          resultCount,
        });
      }

      return result!;
    },

    getMetrics(): ExplorerQuery<PerformanceMetrics> {
      void initializeInstrumentation();
      return createQuery(
        revision$.pipe(map(() => computeMetrics())),
        { live: true },
      );
    },

    getOperations(options: { limit?: number } = {}): ExplorerQuery<OperationLog[]> {
      void initializeInstrumentation();
      const { limit } = options;
      return createQuery(
        revision$.pipe(
          map(() => {
            let result = [...operations].reverse();
            if (limit && limit > 0) {
              result = result.slice(0, limit);
            }
            return result;
          }),
        ),
        { live: true },
      );
    },

    getOperationsByCollection(
      collection: string,
      options: { limit?: number } = {},
    ): ExplorerQuery<OperationLog[]> {
      void initializeInstrumentation();
      const { limit } = options;
      return createQuery(
        revision$.pipe(
          map(() => {
            let result = [...operations]
              .filter((op) => op.collection === collection)
              .reverse();
            if (limit && limit > 0) {
              result = result.slice(0, limit);
            }
            return result;
          }),
        ),
        { live: true },
      );
    },

    getSlowOperations(thresholdMs: number = 100): ExplorerQuery<OperationLog[]> {
      void initializeInstrumentation();
      return createQuery(
        revision$.pipe(
          map(() =>
            [...operations]
              .filter((op) => op.duration >= thresholdMs)
              .sort((a, b) => b.duration - a.duration),
          ),
        ),
        { live: true },
      );
    },

    clear(): void {
      operations.length = 0;
      startedAt = tracking$.value ? Date.now() : null;
      touch();
    },

    dispose(): void {
      tracking$.next(false);
      for (const teardown of teardownInstrumentation) {
        teardown();
      }
      teardownInstrumentation = [];
      touch();
    },
  };
}
