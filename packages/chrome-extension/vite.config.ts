import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [
    tailwindcss(),
    solid(),
    viteStaticCopy({
      targets: [
        { src: "manifest.json", dest: "." },
        { src: "devtools.html", dest: "." },
        { src: "devtools.js", dest: "." },
        { src: "panel.html", dest: "." },
        { src: "icons/*.png", dest: "icons" },
      ],
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        panel: resolve(__dirname, "src/panel.tsx"),
      },
      output: {
        entryFileNames: "[name].js",
        format: "iife",
      },
    },
    minify: false,
    sourcemap: true,
  },
});
