/**
 * F06 §6–7 (FE-011): line edits (`LineOverride`, one row per line key, carried to later
 * revisions) and manual lines (`ManualItem`), per BoQ. They are written to the working version's
 * BoQ and apply on the next run (the fakes in `engine/fakes/line-edits.ts`); `checkPreset` runs the
 * engine's check, e.g. for a manual line's formula.
 */
import { audit } from "../audit.js";
import { nowIso } from "../clock.js";
import { codeListsOf } from "../codes.js";
import { EngineUnavailable, engine, type PresetFolder } from "../engine/engine.js";
import { emit } from "../events.js";
import { conflict, HttpError, notFound } from "../http.js";
import { newId } from "../ids.js";
import { projectAudience } from "../jobs.js";
import { visibleProject, writableProject } from "../projects.js";
import { json, noContent, type Handlers } from "../router.js";
import { db, persist, type BoqRec, type ManualItemRec, type OverrideRec, type ProjectRec, type UserRec } from "../store.js";
import { enginePresetId, writeBlock } from "./boqs.js";

type OverrideInput = Omit<OverrideRec, "id" | "boqId" | "createdBy" | "createdAt">;
type ManualInput = { item: ManualItemRec["item"]; codes?: Record<string, string>; sortHint?: string };

const userRef = (id: string) => {
  const u = db().users.find((x) => x.id === id);
  return u ? { id: u.id, name: u.name, email: u.email } : { id, name: "Unknown" };
};

const overrideView = (o: OverrideRec) => {
  const { createdBy, ...rest } = o;
  return { ...rest, createdBy: userRef(createdBy) };
};
const manualView = (m: ManualItemRec) => {
  const { createdBy, ...rest } = m;
  return { ...rest, createdBy: userRef(createdBy) };
};

function boqFor(user: UserRec, boqId: string) {
  const boq = db().boqs.find((b) => b.id === boqId);
  if (!boq) throw notFound("BoQ");
  return { boq, ...visibleProject(user, boq.projectId) };
}

/** Edits go to the working version of an active BoQ, by leads and estimators (F06 §6, P20). */
function editableBoq(user: UserRec, boqId: string) {
  const found = boqFor(user, boqId);
  writableProject(user, found.project.id, "editLines");
  const revision = db().revisions.find((r) => r.id === found.boq.currentRevisionId)!;
  const blocked = writeBlock(found.boq, revision);
  if (blocked) throw blocked;
  return { ...found, revision };
}

function changed(project: ProjectRec, boq: BoqRec, entityType: "override" | "manualItem") {
  const userIds = projectAudience(project.id);
  emit("entity.changed", { entityType, entityId: boq.id, projectId: project.id, change: "updated" }, { userIds });
  emit("entity.changed", { entityType: "boq", entityId: boq.id, projectId: project.id, change: "updated" }, { userIds });
}

function checkCodes(boq: BoqRec, codes: Record<string, string> | undefined) {
  if (!codes || !Object.keys(codes).length) return;
  const revision = db().revisions.find((r) => r.id === boq.currentRevisionId)!;
  const lists = codeListsOf(revision.inputs);
  for (const [system, code] of Object.entries(codes)) {
    if (!lists.get(system)?.has(code)) throw new HttpError(400, "unknown_code", `"${code}" is not a code of ${system} in this BoQ's classifications.`, { system, code });
  }
}

