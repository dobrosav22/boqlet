import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { apiAs, generatedDuplexBoq, MOCK_URL, signInAs, type DevUser } from "./helpers";

/**
 * FE-035: FL-3 "New model version → next saved version" end to end, v1 criteria 3, 4 and 5 on the mock.
 * Until EN-008 brings the Duplex v1/v2 pair, v2 is made here from v1 by renaming one wall (a valid IFC
 * that parses to the same geometry): the change report must list exactly that element, and the lines it
 * feeds only if their numbers moved.
 */

const DUPLEX = path.resolve(__dirname, "..", "..", "..", "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");
const WALL = "2O2Fr$t4X7Zf8NOew3FNld";
test.describe.configure({ timeout: 360_000 });

async function waitFor<T>(fn: () => Promise<T | undefined>, what: string, ms = 180_000): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v !== undefined) return v;
    if (Date.now() > deadline) throw new Error(`timed out: ${what}`);
    await new Promise((r) => setTimeout(r, 400));
  }
}

/** Duplex v2: the same file with one wall renamed. */
async function duplexV2(): Promise<Uint8Array> {
  const text = await readFile(DUPLEX, "latin1");
  const at = text.indexOf(`IFCWALLSTANDARDCASE('${WALL}'`);
  const name = text.indexOf(":138584',", at);
  if (at < 0 || name < 0) throw new Error("the wall to rename isn't in the fixture");
  return new Uint8Array(Buffer.from(text.slice(0, name) + ":138584 moved'," + text.slice(name + ":138584',".length), "latin1"));
}

async function uploadV2(user: DevUser, modelId: string) {
  const bytes = await duplexV2();
  const { version, upload } = await apiAs<{ version: { id: string }; upload: { method: string; url: string; headers: Record<string, string> } }>(user, "POST", `/models/${modelId}/versions`, { fileName: "Duplex_A_v2.ifc", sizeBytes: bytes.byteLength, note: "Wall renamed" });
  await fetch(upload.url, { method: upload.method, headers: upload.headers, body: new Blob([bytes as BlobPart]) });
  await apiAs(user, "POST", `/model-versions/${version.id}/complete`, {});
  await waitFor(async () => ((await apiAs<{ status: string }>(user, "GET", `/model-versions/${version.id}`)).status === "ready" ? true : undefined), "v2 parse");
}

