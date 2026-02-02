import { Observable, from, startWith, scan, map } from "rxjs";
import { shareReplay } from "rxjs/operators";
import { 
  evalInPage, 
  evalAsyncInPage, 
  getCollectionChanges, 
  getBridgeEvents,
} from "./bridge.js";

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
  collections: RemoteCollectionInfo[];
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

/**
 * Creates a remote database proxy that forwards all calls to the page via eval().
 */
export async function createRemoteDatabase(): Promise<unknown> {
  // Fetch database info including counts in one async call
  const dbInfo = await evalAsyncInPage<RemoteDatabaseInfo>(`
    (async function() {
      const db = window.__rxdb_handle;
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
      
      return { name: db.name, collections };
    })()
  `);

  if (!dbInfo) {
    throw new Error("No database found");
  }

  const collections: Record<string, unknown> = {};
  for (const colInfo of dbInfo.collections) {
    collections[colInfo.name] = createRemoteCollection(colInfo);
  }

  return {
    name: dbInfo.name,
    collections,
    $: getBridgeEvents(),
  };
}

function createRemoteCollection(info: RemoteCollectionInfo) {
  const { name, schema, count: initialCount } = info;

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

  const liveCount$ = collectionChanges$.pipe(
    map((event) => (event.operation === "INSERT" ? 1 : event.operation === "DELETE" ? -1 : 0)),
    scan((acc, delta) => Math.max(0, acc + delta), initialCount),
    startWith(initialCount),
    shareReplay(1)
  );

  return {
    name,
    schema: schemaObj,

    find(_queryObj?: Record<string, unknown>) {
      return createRemoteQuery(name, collectionRef);
    },

    findOne(primary?: string) {
      return createRemoteFindOne(name, collectionRef, primary);
    },

    count() {
      return {
        exec: async () => {
          return evalAsyncInPage<number>(`
            (async () => {
              const col = window.__rxdb_handle?.collections?.['${name}'];
              if (!col) return 0;
              return col.count().exec();
            })()
          `);
        },
        $: liveCount$,
      };
    },

    $: collectionChanges$,
  };
}

function createRemoteQuery(collectionName: string, collectionRef: { schema: { primaryPath: string } }) {
  let limitValue: number | undefined;
  let skipValue: number | undefined;

  const fetchDocs = async (): Promise<unknown[]> => {
    const limitClause = limitValue ? `.limit(${limitValue})` : "";
    const skipClause = skipValue ? `.skip(${skipValue})` : "";
    
    // Fetch plain JSON documents from the page
    const plainDocs = await evalAsyncInPage<Record<string, unknown>[]>(`
      (async () => {
        const col = window.__rxdb_handle?.collections?.['${collectionName}'];
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
      return from(fetchDocs()).pipe(shareReplay(1));
    },
  };

  return query;
}

function createRemoteFindOne(
  collectionName: string, 
  collectionRef: { schema: { primaryPath: string } },
  primary?: string
) {
  const fetchDoc = async (): Promise<unknown | null> => {
    if (!primary) return null;
    
    const plainDoc = await evalAsyncInPage<Record<string, unknown> | null>(`
      (async () => {
        const col = window.__rxdb_handle?.collections?.['${collectionName}'];
        if (!col) return null;
        const doc = await col.findOne('${primary}').exec();
        return doc ? (doc.toJSON ? doc.toJSON(true) : doc) : null;
      })()
    `);
    
    return plainDoc ? wrapDocument(plainDoc, collectionRef) : null;
  };

  return {
    exec: fetchDoc,
    get $(): Observable<unknown | null> {
      return from(fetchDoc()).pipe(shareReplay(1));
    },
  };
}

/**
 * Check if the page has an RxDB handle exposed.
 */
export async function waitForDatabase(maxAttempts = 20): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const hasHandle = await evalInPage<boolean>(
        "typeof window.__rxdb_handle !== 'undefined' && window.__rxdb_handle !== null"
      );
      if (hasHandle) return true;
    } catch {
      // Continue waiting
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
