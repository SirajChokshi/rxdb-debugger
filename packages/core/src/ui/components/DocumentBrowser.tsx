import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import type { RxdbExplorer } from "../../core.js";
import type { DocumentResult } from "../../documents.js";
import { css, ellipsis, flex, scrollable } from "../styles/css.js";
import type { Theme } from "../styles/theme.js";

export interface DocumentBrowserProps {
  theme: Theme;
  explorer: RxdbExplorer;
  collectionName: string;
  selectedDocId: string | null;
  onSelectDocument: (doc: DocumentResult) => void;
}

const PAGE_SIZE = 50;

export function DocumentBrowser(props: DocumentBrowserProps) {
  const [documents, setDocuments] = createSignal<DocumentResult[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [totalCount, setTotalCount] = createSignal(0);

  // Load documents when collection changes
  createEffect(() => {
    const collectionName = props.collectionName;
    setIsLoading(true);
    setError(null);
    setDocuments([]);

    // Get count
    const countSub = props.explorer.documents
      .count(collectionName, { live: true })
      .observe()
      .subscribe({
        next: setTotalCount,
        error: () => {},
      });

    // Get documents
    const docsSub = props.explorer.documents
      .list(collectionName, { limit: PAGE_SIZE, live: true })
      .observe()
      .subscribe({
        next: (docs) => {
          setDocuments(docs);
          setIsLoading(false);
        },
        error: (err) => {
          setError(err.message || "Failed to load documents");
          setIsLoading(false);
        },
      });

    onCleanup(() => {
      countSub.unsubscribe();
      docsSub.unsubscribe();
    });
  });

  const { theme } = props;

  const containerStyle = css(flex.col, {
    flex: "1",
    "min-width": "0",
    overflow: "hidden",
    background: theme.colors.bg,
  });

  const headerStyle = css(flex.row, flex.between, {
    padding: theme.sizing.spacing.md,
    "border-bottom": `1px solid ${theme.colors.border}`,
    "flex-shrink": "0",
    "align-items": "center",
  });

  const titleStyle = css({
    "font-weight": "600",
    "font-size": "14px",
  });

  const countStyle = css({
    "font-size": "12px",
    color: theme.colors.textMuted,
    "font-family": theme.fonts.mono,
  });

  const listStyle = css(flex.col, scrollable, {
    flex: "1",
  });

  const rowStyle = (isSelected: boolean) =>
    css(flex.row, {
      padding: `${theme.sizing.spacing.sm} ${theme.sizing.spacing.md}`,
      "border-bottom": `1px solid ${theme.colors.border}`,
      cursor: "pointer",
      background: isSelected ? theme.colors.bgSelected : "transparent",
      transition: "background 0.1s ease",
      gap: theme.sizing.spacing.md,
    });

  const idCellStyle = css(ellipsis, {
    width: "160px",
    "flex-shrink": "0",
    "font-family": theme.fonts.mono,
    "font-size": "12px",
    color: theme.colors.accent,
  });

  const previewCellStyle = css(ellipsis, {
    flex: "1",
    color: theme.colors.textSecondary,
    "font-size": "12px",
  });

  const loadingStyle = css(flex.col, flex.center, {
    flex: "1",
    color: theme.colors.textMuted,
    "font-size": "12px",
  });

  const errorStyle = css({
    padding: theme.sizing.spacing.md,
    color: theme.colors.error,
    "font-size": "12px",
  });

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>{props.collectionName}</span>
        <span style={countStyle}>
          {documents().length} / {totalCount()} documents
        </span>
      </div>

      <Show when={error()}>
        <div style={errorStyle}>{error()}</div>
      </Show>

      <Show when={isLoading()}>
        <div style={loadingStyle}>Loading documents...</div>
      </Show>

      <Show when={!isLoading() && !error()}>
        <div style={listStyle}>
          <For each={documents()}>
            {(doc) => {
              const isSelected = () => props.selectedDocId === doc.id;
              return (
                <div
                  style={rowStyle(isSelected())}
                  onClick={() => props.onSelectDocument(doc)}
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
                  <span style={idCellStyle}>{doc.id}</span>
                  <span style={previewCellStyle}>
                    {getDocPreview(doc.data)}
                  </span>
                </div>
              );
            }}
          </For>
          <Show when={documents().length === 0}>
            <div style={loadingStyle}>No documents in this collection</div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

function getDocPreview(data: Record<string, unknown>): string {
  const keys = Object.keys(data).slice(0, 5);
  const pairs = keys.map((k) => {
    const v = data[k];
    const preview = typeof v === "string" ? v.slice(0, 30) : JSON.stringify(v);
    return `${k}: ${preview}`;
  });
  return pairs.join(" | ");
}
