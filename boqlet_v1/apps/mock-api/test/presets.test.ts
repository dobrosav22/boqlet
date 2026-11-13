import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * F02 §2 with the Library (FE-021): a new project's defaults are the org's starred presets (their
 * latest published versions), else As modelled and the global seed dictionary. Publishing comes with
 * FE-025, so the starred presets here are the seeded ones.
 */
const tmp = mkdtempSync(path.join(os.tmpdir(), "boqlet-presets-"));
process.env.MOCK_DATA_DIR = tmp;

const { createApp } = await import("../src/app.js");
const { SEED, SEED_PRESETS } = await import("../src/seed.js");
const { seedId } = await import("../src/ids.js");

type App = Awaited<ReturnType<typeof createApp>>;
let app: App;
const api = (p: string, userId: string, init: { method?: string; body?: unknown } = {}) =>
  app.request(`http://localhost:4010/api/v1${p}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer mock:${userId}`, ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
const newProject = async (name: string) => {
  const res = await api(`/orgs/${SEED.orgs.studio}/projects`, SEED.users.olivia, { method: "POST", body: { name } });
  expect(res.status).toBe(201);
  return (await res.json()) as { defaults: { ruleSetVersionId: string; classificationVersionIds: string[]; dictionaryVersionIds: string[] } };
};
const star = async (presetId: string, starred: boolean) => {
  const res = await api(`/presets/${presetId}`, SEED.users.ivana, { method: "PATCH", body: { starred } });
  expect(res.status).toBe(200);
};

beforeAll(async () => {
  app = await createApp({ reseed: true });
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("new projects' default presets (F02 §2)", () => {
  it("without starred presets: As modelled, the global seed dictionary, no classification", async () => {
    const { defaults } = await newProject("Plain");
    expect(defaults).toMatchObject({
      ruleSetVersionId: seedId("preset-version:rule_set:as-modelled:1"),
      classificationVersionIds: [],
      dictionaryVersionIds: [seedId("preset-version:dictionary:global-seed:1")],
    });
  });

  it("starred presets prefill the defaults; archived ones don't", async () => {
    await star(SEED_PRESETS.studioRules, true);
    await star(SEED_PRESETS.studioTrades, true);
    await star(SEED_PRESETS.studioNames, true);
    const { defaults } = await newProject("Starred");
    expect(defaults).toMatchObject({
      ruleSetVersionId: seedId("preset-version:org:studio-rules:1"),
      classificationVersionIds: [seedId("preset-version:org:studio-trades:1")],
      dictionaryVersionIds: [seedId("preset-version:dictionary:global-seed:1"), seedId("preset-version:org:studio-names:1")],
    });
    // The draft of Studio rules is not a version a project can use.
    expect(defaults.ruleSetVersionId).not.toBe(seedId("preset-version:org:studio-rules:draft"));

    expect((await api(`/presets/${SEED_PRESETS.studioTrades}/archive`, SEED.users.ivana, { method: "POST" })).status).toBe(200);
    expect((await newProject("After archive")).defaults.classificationVersionIds).toEqual([]);
  });

  it("an org preset patch on another org preset runs its parent from the store (engine ids)", async () => {
    const { withParents } = await import("../src/preset-docs.js");
    const { db } = await import("../src/store.js");
    const parent = db().presetVersions.find((v) => v.id === seedId("preset-version:org:studio-rules:1"))!;
    const { doc, library } = withParents({ schemaVersion: "1.0", id: "child", name: "Child", version: "1", extends: "studio-rules", params: {} }, parent.id);
    expect(doc.extends).toBe(`mock-${parent.id}`);
    expect(library).toHaveLength(1);
    expect(library[0]).toMatchObject({ id: `mock-${parent.id}`, extends: "as-modelled" });
  });
});
