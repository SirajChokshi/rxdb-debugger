# RxDB Debugger

Debugging toolkit for [RxDB](https://rxdb.info/): a headless **core** library, a **SolidJS** UI you can mount into any app, and an optional **Chrome DevTools** extension with auto-discovery.

## Features

- **Schema inspector** — collections, property types, indexes, relationships
- **Document browser** — list, search, compare, and optional edits with live updates
- **Query playground** — Mango queries with timing and index analysis
- **Event stream** — document changes across collections
- **Replication monitoring** — per-collection sync state and errors
- **Performance tracking** — operation logs and diagnostics
- **Export / import** — JSON backup and restore
- **Document history** — version tracking via the events pipeline
- **Mountable UI** — embed the debugger panel in your own layout
- **Chrome extension (MV3)** — inspect RxDB in the browser; optional auto-discovery plugin

## Repository layout

| Path | Package / role |
|------|----------------|
| [`packages/core`](packages/core) | **`@rxdb-debugger/core`** — `RxdbDebugger`, services, auto-discovery plugin |
| [`packages/ui`](packages/ui) | **`@rxdb-debugger/ui`** — `mountDebugger`, `mountExplorerDebugger`, styles (`@rxdb-debugger/ui/styles.css`) |
| [`packages/chrome-extension`](packages/chrome-extension) | Chrome DevTools extension (build output in `dist/`) |
| [`examples/react`](examples/react) | Vite + React demo (music catalog; see its README) |

## Prerequisites

- [Bun](https://bun.sh/) — used for repo scripts and workspace installs
- Library consumers need **RxDB** ≥ 15, **RxJS** ≥ 7, and **SolidJS** (for the UI package) as peer dependencies

## Installing from npm

```bash
npm install @rxdb-debugger/core @rxdb-debugger/ui
```

Peer dependencies: `rxdb@>=15.0.0`, `rxjs@>=7.0.0`, and `solid-js` (for `@rxdb-debugger/ui`). Code samples and full API details are in [`packages/core/README.md`](packages/core/README.md).

## Quick start (contributors)

From the repository root:

```bash
bun install
bun run build
```

`build` runs lint and builds `@rxdb-debugger/core` and `@rxdb-debugger/ui`.

Run the React example:

```bash
cd examples/react
bun install
bun run dev
```

Then open the dev server URL (typically [http://localhost:5173](http://localhost:5173)). More detail: [`examples/react/README.md`](examples/react/README.md).

## Chrome extension (local)

Build the extension:

```bash
bun run build:ext
```

In Chrome, open **Extensions** → **Load unpacked** and select **`packages/chrome-extension/dist`** (created by the Vite build).

## Development

- **`bun run dev`** — watch mode for `@rxdb-debugger/core` and `@rxdb-debugger/ui`
- **`bun run typecheck`** — TypeScript across workspaces
- **`bun run lint`** / **`bun run lint:fix`** — Oxlint

## Documentation

- **API, UI reference, auto-discovery, framework examples:** [`packages/core/README.md`](packages/core/README.md)
- **React demo app:** [`examples/react/README.md`](examples/react/README.md)

## License

MIT
