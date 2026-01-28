import { For, Show, type JSX } from "solid-js";
import { css, ellipsis, scrollable } from "../../styles/css.js";
import type { Theme } from "../../styles/theme.js";

export interface TableColumn<T> {
  key: string;
  label: string;
  width?: string;
  render?: (item: T, index: number) => JSX.Element | string;
}

export interface TableProps<T> {
  theme: Theme;
  columns: TableColumn<T>[];
  data: T[];
  getRowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  selectedKey?: string | null;
  emptyMessage?: string;
}

export function Table<T>(props: TableProps<T>) {
  const { theme } = props;

  const containerStyle = css(scrollable, {
    flex: "1",
    "min-height": "0",
  });

  const tableStyle = css({
    width: "100%",
    "border-collapse": "collapse",
    "table-layout": "fixed",
  });

  const headerRowStyle = css({
    position: "sticky",
    top: "0",
    background: theme.colors.bgSecondary,
    "z-index": "1",
  });

  const headerCellStyle = (width?: string): JSX.CSSProperties =>
    css(ellipsis, {
      padding: `${theme.sizing.spacing.sm} ${theme.sizing.spacing.md}`,
      "text-align": "left",
      "font-size": "11px",
      "font-weight": "600",
      "text-transform": "uppercase",
      "letter-spacing": "0.5px",
      color: theme.colors.textMuted,
      "border-bottom": `1px solid ${theme.colors.border}`,
      width: width ?? "auto",
    });

  const rowStyle = (isSelected: boolean): JSX.CSSProperties =>
    css({
      cursor: props.onRowClick ? "pointer" : "default",
      background: isSelected ? theme.colors.bgSelected : "transparent",
      transition: "background 0.1s ease",
    });

  const cellStyle = css(ellipsis, {
    padding: `${theme.sizing.spacing.sm} ${theme.sizing.spacing.md}`,
    "font-size": "12px",
    "border-bottom": `1px solid ${theme.colors.border}`,
    color: theme.colors.text,
  });

  const emptyStyle = css({
    padding: theme.sizing.spacing.xl,
    "text-align": "center",
    color: theme.colors.textMuted,
    "font-size": "13px",
  });

  return (
    <div style={containerStyle}>
      <table style={tableStyle}>
        <thead>
          <tr style={headerRowStyle}>
            <For each={props.columns}>
              {(col) => <th style={headerCellStyle(col.width)}>{col.label}</th>}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={props.data}>
            {(item, index) => {
              const key = props.getRowKey(item);
              const isSelected = () => props.selectedKey === key;
              return (
                <tr
                  style={rowStyle(isSelected())}
                  onClick={() => props.onRowClick?.(item)}
                  onMouseEnter={(e) => {
                    if (!isSelected() && props.onRowClick) {
                      e.currentTarget.style.background = theme.colors.bgHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected()) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <For each={props.columns}>
                    {(col) => {
                      const value = col.render
                        ? col.render(item, index())
                        : String((item as Record<string, unknown>)[col.key] ?? "");
                      return <td style={cellStyle}>{value}</td>;
                    }}
                  </For>
                </tr>
              );
            }}
          </For>
        </tbody>
      </table>
      <Show when={props.data.length === 0}>
        <div style={emptyStyle}>{props.emptyMessage ?? "No data"}</div>
      </Show>
    </div>
  );
}
