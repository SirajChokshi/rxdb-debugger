import type { JSX } from "solid-js";
import { cva, type VariantProps } from "class-variance-authority";
import type { Theme } from "../../styles/theme.js";

const buttonVariants = cva(
  "rounded-[var(--radius)] font-medium whitespace-nowrap transition-all duration-150 ease-out inline-flex items-center justify-center",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-white border border-transparent hover:opacity-80",
        secondary:
          "bg-bg-secondary text-text border border-border hover:opacity-80",
        ghost:
          "bg-transparent text-text border border-transparent hover:bg-bg-hover",
        danger:
          "bg-error text-white border border-transparent hover:opacity-80",
      },
      size: {
        sm: "px-[var(--spacing-sm)] py-[var(--spacing-xs)] text-[11px] h-[22px]",
        default: "px-[var(--spacing-sm)] py-[var(--spacing-xs)] text-xs h-[26px]",
        lg: "px-[var(--spacing-md)] py-[var(--spacing-sm)] text-xs h-[32px]",
      },
      disabled: {
        true: "opacity-60 cursor-not-allowed",
        false: "cursor-pointer",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
      disabled: false,
    },
  }
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

export interface ButtonProps {
  theme: Theme;
  children: JSX.Element;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  class?: string;
}

export function Button(props: ButtonProps) {
  const classes = () =>
    buttonVariants({
      variant: props.variant,
      size: props.size,
      disabled: props.disabled ?? false,
      class: props.class,
    });

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

export { buttonVariants };
