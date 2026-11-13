import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** F06 §6–7 in the mock (FE-011) without the engine: who may edit lines, and when. */
const tmp = mkdtempSync(path.join(os.tmpdir(), "boqlet-adjustments-"));
process.env.MOCK_DATA_DIR = tmp;

const { createApp } = await import("../src/app.js");
const { SEED, SEED_PROJECTS } = await import("../src/seed.js");
const { db } = await import("../src/store.js");
const { newId } = await import("../src/ids.js");

let app: Awaited<ReturnType<typeof createApp>>;
const api = (p: string, userId: string, init: { method?: string; body?: unknown } = {}) =>
  app.request(`http://localhost:4010/api/v1${p}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer mock:${userId}`, ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });

function boq(status: "draft" | "issued" = "draft") {
  const at = new Date().toISOString();
  const project = db().projects.find((p) => p.id === SEED_PROJECTS.duplex)!;
  const id = newId();
  const revisionId = newId();
  const inputs = { models: [], ruleSetVersionId: project.defaults.ruleSetVersionId!, classificationVersionIds: [], dictionaryVersionIds: [], federationVersionId: null, resolutionVersionId: null };
  db().boqs.push({ id, projectId: project.id, name: "Edits", status: "working", currentRevisionId: revisionId, latestIssuedRevisionId: null, archived: false, createdBy: SEED.users.olivia, createdAt: at, updatedAt: at });
  db().revisions.push({ id: revisionId, boqId: id, number: 1, status, inputs, currentRunId: null, basedOnRevisionId: null, createdAt: at });
  return id;
}

const edit = { lineKey: "walls|ext", description: "Outer walls" };
const manual = { item: { id: "manual-1", kind: "other", description: "Hoarding", unit: "m", quantity: 3 } };

beforeAll(async () => {
  app = await createApp({ reseed: true });
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("line edits and manual lines (F06 §6–7)", () => {
  it("are for leads and estimators; approvers and viewers read them", async () => {
    const id = boq();
    for (const who of [SEED.users.ana, SEED.users.victor]) {
      expect((await api(`/boqs/${id}/overrides`, who, { method: "POST", body: edit })).status).toBe(403);
      expect((await api(`/boqs/${id}/manual-items`, who, { method: "POST", body: manual })).status).toBe(403);
    }
    expect((await api(`/boqs/${id}/overrides`, SEED.users.marko, { method: "POST", body: edit })).status).toBe(200);
    expect((await api(`/boqs/${id}/manual-items`, SEED.users.marko, { method: "POST", body: manual })).status).toBe(201);
    const list = (await (await api(`/boqs/${id}/overrides`, SEED.users.victor)).json()) as { lineKey: string; createdBy: { name: string } }[];
    expect(list).toEqual([expect.objectContaining({ lineKey: edit.lineKey, createdBy: expect.objectContaining({ name: "Marko Estimator" }) })]);
    const again = await api(`/boqs/${id}/manual-items`, SEED.users.marko, { method: "POST", body: manual });
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ code: "duplicate_id" });
  });

  it("are refused on an archived BoQ and on a saved version", async () => {
    const archived = boq();
    db().boqs.find((b) => b.id === archived)!.archived = true;
    const res = await api(`/boqs/${archived}/overrides`, SEED.users.marko, { method: "POST", body: edit });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "boq_archived" });
    const saved = boq("issued");
    expect(await (await api(`/boqs/${saved}/manual-items`, SEED.users.marko, { method: "POST", body: manual })).json()).toMatchObject({ code: "revision_locked" });
  });
});
