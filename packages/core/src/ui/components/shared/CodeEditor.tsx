import { createSignal, onMount, type JSX } from "solid-js";
import { css } from "../../styles/css.js";
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

  const containerStyle = (): JSX.CSSProperties =>
    css({
      display: "flex",
      "flex-direction": "column",
      height: props.height ?? "200px",
      border: `1px solid ${error() ? props.theme.colors.error : props.theme.colors.border}`,
      "border-radius": props.theme.sizing.borderRadius,
      overflow: "hidden",
    });

  const textareaStyle = (): JSX.CSSProperties =>
    css({
      flex: "1",
      padding: props.theme.sizing.spacing.md,
      background: props.theme.colors.bg,
      color: props.theme.colors.text,
      border: "none",
      resize: "none",
      "font-family": props.theme.fonts.mono,
      "font-size": "12px",
      "line-height": "1.5",
      outline: "none",
      "tab-size": "2",
    });

  const errorStyle = (): JSX.CSSProperties =>
    css({
      padding: `${props.theme.sizing.spacing.xs} ${props.theme.sizing.spacing.sm}`,
      background: props.theme.colors.error,
      color: "#fff",
      "font-size": "11px",
      "font-family": props.theme.fonts.mono,
    });

  return (
    <div style={containerStyle()}>
      <textarea
        style={textareaStyle()}
        value={props.value}
        onInput={handleChange}
        placeholder={props.placeholder}
        readOnly={props.readonly}
        spellcheck={false}
      />
      {error() && <div style={errorStyle()}>{error()}</div>}
    </div>
  );
}
