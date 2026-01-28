import { createEffect, createSignal, For, Show, type JSX } from "solid-js";
import type { RxdbDebugger, ExportData, ImportResult } from "@rxdb-debugger/core";
import { css, flex, scrollable } from "../../styles/css.js";
import type { Theme } from "../../styles/theme.js";
import { Button } from "../shared/Button.js";

export interface ExportPanelProps {
  theme: Theme;
  debugger: RxdbDebugger;
  allowMutations: boolean;
}

export function ExportPanel(props: ExportPanelProps) {
  const [collections, setCollections] = createSignal<string[]>([]);
  const [selectedCollection, setSelectedCollection] = createSignal<string>("");
  const [isExporting, setIsExporting] = createSignal(false);
  const [isImporting, setIsImporting] = createSignal(false);
  const [importResult, setImportResult] = createSignal<ImportResult | null>(null);
  const [importError, setImportError] = createSignal<string | null>(null);
  const [importPreview, setImportPreview] = createSignal<ExportData | null>(null);
  const [importJson, setImportJson] = createSignal<string>("");

  createEffect(() => {
    props.debugger.catalog.collectionNames().get().then((names) => {
      setCollections(names);
      const first = names[0];
      if (first && !selectedCollection()) {
        setSelectedCollection(first);
      }
    });
  });

  const exportCollection = async () => {
    const collection = selectedCollection();
    if (!collection) return;

    setIsExporting(true);
    try {
      await props.debugger.export.downloadCollection(collection);
    } finally {
      setIsExporting(false);
    }
  };

  const exportDatabase = async () => {
    setIsExporting(true);
    try {
      await props.debugger.export.downloadDatabase();
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const json = reader.result as string;
      setImportJson(json);
      const parsed = props.debugger.export.parseExport(json);
      if ("error" in parsed) {
        setImportError(parsed.error);
        setImportPreview(null);
      } else {
        setImportError(null);
        setImportPreview(parsed);
      }
    };
    reader.readAsText(file);
  };

  const importData = async () => {
    const preview = importPreview();
    if (!preview) return;

    setIsImporting(true);
    setImportResult(null);
    setImportError(null);

    try {
      const results = await props.debugger.export.importDatabase(importJson(), { upsert: true });
      const combined: ImportResult = {
        inserted: 0,
        updated: 0,
        failed: 0,
        errors: [],
      };
      for (const result of Object.values(results)) {
        combined.inserted += result.inserted;
        combined.updated += result.updated;
        combined.failed += result.failed;
        combined.errors.push(...result.errors);
      }
      setImportResult(combined);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
    }
  };

  const clearImport = () => {
    setImportJson("");
    setImportPreview(null);
    setImportResult(null);
    setImportError(null);
  };

  const { theme } = props;

  const containerStyle = css(flex.col, {
    height: "100%",
    overflow: "hidden",
    padding: theme.sizing.spacing.lg,
  });

  const sectionStyle = css({
    "margin-bottom": theme.sizing.spacing.xl,
    padding: theme.sizing.spacing.lg,
    background: theme.colors.bgSecondary,
    "border-radius": theme.sizing.borderRadius,
  });

  const sectionTitleStyle = css({
    "font-weight": "600",
    "font-size": "14px",
    "margin-bottom": theme.sizing.spacing.md,
    color: theme.colors.text,
  });

  const rowStyle = css(flex.row, {
    gap: theme.sizing.spacing.md,
    "align-items": "center",
    "margin-bottom": theme.sizing.spacing.md,
  });

  const selectStyle = css({
    padding: `${theme.sizing.spacing.sm} ${theme.sizing.spacing.md}`,
    background: theme.colors.bg,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    "border-radius": theme.sizing.borderRadius,
    "font-size": "13px",
    "min-width": "200px",
  });

  const fileInputStyle = css({
    display: "none",
  });

  const fileButtonStyle = css({
    padding: `${theme.sizing.spacing.sm} ${theme.sizing.spacing.md}`,
    background: theme.colors.bg,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    "border-radius": theme.sizing.borderRadius,
    cursor: "pointer",
    "font-size": "13px",
  });

  const previewStyle = css({
    padding: theme.sizing.spacing.md,
    background: theme.colors.bg,
    "border-radius": theme.sizing.borderRadius,
    "font-family": theme.fonts.mono,
    "font-size": "12px",
    "margin-top": theme.sizing.spacing.md,
  });

  const resultStyle = (success: boolean): JSX.CSSProperties =>
    css({
      padding: theme.sizing.spacing.md,
      background: success ? `${theme.colors.success}20` : `${theme.colors.error}20`,
      color: success ? theme.colors.success : theme.colors.error,
      "border-radius": theme.sizing.borderRadius,
      "font-size": "13px",
      "margin-top": theme.sizing.spacing.md,
    });

  const warningStyle = css({
    padding: theme.sizing.spacing.md,
    background: `${theme.colors.warning}20`,
    color: theme.colors.warning,
    "border-radius": theme.sizing.borderRadius,
    "font-size": "12px",
    "margin-bottom": theme.sizing.spacing.md,
  });

  return (
    <div style={css(containerStyle, scrollable)}>
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Export Data</div>
        <div style={rowStyle}>
          <select
            style={selectStyle}
            value={selectedCollection()}
            onChange={(e) => setSelectedCollection(e.currentTarget.value)}
          >
            <For each={collections()}>
              {(name) => <option value={name}>{name}</option>}
            </For>
          </select>
          <Button theme={theme} variant="primary" onClick={exportCollection} disabled={isExporting()}>
            {isExporting() ? "Exporting..." : "Export Collection"}
          </Button>
        </div>
        <div style={rowStyle}>
          <Button theme={theme} onClick={exportDatabase} disabled={isExporting()}>
            Export Entire Database
          </Button>
        </div>
      </div>

      <Show when={props.allowMutations} fallback={
        <div style={warningStyle}>
          Import is disabled. Enable mutations in debugger options to import data.
        </div>
      }>
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Import Data</div>
          <div style={rowStyle}>
            <label style={fileButtonStyle}>
              Choose File
              <input
                type="file"
                accept=".json"
                style={fileInputStyle}
                onChange={handleFileSelect}
              />
            </label>
            <Show when={importPreview()}>
              <Button theme={theme} onClick={clearImport}>
                Clear
              </Button>
            </Show>
          </div>

          <Show when={importError()}>
            <div style={resultStyle(false)}>{importError()}</div>
          </Show>

          <Show when={importPreview()}>
            {(preview) => (
              <>
                <div style={previewStyle}>
                  <div style={{ "margin-bottom": theme.sizing.spacing.sm }}>
                    <strong>Database:</strong> {preview().database}
                  </div>
                  <div style={{ "margin-bottom": theme.sizing.spacing.sm }}>
                    <strong>Exported:</strong> {preview().exportedAt}
                  </div>
                  <div style={{ "margin-bottom": theme.sizing.spacing.sm }}>
                    <strong>Collections:</strong>
                  </div>
                  <For each={Object.entries(preview().collections)}>
                    {([name, data]) => (
                      <div style={{ "padding-left": theme.sizing.spacing.md }}>
                        {name}: {data.count} documents (v{data.schemaVersion})
                      </div>
                    )}
                  </For>
                </div>
                <div style={css(rowStyle, { "margin-top": theme.sizing.spacing.md })}>
                  <Button theme={theme} variant="primary" onClick={importData} disabled={isImporting()}>
                    {isImporting() ? "Importing..." : "Import Data"}
                  </Button>
                </div>
              </>
            )}
          </Show>

          <Show when={importResult()}>
            {(result) => (
              <div style={resultStyle(result().failed === 0)}>
                <div>Inserted: {result().inserted}</div>
                <div>Updated: {result().updated}</div>
                <Show when={result().failed > 0}>
                  <div>Failed: {result().failed}</div>
                  <For each={result().errors.slice(0, 5)}>
                    {(err) => (
                      <div style={{ "font-size": "11px", "margin-top": "4px" }}>
                        {err.id}: {err.error}
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            )}
          </Show>
        </div>
      </Show>
    </div>
  );
}
