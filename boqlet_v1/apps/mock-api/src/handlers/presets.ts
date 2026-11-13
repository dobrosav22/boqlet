/**
 * F10 Library: presets visible to an org (system, org, and one project's), their versions, and the
 * Library shell's writes (FE-021): create (empty / copy / patch), details, star, archive, where used,
 * and the draft (save with ETag and the engine's check, discard); publish and preview (FE-025).
 */
import { audit } from "../audit.js";
import { putBlob, signedUrl } from "../blobs.js";
import { nowIso } from "../clock.js";
import { EngineUnavailable } from "../engine/engine.js";
import { readTemplate, writeTemplate, type TemplateInput } from "../engine/fakes/preset-template.js";
import { previewResult, previewRun, type PreviewInputs } from "../engine/fakes/preview.js";
import { withSetupMarkers } from "../engine/fakes/setup-markers.js";
import { createJob, jobView, runJob } from "../jobs.js";
import { emit } from "../events.js";
import { conflict, forbidden, HttpError, limitReached, notFound } from "../http.js";
import { newId } from "../ids.js";
import { memberOrg, orgPermissions } from "../permissions.js";
import { blankDoc, blankPatch, checkDoc, docIdOf, renamed, slugify, uniqueSlug } from "../preset-docs.js";
import { projectRoleOf, visibleProject, writableProject } from "../projects.js";
import { json, noContent, type Handlers } from "../router.js";
import { db, persist, type BoqRec, type PresetRec, type PresetVersionRec, type ProjectRec, type RevisionInputs, type RevisionRec, type UserRec } from "../store.js";
import { planLimits } from "./orgs.js";
import { minutesUsed, revisionLabel } from "./boqs.js";
import { projectDictionaryVersionIds } from "./models.js";

const userRef = (id?: string) => {
  const u = id ? db().users.find((x) => x.id === id) : undefined;
  return u ? { id: u.id, name: u.name, email: u.email } : undefined;
};

const engineDown = () => new HttpError(503, "engine_unavailable", "The processing service is not available. Try again.");

export const presetVersionsOf = (presetId: string) => db().presetVersions.filter((v) => v.presetId === presetId);

export function latestPublished(presetId: string): PresetVersionRec | undefined {
  return presetVersionsOf(presetId)
    .filter((v) => v.status === "published")
    .sort((a, b) => (b.number ?? 0) - (a.number ?? 0))[0];
}

const draftOf = (presetId: string) => presetVersionsOf(presetId).find((v) => v.status === "draft");

/** A draft's ETag: changes on every save (FE-022 sends it back as `If-Match`). */
export const etagOf = (v: PresetVersionRec) => `"${v.id}.${v.rev ?? 0}"`;

export function versionInfo(v: PresetVersionRec) {
  const publishedBy = userRef(v.publishedBy);
  return {
    id: v.id,
    number: v.number,
    status: v.status,
    ...(v.changeNote ? { changeNote: v.changeNote } : {}),
    problemCount: v.problems.length,
    ...(publishedBy ? { publishedBy } : {}),
    ...(v.publishedAt ? { publishedAt: v.publishedAt } : {}),
    updatedAt: v.publishedAt ?? v.updatedAt ?? v.createdAt,
    ...(v.status === "draft" ? { etag: etagOf(v) } : {}),
  };
}

/** A version with its document (`PresetVersion`); `flattened` for rule-set patches. */
export function presetVersionView(v: PresetVersionRec, flattened?: unknown) {
  return {
    ...versionInfo(v),
    presetId: v.presetId,
    doc: v.doc,
    extendsVersionId: v.extendsVersionId,
    problems: v.problems,
    ...(flattened ? { flattened } : {}),
  };
}

/**
 * Revisions whose inputs name one of the preset's versions, in projects the user can see (of the
 * preset's org, for an org preset), with the version they name.
 */
