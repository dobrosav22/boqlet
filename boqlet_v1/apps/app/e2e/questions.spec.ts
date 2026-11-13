import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { generatedDuplexBoq, signInAs } from "./helpers";

/**
 * FE-010: questions and decisions (F05) on a real Duplex run. Without dictionaries the Duplex's
 * materials are unknown names and the run needs input.
 */

const DUPLEX = path.resolve(__dirname, "..", "..", "..", "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");
test.describe.configure({ timeout: 300_000 });

const unnamedDuplex = async () => generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)), ["acme-cost-codes"], { dictionaryVersionIds: [] });

test("F05-AC1, AC3 bulk-answering the names is one request; one regenerate completes the BoQ", async ({ page }) => {
  const { url, run } = await unnamedDuplex();
  expect(run.status).toBe("needs_input");
  await signInAs(page, "olivia");
  await page.goto(`${url}?tab=questions`);
  await expect(page.getByTestId("questions-summary")).toContainText("blocking");
  const rows = page.getByTestId("question-row");
  await expect(rows.first()).toContainText("Blocking");

  // Select one blocking name, then every question answered the same way.
  await rows.first().getByTestId("question-select").check();
  await page.getByTestId("select-all-like").click();
  const bar = page.getByTestId("bulk-bar");
  await expect(bar).toBeVisible();
  const selected = Number((await bar.textContent())!.match(/(\d+) selected/)![1]);
  expect(selected).toBeGreaterThanOrEqual(10);

  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/decisions")) posts.push(r.url());
  });
  await bar.getByTestId("bulk-answer").click();
  await bar.getByTestId("bulk-answer").fill("concrete");
  await bar.getByRole("listbox").getByRole("option").first().click();
  await bar.getByTestId("bulk-apply").click();
  await expect(bar).toBeHidden();
  expect(posts).toHaveLength(1);
  expect(posts[0]).not.toContain("dryRun");

  // The answers wait for a regenerate, in the header and in the tab.
  await expect(page.getByTestId("answers-pending")).toContainText(`${selected} answers not applied yet`);
  await expect(page.getByTestId("questions-regenerate")).toContainText(`${selected} new answers`);
  await page.getByTestId("questions-state").selectOption("answered");
  await expect(rows).toHaveCount(selected);
  await expect(rows.first().getByTestId("answered-after-run")).toBeVisible();

  // Whatever is still blocking gets the same treatment.
  await page.getByTestId("questions-state").selectOption("unanswered");
  const stillBlocking = rows.filter({ hasText: "Blocking" });
  if ((await stillBlocking.count()) > 0) {
    await stillBlocking.first().getByTestId("question-select").check();
    await page.getByTestId("select-all-like").click();
    await bar.getByTestId("bulk-answer").click();
    await bar.getByRole("listbox").getByRole("option").first().click();
    await bar.getByTestId("bulk-apply").click();
    await expect(bar).toBeHidden();
  }
  await expect(page.getByTestId("questions-summary")).toContainText("0 blocking");

  await page.getByTestId("answers-regenerate").click();
  await expect(page.getByTestId("current-run")).toHaveAttribute("data-status", "complete", { timeout: 180_000 });
  await expect(page.getByTestId("answers-pending")).toHaveCount(0);
  await page.getByTestId("questions-state").selectOption("answered");
  await expect(rows.first()).toBeVisible();
  await expect(page.getByTestId("answered-after-run")).toHaveCount(0);
});

test("F05 §4, §7 a choice answers in one click; the decisions page lists, clears and exports", async ({ page }) => {
  const { url, projectUrl } = await unnamedDuplex();
  await signInAs(page, "olivia");
  await page.goto(`${url}?tab=questions`);
  await page.getByTestId("questions-kind").selectOption("contradiction");
  const open = page.getByTestId("question-row");
  const before = await open.count();
  expect(before).toBeGreaterThan(0);
  const row = open.first();
  // The engine's suggestion is preselected and marked.
  await expect(row).toContainText("Suggested");
  await expect(row.getByRole("radio", { checked: true })).toHaveCount(1);
  await row.getByRole("radio", { checked: false }).first().check();
  await expect(open).toHaveCount(before - 1);
  await page.getByTestId("questions-state").selectOption("answered");
  await expect(page.getByTestId("question-row")).toHaveCount(1);
  await expect(page.getByTestId("question-row").first().getByTestId("question-answer")).toContainText("geometry");

  await page.goto(`${projectUrl}/decisions`);
  const decisions = page.getByTestId("decision-row");
  await expect(decisions).toHaveCount(1);
  await expect(decisions.first().getByTestId("decision-used")).toHaveText("Not yet");
  const download = page.waitForEvent("download");
  await page.getByTestId("decisions-export").click();
  expect((await download).suggestedFilename()).toMatch(/^decisions-.*\.csv$/);

  await decisions.first().getByTestId("decision-clear").click();
  await expect(page.getByTestId("decisions-empty")).toBeVisible();
});
