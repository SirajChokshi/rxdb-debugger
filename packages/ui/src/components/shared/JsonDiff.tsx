import { For, Show } from "solid-js";
import type { DiffChange } from "@rxdb-debugger/core";
import type { Theme } from "../../styles/theme.js";

export interface JsonDiffProps {
  theme: Theme;
  changes: DiffChange[];
  showUnchanged?: boolean;
}

const changeTypeClasses = {
  added: "bg-success/20 border-l-3 border-success",
  removed: "bg-error/20 border-l-3 border-error",
  changed: "bg-warning/20 border-l-3 border-warning",
};

export function JsonDiff(props: JsonDiffProps) {
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

  return (
    <div class="overflow-auto font-mono text-xs leading-relaxed p-[var(--spacing-md)]">
      <Show when={props.changes.length === 0}>
        <div class="text-text-muted text-center p-[var(--spacing-xl)]">No differences found</div>
      </Show>
      <For each={props.changes}>
        {(change) => (
          <div
            class={`px-[var(--spacing-sm)] py-[var(--spacing-xs)] rounded-sm mb-[var(--spacing-xs)] flex flex-col gap-0.5 ${changeTypeClasses[change.type]}`}
          >
            <div class="font-semibold text-accent">{change.path || "(root)"}</div>
            <Show when={change.type === "removed" || change.type === "changed"}>
              <div class="flex items-start gap-[var(--spacing-xs)]">
                <span class="text-[10px] uppercase text-text-muted mr-[var(--spacing-xs)]">-</span>
                <span class="text-error break-all">{formatValue(change.oldValue)}</span>
              </div>
            </Show>
            <Show when={change.type === "added" || change.type === "changed"}>
              <div class="flex items-start gap-[var(--spacing-xs)]">
                <span class="text-[10px] uppercase text-text-muted mr-[var(--spacing-xs)]">+</span>
                <span class="text-success break-all">{formatValue(change.newValue)}</span>
              </div>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}
