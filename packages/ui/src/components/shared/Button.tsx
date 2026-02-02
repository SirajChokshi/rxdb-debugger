import type { JSX } from "solid-js";
import type { Theme } from "../../styles/theme.js";

export interface ButtonProps {
  theme: Theme;
  children: JSX.Element;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  class?: string;
}

const baseClasses =
  "rounded-[var(--radius)] font-medium whitespace-nowrap transition-all duration-150 ease-out";

const sizeClasses = {
  sm: "px-[var(--spacing-sm)] py-[var(--spacing-xs)] text-[11px]",
  md: "px-[var(--spacing-md)] py-[var(--spacing-sm)] text-xs",
};

const variantClasses = {
  primary:
    "bg-accent text-white border border-transparent hover:opacity-80",
  secondary:
    "bg-bg-secondary text-text border border-border hover:opacity-80",
  danger:
    "bg-error text-white border border-transparent hover:opacity-80",
};

const disabledClasses = "opacity-60 cursor-not-allowed";

export function Button(props: ButtonProps) {
  const variant = () => props.variant ?? "secondary";
  const size = () => props.size ?? "md";

  const classes = () => {
    const parts = [
      baseClasses,
      sizeClasses[size()],
      variantClasses[variant()],
      props.disabled ? disabledClasses : "cursor-pointer",
      props.class,
    ];
    return parts.filter(Boolean).join(" ");
  };

  return (
    <button
      class={classes()}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  );
}
