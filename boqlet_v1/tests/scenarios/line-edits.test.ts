import { beforeAll, describe, expect, it } from "vitest";
import type { Schemas } from "@ifc-boq/api";
import { client } from "../support/env";
import { duplexBytes, uploadVersion, waitForVersion } from "../support/models";
import { signUp, uniqueEmail, type TestUser } from "../support/users";

/**
 * F06 §6–7 line edits and manual lines (FE-011) on the Duplex: every kind of edit and a manual line
 * survive regeneration and a new model version (F06-AC3, AC6); the rules that refuse an edit (AC4).
 * Edits are applied by the mock's "Line edits applied" fake until EN-003.
 */

const slug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const SYSTEM = "acme-cost-codes";
type Api = ReturnType<typeof client>;
type Line = Schemas["RunLine"];

let owner: TestUser;
let modelId: string;
let boq: Schemas["Boq"];
let lines: Line[];

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
  const run = await finished(api, data!.run.id);
  const { data: page } = await api.GET("/runs/{runId}/lines", { params: { path: { runId: run.id } } });
  return { run, lines: page!.items };
}
const pendingChanges = async (api: Api) => (await api.GET("/boqs/{boqId}", { params: { path: { boqId: boq.id } } })).data!.currentRevision.pendingChanges;
const setOverride = (api: Api, body: Schemas["LineOverrideInput"]) => api.POST("/boqs/{boqId}/overrides", { params: { path: { boqId: boq.id } }, body });

beforeAll(async () => {
  owner = await signUp("Edits Owner", uniqueEmail("edits"));
  const api = client(owner.token);
  const { data: org } = await api.POST("/orgs", { body: { name: "Edits Firm", slug: slug("edits") } });
  const { data: project } = await api.POST("/orgs/{orgId}/projects", { params: { path: { orgId: org!.id } }, body: { name: "Duplex" } });
  const { data: model } = await api.POST("/projects/{projectId}/models", { params: { path: { projectId: project!.id } }, body: { name: "Architecture", discipline: "architecture" } });
  modelId = model!.id;
  const version = await uploadVersion(owner, modelId, await duplexBytes(), "Ifc2x3_Duplex_Architecture.ifc");
  expect((await waitForVersion(owner, version.id)).status).toBe("ready");
  const { data: presets } = await api.GET("/orgs/{orgId}/presets", { params: { path: { orgId: org!.id }, query: { kind: "classification" } } });
  const codes = presets!.find((p) => p.slug === SYSTEM)!.latestPublishedVersion!.id;
  const { data } = await api.POST("/projects/{projectId}/boqs", { params: { path: { projectId: project!.id } }, body: { name: "Edits", inputs: { classificationVersionIds: [codes] } } });
  boq = data!;
  lines = (await generate(api)).lines;
}, 240_000);

describe("refused edits (F06 §6, AC4)", () => {
  it("a new unit without a new quantity is 409 unit_needs_quantity", async () => {
    const line = lines.find((l) => l.quantity !== null)!;
    const { response, error } = await setOverride(client(owner.token), { lineKey: line.key, unit: "m3" });
    expect(response.status).toBe(409);
    expect(error).toMatchObject({ code: "unit_needs_quantity" });
  });

  it("a quantity or an exclusion without a reason is 400 reason_required; an unknown code is 400 unknown_code", async () => {
    const api = client(owner.token);
    const line = lines[0]!;
    expect((await setOverride(api, { lineKey: line.key, quantity: 3 })).error).toMatchObject({ code: "reason_required" });
    expect((await setOverride(api, { lineKey: line.key, excluded: true, reason: "  " })).error).toMatchObject({ code: "reason_required" });
    expect((await setOverride(api, { lineKey: line.key, codes: { [SYSTEM]: "ZZ.99" } })).error).toMatchObject({ code: "unknown_code" });
    expect((await setOverride(api, { lineKey: line.key })).response.status).toBe(400);
    expect((await api.GET("/boqs/{boqId}/overrides", { params: { path: { boqId: boq.id } } })).data).toEqual([]);
    expect(await pendingChanges(api)).toEqual([]);
  });

  it("a batch is all or nothing", async () => {
    const api = client(owner.token);
    const { response } = await api.POST("/boqs/{boqId}/overrides/batch", {
      params: { path: { boqId: boq.id } },
      body: { overrides: [{ lineKey: lines[0]!.key, excluded: true, reason: "Out of scope" }, { lineKey: lines[1]!.key, excluded: true }] },
    });
    expect(response.status).toBe(400);
    expect((await api.GET("/boqs/{boqId}/overrides", { params: { path: { boqId: boq.id } } })).data).toEqual([]);
  });
});

