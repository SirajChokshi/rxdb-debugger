import { createEffect, createSignal, For, onCleanup, Show, type JSX } from "solid-js";
import type { CollectionInfo, RxdbDebugger, PropertyInfo, SchemaDetails, Relationship } from "@rxdb-debugger/core";
import { css, ellipsis, flex, scrollable } from "../../styles/css.js";
import type { Theme } from "../../styles/theme.js";

export interface CollectionsPanelProps {
  theme: Theme;
  debugger: RxdbDebugger;
}

interface PropertyTreeProps {
  properties: PropertyInfo[];
  depth: number;
  theme: Theme;
}

function PropertyTree(props: PropertyTreeProps) {
  const { theme, depth } = props;
  const [expandedProps, setExpandedProps] = createSignal<Set<string>>(new Set());

  const toggleExpanded = (path: string) => {
    setExpandedProps((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const hasNestedContent = (prop: PropertyInfo): boolean => {
    return !!(prop.properties?.length || prop.items || prop.enum?.length);
  };

  const formatConstraints = (prop: PropertyInfo): string => {
    const parts: string[] = [];
    if (prop.required) parts.push("required");
    if (prop.maxLength) parts.push(`max: ${prop.maxLength}`);
    if (prop.minimum !== undefined) parts.push(`min: ${prop.minimum}`);
    if (prop.maximum !== undefined) parts.push(`max: ${prop.maximum}`);
    if (prop.pattern) parts.push("pattern");
    if (prop.ref) parts.push(`→ ${prop.ref}`);
    return parts.join(", ");
  };

  const propertyRowStyle = css(flex.row, {
    padding: `${theme.sizing.spacing.xs} 0`,
    "font-size": "12px",
    "border-bottom": `1px solid ${theme.colors.border}`,
    "align-items": "flex-start",
  });

  const propertyNameStyle = css({
    width: "140px",
    "flex-shrink": "0",
    "font-family": theme.fonts.mono,
    color: theme.colors.accent,
    display: "flex",
    "align-items": "center",
    gap: theme.sizing.spacing.xs,
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

  const expandButtonStyle = css({
    background: "transparent",
    border: "none",
    color: theme.colors.textMuted,
    cursor: "pointer",
    padding: "0",
    "font-size": "10px",
    width: "14px",
    "text-align": "center",
  });

  const nestedContainerStyle = css({
    "padding-left": theme.sizing.spacing.md,
    "border-left": `1px solid ${theme.colors.border}`,
    "margin-left": theme.sizing.spacing.sm,
  });

  const enumListStyle = css({
    "font-size": "11px",
    color: theme.colors.textMuted,
    "padding-left": theme.sizing.spacing.md,
    "margin-top": theme.sizing.spacing.xs,
  });

  return (
    <For each={props.properties}>
      {(prop) => {
        const isExpanded = () => expandedProps().has(prop.path);
        const hasNested = hasNestedContent(prop);
        return (
          <>
            <div style={propertyRowStyle}>
              <span style={css(propertyNameStyle, { "padding-left": `${depth * 12}px` })}>
                <Show when={hasNested}>
                  <button style={expandButtonStyle} onClick={() => toggleExpanded(prop.path)}>
                    {isExpanded() ? "▼" : "▶"}
                  </button>
                </Show>
                <Show when={!hasNested}>
                  <span style={{ width: "14px" }} />
                </Show>
                {prop.name}
              </span>
              <span style={propertyTypeStyle}>
                {prop.type}
                <Show when={prop.items}>
                  {"<"}{prop.items!.type}{">"}
                </Show>
              </span>
              <span style={propertyInfoStyle}>
                {formatConstraints(prop)}
                <Show when={prop.enum && !isExpanded()}>
                  <span style={{ color: theme.colors.warning }}> enum({prop.enum!.length})</span>
                </Show>
              </span>
            </div>
            <Show when={isExpanded()}>
              <Show when={prop.enum}>
                <div style={enumListStyle}>
                  <For each={prop.enum}>
                    {(v) => (
                      <div style={{ padding: "2px 0" }}>
                        <span style={{ color: theme.colors.success }}>{JSON.stringify(v)}</span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={prop.properties}>
                <div style={nestedContainerStyle}>
                  <PropertyTree properties={prop.properties!} depth={depth + 1} theme={theme} />
                </div>
              </Show>
              <Show when={prop.items?.properties}>
                <div style={nestedContainerStyle}>
                  <div style={{ "font-size": "10px", color: theme.colors.textMuted, "margin-bottom": theme.sizing.spacing.xs }}>
                    Array items:
                  </div>
                  <PropertyTree properties={prop.items!.properties!} depth={depth + 1} theme={theme} />
                </div>
              </Show>
            </Show>
          </>
        );
      }}
    </For>
  );
}

export function CollectionsPanel(props: CollectionsPanelProps) {
  const [collections, setCollections] = createSignal<CollectionInfo[]>([]);
  const [selectedCollection, setSelectedCollection] = createSignal<string | null>(null);
  const [schema, setSchema] = createSignal<SchemaDetails | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [schemaLoading, setSchemaLoading] = createSignal(false);
  const [schemaError, setSchemaError] = createSignal<string | null>(null);
  const [relationships, setRelationships] = createSignal<Relationship[]>([]);
  const [isMobile, setIsMobile] = createSignal(false);

  createEffect(() => {
    const checkWidth = () => setIsMobile(window.innerWidth < props.theme.breakpoints.tablet);
    checkWidth();
    window.addEventListener("resize", checkWidth);
    onCleanup(() => window.removeEventListener("resize", checkWidth));
  });

  createEffect(() => {
    const sub = props.debugger.catalog
      .collections({ live: true })
      .observe()
      .subscribe({
        next: (cols) => {
          setCollections(cols);
          setIsLoading(false);
          setError(null);
        },
        error: (err) => {
          setIsLoading(false);
          setError(err instanceof Error ? err.message : "Failed to load collections");
        },
      });

    onCleanup(() => sub.unsubscribe());
  });

  createEffect(() => {
    const name = selectedCollection();
    if (!name) {
      setSchema(null);
      setSchemaError(null);
      return;
    }
    setSchemaLoading(true);
    setSchemaError(null);
    props.debugger.schema.getSchema(name).get()
      .then((s) => {
        setSchema(s);
        setSchemaLoading(false);
      })
      .catch((err) => {
        setSchemaError(err instanceof Error ? err.message : "Failed to load schema");
        setSchemaLoading(false);
      });
  });

  createEffect(() => {
    props.debugger.schema.getRelationships().get()
      .then(setRelationships)
      .catch(() => setRelationships([]));
  });

  const { theme } = props;

  const containerStyle = css(isMobile() ? flex.col : flex.row, {
    height: "100%",
    overflow: "hidden",
  });

  const listStyle = css(flex.col, {
    width: isMobile() ? "100%" : "240px",
    "max-height": isMobile() ? "40%" : "100%",
    "flex-shrink": "0",
    "border-right": isMobile() ? "none" : `1px solid ${theme.colors.border}`,
    "border-bottom": isMobile() ? `1px solid ${theme.colors.border}` : "none",
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
          <Show when={error()}>
            <div style={{ padding: theme.sizing.spacing.md, color: theme.colors.error, background: `${theme.colors.error}15`, "border-radius": theme.sizing.borderRadius }}>
              {error()}
            </div>
          </Show>
          <Show when={!isLoading() && !error() && collections().length === 0}>
            <div style={{ padding: theme.sizing.spacing.md, color: theme.colors.textMuted, "text-align": "center" }}>
              No collections found
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
        <Show when={schemaLoading()}>
          <div style={{ color: theme.colors.textMuted }}>
            Loading schema...
          </div>
        </Show>
        <Show when={schemaError()}>
          <div style={{ color: theme.colors.error, background: `${theme.colors.error}15`, padding: theme.sizing.spacing.md, "border-radius": theme.sizing.borderRadius }}>
            {schemaError()}
          </div>
        </Show>
        <Show when={!schemaLoading() && !schemaError() && !schema() && !selectedCollection()}>
          <div style={{ color: theme.colors.textMuted }}>
            Select a collection to view its schema
          </div>
        </Show>
        <Show when={schema()}>
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
                <PropertyTree properties={s().properties} depth={0} theme={theme} />
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

              {(() => {
                const collName = s().name;
                const outgoing = relationships().filter(r => r.from.collection === collName);
                const incoming = relationships().filter(r => r.to.collection === collName);
                const hasRelations = outgoing.length > 0 || incoming.length > 0;
                return (
                  <Show when={hasRelations}>
                    <div style={sectionStyle}>
                      <div style={sectionTitleStyle}>Relationships</div>
                      <Show when={outgoing.length > 0}>
                        <div style={{ "margin-bottom": theme.sizing.spacing.sm }}>
                          <div style={{ "font-size": "11px", color: theme.colors.textMuted, "margin-bottom": theme.sizing.spacing.xs }}>
                            References
                          </div>
                          <For each={outgoing}>
                            {(rel) => (
                              <div style={{ "font-size": "12px", padding: `${theme.sizing.spacing.xs} 0` }}>
                                <span style={{ "font-family": theme.fonts.mono, color: theme.colors.accent }}>{rel.from.field}</span>
                                <span style={{ color: theme.colors.textMuted }}> → </span>
                                <span style={{ color: theme.colors.success }}>{rel.to.collection}</span>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                      <Show when={incoming.length > 0}>
                        <div>
                          <div style={{ "font-size": "11px", color: theme.colors.textMuted, "margin-bottom": theme.sizing.spacing.xs }}>
                            Referenced by
                          </div>
                          <For each={incoming}>
                            {(rel) => (
                              <div style={{ "font-size": "12px", padding: `${theme.sizing.spacing.xs} 0` }}>
                                <span style={{ color: theme.colors.warning }}>{rel.from.collection}</span>
                                <span style={{ color: theme.colors.textMuted }}>.</span>
                                <span style={{ "font-family": theme.fonts.mono, color: theme.colors.accent }}>{rel.from.field}</span>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  </Show>
                );
              })()}
            </>
          )}
        </Show>
      </div>
    </div>
  );
}
