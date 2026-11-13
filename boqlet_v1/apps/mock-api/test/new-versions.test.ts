import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** F08 §1 in the mock (FE-029) without the engine: who is told of a new model version, and "Reopen to update". */
const tmp = mkdtempSync(path.join(os.tmpdir(), "boqlet-new-versions-"));
process.env.MOCK_DATA_DIR = tmp;

const { createApp } = await import("../src/app.js");
const { SEED, SEED_PROJECTS } = await import("../src/seed.js");
const { db } = await import("../src/store.js");
const { newId } = await import("../src/ids.js");
const { announceNewModelVersion } = await import("../src/handlers/boqs.js");

let app: Awaited<ReturnType<typeof createApp>>;
const api = (p: string, userId: string, init: { method?: string; body?: unknown } = {}) =>
  app.request(`http://localhost:4010/api/v1${p}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer mock:${userId}`, ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });

/** A model with a ready v1 in the seeded Duplex project, and a BoQ whose working version uses it. */
function setup(boqStatus: "working" | "confirmed" = "working") {
  const at = new Date().toISOString();
  const project = db().projects.find((p) => p.id === SEED_PROJECTS.duplex)!;
  const modelId = newId();
  db().models.push({ id: modelId, projectId: project.id, name: `Arch ${modelId.slice(0, 4)}`, discipline: "architecture", archived: false, createdAt: at });
  const version = (number: number) => {
    const id = newId();
    db().modelVersions.push({ id, modelId, number, fileName: `v${number}.ifc`, sizeBytes: 1, status: "ready", parseJobId: null, identicalToVersion: null, uploadedBy: SEED.users.marko, uploadedAt: at, blobKey: `x/${id}` });
    return id;
  };
  const v1 = version(1);
  const id = newId();
  const saved = newId();
  const working = newId();
  const inputs = { models: [{ modelId, modelVersionId: v1, discipline: "architecture" }], ruleSetVersionId: project.defaults.ruleSetVersionId!, classificationVersionIds: [], dictionaryVersionIds: [], federationVersionId: null, resolutionVersionId: null };
  db().boqs.push({ id, projectId: project.id, name: `Tender ${id.slice(0, 4)}`, status: boqStatus, currentRevisionId: boqStatus === "confirmed" ? saved : working, latestIssuedRevisionId: saved, archived: false, createdBy: SEED.users.olivia, createdAt: at, updatedAt: at });
  db().revisions.push({ id: saved, boqId: id, number: 1, status: "issued", inputs: structuredClone(inputs), currentRunId: null, basedOnRevisionId: null, createdAt: at });
  if (boqStatus === "working") db().revisions.push({ id: working, boqId: id, number: 2, status: "draft", inputs: structuredClone(inputs), currentRunId: null, basedOnRevisionId: saved, createdAt: at });
  return { id, modelId, saved, v2: () => version(2) };
}

const toldAbout = (boqId: string) => db().notifications.filter((n) => n.kind === "boq.new_version_available" && n.entityId === boqId).map((n) => n.userId);

beforeAll(async () => {
  app = await createApp({ reseed: true });
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("new model version available (F08 §1, F13)", () => {
  it("tells the project's leads and estimators once per BoQ, not approvers or viewers", async () => {
    const { id, modelId, v2 } = setup();
    v2();
    announceNewModelVersion(modelId, 2, "Arch");
    const told = toldAbout(id);
    expect(told).toContain(SEED.users.marko);
    expect(told).toContain(SEED.users.olivia); // org owner: a lead everywhere
    expect(told).not.toContain(SEED.users.ana);
    expect(told).not.toContain(SEED.users.victor);
    expect(new Set(told).size).toBe(told.length);
    const boq = (await (await api(`/boqs/${id}`, SEED.users.victor)).json()) as { newModelVersionsAvailable: boolean };
    expect(boq.newModelVersionsAvailable).toBe(true);
  });

  it("leaves BoQs already on that version, and archived BoQs, alone", () => {
    const { id, modelId } = setup();
    announceNewModelVersion(modelId, 1, "Arch");
    expect(toldAbout(id)).toEqual([]);
    const archived = setup();
    db().boqs.find((b) => b.id === archived.id)!.archived = true;
    archived.v2();
    announceNewModelVersion(archived.modelId, 2, "Arch");
    expect(toldAbout(archived.id)).toEqual([]);
  });
});

describe("reopen a confirmed BoQ (F09 §6, F08 §1 \"Reopen to update\")", () => {
  it("is the lead's, needs a reason, and only for a confirmed BoQ", async () => {
    const { id } = setup("confirmed");
    expect((await api(`/boqs/${id}/reopen`, SEED.users.marko, { method: "POST", body: { reason: "New model" } })).status).toBe(403);
    expect((await api(`/boqs/${id}/reopen`, SEED.users.olivia, { method: "POST", body: { reason: " " } })).status).toBe(400);
    const working = setup("working");
    const refused = await api(`/boqs/${working.id}/reopen`, SEED.users.olivia, { method: "POST", body: { reason: "New model" } });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ code: "invalid_transition" });
  });

  it("opens a new working version from the last saved one, which can then take the new version", async () => {
    const { id, saved, v2 } = setup("confirmed");
    const v2Id = v2();
    const blocked = (await (await api(`/boqs/${id}`, SEED.users.olivia)).json()) as { currentRevision: { permissions: Record<string, boolean> } };
    expect(blocked.currentRevision.permissions).toMatchObject({ editBoqs: false, reopen: true });
    const res = await api(`/boqs/${id}/reopen`, SEED.users.olivia, { method: "POST", body: { reason: "Architecture v2 arrived" } });
    expect(res.status).toBe(200);
    const boq = (await res.json()) as { status: string; newModelVersionsAvailable: boolean; currentRevision: { id: string; number: number; label: string; status: string; basedOnRevisionId: string; inputs: { models: { modelId: string; discipline: string }[] }; permissions: Record<string, boolean> } };
    expect(boq).toMatchObject({ status: "working", newModelVersionsAvailable: true });
    expect(boq.currentRevision).toMatchObject({ number: 2, label: "B", status: "draft", basedOnRevisionId: saved });
    expect(boq.currentRevision.permissions.editBoqs).toBe(true);
    const models = boq.currentRevision.inputs.models.map((m) => ({ modelId: m.modelId, modelVersionId: v2Id, discipline: m.discipline }));
    expect((await api(`/revisions/${boq.currentRevision.id}`, SEED.users.marko, { method: "PATCH", body: { inputs: { models } } })).status).toBe(200);
    expect(db().audit.some((a) => a.action === "boq.reopened" && a.subjectId === id && (a.data as { reason?: string }).reason === "Architecture v2 arrived")).toBe(true);
  });
});
