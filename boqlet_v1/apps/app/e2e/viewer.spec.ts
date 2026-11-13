import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { apiAs, devUser, generatedDuplexBoq, modelWithVersion, signInAs, unique } from "./helpers";

/** FE-016: the 3D viewer (F07) on real runs: line ↔ elements, coverage, models, tools, entry points. */

const FIXTURES = path.resolve(__dirname, "..", "..", "..", "fixtures", "ifc");
const DUPLEX = path.join(FIXTURES, "Ifc2x3_Duplex_Architecture.ifc");
test.describe.configure({ timeout: 240_000 });

type Line = { key: string; description: string; ruleKind: string; quantity: number | null; trace: { elements: { guid: string; quantity: number | null }[]; sourceLine?: string } };
type Scene = { elements: Record<string, { parts?: string[]; parent?: string }> };

async function runData(olivia: Awaited<ReturnType<typeof devUser>>, runId: string) {
  const run = await apiAs<{ snapshotVersions: { models: { modelVersionId: string }[] } }>(olivia, "GET", `/runs/${runId}`);
  const lines = (await apiAs<{ items: Line[] }>(olivia, "GET", `/runs/${runId}/lines`)).items;
  const scene = await apiAs<Scene>(olivia, "GET", `/model-versions/${run.snapshotVersions.models[0]!.modelVersionId}/scene`);
  return { lines, scene };
}

async function viewerReady(page: Page) {
  const viewer = page.getByTestId("viewer");
  await expect(viewer).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(viewer).not.toHaveAttribute("data-meshes", "0");
  return viewer;
}

/** The meshes a line's elements are drawn by (SceneIndex parts), as F07 §3 says. */
function meshesOf(line: Line, lines: Line[], scene: Scene) {
  let guids = [...new Set(line.trace.elements.map((e) => e.guid).filter(Boolean))];
  if (!guids.length && line.trace.sourceLine) guids = [...new Set(lines.find((l) => l.key === line.trace.sourceLine)!.trace.elements.map((e) => e.guid))];
  return new Set(guids.flatMap((g) => scene.elements[g]?.parts ?? [g]));
}

test("F07-AC1 selecting a line highlights exactly its elements; a roof line highlights the roof's slabs", async ({ page }) => {
  const { url, run, olivia } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  const { lines, scene } = await runData(olivia, run.id);
  await signInAs(page, "olivia");

  // From the line detail's "Show in 3D".
  await page.goto(url);
  await page.getByTestId("sheet-search").fill("Brick on Block");
  await page.locator('[data-testid="sheet-line"][data-source="measured"]').first().click();
  await page.getByTestId("show-in-3d").click();
  const brick = lines.find((l) => l.ruleKind === "item" && l.description.includes("Brick on Block"))!;
  await expect(await viewerReady(page)).toHaveAttribute("data-focus", String(meshesOf(brick, lines, scene).size));
  await expect(page.getByTestId("viewer-line-element")).toHaveCount(new Set(brick.trace.elements.map((e) => e.guid)).size);

  const roof = lines.find((l) => l.ruleKind === "item" && l.trace.elements.some((e) => (scene.elements[e.guid]?.parts?.length ?? 0) > 1));
  expect(roof, "a line measuring an aggregate drawn by its parts").toBeTruthy();
  await page.goto(`${url}?tab=viewer&line=${encodeURIComponent(roof!.key)}`);
  const expected = meshesOf(roof!, lines, scene);
  expect(expected.size).toBeGreaterThan(new Set(roof!.trace.elements.map((e) => e.guid)).size);
  await expect(await viewerReady(page)).toHaveAttribute("data-focus", String(expected.size));
});

