import { createSignal, Match, Switch, onMount, onCleanup } from "solid-js";
import { render } from "solid-js/web";
import { mountDebugger } from "@rxdb-debugger/ui";
import { createRemoteDatabase, waitForDatabase } from "./remote-db";
import { initBridge, disposeBridge } from "./bridge";

type State =
  | { status: "loading" }
  | { status: "no-database" }
  | { status: "error"; message: string }
  | { status: "connected" };

const styles = {
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
  title: "margin: 0 0 8px; font-size: 18px; color: #fff;",
  subtitle: "margin: 0 0 16px; color: #888; font-size: 14px;",
  code: "background: #333; padding: 2px 6px; border-radius: 4px; font-family: monospace;",
  pre: `
    background: #111;
    padding: 16px;
    border-radius: 8px;
    font-size: 12px;
    color: #4ade80;
    text-align: left;
    font-family: monospace;
  `,
  button: `
    margin-top: 16px;
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  `,
  errorTitle: "margin: 0 0 8px; font-size: 18px; color: #ef4444;",
};

function LoadingScreen() {
  return (
    <div style={styles.container}>
      <div style="color: #888;">Connecting to RxDB...</div>
    </div>
  );
}

function NoDatabase(props: { onRetry: () => void }) {
  return (
    <div style={styles.container}>
      <div style={styles.icon}>🔍</div>
      <h2 style={styles.title}>No RxDB Handle Found</h2>
      <p style={styles.subtitle}>
        Make sure <code style={styles.code}>window.__rxdb_handle</code> is set
        to your RxDB database instance.
      </p>
      <pre style={styles.pre}>
        {`const db = await createRxDatabase({...});
window.__rxdb_handle = db;`}
      </pre>
      <button style={styles.button} onClick={props.onRetry}>
        Retry
      </button>
    </div>
  );
}

function ErrorScreen(props: { message: string }) {
  return (
    <div style={styles.container}>
      <div style={styles.icon}>❌</div>
      <h2 style={styles.errorTitle}>Error connecting to database</h2>
      <p style={styles.subtitle}>{props.message}</p>
    </div>
  );
}

function Panel() {
  const [state, setState] = createSignal<State>({ status: "loading" });
  let containerRef: HTMLDivElement | undefined;
  let debuggerCleanup: (() => void) | null = null;

  async function connect() {
    // Cleanup any previous instance
    if (debuggerCleanup) {
      debuggerCleanup();
      debuggerCleanup = null;
    }
    disposeBridge();

    setState({ status: "loading" });

    const hasDb = await waitForDatabase();
    if (!hasDb) {
      setState({ status: "no-database" });
      return;
    }

    try {
      // Initialize the event bridge
      await initBridge();

      const remoteDb = await createRemoteDatabase();
      setState({ status: "connected" });

      if (containerRef) {
        debuggerCleanup = mountDebugger({
          container: containerRef,
          db: remoteDb,
          theme: "dark",
        });
      }
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  onMount(() => {
    connect();

    // Listen for page navigation/reload
    chrome.devtools.network.onNavigated.addListener(() => {
      connect();
    });
  });

  onCleanup(() => {
    if (debuggerCleanup) {
      debuggerCleanup();
    }
    disposeBridge();
  });

  return (
    <Switch>
      <Match when={state().status === "loading"}>
        <LoadingScreen />
      </Match>
      <Match when={state().status === "no-database"}>
        <NoDatabase onRetry={connect} />
      </Match>
      <Match when={state().status === "error"}>
        <ErrorScreen message={(state() as { message: string }).message} />
      </Match>
      <Match when={state().status === "connected"}>
        <div ref={containerRef} style="width: 100%; height: 100vh;" />
      </Match>
    </Switch>
  );
}

const root = document.getElementById("root");
if (root) {
  render(() => <Panel />, root);
}
