import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { apiAs, devUser, generatedDuplexBoq, signInAs } from "./helpers";

/** FE-040: position numbers (F06 §13, criterion 9) and live co-editing (F06 §14, criterion 10) on a real Duplex run. */

const DUPLEX = path.resolve(__dirname, "..", "..", "..", "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");
test.describe.configure({ timeout: 300_000 });

const lineAt = (page: Page, key: string) => page.locator(`[data-testid="sheet-line"][data-key=${JSON.stringify(key)}]`);
const cell = (line: Locator, column: string) => line.locator(`[data-column="${column}"]`);
const positionOf = (page: Page, key: string) => cell(lineAt(page, key), "positionNo");

async function editQuantity(page: Page, key: string, value: string, reason: string) {
  await lineAt(page, key).click();
  await cell(lineAt(page, key), "quantity").dblclick();
  await page.getByTestId("cell-editor").fill(value);
  await page.getByTestId("cell-editor").press("Enter");
  await page.getByTestId("reason-input").fill(reason);
  await page.getByTestId("reason-confirm").click();
}

/** Two measured lines of the same section (the same Item code), in sheet order. */
async function twoInOneSection(page: Page): Promise<[string, string]> {
  const rows = await page.getByTestId("sheet-line").evaluateAll((els) =>
    els.map((e) => ({ key: e.getAttribute("data-key")!, source: e.getAttribute("data-source"), item: e.querySelector('[data-column="item"]')?.textContent ?? "" })),
  );
  const measured = rows.filter((r) => r.source === "measured" && r.item);
  for (let i = 0; i < measured.length; i++) for (let j = i + 1; j < measured.length; j++) if (measured[i]!.item === measured[j]!.item) return [measured[i]!.key, measured[j]!.key];
  throw new Error("no section with two measured lines");
}

test("F06-AC9: position numbers renumber at once after an exclusion, and stay as they were in the saved version", async ({ page }) => {
  const { url } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  await signInAs(page, "olivia");
  await page.goto(url);
  await expect(page.getByTestId("sheet")).toHaveAttribute("data-editable", "true");
  const pair = await twoInOneSection(page);
  const item = (await cell(lineAt(page, pair[0]), "item").textContent())!;
  const n = (p: string) => Number(p.split(".").at(-1));
  // In number order (rows are virtualised, so the DOM order needn't be the sheet's).
  const numbered = await Promise.all(pair.map(async (k) => ({ k, p: (await positionOf(page, k).textContent())! })));
  numbered.sort((x, y) => n(x.p) - n(y.p));
  const [a, b] = [numbered[0]!.k, numbered[1]!.k];
  const before = { a: numbered[0]!.p, b: numbered[1]!.p };
  expect(before.a.startsWith(`${item}.`)).toBe(true);
  expect(n(before.b)).toBeGreaterThan(n(before.a));

  // Save version A as it is now (no edits yet): its numbers are frozen with it.
  await page.getByTestId("save-version").click();
  const dialog = page.getByTestId("save-version-dialog");
  await dialog.getByTestId("version-note").fill("Numbers frozen");
  await dialog.getByTestId("save-not-modelled-tick").check();
  await dialog.getByTestId("save-version-submit").click();
  await expect(dialog).toHaveCount(0);

  // Exclude a: it loses its number and b moves up at once, without a run.
  await lineAt(page, a).click();
  await page.getByTestId("exclude-line").click();
  await page.getByTestId("reason-input").fill("Not ours");
  await page.getByTestId("reason-confirm").click();
  await expect(lineAt(page, a)).toHaveAttribute("data-excluded", "true");
  await expect(positionOf(page, a)).toHaveText("");
  await expect(positionOf(page, b)).toHaveText(`${item}.${n(before.b) - 1}`);

  // Saved version A still shows the numbers it was saved with.
  await page.getByTestId("tab-versions").click();
  await page.getByTestId("saved-version").filter({ hasText: "Numbers frozen" }).getByTestId("open-version").click();
  await expect(page.getByTestId("viewing-version")).toHaveAttribute("data-label", "A");
  await expect(positionOf(page, a)).toHaveText(before.a);
  await expect(positionOf(page, b)).toHaveText(before.b);
});

test("F06-AC10: two browsers on one BoQ: presence, an edit there within a second, and on the same line the later edit wins and the earlier editor is told", async ({ page, browser }) => {
  const { url, projectUrl, projectId, olivia } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  const marko = await devUser("marko");
  await apiAs(olivia, "POST", `/projects/${projectId}/members`, { userId: marko.id, role: "estimator" });

  await signInAs(page, "olivia");
  await page.goto(url);
  const other = await browser.newContext();
  const page2 = await other.newPage();
  await signInAs(page2, "marko");
  await page2.goto(url);
  await expect(page.getByTestId("sheet")).toHaveAttribute("data-editable", "true");
  await expect(page2.getByTestId("sheet")).toHaveAttribute("data-editable", "true");

  // Presence: each sees the other.
  await expect(page.locator('[data-testid="presence-user"][data-name="Marko Estimator"]')).toBeVisible();
  await expect(page2.locator('[data-testid="presence-user"][data-name="Olivia Owner"]')).toBeVisible();

  const [key, markedKey] = await twoInOneSection(page);

  // Olivia edits: Marko's sheet shows it within a second, without a reload.
  await editQuantity(page, key, "123.5", "Measured on site");
  await expect(cell(lineAt(page, key), "quantity")).toHaveText("123.5");
  const shownAt = Date.now();
  await expect(cell(lineAt(page2, key), "quantity")).toHaveText("123.5", { timeout: 5_000 });
  expect(Date.now() - shownAt).toBeLessThan(1_000);

  // A line someone is editing carries their marker.
  await lineAt(page2, markedKey).click();
  await cell(lineAt(page2, markedKey), "quantity").dblclick();
  await expect(lineAt(page, markedKey)).toHaveAttribute("data-editing-by", /Marko Estimator/);
  await page2.getByTestId("cell-editor").press("Escape");
  await expect(lineAt(page, markedKey)).not.toHaveAttribute("data-editing-by", /Marko/);

  // Marko edits the same line later: his edit wins, and Olivia is told, with his value.
  await editQuantity(page2, key, "77", "Recounted");
  await expect(cell(lineAt(page, key), "quantity")).toHaveText("77", { timeout: 5_000 });
  const notice = page.getByText("Marko Estimator changed this line just now");
  await expect(notice).toBeVisible();
  await expect(page.getByText(/Now: 77/)).toBeVisible();

  // Olivia's Ctrl+Z no longer touches that line (undo is only for her own edits).
  await expect(page.getByTestId("undo-edit")).toBeDisabled();

  // "Keep mine" puts her value back, as the later edit; Marko sees it.
  await page.getByRole("button", { name: "Keep mine" }).click();
  await expect(cell(lineAt(page, key), "quantity")).toHaveText("123.5");
  await expect(cell(lineAt(page2, key), "quantity")).toHaveText("123.5", { timeout: 5_000 });
  await expect(page2.getByText("Olivia Owner changed this line just now")).toBeVisible();

  // Marko leaves the BoQ: Olivia no longer sees him (a closed tab drops out after 45 s without a heartbeat).
  await page2.goto(projectUrl);
  await expect(page.locator('[data-testid="presence-user"][data-name="Marko Estimator"]')).toHaveCount(0, { timeout: 10_000 });
  await other.close();
});
