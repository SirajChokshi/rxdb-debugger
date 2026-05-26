type SharedInitializerState = "idle" | "starting" | "ready" | "disposed";

export interface SharedInitializerContext {
  shouldContinue(): boolean;
}

export interface SharedInitializerStartOptions {
  force?: boolean;
}

/**
 * Coordinates async service-level startup independently from individual subscribers.
 *
 * Consumers may retain/release interest, but only `dispose()` can cancel the
 * shared resource outright. This keeps one cancelled subscriber from invalidating
 * startup for another subscriber that joined the same in-flight initialization.
 */
export class SharedAsyncInitializer {
  private state: SharedInitializerState = "idle";
  private promise: Promise<void> | null = null;
  private activeConsumers = 0;
  private forceRequested = false;

  retain(): () => void {
    if (this.state === "disposed") {
      return () => {};
    }

    this.activeConsumers += 1;
    let released = false;

    return () => {
      if (released) {
        return;
      }
      released = true;
      this.activeConsumers = Math.max(0, this.activeConsumers - 1);
    };
  }

  ensureStarted(
    start: (context: SharedInitializerContext) => Promise<void>,
    options: SharedInitializerStartOptions = {},
  ): Promise<void> {
    if (this.state === "ready" || this.state === "disposed") {
      return Promise.resolve();
    }

    if (options.force) {
      this.forceRequested = true;
    }

    if (this.promise) {
      return this.promise;
    }

    this.state = "starting";
    const context: SharedInitializerContext = {
      shouldContinue: () =>
        this.state !== "disposed"
        && (this.forceRequested || this.activeConsumers > 0),
    };

    this.promise = (async () => {
      try {
        await start(context);
        this.state = context.shouldContinue() ? "ready" : "idle";
      } catch (error) {
        this.state = this.state === "disposed" ? "disposed" : "idle";
        throw error;
      } finally {
        this.promise = null;
        this.forceRequested = false;
      }
    })();

    return this.promise;
  }

  dispose(cleanup?: () => void): void {
    if (this.state === "disposed") {
      return;
    }

    this.state = "disposed";
    this.promise = null;
    this.forceRequested = false;
    this.activeConsumers = 0;
    cleanup?.();
  }
}
