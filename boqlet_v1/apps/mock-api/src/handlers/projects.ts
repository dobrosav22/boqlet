/** F02 projects (FE-006): create, list, read, update, archive, members, project audit. */
import { audit } from "../audit.js";
import { nowIso } from "../clock.js";
import { emit } from "../events.js";
import { conflict, HttpError, limitReached } from "../http.js";
import { newId } from "../ids.js";
import { memberOrg, requireOrgAction, roleIn } from "../permissions.js";
import { activeProjectCount, projectPermissions, projectRoleOf, visibleProject, writableProject } from "../projects.js";
import { json, noContent, type Handlers } from "../router.js";
import { seedId } from "../ids.js";
import { db, persist, type Db, type OrgRec, type ProjectRec, type ProjectRole, type UserRec } from "../store.js";
import { openBlockingQuestions } from "../decisions.js";
import { planLimits } from "./orgs.js";

type Body = Record<string, unknown>;

const userRef = (id?: string) => {
  const u = id ? db().users.find((x) => x.id === id) : undefined;
  return u ? { id: u.id, name: u.name, email: u.email } : undefined;
};

export function projectView(project: ProjectRec, userId: string) {
  const myRole = projectRoleOf(project, userId);
  return {
    ...project,
    ...(myRole ? { myRole } : {}),
    permissions: projectPermissions(project, myRole),
  };
}

function lastActivityAt(projectId: string) {
  const events = db().audit.filter((a) => a.projectId === projectId);
  return events.length ? events.reduce((max, a) => (a.at > max ? a.at : max), events[0]!.at) : undefined;
}

function listItem(project: ProjectRec, userId: string) {
  const last = lastActivityAt(project.id) ?? project.updatedAt;
  // Reviews (FE-031) are counted when they arrive.
  const boqs = db().boqs.filter((b) => b.projectId === project.id && !b.archived);
  const counts = {
    models: db().models.filter((m) => m.projectId === project.id && !m.archived).length,
    boqs: boqs.length,
    blockingQuestions: openBlockingQuestions(project.id),
    revisionsInReview: 0,
    confirmedBoqs: boqs.filter((b) => b.status === "confirmed").length,
  };
  return { ...projectView(project, userId), counts, lastActivityAt: last };
}

/**
 * Initial defaults (F02 §2): the org's starred presets (FE-021), else the system "As modelled"
 * rule set, the global seed dictionary and no classification.
 */
function initialDefaults(): ProjectRec["defaults"] {
  return {
    ruleSetVersionId: seedId("preset-version:rule_set:as-modelled:1"),
    classificationVersionIds: [],
    dictionaryVersionIds: [seedId("preset-version:dictionary:global-seed:1")],
    federationVersionId: null,
  };
}

/** The project's own dictionary: an empty project-layer preset, always the most specific layer (F02 §3). */
function createProjectDictionary(store: Db, org: OrgRec, projectId: string, projectName: string, actorId: string | undefined, at: string) {
  const id = newId();
  const slug = `project-${projectId.slice(0, 8)}`;
  store.presets.push({ id, orgId: org.id, projectId, kind: "dictionary", layer: "project", slug, name: `${projectName} names`, archived: false, updatedAt: at, updatedBy: actorId });
  store.presetVersions.push({
    id: newId(),
    presetId: id,
    number: 1,
    status: "published",
    doc: { schemaVersion: "1.0", id: slug, name: `${projectName} names`, version: "1", layer: "project", entries: [] },
    extendsVersionId: null,
    problems: [],
    createdAt: at,
    publishedAt: at,
  });
  return id;
}

/** Creates a project row with its dictionary and lead. Used by the API and by the seed. */
export function insertProject(
  org: OrgRec,
  lead: UserRec,
  fields: Partial<ProjectRec> & { name: string },
  opts: { at?: string; id?: string; store?: Db } = {},
): ProjectRec {
  const store = opts.store ?? db();
  const at = opts.at ?? nowIso();
  const id = opts.id ?? newId();
  const project: ProjectRec = {
    id,
    orgId: org.id,
    name: fields.name.trim(),
    ...(fields.code ? { code: fields.code } : {}),
    ...(fields.client ? { client: fields.client } : {}),
    ...(fields.location ? { location: fields.location } : {}),
    currency: fields.currency ?? org.settings.defaultCurrency ?? "EUR",
    unitSystem: fields.unitSystem ?? org.settings.defaultUnitSystem ?? "metric",
    locale: fields.locale ?? org.settings.defaultLocale ?? "en",
    status: "active",
    sample: fields.sample ?? false,
    defaults: fields.defaults ?? initialDefaults(),
    projectDictionaryId: "",
    createdAt: at,
    updatedAt: at,
  };
  project.projectDictionaryId = createProjectDictionary(store, org, id, project.name, lead.id, at);
  store.projects.push(project);
  store.projectMembers.push({ projectId: id, userId: lead.id, role: "lead", createdAt: at });
  return project;
}

