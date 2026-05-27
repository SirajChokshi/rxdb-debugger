# RxDB Debugger

A zero-dependency, framework-agnostic debugger for RxDB databases. Provides a headless API and a portable SolidJS UI that can be mounted into any application.

## Features

- **Schema Inspector**: Browse collections, view property types, constraints, indexes, and relationships
- **Document Browser**: List, search, compare, and edit documents with live updates
- **Query Playground**: Build and test Mango queries with timing and index analysis
- **Event Stream**: Watch document changes in real-time across all collections
- **Replication Monitoring**: Inspect replication state, activity, and errors per collection
- **Performance Tracking**: Auto-instrument RxDB operations with query-plan diagnostics and setup-aware recommendations
- **Export/Import**: Export collections or entire database to JSON, import data

## Installation

```bash
npm install rxdb-debugger
```

**Peer Dependencies:** `rxdb@>=15.0.0`, `rxjs@>=7.0.0`

## Quick Start

### Headless API

```typescript
import { RxdbDebugger } from "rxdb-debugger";
import { getDatabase } from "./my-db";

const debugger = new RxdbDebugger({
  db: getDatabase,
  trackPerformance: true,
});

// Browse collections
const collections = await debugger.catalog.collections().get();
console.log(collections);

// Query documents
const docs = await debugger.documents.list("users", { limit: 10 }).get();

// Get schema details
const schema = await debugger.schema.getSchema("users").get();

// Stream events
debugger.events.stream().observe().subscribe(event => {
  console.log("Change:", event.operation, event.collection, event.documentId);
});

// Execute queries
const result = await debugger.query.execute("users", {
  selector: { age: { $gte: 18 } },
  limit: 25,
}).get();

// Export data
const json = await debugger.export.exportCollection("users");

// Cleanup
debugger.dispose();
```

### Mounted UI

```typescript
import { mountDebugger } from "rxdb-debugger/ui";
import { getDatabase } from "./my-db";

const unmount = mountDebugger({
  container: "#debug-panel",
  db: getDatabase,
  theme: "dark",
  allowMutations: false,
});

// Later: cleanup
unmount();
```

### Mounted Explorer UI (Feature Parity with Extension)

If you want the same database explorer shell used by the DevTools extension (logical DBs, instances, close/remove actions), mount the explorer UI:

```typescript
import { mountExplorerDebugger } from "rxdb-debugger/ui";

const unmount = mountExplorerDebugger({
  container: "#debug-panel",
  adapter: {
    async isRegistryAvailable() {
      return typeof window.__RXDB_DEBUGGER__?.snapshot === "function";
    },
    async listLogicalDatabases() {
      return Object.values(window.__RXDB_DEBUGGER__.snapshot().logicalDatabases);
    },
    async listInstances(logicalDatabaseId) {
      const instances = Object.values(window.__RXDB_DEBUGGER__.snapshot().instances);
      return logicalDatabaseId
        ? instances.filter((instance) => instance.logicalDatabaseId === logicalDatabaseId)
        : instances;
    },
    async connectToInstance(instanceId) {
      return window.__RXDB_DEBUGGER__.getInstanceHandle(instanceId);
    },
    async closeInstance(instanceId) {
      return window.__RXDB_DEBUGGER__.closeInstance(instanceId);
    },
    async removeInstance(instanceId) {
      return window.__RXDB_DEBUGGER__.removeInstance(instanceId);
    },
  },
  shellTheme: "auto",
  inspectorTheme: "auto",
});
```

### Chrome Extension Auto-Discovery (No Manual Window Handles)

To let the DevTools extension discover and manage all RxDB databases automatically, install the auto-discovery plugin once before creating databases:

```typescript
import { addRxPlugin } from "rxdb/plugins/core";
import { createRxdbDebuggerAutoDiscoveryPlugin } from "rxdb-debugger";

addRxPlugin(createRxdbDebuggerAutoDiscoveryPlugin());
```

If you prefer a helper that is safe to call more than once:

```typescript
import { installRxdbDebuggerAutoDiscovery } from "rxdb-debugger";

installRxdbDebuggerAutoDiscovery();
```

