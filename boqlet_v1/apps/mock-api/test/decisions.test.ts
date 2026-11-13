import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * F05 decisions in the mock (FE-010) without the engine: permissions, validation, BR-23 (an answer
 * an approved version's run used sends it back to draft), promoting and the term picker. Runs are
 * written into the store directly; `tests/scenarios/questions.test.ts` runs the Duplex for real.
 */
const tmp = mkdtempSync(path.join(os.tmpdir(), "boqlet-decisions-"));
process.env.MOCK_DATA_DIR = tmp;

const { createApp } = await import("../src/app.js");
const { SEED, SEED_PROJECTS } = await import("../src/seed.js");
const { db } = await import("../src/store.js");
const { newId } = await import("../src/ids.js");

type App = Awaited<ReturnType<typeof createApp>>;
let app: App;
const as = (userId: string) => ({ Authorization: `Bearer mock:${userId}` });
const api = (p: string, userId: string, init: { method?: string; body?: unknown } = {}) =>
  app.request(`http://localhost:4010/api/v1${p}`, {
    method: init.method ?? "GET",
    headers: { ...as(userId), ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
const project = SEED_PROJECTS.duplex;
const answer = (userId: string, decisions: unknown[], query = "") => api(`/projects/${project}/decisions${query}`, userId, { method: "POST", body: { decisions } });

const NAME_Q = "name:material:Beton C25";
const question = {
  id: NAME_Q,
  kind: "unknown_name" as const,
  blocking: true,
  message: "What is 'Beton C25' (material)?",
  answer: { kind: "term" as const, category: "material" },
  field: "material",
  raw: "Beton C25",
  occurrences: 14,
};

/** A BoQ whose working version is `status`, with a finished run that asked `askedQuestionIds`. */
function boqWithRun(name: string, status: "draft" | "in_review" | "approved", askedQuestionIds: string[]) {
  const at = new Date().toISOString();
  const boqId = newId();
  const revisionId = newId();
  const runId = newId();
  const inputs = { models: [], ruleSetVersionId: db().projects.find((p) => p.id === project)!.defaults.ruleSetVersionId!, classificationVersionIds: [], dictionaryVersionIds: [], federationVersionId: null, resolutionVersionId: null };
  db().boqs.push({ id: boqId, projectId: project, name, status: "working", currentRevisionId: revisionId, latestIssuedRevisionId: null, archived: false, createdBy: SEED.users.olivia, createdAt: at, updatedAt: at });
  db().revisions.push({ id: revisionId, boqId, number: 1, status, inputs, currentRunId: runId, basedOnRevisionId: null, createdAt: at });
  db().runs.push({ id: runId, revisionId, jobId: newId(), status: "needs_input", request: { inputs, projectDictionaryVersionId: null, decisions: [] }, askedQuestionIds, createdBy: SEED.users.olivia, createdAt: at, finishedAt: at });
  return { boqId, revisionId, runId };
}

beforeAll(async () => {
  app = await createApp({ reseed: true });
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("answering (F05 §2)", () => {
  it("is for leads and estimators: approvers and viewers get 403", async () => {
    for (const who of [SEED.users.ana, SEED.users.victor]) {
      const res = await answer(who, [{ questionId: "name:material:X", kind: "unknown_name", answer: "concrete" }]);
      expect(res.status).toBe(403);
    }
  });

  it("refuses an unknown kind and a question answered twice in one request", async () => {
    expect((await answer(SEED.users.marko, [{ questionId: "q1", kind: "nonsense", answer: "x" }])).status).toBe(400);
    const twice = await answer(SEED.users.marko, [
      { questionId: "name:material:Y", kind: "unknown_name", answer: "concrete" },
      { questionId: "name:material:Y", kind: "unknown_name", answer: "masonry" },
    ]);
    expect(twice.status).toBe(400);
    expect(await twice.json()).toMatchObject({ code: "invalid_body", details: { questionId: "name:material:Y" } });
  });

  it("checks the answer against the question a run asked", async () => {
    const { runId } = boqWithRun("Choice check", "draft", ["contradiction:volume:IfcWall:W"]);
    const run = db().runs.find((r) => r.id === runId)!;
    run.request.decisions = [
      {
        questionId: "contradiction:volume:IfcWall:W",
        kind: "contradiction",
        answer: null,
        question: { id: "contradiction:volume:IfcWall:W", kind: "contradiction", blocking: false, message: "m", answer: { kind: "choice", options: [{ value: "reported", label: "Reported" }, { value: "geometry", label: "Geometry" }] } },
      },
    ];
    const bad = await answer(SEED.users.marko, [{ questionId: "contradiction:volume:IfcWall:W", kind: "contradiction", answer: "other" }]);
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ code: "invalid_answer" });
    const wrongKind = await answer(SEED.users.marko, [{ questionId: "contradiction:volume:IfcWall:W", kind: "overlap", answer: "reported" }]);
    expect(wrongKind.status).toBe(400);
    const good = await answer(SEED.users.marko, [{ questionId: "contradiction:volume:IfcWall:W", kind: "contradiction", answer: "geometry" }]);
    expect(good.status).toBe(200);
    const body = (await good.json()) as { decisions: { answerType?: { kind: string } }[] };
    expect(body.decisions[0]!.answerType).toMatchObject({ kind: "choice" });
  });

  it("adds name answers to the project dictionary as a new published version (F05 §5)", async () => {
    const dictionaryId = db().projects.find((p) => p.id === project)!.projectDictionaryId;
    const before = db().presetVersions.filter((v) => v.presetId === dictionaryId).length;
    const res = await answer(SEED.users.marko, [{ questionId: NAME_Q, kind: "unknown_name", answer: "concrete.in_situ" }]);
    expect(res.status).toBe(200);
    const versions = db().presetVersions.filter((v) => v.presetId === dictionaryId).sort((a, b) => b.number! - a.number!);
    expect(versions.length).toBe(before + 1);
    expect(versions[0]!.status).toBe("published");
    const entries = (versions[0]!.doc as { entries: { field: string; match: { exact: string }; term: string; source: string }[] }).entries;
    expect(entries).toContainEqual(expect.objectContaining({ field: "material", match: { exact: "Beton C25" }, term: "concrete.in_situ", source: "user" }));

    // Without the tick, only the decision is written.
    const off = await api(`/projects/${project}/decisions`, SEED.users.marko, { method: "POST", body: { decisions: [{ questionId: "name:material:Ziegel", kind: "unknown_name", answer: "masonry.brick" }], addToProjectDictionary: false } });
    expect(off.status).toBe(200);
    expect(db().presetVersions.filter((v) => v.presetId === dictionaryId).length).toBe(before + 1);
  });

  it("keeps a changed answer's old row as history and lists the current one only", async () => {
    await answer(SEED.users.marko, [{ questionId: NAME_Q, kind: "unknown_name", answer: "concrete.precast" }]);
    const list = (await (await api(`/projects/${project}/decisions?kind=unknown_name`, SEED.users.victor)).json()) as { questionId: string; answer: unknown; decidedBy: { name: string } }[];
    expect(list.filter((d) => d.questionId === NAME_Q)).toEqual([expect.objectContaining({ answer: "concrete.precast" })]);
    expect(db().decisions.filter((d) => d.questionId === NAME_Q && d.projectId === project)).toHaveLength(2);
  });
});

describe("BR-23: an answer an approved version's run used", () => {
  it("lists the version in a dry run without changing anything, then reopens it", async () => {
    const q = "name:material:Kalkzandsteen";
    const { boqId, revisionId } = boqWithRun("Approved BoQ", "approved", [q]);
    const decisionsBefore = db().decisions.length;
    const dry = await answer(SEED.users.marko, [{ questionId: q, kind: "unknown_name", answer: "masonry.block" }], "?dryRun=true");
    expect(dry.status).toBe(200);
    expect(await dry.json()).toMatchObject({ reopenedRevisions: [{ boqId, boqName: "Approved BoQ", revisionId, label: "A", status: "approved" }] });
    expect(db().revisions.find((r) => r.id === revisionId)!.status).toBe("approved");
    expect(db().decisions.length).toBe(decisionsBefore);

    const real = await answer(SEED.users.marko, [{ questionId: q, kind: "unknown_name", answer: "masonry.block" }]);
    expect(await real.json()).toMatchObject({ reopenedRevisions: [{ revisionId, status: "draft" }] });
    expect(db().revisions.find((r) => r.id === revisionId)!.status).toBe("draft");
    expect(db().audit.some((a) => a.action === "revision.reopened" && a.subjectId === revisionId)).toBe(true);
  });

  it("leaves versions alone when the answer doesn't change or the run didn't use the question", async () => {
    const q = "name:material:Kalkzandsteen";
    const { revisionId } = boqWithRun("Approved again", "in_review", [q, "name:material:Other"]);
    const same = await answer(SEED.users.marko, [{ questionId: q, kind: "unknown_name", answer: "masonry.block" }], "?dryRun=true");
    expect(await same.json()).toMatchObject({ reopenedRevisions: [] });
    const unrelated = await answer(SEED.users.marko, [{ questionId: "name:material:Unrelated", kind: "unknown_name", answer: "concrete" }], "?dryRun=true");
    expect(await unrelated.json()).toMatchObject({ reopenedRevisions: [] });
    expect(db().revisions.find((r) => r.id === revisionId)!.status).toBe("in_review");
  });

  it("clearing an answer the run used reopens too", async () => {
    const q = "name:material:Kalkzandsteen";
    const { revisionId } = boqWithRun("Approved third", "approved", [q]);
    const decision = db().decisions.find((d) => d.questionId === q && !d.supersededAt)!;
    expect((await api(`/decisions/${decision.id}`, SEED.users.victor, { method: "DELETE" })).status).toBe(403);
    expect((await api(`/decisions/${decision.id}`, SEED.users.marko, { method: "DELETE" })).status).toBe(204);
    expect(db().revisions.find((r) => r.id === revisionId)!.status).toBe("draft");
    const list = (await (await api(`/projects/${project}/decisions`, SEED.users.marko)).json()) as { questionId: string }[];
    expect(list.some((d) => d.questionId === q)).toBe(false);
    expect((await api(`/decisions/${decision.id}`, SEED.users.marko, { method: "DELETE" })).status).toBe(404);
  });
});

describe("pending changes (F05 §3)", () => {
  it("names decisions while an answer the current run doesn't reflect exists", async () => {
    const q = "name:material:Pending";
    const { boqId } = boqWithRun("Pending BoQ", "draft", [q]);
    const pending = async () => {
      const res = await api(`/boqs/${boqId}`, SEED.users.marko);
      const body = (await res.json()) as { currentRevision: { pendingChanges: string[] } };
      expect(res.status, JSON.stringify(body)).toBe(200);
      return body.currentRevision.pendingChanges;
    };
    expect(await pending()).not.toContain("decisions");
    await answer(SEED.users.marko, [{ questionId: q, kind: "unknown_name", answer: "concrete" }]);
    expect(await pending()).toContain("decisions");
  });
});

describe("promote (F05 §6)", () => {
  let orgDictionaryId: string;
  beforeAll(() => {
    const at = new Date().toISOString();
    orgDictionaryId = newId();
    db().presets.push({ id: orgDictionaryId, orgId: SEED.orgs.studio, projectId: null, kind: "dictionary", layer: "org", slug: "studio-names", name: "Studio names", archived: false, updatedAt: at });
    db().presetVersions.push({ id: newId(), presetId: orgDictionaryId, number: 1, status: "published", doc: { schemaVersion: "1.0", id: "studio-names", name: "Studio names", version: "1", layer: "company", terms: [{ id: "studio.block", category: "material", label: "Studio block", broader: "masonry" }], entries: [] }, extendsVersionId: null, problems: [], createdAt: at, publishedAt: at });
  });

  it("publishes a new version of the org dictionary with the entry, for library editors only", async () => {
    const decision = db().decisions.find((d) => d.questionId === NAME_Q && !d.supersededAt)!;
    const denied = await api(`/decisions/${decision.id}/promote`, SEED.users.marko, { method: "POST", body: { dictionaryPresetId: orgDictionaryId } });
    expect(denied.status).toBe(403);
    const res = await api(`/decisions/${decision.id}/promote`, SEED.users.olivia, { method: "POST", body: { dictionaryPresetId: orgDictionaryId } });
    expect(res.status).toBe(200);
    const version = (await res.json()) as { id: string; number: number; status: string; doc: { entries: { match: { exact: string }; term: string }[] } };
    expect(version).toMatchObject({ number: 2, status: "published" });
    expect(version.doc.entries).toContainEqual(expect.objectContaining({ match: { exact: "Beton C25" }, term: "concrete.precast" }));
    const list = (await (await api(`/projects/${project}/decisions`, SEED.users.marko)).json()) as { id: string; promotedToPresetVersionId: string | null }[];
    expect(list.find((d) => d.id === decision.id)!.promotedToPresetVersionId).toBe(version.id);
    expect(db().audit.some((a) => a.action === "decision.promoted" && a.subjectId === decision.id)).toBe(true);
  });

  it("refuses a system dictionary and an answer that isn't a name", async () => {
    const decision = db().decisions.find((d) => d.questionId === NAME_Q && !d.supersededAt)!;
    const system = db().presets.find((p) => p.kind === "dictionary" && p.layer === "system")!;
    const res = await api(`/decisions/${decision.id}/promote`, SEED.users.olivia, { method: "POST", body: { dictionaryPresetId: system.id } });
    expect(res.status).toBe(400);
    const choice = db().decisions.find((d) => d.kind === "contradiction" && !d.supersededAt)!;
    const notName = await api(`/decisions/${choice.id}/promote`, SEED.users.olivia, { method: "POST", body: { dictionaryPresetId: orgDictionaryId } });
    expect(notName.status).toBe(409);
    expect(await notName.json()).toMatchObject({ code: "not_promotable" });
  });
});

describe("terms (term picker) and the CSV", () => {
  it("lists system and org terms, filtered by category and text", async () => {
    const all = (await (await api(`/orgs/${SEED.orgs.studio}/terms?category=material`, SEED.users.marko)).json()) as { id: string; category: string; layer: string; parent?: string }[];
    expect(all.every((t) => t.category === "material")).toBe(true);
    expect(all).toContainEqual(expect.objectContaining({ id: "concrete.in_situ", parent: "concrete", layer: "system" }));
    expect(all).toContainEqual(expect.objectContaining({ id: "studio.block", layer: "org" }));
    const found = (await (await api(`/orgs/${SEED.orgs.studio}/terms?q=in-situ`, SEED.users.marko)).json()) as { id: string }[];
    expect(found.map((t) => t.id)).toContain("concrete.in_situ");
    expect((await api(`/orgs/${SEED.orgs.small}/terms`, SEED.users.marko)).status).toBe(404);
  });

  it("exports every current decision as CSV", async () => {
    const res = await api(`/projects/${project}/decisions.csv`, SEED.users.victor);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const text = await res.text();
    const [head, ...rows] = text.replace(/^﻿/, "").trim().split("\r\n");
    expect(head).toBe("kind,question,question_id,answer,note,decided_by,decided_at,used_by_latest_runs,promoted");
    const current = db().decisions.filter((d) => d.projectId === project && !d.supersededAt).length;
    expect(rows).toHaveLength(current);
  });
});
