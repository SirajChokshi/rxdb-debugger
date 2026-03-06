import { For, Match, Show, Switch, createEffect, createMemo, createSignal, onCleanup, onMount, type JSX } from "solid-js";
import type { ThemeMode } from "../styles/theme.js";
import { mountDebugger } from "../mount.js";
import type { PanelId } from "./Debugger.js";

type ExplorerStatus = "loading" | "setup-required" | "empty" | "ready" | "error";

export interface ExplorerDebuggerAdapter {
  isRegistryAvailable(): Promise<boolean>;
  listLogicalDatabases(): Promise<ExplorerLogicalDatabase[]>;
  listInstances(logicalDatabaseId?: string): Promise<ExplorerDatabaseInstance[]>;
  connectToInstance(instanceId: string): Promise<unknown>;
  disconnect?(): Promise<void>;
  closeInstance(instanceId: string): Promise<boolean>;
  removeInstance(instanceId: string): Promise<boolean>;
}

export interface ExplorerLogicalDatabase {
  id: string;
  name: string;
  storageName: string;
  multiInstance: boolean;
  status: "open" | "closing" | "closed" | "removed";
  createdAt: number;
  updatedAt: number;
  openInstanceCount: number;
  totalInstanceCount: number;
  hasPasswordConfigured: boolean;
  hasEncryptedFields: boolean;
  hasEncryptedAttachments: boolean;
  collectionNames: string[];
}

export interface ExplorerDatabaseInstance {
  id: string;
  logicalDatabaseId: string;
  name: string;
  storageName: string;
  multiInstance: boolean;
  status: "open" | "closing" | "closed" | "removed";
  instanceToken: string;
  createdAt: number;
  updatedAt: number;
  collectionNames: string[];
}

export interface ExplorerDebuggerProps {
  adapter: ExplorerDebuggerAdapter;
  width: string;
  height: string;
  setupSnippet: string;
  inspectorTheme: ThemeMode | (() => ThemeMode);
  initialPanel: PanelId;
  allowMutations: boolean;
  trackPerformance: boolean;
}

function LoadingView() {
  return (
    <div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--color-text-secondary);">
      Connecting to RxDB...
    </div>
  );
}

function SetupRequiredView(props: { setupSnippet: string; onRetry: () => void }) {
  return (
    <div
      style="
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        height:100%;
        text-align:center;
        padding:32px;
        gap:12px;
      "
    >
      <div style="font-size:40px;">🔍</div>
      <h2 style="margin:0; font-size:22px;">Auto-Discovery Plugin Required</h2>
      <p style="margin:0; color:var(--color-text-secondary); max-width:560px;">
        Install the RxDB Debugger auto-discovery plugin before creating your databases.
      </p>
      <pre
        style="
          max-width:640px;
          overflow:auto;
          background:var(--color-bg-secondary);
          border:1px solid var(--color-border);
          border-radius:8px;
          padding:14px;
          text-align:left;
          font-size:12px;
          color:var(--color-success);
        "
      >
        {props.setupSnippet}
      </pre>
      <button
        style="
          border:1px solid var(--color-border);
          border-radius:6px;
          background:var(--color-bg-secondary);
          color:var(--color-text);
          cursor:pointer;
          padding:8px 12px;
        "
        onClick={props.onRetry}
      >
        Retry
      </button>
    </div>
  );
}

