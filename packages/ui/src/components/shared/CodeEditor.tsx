import { createSignal, Show } from "solid-js";
import type { Theme } from "../../styles/theme.js";

export interface CodeEditorProps {
  theme: Theme;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readonly?: boolean;
  height?: string;
  language?: "json" | "text";
}

export function CodeEditor(props: CodeEditorProps) {
  const [error, setError] = createSignal<string | null>(null);

  const validateJson = (value: string): boolean => {
    if (props.language !== "json") return true;
    if (!value.trim()) return true;
    try {
      JSON.parse(value);
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
      return false;
    }
  };

  const handleChange = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    const value = target.value;
    validateJson(value);
    props.onChange?.(value);
  };

  const containerClasses = () => {
    const base = "flex flex-col rounded-[var(--radius)] overflow-hidden border";
    const borderColor = error() ? "border-error" : "border-border";
    return `${base} ${borderColor}`;
  };

  return (
    <div class={containerClasses()} style={{ height: props.height ?? "200px" }}>
      <textarea
        class="flex-1 p-[var(--spacing-md)] bg-bg text-text border-none resize-none font-mono text-xs leading-normal outline-none"
        style={{ "tab-size": "2" }}
        value={props.value}
        onInput={handleChange}
        placeholder={props.placeholder}
        readOnly={props.readonly}
        spellcheck={false}
      />
      <Show when={error()}>
        <div class="px-[var(--spacing-sm)] py-[var(--spacing-xs)] bg-error text-white text-[11px] font-mono">
          {error()}
        </div>
      </Show>
    </div>
  );
}
