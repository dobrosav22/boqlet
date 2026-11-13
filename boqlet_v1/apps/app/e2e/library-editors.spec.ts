import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { apiAs, devUser, generatedDuplexBoq, modelWithVersion, signInAs, unique } from "./helpers";

/**
 * M2 Library (FE-022…FE-027): the three editors with autosave, the Settings deep link, preview beside
 * the editor, publish, clone, Excel templates, and item texts in the sheet.
 */

const DUPLEX = path.resolve(__dirname, "..", "..", "..", "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");

interface Preset {
  id: string;
  name: string;
  slug: string;
  latestPublishedVersion?: { id: string; number: number };
  draft?: { id: string };
}

async function studio(key = "ivana") {
  const user = await devUser(key);
  const me = await apiAs<{ memberships: { org: { id: string; slug: string } }[] }>(user, "GET", "/me");
  return { user, orgId: me.memberships.find((m) => m.org.slug === "studio-demo")!.org.id };
}

async function asModelledVersion(orgId: string, user: Awaited<ReturnType<typeof devUser>>) {
  const presets = await apiAs<Preset[]>(user, "GET", `/orgs/${orgId}/presets?kind=rule_set&layer=system`);
  return presets.find((p) => p.slug === "as-modelled")!.latestPublishedVersion!.id;
}

async function newPatch(name: string) {
  const { user, orgId } = await studio();
  return apiAs<Preset>(user, "POST", `/orgs/${orgId}/presets`, { kind: "rule_set", name, start: { mode: "patch", fromVersionId: await asModelledVersion(orgId, user) } });
}

/** Picks an answer on a Settings question card (select, radio or input inside `answer`). */
async function answer(page: Page, slot: string, value: string) {
  const card = page.locator(`[data-testid="question"][data-slot="${slot}"]`);
  await card.scrollIntoViewIfNeeded();
  const box = card.getByTestId("answer");
  const select = box.locator("select");
  if (await select.count()) await select.first().selectOption(value);
  else if (await box.getByRole("radio", { name: value }).count()) await box.getByRole("radio", { name: value }).check();
  else await box.locator("input").first().fill(value);
  await expect(card).toHaveAttribute("data-mine", "true");
}

test("FE-022: Settings answers on a patch autosave, the deep link opens a question, a reload keeps them", async ({ page }) => {
  const preset = await newPatch(`Editor ${unique("r")}`);
  await signInAs(page, "ivana");
  await page.goto(`/studio-demo/library/rule_set/${preset.id}?question=wall_opening_threshold`);
  await expect(page.getByTestId("rule-tab-settings")).toBeVisible();
  await expect(page.locator('[data-testid="question"][data-slot="wall_opening_threshold"]')).toHaveAttribute("data-focused", "true");

  await answer(page, "lines_by_storey", "Yes");
  await answer(page, "window_measure", "area");
  await expect(page.getByTestId("preset-editor")).toHaveAttribute("data-status", "saved", { timeout: 15_000 });
  await page.reload();
  await expect(page.locator('[data-testid="question"][data-slot="lines_by_storey"]')).toHaveAttribute("data-mine", "true");
  await expect(page.locator('[data-testid="question"][data-slot="window_measure"]')).toHaveAttribute("data-mine", "true");
  // A patch stores only the changed answers.
  const { user } = await studio();
  const fresh = await apiAs<Preset>(user, "GET", `/presets/${preset.id}`);
  const doc = await apiAs<{ doc: { params: Record<string, unknown> } }>(user, "GET", `/preset-versions/${fresh.draft!.id}`);
  expect(Object.keys(doc.doc.params).sort()).toEqual(["lines_by_storey", "window_measure"]);

  // The BoQ items tab tells each item's story.
  await page.getByTestId("rule-tab-items").click();
  await expect(page.getByTestId("item-story").first()).toBeVisible();
});

