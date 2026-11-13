import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_URL, client } from "../support/env";
import { user, type TestUser } from "../support/users";

/**
 * F10 §14 Excel templates (FE-026, the "Preset Excel templates" fake until EN-012): download a
 * preset as a workbook, change it in Excel (openpyxl here, through the engine's Python), upload it
 * back: exactly the changes made, and problems by sheet, row and column. Nothing is saved.
 */

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "engine");
const python = process.env.IFC_BOQ_PYTHON ?? (existsSync(path.join(ENGINE, ".venv", "Scripts", "python.exe")) ? path.join(ENGINE, ".venv", "Scripts", "python.exe") : path.join(ENGINE, ".venv", "bin", "python"));
const tmp = mkdtempSync(path.join(os.tmpdir(), "boqlet-templates-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

let ivana: TestUser;
let studioId: string;
let asModelled: string;

/** Runs Python over a workbook: `edit` gets the openpyxl workbook as `wb`. */
function py(file: string, edit: string): string {
  const script = ["import sys, json", "from openpyxl import load_workbook", "wb = load_workbook(sys.argv[1])", edit, "wb.save(sys.argv[1])"].join("\n");
  const res = spawnSync(python, ["-c", script, file], { encoding: "utf8", env: { ...process.env, PYTHONUTF8: "1" } });
  if (res.status !== 0) throw new Error(res.stderr);
  return res.stdout;
}

async function download(presetId: string, source = "draft") {
  const res = await fetch(`${API_URL}/presets/${presetId}/template.xlsx?source=${source}`, { headers: { Authorization: `Bearer ${ivana.token}` }, redirect: "manual" });
  expect(res.status).toBe(302);
  const file = await fetch(res.headers.get("Location")!);
  expect(file.ok).toBe(true);
  const target = path.join(tmp, `${presetId}-${Date.now()}.xlsx`);
  writeFileSync(target, Buffer.from(await file.arrayBuffer()));
  return target;
}

async function upload(presetId: string, file: string) {
  const form = new FormData();
  form.append("file", new Blob([readFileSync(file)]), "template.xlsx");
  const res = await fetch(`${API_URL}/presets/${presetId}/template-import`, { method: "POST", headers: { Authorization: `Bearer ${ivana.token}` }, body: form });
  return { status: res.status, body: (await res.json()) as { doc: Record<string, unknown>; changes: { what: string; summary: string }[]; problems: { sheet?: string; row?: number; column?: string; message: string }[]; code?: string } };
}

beforeAll(async () => {
  ivana = await user("ivana");
  const me = (await client(ivana.token).GET("/me")).data!;
  studioId = me.memberships.find((m) => m.org.slug === "studio-demo")!.org.id;
  const presets = (await client(ivana.token).GET("/orgs/{orgId}/presets", { params: { path: { orgId: studioId }, query: { kind: "rule_set", layer: "system" } } })).data!;
  asModelled = presets.find((p) => p.slug === "as-modelled")!.latestPublishedVersion!.id;
});

describe("F10 §14 Excel templates", () => {
  it("F10-AC8: three answers changed in Excel come back as exactly three changes; a wrong answer names its sheet, row and column", async () => {
    const preset = (await client(ivana.token).POST("/orgs/{orgId}/presets", { params: { path: { orgId: studioId } }, body: { kind: "rule_set", name: `Template ${Date.now()}`, start: { mode: "patch", fromVersionId: asModelled } } })).data!;
    const file = await download(preset.id);
    const rows = JSON.parse(py(file, "ws = wb['Settings']\nprint(json.dumps({str(r[0].value): i + 2 for i, r in enumerate(ws.iter_rows(min_row=2))}))").trim()) as Record<string, number>;
    expect(Object.keys(rows)).toEqual(expect.arrayContaining(["lines_by_storey", "wall_opening_threshold", "window_measure"]));
    // Three answers: a yes/no, a number, a choice (by its label, as the dropdown offers it).
    py(file, `ws = wb['Settings']
ws.cell(row=${rows.lines_by_storey}, column=6, value='yes')
ws.cell(row=${rows.wall_opening_threshold}, column=6, value=0.5)
labels = {'area': None}
ws.cell(row=${rows.window_measure}, column=6, value='area')`);
    const ok = await upload(preset.id, file);
    expect(ok.status).toBe(200);
    expect(ok.body.problems).toEqual([]);
    expect(ok.body.changes.filter((c) => c.what === "answer")).toHaveLength(3);
    expect(ok.body.doc.params).toMatchObject({ lines_by_storey: { value: true }, wall_opening_threshold: { value: 0.5 }, window_measure: { value: "area" } });
    // Nothing was saved.
    const after = (await client(ivana.token).GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: preset.draft!.id } } })).data!;
    expect((after.doc as { params: Record<string, unknown> }).params).toEqual({});

    py(file, `ws = wb['Settings']\nws.cell(row=${rows.lines_by_storey}, column=6, value='perhaps')`);
    const bad = await upload(preset.id, file);
    expect(bad.status).toBe(200);
    expect(bad.body.problems).toContainEqual(expect.objectContaining({ sheet: "Settings", row: rows.lines_by_storey, column: "F" }));
  });

  it("a classification's Codes and a dictionary's Names round-trip; duplicates and unknown codes are problems", async () => {
    const trades = (await client(ivana.token).GET("/orgs/{orgId}/presets", { params: { path: { orgId: studioId }, query: { kind: "classification", layer: "org" } } })).data!.find((p) => p.name === "Studio trades")!;
    const file = await download(trades.id, "latest");
    const unchanged = await upload(trades.id, file);
    expect(unchanged.status).toBe(200);
    expect(unchanged.body.changes).toEqual([]);
    expect(unchanged.body.problems).toEqual([]);
    py(file, `ws = wb['Codes']
first = ws.cell(row=2, column=1).value
ws.cell(row=2, column=4, value='Laying blocks {thickness} thick')
ws.append([first, 'Again', '', ''])
lines = wb['Codes per line']
lines.cell(row=2, column=3, value='NOPE-99')`);
    const edited = await upload(trades.id, file);
    expect(edited.body.changes).toContainEqual(expect.objectContaining({ what: "item_text" }));
    expect(edited.body.problems).toContainEqual(expect.objectContaining({ sheet: "Codes", column: "A" }));
    expect(edited.body.problems).toContainEqual(expect.objectContaining({ sheet: "Codes per line", row: 2, column: "C" }));

    const names = (await client(ivana.token).GET("/orgs/{orgId}/presets", { params: { path: { orgId: studioId }, query: { kind: "dictionary", layer: "org" } } })).data!.find((p) => p.name === "Studio names")!;
    const dict = await download(names.id, "latest");
    expect((await upload(names.id, dict)).body.changes).toEqual([]);
    py(dict, "ws = wb['Names']\nws.append(['', 'Ziegel 25', 'exact', 'material', 'no.such.term'])");
    const dictBad = await upload(names.id, dict);
    expect(dictBad.body.problems).toContainEqual(expect.objectContaining({ sheet: "Names", column: "E" }));
  });

  it("refuses a file that isn't a workbook", async () => {
    const preset = (await client(ivana.token).POST("/orgs/{orgId}/presets", { params: { path: { orgId: studioId } }, body: { kind: "dictionary", name: `Not xlsx ${Date.now()}`, start: { mode: "empty" } } })).data!;
    const text = path.join(tmp, "not.xlsx");
    writeFileSync(text, "hello");
    const res = await upload(preset.id, text);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid_file");
  });
});
