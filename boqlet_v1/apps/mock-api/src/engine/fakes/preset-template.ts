/**
 * Fake "Preset Excel templates" (mock-api.md, replaced by EN-012): a rule set's Settings, a
 * classification's Codes and Codes per line, a dictionary's Names, written to and read back from an
 * xlsx by `preset_template.py` with the engine's Python (openpyxl, as the FE-017 export fake). The
 * read gives the proposed draft, the changes and the problems by sheet, row and column; nothing is
 * saved. Nothing is measured (BR-01).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCT_ROOT } from "../../paths.js";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "preset_template.py");

function python() {
  if (process.env.IFC_BOQ_PYTHON) return process.env.IFC_BOQ_PYTHON;
  const engine = path.join(PRODUCT_ROOT, "engine");
  const win = path.join(engine, ".venv", "Scripts", "python.exe");
  return existsSync(win) ? win : path.join(engine, ".venv", "bin", "python");
}

export interface TemplateInput {
  kind: "rule_set" | "classification" | "dictionary";
  doc: unknown;
  effective?: unknown;
  parentParams?: unknown;
  items?: { id: string; label: string }[];
  terms?: string[];
  source: "draft" | "latest" | "empty";
}

export interface TemplateImport {
  doc: Record<string, unknown>;
  changes: { what: string; summary: string; before?: unknown; after?: unknown }[];
  problems: { sheet?: string; row?: number; column?: string; message: string }[];
}

function run(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(python(), [SCRIPT, ...args], { env: { ...process.env, PYTHONUTF8: "1" } });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err.trim().split("\n").pop() || `template script exited ${code}`))));
  });
}

export async function writeTemplate(input: TemplateInput): Promise<Uint8Array> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "boqlet-template-"));
  try {
    await writeFile(path.join(dir, "in.json"), JSON.stringify(input));
    await run(["write", path.join(dir, "in.json"), path.join(dir, "out.xlsx")]);
    return new Uint8Array(await readFile(path.join(dir, "out.xlsx")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Reads a filled-in template; `{error}` when the file isn't a workbook. */
export async function readTemplate(input: TemplateInput, xlsx: Uint8Array): Promise<TemplateImport | { error: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "boqlet-template-"));
  try {
    await writeFile(path.join(dir, "in.json"), JSON.stringify(input));
    await writeFile(path.join(dir, "in.xlsx"), xlsx);
    return JSON.parse(await run(["read", path.join(dir, "in.json"), path.join(dir, "in.xlsx")])) as TemplateImport | { error: string };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
