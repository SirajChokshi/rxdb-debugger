import type { RxCollection, RxDatabase } from "rxdb/plugins/core";
import { REPLICATION_STATE_BY_COLLECTION } from "rxdb/plugins/replication";
import { BehaviorSubject, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { createQuery, type ExplorerQuery, type LiveOptions } from "./query.js";

const STATE_DISCOVERY_INTERVAL_MS = 1500;
const MAX_RECENT_ERRORS = 10;

type ReplicationDirection = "pull" | "push" | "unknown";

interface ReplicationStateLike {
  readonly replicationIdentifier: string;
  readonly deletedField?: string;
  readonly pull?: unknown;
  readonly push?: unknown;
  readonly live?: boolean;
  readonly retryTime?: number;
  readonly autoStart?: boolean;
  readonly active$?: Observable<boolean>;
  readonly canceled$?: Observable<boolean>;
  readonly sent$?: Observable<unknown>;
  readonly received$?: Observable<unknown>;
  readonly error$?: Observable<unknown>;
  reSync?: () => void;
  pause?: () => Promise<unknown> | unknown;
  start?: () => Promise<unknown> | unknown;
  isPaused?: () => boolean;
  isStopped?: () => boolean;
  awaitInitialReplication?: () => Promise<unknown>;
  awaitInSync?: () => Promise<unknown>;
}

interface TrackedReplicationState {
  key: string;
  collection: string;
  state: ReplicationStateLike;
  snapshot: ReplicationStateSnapshot;
  subscriptions: Array<{ unsubscribe: () => void }>;
  inSyncCheckInFlight: boolean;
  needsInSyncRecheck: boolean;
}

interface ErrorWithMessage {
  message?: unknown;
  parameters?: {
    direction?: unknown;
    errors?: unknown[];
  };
}

/**
 * Error metadata captured from replication streams.
 */
export interface ReplicationErrorInfo {
  /** Error message */
  message: string;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Replication direction, if available */
  direction: ReplicationDirection;
}

/**
 * Runtime snapshot of a single RxReplicationState.
 */
export interface ReplicationStateSnapshot {
  /** Stable debugger-side ID */
  id: string;
  /** Collection name */
  collection: string;
  /** Replication identifier */
  replicationIdentifier: string;
  /** Pull configured */
  hasPull: boolean;
  /** Push configured */
  hasPush: boolean;
  /** Live replication mode */
  live: boolean;
  /** Retry time in ms */
  retryTime: number | null;
  /** Auto-start configured */
  autoStart: boolean | null;
  /** Deleted flag field mapping */
  deletedField: string;
  /** Currently running a cycle */
  isActive: boolean;
  /** Currently paused */
  isPaused: boolean;
  /** Replication stopped/canceled */
  isStopped: boolean;
  /** Canceled stream signal */
  isCanceled: boolean;
  /** Initial replication completed at least once */
  isInitialReplicationComplete: boolean;
  /** Initial replication completion timestamp */
  initialReplicationCompletedAt: number | null;
  /** Most recent in-sync evaluation */
  isInSync: boolean;
  /** Last in-sync timestamp */
  lastInSyncAt: number | null;
  /** Total pushed docs observed */
  sentCount: number;
  /** Total pulled docs observed */
  receivedCount: number;
  /** Total errors observed */
  errorCount: number;
  /** Last replication activity timestamp */
  lastActivityAt: number | null;
  /** Most recent error */
  lastError: ReplicationErrorInfo | null;
  /** Recent errors, newest first */
  recentErrors: ReplicationErrorInfo[];
}

/**
 * Aggregated replication metrics per collection.
 */
export interface CollectionReplicationSummary {
  /** Collection name */
  collection: string;
  /** Number of discovered replication states */
  totalStates: number;
  /** Number of active states */
  activeStates: number;
  /** Number of paused states */
  pausedStates: number;
  /** Number of stopped states */
  stoppedStates: number;
  /** Number of states with errors */
  statesWithErrors: number;
  /** Total sent docs across states */
  totalSent: number;
  /** Total received docs across states */
  totalReceived: number;
  /** Total errors across states */
  totalErrors: number;
  /** True when any state is still waiting for initial replication */
  hasInitialReplicationPending: boolean;
  /** True when any running state is not in sync */
  hasOutOfSyncStates: boolean;
  /** Most recent activity timestamp across states */
  lastActivityAt: number | null;
}

/**
 * Service for discovering and monitoring RxDB replication states.
 */
export interface ReplicationService {
  /**
   * Get all discovered replication state snapshots.
   */
  states(options?: LiveOptions): ExplorerQuery<ReplicationStateSnapshot[]>;

  /**
   * Get per-collection replication summaries.
   */
  collectionSummaries(options?: LiveOptions): ExplorerQuery<CollectionReplicationSummary[]>;

  /**
   * Trigger re-sync on matching replication state(s).
   */
  reSync(collectionName: string, replicationIdentifier: string): Promise<boolean>;

  /**
   * Pause matching replication state(s).
   */
  pause(collectionName: string, replicationIdentifier: string): Promise<boolean>;

  /**
   * Start/resume matching replication state(s).
   */
  start(collectionName: string, replicationIdentifier: string): Promise<boolean>;

  /**
   * Force a discovery refresh.
   */
  refresh(): Promise<void>;

  /**
   * Cleanup subscriptions/resources.
   */
  dispose(): void;
}

function isObservable<T>(value: unknown): value is Observable<T> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { subscribe?: unknown };
  return typeof candidate.subscribe === "function";
}

