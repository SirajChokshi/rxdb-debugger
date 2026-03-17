# rxdb-debugger-plugin

Minimal auto-discovery plugin for the [RxDB Debugger Chrome extension](https://github.com/sirajchokshi/rxdb-debugger).

Install this in your app so the Chrome DevTools extension can find your RxDB databases automatically. This package has no UI dependencies and adds virtually zero overhead.

## Installation

```bash
npm install rxdb-debugger-plugin
```

**Peer Dependencies:** `rxdb@>=15.0.0`, `rxjs@>=7.0.0`

## Usage

Call once before creating any RxDB databases:

```typescript
import { installRxdbDebuggerAutoDiscovery } from "rxdb-debugger-plugin";

installRxdbDebuggerAutoDiscovery();
```

Or use the RxDB plugin API directly:

```typescript
import { addRxPlugin } from "rxdb/plugins/core";
import { createRxdbDebuggerAutoDiscoveryPlugin } from "rxdb-debugger-plugin";

addRxPlugin(createRxdbDebuggerAutoDiscoveryPlugin());
```

That's it. The Chrome extension will discover all databases and instances automatically.

## When to Use This vs `rxdb-debugger`

- **`rxdb-debugger-plugin`**: You only want the Chrome extension to work. No headless API or mountable UI.
- **`rxdb-debugger`**: You want the full headless API, mountable UI, and/or auto-discovery in one package.

## License

MIT
