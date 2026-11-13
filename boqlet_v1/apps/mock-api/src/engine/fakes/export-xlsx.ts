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
import { PRODUCT_ROOT } from "../../paths.js";
import type { EditedLine } from "./line-edits.js";

export interface ExportMeta {
  /** Classifications in grouping order: the first groups the BoQ sheet. */
  classifications: { id: string; name: string }[];
  modelName: string;
  generatedAt: string;
  dictionaries?: string[];
}

const ENGINE = path.join(PRODUCT_ROOT, "engine");
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

/** The result the export shows: without excluded lines, each edit written in the line's notes. */
export function exportedResult(result: BoqResult): BoqResult {
  const lines = (result.lines as EditedLine[])
    .filter((l) => !l.excluded)
    .map((l) => {
      const o = l.overridden;
      if (!o) return l;
      const parts: string[] = [];
      if (o.fields.includes("quantity")) parts.push(`quantity edited: ${fmt(o.quantity)} instead of ${fmt(o.engineQuantity)}${o.engineUnit ? ` ${o.engineUnit}` : ""}`);
      if (o.fields.includes("description")) parts.push(`description edited (measured as: ${o.engineDescription})`);
      if (o.fields.includes("codes")) parts.push("moved to another section");
      if (o.reason) parts.push(`reason: ${o.reason}`);
      return parts.length ? { ...l, notes: [...l.notes, `Edited: ${parts.join("; ")}`] } : l;
    });
  return { ...result, lines };
}

/** Writes the BoQ Excel of a result with the engine's exporter; returns the xlsx bytes. */
export async function exportXlsx(result: BoqResult, meta: ExportMeta): Promise<Uint8Array> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "boqlet-export-"));
  try {
    const [resultPath, metaPath, outPath] = ["result.json", "meta.json", "boq.xlsx"].map((f) => path.join(dir, f)) as [string, string, string];
    await writeFile(resultPath, JSON.stringify(exportedResult(result)));
    await writeFile(metaPath, JSON.stringify(meta));
    await new Promise<void>((resolve, reject) => {
      const child = spawn(python(), ["-c", SCRIPT, resultPath, metaPath, outPath], { cwd: ENGINE, env: { ...process.env, PYTHONUTF8: "1" } });
      let err = "";
      child.stderr.on("data", (d) => (err += String(d)));
      child.on("error", reject);
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`export failed (${code}): ${err.slice(-500)}`))));
    });
    return new Uint8Array(await readFile(outPath));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
