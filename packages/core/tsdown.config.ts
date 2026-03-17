import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/plugin.ts'],
  outDir: 'dist',
  format: ['esm'],
  dts: true,
  external: ['rxdb', 'rxdb/plugins/core', 'rxdb/plugins/replication', 'rxjs', 'rxjs/operators', 'dexie'],
  platform: 'neutral',
  clean: true,
})
