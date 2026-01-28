/**
 * @lassie/rxdb-explorer/ui
 *
 * SolidJS-based UI for debugging RxDB databases.
 * Designed to be mounted into any framework via portal pattern.
 */

export {
  mountDebugger,
  mountExplorer,
  type MountDebuggerOptions,
  type MountExplorerOptions,
} from "./mount.js";

export { type PanelId } from "./components/Debugger.js";

export { type Theme, themes, getTheme } from "./styles/theme.js";
