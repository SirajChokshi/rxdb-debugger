# RxDB Debugger

Debugger and DevTools toolkit for [RxDB](https://rxdb.info/) apps: inspect collections, run live and snapshot queries, watch replication and performance, browse schema and history, and use a Chrome DevTools panel—all built on a headless core you can embed in your own tools.

## Repository layout

| Path | Package | Role |
|------|---------|------|
| [`packages/core`](packages/core) | `@rxdb-debugger/core` | Headless debugger APIs (`RxdbDebugger`, catalog, documents, events, export/import, performance, replication, schema, history, query playground, live/static queries, auto-discovery for extension integration). Peer deps: `rxdb` ≥15, `rxjs` ≥7. Published to npm (`publishConfig.access: public`). |
| [`packages/ui`](packages/ui) | `@rxdb-debugger/ui` | SolidJS UI + Tailwind (`@rxdb-debugger/core`, `solid-js` peers). Exports `./styles.css`. |
| [`packages/chrome-extension`](packages/chrome-extension) | `chrome-extension` | Chrome DevTools extension (private workspace package). |
| [`examples/react`](examples/react) | — | Vite + React demo: seeded music catalog, mock replication, optional encryption, auto-discovery plugin. |

Core exports include `installRxdbDebuggerAutoDiscovery` and a global registry so the extension can discover databases without assigning them to `window`.

## Prerequisites

- [Bun](https://bun.sh) (this repo uses a [bun.lock](bun.lock) workspace)

## Quick start

From the repository root:

```bash
bun install
bun run build
```

`build` runs Oxlint, then builds all `@rxdb-debugger/*` packages.

Targeted builds:

```bash
bun run build:libs   # @rxdb-debugger/core and @rxdb-debugger/ui only
bun run build:ext    # chrome-extension only
```

## Running the React example

Build libraries first (`bun run build` or `bun run build:libs`), then:

```bash
cd examples/react
bun install
bun run dev
```

Open [http://localhost:5173](http://localhost:5173).

For the full feature list (collections, seed data, replication panel, encryption env vars, and Chrome extension integration), see **[examples/react/README.md](examples/react/README.md)**.

## Root scripts

| Script | Description |
|--------|-------------|
| `bun run lint` | Run [Oxlint](https://oxc.rs) |
| `bun run lint:fix` | Oxlint with `--fix` |
| `bun run build` | Lint + build all `@rxdb-debugger/*` packages |
| `bun run build:libs` | Build core and UI only |
| `bun run build:ext` | Build the Chrome extension |
| `bun run dev` | `dev` for all `@rxdb-debugger/*` workspaces |
| `bun run typecheck` | Typecheck all workspaces |
| `bun run clean` | Run `clean` in each workspace (best-effort) |

## Tech stack

TypeScript, Oxlint ([`.oxlintrc.json`](.oxlintrc.json)), tsdown (core/ui), Vite (extension and example), React (example), SolidJS (UI and extension), Tailwind.

## License

MIT. Repository: [github.com/sirajchokshi/rxdb-debugger](https://github.com/sirajchokshi/rxdb-debugger).
