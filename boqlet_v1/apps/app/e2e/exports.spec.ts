import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { apiAs, generatedDuplexBoq, signInAs } from "./helpers";

/** FE-017: the run's Excel (F12), downloaded from the sheet, read back with the engine's openpyxl. */

const ROOT = path.resolve(__dirname, "..", "..", "..");
const DUPLEX = path.join(ROOT, "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");
test.describe.configure({ timeout: 240_000 });

/** The BoQ sheet's line rows: [ref, description, unit, quantity, source, notes] (section and subtotal rows left out). */
function boqRows(file: string): { ref: string; description: string; unit: string; quantity: number | null; notes: string }[] {
  const engine = path.join(ROOT, "engine");
  const py = existsSync(path.join(engine, ".venv", "Scripts", "python.exe")) ? path.join(engine, ".venv", "Scripts", "python.exe") : path.join(engine, ".venv", "bin", "python");
  const script = [
    "import json, sys",
    "from openpyxl import load_workbook",
    "ws = load_workbook(sys.argv[1])['BoQ']",
    "rows = []",
    "for r in ws.iter_rows(min_row=6, values_only=True):",
    "    ref, desc, unit, qty, rate, amount, source, notes = (list(r) + [None] * 8)[:8]",
    "    if unit:",
    "        rows.append({'ref': ref or '', 'description': desc or '', 'unit': unit, 'quantity': qty, 'notes': notes or ''})",
    "print(json.dumps(rows))",
  ].join("\n");
  return JSON.parse(execFileSync(py, ["-c", script, file], { encoding: "utf8", env: { ...process.env, PYTHONUTF8: "1" } }));
}

const byUnit = (rows: { unit: string; quantity: number | null }[]) => {
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.unit, (out.get(r.unit) ?? 0) + (r.quantity ?? 0));
  return out;
};

test("F12-AC1, F06-AC3 a Duplex run downloads an xlsx whose totals match the sheet, with the edits", async ({ page }) => {
  const { url, run: first, olivia } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)), ["acme-cost-codes"]);
  const boqId = url.split("/").at(-1)!;
  const lines0 = (await apiAs<{ items: { key: string; source: string; quantity: number | null }[] }>(olivia, "GET", `/runs/${first.id}/lines`)).items;
  const [edited, excluded] = lines0.filter((l) => l.source === "measured" && l.quantity !== null);
  await apiAs(olivia, "POST", `/boqs/${boqId}/overrides/batch`, {
    overrides: [
      { lineKey: edited!.key, quantity: 123.5, reason: "Measured on site" },
      { lineKey: excluded!.key, excluded: true, reason: "Out of scope" },
    ],
  });
  const boq = await apiAs<{ currentRevision: { id: string } }>(olivia, "GET", `/boqs/${boqId}`);
  const { run } = await apiAs<{ run: { id: string } }>(olivia, "POST", `/revisions/${boq.currentRevision.id}/runs`);
  await expect.poll(async () => (await apiAs<{ status: string }>(olivia, "GET", `/runs/${run.id}`)).status, { timeout: 120_000 }).toBe("complete");
  const lines = (await apiAs<{ items: { key: string; description: string; unit: string; quantity: number | null; excluded?: boolean }[] }>(olivia, "GET", `/runs/${run.id}/lines`)).items;
  const inBoq = lines.filter((l) => !l.excluded);

  await signInAs(page, "olivia");
  await page.goto(url);
  await expect(page.getByTestId("sheet-grid")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByTestId("export-xlsx").click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/_Tender-BoQ_RevA_\d{4}-\d{2}-\d{2}\.xlsx$/);
  await expect(page.getByText(`Downloaded ${file.suggestedFilename()}`)).toBeVisible();
  const saved = test.info().outputPath(file.suggestedFilename());
  await file.saveAs(saved);

  const rows = boqRows(saved);
  // Every line in the BoQ, none of the excluded ones, and the same totals per unit as the sheet.
  expect(rows).toHaveLength(inBoq.length);
  const expected = byUnit(inBoq);
  const actual = byUnit(rows);
  expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
  for (const [unit, total] of expected) expect(actual.get(unit)!).toBeCloseTo(total, 4);
  // The quantity edit with its reason (F06-AC3).
  const row = rows.find((r) => r.quantity === 123.5 && r.notes.includes("reason: Measured on site"));
  expect(row, "the edited line with its reason").toBeTruthy();
  expect(row!.notes).toContain("quantity edited: 123.5 instead of");
  expect(rows.some((r) => r.notes.includes("Out of scope"))).toBe(false);
});

