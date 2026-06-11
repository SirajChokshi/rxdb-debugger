import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import type { RxdbDebugger, CollectionInfo, PropertyInfo, SchemaDetails, Relationship } from "@rxdb-debugger/core";
import type { Theme } from "../../styles/theme.js";
import { fromExplorerQuery } from "../../utils/observable.js";
import { Resizable } from "../shared/Resizable.js";

export interface CollectionsPanelProps {
  theme: Theme;
  debugger: RxdbDebugger;
}

interface PropertyTreeProps {
  properties: PropertyInfo[];
  depth: number;
}

function PropertyTree(props: PropertyTreeProps) {
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

  return (
    <For each={props.properties}>
      {(prop) => {
        const isExpanded = () => expandedProps().has(prop.path);
        const hasNested = hasNestedContent(prop);
        return (
          <>
            <div class="flex flex-row py-[var(--spacing-xs)] text-xs border-b border-border items-start">
              <span
                class="w-[140px] shrink-0 font-mono text-accent flex items-center gap-[var(--spacing-xs)]"
                style={{ "padding-left": `${props.depth * 12}px` }}
              >
                <Show when={hasNested}>
                  <button
                    class="bg-transparent border-none text-text-muted cursor-pointer p-0 text-[10px] w-3.5 text-center"
                    onClick={() => toggleExpanded(prop.path)}
                  >
                    {isExpanded() ? "▼" : "▶"}
                  </button>
                </Show>
                <Show when={!hasNested}>
                  <span class="w-3.5" />
                </Show>
                {prop.name}
              </span>
              <span class="w-20 shrink-0 text-text-secondary">
                {prop.type}
                <Show when={prop.items}>
                  {"<"}{prop.items!.type}{">"}
                </Show>
              </span>
              <span class="flex-1 text-text-muted text-[11px]">
                {formatConstraints(prop)}
                <Show when={prop.enum && !isExpanded()}>
                  <span class="text-warning"> enum({prop.enum!.length})</span>
                </Show>
              </span>
            </div>
            <Show when={isExpanded()}>
              <Show when={prop.enum}>
                <div class="text-[11px] text-text-muted pl-[var(--spacing-md)] mt-[var(--spacing-xs)]">
                  <For each={prop.enum}>
                    {(v) => (
                      <div class="py-0.5">
                        <span class="text-success">{JSON.stringify(v)}</span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={prop.properties}>
                <div class="pl-[var(--spacing-md)] border-l border-border ml-[var(--spacing-sm)]">
                  <PropertyTree properties={prop.properties!} depth={props.depth + 1} />
                </div>
              </Show>
              <Show when={prop.items?.properties}>
                <div class="pl-[var(--spacing-md)] border-l border-border ml-[var(--spacing-sm)]">
                  <div class="text-[10px] text-text-muted mb-[var(--spacing-xs)]">Array items:</div>
                  <PropertyTree properties={prop.items!.properties!} depth={props.depth + 1} />
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
  const [selectedCollection, setSelectedCollection] = createSignal<string | null>(null);
  const [schema, setSchema] = createSignal<SchemaDetails | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [schemaLoading, setSchemaLoading] = createSignal(false);
  const [schemaError, setSchemaError] = createSignal<string | null>(null);
  const [relationships, setRelationships] = createSignal<Relationship[]>([]);
  const [isMobile, setIsMobile] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");

  // null = first emission pending. An empty array is a valid loaded state
  // (database without collections); treating it as "loading" made empty
  // databases show a spinner forever.
  const collections = fromExplorerQuery(
    props.debugger.catalog.collections({ live: true }),
    {
      initialValue: null as CollectionInfo[] | null,
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to load collections"),
    }
  );

  const loadedCollections = () => collections() ?? [];
  const isLoading = () => collections() === null && !error();

  const filteredCollections = () => {
    const q = searchQuery().toLowerCase();
    if (!q) return loadedCollections();
    return loadedCollections().filter(c => c.name.toLowerCase().includes(q));
  };

  createEffect(() => {
    const checkWidth = () => setIsMobile(window.innerWidth < props.theme.breakpoints.tablet);
    checkWidth();
    window.addEventListener("resize", checkWidth);
    onCleanup(() => window.removeEventListener("resize", checkWidth));
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

  const formatCount = (count: number): string => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return String(count);
  };

  const listContent = () => (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex flex-col p-[var(--spacing-md)] gap-[var(--spacing-sm)] border-b border-border">
        <span class="font-semibold text-[11px] uppercase tracking-wider text-text-muted">
          Collections
        </span>
        <input
          class="px-[var(--spacing-sm)] py-[var(--spacing-xs)] bg-bg-secondary text-text border border-border rounded-[var(--radius)] text-xs outline-none w-full"
          placeholder="Search collections..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
        />
      </div>
      <div class="flex-1 overflow-auto">
        <Show when={isLoading()}>
          <div class="p-[var(--spacing-md)] text-text-muted">Loading...</div>
        </Show>
        <Show when={error()}>
          <div class="p-[var(--spacing-md)] text-error bg-error/10">{error()}</div>
        </Show>
        <Show when={!isLoading() && !error() && loadedCollections().length === 0}>
          <div class="p-[var(--spacing-md)] text-text-muted text-center">No collections found</div>
        </Show>
        <Show when={!isLoading() && !error() && loadedCollections().length > 0 && filteredCollections().length === 0}>
          <div class="p-[var(--spacing-md)] text-text-muted text-center">No matching collections</div>
        </Show>
        <For each={filteredCollections()}>
          {(col) => {
            const isSelected = () => selectedCollection() === col.name;
            const itemClasses = () => {
              const base = "flex flex-row px-[var(--spacing-md)] py-[var(--spacing-sm)] border-b border-border cursor-pointer";
              return isSelected() ? `${base} bg-bg-selected` : `${base} hover:bg-bg-hover`;
            };
            return (
              <div class={itemClasses()} onClick={() => setSelectedCollection(col.name)}>
                <span class="flex-1 font-medium text-[13px] truncate">{col.name}</span>
                <span class="text-[11px] text-text-muted font-mono">{formatCount(col.count)}</span>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );

  const detailContent = () => (
    <div class="flex flex-col h-full overflow-auto p-[var(--spacing-md)]">
      <Show when={schemaLoading()}>
        <div class="text-text-muted">Loading schema...</div>
      </Show>
      <Show when={schemaError()}>
        <div class="text-error bg-error/10 p-[var(--spacing-md)] rounded-[var(--radius)]">{schemaError()}</div>
      </Show>
      <Show when={!schemaLoading() && !schemaError() && !schema() && !selectedCollection()}>
        <div class="text-text-muted">Select a collection to view its schema</div>
      </Show>
      <Show when={schema()}>
        {(s) => (
          <>
            <div class="block mb-[var(--spacing-lg)]">
              <div class="font-semibold text-xs mb-[var(--spacing-sm)] text-text">
                {s().name} (v{s().version})
              </div>
              <div class="text-xs text-text-secondary">
                Primary key: <span class="font-mono">{s().primaryKey}</span>
              </div>
            </div>

            <div class="block mb-[var(--spacing-lg)]">
              <div class="font-semibold text-xs mb-[var(--spacing-sm)] text-text">
                Properties ({s().properties.length})
              </div>
              <PropertyTree properties={s().properties} depth={0} />
            </div>

            <Show when={s().indexes.length > 0}>
              <div class="block mb-[var(--spacing-lg)]">
                <div class="font-semibold text-xs mb-[var(--spacing-sm)] text-text">
                  Indexes ({s().indexes.length})
                </div>
                <div>
                  <For each={s().indexes}>
                    {(idx) => (
                      <span class="inline-block px-[var(--spacing-sm)] py-[var(--spacing-xs)] bg-bg-secondary rounded-[var(--radius)] font-mono text-[11px] mr-[var(--spacing-xs)] mb-[var(--spacing-xs)]">
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
                  <div class="block mb-[var(--spacing-lg)]">
                    <div class="font-semibold text-xs mb-[var(--spacing-sm)] text-text">Relationships</div>
                    <Show when={outgoing.length > 0}>
                      <div class="block mb-[var(--spacing-sm)]">
                        <div class="text-[11px] text-text-muted mb-[var(--spacing-xs)]">References</div>
                        <For each={outgoing}>
                          {(rel) => (
                            <div class="text-xs py-[var(--spacing-xs)]">
                              <span class="font-mono text-accent">{rel.from.field}</span>
                              <span class="text-text-muted"> → </span>
                              <span class="text-success">{rel.to.collection}</span>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                    <Show when={incoming.length > 0}>
                      <div>
                        <div class="text-[11px] text-text-muted mb-[var(--spacing-xs)]">Referenced by</div>
                        <For each={incoming}>
                          {(rel) => (
                            <div class="text-xs py-[var(--spacing-xs)]">
                              <span class="text-warning">{rel.from.collection}</span>
                              <span class="text-text-muted">.</span>
                              <span class="font-mono text-accent">{rel.from.field}</span>
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
  );

  return (
    <Resizable
      theme={props.theme}
      direction={isMobile() ? "vertical" : "horizontal"}
      initialSize={isMobile() ? 200 : 240}
      minSize={isMobile() ? 100 : 180}
      maxSize={isMobile() ? 400 : 400}
      class="h-full"
    >
      {listContent()}
      {detailContent()}
    </Resizable>
  );
}
