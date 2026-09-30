// Assembles build/mcpb (manifest + bundled server) and packs it into
// build/contractbook.mcpb. Run via `pnpm build:mcpb`, after the vite build.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const MCPB_CLI = "@anthropic-ai/mcpb@2.1.2";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("mcpb/manifest.json", "utf8"));
manifest.version = pkg.version;
writeFileSync("build/mcpb/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
execFileSync(npx, ["-y", MCPB_CLI, "pack", "build/mcpb", "build/contractbook.mcpb"], {
  stdio: "inherit",
});
