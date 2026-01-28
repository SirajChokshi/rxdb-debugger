import { createEffect, createSignal, For, onCleanup, Show, type JSX } from "solid-js";
import type { RxdbDebugger } from "../../../core.js";
import type { QueryDocument, QueryHistoryEntry } from "../../../query-playground.js";
import { css, flex, scrollable } from "../../styles/css.js";
import type { Theme } from "../../styles/theme.js";
import { Button } from "../shared/Button.js";
import { CodeEditor } from "../shared/CodeEditor.js";

export interface QueryPanelProps {
  theme: Theme;
  debugger: RxdbDebugger;
}

const DEFAULT_QUERY = `{
  "selector": {},
  "limit": 25
}`;

export function QueryPanel(props: QueryPanelProps) {
  const [collections, setCollections] = createSignal<string[]>([]);
  const [selectedCollection, setSelectedCollection] = createSignal<string>("");
  const [queryText, setQueryText] = createSignal(DEFAULT_QUERY);
  const [results, setResults] = createSignal<QueryDocument[]>([]);
  const [duration, setDuration] = createSignal<number | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [isRunning, setIsRunning] = createSignal(false);
  const [history, setHistory] = createSignal<QueryHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = createSignal(false);

  createEffect(() => {
    props.debugger.catalog.collectionNames().get().then((names) => {
      setCollections(names);
      const first = names[0];
      if (first && !selectedCollection()) {
        setSelectedCollection(first);
      }
    });
  });

  const runQuery = async () => {
    const collection = selectedCollection();
    if (!collection) return;

    setIsRunning(true);
    setError(null);
    setResults([]);
    setDuration(null);

    try {
      const query = JSON.parse(queryText());
      const result = await props.debugger.query.execute(collection, query).get();
      setResults(result.documents);
      setDuration(result.duration);
      refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  const refreshHistory = () => {
    props.debugger.query.getHistory({ limit: 20 }).get().then(setHistory);
  };

  const loadFromHistory = (entry: QueryHistoryEntry) => {
    setSelectedCollection(entry.collection);
    setQueryText(JSON.stringify(entry.query, null, 2));
    setShowHistory(false);
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

  const selectStyle = css({
    padding: `${theme.sizing.spacing.xs} ${theme.sizing.spacing.sm}`,
    background: theme.colors.bgSecondary,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    "border-radius": theme.sizing.borderRadius,
    "font-size": "12px",
  });

  const editorContainerStyle = css({
    padding: theme.sizing.spacing.md,
    "padding-top": "0",
    "flex-shrink": "0",
  });

  const resultsContainerStyle = css(flex.col, scrollable, {
    flex: "1",
    "border-top": `1px solid ${theme.colors.border}`,
  });

  const resultsHeaderStyle = css(flex.row, flex.between, {
    padding: theme.sizing.spacing.md,
    background: theme.colors.bgSecondary,
    "font-size": "12px",
    "flex-shrink": "0",
  });

  const resultRowStyle = css({
    padding: theme.sizing.spacing.md,
    "border-bottom": `1px solid ${theme.colors.border}`,
    "font-family": theme.fonts.mono,
    "font-size": "11px",
    "white-space": "pre-wrap",
    "word-break": "break-all",
  });

  const errorStyle = css({
    padding: theme.sizing.spacing.md,
    background: `${theme.colors.error}20`,
    color: theme.colors.error,
    "font-size": "12px",
  });

  const historyPanelStyle = css(flex.col, {
    position: "absolute",
    right: theme.sizing.spacing.md,
    top: "50px",
    width: "300px",
    "max-height": "300px",
    background: theme.colors.bg,
    border: `1px solid ${theme.colors.border}`,
    "border-radius": theme.sizing.borderRadius,
    "box-shadow": "0 4px 12px rgba(0,0,0,0.3)",
    "z-index": "10",
    overflow: "hidden",
  });

  const historyItemStyle = css({
    padding: theme.sizing.spacing.sm,
    "border-bottom": `1px solid ${theme.colors.border}`,
    cursor: "pointer",
    "font-size": "11px",
  });

  return (
    <div style={css(containerStyle, { position: "relative" })}>
      <div style={toolbarStyle}>
        <select
          style={selectStyle}
          value={selectedCollection()}
          onChange={(e) => setSelectedCollection(e.currentTarget.value)}
        >
          <For each={collections()}>
            {(name) => <option value={name}>{name}</option>}
          </For>
        </select>
        <Button theme={theme} variant="primary" onClick={runQuery} disabled={isRunning()}>
          {isRunning() ? "Running..." : "Run Query"}
        </Button>
        <Button theme={theme} onClick={() => { setShowHistory(!showHistory()); refreshHistory(); }}>
          History
        </Button>
        <div style={{ flex: "1" }} />
        <Show when={duration() !== null}>
          <span style={{ "font-size": "11px", color: theme.colors.textMuted }}>
            {duration()?.toFixed(1)}ms
          </span>
        </Show>
      </div>

      <Show when={showHistory()}>
        <div style={historyPanelStyle}>
          <div style={css(scrollable, { flex: "1" })}>
            <For each={history()} fallback={
              <div style={{ padding: theme.sizing.spacing.md, color: theme.colors.textMuted }}>
                No history yet
              </div>
            }>
              {(entry) => (
                <div
                  style={historyItemStyle}
                  onClick={() => loadFromHistory(entry)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = theme.colors.bgHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ "font-weight": "500" }}>{entry.collection}</div>
                  <div style={{ color: theme.colors.textMuted }}>
                    {entry.resultCount} results • {entry.duration.toFixed(1)}ms
                    {!entry.success && ` • ${entry.error}`}
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      <div style={editorContainerStyle}>
        <CodeEditor
          theme={theme}
          value={queryText()}
          onChange={setQueryText}
          language="json"
          height="150px"
          placeholder="Enter Mango query..."
        />
      </div>

      <Show when={error()}>
        <div style={errorStyle}>{error()}</div>
      </Show>

      <div style={resultsContainerStyle}>
        <div style={resultsHeaderStyle}>
          <span>Results: {results().length}</span>
        </div>
        <div style={scrollable}>
          <For each={results()}>
            {(doc) => (
              <div style={resultRowStyle}>
                <div style={{ color: theme.colors.accent, "margin-bottom": "4px" }}>
                  {doc.id}
                </div>
                {JSON.stringify(doc.data, null, 2)}
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
