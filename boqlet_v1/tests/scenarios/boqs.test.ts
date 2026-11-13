import { gunzipSync } from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";
import type { Schemas } from "@ifc-boq/api";
import { API_URL, client } from "../support/env";
import { duplexBytes, uploadVersion, waitForVersion } from "../support/models";
import { signUp, uniqueEmail, user, type TestUser } from "../support/users";

/** F04 BoQs and runs, and the Run and Job state machines, through the API only. */

type Run = Schemas["Run"];
const slug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

let owner: TestUser;
let orgId: string;
let projectId: string;
const models: { modelId: string; versionId: string }[] = [];

async function newModel(name: string) {
  const { data, response } = await client(owner.token).POST("/projects/{projectId}/models", { params: { path: { projectId } }, body: { name, discipline: "architecture" } });
  expect(response.status).toBe(201);
  return data!;
}

async function newBoq(name: string, body: Record<string, unknown> = {}) {
  const res = await client(owner.token).POST("/projects/{projectId}/boqs", { params: { path: { projectId } }, body: { name, ...body } });
  expect(res.response.status).toBe(201);
  return res.data!;
}

/** Polls a run until it is finished (complete, needs_input, failed or cancelled). */
async function waitForRun(runId: string, timeoutMs = 120_000): Promise<Run> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { data } = await client(owner.token).GET("/runs/{runId}", { params: { path: { runId } } });
    if (data && data.status !== "queued" && data.status !== "running") return data;
    if (Date.now() > deadline) throw new Error(`run ${runId} still ${data?.status}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function generate(revisionId: string) {
  const res = await client(owner.token).POST("/revisions/{revisionId}/runs", { params: { path: { revisionId } } });
  expect(res.response.status).toBe(202);
  return res.data!;
}

/** The full BoqResult of a run (302 to a signed, gzipped JSON). */
async function result(runId: string) {
  const res = await fetch(`${API_URL}/runs/${runId}/result`, { headers: { Authorization: `Bearer ${owner.token}` }, redirect: "manual" });
  expect(res.status).toBe(302);
  const blob = await fetch(res.headers.get("Location")!);
  expect(blob.ok).toBe(true);
  return JSON.parse(gunzipSync(Buffer.from(await blob.arrayBuffer())).toString("utf8")) as { lines: { key: string; quantity: number | null; codes?: Record<string, unknown> }[] };
}

beforeAll(async () => {
  owner = await signUp("BoQ Owner", uniqueEmail("boqs"));
  const { data: org } = await client(owner.token).POST("/orgs", { body: { name: "BoQ Firm", slug: slug("boqs") } });
  orgId = org!.id;
  const { data: project } = await client(owner.token).POST("/orgs/{orgId}/projects", { params: { path: { orgId } }, body: { name: "Duplex" } });
  projectId = project!.id;
  const bytes = await duplexBytes();
  // Two models with the same file: the second reuses the first parse (BR-08).
  for (const name of ["Architecture", "Architecture copy"]) {
    const model = await newModel(name);
    const version = await uploadVersion(owner, model.id, bytes, "Ifc2x3_Duplex_Architecture.ifc");
    const ready = await waitForVersion(owner, version.id);
    expect(ready.status).toBe("ready");
    models.push({ modelId: model.id, versionId: ready.id });
  }
}, 240_000);

describe("BoQ create and inputs (F04 §1, §2)", () => {
  it("F04-AC1 a new BoQ preselects every model's latest ready version and the project defaults", async () => {
    const { data: project } = await client(owner.token).GET("/projects/{projectId}", { params: { path: { projectId } } });
    const boq = await newBoq("Cost check");
    const rev = boq.currentRevision;
    expect(rev).toMatchObject({ number: 1, label: "A", status: "draft", pendingChanges: [] });
    expect(rev.inputs.models.map((m) => m.modelVersionId).sort()).toEqual(models.map((m) => m.versionId).sort());
    expect(rev.inputs.ruleSetVersionId).toBe(project!.defaults.ruleSetVersionId);
    expect(rev.inputs.dictionaryVersionIds).toEqual(project!.defaults.dictionaryVersionIds);
    expect(rev.inputs.classificationVersionIds).toEqual(project!.defaults.classificationVersionIds);
    expect(rev.currentRun).toBeUndefined();
    expect(boq.status).toBe("working");
    const { data: list } = await client(owner.token).GET("/projects/{projectId}/boqs", { params: { path: { projectId } } });
    expect(list!.some((b) => b.id === boq.id)).toBe(true);
  });

  it("refuses inputs that aren't the project's or aren't published presets of the right kind", async () => {
    const boq = await newBoq("Bad inputs");
    const id = boq.currentRevision.id;
    const wrongKind = await client(owner.token).PATCH("/revisions/{revisionId}", { params: { path: { revisionId: id } }, body: { inputs: { classificationVersionIds: [boq.currentRevision.inputs.ruleSetVersionId] } } });
    expect(wrongKind.response.status).toBe(400);
    expect(wrongKind.error).toMatchObject({ code: "invalid_inputs" });
    const foreign = await client(owner.token).PATCH("/revisions/{revisionId}", {
      params: { path: { revisionId: id } },
      body: { inputs: { models: [{ modelId: "00000000-0000-4000-8000-000000000000", modelVersionId: models[0]!.versionId, discipline: "architecture" }] } },
    });
    expect(foreign.response.status).toBe(400);
  });

  it("maxModelsPerBoq: more models than the plan allows answers 402 (free plan: 2)", async () => {
    const third = await newModel("Third");
    const version = await uploadVersion(owner, third.id, await duplexBytes(), "Ifc2x3_Duplex_Architecture.ifc");
    expect((await waitForVersion(owner, version.id)).status).toBe("ready");
    const res = await client(owner.token).POST("/projects/{projectId}/boqs", { params: { path: { projectId } }, body: { name: "Too many" } });
    expect(res.response.status).toBe(402);
    expect(res.error).toMatchObject({ code: "limit_reached", details: { limit: "maxModelsPerBoq", max: 2 } });
    await client(owner.token).DELETE("/models/{modelId}", { params: { path: { modelId: third.id } } });
  });

  it("a model version that isn't ready can't be generated: 409 model_not_ready", async () => {
    const notes = await newModel("Notes");
    const failed = await uploadVersion(owner, notes.id, new TextEncoder().encode("not a model"), "notes.ifc");
    expect(failed.status).toBe("failed");
    const boq = await newBoq("Not ready", { inputs: { models: [{ modelId: notes.id, modelVersionId: failed.id, discipline: "architecture" }] } });
    const res = await client(owner.token).POST("/revisions/{revisionId}/runs", { params: { path: { revisionId: boq.currentRevision.id } } });
    expect(res.response.status).toBe(409);
    expect(res.error).toMatchObject({ code: "model_not_ready" });
    await client(owner.token).DELETE("/models/{modelId}", { params: { path: { modelId: notes.id } } });
  });
});

describe("Run and Job (F04 §3–5)", () => {
  let boq: Schemas["Boq"];
  let first: Run;

  it("F04-AC2 queued → running → complete or needs_input; the job succeeds and the run becomes current (cached parse, < 10 s)", async () => {
    boq = await newBoq("Tender BoQ", { inputs: { models: [{ modelId: models[0]!.modelId, modelVersionId: models[0]!.versionId, discipline: "architecture" }] } });
    const started = Date.now();
    const { run, job } = await generate(boq.currentRevision.id);
    expect(run.status).toBe("queued");
    expect(job).toMatchObject({ type: "run", subjectType: "run", subjectId: run.id });
    first = await waitForRun(run.id);
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(["complete", "needs_input"]).toContain(first.status);
    expect(first.stats!.lines).toBeGreaterThan(30);
    expect(first.stats!.blockingQuestions).toBeGreaterThanOrEqual(0);
    expect(first.finishedAt).toBeTruthy();
    expect(first.snapshotVersions!.ruleSetVersionId).toBe(boq.currentRevision.inputs.ruleSetVersionId);
    const { data: finishedJob } = await client(owner.token).GET("/jobs/{jobId}", { params: { path: { jobId: job.id } } });
    // A job never needs input (P13): needs_input is the run's state, the job succeeded.
    expect(finishedJob!.status).toBe("succeeded");
    const { data: rev } = await client(owner.token).GET("/revisions/{revisionId}", { params: { path: { revisionId: boq.currentRevision.id } } });
    expect(rev!.currentRun!.id).toBe(run.id);
    expect(rev!.pendingChanges).toEqual([]);
  });

  it("F04-AC3 a run with blocking questions lands in needs_input with the count (no dictionaries: every name is asked)", async () => {
    const asked = await newBoq("Needs input", {
      inputs: { models: [{ modelId: models[0]!.modelId, modelVersionId: models[0]!.versionId, discipline: "architecture" }], dictionaryVersionIds: [] },
    });
    const { run } = await generate(asked.currentRevision.id);
    const done = await waitForRun(run.id);
    expect(done.status).toBe("needs_input");
    expect(done.stats!.blockingQuestions).toBeGreaterThan(0);
  });

  it("F04-AC4 changing an input shows pending changes until the next run", async () => {
    const { data: presets } = await client(owner.token).GET("/orgs/{orgId}/presets", { params: { path: { orgId }, query: { kind: "classification" } } });
    const codes = presets!.find((p) => p.slug === "acme-cost-codes")!;
    const changed = await client(owner.token).PATCH("/revisions/{revisionId}", {
      params: { path: { revisionId: boq.currentRevision.id } },
      body: { inputs: { classificationVersionIds: [codes.latestPublishedVersion!.id] } },
    });
    expect(changed.response.status).toBe(200);
    expect(changed.data!.pendingChanges).toEqual(["inputs.classifications"]);
    const { run } = await generate(boq.currentRevision.id);
    await waitForRun(run.id);
    const { data: rev } = await client(owner.token).GET("/revisions/{revisionId}", { params: { path: { revisionId: boq.currentRevision.id } } });
    expect(rev!.pendingChanges).toEqual([]);
    expect(rev!.currentRun!.id).toBe(run.id);
    expect(rev!.currentRun!.classifications).toEqual([{ id: "acme-cost-codes", name: codes.name }]);
  });

  it("F04-AC5 BR-02 two runs with different classifications have identical quantities per line key", async () => {
    const { data: runs } = await client(owner.token).GET("/revisions/{revisionId}/runs", { params: { path: { revisionId: boq.currentRevision.id } } });
    expect(runs!.length).toBe(2);
    const [withCodes, without] = [runs![0]!, runs![1]!];
    expect(without.id).toBe(first.id);
    const a = await result(without.id);
    const b = await result(withCodes.id);
    const quantities = (r: typeof a) => Object.fromEntries(r.lines.map((l) => [l.key, l.quantity]));
    expect(quantities(b)).toEqual(quantities(a));
    expect(b.lines.some((l) => l.codes && Object.keys(l.codes).length > 0)).toBe(true);
  });

  it("finished runs are immutable; run history lists every run newest first", async () => {
    const { data: again } = await client(owner.token).GET("/runs/{runId}", { params: { path: { runId: first.id } } });
    expect(again).toEqual(first);
    const { data: runs } = await client(owner.token).GET("/revisions/{revisionId}/runs", { params: { path: { revisionId: boq.currentRevision.id } } });
    expect(runs!.map((r) => r.createdAt)).toEqual([...runs!.map((r) => r.createdAt)].sort().reverse());
  });

  it("queued → cancelled by the user; the current run stays", async () => {
    const before = (await client(owner.token).GET("/revisions/{revisionId}", { params: { path: { revisionId: boq.currentRevision.id } } })).data!.currentRun!.id;
    // Runs execute one at a time: the second waits behind the first and is cancelled while queued.
    await generate(boq.currentRevision.id);
    const { run, job } = await generate(boq.currentRevision.id);
    const cancel = await client(owner.token).POST("/jobs/{jobId}/cancel", { params: { path: { jobId: job.id } } });
    expect(cancel.response.status).toBe(200);
    expect((await waitForRun(run.id)).status).toBe("cancelled");
    const { data: cancelledJob } = await client(owner.token).GET("/jobs/{jobId}", { params: { path: { jobId: job.id } } });
    expect(cancelledJob!.status).toBe("cancelled");
    const { data: rev } = await client(owner.token).GET("/revisions/{revisionId}", { params: { path: { revisionId: boq.currentRevision.id } } });
    expect(rev!.currentRun!.id).not.toBe(run.id);
    expect(before).toBeTruthy();
  });

  it("a newer ready model version is flagged on the BoQ (F04 §2)", async () => {
    const v2 = await uploadVersion(owner, models[0]!.modelId, await duplexBytes(), "Duplex_v2.ifc");
    expect((await waitForVersion(owner, v2.id)).status).toBe("ready");
    const { data } = await client(owner.token).GET("/boqs/{boqId}", { params: { path: { boqId: boq.id } } });
    expect(data!.newModelVersionsAvailable).toBe(true);
    expect(data!.currentRevision.inputs.models[0]!.newerVersionAvailable).toBe(v2.number);
    const { data: version } = await client(owner.token).GET("/model-versions/{versionId}", { params: { path: { versionId: models[0]!.versionId } } });
    expect(version!.usedBy!.some((r) => r.boqId === boq.id && r.label === "A")).toBe(true);
    // F08 §1 / FL-3 step 2: the project's leads and estimators are told (F13 `boq.new_version_available`).
    const { data: list } = await client(owner.token).GET("/notifications", { params: { query: { limit: 200 } } });
    const told = list!.items.find((n) => n.kind === "boq.new_version_available" && n.entityId === boq.id);
    expect(told).toMatchObject({ entityType: "boq", params: { boq: boq.name, version: v2.number } });
    expect(told!.url).toContain(`/boqs/${boq.id}`);
  });

  it("\"Use v2\" swaps the newer version into the working version as a pending change (F08 §1)", async () => {
    const before = (await client(owner.token).GET("/boqs/{boqId}", { params: { path: { boqId: boq.id } } })).data!;
    const input = before.currentRevision.inputs.models[0]!;
    const { data: versions } = await client(owner.token).GET("/models/{modelId}/versions", { params: { path: { modelId: input.modelId } } });
    const latest = versions!.find((v) => v.number === input.newerVersionAvailable)!;
    const models = before.currentRevision.inputs.models.map((m) => ({ modelId: m.modelId, modelVersionId: m.modelId === input.modelId ? latest.id : m.modelVersionId, discipline: m.discipline }));
    const swapped = await client(owner.token).PATCH("/revisions/{revisionId}", { params: { path: { revisionId: before.currentRevision.id } }, body: { inputs: { models } } });
    expect(swapped.response.status).toBe(200);
    expect(swapped.data!.pendingChanges).toContain("inputs.models");
    const { data: after } = await client(owner.token).GET("/boqs/{boqId}", { params: { path: { boqId: boq.id } } });
    expect(after!.newModelVersionsAvailable).toBe(false);
    expect(after!.currentRevision.inputs.models[0]!).toMatchObject({ modelVersionId: latest.id, newerVersionAvailable: null });
  });
});

describe("Archive and permissions (F04 §6, permissions.md)", () => {
  it("archive makes a BoQ read-only (409 boq_archived) until the lead restores it", async () => {
    const boq = await newBoq("Variant");
    const archived = await client(owner.token).POST("/boqs/{boqId}/archive", { params: { path: { boqId: boq.id } } });
    expect(archived.data!.archived).toBe(true);
    expect(archived.data!.currentRevision.permissions.editBoqs).toBe(false);
    const write = await client(owner.token).POST("/revisions/{revisionId}/runs", { params: { path: { revisionId: boq.currentRevision.id } } });
    expect(write.response.status).toBe(409);
    expect(write.error).toMatchObject({ code: "boq_archived" });
    const restored = await client(owner.token).PATCH("/boqs/{boqId}", { params: { path: { boqId: boq.id } }, body: { archived: false } });
    expect(restored.data!.archived).toBe(false);
  });

  it("on the seeded Duplex: an estimator creates BoQs; an approver and a viewer can't (403)", async () => {
    const marko = await user("marko");
    const studio = (await client(marko.token).GET("/me")).data!.memberships.find((m) => m.org.slug === "studio-demo")!.org;
    const { data: projects } = await client(marko.token).GET("/orgs/{orgId}/projects", { params: { path: { orgId: studio.id } } });
    const duplex = projects!.find((p) => p.name === "Duplex")!;
    const created = await client(marko.token).POST("/projects/{projectId}/boqs", { params: { path: { projectId: duplex.id } }, body: { name: `Estimator ${Date.now()}` } });
    expect(created.response.status).toBe(201);
    expect(created.data!.currentRevision.permissions).toMatchObject({ editBoqs: true, archive: false });
    for (const who of ["ana", "victor"] as const) {
      const u = await user(who);
      const res = await client(u.token).POST("/projects/{projectId}/boqs", { params: { path: { projectId: duplex.id } }, body: { name: "Nope" } });
      expect(res.response.status).toBe(403);
      const gen = await client(u.token).POST("/revisions/{revisionId}/runs", { params: { path: { revisionId: created.data!.currentRevision.id } } });
      expect(gen.response.status).toBe(403);
      const read = await client(u.token).GET("/boqs/{boqId}", { params: { path: { boqId: created.data!.id } } });
      expect(read.response.status).toBe(200);
    }
    const archive = await client(marko.token).POST("/boqs/{boqId}/archive", { params: { path: { boqId: created.data!.id } } });
    expect(archive.response.status).toBe(403);
  });
});
