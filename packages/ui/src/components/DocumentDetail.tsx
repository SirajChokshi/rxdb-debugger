import {
  createEffect,
  createMemo,
  createSignal,
  Index,
  Match,
  Show,
  Switch,
} from "solid-js";
import type { DocumentResult } from "@rxdb-debugger/core";
import { css, flex, scrollable } from "../styles/css.js";
import type { Theme } from "../styles/theme.js";

export interface DocumentDetailProps {
  theme: Theme;
  document: DocumentResult;
  onClose: () => void;
}

export function DocumentDetail(props: DocumentDetailProps) {
  const [expandedPaths, setExpandedPaths] = createSignal<Set<string>>(
    new Set([""]),
  );

  // Reset expanded paths when document changes
  createEffect(() => {
    const _docId = props.document.id;
    setExpandedPaths(new Set([""]));
  });

  const togglePath = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const containerStyle = () =>
    css(flex.col, {
      width: "360px",
      "flex-shrink": "0",
      "border-left": `1px solid ${props.theme.colors.border}`,
      background: props.theme.colors.bgSecondary,
      overflow: "hidden",
    });

  const headerStyle = () =>
    css(flex.row, flex.between, {
      padding: props.theme.sizing.spacing.md,
      "border-bottom": `1px solid ${props.theme.colors.border}`,
      "align-items": "center",
      "flex-shrink": "0",
    });

  const titleStyle = () =>
    css({
      "font-weight": "600",
      "font-size": "12px",
      "font-family": props.theme.fonts.mono,
      color: props.theme.colors.accent,
    });

  const closeButtonStyle = () =>
    css({
      background: "none",
      border: "none",
      color: props.theme.colors.textMuted,
      cursor: "pointer",
      padding: props.theme.sizing.spacing.xs,
      "border-radius": props.theme.sizing.borderRadius,
      "font-size": "18px",
      "line-height": "1",
    });

  const contentStyle = () =>
    css(flex.col, scrollable, {
      flex: "1",
      padding: props.theme.sizing.spacing.md,
      "font-family": props.theme.fonts.mono,
      "font-size": "12px",
      "line-height": "1.6",
    });

  return (
    <div style={containerStyle()}>
      <div style={headerStyle()}>
        <span style={titleStyle()}>{props.document.id}</span>
        <button
          style={closeButtonStyle()}
          onClick={props.onClose}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = props.theme.colors.bgHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
          }}
        >
          ×
        </button>
      </div>
      <div style={contentStyle()}>
        <JsonTree
          theme={props.theme}
          data={props.document.data}
          path=""
          expandedPaths={expandedPaths()}
          onToggle={togglePath}
        />
      </div>
    </div>
  );
}

interface JsonTreeProps {
  theme: Theme;
  data: unknown;
  path: string;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  depth?: number;
}

type DataType =
  | "null"
  | "undefined"
  | "boolean"
  | "number"
  | "string"
  | "array"
  | "object"
  | "unknown";

function getDataType(data: unknown): DataType {
  if (data === null) return "null";
  if (data === undefined) return "undefined";
  if (typeof data === "boolean") return "boolean";
  if (typeof data === "number") return "number";
  if (typeof data === "string") return "string";
  if (Array.isArray(data)) return "array";
  if (typeof data === "object") return "object";
  return "unknown";
}

