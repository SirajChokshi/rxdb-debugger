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
 * Create an observable whose inner live source is resolved asynchronously.
 *
 * RxDB handles are often behind a Promise, while Solid can dispose reactive
 * scopes synchronously. This guards the gap so an unsubscribe that happens
 * before the Promise resolves cannot leave an inner RxDB subscription behind.
 */
export function createAsyncObservable<T>(
  getSource: () => Promise<Observable<T>>,
): Observable<T> {
  return new Observable<T>((subscriber) => {
    let innerSub: { unsubscribe: () => void } | null = null;
    let disposed = false;

    getSource()
      .then((source$) => {
        if (disposed || subscriber.closed) {
          return;
        }

        innerSub = source$.subscribe(subscriber);

        if (disposed || subscriber.closed) {
          innerSub.unsubscribe();
          innerSub = null;
        }
      })
      .catch((error) => {
        if (!disposed && !subscriber.closed) {
          subscriber.error(error);
        }
      });

    return () => {
      disposed = true;
      innerSub?.unsubscribe();
      innerSub = null;
    };
  });
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
