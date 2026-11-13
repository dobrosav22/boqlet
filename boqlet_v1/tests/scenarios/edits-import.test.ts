import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Schemas } from "@ifc-boq/api";
import { API_URL, client } from "../support/env";
import { duplexBytes, uploadVersion, waitForVersion } from "../support/models";
import { signUp, uniqueEmail, type TestUser } from "../support/users";

/**
 * F12 "Editing in Excel and importing back" (FE-037, P20; the round-trip fake until EN-006): export the
 * Duplex BoQ, edit it as a person would (openpyxl through the engine's Python), import it: exactly the
 * edits made, nothing applied until they are applied through `applyLineEdits`.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(HERE, "..", "..", "engine");
const python = process.env.IFC_BOQ_PYTHON ?? (existsSync(path.join(ENGINE, ".venv", "Scripts", "python.exe")) ? path.join(ENGINE, ".venv", "Scripts", "python.exe") : path.join(ENGINE, ".venv", "bin", "python"));
const EDIT = path.resolve(HERE, "..", "support", "edit_boq_xlsx.py");
const tmp = mkdtempSync(path.join(os.tmpdir(), "boqlet-edits-import-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const slug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

let owner: TestUser;
let boq: Schemas["Boq"];
let systemId: string;

const api = () => client(owner.token);

async function job(jobId: string) {
  const deadline = Date.now() + 120_000;
  for (;;) {
    const { data } = await api().GET("/jobs/{jobId}", { params: { path: { jobId } } });
    if (data && data.status !== "queued" && data.status !== "running") return data;
    if (Date.now() > deadline) throw new Error(`job ${jobId} did not finish`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function exported(file: string) {
  const { data: started } = await api().POST("/runs/{runId}/exports", { params: { path: { runId: boq.currentRevision.currentRun!.id } }, body: { format: "xlsx", groupBy: systemId } });
  const done = await job(started!.id);
  const exportId = (done.output as { exportId: string }).exportId;
  const res = await fetch(`${API_URL}/exports/${exportId}/download`, { headers: { Authorization: `Bearer ${owner.token}` } });
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

async function importFile(file: string) {
  const form = new FormData();
  form.append("file", new Blob([readFileSync(file)]), path.basename(file));
  const res = await fetch(`${API_URL}/revisions/${boq.currentRevision.id}/edits-import`, { method: "POST", headers: { Authorization: `Bearer ${owner.token}` }, body: form });
  expect(res.status).toBe(202);
  const done = await job(((await res.json()) as { id: string }).id);
  expect(done.type).toBe("import_boq_edits");
  const { data, response, error } = await api().GET("/jobs/{jobId}/edits-import-report", { params: { path: { jobId: done.id } } });
  expect(response.status, JSON.stringify(error)).toBe(200);
  return { report: data!, output: done.output };
}

beforeAll(async () => {
  owner = await signUp("Import Owner", uniqueEmail("import"));
  const { data: org } = await api().POST("/orgs", { body: { name: "Import Firm", slug: slug("import") } });
  const { data: project } = await api().POST("/orgs/{orgId}/projects", { params: { path: { orgId: org!.id } }, body: { name: "Duplex" } });
  const { data: model } = await api().POST("/projects/{projectId}/models", { params: { path: { projectId: project!.id } }, body: { name: "Architecture", discipline: "architecture" } });
  const version = await uploadVersion(owner, model!.id, await duplexBytes(), "Duplex_A.ifc");
  expect((await waitForVersion(owner, version.id)).status).toBe("ready");
  const { data: presets } = await api().GET("/orgs/{orgId}/presets", { params: { path: { orgId: org!.id }, query: { kind: "classification" } } });
  const codes = presets!.find((p) => p.slug === "acme-cost-codes")!;
  const created = (await api().POST("/projects/{projectId}/boqs", { params: { path: { projectId: project!.id } }, body: { name: "Tender", inputs: { classificationVersionIds: [codes.latestPublishedVersion!.id] } } })).data!;
  const { data: started } = await api().POST("/revisions/{revisionId}/runs", { params: { path: { revisionId: created.currentRevision.id } } });
  await job(started!.job.id);
  boq = (await api().GET("/boqs/{boqId}", { params: { path: { boqId: created.id } } })).data!;
  systemId = boq.currentRevision.currentRun!.classifications![0]!.id;
}, 300_000);

describe("edits import (F12-AC4)", () => {
  it("an unedited export imports as nothing to apply", async () => {
    const file = path.join(tmp, "same.xlsx");
    await exported(file);
    const { report, output } = await importFile(file);
    expect(report).toEqual({ overrides: [], manualItems: [], problems: [] });
    expect(output).toMatchObject({ importReport: { overrides: 0, manualItems: 0, problems: 0 } });
  });

  it("one quantity changed, one row moved, one deleted, one added: exactly one edit of each kind", async () => {
    const file = path.join(tmp, "edited.xlsx");
    await exported(file);
    const res = spawnSync(python, [EDIT, file], { encoding: "utf8", env: { ...process.env, PYTHONUTF8: "1" } });
    expect(res.status, res.stderr).toBe(0);
    const done = JSON.parse(res.stdout) as { quantity: { key: string; from: number }; moved: { key: string; to: string }; deleted: { key: string }; added: { description: string; unit: string; quantity: number } };
    const { report } = await importFile(file);
    expect(report.problems).toEqual([]);
    expect(report.overrides.map((o) => o.change).sort()).toEqual(["excluded", "moved", "quantity"]);
    expect(report.overrides.find((o) => o.change === "quantity")!.edit).toEqual({ lineKey: done.quantity.key, quantity: done.quantity.from * 2 });
    expect(report.overrides.find((o) => o.change === "moved")!.edit).toEqual({ lineKey: done.moved.key, codes: { [systemId]: done.moved.to } });
    expect(report.overrides.find((o) => o.change === "excluded")!.edit).toEqual({ lineKey: done.deleted.key, excluded: true });
    expect(report.manualItems).toHaveLength(1);
    expect(report.manualItems[0]!.item!.item).toMatchObject({ kind: "other", description: done.added.description, unit: done.added.unit, quantity: done.added.quantity });
    expect(Object.keys(report.manualItems[0]!.item!.codes ?? {})).toEqual([systemId]);

    // Nothing applied yet; applying the reviewed edits (with reasons where F06 §6 asks) makes them line edits.
    expect((await api().GET("/boqs/{boqId}/overrides", { params: { path: { boqId: boq.id } } })).data).toEqual([]);
    const applied = await api().POST("/boqs/{boqId}/overrides/batch", {
      params: { path: { boqId: boq.id } },
      body: {
        overrides: report.overrides.map((o) => ({ ...o.edit, ...(o.change === "quantity" || o.change === "excluded" ? { reason: "From the Excel review" } : {}) })),
        manualItems: report.manualItems.map((m) => m.item!),
      },
    });
    expect(applied.response.status).toBe(200);
    expect(applied.data!.overrides).toHaveLength(3);
    expect(applied.data!.manualItems).toHaveLength(1);
    expect((await api().GET("/boqs/{boqId}", { params: { path: { boqId: boq.id } } })).data!.currentRevision.pendingChanges).toEqual(["adjustments"]);
  });

  it("a file of another BoQ, or not a workbook, is reported, never applied", async () => {
    const other = (await api().POST("/projects/{projectId}/boqs", { params: { path: { projectId: boq.projectId } }, body: { name: "Other" } })).data!;
    const file = path.join(tmp, "other.xlsx");
    await exported(file);
    const form = new FormData();
    form.append("file", new Blob([readFileSync(file)]), "other.xlsx");
    // The other BoQ has no run: refused before reading.
    expect((await fetch(`${API_URL}/revisions/${other.currentRevision.id}/edits-import`, { method: "POST", headers: { Authorization: `Bearer ${owner.token}` }, body: form })).status).toBe(409);
    writeFileSync(path.join(tmp, "junk.xlsx"), "not a workbook");
    const { report } = await importFile(path.join(tmp, "junk.xlsx"));
    expect(report.overrides).toEqual([]);
    expect(report.problems[0]!.message).toMatch(/not an Excel workbook/);
  });
});
