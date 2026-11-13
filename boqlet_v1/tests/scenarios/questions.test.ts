import { beforeAll, describe, expect, it } from "vitest";
import type { Schemas } from "@ifc-boq/api";
import { client, ROOT_URL } from "../support/env";
import { duplexBytes, uploadVersion, waitForVersion } from "../support/models";
import { signUp, uniqueEmail, type TestUser } from "../support/users";

/**
 * F05 questions and decisions (FE-010) on the Duplex. A BoQ without dictionaries leaves the
 * materials and wall types unnamed, so the run needs input: 33 blocking name questions.
 */

const slug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

let owner: TestUser;
let orgId: string;
let projectId: string;
let boq: Schemas["Boq"];
let first: Schemas["Run"];
/** The answers that also went to the project dictionary. */
let inDictionary: string[] = [];

type Api = ReturnType<typeof client>;

async function finished(api: Api, runId: string) {
  const deadline = Date.now() + 120_000;
  for (;;) {
    const { data } = await api.GET("/runs/{runId}", { params: { path: { runId } } });
    if (data && data.status !== "queued" && data.status !== "running") return data;
    if (Date.now() > deadline) throw new Error("run did not finish");
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function generate(api: Api) {
  const { data } = await api.POST("/revisions/{revisionId}/runs", { params: { path: { revisionId: boq.currentRevision.id } } });
  return finished(api, data!.run.id);
}

const questionsOf = async (api: Api, runId: string) => (await api.GET("/runs/{runId}/questions", { params: { path: { runId } } })).data!;
const cardBlocking = async (api: Api) => (await api.GET("/orgs/{orgId}/projects", { params: { path: { orgId } } })).data!.find((p) => p.id === projectId)!.counts!.blockingQuestions;
const pendingChanges = async (api: Api) => (await api.GET("/boqs/{boqId}", { params: { path: { boqId: boq.id } } })).data!.currentRevision.pendingChanges;

/** The first term of each category (any term answers a name question). */
async function firstTerms(api: Api) {
  const { data } = await api.GET("/orgs/{orgId}/terms", { params: { path: { orgId } } });
  const out = new Map<string, string>();
  for (const t of data!) if (!out.has(t.category)) out.set(t.category, t.id);
  return out;
}

beforeAll(async () => {
  owner = await signUp("Questions Owner", uniqueEmail("questions"));
  const api = client(owner.token);
  const { data: org } = await api.POST("/orgs", { body: { name: "Questions Firm", slug: slug("questions") } });
  orgId = org!.id;
  const { data: project } = await api.POST("/orgs/{orgId}/projects", { params: { path: { orgId } }, body: { name: "Duplex" } });
  projectId = project!.id;
  const { data: model } = await api.POST("/projects/{projectId}/models", { params: { path: { projectId } }, body: { name: "Architecture", discipline: "architecture" } });
  const version = await uploadVersion(owner, model!.id, await duplexBytes(), "Ifc2x3_Duplex_Architecture.ifc");
  expect((await waitForVersion(owner, version.id)).status).toBe("ready");
  const { data } = await api.POST("/projects/{projectId}/boqs", { params: { path: { projectId } }, body: { name: "Unnamed", inputs: { dictionaryVersionIds: [] } } });
  boq = data!;
  first = await generate(api);
}, 240_000);

describe("questions of a run (F05 §1)", () => {
  it("lists every open question, unanswered and blocking first, none answered yet", async () => {
    expect(first.status).toBe("needs_input");
    const questions = await questionsOf(client(owner.token), first.id);
    expect(questions.length).toBe(first.stats!.questions);
    const blocking = questions.filter((q) => q.blocking);
    expect(blocking.length).toBe(first.stats!.blockingQuestions);
    expect(blocking.length).toBeGreaterThanOrEqual(10);
    expect(questions.slice(0, blocking.length).every((q) => q.blocking)).toBe(true);
    expect(questions.every((q) => !q.decision && q.answeredAfterRun === false)).toBe(true);
    expect(blocking.every((q) => q.kind === "unknown_name" && q.answer.kind === "term")).toBe(true);
    // The project card counts them (F02).
    expect(await cardBlocking(client(owner.token))).toBe(blocking.length);
  });
});

describe("answering (F05 §2, §3)", () => {
  it("bulk-answers 10 names in one request; the run doesn't change until regenerated", async () => {
    const api = client(owner.token);
    const terms = await firstTerms(api);
    const questions = await questionsOf(api, first.id);
    const ten = questions.filter((q) => q.blocking && q.answer.kind === "term" && q.answer.category === "material").slice(0, 10);
    expect(ten).toHaveLength(10);
    inDictionary = ten.map((q) => q.id);
    const { data, response } = await api.POST("/projects/{projectId}/decisions", {
      params: { path: { projectId } },
      body: { decisions: ten.map((q) => ({ questionId: q.id, kind: q.kind, answer: terms.get("material")! })) },
    });
    expect(response.status).toBe(200);
    expect(data!.decisions).toHaveLength(10);
    expect(data!.reopenedRevisions).toEqual([]);

    const after = await questionsOf(api, first.id);
    const answered = after.filter((q) => q.decision);
    expect(answered.map((q) => q.id).sort()).toEqual(ten.map((q) => q.id).sort());
    expect(answered.every((q) => q.answeredAfterRun && q.decision!.answer === terms.get("material"))).toBe(true);
    expect(await cardBlocking(api)).toBe(first.stats!.blockingQuestions! - 10);
    // Answered rows sort after the open ones.
    expect(after.slice(-10).every((q) => q.decision)).toBe(true);
    // The answers wait for a regenerate; the project dictionary moved too (F05 §5).
    expect(await pendingChanges(api)).toEqual(expect.arrayContaining(["decisions", "inputs.dictionaries"]));
    const decisions = (await api.GET("/projects/{projectId}/decisions", { params: { path: { projectId } } })).data!;
    expect(decisions).toHaveLength(10);
    expect(decisions.every((d) => d.usedByLatestRuns === false && d.answerType?.kind === "term")).toBe(true);
  });

  it("answering every blocking question and regenerating gives a complete run (F05 AC1)", async () => {
    const api = client(owner.token);
    const terms = await firstTerms(api);
    const open = (await questionsOf(api, first.id)).filter((q) => q.blocking && !q.decision);
    const { response } = await api.POST("/projects/{projectId}/decisions", {
      params: { path: { projectId } },
      body: {
        decisions: open.map((q) => ({ questionId: q.id, kind: q.kind, answer: terms.get(q.answer.kind === "term" ? (q.answer.category ?? "material") : "material")! })),
        addToProjectDictionary: false,
      },
    });
    expect(response.status).toBe(200);
    const second = await generate(api);
    expect(second.status).toBe("complete");
    expect(second.stats!.blockingQuestions).toBe(0);
    expect(await pendingChanges(api)).toEqual([]);

    // The new run lists the answered questions with their answers, not as changed after the run.
    const questions = await questionsOf(api, second.id);
    const answered = questions.filter((q) => q.decision);
    expect(answered.length).toBe(first.stats!.blockingQuestions);
    expect(answered.every((q) => !q.answeredAfterRun)).toBe(true);
    const decisions = (await api.GET("/projects/{projectId}/decisions", { params: { path: { projectId } } })).data!;
    expect(decisions.every((d) => d.usedByLatestRuns)).toBe(true);
  }, 180_000);

  it("dismisses an informative question with null (leave it), and the next run doesn't ask it", async () => {
    const api = client(owner.token);
    const run = (await api.GET("/boqs/{boqId}", { params: { path: { boqId: boq.id } } })).data!.currentRevision.currentRun!;
    const info = (await questionsOf(api, run.id)).find((q) => !q.blocking && !q.decision)!;
    expect(info).toBeTruthy();
    const bad = await api.POST("/projects/{projectId}/decisions", { params: { path: { projectId } }, body: { decisions: [{ questionId: info.id, kind: info.kind, answer: 42 }] } });
    expect(bad.response.status).toBe(400);
    await api.POST("/projects/{projectId}/decisions", { params: { path: { projectId } }, body: { decisions: [{ questionId: info.id, kind: info.kind, answer: null }] } });
    expect(await pendingChanges(api)).toContain("decisions");
    const next = await generate(api);
    const row = (await questionsOf(api, next.id)).find((q) => q.id === info.id)!;
    expect(row.decision?.answer).toBeNull();
    expect(next.stats!.questions).toBe(run.stats!.questions! - 1);
  }, 180_000);

  it("clearing an answer is pending until the next run, which asks again", async () => {
    const api = client(owner.token);
    const decisions = (await api.GET("/projects/{projectId}/decisions", { params: { path: { projectId }, query: { kind: "unknown_name" } } })).data!;
    // One of the answers given without the project dictionary, so clearing it asks again.
    const one = decisions.find((d) => d.answerType?.kind === "term" && !inDictionary.includes(d.questionId))!;
    const { response } = await api.DELETE("/decisions/{decisionId}", { params: { path: { decisionId: one.id } } });
    expect(response.status).toBe(204);
    expect(await pendingChanges(api)).toContain("decisions");
    const run = (await api.GET("/boqs/{boqId}", { params: { path: { boqId: boq.id } } })).data!.currentRevision.currentRun!;
    const row = (await questionsOf(api, run.id)).find((q) => q.id === one.questionId)!;
    expect(row.decision).toBeUndefined();
    expect(row.answeredAfterRun).toBe(true);
    const next = await generate(api);
    expect(next.status).toBe("needs_input");
    expect((await questionsOf(api, next.id)).find((q) => q.id === one.questionId)).toMatchObject({ blocking: true, answeredAfterRun: false });
  }, 180_000);
});

describe("decisions page (F05 §7)", () => {
  it("exports the decisions as CSV", async () => {
    const res = await fetch(`${ROOT_URL}/api/v1/projects/${projectId}/decisions.csv`, { headers: { Authorization: `Bearer ${owner.token}` } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const lines = (await res.text()).trim().split(/\r?\n/);
    const count = (await client(owner.token).GET("/projects/{projectId}/decisions", { params: { path: { projectId } } })).data!.length;
    expect(lines).toHaveLength(count + 1);
  });
});
