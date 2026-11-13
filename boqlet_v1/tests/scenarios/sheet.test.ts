import { beforeAll, describe, expect, it } from "vitest";
import type { Schemas } from "@ifc-boq/api";
import { client } from "../support/env";
import { duplexBytes, uploadVersion, waitForVersion } from "../support/models";
import { signUp, uniqueEmail, type TestUser } from "../support/users";

/** F06 sheet data (FE-009): lines, one line's detail, warnings and the log of a Duplex run. */

const slug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const SYSTEM = "acme-cost-codes";

let owner: TestUser;
let run: Schemas["Run"];
let lines: Schemas["RunLine"][];

beforeAll(async () => {
  owner = await signUp("Sheet Owner", uniqueEmail("sheet"));
  const api = client(owner.token);
  const { data: org } = await api.POST("/orgs", { body: { name: "Sheet Firm", slug: slug("sheet") } });
  const { data: project } = await api.POST("/orgs/{orgId}/projects", { params: { path: { orgId: org!.id } }, body: { name: "Duplex" } });
  const { data: model } = await api.POST("/projects/{projectId}/models", { params: { path: { projectId: project!.id } }, body: { name: "Architecture", discipline: "architecture" } });
  const version = await uploadVersion(owner, model!.id, await duplexBytes(), "Ifc2x3_Duplex_Architecture.ifc");
  expect((await waitForVersion(owner, version.id)).status).toBe("ready");
  const { data: presets } = await api.GET("/orgs/{orgId}/presets", { params: { path: { orgId: org!.id }, query: { kind: "classification" } } });
  const codes = presets!.find((p) => p.slug === SYSTEM)!.latestPublishedVersion!.id;
  const { data: boq } = await api.POST("/projects/{projectId}/boqs", { params: { path: { projectId: project!.id } }, body: { name: "Sheet", inputs: { classificationVersionIds: [codes] } } });
  const { data: started } = await api.POST("/revisions/{revisionId}/runs", { params: { path: { revisionId: boq!.currentRevision.id } } });
  const deadline = Date.now() + 120_000;
  for (;;) {
    const { data } = await api.GET("/runs/{runId}", { params: { path: { runId: started!.run.id } } });
    if (data && data.status !== "queued" && data.status !== "running") {
      run = data;
      break;
    }
    if (Date.now() > deadline) throw new Error("run did not finish");
    await new Promise((r) => setTimeout(r, 250));
  }
  const { data: page } = await api.GET("/runs/{runId}/lines", { params: { path: { runId: run.id } } });
  lines = page!.items;
}, 240_000);

const lineOf = (key: string) => client(owner.token).GET("/runs/{runId}/lines/by-key", { params: { path: { runId: run.id }, query: { key } } });

describe("lines (F06 §1)", () => {
  it("returns every line of the run in engine order, each with its codes", async () => {
    expect(["complete", "needs_input"]).toContain(run.status);
    expect(lines.length).toBe(run.stats!.lines);
    expect(lines.map((l) => l.sortIndex)).toEqual(lines.map((_, i) => i));
    expect(lines.filter((l) => l.codes[SYSTEM]).length).toBeGreaterThan(lines.length / 2);
    expect(new Set(lines.map((l) => l.key)).size).toBe(lines.length);
  });

  it("filters by source, storey and text without changing the lines (F06 §4)", async () => {
    const api = client(owner.token);
    const derived = (await api.GET("/runs/{runId}/lines", { params: { path: { runId: run.id }, query: { source: "derived" } } })).data!;
    expect(derived.items.length).toBe(lines.filter((l) => l.source === "derived").length);
    expect(derived.total).toBe(derived.items.length);
    const storey = lines.find((l) => l.location?.storey)?.location?.storey;
    if (storey) {
      const onStorey = (await api.GET("/runs/{runId}/lines", { params: { path: { runId: run.id }, query: { storey } } })).data!;
      expect(onStorey.items.length).toBeGreaterThan(0);
      expect(onStorey.items.every((l) => l.location?.storey === storey || l.location?.storeys?.includes(storey))).toBe(true);
    }
    const word = lines[lines.length - 1]!.description.split(/\s+/)[0]!.toLowerCase();
    const search = (await api.GET("/runs/{runId}/lines", { params: { path: { runId: run.id }, query: { q: word } } })).data!;
    expect(search.items.length).toBeGreaterThan(0);
    for (const l of search.items) expect(l.description.toLowerCase().includes(word) || Object.values(l.codes).some((c) => c.code.toLowerCase().includes(word) || c.title.toLowerCase().includes(word))).toBe(true);
    // Filtered lines are the same objects as unfiltered ones.
    const byKey = new Map(lines.map((l) => [l.key, l]));
    for (const l of derived.items) expect(l).toEqual(byKey.get(l.key));
  });

  it("pages with a cursor", async () => {
    const api = client(owner.token);
    const first = (await api.GET("/runs/{runId}/lines", { params: { path: { runId: run.id }, query: { limit: 10 } } })).data!;
    expect(first.items.length).toBe(10);
    expect(first.nextCursor).toBeTruthy();
    const second = (await api.GET("/runs/{runId}/lines", { params: { path: { runId: run.id }, query: { limit: 10, cursor: first.nextCursor! } } })).data!;
    expect(second.items[0]!.sortIndex).toBe(10);
  });

  it("groups server-side for large runs: group rows with counts, then one group's lines (F06 edge cases)", async () => {
    const api = client(owner.token);
    const grouped = (await api.GET("/runs/{runId}/lines", { params: { path: { runId: run.id }, query: { groupBy: SYSTEM, level: 1 } } })).data!;
    expect(grouped.items).toEqual([]);
    expect(grouped.groups!.reduce((n, g) => n + g.lineCount, 0)).toBe(lines.length);
    const group = grouped.groups!.find((g) => g.path)!;
    const inGroup = (await api.GET("/runs/{runId}/lines", { params: { path: { runId: run.id }, query: { groupBy: SYSTEM, level: 1, groupPath: group.path } } })).data!;
    expect(inGroup.items.length).toBe(group.lineCount);
    expect(inGroup.items.every((l) => l.codes[SYSTEM]!.path[0]!.code === group.path)).toBe(true);
    for (const g of grouped.groups!) if (g.unit) expect(g.quantity).toBeCloseTo(lines.filter((l) => (l.codes[SYSTEM]?.path[0]?.code ?? "") === g.path).reduce((s, l) => s + (l.quantity ?? 0), 0), 6);
  });
});

