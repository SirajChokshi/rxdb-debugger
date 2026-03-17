import { mountExplorerDebugger, type ExplorerDebuggerAdapter, type ThemeMode } from "@rxdb-debugger/ui";
import {
  closeRemoteDatabaseInstance,
  createRemoteDatabase,
  listRemoteDatabaseInstances,
  listRemoteLogicalDatabases,
  removeRemoteDatabaseInstance,
  waitForRegistry,
} from "./remote-db";
import { disposeBridge, initBridge } from "./bridge";
import "./styles.css";

function getDevToolsTheme(): "light" | "dark" {
  try {
    const themeName = chrome.devtools?.panels?.themeName;
    return themeName === "dark" ? "dark" : "light";
  } catch {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
}

function createExtensionAdapter(): ExplorerDebuggerAdapter {
  return {
    async isRegistryAvailable() {
      return waitForRegistry();
    },
    async listLogicalDatabases() {
      return listRemoteLogicalDatabases();
    },
    async listInstances(logicalDatabaseId?: string) {
      return listRemoteDatabaseInstances(logicalDatabaseId);
    },
    async connectToInstance(instanceId: string) {
      await initBridge(instanceId);
      return createRemoteDatabase(instanceId);
    },
    async disconnect() {
      await disposeBridge();
    },
    async closeInstance(instanceId: string) {
      return closeRemoteDatabaseInstance(instanceId);
    },
    async removeInstance(instanceId: string) {
      return removeRemoteDatabaseInstance(instanceId);
    },
  };
}

const root = document.getElementById("root");

if (root) {
  const setupSnippet = `import { installRxdbDebuggerAutoDiscovery } from "rxdb-debugger-plugin";

installRxdbDebuggerAutoDiscovery();`;

  let cleanup: (() => void) | null = null;
  let lastTheme: ThemeMode = getDevToolsTheme();

  const mount = () => {
    cleanup?.();
    cleanup = mountExplorerDebugger({
      container: root,
      adapter: createExtensionAdapter(),
      shellTheme: lastTheme,
      inspectorTheme: () => getDevToolsTheme(),
      initialPanel: "collections",
      trackPerformance: false,
      setupSnippet,
      height: "100vh",
    });
  };

  const handleNavigated = () => {
    mount();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState !== "visible") {
      return;
    }
    const currentTheme = getDevToolsTheme();
    if (currentTheme !== lastTheme) {
      lastTheme = currentTheme;
      mount();
    }
  };

  mount();
  chrome.devtools.network.onNavigated.addListener(handleNavigated);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  window.addEventListener("beforeunload", () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    chrome.devtools.network.onNavigated.removeListener(handleNavigated);
    cleanup?.();
    cleanup = null;
  });
}

