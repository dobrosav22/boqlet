import { expect, test } from "@playwright/test";
import { createOrg, createUser, devUser, MOCK_URL, signInAs, signInAsUser, unique } from "./helpers";

/** FE-006: F02 projects and the dashboard against the mock. */

async function duplexId() {
  const olivia = await devUser("olivia");
  const me = (await (await fetch(`${MOCK_URL}/api/v1/me`, { headers: { Authorization: `Bearer ${olivia.token}` } })).json()) as {
    memberships: { org: { id: string; slug: string } }[];
  };
  const org = me.memberships.find((m) => m.org.slug === "studio-demo")!.org;
  const projects = (await (await fetch(`${MOCK_URL}/api/v1/orgs/${org.id}/projects`, { headers: { Authorization: `Bearer ${olivia.token}` } })).json()) as {
    id: string;
    name: string;
  }[];
  return projects.find((p) => p.name === "Duplex")!.id;
}

test("FL-1 step 4–5: an empty dashboard offers the sample project, which opens", async ({ page }) => {
  const owner = await createUser("Fresh Owner", `${unique("fresh")}@example.com`);
  const org = await createOrg(owner, "Fresh Firm", unique("fresh"));
  await signInAsUser(page, owner);
  await page.goto(`/${org.slug}`);
  await expect(page.getByTestId("empty-dashboard")).toBeVisible();
  await page.getByTestId("try-sample").click();
  await expect(page.getByTestId("project-title")).toHaveText("Duplex (sample)");
  await page.goto(`/${org.slug}`);
  await expect(page.getByTestId("project-cards")).toContainText("Duplex (sample)");
});

test("a member creates a project and becomes its lead", async ({ page }) => {
  await signInAs(page, "marko");
  await page.goto("/studio-demo/projects/new");
  const name = `Tower ${unique("t")}`;
  await page.getByTestId("project-name").fill(name);
  await page.getByTestId("create-project").click();
  await expect(page.getByTestId("project-title")).toHaveText(name);
  await expect(page.getByTestId("project-title")).toBeVisible();
  await page.goto(`${page.url()}/settings`);
  await expect(page.getByTestId("project-members")).toContainText("Lead");
});

test("F02-AC1 the project limit opens the limit dialog; archiving frees the slot", async ({ page }) => {
  const owner = await createUser("Limit Owner", `${unique("limit")}@example.com`);
  const org = await createOrg(owner, "Limit Firm", unique("limit"));
  await signInAsUser(page, owner);
  await page.goto(`/${org.slug}/projects/new`);
  await page.getByTestId("project-name").fill("First");
  await page.getByTestId("create-project").click();
  await expect(page.getByTestId("project-title")).toHaveText("First");
  const firstUrl = page.url();
  await page.goto(`/${org.slug}/projects/new`);
  await page.getByTestId("project-name").fill("Second");
  await page.getByTestId("create-project").click();
  await expect(page.getByTestId("limit-dialog")).toBeVisible();
  await expect(page.getByTestId("limit-detail")).toContainText("activeProjects: 1 of 1");
  await page.keyboard.press("Escape");
  await page.goto(`${firstUrl}/settings`);
  await page.getByTestId("archive-toggle").click();
  await expect(page.getByTestId("archived-banner")).toBeVisible();
  await page.goto(`/${org.slug}/projects/new`);
  await page.getByTestId("project-name").fill("Second");
  await page.getByTestId("create-project").click();
  await expect(page.getByTestId("project-title")).toHaveText("Second");
});

test("F02-AC2 a member without a project role doesn't see it and gets not found", async ({ page }) => {
  const id = await duplexId();
  await signInAs(page, "ivana");
  await page.goto("/studio-demo");
  await expect(page.getByTestId("project-cards").or(page.getByTestId("empty-dashboard"))).toBeVisible();
  await expect(page.getByTestId("project-card-Duplex")).toHaveCount(0);
  await page.goto(`/studio-demo/projects/${id}`);
  await expect(page.getByTestId("not-found")).toBeVisible();
});

test("F02-AC3 only org members can be added; outsiders get the share-link hint", async ({ page }) => {
  await signInAs(page, "olivia");
  await page.goto("/studio-demo/projects/new");
  await page.getByTestId("project-name").fill(`Team ${unique("team")}`);
  await page.getByTestId("create-project").click();
  await expect(page.getByTestId("project-title")).toBeVisible();
  await page.goto(`${page.url()}/settings`);
  await page.getByTestId("project-member-email").fill("stranger@elsewhere.example");
  await page.getByTestId("project-member-add").click();
  await expect(page.getByTestId("add-project-member")).toContainText("share link");
  await page.getByTestId("project-member-email").fill("ivana@example.com");
  await page.getByTestId("project-member-add").click();
  await expect(page.getByTestId("project-member-ivana@example.com")).toBeVisible();
});

test("F02-AC4 an archived project shows the read-only banner and disables its settings", async ({ page }) => {
  await signInAs(page, "olivia");
  await page.goto("/studio-demo/projects/new");
  await page.getByTestId("project-name").fill(`Old ${unique("old")}`);
  await page.getByTestId("create-project").click();
  await expect(page.getByTestId("project-title")).toBeVisible();
  await page.goto(`${page.url()}/settings`);
  await page.getByTestId("archive-toggle").click();
  await expect(page.getByTestId("archived-banner")).toBeVisible();
  await expect(page.getByTestId("project-settings-name")).toBeDisabled();
  await page.getByTestId("archive-toggle").click();
  await expect(page.getByTestId("archived-banner")).toHaveCount(0);
});
