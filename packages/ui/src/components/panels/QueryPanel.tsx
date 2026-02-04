import { createEffect, createSignal, For, Index, Show } from "solid-js";
import type { RxdbDebugger, QueryDocument, QueryHistoryEntry, QueryExplanation } from "@rxdb-debugger/core";
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

  const { theme } = props;
  let prevQueryMode = queryMode();

  createEffect(() => {
    props.debugger.catalog.collectionNames().get().then((names) => {
      setCollections(names);
      const first = names[0];
      if (first && !selectedCollection()) {
        setSelectedCollection(first);
      }
    });
  });

  createEffect(() => {
    const currentMode = queryMode();
    if (prevQueryMode === "builder" && currentMode === "json") {
      syncBuilderToJson();
    }
    prevQueryMode = currentMode;
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
        const parsedValue = parseValue(clause.value);
        if (clause.operator === "$eq") {
          selector[clause.field] = parsedValue;
        } else {
          selector[clause.field] = { [clause.operator]: parsedValue };
        }
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
    const collection = selectedCollection();
    if (!collection) return;

    setIsRunning(true);
    setError(null);
    setResults([]);
    setDuration(null);

    try {
      const query = buildQueryFromBuilder();
      setQueryText(JSON.stringify(query, null, 2));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await props.debugger.query.execute(collection, query as any).get();
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

  const loadFromHistory = (entry: QueryHistoryEntry) => {
    setSelectedCollection(entry.collection);
    setQueryText(JSON.stringify(entry.query, null, 2));
    setShowHistory(false);
  };

  const efficiencyClasses = (eff: string) => {
    if (eff === "index-only") return "bg-success/30 text-success";
    if (eff === "partial-index") return "bg-warning/30 text-warning";
    return "bg-error/30 text-error";
  };

  const modeButtonClasses = (isActive: boolean) => {
    const base = "px-[var(--spacing-sm)] py-[var(--spacing-xs)] border-none rounded-[var(--radius)] cursor-pointer text-[11px]";
    return isActive ? `${base} bg-accent text-white` : `${base} bg-transparent text-text-muted`;
  };

  const inputClasses = "flex-1 p-[var(--spacing-xs)] bg-bg-secondary border border-border rounded-[var(--radius)] text-text text-xs";

  return (
    <div class="flex flex-col h-full overflow-hidden relative">
      <div class="flex flex-row p-[var(--spacing-md)] gap-[var(--spacing-sm)] border-b border-border items-center shrink-0">
        <select
          class="px-[var(--spacing-sm)] py-[var(--spacing-xs)] bg-bg-secondary text-text border border-border rounded-[var(--radius)] text-xs"
          value={selectedCollection()}
          onChange={(e) => setSelectedCollection(e.currentTarget.value)}
        >
          <For each={collections()}>
            {(name) => <option value={name}>{name}</option>}
          </For>
        </select>
        <Button theme={theme} variant="primary" onClick={() => queryMode() === "builder" ? runBuilderQuery() : runQuery()} disabled={isRunning()}>
          {isRunning() ? "Running..." : "Run Query"}
        </Button>
        <Button theme={theme} variant="secondary" onClick={explainQuery} disabled={isExplaining()}>
          {isExplaining() ? "Analyzing..." : "Explain"}
        </Button>
        <Button theme={theme} variant="secondary" onClick={exportResults} disabled={isExporting()}>
          {isExporting() ? "Exporting..." : "Export"}
        </Button>
        <div class="relative">
          <Button theme={theme} onClick={() => { setShowHistory(!showHistory()); refreshHistory(); }}>
            History
          </Button>
          <Show when={showHistory()}>
            <div class="absolute left-0 top-full mt-1 w-[300px] max-h-[300px] bg-bg border border-border rounded-[var(--radius)] shadow-lg z-10 overflow-hidden flex flex-col">
              <div class="flex-1 overflow-auto">
                <For each={history()} fallback={
                  <div class="p-[var(--spacing-md)] text-text-muted">No history yet</div>
                }>
                  {(entry) => (
                    <div
                      class="p-[var(--spacing-sm)] border-b border-border cursor-pointer text-[11px] hover:bg-bg-hover"
                      onClick={() => loadFromHistory(entry)}
                    >
                      <div class="font-medium">{entry.collection}</div>
                      <div class="text-text-muted">
                        {entry.resultCount} results • {entry.duration.toFixed(1)}ms
                        {!entry.success && ` • ${entry.error}`}
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
        <div class="flex flex-row gap-0.5 bg-bg-secondary rounded-[var(--radius)] p-0.5">
          <button class={modeButtonClasses(queryMode() === "json")} onClick={() => setQueryMode("json")}>
            JSON
          </button>
          <button class={modeButtonClasses(queryMode() === "builder")} onClick={() => setQueryMode("builder")}>
            Builder
          </button>
        </div>
        <div class="flex-1" />
        <Show when={duration() !== null}>
          <span class="text-[11px] text-text-muted">{duration()?.toFixed(1)}ms</span>
        </Show>
      </div>

      <Show when={queryMode() === "json"}>
        <div class="p-[var(--spacing-md)] pt-0 shrink-0">
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
        <div class="flex flex-col p-[var(--spacing-md)] gap-[var(--spacing-sm)] border-b border-border">
          <div class="flex flex-row gap-[var(--spacing-sm)] items-center">
            <span class="text-xs font-medium">Filters</span>
            <Button theme={theme} size="sm" onClick={addClause}>+ Add Filter</Button>
          </div>
          <Index each={clauses()}>
            {(clause) => (
              <div class="flex flex-row gap-[var(--spacing-sm)] items-center">
                <input
                  class={inputClasses}
                  placeholder="field"
                  value={clause().field}
                  onInput={(e) => updateClause(clause().id, "field", e.currentTarget.value)}
                />
                <select
                  class="p-[var(--spacing-xs)] bg-bg-secondary border border-border rounded-[var(--radius)] text-text text-xs"
                  value={clause().operator}
                  onChange={(e) => updateClause(clause().id, "operator", e.currentTarget.value)}
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
                  class={inputClasses}
                  placeholder="value"
                  value={clause().value}
                  onInput={(e) => updateClause(clause().id, "value", e.currentTarget.value)}
                />
                <Button theme={theme} size="sm" variant="danger" onClick={() => removeClause(clause().id)}>×</Button>
              </div>
            )}
          </Index>
          <Show when={clauses().length === 0}>
            <div class="text-xs text-text-muted">No filters. Click "+ Add Filter" to add one.</div>
          </Show>
          <div class="flex flex-row gap-[var(--spacing-md)] mt-[var(--spacing-sm)]">
            <div class="flex flex-row gap-[var(--spacing-xs)] items-center">
              <span class="text-[11px] text-text-muted">Sort:</span>
              <input
                class="w-[100px] p-[var(--spacing-xs)] bg-bg-secondary border border-border rounded-[var(--radius)] text-text text-[11px]"
                placeholder="field"
                value={sortField()}
                onInput={(e) => setSortField(e.currentTarget.value)}
              />
              <select
                class="p-[var(--spacing-xs)] bg-bg-secondary border border-border rounded-[var(--radius)] text-text text-[11px]"
                value={sortDirection()}
                onChange={(e) => setSortDirection(e.currentTarget.value as "asc" | "desc")}
              >
                <option value="asc">ASC</option>
                <option value="desc">DESC</option>
              </select>
            </div>
            <div class="flex flex-row gap-[var(--spacing-xs)] items-center">
              <span class="text-[11px] text-text-muted">Limit:</span>
              <input
                type="number"
                class="w-[60px] p-[var(--spacing-xs)] bg-bg-secondary border border-border rounded-[var(--radius)] text-text text-[11px]"
                value={limit()}
                onInput={(e) => setLimit(Number(e.currentTarget.value) || 25)}
              />
            </div>
          </div>
        </div>
      </Show>

      <Show when={error()}>
        <div class="p-[var(--spacing-md)] bg-error/20 text-error text-xs">{error()}</div>
      </Show>

      <Show when={explanation()}>
        {(exp) => (
          <div class="p-[var(--spacing-md)] bg-bg-secondary border-b border-border">
            <div class="flex flex-row gap-[var(--spacing-md)] items-center mb-[var(--spacing-sm)]">
              <span class="font-semibold text-xs">Query Analysis</span>
              <span class={`px-[var(--spacing-xs)] py-0.5 rounded-sm text-[10px] font-semibold ${efficiencyClasses(exp().efficiency)}`}>
                {exp().efficiency === "index-only" ? "Efficient" : exp().efficiency === "partial-index" ? "Partial Index" : "Full Scan"}
              </span>
              <Button theme={theme} size="sm" onClick={() => setExplanation(null)}>×</Button>
            </div>
            <div class="text-xs flex gap-[var(--spacing-lg)]">
              <div>
                <span class="text-text-muted">Uses Index: </span>
                <span class={exp().usesIndex ? "text-success" : "text-error"}>
                  {exp().usesIndex ? "Yes" : "No"}
                </span>
              </div>
              <Show when={exp().indexFields.length > 0}>
                <div>
                  <span class="text-text-muted">Index Fields: </span>
                  <span class="font-mono">{exp().indexFields.join(", ")}</span>
                </div>
              </Show>
              <Show when={exp().uncoveredFields.length > 0}>
                <div>
                  <span class="text-text-muted">Uncovered: </span>
                  <span class="font-mono text-warning">{exp().uncoveredFields.join(", ")}</span>
                </div>
              </Show>
            </div>
            <Show when={exp().suggestions.length > 0}>
              <div class="block mt-[var(--spacing-sm)]">
                <For each={exp().suggestions}>
                  {(suggestion) => (
                    <div class="text-[11px] text-text-muted flex items-center gap-[var(--spacing-xs)]">
                      <span class="text-warning">💡</span> {suggestion}
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        )}
      </Show>

      <div class="flex flex-col flex-1 overflow-auto border-t border-border">
        <div class="flex flex-row justify-between p-[var(--spacing-md)] bg-bg-secondary text-xs shrink-0">
          <span>Results: {results().length}</span>
        </div>
        <div class="overflow-auto">
          <Show when={hasRun() && !isRunning() && !error() && results().length === 0}>
            <div class="p-[var(--spacing-xl)] text-center text-text-muted">Query returned no results</div>
          </Show>
          <Show when={!hasRun() && !isRunning()}>
            <div class="p-[var(--spacing-xl)] text-center text-text-muted">Run a query to see results</div>
          </Show>
          <For each={results()}>
            {(doc) => (
              <div class="p-[var(--spacing-md)] border-b border-border font-mono text-[11px] whitespace-pre-wrap break-all">
                <div class="text-accent mb-1">{doc.id}</div>
                <JsonViewer theme={theme} data={doc.data} collapsed={true} />
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
