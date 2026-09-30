import { defineConfig } from "vite";

import pkg from "./package.json" with { type: "json" };

// Builds the server for the Claude Desktop Extension (`pnpm build:mcpb`).
// Users have no node_modules, so dependencies go into the bundle. The output
// targets Node 24, matching `engines` in package.json.
export default defineConfig({
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  ssr: {
    noExternal: true,
  },
  build: {
    outDir: "build/mcpb/server",
    emptyOutDir: true,
    target: "node24",
    ssr: "./src/index.ts",
    rollupOptions: {
      external: [/^node:/],
      output: {
        entryFileNames: "index.mjs",
        format: "es",
      },
    },
  },
});
