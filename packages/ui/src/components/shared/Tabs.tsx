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
              "relative px-[var(--spacing-md)] py-[var(--spacing-sm)] cursor-pointer text-xs whitespace-nowrap select-none transition-all duration-150 ease-out border-b-2";
            const activeClasses = isActive()
              ? "bg-bg border-accent"
              : "bg-transparent border-transparent hover:bg-bg-hover";
            return `${base} ${activeClasses}`;
          };

          const labelClasses = () => {
            const base =
              "absolute inset-0 flex items-center justify-center transition-all duration-150";
            const activeClasses = isActive()
              ? "font-semibold text-accent"
              : "font-normal text-text-secondary group-hover:text-text";
            return `${base} ${activeClasses}`;
          };

          return (
            <div
              class={`group ${tabClasses()}`}
              onClick={() => props.onTabChange(tab.id)}
            >
              <span class="font-semibold invisible pointer-events-none">
                {label()}
              </span>
              <span class={labelClasses()}>{label()}</span>
            </div>
          );
        }}
      </For>
    </div>
  );
}
