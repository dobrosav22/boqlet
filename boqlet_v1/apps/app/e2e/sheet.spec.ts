import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
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

/** The detail's "How it is calculated": every step's value, and the result (data-value). */
async function stepValues(detail: ReturnType<Page["getByTestId"]>) {
  const steps = detail.getByTestId("how-step");
  const kinds = await steps.evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")!));
  const values = await steps.evaluateAll((els) => els.map((e) => e.getAttribute("data-value")!));
  return { kinds, values: values.map((v) => (v === "" ? null : Number(v))) };
}

test("F06-AC5 the detail starts with How it is calculated, its steps add up, and each setting links to its Settings question", async ({ page }) => {
  const { url } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  await signInAs(page, "olivia");
  await page.goto(url);
  await page.getByTestId("sheet-search").fill("Brick on Block");
  await page.locator('[data-testid="sheet-line"][data-source="measured"]').first().click();
  const detail = page.getByTestId("line-detail");
  const how = detail.getByTestId("how-calculated");
  await expect(how).toBeVisible();
  // Before any formula (P25).
  const [howBox, formulaBox] = [await how.boundingBox(), await detail.getByTestId("detail-formula").boundingBox()];
  expect(howBox!.y).toBeLessThan(formulaBox!.y);

  const { kinds, values } = await stepValues(detail);
  expect(kinds[0]).toBe("start");
  expect(kinds).toContain("deduct");
  expect(kinds.at(-1)).toBe("result");
  const result = values.at(-1)!;
  const quantity = number((await detail.getByTestId("detail-quantity").textContent())!.split(" ")[0]!);
  expect(result).toBeCloseTo(quantity, 6);
  const sum = values.slice(0, -1).reduce<number>((s, v) => s + (v ?? 0), 0);
  expect(Math.abs(sum - result)).toBeLessThanOrEqual(0.005);

  // The deduction names the opening settings and links to their questions in the Library.
  const setting = detail.locator('[data-testid="how-setting"][data-slot="wall_opening_threshold"]');
  await expect(setting).toContainText("Wall opening size limit");
  await expect(setting).toHaveAttribute("href", /^\/studio-demo\/library\/rule_set\/[0-9a-f-]+\?question=wall_opening_threshold$/);
  await expect(detail.locator('[data-testid="how-setting"][data-slot="wall_opening_mode"]')).toContainText("Deduct every opening");

  // A step opens to its elements.
  const start = detail.locator('[data-testid="how-step"][data-kind="start"]');
  await start.getByTestId("how-step-toggle").click();
  await expect(start.getByTestId("how-step-elements").locator("li").first()).toBeVisible();
});

test("F06 §5 a derived line's steps name its source lines, which open on click", async ({ page }) => {
  const { url } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  await signInAs(page, "olivia");
  await page.goto(url);
  await page.getByTestId("sheet-search").fill("Formwork to walls");
  await page.locator('[data-testid="sheet-line"][data-source="derived"]').first().click();
  const detail = page.getByTestId("line-detail");
  const derive = detail.locator('[data-testid="how-step"][data-kind="derive"]');
  await expect(derive).toBeVisible();
  const { values } = await stepValues(detail);
  expect(Math.abs(values.slice(0, -1).reduce<number>((s, v) => s + (v ?? 0), 0) - values.at(-1)!)).toBeLessThanOrEqual(0.005);
  const source = derive.getByTestId("how-source-line").last();
  const name = (await source.textContent())!;
  await source.click();
  await expect(detail.locator("h3")).toHaveText(name);
  await expect(detail.locator('[data-testid="how-step"][data-kind="start"]')).toBeVisible();
});

test("F06 §5 an edited line shows the engine's value, the edit, who and why", async ({ page }) => {
  const { url, olivia, run: first } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  const boqId = url.split("/").at(-1)!;
  const lines = await apiAs<{ items: { key: string; source: string; quantity: number | null }[] }>(olivia, "GET", `/runs/${first.id}/lines`);
  const target = lines.items.find((l) => l.source === "measured" && l.quantity !== null)!;
  await apiAs(olivia, "POST", `/boqs/${boqId}/overrides`, { lineKey: target.key, quantity: 123.5, reason: "Measured on site" });
  const boq = await apiAs<{ currentRevision: { id: string } }>(olivia, "GET", `/boqs/${boqId}`);
  const { run } = await apiAs<{ run: { id: string } }>(olivia, "POST", `/revisions/${boq.currentRevision.id}/runs`);
  await expect.poll(async () => (await apiAs<{ status: string }>(olivia, "GET", `/runs/${run.id}`)).status, { timeout: 120_000 }).toBe("complete");

  await signInAs(page, "olivia");
  await page.goto(url);
  await page.locator(`[data-testid="sheet-line"][data-key=${JSON.stringify(target.key)}]`).click();
  const edit = page.getByTestId("line-detail").locator('[data-testid="how-step"][data-kind="edit"]');
  await expect(edit).toContainText("Edited by Olivia");
  await expect(edit).toContainText("123.5");
  await expect(edit).toContainText("Reason: Measured on site");
  const { values } = await stepValues(page.getByTestId("line-detail"));
  expect(values.at(-1)).toBe(123.5);
  expect(Math.abs(values.slice(0, -1).reduce<number>((s, v) => s + (v ?? 0), 0) - 123.5)).toBeLessThanOrEqual(0.005);
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

test("F06-AC8 the not-in-the-models notice and the counts by source are on the sheet, and collapsing it is remembered per user", async ({ page }) => {
  const { url, olivia, run } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)), ["acme-cost-codes"]);
  const projectId = url.split("/")[3]!;
  const victor = await devUser("victor");
  await apiAs(olivia, "POST", `/projects/${projectId}/members`, { userId: victor.id, role: "viewer" });
  const lines = await apiAs<{ items: { source: string }[] }>(olivia, "GET", `/runs/${run.id}/lines`);
  const bySource = (s: string) => String(lines.items.filter((l) => l.source === s).length);

  await signInAs(page, "olivia");
  await page.goto(url);
  const notice = page.getByTestId("not-in-models");
  await expect(notice).toHaveAttribute("data-collapsed", "false");
  await expect(notice).toContainText("This BoQ contains what the models contain");
  const counts = notice.getByTestId("source-counts");
  for (const s of ["measured", "derived", "manual", "flagged"]) await expect(counts).toHaveAttribute(`data-${s}`, bySource(s));
  await expect(counts).toContainText(`${bySource("measured")} measured`);

  // "Add line" opens the manual line dialog, whose help says the same.
  await notice.getByTestId("not-in-models-add").click();
  await expect(page.getByTestId("manual-line-dialog")).toContainText("This BoQ contains what the models contain");
  await page.keyboard.press("Escape");

  // Collapsed to the counts line, still there after a reload.
  await notice.getByTestId("not-in-models-toggle").click();
  await expect(notice).toHaveAttribute("data-collapsed", "true");
  await expect(notice).not.toContainText("This BoQ contains what the models contain");
  await expect(counts).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("not-in-models")).toHaveAttribute("data-collapsed", "true");

  // Another user in the same browser sees it open, without "Add line" (read-only). The init script of
  // signInAs only signs in when nobody is, so the stored session is replaced here.
  const session = { token: victor.token, userId: victor.id, name: victor.name, email: victor.email, sessionless: true };
  await page.evaluate((value) => window.localStorage.setItem("boqlet-mock-session", value), JSON.stringify(session));
  await page.goto(url);
  await expect(page.getByTestId("not-in-models")).toHaveAttribute("data-collapsed", "false");
  await expect(page.getByTestId("not-in-models-add")).toHaveCount(0);
});
