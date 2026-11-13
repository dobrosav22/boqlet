import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { apiAs, generatedDuplexBoq, signInAs } from "./helpers";

/** FE-014: the sheet and the model side by side (F07 §9): one filter, shared selection, box selection, keyboard. */

const DUPLEX = path.resolve(__dirname, "..", "..", "..", "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");
const SYSTEM = "acme-cost-codes";
test.describe.configure({ timeout: 240_000 });
test.use({ viewport: { width: 1440, height: 1000 } });

type Line = {
  key: string;
  location?: { storey?: string; storeys?: string[] };
  codes: Record<string, { path: { code: string }[] }>;
  trace: { elements: { guid: string }[]; sourceLine?: string };
};
type Scene = { elements: Record<string, { parts?: string[] }> };

/** The meshes that draw these lines' elements (a derived per-line line takes its source line's). */
function meshes(keys: string[], lines: Line[], scene: Scene) {
  const byKey = new Map(lines.map((l) => [l.key, l]));
  const guidsOf = (l: Line): string[] => {
    const own = l.trace.elements.map((e) => e.guid).filter(Boolean);
    return own.length || !l.trace.sourceLine ? own : guidsOf(byKey.get(l.trace.sourceLine)!);
  };
  return new Set(keys.flatMap((k) => guidsOf(byKey.get(k)!)).flatMap((g) => scene.elements[g]?.parts ?? [g]));
}

async function ready(page: Page) {
  const viewer = page.getByTestId("viewer");
  await expect(viewer).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(viewer).not.toHaveAttribute("data-meshes", "0");
  return viewer;
}

