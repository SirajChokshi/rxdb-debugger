import { For, type JSX } from "solid-js";
import { css } from "../../styles/css.js";
import type { Theme } from "../../styles/theme.js";

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
}

export interface TabsProps {
  theme: Theme;
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function Tabs(props: TabsProps) {
  const { theme } = props;

  const containerStyle = css({
    display: "flex",
    "flex-direction": "row",
    "border-bottom": `1px solid ${theme.colors.border}`,
    background: theme.colors.bgSecondary,
    "flex-shrink": "0",
    "overflow-x": "auto",
    "overflow-y": "hidden",
    "-webkit-overflow-scrolling": "touch",
    "scrollbar-width": "thin",
  });

  const tabStyle = (isActive: boolean): JSX.CSSProperties =>
    css({
      position: "relative",
      padding: `${theme.sizing.spacing.sm} ${theme.sizing.spacing.md}`,
      cursor: "pointer",
      "font-size": "12px",
      background: isActive ? theme.colors.bg : "transparent",
      "border-bottom": isActive
        ? `2px solid ${theme.colors.accent}`
        : "2px solid transparent",
      transition: "background 0.15s ease, border-color 0.15s ease",
      "white-space": "nowrap",
      "user-select": "none",
    });

  const hiddenLabelStyle = css({
    "font-weight": "600",
    visibility: "hidden",
    "pointer-events": "none",
  });

  const visibleLabelStyle = (isActive: boolean): JSX.CSSProperties =>
    css({
      position: "absolute",
      inset: "0",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      "font-weight": isActive ? "600" : "400",
      color: isActive ? theme.colors.accent : theme.colors.textSecondary,
      transition: "color 0.15s ease, font-weight 0.15s ease",
    });

  return (
    <div style={containerStyle}>
      <For each={props.tabs}>
        {(tab) => {
          const isActive = () => props.activeTab === tab.id;
          const label = () => (tab.icon ? `${tab.icon} ` : "") + tab.label;
          return (
            <div
              style={tabStyle(isActive())}
              onClick={() => props.onTabChange(tab.id)}
              onMouseEnter={(e) => {
                if (!isActive()) {
                  const visibleLabel = e.currentTarget.querySelector(
                    "[data-visible-label]"
                  ) as HTMLElement;
                  if (visibleLabel) {
                    visibleLabel.style.color = theme.colors.text;
                  }
                  e.currentTarget.style.background = theme.colors.bgHover;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive()) {
                  const visibleLabel = e.currentTarget.querySelector(
                    "[data-visible-label]"
                  ) as HTMLElement;
                  if (visibleLabel) {
                    visibleLabel.style.color = theme.colors.textSecondary;
                  }
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {/* Hidden bold label to set stable width */}
              <span style={hiddenLabelStyle}>{label()}</span>
              {/* Visible centered label */}
              <span data-visible-label style={visibleLabelStyle(isActive())}>
                {label()}
              </span>
            </div>
          );
        }}
      </For>
    </div>
  );
}