/** Every text cell of a workbook's first sheet, read with the engine's openpyxl. */
function firstSheetText(file: string): string {
  const engine = path.join(ROOT, "engine");
  const py = existsSync(path.join(engine, ".venv", "Scripts", "python.exe")) ? path.join(engine, ".venv", "Scripts", "python.exe") : path.join(engine, ".venv", "bin", "python");
  const script = [
    "import sys",
    "from openpyxl import load_workbook",
    "ws = load_workbook(sys.argv[1], read_only=True).worksheets[0]",
    "for row in ws.iter_rows(values_only=True):",
    "    for c in row:",
    "        if isinstance(c, str): print(c)",
  ].join("\n");
  return execFileSync(py, ["-c", script, file], { encoding: "utf8" });
}

test("FE-032 F12-AC3 the Exports tab: a working export says WORKING; the saved version's frozen file doesn't; the audit CSV downloads", async ({ page }, testInfo) => {
  const { url, projectUrl, olivia } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  await signInAs(page, "olivia");
  await page.goto(`${url}?tab=exports`);
  const working = page.waitForEvent("download");
  await page.getByTestId("exports-new").click();
  const workingFile = testInfo.outputPath("working.xlsx");
  await (await working).saveAs(workingFile);
  expect(firstSheetText(workingFile)).toContain("(WORKING)");
  await expect(page.locator('[data-testid="exports-revision"][data-label="A"] [data-testid="export-row"][data-kind="boq_xlsx"]')).toHaveCount(1);

  const boq = await apiAs<{ currentRevision: { id: string } }>(olivia, "GET", `/boqs/${url.split("/").pop()}`);
  await apiAs(olivia, "POST", `/revisions/${boq.currentRevision.id}/issue`, { notModelledConfirmed: true, note: "Issued" });
  const saved = page.locator('[data-testid="exports-revision"][data-label="A"][data-status="issued"]');
  const frozenRow = saved.locator('[data-testid="export-row"][data-kind="issued_boq_xlsx"]');
  await expect(frozenRow).toHaveCount(1, { timeout: 30_000 });
  const frozen = page.waitForEvent("download");
  await frozenRow.getByTestId("export-download").click();
  const frozenFile = testInfo.outputPath("saved.xlsx");
  await (await frozen).saveAs(frozenFile);
  const frozenText = firstSheetText(frozenFile);
  expect(frozenText).not.toContain("(WORKING)");
  expect(frozenText).toContain("revision A: Issued");

  await page.goto(`${projectUrl}/activity`);
  const csv = page.waitForEvent("download");
  await page.getByTestId("audit-csv").click();
  expect((await csv).suggestedFilename()).toMatch(/_audit\.csv$/);
});

test("FE-037 F12-AC4 / v1 criterion 13: an Excel edited by hand imports as exactly its edits; the ticked ones apply as line edits", async ({ page }, testInfo) => {
  const { url } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  await signInAs(page, "olivia");
  await page.goto(`${url}?tab=exports`);
  const download = page.waitForEvent("download");
  await page.getByTestId("exports-new").click();
  const file = testInfo.outputPath("edited.xlsx");
  await (await download).saveAs(file);
  const engine = path.join(ROOT, "engine");
  const py = existsSync(path.join(engine, ".venv", "Scripts", "python.exe")) ? path.join(engine, ".venv", "Scripts", "python.exe") : path.join(engine, ".venv", "bin", "python");
  const done = JSON.parse(execFileSync(py, [path.join(ROOT, "tests", "support", "edit_boq_xlsx.py"), file], { encoding: "utf8" })) as { added: { description: string } };

  await page.getByTestId("edits-import-file").setInputFiles(file);
  const review = page.getByTestId("edits-import-review");
  await expect(review).toBeVisible({ timeout: 30_000 });
  await expect(review.getByTestId("edits-import-edit")).toHaveCount(3);
  for (const change of ["quantity", "moved", "excluded"]) await expect(review.locator(`[data-testid="edits-import-edit"][data-change="${change}"]`)).toHaveCount(1);
  await expect(review.getByTestId("edits-import-manual")).toHaveCount(1);
  await expect(review.getByTestId("edits-import-manual")).toContainText(done.added.description);
  await expect(review.getByTestId("edits-import-apply")).toBeDisabled();
  const reasons = review.getByTestId("edits-import-reason");
  await expect(reasons).toHaveCount(2);
  for (let i = 0; i < 2; i++) await reasons.nth(i).fill("Checked on site");
  await review.getByTestId("edits-import-apply").click();
  await expect(page.getByTestId("edits-import-applied")).toContainText("4 changes applied");
  await expect(page.getByTestId("pending-changes")).toContainText("line edits");

  await page.getByTestId("generate").click();
  await expect(page.getByTestId("pending-changes")).toHaveCount(0, { timeout: 60_000 });
  await page.getByTestId("tab-sheet").click();
  await expect(page.getByTestId("sheet")).toContainText(done.added.description);
});
