// Packs the normal `pnpm build` output into build/contractbook.mcpb, together
// with the production dependencies, since users have no node_modules.
// Run via `pnpm build:mcpb`.
import { execFileSync, spawn } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const MCPB_CLI = "@anthropic-ai/mcpb@2.1.2";
const BUNDLE_DIR = "build/mcpb";
const SERVER = `${BUNDLE_DIR}/dist/index.js`;

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("mcpb/manifest.json", "utf8"));

if (manifest.version !== pkg.version) {
  console.error(
    `mcpb/manifest.json version ${manifest.version} does not match package.json version ${pkg.version}`,
  );
  process.exit(1);
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

// Copies dist/index.js and installs only the production dependencies from the
// lockfile, in its own directory so the project's node_modules is untouched.
// A hoisted layout avoids symlinks, which do not survive the zip everywhere.
const INSTALL_FILES = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"];
rmSync(BUNDLE_DIR, { recursive: true, force: true });
mkdirSync(`${BUNDLE_DIR}/dist`, { recursive: true });
cpSync("dist/index.js", `${BUNDLE_DIR}/dist/index.js`);
for (const file of INSTALL_FILES) {
  cpSync(file, `${BUNDLE_DIR}/${file}`);
}
execFileSync(
  pnpm,
  ["install", "--prod", "--frozen-lockfile", "--ignore-scripts", "--config.node-linker=hoisted"],
  { cwd: BUNDLE_DIR, stdio: "inherit" },
);
// package.json stays: it marks dist/index.js as an ES module.
rmSync(`${BUNDLE_DIR}/pnpm-lock.yaml`);
rmSync(`${BUNDLE_DIR}/pnpm-workspace.yaml`);

manifest.tools = await listTools();
writeFileSync(`${BUNDLE_DIR}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);

execFileSync(npx, ["-y", MCPB_CLI, "pack", BUNDLE_DIR, "build/contractbook.mcpb"], {
  stdio: "inherit",
});

// Reads the tool list from the bundled server so the manifest can't drift from the code.
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
