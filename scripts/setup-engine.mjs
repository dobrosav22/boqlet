#!/usr/bin/env node
/**
 * Creates engine/.venv and installs the Python engine into it.
 * Runs automatically after `npm install` (postinstall); rerun with `npm run setup:engine`.
 *
 * Skips quietly when IFC_BOQ_SKIP_ENGINE_SETUP=1, and never fails `npm install`:
 * if Python is missing it prints what to do instead.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const engine = join(root, "engine");
const venv = join(engine, ".venv");
const isWin = process.platform === "win32";
const venvPython = isWin ? join(venv, "Scripts", "python.exe") : join(venv, "bin", "python");
const force = process.argv.includes("--force");
const stamp = join(venv, ".installed-hash");

const log = (m) => console.log(`[engine setup] ${m}`);

if (process.env.IFC_BOQ_SKIP_ENGINE_SETUP === "1") {
  log("skipped (IFC_BOQ_SKIP_ENGINE_SETUP=1)");
  process.exit(0);
}

function findPython() {
  const candidates = process.env.IFC_BOQ_PYTHON
    ? [process.env.IFC_BOQ_PYTHON]
    : isWin ? ["py -3.12", "py -3.11", "py -3.13", "py -3.10", "py -3", "python"] : ["python3.12", "python3.11", "python3.13", "python3.10", "python3", "python"];
  for (const c of candidates) {
    const [cmd, ...args] = c.split(" ");
    const r = spawnSync(cmd, [...args, "-c", "import sys; print('%d.%d' % sys.version_info[:2])"], { encoding: "utf8" });
    if (r.status === 0) {
      const [maj, min] = r.stdout.trim().split(".").map(Number);
      if (maj === 3 && min >= 10 && min <= 13) return { cmd, args, version: r.stdout.trim() };
    }
  }
  return null;
}

const reqFile = join(engine, "requirements.txt");
const pyproject = join(engine, "pyproject.toml");
const hash = createHash("sha256")
  .update(readFileSync(reqFile))
  .update(readFileSync(pyproject))
  .digest("hex");

if (!force && existsSync(venvPython) && existsSync(stamp) && readFileSync(stamp, "utf8") === hash) {
  log("up to date");
  process.exit(0);
}

const py = findPython();
if (!py) {
  log("Python 3.10-3.13 not found. The web app will install, but the engine will not run.");
  log("Install Python 3.12 (python.org), then run:  npm run setup:engine");
  log("Or point to a specific interpreter:  IFC_BOQ_PYTHON=/path/to/python npm run setup:engine");
  process.exit(0);
}

const run = (cmd, args, label) => {
  log(label);
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: engine });
  if (r.status !== 0) {
    log(`FAILED: ${label}. Fix the error above, then run: npm run setup:engine`);
    process.exit(0);
  }
};

if (!existsSync(venvPython) || force) {
  run(py.cmd, [...py.args, "-m", "venv", venv], `creating engine/.venv with Python ${py.version}`);
}
run(venvPython, ["-m", "pip", "install", "--upgrade", "pip", "--quiet"], "upgrading pip");
run(venvPython, ["-m", "pip", "install", "-r", reqFile, "--quiet"], "installing engine dependencies (ifcopenshell, trimesh, ...) - first time takes a minute");
run(venvPython, ["-m", "pip", "install", "-e", ".", "--no-deps", "--quiet"], "installing the engine package (editable)");
writeFileSync(stamp, hash);
log(`ready (${venvPython}, ${statSync(venvPython).isFile() ? "ok" : "?"})`);
