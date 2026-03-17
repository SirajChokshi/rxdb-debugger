import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    ui: 'src/ui.ts',
    plugin: 'src/plugin.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  dts: true,
  external: [
    '@rxdb-debugger/core',
    '@rxdb-debugger/core/plugin',
    '@rxdb-debugger/ui',
    'rxdb',
    'rxdb/plugins/core',
    'rxjs',
    'solid-js',
    'solid-js/web',
  ],
  platform: 'neutral',
  clean: true,
})
