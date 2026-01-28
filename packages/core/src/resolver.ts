import type { RxDatabase } from "rxdb/plugins/core";

/**
 * Flexible database input type.
 * Accepts a database instance, a Promise resolving to one, or a factory function.
 */
export type DbInput<T extends RxDatabase = RxDatabase> =
  | T
  | Promise<T>
  | (() => T | Promise<T>);

/**
 * Resolve a DbInput to a cached Promise<RxDatabase>.
 * The resolution happens once and is memoized.
 */
export function resolveDb<T extends RxDatabase>(input: DbInput<T>): Promise<T> {
  if (input instanceof Promise) {
    return input;
  }

  if (typeof input === "function") {
    const result = input();
    if (result instanceof Promise) {
      return result;
    }
    return Promise.resolve(result);
  }

  return Promise.resolve(input);
}

/**
 * Create a memoized resolver that caches the database instance.
 */
export function createMemoizedResolver<T extends RxDatabase>(
  input: DbInput<T>,
): () => Promise<T> {
  let cached: Promise<T> | null = null;

  return () => {
    if (!cached) {
      cached = resolveDb(input);
    }
    return cached;
  };
}