const projectAudience = (project: ProjectRec) =>
  db().memberships.filter((m) => m.orgId === project.orgId && projectRoleOf(project, m.userId)).map((m) => m.userId);
const changed = (project: ProjectRec, change: "created" | "updated" | "deleted") =>
  emit("entity.changed", { entityType: "project", entityId: project.id, projectId: project.id, change }, { userIds: projectAudience(project) });

function memberView(projectId: string, userId: string) {
  const m = db().projectMembers.find((x) => x.projectId === projectId && x.userId === userId)!;
  return { user: db().users.find((u) => u.id === userId)!, role: m.role, ...(userRef(m.addedBy) ? { addedBy: userRef(m.addedBy) } : {}) };
}

export const projectHandlers: Handlers = {
  listProjects({ user, params, query }) {
    const { org } = memberOrg(user!, params.orgId!);
    const q = String(query.q ?? "").toLowerCase();
    const items = db()
      .projects.filter((p) => p.orgId === org.id && projectRoleOf(p, user!.id))
      .filter((p) => !query.status || p.status === query.status)
      .filter((p) => !q || [p.name, p.code, p.client].some((v) => v?.toLowerCase().includes(q)))
      .map((p) => listItem(p, user!.id))
      .sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""));
    return json(items);
  },

  createProject({ user, params, body }) {
    const { org } = requireOrgAction(user!, params.orgId!, "createProjects");
    const b = body as Partial<ProjectRec> & { name: string; sample?: "duplex" };
    if (b.sample !== "duplex") {
      const max = planLimits(org).activeProjects;
      const current = activeProjectCount(org.id);
      if (max !== undefined && current >= max) throw limitReached("activeProjects", current, max);
    }
    if (!b.name?.trim()) throw new HttpError(400, "invalid_body", "The name can't be empty.");
    const sample = b.sample === "duplex";
    const project = insertProject(org, user!, { ...b, sample, name: b.name });
    // The sample's model, BoQ and answers are copied in as their features arrive (FE-007, FE-008, FE-010).
    persist();
    audit({ orgId: org.id, projectId: project.id, actorId: user!.id, action: "project.created", subjectType: "project", subjectId: project.id, data: { name: project.name, sample } });
    changed(project, "created");
    return json(projectView(project, user!.id), 201);
  },

  getProject({ user, params }) {
    const { project } = visibleProject(user!, params.projectId!);
    return json(projectView(project, user!.id));
  },

  updateProject({ user, params, body }) {
    const { project } = writableProject(user!, params.projectId!, "edit");
    const b = body as Body;
    if (typeof b.name === "string" && !b.name.trim()) throw new HttpError(400, "invalid_body", "The name can't be empty.");
    Object.assign(project, b, { updatedAt: nowIso() });
    if (typeof b.name === "string") project.name = b.name.trim();
    persist();
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "project.updated", subjectType: "project", subjectId: project.id, data: { fields: Object.keys(b) } });
    changed(project, "updated");
    return json(projectView(project, user!.id));
  },

  archiveProject({ user, params }) {
    const { project } = writableProject(user!, params.projectId!, "archive");
    if (project.status !== "archived") {
      project.status = "archived";
      project.updatedAt = nowIso();
      persist();
      audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "project.archived", subjectType: "project", subjectId: project.id });
      // Modules hear about it through this event (F02 §7).
      emit("project.archived", { projectId: project.id }, { userIds: projectAudience(project) });
      changed(project, "updated");
    }
    return json(projectView(project, user!.id));
  },

  unarchiveProject({ user, params }) {
    const { project } = writableProject(user!, params.projectId!, "archive");
    if (project.status === "archived") {
      const org = db().orgs.find((o) => o.id === project.orgId)!;
      const max = planLimits(org).activeProjects;
      const current = activeProjectCount(org.id);
      if (!project.sample && max !== undefined && current >= max) throw limitReached("activeProjects", current, max);
      project.status = "active";
      project.updatedAt = nowIso();
      persist();
      audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "project.restored", subjectType: "project", subjectId: project.id });
      changed(project, "updated");
    }
    return json(projectView(project, user!.id));
  },

  listProjectMembers({ user, params }) {
    const { project } = visibleProject(user!, params.projectId!);
    return json(db().projectMembers.filter((m) => m.projectId === project.id).map((m) => memberView(project.id, m.userId)));
  },

  addProjectMember({ user, params, body }) {
    const { project } = writableProject(user!, params.projectId!, "manageMembers");
    const { userId, role } = body as { userId: string; role: ProjectRole };
    // Project members are org members only (P28); outsiders get share links (F18).
    if (!roleIn(project.orgId, userId)) throw conflict("not_org_member", "Only members of the organisation can join a project. Use a share link for people outside it.");
    if (db().projectMembers.some((m) => m.projectId === project.id && m.userId === userId)) throw conflict("already_member", "Already a project member.");
    db().projectMembers.push({ projectId: project.id, userId, role, addedBy: user!.id, createdAt: nowIso() });
    persist();
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "project.member_added", subjectType: "user", subjectId: userId, data: { role } });
    emit("entity.changed", { entityType: "project", entityId: project.id, projectId: project.id, change: "updated" }, { userIds: [...projectAudience(project)] });
    return json(memberView(project.id, userId), 201);
  },

  updateProjectMember({ user, params, body }) {
    const { project } = writableProject(user!, params.projectId!, "manageMembers");
    const m = db().projectMembers.find((x) => x.projectId === project.id && x.userId === params.userId);
    if (!m) throw new HttpError(404, "not_found", "Not a project member.");
    const role = (body as { role: ProjectRole }).role;
    if (m.role === "lead" && role !== "lead" && db().projectMembers.filter((x) => x.projectId === project.id && x.role === "lead").length === 1) {
      throw conflict("last_lead", "A project needs at least one lead.");
    }
    const from = m.role;
    m.role = role;
    persist();
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "project.member_role_changed", subjectType: "user", subjectId: m.userId, data: { from, to: role } });
    changed(project, "updated");
    return json(memberView(project.id, m.userId));
  },

  removeProjectMember({ user, params }) {
    const { project } = writableProject(user!, params.projectId!, "manageMembers");
    const m = db().projectMembers.find((x) => x.projectId === project.id && x.userId === params.userId);
    if (!m) throw new HttpError(404, "not_found", "Not a project member.");
    if (m.role === "lead" && db().projectMembers.filter((x) => x.projectId === project.id && x.role === "lead").length === 1) {
      throw conflict("last_lead", "A project needs at least one lead.");
    }
    const audience = projectAudience(project);
    db().projectMembers.splice(db().projectMembers.indexOf(m), 1);
    persist();
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "project.member_removed", subjectType: "user", subjectId: m.userId });
    emit("entity.changed", { entityType: "project", entityId: project.id, projectId: project.id, change: "updated" }, { userIds: audience });
    return noContent();
  },

  listProjectAudit({ user, params, query }) {
    const { project, role } = visibleProject(user!, params.projectId!);
    if (!projectPermissions(project, role).seeAudit) throw new HttpError(403, "forbidden", "Your role does not allow this.", { required: "lead|approver" });
    const limit = Math.min(Number(query.limit ?? 100), 1000);
    const offset = Number(query.cursor ?? 0) || 0;
    const items = db()
      .audit.filter((a) => a.projectId === project.id)
      .filter((a) => !query.actorId || a.actorId === query.actorId)
      .filter((a) => !query.action || a.action === query.action)
      .filter((a) => !query.entityType || a.subjectType === query.entityType)
      .sort((a, b) => b.at.localeCompare(a.at));
    const page = items.slice(offset, offset + limit).map((a) => ({
      id: a.id,
      ...(a.actorId ? { actor: userRef(a.actorId), actorKind: "user" as const } : { actorKind: "system" as const }),
      action: a.action,
      entityType: a.subjectType,
      entityId: a.subjectId,
      projectId: a.projectId ?? null,
      data: a.data ?? {},
      at: a.at,
    }));
    return json({ items: page, nextCursor: offset + limit < items.length ? String(offset + limit) : null });
  },
};