/** F06 §6: a reason for quantities and exclusions; a unit only with a quantity; at least one edit. */
function normalizeOverride(boq: BoqRec, input: OverrideInput): OverrideInput {
  if (!input.lineKey.trim()) throw new HttpError(400, "invalid_body", "A line edit needs the line key.");
  const o: OverrideInput = { lineKey: input.lineKey };
  if (input.quantity !== undefined) {
    if (input.quantity !== null && (!Number.isFinite(input.quantity) || input.quantity < 0)) throw new HttpError(400, "invalid_quantity", "A quantity is a number of zero or more.", { lineKey: input.lineKey });
    o.quantity = input.quantity;
  }
  if (input.unit !== undefined) {
    if (!input.unit.trim()) throw new HttpError(400, "invalid_body", "The unit can't be empty.", { lineKey: input.lineKey });
    if (input.quantity === undefined) throw conflict("unit_needs_quantity", "A new unit needs a new quantity too: a number in one unit doesn't become another by relabelling.", { lineKey: input.lineKey });
    o.unit = input.unit.trim();
  }
  if (input.description !== undefined) {
    if (!input.description.trim()) throw new HttpError(400, "invalid_body", "The description can't be empty.", { lineKey: input.lineKey });
    o.description = input.description.trim();
  }
  if (input.codes && Object.keys(input.codes).length) {
    checkCodes(boq, input.codes);
    o.codes = input.codes;
  }
  if (input.sortAfter !== undefined) o.sortAfter = input.sortAfter;
  if (input.excluded === true) o.excluded = true;
  const reason = input.reason?.trim();
  if ((o.quantity !== undefined || o.excluded) && !reason) throw new HttpError(400, "reason_required", "Say why: a reason is needed for a changed quantity or an exclusion.", { lineKey: input.lineKey });
  if (reason) o.reason = reason;
  if (Object.keys(o).length === 1 + (o.reason ? 1 : 0)) throw new HttpError(400, "invalid_body", "Nothing to edit: restore the line instead.", { lineKey: input.lineKey });
  return o;
}

function normalizeManual(boq: BoqRec, input: ManualInput, exceptId?: string): ManualInput {
  const item = input.item;
  if (!item.id.trim()) throw new HttpError(400, "invalid_body", "A manual line needs an id.");
  if (typeof item.description === "string" && !item.description.trim()) throw new HttpError(400, "invalid_body", "A manual line needs a description.");
  if (db().manualItems.some((m) => m.boqId === boq.id && m.item.id === item.id && m.id !== exceptId)) throw conflict("duplicate_id", "Another manual line of this BoQ has this id.", { id: item.id });
  checkCodes(boq, input.codes);
  return { item, ...(input.codes && Object.keys(input.codes).length ? { codes: input.codes } : {}), ...(input.sortHint ? { sortHint: input.sortHint } : {}) };
}

function upsertOverride(boq: BoqRec, o: OverrideInput, user: UserRec): OverrideRec {
  const at = nowIso();
  const existing = db().overrides.find((x) => x.boqId === boq.id && x.lineKey === o.lineKey);
  const rec: OverrideRec = { id: existing?.id ?? newId(), boqId: boq.id, ...o, createdBy: user.id, createdAt: at };
  if (existing) db().overrides.splice(db().overrides.indexOf(existing), 1, rec);
  else db().overrides.push(rec);
  return rec;
}

function addManual(boq: BoqRec, m: ManualInput, user: UserRec): ManualItemRec {
  const rec: ManualItemRec = { id: newId(), boqId: boq.id, ...m, createdBy: user.id, createdAt: nowIso() };
  db().manualItems.push(rec);
  return rec;
}

const touch = (boq: BoqRec) => {
  boq.updatedAt = nowIso();
  persist();
};

const FOLDER: Record<string, PresetFolder> = { rule_set: "rules", classification: "classifications", dictionary: "dictionaries" };

