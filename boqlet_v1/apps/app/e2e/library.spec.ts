import { expect, test } from "@playwright/test";
import { apiAs, createOrg, createUser, devUser, signInAs, signInAsUser, unique } from "./helpers";

/**
 * FE-021: the Library shell (F10 §1, 2, 5, 9, 10, 11): lists per kind and layer, create (empty /
 * copy / patch), the preset page with its versions, compare, restore as draft, where used, archive,
 * and who may do what.
 */

interface Preset {
  id: string;
  name: string;
  kind: string;
  layer: string;
  latestPublishedVersion?: { id: string; number: number };
  draft?: { id: string };
}

const studioPresets = async (key = "olivia") => {
  const user = await devUser(key);
  const me = await apiAs<{ memberships: { org: { id: string; slug: string } }[] }>(user, "GET", "/me");
  const orgId = me.memberships.find((m) => m.org.slug === "studio-demo")!.org.id;
  return { user, orgId, presets: await apiAs<Preset[]>(user, "GET", `/orgs/${orgId}/presets`) };
};

test("a library editor lists presets by kind and layer and creates a patch on As modelled", async ({ page }) => {
  await signInAs(page, "ivana");
  await page.goto("/studio-demo/library");
  const table = page.getByTestId("library-table");
  await expect(table.locator('[data-testid="library-row"][data-name="Studio rules"]')).toContainText("Company");
  await expect(table.locator('[data-testid="library-row"][data-name="Studio rules"]').getByTestId("draft-tag")).toBeVisible();
  const asModelled = table.locator('[data-testid="library-row"][data-name="As modelled (master template)"]');
  await expect(asModelled.getByTestId("make-copy")).toBeVisible();
  // Layer filter: only the company's own.
  await page.getByTestId("library-layer").selectOption("org");
  await expect(asModelled).toHaveCount(0);
  await expect(page).toHaveURL(/layer=org/);
  // Other kinds.
  await page.getByTestId("library-kind-classification").click();
  await expect(page.locator('[data-testid="library-row"][data-name="Studio trades"]')).toBeVisible();
  await page.getByTestId("library-kind-dictionary").click();
  await expect(page.locator('[data-testid="library-row"][data-name="Studio names"]')).toBeVisible();

  // FL-6 step 1: New → changes on As modelled.
  await page.getByTestId("library-kind-rule_set").click();
  await expect(page.getByTestId("library-new")).toHaveText("New rule set");
  await page.getByTestId("library-new").click();
  await expect(page).toHaveURL(/\/studio-demo\/library\/rule_set\/new/);
  const name = `Office rules ${unique("r")}`;
  await page.getByTestId("preset-name-input").fill(name);
  await page.getByTestId("start-patch").check();
  await page.getByTestId("preset-source").selectOption({ label: "As modelled (master template) · System" });
  await page.getByTestId("create-preset-submit").click();
  await expect(page.getByTestId("preset-page")).toBeVisible();
  await expect(page.getByTestId("preset-name")).toHaveText(name);
  await expect(page.getByTestId("preset-layer")).toHaveText("Company");
  await expect(page.getByTestId("preset-latest")).toHaveText("Not published yet");
  await expect(page.getByTestId("preset-draft")).toHaveText("no problems");
  await expect(page.getByTestId("preset-doc")).toContainText('"extends": "as-modelled"');
  await page.getByTestId("preset-tab-versions").click();
  await expect(page.getByTestId("version-row")).toHaveCount(1);
  await page.getByTestId("preset-tab-usage").click();
  await expect(page.getByText("No BoQ uses this preset yet.")).toBeVisible();
});

