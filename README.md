# rxdb-debugger

Debugger tooling for [RxDB](https://rxdb.info/): a headless API (`@rxdb-debugger/core`), SolidJS UI (`@rxdb-debugger/ui`), and a Chrome DevTools extension for inspecting live databases.

## Repository layout

| Path | Package | Description |
|------|---------|-------------|
| [`packages/core`](packages/core) | `@rxdb-debugger/core` | Headless debugger API. Peer dependencies: `rxdb@>=15`, `rxjs@>=7`. |
| [`packages/ui`](packages/ui) | `@rxdb-debugger/ui` | SolidJS UI components and styles for the debugger. |
| [`packages/chrome-extension`](packages/chrome-extension) | Chrome extension | DevTools extension that uses core + UI. |
| [`examples/react`](examples/react) | Example app | Vite + React demo with a realistic music catalog DB. See [examples/react/README.md](examples/react/README.md) for features, data model, encryption/replication options, and how to run it. |

## Prerequisites

- [Bun](https://bun.sh/) (used for workspaces and scripts)

## Scripts (from repo root)

```bash
bun install
```

```bash
# Lint + build all @rxdb-debugger/* packages
bun run build
```

```bash
# Build only core + UI libraries
bun run build:libs
```

```bash
# Build the Chrome extension
bun run build:ext
```

```bash
# Watch/dev for packages (see package scripts)
bun run dev
```

To run the **React example** dev server, use `examples/react` (see [examples/react/README.md](examples/react/README.md)): `bun install` and `bun run dev` from that directory after building libraries from the root if needed.

## License

MIT
