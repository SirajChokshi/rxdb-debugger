import { For, Match, Show, Switch, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { render } from "solid-js/web";
import { mountDebugger } from "@rxdb-debugger/ui";
import {
  closeRemoteDatabaseInstance,
  createRemoteDatabase,
  listRemoteDatabaseInstances,
  listRemoteLogicalDatabases,
  removeRemoteDatabaseInstance,
  type RemoteDatabaseInstanceInfo,
  type RemoteLogicalDatabaseInfo,
  waitForRegistry,
} from "./remote-db";
import { initBridge, disposeBridge } from "./bridge";
import "./styles.css";

type PanelStatus = "loading" | "setup-required" | "empty" | "ready" | "error";

/**
 * Detects the DevTools theme using chrome.devtools.panels.themeName.
 * Returns "dark" or "light" based on the current DevTools theme.
 */
function getDevToolsTheme(): "dark" | "light" {
  try {
    // chrome.devtools.panels.themeName returns "dark" or "default"
    const themeName = chrome.devtools?.panels?.themeName;
    return themeName === "dark" ? "dark" : "light";
  } catch {
    // Fallback to checking prefers-color-scheme if DevTools API unavailable
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
}

function applyThemeToBody(theme: "dark" | "light") {
  document.body.classList.remove("theme-dark", "theme-light");
  document.body.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

async function waitForDebuggerContainer(
  getContainer: () => HTMLDivElement | undefined,
  maxAttempts = 20,
): Promise<HTMLDivElement> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const container = getContainer();
    if (container) {
      return container;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 16));
  }
  throw new Error("Debugger container not available");
}

function getStyles() {
  const isDark = getDevToolsTheme() === "dark";

  return {
    container: `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      text-align: center;
      padding: 32px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `,
    icon: "font-size: 48px; margin-bottom: 16px;",
    title: `margin: 0 0 8px; font-size: 18px; color: ${isDark ? "#e4e4ef" : "#1f2328"};`,
    subtitle: `margin: 0 0 16px; color: ${isDark ? "#9898a8" : "#57606a"}; font-size: 14px;`,
    code: `background: ${isDark ? "#2a2a3a" : "#eaeef2"}; padding: 2px 6px; border-radius: 4px; font-family: monospace;`,
    pre: `
      background: ${isDark ? "#16161d" : "#f6f8fa"};
      padding: 16px;
      border-radius: 8px;
      font-size: 12px;
      color: ${isDark ? "#4ade80" : "#1a7f37"};
      text-align: left;
      font-family: monospace;
    `,
    button: `
      margin-top: 16px;
      padding: 8px 16px;
      background: #8b7cf7;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    `,
    errorTitle: `margin: 0 0 8px; font-size: 18px; color: ${isDark ? "#f87171" : "#cf222e"};`,
    loading: `color: ${isDark ? "#9898a8" : "#57606a"};`,
  };
}

function LoadingScreen() {
  const styles = getStyles();
  return (
    <div style={styles.container}>
      <div style={styles.loading}>Connecting to RxDB...</div>
    </div>
  );
}

function SetupRequired(props: { onRetry: () => void }) {
  const styles = getStyles();
  return (
    <div style={styles.container}>
      <div style={styles.icon}>🔍</div>
      <h2 style={styles.title}>Auto-Discovery Plugin Required</h2>
      <p style={styles.subtitle}>
        Install the RxDB Debugger auto-discovery plugin before creating your databases.
      </p>
      <pre style={styles.pre}>
        {`import { addRxPlugin } from "rxdb/plugins/core";
import { createRxdbDebuggerAutoDiscoveryPlugin } from "@rxdb-debugger/core";

addRxPlugin(createRxdbDebuggerAutoDiscoveryPlugin());`}
      </pre>
      <button style={styles.button} onClick={props.onRetry}>
        Retry
      </button>
    </div>
  );
}

function ErrorScreen(props: { message: string }) {
  const styles = getStyles();
  return (
    <div style={styles.container}>
      <div style={styles.icon}>❌</div>
      <h2 style={styles.errorTitle}>Error connecting to database</h2>
      <p style={styles.subtitle}>{props.message}</p>
    </div>
  );
}

