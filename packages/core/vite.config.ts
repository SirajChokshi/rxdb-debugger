import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    solid(),
    dts({
      include: ["src/ui/**/*.ts", "src/ui/**/*.tsx"],
      outDir: "dist/ui",
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: "src/ui/index.ts",
      formats: ["es"],
      fileName: () => "index.js",
    },
    outDir: "dist/ui",
    rollupOptions: {
      external: ["rxdb", "rxjs", "rxjs/operators"],
    },
    minify: false,
    sourcemap: true,
  },
});
