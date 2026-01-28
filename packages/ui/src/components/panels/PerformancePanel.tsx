import { createEffect, createSignal, For, onCleanup, Show, type JSX } from "solid-js";
import type { RxdbDebugger, OperationLog, PerformanceMetrics } from "@rxdb-debugger/core";
import { css, flex, scrollable } from "../../styles/css.js";
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

  const refreshMetrics = () => {
    props.debugger.performance.getMetrics().get().then(setMetrics);
    props.debugger.performance.getSlowOperations(50).get().then(setSlowOps);
    setIsTracking(props.debugger.performance.isTracking());
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

  const { theme } = props;

  const containerStyle = css(flex.col, {
    height: "100%",
    overflow: "hidden",
  });

  const toolbarStyle = css(flex.row, {
    padding: theme.sizing.spacing.md,
    gap: theme.sizing.spacing.sm,
    "border-bottom": `1px solid ${theme.colors.border}`,
    "align-items": "center",
    "flex-shrink": "0",
  });

  const contentStyle = css(flex.row, scrollable, {
    flex: "1",
    overflow: "hidden",
  });

  const metricsStyle = css(flex.col, {
    width: "300px",
    "flex-shrink": "0",
    padding: theme.sizing.spacing.md,
    "border-right": `1px solid ${theme.colors.border}`,
    overflow: "auto",
  });

  const metricCardStyle = css({
    padding: theme.sizing.spacing.md,
    background: theme.colors.bgSecondary,
    "border-radius": theme.sizing.borderRadius,
    "margin-bottom": theme.sizing.spacing.md,
  });

  const metricLabelStyle = css({
    "font-size": "11px",
    color: theme.colors.textMuted,
    "text-transform": "uppercase",
    "margin-bottom": theme.sizing.spacing.xs,
  });

  const metricValueStyle = css({
    "font-size": "24px",
    "font-weight": "600",
    color: theme.colors.text,
    "font-family": theme.fonts.mono,
  });

  const slowOpsStyle = css(flex.col, scrollable, {
    flex: "1",
    padding: theme.sizing.spacing.md,
  });

  const sectionTitleStyle = css({
    "font-weight": "600",
    "font-size": "12px",
    "margin-bottom": theme.sizing.spacing.md,
    color: theme.colors.text,
  });

  const opRowStyle = css(flex.row, {
    padding: theme.sizing.spacing.sm,
    "border-bottom": `1px solid ${theme.colors.border}`,
    "font-size": "12px",
    gap: theme.sizing.spacing.sm,
    "align-items": "center",
  });

  const opTypeBadgeStyle = css({
    padding: `2px ${theme.sizing.spacing.xs}`,
    "border-radius": "3px",
    "font-size": "10px",
    "font-weight": "500",
    background: theme.colors.bgSecondary,
    color: theme.colors.textSecondary,
    "min-width": "50px",
    "text-align": "center",
  });

  const opCollectionStyle = css({
    flex: "1",
    color: theme.colors.accent,
    "font-family": theme.fonts.mono,
  });

  const opDurationStyle = (duration: number): JSX.CSSProperties =>
    css({
      "font-family": theme.fonts.mono,
      color: duration > 100 ? theme.colors.error : duration > 50 ? theme.colors.warning : theme.colors.success,
    });

  const barContainerStyle = css({
    display: "flex",
    "flex-direction": "column",
    gap: theme.sizing.spacing.xs,
    "margin-top": theme.sizing.spacing.sm,
  });

  const barRowStyle = css(flex.row, {
    "align-items": "center",
    gap: theme.sizing.spacing.sm,
    "font-size": "11px",
  });

  const barLabelStyle = css({
    width: "80px",
    "flex-shrink": "0",
    color: theme.colors.textSecondary,
  });

  const barTrackStyle = css({
    flex: "1",
    height: "8px",
    background: theme.colors.bgSecondary,
    "border-radius": "4px",
    overflow: "hidden",
  });

  const barFillStyle = (percent: number): JSX.CSSProperties =>
    css({
      width: `${Math.min(100, percent)}%`,
      height: "100%",
      background: theme.colors.accent,
      "border-radius": "4px",
    });

  const barValueStyle = css({
    width: "40px",
    "text-align": "right",
    "font-family": theme.fonts.mono,
    color: theme.colors.textMuted,
  });

  const formatDuration = (ms: number): string => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${ms.toFixed(1)}ms`;
  };

  return (
    <div style={containerStyle}>
      <div style={toolbarStyle}>
        <Button theme={theme} variant={isTracking() ? "danger" : "primary"} onClick={toggleTracking}>
          {isTracking() ? "Stop Tracking" : "Start Tracking"}
        </Button>
        <Button theme={theme} onClick={clearMetrics}>
          Clear
        </Button>
        <Button theme={theme} onClick={refreshMetrics}>
          Refresh
        </Button>
        <div style={{ flex: "1" }} />
        <span style={{ "font-size": "11px", color: isTracking() ? theme.colors.success : theme.colors.textMuted }}>
          {isTracking() ? "● Tracking" : "○ Not tracking"}
        </span>
      </div>

      <div style={contentStyle}>
        <div style={metricsStyle}>
          <Show when={metrics()} fallback={
            <div style={{ color: theme.colors.textMuted }}>
              Start tracking to see performance metrics
            </div>
          }>
            {(m) => (
              <>
                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>Total Operations</div>
                  <div style={metricValueStyle}>{m().totalOperations}</div>
                </div>

                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>Average Duration</div>
                  <div style={metricValueStyle}>{formatDuration(m().averageDuration)}</div>
                </div>

                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>Failed Operations</div>
                  <div style={css(metricValueStyle, { color: m().failedOperations > 0 ? theme.colors.error : theme.colors.success })}>
                    {m().failedOperations}
                  </div>
                </div>

                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>By Type</div>
                  <div style={barContainerStyle}>
                    <For each={Object.entries(m().operationsByType).sort((a, b) => b[1] - a[1])}>
                      {([type, count]) => {
                        const percent = (count / m().totalOperations) * 100;
                        return (
                          <div style={barRowStyle}>
                            <span style={barLabelStyle}>{type}</span>
                            <div style={barTrackStyle}>
                              <div style={barFillStyle(percent)} />
                            </div>
                            <span style={barValueStyle}>{count}</span>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </div>

                <div style={metricCardStyle}>
                  <div style={metricLabelStyle}>By Collection</div>
                  <div style={barContainerStyle}>
                    <For each={Object.entries(m().operationsByCollection).sort((a, b) => b[1] - a[1]).slice(0, 5)}>
                      {([col, count]) => {
                        const percent = (count / m().totalOperations) * 100;
                        return (
                          <div style={barRowStyle}>
                            <span style={barLabelStyle}>{col}</span>
                            <div style={barTrackStyle}>
                              <div style={barFillStyle(percent)} />
                            </div>
                            <span style={barValueStyle}>{count}</span>
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

        <div style={slowOpsStyle}>
          <div style={sectionTitleStyle}>Slow Operations (&gt;50ms)</div>
          <For each={slowOps()} fallback={
            <div style={{ color: theme.colors.textMuted, "font-size": "12px" }}>
              No slow operations recorded
            </div>
          }>
            {(op) => (
              <div style={opRowStyle}>
                <span style={opTypeBadgeStyle}>{op.type}</span>
                <span style={opCollectionStyle}>{op.collection}</span>
                <span style={opDurationStyle(op.duration)}>{formatDuration(op.duration)}</span>
                <Show when={op.resultCount !== undefined}>
                  <span style={{ color: theme.colors.textMuted }}>{op.resultCount} results</span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
