import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { generatedDuplexBoq, signInAs } from "./helpers";

/** FE-018: notifications (F13): toasts for one's own jobs, the bell, the list page, email preferences. */

const DUPLEX = path.resolve(__dirname, "..", "..", "..", "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");
test.describe.configure({ timeout: 240_000 });

test("F13-AC1 a run finishing in another tab shows a toast and updates the open BoQ page within 2 s", async ({ page, context }) => {
  const { url } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  await signInAs(page, "olivia");
  await page.goto(url);
  await expect(page.getByTestId("current-run")).toHaveAttribute("data-status", "complete");
  await expect(page.locator("html")).toHaveAttribute("data-realtime", "open");
  const runsBefore = await page.getByTestId("current-run").getAttribute("data-run");

  // The other tab (same browser, same sign-in) generates again.
  const other = await context.newPage();
  await other.goto(url);
  await other.getByTestId("generate").click();
  await expect(other.getByTestId("current-run")).not.toHaveAttribute("data-run", runsBefore ?? "", { timeout: 120_000 });
  await expect(other.getByTestId("current-run")).toHaveAttribute("data-status", "complete", { timeout: 120_000 });

  // This tab learns it within 2 s: a toast, the header's new run, and the bell (counts aren't compared:
  // other tests run as the same seeded user and mark their notifications read).
  await expect(page.getByText("Tender BoQ is generated").first()).toBeVisible({ timeout: 2_000 });
  await expect(page.getByTestId("current-run")).not.toHaveAttribute("data-run", runsBefore ?? "", { timeout: 2_000 });
  await expect(page.getByTestId("current-run")).toHaveAttribute("data-status", "complete", { timeout: 2_000 });
  await page.getByTestId("notification-bell").click();
  await expect(page.getByTestId("notification-item").filter({ hasText: "Tender BoQ is generated" }).first()).toBeVisible({ timeout: 2_000 });
});

test("the bell lists the newest notifications, opens one and marks it read; the list page marks all read", async ({ page }) => {
  const { url } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  await signInAs(page, "olivia");
  await page.goto(url);
  const bell = page.getByTestId("notification-bell");
  await expect.poll(async () => Number(await bell.getAttribute("data-unread"))).toBeGreaterThan(0);
  await bell.click();
  const item = page.getByTestId("notification-item").filter({ hasText: "Tender BoQ is generated" }).first();
  await expect(item).toBeVisible();
  await item.click();
  await expect(page).toHaveURL(/\/boqs\//);

  await page.goto("/notifications");
  await expect(page.getByTestId("notification-row").first()).toBeVisible();
  await page.getByTestId("notifications-unread-only").check();
  await page.getByTestId("notifications-page-read-all").click();
  await expect(page.getByTestId("notification-row")).toHaveCount(0);
  await page.getByTestId("notifications-unread-only").uncheck();
  await expect(page.locator('[data-testid="notification-row"][data-read="false"]')).toHaveCount(0);
});

test("email preferences per category are saved (F13)", async ({ page }) => {
  await signInAs(page, "ivana");
  await page.goto("/account");
  const jobs = page.getByTestId("email-jobs");
  await expect(jobs).toBeChecked();
  const saved = page.waitForResponse((r) => r.url().includes("/me/notification-preferences") && r.request().method() === "PUT");
  await jobs.uncheck();
  await saved;
  await page.reload();
  await expect(page.getByTestId("email-jobs")).not.toBeChecked();
  await expect(page.getByTestId("email-versions")).toBeChecked();
  const restored = page.waitForResponse((r) => r.url().includes("/me/notification-preferences") && r.request().method() === "PUT");
  await page.getByTestId("email-jobs").check();
  await restored;
  await page.reload();
  await expect(page.getByTestId("email-jobs")).toBeChecked();
});
