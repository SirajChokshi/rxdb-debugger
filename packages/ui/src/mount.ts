import type { RxDatabase } from "rxdb/plugins/core";
import { render } from "solid-js/web";
import { RxdbDebugger } from "@rxdb-debugger/core";
import { Debugger, type PanelId } from "./components/Debugger.js";
import { getTheme, type Theme } from "./styles/theme.js";

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
   * UI theme. Defaults to "dark".
   */
  theme?: "dark" | "light";

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
    theme: themeName = "dark",
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

  const theme = getTheme(themeName);

  const dispose = render(
    () =>
      Debugger({
        debugger: debuggerInstance,
        theme,
        width,
        height,
        initialPanel,
        allowMutations,
      }),
    containerEl,
  );

  return () => {
    dispose();
    debuggerInstance.dispose();
  };
}

