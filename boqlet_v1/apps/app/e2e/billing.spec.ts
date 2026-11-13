import { expect, test } from "@playwright/test";
import { apiAs, createOrg, createUser, signInAs, signInAsUser, unique } from "./helpers";

/** FE-019: entitlement UX (F14): the limit dialog with its way on, the billing page with checkout, usage. */

test("the Small Firm seed shows the limit dialog on New project, with Upgrade for its owner", async ({ page }) => {
  await signInAs(page, "olivia");
  await page.goto("/small-firm/projects/new");
  await page.getByTestId("project-name").fill(`Over the limit ${unique("p")}`);
  await page.getByTestId("create-project").click();
  const dialog = page.getByTestId("limit-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("limit-detail")).toContainText("activeProjects");
  await dialog.getByTestId("limit-upgrade").click();
  await expect(page).toHaveURL(/\/small-firm\/settings\/billing$/);
  await expect(page.getByTestId("billing-settings")).toHaveAttribute("data-plan", "free");
  // The seed stays at its limit: no checkout here (other tests rely on it).
  await expect(page.getByTestId("limit-activeProjects")).toHaveAttribute("data-max", "1");
});

test("F14 checkout on /_dev/checkout lifts the limit, and the usage page shows the month", async ({ page }) => {
  const owner = await createUser("Growing Owner", `${unique("grow")}@example.com`);
  const org = await createOrg(owner, "Growing Firm", unique("grow"));
  await apiAs(owner, "POST", `/orgs/${org.id}/projects`, { name: "The one free project" });
  await signInAsUser(page, owner);

  await page.goto(`/${org.slug}/projects/new`);
  await page.getByTestId("project-name").fill("Second project");
  await page.getByTestId("create-project").click();
  await expect(page.getByTestId("limit-dialog")).toBeVisible();
  await page.getByTestId("limit-upgrade").click();

  const billing = page.getByTestId("billing-settings");
  await expect(billing).toHaveAttribute("data-plan", "free");
  await expect(page.getByTestId("limit-activeProjects")).toHaveAttribute("data-used", "1");
  await page.locator('[data-testid="plan-card"][data-plan="professional"]').getByTestId("choose-plan").click();
  // The manual adapter's checkout switches the plan and comes back here.
  await expect(page).toHaveURL(new RegExp(`/${org.slug}/settings/billing$`));
  await expect(page.getByTestId("billing-settings")).toHaveAttribute("data-plan", "professional");
  await expect(page.locator('[data-testid="plan-card"][data-plan="professional"]').getByTestId("choose-plan")).toBeDisabled();

  await page.goto(`/${org.slug}/projects/new`);
  await page.getByTestId("project-name").fill("Second project");
  await page.getByTestId("create-project").click();
  await expect(page).toHaveURL(new RegExp(`/${org.slug}/projects/[0-9a-f-]+`));
  await expect(page.getByTestId("limit-dialog")).toHaveCount(0);

  await page.goto(`/${org.slug}/settings/usage`);
  await expect(page.getByTestId("usage-settings")).toBeVisible();
  await expect(page.getByTestId("usage-projects")).toContainText("2");
  await expect(page.getByTestId("settings-billing")).toBeVisible();
});

test("a member sees neither billing nor usage in the settings", async ({ page }) => {
  await signInAs(page, "marko");
  await page.goto("/studio-demo/settings/general");
  await expect(page.getByTestId("settings-members")).toBeVisible();
  await expect(page.getByTestId("settings-billing")).toHaveCount(0);
  await expect(page.getByTestId("settings-usage")).toHaveCount(0);
});
