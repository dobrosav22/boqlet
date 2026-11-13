import { expect, test } from "@playwright/test";
import { createUser, pickOnSignIn, unique } from "./helpers";

/**
 * FE-012: one active session per account (F01 §10, F01-AC5, v1 criterion 16). Each browser is
 * its own Playwright context; a fresh person, so no other test's session gets in the way.
 */

test("F01-AC5 a second browser is asked first; cancelling changes nothing, continuing signs the first out within 5 s", async ({ page, browser }) => {
  const email = `${unique("twice")}@example.com`;
  await createUser("Two Browsers", email);

  // First browser: signs in, gets the session and the live connection.
  await page.goto("/");
  await pickOnSignIn(page, email);
  await expect(page.locator("html")).toHaveAttribute("data-session", "active");
  await expect(page.locator("html")).toHaveAttribute("data-realtime", "open");

  // Second browser, cancelled: signed out there, the first one goes on.
  const second = await browser.newContext();
  const other = await second.newPage();
  await other.goto("/");
  await other.getByTestId(`sign-in-as-${email}`).click();
  await expect(other.getByTestId("session-conflict-text")).toContainText(/Chrome on \w+, last active/);
  await other.getByTestId("session-cancel").click();
  await expect(other).toHaveURL(/\/sign-in/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-session", "active");
  await expect(page.getByTestId("signed-out-reason")).toHaveCount(0);

  // Again, and continue: the first browser shows why it was signed out.
  await other.getByTestId(`sign-in-as-${email}`).click();
  await other.getByTestId("session-continue").click();
  await expect(other.locator("html")).toHaveAttribute("data-session", "active");
  await expect(page.getByTestId("signed-out-reason")).toHaveText("You were signed out because your account was opened on another device.", { timeout: 5_000 });
  await expect(page).toHaveURL(/\/sign-in/);
  await second.close();
});

test("a replaced session's next request signs it out with the reason, even without the live event", async ({ page, browser }) => {
  const email = `${unique("stale")}@example.com`;
  await createUser("Stale Tab", email);
  await page.goto("/");
  await pickOnSignIn(page, email);
  await expect(page.locator("html")).toHaveAttribute("data-session", "active");
  await page.context().setOffline(true);

  const second = await browser.newContext();
  const other = await second.newPage();
  await other.goto("/");
  await pickOnSignIn(other, email);
  await expect(other.locator("html")).toHaveAttribute("data-session", "active");

  await page.context().setOffline(false);
  await page.reload();
  await expect(page.getByTestId("signed-out-reason")).toBeVisible();
  await second.close();
});
