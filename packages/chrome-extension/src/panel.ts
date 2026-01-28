import { render } from "solid-js/web";
import { createSignal, onMount, onCleanup, For, Show, createEffect } from "solid-js";

interface CollectionInfo {
  name: string;
  count: number;
  primaryKey: string;
}

interface DatabaseInfo {
  name: string;
  collections: CollectionInfo[];
}

interface DocumentData {
  [key: string]: unknown;
}

type PanelTab = "collections" | "documents";

function evalInPage<T>(expression: string): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval(expression, (result, exceptionInfo) => {
      if (exceptionInfo) {
        reject(new Error(exceptionInfo.value || "Eval failed"));
      } else {
        resolve(result as T);
      }
    });
  });
}

async function checkForHandle(): Promise<boolean> {
  try {
    const result = await evalInPage<boolean>("typeof window.__rxdb_handle !== 'undefined' && window.__rxdb_handle !== null");
    return result;
  } catch {
    return false;
  }
}

async function getDatabaseInfo(): Promise<DatabaseInfo | null> {
  try {
    const info = await evalInPage<DatabaseInfo>(`
      (function() {
        const db = window.__rxdb_handle;
        if (!db) return null;
        
        const collections = [];
        for (const [name, col] of Object.entries(db.collections || {})) {
          collections.push({
            name: name,
            count: -1,
            primaryKey: col.schema?.primaryPath || 'id'
          });
        }
        
        return {
          name: db.name || 'unknown',
          collections: collections
        };
      })()
    `);
    return info;
  } catch {
    return null;
  }
}

async function getCollectionCount(collectionName: string): Promise<number> {
  try {
    const count = await evalInPage<number>(`
      (async function() {
        const db = window.__rxdb_handle;
        if (!db || !db.collections['${collectionName}']) return 0;
        return await db.collections['${collectionName}'].count().exec();
      })()
    `);
    return count;
  } catch {
    return 0;
  }
}

async function getDocuments(collectionName: string, limit = 50): Promise<DocumentData[]> {
  try {
    const docs = await evalInPage<DocumentData[]>(`
      (async function() {
        const db = window.__rxdb_handle;
        if (!db || !db.collections['${collectionName}']) return [];
        const docs = await db.collections['${collectionName}'].find().limit(${limit}).exec();
        return docs.map(d => d.toJSON ? d.toJSON(true) : d);
      })()
    `);
    return docs || [];
  } catch {
    return [];
  }
}

