import { createEffect, createSignal, createMemo, For, onCleanup, Show } from "solid-js";
import type { RxdbDebugger, DiffResult, DocumentResult, SchemaDetails, DocumentVersion } from "@rxdb-debugger/core";
import { Table, type TableColumn } from "../shared/Table.js";
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

const opBadgeClasses = {
  INSERT: "bg-success/30 text-success",
  UPDATE: "bg-warning/30 text-warning",
  DELETE: "bg-error/30 text-error",
};

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

  const { theme } = props;

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

  const modeButtonClasses = (isActive: boolean) => {
    const base = "px-[var(--spacing-sm)] py-[var(--spacing-xs)] border-none rounded-[var(--radius)] cursor-pointer text-[11px]";
    return isActive ? `${base} bg-accent text-white` : `${base} bg-transparent text-text-muted`;
  };

  const docRowClasses = (isSelected: boolean, isCompare: boolean) => {
    const base = "flex flex-row px-[var(--spacing-md)] py-[var(--spacing-sm)] border-b border-border cursor-pointer gap-[var(--spacing-md)]";
    if (isCompare) return `${base} bg-warning/20`;
    if (isSelected) return `${base} bg-bg-selected`;
    return `${base} hover:bg-bg-hover`;
  };

  const detailClasses = () => {
    if (isMobile()) {
      return "flex flex-col absolute inset-0 bg-bg z-50";
    }
    return "flex flex-col w-[400px] shrink-0 border-l border-border overflow-hidden";
  };

  return (
    <div class="flex flex-row h-full overflow-hidden relative">
      <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
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
          <input
            class="flex-1 px-[var(--spacing-sm)] py-[var(--spacing-xs)] bg-bg-secondary text-text border border-border rounded-[var(--radius)] text-xs outline-none"
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
            <Button theme={theme} variant="primary" size="sm" onClick={startInserting}>
              + New
            </Button>
          </Show>
          <div class="flex flex-row gap-0.5 bg-bg-secondary rounded-[var(--radius)] p-0.5">
            <button class={modeButtonClasses(viewMode() === "list")} onClick={() => setViewMode("list")}>
              List
            </button>
            <button class={modeButtonClasses(viewMode() === "table")} onClick={() => setViewMode("table")}>
              Table
            </button>
          </div>
          <span class="text-[11px] text-text-muted">
            {filteredDocs().length} / {totalCount()}
          </span>
        </div>

        <Show when={compareMode()}>
          <div class="p-[var(--spacing-sm)] bg-warning/20 text-xs text-warning">
            Compare mode: Select two documents to compare
          </div>
        </Show>

        <div class="flex-1 overflow-auto">
          <Show when={isLoading()}>
            <div class="p-[var(--spacing-xl)] text-center text-text-muted">Loading...</div>
          </Show>
          <Show when={error()}>
            <div class="p-[var(--spacing-md)] m-[var(--spacing-md)] text-error bg-error/10 rounded-[var(--radius)]">{error()}</div>
          </Show>
          <Show when={!isLoading() && !error() && documents().length === 0}>
            <div class="p-[var(--spacing-xl)] text-center text-text-muted">No documents in this collection</div>
          </Show>
          <Show when={!isLoading() && !error() && documents().length > 0 && filteredDocs().length === 0}>
            <div class="p-[var(--spacing-xl)] text-center text-text-muted">No documents match your search</div>
          </Show>

          <Show when={viewMode() === "list"}>
            <For each={filteredDocs()}>
              {(doc) => {
                const isSelected = () => selectedDoc()?.id === doc.id;
                const isCompare = () => compareDoc()?.id === doc.id;
                return (
                  <div class={docRowClasses(isSelected(), isCompare())} onClick={() => handleDocClick(doc)}>
                    <span class="w-[160px] shrink-0 font-mono text-xs text-accent truncate">{doc.id}</span>
                    <span class="flex-1 text-xs text-text-secondary truncate">{getDocPreview(doc.data)}</span>
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
        <div class={detailClasses()}>
          <div class="flex flex-row justify-between p-[var(--spacing-md)] border-b border-border items-center shrink-0">
            <span class="font-semibold text-xs font-mono">
              {diffResult() ? "Document Comparison" : selectedDoc()?.id}
            </span>
            <div class="flex flex-row gap-[var(--spacing-xs)]">
              <Show when={selectedDoc() && !diffResult()}>
                <Button theme={theme} size="sm" onClick={loadHistory}>History</Button>
              </Show>
              <Show when={props.allowMutations && selectedDoc() && !diffResult()}>
                <Button theme={theme} size="sm" onClick={startEditing}>Edit</Button>
                <Button theme={theme} size="sm" variant="danger" onClick={deleteDocument}>Delete</Button>
              </Show>
              <Button theme={theme} size="sm" onClick={() => { setSelectedDoc(null); setCompareDoc(null); setDiffResult(null); setShowHistory(false); }}>
                ×
              </Button>
            </div>
          </div>
          <Show when={showHistory()}>
            <div class="flex-1 overflow-auto">
              <div class="p-[var(--spacing-sm)] bg-bg-secondary text-[11px] flex justify-between items-center">
                <span>Version History</span>
                <Button theme={theme} size="sm" onClick={() => setShowHistory(false)}>Back</Button>
              </div>
              <div class="flex-1 overflow-auto">
                <Show when={docHistory().length === 0}>
                  <div class="p-[var(--spacing-xl)] text-center text-text-muted">No history recorded for this document</div>
                </Show>
                <For each={docHistory()}>
                  {(version) => (
                    <div
                      class="flex flex-row p-[var(--spacing-sm)] border-b border-border cursor-pointer gap-[var(--spacing-sm)] items-center hover:bg-bg-hover"
                      onClick={() => selectVersion(version)}
                    >
                      <span class={`px-[var(--spacing-xs)] py-0.5 rounded-sm text-[10px] font-semibold ${opBadgeClasses[version.operation]}`}>
                        {version.operation}
                      </span>
                      <span class="text-[11px] text-text-muted font-mono">
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
              <div class="flex-1 overflow-auto p-0">
                <JsonViewer theme={theme} data={selectedDoc()?.data} collapsed={false} />
              </div>
            }>
              {(diff) => (
                <div class="flex-1 overflow-auto p-0">
                  <div class="p-[var(--spacing-sm)] bg-bg-secondary text-[11px]">
                    <span class="text-accent">{selectedDoc()?.id}</span>
                    {" vs "}
                    <span class="text-warning">{compareDoc()?.id}</span>
                    {diff().equal && <span class="text-success"> (identical)</span>}
                  </div>
                  <JsonDiff theme={theme} changes={diff().changes} />
                </div>
              )}
            </Show>
          </Show>
        </div>
      </Show>

      <Show when={isEditing() || isInserting()}>
        <div class="absolute inset-0 bg-black/70 flex items-center justify-center z-[100]">
          <div class="flex flex-col w-[500px] max-h-[80%] bg-bg rounded-[var(--radius)] border border-border overflow-hidden">
            <div class="flex flex-row justify-between p-[var(--spacing-md)] border-b border-border items-center">
              <span class="font-semibold text-sm">
                {isInserting() ? "New Document" : `Edit: ${selectedDoc()?.id}`}
              </span>
              <Button theme={theme} size="sm" onClick={cancelEdit}>×</Button>
            </div>
            <div class="flex flex-col p-[var(--spacing-md)] gap-[var(--spacing-md)]">
              <Show when={editError()}>
                <div class="text-error bg-error/10 p-[var(--spacing-sm)] rounded-[var(--radius)] text-xs">
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
              <div class="flex flex-row gap-[var(--spacing-sm)] justify-end">
                <Button theme={theme} onClick={cancelEdit}>Cancel</Button>
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
