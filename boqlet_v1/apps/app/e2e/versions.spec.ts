import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { apiAs, createOrg, createUser, generatedDuplexBoq, mailLinks, MOCK_URL, modelWithVersion, signInAs, signInAsUser, unique, type DevUser } from "./helpers";

/** FE-031: F09 save version, saved versions read-only, confirm and reopen, and the optional review. */

const DUPLEX = path.resolve(__dirname, "..", "..", "..", "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");
test.describe.configure({ timeout: 300_000 });

async function waitRun(user: DevUser, runId: string) {
  const deadline = Date.now() + 120_000;
  for (;;) {
    const r = await apiAs<{ status: string }>(user, "GET", `/runs/${runId}`);
    if (r.status !== "queued" && r.status !== "running") return;
    if (Date.now() > deadline) throw new Error("run did not finish");
    await new Promise((res) => setTimeout(res, 300));
  }
}

async function saveInDialog(page: Page, note: string) {
  await page.getByTestId("save-version").click();
  const dialog = page.getByTestId("save-version-dialog");
  await expect(dialog.getByTestId("save-version-submit")).toBeDisabled();
  await dialog.getByTestId("version-note").fill(note);
  await dialog.getByTestId("save-not-modelled-tick").check();
  await dialog.getByTestId("save-version-submit").click();
  await expect(dialog).toHaveCount(0);
}

test("F09 §2–3 save version A with the not-in-the-models tick; the working version goes on as B; A opens read-only and downloads its Excel", async ({ page }) => {
  const { url } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  await signInAs(page, "olivia");
  await page.goto(url);
  await expect(page.getByTestId("current-run")).toBeVisible();
  await saveInDialog(page, "For the client meeting");
  await expect(page.getByTestId("revision-status")).toContainText("B · Working · last saved A");

  await page.getByTestId("tab-versions").click();
  const row = page.getByTestId("saved-version").filter({ hasText: "For the client meeting" });
  await expect(row).toHaveAttribute("data-label", "A");
  await expect(row.getByTestId("version-excel")).toBeVisible({ timeout: 30_000 });
  const download = page.waitForEvent("download");
  await row.getByTestId("version-excel").click();
  expect((await download).suggestedFilename()).toMatch(/_RevA_.*\.xlsx$/);

  await row.getByTestId("open-version").click();
  await expect(page.getByTestId("viewing-version")).toHaveAttribute("data-label", "A");
  await expect(page.getByTestId("tab-setup")).toHaveCount(0);
  // Read-only: the saved version's sheet takes no edits (it shares its run with the working version).
  await expect(page.getByTestId("sheet")).toHaveAttribute("data-editable", "false");
  await expect(page.getByTestId("add-line")).toHaveCount(0);
  await page.getByTestId("back-to-working").click();
  await expect(page.getByTestId("viewing-version")).toHaveCount(0);
  await expect(page.getByTestId("sheet")).toHaveAttribute("data-editable", "true");
});

