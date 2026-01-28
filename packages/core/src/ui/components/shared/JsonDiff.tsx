import { For, Show, type JSX } from "solid-js";
import type { DiffChange } from "../../../documents.js";
import { css, scrollable } from "../../styles/css.js";
import type { Theme } from "../../styles/theme.js";

export interface JsonDiffProps {
  theme: Theme;
  changes: DiffChange[];
  showUnchanged?: boolean;
}

export function JsonDiff(props: JsonDiffProps) {
  const { theme } = props;

  const containerStyle = css(scrollable, {
    "font-family": theme.fonts.mono,
    "font-size": "12px",
    "line-height": "1.6",
    padding: theme.sizing.spacing.md,
  });

  const changeStyle = (type: DiffChange["type"]): JSX.CSSProperties => {
    const baseStyle = css({
      padding: `${theme.sizing.spacing.xs} ${theme.sizing.spacing.sm}`,
      "border-radius": "3px",
      "margin-bottom": theme.sizing.spacing.xs,
      display: "flex",
      "flex-direction": "column",
      gap: "2px",
    });

    switch (type) {
      case "added":
        return css(baseStyle, {
          background: `${theme.colors.success}20`,
          "border-left": `3px solid ${theme.colors.success}`,
        });
      case "removed":
        return css(baseStyle, {
          background: `${theme.colors.error}20`,
          "border-left": `3px solid ${theme.colors.error}`,
        });
      case "changed":
        return css(baseStyle, {
          background: `${theme.colors.warning}20`,
          "border-left": `3px solid ${theme.colors.warning}`,
        });
    }
  };

  const pathStyle = css({
    "font-weight": "600",
    color: theme.colors.accent,
  });

  const labelStyle = css({
    "font-size": "10px",
    "text-transform": "uppercase",
    color: theme.colors.textMuted,
    "margin-right": theme.sizing.spacing.xs,
  });

  const valueRowStyle = css({
    display: "flex",
    "align-items": "flex-start",
    gap: theme.sizing.spacing.xs,
  });

  const valueStyle = (type: "old" | "new"): JSX.CSSProperties =>
    css({
      color: type === "old" ? theme.colors.error : theme.colors.success,
      "word-break": "break-all",
    });

  const formatValue = (value: unknown): string => {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "string") return `"${value}"`;
    if (typeof value === "object") {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const emptyStyle = css({
    color: theme.colors.textMuted,
    "text-align": "center",
    padding: theme.sizing.spacing.xl,
  });

  return (
    <div style={containerStyle}>
      <Show when={props.changes.length === 0}>
        <div style={emptyStyle}>No differences found</div>
      </Show>
      <For each={props.changes}>
        {(change) => (
          <div style={changeStyle(change.type)}>
            <div style={pathStyle}>{change.path || "(root)"}</div>
            <Show when={change.type === "removed" || change.type === "changed"}>
              <div style={valueRowStyle}>
                <span style={labelStyle}>-</span>
                <span style={valueStyle("old")}>{formatValue(change.oldValue)}</span>
              </div>
            </Show>
            <Show when={change.type === "added" || change.type === "changed"}>
              <div style={valueRowStyle}>
                <span style={labelStyle}>+</span>
                <span style={valueStyle("new")}>{formatValue(change.newValue)}</span>
              </div>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}
