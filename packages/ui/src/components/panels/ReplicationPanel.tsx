import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import type {
  CollectionReplicationSummary,
  ReplicationStateSnapshot,
  RxdbDebugger,
} from "@rxdb-debugger/core";
import type { Theme } from "../../styles/theme.js";
import { fromExplorerQuery } from "../../utils/observable.js";
import { Button } from "../shared/Button.js";
import { Resizable } from "../shared/Resizable.js";

export interface ReplicationPanelProps {
  theme: Theme;
  debugger: RxdbDebugger;
}

function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleTimeString();
}

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return "never";
  const deltaMs = Date.now() - timestamp;
  if (deltaMs < 1000) return "just now";
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusBadgeClasses(status: "active" | "paused" | "stopped" | "idle"): string {
  const base = "px-[var(--spacing-xs)] py-0.5 rounded-sm text-[10px] font-semibold";
  if (status === "active") return `${base} bg-success/30 text-success`;
  if (status === "paused") return `${base} bg-warning/30 text-warning`;
  if (status === "stopped") return `${base} bg-error/30 text-error`;
  return `${base} bg-bg-secondary text-text-muted`;
}

function getStateStatus(state: ReplicationStateSnapshot): "active" | "paused" | "stopped" | "idle" {
  if (state.isStopped || state.isCanceled) return "stopped";
  if (state.isPaused) return "paused";
  if (state.isActive) return "active";
  return "idle";
}

function summaryHealth(summary: CollectionReplicationSummary): string {
  if (summary.totalStates === 0) return "No replication";
  if (summary.totalErrors > 0) return "Errors";
  if (summary.hasOutOfSyncStates) return "Syncing";
  return "Healthy";
}

