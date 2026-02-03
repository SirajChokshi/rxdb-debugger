import { For } from "solid-js";
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
  return (
    <div class="flex flex-row border-b border-border bg-bg-secondary shrink-0 overflow-x-auto overflow-y-hidden">
      <For each={props.tabs}>
        {(tab) => {
          const isActive = () => props.activeTab === tab.id;
          const label = () => (tab.icon ? `${tab.icon} ` : "") + tab.label;

          const tabClasses = () => {
            const base =
              "px-[var(--spacing-md)] py-[var(--spacing-xs)] cursor-pointer text-xs whitespace-nowrap select-none transition-colors duration-150 ease-out border-b-2";
            const activeClasses = isActive()
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text hover:bg-bg-hover";
            return `${base} ${activeClasses}`;
          };

          return (
            <div
              class={tabClasses()}
              onClick={() => props.onTabChange(tab.id)}
            >
              {label()}
            </div>
          );
        }}
      </For>
    </div>
  );
}