function usageOf(preset: PresetRec, user: UserRec) {
  const versions = new Map(presetVersionsOf(preset.id).map((v) => [v.id, v]));
  const out: { revision: RevisionRec; version: PresetVersionRec; boq: BoqRec; project: ProjectRec }[] = [];
  for (const revision of db().revisions) {
    const i = revision.inputs;
    const id = [i.ruleSetVersionId, ...i.classificationVersionIds, ...i.dictionaryVersionIds, i.federationVersionId, i.resolutionVersionId].find((x) => x && versions.has(x));
    if (!id) continue;
    const boq = db().boqs.find((x) => x.id === revision.boqId);
    const project = boq && db().projects.find((x) => x.id === boq.projectId);
    if (!boq || !project || (preset.layer !== "system" && project.orgId !== preset.orgId) || !projectRoleOf(project, user.id)) continue;
    out.push({ revision, version: versions.get(id)!, boq, project });
  }
  return out;
}

export function presetView(p: PresetRec, canEdit: boolean, user: UserRec) {
  const latest = latestPublished(p.id);
  const draft = draftOf(p.id);
  const updatedBy = userRef(p.updatedBy);
  return {
    id: p.id,
    orgId: p.orgId,
    projectId: p.projectId,
    kind: p.kind,
    layer: p.layer,
    slug: p.slug,
    name: p.name,
    ...(p.description ? { description: p.description } : {}),
    ...(p.basedOn ? { basedOn: p.basedOn } : {}),
    ...(p.starred ? { starred: true } : {}),
    ...(p.available !== undefined ? { available: p.available } : {}),
    ...(p.unavailableReason ? { unavailableReason: p.unavailableReason } : {}),
    ...(latest ? { latestPublishedVersion: versionInfo(latest) } : {}),
    ...(draft ? { draft: versionInfo(draft) } : {}),
    usedByCount: usageOf(p, user).length,
    archived: p.archived,
    permissions: { edit: canEdit && p.layer !== "system" && !p.archived },
    updatedAt: p.updatedAt,
    ...(updatedBy ? { updatedBy } : {}),
  };
}

/** May the user edit presets of this project (lead, estimator; F10 §11)? */
const projectEditor = (user: UserRec, projectId: string) => {
  const { role } = visibleProject(user, projectId);
  return role === "lead" || role === "estimator";
};

/** A preset the user may read: system ones, their orgs' ones, and those of projects they see. */
export function visiblePreset(user: UserRec, presetId: string) {
  const preset = db().presets.find((p) => p.id === presetId);
  if (!preset) throw notFound("preset");
  if (preset.layer === "system") return { preset, canEdit: false };
  const { role } = memberOrg(user, preset.orgId!);
  if (preset.projectId) return { preset, canEdit: projectEditor(user, preset.projectId) };
  return { preset, canEdit: orgPermissions(role).editLibrary === true };
}

/** A preset the user may change: never a system one, never an archived one (F10 §10, §11). */
function editablePreset(user: UserRec, presetId: string) {
  const found = visiblePreset(user, presetId);
  if (found.preset.layer === "system") throw forbidden("system preset");
  if (!found.canEdit) throw forbidden(found.preset.projectId ? "lead|estimator" : "owner|admin|library_editor");
  if (found.preset.archived) throw conflict("preset_archived", "The preset is archived.");
  return found;
}

/** Org members, or one project's audience, are told a preset changed. */
function changed(preset: PresetRec, change: "created" | "updated" | "deleted") {
  const userIds = db()
    .memberships.filter((m) => m.orgId === preset.orgId)
    .map((m) => m.userId);
  emit("entity.changed", { entityType: "preset", entityId: preset.id, change, ...(preset.projectId ? { projectId: preset.projectId } : {}) }, { userIds });
}

const auditPreset = (user: UserRec, preset: PresetRec, action: string, data: Record<string, unknown> = {}) =>
  audit({ orgId: preset.orgId, projectId: preset.projectId, actorId: user.id, action, subjectType: "preset", subjectId: preset.id, data: { name: preset.name, kind: preset.kind, ...data } });

/** Runs the engine's check on a draft and stores its problems. */
async function check(preset: PresetRec, version: PresetVersionRec) {
  try {
    version.problems = (await checkDoc(preset.kind, version.doc, version.extendsVersionId)).problems;
  } catch (e) {
    if (e instanceof EngineUnavailable) throw engineDown();
    throw e;
  }
}

