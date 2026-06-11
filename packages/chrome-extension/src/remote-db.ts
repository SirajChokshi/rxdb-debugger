import { Observable, from } from "rxjs";
import { debounceTime, filter, map, scan, shareReplay, startWith, switchMap } from "rxjs/operators";
import { 
  evalInPage, 
  evalAsyncInPage, 
  getCollectionChanges, 
  getBridgeEvents,
} from "./bridge.js";

/**
 * Change events are drained from the page in batches; debounce briefly so a
 * burst of changes triggers a single refetch instead of one per event.
 */
const LIVE_REFETCH_DEBOUNCE_MS = 150;

type LiveFetchResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

type LiveStreamState<T> =
  | { hasValue: false; shouldEmit: false }
  | { hasValue: true; shouldEmit: boolean; value: T };

/**
 * Build a live observable that fetches on subscribe and refetches whenever a
 * relevant change event arrives. Fetching happens lazily (no work until the
 * first subscriber) and stops when the last subscriber leaves (refCount).
 *
 * Initial fetch failures surface to subscribers so loading states can clear.
 * Once a value has emitted, transient refetch failures are dropped and the
 * latest value stays current until the next change event retries.
 */
function createLiveStream<T>(
  changes$: Observable<unknown>,
  fetcher: () => Promise<T>,
): Observable<T> {
  return changes$.pipe(
    debounceTime(LIVE_REFETCH_DEBOUNCE_MS),
    startWith(null),
    switchMap(() =>
      from(
        fetcher().then(
          (value) => ({ ok: true as const, value }),
          (error) => ({ ok: false as const, error }),
        ),
      ),
    ),
    scan<LiveFetchResult<T>, LiveStreamState<T>>((state, result) => {
      if (result.ok) {
        return { hasValue: true, shouldEmit: true, value: result.value };
      }

      if (!state.hasValue) {
        throw result.error;
      }

      return { ...state, shouldEmit: false };
    }, { hasValue: false, shouldEmit: false }),
    filter((state): state is { hasValue: true; shouldEmit: true; value: T } =>
      state.hasValue && state.shouldEmit
    ),
    map((state) => state.value),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}

interface RemoteCollectionSchema {
  primaryPath: string;
  version: number;
  indexes: string[][];
  jsonSchema: Record<string, unknown>;
}

interface RemoteCollectionInfo {
  name: string;
  schema: RemoteCollectionSchema;
  count: number;
}

interface RemoteDatabaseInfo {
  name: string;
  instanceId: string;
  logicalDatabaseId: string;
  collections: RemoteCollectionInfo[];
}

export interface RemoteLogicalDatabaseInfo {
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

export interface RemoteDatabaseInstanceInfo {
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

interface RegistrySnapshot {
  logicalDatabases: Record<string, RemoteLogicalDatabaseInfo>;
  instances: Record<string, RemoteDatabaseInstanceInfo>;
}

/**
 * Wraps a plain JSON document to look like an RxDocument.
 * The core library calls doc.toJSON() and accesses doc.collection.schema.primaryPath
 */
function wrapDocument(data: Record<string, unknown>, collectionRef: { schema: { primaryPath: string } }) {
  const primaryPath = collectionRef.schema.primaryPath;
  const primaryValue = data[primaryPath];
  
  return {
    // The data itself
    ...data,
    
    // RxDocument-like interface
    toJSON(_withMetadata?: boolean) {
      return data;
    },
    
    // Collection reference for primaryPath lookup
    collection: collectionRef,
    
    // Primary key value
    primary: primaryValue,
  };
}

async function getRegistrySnapshot(): Promise<RegistrySnapshot | null> {
  try {
    return await evalInPage<RegistrySnapshot | null>(`
      (function () {
        const registry = window.__RXDB_DEBUGGER__;
        if (!registry || typeof registry.snapshot !== "function") {
          return null;
        }
        return registry.snapshot();
      })()
    `);
  } catch {
    return null;
  }
}

/**
 * List logical databases discovered by the auto-discovery plugin.
 */
export async function listRemoteLogicalDatabases(): Promise<RemoteLogicalDatabaseInfo[]> {
  const snapshot = await getRegistrySnapshot();
  if (!snapshot) {
    return [];
  }
  return Object.values(snapshot.logicalDatabases).sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    if (byName !== 0) {
      return byName;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * List discovered database instances, optionally by logical DB id.
 */
export async function listRemoteDatabaseInstances(
  logicalDatabaseId?: string,
): Promise<RemoteDatabaseInstanceInfo[]> {
  const snapshot = await getRegistrySnapshot();
  if (!snapshot) {
    return [];
  }
  return Object.values(snapshot.instances)
    .filter((instance) =>
      logicalDatabaseId ? instance.logicalDatabaseId === logicalDatabaseId : true
    )
    .sort((a, b) => {
      const byName = a.name.localeCompare(b.name);
      if (byName !== 0) {
        return byName;
      }
      return a.instanceToken.localeCompare(b.instanceToken);
    });
}

/**
 * Close a selected database instance through the registry.
 */
export async function closeRemoteDatabaseInstance(instanceId: string): Promise<boolean> {
  const instanceIdLiteral = JSON.stringify(instanceId);
  return evalAsyncInPage<boolean>(`
    (async function() {
      const registry = window.__RXDB_DEBUGGER__;
      if (!registry || typeof registry.closeInstance !== "function") {
        return false;
      }
      return registry.closeInstance(${instanceIdLiteral});
    })()
  `);
}

/**
 * Remove a selected database instance through the registry.
 */
export async function removeRemoteDatabaseInstance(instanceId: string): Promise<boolean> {
  const instanceIdLiteral = JSON.stringify(instanceId);
  return evalAsyncInPage<boolean>(`
    (async function() {
      const registry = window.__RXDB_DEBUGGER__;
      if (!registry || typeof registry.removeInstance !== "function") {
        return false;
      }
      return registry.removeInstance(${instanceIdLiteral});
    })()
  `);
}

/**
 * Creates a remote database proxy that forwards all calls to the page via eval().
 */
export async function createRemoteDatabase(instanceId: string): Promise<unknown> {
  const instanceIdLiteral = JSON.stringify(instanceId);
  // Fetch database info including counts in one async call
  const dbInfo = await evalAsyncInPage<RemoteDatabaseInfo>(`
    (async function() {
      const registry = window.__RXDB_DEBUGGER__;
      if (!registry || typeof registry.getInstanceHandle !== "function") {
        return null;
      }
      const db = registry.getInstanceHandle(${instanceIdLiteral});
      if (!db) return null;
      
      const collections = [];
      for (const [name, col] of Object.entries(db.collections || {})) {
        const schema = col.schema?.jsonSchema || {};
        const primaryPath = typeof schema.primaryKey === 'string' 
          ? schema.primaryKey 
          : (schema.primaryKey?.key || 'id');
        
        // Get count asynchronously
        let count = 0;
        try {
          count = await col.count().exec();
        } catch (e) {}
        
        collections.push({
          name,
          schema: {
            primaryPath,
            version: schema.version || 0,
            indexes: schema.indexes || [],
            jsonSchema: schema
          },
          count
        });
      }
      
      const snapshot = typeof registry.snapshot === "function" ? registry.snapshot() : null;
      let logicalDatabaseId = "";
      if (snapshot && snapshot.instances && snapshot.instances[${instanceIdLiteral}]) {
        logicalDatabaseId = snapshot.instances[${instanceIdLiteral}].logicalDatabaseId || "";
      }

      return { name: db.name, instanceId: ${instanceIdLiteral}, logicalDatabaseId, collections };
    })()
  `);

  if (!dbInfo) {
    throw new Error("No database instance found");
  }

  const collections: Record<string, unknown> = {};
  for (const colInfo of dbInfo.collections) {
    collections[colInfo.name] = createRemoteCollection(instanceId, colInfo);
  }

  return {
    name: dbInfo.name,
    instanceId: dbInfo.instanceId,
    logicalDatabaseId: dbInfo.logicalDatabaseId,
    collections,
    $: getBridgeEvents(),
  };
}

function createRemoteCollection(instanceId: string, info: RemoteCollectionInfo) {
  const { name, schema, count: initialCount } = info;
  const instanceIdLiteral = JSON.stringify(instanceId);
  const collectionNameLiteral = JSON.stringify(name);

  const schemaObj = {
    primaryPath: schema.primaryPath,
    version: schema.version,
    indexes: schema.indexes,
    jsonSchema: schema.jsonSchema,
  };

  const collectionRef = {
    name,
    schema: schemaObj,
  };

  const collectionChanges$ = getCollectionChanges(name);

  const fetchCount = async (): Promise<number> => {
    return evalAsyncInPage<number>(`
      (async () => {
        const registry = window.__RXDB_DEBUGGER__;
        const db = registry?.getInstanceHandle?.(${instanceIdLiteral});
        const col = db?.collections?.[${collectionNameLiteral}];
        if (!col) return 0;
        return col.count().exec();
      })()
    `);
  };

  // Re-count from the source of truth on every change instead of replaying
  // deltas: dropped or replayed events can never make the count drift.
  // initialCount is emitted synchronously so first paint doesn't wait for an
  // eval roundtrip.
  const liveCount$ = createLiveStream(collectionChanges$, fetchCount).pipe(
    startWith(initialCount),
  );

  return {
    name,
    schema: schemaObj,

    find(_queryObj?: Record<string, unknown>) {
      return createRemoteQuery(instanceId, name, collectionRef);
    },

    findOne(primary?: string) {
      return createRemoteFindOne(instanceId, name, collectionRef, primary);
    },

    count() {
      return {
        exec: fetchCount,
        $: liveCount$,
      };
    },

    $: collectionChanges$,
  };
}

function createRemoteQuery(
  instanceId: string,
  collectionName: string,
  collectionRef: { schema: { primaryPath: string } },
) {
  let limitValue: number | undefined;
  let skipValue: number | undefined;
  const instanceIdLiteral = JSON.stringify(instanceId);
  const collectionNameLiteral = JSON.stringify(collectionName);

  const fetchDocs = async (): Promise<unknown[]> => {
    const limitClause = limitValue ? `.limit(${limitValue})` : "";
    const skipClause = skipValue ? `.skip(${skipValue})` : "";
    
    // Fetch plain JSON documents from the page
    const plainDocs = await evalAsyncInPage<Record<string, unknown>[]>(`
      (async () => {
        const registry = window.__RXDB_DEBUGGER__;
        const db = registry?.getInstanceHandle?.(${instanceIdLiteral});
        const col = db?.collections?.[${collectionNameLiteral}];
        if (!col) return [];
        const docs = await col.find()${limitClause}${skipClause}.exec();
        return docs.map(d => d.toJSON ? d.toJSON(true) : d);
      })()
    `);
    
    // Wrap each document with RxDocument-like interface
    return plainDocs.map(doc => wrapDocument(doc, collectionRef));
  };

  const query = {
    limit(n: number) {
      limitValue = n;
      return query;
    },
    skip(n: number) {
      skipValue = n;
      return query;
    },
    sort(_sortObj: unknown) {
      return query;
    },
    exec: fetchDocs,
    get $(): Observable<unknown[]> {
      // Live like a real RxQuery: fetch on subscribe, refetch on changes to
      // this collection. Previously this emitted once and completed, so the
      // Documents panel never updated after the initial load.
      return createLiveStream(getCollectionChanges(collectionName), fetchDocs);
    },
  };

  return query;
}

function createRemoteFindOne(
  instanceId: string,
  collectionName: string, 
  collectionRef: { schema: { primaryPath: string } },
  primary?: string
) {
  const instanceIdLiteral = JSON.stringify(instanceId);
  const collectionNameLiteral = JSON.stringify(collectionName);
  const fetchDoc = async (): Promise<unknown | null> => {
    if (!primary) return null;
    const primaryLiteral = JSON.stringify(primary);
    
    const plainDoc = await evalAsyncInPage<Record<string, unknown> | null>(`
      (async () => {
        const registry = window.__RXDB_DEBUGGER__;
        const db = registry?.getInstanceHandle?.(${instanceIdLiteral});
        const col = db?.collections?.[${collectionNameLiteral}];
        if (!col) return null;
        const doc = await col.findOne(${primaryLiteral}).exec();
        return doc ? (doc.toJSON ? doc.toJSON(true) : doc) : null;
      })()
    `);
    
    return plainDoc ? wrapDocument(plainDoc, collectionRef) : null;
  };

  // Only changes to this specific document can affect the result.
  const relevantChanges$ = getCollectionChanges(collectionName).pipe(
    filter((event) => primary !== undefined && event.documentId === primary),
  );

  return {
    exec: fetchDoc,
    get $(): Observable<unknown | null> {
      return createLiveStream(relevantChanges$, fetchDoc);
    },
  };
}

/**
 * Check if the page has a debugger auto-discovery registry exposed.
 */
export async function waitForRegistry(maxAttempts = 20): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const hasRegistry = await evalInPage<boolean>(
        "typeof window.__RXDB_DEBUGGER__ !== 'undefined' && window.__RXDB_DEBUGGER__ !== null"
      );
      if (hasRegistry) return true;
    } catch {
      // Continue waiting
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
