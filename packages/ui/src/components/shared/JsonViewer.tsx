import { For, Show, createSignal, createMemo, type JSX } from "solid-js";
import { css, scrollable } from "../../styles/css.js";
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
      style={css(scrollable, {
        "font-family": props.theme.fonts.mono,
        "font-size": "12px",
        "line-height": "1.6",
        padding: props.theme.sizing.spacing.md,
        background: props.theme.colors.bg,
        "max-height": props.maxHeight,
      })}
    >
      <JsonNode
        theme={props.theme}
        value={props.data as JsonValue}
        depth={0}
        initialCollapsed={props.collapsed ?? false}
      />
    </div>
  );
}

interface JsonNodeProps {
  theme: Theme;
  value: JsonValue;
  depth: number;
  initialCollapsed: boolean;
  keyName?: string;
  isLast?: boolean;
}

function JsonNode(props: JsonNodeProps) {
  const { theme } = props;
  const [collapsed, setCollapsed] = createSignal(props.initialCollapsed && props.depth > 0);

  const _indent = () => props.depth * 16;

  const keyStyle: JSX.CSSProperties = {
    color: theme.colors.accent,
  };

  const stringStyle: JSX.CSSProperties = {
    color: theme.colors.success,
  };

  const numberStyle: JSX.CSSProperties = {
    color: theme.colors.warning,
  };

  const booleanStyle: JSX.CSSProperties = {
    color: theme.colors.error,
  };

  const nullStyle: JSX.CSSProperties = {
    color: theme.colors.textMuted,
    "font-style": "italic",
  };

  const punctuationStyle: JSX.CSSProperties = {
    color: theme.colors.textSecondary,
  };

  const toggleStyle: JSX.CSSProperties = {
    color: theme.colors.textMuted,
    cursor: "pointer",
    "user-select": "none",
    "margin-right": "4px",
    "font-size": "10px",
    width: "12px",
    display: "inline-block",
    "text-align": "center",
  };

  const lineStyle = (depth: number): JSX.CSSProperties => ({
    "padding-left": `${depth * 16}px`,
    "white-space": "pre",
  });

  const renderPrimitive = (value: string | number | boolean | null): JSX.Element => {
    if (value === null) {
      return <span style={nullStyle}>null</span>;
    }
    if (typeof value === "string") {
      return <span style={stringStyle}>"{escapeString(value)}"</span>;
    }
    if (typeof value === "number") {
      return <span style={numberStyle}>{value}</span>;
    }
    if (typeof value === "boolean") {
      return <span style={booleanStyle}>{value ? "true" : "false"}</span>;
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

  const comma = () => (props.isLast === false ? <span style={punctuationStyle}>,</span> : null);

  const keyPrefix = () =>
    props.keyName !== undefined ? (
      <>
        <span style={keyStyle}>"{props.keyName}"</span>
        <span style={punctuationStyle}>: </span>
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
        <div style={lineStyle(props.depth)}>
          {keyPrefix()}
          {renderPrimitive(props.value as string | number | boolean | null)}
          {comma()}
        </div>
      }
    >
      <Show
        when={!isEmpty()}
        fallback={
          <div style={lineStyle(props.depth)}>
            {keyPrefix()}
            <span style={punctuationStyle}>
              {openBracket()}
              {closeBracket()}
            </span>
            {comma()}
          </div>
        }
      >
        <div style={lineStyle(props.depth)}>
          <span style={toggleStyle} onClick={() => setCollapsed(!collapsed())}>
            {collapsed() ? "▶" : "▼"}
          </span>
          {keyPrefix()}
          <span style={punctuationStyle}>{openBracket()}</span>
          <Show when={collapsed()}>
            <span style={punctuationStyle}>
              {" "}
              <span style={{ color: theme.colors.textMuted }}>
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
                theme={theme}
                value={value}
                depth={props.depth + 1}
                initialCollapsed={props.initialCollapsed}
                keyName={isArray() ? undefined : String(key)}
                isLast={index() === entries().length - 1}
              />
            )}
          </For>
          <div style={lineStyle(props.depth)}>
            <span style={{ width: "16px", display: "inline-block" }} />
            <span style={punctuationStyle}>{closeBracket()}</span>
            {comma()}
          </div>
        </Show>
      </Show>
    </Show>
  );
}