function Panel() {
  const [status, setStatus] = createSignal<PanelStatus>("loading");
  const [errorMessage, setErrorMessage] = createSignal("");
  const [logicalDatabases, setLogicalDatabases] = createSignal<RemoteLogicalDatabaseInfo[]>([]);
  const [instances, setInstances] = createSignal<RemoteDatabaseInstanceInfo[]>([]);
  const [selectedLogicalId, setSelectedLogicalId] = createSignal<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = createSignal<string | null>(null);
  const [activeInstanceId, setActiveInstanceId] = createSignal<string | null>(null);
  const [expandedLogicalIds, setExpandedLogicalIds] = createSignal<string[]>([]);
  const [isBusy, setIsBusy] = createSignal(false);

  let debuggerContainerRef: HTMLDivElement | undefined;
  let debuggerCleanup: (() => void) | null = null;
  let connectGeneration = 0;

  const selectedLogical = createMemo(() =>
    logicalDatabases().find((entry) => entry.id === selectedLogicalId()) ?? null
  );
  const selectedInstance = createMemo(() =>
    instances().find((entry) => entry.id === selectedInstanceId()) ?? null
  );
  const visibleInstances = createMemo(() => {
    const selectedId = selectedLogicalId();
    if (!selectedId) {
      return [] as RemoteDatabaseInstanceInfo[];
    }
    return instances().filter((entry) => entry.logicalDatabaseId === selectedId);
  });
  const isEmpty = createMemo(() => status() === "empty");

  const isExpanded = (logicalId: string): boolean => {
    return expandedLogicalIds().includes(logicalId);
  };

  const toggleExpanded = (logicalId: string): void => {
    setExpandedLogicalIds((prev) =>
      prev.includes(logicalId)
        ? prev.filter((entry) => entry !== logicalId)
        : [...prev, logicalId]
    );
  };

  async function disconnectDebugger(): Promise<void> {
    if (debuggerCleanup) {
      debuggerCleanup();
      debuggerCleanup = null;
    }
    setActiveInstanceId(null);
    await disposeBridge();
  }

  function pickInstanceForLogical(
    logicalId: string,
    preferredInstanceId: string | null,
    currentInstances: RemoteDatabaseInstanceInfo[],
  ): string | null {
    const scoped = currentInstances.filter((entry) => entry.logicalDatabaseId === logicalId);
    if (scoped.length === 0) {
      return null;
    }

    if (preferredInstanceId) {
      const preferred = scoped.find((entry) => entry.id === preferredInstanceId);
      if (preferred && preferred.status === "open") {
        return preferred.id;
      }
    }

    const openInstance = scoped.find((entry) => entry.status === "open");
    return openInstance?.id ?? null;
  }

  async function connectToInstance(instanceId: string): Promise<void> {
    const generation = ++connectGeneration;

    await disconnectDebugger();
    if (generation !== connectGeneration) return;

    try {
      await withTimeout(
        initBridge(instanceId),
        5000,
        "Timed out while initializing the RxDB bridge",
      );
      if (generation !== connectGeneration) return;

      const remoteDb = await withTimeout(
        createRemoteDatabase(instanceId),
        8000,
        "Timed out while connecting to the selected RxDB instance",
      );
      if (generation !== connectGeneration) return;

      setActiveInstanceId(instanceId);
      setStatus("ready");
      const container = await waitForDebuggerContainer(() => debuggerContainerRef);
      const theme = getDevToolsTheme();
      debuggerCleanup = mountDebugger({
        container,
        db: remoteDb,
        theme,
      });
    } catch (err) {
      if (generation !== connectGeneration) return;
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }

  async function refreshInventory(preserveSelection: boolean): Promise<void> {
    setStatus("loading");

    try {
      const hasRegistry = await withTimeout(
        waitForRegistry(),
        12000,
        "Timed out while discovering the RxDB debugger registry",
      );
      if (!hasRegistry) {
        await disconnectDebugger();
        setLogicalDatabases([]);
        setInstances([]);
        setSelectedLogicalId(null);
        setSelectedInstanceId(null);
        setStatus("setup-required");
        return;
      }

      const nextLogicalDatabases = await withTimeout(
        listRemoteLogicalDatabases(),
        6000,
        "Timed out while loading logical databases",
      );
      const nextInstances = await withTimeout(
        listRemoteDatabaseInstances(),
        6000,
        "Timed out while loading database instances",
      );

      setLogicalDatabases(nextLogicalDatabases);
      setInstances(nextInstances);

      if (nextLogicalDatabases.length === 0) {
        await disconnectDebugger();
        setSelectedLogicalId(null);
        setSelectedInstanceId(null);
        setStatus("empty");
        return;
      }

      const previousLogicalId = preserveSelection ? selectedLogicalId() : null;
      const nextLogicalId: string = (
        previousLogicalId
        && nextLogicalDatabases.some((entry) => entry.id === previousLogicalId)
      )
        ? previousLogicalId
        : nextLogicalDatabases[0]!.id;
      setSelectedLogicalId(nextLogicalId);

      if (!isExpanded(nextLogicalId)) {
        setExpandedLogicalIds((prev) => [...new Set([...prev, nextLogicalId])]);
      }

      const previousInstanceId = preserveSelection ? selectedInstanceId() : null;
      const nextInstanceId = pickInstanceForLogical(nextLogicalId, previousInstanceId, nextInstances);
      setSelectedInstanceId(nextInstanceId);

      if (!nextInstanceId) {
        await disconnectDebugger();
        setStatus("ready");
        return;
      }

      if (activeInstanceId() !== nextInstanceId) {
        await connectToInstance(nextInstanceId);
        return;
      }

      setStatus("ready");
    } catch (error) {
      await disconnectDebugger();
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function withBusyAction(action: () => Promise<void>): Promise<void> {
    if (isBusy()) {
      return;
    }
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCloseInstance(instanceId: string): Promise<void> {
    await withBusyAction(async () => {
      await closeRemoteDatabaseInstance(instanceId);
      await refreshInventory(true);
    });
  }

  async function handleRemoveInstance(instanceId: string): Promise<void> {
    if (!window.confirm("Remove this database instance and underlying data?")) {
      return;
    }
    await withBusyAction(async () => {
      await removeRemoteDatabaseInstance(instanceId);
      await refreshInventory(true);
    });
  }

  async function handleSelectLogical(logicalId: string): Promise<void> {
    setSelectedLogicalId(logicalId);
    if (!isExpanded(logicalId)) {
      toggleExpanded(logicalId);
    }
    const nextInstanceId = pickInstanceForLogical(logicalId, null, instances());
    setSelectedInstanceId(nextInstanceId);
    if (nextInstanceId) {
      await connectToInstance(nextInstanceId);
    } else {
      await disconnectDebugger();
      setStatus("ready");
    }
  }

  async function handleSelectInstance(instanceId: string): Promise<void> {
    setSelectedInstanceId(instanceId);
    await connectToInstance(instanceId);
  }

  let loadingWatchdogId: number | undefined;

  createEffect(() => {
    const currentStatus = status();
    if (loadingWatchdogId !== undefined) {
      window.clearTimeout(loadingWatchdogId);
      loadingWatchdogId = undefined;
    }

    if (currentStatus !== "loading") {
      return;
    }

    loadingWatchdogId = window.setTimeout(() => {
      if (status() === "loading") {
        setStatus("error");
        setErrorMessage(
          "Timed out while connecting to the inspected page. Reload the page and reopen the RxDB panel.",
        );
      }
    }, 15000);
  });

  onMount(() => {
    let lastTheme = getDevToolsTheme();

    applyThemeToBody(lastTheme);
    void refreshInventory(false);

    // Listen for page navigation/reload
    const handleNavigated = async () => {
      await disconnectDebugger();
      void refreshInventory(false);
    };
    chrome.devtools.network.onNavigated.addListener(handleNavigated);

    // Check for theme changes when panel becomes visible
    // (DevTools was closed and reopened with different theme)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const currentTheme = getDevToolsTheme();
        if (currentTheme !== lastTheme) {
          lastTheme = currentTheme;
          applyThemeToBody(currentTheme);
          const active = activeInstanceId();
          if (active) {
            void connectToInstance(active);
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    onCleanup(() => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      chrome.devtools.network.onNavigated.removeListener(handleNavigated);
    });
  });

  onCleanup(() => {
    connectGeneration += 1;
    if (loadingWatchdogId !== undefined) {
      window.clearTimeout(loadingWatchdogId);
      loadingWatchdogId = undefined;
    }
    void disconnectDebugger();
  });

  return (
    <Switch>
      <Match when={status() === "loading"}>
        <LoadingScreen />
      </Match>
      <Match when={status() === "setup-required"}>
        <SetupRequired onRetry={() => { void refreshInventory(false); }} />
      </Match>
      <Match when={status() === "error"}>
        <ErrorScreen message={errorMessage()} />
      </Match>
      <Match when={status() === "ready" || status() === "empty"}>
        <div style="height:100vh; display:flex; background:var(--color-bg); color:var(--color-text);">
      <aside
        style="width:320px; border-right:1px solid var(--color-border); display:flex; flex-direction:column; background:var(--color-bg-secondary);"
      >
        <div style="padding:12px; border-bottom:1px solid var(--color-border); display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <div>
            <div style="font-size:13px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase;">
              Database Explorer
            </div>
            <div style="font-size:12px; color:var(--color-text-secondary);">
              {logicalDatabases().length} databases • {instances().length} instances
            </div>
          </div>
          <button
            style="padding:6px 10px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-bg); color:var(--color-text); cursor:pointer;"
            onClick={() => { void refreshInventory(true); }}
            disabled={isBusy()}
          >
            Refresh
          </button>
        </div>

        <div style="overflow:auto; flex:1; padding:8px;">
          <Show when={!isEmpty()} fallback={
            <div style="padding:12px; font-size:13px; color:var(--color-text-secondary);">
              No databases discovered yet. Create a database after installing the auto-discovery plugin.
            </div>
          }>
            <For each={logicalDatabases()}>
              {(logicalDb) => {
                const logicalInstances = createMemo(() =>
                  instances().filter((entry) => entry.logicalDatabaseId === logicalDb.id)
                );
                const isSelectedLogical = createMemo(() => selectedLogicalId() === logicalDb.id);
                return (
                  <div style="margin-bottom:8px; border:1px solid var(--color-border); border-radius:8px; overflow:hidden;">
                    <button
                      onClick={() => { void handleSelectLogical(logicalDb.id); }}
                      style={`width:100%; text-align:left; border:none; cursor:pointer; padding:10px; display:flex; flex-direction:column; gap:6px; background:${isSelectedLogical() ? "var(--color-bg-selected)" : "var(--color-bg)"}; color:var(--color-text);`}
                    >
                      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                        <div style="font-weight:600; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                          {logicalDb.name}
                        </div>
                        <div
                          style="font-size:11px; color:var(--color-text-secondary); border:1px solid var(--color-border); border-radius:999px; padding:2px 6px;"
                        >
                          {logicalDb.openInstanceCount}/{logicalDb.totalInstanceCount}
                        </div>
                      </div>
                      <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <span
                          title="RxDB storage adapter name"
                          style="font-size:11px; color:var(--color-text-secondary); border:1px solid var(--color-border); border-radius:999px; padding:1px 6px;"
                        >
                          storage: {logicalDb.storageName}
                        </span>
                        <span
                          title="Logical database lifecycle status"
                          style={`font-size:11px; border:1px solid var(--color-border); border-radius:999px; padding:1px 6px; color:${logicalDb.status === "open" ? "var(--color-success)" : "var(--color-text-secondary)"};`}
                        >
                          state: {logicalDb.status}
                        </span>
                        <Switch>
                          <Match when={logicalDb.hasEncryptedFields}>
                            <span
                              title="This logical database has encrypted schema fields"
                              style="font-size:11px; color:var(--color-warning); border:1px solid var(--color-border); border-radius:999px; padding:1px 6px;"
                            >
                              fields: encrypted
                            </span>
                          </Match>
                          <Match when={true}>
                            <span
                              title="This logical database has no encrypted schema fields"
                              style="font-size:11px; color:var(--color-text-secondary); border:1px solid var(--color-border); border-radius:999px; padding:1px 6px;"
                            >
                              fields: none
                            </span>
                          </Match>
                        </Switch>
                        <Switch>
                          <Match when={logicalDb.hasEncryptedAttachments}>
                            <span
                              title="This logical database has encrypted attachments"
                              style="font-size:11px; color:var(--color-warning); border:1px solid var(--color-border); border-radius:999px; padding:1px 6px;"
                            >
                              attachments: encrypted
                            </span>
                          </Match>
                          <Match when={true}>
                            <span
                              title="This logical database has no encrypted attachments"
                              style="font-size:11px; color:var(--color-text-secondary); border:1px solid var(--color-border); border-radius:999px; padding:1px 6px;"
                            >
                              attachments: none
                            </span>
                          </Match>
                        </Switch>
                        <Switch>
                          <Match when={logicalDb.hasPasswordConfigured}>
                            <span
                              title="A database password was configured at creation"
                              style="font-size:11px; color:var(--color-warning); border:1px solid var(--color-border); border-radius:999px; padding:1px 6px;"
                            >
                              password: yes
                            </span>
                          </Match>
                          <Match when={true}>
                            <span
                              title="No database password was configured at creation"
                              style="font-size:11px; color:var(--color-text-secondary); border:1px solid var(--color-border); border-radius:999px; padding:1px 6px;"
                            >
                              password: no
                            </span>
                          </Match>
                        </Switch>
                      </div>
                    </button>

                    <button
                      onClick={() => toggleExpanded(logicalDb.id)}
                      style="width:100%; border:none; border-top:1px solid var(--color-border); background:var(--color-bg-secondary); color:var(--color-text-secondary); cursor:pointer; font-size:11px; padding:4px 8px; text-align:left;"
                    >
                      {isExpanded(logicalDb.id) ? "Hide instances" : "Show instances"}
                    </button>

                    <Show when={isExpanded(logicalDb.id)}>
                      <div style="padding:8px; background:var(--color-bg-secondary); border-top:1px solid var(--color-border);">
                        <For each={logicalInstances()}>
                          {(instance) => {
                            const isSelectedInstance = createMemo(() => selectedInstanceId() === instance.id);
                            return (
                              <div
                                style={`padding:8px; border:1px solid var(--color-border); border-radius:6px; margin-bottom:6px; background:${isSelectedInstance() ? "var(--color-bg-selected)" : "var(--color-bg)"};`}
                              >
                                <button
                                  onClick={() => { void handleSelectInstance(instance.id); }}
                                  style="display:flex; width:100%; justify-content:space-between; align-items:center; border:none; background:transparent; color:var(--color-text); cursor:pointer; padding:0;"
                                >
                                  <span style="font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                    {instance.instanceToken}
                                  </span>
                                  <span style={`font-size:11px; color:${instance.status === "open" ? "var(--color-success)" : "var(--color-text-secondary)"};`}>
                                    {instance.status}
                                  </span>
                                </button>
                                <div style="display:flex; gap:6px; margin-top:6px;">
                                  <button
                                    onClick={() => { void handleCloseInstance(instance.id); }}
                                    disabled={isBusy() || instance.status !== "open"}
                                    style="font-size:11px; border:1px solid var(--color-border); border-radius:4px; background:var(--color-bg-secondary); color:var(--color-text); padding:3px 6px; cursor:pointer;"
                                  >
                                    Close
                                  </button>
                                  <button
                                    onClick={() => { void handleRemoveInstance(instance.id); }}
                                    disabled={isBusy()}
                                    style="font-size:11px; border:1px solid var(--color-border); border-radius:4px; background:var(--color-bg-secondary); color:var(--color-error); padding:3px 6px; cursor:pointer;"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            );
                          }}
                        </For>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </Show>
        </div>
      </aside>

      <main style="flex:1; display:flex; flex-direction:column; min-width:0;">
        <div style="padding:10px 12px; border-bottom:1px solid var(--color-border); display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <div>
            <div style="font-size:14px; font-weight:600;">
              {selectedLogical()?.name ?? "No database selected"}
            </div>
            <div style="font-size:12px; color:var(--color-text-secondary);">
              {selectedInstance()
                ? `Instance ${selectedInstance()!.instanceToken}`
                : "Select an open instance to inspect"}
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button
              onClick={() => { void refreshInventory(true); }}
              disabled={isBusy()}
              style="padding:6px 10px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-bg-secondary); color:var(--color-text); cursor:pointer;"
            >
              Refresh
            </button>
            <button
              onClick={() => { const id = selectedInstanceId(); if (id) { void handleCloseInstance(id); } }}
              disabled={isBusy() || !selectedInstance() || selectedInstance()!.status !== "open"}
              style="padding:6px 10px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-bg-secondary); color:var(--color-text); cursor:pointer;"
            >
              Close Instance
            </button>
            <button
              onClick={() => { const id = selectedInstanceId(); if (id) { void handleRemoveInstance(id); } }}
              disabled={isBusy() || !selectedInstance()}
              style="padding:6px 10px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-bg-secondary); color:var(--color-error); cursor:pointer;"
            >
              Remove Database
            </button>
          </div>
        </div>

        <Show when={selectedInstance() && activeInstanceId() === selectedInstanceId()} fallback={
          <div style="flex:1; display:flex; align-items:center; justify-content:center; color:var(--color-text-secondary); font-size:13px;">
            {selectedInstance()
              ? "This instance is not open. Select another instance."
              : "Select a database instance from the explorer."}
          </div>
        }>
          <div ref={debuggerContainerRef} style="flex:1; min-height:0;" />
        </Show>
      </main>
        </div>
      </Match>
      <Match when={true}>
        <LoadingScreen />
      </Match>
    </Switch>
  );
}

const root = document.getElementById("root");
if (root) {
  render(() => <Panel />, root);
}
