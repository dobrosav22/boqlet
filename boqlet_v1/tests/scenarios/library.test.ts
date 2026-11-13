import { beforeAll, describe, expect, it } from "vitest";
import { client, TARGET } from "../support/env";
import { signUp, uniqueEmail, user, type TestUser } from "../support/users";

/**
 * F10 Library shell (FE-021): presets per kind and layer, create (empty / copy / patch), details,
 * star, archive, versions, the draft (ETag, check, discard) and where a preset is used.
 */

const slug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

let olivia: TestUser;
let ivana: TestUser;
let marko: TestUser;
let studioId: string;

const list = async (u: TestUser, query: Record<string, unknown> = {}) =>
  (await client(u.token).GET("/orgs/{orgId}/presets", { params: { path: { orgId: studioId }, query } })).data!;

const systemVersionId = async (kind: "rule_set" | "classification" | "dictionary", slugName: string) => {
  const preset = (await list(olivia, { kind, layer: "system" })).find((p) => p.slug === slugName)!;
  return preset.latestPublishedVersion!.id;
};

const create = (u: TestUser, body: Record<string, unknown>, orgId = studioId) =>
  client(u.token).POST("/orgs/{orgId}/presets", { params: { path: { orgId } }, body: body as never });

beforeAll(async () => {
  [olivia, ivana, marko] = await Promise.all([user("olivia"), user("ivana"), user("marko")]);
  const me = (await client(olivia.token).GET("/me")).data!;
  studioId = me.memberships.find((m) => m.org.slug === "studio-demo")!.org.id;
});

