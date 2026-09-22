#!/usr/bin/env node
// Stages an ephemeral MCPB bundle directory (server code + production-only
// node_modules) from the already-built `dist/`, then packs it into a .mcpb.
// Run via `npm run package:mcpb` (which builds first).
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const stageDir = new URL("../.mcpb-build/", import.meta.url);
const stagePath = fileURLToPath(stageDir);

rmSync(stagePath, { recursive: true, force: true });
mkdirSync(fileURLToPath(new URL("server", stageDir)), { recursive: true });

cpSync(fileURLToPath(new URL("../dist", import.meta.url)), fileURLToPath(new URL("server", stageDir)), {
  recursive: true,
  // .d.ts/.map files aren't needed at runtime and just add dead weight to the bundle.
  filter: (src) => !src.endsWith(".d.ts") && !src.endsWith(".map"),
});
cpSync(fileURLToPath(new URL("../manifest.json", import.meta.url)), fileURLToPath(new URL("manifest.json", stageDir)));

const rootPkg = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"));
const bundlePkg = {
  name: rootPkg.name,
  version: rootPkg.version,
  private: true,
  type: "module",
  dependencies: rootPkg.dependencies,
};
writeFileSync(fileURLToPath(new URL("package.json", stageDir)), JSON.stringify(bundlePkg, null, 2));

console.log("Installing production dependencies into .mcpb-build/ ...");
execFileSync("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], {
  cwd: stagePath,
  stdio: "inherit",
});

console.log("Validating manifest ...");
execFileSync("npx", ["--no-install", "@anthropic-ai/mcpb", "validate", "manifest.json"], {
  cwd: stagePath,
  stdio: "inherit",
});

const outFile = `${rootPkg.name}.mcpb`;
console.log(`Packing ${outFile} ...`);
execFileSync("npx", ["--no-install", "@anthropic-ai/mcpb", "pack", stagePath, `${root}${outFile}`], {
  stdio: "inherit",
});

console.log(`Done: ${outFile}`);
