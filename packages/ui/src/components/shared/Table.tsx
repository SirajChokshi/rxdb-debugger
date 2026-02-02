import { For, Show, type JSX } from "solid-js";
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
  const rowClasses = (isSelected: boolean) => {
    const base = "transition-colors duration-100";
    const cursor = props.onRowClick ? "cursor-pointer" : "cursor-default";
    const bg = isSelected ? "bg-bg-selected" : "bg-transparent hover:bg-bg-hover";
    return `${base} ${cursor} ${bg}`;
  };

  return (
    <div class="flex-1 min-h-0 overflow-auto">
      <table class="w-full border-collapse table-fixed">
        <thead>
          <tr class="sticky top-0 bg-bg-secondary z-[1]">
            <For each={props.columns}>
              {(col) => (
                <th
                  class="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted border-b border-border truncate"
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              )}
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
                  class={rowClasses(isSelected())}
                  onClick={() => props.onRowClick?.(item)}
                >
                  <For each={props.columns}>
                    {(col) => {
                      const value = col.render
                        ? col.render(item, index())
                        : String((item as Record<string, unknown>)[col.key] ?? "");
                      return (
                        <td class="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-xs border-b border-border text-text truncate">
                          {value}
                        </td>
                      );
                    }}
                  </For>
                </tr>
              );
            }}
          </For>
        </tbody>
      </table>
      <Show when={props.data.length === 0}>
        <div class="p-[var(--spacing-xl)] text-center text-text-muted text-[13px]">
          {props.emptyMessage ?? "No data"}
        </div>
      </Show>
    </div>
  );
}
