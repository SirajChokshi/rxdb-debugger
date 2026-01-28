import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import type { CollectionInfo } from "../../catalog.js";
import type { RxdbExplorer } from "../../core.js";
import type { DocumentResult } from "../../documents.js";
import { css, flex, resetStyles, scrollable } from "../styles/css.js";
import type { Theme } from "../styles/theme.js";
import { CollectionList } from "./CollectionList.js";
import { DocumentBrowser } from "./DocumentBrowser.js";
import { DocumentDetail } from "./DocumentDetail.js";

export interface ExplorerProps {
  explorer: RxdbExplorer;
  theme: Theme;
  width: string;
  height: string;
}

export function Explorer(props: ExplorerProps) {
  const [collections, setCollections] = createSignal<CollectionInfo[]>([]);
  const [selectedCollection, setSelectedCollection] = createSignal<
    string | null
  >(null);
  const [selectedDocument, setSelectedDocument] =
    createSignal<DocumentResult | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Load collections on mount
  createEffect(() => {
    const subscription = props.explorer.catalog
      .collections({ live: true })
      .observe()
      .subscribe({
        next: (cols) => {
          setCollections(cols);
          setIsLoading(false);
          // Auto-select first collection if none selected
          const firstCol = cols[0];
          if (!selectedCollection() && firstCol) {
            setSelectedCollection(firstCol.name);
          }
        },
        error: (err) => {
          setError(err.message || "Failed to load collections");
          setIsLoading(false);
        },
      });

    onCleanup(() => subscription.unsubscribe());
  });

  const handleSelectCollection = (name: string) => {
    setSelectedCollection(name);
    setSelectedDocument(null);
  };

  const handleSelectDocument = (doc: DocumentResult) => {
    setSelectedDocument(doc);
  };

  const handleCloseDetail = () => {
    setSelectedDocument(null);
  };

  const { theme } = props;

  const containerStyle = css(resetStyles, {
    width: props.width,
    height: props.height,
    display: "grid",
    "grid-template-columns": "220px 1fr",
    "grid-template-rows": "1fr",
    background: theme.colors.bg,
    color: theme.colors.text,
    "font-family": theme.fonts.sans,
    "font-size": "13px",
    "line-height": "1.5",
    "border-radius": theme.sizing.borderRadius,
    overflow: "hidden",
    border: `1px solid ${theme.colors.border}`,
  });

  const mainAreaStyle = css(flex.row, {
    "min-width": "0",
    overflow: "hidden",
  });

  return (
    <div style={containerStyle}>
      <CollectionList
        theme={theme}
        collections={collections()}
        selectedCollection={selectedCollection()}
        onSelect={handleSelectCollection}
        isLoading={isLoading()}
        error={error()}
      />
      <div style={mainAreaStyle}>
        <Show when={selectedCollection()}>
          {(collName) => (
            <>
              <DocumentBrowser
                theme={theme}
                explorer={props.explorer}
                collectionName={collName()}
                selectedDocId={selectedDocument()?.id ?? null}
                onSelectDocument={handleSelectDocument}
              />
              <Show when={selectedDocument()}>
                {(doc) => (
                  <DocumentDetail
                    theme={theme}
                    document={doc()}
                    onClose={handleCloseDetail}
                  />
                )}
              </Show>
            </>
          )}
        </Show>
        <Show when={!selectedCollection() && !isLoading()}>
          <div
            style={css(flex.col, flex.center, {
              flex: "1",
              color: theme.colors.textMuted,
            })}
          >
            Select a collection to browse documents
          </div>
        </Show>
      </div>
    </div>
  );
}
