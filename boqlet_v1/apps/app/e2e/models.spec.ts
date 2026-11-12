import { writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createOrg, createUser, signInAs, signInAsUser, unique } from "./helpers";

/** FE-007: F03 models and uploads against the mock and the PoC engine. */

const FIXTURES = path.resolve(__dirname, "..", "..", "..", "fixtures", "ifc");
const DUPLEX = path.join(FIXTURES, "Ifc2x3_Duplex_Architecture.ifc");
const SMALL = path.join(FIXTURES, "buildingsmart", "IFC2X3", "Building-Architecture.ifc");
test.describe.configure({ timeout: 240_000 });

async function newProjectWithModel(page: import("@playwright/test").Page, modelName = "Architecture", name = `Models ${unique("m")}`) {
  await page.goto("/studio-demo/projects/new");
  await page.getByTestId("project-name").fill(name);
  await page.getByTestId("create-project").click();
  await expect(page.getByTestId("project-title")).toHaveText(name);
  await page.goto(`${page.url()}/models`);
  await page.getByTestId("model-name").fill(modelName);
  await page.getByTestId("add-model-submit").click();
  await expect(page.getByTestId(`model-${modelName}`)).toBeVisible();
}

test("F03-AC1 uploading the Duplex shows upload, processing and the report without a reload; a notification arrives", async ({ page }) => {
  await signInAs(page, "olivia");
  const model = `Arch ${unique("a")}`;
  await newProjectWithModel(page, model);
  await page.locator('[data-testid^="upload-input-"]').setInputFiles(DUPLEX);
  await expect(page.getByTestId("version-page")).toBeVisible({ timeout: 60_000 });
  // The toast comes when the parse is done; watch for it while the report arrives (F03-AC2, second half).
  const notified = expect(page.getByText(`${model} v1 is ready`)).toBeVisible({ timeout: 180_000 });
  await expect(page.getByTestId("input-check-report")).toBeVisible({ timeout: 180_000 });
  await notified;
  await expect(page.getByTestId("version-page")).toContainText("IFC2X3");
  await expect(page.getByTestId("checks")).toBeVisible();
  await page.getByTestId("load-names").click();
  await expect(page.getByTestId("names-summary")).toContainText("names");
});

test("F03-AC2 leaving and coming back during processing shows the live state", async ({ page }) => {
  await signInAs(page, "olivia");
  await newProjectWithModel(page, `Small ${unique("s")}`);
  await page.locator('[data-testid^="upload-input-"]').setInputFiles(SMALL);
  await expect(page.getByTestId("version-page")).toBeVisible({ timeout: 60_000 });
  const versionUrl = page.url();
  await page.getByRole("link", { name: "Overview" }).click();
  await expect(page.getByTestId("overview-models")).toBeVisible();
  await page.goto(versionUrl);
  await expect(page.locator('[data-testid^="version-status-"]').first()).toHaveAttribute("data-status", /queued|processing|ready/);
  await expect(page.getByTestId("input-check-report")).toBeVisible({ timeout: 180_000 });
});

test("F03-AC3 a non-IFC file fails with a readable message and no retry", async ({ page }) => {
  await signInAs(page, "olivia");
  await newProjectWithModel(page, `Notes ${unique("n")}`);
  await page.locator('[data-testid^="upload-input-"]').setInputFiles({ name: "notes.ifc", mimeType: "application/octet-stream", buffer: Buffer.from("these are notes, not a model") });
  await expect(page.getByTestId("version-page")).toBeVisible();
  await expect(page.getByText("This file is not an IFC file.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
});

test("F03-AC6 the client refuses other files and files over the plan's size before uploading", async ({ page }, testInfo) => {
  const owner = await createUser("Free Modeller", `${unique("fm")}@example.com`);
  const org = await createOrg(owner, "Free Modelling", unique("fm"));
  await signInAsUser(page, owner);
  await page.goto(`/${org.slug}/projects/new`);
  await page.getByTestId("project-name").fill("Size test");
  await page.getByTestId("create-project").click();
  await expect(page.getByTestId("project-title")).toBeVisible();
  await page.goto(`${page.url()}/models`);
  await page.getByTestId("model-name").fill("Big");
  await page.getByTestId("add-model-submit").click();
  const input = page.locator('[data-testid^="upload-input-"]');
  await input.setInputFiles({ name: "plan.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF") });
  await expect(page.getByTestId("upload-error")).toContainText("IFC file");
  const huge = testInfo.outputPath("huge.ifc");
  await writeFile(huge, Buffer.alloc(51 * 1024 * 1024, 32));
  await input.setInputFiles(huge);
  await expect(page.getByTestId("upload-error")).toContainText("50 MB");
});
