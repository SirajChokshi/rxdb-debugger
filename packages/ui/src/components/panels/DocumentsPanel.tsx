import { createEffect, createSignal, createMemo, For, onCleanup, Show, type JSX } from "solid-js";
import type { RxdbDebugger, DiffResult, DocumentResult, SchemaDetails, DocumentVersion } from "@rxdb-debugger/core";
import { Table, type TableColumn } from "../shared/Table.js";
import { css, ellipsis, flex, scrollable } from "../../styles/css.js";
import type { Theme } from "../../styles/theme.js";
import { Button } from "../shared/Button.js";
import { JsonDiff } from "../shared/JsonDiff.js";
import { CodeEditor } from "../shared/CodeEditor.js";
import { JsonViewer } from "../shared/JsonViewer.js";
import { createObservableSignal } from "../../utils/observable.js";

export interface DocumentsPanelProps {
  theme: Theme;
  debugger: RxdbDebugger;
  allowMutations: boolean;
}

const PAGE_SIZE = 50;

export function DocumentsPanel(props: DocumentsPanelProps) {
  const [collections, setCollections] = createSignal<string[]>([]);
  const [selectedCollection, setSelectedCollection] = createSignal<string>("");
  const [documents, setDocuments] = createSignal<DocumentResult[]>([]);
  const [selectedDoc, setSelectedDoc] = createSignal<DocumentResult | null>(null);
  const [compareDoc, setCompareDoc] = createSignal<DocumentResult | null>(null);
  const [diffResult, setDiffResult] = createSignal<DiffResult | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [totalCount, setTotalCount] = createSignal(0);
  const [searchTerm, setSearchTerm] = createSignal("");
  const [compareMode, setCompareMode] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [isEditing, setIsEditing] = createSignal(false);
  const [isInserting, setIsInserting] = createSignal(false);
  const [editingJson, setEditingJson] = createSignal("");
  const [editError, setEditError] = createSignal<string | null>(null);
  const [isSaving, setIsSaving] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<"list" | "table">("list");
  const [schema, setSchema] = createSignal<SchemaDetails | null>(null);
  const [showHistory, setShowHistory] = createSignal(false);
  const [docHistory, setDocHistory] = createSignal<DocumentVersion[]>([]);
  const [isMobile, setIsMobile] = createSignal(false);

  createEffect(() => {
    const checkWidth = () => setIsMobile(window.innerWidth < 768);
    checkWidth();
    window.addEventListener("resize", checkWidth);
    onCleanup(() => window.removeEventListener("resize", checkWidth));
  });

  createEffect(() => {
    props.debugger.catalog.collectionNames().get().then((names) => {
      setCollections(names);
      const first = names[0];
      if (first && !selectedCollection()) {
        setSelectedCollection(first);
      }
    });
  });

  const liveDocuments = createMemo(() => {
    const collection = selectedCollection();
    if (!collection) return null;
    return createObservableSignal(
      () => props.debugger.documents.list(collection, { limit: PAGE_SIZE, live: true }).observe(),
      {
        initialValue: [] as DocumentResult[],
        onError: (err) => setError(err instanceof Error ? err.message : "Failed to load documents"),
      }
    );
  });

  const liveCount = createMemo(() => {
    const collection = selectedCollection();
    if (!collection) return null;
    return createObservableSignal(
      () => props.debugger.documents.count(collection, { live: true }).observe(),
      { initialValue: 0 }
    );
  });

  createEffect(() => {
    const collection = selectedCollection();
    if (!collection) return;

    setIsLoading(true);
    setDocuments([]);
    setSelectedDoc(null);
    setCompareDoc(null);
    setDiffResult(null);
    setError(null);
  });

  createEffect(() => {
    const docsAccessor = liveDocuments();
    if (docsAccessor) {
      const docs = docsAccessor();
      setDocuments(docs);
      if (docs.length > 0 || !isLoading()) {
        setIsLoading(false);
      }
    }
  });

  createEffect(() => {
    const countAccessor = liveCount();
    if (countAccessor) {
      setTotalCount(countAccessor());
    }
  });

  createEffect(() => {
    const collection = selectedCollection();
    if (!collection) {
      setSchema(null);
      return;
    }
    props.debugger.schema.getSchema(collection).get()
      .then(setSchema)
      .catch(() => setSchema(null));
  });

  createEffect(() => {
    const doc1 = selectedDoc();
    const doc2 = compareDoc();
    if (doc1 && doc2) {
      const result = props.debugger.documents.compare(doc1, doc2);
      setDiffResult(result);
    } else {
      setDiffResult(null);
    }
  });

  const filteredDocs = () => {
    const term = searchTerm().toLowerCase();
    if (!term) return documents();
    return documents().filter(
      (doc) =>
        doc.id.toLowerCase().includes(term) ||
        JSON.stringify(doc.data).toLowerCase().includes(term)
    );
  };

  const handleDocClick = (doc: DocumentResult) => {
    if (compareMode()) {
      if (!selectedDoc()) {
        setSelectedDoc(doc);
      } else if (selectedDoc()?.id !== doc.id) {
        setCompareDoc(doc);
      }
    } else {
      setSelectedDoc(doc);
      setCompareDoc(null);
    }
  };

  const exitCompareMode = () => {
    setCompareMode(false);
    setCompareDoc(null);
    setDiffResult(null);
  };

  const deleteDocument = async () => {
    const doc = selectedDoc();
    const collection = selectedCollection();
    if (!doc || !collection || !props.allowMutations) return;

    if (!confirm(`Delete document ${doc.id}?`)) return;

    await props.debugger.documents.delete(collection, doc.id);
    setSelectedDoc(null);
  };

  const startEditing = () => {
    const doc = selectedDoc();
    if (!doc) return;
    setEditingJson(JSON.stringify(doc.data, null, 2));
    setEditError(null);
    setIsEditing(true);
  };

  const loadHistory = () => {
    const doc = selectedDoc();
    const collection = selectedCollection();
    if (!doc || !collection || !props.debugger.history) return;

    props.debugger.history.getVersions(collection, doc.id).get()
      .then((versions) => {
        setDocHistory(versions);
        setShowHistory(true);
      })
      .catch(() => setDocHistory([]));
  };

  const selectVersion = (version: DocumentVersion) => {
    setSelectedDoc({ id: version.documentId, data: version.data });
    setShowHistory(false);
  };

  const startInserting = () => {
    setEditingJson("{\n  \n}");
    setEditError(null);
    setIsInserting(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setIsInserting(false);
    setEditingJson("");
    setEditError(null);
  };

  const saveDocument = async () => {
    const collection = selectedCollection();
    if (!collection || !props.allowMutations) return;

    setIsSaving(true);
    setEditError(null);

    try {
      const data = JSON.parse(editingJson());

      if (isInserting()) {
        await props.debugger.documents.insert(collection, data);
        setIsInserting(false);
      } else if (isEditing()) {
        const doc = selectedDoc();
        if (!doc) return;
        await props.debugger.documents.update(collection, doc.id, data);
        setIsEditing(false);
        setSelectedDoc(null);
      }
      setEditingJson("");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save document");
    } finally {
      setIsSaving(false);
    }
  };

  const { theme } = props;

  const containerStyle = css(flex.row, {
    height: "100%",
    overflow: "hidden",
    position: "relative",
  });

  const listStyle = css(flex.col, {
    flex: "1",
    "min-width": "0",
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

  const searchStyle = css({
    flex: "1",
    padding: `${theme.sizing.spacing.xs} ${theme.sizing.spacing.sm}`,
    background: theme.colors.bgSecondary,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    "border-radius": theme.sizing.borderRadius,
    "font-size": "12px",
    outline: "none",
  });

  const countStyle = css({
    "font-size": "11px",
    color: theme.colors.textMuted,
  });

  const docListStyle = css(scrollable, {
    flex: "1",
  });

  const docRowStyle = (isSelected: boolean, isCompare: boolean): JSX.CSSProperties =>
    css(flex.row, {
      padding: `${theme.sizing.spacing.sm} ${theme.sizing.spacing.md}`,
      "border-bottom": `1px solid ${theme.colors.border}`,
      cursor: "pointer",
      background: isCompare
        ? `${theme.colors.warning}20`
        : isSelected
          ? theme.colors.bgSelected
          : "transparent",
      gap: theme.sizing.spacing.md,
    });

  const docIdStyle = css(ellipsis, {
    width: "160px",
    "flex-shrink": "0",
    "font-family": theme.fonts.mono,
    "font-size": "12px",
    color: theme.colors.accent,
  });

  const docPreviewStyle = css(ellipsis, {
    flex: "1",
    "font-size": "12px",
    color: theme.colors.textSecondary,
  });

  const detailStyle = css(flex.col, isMobile() ? {
    position: "absolute",
    inset: "0",
    background: theme.colors.bg,
    "z-index": "50",
  } : {
    width: "400px",
    "flex-shrink": "0",
    "border-left": `1px solid ${theme.colors.border}`,
    overflow: "hidden",
  });

  const detailHeaderStyle = css(flex.row, flex.between, {
    padding: theme.sizing.spacing.md,
    "border-bottom": `1px solid ${theme.colors.border}`,
    "align-items": "center",
    "flex-shrink": "0",
  });

  const detailContentStyle = css(scrollable, {
    flex: "1",
    padding: theme.sizing.spacing.md,
    "font-family": theme.fonts.mono,
    "font-size": "11px",
    "white-space": "pre-wrap",
    "word-break": "break-all",
  });

  const getDocPreview = (data: Record<string, unknown>): string => {
    const keys = Object.keys(data).slice(0, 4);
    const pairs = keys.map((k) => {
      const v = data[k];
      const preview = typeof v === "string" ? v.slice(0, 20) : JSON.stringify(v);
      return `${k}: ${preview}`;
    });
    return pairs.join(" | ");
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "string") return value.length > 30 ? value.slice(0, 30) + "..." : value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return `[${value.length}]`;
    if (typeof value === "object") return "{...}";
    return String(value);
  };

  const generateColumns = (): TableColumn<DocumentResult>[] => {
    const columns: TableColumn<DocumentResult>[] = [
      { key: "id", label: "ID", width: "150px", render: (doc) => doc.id }
    ];
    const s = schema();
    if (s) {
      for (const prop of s.properties.slice(0, 5)) {
        columns.push({
          key: prop.name,
          label: prop.name,
          render: (doc) => formatValue(doc.data[prop.name])
        });
      }
    } else {
      const sample = documents()[0];
      if (sample) {
        for (const key of Object.keys(sample.data).slice(0, 5)) {
          columns.push({
            key,
            label: key,
            render: (doc) => formatValue(doc.data[key])
          });
        }
      }
    }
    return columns;
  };

  return (
    <div style={containerStyle}>
      <div style={listStyle}>
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
          <input
            style={searchStyle}
            placeholder="Search documents..."
            value={searchTerm()}
            onInput={(e) => setSearchTerm(e.currentTarget.value)}
          />
          <Button
            theme={theme}
            variant={compareMode() ? "primary" : "secondary"}
            size="sm"
            onClick={() => compareMode() ? exitCompareMode() : setCompareMode(true)}
          >
            {compareMode() ? "Exit Compare" : "Compare"}
          </Button>
          <Show when={props.allowMutations}>
            <Button
              theme={theme}
              variant="primary"
              size="sm"
              onClick={startInserting}
            >
              + New
            </Button>
          </Show>
          <div style={css(flex.row, { gap: "2px", background: theme.colors.bgSecondary, "border-radius": theme.sizing.borderRadius, padding: "2px" })}>
            <button
              style={css({
                padding: `${theme.sizing.spacing.xs} ${theme.sizing.spacing.sm}`,
                border: "none",
                "border-radius": theme.sizing.borderRadius,
                cursor: "pointer",
                "font-size": "11px",
                background: viewMode() === "list" ? theme.colors.accent : "transparent",
                color: viewMode() === "list" ? "#fff" : theme.colors.textMuted,
              })}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
            <button
              style={css({
                padding: `${theme.sizing.spacing.xs} ${theme.sizing.spacing.sm}`,
                border: "none",
                "border-radius": theme.sizing.borderRadius,
                cursor: "pointer",
                "font-size": "11px",
                background: viewMode() === "table" ? theme.colors.accent : "transparent",
                color: viewMode() === "table" ? "#fff" : theme.colors.textMuted,
              })}
              onClick={() => setViewMode("table")}
            >
              Table
            </button>
          </div>
          <span style={countStyle}>
            {filteredDocs().length} / {totalCount()}
          </span>
        </div>

        <Show when={compareMode()}>
          <div style={css({
            padding: theme.sizing.spacing.sm,
            background: `${theme.colors.warning}20`,
            "font-size": "12px",
            color: theme.colors.warning,
          })}>
            Compare mode: Select two documents to compare
          </div>
        </Show>

        <div style={docListStyle}>
          <Show when={isLoading()}>
            <div style={{ padding: theme.sizing.spacing.xl, "text-align": "center", color: theme.colors.textMuted }}>
              Loading...
            </div>
          </Show>
          <Show when={error()}>
            <div style={{ padding: theme.sizing.spacing.md, margin: theme.sizing.spacing.md, color: theme.colors.error, background: `${theme.colors.error}15`, "border-radius": theme.sizing.borderRadius }}>
              {error()}
            </div>
          </Show>
          <Show when={!isLoading() && !error() && documents().length === 0}>
            <div style={{ padding: theme.sizing.spacing.xl, "text-align": "center", color: theme.colors.textMuted }}>
              No documents in this collection
            </div>
          </Show>
          <Show when={!isLoading() && !error() && documents().length > 0 && filteredDocs().length === 0}>
            <div style={{ padding: theme.sizing.spacing.xl, "text-align": "center", color: theme.colors.textMuted }}>
              No documents match your search
            </div>
          </Show>

          <Show when={viewMode() === "list"}>
            <For each={filteredDocs()}>
              {(doc) => {
                const isSelected = () => selectedDoc()?.id === doc.id;
                const isCompare = () => compareDoc()?.id === doc.id;
                return (
                  <div
                    style={docRowStyle(isSelected(), isCompare())}
                    onClick={() => handleDocClick(doc)}
                    onMouseEnter={(e) => {
                      if (!isSelected() && !isCompare()) {
                        e.currentTarget.style.background = theme.colors.bgHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected() && !isCompare()) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <span style={docIdStyle}>{doc.id}</span>
                    <span style={docPreviewStyle}>{getDocPreview(doc.data)}</span>
                  </div>
                );
              }}
            </For>
          </Show>

          <Show when={viewMode() === "table" && filteredDocs().length > 0}>
            <Table
              theme={theme}
              columns={generateColumns()}
              data={filteredDocs()}
              getRowKey={(doc) => doc.id}
              onRowClick={handleDocClick}
              selectedKey={selectedDoc()?.id ?? null}
              emptyMessage="No documents"
            />
          </Show>
        </div>
      </div>

      <Show when={selectedDoc() || diffResult()}>
        <div style={detailStyle}>
          <div style={detailHeaderStyle}>
            <span style={{ "font-weight": "600", "font-size": "12px", "font-family": theme.fonts.mono }}>
              {diffResult() ? "Document Comparison" : selectedDoc()?.id}
            </span>
            <div style={css(flex.row, { gap: theme.sizing.spacing.xs })}>
              <Show when={selectedDoc() && !diffResult()}>
                <Button theme={theme} size="sm" onClick={loadHistory}>
                  History
                </Button>
              </Show>
              <Show when={props.allowMutations && selectedDoc() && !diffResult()}>
                <Button theme={theme} size="sm" onClick={startEditing}>
                  Edit
                </Button>
                <Button theme={theme} size="sm" variant="danger" onClick={deleteDocument}>
                  Delete
                </Button>
              </Show>
              <Button theme={theme} size="sm" onClick={() => { setSelectedDoc(null); setCompareDoc(null); setDiffResult(null); setShowHistory(false); }}>
                ×
              </Button>
            </div>
          </div>
          <Show when={showHistory()}>
            <div style={css(detailContentStyle, { padding: "0" })}>
              <div style={{ padding: theme.sizing.spacing.sm, background: theme.colors.bgSecondary, "font-size": "11px", display: "flex", "justify-content": "space-between", "align-items": "center" }}>
                <span>Version History</span>
                <Button theme={theme} size="sm" onClick={() => setShowHistory(false)}>Back</Button>
              </div>
              <div style={css(scrollable, { flex: "1" })}>
                <Show when={docHistory().length === 0}>
                  <div style={{ padding: theme.sizing.spacing.xl, "text-align": "center", color: theme.colors.textMuted }}>
                    No history recorded for this document
                  </div>
                </Show>
                <For each={docHistory()}>
                  {(version) => (
                    <div
                      style={css(flex.row, {
                        padding: theme.sizing.spacing.sm,
                        "border-bottom": `1px solid ${theme.colors.border}`,
                        cursor: "pointer",
                        gap: theme.sizing.spacing.sm,
                        "align-items": "center",
                      })}
                      onClick={() => selectVersion(version)}
                      onMouseEnter={(e) => { e.currentTarget.style.background = theme.colors.bgHover; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={css({
                        padding: `2px ${theme.sizing.spacing.xs}`,
                        "border-radius": "3px",
                        "font-size": "10px",
                        "font-weight": "600",
                        background: version.operation === "INSERT" ? `${theme.colors.success}30` : version.operation === "UPDATE" ? `${theme.colors.warning}30` : `${theme.colors.error}30`,
                        color: version.operation === "INSERT" ? theme.colors.success : version.operation === "UPDATE" ? theme.colors.warning : theme.colors.error,
                      })}>
                        {version.operation}
                      </span>
                      <span style={{ "font-size": "11px", color: theme.colors.textMuted, "font-family": theme.fonts.mono }}>
                        {new Date(version.timestamp).toLocaleString()}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
          <Show when={!showHistory()}>
            <Show when={diffResult()} fallback={
              <div style={css(detailContentStyle, { padding: "0" })}>
                <JsonViewer theme={theme} data={selectedDoc()?.data} collapsed={false} />
              </div>
            }>
              {(diff) => (
                <div style={css(detailContentStyle, { padding: "0" })}>
                  <div style={{ padding: theme.sizing.spacing.sm, background: theme.colors.bgSecondary, "font-size": "11px" }}>
                    <span style={{ color: theme.colors.accent }}>{selectedDoc()?.id}</span>
                    {" vs "}
                    <span style={{ color: theme.colors.warning }}>{compareDoc()?.id}</span>
                    {diff().equal && <span style={{ color: theme.colors.success }}> (identical)</span>}
                  </div>
                  <JsonDiff theme={theme} changes={diff().changes} />
                </div>
              )}
            </Show>
          </Show>
        </div>
      </Show>

      <Show when={isEditing() || isInserting()}>
        <div style={css({
          position: "absolute",
          inset: "0",
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          "z-index": "100",
        })}>
          <div style={css(flex.col, {
            width: "500px",
            "max-height": "80%",
            background: theme.colors.bg,
            "border-radius": theme.sizing.borderRadius,
            border: `1px solid ${theme.colors.border}`,
            overflow: "hidden",
          })}>
            <div style={css(flex.row, flex.between, {
              padding: theme.sizing.spacing.md,
              "border-bottom": `1px solid ${theme.colors.border}`,
              "align-items": "center",
            })}>
              <span style={{ "font-weight": "600", "font-size": "14px" }}>
                {isInserting() ? "New Document" : `Edit: ${selectedDoc()?.id}`}
              </span>
              <Button theme={theme} size="sm" onClick={cancelEdit}>×</Button>
            </div>
            <div style={css(flex.col, { padding: theme.sizing.spacing.md, gap: theme.sizing.spacing.md })}>
              <Show when={editError()}>
                <div style={{ color: theme.colors.error, background: `${theme.colors.error}15`, padding: theme.sizing.spacing.sm, "border-radius": theme.sizing.borderRadius, "font-size": "12px" }}>
                  {editError()}
                </div>
              </Show>
              <CodeEditor
                theme={theme}
                value={editingJson()}
                onChange={setEditingJson}
                language="json"
                height="300px"
                placeholder="Enter document JSON..."
              />
              <div style={css(flex.row, { gap: theme.sizing.spacing.sm, "justify-content": "flex-end" })}>
                <Button theme={theme} onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button theme={theme} variant="primary" onClick={saveDocument} disabled={isSaving()}>
                  {isSaving() ? "Saving..." : isInserting() ? "Create" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
