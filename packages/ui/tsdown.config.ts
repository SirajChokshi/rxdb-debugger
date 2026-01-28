import solid from 'rolldown-plugin-solid'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  dts: true,
  external: [
    '@rxdb-debugger/core',
    'rxdb',
    'rxjs',
    'solid-js',
    'solid-js/web',
  ],
  platform: 'neutral',
  plugins: [solid()],
  clean: true,
})
