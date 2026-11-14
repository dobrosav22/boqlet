import { expect, test } from "@playwright/test";
import { apiAs, createOrg, createUser, MOCK_URL, signInAs, signInAsUser, unique } from "./helpers";

/** FE-038: the platform admin console (F19, S36) and FL-12, as Pat (platform admin) on the mock. */

async function orgThatHitALimit(prefix: string) {
  const owner = await createUser(`${prefix} Owner`, `${unique(prefix)}@example.com`);
  const org = await createOrg(owner, `${prefix} Firm ${unique("x")}`, unique(prefix), { setupDone: false });
  await apiAs(owner, "POST", `/orgs/${org.id}/projects`, { name: "The free one" });
  const over = await fetch(`${MOCK_URL}/api/v1/orgs/${org.id}/projects`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${owner.token}` }, body: JSON.stringify({ name: "One more" }) });
  expect(over.status).toBe(402);
  return { owner, org };
}

test("a platform admin with no org lands on the console; overview tiles and orgs by plan", async ({ page }) => {
  await signInAs(page, "pat");
  await page.goto("/");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId("admin-overview")).toBeVisible();
  await expect(page.getByTestId("admin-tile-newOrgs-value")).not.toHaveText("");
  await expect(page.getByTestId("admin-orgs-by-plan")).toContainText("free");
  await page.getByTestId("admin-period").selectOption("7");
  await expect(page.getByTestId("admin-tile-signUps")).toBeVisible();
});

test("FL-12: funnel to the stuck orgs, 'hit a limit', an org's usage and limit events, a note, a tag and a trial with a reason", async ({ page }) => {
  const { owner, org } = await orgThatHitALimit("fl12");
  await signInAs(page, "pat");

  // 1. The funnel: the new org hasn't finished setup.
  await page.goto("/admin/funnel");
  await expect(page.getByTestId("funnel-org_created-count")).not.toHaveText("0");
  await page.getByTestId("funnel-setup_done-stuck").click();
  await expect(page).toHaveURL(/\/admin\/orgs\?stuckAt=setup_done/);
  await expect(page.getByTestId("orgs-stuck-at")).toBeVisible();
  await expect(page.getByTestId(`orgs-row-${org.id}`)).toBeVisible();

  // 2. Orgs that hit a limit: open it, read usage and limit events, add a note and a tag.
  await page.goto("/admin/orgs?signal=hit_limit");
  const row = page.getByTestId(`orgs-row-${org.id}`);
  await expect(row.getByTestId("orgs-limit-hits")).toHaveText("1");
  await expect(row.getByTestId("orgs-projects")).toHaveText("1 / 1");
  await row.getByRole("link").click();
  await expect(page.getByTestId("admin-org")).toBeVisible();
  await expect(page.getByTestId("admin-org-limit-events")).toContainText("activeProjects");
  await expect(page.getByTestId("admin-org-counts")).toBeVisible();
  // Metadata only (BR-57): the project's name isn't there.
  await expect(page.getByTestId("admin-org")).not.toContainText("The free one");

  await page.getByTestId("admin-note-text").fill("Hit the project limit on day one; call about Professional");
  await page.getByTestId("admin-note-add").click();
  await expect(page.getByTestId("admin-note")).toContainText("call about Professional");

  await page.getByTestId("admin-tags").click();
  await page.getByTestId("admin-tags-input").fill("upsell, onboarding");
  await expect(page.getByTestId("admin-tags-submit")).toBeDisabled();
  await page.getByTestId("admin-tags-reason").fill("Sales pipeline");
  await page.getByTestId("admin-tags-submit").click();
  await expect(page.getByTestId("admin-org-tag-list")).toContainText("upsell");

  // 3. Extend the trial by 14 days with a reason: audited, visible to the org.
  await page.getByTestId("admin-trial").click();
  await page.getByTestId("admin-trial-plus-14").click();
  await page.getByTestId("admin-trial-reason").fill("Asked for two more weeks");
  await page.getByTestId("admin-trial-submit").click();
  await expect(page.getByTestId("admin-org-subscription")).toHaveText("Trial");
  await expect(page.getByTestId("admin-org-trial")).not.toHaveText("No trial");

  const audit = await apiAs<{ items: { action: string; actorKind: string; data: Record<string, unknown> }[] }>(owner, "GET", `/orgs/${org.id}/audit`);
  expect(audit.items.find((e) => e.action === "org.trial_changed")).toMatchObject({ actorKind: "platform_admin", data: { reason: "Asked for two more weeks" } });
  expect(JSON.stringify(audit.items)).not.toContain("call about Professional");
});

test("changing the plan needs a reason and lifts the limit at once; suspending shows the org read-only", async ({ page, browser }) => {
  const { owner, org } = await orgThatHitALimit("plan");
  await signInAs(page, "pat");
  await page.goto(`/admin/orgs/${org.id}`);
  await page.getByTestId("admin-plan").click();
  await page.getByTestId("admin-plan-select").selectOption("professional");
  await expect(page.getByTestId("admin-plan-submit")).toBeDisabled();
  await page.getByTestId("admin-plan-reason").fill("Signed the contract by email");
  await page.getByTestId("admin-plan-submit").click();
  await expect(page.getByTestId("admin-org-status")).toContainText("professional");
  await expect(page.getByTestId("admin-org-plan-history")).toContainText("professional");
  await apiAs(owner, "POST", `/orgs/${org.id}/projects`, { name: "Fits now" });

  await page.getByTestId("admin-suspend").click();
  await page.getByTestId("admin-suspend-reason").fill("Chargeback");
  await page.getByTestId("admin-suspend-submit").click();
  await expect(page.getByTestId("admin-org-suspended")).toBeVisible();

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await signInAsUser(ownerPage, owner);
  await ownerPage.goto(`/${org.slug}/projects`);
  await expect(ownerPage.getByTestId("org-suspended")).toBeVisible();
  await ownerContext.close();

  await page.getByTestId("admin-suspend").click();
  await page.getByTestId("admin-suspend-reason").fill("Resolved");
  await page.getByTestId("admin-suspend-submit").click();
  await expect(page.getByTestId("admin-org-suspended")).toHaveCount(0);
});

test("users: end a person's active session", async ({ page }) => {
  const person = await createUser("Locked Out", `${unique("locked")}@example.com`);
  await apiAs(person, "POST", "/sessions", { deviceLabel: "Office PC" });
  await signInAs(page, "pat");
  await page.goto("/admin/users");
  await page.getByTestId("users-search").fill(person.email);
  // The search is debounced: wait until the list is just that person before opening the dialog.
  await expect(page.getByTestId("users-table").locator("tbody tr")).toHaveCount(1);
  await page.getByTestId(`users-end-${person.email}`).click();
  await page.getByTestId("users-end-confirm").click();
  await expect(page.getByTestId(`users-row-${person.email}`)).toContainText("None");
});

test("health shows job durations", async ({ page }) => {
  await signInAs(page, "pat");
  await page.goto("/admin/health");
  await expect(page.getByTestId("admin-health")).toBeVisible();
});

test("anyone else gets the not-found page at /admin", async ({ page }) => {
  await signInAs(page, "olivia");
  await page.goto("/admin");
  await expect(page.getByTestId("not-found")).toBeVisible();
  await expect(page.getByTestId("admin-shell")).toHaveCount(0);
  await page.goto("/admin/orgs");
  await expect(page.getByTestId("not-found")).toBeVisible();
});