test("F07-AC2 an element lists every line it feeds with its share, and opens a line in the sheet", async ({ page }) => {
  const { url, run, olivia } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  const { lines } = await runData(olivia, run.id);
  const brick = lines.find((l) => l.ruleKind === "item" && l.description.includes("Brick on Block"))!;
  const guid = brick.trace.elements[0]!.guid;
  const feeding = lines.filter((l) => l.trace.elements.some((e) => e.guid === guid));
  await signInAs(page, "olivia");
  await page.goto(`${url}?tab=viewer&line=${encodeURIComponent(brick.key)}`);
  await viewerReady(page);
  await page.getByTestId("viewer-line-element").first().click();
  const element = page.getByTestId("viewer-element");
  await expect(element).toHaveAttribute("data-guid", guid);
  for (const l of feeding) {
    const row = element.locator(`[data-testid="viewer-element-line"][data-key=${JSON.stringify(l.key)}]`);
    await expect(row).toBeVisible();
    const share = l.trace.elements.filter((e) => e.guid === guid).reduce((s, e) => s + (e.quantity ?? 0), 0);
    expect(Number(await row.getAttribute("data-share"))).toBeCloseTo(share, 6);
  }
  await element.locator(`[data-testid="viewer-open-line"][data-key=${JSON.stringify(brick.key)}]`).click();
  await expect(page.getByTestId("line-detail").locator("h3")).toHaveText(brick.description);
});

test("F07-AC3 coverage shows unmatched elements, as many as the unmatched questions' occurrences", async ({ page }) => {
  // The "demo-custom" rule set measures only part of the Duplex: 117 elements are unmatched questions.
  const olivia0 = await devUser("olivia");
  const me = await apiAs<{ memberships: { org: { id: string; slug: string } }[] }>(olivia0, "GET", "/me");
  const orgId = me.memberships.find((m) => m.org.slug === "studio-demo")!.org.id;
  const ruleSets = await apiAs<{ slug: string; latestPublishedVersion?: { id: string } }[]>(olivia0, "GET", `/orgs/${orgId}/presets?kind=rule_set`);
  const ruleSetVersionId = ruleSets.find((p) => p.slug === "demo-custom")!.latestPublishedVersion!.id;
  const { url, run, olivia } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)), ["acme-cost-codes"], { ruleSetVersionId });
  const questions = await apiAs<{ kind: string; occurrences?: number; guids?: string[] }[]>(olivia, "GET", `/runs/${run.id}/questions`);
  const unmatched = questions.filter((q) => q.kind === "unmatched").reduce((s, q) => s + (q.occurrences ?? q.guids?.length ?? 0), 0);
  expect(unmatched).toBeGreaterThan(0);
  await signInAs(page, "olivia");
  await page.goto(`${url}?tab=viewer`);
  await viewerReady(page);
  await page.getByTestId("viewer-mode").selectOption("coverage");
  const entry = page.locator('[data-testid="viewer-legend-entry"][data-key="unmatched"]');
  await expect(entry).toHaveAttribute("data-count", String(unmatched));
  await expect(page.locator('[data-testid="viewer-legend-entry"][data-key="measured"]')).toBeVisible();

  // A legend entry selects its elements; the question's "Show in 3D" opens them too (F07 §7).
  await page.locator('[data-testid="viewer-legend-entry"][data-key="measured"]').click();
  await expect(page.getByTestId("viewer")).not.toHaveAttribute("data-focus", "0");
  await page.goto(`${url}?tab=questions`);
  const link = page.getByTestId("question-show-in-3d").first();
  await link.click();
  await expect(await viewerReady(page)).not.toHaveAttribute("data-focus", "0");
});

test("F07-AC4 a two-model run shows both models, each toggleable, and colours by model", async ({ page }) => {
  const olivia = await devUser("olivia");
  const me = await apiAs<{ memberships: { org: { id: string; slug: string } }[] }>(olivia, "GET", "/me");
  const org = me.memberships.find((m) => m.org.slug === "studio-demo")!.org;
  const project = await apiAs<{ id: string }>(olivia, "POST", `/orgs/${org.id}/projects`, { name: `Two models ${unique("p")}` });
  for (const [name, file] of [
    ["Architecture", "Building-Architecture.ifc"],
    ["Structure", "Building-Structural.ifc"],
  ] as const)
    await modelWithVersion(olivia, project.id, name, new Uint8Array(await readFile(path.join(FIXTURES, "buildingsmart", "IFC4", file))), file);
  const boq = await apiAs<{ id: string; currentRevision: { id: string } }>(olivia, "POST", `/projects/${project.id}/boqs`, { name: "Federated" });
  const { run } = await apiAs<{ run: { id: string } }>(olivia, "POST", `/revisions/${boq.currentRevision.id}/runs`);
  await expect.poll(async () => (await apiAs<{ status: string }>(olivia, "GET", `/runs/${run.id}`)).status, { timeout: 120_000 }).toMatch(/complete|needs_input/);

  await signInAs(page, "olivia");
  await page.goto(`/studio-demo/projects/${project.id}/boqs/${boq.id}?tab=viewer`);
  const viewer = await viewerReady(page);
  await expect(page.getByTestId("viewer-model")).toHaveCount(2);
  const all = Number(await viewer.getAttribute("data-visible"));
  await page.getByTestId("viewer-model-toggle").nth(1).uncheck();
  const one = Number(await viewer.getAttribute("data-visible"));
  expect(one).toBeGreaterThan(0);
  expect(one).toBeLessThan(all);
  await page.getByTestId("viewer-model-toggle").nth(1).check();
  await expect(viewer).toHaveAttribute("data-visible", String(all));
  await page.getByTestId("viewer-mode").selectOption("model");
  await expect(page.getByTestId("viewer-legend-entry")).toHaveCount(2);
});

