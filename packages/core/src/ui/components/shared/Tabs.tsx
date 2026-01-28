import { createSignal, For, type JSX } from "solid-js";
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
    overflow: "hidden",
  });

  const tabStyle = (isActive: boolean): JSX.CSSProperties =>
    css({
      padding: `${theme.sizing.spacing.sm} ${theme.sizing.spacing.md}`,
      cursor: "pointer",
      "font-size": "12px",
      "font-weight": isActive ? "600" : "400",
      color: isActive ? theme.colors.accent : theme.colors.textSecondary,
      background: isActive ? theme.colors.bg : "transparent",
      "border-bottom": isActive
        ? `2px solid ${theme.colors.accent}`
        : "2px solid transparent",
      transition: "all 0.15s ease",
      "white-space": "nowrap",
      "user-select": "none",
    });

  return (
    <div style={containerStyle}>
      <For each={props.tabs}>
        {(tab) => {
          const isActive = () => props.activeTab === tab.id;
          return (
            <div
              style={tabStyle(isActive())}
              onClick={() => props.onTabChange(tab.id)}
              onMouseEnter={(e) => {
                if (!isActive()) {
                  e.currentTarget.style.color = theme.colors.text;
                  e.currentTarget.style.background = theme.colors.bgHover;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive()) {
                  e.currentTarget.style.color = theme.colors.textSecondary;
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {tab.icon ? `${tab.icon} ` : ""}
              {tab.label}
            </div>
          );
        }}
      </For>
    </div>
  );
}
