import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Workspace `file:` deps are symlinked; skipping pre-bundle avoids esbuild
  // failing to resolve package entries during dep-scan on some setups (e.g. Bun).
  optimizeDeps: {
    exclude: ["@rxdb-debugger/core", "@rxdb-debugger/ui"],
  },
});