test("FL-3 / v1 criteria 3–5: answer, save A, take v2, no question asked again, the change report lists the change, save B, confirm, reopen", async ({ page }) => {
  const { url, projectId, olivia, run } = await generatedDuplexBoq(new Uint8Array(await readFile(DUPLEX)));
  const boqId = url.split("/").pop()!;

  // Answer every open question the first run asked (as the estimator would), then generate again.
  const questions = await apiAs<{ id: string; kind: string; blocking: boolean; suggestion?: string | number; decision?: unknown }[]>(olivia, "GET", `/runs/${run.id}/questions`);
  const open = questions.filter((q) => !q.decision && q.suggestion !== undefined);
  if (open.length) await apiAs(olivia, "POST", `/projects/${projectId}/decisions`, { decisions: open.map((q) => ({ questionId: q.id, kind: q.kind, answer: q.suggestion })) });

  await signInAs(page, "olivia");
  await page.goto(url);
  if (open.length) {
    await page.getByTestId("generate").click();
    await expect(page.getByTestId("pending-changes")).toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByTestId("answers-pending")).toHaveCount(0);
  }
  await expect(page.getByTestId("current-run")).toBeVisible();

  // Version A.
  await page.getByTestId("save-version").click();
  const dialog = page.getByTestId("save-version-dialog");
  await dialog.getByTestId("version-note").fill("Version A");
  await dialog.getByTestId("save-not-modelled-tick").check();
  await dialog.getByTestId("save-version-submit").click();
  await expect(page.getByTestId("revision-status")).toContainText("B · Working · last saved A");

  // v1 criterion 5: a saved version can't be changed by anyone, the org owner included.
  const revisions = await apiAs<{ id: string; label: string; status: string; frozen?: { runId: string } }[]>(olivia, "GET", `/boqs/${boqId}/revisions`);
  const a = revisions.find((r) => r.label === "A")!;
  const locked = await fetch(`${MOCK_URL}/api/v1/revisions/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${olivia.token}` }, body: JSON.stringify({ inputs: { classificationVersionIds: [] } }) });
  expect(locked.status).toBe(409);
  expect(((await locked.json()) as { code: string }).code).toBe("revision_locked");

  // FL-3 steps 1–3: v2 arrives; "Use v2" in the working version; generate.
  const [model] = await apiAs<{ id: string }[]>(olivia, "GET", `/projects/${projectId}/models`);
  await uploadV2(olivia, model!.id);
  await expect(page.getByTestId("new-model-version")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("use-newer-version-Architecture").click();
  await expect(page.getByTestId("pending-changes")).toContainText("models");
  await page.getByTestId("generate").click();
  await expect(page.getByTestId("pending-changes")).toHaveCount(0, { timeout: 90_000 });
  await expect(page.getByTestId("current-run")).toHaveAttribute("data-run", /.+/);
  const runB = await page.getByTestId("current-run").getAttribute("data-run");
  expect(runB).not.toBe(a.frozen!.runId);

  // FL-3 step 4 / criterion 3: the questions answered for A aren't asked again.
  const asked = await apiAs<{ id: string; decision?: unknown }[]>(olivia, "GET", `/runs/${runB}/questions`);
  for (const q of open) expect(asked.find((x) => x.id === q.id)?.decision ?? null, `question ${q.id} asked again`).not.toBeNull();
  await expect(page.getByTestId("answers-pending")).toHaveCount(0);

  // FL-3 step 5 / criterion 3: the change report against A opens by itself and lists exactly the change.
  await page.getByTestId("tab-changes").click();
  await expect(page.getByTestId("changes-report")).toBeVisible({ timeout: 10_000 });
  const diffId = await page.getByTestId("changes-report").getAttribute("data-diff");
  const diff = await apiAs<{ summary: Record<string, number> }>(olivia, "GET", `/diffs/${diffId}`);
  expect(diff.summary).toMatchObject({ elementsAdded: 0, elementsRemoved: 0, elementsChanged: 1, questionsNew: 0 });
  await expect(page.getByTestId("summary-elementsChanged")).toHaveAttribute("data-value", "1");
  await expect(page.getByTestId("changes-inputs")).toContainText("model versions");
  const element = page.getByTestId("change-element");
  await expect(element).toHaveCount(1);
  await expect(element).toContainText(WALL);
  await expect(element).toContainText("name");
  const { items: lineChanges } = await apiAs<{ items: { lineKey: string; causes: string[] }[] }>(olivia, "GET", `/diffs/${diffId}/lines?limit=1000`);
  await page.getByTestId("changes-filter-threshold").fill("0");
  await expect(page.getByTestId("change-line")).toHaveCount(lineChanges.length);
  for (const l of lineChanges) expect(l.causes).toContain("elements_changed");

  // v1 criterion 4 (automated part): a line's elements in 3D and its formula, parameters and shares, one click each.
  await page.getByTestId("tab-sheet").click();
  await page.locator('[data-testid="sheet-line"][data-source="measured"]').first().click();
  const detail = page.getByTestId("line-detail");
  await expect(detail.getByTestId("detail-formula")).toBeVisible();
  await expect(detail.getByTestId("detail-params")).toBeVisible();
  await expect(detail.getByTestId("detail-share").first()).toBeVisible();
  await detail.getByTestId("show-in-3d").click();
  await expect(page.getByTestId("viewer")).toHaveAttribute("data-focus", /^[1-9]/, { timeout: 30_000 });

  // FL-3 step 6: version B, then confirm (nothing new since B), writes refused, reopen.
  await page.getByTestId("tab-sheet").click();
  await page.getByTestId("save-version").click();
  await dialog.getByTestId("save-not-modelled-tick").check();
  await dialog.getByTestId("save-version-submit").click();
  await expect(page.getByTestId("revision-status")).toContainText("C · Working · last saved B");
  await page.getByTestId("boq-menu").click();
  await page.getByTestId("confirm-boq").click();
  await dialog.getByTestId("save-not-modelled-tick").check();
  await dialog.getByTestId("save-version-submit").click();
  await expect(page.getByTestId("revision-status")).toContainText("B · Saved");
  const refused = await fetch(`${MOCK_URL}/api/v1/boqs/${boqId}/overrides`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${olivia.token}` }, body: JSON.stringify({ lineKey: lineChanges[0]?.lineKey ?? "x", description: "x" }) });
  expect(((await refused.json()) as { code: string }).code).toBe("boq_confirmed");
  await page.getByTestId("reopen-boq").click();
  await page.getByTestId("reopen-reason").fill("Next design stage");
  await page.getByTestId("reopen-submit").click();
  await expect(page.getByTestId("revision-status")).toContainText("C · Working · last saved B");
});