test("F07-AC5 filtering by storey and code group narrows the sheet and the model; box selection lists lines with the bulk actions", async ({ page }) => {
  const { url, run, olivia } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  const full = await apiAs<{ snapshotVersions: { models: { modelVersionId: string }[] } }>(olivia, "GET", `/runs/${run.id}`);
  const lines = (await apiAs<{ items: Line[] }>(olivia, "GET", `/runs/${run.id}/lines`)).items;
  const scene = await apiAs<Scene>(olivia, "GET", `/model-versions/${full.snapshotVersions.models[0]!.modelVersionId}/scene`);
  await signInAs(page, "olivia");
  await page.goto(url);

  // Side by side on a wide screen; the model can be collapsed and brought back.
  await expect(page.getByTestId("sheet-split")).toBeVisible();
  const viewer = await ready(page);
  await page.getByTestId("toggle-model").click();
  await expect(page.getByTestId("sheet-split")).toHaveCount(0);
  await page.getByTestId("toggle-model").click();
  await ready(page);

  // One filter for both: storey and code group.
  const pick = lines.find((l) => l.location?.storey && l.codes[SYSTEM]?.path[0])!;
  const storey = pick.location!.storey!;
  const group = pick.codes[SYSTEM]!.path[0]!.code;
  await page.getByTestId("filter-storey").selectOption(storey);
  await page.getByTestId("filter-group").selectOption(group);
  const kept = lines.filter(
    (l) => (l.location?.storey === storey || l.location?.storeys?.includes(storey)) && (l.codes[SYSTEM]?.path[0]?.code ?? "~unclassified") === group,
  );
  expect(kept.length).toBeGreaterThan(0);
  await expect(page.getByTestId("sheet-grid")).toHaveAttribute("data-lines", String(kept.length));
  await expect(viewer).toHaveAttribute("data-scope", String(meshes(kept.map((l) => l.key), lines, scene).size));
  await page.getByTestId("filtered-count").getByRole("button").click();
  await expect(viewer).toHaveAttribute("data-scope", "");

  // Box selection over the whole model lists the lines of the picked elements, with the bulk actions.
  const canvas = page.getByTestId("viewer-canvas");
  const box = (await canvas.boundingBox())!;
  await page.keyboard.down("Shift");
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  await page.mouse.move(box.x + box.width - 5, box.y + box.height - 5, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect(viewer).not.toHaveAttribute("data-picked", "0");
  const selection = page.getByTestId("model-selection");
  await expect(selection).toBeVisible();
  await selection.getByTestId("model-selection-check").click();
  await expect(page.getByTestId("bulk-exclude")).toBeVisible();
  await selection.getByTestId("model-selection-only").click();
  await expect(page.getByTestId("filtered-count")).toBeVisible();

  // Esc clears the selection in the model.
  await viewer.focus();
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveAttribute("data-picked", "0");
  await expect(page.getByTestId("model-selection")).toHaveCount(0);
});

test("F07 §9 a group row highlights its lines' elements; I isolates, Esc and the line link back to the sheet", async ({ page }) => {
  const { url, run, olivia } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  const full = await apiAs<{ snapshotVersions: { models: { modelVersionId: string }[] } }>(olivia, "GET", `/runs/${run.id}`);
  const lines = (await apiAs<{ items: Line[] }>(olivia, "GET", `/runs/${run.id}/lines`)).items;
  const scene = await apiAs<Scene>(olivia, "GET", `/model-versions/${full.snapshotVersions.models[0]!.modelVersionId}/scene`);
  await signInAs(page, "olivia");
  await page.goto(url);
  const viewer = await ready(page);

  // A top-level group whose lines are measured from elements.
  const id = lines.find((l) => l.trace.elements.length && l.codes[SYSTEM]?.path[0])!.codes[SYSTEM]!.path[0]!.code;
  const row = page.locator(`[data-testid="sheet-group"][data-group=${JSON.stringify(id)}]`);
  const inGroup = lines.filter((l) => {
    const path = (l.codes[SYSTEM]?.path ?? []).map((p) => p.code);
    return id.split("/").every((c, i) => path[i] === c);
  });
  // The row is wider than the sheet's half of the split; click it outside its name button.
  await row.dispatchEvent("click");
  await expect(row).toHaveAttribute("aria-selected", "true");
  const expected = meshes(inGroup.map((l) => l.key), lines, scene).size;
  expect(expected).toBeGreaterThan(0);
  await expect(viewer).toHaveAttribute("data-focus", String(expected));

  await viewer.focus();
  await page.keyboard.press("i");
  await expect(viewer).toHaveAttribute("data-visible", (await viewer.getAttribute("data-focus"))!);
  await page.getByTestId("viewer-reset").click();
  await expect(viewer).toHaveAttribute("data-visible", (await viewer.getAttribute("data-meshes"))!);

  // A line selected in the sheet is highlighted in the model.
  await page.locator('[data-testid="sheet-line"][data-source="measured"]').first().click();
  await expect(page.getByTestId("line-detail")).toBeVisible();
  const key = (await page.locator('[data-testid="sheet-line"][aria-selected="true"]').getAttribute("data-key"))!;
  await expect(viewer).toHaveAttribute("data-focus", String(meshes([key], lines, scene).size));

  // The split can be resized from the keyboard.
  const handle = page.getByTestId("split-handle");
  const before = Number(await handle.getAttribute("aria-valuenow"));
  await handle.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(handle).toHaveAttribute("aria-valuenow", String(before - 5));
});

test("F07 §5 the Edited colour mode shows the elements of edited lines", async ({ page }) => {
  const { url, run, olivia } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  const lines = (await apiAs<{ items: (Line & { source: string })[] }>(olivia, "GET", `/runs/${run.id}/lines`)).items;
  const target = lines.find((l) => l.source === "measured" && l.trace.elements.length > 0)!;
  const boqId = url.split("/").at(-1)!;
  await apiAs(olivia, "POST", `/boqs/${boqId}/overrides`, { lineKey: target.key, quantity: 1, reason: "Checked on site" });
  await signInAs(page, "olivia");
  await page.goto(url);
  await ready(page);
  await page.getByTestId("viewer-mode").selectOption("edited");
  const edited = page.locator('[data-testid="viewer-legend-entry"][data-key="edited"]');
  await expect(edited).toHaveAttribute("data-count", String(new Set(target.trace.elements.map((e) => e.guid)).size));
});
