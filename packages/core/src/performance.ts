import { BehaviorSubject, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { createQuery, createStaticQuery, type ExplorerQuery } from "./query.js";

/**
 * Types of database operations.
 */
export type OperationTypeName =
  | "find"
  | "findOne"
  | "findByIds"
  | "insert"
  | "update"
  | "delete"
  | "count"
  | "bulkInsert"
  | "bulkUpsert";

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
}

/**
 * Generate a unique operation ID.
 */
function generateOperationId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create the performance service.
 */
export function createPerformanceService(
  maxOperations: number = 500,
): PerformanceService {
  const operations: OperationLog[] = [];
  const tracking$ = new BehaviorSubject<boolean>(false);
  let startedAt: number | null = null;

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
  };

  const computeMetrics = (): PerformanceMetrics => {
    const operationsByType: Record<string, number> = {};
    const operationsByCollection: Record<string, number> = {};
    let totalDuration = 0;
    let failedOperations = 0;

    for (const op of operations) {
      operationsByType[op.type] = (operationsByType[op.type] ?? 0) + 1;
      operationsByCollection[op.collection] =
        (operationsByCollection[op.collection] ?? 0) + 1;
      totalDuration += op.duration;
      if (!op.success) {
        failedOperations++;
      }
    }

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
    };
  };

  return {
    start(): void {
      if (!tracking$.value) {
        startedAt = Date.now();
        tracking$.next(true);
      }
    },

    stop(): void {
      tracking$.next(false);
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
      const source$ = tracking$.pipe(map(() => computeMetrics()));
      return createQuery(source$, { live: true });
    },

    getOperations(options: { limit?: number } = {}): ExplorerQuery<OperationLog[]> {
      const { limit } = options;

      return createStaticQuery(() => {
        let result = [...operations].reverse();
        if (limit && limit > 0) {
          result = result.slice(0, limit);
        }
        return result;
      });
    },

    getOperationsByCollection(
      collection: string,
      options: { limit?: number } = {},
    ): ExplorerQuery<OperationLog[]> {
      const { limit } = options;

      return createStaticQuery(() => {
        let result = [...operations]
          .filter((op) => op.collection === collection)
          .reverse();
        if (limit && limit > 0) {
          result = result.slice(0, limit);
        }
        return result;
      });
    },

    getSlowOperations(thresholdMs: number = 100): ExplorerQuery<OperationLog[]> {
      return createStaticQuery(() => {
        return [...operations]
          .filter((op) => op.duration >= thresholdMs)
          .sort((a, b) => b.duration - a.duration);
      });
    },

    clear(): void {
      operations.length = 0;
      startedAt = tracking$.value ? Date.now() : null;
    },
  };
}
