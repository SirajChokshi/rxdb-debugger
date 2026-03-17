# rxdb-debugger

Headless API + mountable UI for debugging [RxDB](https://rxdb.info/) apps. Peers: `rxdb`, `rxjs`; UI path needs `solid-js`.

```bash
bun add rxdb-debugger rxdb rxjs
```

```ts
import { RxdbDebugger } from "rxdb-debugger";
const dbg = new RxdbDebugger({ db: myDb });
await dbg.catalog.collections().get();
dbg.dispose();
```

```ts
import { mountDebugger } from "rxdb-debugger/ui";
import "rxdb-debugger/styles.css";
mountDebugger({ container: "#root", db: myDb });
```

Extension auto-discovery: `import { installRxdbDebuggerAutoDiscovery } from "rxdb-debugger-plugin"` (or `rxdb-debugger`) and call once before `createRxDatabase`.

**Packages:** `rxdb-debugger` (this) · `rxdb-debugger-plugin` (plugin only) · `@rxdb-debugger/core` / `@rxdb-debugger/ui` (advanced).

Source: [github.com/SirajChokshi/rxdb-debugger](https://github.com/SirajChokshi/rxdb-debugger).

MIT
