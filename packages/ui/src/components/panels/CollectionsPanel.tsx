import { createEffect, createSignal, For, onCleanup, Show, type JSX } from "solid-js";
import type { CollectionInfo, RxdbDebugger, PropertyInfo, SchemaDetails } from "@rxdb-debugger/core";
import { css, ellipsis, flex, scrollable } from "../../styles/css.js";
import type { Theme } from "../../styles/theme.js";

export interface CollectionsPanelProps {
  theme: Theme;
  debugger: RxdbDebugger;
}

export function CollectionsPanel(props: CollectionsPanelProps) {
  const [collections, setCollections] = createSignal<CollectionInfo[]>([]);
  const [selectedCollection, setSelectedCollection] = createSignal<string | null>(null);
  const [schema, setSchema] = createSignal<SchemaDetails | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);

  createEffect(() => {
    const sub = props.debugger.catalog
      .collections({ live: true })
      .observe()
      .subscribe({
        next: (cols) => {
          setCollections(cols);
          setIsLoading(false);
        },
        error: () => setIsLoading(false),
      });

    onCleanup(() => sub.unsubscribe());
  });

  createEffect(() => {
    const name = selectedCollection();
    if (!name) {
      setSchema(null);
      return;
    }
    props.debugger.schema.getSchema(name).get().then(setSchema);
  });

  const { theme } = props;

  const containerStyle = css(flex.row, {
    height: "100%",
    overflow: "hidden",
  });

  const listStyle = css(flex.col, {
    width: "240px",
    "flex-shrink": "0",
    "border-right": `1px solid ${theme.colors.border}`,
    overflow: "hidden",
  });

  const listHeaderStyle = css({
    padding: theme.sizing.spacing.md,
    "font-weight": "600",
    "font-size": "11px",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: theme.colors.textMuted,
    "border-bottom": `1px solid ${theme.colors.border}`,
  });

  const listContentStyle = css(scrollable, {
    flex: "1",
    padding: theme.sizing.spacing.xs,
  });

  const itemStyle = (isSelected: boolean): JSX.CSSProperties =>
    css(flex.row, {
      padding: `${theme.sizing.spacing.sm} ${theme.sizing.spacing.md}`,
      "border-radius": theme.sizing.borderRadius,
      cursor: "pointer",
      background: isSelected ? theme.colors.bgSelected : "transparent",
      "margin-bottom": "2px",
    });

  const itemNameStyle = css(ellipsis, {
    flex: "1",
    "font-weight": "500",
    "font-size": "13px",
  });

  const itemCountStyle = css({
    "font-size": "11px",
    color: theme.colors.textMuted,
    "font-family": theme.fonts.mono,
  });

  const detailStyle = css(flex.col, scrollable, {
    flex: "1",
    padding: theme.sizing.spacing.md,
  });

  const sectionStyle = css({
    "margin-bottom": theme.sizing.spacing.lg,
  });

  const sectionTitleStyle = css({
    "font-weight": "600",
    "font-size": "12px",
    "margin-bottom": theme.sizing.spacing.sm,
    color: theme.colors.text,
  });

  const propertyRowStyle = css(flex.row, {
    padding: `${theme.sizing.spacing.xs} 0`,
    "font-size": "12px",
    "border-bottom": `1px solid ${theme.colors.border}`,
  });

  const propertyNameStyle = css({
    width: "140px",
    "flex-shrink": "0",
    "font-family": theme.fonts.mono,
    color: theme.colors.accent,
  });

  const propertyTypeStyle = css({
    width: "80px",
    "flex-shrink": "0",
    color: theme.colors.textSecondary,
  });

  const propertyInfoStyle = css({
    flex: "1",
    color: theme.colors.textMuted,
    "font-size": "11px",
  });

  const indexStyle = css({
    padding: `${theme.sizing.spacing.xs} ${theme.sizing.spacing.sm}`,
    background: theme.colors.bgSecondary,
    "border-radius": theme.sizing.borderRadius,
    "font-family": theme.fonts.mono,
    "font-size": "11px",
    "margin-right": theme.sizing.spacing.xs,
    "margin-bottom": theme.sizing.spacing.xs,
    display: "inline-block",
  });

  const formatCount = (count: number): string => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return String(count);
  };

  const getPropertyConstraints = (prop: PropertyInfo): string => {
    const constraints: string[] = [];
    if (prop.required) constraints.push("required");
    if (prop.maxLength) constraints.push(`max: ${prop.maxLength}`);
    if (prop.minimum !== undefined) constraints.push(`min: ${prop.minimum}`);
    if (prop.maximum !== undefined) constraints.push(`max: ${prop.maximum}`);
    if (prop.pattern) constraints.push("pattern");
    if (prop.enum) constraints.push(`enum(${prop.enum.length})`);
    if (prop.ref) constraints.push(`ref: ${prop.ref}`);
    return constraints.join(", ");
  };

  return (
    <div style={containerStyle}>
      <div style={listStyle}>
        <div style={listHeaderStyle}>Collections</div>
        <div style={listContentStyle}>
          <Show when={isLoading()}>
            <div style={{ padding: theme.sizing.spacing.md, color: theme.colors.textMuted }}>
              Loading...
            </div>
          </Show>
          <For each={collections()}>
            {(col) => {
              const isSelected = () => selectedCollection() === col.name;
              return (
                <div
                  style={itemStyle(isSelected())}
                  onClick={() => setSelectedCollection(col.name)}
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
                  <span style={itemNameStyle}>{col.name}</span>
                  <span style={itemCountStyle}>{formatCount(col.count)}</span>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      <div style={detailStyle}>
        <Show when={schema()} fallback={
          <div style={{ color: theme.colors.textMuted }}>
            Select a collection to view its schema
          </div>
        }>
          {(s) => (
            <>
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>
                  {s().name} (v{s().version})
                </div>
                <div style={{ "font-size": "12px", color: theme.colors.textSecondary }}>
                  Primary key: <span style={{ "font-family": theme.fonts.mono }}>{s().primaryKey}</span>
                </div>
              </div>

              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Properties ({s().properties.length})</div>
                <For each={s().properties}>
                  {(prop) => (
                    <div style={propertyRowStyle}>
                      <span style={propertyNameStyle}>{prop.name}</span>
                      <span style={propertyTypeStyle}>{prop.type}</span>
                      <span style={propertyInfoStyle}>{getPropertyConstraints(prop)}</span>
                    </div>
                  )}
                </For>
              </div>

              <Show when={s().indexes.length > 0}>
                <div style={sectionStyle}>
                  <div style={sectionTitleStyle}>Indexes ({s().indexes.length})</div>
                  <div>
                    <For each={s().indexes}>
                      {(idx) => (
                        <span style={indexStyle}>
                          {idx.fields.join(" + ")}
                          {idx.compound && " (compound)"}
                        </span>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </>
          )}
        </Show>
      </div>
    </div>
  );
}
