# RxDB Debugger - Cloud Agent Instructions

## Overview

RxDB Debugger is a zero-dependency, framework-agnostic debugger/devtools for RxDB databases. The monorepo contains:

| Package | Path | Description |
|---------|------|-------------|
| `@rxdb-debugger/core` | `packages/core` | Headless debugger API |
| `@rxdb-debugger/ui` | `packages/ui` | SolidJS UI components |
| `chrome-extension` | `packages/chrome-extension` | Chrome DevTools extension |
| `react-example` | `examples/react` | React demo app (RxTunes music catalog) |

## Commands

| Task | Command |
|------|---------|
| Install dependencies | `bun install` |
| Lint | `bun run lint` |
| Build libs (core + ui) | `bun run build:libs` |
| Build Chrome extension | `bun run build:ext` |
| Run example app | `bun run dev` (in `examples/react`) |
| Typecheck | `bun run typecheck` |

## Build Order

Packages must be built in order due to dependencies:
1. `@rxdb-debugger/core` (no dependencies)
2. `@rxdb-debugger/ui` (depends on core)
3. `chrome-extension` or `react-example` (depend on core + ui)

Use `bun run build:libs` from root to build core and ui in the correct order.

## Chrome Extension Development

After building with `bun run build:ext`, the extension files are in `packages/chrome-extension/dist`. Load this folder as an unpacked extension in Chrome:
1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select `packages/chrome-extension/dist`

The extension adds an "RxDB" panel to Chrome DevTools.

## Known Issues

- The linter (`oxlint`) reports pre-existing warnings/errors in `packages/chrome-extension/src/`
- The `@rxdb-debugger/ui` package has pre-existing TypeScript errors in `src/utils/observable.ts` (missing rxjs peer dependency types), but builds successfully
