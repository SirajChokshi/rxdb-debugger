# AGENTS.md

## Cursor Cloud specific instructions

This is a Bun-based TypeScript monorepo (`rxdb-debugger`) using Bun workspaces
(`packages/*`, `examples/*`). All standard scripts live in the root
`package.json` and the README; prefer those over duplicating commands here.

### Runtime / package manager
- The package manager is **Bun** (only `bun.lock` lockfiles are committed; CI uses
  Bun). `node`/`npm` exist but are not used for workspace tasks.
- Bun is installed at `~/.npm-global/bin/bun` and that directory is already on the
  default `PATH`, so `bun` works in fresh non-login shells (no profile sourcing
  needed). The startup update script runs `bun install --frozen-lockfile`.

### Services / packages
- `packages/core` (`@rxdb-debugger/core`) and `packages/ui` (`@rxdb-debugger/ui`) —
  the shippable libraries, built with `tsdown`.
- `packages/chrome-extension` — Chrome DevTools panel (Vite build).
- `examples/react` — the React "RxTunes" demo app and primary manual E2E harness.
  Runs at `http://localhost:5173` via `cd examples/react && bun run dev` (Vite).

There is **no backend, database, or external service**: RxDB data is in-browser
(Dexie/IndexedDB) and replication in the example is mocked in-process. No secrets
are required.

### Non-obvious gotchas
- The React example consumes the **built** `dist/` of core & ui via `file:` deps,
  so you must run `bun run build:libs` (or `bun run build`) at least once before
  `examples/react` will work. Re-run it after changing `packages/core` or
  `packages/ui` since the example does not pick up library source changes live.
- In the RxTunes demo, click **Load Demo Data** (bottom-left) to seed the catalog,
  then toggle the embedded RxDB Debugger with **Ctrl/Cmd+D** (or the orange
  bottom-right button).
- `bun run build` runs `lint` first, so a lint failure blocks the build. Use
  `bun run build:libs` to build without the lint gate.

### Verify (mirrors `.github/workflows/ci.yml`)
`bun run lint`, `bun run test`, `bun run build:libs`, `bun run typecheck`,
`bun run build:ext`.
