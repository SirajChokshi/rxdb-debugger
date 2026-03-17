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
- **Chrome DevTools Extension**: Inspect databases visually without code changes

## Packages

| Package | Description |
|---------|-------------|
| [`rxdb-debugger`](https://www.npmjs.com/package/rxdb-debugger) | Full debugger: headless API + mountable UI |
| [`rxdb-debugger-plugin`](https://www.npmjs.com/package/rxdb-debugger-plugin) | Minimal auto-discovery plugin for the Chrome extension |

**Advanced / low-level:**

| Package | Description |
|---------|-------------|
| [`@rxdb-debugger/core`](https://www.npmjs.com/package/@rxdb-debugger/core) | Headless API only (no UI dependency) |
| [`@rxdb-debugger/ui`](https://www.npmjs.com/package/@rxdb-debugger/ui) | SolidJS UI components only |

## Installation

```bash
npm install rxdb-debugger
```

**Peer Dependencies:** `rxdb@>=15.0.0`, `rxjs@>=7.0.0`

> If you only need auto-discovery for the Chrome extension, install `rxdb-debugger-plugin` instead — it has no UI dependencies.

## Quick Start

### Headless API

```typescript
import { RxdbDebugger } from "rxdb-debugger";
import { getDatabase } from "./my-db";

const dbg = new RxdbDebugger({
  db: getDatabase,
  trackPerformance: true,
});

// Browse collections
const collections = await dbg.catalog.collections().get();

// Query documents
const docs = await dbg.documents.list("users", { limit: 10 }).get();

// Get schema details
const schema = await dbg.schema.getSchema("users").get();

// Stream events
dbg.events.stream().observe().subscribe(event => {
  console.log("Change:", event.operation, event.collection, event.documentId);
});

// Execute queries
const result = await dbg.query.execute("users", {
  selector: { age: { $gte: 18 } },
  limit: 25,
}).get();

// Export data
const json = await dbg.export.exportCollection("users");

// Cleanup
dbg.dispose();
```

### Mounted UI

```typescript
import { mountDebugger } from "rxdb-debugger/ui";
import "rxdb-debugger/styles.css";
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

### Chrome Extension Auto-Discovery

To let the DevTools extension discover and manage all RxDB databases automatically, install the plugin once before creating databases.

Using the lightweight plugin package:

```typescript
import { installRxdbDebuggerAutoDiscovery } from "rxdb-debugger-plugin";

installRxdbDebuggerAutoDiscovery();
```

Or using the full package:

```typescript
import { installRxdbDebuggerAutoDiscovery } from "rxdb-debugger";

installRxdbDebuggerAutoDiscovery();
```

If you prefer the RxDB plugin API:

```typescript
import { addRxPlugin } from "rxdb/plugins/core";
import { createRxdbDebuggerAutoDiscoveryPlugin } from "rxdb-debugger-plugin";

addRxPlugin(createRxdbDebuggerAutoDiscoveryPlugin());
```

With auto-discovery enabled, the extension can:
- detect multiple logical databases
- show multiple active instances/handles per database
- close/remove databases from the explorer UI

No `window.__rxdb_handle` assignment is required.

### Mounted Explorer UI (Feature Parity with Extension)

If you want the same database explorer shell used by the DevTools extension (logical DBs, instances, close/remove actions), mount the explorer UI:

```typescript
import { mountExplorerDebugger } from "rxdb-debugger/ui";
import "rxdb-debugger/styles.css";

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

### Encryption Metadata

The auto-discovery registry includes non-secret encryption metadata so the extension can show encryption badges without manual wiring:

- whether a database password is configured
- whether any collection has encrypted fields
- whether any collection uses encrypted attachments

This metadata is derived from RxDB schema and creation options only. Raw password values are never exposed through the registry.

## API Reference

### RxdbDebugger

Main entry point for the headless debugger API.

```typescript
const dbg = new RxdbDebugger({
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
| `history` | Track document version history |

### CatalogService

```typescript
// All collections with live counts
dbg.catalog.collections({ live: true }).observe().subscribe(console.log);

// Single collection info
const userInfo = await dbg.catalog.collection("users").get();

// Collection names only
const names = await dbg.catalog.collectionNames().get();
```

### DocumentsService

```typescript
// List with filtering and pagination
const docs = await dbg.documents.list("users", {
  selector: { status: "active" },
  sort: [{ createdAt: "desc" }],
  skip: 0,
  limit: 25,
  live: true,
}).get();

// Find by ID
const doc = await dbg.documents.findById("users", "user-123").get();

// Find multiple by IDs
const docs = await dbg.documents.findByIds("users", ["id1", "id2"]).get();

// Compare two documents
const diff = dbg.documents.compare(docA, docB);
// { equal: false, changes: [{ path: "name", type: "changed", oldValue: "A", newValue: "B" }] }

// Delete document
await dbg.documents.delete("users", "user-123");

// Update document
const updated = await dbg.documents.update("users", "user-123", { name: "New Name" });

// Insert document
const inserted = await dbg.documents.insert("users", { id: "new-id", name: "John" });
```

### SchemaService

```typescript
// Get detailed schema
const schema = await dbg.schema.getSchema("users").get();

// Get all relationships (foreign keys)
const relationships = await dbg.schema.getRelationships().get();

// Get all schemas
const schemas = await dbg.schema.getAllSchemas().get();
```

### QueryService

```typescript
// Execute a query
const result = await dbg.query.execute("users", {
  selector: { age: { $gte: 18 } },
  sort: [{ age: "asc" }],
  limit: 10,
}).get();

// Live query
dbg.query.execute("users", { selector: {} }, { live: true })
  .observe()
  .subscribe(result => console.log("Updated:", result.count));

// Explain query (index analysis)
const explanation = await dbg.query.explain("users", {
  selector: { email: { $eq: "test@example.com" } },
}).get();

// Get query history
const history = await dbg.query.getHistory({ limit: 10 }).get();
```

### EventsService

```typescript
// Stream all changes
const sub = dbg.events.stream().observe().subscribe(event => {
  console.log(event.operation, event.collection, event.documentId);
});

// Filter by collection
dbg.events.stream({ collections: ["users", "posts"] }).observe();

// Filter by operation
dbg.events.stream({ operations: ["INSERT", "DELETE"] }).observe();

// Get event history
const history = await dbg.events.history({ limit: 50 }).get();

// Pause/resume
dbg.events.pause();
dbg.events.resume();

// Clear buffer
dbg.events.clear();
```

### ReplicationService

```typescript
// Snapshot of all replication states
const states = await dbg.replication.states().get();

// Per-collection summary
const summaries = await dbg.replication.collectionSummaries().get();

// Control actions
await dbg.replication.reSync("songs", "mock-songs-sync");
await dbg.replication.pause("songs", "mock-songs-sync");
await dbg.replication.start("songs", "mock-songs-sync");
```

### PerformanceService

```typescript
// Start tracking
dbg.performance.start();

// Get metrics
const metrics = await dbg.performance.getMetrics().get();

// Get recent operations with diagnostics
const operations = await dbg.performance.getOperations({ limit: 50 }).get();

// Get slow operations
const slowOps = await dbg.performance.getSlowOperations(100).get(); // >100ms

// Track custom operation
const result = await dbg.performance.track(
  "find",
  "users",
  () => collection.find().exec(),
  (docs) => docs.length,
);

// Stop tracking
dbg.performance.stop();

// Clear metrics
dbg.performance.clear();

// Dispose instrumentation
dbg.performance.dispose();
```

### ExportService

```typescript
// Export collection to JSON string
const json = await dbg.export.exportCollection("users", {
  includeMetadata: false,
  pretty: true,
});

// Export entire database
const backup = await dbg.export.exportDatabase();

// Download as file (browser only)
await dbg.export.downloadCollection("users", "users-backup.json");
await dbg.export.downloadDatabase("my-db-backup.json");

// Import documents
const result = await dbg.export.importDocuments("users", json, { upsert: true });

// Import full database backup
const results = await dbg.export.importDatabase(backupJson);
```

## UI Reference

### mountDebugger

Mount the debugger UI into any container.

```typescript
import { mountDebugger } from "rxdb-debugger/ui";
import "rxdb-debugger/styles.css";

const unmount = mountDebugger({
  container: "#debug-panel",  // CSS selector or HTMLElement
  db: getDatabase,            // RxDatabase | Promise | factory

  // Optional
  theme: "dark",              // "dark" | "light" | "auto"
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
import "rxdb-debugger/styles.css";
import { getDatabase } from "./db";

function RxdbDebugPanel() {
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
import 'rxdb-debugger/styles.css';
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
  import "rxdb-debugger/styles.css";
  import { createDatabase } from "./db.js";

  mountDebugger({
    container: "#rxdb-debugger",
    db: createDatabase,
    theme: "dark",
    height: "600px",
  });
</script>
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
dbg.catalog.collections().observe().subscribe(console.log);

// Live: emits on every change
dbg.catalog.collections({ live: true }).observe().subscribe(console.log);
```

## Design Principles

1. **Zero app-specific dependencies** - Only RxDB, RxJS, SolidJS
2. **Headless-first** - All features available via API, UI is optional
3. **Non-invasive** - Read-only by default, opt-in mutations
4. **Performance conscious** - Lazy loading, efficient subscriptions
5. **Type-safe** - Full TypeScript with strict types
6. **Framework agnostic** - Works with React, Vue, Svelte, vanilla JS

## License

MIT