function JsonTree(props: JsonTreeProps) {
  const depth = () => props.depth ?? 0;
  const dataType = () => getDataType(props.data);
  const isExpanded = () => props.expandedPaths.has(props.path);

  const entries = createMemo(() => {
    const d = props.data;
    if (d && typeof d === "object" && !Array.isArray(d)) {
      return Object.entries(d as Record<string, unknown>);
    }
    return [];
  });

  const arrayItems = createMemo(() => {
    return Array.isArray(props.data) ? props.data : [];
  });

  return (
    <Switch
      fallback={
        <span style={{ color: props.theme.colors.textMuted }}>unknown</span>
      }
    >
      <Match when={dataType() === "null"}>
        <span style={{ color: props.theme.colors.textMuted }}>null</span>
      </Match>

      <Match when={dataType() === "undefined"}>
        <span style={{ color: props.theme.colors.textMuted }}>undefined</span>
      </Match>

      <Match when={dataType() === "boolean"}>
        <span style={{ color: props.theme.colors.warning }}>
          {String(props.data)}
        </span>
      </Match>

      <Match when={dataType() === "number"}>
        <span style={{ color: props.theme.colors.success }}>
          {String(props.data)}
        </span>
      </Match>

      <Match when={dataType() === "string"}>
        <span style={{ color: props.theme.colors.warning }}>
          "{props.data as string}"
        </span>
      </Match>

      <Match when={dataType() === "array"}>
        <Show
          when={arrayItems().length > 0}
          fallback={
            <span style={{ color: props.theme.colors.textMuted }}>[]</span>
          }
        >
          <div>
            {/** biome-ignore lint/a11y/noStaticElementInteractions: we want to be able to toggle the array */}
            {/** biome-ignore lint/a11y/useKeyWithClickEvents: we want to be able to toggle the array */}
            <span
              onClick={() => props.onToggle(props.path)}
              style={{
                cursor: "pointer",
                color: props.theme.colors.textMuted,
                "user-select": "none",
              }}
            >
              {isExpanded() ? "▼" : "▶"} [{arrayItems().length}]
            </span>
            <Show when={isExpanded()}>
              <div style={{ "margin-left": "16px" }}>
                <Index each={arrayItems()}>
                  {(item, index) => (
                    <div style={{ display: "flex", gap: "4px" }}>
                      <span style={{ color: props.theme.colors.textMuted }}>
                        {index}:
                      </span>
                      <JsonTree
                        theme={props.theme}
                        data={item()}
                        path={`${props.path}[${index}]`}
                        expandedPaths={props.expandedPaths}
                        onToggle={props.onToggle}
                        depth={0}
                      />
                    </div>
                  )}
                </Index>
              </div>
            </Show>
          </div>
        </Show>
      </Match>

      <Match when={dataType() === "object"}>
        <Show
          when={entries().length > 0}
          fallback={
            <span style={{ color: props.theme.colors.textMuted }}>{"{}"}</span>
          }
        >
          <div>
            <Show when={depth() > 0}>
              {/** biome-ignore lint/a11y/noStaticElementInteractions: we want to be able to toggle the object */}
              {/** biome-ignore lint/a11y/useKeyWithClickEvents: we want to be able to toggle the object */}
              <span
                onClick={() => props.onToggle(props.path)}
                style={{
                  cursor: "pointer",
                  color: props.theme.colors.textMuted,
                  "user-select": "none",
                }}
              >
                {isExpanded() ? "▼" : "▶"} {"{"}...{"}"}
              </span>
            </Show>
            <Show when={isExpanded() || depth() === 0}>
              <div style={{ "margin-left": depth() > 0 ? "16px" : "0" }}>
                <Index each={entries()}>
                  {(entry) => {
                    const key = () => entry()[0];
                    const value = () => entry()[1];
                    return (
                      <div
                        style={{
                          display: "flex",
                          gap: "4px",
                          "flex-wrap": "wrap",
                        }}
                      >
                        <span style={{ color: props.theme.colors.accent }}>
                          {key()}:
                        </span>
                        <JsonTree
                          theme={props.theme}
                          data={value()}
                          path={props.path ? `${props.path}.${key()}` : key()}
                          expandedPaths={props.expandedPaths}
                          onToggle={props.onToggle}
                          depth={0}
                        />
                      </div>
                    );
                  }}
                </Index>
              </div>
            </Show>
          </div>
        </Show>
      </Match>
    </Switch>
  );
}