test("F09 §5–6 confirm (nothing new: the working version closes), read-only, reopen with a reason; F08 §1 Reopen to update", async ({ page }) => {
  const { url, projectId, olivia } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  await signInAs(page, "olivia");
  await page.goto(url);
  await saveInDialog(page, "Tender");
  await page.getByTestId("boq-menu").click();
  await page.getByTestId("confirm-boq").click();
  const dialog = page.getByTestId("save-version-dialog");
  await expect(dialog).toHaveAttribute("data-mode", "confirm");
  await dialog.getByTestId("save-not-modelled-tick").check();
  await dialog.getByTestId("save-version-submit").click();
  await expect(page.getByTestId("revision-status")).toContainText("A · Saved");
  await expect(page.getByTestId("generate")).toHaveCount(0);

  // A newer model version arrives: the confirmed BoQ offers "Reopen to update" (F08 §1).
  const [model] = await apiAs<{ id: string }[]>(olivia, "GET", `/projects/${projectId}/models`);
  const bytes = new Uint8Array(await readFile(DUPLEX));
  const { version, upload } = await apiAs<{ version: { id: string }; upload: { method: string; url: string; headers: Record<string, string> } }>(olivia, "POST", `/models/${model!.id}/versions`, { fileName: "Duplex_A_v2.ifc", sizeBytes: bytes.byteLength });
  await fetch(upload.url, { method: upload.method, headers: upload.headers, body: new Blob([bytes as BlobPart]) });
  await apiAs(olivia, "POST", `/model-versions/${version.id}/complete`, {});
  const banner = page.getByTestId("new-model-version");
  await expect(banner).toHaveAttribute("data-confirmed", "true", { timeout: 10_000 });
  await banner.getByTestId("reopen-to-update").click();
  const reopen = page.getByTestId("reopen-boq-dialog");
  await expect(reopen.getByTestId("reopen-submit")).toBeDisabled();
  await reopen.getByTestId("reopen-reason").fill("Architecture v2 arrived");
  await reopen.getByTestId("reopen-submit").click();
  await expect(page.getByTestId("revision-status")).toContainText("B · Working · last saved A");
  await expect(page.getByTestId("new-model-version")).toHaveAttribute("data-confirmed", "false");
  await expect(page.getByTestId("use-newer-version-Architecture")).toBeVisible();
});

/** A fresh org on a plan with approval, approval and four-eyes on, a lead and an approver, and a generated BoQ. */
async function approvalOrg() {
  const lead = await createUser("Lena Lead", `${unique("lead")}@example.com`);
  const org = await createOrg(lead, "Review Firm", unique("review"));
  const { url: checkout } = await apiAs<{ url: string }>(lead, "POST", `/orgs/${org.id}/billing/checkout`, { planId: "team", returnUrl: "http://localhost:3000/" });
  await fetch(checkout, { redirect: "manual" });
  await apiAs(lead, "PATCH", `/orgs/${org.id}`, { settings: { approvalRequired: true, fourEyes: true } });
  const email = `${unique("approver")}@example.com`;
  await apiAs(lead, "POST", `/orgs/${org.id}/invitations`, { email, role: "member" });
  const approver = await createUser("Ana Reviewer", email);
  const token = (await mailLinks(email)).find((l) => l.includes("/invite/"))!.split("/invite/")[1]!;
  await apiAs(approver, "POST", `/invitations/${token}/accept`, {});
  const project = await apiAs<{ id: string }>(lead, "POST", `/orgs/${org.id}/projects`, { name: "Review project" });
  await apiAs(lead, "POST", `/projects/${project.id}/members`, { userId: approver.id, role: "approver" });
  await modelWithVersion(lead, project.id, "Architecture", new Uint8Array(await readFile(DUPLEX)), "Duplex_A.ifc");
  const boq = await apiAs<{ id: string; currentRevision: { id: string } }>(lead, "POST", `/projects/${project.id}/boqs`, { name: "Tender BoQ" });
  const { run } = await apiAs<{ run: { id: string } }>(lead, "POST", `/revisions/${boq.currentRevision.id}/runs`);
  await waitRun(lead, run.id);
  return { lead, approver, url: `/${org.slug}/projects/${project.id}/boqs/${boq.id}` };
}

