import { createEffect, createSignal, For, onCleanup, Show, type JSX } from "solid-js";
import type { RxdbDebugger, DiffResult, DocumentResult } from "@rxdb-debugger/core";
import { css, ellipsis, flex, scrollable } from "../../styles/css.js";
import type { Theme } from "../../styles/theme.js";
import { Button } from "../shared/Button.js";
import { JsonDiff } from "../shared/JsonDiff.js";

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
    const collection = selectedCollection();
    if (!collection) return;

    setIsLoading(true);
    setDocuments([]);
    setSelectedDoc(null);
    setCompareDoc(null);
    setDiffResult(null);

    const countSub = props.debugger.documents
      .count(collection, { live: true })
      .observe()
      .subscribe({ next: setTotalCount });

    const docsSub = props.debugger.documents
      .list(collection, { limit: PAGE_SIZE, live: true })
      .observe()
      .subscribe({
        next: (docs) => {
          setDocuments(docs);
          setIsLoading(false);
        },
        error: () => setIsLoading(false),
      });

    onCleanup(() => {
      countSub.unsubscribe();
      docsSub.unsubscribe();
    });
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

  const { theme } = props;

  const containerStyle = css(flex.row, {
    height: "100%",
    overflow: "hidden",
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

  const detailStyle = css(flex.col, {
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
        </div>
      </div>

      <Show when={selectedDoc() || diffResult()}>
        <div style={detailStyle}>
          <div style={detailHeaderStyle}>
            <span style={{ "font-weight": "600", "font-size": "12px", "font-family": theme.fonts.mono }}>
              {diffResult() ? "Document Comparison" : selectedDoc()?.id}
            </span>
            <div style={css(flex.row, { gap: theme.sizing.spacing.xs })}>
              <Show when={props.allowMutations && selectedDoc() && !diffResult()}>
                <Button theme={theme} size="sm" variant="danger" onClick={deleteDocument}>
                  Delete
                </Button>
              </Show>
              <Button theme={theme} size="sm" onClick={() => { setSelectedDoc(null); setCompareDoc(null); setDiffResult(null); }}>
                ×
              </Button>
            </div>
          </div>
          <Show when={diffResult()} fallback={
            <div style={detailContentStyle}>
              {JSON.stringify(selectedDoc()?.data, null, 2)}
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
        </div>
      </Show>
    </div>
  );
}
