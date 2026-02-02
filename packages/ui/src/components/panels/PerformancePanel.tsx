import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import type { RxdbDebugger, OperationLog, PerformanceMetrics } from "@rxdb-debugger/core";
import type { Theme } from "../../styles/theme.js";
import { Button } from "../shared/Button.js";

export interface PerformancePanelProps {
  theme: Theme;
  debugger: RxdbDebugger;
}

export function PerformancePanel(props: PerformancePanelProps) {
  const [metrics, setMetrics] = createSignal<PerformanceMetrics | null>(null);
  const [slowOps, setSlowOps] = createSignal<OperationLog[]>([]);
  const [isTracking, setIsTracking] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const { theme } = props;

  const refreshMetrics = async () => {
    try {
      const [m, ops] = await Promise.all([
        props.debugger.performance.getMetrics().get(),
        props.debugger.performance.getSlowOperations(50).get(),
      ]);
      setMetrics(m);
      setSlowOps(ops);
      setIsTracking(props.debugger.performance.isTracking());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load performance metrics");
    }
  };

  createEffect(() => {
    refreshMetrics();
    const interval = setInterval(refreshMetrics, 2000);
    onCleanup(() => clearInterval(interval));
  });

  const toggleTracking = () => {
    if (isTracking()) {
      props.debugger.performance.stop();
    } else {
      props.debugger.performance.start();
    }
    setIsTracking(!isTracking());
  };

  const clearMetrics = () => {
    props.debugger.performance.clear();
    refreshMetrics();
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

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex flex-row p-[var(--spacing-md)] gap-[var(--spacing-sm)] border-b border-border items-center shrink-0">
        <Button theme={theme} variant={isTracking() ? "danger" : "primary"} onClick={toggleTracking}>
          {isTracking() ? "Stop Tracking" : "Start Tracking"}
        </Button>
        <Button theme={theme} onClick={clearMetrics}>Clear</Button>
        <Button theme={theme} onClick={refreshMetrics}>Refresh</Button>
        <div class="flex-1" />
        <span class={`text-[11px] ${isTracking() ? "text-success" : "text-text-muted"}`}>
          {isTracking() ? "● Tracking" : "○ Not tracking"}
        </span>
      </div>

      <div class="flex flex-row flex-1 overflow-hidden">
        <div class="flex flex-col w-[300px] shrink-0 p-[var(--spacing-md)] border-r border-border overflow-auto">
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
                <div class="p-[var(--spacing-md)] bg-bg-secondary rounded-[var(--radius)] mb-[var(--spacing-md)]">
                  <div class="text-[11px] text-text-muted uppercase mb-[var(--spacing-xs)]">Total Operations</div>
                  <div class="text-2xl font-semibold text-text font-mono">{m().totalOperations}</div>
                </div>

                <div class="p-[var(--spacing-md)] bg-bg-secondary rounded-[var(--radius)] mb-[var(--spacing-md)]">
                  <div class="text-[11px] text-text-muted uppercase mb-[var(--spacing-xs)]">Average Duration</div>
                  <div class="text-2xl font-semibold text-text font-mono">{formatDuration(m().averageDuration)}</div>
                </div>

                <div class="p-[var(--spacing-md)] bg-bg-secondary rounded-[var(--radius)] mb-[var(--spacing-md)]">
                  <div class="text-[11px] text-text-muted uppercase mb-[var(--spacing-xs)]">Failed Operations</div>
                  <div class={`text-2xl font-semibold font-mono ${m().failedOperations > 0 ? "text-error" : "text-success"}`}>
                    {m().failedOperations}
                  </div>
                </div>

                <div class="p-[var(--spacing-md)] bg-bg-secondary rounded-[var(--radius)] mb-[var(--spacing-md)]">
                  <div class="text-[11px] text-text-muted uppercase mb-[var(--spacing-xs)]">By Type</div>
                  <div class="flex flex-col gap-[var(--spacing-xs)] mt-[var(--spacing-sm)]">
                    <For each={Object.entries(m().operationsByType).sort((a, b) => b[1] - a[1])}>
                      {([type, count]) => {
                        const percent = (count / m().totalOperations) * 100;
                        return (
                          <div class="flex flex-row items-center gap-[var(--spacing-sm)] text-[11px]">
                            <span class="w-20 shrink-0 text-text-secondary">{type}</span>
                            <div class="flex-1 h-2 bg-bg-secondary rounded overflow-hidden">
                              <div class="h-full bg-accent rounded" style={{ width: `${Math.min(100, percent)}%` }} />
                            </div>
                            <span class="w-10 text-right font-mono text-text-muted">{count}</span>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </div>

                <div class="p-[var(--spacing-md)] bg-bg-secondary rounded-[var(--radius)] mb-[var(--spacing-md)]">
                  <div class="text-[11px] text-text-muted uppercase mb-[var(--spacing-xs)]">By Collection</div>
                  <div class="flex flex-col gap-[var(--spacing-xs)] mt-[var(--spacing-sm)]">
                    <For each={Object.entries(m().operationsByCollection).sort((a, b) => b[1] - a[1]).slice(0, 5)}>
                      {([col, count]) => {
                        const percent = (count / m().totalOperations) * 100;
                        return (
                          <div class="flex flex-row items-center gap-[var(--spacing-sm)] text-[11px]">
                            <span class="w-20 shrink-0 text-text-secondary truncate">{col}</span>
                            <div class="flex-1 h-2 bg-bg-secondary rounded overflow-hidden">
                              <div class="h-full bg-accent rounded" style={{ width: `${Math.min(100, percent)}%` }} />
                            </div>
                            <span class="w-10 text-right font-mono text-text-muted">{count}</span>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </div>
              </>
            )}
          </Show>
        </div>

        <div class="flex flex-col flex-1 overflow-auto p-[var(--spacing-md)]">
          <Show when={slowOps().length > 0}>
            <div class="block mb-[var(--spacing-lg)]">
              <div class="font-semibold text-xs mb-[var(--spacing-md)] text-text">Operation Timeline</div>
              <div class="bg-bg-secondary rounded-[var(--radius)] p-[var(--spacing-sm)]">
                <svg width="100%" height="80" style={{ display: "block" }}>
                  {(() => {
                    const ops = slowOps();
                    const maxDuration = Math.max(...ops.map(o => o.duration), 100);
                    const barWidth = 100 / Math.max(ops.length, 1);
                    return (
                      <>
                        <For each={ops}>
                          {(op, i) => {
                            const height = Math.min((op.duration / maxDuration) * 60, 60);
                            const color = op.duration > 100 ? theme.colors.error : op.duration > 50 ? theme.colors.warning : theme.colors.success;
                            return (
                              <g>
                                <rect
                                  x={`${i() * barWidth}%`}
                                  y={70 - height}
                                  width={`${barWidth * 0.8}%`}
                                  height={height}
                                  fill={color}
                                  rx="2"
                                >
                                  <title>{op.type}: {op.collection} - {formatDuration(op.duration)}</title>
                                </rect>
                              </g>
                            );
                          }}
                        </For>
                        <line x1="0" y1="70" x2="100%" y2="70" stroke={theme.colors.border} stroke-width="1" />
                      </>
                    );
                  })()}
                </svg>
                <div class="flex flex-row justify-between text-[10px] text-text-muted mt-[var(--spacing-xs)]">
                  <span>Oldest</span>
                  <span>Most Recent</span>
                </div>
              </div>
            </div>
          </Show>
          <div class="font-semibold text-xs mb-[var(--spacing-md)] text-text">Slow Operations (&gt;50ms)</div>
          <For each={slowOps()} fallback={
            <div class="text-text-muted text-xs">No slow operations recorded</div>
          }>
            {(op) => (
              <div class="flex flex-row p-[var(--spacing-sm)] border-b border-border text-xs gap-[var(--spacing-sm)] items-center">
                <span class="px-[var(--spacing-xs)] py-0.5 rounded-sm text-[10px] font-medium bg-bg-secondary text-text-secondary min-w-[50px] text-center">
                  {op.type}
                </span>
                <span class="flex-1 text-accent font-mono">{op.collection}</span>
                <span class={`font-mono ${durationColor(op.duration)}`}>{formatDuration(op.duration)}</span>
                <Show when={op.resultCount !== undefined}>
                  <span class="text-text-muted">{op.resultCount} results</span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
