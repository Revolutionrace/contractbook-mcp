import { defineConfig } from "vite";

import pkg from "./package.json" with { type: "json" };

// `vite build --mode mcpb` produces a fully self-contained server for the
// Claude Desktop Extension: dependencies are bundled in and the syntax targets
// the Node runtime Claude Desktop ships, since users have no node_modules.
export default defineConfig(({ mode }) => {
  const mcpb = mode === "mcpb";

  return {
    define: {
      __VERSION__: JSON.stringify(pkg.version),
    },
    ssr: mcpb ? { noExternal: true } : undefined,
    build: {
      outDir: mcpb ? "build/mcpb/server" : "dist",
      emptyOutDir: mcpb,
      target: mcpb ? "node20" : "es2024",
      ssr: mcpb ? "./src/index.ts" : undefined,
      lib: mcpb
        ? undefined
        : {
            entry: "./src/index.ts",
            formats: ["es"],
            fileName: "index",
          },
      rollupOptions: {
        external: mcpb ? [/^node:/] : [/^node:/, /^@modelcontextprotocol/, "zod"],
        output: mcpb
          ? { entryFileNames: "index.mjs", format: "es" }
          : { banner: "#!/usr/bin/env node" },
      },
    },
  };
});
