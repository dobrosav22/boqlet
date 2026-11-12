import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

/** FE-002: the app shell in both themes, the theme switch, not-found, and the pseudo-locale. */
const PAPER = "rgb(242, 237, 227)";
const INK = "rgb(21, 21, 21)";
const bodyBackground = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("the org shell shows the wordmark and the left navigation", async ({ page }) => {
  await signInAs(page, "olivia");
  await page.goto("/studio-demo");
  await expect(page.getByTestId("wordmark")).toHaveText("boqlet");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link")).toHaveText(["Dashboard", "Projects", "Library", "Settings"]);
  await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(font).toContain("JetBrains Mono");
});

test("light by default, dark when the OS asks for it", async ({ browser }) => {
  const light = await browser.newContext({ colorScheme: "light" });
  const lightPage = await light.newPage();
  await signInAs(lightPage, "olivia");
  await lightPage.goto("/studio-demo");
  expect(await bodyBackground(lightPage)).toBe(PAPER);
  await light.close();

  const dark = await browser.newContext({ colorScheme: "dark" });
  const darkPage = await dark.newPage();
  await signInAs(darkPage, "olivia");
  await darkPage.goto("/studio-demo");
  expect(await bodyBackground(darkPage)).toBe(INK);
  await dark.close();
});

test("the user can switch the theme, and it is remembered", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signInAs(page, "olivia");
  await page.goto("/studio-demo");
  await page.getByTestId("theme-switch").click();
  await page.getByTestId("theme-dark").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await bodyBackground(page)).toBe(INK);
  await page.reload();
  expect(await bodyBackground(page)).toBe(INK);
});

test("unknown routes show the not-found page", async ({ page }) => {
  const response = await page.goto("/studio-demo/does/not/exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByTestId("not-found")).toBeVisible();
});

test("the pseudo-locale en-XA renders every shell string from the catalogue", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "boqlet-locale", value: "en-XA", url: baseURL! }]);
  await signInAs(page, "olivia");
  await page.goto("/studio-demo");
  const links = page.getByRole("navigation").getByRole("link");
  for (const text of await links.allTextContents()) expect(text).toMatch(/^\[.*~+\]$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-XA");
});