export function ReplicationPanel(props: ReplicationPanelProps) {
  const [queryError, setQueryError] = createSignal<string | null>(null);
  const [actionError, setActionError] = createSignal<string | null>(null);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedCollection, setSelectedCollection] = createSignal<string | null>(null);
  const [selectedStateId, setSelectedStateId] = createSignal<string | null>(null);
  const [isRunningAction, setIsRunningAction] = createSignal(false);

  const summaries = fromExplorerQuery(
    props.debugger.replication.collectionSummaries({ live: true }),
    {
      initialValue: [] as CollectionReplicationSummary[],
      onError: (error) =>
        setQueryError(error instanceof Error ? error.message : "Failed to load replication summaries"),
    },
  );

  const states = fromExplorerQuery(
    props.debugger.replication.states({ live: true }),
    {
      initialValue: [] as ReplicationStateSnapshot[],
      onError: (error) =>
        setQueryError(error instanceof Error ? error.message : "Failed to load replication states"),
    },
  );

  const filteredSummaries = createMemo(() => {
    const query = searchQuery().trim().toLowerCase();
    if (!query) return summaries();
    return summaries().filter((summary) => summary.collection.toLowerCase().includes(query));
  });

  const selectedCollectionSummary = createMemo(() =>
    summaries().find((summary) => summary.collection === selectedCollection()) ?? null
  );

  const selectedCollectionStates = createMemo(() =>
    states()
      .filter((state) => state.collection === selectedCollection())
      .sort((a, b) => a.replicationIdentifier.localeCompare(b.replicationIdentifier))
  );

  const selectedState = createMemo(() =>
    selectedCollectionStates().find((state) => state.id === selectedStateId()) ?? null
  );

  createEffect(() => {
    const list = filteredSummaries();
    if (list.length === 0) {
      setSelectedCollection(null);
      return;
    }
    if (!selectedCollection() || !list.some((item) => item.collection === selectedCollection())) {
      setSelectedCollection(list[0]!.collection);
    }
  });

  createEffect(() => {
    const list = selectedCollectionStates();
    if (list.length === 0) {
      setSelectedStateId(null);
      return;
    }
    if (!selectedStateId() || !list.some((state) => state.id === selectedStateId())) {
      setSelectedStateId(list[0]!.id);
    }
  });

  const refresh = async () => {
    setActionError(null);
    try {
      await props.debugger.replication.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to refresh replication state");
    }
  };

  const runAction = async (action: "reSync" | "pause" | "start") => {
    const state = selectedState();
    if (!state || isRunningAction()) return;

    setIsRunningAction(true);
    setActionError(null);
    try {
      let changed = false;
      if (action === "reSync") {
        changed = await props.debugger.replication.reSync(state.collection, state.replicationIdentifier);
      } else if (action === "pause") {
        changed = await props.debugger.replication.pause(state.collection, state.replicationIdentifier);
      } else {
        changed = await props.debugger.replication.start(state.collection, state.replicationIdentifier);
      }

      if (!changed) {
        setActionError("Replication state no longer available.");
      }
      await props.debugger.replication.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Replication action failed");
    } finally {
      setIsRunningAction(false);
    }
  };

  const listPane = () => (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex flex-col p-[var(--spacing-md)] gap-[var(--spacing-sm)] border-b border-border">
        <div class="font-semibold text-[11px] uppercase tracking-wider text-text-muted">
          Replication Collections
        </div>
        <input
          class="px-[var(--spacing-sm)] py-[var(--spacing-xs)] bg-bg-secondary text-text border border-border rounded-[var(--radius)] text-xs outline-none w-full"
          placeholder="Search collections..."
          value={searchQuery()}
          onInput={(event) => setSearchQuery(event.currentTarget.value)}
        />
      </div>

      <div class="flex-1 overflow-auto">
        <Show when={queryError()}>
          <div class="p-[var(--spacing-md)] m-[var(--spacing-md)] text-error bg-error/10 rounded-[var(--radius)]">
            {queryError()}
          </div>
        </Show>

        <Show when={!queryError() && summaries().length === 0}>
          <div class="p-[var(--spacing-xl)] text-center text-text-muted">
            No collections found.
          </div>
        </Show>

        <Show when={!queryError() && summaries().length > 0 && filteredSummaries().length === 0}>
          <div class="p-[var(--spacing-xl)] text-center text-text-muted">
            No collections match your search.
          </div>
        </Show>

        <For each={filteredSummaries()}>
          {(summary) => {
            const isSelected = () => summary.collection === selectedCollection();
            const rowClasses = () => {
              const base =
                "flex flex-col gap-[var(--spacing-xs)] px-[var(--spacing-md)] py-[var(--spacing-sm)] border-b border-border cursor-pointer";
              return isSelected() ? `${base} bg-bg-selected` : `${base} hover:bg-bg-hover`;
            };
            return (
              <div class={rowClasses()} onClick={() => setSelectedCollection(summary.collection)}>
                <div class="flex flex-row items-center justify-between gap-[var(--spacing-sm)]">
                  <span class="font-medium text-[13px] truncate">{summary.collection}</span>
                  <span class="text-[10px] text-text-muted">{summary.totalStates} state(s)</span>
                </div>
                <div class="flex flex-row items-center gap-[var(--spacing-sm)] text-[10px] text-text-muted">
                  <span>{summaryHealth(summary)}</span>
                  <span>↑{summary.totalSent}</span>
                  <span>↓{summary.totalReceived}</span>
                  <Show when={summary.totalErrors > 0}>
                    <span class="text-error">⚠ {summary.totalErrors}</span>
                  </Show>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );

  const detailPane = () => (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex flex-row items-center justify-between gap-[var(--spacing-sm)] p-[var(--spacing-md)] border-b border-border">
        <div class="flex flex-col">
          <span class="font-semibold text-xs">Replication States</span>
          <Show when={selectedCollectionSummary()}>
            {(summary) => (
              <span class="text-[11px] text-text-muted">
                {summary().collection} · {summary().totalStates} state(s)
              </span>
            )}
          </Show>
        </div>
        <Button theme={props.theme} size="sm" onClick={refresh}>
          Refresh
        </Button>
      </div>

      <Show when={actionError()}>
        <div class="mx-[var(--spacing-md)] mt-[var(--spacing-sm)] p-[var(--spacing-sm)] text-error bg-error/10 rounded-[var(--radius)] text-xs">
          {actionError()}
        </div>
      </Show>

      <Show
        when={selectedCollectionSummary()}
        fallback={
          <div class="flex-1 p-[var(--spacing-xl)] text-center text-text-muted">
            Select a collection to inspect replication.
          </div>
        }
      >
        <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div class="p-[var(--spacing-md)] border-b border-border">
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-[var(--spacing-sm)] text-[11px]">
              <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                <div class="text-text-muted">States</div>
                <div class="font-semibold text-text">{selectedCollectionSummary()!.totalStates}</div>
              </div>
              <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                <div class="text-text-muted">Activity</div>
                <div class="font-semibold text-text">
                  ↑{selectedCollectionSummary()!.totalSent} · ↓{selectedCollectionSummary()!.totalReceived}
                </div>
              </div>
              <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                <div class="text-text-muted">Errors</div>
                <div class={selectedCollectionSummary()!.totalErrors > 0 ? "font-semibold text-error" : "font-semibold text-success"}>
                  {selectedCollectionSummary()!.totalErrors}
                </div>
              </div>
              <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                <div class="text-text-muted">Last Activity</div>
                <div class="font-semibold text-text">
                  {formatRelativeTime(selectedCollectionSummary()!.lastActivityAt)}
                </div>
              </div>
            </div>
          </div>

          <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div class="flex-1 overflow-auto border-b border-border">
              <Show when={selectedCollectionStates().length === 0}>
                <div class="p-[var(--spacing-xl)] text-center text-text-muted">
                  No replication states discovered for this collection yet.
                </div>
              </Show>
              <For each={selectedCollectionStates()}>
                {(state) => {
                  const isSelected = () => selectedStateId() === state.id;
                  const stateStatus = () => getStateStatus(state);
                  const rowClasses = () => {
                    const base = "flex flex-col gap-[var(--spacing-xs)] px-[var(--spacing-md)] py-[var(--spacing-sm)] border-b border-border cursor-pointer";
                    return isSelected() ? `${base} bg-bg-selected` : `${base} hover:bg-bg-hover`;
                  };
                  return (
                    <div class={rowClasses()} onClick={() => setSelectedStateId(state.id)}>
                      <div class="flex flex-row items-center justify-between gap-[var(--spacing-sm)]">
                        <span class="font-mono text-[11px] text-accent truncate">{state.replicationIdentifier}</span>
                        <span class={statusBadgeClasses(stateStatus())}>{stateStatus()}</span>
                      </div>
                      <div class="flex flex-row gap-[var(--spacing-sm)] text-[10px] text-text-muted">
                        <span>{state.hasPull ? "pull" : "no-pull"}</span>
                        <span>{state.hasPush ? "push" : "no-push"}</span>
                        <span>{state.live ? "live" : "one-shot"}</span>
                        <span>↑{state.sentCount}</span>
                        <span>↓{state.receivedCount}</span>
                        <Show when={state.errorCount > 0}>
                          <span class="text-error">⚠ {state.errorCount}</span>
                        </Show>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>

            <Show
              when={selectedState()}
              fallback={
                <div class="p-[var(--spacing-md)] text-[11px] text-text-muted">
                  Select a replication state to inspect details.
                </div>
              }
            >
              {(stateAccessor) => {
                const state = stateAccessor();
                const stateStatus = getStateStatus(state);
                return (
                  <div class="p-[var(--spacing-md)] overflow-auto">
                    <div class="flex flex-row items-center justify-between gap-[var(--spacing-sm)] mb-[var(--spacing-sm)]">
                      <div class="font-mono text-xs text-accent break-all">{state.replicationIdentifier}</div>
                      <span class={statusBadgeClasses(stateStatus)}>{stateStatus}</span>
                    </div>

                    <div class="flex flex-row gap-[var(--spacing-xs)] mb-[var(--spacing-sm)]">
                      <Button
                        theme={props.theme}
                        size="sm"
                        onClick={() => runAction("reSync")}
                        disabled={isRunningAction()}
                      >
                        ReSync
                      </Button>
                      <Button
                        theme={props.theme}
                        size="sm"
                        onClick={() => runAction(state.isPaused ? "start" : "pause")}
                        disabled={isRunningAction() || state.isStopped}
                      >
                        {state.isPaused ? "Resume" : "Pause"}
                      </Button>
                    </div>

                    <div class="grid grid-cols-2 gap-[var(--spacing-sm)] text-[11px] mb-[var(--spacing-sm)]">
                      <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                        <div class="text-text-muted">Initial Sync</div>
                        <div class={state.isInitialReplicationComplete ? "text-success font-semibold" : "text-warning font-semibold"}>
                          {state.isInitialReplicationComplete ? "completed" : "pending"}
                        </div>
                      </div>
                      <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                        <div class="text-text-muted">In Sync</div>
                        <div class={state.isInSync ? "text-success font-semibold" : "text-warning font-semibold"}>
                          {state.isInSync ? "yes" : "no"}
                        </div>
                      </div>
                      <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                        <div class="text-text-muted">Last Activity</div>
                        <div class="font-semibold text-text">{formatRelativeTime(state.lastActivityAt)}</div>
                      </div>
                      <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                        <div class="text-text-muted">Last In Sync</div>
                        <div class="font-semibold text-text">{formatRelativeTime(state.lastInSyncAt)}</div>
                      </div>
                    </div>

                    <div class="grid grid-cols-2 gap-[var(--spacing-sm)] text-[11px] mb-[var(--spacing-sm)]">
                      <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                        <div class="text-text-muted">Direction</div>
                        <div class="font-semibold text-text">
                          {state.hasPull && state.hasPush ? "pull + push" : state.hasPull ? "pull only" : "push only"}
                        </div>
                      </div>
                      <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                        <div class="text-text-muted">Retry Time</div>
                        <div class="font-semibold text-text">
                          {state.retryTime !== null ? `${state.retryTime}ms` : "default"}
                        </div>
                      </div>
                      <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                        <div class="text-text-muted">Deleted Field</div>
                        <div class="font-semibold text-text">{state.deletedField}</div>
                      </div>
                      <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                        <div class="text-text-muted">Last Error</div>
                        <div class={state.lastError ? "font-semibold text-error" : "font-semibold text-text-muted"}>
                          {state.lastError ? formatTimestamp(state.lastError.timestamp) : "none"}
                        </div>
                      </div>
                    </div>

                    <div class="text-[11px]">
                      <div class="font-semibold mb-[var(--spacing-xs)]">Recent Errors</div>
                      <Show when={state.recentErrors.length === 0}>
                        <div class="text-text-muted">No replication errors observed.</div>
                      </Show>
                      <For each={state.recentErrors}>
                        {(error) => (
                          <div class="mb-[var(--spacing-xs)] p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                            <div class="flex flex-row items-center justify-between gap-[var(--spacing-sm)] mb-0.5">
                              <span class="text-error font-semibold">{error.direction}</span>
                              <span class="text-text-muted">{formatTimestamp(error.timestamp)}</span>
                            </div>
                            <div class="text-text-secondary break-words">{error.message}</div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                );
              }}
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );

  return (
    <Resizable
      theme={props.theme}
      direction="horizontal"
      initialSize={300}
      minSize={220}
      maxSize={420}
      class="h-full"
    >
      {listPane()}
      {detailPane()}
    </Resizable>
  );
}