With auto-discovery enabled, the extension can:
- detect multiple logical databases
- show multiple active instances/handles per database
- close/remove databases from the explorer UI

No `window.__rxdb_handle` assignment is required.

### Encryption Metadata Productization

The auto-discovery registry includes non-secret encryption metadata so the extension can show encryption badges without manual wiring:

- whether a database password is configured
- whether any collection has encrypted fields
- whether any collection uses encrypted attachments

This metadata is derived from RxDB schema and creation options only. Raw password values are never exposed through the registry.

## API Reference

### RxdbDebugger

Main entry point for the headless debugger API.

```typescript
const debugger = new RxdbDebugger({
  db: myDatabase,           // RxDatabase | Promise | factory
  trackPerformance: false,  // Enable performance tracking on init
  eventBufferSize: 100,     // Max events to buffer
  performanceLogSize: 500,  // Max operations to track
  queryHistorySize: 50,     // Max queries to remember
});
```

#### Services

| Service | Description |
|---------|-------------|
| `catalog` | Browse collections, get counts and metadata |
| `documents` | List, find, compare, delete, update documents |
| `schema` | Inspect schemas, properties, indexes, relationships |
| `query` | Execute and explain Mango queries |
| `events` | Stream document changes |
| `replication` | Inspect replication state and sync activity |
| `performance` | Auto-track storage/query/write performance with diagnostics and insights |
| `export` | Export/import data as JSON |
| `metadata` | Database-level information |

### CatalogService

```typescript
// All collections with live counts
debugger.catalog.collections({ live: true }).observe().subscribe(console.log);

// Single collection info
const userInfo = await debugger.catalog.collection("users").get();

// Collection names only
const names = await debugger.catalog.collectionNames().get();
```

### DocumentsService

```typescript
// List with filtering and pagination
const docs = await debugger.documents.list("users", {
  selector: { status: "active" },
  sort: [{ createdAt: "desc" }],
  skip: 0,
  limit: 25,
  live: true,
}).get();

// Find by ID
const doc = await debugger.documents.findById("users", "user-123").get();

// Find multiple by IDs
const docs = await debugger.documents.findByIds("users", ["id1", "id2"]).get();

// Compare two documents
const diff = debugger.documents.compare(docA, docB);
// { equal: false, changes: [{ path: "name", type: "changed", oldValue: "A", newValue: "B" }] }

// Delete document
await debugger.documents.delete("users", "user-123");

// Update document
const updated = await debugger.documents.update("users", "user-123", { name: "New Name" });

// Insert document
const inserted = await debugger.documents.insert("users", { id: "new-id", name: "John" });
```

### SchemaService

```typescript
// Get detailed schema
const schema = await debugger.schema.getSchema("users").get();
// {
//   name: "users",
//   version: 0,
//   primaryKey: "id",
//   properties: [
//     { path: "id", name: "id", type: "string", required: true, maxLength: 36 },
//     { path: "email", name: "email", type: "string", required: true, pattern: "..." },
//     { path: "profile", name: "profile", type: "object", properties: [...] },
//   ],
//   indexes: [{ fields: ["email"], compound: false }],
// }

// Get all relationships (foreign keys)
const relationships = await debugger.schema.getRelationships().get();
// [{ from: { collection: "posts", field: "authorId" }, to: { collection: "users" } }]

// Get all schemas
const schemas = await debugger.schema.getAllSchemas().get();
```

### QueryService

```typescript
// Execute a query
const result = await debugger.query.execute("users", {
  selector: { age: { $gte: 18 } },
  sort: [{ age: "asc" }],
  limit: 10,
}).get();
// { documents: [...], count: 10, duration: 12.5, live: false }

// Live query
debugger.query.execute("users", { selector: {} }, { live: true })
  .observe()
  .subscribe(result => console.log("Updated:", result.count));

// Explain query (index analysis)
const explanation = await debugger.query.explain("users", {
  selector: { email: { $eq: "test@example.com" } },
}).get();
// {
//   usesIndex: true,
//   indexFields: ["email"],
//   plannerIndex: ["_deleted", "email", "id"],
//   selectorSatisfiedByIndex: true,
//   sortSatisfiedByIndex: true,
//   hasManualIndex: false,
//   uncoveredFields: [],
//   efficiency: "index-only",
//   suggestions: [],
// }

// Get query history
const history = await debugger.query.getHistory({ limit: 10 }).get();
```