test("F09 §4 with approval and four-eyes: submit → comment and request changes → submit → approve → the approver saves", async ({ page, browser }) => {
  const { lead, approver, url } = await approvalOrg();
  await signInAsUser(page, lead);
  await page.goto(url);
  await expect(page.getByTestId("save-version")).toHaveCount(0);
  await page.getByTestId("submit-for-review").click();
  const submit = page.getByTestId("submit-dialog");
  await submit.locator('[data-testid="reviewer"][data-name="Ana Reviewer"]').check();
  await submit.getByTestId("submit-message").fill("Please check the walls");
  await submit.getByTestId("save-not-modelled-tick").check();
  await submit.getByTestId("submit-review").click();
  const strip = page.getByTestId("review-strip");
  await expect(strip).toHaveAttribute("data-status", "in_review");
  // Four-eyes: the submitter has no Approve; the version is read-only until the review is withdrawn.
  await expect(strip.getByTestId("approve")).toHaveCount(0);
  await expect(page.getByTestId("generate")).toHaveCount(0);

  const other = await browser.newContext();
  const review = await other.newPage();
  await signInAsUser(review, approver);
  await review.goto(`${url}?tab=review`);
  await expect(review.getByTestId("review-tab")).toBeVisible();
  await expect(review.getByTestId("review-comment").first()).toContainText("Please check the walls");
  await expect(review.getByTestId("changes-tab")).toBeVisible();
  await review.getByTestId("review-comment-line").selectOption({ index: 1 });
  await review.getByTestId("review-comment-text").fill("Is this right?");
  await review.getByTestId("review-comment-post").click();
  await expect(review.locator('[data-testid="review-comment"]:not([data-line=""])')).toContainText("Is this right?");
  await review.getByTestId("request-changes").click();
  await review.getByTestId("request-comment").fill("Walls look off");
  await review.getByTestId("request-changes-submit").click();
  await expect(review.getByTestId("review-strip")).toHaveCount(0);

  // The lead sees it back in the working state and submits again; the approver approves and saves.
  await expect(page.getByTestId("review-strip")).toHaveCount(0, { timeout: 5_000 });
  await page.getByTestId("submit-for-review").click();
  await submit.locator('[data-testid="reviewer"][data-name="Ana Reviewer"]').check();
  await submit.getByTestId("save-not-modelled-tick").check();
  await submit.getByTestId("submit-review").click();
  await review.reload();
  await review.getByTestId("approve").click();
  await expect(review.getByTestId("review-strip")).toHaveAttribute("data-status", "approved");
  await expect(page.getByTestId("save-approved")).toHaveCount(0);
  await review.getByTestId("save-approved").click();
  await review.getByTestId("save-version-dialog").getByTestId("save-version-submit").click();
  await expect(review.getByTestId("revision-status")).toContainText("B · Working · last saved A");
  await other.close();
  expect(MOCK_URL).toBeTruthy();
});

test("F09 §4 withdraw a review to change the version (BR-23)", async ({ page }) => {
  const { lead, approver, url } = await approvalOrg();
  await signInAsUser(page, lead);
  await page.goto(url);
  const revision = (await apiAs<{ currentRevision: { id: string } }>(lead, "GET", `/boqs/${url.split("/").pop()}`)).currentRevision.id;
  await apiAs(lead, "POST", `/revisions/${revision}/submit`, { reviewerIds: [approver.id], notModelledConfirmed: true });
  await page.reload();
  await expect(page.getByTestId("review-strip")).toHaveAttribute("data-status", "in_review");
  await page.getByTestId("withdraw-review").click();
  await page.getByTestId("withdraw-confirm").click();
  await expect(page.getByTestId("review-strip")).toHaveCount(0);
  await expect(page.getByTestId("generate")).toBeVisible();
});

test("F02-AC5: the approver's dashboard shows the review request in Needs you within 5 seconds, without a reload", async ({ page }) => {
  const { lead, approver, url } = await approvalOrg();
  await signInAsUser(page, approver);
  await page.goto(url.split("/projects/")[0]!);
  await expect(page.getByTestId("needs-you")).toBeVisible();
  await expect(page.locator('[data-testid="needs-you-item"][data-kind="review_requested"]')).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-realtime", "open");

  const boq = await apiAs<{ currentRevision: { id: string } }>(lead, "GET", `/boqs/${url.split("/boqs/")[1]}`);
  const submitted = Date.now();
  await apiAs(lead, "POST", `/revisions/${boq.currentRevision.id}/submit`, { reviewerIds: [approver.id], notModelledConfirmed: true });
  const item = page.locator('[data-testid="needs-you-item"][data-kind="review_requested"]');
  await expect(item).toContainText("Review Tender BoQ", { timeout: 5_000 });
  expect(Date.now() - submitted).toBeLessThan(5_000);
});
