import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  dts: true,
  external: [
    '@rxdb-debugger/core',
    '@rxdb-debugger/core/plugin',
    'rxdb',
    'rxdb/plugins/core',
    'rxjs',
  ],
  platform: 'neutral',
  clean: true,
})