function isReplicationStateLike(value: unknown): value is ReplicationStateLike {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { replicationIdentifier?: unknown };
  return typeof candidate.replicationIdentifier === "string";
}

function getDirection(error: unknown): ReplicationDirection {
  if (typeof error !== "object" || error === null) {
    return "unknown";
  }

  const candidate = error as ErrorWithMessage;
  const direction = candidate.parameters?.direction;
  if (direction === "pull" || direction === "push") {
    return direction;
  }
  return "unknown";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const candidate = error as ErrorWithMessage;
    if (typeof candidate.message === "string" && candidate.message.length > 0) {
      return candidate.message;
    }
    const originalErrors = candidate.parameters?.errors;
    if (Array.isArray(originalErrors) && originalErrors.length > 0) {
      const first = originalErrors[0];
      if (typeof first === "string") {
        return first;
      }
      if (typeof first === "object" && first !== null) {
        const firstObj = first as { message?: unknown };
        if (typeof firstObj.message === "string" && firstObj.message.length > 0) {
          return firstObj.message;
        }
      }
    }
  }

  return String(error);
}

function maxTimestamp(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

function computeCollectionSummaries(
  snapshots: ReplicationStateSnapshot[],
  collectionNames: string[],
): CollectionReplicationSummary[] {
  const summaries = new Map<string, CollectionReplicationSummary>();

  for (const collectionName of collectionNames) {
    summaries.set(collectionName, {
      collection: collectionName,
      totalStates: 0,
      activeStates: 0,
      pausedStates: 0,
      stoppedStates: 0,
      statesWithErrors: 0,
      totalSent: 0,
      totalReceived: 0,
      totalErrors: 0,
      hasInitialReplicationPending: false,
      hasOutOfSyncStates: false,
      lastActivityAt: null,
    });
  }

  for (const snapshot of snapshots) {
    const existing = summaries.get(snapshot.collection) ?? {
      collection: snapshot.collection,
      totalStates: 0,
      activeStates: 0,
      pausedStates: 0,
      stoppedStates: 0,
      statesWithErrors: 0,
      totalSent: 0,
      totalReceived: 0,
      totalErrors: 0,
      hasInitialReplicationPending: false,
      hasOutOfSyncStates: false,
      lastActivityAt: null,
    };

    existing.totalStates += 1;
    existing.activeStates += snapshot.isActive ? 1 : 0;
    existing.pausedStates += snapshot.isPaused ? 1 : 0;
    existing.stoppedStates += snapshot.isStopped ? 1 : 0;
    existing.statesWithErrors += snapshot.errorCount > 0 ? 1 : 0;
    existing.totalSent += snapshot.sentCount;
    existing.totalReceived += snapshot.receivedCount;
    existing.totalErrors += snapshot.errorCount;
    existing.hasInitialReplicationPending =
      existing.hasInitialReplicationPending
      || (!snapshot.isInitialReplicationComplete && !snapshot.isStopped);
    existing.hasOutOfSyncStates =
      existing.hasOutOfSyncStates
      || (!snapshot.isInSync && !snapshot.isStopped && !snapshot.isPaused);
    existing.lastActivityAt = maxTimestamp(existing.lastActivityAt, snapshot.lastActivityAt);

    summaries.set(snapshot.collection, existing);
  }

  return [...summaries.values()].sort((a, b) => a.collection.localeCompare(b.collection));
}

export function createReplicationService(
  getDb: () => Promise<RxDatabase>,
): ReplicationService {
  const snapshots$ = new BehaviorSubject<ReplicationStateSnapshot[]>([]);
  const trackedStates = new Map<string, TrackedReplicationState>();
  const stateIds = new WeakMap<object, string>();

  let stateIdCounter = 0;
  let knownCollectionNames: string[] = [];
  let initialized = false;
  let disposed = false;
  let discoveryInterval: ReturnType<typeof setInterval> | null = null;

  const emitSnapshots = (): void => {
    if (disposed) return;
    const next = [...trackedStates.values()]
      .map((entry) => ({
        ...entry.snapshot,
        recentErrors: [...entry.snapshot.recentErrors],
      }))
      .sort((a, b) => {
        const byCollection = a.collection.localeCompare(b.collection);
        if (byCollection !== 0) return byCollection;
        return a.replicationIdentifier.localeCompare(b.replicationIdentifier);
      });
    snapshots$.next(next);
  };

  const getStateKey = (
    collectionName: string,
    state: ReplicationStateLike,
  ): string => {
    const stateObject = state as object;
    let stateId = stateIds.get(stateObject);
    if (!stateId) {
      stateIdCounter += 1;
      stateId = `replication-state-${stateIdCounter}`;
      stateIds.set(stateObject, stateId);
    }
    return `${collectionName}::${stateId}`;
  };

  const updateSnapshot = (
    tracked: TrackedReplicationState,
    updater: (prev: ReplicationStateSnapshot) => ReplicationStateSnapshot,
  ): void => {
    tracked.snapshot = updater(tracked.snapshot);
    emitSnapshots();
  };

  const recordError = (tracked: TrackedReplicationState, error: unknown): void => {
    const nextError: ReplicationErrorInfo = {
      message: getErrorMessage(error),
      direction: getDirection(error),
      timestamp: Date.now(),
    };

    updateSnapshot(tracked, (prev) => ({
      ...prev,
      errorCount: prev.errorCount + 1,
      lastError: nextError,
      recentErrors: [nextError, ...prev.recentErrors].slice(0, MAX_RECENT_ERRORS),
      isInSync: false,
    }));
  };

  const refreshRuntimeFlags = (tracked: TrackedReplicationState): void => {
    const state = tracked.state;
    let isPaused = tracked.snapshot.isPaused;
    let isStopped = tracked.snapshot.isStopped;
    try {
      if (typeof state.isPaused === "function") {
        isPaused = !!state.isPaused();
      }
      if (typeof state.isStopped === "function") {
        isStopped = !!state.isStopped();
      }
    } catch {
      // Ignore runtime probe failures.
    }

    updateSnapshot(tracked, (prev) => ({
      ...prev,
      isPaused,
      isStopped,
      isCanceled: prev.isCanceled || isStopped,
      isActive: isStopped ? false : prev.isActive,
    }));
  };

  const scheduleInSyncCheck = (tracked: TrackedReplicationState): void => {
    if (disposed) return;
    if (tracked.snapshot.isStopped || tracked.snapshot.isPaused) return;
    if (typeof tracked.state.awaitInSync !== "function") return;

    if (tracked.inSyncCheckInFlight) {
      tracked.needsInSyncRecheck = true;
      return;
    }

    tracked.inSyncCheckInFlight = true;
    Promise.resolve()
      .then(() => tracked.state.awaitInSync!())
      .then(() => {
        if (disposed) return;
        updateSnapshot(tracked, (prev) => ({
          ...prev,
          isInSync: true,
          lastInSyncAt: Date.now(),
        }));
      })
      .catch((error) => {
        if (disposed) return;
        recordError(tracked, error);
      })
      .finally(() => {
        tracked.inSyncCheckInFlight = false;
        if (tracked.needsInSyncRecheck) {
          tracked.needsInSyncRecheck = false;
          scheduleInSyncCheck(tracked);
        }
      });
  };

  const subscribeObservable = <T,>(
    tracked: TrackedReplicationState,
    observable: Observable<T> | undefined,
    onNext: (value: T) => void,
  ): void => {
    if (!observable) return;
    const sub = observable.subscribe({
      next: onNext,
      error: (error) => recordError(tracked, error),
    });
    tracked.subscriptions.push(sub);
  };

  const trackState = (
    collectionName: string,
    state: ReplicationStateLike,
  ): void => {
    const key = getStateKey(collectionName, state);
    if (trackedStates.has(key)) {
      const existing = trackedStates.get(key);
      if (existing) {
        refreshRuntimeFlags(existing);
      }
      return;
    }

    const initialSnapshot: ReplicationStateSnapshot = {
      id: key,
      collection: collectionName,
      replicationIdentifier: state.replicationIdentifier,
      hasPull: !!state.pull,
      hasPush: !!state.push,
      live: state.live ?? true,
      retryTime: typeof state.retryTime === "number" ? state.retryTime : null,
      autoStart: typeof state.autoStart === "boolean" ? state.autoStart : null,
      deletedField: typeof state.deletedField === "string" ? state.deletedField : "_deleted",
      isActive: false,
      isPaused: false,
      isStopped: false,
      isCanceled: false,
      isInitialReplicationComplete: false,
      initialReplicationCompletedAt: null,
      isInSync: false,
      lastInSyncAt: null,
      sentCount: 0,
      receivedCount: 0,
      errorCount: 0,
      lastActivityAt: null,
      lastError: null,
      recentErrors: [],
    };

    const tracked: TrackedReplicationState = {
      key,
      collection: collectionName,
      state,
      snapshot: initialSnapshot,
      subscriptions: [],
      inSyncCheckInFlight: false,
      needsInSyncRecheck: false,
    };
    trackedStates.set(key, tracked);

    subscribeObservable(tracked, isObservable<boolean>(state.active$) ? state.active$ : undefined, (isActive) => {
      updateSnapshot(tracked, (prev) => ({
        ...prev,
        isActive,
        isInSync: isActive ? false : prev.isInSync,
        lastActivityAt: isActive ? Date.now() : prev.lastActivityAt,
      }));
      if (!isActive) {
        scheduleInSyncCheck(tracked);
      }
    });

    subscribeObservable(tracked, isObservable<boolean>(state.canceled$) ? state.canceled$ : undefined, (isCanceled) => {
      updateSnapshot(tracked, (prev) => ({
        ...prev,
        isCanceled,
        isStopped: isCanceled || prev.isStopped,
        isActive: isCanceled ? false : prev.isActive,
      }));
    });

    subscribeObservable(tracked, isObservable(state.sent$) ? state.sent$ : undefined, () => {
      updateSnapshot(tracked, (prev) => ({
        ...prev,
        sentCount: prev.sentCount + 1,
        lastActivityAt: Date.now(),
        isInSync: false,
      }));
    });

    subscribeObservable(tracked, isObservable(state.received$) ? state.received$ : undefined, () => {
      updateSnapshot(tracked, (prev) => ({
        ...prev,
        receivedCount: prev.receivedCount + 1,
        lastActivityAt: Date.now(),
        isInSync: false,
      }));
    });

    subscribeObservable(tracked, isObservable(state.error$) ? state.error$ : undefined, (error) => {
      recordError(tracked, error);
    });

    if (typeof state.awaitInitialReplication === "function") {
      Promise.resolve()
        .then(() => state.awaitInitialReplication!())
        .then(() => {
          if (disposed) return;
          updateSnapshot(tracked, (prev) => ({
            ...prev,
            isInitialReplicationComplete: true,
            initialReplicationCompletedAt: prev.initialReplicationCompletedAt ?? Date.now(),
          }));
          scheduleInSyncCheck(tracked);
        })
        .catch((error) => {
          if (disposed) return;
          recordError(tracked, error);
        });
    }

    refreshRuntimeFlags(tracked);
    scheduleInSyncCheck(tracked);
  };

  const getReplicationStatesForCollection = (
    collection: RxCollection | unknown,
  ): ReplicationStateLike[] => {
    if (typeof collection !== "object" || collection === null) {
      return [];
    }
    const rawStates = (REPLICATION_STATE_BY_COLLECTION as unknown as {
      get: (value: object) => unknown;
    }).get(collection as object);

    if (!Array.isArray(rawStates)) {
      return [];
    }

    return rawStates.filter(isReplicationStateLike);
  };

  const refreshDiscoveredStates = async (
    shouldContinue: () => boolean = () => true,
  ): Promise<void> => {
    if (disposed || !shouldContinue()) return;
    const db = await getDb();
    if (disposed || !shouldContinue()) return;

    knownCollectionNames = Object.keys(db.collections).sort();
    for (const collectionName of knownCollectionNames) {
      const collection = db.collections[collectionName];
      const states = getReplicationStatesForCollection(collection);
      for (const state of states) {
        trackState(collectionName, state);
      }
    }
    emitSnapshots();
  };

  const initialize = async (
    shouldContinue: () => boolean = () => true,
  ): Promise<void> => {
    if (initialized || disposed) return;
    initialized = true;

    try {
      await refreshDiscoveredStates(shouldContinue);
      if (disposed || !shouldContinue()) {
        initialized = false;
        return;
      }
      if (!disposed && shouldContinue()) {
        discoveryInterval = setInterval(() => {
          void refreshDiscoveredStates().catch(() => {
            // Discovery retries on next interval.
          });
        }, STATE_DISCOVERY_INTERVAL_MS);
      }
    } catch (error) {
      initialized = false;
      throw error;
    }
  };

  const createSource$ = <T,>(
    selector: (snapshots: ReplicationStateSnapshot[]) => T,
  ): Observable<T> => {
    return new Observable<T>((subscriber) => {
      let innerSub: { unsubscribe: () => void } | null = null;
      let unsubscribed = false;

      initialize(() => !unsubscribed && !subscriber.closed)
        .then(() => {
          if (unsubscribed || subscriber.closed) {
            return;
          }
          innerSub = snapshots$
            .pipe(map(selector))
            .subscribe(subscriber);
        })
        .catch((error) => {
          subscriber.error(error);
        });

      return () => {
        unsubscribed = true;
        innerSub?.unsubscribe();
      };
    });
  };

  const getMatchingStates = (
    collectionName: string,
    replicationIdentifier: string,
  ): TrackedReplicationState[] => {
    return [...trackedStates.values()].filter((entry) =>
      entry.collection === collectionName
      && entry.snapshot.replicationIdentifier === replicationIdentifier
    );
  };

  const runControlAction = async (
    collectionName: string,
    replicationIdentifier: string,
    action: "reSync" | "pause" | "start",
  ): Promise<boolean> => {
    await initialize();

    const matches = getMatchingStates(collectionName, replicationIdentifier);
    if (matches.length === 0) {
      return false;
    }

    let didRun = false;
    for (const entry of matches) {
      const fn = entry.state[action];
      if (typeof fn !== "function") {
        continue;
      }
      didRun = true;
      await Promise.resolve(fn.call(entry.state));
      refreshRuntimeFlags(entry);
      if (action === "reSync" || action === "start") {
        scheduleInSyncCheck(entry);
      }
    }

    emitSnapshots();
    return didRun;
  };

  return {
    states(options: LiveOptions = {}): ExplorerQuery<ReplicationStateSnapshot[]> {
      return createQuery(createSource$((snapshots) => snapshots), options);
    },

    collectionSummaries(
      options: LiveOptions = {},
    ): ExplorerQuery<CollectionReplicationSummary[]> {
      return createQuery(
        createSource$((snapshots) =>
          computeCollectionSummaries(snapshots, knownCollectionNames)
        ),
        options,
      );
    },

    reSync(collectionName: string, replicationIdentifier: string): Promise<boolean> {
      return runControlAction(collectionName, replicationIdentifier, "reSync");
    },

    pause(collectionName: string, replicationIdentifier: string): Promise<boolean> {
      return runControlAction(collectionName, replicationIdentifier, "pause");
    },

    start(collectionName: string, replicationIdentifier: string): Promise<boolean> {
      return runControlAction(collectionName, replicationIdentifier, "start");
    },

    async refresh(): Promise<void> {
      await initialize();
      await refreshDiscoveredStates();
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;

      if (discoveryInterval) {
        clearInterval(discoveryInterval);
        discoveryInterval = null;
      }

      for (const tracked of trackedStates.values()) {
        for (const sub of tracked.subscriptions) {
          sub.unsubscribe();
        }
      }
      trackedStates.clear();
      snapshots$.complete();
    },
  };
}
