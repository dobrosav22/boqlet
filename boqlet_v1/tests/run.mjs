#!/usr/bin/env node
// Runs a shared suite: `node run.mjs contract|scenarios [--mock]`.
//   API_URL=<base>/api/v1  runs it against a running backend (the mock, or Java in phase 2).
//   --mock                 starts a fresh mock on a free port (own data folder, reseeded),
//                          runs the suite against it and stops it (mock-api.md `test:contract:mock`).
// Plain Node so it runs the same on Windows and in CI.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const suite = process.argv[2];
if (suite !== "contract" && suite !== "scenarios") {
  console.error("usage: node run.mjs contract|scenarios [--mock]");
  process.exit(2);
}
const useMock = process.argv.includes("--mock");

// Vitest needs one spelling of the path on Windows (see apps/app/scripts/vitest.mjs).
if (/^[a-z]:/.test(process.cwd())) process.chdir(process.cwd()[0].toUpperCase() + process.cwd().slice(1));

const freePort = () =>
  new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

async function waitFor(url, child, what) {
  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline || child.exitCode !== null) {
      console.error(`[suites] ${what} did not start`);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

let mock = null;
let engineProcess = null;
let dataDir = null;
if (useMock) {
  // A private PoC engine for the suite (phase 1; the worker from EN-001): no auto-reload, own port.
  const productRoot = path.resolve(here, "..");
  const python = path.join(productRoot, "engine", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  let engineUrl = process.env.POC_ENGINE_URL;
  if (!engineUrl && existsSync(python)) {
    const enginePort = await freePort();
    engineProcess = spawn(python, ["-m", "uvicorn", "ifc_boq.api:app", "--host", "127.0.0.1", "--port", String(enginePort), "--log-level", "warning"], {
      cwd: path.join(productRoot, "engine"),
      stdio: ["ignore", "ignore", "inherit"],
    });
    engineUrl = `http://127.0.0.1:${enginePort}`;
    await waitFor(`${engineUrl}/api/health`, engineProcess, "the engine");
  } else if (!engineUrl) {
    console.warn("[suites] no engine venv (npm run setup:engine): scenarios that parse or run will fail");
  }
  const port = await freePort();
  dataDir = mkdtempSync(path.join(os.tmpdir(), "boqlet-suite-"));
  mock = spawn(process.execPath, [path.join(productRoot, "node_modules", "tsx", "dist", "cli.mjs"), "src/server.ts", "--reseed"], {
    cwd: path.join(productRoot, "apps", "mock-api"),
    env: { ...process.env, MOCK_PORT: String(port), MOCK_DATA_DIR: dataDir, MOCK_PUBLIC_URL: `http://localhost:${port}`, ...(engineUrl ? { POC_ENGINE_URL: engineUrl } : {}) },
    stdio: ["ignore", "ignore", "inherit"],
  });
  process.env.API_URL = `http://localhost:${port}/api/v1`;
  process.env.SUITE_TARGET = "mock";
  await waitFor(`http://localhost:${port}/`, mock, "the mock");
}

let code = 1;
try {
  const require = createRequire(path.join(process.cwd(), "package.json"));
  const { startVitest } = await import(pathToFileURL(require.resolve("vitest/node")).href);
  const vitest = await startVitest("test", [`${suite}/`], { run: true, root: here, config: path.join(here, "vitest.config.ts") });
  code = process.exitCode ?? (vitest?.state.getCountOfFailedTests() ? 1 : 0);
  await vitest?.close();
} finally {
  if (mock) mock.kill();
  if (engineProcess) engineProcess.kill();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
}
process.exit(code);
