import { expect, test } from "@playwright/test";
import { devUser, emit, signInAs } from "./helpers";

/** FE-004: the mock auth adapter and the realtime client. */

test("signing in as a seeded user, then switching users, changes GET /me", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in/);
  const meOlivia = page.waitForResponse((r) => r.url().endsWith("/api/v1/me") && r.status() === 200);
  await page.getByTestId("sign-in-as-olivia@example.com").click();
  expect(((await (await meOlivia).json()) as { user: { name: string } }).user.name).toBe("Olivia Owner");
  await expect(page).toHaveURL(/\/studio-demo$/);
  await expect(page.getByTestId("user-name")).toHaveText("Olivia Owner");

  await page.getByTestId("user-menu").click();
  await page.getByTestId("sign-out").click();
  await expect(page).toHaveURL(/\/sign-in/);

  const meMarko = page.waitForResponse((r) => r.url().endsWith("/api/v1/me") && r.status() === 200);
  await page.getByTestId("sign-in-as-marko@example.com").click();
  expect(((await (await meMarko).json()) as { user: { name: string } }).user.name).toBe("Marko Estimator");
  await expect(page.getByTestId("user-name")).toHaveText("Marko Estimator");
});

test("an anonymous visitor is sent to sign-in and comes back to the page afterwards", async ({ page }) => {
  await page.goto("/studio-demo?tab=x");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fstudio-demo%3Ftab%3Dx/);
  await page.getByTestId("sign-in-as-ivana@example.com").click();
  await expect(page).toHaveURL(/\/studio-demo\?tab=x$/);
});

test("a realtime event invalidates the matching query", async ({ page }) => {
  const olivia = await signInAs(page, "olivia");
  await page.goto("/");
  await expect(page).toHaveURL(/\/studio-demo$/);
  await expect(page.locator("html")).toHaveAttribute("data-realtime", "open");
  const refetch = page.waitForRequest((r) => r.url().endsWith("/api/v1/me"));
  await emit("entity.changed", { entityType: "user", entityId: olivia.id, change: "updated" }, [olivia.id]);
  await refetch;
});

test("events for another user don't reach this one", async ({ page }) => {
  await signInAs(page, "ana");
  const marko = await devUser("marko");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-realtime", "open");
  let refetched = false;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/v1/me")) refetched = true;
  });
  await emit("entity.changed", { entityType: "user", entityId: marko.id }, [marko.id]);
  await page.waitForTimeout(1000);
  expect(refetched).toBe(false);
});
