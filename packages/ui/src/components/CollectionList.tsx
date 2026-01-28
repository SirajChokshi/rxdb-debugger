import { For, Show } from "solid-js";
import type { CollectionInfo } from "@rxdb-debugger/core";
import { css, ellipsis, flex, scrollable } from "../styles/css.js";
import type { Theme } from "../styles/theme.js";

export interface CollectionListProps {
  theme: Theme;
  collections: CollectionInfo[];
  selectedCollection: string | null;
  onSelect: (name: string) => void;
  isLoading: boolean;
  error: string | null;
}

export function CollectionList(props: CollectionListProps) {
  const { theme } = props;

  const containerStyle = css(flex.col, {
    background: theme.colors.bgSecondary,
    "border-right": `1px solid ${theme.colors.border}`,
    height: "100%",
    overflow: "hidden",
  });

  const headerStyle = css({
    padding: theme.sizing.spacing.md,
    "font-weight": "600",
    "font-size": "11px",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: theme.colors.textMuted,
    "border-bottom": `1px solid ${theme.colors.border}`,
    "flex-shrink": "0",
  });

  const listStyle = css(flex.col, scrollable, {
    flex: "1",
    padding: theme.sizing.spacing.xs,
    gap: "2px",
  });

  const itemStyle = (isSelected: boolean) =>
    css(flex.row, {
      padding: `${theme.sizing.spacing.sm} ${theme.sizing.spacing.md}`,
      "border-radius": theme.sizing.borderRadius,
      cursor: "pointer",
      background: isSelected ? theme.colors.bgSelected : "transparent",
      color: isSelected ? theme.colors.text : theme.colors.textSecondary,
      transition: "background 0.1s ease",
    });

  const itemNameStyle = css(ellipsis, {
    flex: "1",
    "font-weight": "500",
  });

  const countBadgeStyle = css({
    "font-size": "11px",
    color: theme.colors.textMuted,
    "font-family": theme.fonts.mono,
    "min-width": "36px",
    "text-align": "right",
  });

  const loadingStyle = css(flex.col, flex.center, {
    flex: "1",
    color: theme.colors.textMuted,
    "font-size": "12px",
  });

  const errorStyle = css({
    padding: theme.sizing.spacing.md,
    color: theme.colors.error,
    "font-size": "12px",
  });

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>Collections</div>
      <Show when={props.error}>
        <div style={errorStyle}>{props.error}</div>
      </Show>
      <Show when={props.isLoading}>
        <div style={loadingStyle}>Loading...</div>
      </Show>
      <Show when={!props.isLoading && !props.error}>
        <div style={listStyle}>
          <For each={props.collections}>
            {(collection) => {
              const isSelected = () =>
                props.selectedCollection === collection.name;
              return (
                <div
                  style={itemStyle(isSelected())}
                  onClick={() => props.onSelect(collection.name)}
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
                  <span style={itemNameStyle}>{collection.name}</span>
                  <span style={countBadgeStyle}>
                    {formatCount(collection.count)}
                  </span>
                </div>
              );
            }}
          </For>
          <Show when={props.collections.length === 0}>
            <div style={loadingStyle}>No collections</div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return String(count);
}
