import { createEffect, createSignal, For, Show } from "solid-js";
import type { RxdbDebugger, ChangeEvent, OperationType } from "@rxdb-debugger/core";
import type { Theme } from "../../styles/theme.js";
import { Button } from "../shared/Button.js";
import { JsonDiff } from "../shared/JsonDiff.js";
import { JsonViewer } from "../shared/JsonViewer.js";
import { fromObservable } from "../../utils/observable.js";

const OPERATION_TYPES: OperationType[] = ["INSERT", "UPDATE", "DELETE"];

const MAX_RENDERED_EVENTS = 200;

export interface EventsPanelProps {
  theme: Theme;
  debugger: RxdbDebugger;
}

const opBadgeClasses = {
  INSERT: "bg-success/30 text-success",
  UPDATE: "bg-warning/30 text-warning",
  DELETE: "bg-error/30 text-error",
};

export function EventsPanel(props: EventsPanelProps) {
  const [events, setEvents] = createSignal<ChangeEvent[]>([]);
  const [isPaused, setIsPaused] = createSignal(false);
  const [selectedEvent, setSelectedEvent] = createSignal<ChangeEvent | null>(null);
  const [filter, setFilter] = createSignal<string>("");
  const [error, setError] = createSignal<string | null>(null);
  const [collectionFilter, setCollectionFilter] = createSignal<string | null>(null);
  const [operationFilters, setOperationFilters] = createSignal<Set<OperationType>>(new Set());
  const [collectionNames, setCollectionNames] = createSignal<string[]>([]);
  let lastRenderedEventId: string | null = null;

  const { theme } = props;

  createEffect(() => {
    props.debugger.catalog.collectionNames().get()
      .then(setCollectionNames)
      .catch(() => setCollectionNames([]));
  });

  const toggleOperationFilter = (op: OperationType) => {
    setOperationFilters((prev) => {
      const next = new Set(prev);
      if (next.has(op)) {
        next.delete(op);
      } else {
        next.add(op);
      }
      return next;
    });
  };

  const latestEvent = fromObservable(
    props.debugger.events.stream().observe(),
    {
      initialValue: null as ChangeEvent | null,
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to stream events"),
    }
  );

  // The core service keeps a buffer of past events; seed from it so events
  // recorded while this panel was unmounted (e.g. another tab was active)
  // are not lost. Newly streamed events are deduped by id.
  props.debugger.events.history({ limit: MAX_RENDERED_EVENTS }).get()
    .then((history) => {
      if (history.length === 0) return;
      setEvents((prev) => {
        const knownIds = new Set(prev.map((e) => e.id));
        // history() returns newest-first; streamed events in `prev` are newer
        // than anything buffered before mount, so appending keeps order.
        const merged = [...prev];
        for (const event of history) {
          if (!knownIds.has(event.id)) {
            merged.push(event);
          }
        }
        return merged.slice(0, MAX_RENDERED_EVENTS);
      });
    })
    .catch(() => {
      // The live stream still works without buffered history.
    });

  createEffect(() => {
    const event = latestEvent();
    if (!event || isPaused()) return;
    if (event.id === lastRenderedEventId) return;
    lastRenderedEventId = event.id;
    setEvents((prev) => [event, ...prev].slice(0, MAX_RENDERED_EVENTS));
    setError(null);
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
    const textFilter = filter().toLowerCase();
    const collFilter = collectionFilter();
    const opFilters = operationFilters();

    return events().filter((e) => {
      if (collFilter && e.collection !== collFilter) return false;
      if (opFilters.size > 0 && !opFilters.has(e.operation)) return false;
      if (textFilter) {
        const matchesText =
          e.collection.toLowerCase().includes(textFilter) ||
          e.documentId.toLowerCase().includes(textFilter) ||
          e.operation.toLowerCase().includes(textFilter);
        if (!matchesText) return false;
      }
      return true;
    });
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const opToggleClasses = (isActive: boolean, op: OperationType) => {
    const base = "px-[var(--spacing-xs)] py-0.5 rounded-sm text-[10px] font-semibold border-none cursor-pointer";
    if (!isActive) {
      return `${base} bg-bg-secondary text-text-muted opacity-60`;
    }
    const activeColors = {
      INSERT: "bg-success/30 text-success",
      UPDATE: "bg-warning/30 text-warning",
      DELETE: "bg-error/30 text-error",
    };
    return `${base} ${activeColors[op]}`;
  };

  return (
    <div class="flex flex-row h-full overflow-hidden">
      <div class="flex flex-col flex-1 overflow-hidden">
        <div class="flex flex-row p-[var(--spacing-md)] gap-[var(--spacing-sm)] border-b border-border items-center shrink-0">
          <input
            class="flex-1 min-w-[120px] px-[var(--spacing-sm)] py-[var(--spacing-xs)] bg-bg-secondary text-text border border-border rounded-[var(--radius)] text-xs outline-none"
            placeholder="Filter events..."
            value={filter()}
            onInput={(e) => setFilter(e.currentTarget.value)}
          />
          <select
            class="px-[var(--spacing-sm)] py-[var(--spacing-xs)] bg-bg-secondary text-text border border-border rounded-[var(--radius)] text-xs outline-none cursor-pointer"
            value={collectionFilter() ?? ""}
            onChange={(e) => setCollectionFilter(e.currentTarget.value || null)}
          >
            <option value="">All Collections</option>
            <For each={collectionNames()}>
              {(name) => <option value={name}>{name}</option>}
            </For>
          </select>
          <div class="flex flex-row gap-1 items-center">
            <For each={OPERATION_TYPES}>
              {(op) => (
                <button
                  class={opToggleClasses(operationFilters().has(op), op)}
                  onClick={() => toggleOperationFilter(op)}
                  title={`Filter by ${op}`}
                >
                  {op}
                </button>
              )}
            </For>
          </div>
          <Button theme={theme} onClick={togglePause} variant={isPaused() ? "primary" : "secondary"}>
            {isPaused() ? "Resume" : "Pause"}
          </Button>
          <Button theme={theme} onClick={clearEvents}>
            Clear
          </Button>
          <span class="text-[11px] text-text-muted">{filteredEvents().length} events</span>
        </div>

        <div class="flex-1 overflow-auto">
          <Show when={error()}>
            <div class="p-[var(--spacing-md)] m-[var(--spacing-md)] text-error bg-error/10 rounded-[var(--radius)]">
              {error()}
            </div>
          </Show>
          <For each={filteredEvents()} fallback={
            <div class="p-[var(--spacing-xl)] text-center text-text-muted">
              No events yet. Changes to documents will appear here.
            </div>
          }>
            {(event) => {
              const isSelected = () => selectedEvent()?.id === event.id;
              const rowClasses = () => {
                const base = "flex flex-row px-[var(--spacing-md)] py-[var(--spacing-sm)] border-b border-border cursor-pointer gap-[var(--spacing-sm)] items-center";
                return isSelected() ? `${base} bg-bg-selected` : `${base} hover:bg-bg-hover`;
              };
              return (
                <div class={rowClasses()} onClick={() => setSelectedEvent(event)}>
                  <span class={`px-[var(--spacing-xs)] py-0.5 rounded-sm text-[10px] font-semibold ${opBadgeClasses[event.operation]}`}>
                    {event.operation}
                  </span>
                  <span class="w-[100px] shrink-0 text-xs text-accent truncate">{event.collection}</span>
                  <span class="flex-1 text-xs font-mono text-text-secondary truncate">{event.documentId}</span>
                  <span class="text-[10px] text-text-muted font-mono">{formatTime(event.timestamp)}</span>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      <Show when={selectedEvent()}>
        {(event) => (
          <div class="flex flex-col w-[350px] shrink-0 border-l border-border overflow-hidden">
            <div class="flex flex-row justify-between p-[var(--spacing-md)] border-b border-border items-center">
              <span class="font-semibold text-xs">Event Details</span>
              <Button theme={theme} size="sm" onClick={() => setSelectedEvent(null)}>
                ×
              </Button>
            </div>
            <div class="flex-1 overflow-auto p-[var(--spacing-md)] font-mono text-[11px] whitespace-pre-wrap break-all">
              <div class="block mb-[var(--spacing-md)]">
                <div class="text-text-muted mb-1">Operation</div>
                <span class={`px-[var(--spacing-xs)] py-0.5 rounded-sm text-[10px] font-semibold ${opBadgeClasses[event().operation]}`}>
                  {event().operation}
                </span>
              </div>
              <div class="block mb-[var(--spacing-md)]">
                <div class="text-text-muted mb-1">Collection</div>
                <div class="text-accent">{event().collection}</div>
              </div>
              <div class="block mb-[var(--spacing-md)]">
                <div class="text-text-muted mb-1">Document ID</div>
                <div>{event().documentId}</div>
              </div>
              <Show when={event().operation === "UPDATE" && event().previousData && event().data}>
                <div class="block mb-[var(--spacing-md)]">
                  <div class="text-text-muted mb-1">Changes</div>
                  {(() => {
                    const docA = { id: "prev", data: event().previousData as Record<string, unknown> };
                    const docB = { id: "curr", data: event().data as Record<string, unknown> };
                    const diff = props.debugger.documents.compare(docA, docB);
                    return <JsonDiff theme={theme} changes={diff.changes} />;
                  })()}
                </div>
              </Show>
              <Show when={event().operation !== "UPDATE" && event().data}>
                <div class="block mb-[var(--spacing-md)]">
                  <div class="text-text-muted mb-1">Data</div>
                  <JsonViewer theme={theme} data={event().data} collapsed={false} />
                </div>
              </Show>
              <Show when={event().operation !== "UPDATE" && event().previousData}>
                <div>
                  <div class="text-text-muted mb-1">Previous Data</div>
                  <JsonViewer theme={theme} data={event().previousData} collapsed={false} />
                </div>
              </Show>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
