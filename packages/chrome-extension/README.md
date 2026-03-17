# RxDB Debugger - Chrome DevTools Extension

A Chrome DevTools extension for inspecting and debugging [RxDB](https://rxdb.info/) databases in the browser.

## Features

- **Schema Inspector**: Browse collections, view property types, constraints, indexes, and relationships
- **Document Browser**: List, search, compare, and edit documents with live updates
- **Query Playground**: Build and test Mango queries with timing and index analysis
- **Event Stream**: Watch document changes in real-time across all collections
- **Replication Monitoring**: Inspect replication state, activity, and errors per collection
- **Performance Tracking**: Auto-instrument RxDB operations with query-plan diagnostics
- **Export/Import**: Export collections or entire database to JSON, import data
- **Multi-Database Support**: Discover and switch between multiple logical databases and instances

## Installation

### Chrome Web Store

Install the extension from the [Chrome Web Store](https://chromewebstore.google.com/) (link coming soon).

### Load Unpacked (Development)

1. Build the extension:

```bash
# From the repo root
bun install
bun run build
bun run build:ext
```

2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `packages/chrome-extension/dist` directory

## App Setup

For the extension to discover your RxDB databases, install the auto-discovery plugin in your app:

```bash
npm install rxdb-debugger-plugin
```

```typescript
import { installRxdbDebuggerAutoDiscovery } from "rxdb-debugger-plugin";

installRxdbDebuggerAutoDiscovery();
```

Call this once before creating any RxDB databases. The extension will then automatically discover all databases and instances.

## How It Works

The extension uses `chrome.devtools.inspectedWindow.eval` to communicate with the inspected page. The auto-discovery plugin registers an RxDB lifecycle hook that exposes a registry at `window.__RXDB_DEBUGGER__`. The extension reads this registry to discover databases and proxies all operations through eval-based bridges.

## Permissions

| Permission | Reason |
|------------|--------|
| `scripting` | Required for DevTools eval-based communication with the inspected page |
| `<all_urls>` (host) | Required so the DevTools panel can inspect any tab, regardless of origin |

These permissions are standard for DevTools extensions and do not grant any capabilities beyond what the DevTools API provides. The extension only activates when the DevTools panel is open and communicates solely with the inspected page.

## Privacy

- The extension does not collect, transmit, or store any user data
- All database inspection happens locally within the browser
- No network requests are made by the extension
- Database contents are only read when the DevTools panel is actively open
- The auto-discovery registry never exposes raw database passwords

## Development

```bash
# Watch mode for development
cd packages/chrome-extension
bun run dev

# Build for production
bun run build
```

After making changes, reload the extension in `chrome://extensions` to see updates.

## License

MIT