test("a system preset is read-only with Make a copy; the copy is named after it", async ({ page }) => {
  await signInAs(page, "ivana");
  await page.goto("/studio-demo/library?kind=classification&layer=system");
  await page.locator('[data-testid="library-row"][data-name="Demo: trade sections"]').getByRole("link", { name: "Demo: trade sections" }).click();
  await expect(page.getByTestId("preset-layer")).toHaveText("System");
  await expect(page.getByTestId("preset-archive")).toHaveCount(0);
  await expect(page.getByTestId("start-draft")).toHaveCount(0);
  await expect(page.getByText("System presets are read-only. Make a copy to change one.")).toBeVisible();
  const original = await page.getByTestId("preset-name").textContent();
  await page.getByTestId("preset-copy").click();
  await expect(page.getByTestId("preset-name-input")).toHaveValue(`${original} (copy)`);
  await expect(page.getByTestId("start-copy")).toBeChecked();
  await page.getByTestId("preset-name-input").fill(`Trades ${unique("c")}`);
  await page.getByTestId("create-preset-submit").click();
  await expect(page.getByTestId("preset-layer")).toHaveText("Company");
  await expect(page.getByTestId("preset-doc")).toContainText('"codes"');
});

test("versions: compare the draft with version 1, restore version 1 as the draft", async ({ page }) => {
  const { user, presets } = await studioPresets("ivana");
  const rules = presets.find((p) => p.name === "Studio rules")!;
  const draft = await apiAs<{ doc: unknown }>(user, "GET", `/preset-versions/${rules.draft!.id}`);
  try {
    await signInAs(page, "ivana");
    // The Settings link from "How it is calculated" (FE-013) lands here; FE-022 opens the question.
    await page.goto(`/studio-demo/library/rule_set/${rules.id}?question=wall_opening_threshold`);
    await expect(page.getByTestId("preset-latest")).toHaveText("Version 1");
    await page.getByTestId("preset-tab-versions").click();
    const rows = page.getByTestId("version-row");
    await expect(rows).toHaveCount(2);
    await rows.nth(0).getByTestId("version-pick").check();
    await rows.nth(1).getByTestId("version-pick").check();
    await page.getByTestId("compare-versions").click();
    const diff = page.getByTestId("version-diff");
    await expect(diff).toContainText("Version 1 → Draft");
    await expect(diff.locator('tr[data-op="added"]')).toContainText(["lines_by_storey"]);
    await expect(page.getByTestId("diff-summary")).toContainText("added");

    // Version 1, read-only, restored as the draft (with a confirmation: a draft exists).
    await rows.nth(1).getByTestId("view-version").click();
    await expect(page.getByTestId("version-view")).toContainText("Read-only");
    await page.getByTestId("restore-version").click();
    await page.getByTestId("restore-version-confirm").click();
    await expect(page.getByText("Version 1 is the draft now")).toBeVisible();
    await rows.nth(0).getByTestId("version-pick").check();
    await rows.nth(1).getByTestId("version-pick").check();
    await page.getByTestId("compare-versions").click();
    await expect(page.getByTestId("diff-summary")).toHaveText("The two versions are the same.");
  } finally {
    // Put the seeded draft back for other tests.
    await apiAs(user, "PUT", `/presets/${rules.id}/draft`, { doc: draft.doc });
  }
});

test("archive hides a preset from the Library; Show archived lists it again", async ({ page }) => {
  const { user, orgId } = await studioPresets("ivana");
  const name = `Old names ${unique("a")}`;
  const preset = await apiAs<Preset>(user, "POST", `/orgs/${orgId}/presets`, { kind: "dictionary", name, start: { mode: "empty" } });
  await signInAs(page, "ivana");
  await page.goto(`/studio-demo/library/dictionary/${preset.id}`);
  await page.getByTestId("preset-details").click();
  await page.getByTestId("details-name").fill(`${name} v2`);
  await page.getByTestId("details-save").click();
  await expect(page.getByTestId("preset-name")).toHaveText(`${name} v2`);
  await page.getByTestId("preset-archive").click();
  await page.getByTestId("preset-archive-confirm").click();
  await expect(page).toHaveURL(/\/studio-demo\/library\?kind=dictionary$/);
  await expect(page.getByTestId("library-list")).toBeVisible();
  await expect(page.locator(`[data-testid="library-row"][data-preset="${preset.id}"]`)).toHaveCount(0);
  await page.getByTestId("library-archived").click();
  await expect(page).toHaveURL(/archived=1/);
  await expect(page.locator(`[data-testid="library-row"][data-preset="${preset.id}"]`)).toContainText("Archived");
});

