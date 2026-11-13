import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { apiAs, generatedDuplexBoq, signInAs, type DevUser } from "./helpers";

/** FE-030: F08 §3–7, the Changes tab: compare runs, filters, elements, the viewer's changes mode, export. */

const DUPLEX = path.resolve(__dirname, "..", "..", "..", "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");
test.describe.configure({ timeout: 240_000 });

/** A Duplex BoQ with two runs: the second after a line edit that doubles one line. */
async function twoRuns() {
  const bytes = new Uint8Array(await readFile(DUPLEX));
  const made = await generatedDuplexBoq(bytes);
  const { olivia, run } = made;
  const boqId = made.url.split("/").pop()!;
  const { items } = await apiAs<{ items: { key: string; quantity: number | null; description: string }[] }>(olivia, "GET", `/runs/${run.id}/lines`);
  const line = items.find((l) => l.quantity && l.quantity > 10)!;
  await apiAs(olivia, "POST", `/boqs/${boqId}/overrides`, { lineKey: line.key, quantity: line.quantity! * 2, reason: "Site measure" });
  const boq = await apiAs<{ currentRevision: { id: string } }>(olivia, "GET", `/boqs/${boqId}`);
  const second = await generate(olivia, boq.currentRevision.id);
  return { ...made, line, first: run.id, second };
}

async function generate(user: DevUser, revisionId: string) {
  const { run } = await apiAs<{ run: { id: string } }>(user, "POST", `/revisions/${revisionId}/runs`);
  const deadline = Date.now() + 120_000;
  for (;;) {
    const r = await apiAs<{ status: string }>(user, "GET", `/runs/${run.id}`);
    if (r.status !== "queued" && r.status !== "running") return run.id;
    if (Date.now() > deadline) throw new Error("run did not finish");
    await new Promise((res) => setTimeout(res, 300));
  }
}

async function pickEarlier(page: Page, runId: string) {
  await page.getByTestId("changes-from").selectOption(runId);
}

test("F08 §3–4 before the first save: pick an earlier run; the edited line, its cause, filters, no element changes, the viewer in changes mode", async ({ page }) => {
  const { url, line, first, second } = await twoRuns();
  await signInAs(page, "olivia");
  await page.goto(`${url}?tab=changes`);
  await expect(page.getByTestId("changes-none")).toBeVisible();

  const started = Date.now();
  await pickEarlier(page, first);
  const report = page.getByTestId("changes-report");
  await expect(report).toBeVisible({ timeout: 10_000 });
  // F08-AC4: the report opens in under 3 s for the Duplex.
  expect(Date.now() - started).toBeLessThan(3_000);
  await expect(page).toHaveURL(new RegExp(`from=${first}`));
  await expect(page.getByTestId("summary-linesChanged")).toHaveAttribute("data-value", "1");
  await expect(page.getByTestId("summary-elementsChanged")).toHaveAttribute("data-value", "0");
  await expect(page.getByTestId("changes-inputs")).toContainText("line edits");

  const row = page.getByTestId("change-line");
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("data-key", line.key);
  await expect(row).toHaveAttribute("data-change", "changed");
  await expect(row.getByTestId("change-causes")).toHaveText("line edit changed");
  await expect(row).toContainText("+100 %");

  // |Δ%| threshold and change type filters.
  await page.getByTestId("changes-filter-threshold").fill("150");
  await expect(page.getByTestId("changes-no-lines")).toBeVisible();
  await page.getByTestId("changes-filter-threshold").fill("1");
  await page.getByTestId("changes-filter-change").selectOption("added");
  await expect(page.getByTestId("change-line")).toHaveCount(0);
  await page.getByTestId("changes-filter-change").selectOption("");
  await expect(page.getByTestId("change-line")).toHaveCount(1);

  await expect(page.getByTestId("changes-no-elements")).toBeVisible();
  const viewer = page.getByTestId("viewer");
  await expect(viewer).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await expect(viewer).toHaveAttribute("data-mode", "changes");

  // A line opens in the sheet.
  await row.getByRole("button", { name: line.description }).click();
  await expect(page).toHaveURL(/tab=sheet/);

  // Cached: back to the report, it answers at once (F08-AC4, cached under 500 ms on the API).
  await page.goto(`${url}?tab=changes&from=${first}`);
  await expect(page.getByTestId("changes-report")).toBeVisible({ timeout: 3_000 });
  expect(second).toBeTruthy();
});

test("F08 §6 compare two runs from the run history; F08 §7 the change report downloads", async ({ page }) => {
  const { url, first, second } = await twoRuns();
  await signInAs(page, "olivia");
  await page.goto(`${url}?tab=versions`);
  const picks = page.getByTestId("run-pick");
  await expect(picks).toHaveCount(2);
  await expect(page.getByTestId("compare-runs")).toBeDisabled();
  await picks.nth(0).check();
  await picks.nth(1).check();
  await page.getByTestId("compare-runs").click();
  await expect(page).toHaveURL(new RegExp(`tab=changes.*from=${first}.*to=${second}|tab=changes.*to=${second}.*from=${first}`));
  await expect(page.getByTestId("summary-linesChanged")).toHaveAttribute("data-value", "1");

  const download = page.waitForEvent("download");
  await page.getByTestId("changes-export").click();
  expect((await download).suggestedFilename()).toMatch(/_changes\.xlsx$/);
});

test("viewers don't get the Changes tab (S12d)", async ({ page }) => {
  const { url, projectId, olivia } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  const victor = await signInAs(page, "victor");
  await apiAs(olivia, "POST", `/projects/${projectId}/members`, { userId: victor.id, role: "viewer" });
  await page.goto(url);
  await expect(page.getByTestId("tab-sheet")).toBeVisible();
  await expect(page.getByTestId("tab-changes")).toHaveCount(0);
});
