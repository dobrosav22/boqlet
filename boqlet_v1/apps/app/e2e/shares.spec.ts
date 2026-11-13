import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { generatedDuplexBoq, signInAs } from "./helpers";

/** FE-036: F18 share links, created in the workspace and opened with no account; v1 criterion 15. */

const DUPLEX = path.resolve(__dirname, "..", "..", "..", "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");
test.describe.configure({ timeout: 240_000 });

test("F18-AC1/AC2: a link opens in a private window with no account (sheet, explanation, 3D, nothing else); revoked, it's gone at once", async ({ page, browser }) => {
  const { url } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  await signInAs(page, "olivia");
  await page.goto(url);
  await page.getByTestId("share-boq").click();
  const dialog = page.getByTestId("share-dialog");
  await dialog.getByTestId("share-label").fill("For the client");
  await dialog.getByTestId("share-create").click();
  const link = await dialog.getByTestId("share-url").inputValue();
  expect(link).toMatch(/\/s\/[A-Za-z0-9_-]{43}$/);
  await expect(dialog.locator('[data-testid="share-link"][data-label="For the client"]')).toHaveAttribute("data-status", "active");

  // A private window: no session, no cookies.
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  const response = await pub.goto(new URL(link).pathname);
  expect(response!.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect(response!.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(pub.getByTestId("share-title")).toHaveText("Tender BoQ");
  await expect(pub.getByTestId("share-version")).toContainText("A");
  await expect(pub.getByTestId("share-working")).toBeVisible();
  await expect(pub.getByTestId("share-line").first()).toBeVisible();
  await expect(pub.getByTestId("share-excel")).toHaveCount(0);
  await pub.locator('[data-testid="share-line"][data-source="measured"]').first().click();
  await expect(pub.getByTestId("share-detail").getByTestId("how-calculated")).toBeVisible();
  await expect(pub.getByTestId("share-detail").getByTestId("detail-share").first()).toBeVisible();
  await expect(pub.getByTestId("share-detail").getByTestId("detail-log")).toHaveCount(0);
  await expect(pub.getByTestId("viewer")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await expect(pub.getByTestId("viewer")).toHaveAttribute("data-focus", /^[1-9]/);
  // Nothing of the firm's people.
  await expect(pub.locator("body")).not.toContainText("Olivia");

  // The view is counted for the firm.
  await page.reload();
  await page.getByTestId("share-boq").click();
  const row = page.getByTestId("share-dialog").locator('[data-testid="share-link"][data-label="For the client"]');
  await expect(row.getByTestId("share-views")).toContainText("opened");

  // Revoke: the page says it's gone.
  await row.getByTestId("share-revoke").click();
  await page.getByTestId("share-revoke-confirm").click();
  await expect(row).toHaveAttribute("data-status", "revoked");
  const started = Date.now();
  await pub.reload();
  await expect(pub.getByTestId("share-gone")).toBeVisible();
  expect(Date.now() - started).toBeLessThan(5_000);
  await visitor.close();

  // Owners see every link of the org.
  await page.goto("/studio-demo/settings/shares");
  await expect(page.getByTestId("org-share-links").locator('[data-testid="share-link"][data-label="For the client"]').first()).toHaveAttribute("data-status", "revoked");
});

test("an unknown token shows that the link is no longer available", async ({ browser }) => {
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto("/s/not-a-real-token-at-all");
  await expect(pub.getByTestId("share-gone")).toBeVisible();
  await visitor.close();
});