describe("edits and a manual line survive regeneration and a new model version (F06 AC3, AC6)", () => {
  let quantityLine: Line, textLine: Line, movedLine: Line, excludedLine: Line, reorderedLine: Line;
  let target: string;
  const manualId = `manual-${Math.random().toString(16).slice(2, 10)}`;

  it("saves each edit at once; they wait for a regenerate", async () => {
    const api = client(owner.token);
    const measured = lines.filter((l) => l.quantity !== null && l.codes[SYSTEM]);
    [quantityLine, textLine, movedLine, excludedLine, reorderedLine] = measured as [Line, Line, Line, Line, Line];
    target = movedLine.codes[SYSTEM]!.code === "A.01" ? "A.02" : "A.01";

    const quantity = await setOverride(api, { lineKey: quantityLine.key, quantity: 123.45, reason: "Measured on site" });
    expect(quantity.response.status).toBe(200);
    expect(quantity.data).toMatchObject({ lineKey: quantityLine.key, quantity: 123.45, reason: "Measured on site" });
    await setOverride(api, { lineKey: textLine.key, description: "Edited text" });
    await setOverride(api, { lineKey: movedLine.key, codes: { [SYSTEM]: target } });
    await setOverride(api, { lineKey: excludedLine.key, excluded: true, reason: "By the client" });
    await setOverride(api, { lineKey: reorderedLine.key, sortAfter: quantityLine.key });
    // Editing one line again replaces its edits.
    await setOverride(api, { lineKey: quantityLine.key, quantity: 120, unit: quantityLine.unit, reason: "Measured on site" });

    const { response, data } = await api.POST("/boqs/{boqId}/manual-items", {
      params: { path: { boqId: boq.id } },
      body: { item: { id: manualId, kind: "preliminary", description: "Site hoarding", unit: "m", quantity: 42 }, codes: { [SYSTEM]: "A.01" }, sortHint: quantityLine.key },
    });
    expect(response.status).toBe(201);
    expect(data).toMatchObject({ item: { id: manualId }, codes: { [SYSTEM]: "A.01" } });

    const overrides = (await api.GET("/boqs/{boqId}/overrides", { params: { path: { boqId: boq.id } } })).data!;
    expect(overrides).toHaveLength(5);
    expect(overrides.find((o) => o.lineKey === quantityLine.key)).toMatchObject({ quantity: 120 });
    expect(await pendingChanges(api)).toEqual(["adjustments"]);
  });

  const checkApplied = (after: Line[]) => {
    const byKey = new Map(after.map((l) => [l.key, l]));
    expect(byKey.get(quantityLine.key)).toMatchObject({ quantity: 120, overridden: { fields: ["quantity", "unit"], engineQuantity: quantityLine.quantity, reason: "Measured on site" } });
    expect(byKey.get(textLine.key)).toMatchObject({ description: "Edited text", overridden: { fields: ["description"], engineDescription: textLine.description } });
    expect(byKey.get(movedLine.key)!.codes[SYSTEM]!.code).toBe(target);
    expect(byKey.get(movedLine.key)!.overridden).toMatchObject({ fields: ["codes"], engineCodes: { [SYSTEM]: movedLine.codes[SYSTEM]!.code } });
    expect(byKey.get(excludedLine.key)).toMatchObject({ excluded: true, quantity: excludedLine.quantity, overridden: { fields: ["excluded"], reason: "By the client" } });
    // Only the moved line's code changed, other lines keep theirs.
    expect(byKey.get(quantityLine.key)!.codes[SYSTEM]!.code).toBe(quantityLine.codes[SYSTEM]!.code);
    const keys = after.map((l) => l.key);
    // Both follow the quantity line: the line edit is applied after the manual line's hint, so it sits closer.
    expect(keys.indexOf(reorderedLine.key)).toBe(keys.indexOf(quantityLine.key) + 1);
    const manual = byKey.get(manualId)!;
    expect(manual).toMatchObject({ ruleKind: "manual", description: "Site hoarding", unit: "m", quantity: 42 });
    expect(manual.codes[SYSTEM]).toMatchObject({ code: "A.01", path: [{ code: "A.01" }] });
    expect(keys.indexOf(manualId)).toBe(keys.indexOf(quantityLine.key) + 2);
    expect(after.length).toBe(lines.length + 1);
  };

  it("regenerating applies them", async () => {
    const api = client(owner.token);
    const second = await generate(api);
    expect(second.run.status).toBe("complete");
    checkApplied(second.lines);
    expect(await pendingChanges(api)).toEqual([]);
  }, 180_000);

  it("a new model version keeps them (line keys don't depend on the version)", async () => {
    const api = client(owner.token);
    const version = await uploadVersion(owner, modelId, await duplexBytes(), "Ifc2x3_Duplex_Architecture_v2.ifc");
    expect((await waitForVersion(owner, version.id)).status).toBe("ready");
    const { data: revision } = await api.PATCH("/revisions/{revisionId}", {
      params: { path: { revisionId: boq.currentRevision.id } },
      body: { inputs: { models: [{ modelId, modelVersionId: version.id, discipline: "architecture" }] } },
    });
    expect(revision!.pendingChanges).toEqual(["inputs.models"]);
    checkApplied((await generate(api)).lines);
  }, 240_000);

  it("restoring a line and deleting the manual line apply on the next run", async () => {
    const api = client(owner.token);
    const overrides = (await api.GET("/boqs/{boqId}/overrides", { params: { path: { boqId: boq.id } } })).data!;
    const excluded = overrides.find((o) => o.lineKey === excludedLine.key)!;
    expect((await api.DELETE("/overrides/{overrideId}", { params: { path: { overrideId: excluded.id } } })).response.status).toBe(204);
    const manual = (await api.GET("/boqs/{boqId}/manual-items", { params: { path: { boqId: boq.id } } })).data!;
    expect((await api.DELETE("/manual-items/{itemId}", { params: { path: { itemId: manual[0]!.id } } })).response.status).toBe(204);
    expect(await pendingChanges(api)).toEqual(["adjustments"]);
    const after = (await generate(api)).lines;
    const line = after.find((l) => l.key === excludedLine.key)!;
    expect(line.excluded).toBeUndefined();
    expect(line.overridden).toBeUndefined();
    expect(after.some((l) => l.key === manualId)).toBe(false);
  }, 180_000);
});

describe("checking a manual line's formula (F06 §7)", () => {
  it("passes a formula over building values and names the problem in a broken one", async () => {
    const api = client(owner.token);
    const parent = boq.currentRevision.inputs.ruleSetVersionId;
    // The engine syntax-checks formula slots, so the formula goes in one the manual line points to.
    const doc = (formula: string) => ({
      schemaVersion: "1.0",
      id: "manual-check",
      name: "Check",
      version: "1",
      extends: "",
      params: { manual_formula: { type: "formula", label: "Formula", value: formula, unit: "m3" } },
      manual: [{ id: "manual-x", kind: "other", description: "Check", unit: "m3", formula: { param: "manual_formula" } }],
    });
    const good = await api.POST("/presets/check", { body: { kind: "rule_set", doc: doc("building.gross_volume / 100"), parentVersionIds: [parent] } });
    expect(good.data).toMatchObject({ ok: true, problems: [] });
    const bad = await api.POST("/presets/check", { body: { kind: "rule_set", doc: doc("building.gross_volume / / 100"), parentVersionIds: [parent] } });
    expect(bad.data!.ok).toBe(false);
    expect(bad.data!.problems.length).toBeGreaterThan(0);
  });
});
