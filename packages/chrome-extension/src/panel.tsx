import { mountDebugger } from "@rxdb-debugger/ui";
import { createRemoteDatabase, waitForDatabase } from "./remote-db";

function showNoDatabase(root: HTMLElement) {
  root.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
      <h2 style="margin: 0 0 8px; font-size: 18px; color: #fff;">No RxDB Handle Found</h2>
      <p style="margin: 0 0 16px; color: #888; font-size: 14px;">
        Make sure <code style="background: #333; padding: 2px 6px; border-radius: 4px; font-family: monospace;">window.__rxdb_handle</code> is set to your RxDB database instance.
      </p>
      <pre style="background: #111; padding: 16px; border-radius: 8px; font-size: 12px; color: #4ade80; text-align: left; font-family: monospace;">const db = await createRxDatabase({...});
window.__rxdb_handle = db;</pre>
      <button id="retry-btn" style="margin-top: 16px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
        Retry
      </button>
    </div>
  `;

  document.getElementById("retry-btn")?.addEventListener("click", () => init());
}

async function init() {
  const root = document.getElementById("root");
  if (!root) return;

  root.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; color: #888; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      Connecting to RxDB...
    </div>
  `;

  const hasDb = await waitForDatabase();

  if (!hasDb) {
    showNoDatabase(root);
    return;
  }

  try {
    const remoteDb = await createRemoteDatabase();

    root.innerHTML = "";
    
    mountDebugger({
      container: root,
      db: remoteDb,
      theme: "dark",
    });
  } catch (err) {
    root.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 32px; color: #ef4444; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
        <h2 style="margin: 0 0 8px; font-size: 18px;">Error connecting to database</h2>
        <p style="margin: 0; font-size: 14px; color: #888;">${err instanceof Error ? err.message : String(err)}</p>
      </div>
    `;
  }
}

init();
