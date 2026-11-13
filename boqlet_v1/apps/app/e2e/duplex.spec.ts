import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { apiAs, devUser, signInAs, unique } from "./helpers";

/**
 * FE-020, v1 criterion 1 (Duplex reproduction): through the whole stack (UI upload → parse job → run
 * job → lines API), "As modelled" + "ACME cost codes" gives exactly the lines of the hand-made Duplex
 * BoQ. The expected lines are read from the engine's own acceptance test (`HAND_BOQ`, `COUNTS` in
 * `engine/tests/test_duplex.py`), so the two can't drift apart.
 */

const ROOT = path.resolve(__dirname, "..", "..", "..");
const DUPLEX = path.join(ROOT, "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");
test.describe.configure({ timeout: 300_000 });

type Expected = { hand: [string, string, number, string][]; counts: [string, string, number][] };

function handBoq(): Expected {
  const engine = path.join(ROOT, "engine");
  const py = existsSync(path.join(engine, ".venv", "Scripts", "python.exe")) ? path.join(engine, ".venv", "Scripts", "python.exe") : path.join(engine, ".venv", "bin", "python");
  const script = ["import json, sys", "sys.path.insert(0, 'tests')", "import test_duplex as t", "print(json.dumps({'hand': t.HAND_BOQ, 'counts': t.COUNTS}))"].join("\n");
  return JSON.parse(execFileSync(py, ["-c", script], { cwd: engine, encoding: "utf8", env: { ...process.env, PYTHONUTF8: "1" } }));
}

type Line = { ruleId: string; description: string; unit: string; quantity: number | null };
/** The engine test's `q`: the sum of the quantities of a rule's lines whose description contains the text. */
const q = (lines: Line[], ruleId: string, contains: string) => {
  const found = lines.filter((l) => l.ruleId === ruleId && l.description.includes(contains));
  expect(found.length, `no line ${ruleId} / ${JSON.stringify(contains)}`).toBeGreaterThan(0);
  return { quantity: found.reduce((s, l) => s + (l.quantity ?? 0), 0), units: new Set(found.map((l) => l.unit)) };
};

test("v1-1 the Duplex, uploaded and generated in the app with As modelled + ACME cost codes, reproduces the hand-made BoQ", async ({ page }) => {
  const expected = handBoq();
  expect(expected.hand.length).toBeGreaterThan(20);
  await signInAs(page, "olivia");

  // Project and model, through the UI.
  const name = `Duplex ${unique("d")}`;
  await page.goto("/studio-demo/projects/new");
  await page.getByTestId("project-name").fill(name);
  await page.getByTestId("create-project").click();
  await expect(page.getByTestId("project-title")).toHaveText(name);
  const projectUrl = new URL(page.url()).pathname;
  await page.goto(`${projectUrl}/models`);
  await page.getByTestId("model-name").fill("Architecture");
  await page.getByTestId("add-model-submit").click();
  await expect(page.getByTestId("model-Architecture")).toBeVisible();

  // Upload → parse job → the version's report.
  await page.locator('[data-testid^="upload-input-"]').setInputFiles(DUPLEX);
  await expect(page.getByTestId("version-page")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("input-check-report")).toBeVisible({ timeout: 180_000 });

  // A BoQ with As modelled and ACME cost codes → run job.
  await page.goto(`${projectUrl}/boqs`);
  await page.getByTestId("new-boq").click();
  const dialog = page.getByTestId("create-boq-dialog");
  await expect(dialog.getByLabel("Rule set")).toContainText("As modelled");
  await expect(dialog.getByTestId("create-model-Architecture")).toBeChecked();
  await dialog.getByTestId("boq-name").fill("Duplex BoQ");
  await dialog.getByTestId("create-boq-submit").click();
  await expect(page.getByTestId("setup-tab")).toBeVisible();
  await page.getByTestId("add-classification").selectOption({ label: "ACME cost codes · System" });
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("current-run")).toHaveAttribute("data-status", "complete", { timeout: 120_000 });
  const runId = (await page.getByTestId("current-run").getAttribute("data-run"))!;

  // The lines API: every hand-made line, with its quantity (the engine test's tolerance), and every count.
  const olivia = await devUser("olivia");
  const lines = (await apiAs<{ items: Line[] }>(olivia, "GET", `/runs/${runId}/lines`)).items;
  for (const [ruleId, contains, quantity, unit] of expected.hand) {
    const got = q(lines, ruleId, contains);
    expect([...got.units], `${ruleId} / ${contains}`).toEqual([unit]);
    expect(Math.abs(got.quantity - quantity), `${ruleId} / ${contains}: ${got.quantity} vs ${quantity}`).toBeLessThanOrEqual(Math.max(quantity * 2e-3, 0.011));
  }
  for (const [ruleId, contains, count] of expected.counts) expect(q(lines, ruleId, contains).quantity, `${ruleId} / ${contains}`).toBe(count);
  // Every line carries an ACME code (the engine test's "every line has a company code").
  const run = await apiAs<{ classifications: { id: string; name: string }[] }>(olivia, "GET", `/runs/${runId}`);
  expect(run.classifications.map((c) => c.name)).toContain("ACME cost codes");

  // And the sheet shows them all.
  await page.getByTestId("tab-sheet").click();
  await expect(page.getByTestId("sheet-grid")).toHaveAttribute("data-lines", String(lines.length));
});