### EventsService

```typescript
// Stream all changes
const sub = debugger.events.stream().observe().subscribe(event => {
  console.log(event.operation, event.collection, event.documentId);
  // INSERT users user-123
});

// Filter by collection
debugger.events.stream({ collections: ["users", "posts"] }).observe();

// Filter by operation
debugger.events.stream({ operations: ["INSERT", "DELETE"] }).observe();

// Get event history
const history = await debugger.events.history({ limit: 50 }).get();

// Pause/resume
debugger.events.pause();
debugger.events.resume();

// Clear buffer
debugger.events.clear();
```

### ReplicationService

```typescript
// Snapshot of all replication states
const states = await debugger.replication.states().get();
// [
//   {
//     collection: "songs",
//     replicationIdentifier: "mock-songs-sync",
//     isActive: true,
//     isInSync: false,
//     sentCount: 42,
//     receivedCount: 13,
//     errorCount: 0,
//   }
// ]

// Per-collection summary
const summaries = await debugger.replication.collectionSummaries().get();
// [{ collection: "songs", totalStates: 1, totalSent: 42, totalReceived: 13, ... }]

// Control actions
await debugger.replication.reSync("songs", "mock-songs-sync");
await debugger.replication.pause("songs", "mock-songs-sync");
await debugger.replication.start("songs", "mock-songs-sync");
```

### PerformanceService

```typescript
// Start tracking
debugger.performance.start();

// Get metrics
const metrics = await debugger.performance.getMetrics().get();
// {
//   totalOperations: 150,
//   operationsByType: { query: 90, count: 30, bulkInsert: 5, update: 25 },
//   operationsByCollection: { users: 80, posts: 70 },
//   averageDuration: 5.2,            // ms
//   operationsPerSecond: 12.4,       // ops/s
//   latency: { p50: 2.1, p95: 16.8, p99: 45.0, min: 0.8, max: 98.2 },
//   queryStats: {
//     totalQueries: 120,
//     fullScanCandidates: 8,
//     manualSortCandidates: 3,
//     slowCounts: 2,
//     fastCounts: 28
//   },
//   writeStats: {
//     totalWrites: 40,
//     totalRows: 62,
//     singleRowWrites: 24,
//     averageRowsPerWrite: 1.55
//   },
//   profile: {
//     storageName: "dexie",
//     eventReduce: true,
//     multiInstance: true,
//     allowSlowCount: false
//   },
//   insights: [{ severity: "warning", title: "...", recommendation: "..." }],
//   slowestOperations: [...],
// }

// Get recent operations with diagnostics
const operations = await debugger.performance.getOperations({ limit: 50 }).get();
// each operation can include queryPlan/countMode/bulkWrite context diagnostics

// Get slow operations
const slowOps = await debugger.performance.getSlowOperations(100).get(); // >100ms

// Track custom operation
const result = await debugger.performance.track(
  "find",
  "users",
  () => collection.find().exec(),
  (docs) => docs.length,
);

// Stop tracking
debugger.performance.stop();

// Clear metrics
debugger.performance.clear();

// Dispose instrumentation
debugger.performance.dispose();
```

### ExportService

```typescript
// Export collection to JSON string
const json = await debugger.export.exportCollection("users", {
  includeMetadata: false,
  pretty: true,
});

// Export query results
const json = await debugger.export.exportQuery("users", {
  selector: { status: "active" },
});

// Export entire database
const backup = await debugger.export.exportDatabase();

// Download as file (browser only)
await debugger.export.downloadCollection("users", "users-backup.json");
await debugger.export.downloadDatabase("my-db-backup.json");

// Import documents
const result = await debugger.export.importDocuments("users", json, { upsert: true });
// { inserted: 10, updated: 5, failed: 0, errors: [] }

// Import full database backup
const results = await debugger.export.importDatabase(backupJson);

// Parse and validate export without importing
const parsed = debugger.export.parseExport(json);
```

