import type { Observable } from "rxjs";
import type { RxDatabase } from "rxdb/plugins/core";

const EXTENSIONS_KEY = "__rxdbDebuggerExtensions";

/**
 * Optional hooks attached to a database handle by integration layers
 * (for example the Chrome extension remote proxy).
 */
export interface DebuggerDatabaseExtensions {
  /**
   * Emits the current collection names whenever the collection set changes.
   */
  onCollectionsChanged: Observable<string[]>;
}

type DatabaseWithExtensions = RxDatabase & {
  [EXTENSIONS_KEY]?: DebuggerDatabaseExtensions;
};

export function attachDebuggerDatabaseExtensions(
  db: RxDatabase,
  extensions: DebuggerDatabaseExtensions,
): void {
  (db as DatabaseWithExtensions)[EXTENSIONS_KEY] = extensions;
}

export function getDebuggerDatabaseExtensions(
  db: RxDatabase,
): DebuggerDatabaseExtensions | undefined {
  return (db as DatabaseWithExtensions)[EXTENSIONS_KEY];
}
