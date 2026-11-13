import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { apiAs, devUser, generatedDuplexBoq, signInAs } from "./helpers";

/** FE-009: the BoQ sheet (F06 §1–5, 8–11) on a real Duplex run. */

const DUPLEX = path.resolve(__dirname, "..", "..", "..", "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");
test.describe.configure({ timeout: 240_000 });

const number = (text: string) => Number(text.replace(/[^\d.-]/g, ""));

test("F06-AC1 switching Group by regroups without a request and keeps every line", async ({ page }) => {
  const { url, run } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  await signInAs(page, "olivia");
  await page.goto(url);
  const grid = page.getByTestId("sheet-grid");
  await expect(grid).toHaveAttribute("data-lines", String(run.stats!.lines));
  const firstGroup = await page.getByTestId("sheet-group").first().getAttribute("data-group");

  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/")) requests.push(r.url());
  });
  await page.getByTestId("group-by").selectOption({ label: "Demo: trade sections" });
  await expect(page.getByTestId("sheet-group").first()).not.toHaveAttribute("data-group", firstGroup!);
  await expect(grid).toHaveAttribute("data-lines", String(run.stats!.lines));
  await page.getByTestId("group-by").selectOption({ value: "" });
  await expect(page.getByTestId("sheet-group")).toHaveCount(0);
  await expect(grid).toHaveAttribute("data-lines", String(run.stats!.lines));
  expect(requests.filter((u) => u.includes("/lines"))).toEqual([]);

  // A collapsed group hides its lines; the count comes back when it opens.
  await page.getByTestId("group-by").selectOption({ label: "ACME cost codes" });
  const group = page.getByTestId("sheet-group").first();
  await group.getByRole("button", { name: /^(Collapse|Expand) / }).click();
  await expect(grid).not.toHaveAttribute("data-lines", String(run.stats!.lines));
  await group.getByRole("button", { name: /^(Collapse|Expand) / }).click();
  await expect(grid).toHaveAttribute("data-lines", String(run.stats!.lines));
});

test("F06-AC2 a line's detail shows its formula, settings and element shares that add up to its quantity", async ({ page }) => {
  const { url } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  await signInAs(page, "olivia");
  await page.goto(url);
  // Wall lines carry settings (opening mode, surface) and many elements.
  await page.getByTestId("sheet-search").fill("wall");
  await expect(page.getByTestId("filtered-count")).toContainText("Filtered:");
  await page.locator('[data-testid="sheet-line"][data-source="measured"]').first().click();
  const detail = page.getByTestId("line-detail");
  await expect(detail).toBeVisible();
  await expect(detail.getByTestId("detail-formula")).not.toBeEmpty();
  await expect(detail.getByTestId("detail-raw-formula")).not.toBeEmpty();
  await expect(detail.getByTestId("detail-params")).toBeVisible();
  await expect(detail.getByTestId("detail-element").first()).toBeVisible();
  const quantity = number((await detail.getByTestId("detail-quantity").textContent())!.split(" ")[0]!);
  const sum = number((await detail.getByTestId("detail-share-sum").textContent())!);
  expect(Math.abs(sum - quantity)).toBeLessThanOrEqual(Math.max(0.01, quantity * 0.001));
  await expect(detail.getByTestId("detail-codes")).toContainText("ACME cost codes");
  await expect(detail.getByTestId("detail-log")).toBeVisible();
});

test("keyboard: / focuses the search, arrows move the selection, Escape closes the detail (F06 §10)", async ({ page }) => {
  const { url } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  await signInAs(page, "olivia");
  await page.goto(url);
  await expect(page.getByTestId("sheet-grid")).toBeVisible();
  await page.locator("body").press("/");
  await expect(page.getByTestId("sheet-search")).toBeFocused();
  await page.getByTestId("sheet-grid").focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("line-detail")).toBeVisible();
  const first = await page.locator('[data-testid="sheet-line"][aria-selected="true"]').getAttribute("data-key");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[data-testid="sheet-line"][aria-selected="true"]')).not.toHaveAttribute("data-key", first!);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("line-detail")).toHaveCount(0);
});

test("the log tab pages the calculation log and filters it by stage (F06 §9)", async ({ page }) => {
  const { url } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)), ["acme-cost-codes"]);
  await signInAs(page, "olivia");
  await page.goto(`${url}?tab=log`);
  await expect(page.getByTestId("log-entry")).toHaveCount(200);
  await page.getByTestId("log-more").click();
  await expect(page.getByTestId("log-entry").nth(200)).toBeVisible();
  await page.getByTestId("log-stage").selectOption("classify");
  await expect(page.getByTestId("log-entry").first()).toBeVisible();
  for (const cell of await page.getByTestId("log-entry").locator("td:nth-child(2)").allTextContents()) expect(cell).toBe("Classify");
});

test("a viewer sees the same sheet, with no edit actions (F06 §11)", async ({ page }) => {
  const { url, olivia } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)), ["acme-cost-codes"]);
  const projectId = url.split("/")[3]!;
  const victor = await devUser("victor");
  await apiAs(olivia, "POST", `/projects/${projectId}/members`, { userId: victor.id, role: "viewer" });
  await signInAs(page, "victor");
  await page.goto(url);
  await expect(page.getByTestId("sheet-grid")).toBeVisible();
  await expect(page.getByTestId("generate")).toHaveCount(0);
  await expect(page.getByTestId("save-version")).toHaveCount(0);
  await page.getByTestId("sheet-line").first().click();
  await expect(page.getByTestId("line-detail")).toBeVisible();
});
