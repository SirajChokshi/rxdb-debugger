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

function NoDatabase(props: { onRetry: () => void }) {
  const styles = getStyles();
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
        // Use DevTools theme API for extension panels
        const theme = getDevToolsTheme();
        debuggerCleanup = mountDebugger({
          container: containerRef,
          db: remoteDb,
          theme,
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
    let lastTheme = getDevToolsTheme();
    
    connect();

    // Listen for page navigation/reload
    chrome.devtools.network.onNavigated.addListener(() => {
      connect();
    });

    // Check for theme changes when panel becomes visible
    // (DevTools was closed and reopened with different theme)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const currentTheme = getDevToolsTheme();
        if (currentTheme !== lastTheme) {
          lastTheme = currentTheme;
          // Theme changed, reconnect to apply new theme
          connect();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    onCleanup(() => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
