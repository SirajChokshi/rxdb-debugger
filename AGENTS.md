# Agent notes — RxDB Debugger

General contributor documentation lives in `packages/core/README.md` and `examples/react/README.md`. Package scripts are defined in the root `package.json` (lint, build, dev, typecheck).

## Cursor Cloud specific instructions

- **Package manager**: This repo expects **Bun** (`bun install`, `bun run …`). If `bun` is missing on the VM, install via `npm install -g bun` when `curl https://bun.sh/install` is unavailable (TLS/network restrictions).

- **Scope**: Required processes are **local only** — no Docker Compose or remote databases. The React example uses **RxDB + IndexedDB** and mock replication in-process.

- **Libraries vs extension**: Root `bun run build` runs lint and builds `@rxdb-debugger/core` and `@rxdb-debugger/ui`. Build the Chrome extension with `bun run build:ext`. Root `bun run dev` starts **watch builds** for core + ui only (not the React example).

- **React example dev**: Run **`bun run dev`** from `examples/react` after **`bun run build`** or **`bun run build:libs`** from the repo root so `packages/*/dist` exists (documented in `examples/react/README.md`). **Chrome-extension `typecheck`** resolves `@rxdb-debugger/ui` types from built `dist/` — run **`bun run build:libs`** (or full **`bun run build`**) before **`bun run typecheck`** on a clean tree.

- **Vite + Bun**: The example `vite.config.ts` excludes `@rxdb-debugger/core` and `@rxdb-debugger/ui` from `optimizeDeps` so the dev server’s dependency scan works with symlinked workspace packages under Bun.

- **Lint**: `bun run lint` uses oxlint and may report warnings without failing the build.

- **Automated tests**: There is no root `test` script today; rely on lint, typecheck, build, and manual checks (e.g. React example + debugger UI).
