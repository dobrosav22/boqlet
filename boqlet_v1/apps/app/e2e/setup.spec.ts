import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { apiAs, createOrg, createUser, modelWithVersion, signInAsUser, unique } from "./helpers";

/**
 * FE-028: the setup wizard (F16). A new org's owner can't reach the dashboard before finishing; the
 * suggested answers finish it in a few clicks; progress survives a reload; with a model the preview shows
 * what each answer changes; reinforcement estimates need their kg per m³; a free org fits its plan.
 */

const DUPLEX = path.resolve(__dirname, "..", "..", "..", "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");

async function newOwner(prefix: string) {
  const owner = await createUser("Setup Owner", `${unique(prefix)}@example.com`);
  const org = await createOrg(owner, "Setup Firm", unique(prefix), { setupDone: false });
  return { owner, org };
}

test("F16: the dashboard waits for the wizard; the suggested answers finish it; a reload keeps the step; a free org fits", async ({ page }) => {
  const { owner, org } = await newOwner("wiz");
  await signInAsUser(page, owner);
  await page.goto(`/${org.slug}`);
  await expect(page).toHaveURL(new RegExp(`/${org.slug}/setup$`));
  await page.getByTestId("setup-start-go").click();

  const wizard = page.getByTestId("setup-wizard");
  await expect(wizard).toHaveAttribute("data-step", "measure");
  await expect(page.getByTestId("setup-switch")).toHaveCount(14);
  await expect(page.getByTestId("setup-no-model")).toBeVisible();
  await page.getByTestId("setup-suggested").click();
  await expect(wizard).toHaveAttribute("data-step", "items");
  // Leaving and coming back reopens the step.
  await page.reload();
  await expect(page.getByTestId("setup-wizard")).toHaveAttribute("data-step", "items");
  await page.getByTestId("setup-skip").click();
  await expect(wizard).toHaveAttribute("data-step", "names");
  await page.getByTestId("setup-skip").click();
  await expect(wizard).toHaveAttribute("data-step", "review");
  await expect(page.getByTestId("setup-not-in-models")).toBeVisible();
  await page.getByTestId("setup-publish-all").click();

  await expect(page).toHaveURL(new RegExp(`/${org.slug}$`));
  await expect(page.getByTestId("needs-you")).toBeVisible();
  await expect(page.getByTestId("setup-not-finished")).toHaveCount(0);
  // The rule set is published and starred; the skipped item list and names stay drafts. No 402 on the free plan.
  const presets = await apiAs<{ kind: string; starred?: boolean; latestPublishedVersion?: { number: number }; draft?: unknown }[]>(owner, "GET", `/orgs/${org.id}/presets?layer=org`);
  const rules = presets.find((p) => p.kind === "rule_set")!;
  expect(rules).toMatchObject({ starred: true, latestPublishedVersion: { number: 1 } });
  expect(presets.filter((p) => p.kind === "classification" || p.kind === "dictionary").every((p) => !p.latestPublishedVersion)).toBe(true);
  // The Library's Guided setup opens the finished wizard, which offers to run again.
  await page.goto(`/${org.slug}/library`);
  await page.getByTestId("guided-setup").click();
  await expect(page.getByTestId("setup-done")).toBeVisible();
});

test("F16: with the Duplex, an answer shows in the preview; reinforcement needs its kg per m³; walls in m³", async ({ page }) => {
  test.setTimeout(300_000);
  const { owner, org } = await newOwner("wizd");
  const project = await apiAs<{ id: string; name: string }>(owner, "POST", `/orgs/${org.id}/projects`, { name: "Duplex" });
  await modelWithVersion(owner, project.id, "Architecture", new Uint8Array(await readFile(DUPLEX)), "Duplex_A.ifc");
  await signInAsUser(page, owner);
  await page.goto(`/${org.slug}/setup`);
  const picker = page.getByTestId("preview-picker");
  await picker.getByTestId("preview-project").selectOption({ label: "Duplex" });
  await picker.getByTestId("preview-model").selectOption({ label: "Architecture" });
  await picker.getByTestId("preview-version").selectOption({ index: 1 });
  await page.getByTestId("setup-start-go").click();

  const preview = page.getByTestId("preview-panel");
  await expect(preview).toHaveAttribute("data-state", "done", { timeout: 120_000 });
  await expect(preview.getByTestId("preview-summary")).toContainText("Against As modelled");

  // 1a → 1b: reinforcement estimates on, then its screen can't be left with 0 kg/m³.
  await page.locator('[data-testid="setup-switch"][data-slot="rebar_estimates"] input').check();
  const step = page.getByTestId("measure-step");
  const nextUntil = async (screen: string) => {
    for (let i = 0; i < 12 && (await step.getAttribute("data-screen")) !== screen; i++) {
      const before = await step.getAttribute("data-screen");
      await page.getByTestId("setup-next").click();
      await expect(step).not.toHaveAttribute("data-screen", before!);
    }
    await expect(step).toHaveAttribute("data-screen", screen);
  };
  await nextUntil("detail:rebar_estimates");
  await page.getByTestId("setup-next").click();
  await expect(page.getByTestId("setup-missing").first()).toBeVisible();
  await expect(page.getByTestId("measure-step")).toHaveAttribute("data-screen", "detail:rebar_estimates");
  for (const [slot, kg] of [["rebar_slab_kg_m3", "100"], ["rebar_wall_kg_m3", "80"], ["rebar_footing_kg_m3", "60"]]) {
    await page.locator(`[data-testid="setup-question"][data-slot="${slot}"] input`).fill(kg);
  }
  await page.getByTestId("setup-next").click();
  await expect(page.getByTestId("measure-step")).not.toHaveAttribute("data-screen", "detail:rebar_estimates");

  // 1c: walls in m³; the preview shows walls changed against As modelled.
  await nextUntil("measure:walls");
  await page.locator('[data-testid="setup-question"][data-slot="wall_unit"] select').selectOption("volume");
  // A wall line in m³ is a new line (the unit is part of a line's identity); the m² one is removed.
  await expect(preview.locator('[data-testid="preview-line"][data-change="added"]').filter({ hasText: "Brick on Block" }).filter({ hasText: "m3" })).toBeVisible({ timeout: 120_000 });
  await expect(preview.locator('[data-testid="preview-line"][data-change="removed"]').filter({ hasText: "Brick on Block" })).toBeVisible();
});
