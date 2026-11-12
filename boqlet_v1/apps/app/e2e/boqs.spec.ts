import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { apiAs, devUser, modelWithVersion, signInAs, unique } from "./helpers";

/** FE-008: F04 BoQ create, setup, generate against the mock and the PoC engine. */

const DUPLEX = path.resolve(__dirname, "..", "..", "..", "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");
test.describe.configure({ timeout: 240_000 });

/** A Studio Demo project with two ready models (the same Duplex file: the second reuses the parse). */
async function projectWithTwoModels() {
  const olivia = await devUser("olivia");
  const me = await apiAs<{ memberships: { org: { id: string; slug: string } }[] }>(olivia, "GET", "/me");
  const org = me.memberships.find((m) => m.org.slug === "studio-demo")!.org;
  const project = await apiAs<{ id: string }>(olivia, "POST", `/orgs/${org.id}/projects`, { name: `BoQs ${unique("p")}` });
  const bytes = new Uint8Array(await readFile(DUPLEX));
  await modelWithVersion(olivia, project.id, "Architecture", bytes, "Duplex_A.ifc");
  await modelWithVersion(olivia, project.id, "Architecture B", bytes, "Duplex_B.ifc");
  return `/studio-demo/projects/${project.id}`;
}

test("F04-AC1..AC4 create with both models, generate without a reload, pending changes block Save version until regenerated", async ({ page }) => {
  const base = await projectWithTwoModels();
  await signInAs(page, "olivia");
  await page.goto(`${base}/boqs`);

  // AC1: both latest versions and the project defaults are preselected.
  await page.getByTestId("new-boq").click();
  const dialog = page.getByTestId("create-boq-dialog");
  await expect(dialog.getByTestId("create-model-Architecture")).toBeChecked();
  await expect(dialog.getByTestId("create-model-Architecture B")).toBeChecked();
  await expect(dialog.getByLabel("Rule set")).toContainText("As modelled");
  await dialog.getByTestId("boq-name").fill("Tender BoQ");
  await dialog.getByTestId("create-boq-submit").click();
  await expect(page.getByTestId("setup-tab")).toBeVisible();
  await expect(page.getByTestId("use-model-Architecture")).toBeChecked();
  await expect(page.getByTestId("use-model-Architecture B")).toBeChecked();
  await expect(page.getByTestId("project-dictionary")).toBeVisible();
  await expect(page.getByTestId("boq-header")).toHaveAttribute("data-state", "none");
  await expect(page.getByTestId("save-version")).toBeDisabled();

  // Use one model, so the sheet matches the hand-made Duplex BoQ's scope.
  await page.getByTestId("use-model-Architecture B").click();
  await expect(page.getByTestId("use-model-Architecture B")).not.toBeChecked();

  // AC2: generate and see the result arrive without a reload (cached parse: well under 10 s).
  const started = Date.now();
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("current-run")).toBeVisible({ timeout: 10_000 });
  expect(Date.now() - started).toBeLessThan(10_000);
  await expect(page.getByTestId("boq-header")).toHaveAttribute("data-state", /complete|needs_input/);
  await expect(page.getByTestId("save-version")).toBeEnabled();

  // AC4: changing an input shows the pending changes and disables Save version until regenerated.
  await page.getByTestId("add-classification").selectOption({ label: "ACME cost codes · System" });
  await expect(page.getByTestId("pending-changes")).toContainText("classifications");
  await expect(page.getByTestId("save-version")).toBeDisabled();
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("pending-changes")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId("save-version")).toBeEnabled();

  // Run history lists both runs.
  await page.getByTestId("tab-versions").click();
  await expect(page.getByTestId("run-row")).toHaveCount(2);
});

test("F04-AC3 a run with blocking questions shows the count and links to the questions", async ({ page }) => {
  const base = await projectWithTwoModels();
  await signInAs(page, "olivia");
  await page.goto(`${base}/boqs`);
  await page.getByTestId("new-boq").click();
  await page.getByTestId("boq-name").fill("No dictionaries");
  await page.getByTestId("create-boq-submit").click();
  await expect(page.getByTestId("setup-tab")).toBeVisible();
  // Without the global dictionary every name is asked.
  await page.getByTestId("remove-dictionary").click();
  await expect(page.getByTestId("chosen-dictionary")).toHaveCount(0);
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("needs-input")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("needs-input")).toContainText("need an answer");
  await page.getByTestId("needs-input").click();
  await expect(page).toHaveURL(/tab=questions/);
});

test("a viewer sees BoQs read-only; the lead archives and restores", async ({ page, browser }) => {
  const base = await projectWithTwoModels();
  const olivia = await devUser("olivia");
  const projectId = base.split("/").pop()!;
  const boq = await apiAs<{ id: string }>(olivia, "POST", `/projects/${projectId}/boqs`, { name: "Variant" });
  const victor = await devUser("victor");
  await apiAs(olivia, "POST", `/projects/${projectId}/members`, { userId: victor.id, role: "viewer" });

  const viewer = await browser.newPage();
  await signInAs(viewer, "victor");
  await viewer.goto(`${base}/boqs`);
  await expect(viewer.getByTestId("boq-row-Variant")).toBeVisible();
  await expect(viewer.getByTestId("new-boq")).toHaveCount(0);
  await viewer.goto(`${base}/boqs/${boq.id}?tab=setup`);
  await expect(viewer.getByTestId("setup-tab")).toBeVisible();
  await expect(viewer.getByTestId("generate")).toHaveCount(0);
  await expect(viewer.getByTestId("rule-set-select")).toBeDisabled();
  await viewer.close();

  await signInAs(page, "olivia");
  await page.goto(`${base}/boqs/${boq.id}`);
  await page.getByTestId("boq-menu").click();
  await page.getByTestId("archive-boq").click();
  await expect(page.getByTestId("generate")).toHaveCount(0);
  await page.goto(`${base}/boqs`);
  await expect(page.getByTestId("boq-row-Variant")).toHaveCount(0);
  await page.getByTestId("show-archived").check();
  await page.getByTestId("boq-row-Variant").getByRole("link").click();
  await page.getByTestId("boq-menu").click();
  await page.getByTestId("restore-boq").click();
  await expect(page.getByTestId("generate")).toBeVisible();
});
