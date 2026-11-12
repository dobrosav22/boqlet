#!/usr/bin/env node
// Run Vitest with the working directory's drive letter in upper case. Some Windows shells (Git
// Bash) hand npm a "c:\..." cwd; Vitest then loads its own module twice and every suite fails
// ("Cannot read properties of undefined (reading 'config')" or "failed to find the runner").
// Vitest is resolved from the corrected cwd so every module agrees on one path. Elsewhere this
// changes nothing.
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const cwd = process.cwd();
if (/^[a-z]:/.test(cwd)) process.chdir(cwd[0].toUpperCase() + cwd.slice(1));
const require = createRequire(path.join(process.cwd(), "package.json"));
const { startVitest } = await import(pathToFileURL(require.resolve("vitest/node")).href);
const vitest = await startVitest("test", process.argv.slice(2), { run: true });
await vitest?.close();