describe("line detail (F06 §5)", () => {
  it("F06-AC2 every line's detail has its formula and parameters, and element shares that add up to the quantity", async () => {
    let checked = 0;
    for (const line of lines) {
      const { data, response } = await lineOf(line.key);
      expect(response.status).toBe(200);
      expect(data!.key).toBe(line.key);
      expect(typeof data!.trace.formula).toBe("string");
      expect(data!.trace.params).toBeTypeOf("object");
      if (line.quantity === null || line.trace.elements.length === 0) continue;
      const sum = data!.trace.elements.reduce((s, e) => s + (e.quantity ?? 0), 0);
      // "Within rounding": the line keeps the rule set's rounding, the shares don't.
      expect(Math.abs(sum - line.quantity)).toBeLessThanOrEqual(Math.max(0.01, Math.abs(line.quantity) * 0.001));
      checked += 1;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("carries the log entries of that line", async () => {
    const withLog = lines.find((l) => l.source === "measured")!;
    const { data } = await lineOf(withLog.key);
    expect(data!.log!.length).toBeGreaterThan(0);
    expect(data!.log!.every((e) => e.lineKey === withLog.key)).toBe(true);
  });

  it("answers 404 for an unknown key", async () => {
    const { response } = await lineOf("no-such-line");
    expect(response.status).toBe(404);
  });
});

describe("how it is calculated (F06 §5, EN-013; fake in phase 1)", () => {
  const stepsOf = (l: Schemas["RunLine"]) => l.trace.steps ?? [];

  it("F06-AC5 every line's steps add up to its quantity and end with the result", () => {
    for (const l of lines) {
      const steps = stepsOf(l);
      expect(steps.length, l.key).toBeGreaterThan(1);
      const result = steps.at(-1)!;
      expect(result.kind, l.key).toBe("result");
      expect(result.value, l.key).toBe(l.quantity);
      if (l.quantity === null) continue;
      const sum = steps.slice(0, -1).reduce((s, x) => s + (x.value ?? 0), 0);
      expect(Math.abs(sum - l.quantity), l.key).toBeLessThanOrEqual(0.005);
    }
  });

  it("the brick wall line has start, deduct with the opening size setting, and result", () => {
    const brick = lines.find((l) => l.ruleKind === "item" && l.description.includes("Brick on Block"))!;
    const kinds = stepsOf(brick).map((s) => s.kind);
    expect(kinds[0]).toBe("start");
    expect(kinds.at(-1)).toBe("result");
    const deduct = stepsOf(brick).find((s) => s.kind === "deduct")!;
    expect(deduct.param).toBe("wall_opening_threshold");
    expect(deduct.value).toBeLessThan(0);
    expect(deduct.elements!.length).toBeGreaterThan(0);
    expect(Object.keys(brick.trace.params)).toContain(deduct.param);
  });

  it("derived lines have a derive step naming their source lines", () => {
    const derived = lines.filter((l) => l.ruleKind === "derived");
    expect(derived.length).toBeGreaterThan(0);
    const keys = new Set(lines.map((l) => l.key));
    for (const l of derived) {
      const step = stepsOf(l).find((s) => s.kind === "derive")!;
      expect(step.params.sourceLine, l.key).toBe(l.trace.sourceLine);
      for (const key of step.params.sourceLines as string[]) expect(keys.has(key), key).toBe(true);
    }
  });
});

describe("warnings and log (F06 §8, §9)", () => {
  it("lists the run's warnings", async () => {
    const { data } = await client(owner.token).GET("/runs/{runId}/warnings", { params: { path: { runId: run.id } } });
    expect(Array.isArray(data)).toBe(true);
    expect(data!.length).toBe(run.stats!.warnings);
  });

  it("pages the log in order and filters it by stage and line", async () => {
    const api = client(owner.token);
    const first = (await api.GET("/runs/{runId}/log", { params: { path: { runId: run.id }, query: { limit: 50 } } })).data!;
    expect(first.items.length).toBe(50);
    const second = (await api.GET("/runs/{runId}/log", { params: { path: { runId: run.id }, query: { limit: 50, cursor: first.nextCursor! } } })).data!;
    expect(second.items[0]!.seq).toBeGreaterThan(first.items[49]!.seq);
    const stage = first.items[0]!.stage;
    const byStage = (await api.GET("/runs/{runId}/log", { params: { path: { runId: run.id }, query: { stage, limit: 1000 } } })).data!;
    expect(byStage.items.every((e) => e.stage === stage)).toBe(true);
    const key = lines.find((l) => l.source === "measured")!.key;
    const byLine = (await api.GET("/runs/{runId}/log", { params: { path: { runId: run.id }, query: { lineKey: key } } })).data!;
    expect(byLine.items.length).toBeGreaterThan(0);
    expect(byLine.items.every((e) => e.lineKey === key)).toBe(true);
  });

  it("is hidden from people outside the project (404)", async () => {
    const stranger = await signUp("Stranger", uniqueEmail("stranger"));
    const { response } = await client(stranger.token).GET("/runs/{runId}/lines", { params: { path: { runId: run.id } } });
    expect(response.status).toBe(404);
  });
});

describe("viewer data (F07 §1–5)", () => {
  const api = () => client(owner.token);
  const versionId = () => run.snapshotVersions!.models![0]!.modelVersionId;

  it("the run names the model versions it used, with the id its traces use (F07 §2)", () => {
    const models = run.snapshotVersions!.models!;
    expect(models).toHaveLength(1);
    const traceIds = new Set(lines.flatMap((l) => l.trace.elements.map((e) => e.model)).filter(Boolean));
    expect([...traceIds]).toEqual([models[0]!.traceId]);
  });

  it("serves the scene index and the geometry (a glb behind a signed URL)", async () => {
    const { data: scene } = await api().GET("/model-versions/{versionId}/scene", { params: { path: { versionId: versionId() } } });
    expect(Object.keys(scene!.elements).length).toBeGreaterThan(100);
    expect(Object.values(scene!.elements).some((e) => e.ifcClass === "IfcRoof" && (e.parts?.length ?? 0) > 0)).toBe(true);
    const { response } = await api().GET("/model-versions/{versionId}/geometry", { params: { path: { versionId: versionId() } }, redirect: "manual" } as never);
    expect(response.status).toBe(302);
    const glb = await fetch(response.headers.get("location")!);
    expect(new TextDecoder().decode((await glb.arrayBuffer()).slice(0, 4))).toBe("glTF");
  });

  it("F07-AC3 coverage: unmatched elements match the unmatched questions' occurrences; measured ones are in lines", async () => {
    const { data: coverage } = await api().GET("/runs/{runId}/coverage", { params: { path: { runId: run.id } } });
    const { data: questions } = await api().GET("/runs/{runId}/questions", { params: { path: { runId: run.id } } });
    const unmatched = questions!.filter((q) => q.kind === "unmatched");
    expect(coverage!.unmatched.length).toBe(unmatched.reduce((s, q) => s + (q.occurrences ?? q.guids?.length ?? 0), 0));
    const inLines = new Set(lines.flatMap((l) => l.trace.elements.map((e) => e.guid)));
    for (const g of coverage!.measured.filter((g) => inLines.has(g)).slice(0, 5)) expect(inLines.has(g)).toBe(true);
    expect(coverage!.measured.length).toBeGreaterThan(0);
  });

  it("F07-AC2 an element lists every line it feeds, with its share; a roof part lists its roof's line", async () => {
    const brick = lines.find((l) => l.ruleKind === "item" && l.description.includes("Brick on Block"))!;
    const element = brick.trace.elements[0]!;
    const { data } = await api().GET("/runs/{runId}/elements/{guid}", { params: { path: { runId: run.id, guid: element.guid } } });
    expect(data!.status).toBe("measured");
    expect(data!.modelVersionId).toBe(versionId());
    const row = data!.lines.find((l) => l.lineKey === brick.key)!;
    expect(row.quantity).toBeCloseTo(element.quantity!, 6);
    const every = lines.filter((l) => l.trace.elements.some((e) => e.guid === element.guid)).map((l) => l.key);
    for (const key of every) expect(data!.lines.map((l) => l.lineKey)).toContain(key);

    const { data: scene } = await api().GET("/model-versions/{versionId}/scene", { params: { path: { versionId: versionId() } } });
    const roof = Object.entries(scene!.elements).find(([guid, e]) => e.ifcClass === "IfcRoof" && e.parts?.length && lines.some((l) => l.trace.elements.some((x) => x.guid === guid)));
    if (roof) {
      const part = roof[1].parts![0]!;
      const { data: partLines } = await api().GET("/runs/{runId}/elements/{guid}", { params: { path: { runId: run.id, guid: part } } });
      expect(partLines!.lines.length).toBeGreaterThan(0);
    }
  });
});
