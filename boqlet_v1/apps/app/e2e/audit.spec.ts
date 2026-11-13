import { expect, test } from "@playwright/test";
import { apiAs, createOrg, createUser, signInAsUser, unique } from "./helpers";

/** FE-033: F09 "Audit log": S18 project activity and S25 org audit, with filters and CSV. */

test("S18 filters the project's activity by action; S25 lists the org's events and downloads them as CSV", async ({ page }) => {
  const owner = await createUser("Audrey Owner", `${unique("audit")}@example.com`);
  const org = await createOrg(owner, "Audit Studio", unique("audit"));
  const project = await apiAs<{ id: string }>(owner, "POST", `/orgs/${org.id}/projects`, { name: "Audited", code: "AUD" });
  await apiAs(owner, "PATCH", `/projects/${project.id}`, { name: "Audited project" });
  await signInAsUser(page, owner);

  await page.goto(`/${org.slug}/projects/${project.id}/activity`);
  await expect(page.getByTestId("audit-row").first()).toBeVisible();
  await page.getByTestId("audit-action").selectOption("project.updated");
  await expect(page.getByTestId("audit-row")).toHaveCount(1);
  await expect(page.getByTestId("audit-row")).toHaveAttribute("data-action", "project.updated");
  await page.getByTestId("audit-from").fill("2999-01-01");
  await expect(page.getByTestId("audit-row")).toHaveCount(0);

  await page.goto(`/${org.slug}/settings`);
  await page.getByTestId("settings-audit").click();
  await expect(page).toHaveURL(new RegExp(`/${org.slug}/settings/audit$`));
  await expect(page.locator('[data-testid="audit-row"][data-action="org.created"]')).toHaveCount(1);
  await page.getByTestId("audit-entity").selectOption("project");
  await expect(page.locator('[data-testid="audit-row"][data-action="org.created"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="audit-row"][data-action="project.created"]')).toHaveCount(1);
  const csv = page.waitForEvent("download");
  await page.getByTestId("audit-csv").click();
  expect((await csv).suggestedFilename()).toBe(`${org.slug}_audit.csv`);
});
