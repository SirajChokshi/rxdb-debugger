import { createEffect, createSignal, For, Show } from "solid-js";
import type { RxdbDebugger, QueryDocument, QueryHistoryEntry, QueryExplanation } from "@rxdb-debugger/core";
import { css, flex, scrollable } from "../../styles/css.js";
import type { Theme } from "../../styles/theme.js";
import { Button } from "../shared/Button.js";
import { CodeEditor } from "../shared/CodeEditor.js";
import { JsonViewer } from "../shared/JsonViewer.js";

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
  const [hasRun, setHasRun] = createSignal(false);
  const [explanation, setExplanation] = createSignal<QueryExplanation | null>(null);
  const [isExplaining, setIsExplaining] = createSignal(false);
  const [isExporting, setIsExporting] = createSignal(false);
  const [queryMode, setQueryMode] = createSignal<"json" | "builder">("json");
  const [clauses, setClauses] = createSignal<{ id: number; field: string; operator: string; value: string }[]>([]);
  const [sortField, setSortField] = createSignal("");
  const [sortDirection, setSortDirection] = createSignal<"asc" | "desc">("asc");
  const [limit, setLimit] = createSignal(25);
  let clauseIdCounter = 0;

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
      setHasRun(true);
      refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setHasRun(true);
    } finally {
      setIsRunning(false);
    }
  };

  const explainQuery = async () => {
    const collection = selectedCollection();
    if (!collection) return;

    setIsExplaining(true);
    setError(null);
    setExplanation(null);

    try {
      const query = JSON.parse(queryText());
      const result = await props.debugger.query.explain(collection, query).get();
      setExplanation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExplaining(false);
    }
  };

  const exportResults = async () => {
    const collection = selectedCollection();
    if (!collection) return;

    setIsExporting(true);
    setError(null);

    try {
      const query = JSON.parse(queryText());
      const boundlessQuery = { ...query };
      delete boundlessQuery.limit;

      const json = await props.debugger.export.exportQuery(collection, boundlessQuery, { pretty: true });
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${collection}-query-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const refreshHistory = () => {
    props.debugger.query.getHistory({ limit: 20 }).get().then(setHistory);
  };

  const addClause = () => {
    setClauses([...clauses(), { id: clauseIdCounter++, field: "", operator: "$eq", value: "" }]);
  };

  const removeClause = (id: number) => {
    setClauses(clauses().filter(c => c.id !== id));
  };

  const updateClause = (id: number, field: string, value: string | number) => {
    setClauses(clauses().map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const parseValue = (value: string): unknown => {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== "") return num;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const buildQueryFromBuilder = () => {
    const selector: Record<string, unknown> = {};
    for (const clause of clauses()) {
      if (clause.field) {
        selector[clause.field] = { [clause.operator]: parseValue(clause.value) };
      }
    }
    const query: { selector: Record<string, unknown>; sort?: unknown[]; limit: number } = {
      selector,
      limit: limit(),
    };
    if (sortField()) {
      query.sort = [{ [sortField()]: sortDirection() }];
    }
    return query;
  };

  const syncBuilderToJson = () => {
    const query = buildQueryFromBuilder();
    setQueryText(JSON.stringify(query, null, 2));
  };

  const runBuilderQuery = async () => {
    syncBuilderToJson();
    await runQuery();
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
        <Button theme={theme} variant="primary" onClick={queryMode() === "builder" ? runBuilderQuery : runQuery} disabled={isRunning()}>
          {isRunning() ? "Running..." : "Run Query"}
        </Button>
        <Button theme={theme} variant="secondary" onClick={explainQuery} disabled={isExplaining()}>
          {isExplaining() ? "Analyzing..." : "Explain"}
        </Button>
        <Button theme={theme} variant="secondary" onClick={exportResults} disabled={isExporting()}>
          {isExporting() ? "Exporting..." : "Export"}
        </Button>
        <Button theme={theme} onClick={() => { setShowHistory(!showHistory()); refreshHistory(); }}>
          History
        </Button>
        <div style={css(flex.row, { gap: "2px", background: theme.colors.bgSecondary, "border-radius": theme.sizing.borderRadius, padding: "2px" })}>
          <button
            style={css({
              padding: `${theme.sizing.spacing.xs} ${theme.sizing.spacing.sm}`,
              border: "none",
              "border-radius": theme.sizing.borderRadius,
              cursor: "pointer",
              "font-size": "11px",
              background: queryMode() === "json" ? theme.colors.accent : "transparent",
              color: queryMode() === "json" ? "#fff" : theme.colors.textMuted,
            })}
            onClick={() => setQueryMode("json")}
          >
            JSON
          </button>
          <button
            style={css({
              padding: `${theme.sizing.spacing.xs} ${theme.sizing.spacing.sm}`,
              border: "none",
              "border-radius": theme.sizing.borderRadius,
              cursor: "pointer",
              "font-size": "11px",
              background: queryMode() === "builder" ? theme.colors.accent : "transparent",
              color: queryMode() === "builder" ? "#fff" : theme.colors.textMuted,
            })}
            onClick={() => setQueryMode("builder")}
          >
            Builder
          </button>
        </div>
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

      <Show when={queryMode() === "json"}>
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
      </Show>

      <Show when={queryMode() === "builder"}>
        <div style={css(flex.col, { padding: theme.sizing.spacing.md, gap: theme.sizing.spacing.sm, "border-bottom": `1px solid ${theme.colors.border}` })}>
          <div style={css(flex.row, { gap: theme.sizing.spacing.sm, "align-items": "center" })}>
            <span style={{ "font-size": "12px", "font-weight": "500" }}>Filters</span>
            <Button theme={theme} size="sm" onClick={addClause}>+ Add Filter</Button>
          </div>
          <For each={clauses()}>
            {(clause) => (
              <div style={css(flex.row, { gap: theme.sizing.spacing.sm, "align-items": "center" })}>
                <input
                  style={css({
                    flex: "1",
                    padding: theme.sizing.spacing.xs,
                    background: theme.colors.bgSecondary,
                    border: `1px solid ${theme.colors.border}`,
                    "border-radius": theme.sizing.borderRadius,
                    color: theme.colors.text,
                    "font-size": "12px",
                  })}
                  placeholder="field"
                  value={clause.field}
                  onInput={(e) => updateClause(clause.id, "field", e.currentTarget.value)}
                />
                <select
                  style={css({
                    padding: theme.sizing.spacing.xs,
                    background: theme.colors.bgSecondary,
                    border: `1px solid ${theme.colors.border}`,
                    "border-radius": theme.sizing.borderRadius,
                    color: theme.colors.text,
                    "font-size": "12px",
                  })}
                  value={clause.operator}
                  onChange={(e) => updateClause(clause.id, "operator", e.currentTarget.value)}
                >
                  <option value="$eq">=</option>
                  <option value="$ne">≠</option>
                  <option value="$gt">&gt;</option>
                  <option value="$gte">≥</option>
                  <option value="$lt">&lt;</option>
                  <option value="$lte">≤</option>
                  <option value="$regex">regex</option>
                  <option value="$in">in</option>
                </select>
                <input
                  style={css({
                    flex: "1",
                    padding: theme.sizing.spacing.xs,
                    background: theme.colors.bgSecondary,
                    border: `1px solid ${theme.colors.border}`,
                    "border-radius": theme.sizing.borderRadius,
                    color: theme.colors.text,
                    "font-size": "12px",
                  })}
                  placeholder="value"
                  value={clause.value}
                  onInput={(e) => updateClause(clause.id, "value", e.currentTarget.value)}
                />
                <Button theme={theme} size="sm" variant="danger" onClick={() => removeClause(clause.id)}>×</Button>
              </div>
            )}
          </For>
          <Show when={clauses().length === 0}>
            <div style={{ "font-size": "12px", color: theme.colors.textMuted }}>No filters. Click "+ Add Filter" to add one.</div>
          </Show>
          <div style={css(flex.row, { gap: theme.sizing.spacing.md, "margin-top": theme.sizing.spacing.sm })}>
            <div style={css(flex.row, { gap: theme.sizing.spacing.xs, "align-items": "center" })}>
              <span style={{ "font-size": "11px", color: theme.colors.textMuted }}>Sort:</span>
              <input
                style={css({
                  width: "100px",
                  padding: theme.sizing.spacing.xs,
                  background: theme.colors.bgSecondary,
                  border: `1px solid ${theme.colors.border}`,
                  "border-radius": theme.sizing.borderRadius,
                  color: theme.colors.text,
                  "font-size": "11px",
                })}
                placeholder="field"
                value={sortField()}
                onInput={(e) => setSortField(e.currentTarget.value)}
              />
              <select
                style={css({
                  padding: theme.sizing.spacing.xs,
                  background: theme.colors.bgSecondary,
                  border: `1px solid ${theme.colors.border}`,
                  "border-radius": theme.sizing.borderRadius,
                  color: theme.colors.text,
                  "font-size": "11px",
                })}
                value={sortDirection()}
                onChange={(e) => setSortDirection(e.currentTarget.value as "asc" | "desc")}
              >
                <option value="asc">ASC</option>
                <option value="desc">DESC</option>
              </select>
            </div>
            <div style={css(flex.row, { gap: theme.sizing.spacing.xs, "align-items": "center" })}>
              <span style={{ "font-size": "11px", color: theme.colors.textMuted }}>Limit:</span>
              <input
                type="number"
                style={css({
                  width: "60px",
                  padding: theme.sizing.spacing.xs,
                  background: theme.colors.bgSecondary,
                  border: `1px solid ${theme.colors.border}`,
                  "border-radius": theme.sizing.borderRadius,
                  color: theme.colors.text,
                  "font-size": "11px",
                })}
                value={limit()}
                onInput={(e) => setLimit(Number(e.currentTarget.value) || 25)}
              />
            </div>
          </div>
        </div>
      </Show>

      <Show when={error()}>
        <div style={errorStyle}>{error()}</div>
      </Show>

      <Show when={explanation()}>
        {(exp) => (
          <div style={css({
            padding: theme.sizing.spacing.md,
            background: theme.colors.bgSecondary,
            "border-bottom": `1px solid ${theme.colors.border}`,
          })}>
            <div style={css(flex.row, { gap: theme.sizing.spacing.md, "align-items": "center", "margin-bottom": theme.sizing.spacing.sm })}>
              <span style={{ "font-weight": "600", "font-size": "12px" }}>Query Analysis</span>
              <span style={css({
                padding: `2px ${theme.sizing.spacing.xs}`,
                "border-radius": "3px",
                "font-size": "10px",
                "font-weight": "600",
                background: exp().efficiency === "index-only"
                  ? `${theme.colors.success}30`
                  : exp().efficiency === "partial-index"
                    ? `${theme.colors.warning}30`
                    : `${theme.colors.error}30`,
                color: exp().efficiency === "index-only"
                  ? theme.colors.success
                  : exp().efficiency === "partial-index"
                    ? theme.colors.warning
                    : theme.colors.error,
              })}>
                {exp().efficiency === "index-only" ? "Efficient" : exp().efficiency === "partial-index" ? "Partial Index" : "Full Scan"}
              </span>
              <Button theme={theme} size="sm" onClick={() => setExplanation(null)}>×</Button>
            </div>
            <div style={{ "font-size": "12px", display: "flex", gap: theme.sizing.spacing.lg }}>
              <div>
                <span style={{ color: theme.colors.textMuted }}>Uses Index: </span>
                <span style={{ color: exp().usesIndex ? theme.colors.success : theme.colors.error }}>
                  {exp().usesIndex ? "Yes" : "No"}
                </span>
              </div>
              <Show when={exp().indexFields.length > 0}>
                <div>
                  <span style={{ color: theme.colors.textMuted }}>Index Fields: </span>
                  <span style={{ "font-family": theme.fonts.mono }}>{exp().indexFields.join(", ")}</span>
                </div>
              </Show>
              <Show when={exp().uncoveredFields.length > 0}>
                <div>
                  <span style={{ color: theme.colors.textMuted }}>Uncovered: </span>
                  <span style={{ "font-family": theme.fonts.mono, color: theme.colors.warning }}>{exp().uncoveredFields.join(", ")}</span>
                </div>
              </Show>
            </div>
            <Show when={exp().suggestions.length > 0}>
              <div style={{ "margin-top": theme.sizing.spacing.sm }}>
                <For each={exp().suggestions}>
                  {(suggestion) => (
                    <div style={{ "font-size": "11px", color: theme.colors.textMuted, display: "flex", "align-items": "center", gap: theme.sizing.spacing.xs }}>
                      <span style={{ color: theme.colors.warning }}>💡</span> {suggestion}
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        )}
      </Show>

      <div style={resultsContainerStyle}>
        <div style={resultsHeaderStyle}>
          <span>Results: {results().length}</span>
        </div>
        <div style={scrollable}>
          <Show when={hasRun() && !isRunning() && !error() && results().length === 0}>
            <div style={{ padding: theme.sizing.spacing.xl, "text-align": "center", color: theme.colors.textMuted }}>
              Query returned no results
            </div>
          </Show>
          <Show when={!hasRun() && !isRunning()}>
            <div style={{ padding: theme.sizing.spacing.xl, "text-align": "center", color: theme.colors.textMuted }}>
              Run a query to see results
            </div>
          </Show>
          <For each={results()}>
            {(doc) => (
              <div style={resultRowStyle}>
                <div style={{ color: theme.colors.accent, "margin-bottom": "4px" }}>
                  {doc.id}
                </div>
                <JsonViewer theme={theme} data={doc.data} collapsed={true} />
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
