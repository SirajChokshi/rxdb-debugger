# RxDB Debugger

Monorepo: debugger for [RxDB](https://rxdb.info/) — headless API, SolidJS UI, Chrome DevTools extension.

| Package | Role |
|---------|------|
| [`rxdb-debugger`](./packages/rxdb-debugger) | Main npm package (API + `rxdb-debugger/ui` + styles) |
| [`rxdb-debugger-plugin`](./packages/rxdb-debugger-plugin) | Extension auto-discovery only |
| [`@rxdb-debugger/core`](./packages/core) / [`@rxdb-debugger/ui`](./packages/ui) | Low-level building blocks |

```bash
bun install
bun run build:libs
cd examples/react && bun install && bun run dev
```

Extension: [`packages/chrome-extension`](./packages/chrome-extension). **Vercel** (demo app): root [`vercel.json`](./vercel.json), empty Root Directory.

MIT
