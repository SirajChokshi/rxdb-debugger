import { from } from "solid-js";
import type { Observable, Subscription } from "rxjs";
import type { Accessor } from "solid-js";
import type { ExplorerQuery } from "@rxdb-debugger/core";

/**
 * Options for fromObservable.
 */
export interface FromObservableOptions<T> {
  /**
   * Initial value before the observable emits.
   */
  initialValue: T;
  /**
   * Error handler. If not provided, errors are logged to console.
   */
  onError?: (error: unknown) => void;
}

/**
 * Convert an RxJS Observable to a Solid signal using Solid's `from` utility.
 * Automatically handles subscription cleanup when the reactive scope is disposed.
 *
 * The initial value may have a different type than the stream (e.g. `null`
 * as a "not loaded yet" sentinel that is distinguishable from a legitimate
 * empty result).
 *
 * @param observable$ - The RxJS Observable to subscribe to
 * @param options - Options including initial value and error handler
 * @returns A Solid Accessor that tracks the observable's latest value
 *
 * @example
 * ```tsx
 * const count = fromObservable(collection.count().$, { initialValue: 0 });
 * return <div>Count: {count()}</div>;
 * ```
 */
export function fromObservable<T, I = T>(
  observable$: Observable<T>,
  options: FromObservableOptions<I>
): Accessor<T | I> {
  const { initialValue, onError } = options;

  return from<T | I>((set) => {
    set(() => initialValue);
    let subscription: Subscription | null = null;

    subscription = observable$.subscribe({
      next: (value) => set(() => value),
      error: (err) => {
        if (onError) {
          onError(err);
        } else {
          console.error("Observable error:", err);
        }
      },
    });

    return () => {
      subscription?.unsubscribe();
    };
  }) as Accessor<T | I>;
}

/**
 * Convert an ExplorerQuery to a Solid signal.
 * Subscribes to the query's observable and returns a signal that tracks updates.
 *
 * @param query - The ExplorerQuery to subscribe to
 * @param options - Options including initial value and error handler
 * @returns A Solid Accessor that tracks the query's latest value
 *
 * @example
 * ```tsx
 * const collections = fromExplorerQuery(
 *   debugger.catalog.collections({ live: true }),
 *   { initialValue: [] }
 * );
 * return <For each={collections()}>{...}</For>;
 * ```
 */
export function fromExplorerQuery<T, I = T>(
  query: ExplorerQuery<T>,
  options: FromObservableOptions<I>
): Accessor<T | I> {
  return fromObservable(query.observe(), options);
}

/**
 * Like fromObservable, but guards against `getObservable` throwing
 * synchronously (e.g. when the underlying collection does not exist yet).
 *
 * Note: the producer runs exactly once per reactive owner. Reading signals
 * inside `getObservable` does NOT re-subscribe when they change. To derive
 * the observable from reactive state, create this signal inside a computation
 * that re-runs (and therefore disposes/resubscribes) when its inputs change:
 *
 * @example
 * ```tsx
 * const documents = createMemo(() => {
 *   const collection = selectedCollection();
 *   if (!collection) return null;
 *   return createObservableSignal(
 *     () => debugger.documents.list(collection, { live: true }).observe(),
 *     { initialValue: [] }
 *   );
 * });
 * // read as documents()?.()
 * ```
 */
export function createObservableSignal<T, I = T>(
  getObservable: () => Observable<T>,
  options: FromObservableOptions<I>
): Accessor<T | I> {
  const { initialValue, onError } = options;

  return from<T | I>((set) => {
    set(() => initialValue);
    let subscription: Subscription | null = null;

    try {
      const observable$ = getObservable();
      subscription = observable$.subscribe({
        next: (value) => set(() => value),
        error: (err) => {
          if (onError) {
            onError(err);
          } else {
            console.error("Observable error:", err);
          }
        },
      });
    } catch (err) {
      if (onError) {
        onError(err);
      } else {
        console.error("Error creating observable:", err);
      }
    }

    return () => {
      subscription?.unsubscribe();
    };
  }) as Accessor<T | I>;
}
