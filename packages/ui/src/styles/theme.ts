/**
 * Theme definitions for the RxDB Explorer UI.
 */

export interface Theme {
  name: "dark" | "light";
  colors: {
    bg: string;
    bgSecondary: string;
    bgHover: string;
    bgSelected: string;
    border: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    accentHover: string;
    success: string;
    warning: string;
    error: string;
  };
  fonts: {
    sans: string;
    mono: string;
  };
  sizing: {
    borderRadius: string;
    spacing: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
  };
}

const darkTheme: Theme = {
  name: "dark",
  colors: {
    bg: "#1e1e2e",
    bgSecondary: "#2a2a3c",
    bgHover: "#363649",
    bgSelected: "#3d3d5c",
    border: "#404052",
    text: "#e4e4ef",
    textSecondary: "#a9a9b8",
    textMuted: "#6c6c7a",
    accent: "#7c6ef6",
    accentHover: "#9486f7",
    success: "#4ade80",
    warning: "#fbbf24",
    error: "#f87171",
  },
  fonts: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  },
  sizing: {
    borderRadius: "6px",
    spacing: {
      xs: "4px",
      sm: "8px",
      md: "12px",
      lg: "16px",
      xl: "24px",
    },
  },
};

const lightTheme: Theme = {
  name: "light",
  colors: {
    bg: "#ffffff",
    bgSecondary: "#f5f5f7",
    bgHover: "#ebebed",
    bgSelected: "#e0e0e5",
    border: "#d1d1d6",
    text: "#1d1d1f",
    textSecondary: "#6e6e73",
    textMuted: "#8e8e93",
    accent: "#6c5ce7",
    accentHover: "#5847e0",
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#ef4444",
  },
  fonts: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  },
  sizing: {
    borderRadius: "6px",
    spacing: {
      xs: "4px",
      sm: "8px",
      md: "12px",
      lg: "16px",
      xl: "24px",
    },
  },
};

export const themes: { dark: Theme; light: Theme } = {
  dark: darkTheme,
  light: lightTheme,
};

export function getTheme(name: "dark" | "light"): Theme {
  return themes[name];
}
