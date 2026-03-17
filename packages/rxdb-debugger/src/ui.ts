/**
 * rxdb-debugger/ui
 *
 * SolidJS-based UI for debugging RxDB databases.
 */

export {
  mountDebugger,
  type MountDebuggerOptions,

  mountExplorerDebugger,
  type MountExplorerDebuggerOptions,

  type PanelId,

  type ExplorerDatabaseInstance,
  type ExplorerDebuggerAdapter,
  type ExplorerLogicalDatabase,

  type Theme,
  type ThemeMode,
  themes,
  getTheme,
  detectColorScheme,
  onColorSchemeChange,
  resolveThemeMode,
} from "@rxdb-debugger/ui";
