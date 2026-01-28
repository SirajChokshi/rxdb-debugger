import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  dts: true,
  external: ['rxdb', 'rxdb/plugins/core', 'rxjs', 'rxjs/operators', 'dexie'],
  platform: 'neutral',
  clean: true,
})
