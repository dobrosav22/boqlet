import { beforeAll, describe, expect, it } from "vitest";
import type { Schemas } from "@ifc-boq/api";
import { client } from "../support/env";
import { duplexBytes, uploadVersion, waitForVersion } from "../support/models";
import { signUp, uniqueEmail, type TestUser } from "../support/users";

/** F08 §3–7 change report (FE-030): compare two runs, the cached diff, lines, elements, the export. */

const slug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
type Api = ReturnType<typeof client>;

let owner: TestUser;
let api: Api;
let boq: Schemas["Boq"];
let modelId: string;
let runA: Schemas["Run"];
let runB: Schemas["Run"];
let edited: Schemas["RunLine"];

async function finished(runId: string) {
  const deadline = Date.now() + 120_000;
  for (;;) {
    const { data } = await api.GET("/runs/{runId}", { params: { path: { runId } } });
    if (data && data.status !== "queued" && data.status !== "running") return data;
    if (Date.now() > deadline) throw new Error(`run ${runId} did not finish`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function generate() {
  const { data } = await api.POST("/revisions/{revisionId}/runs", { params: { path: { revisionId: boq.currentRevision.id } } });
  return finished(data!.run.id);
}

async function job(jobId: string) {
  const deadline = Date.now() + 60_000;
  for (;;) {
    const { data } = await api.GET("/jobs/{jobId}", { params: { path: { jobId } } });
    if (data && data.status !== "queued" && data.status !== "running") return data;
    if (Date.now() > deadline) throw new Error(`job ${jobId} did not finish`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

/** Compares and waits: the diff (202 then the job's diffId), or the cached one (200). */
async function compare(to: string, from: string) {
  const res = await api.POST("/runs/{runId}/compare", { params: { path: { runId: to } }, body: { againstRunId: from } });
  if (res.response.status === 200) return { status: 200, diff: res.data as Schemas["RunDiff"] };
  expect(res.response.status).toBe(202);
  const done = await job((res.data as unknown as Schemas["Job"]).id);
  expect(done).toMatchObject({ status: "succeeded", type: "diff" });
  const diffId = (done.output as { diffId: string }).diffId;
  return { status: 202, diff: (await api.GET("/diffs/{diffId}", { params: { path: { diffId } } })).data! };
}

async function allLines(diffId: string, query: Record<string, unknown> = {}) {
  const out: Schemas["LineChange"][] = [];
  let cursor: string | undefined;
  do {
    const { data } = await api.GET("/diffs/{diffId}/lines", { params: { path: { diffId }, query: { limit: 50, ...query, ...(cursor ? { cursor } : {}) } } });
    out.push(...data!.items);
    cursor = data!.nextCursor ?? undefined;
  } while (cursor);
  return out;
}

beforeAll(async () => {
  owner = await signUp("Changes Owner", uniqueEmail("changes"));
  api = client(owner.token);
  const { data: org } = await api.POST("/orgs", { body: { name: "Changes Firm", slug: slug("changes") } });
  const { data: project } = await api.POST("/orgs/{orgId}/projects", { params: { path: { orgId: org!.id } }, body: { name: "Duplex" } });
  const { data: model } = await api.POST("/projects/{projectId}/models", { params: { path: { projectId: project!.id } }, body: { name: "Architecture", discipline: "architecture" } });
  modelId = model!.id;
  const version = await uploadVersion(owner, modelId, await duplexBytes(), "Duplex_A.ifc");
  expect((await waitForVersion(owner, version.id)).status).toBe("ready");
  const { data: presets } = await api.GET("/orgs/{orgId}/presets", { params: { path: { orgId: org!.id }, query: { kind: "classification" } } });
  const codes = presets!.find((p) => p.slug === "acme-cost-codes")!.latestPublishedVersion!.id;
  boq = (await api.POST("/projects/{projectId}/boqs", { params: { path: { projectId: project!.id } }, body: { name: "Tender", inputs: { classificationVersionIds: [codes] } } })).data!;
  runA = await generate();
  const { data: lines } = await api.GET("/runs/{runId}/lines", { params: { path: { runId: runA.id } } });
  edited = lines!.items.find((l) => l.quantity && l.quantity > 1)!;
  expect((await api.POST("/boqs/{boqId}/overrides", { params: { path: { boqId: boq.id } }, body: { lineKey: edited.key, quantity: edited.quantity! * 2, reason: "Site measure" } })).response.status).toBe(200);
  runB = await generate();
}, 300_000);

describe("compare two runs (F08 §3, §6)", () => {
  it("a line edit shows as one changed line with its cause; the same model version has no element changes", async () => {
    const { diff, status } = await compare(runB.id, runA.id);
    expect(status).toBe(202);
    expect(diff).toMatchObject({ fromRunId: runA.id, toRunId: runB.id });
    expect(diff.summary).toMatchObject({ linesChanged: 1, linesAdded: 0, linesRemoved: 0, elementsAdded: 0, elementsRemoved: 0, elementsChanged: 0, inputsChanged: ["adjustments"], guidChurnWarning: false });
    expect(diff.summary.linesUnchanged).toBe(runA.stats!.lines! - 1);
    const lines = await allLines(diff.id);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ lineKey: edited.key, change: "changed", before: { quantity: edited.quantity }, after: { quantity: edited.quantity! * 2 }, deltaPct: 100, causes: ["override_changed"] });
    expect(lines[0]!.before!.codes).toBeTruthy();
    expect((await api.GET("/diffs/{diffId}/elements", { params: { path: { diffId: diff.id } } })).data!.items).toEqual([]);
  });

  it("the second compare answers the cached diff (200), quickly (F08-AC4)", async () => {
    const first = await compare(runB.id, runA.id);
    const started = Date.now();
    const again = await compare(runB.id, runA.id);
    expect(Date.now() - started).toBeLessThan(500);
    expect(again.status).toBe(200);
    expect(again.diff.id).toBe(first.diff.id);
  });

  it("filters lines by change type and by |Δ%|", async () => {
    const { diff } = await compare(runB.id, runA.id);
    expect(await allLines(diff.id, { change: "added" })).toEqual([]);
    expect(await allLines(diff.id, { change: "changed" })).toHaveLength(1);
    expect(await allLines(diff.id, { minDeltaPct: 150 })).toEqual([]);
    expect(await allLines(diff.id, { minDeltaPct: 100 })).toHaveLength(1);
    expect((await api.GET("/diffs/{diffId}/lines", { params: { path: { diffId: diff.id }, query: { change: "nope" as never } } })).response.status).toBe(400);
  });

  it("the reverse direction is its own diff", async () => {
    const { diff } = await compare(runA.id, runB.id);
    const [line] = await allLines(diff.id);
    expect(line).toMatchObject({ before: { quantity: edited.quantity! * 2 }, after: { quantity: edited.quantity }, deltaPct: -50 });
  });

  it("a new model version's run lists the model input as changed; the report has its elements (none: identical file, the v2 fixture fake)", async () => {
    const v2 = await uploadVersion(owner, modelId, await duplexBytes(), "Duplex_A_v2.ifc");
    expect((await waitForVersion(owner, v2.id)).status).toBe("ready");
    const current = (await api.GET("/boqs/{boqId}", { params: { path: { boqId: boq.id } } })).data!.currentRevision;
    await api.PATCH("/revisions/{revisionId}", { params: { path: { revisionId: current.id } }, body: { inputs: { models: current.inputs.models.map((m) => ({ modelId: m.modelId, modelVersionId: v2.id, discipline: m.discipline })) } } });
    const runC = await generate();
    const { diff } = await compare(runC.id, runB.id);
    expect(diff.summary.inputsChanged).toEqual(["inputs.models"]);
    expect(diff.summary).toMatchObject({ linesChanged: 0, elementsAdded: 0, elementsRemoved: 0, elementsChanged: 0 });
  }, 240_000);

  it("refuses unfinished runs, unknown runs and a missing againstRunId", async () => {
    expect((await api.POST("/runs/{runId}/compare", { params: { path: { runId: runB.id } }, body: {} as never })).response.status).toBe(400);
    expect((await api.POST("/runs/{runId}/compare", { params: { path: { runId: runB.id } }, body: { againstRunId: "00000000-0000-4000-8000-000000000000" } })).response.status).toBe(404);
  });

  it("another org's member can't read the diff (404)", async () => {
    const { diff } = await compare(runB.id, runA.id);
    const stranger = await signUp("Stranger", uniqueEmail("stranger"));
    expect((await client(stranger.token).GET("/diffs/{diffId}", { params: { path: { diffId: diff.id } } })).response.status).toBe(404);
  });
});

describe("change report export (F08 §7)", () => {
  it("writes changes_xlsx as a job; the file downloads", async () => {
    const { diff } = await compare(runB.id, runA.id);
    const { data: started, response } = await api.POST("/diffs/{diffId}/export", { params: { path: { diffId: diff.id } } });
    expect(response.status).toBe(202);
    const done = await job(started!.id);
    expect(done.status).toBe("succeeded");
    const exportId = (done.output as { exportId: string }).exportId;
    const { data: meta } = await api.GET("/exports/{exportId}", { params: { path: { exportId } } });
    expect(meta).toMatchObject({ kind: "changes_xlsx", subjectType: "diff", subjectId: diff.id });
    expect(meta!.fileName).toMatch(/_changes\.xlsx$/);
    const { response: download } = await api.GET("/exports/{exportId}/download", { params: { path: { exportId } }, redirect: "manual" } as never);
    expect(download.status).toBe(302);
    const file = await fetch(download.headers.get("Location")!);
    expect(file.ok).toBe(true);
    expect((await file.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });
});
