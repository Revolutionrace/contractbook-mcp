// Assembles build/mcpb (manifest + bundled server) and packs it into
// build/contractbook.mcpb. Run via `pnpm build:mcpb`, after the vite build.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const MCPB_CLI = "@anthropic-ai/mcpb@2.1.2";
const SERVER = "build/mcpb/server/index.mjs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("mcpb/manifest.json", "utf8"));

if (manifest.version !== pkg.version) {
  console.error(
    `mcpb/manifest.json version ${manifest.version} does not match package.json version ${pkg.version}`,
  );
  process.exit(1);
}

manifest.tools = await listTools();
writeFileSync("build/mcpb/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
execFileSync(npx, ["-y", MCPB_CLI, "pack", "build/mcpb", "build/contractbook.mcpb"], {
  stdio: "inherit",
});

// Asks the bundled server for its tools, so the manifest always matches the code.
async function listTools() {
  const server = spawn(process.execPath, [SERVER], {
    env: { ...process.env, CONTRACTBOOK_API_KEY: "unused-while-packing" },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const send = (message) =>
    server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);

  send({
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "pack-mcpb", version: pkg.version },
    },
  });
  send({ method: "notifications/initialized" });
  send({ id: 2, method: "tools/list" });

  for await (const line of createInterface({ input: server.stdout })) {
    const message = JSON.parse(line);
    if (message.id === 2) {
      server.kill();
      if (message.error) {
        throw new Error(`tools/list failed: ${message.error.message}`);
      }
      return message.result.tools.map(({ name, description }) => ({ name, description }));
    }
  }
  throw new Error("Server exited before answering tools/list");
}
