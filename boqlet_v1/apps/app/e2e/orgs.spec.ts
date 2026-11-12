import { expect, test } from "@playwright/test";
import { createOrg, createUser, mailLinks, signInAs, signInAsUser, unique } from "./helpers";

/** FE-005: F01 accounts, organisations and members against the mock. */

test("F01-AC1 a new user signs up, creates an org and lands on its dashboard in under a minute", async ({ page }) => {
  const started = Date.now();
  const email = `${unique("new")}@example.com`;
  await page.goto("/sign-up");
  await page.getByTestId("sign-up-name").fill("New Person");
  await page.getByTestId("sign-up-email").fill(email);
  await page.getByTestId("sign-up-submit").click();
  await expect(page).toHaveURL(/\/onboarding$/);
  const name = `Firm ${unique("x")}`;
  await page.getByTestId("org-name").fill(name);
  await page.getByTestId("create-org").click();
  await expect(page).toHaveURL(/\/firm-x-[a-z0-9]+$/);
  await expect(page.getByTestId("org-switcher")).toContainText(name);
  expect(Date.now() - started).toBeLessThan(60_000);
});

test("an invitation is accepted by the invited person and brings them into the org", async ({ page, browser }) => {
  await signInAs(page, "olivia");
  await page.goto("/studio-demo/settings/members");
  const email = `${unique("colleague")}@example.com`;
  await page.getByTestId("invite-email").fill(email);
  await page.getByTestId("invite-role").selectOption("member");
  await page.getByTestId("invite-submit").click();
  await expect(page.getByTestId(`invitation-${email}`)).toContainText("Pending");

  const link = (await mailLinks(email)).find((l) => l.includes("/invite/"))!;
  const other = await browser.newContext();
  const invitee = await other.newPage();
  await invitee.goto(new URL(link).pathname);
  await expect(invitee.getByTestId("invitation")).toContainText("Join Studio Demo");
  await invitee.getByTestId("invite-sign-in").click();
  await expect(invitee.getByTestId("sign-up-email")).toHaveValue(email);
  await invitee.getByTestId("sign-up-name").fill("Colleague Person");
  await invitee.getByTestId("sign-up-submit").click();
  await invitee.getByTestId("accept-invitation").click();
  await expect(invitee).toHaveURL(/\/studio-demo$/);
  await other.close();

  await page.reload();
  await expect(page.getByTestId(`member-${email}`)).toContainText("Member");
});

test("F01-AC2 someone signed in with another email can't accept", async ({ page }) => {
  const owner = await createUser("Owner", `${unique("owner")}@example.com`);
  const org = await createOrg(owner, "Mismatch Firm", unique("mismatch"));
  const email = `${unique("invited")}@example.com`;
  await fetch(`${process.env.MOCK_URL ?? "http://localhost:4010"}/api/v1/orgs/${org.id}/invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${owner.token}` },
    body: JSON.stringify({ email, role: "member" }),
  });
  const link = (await mailLinks(email)).find((l) => l.includes("/invite/"))!;
  await signInAs(page, "marko");
  await page.goto(new URL(link).pathname);
  await expect(page.getByTestId("email-mismatch")).toBeVisible();
  await expect(page.getByTestId("accept-invitation")).toHaveCount(0);
});

test("F01-AC3 inviting beyond the seat limit shows the limit dialog", async ({ page }) => {
  const owner = await createUser("Free Owner", `${unique("free")}@example.com`);
  const org = await createOrg(owner, "Free Firm", unique("free"));
  await signInAsUser(page, owner);
  await page.goto(`/${org.slug}/settings/members`);
  await page.getByTestId("invite-email").fill(`${unique("one")}@example.com`);
  await page.getByTestId("invite-submit").click();
  await expect(page.getByTestId("invitations-table")).toBeVisible();
  await page.getByTestId("invite-email").fill(`${unique("two")}@example.com`);
  await page.getByTestId("invite-submit").click();
  await expect(page.getByTestId("limit-dialog")).toBeVisible();
  await expect(page.getByTestId("limit-detail")).toContainText("seats: 2 of 2");
});

test("F01-AC4 the last owner can't leave", async ({ page }) => {
  const owner = await createUser("Sole Owner", `${unique("sole")}@example.com`);
  const org = await createOrg(owner, "Sole Firm", unique("sole"));
  await signInAsUser(page, owner);
  await page.goto("/account");
  await page.getByTestId(`leave-${org.slug}`).click();
  await expect(page.getByTestId(`account-org-${org.slug}`)).toContainText("at least one owner");
});

test("F01-AC6 a user in two orgs switches between them", async ({ page }) => {
  await signInAs(page, "olivia");
  await page.goto("/studio-demo/settings/general");
  await expect(page.getByTestId("settings-name")).toHaveValue("Studio Demo");
  await page.getByTestId("org-switcher").click();
  await page.getByTestId("switch-org-small-firm").click();
  await expect(page).toHaveURL(/\/small-firm$/);
  await page.goto("/small-firm/settings/general");
  await expect(page.getByTestId("settings-name")).toHaveValue("Small Firm");
});

test("members see settings read-only and can't invite", async ({ page }) => {
  await signInAs(page, "marko");
  await page.goto("/studio-demo/settings/general");
  await expect(page.getByTestId("read-only-note")).toBeVisible();
  await expect(page.getByTestId("settings-save")).toHaveCount(0);
  await page.goto("/studio-demo/settings/members");
  await expect(page.getByTestId("members-table")).toBeVisible();
  await expect(page.getByTestId("invite-form")).toHaveCount(0);
});

test("an org the user isn't in shows not found", async ({ page }) => {
  await signInAs(page, "marko");
  await page.goto("/small-firm");
  await expect(page.getByTestId("not-found")).toBeVisible();
});