/** What the template fake needs for a preset's document (F10 §14). */
async function templateInput(preset: PresetRec, version: PresetVersionRec | undefined, source: TemplateInput["source"]): Promise<TemplateInput> {
  if (preset.kind !== "rule_set" && preset.kind !== "classification" && preset.kind !== "dictionary") throw new HttpError(400, "no_template", "Templates exist for rule sets, classifications and dictionaries.");
  if (!version) throw conflict("no_draft", "The preset has no draft and no version.");
  const flat = async (doc: unknown, extendsVersionId: string | null) => {
    try {
      return ((await checkDoc("rule_set", doc, extendsVersionId)).flattened ?? doc) as { params?: Record<string, unknown>; items?: { id: string; label?: string }[]; derived?: { id: string; label?: string }[]; manual?: { id: string; description?: string }[] };
    } catch (e) {
      if (e instanceof EngineUnavailable) throw engineDown();
      throw e;
    }
  };
  if (preset.kind === "rule_set") {
    const parent = version.extendsVersionId ? db().presetVersions.find((v) => v.id === version.extendsVersionId) : undefined;
    return { kind: "rule_set", doc: version.doc, effective: await flat(version.doc, version.extendsVersionId), ...(parent ? { parentParams: (await flat(parent.doc, parent.extendsVersionId)).params ?? {} } : {}), source };
  }
  if (preset.kind === "classification") {
    // Codes per line lists the BoQ items of As modelled (the master template every rule set builds on).
    const asModelled = latestPublished(db().presets.find((p) => p.layer === "system" && p.kind === "rule_set" && p.slug === "as-modelled")?.id ?? "");
    const rs = asModelled ? await flat(asModelled.doc, asModelled.extendsVersionId) : {};
    const items = [...(rs.items ?? []), ...(rs.derived ?? [])].map((i) => ({ id: i.id, label: i.label ?? i.id }));
    return { kind: "classification", doc: version.doc, items, source };
  }
  // Meanings: the terms of the dictionaries the org can use (system, its own) and this one's.
  const terms = new Set<string>();
  for (const p of db().presets.filter((x) => x.kind === "dictionary" && (x.layer === "system" || x.orgId === preset.orgId))) {
    const v = latestPublished(p.id);
    for (const t of ((v?.doc as { terms?: { id: string }[] } | undefined)?.terms ?? [])) terms.add(t.id);
  }
  return { kind: "dictionary", doc: version.doc, terms: [...terms].sort(), source };
}