export const adjustmentHandlers: Handlers = {
  listOverrides({ user, params }) {
    const { boq } = boqFor(user!, params.boqId!);
    return json(db().overrides.filter((o) => o.boqId === boq.id).map(overrideView));
  },

  setOverride({ user, params, body }) {
    const { boq, project } = editableBoq(user!, params.boqId!);
    const rec = upsertOverride(boq, normalizeOverride(boq, body as OverrideInput), user!);
    touch(boq);
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "line.edited", subjectType: "boq", subjectId: boq.id, data: { boq: boq.name, lineKey: rec.lineKey, fields: Object.keys(rec).filter((k) => !["id", "boqId", "lineKey", "createdBy", "createdAt", "reason"].includes(k)) } });
    changed(project, boq, "override");
    return json(overrideView(rec));
  },

  removeOverride({ user, params }) {
    const rec = db().overrides.find((o) => o.id === params.overrideId);
    if (!rec) throw notFound("line edit");
    const { boq, project } = editableBoq(user!, rec.boqId);
    db().overrides.splice(db().overrides.indexOf(rec), 1);
    touch(boq);
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "line.restored", subjectType: "boq", subjectId: boq.id, data: { boq: boq.name, lineKey: rec.lineKey } });
    changed(project, boq, "override");
    return noContent();
  },

  /** All or nothing: everything is checked before anything is written. */
  applyLineEdits({ user, params, body }) {
    const { boq, project } = editableBoq(user!, params.boqId!);
    const b = body as { overrides?: OverrideInput[]; removeOverrideLineKeys?: string[]; manualItems?: ManualInput[] };
    const overrides = (b.overrides ?? []).map((o) => normalizeOverride(boq, o));
    const keys = new Set<string>();
    for (const o of overrides) {
      if (keys.has(o.lineKey)) throw new HttpError(400, "invalid_body", "A line is edited twice in one request.", { lineKey: o.lineKey });
      keys.add(o.lineKey);
    }
    const manual = (b.manualItems ?? []).map((m) => normalizeManual(boq, m));
    if (new Set(manual.map((m) => m.item.id)).size !== manual.length) throw conflict("duplicate_id", "Two manual lines have the same id.");
    const remove = new Set(b.removeOverrideLineKeys ?? []);
    db().overrides = db().overrides.filter((o) => !(o.boqId === boq.id && remove.has(o.lineKey)));
    const written = overrides.map((o) => upsertOverride(boq, o, user!));
    const added = manual.map((m) => addManual(boq, m, user!));
    touch(boq);
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "line.edited", subjectType: "boq", subjectId: boq.id, data: { boq: boq.name, lines: written.length, restored: remove.size, manualLines: added.length } });
    changed(project, boq, "override");
    if (added.length) changed(project, boq, "manualItem");
    return json({ overrides: written.map(overrideView), manualItems: added.map(manualView) });
  },

  listManualItems({ user, params }) {
    const { boq } = boqFor(user!, params.boqId!);
    return json(db().manualItems.filter((m) => m.boqId === boq.id).map(manualView));
  },

  addManualItem({ user, params, body }) {
    const { boq, project } = editableBoq(user!, params.boqId!);
    const rec = addManual(boq, normalizeManual(boq, body as ManualInput), user!);
    touch(boq);
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "manual_line.added", subjectType: "boq", subjectId: boq.id, data: { boq: boq.name, id: rec.item.id } });
    changed(project, boq, "manualItem");
    return json(manualView(rec), 201);
  },

  updateManualItem({ user, params, body }) {
    const rec = db().manualItems.find((m) => m.id === params.itemId);
    if (!rec) throw notFound("manual line");
    const { boq, project } = editableBoq(user!, rec.boqId);
    const next = normalizeManual(boq, body as ManualInput, rec.id);
    rec.item = next.item;
    if (next.codes) rec.codes = next.codes;
    else delete rec.codes;
    if (next.sortHint) rec.sortHint = next.sortHint;
    else delete rec.sortHint;
    touch(boq);
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "manual_line.updated", subjectType: "boq", subjectId: boq.id, data: { boq: boq.name, id: rec.item.id } });
    changed(project, boq, "manualItem");
    return json(manualView(rec));
  },

  removeManualItem({ user, params }) {
    const rec = db().manualItems.find((m) => m.id === params.itemId);
    if (!rec) throw notFound("manual line");
    const { boq, project } = editableBoq(user!, rec.boqId);
    db().manualItems.splice(db().manualItems.indexOf(rec), 1);
    touch(boq);
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "manual_line.removed", subjectType: "boq", subjectId: boq.id, data: { boq: boq.name, id: rec.item.id } });
    changed(project, boq, "manualItem");
    return noContent();
  },

  /** The engine's check of a document (nothing saved); a patch's parent comes from `parentVersionIds`. */
  async checkPreset({ body }) {
    const b = body as { kind: string; doc: Record<string, unknown>; parentVersionIds?: string[] };
    const folder = FOLDER[b.kind];
    if (!folder) throw new HttpError(400, "invalid_body", `The engine checks rule sets, classifications and dictionaries, not ${b.kind}.`);
    const doc = structuredClone(b.doc ?? {});
    try {
      const parents = (b.parentVersionIds ?? []).map((id) => {
        const v = db().presetVersions.find((x) => x.id === id);
        if (!v) throw new HttpError(400, "invalid_body", "A parent version doesn't exist.", { versionId: id });
        return v;
      });
      // The nearest parent is the one the document extends, under the engine's id for it.
      if (parents.length) doc.extends = await enginePresetId(parents[parents.length - 1]!);
      return json(await engine().checkPreset(folder, doc));
    } catch (e) {
      if (e instanceof EngineUnavailable) throw new HttpError(503, "engine_unavailable", "The processing service is not available. Try again.");
      throw e;
    }
  },
};
