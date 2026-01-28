import type { JSX } from "solid-js";

/**
 * Helper to create style objects for SolidJS components.
 * Provides type safety and allows spreading multiple style objects.
 */
export function css(
  ...styles: (JSX.CSSProperties | undefined | false)[]
): JSX.CSSProperties {
  const result: JSX.CSSProperties = {};
  for (const style of styles) {
    if (style) {
      Object.assign(result, style);
    }
  }
  return result;
}

/**
 * Common base styles for resetting browser defaults.
 */
export const resetStyles: JSX.CSSProperties = {
  margin: "0",
  padding: "0",
  "box-sizing": "border-box",
};

/**
 * Flex container helpers.
 */
export const flex = {
  row: { display: "flex", "flex-direction": "row" } as JSX.CSSProperties,
  col: { display: "flex", "flex-direction": "column" } as JSX.CSSProperties,
  center: {
    "align-items": "center",
    "justify-content": "center",
  } as JSX.CSSProperties,
  between: { "justify-content": "space-between" } as JSX.CSSProperties,
  start: { "align-items": "flex-start" } as JSX.CSSProperties,
  stretch: { "align-items": "stretch" } as JSX.CSSProperties,
};

/**
 * Text overflow ellipsis.
 */
export const ellipsis: JSX.CSSProperties = {
  overflow: "hidden",
  "text-overflow": "ellipsis",
  "white-space": "nowrap",
};

/**
 * Scrollable container.
 */
export const scrollable: JSX.CSSProperties = {
  overflow: "auto",
};

/**
 * Hide scrollbar but keep scrollable.
 */
export const hideScrollbar: JSX.CSSProperties = {
  overflow: "auto",
  "scrollbar-width": "none",
  "-ms-overflow-style": "none",
};
