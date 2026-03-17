# RxDB Debugger

A zero-dependency, framework-agnostic debugger for [RxDB](https://rxdb.info/) databases. Provides a headless API, a portable SolidJS UI, and a Chrome DevTools extension.

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| [`rxdb-debugger`](./packages/rxdb-debugger) | Full debugger: headless API + mountable UI | `npm install rxdb-debugger` |
| [`rxdb-debugger-plugin`](./packages/rxdb-debugger-plugin) | Minimal auto-discovery plugin for the Chrome extension | `npm install rxdb-debugger-plugin` |
| [`@rxdb-debugger/core`](./packages/core) | Headless API only (advanced) | `npm install @rxdb-debugger/core` |
| [`@rxdb-debugger/ui`](./packages/ui) | SolidJS UI components (advanced) | `npm install @rxdb-debugger/ui` |

## Quick Start

```typescript
import { RxdbDebugger } from "rxdb-debugger";

const dbg = new RxdbDebugger({ db: myDatabase });
const collections = await dbg.catalog.collections().get();
```

### Chrome Extension

Install `rxdb-debugger-plugin` in your app:

```typescript
import { installRxdbDebuggerAutoDiscovery } from "rxdb-debugger-plugin";

installRxdbDebuggerAutoDiscovery();
```

Then install the [RxDB Debugger Chrome extension](./packages/chrome-extension) to inspect your databases in DevTools.

## Documentation

See the full documentation in the [`rxdb-debugger` package README](./packages/rxdb-debugger/README.md).

## Development

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run the React example
cd examples/react
bun install
bun run dev
```

## Vercel (React example)

**Option A — Root = repo (recommended):** After `vercel login`, from the repo root:

```bash
bun run vercel:link
bun run vercel:monorepo-root
```

That clears the dashboard “Root Directory” so [vercel.json](./vercel.json) runs `bun install`, `build:libs`, and the Vite app.

**Option B — Root = `examples/react`:** [examples/react/vercel.json](./examples/react/vercel.json) runs the same build via `cd ../..` so PR previews still work without changing dashboard settings.

## License

MIT
