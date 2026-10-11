#!/usr/bin/env node
/**
 * Runs the Python engine from engine/.venv without activating it.
 *   node scripts/run-engine.mjs serve            -> API on http://127.0.0.1:8787 (auto-reload)
 *   node scripts/run-engine.mjs test             -> pytest
 *   node scripts/run-engine.mjs cli <args>       -> python -m ifc_boq.cli <args>
 *   node scripts/run-engine.mjs import-uniclass  -> fetch + import Uniclass 2015 EF code list
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const engine = join(root, "engine");
const isWin = process.platform === "win32";
const py = isWin ? join(engine, ".venv", "Scripts", "python.exe") : join(engine, ".venv", "bin", "python");
const [, , cmd, ...rest] = process.argv;

if (!existsSync(py)) {
  console.error("[engine] engine/.venv not found. Run: npm run setup:engine");
  process.exit(1);
}

const port = process.env.IFC_BOQ_ENGINE_PORT || "8787";
const commands = {
  serve: ["-m", "uvicorn", "ifc_boq.api:app", "--host", "127.0.0.1", "--port", port, "--reload", "--reload-dir", "ifc_boq"],
  test: ["-m", "pytest", "-q", ...rest],
  cli: ["-m", "ifc_boq.cli", ...rest],
  "import-uniclass": ["scripts/fetch_uniclass.py", ...rest],
};
const args = commands[cmd];
if (!args) {
  console.error(`[engine] unknown command "${cmd}". Use: ${Object.keys(commands).join(" | ")}`);
  process.exit(1);
}
// CLI paths are relative to where the user ran npm; everything else runs inside engine/.
const cwd = cmd === "cli" ? process.env.INIT_CWD || process.cwd() : engine;
const child = spawn(py, args, { cwd, stdio: "inherit", env: { ...process.env, PYTHONUNBUFFERED: "1" } });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