export const presetHandlers: Handlers = {
  listPresets({ user, params, query }) {
    const { org, role } = memberOrg(user!, params.orgId!);
    const projectId = query.projectId as string | undefined;
    const projectEdit = projectId ? projectEditor(user!, projectId) : false;
    const orgEdit = orgPermissions(role).editLibrary === true;
    const items = db()
      .presets.filter((p) => p.layer === "system" || (p.orgId === org.id && (p.projectId === null || p.projectId === projectId)))
      .filter((p) => !query.kind || p.kind === query.kind)
      .filter((p) => !query.layer || p.layer === query.layer)
      .filter((p) => query.includeArchived === true || !p.archived)
      .map((p) => presetView(p, p.layer === "project" ? projectEdit : orgEdit, user!));
    return json(items);
  },

  /**
   * F10 §2: an org preset (or a project's, with `projectId`) with a draft version: empty, a copy of
   * any version the user can read, or (rule sets) a patch on one. Org presets count against
   * `libraryOrgPresets`, per kind.
   */
  async createPreset({ user, params, body }) {
    const b = body as { kind: PresetRec["kind"]; name: string; slug?: string; description?: string; basedOn?: string; projectId?: string; start: { mode: "empty" | "copy" | "patch"; fromVersionId?: string } };
    const { org, role } = memberOrg(user!, params.orgId!);
    const name = b.name.trim();
    if (!name) throw new HttpError(400, "invalid_body", "A name is required.");
    if (b.projectId) {
      const { project } = writableProject(user!, b.projectId, "editPresets");
      if (project.orgId !== org.id) throw notFound("project");
    } else {
      if (orgPermissions(role).editLibrary !== true) throw forbidden("owner|admin|library_editor");
      const max = planLimits(org).libraryOrgPresets;
      // Per kind (05-plans-and-limits.md): a free org has one rule set, one classification, one dictionary.
      const current = db().presets.filter((p) => p.orgId === org.id && p.layer === "org" && p.kind === b.kind && !p.archived).length;
      if (max !== undefined && current >= max) throw limitReached("libraryOrgPresets", current, max);
    }

    let source: PresetVersionRec | undefined;
    if (b.start.mode !== "empty") {
      if (!b.start.fromVersionId) throw new HttpError(400, "invalid_body", "Copying or patching needs fromVersionId.");
      source = db().presetVersions.find((v) => v.id === b.start.fromVersionId);
      if (!source) throw notFound("preset version");
      const { preset: from } = visiblePreset(user!, source.presetId);
      if (from.kind !== b.kind) throw new HttpError(400, "invalid_body", `The version is a ${from.kind}, not a ${b.kind}.`);
      if (b.start.mode === "patch" && b.kind !== "rule_set") throw new HttpError(400, "invalid_body", "Only rule sets can be patched.");
    }

    const taken = db()
      .presets.filter((p) => p.kind === b.kind && (p.layer === "system" || p.orgId === org.id))
      .map((p) => p.slug);
    const slug = uniqueSlug(slugify(b.slug?.trim() || name), taken);
    const layer = b.projectId ? "project" : "org";
    let doc: unknown;
    let extendsVersionId: string | null = null;
    if (!source) doc = blankDoc(b.kind, slug, name, layer);
    else if (b.start.mode === "patch") {
      doc = blankPatch(slug, name, docIdOf("rule_set", source.doc) ?? "");
      extendsVersionId = source.id;
    } else {
      doc = renamed(b.kind, source.doc, slug, name);
      extendsVersionId = source.extendsVersionId;
    }

    const at = nowIso();
    const preset: PresetRec = {
      id: newId(),
      orgId: org.id,
      projectId: b.projectId ?? null,
      kind: b.kind,
      layer,
      slug,
      name,
      ...(b.description?.trim() ? { description: b.description.trim() } : {}),
      ...(b.basedOn?.trim() ? { basedOn: b.basedOn.trim() } : {}),
      archived: false,
      createdAt: at,
      createdBy: user!.id,
      updatedAt: at,
      updatedBy: user!.id,
    };
    const draft: PresetVersionRec = { id: newId(), presetId: preset.id, number: null, status: "draft", doc, extendsVersionId, problems: [], createdAt: at, createdBy: user!.id, updatedAt: at, rev: 0 };
    // A copy of a published version is checked already; anything else is checked now.
    if (b.start.mode === "copy" && source) draft.problems = [...source.problems];
    else await check(preset, draft);
    db().presets.push(preset);
    db().presetVersions.push(draft);
    persist();
    auditPreset(user!, preset, "preset.created", { mode: b.start.mode });
    changed(preset, "created");
    return json(presetView(preset, true, user!), 201);
  },

  getPreset({ user, params }) {
    const { preset, canEdit } = visiblePreset(user!, params.presetId!);
    return json(presetView(preset, canEdit, user!));
  },

  updatePreset({ user, params, body }) {
    const { preset } = editablePreset(user!, params.presetId!);
    const b = body as { name?: string; description?: string; basedOn?: string; starred?: boolean };
    if (b.name !== undefined) {
      if (!b.name.trim()) throw new HttpError(400, "invalid_body", "A name is required.");
      preset.name = b.name.trim();
    }
    // Empty text clears an optional field.
    if (b.description !== undefined) preset.description = b.description.trim() || undefined;
    if (b.basedOn !== undefined) preset.basedOn = b.basedOn.trim() || undefined;
    if (b.starred !== undefined) preset.starred = b.starred || undefined;
    preset.updatedAt = nowIso();
    preset.updatedBy = user!.id;
    persist();
    auditPreset(user!, preset, "preset.updated", { fields: Object.keys(b) });
    changed(preset, "updated");
    return json(presetView(preset, true, user!));
  },

  /** F10 §10: hidden from pickers; runs and saved versions keep their snapshots. Archiving twice is a no-op. */
  archivePreset({ user, params }) {
    const { preset, canEdit } = visiblePreset(user!, params.presetId!);
    if (preset.layer === "system") throw forbidden("system preset");
    if (!canEdit) throw forbidden(preset.projectId ? "lead|estimator" : "owner|admin|library_editor");
    if (!preset.archived) {
      preset.archived = true;
      preset.starred = undefined;
      preset.updatedAt = nowIso();
      preset.updatedBy = user!.id;
      persist();
      auditPreset(user!, preset, "preset.archived");
      changed(preset, "updated");
    }
    return json(presetView(preset, canEdit, user!));
  },

  async getPresetVersion({ user, params }) {
    const version = db().presetVersions.find((v) => v.id === params.presetVersionId);
    if (!version) throw notFound("preset version");
    const { preset } = visiblePreset(user!, version.presetId);
    let flattened: unknown;
    const doc = version.doc as { extends?: string } | null;
    // Every rule set comes flattened (a patch resolved; F16's setup markers merged, the fake until EN-011).
    if (preset.kind === "rule_set" && doc) {
      try {
        // The "Setup markers" fake adds F16's wizard markers to rule sets built on As modelled.
        flattened = withSetupMarkers((await checkDoc("rule_set", doc, version.extendsVersionId)).flattened ?? undefined);
      } catch (e) {
        if (e instanceof EngineUnavailable) throw engineDown();
        flattened = undefined;
      }
    }
    return json(presetVersionView(version, flattened), 200, version.status === "draft" ? { ETag: etagOf(version) } : {});
  },

  listPresetVersions({ user, params }) {
    const { preset } = visiblePreset(user!, params.presetId!);
    return json(
      presetVersionsOf(preset.id)
        .sort((a, b) => (b.number ?? Number.MAX_SAFE_INTEGER) - (a.number ?? Number.MAX_SAFE_INTEGER))
        .map(versionInfo),
    );
  },

  /**
   * F10 §3 and §5 ("restore as draft"): replaces the draft's document, or starts a draft. With
   * `If-Match`, a draft saved since by someone else answers `409 draft_conflict`. Every save runs the
   * engine's check; the problems come back with the draft.
   */
  async saveDraft({ c, user, params, body }) {
    const { preset } = editablePreset(user!, params.presetId!);
    const { doc } = body as { doc: unknown };
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) throw new HttpError(400, "invalid_body", "doc must be an object.");
    const at = nowIso();
    let draft = draftOf(preset.id);
    const ifMatch = c.req.header("If-Match");
    if (draft && ifMatch && ifMatch !== etagOf(draft)) {
      throw conflict("draft_conflict", "Someone saved this draft after you opened it.", { etag: etagOf(draft), updatedAt: draft.updatedAt ?? draft.createdAt });
    }
    const next: PresetVersionRec = draft
      ? { ...draft, doc, updatedAt: at, rev: (draft.rev ?? 0) + 1 }
      : { id: newId(), presetId: preset.id, number: null, status: "draft", doc, extendsVersionId: latestPublished(preset.id)?.extendsVersionId ?? null, problems: [], createdAt: at, createdBy: user!.id, updatedAt: at, rev: 0 };
    // A patch's draft follows its parent's latest published version ("Based on it", F10 §2); a
    // published version keeps the exact parent it was made on (data-model.md).
    const parent = next.extendsVersionId ? db().presetVersions.find((v) => v.id === next.extendsVersionId) : undefined;
    if (parent) next.extendsVersionId = latestPublished(parent.presetId)?.id ?? parent.id;
    await check(preset, next);
    if (draft) Object.assign(draft, next);
    else db().presetVersions.push((draft = next));
    preset.updatedAt = at;
    preset.updatedBy = user!.id;
    persist();
    changed(preset, "updated");
    return json(presetVersionView(draft), 200, { ETag: etagOf(draft) });
  },

  discardDraft({ user, params }) {
    const { preset } = editablePreset(user!, params.presetId!);
    const draft = draftOf(preset.id);
    if (draft) {
      db().presetVersions.splice(db().presetVersions.indexOf(draft), 1);
      preset.updatedAt = nowIso();
      preset.updatedBy = user!.id;
      persist();
      auditPreset(user!, preset, "preset.draft_discarded");
      changed(preset, "updated");
    }
    return noContent();
  },

  /**
   * F10 §4: the draft becomes version n+1, only without problems (checked again now) and with a change
   * note. Projects pinned to a version stay pinned (BR-07).
   */
  async publishDraft({ user, params, body }) {
    const { preset } = editablePreset(user!, params.presetId!);
    const changeNote = String((body as { changeNote?: string }).changeNote ?? "").trim();
    if (!changeNote) throw new HttpError(400, "change_note_required", "Say what changed in this version.");
    const draft = draftOf(preset.id);
    if (!draft) throw conflict("no_draft", "There is no draft to publish.");
    await check(preset, draft);
    if (draft.problems.length) {
      persist();
      throw conflict("draft_has_problems", "Fix the draft's problems before publishing.", { problems: draft.problems });
    }
    const at = nowIso();
    Object.assign(draft, { status: "published", number: (latestPublished(preset.id)?.number ?? 0) + 1, changeNote, publishedAt: at, publishedBy: user!.id });
    preset.updatedAt = at;
    preset.updatedBy = user!.id;
    persist();
    auditPreset(user!, preset, "preset.published", { number: draft.number, changeNote });
    changed(preset, "updated");
    return json(presetVersionView(draft));
  },

  /**
   * F10 §6 (the "Preview" fake until EN-005): the draft (or a version) run on model versions the user
   * can see, with the other inputs from `otherInputs` or the models' project defaults, compared with
   * the latest published version. A `preview` job; its output carries `previewResultUrl`
   * (`PreviewResult`). Nothing is stored for a BoQ; the time counts as processing (BR-62).
   */
  previewPreset({ user, params, body }) {
    const { preset } = visiblePreset(user!, params.presetId!);
    const b = body as { draft?: boolean; presetVersionId?: string; modelVersionIds: string[]; compareWithPublished?: boolean; otherInputs?: Partial<RevisionInputs> };
    if (!b.modelVersionIds.length) throw new HttpError(400, "no_models", "Pick a model version to preview on.");
    const models = b.modelVersionIds.map((id) => {
      const version = db().modelVersions.find((v) => v.id === id);
      const model = version && db().models.find((m) => m.id === version.modelId);
      if (!version || !model) throw notFound("model version");
      const { project } = visibleProject(user!, model.projectId);
      if (version.status !== "ready" || !version.engineModelId) throw conflict("model_not_ready", "A chosen model version is not ready.", { modelVersionId: id });
      return { version, model, project };
    });
    const project = models[0]!.project;
    if (models.some((m) => m.project.id !== project.id)) throw new HttpError(400, "invalid_inputs", "Preview on model versions of one project.");
    if (preset.layer !== "system" && preset.orgId !== project.orgId) throw new HttpError(400, "invalid_inputs", "The model belongs to another organisation.");
    const org = db().orgs.find((o) => o.id === project.orgId)!;
    const maxMinutes = planLimits(org).processingMinutesPerMonth;
    const used = minutesUsed(org.id);
    if (maxMinutes !== undefined && used >= maxMinutes) throw limitReached("processingMinutesPerMonth", Math.ceil(used), maxMinutes);

    const versionRec = (id: string) => db().presetVersions.find((v) => v.id === id);
    let source: PresetVersionRec | undefined;
    if (b.presetVersionId) {
      source = versionRec(b.presetVersionId);
      if (!source || source.presetId !== preset.id) throw notFound("preset version");
    } else source = (b.draft ?? true) ? (draftOf(preset.id) ?? latestPublished(preset.id)) : latestPublished(preset.id);
    if (!source) throw conflict("no_draft", "The preset has no draft and no version to preview.");
    const shown = source;
    const published = latestPublished(preset.id);
    const compareWith = (b.compareWithPublished ?? true) && published && published.id !== shown.id ? published : null;

    const defaults = { ...project.defaults, ...(b.otherInputs ?? {}) } as RevisionInputs;
    const pick = (id: string | null | undefined) => (id ? versionRec(id) : undefined);
    const ruleSet = preset.kind === "rule_set" ? shown : pick(defaults.ruleSetVersionId);
    if (!ruleSet) throw new HttpError(400, "no_rule_set", "The project has no default rule set to preview with.");
    const inputs: PreviewInputs = {
      models: models.map((m) => ({ modelId: m.version.engineModelId!, discipline: m.model.discipline })),
      ruleSet,
      classifications: (defaults.classificationVersionIds ?? []).map(pick).filter((v): v is PresetVersionRec => !!v),
      dictionaries: [...(defaults.dictionaryVersionIds ?? []), ...projectDictionaryVersionIds(project.projectDictionaryId)].map(pick).filter((v): v is PresetVersionRec => !!v),
    };
    const job = createJob({ type: "preview", subjectType: "preset", subjectId: preset.id, projectId: project.id, orgId: org.id, createdBy: user!.id });
    void runJob(job, async (ctx) => {
      const started = Date.now();
      try {
        ctx.progress("rules", 10);
        const after = await previewRun(job.id, "draft", inputs, { preset, doc: shown.doc, extendsVersionId: shown.extendsVersionId });
        if (ctx.cancelled()) return;
        ctx.progress("compare", 60);
        const before = compareWith ? await previewRun(job.id, "published", inputs, { preset, doc: compareWith.doc, extendsVersionId: compareWith.extendsVersionId }) : null;
        const result = previewResult(after, before, compareWith);
        const key = `orgs/${org.id}/previews/${job.id}/preview.json`;
        await putBlob(key, new TextEncoder().encode(JSON.stringify(result)));
        ctx.progress("done", 100);
        return { previewResultUrl: signedUrl(key, "GET", 7 * 24 * 3600).url, presetVersionId: shown.id, lines: result.lines.length, ...(result.compare ? { compare: result.compare } : {}) };
      } catch (e) {
        const code = e instanceof EngineUnavailable ? "engine_unavailable" : "preview_error";
        throw Object.assign(new Error(code === "engine_unavailable" ? "The processing service is not available. Try again." : "The preview could not be made."), { code, retryable: true, cause: e });
      } finally {
        db().usage.push({ orgId: org.id, projectId: project.id, kind: "preview", ms: Date.now() - started, at: nowIso() });
        persist();
      }
    });
    return json(jobView(job), 202);
  },

  /** F10 §14: the preset as an Excel template (302 to the generated workbook's signed URL). */
  async downloadPresetTemplate({ user, params, query }) {
    const { preset } = visiblePreset(user!, params.presetId!);
    const source = ((query.source as string | undefined) ?? "draft") as "draft" | "latest" | "empty";
    const input = await templateInput(preset, source === "latest" ? latestPublished(preset.id) : (draftOf(preset.id) ?? latestPublished(preset.id)), source);
    const key = `orgs/${preset.orgId ?? "system"}/templates/${newId()}/${preset.slug}.xlsx`;
    await putBlob(key, await writeTemplate(input));
    return new Response(null, { status: 302, headers: { Location: signedUrl(key, "GET", 600).url } });
  },

  /**
   * F10 §14 upload back: the proposed draft, the changes against the current draft and the problems
   * by sheet, row and column. Nothing is saved; the app applies the doc as a draft save.
   */
  async importPresetTemplate({ user, params, body }) {
    const { preset } = editablePreset(user!, params.presetId!);
    const file = (body as FormData).get("file");
    if (!file || typeof file === "string") throw new HttpError(400, "invalid_body", 'Send the workbook as the multipart field "file".');
    const input = await templateInput(preset, draftOf(preset.id) ?? latestPublished(preset.id), "draft");
    const out = await readTemplate(input, new Uint8Array(await file.arrayBuffer()));
    if ("error" in out) throw new HttpError(400, "invalid_file", out.error);
    return json(out);
  },

  /** F10 §9: the BoQ revisions that use a version of the preset, in projects the user can see. */
  getPresetUsage({ user, params }) {
    const { preset } = visiblePreset(user!, params.presetId!);
    const rows = [];
    for (const { revision, version, boq, project } of usageOf(preset, user!)) {
      rows.push({
        projectId: project.id,
        projectName: project.name,
        boqId: boq.id,
        boqName: boq.name,
        revisionId: revision.id,
        revisionLabel: revisionLabel(revision.number),
        revisionStatus: revision.status,
        presetVersionNumber: version.number ?? 0,
      });
    }
    return json(rows);
  },
};
