import { For, Show, createSignal, createMemo } from "solid-js";
import type { Theme } from "../../styles/theme.js";

export interface JsonViewerProps {
  theme: Theme;
  data: unknown;
  collapsed?: boolean;
  maxHeight?: string;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function JsonViewer(props: JsonViewerProps) {
  return (
    <div
      class="overflow-auto font-mono text-xs leading-relaxed p-[var(--spacing-md)] bg-bg select-text"
      style={props.maxHeight ? { "max-height": props.maxHeight } : undefined}
    >
      <JsonNode
        value={props.data as JsonValue}
        depth={0}
        initialCollapsed={props.collapsed ?? false}
      />
    </div>
  );
}

interface JsonNodeProps {
  value: JsonValue;
  depth: number;
  initialCollapsed: boolean;
  keyName?: string;
  isLast?: boolean;
}

function JsonNode(props: JsonNodeProps) {
  const [collapsed, setCollapsed] = createSignal(props.initialCollapsed && props.depth > 0);

  const renderPrimitive = (value: string | number | boolean | null) => {
    if (value === null) {
      return <span class="text-text-muted italic">null</span>;
    }
    if (typeof value === "string") {
      return <span class="text-success">"{escapeString(value)}"</span>;
    }
    if (typeof value === "number") {
      return <span class="text-warning">{value}</span>;
    }
    if (typeof value === "boolean") {
      return <span class="text-error">{value ? "true" : "false"}</span>;
    }
    return <span>{String(value)}</span>;
  };

  const escapeString = (str: string): string => {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
  };

  const comma = () => (props.isLast === false ? <span class="text-text-secondary">,</span> : null);

  const keyPrefix = () =>
    props.keyName !== undefined ? (
      <>
        <span class="text-accent">"{props.keyName}"</span>
        <span class="text-text-secondary">: </span>
      </>
    ) : null;

  const isPrimitive = createMemo(() => props.value === null || typeof props.value !== "object");
  const isArray = createMemo(() => Array.isArray(props.value));
  const entries = createMemo(() => {
    if (isPrimitive()) return [];
    return isArray()
      ? (props.value as JsonValue[]).map((v, i) => [i, v] as const)
      : Object.entries(props.value as Record<string, JsonValue>);
  });
  const isEmpty = createMemo(() => entries().length === 0);
  const openBracket = createMemo(() => (isArray() ? "[" : "{"));
  const closeBracket = createMemo(() => (isArray() ? "]" : "}"));

  return (
    <Show
      when={!isPrimitive()}
      fallback={
        <div class="whitespace-pre" style={{ "padding-left": `${props.depth * 16}px` }}>
          {keyPrefix()}
          {renderPrimitive(props.value as string | number | boolean | null)}
          {comma()}
        </div>
      }
    >
      <Show
        when={!isEmpty()}
        fallback={
          <div class="whitespace-pre" style={{ "padding-left": `${props.depth * 16}px` }}>
            {keyPrefix()}
            <span class="text-text-secondary">
              {openBracket()}
              {closeBracket()}
            </span>
            {comma()}
          </div>
        }
      >
        <div class="whitespace-pre" style={{ "padding-left": `${props.depth * 16}px` }}>
          <span
            class="text-text-muted cursor-pointer select-none mr-1 text-[10px] w-3 inline-block text-center"
            onClick={() => setCollapsed(!collapsed())}
          >
            {collapsed() ? "▶" : "▼"}
          </span>
          {keyPrefix()}
          <span class="text-text-secondary">{openBracket()}</span>
          <Show when={collapsed()}>
            <span class="text-text-secondary">
              {" "}
              <span class="text-text-muted">
                {entries().length} {isArray() ? "items" : "keys"}
              </span>{" "}
              {closeBracket()}
            </span>
            {comma()}
          </Show>
        </div>
        <Show when={!collapsed()}>
          <For each={entries()}>
            {([key, value], index) => (
              <JsonNode
                value={value}
                depth={props.depth + 1}
                initialCollapsed={props.initialCollapsed}
                keyName={isArray() ? undefined : String(key)}
                isLast={index() === entries().length - 1}
              />
            )}
          </For>
          <div class="whitespace-pre" style={{ "padding-left": `${props.depth * 16}px` }}>
            <span class="w-4 inline-block" />
            <span class="text-text-secondary">{closeBracket()}</span>
            {comma()}
          </div>
        </Show>
      </Show>
    </Show>
  );
}
