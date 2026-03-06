import { render } from "solid-js/web";
import { ExplorerDebugger, type ExplorerDebuggerAdapter, getDefaultSetupSnippet } from "./components/ExplorerDebugger.js";
import { detectColorScheme, onColorSchemeChange, resolveThemeMode, type ThemeMode } from "./styles/theme.js";
import type { PanelId } from "./components/Debugger.js";

export interface MountExplorerDebuggerOptions {
  container: string | HTMLElement;
  adapter: ExplorerDebuggerAdapter;
  shellTheme?: ThemeMode;
  inspectorTheme?: ThemeMode | (() => ThemeMode);
  width?: string;
  height?: string;
  initialPanel?: PanelId;
  allowMutations?: boolean;
  trackPerformance?: boolean;
  setupSnippet?: string;
}

export function mountExplorerDebugger(options: MountExplorerDebuggerOptions): () => void {
  const {
    container,
    adapter,
    shellTheme = "dark",
    inspectorTheme = "auto",
    width = "100%",
    height = "100%",
    initialPanel = "collections",
    allowMutations = false,
    trackPerformance = false,
    setupSnippet = getDefaultSetupSnippet(),
  } = options;

  const containerEl =
    typeof container === "string"
      ? document.querySelector<HTMLElement>(container)
      : container;

  if (!containerEl) {
    throw new Error(
      `RxDB Explorer: Container not found: ${typeof container === "string" ? container : "HTMLElement"}`,
    );
  }

  const applyThemeClass = (themeName: "dark" | "light") => {
    containerEl.classList.remove("theme-dark", "theme-light");
    containerEl.classList.add(`theme-${themeName}`);
  };

  let resolvedTheme = resolveThemeMode(shellTheme);
  applyThemeClass(resolvedTheme);

  let colorSchemeCleanup: (() => void) | null = null;
  if (shellTheme === "auto") {
    colorSchemeCleanup = onColorSchemeChange((scheme) => {
      resolvedTheme = scheme;
      applyThemeClass(scheme);
    });
  }

  const getInspectorTheme = (): ThemeMode => {
    if (typeof inspectorTheme === "function") {
      return inspectorTheme();
    }
    if (inspectorTheme === "auto") {
      return resolvedTheme ?? detectColorScheme();
    }
    return inspectorTheme;
  };

  const dispose = render(
    () =>
      ExplorerDebugger({
        adapter,
        width,
        height,
        setupSnippet,
        inspectorTheme: getInspectorTheme,
        initialPanel,
        allowMutations,
        trackPerformance,
      }),
    containerEl,
  );

  return () => {
    if (colorSchemeCleanup) {
      colorSchemeCleanup();
    }
    containerEl.classList.remove("theme-dark", "theme-light");
    dispose();
  };
}

