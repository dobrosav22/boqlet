/**
 * F10 Library, reading side (FE-008 needs it for the BoQ setup pickers): presets visible to an org
 * (system, org, and one project's), their versions. Editing, publishing and preview come with the
 * Library tasks (FE-021…FE-025).
 */
import { notFound } from "../http.js";
import { memberOrg, orgPermissions } from "../permissions.js";
import { visibleProject } from "../projects.js";
import { json, type Handlers } from "../router.js";
import { db, type PresetRec, type PresetVersionRec, type UserRec } from "../store.js";

const userRef = (id?: string) => {
  const u = id ? db().users.find((x) => x.id === id) : undefined;
  return u ? { id: u.id, name: u.name, email: u.email } : undefined;
};

export const presetVersionsOf = (presetId: string) => db().presetVersions.filter((v) => v.presetId === presetId);

export function latestPublished(presetId: string): PresetVersionRec | undefined {
  return presetVersionsOf(presetId)
    .filter((v) => v.status === "published")
    .sort((a, b) => (b.number ?? 0) - (a.number ?? 0))[0];
}

export function versionInfo(v: PresetVersionRec) {
  return {
    id: v.id,
    number: v.number,
    status: v.status,
    problemCount: v.problems.length,
    ...(v.publishedAt ? { publishedAt: v.publishedAt } : {}),
    updatedAt: v.publishedAt ?? v.createdAt,
  };
}

/** Revisions whose inputs name one of the preset's versions. */
function usedByCount(presetId: string) {
  const ids = new Set(presetVersionsOf(presetId).map((v) => v.id));
  return db().revisions.filter((r) => {
    const i = r.inputs;
    return [i.ruleSetVersionId, ...i.classificationVersionIds, ...i.dictionaryVersionIds, i.federationVersionId, i.resolutionVersionId].some((id) => id && ids.has(id));
  }).length;
}

export function presetView(p: PresetRec, canEdit: boolean) {
  const latest = latestPublished(p.id);
  const draft = presetVersionsOf(p.id).find((v) => v.status === "draft");
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
    ...(p.available !== undefined ? { available: p.available } : {}),
    ...(p.unavailableReason ? { unavailableReason: p.unavailableReason } : {}),
    ...(latest ? { latestPublishedVersion: versionInfo(latest) } : {}),
    ...(draft ? { draft: versionInfo(draft) } : {}),
    usedByCount: usedByCount(p.id),
    archived: p.archived,
    permissions: { edit: canEdit && p.layer !== "system" && !p.archived },
    updatedAt: p.updatedAt,
    ...(userRef(p.updatedBy) ? { updatedBy: userRef(p.updatedBy) } : {}),
  };
}

/** A preset the user may read: system ones, their orgs' ones, and those of projects they see. */
export function visiblePreset(user: UserRec, presetId: string) {
  const preset = db().presets.find((p) => p.id === presetId);
  if (!preset) throw notFound("preset");
  if (preset.layer === "system") return { preset, canEdit: false };
  const { role } = memberOrg(user, preset.orgId!);
  if (preset.projectId) {
    const { role: projectRole } = visibleProject(user, preset.projectId);
    return { preset, canEdit: projectRole === "lead" || projectRole === "estimator" };
  }
  return { preset, canEdit: orgPermissions(role).editLibrary === true };
}

export const presetHandlers: Handlers = {
  listPresets({ user, params, query }) {
    const { org, role } = memberOrg(user!, params.orgId!);
    const projectId = query.projectId as string | undefined;
    let projectEdit = false;
    if (projectId) {
      const { role: projectRole } = visibleProject(user!, projectId);
      projectEdit = projectRole === "lead" || projectRole === "estimator";
    }
    const orgEdit = orgPermissions(role).editLibrary === true;
    const items = db()
      .presets.filter((p) => p.layer === "system" || (p.orgId === org.id && (p.projectId === null || p.projectId === projectId)))
      .filter((p) => !query.kind || p.kind === query.kind)
      .filter((p) => !query.layer || p.layer === query.layer)
      .filter((p) => query.includeArchived === true || !p.archived)
      .map((p) => presetView(p, p.layer === "project" ? projectEdit : orgEdit));
    return json(items);
  },

  getPreset({ user, params }) {
    const { preset, canEdit } = visiblePreset(user!, params.presetId!);
    return json(presetView(preset, canEdit));
  },

  listPresetVersions({ user, params }) {
    const { preset } = visiblePreset(user!, params.presetId!);
    return json(
      presetVersionsOf(preset.id)
        .sort((a, b) => (b.number ?? Number.MAX_SAFE_INTEGER) - (a.number ?? Number.MAX_SAFE_INTEGER))
        .map(versionInfo),
    );
  },
};
