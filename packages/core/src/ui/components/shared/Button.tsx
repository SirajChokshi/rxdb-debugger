import type { JSX } from "solid-js";
import { css } from "../../styles/css.js";
import type { Theme } from "../../styles/theme.js";

export interface ButtonProps {
  theme: Theme;
  children: JSX.Element;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
}

export function Button(props: ButtonProps) {
  const variant = () => props.variant ?? "secondary";
  const size = () => props.size ?? "md";
  const { theme } = props;

  const getBackground = (): string => {
    if (props.disabled) return theme.colors.bgSecondary;
    switch (variant()) {
      case "primary":
        return theme.colors.accent;
      case "danger":
        return theme.colors.error;
      default:
        return theme.colors.bgSecondary;
    }
  };

  const getColor = (): string => {
    if (props.disabled) return theme.colors.textMuted;
    switch (variant()) {
      case "primary":
      case "danger":
        return "#fff";
      default:
        return theme.colors.text;
    }
  };

  const buttonStyle = (): JSX.CSSProperties =>
    css({
      padding:
        size() === "sm"
          ? `${theme.sizing.spacing.xs} ${theme.sizing.spacing.sm}`
          : `${theme.sizing.spacing.sm} ${theme.sizing.spacing.md}`,
      background: getBackground(),
      color: getColor(),
      border: `1px solid ${variant() === "secondary" ? theme.colors.border : "transparent"}`,
      "border-radius": theme.sizing.borderRadius,
      "font-size": size() === "sm" ? "11px" : "12px",
      "font-weight": "500",
      cursor: props.disabled ? "not-allowed" : "pointer",
      transition: "all 0.15s ease",
      opacity: props.disabled ? 0.6 : 1,
      "white-space": "nowrap",
    });

  return (
    <button
      style={buttonStyle()}
      onClick={props.onClick}
      disabled={props.disabled}
      onMouseEnter={(e) => {
        if (!props.disabled) {
          e.currentTarget.style.opacity = "0.8";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = props.disabled ? "0.6" : "1";
      }}
    >
      {props.children}
    </button>
  );
}
