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
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
}

const darkTheme: Theme = {
  name: "dark",
  colors: {
    bg: "#0f0f14",
    bgSecondary: "#16161d",
    bgHover: "#1e1e28",
    bgSelected: "#252533",
    border: "#2a2a3a",
    text: "#e4e4ef",
    textSecondary: "#9898a8",
    textMuted: "#5c5c6c",
    accent: "#8b7cf7",
    accentHover: "#a090f9",
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
  breakpoints: {
    mobile: 480,
    tablet: 768,
    desktop: 1024,
  },
};

const lightTheme: Theme = {
  name: "light",
  colors: {
    bg: "#ffffff",
    bgSecondary: "#f6f8fa",
    bgHover: "#eaeef2",
    bgSelected: "#dbe4ec",
    border: "#d0d7de",
    text: "#1f2328",
    textSecondary: "#57606a",
    textMuted: "#8b949e",
    accent: "#7c5ce7",
    accentHover: "#6944e0",
    success: "#1a7f37",
    warning: "#bf8700",
    error: "#cf222e",
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
  breakpoints: {
    mobile: 480,
    tablet: 768,
    desktop: 1024,
  },
};

export const themes: { dark: Theme; light: Theme } = {
  dark: darkTheme,
  light: lightTheme,
};

/**
 * Theme mode options.
 * - "dark": Force dark theme
 * - "light": Force light theme
 * - "auto": Use system/browser preference
 */
export type ThemeMode = "dark" | "light" | "auto";

export function getTheme(name: "dark" | "light"): Theme {
  return themes[name];
}

/**
 * Detects the preferred color scheme from the browser/system.
 * Returns "dark" if the user prefers dark mode, "light" otherwise.
 */
export function detectColorScheme(): "dark" | "light" {
  if (typeof window === "undefined") {
    return "dark";
  }

  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  return darkQuery.matches ? "dark" : "light";
}

/**
 * Subscribes to color scheme changes.
 * Calls the callback whenever the system color scheme changes.
 *
 * @param callback - Function to call when color scheme changes
 * @returns Cleanup function to unsubscribe
 */
export function onColorSchemeChange(
  callback: (scheme: "dark" | "light") => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const handler = (e: MediaQueryListEvent) => {
    callback(e.matches ? "dark" : "light");
  };

  darkQuery.addEventListener("change", handler);
  return () => darkQuery.removeEventListener("change", handler);
}

/**
 * Resolves a theme mode to an actual theme name.
 * If mode is "auto", uses system preference detection.
 */
export function resolveThemeMode(mode: ThemeMode): "dark" | "light" {
  if (mode === "auto") {
    return detectColorScheme();
  }
  return mode;
}