test("F07 §6 tools: storey filter, isolate, hide, section box and reset", async ({ page }) => {
  const { url, run, olivia } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  const { lines } = await runData(olivia, run.id);
  const brick = lines.find((l) => l.ruleKind === "item" && l.description.includes("Brick on Block"))!;
  await signInAs(page, "olivia");
  await page.goto(`${url}?tab=viewer&line=${encodeURIComponent(brick.key)}`);
  const viewer = await viewerReady(page);
  const total = await viewer.getAttribute("data-meshes");
  await expect(viewer).toHaveAttribute("data-visible", total!);

  const storey = page.getByTestId("viewer-storey");
  await storey.selectOption({ index: 1 });
  await expect(viewer).not.toHaveAttribute("data-visible", total!);
  await storey.selectOption("");
  await expect(viewer).toHaveAttribute("data-visible", total!);

  await page.getByTestId("viewer-isolate").click();
  await expect(viewer).toHaveAttribute("data-visible", (await viewer.getAttribute("data-focus"))!);
  await page.getByTestId("viewer-reset").click();
  await expect(viewer).toHaveAttribute("data-visible", total!);

  await page.getByTestId("viewer-line-element").first().click();
  await page.getByTestId("viewer-hide").click();
  await expect(viewer).toHaveAttribute("data-visible", String(Number(total) - 1));
  await page.getByTestId("viewer-section").click();
  await expect(page.getByTestId("viewer-section-box")).toBeVisible();
  await page.getByTestId("viewer-reset").click();
  await expect(viewer).toHaveAttribute("data-visible", total!);
  await expect(page.getByTestId("viewer-section-box")).toHaveCount(0);
});

test("F07 §7 the model version page opens a check's elements in 3D, without a run", async ({ page }) => {
  const olivia = await devUser("olivia");
  const me = await apiAs<{ memberships: { org: { id: string; slug: string } }[] }>(olivia, "GET", "/me");
  const org = me.memberships.find((m) => m.org.slug === "studio-demo")!.org;
  const project = await apiAs<{ id: string }>(olivia, "POST", `/orgs/${org.id}/projects`, { name: `Checks ${unique("p")}` });
  const { modelId, versionId } = await modelWithVersion(olivia, project.id, "Architecture", new Uint8Array(await readFile(DUPLEX)), "Duplex_A.ifc");
  await signInAs(page, "olivia");
  await page.goto(`/studio-demo/projects/${project.id}/models/${modelId}/versions/${versionId}`);
  const show = page.getByTestId("check-show-in-3d").first();
  if (await show.count()) {
    await show.click();
    await expect(await viewerReady(page)).not.toHaveAttribute("data-focus", "0");
  } else {
    await page.getByTestId("version-view-3d").click();
    await viewerReady(page);
  }
  // Without a run there is no coverage mode (F07 §7).
  await expect(page.getByTestId("viewer-mode").locator("option")).toHaveText(["By element type"]);
});

test("F07-AC7 the Duplex viewer is interactive within 3 s of opening the tab on a warm cache", async ({ page }) => {
  const { url } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  await signInAs(page, "olivia");
  await page.goto(`${url}?tab=viewer`);
  await viewerReady(page);
  await page.getByTestId("tab-sheet").click();
  await expect(page.getByTestId("sheet-grid")).toBeVisible();
  const started = Date.now();
  await page.getByTestId("tab-viewer").click();
  await viewerReady(page);
  const ms = Date.now() - started;
  test.info().annotations.push({ type: "viewer-warm-ms", description: String(ms) });
  expect(ms).toBeLessThan(3000);
});