test("F10-AC1 / v1 criterion 7: three settings changed, previewed on the Duplex next to the editor, published", async ({ page }) => {
  test.setTimeout(240_000);
  const { user, orgId } = await studio("olivia");
  const project = await apiAs<{ id: string; name: string }>(user, "POST", `/orgs/${orgId}/projects`, { name: `Preview ${unique("p")}` });
  await modelWithVersion(user, project.id, "Architecture", new Uint8Array(await readFile(DUPLEX)), "Duplex_A.ifc");
  const preset = await apiAs<Preset>(user, "POST", `/orgs/${orgId}/presets`, { kind: "rule_set", name: `Office ${unique("r")}`, start: { mode: "patch", fromVersionId: await asModelledVersion(orgId, user) } });

  await signInAs(page, "olivia");
  await page.goto(`/studio-demo/library/rule_set/${preset.id}`);
  const panel = page.getByTestId("preview-panel");
  await panel.getByTestId("preview-project").selectOption({ label: project.name });
  await panel.getByTestId("preview-model").selectOption({ label: "Architecture" });
  await panel.getByTestId("preview-version").selectOption({ index: 1 });
  await expect(panel).toHaveAttribute("data-state", "done", { timeout: 90_000 });
  await expect(panel.getByTestId("preview-summary")).toContainText("Nothing published yet");

  // Publish the new patch (As modelled unchanged) as version 1, then change three settings.
  await page.getByTestId("publish-open").click();
  await page.getByTestId("publish-note").fill("As modelled as it is");
  await page.getByTestId("publish-confirm").click();
  await expect(page.getByTestId("preset-latest")).toHaveText("Version 1");

  await page.getByTestId("rule-tab-settings").click();
  await answer(page, "window_measure", "area");
  await answer(page, "door_measure", "area");
  await answer(page, "lines_by_storey", "Yes");
  await expect(page.getByTestId("preset-editor")).toHaveAttribute("data-status", "saved", { timeout: 15_000 });
  const saved = await apiAs<Preset>(user, "GET", `/presets/${preset.id}`);
  expect(saved.draft).toBeTruthy();
  const savedDoc = await apiAs<{ doc: { params: Record<string, unknown> }; extendsVersionId: string }>(user, "GET", `/preset-versions/${saved.draft!.id}`);
  expect(Object.keys(savedDoc.doc.params).sort()).toEqual(["door_measure", "lines_by_storey", "window_measure"]);
  await expect(panel.getByTestId("preview-run")).toBeEnabled({ timeout: 90_000 });
  await panel.getByTestId("preview-run").click();
  await expect(panel).toHaveAttribute("data-state", "running");
  await expect(panel).toHaveAttribute("data-state", "done", { timeout: 90_000 });
  await expect(panel.getByTestId("preview-summary")).toContainText("Against version 1");
  await expect(panel.locator('[data-testid="preview-line"][data-change="changed"], [data-testid="preview-line"][data-change="added"]').first()).toBeVisible();

  await page.getByTestId("publish-open").click();
  await page.getByTestId("publish-note").fill("Windows and doors by area, lines per storey");
  await page.getByTestId("publish-confirm").click();
  await expect(page.getByTestId("preset-latest")).toHaveText("Version 2");
  await page.getByTestId("preset-tab-versions").click();
  await expect(page.getByTestId("version-row")).toHaveCount(2);
});

test("F10-AC2: a draft with problems can't be published", async ({ page }) => {
  const preset = await newPatch(`Broken ${unique("b")}`);
  const { user } = await studio();
  const doc = await apiAs<{ doc: Record<string, unknown> }>(user, "GET", `/preset-versions/${preset.draft!.id}`);
  await apiAs(user, "PUT", `/presets/${preset.id}/draft`, { doc: { ...doc.doc, params: { excavation_formula: { value: "1 +" } } } });
  await signInAs(page, "ivana");
  await page.goto(`/studio-demo/library/rule_set/${preset.id}`);
  await expect(page.getByTestId("draft-problems")).toBeVisible();
  await page.getByTestId("publish-open").click();
  await expect(page.getByTestId("publish-blocked")).toBeVisible();
  await expect(page.getByTestId("publish-confirm")).toBeDisabled();
});

