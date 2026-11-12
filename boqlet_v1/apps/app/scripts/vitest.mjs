#!/usr/bin/env node
// Run Vitest with the working directory's drive letter in upper case. Some Windows shells (Git
// Bash) hand npm a "c:\..." cwd; Vitest then loads its own module twice and every suite fails with
// "Cannot read properties of undefined (reading 'config')". Elsewhere this changes nothing.
const cwd = process.cwd();
if (/^[a-z]:/.test(cwd)) process.chdir(cwd[0].toUpperCase() + cwd.slice(1));
const { startVitest } = await import("vitest/node");
const vitest = await startVitest("test", process.argv.slice(2), { run: true });
await vitest?.close();