function Panel() {
  const [hasHandle, setHasHandle] = createSignal(false);
  const [isChecking, setIsChecking] = createSignal(true);
  const [dbInfo, setDbInfo] = createSignal<DatabaseInfo | null>(null);
  const [selectedCollection, setSelectedCollection] = createSignal<string | null>(null);
  const [documents, setDocuments] = createSignal<DocumentData[]>([]);
  const [activeTab, setActiveTab] = createSignal<PanelTab>("collections");
  const [collectionCounts, setCollectionCounts] = createSignal<Record<string, number>>({});

  let checkInterval: ReturnType<typeof setInterval>;

  async function refresh() {
    setIsChecking(true);
    const found = await checkForHandle();
    setHasHandle(found);

    if (found) {
      const info = await getDatabaseInfo();
      setDbInfo(info);
      
      if (info) {
        const counts: Record<string, number> = {};
        for (const col of info.collections) {
          counts[col.name] = await getCollectionCount(col.name);
        }
        setCollectionCounts(counts);
      }
    } else {
      setDbInfo(null);
      setSelectedCollection(null);
      setDocuments([]);
    }

    setIsChecking(false);
  }

  onMount(() => {
    refresh();
    checkInterval = setInterval(refresh, 5000);
  });

  onCleanup(() => {
    clearInterval(checkInterval);
  });

  createEffect(async () => {
    const col = selectedCollection();
    if (col) {
      const docs = await getDocuments(col);
      setDocuments(docs);
      setActiveTab("documents");
    }
  });

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>RxDB Debugger</h1>
        <button onClick={refresh} style={styles.refreshButton} disabled={isChecking()}>
          {isChecking() ? "Checking..." : "Refresh"}
        </button>
      </header>

      <Show when={!hasHandle()}>
        <div style={styles.noHandle}>
          <div style={styles.noHandleIcon}>🔍</div>
          <h2 style={styles.noHandleTitle}>No RxDB Handle Found</h2>
          <p style={styles.noHandleText}>
            Make sure <code style={styles.code}>window.__rxdb_handle</code> is set to your RxDB database instance.
          </p>
          <pre style={styles.codeBlock}>
{`// In your app:
const db = await createRxDatabase({...});
window.__rxdb_handle = db;`}
          </pre>
        </div>
      </Show>

      <Show when={hasHandle() && dbInfo()}>
        <div style={styles.dbInfo}>
          <span style={styles.dbLabel}>Database:</span>
          <span style={styles.dbName}>{dbInfo()?.name}</span>
          <span style={styles.collectionCount}>
            {dbInfo()?.collections.length} collection(s)
          </span>
        </div>

        <div style={styles.tabs}>
          <button
            style={activeTab() === "collections" ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab("collections")}
          >
            Collections
          </button>
          <button
            style={activeTab() === "documents" ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab("documents")}
          >
            Documents
          </button>
        </div>

        <Show when={activeTab() === "collections"}>
          <div style={styles.collectionList}>
            <For each={dbInfo()?.collections}>
              {(col) => (
                <div
                  style={{
                    ...styles.collectionItem,
                    ...(selectedCollection() === col.name ? styles.collectionItemSelected : {}),
                  }}
                  onClick={() => setSelectedCollection(col.name)}
                >
                  <span style={styles.collectionName}>{col.name}</span>
                  <span style={styles.collectionMeta}>
                    {collectionCounts()[col.name] ?? "..."} docs • pk: {col.primaryKey}
                  </span>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={activeTab() === "documents"}>
          <Show when={selectedCollection()}>
            <div style={styles.documentsHeader}>
              <h3 style={styles.documentsTitle}>{selectedCollection()}</h3>
              <span style={styles.docCount}>{documents().length} documents</span>
            </div>
            <div style={styles.documentsList}>
              <For each={documents()}>
                {(doc) => (
                  <pre style={styles.documentItem}>
                    {JSON.stringify(doc, null, 2)}
                  </pre>
                )}
              </For>
              <Show when={documents().length === 0}>
                <div style={styles.emptyDocs}>No documents found</div>
              </Show>
            </div>
          </Show>
          <Show when={!selectedCollection()}>
            <div style={styles.selectPrompt}>Select a collection to view documents</div>
          </Show>
        </Show>
      </Show>
    </div>
  );
}

const styles: Record<string, Record<string, string>> = {
  container: {
    display: "flex",
    "flex-direction": "column",
    height: "100vh",
    background: "#1a1a1a",
    color: "#e0e0e0",
  },
  header: {
    display: "flex",
    "justify-content": "space-between",
    "align-items": "center",
    padding: "12px 16px",
    "border-bottom": "1px solid #333",
    background: "#222",
  },
  title: {
    margin: "0",
    "font-size": "16px",
    "font-weight": "600",
    color: "#fff",
  },
  refreshButton: {
    padding: "6px 12px",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    "border-radius": "4px",
    cursor: "pointer",
    "font-size": "12px",
  },
  noHandle: {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    flex: "1",
    padding: "32px",
    "text-align": "center",
  },
  noHandleIcon: {
    "font-size": "48px",
    "margin-bottom": "16px",
  },
  noHandleTitle: {
    margin: "0 0 8px",
    "font-size": "18px",
    color: "#fff",
  },
  noHandleText: {
    margin: "0 0 16px",
    color: "#888",
    "font-size": "14px",
  },
  code: {
    background: "#333",
    padding: "2px 6px",
    "border-radius": "4px",
    "font-family": "monospace",
    "font-size": "13px",
  },
  codeBlock: {
    background: "#111",
    padding: "16px",
    "border-radius": "8px",
    "font-family": "monospace",
    "font-size": "12px",
    "text-align": "left",
    color: "#4ade80",
    "white-space": "pre-wrap",
    "max-width": "400px",
  },
  dbInfo: {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 16px",
    background: "#252525",
    "border-bottom": "1px solid #333",
    "font-size": "13px",
  },
  dbLabel: {
    color: "#888",
  },
  dbName: {
    color: "#4ade80",
    "font-weight": "500",
  },
  collectionCount: {
    color: "#666",
    "margin-left": "auto",
  },
  tabs: {
    display: "flex",
    gap: "4px",
    padding: "8px 16px",
    "border-bottom": "1px solid #333",
  },
  tab: {
    padding: "6px 12px",
    background: "transparent",
    color: "#888",
    border: "none",
    "border-radius": "4px",
    cursor: "pointer",
    "font-size": "13px",
  },
  tabActive: {
    padding: "6px 12px",
    background: "#333",
    color: "#fff",
    border: "none",
    "border-radius": "4px",
    cursor: "pointer",
    "font-size": "13px",
  },
  collectionList: {
    flex: "1",
    overflow: "auto",
    padding: "8px",
  },
  collectionItem: {
    padding: "12px",
    background: "#252525",
    "border-radius": "6px",
    "margin-bottom": "4px",
    cursor: "pointer",
    display: "flex",
    "justify-content": "space-between",
    "align-items": "center",
  },
  collectionItemSelected: {
    background: "#3b82f6",
  },
  collectionName: {
    "font-weight": "500",
    color: "#fff",
  },
  collectionMeta: {
    "font-size": "12px",
    color: "#888",
  },
  documentsHeader: {
    display: "flex",
    "align-items": "center",
    gap: "12px",
    padding: "12px 16px",
    "border-bottom": "1px solid #333",
  },
  documentsTitle: {
    margin: "0",
    "font-size": "14px",
    color: "#fff",
  },
  docCount: {
    "font-size": "12px",
    color: "#666",
  },
  documentsList: {
    flex: "1",
    overflow: "auto",
    padding: "8px",
  },
  documentItem: {
    background: "#111",
    padding: "12px",
    "border-radius": "6px",
    "margin-bottom": "4px",
    "font-family": "monospace",
    "font-size": "11px",
    "white-space": "pre-wrap",
    "word-break": "break-all",
    color: "#e0e0e0",
  },
  emptyDocs: {
    padding: "32px",
    "text-align": "center",
    color: "#666",
  },
  selectPrompt: {
    flex: "1",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    color: "#666",
  },
};

const root = document.getElementById("root");
if (root) {
  render(() => Panel(), root);
}