test("F10-AC6: a member views org presets but sees no edit actions", async ({ page }) => {
  const { presets } = await studioPresets("marko");
  const rules = presets.find((p) => p.name === "Studio rules")!;
  await signInAs(page, "marko");
  await page.goto("/studio-demo/library");
  await expect(page.locator('[data-testid="library-row"][data-name="Studio rules"]')).toBeVisible();
  await expect(page.getByTestId("library-new")).toHaveCount(0);
  await expect(page.getByTestId("make-copy")).toHaveCount(0);
  await page.goto(`/studio-demo/library/rule_set/${rules.id}`);
  await expect(page.getByTestId("preset-doc")).toBeVisible();
  for (const id of ["preset-details", "preset-star", "preset-copy", "preset-archive", "discard-draft", "start-draft"]) await expect(page.getByTestId(id)).toHaveCount(0);
  await page.getByTestId("preset-tab-versions").click();
  await page.getByTestId("view-version").last().click();
  await expect(page.getByTestId("version-view")).toBeVisible();
  await expect(page.getByTestId("restore-version")).toHaveCount(0);
  await page.goto("/studio-demo/library/rule_set/new");
  await expect(page.getByText(/creating them is for library editors/)).toBeVisible();
});

test("where used lists the BoQs on a preset's versions", async ({ page }) => {
  const { user, orgId, presets } = await studioPresets("olivia");
  const rules = presets.find((p) => p.name === "Studio rules")!;
  const project = await apiAs<{ id: string }>(user, "POST", `/orgs/${orgId}/projects`, { name: `Used ${unique("u")}` });
  const boqName = `Tender ${unique("b")}`;
  const boq = await apiAs<{ id: string }>(user, "POST", `/projects/${project.id}/boqs`, { name: boqName, inputs: { ruleSetVersionId: rules.latestPublishedVersion!.id } });
  await signInAs(page, "olivia");
  await page.goto(`/studio-demo/library/rule_set/${rules.id}?tab=usage`);
  const row = page.locator(`[data-testid="usage-row"][data-boq="${boq.id}"]`);
  await expect(row).toContainText(boqName);
  await expect(row).toContainText("Version 1");
  await row.getByRole("link", { name: boqName }).click();
  await expect(page).toHaveURL(new RegExp(`/boqs/${boq.id}\\?tab=setup`));
});

test("a project's Library: its lead creates a project dictionary", async ({ page }) => {
  const { user, orgId } = await studioPresets("olivia");
  const project = await apiAs<{ id: string }>(user, "POST", `/orgs/${orgId}/projects`, { name: `Project lib ${unique("p")}` });
  await signInAs(page, "olivia");
  await page.goto(`/studio-demo/projects/${project.id}/library?kind=dictionary`);
  // The project dictionary every project has (F05) is listed already.
  await expect(page.locator('[data-testid="library-row"]')).toHaveCount(1);
  await page.getByTestId("library-new").click();
  await page.getByTestId("preset-name-input").fill("Site names");
  await page.getByTestId("create-preset-submit").click();
  await expect(page.getByTestId("preset-layer")).toHaveText("Project");
  await page.getByText("‹ Project library").click();
  await expect(page.locator('[data-testid="library-row"][data-name="Site names"]')).toContainText("Project");
});

test("a free org's second company preset opens the limit dialog", async ({ page }) => {
  const owner = await createUser("Library Owner", `${unique("lib")}@example.com`);
  const org = await createOrg(owner, "Library Firm", unique("lib"));
  await apiAs(owner, "POST", `/orgs/${org.id}/presets`, { kind: "dictionary", name: "Our names", start: { mode: "empty" } });
  await signInAsUser(page, owner);
  await page.goto(`/${org.slug}/library/dictionary/new`);
  await page.getByTestId("preset-name-input").fill("More names");
  await page.getByTestId("create-preset-submit").click();
  await expect(page.getByTestId("limit-dialog")).toBeVisible();
  await expect(page.getByTestId("limit-detail")).toContainText("libraryOrgPresets");
});