## UI Reference

### mountDebugger

Mount the debugger UI into any container.

```typescript
import { mountDebugger } from "rxdb-debugger/ui";

const unmount = mountDebugger({
  container: "#debug-panel",  // CSS selector or HTMLElement
  db: getDatabase,            // RxDatabase | Promise | factory

  // Optional
  theme: "dark",              // "dark" | "light"
  initialPanel: "collections", // Panel to show first
  allowMutations: false,      // Enable delete/update/import
  trackPerformance: false,    // Start tracking on mount
  width: "100%",
  height: "100%",
  eventBufferSize: 100,
});

// Cleanup
unmount();
```

### UI Panels

| Panel | Description |
|-------|-------------|
| **Collections** | Browse collections, view schemas, properties, indexes |
| **Documents** | List, search, compare documents. Edit/delete if mutations enabled |
| **Query** | Build and test Mango queries with JSON editor |
| **Replication** | Monitor replication/sync state, counters, and errors |
| **Events** | Live stream of document changes with filtering |
| **Performance** | Operation metrics, slow query analysis |
| **Export** | Export/import data as JSON files |

### Framework Integration

#### React

```tsx
import { useEffect, useRef } from "react";
import { mountDebugger } from "rxdb-debugger/ui";
import { getDatabase } from "./db";

function RxdbDebugger() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const unmount = mountDebugger({
      container: containerRef.current,
      db: getDatabase,
      theme: "dark",
    });

    return unmount;
  }, []);

  return <div ref={containerRef} style={{ height: 500 }} />;
}
```

#### Vue

```vue
<template>
  <div ref="container" style="height: 500px" />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { mountDebugger } from 'rxdb-debugger/ui';
import { getDatabase } from './db';

const container = ref(null);
let unmount;

onMounted(() => {
  unmount = mountDebugger({
    container: container.value,
    db: getDatabase,
    theme: 'dark',
  });
});

onUnmounted(() => unmount?.());
</script>
```

#### Vanilla JS

```html
<div id="rxdb-debugger"></div>
<script type="module">
  import { mountDebugger } from "rxdb-debugger/ui";
  import { createDatabase } from "./db.js";

  mountDebugger({
    container: "#rxdb-debugger",
    db: createDatabase,
    theme: "dark",
    height: "600px",
  });
</script>
```

## Example App

A working Vue example is available in [`examples/vue`](../../examples/vue). It demonstrates:

- RxDB music catalog with nine related collections
- Live document lists with reactive subscriptions
- Playlist management and friends activity sidebar
- Event log showing change events
- Mounted explorer debugger UI with mock replication

To run the example:

```bash
# Build the core package first
bun run build

# Install and run the example
cd examples/vue
bun install
bun run dev
```

## ExplorerQuery Pattern

All service methods return an `ExplorerQuery<T>` that supports both imperative and reactive access:

```typescript
interface ExplorerQuery<T> {
  get(): Promise<T>;        // One-shot fetch
  observe(): Observable<T>; // Reactive stream
}
```

**Live vs Snapshot Mode:**

```typescript
// Snapshot (default): emits once
debugger.catalog.collections().observe().subscribe(console.log);

// Live: emits on every change
debugger.catalog.collections({ live: true }).observe().subscribe(console.log);
```

## Design Principles

1. **Zero app-specific dependencies** - Only RxDB, RxJS, SolidJS
2. **Headless-first** - All features available via API, UI is optional
3. **Non-invasive** - Read-only by default, opt-in mutations
4. **Performance conscious** - Lazy loading, efficient subscriptions
5. **Type-safe** - Full TypeScript with strict types
6. **Framework agnostic** - Works with React, Vue, Svelte, vanilla JS

## Bundle Size

- **Headless core**: ~5KB gzipped
- **UI**: ~15KB gzipped
- **Total**: ~20KB gzipped

## License

MIT
