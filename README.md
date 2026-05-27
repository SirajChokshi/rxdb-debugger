# RxDB Debugger

Debugging and inspection tools for [RxDB](https://rxdb.info/) databases. Browse schemas, documents, queries, live events, replication, and performance from a headless API, an embedded UI, or Chrome DevTools.

## Packages

| Package | Description |
| --- | --- |
| [`@rxdb-debugger/core`](packages/core/) | Headless TypeScript API for inspecting RxDB databases |
| [`@rxdb-debugger/ui`](packages/ui/) | SolidJS UI that mounts into any web app |
| [`chrome-extension`](packages/chrome-extension/) | Chrome DevTools panel for debugging RxDB in the browser |
| [`examples/react`](examples/react/) | React demo app with a music catalog database |

Install the published libraries from npm: [`@rxdb-debugger/core`](https://www.npmjs.com/package/@rxdb-debugger/core) and [`@rxdb-debugger/ui`](https://www.npmjs.com/package/@rxdb-debugger/ui).

**Peer dependencies:** `rxdb@>=15.0.0`, `rxjs@>=7.0.0`, and (for the UI package) `solid-js@^1.9.0`.

```bash
npm install @rxdb-debugger/core @rxdb-debugger/ui
```

API examples and the full headless reference are in [`packages/core/README.md`](packages/core/README.md).

## Features

- Schema inspection for collections, indexes, and relationships
- Document browsing with optional compare, edit, and delete
- Mango query playground with explain and history
- Live change streams across collections
- Replication monitoring with resync and pause controls
- Performance instrumentation and slow-query diagnostics
- JSON export and import for collections or whole databases
- Auto-discovery so the Chrome extension can find RxDB instances in the page

## Quick start

**Requirements:** [Bun](https://bun.sh/) (used for installs, builds, and tests in this repo).

From the repository root:

```bash
bun install
bun run build
bun test
```

Run the React example (workspace dependencies are installed from the root):

```bash
bun run --cwd examples/react dev
```

Open [http://localhost:5173](http://localhost:5173). The example seeds a music catalog, mock replication on `songs` and `users`, and an embedded debugger panel. See [`examples/react/README.md`](examples/react/README.md) for the data model, replication demo, and optional encryption mode.

## Usage modes

### Headless API

Create `RxdbDebugger` with your database factory. You get catalog, documents, schema, query, events, replication, performance, and export services. See [`packages/core/README.md`](packages/core/README.md).

### Embedded UI

Call `mountDebugger()` or `mountExplorerDebugger()` from `@rxdb-debugger/ui` to mount the debugger into any DOM container. Import styles when needed:

```typescript
import "@rxdb-debugger/ui/styles.css";
```

Works with React, Vue, Svelte, or vanilla JavaScript.

### Chrome DevTools

Build the extension with `bun run build:ext`, load the unpacked build from `packages/chrome-extension/dist`, and call `installRxdbDebuggerAutoDiscovery()` once in your app so DevTools can list logical databases and active handles without manual `window` wiring.

## Repository scripts

| Script | Purpose |
| --- | --- |
| `bun run build` | Lint and build library packages |
| `bun run build:libs` | Build core and UI only |
| `bun run build:ext` | Build the Chrome extension |
| `bun run dev` | Watch library packages during development |
| `bun test` | Run package tests |
| `bun run typecheck` | Type-check all workspaces |
| `bun run lint` | Run oxlint across the repo |
| `bun run clean` | Clean build outputs in workspaces |

## Design

The project is headless-first, read-only by default, framework-agnostic, and type-safe. RxDB and RxJS carry the data layer. SolidJS powers the optional UI.

## License

MIT
