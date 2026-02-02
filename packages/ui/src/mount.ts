import type { RxDatabase } from "rxdb/plugins/core";
import { render } from "solid-js/web";
import { RxdbDebugger } from "@rxdb-debugger/core";
import { Debugger, type PanelId } from "./components/Debugger.js";
import {
  getTheme,
  resolveThemeMode,
  onColorSchemeChange,
  type ThemeMode,
} from "./styles/theme.js";

/**
 * Loose database input type for the UI mount function.
 * Accepts any database-like object to avoid strict type conflicts across frameworks.
 */
type AnyDbInput =
  | unknown
  | Promise<unknown>
  | (() => unknown | Promise<unknown>);

/**
 * Options for mounting the RxDB Debugger UI.
 */
export interface MountDebuggerOptions {
  /**
   * The container to mount into.
   * Can be a CSS selector string or an HTMLElement.
   */
  container: string | HTMLElement;

  /**
   * The RxDB database to debug.
   * Can be an instance, a Promise, or a factory function.
   */
  db: AnyDbInput;

  /**
   * UI theme mode. Defaults to "dark".
   * - "dark": Force dark theme
   * - "light": Force light theme
   * - "auto": Use system/browser preference and respond to changes
   */
  theme?: ThemeMode;

  /**
   * Initial panel to show. Defaults to "collections".
   */
  initialPanel?: PanelId;

  /**
   * Enable write operations like delete/update/import.
   * Defaults to false for safety.
   */
  allowMutations?: boolean;

  /**
   * Enable performance tracking on startup.
   * Defaults to false.
   */
  trackPerformance?: boolean;

  /**
   * Container width.
   * Defaults to "100%".
   */
  width?: string;

  /**
   * Container height.
   * Defaults to "100%".
   */
  height?: string;

  /**
   * Event buffer size for the events panel.
   * Defaults to 100.
   */
  eventBufferSize?: number;
}

/**
 * Mount the RxDB Debugger UI into a container.
 *
 * @param options - Mount options
 * @returns A cleanup function to unmount the debugger
 *
 * @example
 * ```typescript
 * import { mountDebugger } from "@lassie/rxdb-explorer/ui";
 *
 * const unmount = mountDebugger({
 *   container: "#debug-panel",
 *   db: getDatabase,
 *   theme: "dark",
 * });
 *
 * // Later: cleanup
 * unmount();
 * ```
 */
export function mountDebugger(options: MountDebuggerOptions): () => void {
  const {
    container,
    db,
    theme: themeMode = "dark",
    initialPanel = "collections",
    allowMutations = false,
    trackPerformance = false,
    width = "100%",
    height = "100%",
    eventBufferSize = 100,
  } = options;

  const containerEl =
    typeof container === "string"
      ? document.querySelector<HTMLElement>(container)
      : container;

  if (!containerEl) {
    throw new Error(
      `RxDB Debugger: Container not found: ${typeof container === "string" ? container : "HTMLElement"}`,
    );
  }

  const debuggerInstance = new RxdbDebugger({
    db: db as
      | RxDatabase
      | Promise<RxDatabase>
      | (() => RxDatabase | Promise<RxDatabase>),
    trackPerformance,
    eventBufferSize,
  });

  const resolvedTheme = resolveThemeMode(themeMode);
  const theme = getTheme(resolvedTheme);

  let colorSchemeCleanup: (() => void) | null = null;

  const dispose = render(
    () =>
      Debugger({
        debugger: debuggerInstance,
        initialTheme: theme,
        themeMode,
        width,
        height,
        initialPanel,
        allowMutations,
      }),
    containerEl,
  );

  if (themeMode === "auto") {
    colorSchemeCleanup = onColorSchemeChange(() => {
      // Theme changes are handled reactively in the Debugger component
    });
  }

  return () => {
    if (colorSchemeCleanup) {
      colorSchemeCleanup();
    }
    dispose();
    debuggerInstance.dispose();
  };
}

