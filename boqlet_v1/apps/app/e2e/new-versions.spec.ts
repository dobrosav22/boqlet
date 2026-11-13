import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { apiAs, generatedDuplexBoq, signInAs, type DevUser } from "./helpers";

/** FE-029: F08 §1 / FL-3 steps 1–3: a newer model version is announced, and "Use v2" swaps it in. */

const DUPLEX = path.resolve(__dirname, "..", "..", "..", "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");
test.describe.configure({ timeout: 240_000 });

/** Uploads a new version of a model (the same file: the parse is reused, so it is ready at once). */
async function uploadVersion(user: DevUser, modelId: string, bytes: Uint8Array, fileName: string) {
  const { version, upload } = await apiAs<{ version: { id: string }; upload: { method: string; url: string; headers: Record<string, string> } }>(user, "POST", `/models/${modelId}/versions`, { fileName, sizeBytes: bytes.byteLength, note: "Wall moved" });
  const put = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: new Blob([bytes as BlobPart]) });
  if (!put.ok) throw new Error(`upload answered ${put.status}`);
  return apiAs<{ status: string; number: number }>(user, "POST", `/model-versions/${version.id}/complete`, {});
}

test("F08 §1 a newer version shows on the open BoQ without a reload; Use v2 makes it a pending change; the bell tells", async ({ page }) => {
  const bytes = new Uint8Array(await readFile(DUPLEX));
  const { url, projectUrl, projectId, olivia } = await generatedDuplexBoq(bytes);
  await signInAs(page, "olivia");
  await page.goto(url);
  await expect(page.getByTestId("current-run")).toBeVisible();
  await expect(page.getByTestId("new-model-version")).toHaveCount(0);

  const [model] = await apiAs<{ id: string }[]>(olivia, "GET", `/projects/${projectId}/models`);
  const v2 = await uploadVersion(olivia, model!.id, bytes, "Duplex_A_v2.ifc");
  expect(v2).toMatchObject({ status: "ready", number: 2 });

  // FL-3 step 2: the open workspace learns it over the event stream.
  const banner = page.getByTestId("new-model-version");
  await expect(banner).toBeVisible({ timeout: 5_000 });
  await expect(banner.getByTestId("newer-Architecture")).toContainText("Architecture: v2 is ready (this version uses v1)");

  // The BoQ list marks it too.
  await page.goto(`${projectUrl}/boqs`);
  await expect(page.getByTestId("boq-row-Tender BoQ").getByTestId("boq-new-version")).toBeVisible();
  await page.getByTestId("notification-bell").click();
  await expect(page.getByTestId("notification-item").filter({ hasText: "Tender BoQ: Architecture v2 is available" }).first()).toBeVisible();
  await page.keyboard.press("Escape");

  // FL-3 step 3: "Use v2" in the working version is a pending change until generated again.
  await page.goto(url);
  await banner.getByTestId("use-newer-version-Architecture").click();
  await expect(page.getByTestId("new-model-version")).toHaveCount(0);
  await expect(page.getByTestId("pending-changes")).toContainText("models");
  await expect(page.getByTestId("save-version")).toBeDisabled();
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("pending-changes")).toHaveCount(0, { timeout: 30_000 });
  await page.goto(`${projectUrl}/boqs`);
  await expect(page.getByTestId("boq-row-Tender BoQ").getByTestId("boq-new-version")).toHaveCount(0);
});

test("a viewer sees the badge without the Use button", async ({ page }) => {
  const bytes = new Uint8Array(await readFile(DUPLEX));
  const { url, projectId, olivia } = await generatedDuplexBoq(bytes);
  const [model] = await apiAs<{ id: string }[]>(olivia, "GET", `/projects/${projectId}/models`);
  await uploadVersion(olivia, model!.id, bytes, "Duplex_A_v2.ifc");
  const victor = await signInAs(page, "victor");
  await apiAs(olivia, "POST", `/projects/${projectId}/members`, { userId: victor.id, role: "viewer" });
  await page.goto(url);
  const banner = page.getByTestId("new-model-version");
  await expect(banner).toBeVisible();
  await expect(banner.getByTestId("use-newer-version-Architecture")).toHaveCount(0);
});
