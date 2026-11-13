import { beforeAll, describe, expect, it } from "vitest";
import type { Schemas } from "@ifc-boq/api";
import { client } from "../support/env";
import { duplexBytes, uploadVersion, waitForVersion } from "../support/models";
import { user, type TestUser } from "../support/users";

/**
 * F10 §4 publish and §6 preview (FE-025): publishing needs a clean draft and a change note and makes
 * version n+1; BoQs pinned to a version keep it (BR-07); a preview runs the draft on the Duplex and
 * lists what changed against the published version (the "Preview" fake until EN-005).
 */

type PreviewResult = Schemas["PreviewResult"];
const slug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

let ivana: TestUser;
let marko: TestUser;
let olivia: TestUser;
let studioId: string;
let asModelled: string;

const api = (u: TestUser) => client(u.token);

async function newPatch(name: string) {
  const { data, error } = await api(ivana).POST("/orgs/{orgId}/presets", { params: { path: { orgId: studioId } }, body: { kind: "rule_set", name, start: { mode: "patch", fromVersionId: asModelled } } });
  expect(error).toBeUndefined();
  return data!;
}

async function draftDoc(presetId: string) {
  const preset = (await api(ivana).GET("/presets/{presetId}", { params: { path: { presetId } } })).data!;
  // A new draft starts from the latest version.
  const id = (preset.draft ?? preset.latestPublishedVersion)!.id;
  return (await api(ivana).GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: id } } })).data!.doc as Record<string, unknown>;
}

const saveParams = (presetId: string, params: Record<string, unknown>) =>
  draftDoc(presetId).then((doc) => api(ivana).PUT("/presets/{presetId}/draft", { params: { path: { presetId } }, body: { doc: { ...doc, params } } }));

const publish = (u: TestUser, presetId: string, changeNote: string) => api(u).POST("/presets/{presetId}/publish", { params: { path: { presetId } }, body: { changeNote } });

beforeAll(async () => {
  [ivana, marko, olivia] = await Promise.all([user("ivana"), user("marko"), user("olivia")]);
  const me = (await api(olivia).GET("/me")).data!;
  studioId = me.memberships.find((m) => m.org.slug === "studio-demo")!.org.id;
  const presets = (await api(olivia).GET("/orgs/{orgId}/presets", { params: { path: { orgId: studioId }, query: { kind: "rule_set", layer: "system" } } })).data!;
  asModelled = presets.find((p) => p.slug === "as-modelled")!.latestPublishedVersion!.id;
});

