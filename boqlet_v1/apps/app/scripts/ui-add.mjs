#!/usr/bin/env node
// Add shadcn/ui components of the style in components.json (base-mira, preset b38miVKzY):
//   npm run ui:add -w @ifc-boq/app -- button dialog [--overwrite]
//
// Why not `npx shadcn add`: the registry's components import `cn` from an npm package of that
// name, and the CLI installs it; this repo uses the classic helper in `src/lib/utils.ts`
// (clsx + tailwind-merge) instead. So this script asks the CLI for a dry run with the files'
// contents (which already carries every CLI transform: icons, aliases, "use client"), writes the
// files itself with `cn` imported from "@/lib/utils", and prints the npm dependencies still to
// add (pin them in apps/app/package.json, then a plain `npm install` in the product root).
// Existing files are kept unless --overwrite is given.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHADCN = "shadcn@4.23.0";
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const overwrite = args.includes("--overwrite");
const names = args.filter((a) => !a.startsWith("--"));
if (names.length === 0) {
  console.error("usage: ui-add <component> [...] [--overwrite]");
  process.exit(2);
}

const ANSI = /\x1b\[[0-9;]*m/g;
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const files = new Map();
const deps = new Set();

// One dry run per component: asked for several at once, the CLI leaves some files out of the view.
for (const name of names) {
  const run = execFileSync(npx, ["-y", SHADCN, "add", name, "--dry-run", "--view", "--cwd", appRoot], {
    cwd: appRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  }).replace(ANSI, "");
  // Each file:  ├ <path> (create|overwrite|skip) N lines / │ ┌── / │ │ <line>… / │ └──
  // Dependencies:  ├ Dependencies (N) / │ + <package>
  let current = null;
  let inDeps = false;
  for (const line of run.split(/\r?\n/)) {
    const header = line.match(/^├ (\S+) \((?:create|overwrite|skip)\)/);
    if (header) {
      const file = header[1].split("\\").join("/");
      current = files.has(file) ? null : { body: [] };
      if (current) files.set(file, current);
      inDeps = false;
      continue;
    }
    if (line.startsWith("├ Dependencies")) {
      inDeps = true;
      continue;
    }
    if (inDeps) {
      const dep = line.match(/^│ \+ (\S+)/);
      if (dep) deps.add(dep[1]);
      else if (!line.startsWith("│ ")) inDeps = false;
      continue;
    }
    if (!current) continue;
    if (line.startsWith("│ │ ")) current.body.push(line.slice(4));
    else if (line === "│ │") current.body.push("");
    else if (line.startsWith("│ └")) current = null;
  }
}
if (files.size === 0) throw new Error("ui-add: no files in the shadcn dry run");

for (const [file, { body }] of files) {
  const out = path.join(appRoot, file);
  if (existsSync(out) && !overwrite) {
    console.log(`[ui:add] kept ${file}`);
    continue;
  }
  while (body.length && body[body.length - 1] === "") body.pop();
  const content = body.join("\n").replace(/from "cn"/g, 'from "@/lib/utils"') + "\n";
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, content, "utf8");
  console.log(`[ui:add] wrote ${file}`);
}

const pkg = JSON.parse(await readFile(path.join(appRoot, "package.json"), "utf8"));
const have = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
const missing = [...deps].filter((d) => {
  const bare = d.replace(/(?<=.)@[^/]*$/, "");
  return bare !== "cn" && !have.has(bare);
});
if (missing.length) console.log(`[ui:add] add these npm dependencies (pinned) to apps/app/package.json: ${missing.join(" ")}`);
