# Chrome Web Store Listing

## Short Description (132 chars max)

DevTools extension for debugging RxDB databases. Inspect schemas, query documents, monitor replication, and track performance.

## Detailed Description

RxDB Debugger adds a new "RxDB" panel to Chrome DevTools, giving you full visibility into your RxDB databases without writing any debugging code.

**Features:**

- Schema Inspector — Browse collections, view property types, constraints, indexes, and foreign-key relationships
- Document Browser — List, search, compare, and edit documents with live updates
- Query Playground — Build and test Mango queries with timing and index analysis
- Event Stream — Watch document changes in real-time across all collections
- Replication Monitoring — Inspect replication state, sync counters, and errors per collection
- Performance Tracking — Auto-instrument RxDB operations with query-plan diagnostics and setup-aware recommendations
- Export/Import — Export collections or entire database to JSON, import data back
- Multi-Database Support — Automatically discover and switch between multiple databases and instances

**Getting Started:**

1. Install this extension
2. Install the companion npm package in your app: `npm install rxdb-debugger-plugin`
3. Add one line before creating databases:

```
import { installRxdbDebuggerAutoDiscovery } from "rxdb-debugger-plugin";
installRxdbDebuggerAutoDiscovery();
```

4. Open DevTools and click the "RxDB" tab

**Privacy:** This extension does not collect, transmit, or store any user data. All inspection happens locally within the browser.

**Open Source:** https://github.com/sirajchokshi/rxdb-debugger

## Category

Developer Tools

## Language

English

## Screenshots Needed

1. Extension panel showing collection list with schema details
2. Document browser with search/filter
3. Query playground with results
4. Event stream showing live changes
5. Performance metrics dashboard
