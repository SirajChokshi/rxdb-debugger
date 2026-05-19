# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is an **RxDB Debugger** monorepo containing:
- `packages/core` — Headless TypeScript debugger library for RxDB
- `packages/ui` — SolidJS-based UI components
- `packages/chrome-extension` — Chrome DevTools extension
- `examples/react` — Demo React music catalog app (RxTunes)

### Runtime & Package Manager

This project uses **Bun** exclusively as its package manager and runtime. The lockfile is `bun.lock`. The update script ensures Bun is installed and dependencies are current.

### Key Commands

| Action | Command |
|--------|---------|
| Install deps | `bun install` |
| Lint | `bun run lint` |
| Lint fix | `bun run lint:fix` |
| Typecheck | `bun run typecheck` |
| Build all (lint + build) | `bun run build` |
| Build libs only | `bun run build:libs` |
| Build extension | `bun run build:ext` |
| Dev mode (all packages) | `bun run dev` |
| Run tests | `bun test` |
| Example app dev server | `cd examples/react && bun run dev` |

### Build Order

Libraries must be built before the Chrome extension or example app can work correctly:
1. `bun run build:libs` (builds core, then ui)
2. `bun run build:ext` or `cd examples/react && bun run dev`

### Known Issues

- The bridge test suite (`packages/chrome-extension/tests/bridge.test.ts`) has 3 pre-existing failures on `main` related to runtime message listener mocking. These are not caused by environment setup.

### Dev Server

The example React app runs on `http://localhost:5173/` via Vite. It is fully client-side (IndexedDB via Dexie) with mock replication — no external databases or backend services are needed.

### No External Dependencies

No Docker, databases, or external APIs are required. Everything runs locally in the browser using IndexedDB.