describe("F10 §4 publish", () => {
  it("needs a change note and a draft without problems; makes version n+1; older versions stay as they were", async () => {
    const preset = await newPatch(`Publish ${slug("p")}`);
    expect((await publish(ivana, preset.id, "  ")).response.status).toBe(400);
    expect((await publish(marko, preset.id, "Mine")).response.status).toBe(403);

    await saveParams(preset.id, { excavation_formula: { value: "1 +" } });
    const bad = await publish(ivana, preset.id, "Broken");
    expect(bad.response.status).toBe(409);
    expect(bad.error).toMatchObject({ code: "draft_has_problems" });

    await saveParams(preset.id, { window_measure: { value: "area" } });
    const v1 = await publish(ivana, preset.id, "Windows by area");
    expect(v1.response.status).toBe(200);
    expect(v1.data).toMatchObject({ number: 1, status: "published", changeNote: "Windows by area", publishedBy: { id: ivana.id } });
    const after = (await api(ivana).GET("/presets/{presetId}", { params: { path: { presetId: preset.id } } })).data!;
    expect(after.draft).toBeUndefined();
    expect(after.latestPublishedVersion).toMatchObject({ number: 1 });
    expect((await publish(ivana, preset.id, "Again")).error).toMatchObject({ code: "no_draft" });

    // A new draft starts from version 1; publishing it makes version 2 and leaves version 1 alone.
    const doc = (await api(ivana).GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: v1.data!.id } } })).data!.doc as Record<string, unknown>;
    await api(ivana).PUT("/presets/{presetId}/draft", { params: { path: { presetId: preset.id } }, body: { doc: { ...doc, params: { window_measure: { value: "area" }, lines_by_storey: { value: true } } } } });
    const v2 = await publish(ivana, preset.id, "Lines per storey");
    expect(v2.data).toMatchObject({ number: 2 });
    const old = (await api(ivana).GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: v1.data!.id } } })).data!;
    expect(old.doc).toEqual(doc);
    const versions = (await api(ivana).GET("/presets/{presetId}/versions", { params: { path: { presetId: preset.id } } })).data!;
    expect(versions.map((v) => v.number)).toEqual([2, 1]);
  });

  it("BR-07: a BoQ pinned to version 1 keeps it when version 2 is published; new projects' pickers see version 2", async () => {
    const preset = await newPatch(`Pinned ${slug("b")}`);
    await saveParams(preset.id, { window_measure: { value: "area" } });
    const published = await publish(ivana, preset.id, "First");
    expect(published.error).toBeUndefined();
    const v1 = published.data!;
    const created = await api(olivia).POST("/orgs/{orgId}/projects", { params: { path: { orgId: studioId } }, body: { name: `Pinned ${slug("p")}` } });
    expect(created.error).toBeUndefined();
    const project = created.data!;
    const boqRes = await api(olivia).POST("/projects/{projectId}/boqs", { params: { path: { projectId: project.id } }, body: { name: "Tender", inputs: { ruleSetVersionId: v1.id } } });
    expect(boqRes.error).toBeUndefined();
    const boq = boqRes.data!;
    await saveParams(preset.id, { window_measure: { value: "area" }, lines_by_storey: { value: true } });
    const v2 = (await publish(ivana, preset.id, "Second")).data!;
    const revision = (await api(olivia).GET("/revisions/{revisionId}", { params: { path: { revisionId: boq.currentRevision.id } } })).data!;
    expect(revision.inputs.ruleSetVersionId).toBe(v1.id);
    const listed = (await api(olivia).GET("/presets/{presetId}", { params: { path: { presetId: preset.id } } })).data!;
    expect(listed.latestPublishedVersion!.id).toBe(v2.id);
  });
});

describe("F10-AC7 clone", () => {
  it("'Based on it' stores only changes and follows the original's next version; an independent copy doesn't", async () => {
    const parent = await newPatch(`Original ${slug("o")}`);
    await saveParams(parent.id, { window_measure: { value: "area" } });
    const p1 = (await publish(ivana, parent.id, "First")).data!;
    const create = (mode: "patch" | "copy") => api(ivana).POST("/orgs/{orgId}/presets", { params: { path: { orgId: studioId } }, body: { kind: "rule_set", name: `Clone ${mode} ${slug("c")}`, start: { mode, fromVersionId: p1.id } } });
    const based = (await create("patch")).data!;
    const copy = (await create("copy")).data!;
    const basedDraft = (await api(ivana).GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: based.draft!.id } } })).data!;
    expect((basedDraft.doc as { params: Record<string, unknown> }).params).toEqual({});
    expect(basedDraft.extendsVersionId).toBe(p1.id);
    const copyDraft = (await api(ivana).GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: copy.draft!.id } } })).data!;
    expect((copyDraft.doc as { params: Record<string, unknown> }).params).toMatchObject({ window_measure: { value: "area" } });

    // The original publishes version 2: the clone based on it follows from its next save.
    await saveParams(parent.id, { window_measure: { value: "area" }, lines_by_storey: { value: true } });
    const p2 = (await publish(ivana, parent.id, "Second")).data!;
    const saved = await api(ivana).PUT("/presets/{presetId}/draft", { params: { path: { presetId: based.id } }, body: { doc: basedDraft.doc } });
    expect(saved.data!.extendsVersionId).toBe(p2.id);
    expect(((saved.data!.flattened ?? (await api(ivana).GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: saved.data!.id } } })).data!.flattened) as { params: Record<string, { value: unknown }> }).params.lines_by_storey!.value).toBe(true);
    // The independent copy doesn't change.
    const copyAgain = (await api(ivana).GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: copy.draft!.id } } })).data!;
    expect((copyAgain.flattened as { params: Record<string, { value: unknown }> }).params.lines_by_storey!.value).toBe(false);
  });
});