function ErrorView(props: { message: string; onRetry: () => void }) {
  return (
    <div
      style="
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        height:100%;
        text-align:center;
        padding:32px;
        gap:10px;
      "
    >
      <div style="font-size:40px;">❌</div>
      <h2 style="margin:0; color:var(--color-error);">Error connecting to database</h2>
      <p style="margin:0; color:var(--color-text-secondary); max-width:520px;">{props.message}</p>
      <button
        style="
          border:1px solid var(--color-border);
          border-radius:6px;
          background:var(--color-bg-secondary);
          color:var(--color-text);
          cursor:pointer;
          padding:8px 12px;
        "
        onClick={props.onRetry}
      >
        Retry
      </button>
    </div>
  );
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

function getInitialSetupSnippet(): string {
  return `import { addRxPlugin } from "rxdb/plugins/core";
import { createRxdbDebuggerAutoDiscoveryPlugin } from "@rxdb-debugger/core";

addRxPlugin(createRxdbDebuggerAutoDiscoveryPlugin());`;
}

export function ExplorerDebugger(props: ExplorerDebuggerProps): JSX.Element {
  const [status, setStatus] = createSignal<ExplorerStatus>("loading");
  const [errorMessage, setErrorMessage] = createSignal("");
  const [logicalDatabases, setLogicalDatabases] = createSignal<ExplorerLogicalDatabase[]>([]);
  const [instances, setInstances] = createSignal<ExplorerDatabaseInstance[]>([]);
  const [selectedLogicalId, setSelectedLogicalId] = createSignal<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = createSignal<string | null>(null);
  const [activeInstanceId, setActiveInstanceId] = createSignal<string | null>(null);
  const [expandedLogicalIds, setExpandedLogicalIds] = createSignal<string[]>([]);
  const [isBusy, setIsBusy] = createSignal(false);

  let debuggerContainerRef: HTMLDivElement | undefined;
  let debuggerCleanup: (() => void) | null = null;
  let connectGeneration = 0;
  let loadingWatchdogId: number | undefined;

  const isEmpty = createMemo(() => status() === "empty");

  const selectedLogical = createMemo(() =>
    logicalDatabases().find((entry) => entry.id === selectedLogicalId()) ?? null
  );
  const selectedInstance = createMemo(() =>
    instances().find((entry) => entry.id === selectedInstanceId()) ?? null
  );
  const visibleInstances = createMemo(() => {
    const selectedId = selectedLogicalId();
    if (!selectedId) {
      return [] as ExplorerDatabaseInstance[];
    }
    return instances().filter((entry) => entry.logicalDatabaseId === selectedId);
  });

  const resolveInspectorTheme = (): ThemeMode => {
    if (typeof props.inspectorTheme === "function") {
      return props.inspectorTheme();
    }
    return props.inspectorTheme;
  };

  const isExpanded = (logicalId: string): boolean => expandedLogicalIds().includes(logicalId);

  const toggleExpanded = (logicalId: string): void => {
    setExpandedLogicalIds((prev) =>
      prev.includes(logicalId)
        ? prev.filter((entry) => entry !== logicalId)
        : [...prev, logicalId]
    );
  };

  const disconnectDebugger = async (): Promise<void> => {
    if (debuggerCleanup) {
      debuggerCleanup();
      debuggerCleanup = null;
    }
    setActiveInstanceId(null);
    if (props.adapter.disconnect) {
      await props.adapter.disconnect();
    }
  };

  const pickInstanceForLogical = (
    logicalId: string,
    preferredInstanceId: string | null,
    currentInstances: ExplorerDatabaseInstance[],
  ): string | null => {
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
  };

  const connectToInstance = async (instanceId: string): Promise<void> => {
    const generation = ++connectGeneration;
    setStatus("loading");

    await disconnectDebugger();
    if (generation !== connectGeneration) return;

    try {
      const debuggerDbInput = await withTimeout(
        props.adapter.connectToInstance(instanceId),
        8000,
        "Timed out while connecting to the selected RxDB instance",
      );
      if (generation !== connectGeneration) return;

      setActiveInstanceId(instanceId);
      setStatus("ready");
      const container = await waitForDebuggerContainer(() => debuggerContainerRef);

      debuggerCleanup = mountDebugger({
        container,
        db: debuggerDbInput,
        theme: resolveInspectorTheme(),
        initialPanel: props.initialPanel,
        allowMutations: props.allowMutations,
        trackPerformance: props.trackPerformance,
        width: "100%",
        height: "100%",
      });
    } catch (error) {
      if (generation !== connectGeneration) return;
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const refreshInventory = async (preserveSelection: boolean): Promise<void> => {
    setStatus("loading");

    try {
      const hasRegistry = await withTimeout(
        props.adapter.isRegistryAvailable(),
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
        props.adapter.listLogicalDatabases(),
        6000,
        "Timed out while loading logical databases",
      );
      const nextInstances = await withTimeout(
        props.adapter.listInstances(),
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
  };

  const withBusyAction = async (action: () => Promise<void>): Promise<void> => {
    if (isBusy()) {
      return;
    }
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  };

  const handleCloseInstance = async (instanceId: string): Promise<void> => {
    await withBusyAction(async () => {
      await props.adapter.closeInstance(instanceId);
      await refreshInventory(true);
    });
  };

  const handleRemoveInstance = async (instanceId: string): Promise<void> => {
    if (!window.confirm("Remove this database instance and underlying data?")) {
      return;
    }

    await withBusyAction(async () => {
      await props.adapter.removeInstance(instanceId);
      await refreshInventory(true);
    });
  };

  const handleSelectLogical = async (logicalId: string): Promise<void> => {
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
  };

  const handleSelectInstance = async (instanceId: string): Promise<void> => {
    setSelectedInstanceId(instanceId);
    await connectToInstance(instanceId);
  };

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
          "Timed out while connecting to the inspected page. Reload and retry.",
        );
      }
    }, 15000);
  });

  onMount(() => {
    void refreshInventory(false);
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
    <div
      class="rxdb-debugger"
      style={{
        width: props.width,
        height: props.height,
      }}
    >
      <Switch>
        <Match when={status() === "loading"}>
          <LoadingView />
        </Match>
        <Match when={status() === "setup-required"}>
          <SetupRequiredView
            setupSnippet={props.setupSnippet}
            onRetry={() => { void refreshInventory(false); }}
          />
        </Match>
        <Match when={status() === "error"}>
          <ErrorView
            message={errorMessage()}
            onRetry={() => { void refreshInventory(true); }}
          />
        </Match>
        <Match when={status() === "ready" || status() === "empty"}>
          <div style="height:100%; display:flex; background:var(--color-bg); color:var(--color-text);">
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
                              <span
                                title={logicalDb.hasEncryptedFields
                                  ? "This logical database has encrypted schema fields"
                                  : "This logical database has no encrypted schema fields"}
                                style={`font-size:11px; border:1px solid var(--color-border); border-radius:999px; padding:1px 6px; color:${logicalDb.hasEncryptedFields ? "var(--color-warning)" : "var(--color-text-secondary)"};`}
                              >
                                fields: {logicalDb.hasEncryptedFields ? "encrypted" : "none"}
                              </span>
                              <span
                                title={logicalDb.hasEncryptedAttachments
                                  ? "This logical database has encrypted attachments"
                                  : "This logical database has no encrypted attachments"}
                                style={`font-size:11px; border:1px solid var(--color-border); border-radius:999px; padding:1px 6px; color:${logicalDb.hasEncryptedAttachments ? "var(--color-warning)" : "var(--color-text-secondary)"};`}
                              >
                                attachments: {logicalDb.hasEncryptedAttachments ? "encrypted" : "none"}
                              </span>
                              <span
                                title={logicalDb.hasPasswordConfigured
                                  ? "A database password was configured at creation"
                                  : "No database password was configured at creation"}
                                style={`font-size:11px; border:1px solid var(--color-border); border-radius:999px; padding:1px 6px; color:${logicalDb.hasPasswordConfigured ? "var(--color-warning)" : "var(--color-text-secondary)"};`}
                              >
                                password: {logicalDb.hasPasswordConfigured ? "yes" : "no"}
                              </span>
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
                    onClick={() => {
                      const id = selectedInstanceId();
                      if (id) {
                        void handleCloseInstance(id);
                      }
                    }}
                    disabled={isBusy() || !selectedInstance() || selectedInstance()!.status !== "open"}
                    style="padding:6px 10px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-bg-secondary); color:var(--color-text); cursor:pointer;"
                  >
                    Close Instance
                  </button>
                  <button
                    onClick={() => {
                      const id = selectedInstanceId();
                      if (id) {
                        void handleRemoveInstance(id);
                      }
                    }}
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
          <LoadingView />
        </Match>
      </Switch>
    </div>
  );
}

export function getDefaultSetupSnippet(): string {
  return getInitialSetupSnippet();
}