describe("F10 Library shell", () => {
  it("lists system presets read-only and Studio Demo's own presets editable for library editors", async () => {
    const presets = await list(ivana);
    const system = presets.filter((p) => p.layer === "system");
    expect(system.length).toBeGreaterThan(0);
    expect(system.every((p) => p.permissions?.edit === false)).toBe(true);
    const own = presets.filter((p) => p.layer === "org");
    expect(own.map((p) => p.name)).toEqual(expect.arrayContaining(["Studio rules", "Studio trades", "Studio names"]));
    const rules = own.find((p) => p.name === "Studio rules")!;
    expect(rules).toMatchObject({ kind: "rule_set", latestPublishedVersion: { number: 1, status: "published" }, draft: { status: "draft" }, permissions: { edit: true } });
    expect(rules.updatedBy?.name).toBeTruthy();
    // Filters by kind and layer.
    expect((await list(ivana, { kind: "dictionary", layer: "org" })).every((p) => p.kind === "dictionary" && p.layer === "org")).toBe(true);
  });

  it("creates a patch on As modelled: a draft that extends it, checked, flattened", async () => {
    const asModelled = await systemVersionId("rule_set", "as-modelled");
    const { data: preset, response } = await create(ivana, { kind: "rule_set", name: `Office rules ${slug("r")}`, basedOn: "Our rulebook", start: { mode: "patch", fromVersionId: asModelled } });
    expect(response.status).toBe(201);
    expect(preset).toMatchObject({ layer: "org", kind: "rule_set", basedOn: "Our rulebook", draft: { status: "draft", number: null, problemCount: 0 }, permissions: { edit: true } });
    expect(preset!.latestPublishedVersion).toBeUndefined();
    const draft = (await client(ivana.token).GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: preset!.draft!.id } } })).data!;
    expect(draft).toMatchObject({ status: "draft", extendsVersionId: asModelled, problems: [] });
    expect((draft.doc as { extends: string; id: string }).extends).toBe("as-modelled");
    expect((draft.doc as { id: string }).id).toBe(preset!.slug);
    expect((draft.flattened as { items: unknown[] }).items.length).toBeGreaterThan(0);
  });

  it("creates empty presets and copies of any kind, with unique slugs", async () => {
    const name = `Copy ${slug("c")}`;
    const fromVersionId = await systemVersionId("classification", "demo-trades");
    const first = (await create(ivana, { kind: "classification", name, start: { mode: "copy", fromVersionId } })).data!;
    const second = (await create(ivana, { kind: "classification", name, start: { mode: "copy", fromVersionId } })).data!;
    expect(second.slug).not.toBe(first.slug);
    const doc = (await client(ivana.token).GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: first.draft!.id } } })).data!.doc as {
      codeList: { id: string; name: string; codes: unknown[] };
      map: { codeList: string };
    };
    expect(doc.codeList).toMatchObject({ id: first.slug, name });
    expect(doc.codeList.codes.length).toBeGreaterThan(0);
    expect(doc.map.codeList).toBe(first.slug);

    const empty = (await create(ivana, { kind: "dictionary", name: `Names ${slug("d")}`, start: { mode: "empty" } })).data!;
    const emptyDoc = (await client(ivana.token).GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: empty.draft!.id } } })).data!.doc as { layer: string; entries: unknown[] };
    expect(emptyDoc).toMatchObject({ layer: "company", entries: [] });

    const badPatch = await create(ivana, { kind: "classification", name: "Nope", start: { mode: "patch", fromVersionId } });
    expect(badPatch.response.status).toBe(400);
    const wrongKind = await create(ivana, { kind: "rule_set", name: "Nope", start: { mode: "copy", fromVersionId } });
    expect(wrongKind.response.status).toBe(400);
  });

  it("members view and pick org presets but every edit is 403 (F10-AC6)", async () => {
    const presets = await list(marko);
    const rules = presets.find((p) => p.name === "Studio rules")!;
    expect(rules.permissions?.edit).toBe(false);
    const api = client(marko.token);
    expect((await create(marko, { kind: "dictionary", name: "Mine", start: { mode: "empty" } })).response.status).toBe(403);
    expect((await api.PATCH("/presets/{presetId}", { params: { path: { presetId: rules.id } }, body: { name: "Mine" } })).response.status).toBe(403);
    expect((await api.POST("/presets/{presetId}/archive", { params: { path: { presetId: rules.id } } })).response.status).toBe(403);
    expect((await api.PUT("/presets/{presetId}/draft", { params: { path: { presetId: rules.id } }, body: { doc: {} } })).response.status).toBe(403);
    expect((await api.DELETE("/presets/{presetId}/draft", { params: { path: { presetId: rules.id } } })).response.status).toBe(403);
    // Reading is allowed.
    expect((await api.GET("/presets/{presetId}/versions", { params: { path: { presetId: rules.id } } })).response.status).toBe(200);
    expect((await api.GET("/presets/{presetId}/usage", { params: { path: { presetId: rules.id } } })).response.status).toBe(200);
  });

  it("system presets can't be changed, only copied", async () => {
    const system = (await list(ivana, { layer: "system" }))[0]!;
    const api = client(ivana.token);
    expect((await api.PATCH("/presets/{presetId}", { params: { path: { presetId: system.id } }, body: { name: "Mine" } })).response.status).toBe(403);
    expect((await api.POST("/presets/{presetId}/archive", { params: { path: { presetId: system.id } } })).response.status).toBe(403);
  });

  it("renames, describes and stars a preset; archiving hides it from the lists and stops edits", async () => {
    const api = client(ivana.token);
    const preset = (await create(ivana, { kind: "dictionary", name: `Archive me ${slug("a")}`, start: { mode: "empty" } })).data!;
    const updated = (await api.PATCH("/presets/{presetId}", { params: { path: { presetId: preset.id } }, body: { name: `${preset.name} (renamed)`, description: "Words", starred: true } })).data!;
    expect(updated).toMatchObject({ name: `${preset.name} (renamed)`, description: "Words", starred: true });
    const archived = (await api.POST("/presets/{presetId}/archive", { params: { path: { presetId: preset.id } } })).data!;
    expect(archived).toMatchObject({ archived: true, permissions: { edit: false } });
    expect(archived.starred).toBeUndefined();
    expect((await list(ivana)).some((p) => p.id === preset.id)).toBe(false);
    expect((await list(ivana, { includeArchived: true })).some((p) => p.id === preset.id)).toBe(true);
    const edit = await api.PATCH("/presets/{presetId}", { params: { path: { presetId: preset.id } }, body: { name: "Again" } });
    expect(edit.response.status).toBe(409);
    expect((edit.error as unknown as { code: string }).code).toBe("preset_archived");
    // Archiving twice is fine; the preset and its versions stay readable.
    expect((await api.POST("/presets/{presetId}/archive", { params: { path: { presetId: preset.id } } })).response.status).toBe(200);
    expect((await api.GET("/presets/{presetId}", { params: { path: { presetId: preset.id } } })).data!.archived).toBe(true);
  });

  it("saves a draft with the engine's problems, refuses a stale ETag, and discards it", async () => {
    const api = client(ivana.token);
    const asModelled = await systemVersionId("rule_set", "as-modelled");
    const preset = (await create(ivana, { kind: "rule_set", name: `Draft ${slug("d")}`, start: { mode: "patch", fromVersionId: asModelled } })).data!;
    const first = await api.GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: preset.draft!.id } } });
    const etag = first.response.headers.get("ETag")!;
    expect(etag).toBe(preset.draft!.etag);
    const doc = { ...(first.data!.doc as Record<string, unknown>), params: { wall_opening_threshold: { value: 0.5 }, excavation_formula: { value: "1 +" } } };
    const saved = await api.PUT("/presets/{presetId}/draft", { params: { path: { presetId: preset.id }, header: { "If-Match": etag } }, body: { doc } });
    expect(saved.response.status).toBe(200);
    expect(saved.data!.problems.length).toBeGreaterThan(0);
    const newEtag = saved.response.headers.get("ETag")!;
    expect(newEtag).not.toBe(etag);
    const stale = await api.PUT("/presets/{presetId}/draft", { params: { path: { presetId: preset.id }, header: { "If-Match": etag } }, body: { doc } });
    expect(stale.response.status).toBe(409);
    expect((stale.error as { code: string }).code).toBe("draft_conflict");
    expect((await api.DELETE("/presets/{presetId}/draft", { params: { path: { presetId: preset.id } } })).response.status).toBe(204);
    const after = (await api.GET("/presets/{presetId}", { params: { path: { presetId: preset.id } } })).data!;
    expect(after.draft).toBeUndefined();
    expect((await api.GET("/presets/{presetId}/versions", { params: { path: { presetId: preset.id } } })).data).toEqual([]);
    // Restoring a version as a draft (F10 §5) is a save without If-Match.
    const restored = await api.PUT("/presets/{presetId}/draft", { params: { path: { presetId: preset.id } }, body: { doc: first.data!.doc } });
    expect(restored.data).toMatchObject({ status: "draft", problems: [] });
  });

  it("lists the BoQ revisions that use a preset, in projects the caller sees", async () => {
    const studioRules = (await list(olivia, { kind: "rule_set", layer: "org" })).find((p) => p.name === "Studio rules")!;
    const api = client(olivia.token);
    const project = (await api.POST("/orgs/{orgId}/projects", { params: { path: { orgId: studioId } }, body: { name: `Usage ${slug("u")}` } })).data!;
    const before = studioRules.usedByCount ?? 0;
    const boq = (await api.POST("/projects/{projectId}/boqs", { params: { path: { projectId: project.id } }, body: { name: "Tender", inputs: { ruleSetVersionId: studioRules.latestPublishedVersion!.id } } })).data!;
    const usage = (await api.GET("/presets/{presetId}/usage", { params: { path: { presetId: studioRules.id } } })).data!;
    expect(usage).toContainEqual(expect.objectContaining({ projectId: project.id, projectName: project.name, boqId: boq.id, boqName: "Tender", revisionLabel: "A", presetVersionNumber: 1 }));
    expect((await api.GET("/presets/{presetId}", { params: { path: { presetId: studioRules.id } } })).data!.usedByCount).toBe(before + 1);
    // Marko isn't in that project: he doesn't see the row.
    const markoUsage = (await client(marko.token).GET("/presets/{presetId}/usage", { params: { path: { presetId: studioRules.id } } })).data!;
    expect(markoUsage.some((u) => u.projectId === project.id)).toBe(false);
  });

  it("project presets belong to the project's leads and estimators", async () => {
    const api = client(olivia.token);
    const project = (await api.POST("/orgs/{orgId}/projects", { params: { path: { orgId: studioId } }, body: { name: `Project lib ${slug("p")}` } })).data!;
    const created = await create(olivia, { kind: "dictionary", name: "Project names", projectId: project.id, start: { mode: "empty" } });
    expect(created.response.status).toBe(201);
    expect(created.data).toMatchObject({ layer: "project", projectId: project.id });
    // Listed with the project, not without it.
    expect((await list(olivia, { projectId: project.id, layer: "project" })).some((p) => p.id === created.data!.id)).toBe(true);
    expect((await list(olivia)).some((p) => p.id === created.data!.id)).toBe(false);
    // Ivana edits the org's Library but isn't on this project.
    expect((await create(ivana, { kind: "dictionary", name: "Not mine", projectId: project.id, start: { mode: "empty" } })).response.status).toBe(404);
  });

  it("org presets count against libraryOrgPresets per kind (402)", async () => {
    if (TARGET !== "mock") return;
    const owner = await signUp("Library Owner", uniqueEmail("library"));
    const { data: org } = await client(owner.token).POST("/orgs", { body: { name: "Library Firm", slug: slug("library") } });
    const ents = (await client(owner.token).GET("/orgs/{orgId}/entitlements", { params: { path: { orgId: org!.id } } })).data!;
    const max = ents.limits.libraryOrgPresets!;
    for (let i = 0; i < max; i++) expect((await create(owner, { kind: "dictionary", name: `N${i}`, start: { mode: "empty" } }, org!.id)).response.status).toBe(201);
    const over = await create(owner, { kind: "dictionary", name: "One too many", start: { mode: "empty" } }, org!.id);
    expect(over.response.status).toBe(402);
    expect((over.error as { details?: Record<string, unknown> }).details).toMatchObject({ limit: "libraryOrgPresets", current: max, max });
    // Another kind still fits.
    expect((await create(owner, { kind: "rule_set", name: "Our rules", start: { mode: "empty" } }, org!.id)).response.status).toBe(201);
  });
});
