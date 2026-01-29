import { Observable } from "rxjs";
import { shareReplay, take } from "rxjs/operators";

/**
 * Options for controlling live/snapshot behavior.
 */
export interface LiveOptions {
  /**
   * When true, observe() returns a live stream that updates on changes.
   * When false (default), observe() emits once and completes.
   */
  live?: boolean;
}

/**
 * A query result that supports both imperative (get) and reactive (observe) access.
 * This abstraction allows UI layers to choose their consumption pattern.
 */
export interface ExplorerQuery<T> {
  /**
   * Execute the query once and return the result.
   */
  get(): Promise<T>;

  /**
   * Get an observable stream of results.
   * In snapshot mode (live: false), emits once and completes.
   * In live mode (live: true), emits on every change.
   */
  observe(): Observable<T>;
}

/**
 * Create an ExplorerQuery from a live observable source.
 *
 * @param source$ - The live observable that emits on changes
 * @param options - Live options controlling stream behavior
 */
export function createQuery<T>(
  source$: Observable<T>,
  options: LiveOptions = {},
): ExplorerQuery<T> {
  const { live = false } = options;

  const shared$ = source$.pipe(shareReplay({ bufferSize: 1, refCount: true }));

  return {
    async get(): Promise<T> {
      return new Promise((resolve, reject) => {
        shared$.pipe(take(1)).subscribe({
          next: resolve,
          error: reject,
        });
      });
    },

    observe(): Observable<T> {
      if (live) {
        return shared$;
      }
      return shared$.pipe(take(1));
    },
  };
}

/**
 * Create an ExplorerQuery from a static value or promise.
 * Useful for metadata that doesn't change.
 */
export function createStaticQuery<T>(
  getValue: () => T | Promise<T>,
): ExplorerQuery<T> {
  let cached: Promise<T> | null = null;

  const getCached = (): Promise<T> => {
    if (!cached) {
      const result = getValue();
      cached = result instanceof Promise ? result : Promise.resolve(result);
    }
    return cached;
  };

  return {
    get: getCached,
    observe(): Observable<T> {
      return new Observable((subscriber) => {
        getCached()
          .then((value) => {
            subscriber.next(value);
            subscriber.complete();
          })
          .catch((err) => subscriber.error(err));
      });
    },
  };
}

/**
 * Create an ExplorerQuery that wraps an async factory function.
 * Each call to get() re-executes the factory (no caching).
 * observe() emits once per subscription.
 */
export function createAsyncQuery<T>(
  factory: () => Promise<T>,
  options: LiveOptions = {},
): ExplorerQuery<T> {
  const { live = false } = options;

  if (live) {
    throw new Error(
      "createAsyncQuery does not support live mode. Use createQuery with an Observable source.",
    );
  }

  return {
    get: factory,
    observe(): Observable<T> {
      return new Observable((subscriber) => {
        factory()
          .then((value) => {
            subscriber.next(value);
            subscriber.complete();
          })
          .catch((err) => subscriber.error(err));
      });
    },
  };
}
