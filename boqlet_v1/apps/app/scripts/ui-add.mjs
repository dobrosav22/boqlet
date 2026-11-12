#!/usr/bin/env node
// Add shadcn/ui components of the style in components.json (base-mira, preset b38miVKzY) without
// the shadcn CLI's install step: `npm run ui:add -w @ifc-boq/app -- button dialog`.
//
// Why: the registry's components import `cn` from an npm package of that name, which this repo
// does not use; they get the shadcn helper in `src/lib/utils.ts` (clsx + tailwind-merge) instead.
// Registry dependencies are added too; npm dependencies are printed for you to add to
// apps/app/package.json (pinned) and install with a plain `npm install` in the product root.
// Existing files are kept unless --overwrite is given.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(path.join(appRoot, "components.json"), "utf8"));
const style = config.style;
const args = process.argv.slice(2);
const overwrite = args.includes("--overwrite");
const queue = args.filter((a) => !a.startsWith("--"));
if (queue.length === 0) {
  console.error("usage: ui-add <component> [...] [--overwrite]");
  process.exit(2);
}

const target = { "registry:ui": "src/components/ui", "registry:hook": "src/hooks", "registry:lib": "src/lib" };
const seen = new Set();
const npmDeps = new Set();
const pkg = JSON.parse(await readFile(path.join(appRoot, "package.json"), "utf8"));
const installed = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);

while (queue.length) {
  const name = queue.shift();
  if (seen.has(name)) continue;
  seen.add(name);
  const url = name.startsWith("http") ? name : `https://ui.shadcn.com/r/styles/${style}/${name}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const item = await res.json();
  for (const dep of item.registryDependencies ?? []) {
    const short = dep.replace(/^@shadcn\//, "");
    if (short !== "utils") queue.push(short);
  }
  for (const dep of item.dependencies ?? []) {
    const bare = dep.replace(/(?<=.)@[^/]*$/, "");
    if (bare !== "cn" && !installed.has(bare)) npmDeps.add(dep);
  }
  for (const file of item.files ?? []) {
    const dir = target[file.type];
    if (!dir) {
      console.warn(`[ui:add] ${name}: skipped ${file.path} (${file.type})`);
      continue;
    }
    const out = path.join(appRoot, dir, path.basename(file.path));
    if (existsSync(out) && !overwrite) {
      console.log(`[ui:add] kept ${path.relative(appRoot, out)}`);
      continue;
    }
    const content = file.content
      .replace(/from "cn"/g, 'from "@/lib/utils"')
      .replace(/from "@\/registry\/[^/]+\/(ui|hooks|lib)\//g, (_m, kind) => `from "@/${kind === "ui" ? "components/ui" : kind}/`);
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, content, "utf8");
    console.log(`[ui:add] wrote ${path.relative(appRoot, out)}`);
  }
}
if (npmDeps.size) console.log(`[ui:add] add these npm dependencies (pinned) to apps/app/package.json: ${[...npmDeps].join(" ")}`);
