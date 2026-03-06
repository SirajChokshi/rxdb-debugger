/**
 * @rxdb-debugger/ui
 *
 * SolidJS-based UI for debugging RxDB databases.
 * Designed to be mounted into any framework via portal pattern.
 */

export {
  mountDebugger,
  type MountDebuggerOptions,
} from "./mount.js";

export {
  mountExplorerDebugger,
  type MountExplorerDebuggerOptions,
} from "./mount-explorer.js";

export { type PanelId } from "./components/Debugger.js";
export {
  type ExplorerDatabaseInstance,
  type ExplorerDebuggerAdapter,
  type ExplorerLogicalDatabase,
} from "./components/ExplorerDebugger.js";

export {
  type Theme,
  type ThemeMode,
  themes,
  getTheme,
  detectColorScheme,
  onColorSchemeChange,
  resolveThemeMode,
} from "./styles/theme.js";
