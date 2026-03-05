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
export function fromObservable<T>(
  observable$: Observable<T>,
  options: FromObservableOptions<T>
): Accessor<T> {
  const { initialValue, onError } = options;

  return from<T>((set) => {
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
  }) as Accessor<T>;
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
export function fromExplorerQuery<T>(
  query: ExplorerQuery<T>,
  options: FromObservableOptions<T>
): Accessor<T> {
  return fromObservable(query.observe(), options);
}

/**
 * Hook-like wrapper for fromObservable that creates a reactive signal from an observable.
 * Use this when you need to create the observable dynamically based on reactive dependencies.
 *
 * @param getObservable - Function that returns the observable to subscribe to
 * @param options - Options including initial value and error handler
 * @returns A Solid Accessor that tracks the observable's latest value
 *
 * @example
 * ```tsx
 * const documents = createObservableSignal(
 *   () => debugger.documents.list(selectedCollection(), { live: true }).observe(),
 *   { initialValue: [] }
 * );
 * ```
 */
export function createObservableSignal<T>(
  getObservable: () => Observable<T>,
  options: FromObservableOptions<T>
): Accessor<T> {
  const { initialValue, onError } = options;

  return from<T>((set) => {
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
  }) as Accessor<T>;
}
