# @rxdb-debugger/core

Low-level headless RxDB debugger API with live/snapshot query support.

> **Most users should install [`rxdb-debugger`](https://www.npmjs.com/package/rxdb-debugger) instead.** This package is the internal implementation that powers the umbrella package. Use it directly only if you need fine-grained dependency control or are building your own debugger UI.

## Installation

```bash
npm install @rxdb-debugger/core
```

**Peer Dependencies:** `rxdb@>=15.0.0`, `rxjs@>=7.0.0`

## Usage

```typescript
import { RxdbDebugger } from "@rxdb-debugger/core";

const dbg = new RxdbDebugger({ db: myDatabase });

const collections = await dbg.catalog.collections().get();
const docs = await dbg.documents.list("users", { limit: 10 }).get();

dbg.dispose();
```

## Auto-Discovery Plugin

```typescript
import { installRxdbDebuggerAutoDiscovery } from "@rxdb-debugger/core";

installRxdbDebuggerAutoDiscovery();
```

> For a lighter dependency, use [`rxdb-debugger-plugin`](https://www.npmjs.com/package/rxdb-debugger-plugin) which re-exports only the auto-discovery helpers.

## API

See the full [RxDB Debugger documentation](https://github.com/sirajchokshi/rxdb-debugger#readme) for the complete API reference.

## License

MIT
