# RxDB Debugger - Chrome DevTools Extension

Chrome DevTools extension for inspecting [RxDB](https://rxdb.info/) databases.

## Features

- Schema / documents / query playground / events / replication / performance / export
- Multiple logical DBs and instances via auto-discovery

## Install (development)

```bash
# repo root
bun install && bun run build:libs && bun run build:ext
```

Chrome → `chrome://extensions` → Developer mode → Load unpacked → `packages/chrome-extension/dist`.

## App setup

Apps need [`rxdb-debugger-plugin`](../rxdb-debugger-plugin) (or `rxdb-debugger`) — call `installRxdbDebuggerAutoDiscovery()` before creating databases.

## Permissions

| Permission | Reason |
|------------|--------|
| `scripting` | DevTools ↔ page |
| `<all_urls>` | Inspect any tab from DevTools |

## License

MIT