test("FE-023, FE-024: the classification and dictionary editors open on Studio Demo's presets", async ({ page }) => {
  const { user, orgId } = await studio();
  const presets = await apiAs<(Preset & { kind: string })[]>(user, "GET", `/orgs/${orgId}/presets`);
  await signInAs(page, "ivana");
  await page.goto(`/studio-demo/library/classification/${presets.find((p) => p.name === "Studio trades")!.id}`);
  await page.getByTestId("class-tab-codes").click();
  await expect(page.getByTestId("code-row").first()).toBeVisible();
  await page.getByTestId("class-tab-lines").click();
  await expect(page.getByTestId("class-table")).toBeVisible();
  await page.goto(`/studio-demo/library/dictionary/${presets.find((p) => p.name === "Studio names")!.id}`);
  await page.getByTestId("dict-tab-entries").click();
  await expect(page.getByTestId("row").first()).toBeVisible();
  await page.getByTestId("dict-tab-terms").click();
  await expect(page.getByTestId("dictionary-editor")).toBeVisible();
});

test("FE-026: Clone 'Based on it' makes a patch; the Excel template downloads", async ({ page }) => {
  const { user, orgId } = await studio();
  const rules = (await apiAs<Preset[]>(user, "GET", `/orgs/${orgId}/presets?kind=rule_set&layer=org`)).find((p) => p.name === "Studio rules")!;
  await signInAs(page, "ivana");
  await page.goto(`/studio-demo/library/rule_set/${rules.id}`);
  const download = page.waitForEvent("download");
  await page.getByTestId("template-download").click();
  expect((await download).suggestedFilename()).toBe("studio-rules.xlsx");

  await page.getByTestId("preset-clone").click();
  await expect(page.getByTestId("clone-name")).toHaveValue("Studio rules (copy)");
  await page.getByTestId("clone-name").fill(`Branch rules ${unique("c")}`);
  await page.getByTestId("clone-patch").check();
  await page.getByTestId("clone-confirm").click();
  await expect(page.getByTestId("preset-layer")).toHaveText("Company");
  await page.getByTestId("rule-tab-advanced").click();
  await expect(page.getByTestId("extends")).toContainText("studio-rules");
});

test("FE-027: the sheet's Description shows the code's item text, the detail what was measured", async ({ page }) => {
  test.setTimeout(240_000);
  const { user, orgId } = await studio();
  const trades = (await apiAs<Preset[]>(user, "GET", `/orgs/${orgId}/presets?kind=classification&layer=system`)).find((p) => p.slug === "demo-trades")!;
  const copy = await apiAs<Preset>(user, "POST", `/orgs/${orgId}/presets`, { kind: "classification", name: `Texts ${unique("t")}`, start: { mode: "copy", fromVersionId: trades.latestPublishedVersion!.id } });
  const draft = await apiAs<{ doc: { codeList: { codes: { code: string; description?: string }[] } } }>(user, "GET", `/preset-versions/${copy.draft!.id}`);
  const codes = draft.doc.codeList.codes.map((c) => ({ ...c, description: "Supply and fix {type_name}, measured in {unit}" }));
  await apiAs(user, "PUT", `/presets/${copy.id}/draft`, { doc: { ...draft.doc, codeList: { ...draft.doc.codeList, codes } } });
  const v1 = await apiAs<{ id: string }>(user, "POST", `/presets/${copy.id}/publish`, { changeNote: "Item texts" });

  const { url } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)), [], { classificationVersionIds: [v1.id] });
  await signInAs(page, "olivia");
  await page.goto(url);
  // A measured line's blanks are filled from its values; a line without a type name keeps the blank visible.
  const cell = page.locator('[data-testid="sheet"] [data-column="description"]').filter({ hasText: /Supply and fix .* measured in m/ }).first();
  await expect(cell).toBeVisible();
  await expect(cell).not.toContainText("{type_name}");
  await cell.click();
  await expect(page.getByTestId("detail-item-text").first()).toContainText("Supply and fix");
  await expect(page.getByTestId("detail-measured-as")).toContainText("Measured as");
});
