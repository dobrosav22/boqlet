/**
 * Fake "BoQ export" (mock-api.md, replaced by EN-006): the PoC engine's own Excel writer
 * (`ifc_boq.export_xlsx.export`, run with the engine's Python) over the run's result as the mock
 * keeps it, so the BoQ's line edits (applied by the "Line edits applied" fake) are in the file:
 * excluded lines leave the BoQ, and an edited line says what was edited, the engine's value and the
 * reason in its notes. Nothing is measured here (BR-01).
 *
 * Known gaps until EN-006: the PoC layout (no cover sheet, no "Excluded lines" sheet, no hidden line
 * keys for the edits import), English only, and the WORKING mark is in the title line.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BoqResult } from "@ifc-boq/types";
import { fileURLToPath } from "node:url";
import { PRODUCT_ROOT } from "../../paths.js";
import type { EditedLine } from "./line-edits.js";

export interface ExportMeta {
  /** Classifications in grouping order: the first groups the BoQ sheet. */
  classifications: { id: string; name: string }[];
  modelName: string;
  generatedAt: string;
  dictionaries?: string[];
  /** The BoQ the file is of: the edits import (FE-037) refuses a file of another BoQ. */
  boqId?: string;
}

const ENGINE = path.join(PRODUCT_ROOT, "engine");
/** The round-trip fake (FE-037): hidden line keys and the exported values, and reading an edited file back. */
const ROUNDTRIP = path.join(path.dirname(fileURLToPath(import.meta.url)), "boq_roundtrip.py");
const SCRIPT = [
  "import json, sys",
  "from ifc_boq.export_xlsx import export",
  "result = json.load(open(sys.argv[1], encoding='utf8'))",
  "meta = json.load(open(sys.argv[2], encoding='utf8'))",
  "open(sys.argv[3], 'wb').write(export(result, meta))",
].join("\n");

function python() {
  if (process.env.IFC_BOQ_PYTHON) return process.env.IFC_BOQ_PYTHON;
  const win = path.join(ENGINE, ".venv", "Scripts", "python.exe");
  return existsSync(win) ? win : path.join(ENGINE, ".venv", "bin", "python");
}

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "to confirm" : String(Math.round(v * 1e6) / 1e6));

/**
 * The result the export shows: without excluded lines, each edit written in the line's notes, and
 * (P14, F06 §2) the item text of the grouping system as the Description, with what was measured in the
 * notes. An edited description wins over the item text.
 */
export function exportedResult(result: BoqResult, groupBy?: string): BoqResult {
  const lines = (result.lines as EditedLine[])
    .filter((l) => !l.excluded)
    .map((l) => {
      const o = l.overridden;
      const text = groupBy && !o?.fields.includes("description") ? l.codes?.[groupBy]?.text : undefined;
      const withText = text ? { ...l, description: text, notes: [...l.notes, `Measured as: ${l.description}`] } : l;
      if (!o) return withText;
      const parts: string[] = [];
      if (o.fields.includes("quantity")) parts.push(`quantity edited: ${fmt(o.quantity)} instead of ${fmt(o.engineQuantity)}${o.engineUnit ? ` ${o.engineUnit}` : ""}`);
      if (o.fields.includes("description")) parts.push(`description edited (measured as: ${o.engineDescription})`);
      if (o.fields.includes("codes")) parts.push("moved to another section");
      if (o.reason) parts.push(`reason: ${o.reason}`);
      return parts.length ? { ...withText, notes: [...withText.notes, `Edited: ${parts.join("; ")}`] } : withText;
    });
  return { ...result, lines };
}

function runPython(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(python(), args, { ...(cwd ? { cwd } : {}), env: { ...process.env, PYTHONUTF8: "1" } });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += String(d)));
    child.stderr.on("data", (d) => (err += String(d)));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`python failed (${code}): ${err.slice(-500)}`))));
  });
}

/** One line as the import compares it: its key, its codes, whether it is excluded now. */
export interface ImportLine {
  key: string;
  codes: BoqResult["lines"][number]["codes"];
  excluded?: boolean;
}

/** Reads an edited BoQ workbook back against the BoQ's current lines (F12, FE-037): the EditsImportReport. */
export async function readEditedXlsx(xlsx: Uint8Array, info: { boqId: string; primary: string | null; lines: ImportLine[] }): Promise<unknown> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "boqlet-import-"));
  try {
    await writeFile(path.join(dir, "in.xlsx"), xlsx);
    await writeFile(path.join(dir, "info.json"), JSON.stringify(info));
    return JSON.parse(await runPython([ROUNDTRIP, "read", path.join(dir, "in.xlsx"), path.join(dir, "info.json")]));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Writes the BoQ Excel of a result with the engine's exporter; returns the xlsx bytes. */
export async function exportXlsx(result: BoqResult, meta: ExportMeta): Promise<Uint8Array> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "boqlet-export-"));
  try {
    const [resultPath, metaPath, rawPath, infoPath, outPath] = ["result.json", "meta.json", "raw.xlsx", "info.json", "boq.xlsx"].map((f) => path.join(dir, f)) as [string, string, string, string, string];
    const shown = exportedResult(result, meta.classifications[0]?.id);
    await writeFile(resultPath, JSON.stringify(shown));
    await writeFile(metaPath, JSON.stringify(meta));
    await runPython(["-c", SCRIPT, resultPath, metaPath, rawPath], ENGINE);
    await writeFile(infoPath, JSON.stringify({ boqId: meta.boqId ?? "", primary: meta.classifications[0]?.id ?? null, lines: shown.lines.map((l) => ({ key: l.key, codes: l.codes })) }));
    await runPython([ROUNDTRIP, "annotate", rawPath, infoPath, outPath]);
    return new Uint8Array(await readFile(outPath));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