describe("F10 §6 preview (fake until EN-005)", () => {
  let versionId: string;
  beforeAll(async () => {
    const project = (await api(olivia).POST("/orgs/{orgId}/projects", { params: { path: { orgId: studioId } }, body: { name: `Preview ${slug("p")}` } })).data!;
    const model = (await api(olivia).POST("/projects/{projectId}/models", { params: { path: { projectId: project.id } }, body: { name: "Architecture", discipline: "architecture" } })).data!;
    const version = await uploadVersion(olivia, model.id, await duplexBytes(), "Duplex_A.ifc");
    expect((await waitForVersion(olivia, version.id)).status).toBe("ready");
    versionId = version.id;
  }, 240_000);

  async function preview(presetId: string): Promise<{ job: Schemas["Job"]; result: PreviewResult }> {
    const started = await api(olivia).POST("/presets/{presetId}/preview", { params: { path: { presetId } }, body: { modelVersionIds: [versionId] } });
    expect(started.response.status).toBe(202);
    let job = started.data!;
    const deadline = Date.now() + 120_000;
    while (job.status === "queued" || job.status === "running") {
      if (Date.now() > deadline) throw new Error("preview still running");
      await new Promise((r) => setTimeout(r, 300));
      job = (await api(olivia).GET("/jobs/{jobId}", { params: { path: { jobId: job.id } } })).data!;
    }
    expect(job.status).toBe("succeeded");
    const res = await fetch((job.output as { previewResultUrl: string }).previewResultUrl);
    expect(res.ok).toBe(true);
    return { job, result: (await res.json()) as PreviewResult };
  }

  it("F10-AC1 / v1 criterion 7: three settings changed on As modelled show as changed lines against the published version", async () => {
    const preset = await newPatch(`Preview ${slug("r")}`);
    // Version 1 is As modelled unchanged; the draft changes three settings.
    await saveParams(preset.id, {});
    await publish(ivana, preset.id, "As modelled as it is");
    const doc = (await api(ivana).GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: (await api(ivana).GET("/presets/{presetId}", { params: { path: { presetId: preset.id } } })).data!.latestPublishedVersion!.id } } })).data!.doc as Record<string, unknown>;
    await api(ivana).PUT("/presets/{presetId}/draft", {
      params: { path: { presetId: preset.id } },
      body: { doc: { ...doc, params: { window_measure: { value: "area" }, wall_opening_mode: { value: "over_threshold" }, wall_opening_threshold: { value: 1 } } } },
    });
    const { job, result } = await preview(preset.id);
    expect(result.lines.length).toBeGreaterThan(10);
    expect(result.compare).toMatchObject({ versionNumber: 1 });
    expect(result.compare!.changed + result.compare!.added + result.compare!.removed).toBeGreaterThan(0);
    // Windows are measured in m² now.
    expect(result.changes.some((c) => c.after?.unit === "m2" && c.before?.unit !== "m2")).toBe(true);
    expect(job.output).toMatchObject({ lines: result.lines.length, compare: result.compare });
    // Nothing was stored as a run, and the preview counted as processing.
    const usage = (await api(olivia).GET("/orgs/{orgId}/usage", { params: { path: { orgId: studioId } } })).data!;
    expect(JSON.stringify(usage)).toContain("preview");
  }, 240_000);

  it("previews a patch with nothing published against the version it is based on, and refuses models it can't see", async () => {
    const preset = await newPatch(`Unpublished ${slug("u")}`);
    const { result } = await preview(preset.id);
    expect(result.compare).toMatchObject({ versionId: asModelled, presetName: "As modelled (master template)", added: 0, removed: 0, changed: 0 });
    expect(result.changes).toEqual([]);
    // Ivana edits the Library but isn't on this project.
    const outsider = await api(ivana).POST("/presets/{presetId}/preview", { params: { path: { presetId: preset.id } }, body: { modelVersionIds: [versionId] } });
    expect(outsider.response.status).toBe(404);
  }, 240_000);
});
