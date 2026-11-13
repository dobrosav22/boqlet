import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { generatedDuplexBoq, signInAs } from "./helpers";

/** FE-011: line edits and manual lines (F06 §6–7) on a real Duplex run. */

const DUPLEX = path.resolve(__dirname, "..", "..", "..", "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");
test.describe.configure({ timeout: 300_000 });

const lineAt = (page: Page, key: string) => page.locator(`[data-testid="sheet-line"][data-key=${JSON.stringify(key)}]`);
const cell = (line: Locator, column: string) => line.locator(`[data-column="${column}"]`);

/** Selects the line (its detail opens beside the sheet), then edits the cell in place. */
async function editCell(page: Page, key: string, column: string, value: string) {
  await lineAt(page, key).click();
  await expect(lineAt(page, key)).toHaveAttribute("aria-selected", "true");
  await cell(lineAt(page, key), column).dblclick();
  await page.getByTestId("cell-editor").fill(value);
  await page.getByTestId("cell-editor").press("Enter");
}

async function giveReason(page: Page, reason: string) {
  await page.getByTestId("reason-input").fill(reason);
  await page.getByTestId("reason-confirm").click();
}

async function regenerate(page: Page) {
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("boq-header")).toHaveAttribute("data-state", "active");
  await expect(page.getByTestId("current-run")).toHaveAttribute("data-status", "complete", { timeout: 180_000 });
  await expect(page.getByTestId("pending-changes")).toHaveCount(0);
}

