import { createEffect, createSignal, For, onCleanup, Show, type JSX } from "solid-js";
import type { RxdbDebugger, ChangeEvent } from "@rxdb-debugger/core";
import { css, ellipsis, flex, scrollable } from "../../styles/css.js";
import type { Theme } from "../../styles/theme.js";
import { Button } from "../shared/Button.js";

export interface EventsPanelProps {
  theme: Theme;
  debugger: RxdbDebugger;
}

export function EventsPanel(props: EventsPanelProps) {
  const [events, setEvents] = createSignal<ChangeEvent[]>([]);
  const [isPaused, setIsPaused] = createSignal(false);
  const [selectedEvent, setSelectedEvent] = createSignal<ChangeEvent | null>(null);
  const [filter, setFilter] = createSignal<string>("");

  createEffect(() => {
    const sub = props.debugger.events
      .stream()
      .observe()
      .subscribe({
        next: (event) => {
          if (!isPaused()) {
            setEvents((prev) => [event, ...prev].slice(0, 200));
          }
        },
      });

    onCleanup(() => sub.unsubscribe());
  });

  const togglePause = () => {
    if (isPaused()) {
      props.debugger.events.resume();
    } else {
      props.debugger.events.pause();
    }
    setIsPaused(!isPaused());
  };

  const clearEvents = () => {
    setEvents([]);
    props.debugger.events.clear();
  };

  const filteredEvents = () => {
    const f = filter().toLowerCase();
    if (!f) return events();
    return events().filter(
      (e) =>
        e.collection.toLowerCase().includes(f) ||
        e.documentId.toLowerCase().includes(f) ||
        e.operation.toLowerCase().includes(f)
    );
  };

  const { theme } = props;

  const containerStyle = css(flex.row, {
    height: "100%",
    overflow: "hidden",
  });

  const listStyle = css(flex.col, {
    flex: "1",
    overflow: "hidden",
  });

  const toolbarStyle = css(flex.row, {
    padding: theme.sizing.spacing.md,
    gap: theme.sizing.spacing.sm,
    "border-bottom": `1px solid ${theme.colors.border}`,
    "align-items": "center",
    "flex-shrink": "0",
  });

  const filterInputStyle = css({
    flex: "1",
    padding: `${theme.sizing.spacing.xs} ${theme.sizing.spacing.sm}`,
    background: theme.colors.bgSecondary,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    "border-radius": theme.sizing.borderRadius,
    "font-size": "12px",
    outline: "none",
  });

  const eventListStyle = css(scrollable, {
    flex: "1",
  });

  const eventRowStyle = (isSelected: boolean): JSX.CSSProperties =>
    css(flex.row, {
      padding: `${theme.sizing.spacing.sm} ${theme.sizing.spacing.md}`,
      "border-bottom": `1px solid ${theme.colors.border}`,
      cursor: "pointer",
      background: isSelected ? theme.colors.bgSelected : "transparent",
      gap: theme.sizing.spacing.sm,
      "align-items": "center",
    });

  const operationBadgeStyle = (op: string): JSX.CSSProperties => {
    const colors = {
      INSERT: theme.colors.success,
      UPDATE: theme.colors.warning,
      DELETE: theme.colors.error,
    };
    return css({
      padding: `2px ${theme.sizing.spacing.xs}`,
      "border-radius": "3px",
      "font-size": "10px",
      "font-weight": "600",
      background: `${colors[op as keyof typeof colors] ?? theme.colors.textMuted}30`,
      color: colors[op as keyof typeof colors] ?? theme.colors.textMuted,
    });
  };

  const collectionStyle = css(ellipsis, {
    width: "100px",
    "flex-shrink": "0",
    "font-size": "12px",
    color: theme.colors.accent,
  });

  const docIdStyle = css(ellipsis, {
    flex: "1",
    "font-size": "12px",
    "font-family": theme.fonts.mono,
    color: theme.colors.textSecondary,
  });

  const timeStyle = css({
    "font-size": "10px",
    color: theme.colors.textMuted,
    "font-family": theme.fonts.mono,
  });

  const detailStyle = css(flex.col, {
    width: "350px",
    "flex-shrink": "0",
    "border-left": `1px solid ${theme.colors.border}`,
    overflow: "hidden",
  });

  const detailHeaderStyle = css(flex.row, flex.between, {
    padding: theme.sizing.spacing.md,
    "border-bottom": `1px solid ${theme.colors.border}`,
    "align-items": "center",
  });

  const detailContentStyle = css(scrollable, {
    flex: "1",
    padding: theme.sizing.spacing.md,
    "font-family": theme.fonts.mono,
    "font-size": "11px",
    "white-space": "pre-wrap",
    "word-break": "break-all",
  });

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div style={containerStyle}>
      <div style={listStyle}>
        <div style={toolbarStyle}>
          <input
            style={filterInputStyle}
            placeholder="Filter events..."
            value={filter()}
            onInput={(e) => setFilter(e.currentTarget.value)}
          />
          <Button theme={theme} onClick={togglePause} variant={isPaused() ? "primary" : "secondary"}>
            {isPaused() ? "Resume" : "Pause"}
          </Button>
          <Button theme={theme} onClick={clearEvents}>
            Clear
          </Button>
          <span style={{ "font-size": "11px", color: theme.colors.textMuted }}>
            {filteredEvents().length} events
          </span>
        </div>

        <div style={eventListStyle}>
          <For each={filteredEvents()} fallback={
            <div style={{ padding: theme.sizing.spacing.xl, "text-align": "center", color: theme.colors.textMuted }}>
              No events yet. Changes to documents will appear here.
            </div>
          }>
            {(event) => {
              const isSelected = () => selectedEvent()?.id === event.id;
              return (
                <div
                  style={eventRowStyle(isSelected())}
                  onClick={() => setSelectedEvent(event)}
                  onMouseEnter={(e) => {
                    if (!isSelected()) {
                      e.currentTarget.style.background = theme.colors.bgHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected()) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <span style={operationBadgeStyle(event.operation)}>{event.operation}</span>
                  <span style={collectionStyle}>{event.collection}</span>
                  <span style={docIdStyle}>{event.documentId}</span>
                  <span style={timeStyle}>{formatTime(event.timestamp)}</span>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      <Show when={selectedEvent()}>
        {(event) => (
          <div style={detailStyle}>
            <div style={detailHeaderStyle}>
              <span style={{ "font-weight": "600", "font-size": "12px" }}>
                Event Details
              </span>
              <Button theme={theme} size="sm" onClick={() => setSelectedEvent(null)}>
                ×
              </Button>
            </div>
            <div style={detailContentStyle}>
              <div style={{ "margin-bottom": theme.sizing.spacing.md }}>
                <div style={{ color: theme.colors.textMuted, "margin-bottom": "4px" }}>Operation</div>
                <span style={operationBadgeStyle(event().operation)}>{event().operation}</span>
              </div>
              <div style={{ "margin-bottom": theme.sizing.spacing.md }}>
                <div style={{ color: theme.colors.textMuted, "margin-bottom": "4px" }}>Collection</div>
                <div style={{ color: theme.colors.accent }}>{event().collection}</div>
              </div>
              <div style={{ "margin-bottom": theme.sizing.spacing.md }}>
                <div style={{ color: theme.colors.textMuted, "margin-bottom": "4px" }}>Document ID</div>
                <div>{event().documentId}</div>
              </div>
              <Show when={event().data}>
                <div style={{ "margin-bottom": theme.sizing.spacing.md }}>
                  <div style={{ color: theme.colors.textMuted, "margin-bottom": "4px" }}>Data</div>
                  <div>{JSON.stringify(event().data, null, 2)}</div>
                </div>
              </Show>
              <Show when={event().previousData}>
                <div>
                  <div style={{ color: theme.colors.textMuted, "margin-bottom": "4px" }}>Previous Data</div>
                  <div>{JSON.stringify(event().previousData, null, 2)}</div>
                </div>
              </Show>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
