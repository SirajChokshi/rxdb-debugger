import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import type { OperationLog, PerformanceMetrics, RxdbDebugger } from "@rxdb-debugger/core";
import type { Theme } from "../../styles/theme.js";
import { Button } from "../shared/Button.js";
import { JsonViewer } from "../shared/JsonViewer.js";

export interface PerformancePanelProps {
  theme: Theme;
  debugger: RxdbDebugger;
}

export function PerformancePanel(props: PerformancePanelProps) {
  const [metrics, setMetrics] = createSignal<PerformanceMetrics | null>(null);
  const [operations, setOperations] = createSignal<OperationLog[]>([]);
  const [slowThresholdMs, setSlowThresholdMs] = createSignal(50);
  const [onlySlow, setOnlySlow] = createSignal(false);
  const [typeFilter, setTypeFilter] = createSignal("all");
  const [collectionFilter, setCollectionFilter] = createSignal("all");
  const [expandedOperationId, setExpandedOperationId] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const { theme } = props;

  const refreshData = async () => {
    try {
      const [m, ops] = await Promise.all([
        props.debugger.performance.getMetrics().get(),
        props.debugger.performance.getOperations({ limit: 400 }).get(),
      ]);
      setMetrics(m);
      setOperations(ops);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load performance metrics");
    }
  };

  createEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 1500);
    onCleanup(() => clearInterval(interval));
  });

  const isTracking = () => metrics()?.isTracking ?? props.debugger.performance.isTracking();

  const toggleTracking = () => {
    if (isTracking()) {
      props.debugger.performance.stop();
    } else {
      props.debugger.performance.start();
    }
    void refreshData();
  };

  const clearMetrics = () => {
    props.debugger.performance.clear();
    void refreshData();
  };

  const formatDuration = (ms: number): string => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${ms.toFixed(1)}ms`;
  };

  const durationColor = (duration: number) => {
    if (duration > 100) return "text-error";
    if (duration > 50) return "text-warning";
    return "text-success";
  };

  const formatOpsRate = (value: number): string => {
    if (value >= 100) return `${value.toFixed(0)}/s`;
    if (value >= 10) return `${value.toFixed(1)}/s`;
    return `${value.toFixed(2)}/s`;
  };

  const typeOptions = createMemo(() => {
    return [...new Set(operations().map((op) => op.type))].sort();
  });

  const collectionOptions = createMemo(() => {
    return [...new Set(operations().map((op) => op.collection))].sort();
  });

  const filteredOperations = createMemo(() => {
    const threshold = slowThresholdMs();
    return operations().filter((op) => {
      if (typeFilter() !== "all" && op.type !== typeFilter()) {
        return false;
      }
      if (collectionFilter() !== "all" && op.collection !== collectionFilter()) {
        return false;
      }
      if (onlySlow() && op.duration < threshold) {
        return false;
      }
      return true;
    });
  });

  const insightStyle = (severity: "info" | "warning" | "error"): string => {
    if (severity === "error") return "border-error bg-error/10";
    if (severity === "warning") return "border-warning bg-warning/10";
    return "border-accent bg-accent/10";
  };

  const operationFlags = (operation: OperationLog): string[] => {
    const details = operation.details as {
      kind?: string;
      diagnostics?: {
        fullScanCandidate?: boolean;
        manualSortCandidate?: boolean;
        countMode?: "fast" | "slow";
        rowCount?: number;
      };
    } | undefined;

    if (!details || !details.diagnostics) return [];

    const flags: string[] = [];
    if (details.diagnostics.fullScanCandidate) flags.push("Full scan candidate");
    if (details.diagnostics.manualSortCandidate) flags.push("Manual sort candidate");
    if (details.diagnostics.countMode === "slow") flags.push("Slow count");
    if (details.kind === "bulkWrite" && details.diagnostics.rowCount === 1) {
      flags.push("Single-row write");
    }
    return flags;
  };

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex flex-row p-[var(--spacing-md)] gap-[var(--spacing-sm)] border-b border-border items-center shrink-0">
        <Button theme={theme} variant={isTracking() ? "danger" : "primary"} onClick={toggleTracking}>
          {isTracking() ? "Stop Tracking" : "Start Tracking"}
        </Button>
        <Button theme={theme} onClick={clearMetrics}>Clear</Button>
        <Button theme={theme} onClick={refreshData}>Refresh</Button>
        <div class="flex-1" />
        <span class={`text-[11px] ${isTracking() ? "text-success" : "text-text-muted"}`}>
          {isTracking() ? "● Tracking" : "○ Not tracking"}
        </span>
      </div>

      <div class="flex flex-row p-[var(--spacing-sm)] gap-[var(--spacing-sm)] border-b border-border items-center shrink-0 text-[11px]">
        <span class="text-text-muted">Type:</span>
        <select
          class="px-[var(--spacing-xs)] py-0.5 bg-bg-secondary text-text border border-border rounded-[var(--radius)]"
          value={typeFilter()}
          onChange={(e) => setTypeFilter(e.currentTarget.value)}
        >
          <option value="all">All</option>
          <For each={typeOptions()}>
            {(type) => <option value={type}>{type}</option>}
          </For>
        </select>

        <span class="text-text-muted">Collection:</span>
        <select
          class="px-[var(--spacing-xs)] py-0.5 bg-bg-secondary text-text border border-border rounded-[var(--radius)]"
          value={collectionFilter()}
          onChange={(e) => setCollectionFilter(e.currentTarget.value)}
        >
          <option value="all">All</option>
          <For each={collectionOptions()}>
            {(collection) => <option value={collection}>{collection}</option>}
          </For>
        </select>

        <span class="text-text-muted">Slow threshold:</span>
        <input
          type="number"
          class="w-16 px-[var(--spacing-xs)] py-0.5 bg-bg-secondary text-text border border-border rounded-[var(--radius)]"
          value={slowThresholdMs()}
          onInput={(e) => setSlowThresholdMs(Math.max(0, Number(e.currentTarget.value) || 0))}
        />
        <span class="text-text-muted">ms</span>

        <label class="flex flex-row items-center gap-[var(--spacing-xs)] ml-[var(--spacing-sm)] cursor-pointer">
          <input
            type="checkbox"
            checked={onlySlow()}
            onChange={(e) => setOnlySlow(e.currentTarget.checked)}
          />
          <span class="text-text-muted">Only slow operations</span>
        </label>
      </div>

      <div class="flex flex-row flex-1 overflow-hidden">
        <div class="flex flex-col w-[360px] shrink-0 p-[var(--spacing-md)] border-r border-border overflow-auto gap-[var(--spacing-sm)]">
          <Show when={error()}>
            <div class="text-error bg-error/10 p-[var(--spacing-md)] rounded-[var(--radius)] mb-[var(--spacing-md)]">
              {error()}
            </div>
          </Show>
          <Show when={metrics()} fallback={
            <div class="text-text-muted">Start tracking to see performance metrics</div>
          }>
            {(m) => (
              <>
                <div class="grid grid-cols-2 gap-[var(--spacing-sm)]">
                  <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                    <div class="text-[10px] text-text-muted uppercase mb-[var(--spacing-xs)]">Operations</div>
                    <div class="text-xl font-semibold text-text font-mono">{m().totalOperations}</div>
                  </div>
                  <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                    <div class="text-[10px] text-text-muted uppercase mb-[var(--spacing-xs)]">Ops / Sec</div>
                    <div class="text-xl font-semibold text-text font-mono">{formatOpsRate(m().operationsPerSecond)}</div>
                  </div>
                  <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                    <div class="text-[10px] text-text-muted uppercase mb-[var(--spacing-xs)]">P95 Latency</div>
                    <div class={`text-xl font-semibold font-mono ${durationColor(m().latency.p95)}`}>
                      {formatDuration(m().latency.p95)}
                    </div>
                  </div>
                  <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                    <div class="text-[10px] text-text-muted uppercase mb-[var(--spacing-xs)]">Failures</div>
                    <div class={`text-xl font-semibold font-mono ${m().failedOperations > 0 ? "text-error" : "text-success"}`}>
                      {m().failedOperations}
                    </div>
                  </div>
                </div>

                <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                  <div class="text-[11px] text-text-muted uppercase mb-[var(--spacing-xs)]">Query Health</div>
                  <div class="text-[11px] flex flex-col gap-1">
                    <div class="flex justify-between"><span class="text-text-muted">Tracked queries</span><span class="font-mono">{m().queryStats.totalQueries}</span></div>
                    <div class="flex justify-between"><span class="text-text-muted">Full scan candidates</span><span class={`font-mono ${m().queryStats.fullScanCandidates > 0 ? "text-warning" : "text-success"}`}>{m().queryStats.fullScanCandidates}</span></div>
                    <div class="flex justify-between"><span class="text-text-muted">Manual sort candidates</span><span class={`font-mono ${m().queryStats.manualSortCandidates > 0 ? "text-warning" : "text-success"}`}>{m().queryStats.manualSortCandidates}</span></div>
                    <div class="flex justify-between"><span class="text-text-muted">Slow counts</span><span class={`font-mono ${m().queryStats.slowCounts > 0 ? "text-warning" : "text-success"}`}>{m().queryStats.slowCounts}</span></div>
                  </div>
                </div>

                <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                  <div class="text-[11px] text-text-muted uppercase mb-[var(--spacing-xs)]">Write Patterns</div>
                  <div class="text-[11px] flex flex-col gap-1">
                    <div class="flex justify-between"><span class="text-text-muted">Tracked writes</span><span class="font-mono">{m().writeStats.totalWrites}</span></div>
                    <div class="flex justify-between"><span class="text-text-muted">Total write rows</span><span class="font-mono">{m().writeStats.totalRows}</span></div>
                    <div class="flex justify-between"><span class="text-text-muted">Single-row writes</span><span class={`font-mono ${m().writeStats.singleRowWrites > 0 ? "text-warning" : "text-success"}`}>{m().writeStats.singleRowWrites}</span></div>
                    <div class="flex justify-between"><span class="text-text-muted">Avg rows / write</span><span class="font-mono">{m().writeStats.averageRowsPerWrite.toFixed(2)}</span></div>
                  </div>
                </div>

                <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                  <div class="text-[11px] text-text-muted uppercase mb-[var(--spacing-xs)]">DB Configuration</div>
                  <Show when={m().profile} fallback={<div class="text-[11px] text-text-muted">Profile not available yet</div>}>
                    {(profile) => (
                      <div class="text-[11px] flex flex-col gap-1">
                        <div class="flex justify-between"><span class="text-text-muted">Storage</span><span class="font-mono">{profile().storageName ?? "unknown"}</span></div>
                        <div class="flex justify-between"><span class="text-text-muted">eventReduce</span><span class="font-mono">{String(profile().eventReduce)}</span></div>
                        <div class="flex justify-between"><span class="text-text-muted">multiInstance</span><span class="font-mono">{String(profile().multiInstance)}</span></div>
                        <div class="flex justify-between"><span class="text-text-muted">allowSlowCount</span><span class="font-mono">{String(profile().allowSlowCount)}</span></div>
                        <div class="flex justify-between"><span class="text-text-muted">Collections / Indexed</span><span class="font-mono">{profile().collectionCount} / {profile().indexedCollections}</span></div>
                        <div class="flex justify-between"><span class="text-text-muted">Total indexes</span><span class="font-mono">{profile().totalIndexes}</span></div>
                      </div>
                    )}
                  </Show>
                </div>

                <div class="p-[var(--spacing-sm)] bg-bg-secondary rounded-[var(--radius)]">
                  <div class="text-[11px] text-text-muted uppercase mb-[var(--spacing-xs)]">Insights</div>
                  <For each={m().insights} fallback={
                    <div class="text-[11px] text-text-muted">No recommendations yet. Keep tracking while running app workflows.</div>
                  }>
                    {(insight) => (
                      <div class={`border p-[var(--spacing-sm)] rounded-[var(--radius)] mb-[var(--spacing-xs)] ${insightStyle(insight.severity)}`}>
                        <div class="text-[11px] font-semibold text-text">{insight.title}</div>
                        <div class="text-[11px] text-text-secondary mt-[2px]">{insight.description}</div>
                        <Show when={insight.recommendation}>
                          <div class="text-[11px] text-text mt-[var(--spacing-xs)]">→ {insight.recommendation}</div>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </>
            )}
          </Show>
        </div>

        <div class="flex flex-col flex-1 overflow-hidden">
          <div class="flex flex-row justify-between px-[var(--spacing-md)] py-[var(--spacing-sm)] border-b border-border text-[11px] text-text-muted shrink-0">
            <span>Showing {filteredOperations().length} of {operations().length} operations</span>
            <span>Slow threshold: {slowThresholdMs()}ms</span>
          </div>
          <div class="flex flex-col flex-1 overflow-auto">
            <For each={filteredOperations()} fallback={
              <div class="text-text-muted text-xs p-[var(--spacing-md)]">No operations match current filters.</div>
            }>
              {(op) => (
                <div class="border-b border-border">
                  <button
                    class="w-full flex flex-row p-[var(--spacing-sm)] text-xs gap-[var(--spacing-sm)] items-center hover:bg-bg-secondary text-left"
                    onClick={() => setExpandedOperationId(expandedOperationId() === op.id ? null : op.id)}
                  >
                    <span class="px-[var(--spacing-xs)] py-0.5 rounded-sm text-[10px] font-medium bg-bg-secondary text-text-secondary min-w-[62px] text-center">
                      {op.type}
                    </span>
                    <span class="w-[140px] truncate text-accent font-mono">{op.collection}</span>
                    <span class={`w-[90px] font-mono ${durationColor(op.duration)}`}>{formatDuration(op.duration)}</span>
                    <span class="w-[90px] text-text-muted">{new Date(op.timestamp).toLocaleTimeString()}</span>
                    <span class={`w-[70px] text-center ${op.success ? "text-success" : "text-error"}`}>
                      {op.success ? "ok" : "failed"}
                    </span>
                    <span class="w-[80px] text-right text-text-muted">
                      {op.resultCount !== undefined ? `${op.resultCount} rows` : "—"}
                    </span>
                    <div class="flex flex-wrap gap-[var(--spacing-xs)] ml-[var(--spacing-sm)]">
                      <For each={operationFlags(op)}>
                        {(flag) => (
                          <span class="px-[var(--spacing-xs)] py-0.5 rounded-sm bg-warning/20 text-warning text-[10px]">
                            {flag}
                          </span>
                        )}
                      </For>
                    </div>
                    <div class="flex-1" />
                    <span class="text-text-muted text-[11px]">
                      {expandedOperationId() === op.id ? "▼" : "▶"}
                    </span>
                  </button>
                  <Show when={expandedOperationId() === op.id}>
                    <div class="px-[var(--spacing-md)] pb-[var(--spacing-md)]">
                      <Show when={op.error}>
                        <div class="text-error text-xs mb-[var(--spacing-sm)]">{op.error}</div>
                      </Show>
                      <Show when={op.details !== undefined} fallback={
                        <div class="text-[11px] text-text-muted">No operation details.</div>
                      }>
                        <JsonViewer theme={theme} data={op.details} collapsed={false} maxHeight="220px" />
                      </Show>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
          <Show when={metrics()}>
            {(m) => (
              <div class="px-[var(--spacing-md)] py-[var(--spacing-sm)] border-t border-border text-[11px] text-text-muted shrink-0 flex gap-[var(--spacing-lg)]">
                <span>Avg: {formatDuration(m().averageDuration)}</span>
                <span>P50: {formatDuration(m().latency.p50)}</span>
                <span>P95: {formatDuration(m().latency.p95)}</span>
                <span>P99: {formatDuration(m().latency.p99)}</span>
                <Show when={m().instrumentation.state !== "ready"}>
                  <span>Instrumentation: {m().instrumentation.state}</span>
                </Show>
              </div>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
}