test("F06-AC3, AC4 edits show at once, a unit alone is refused, Ctrl+Z undoes, and the edits survive regeneration", async ({ page }) => {
  const { url } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  await signInAs(page, "olivia");
  await page.goto(url);
  await expect(page.getByTestId("sheet")).toHaveAttribute("data-editable", "true");
  const lines = page.getByTestId("sheet-line");
  const keys = await lines.evaluateAll((els) => els.filter((e) => e.getAttribute("data-source") === "measured").slice(0, 6).map((e) => e.getAttribute("data-key")!));
  const [textKey, quantityKey, unitKey, excludeKey, bulkA, bulkB] = keys as [string, string, string, string, string, string];

  // Text: in place, no reason needed.
  await editCell(page, textKey, "description", "Edited description");
  await expect(cell(lineAt(page, textKey), "description")).toHaveText("Edited description");
  await expect(cell(lineAt(page, textKey), "description")).toHaveAttribute("data-edited", "true");

  // Quantity: needs a reason; the cell shows the engine's value on hover.
  const engineQuantity = await cell(lineAt(page, quantityKey), "quantity").textContent();
  await editCell(page, quantityKey, "quantity", "123.5");
  await giveReason(page, "Measured on site");
  await expect(cell(lineAt(page, quantityKey), "quantity")).toHaveText("123.5");
  await expect(cell(lineAt(page, quantityKey), "quantity")).toHaveAttribute("title", new RegExp(engineQuantity!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  // A unit without a quantity is refused, with the reason (AC4).
  await editCell(page, unitKey, "unit", "yd3");
  await expect(page.getByTestId("edit-error")).toContainText("needs a new quantity");

  // Ctrl+Z undoes the last edit (the quantity) (AC4).
  await page.getByTestId("sheet-grid").focus();
  await page.keyboard.press("Control+z");
  await expect(cell(lineAt(page, quantityKey), "quantity")).toHaveText(engineQuantity!);
  await page.keyboard.press("Control+z");
  await expect(cell(lineAt(page, textKey), "description")).not.toHaveText("Edited description");
  await expect(page.getByTestId("undo-edit")).toBeDisabled();

  // Redo the two edits for the regeneration check.
  await editCell(page, textKey, "description", "Edited description");
  await editCell(page, quantityKey, "quantity", "123.5");
  await giveReason(page, "Measured on site");

  // Exclude from the detail: still listed, struck through.
  await lineAt(page, excludeKey).click();
  await page.getByTestId("exclude-line").click();
  await giveReason(page, "Client supplies it");
  await expect(lineAt(page, excludeKey)).toHaveAttribute("data-excluded", "true");

  // Bulk: tick two lines and move them to another section.
  await lineAt(page, bulkA).getByTestId("line-check").click();
  await lineAt(page, bulkB).getByTestId("line-check").click();
  await expect(page.getByTestId("sheet-bulk-bar")).toContainText("2 lines selected");
  await page.getByTestId("bulk-move").click();
  await page.getByTestId("bulk-move").fill("A.03");
  await page.getByTestId("sheet-bulk-bar").getByRole("option").first().click();
  await expect(cell(lineAt(page, bulkA), "item")).toHaveText("A.03");
  await expect(cell(lineAt(page, bulkB), "item")).toHaveText("A.03");

  // Drag a line onto another: it follows it.
  await lineAt(page, bulkB).dragTo(lineAt(page, bulkA));
  await expect(lineAt(page, bulkB)).toHaveAttribute("data-edited", /order/);
  const order = await lines.evaluateAll((els) => els.map((e) => e.getAttribute("data-key")));
  expect(order.indexOf(bulkB)).toBe(order.indexOf(bulkA) + 1);

  await expect(page.getByTestId("pending-changes")).toContainText("line edits");
  await page.getByTestId("filter-source").selectOption("edited");
  await expect(lines).toHaveCount(5);
  await page.getByTestId("filter-source").selectOption("");

  await regenerate(page);
  await expect(cell(lineAt(page, textKey), "description")).toHaveText("Edited description");
  await expect(cell(lineAt(page, quantityKey), "quantity")).toHaveText("123.5");
  await expect(lineAt(page, excludeKey)).toHaveAttribute("data-excluded", "true");
  await expect(cell(lineAt(page, bulkA), "item")).toHaveText("A.03");
  const after = await lines.evaluateAll((els) => els.map((e) => e.getAttribute("data-key")));
  expect(after.indexOf(bulkB)).toBe(after.indexOf(bulkA) + 1);

  // Restore from the detail panel.
  await lineAt(page, textKey).click();
  await page.getByTestId("restore-description").click();
  await expect(cell(lineAt(page, textKey), "description")).not.toHaveText("Edited description");
});

test("F06-AC6 a manual line added under a group lands there after regeneration, with that group's code", async ({ page }) => {
  const { url } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  await signInAs(page, "olivia");
  await page.goto(url);
  const group = page.getByTestId("sheet-group").first();
  const code = (await group.getAttribute("data-group"))!;
  await group.hover();
  await group.getByTestId("group-add-line").click();
  const dialog = page.getByTestId("manual-line-dialog");
  await dialog.getByTestId("manual-description").fill("Site hoarding");
  await dialog.getByTestId("manual-unit").selectOption("m");
  await dialog.getByTestId("manual-quantity").fill("42");
  await expect(dialog.getByTestId("manual-code-acme-cost-codes")).toHaveValue(code);
  await dialog.getByTestId("manual-save").click();
  await expect(dialog).toBeHidden();

  const pending = page.locator('[data-testid="sheet-line"][data-pending="true"]');
  await expect(pending).toHaveCount(1);
  await expect(pending).toContainText("Site hoarding");
  await expect(cell(pending, "item")).toHaveText(code);

  // A formula is checked by the engine before it is saved.
  await page.getByTestId("add-line").click();
  await dialog.getByTestId("manual-description").fill("Cleaning");
  await dialog.getByRole("radio", { name: "A formula" }).check();
  await dialog.getByTestId("manual-formula").fill("building.gross_volume / / 100");
  await dialog.getByTestId("manual-save").click();
  await expect(dialog.getByTestId("manual-problems")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await regenerate(page);
  const manual = page.getByTestId("sheet-line").filter({ hasText: "Site hoarding" });
  await expect(manual).toHaveCount(1);
  await expect(manual).not.toHaveAttribute("data-pending", "true");
  await expect(manual).toHaveAttribute("data-source", "manual");
  await expect(cell(manual, "item")).toHaveText(code);
  await expect(cell(manual, "quantity")).toHaveText("42");
});
