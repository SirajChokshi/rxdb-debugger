# @rxdb-debugger/ui

SolidJS-based UI components for the RxDB Debugger.

> **Most users should install [`rxdb-debugger`](https://www.npmjs.com/package/rxdb-debugger) and import from `rxdb-debugger/ui` instead.** This package is the internal implementation. Use it directly only if you need fine-grained dependency control.

## Installation

```bash
npm install @rxdb-debugger/ui
```

**Peer Dependencies:** `@rxdb-debugger/core@>=0.1.0`, `solid-js@^1.9.0`

## Usage

```typescript
import { mountDebugger } from "@rxdb-debugger/ui";
import "@rxdb-debugger/ui/styles.css";

const unmount = mountDebugger({
  container: "#debug-panel",
  db: myDatabase,
  theme: "dark",
});

// Cleanup
unmount();
```

## Styles

You must import the prebuilt CSS for the UI to render correctly:

```typescript
import "@rxdb-debugger/ui/styles.css";
```

## License

MIT
