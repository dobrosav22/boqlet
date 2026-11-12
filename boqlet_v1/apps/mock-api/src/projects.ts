/**
 * Project access and permissions (03-domain/permissions.md "Project roles", F02). Org owners and
 * admins act as lead on every project; other org members see only projects they belong to.
 */
import { conflict, forbidden, notFound } from "./http.js";
import { roleIn } from "./permissions.js";
import { db, type ProjectRec, type ProjectRole, type UserRec } from "./store.js";

export const PROJECT_PERMISSIONS = {
  view: ["lead", "estimator", "approver", "viewer"],
  edit: ["lead"],
  archive: ["lead"],
  manageMembers: ["lead"],
  editModels: ["lead", "estimator"],
  editBoqs: ["lead", "estimator"],
  answerQuestions: ["lead", "estimator"],
  editLines: ["lead", "estimator"],
  editPresets: ["lead", "estimator"],
  saveVersion: ["lead", "estimator"],
  approve: ["lead", "approver"],
  confirm: ["lead", "approver"],
  reopen: ["lead"],
  share: ["lead", "estimator", "approver"],
  revokeShares: ["lead", "approver"],
  seeAudit: ["lead", "approver"],
} as const satisfies Record<string, readonly ProjectRole[]>;
export type ProjectPermission = keyof typeof PROJECT_PERMISSIONS;

/** Keys that stay true on an archived project (reading never stops). */
const READ_ONLY_KEYS = new Set<ProjectPermission>(["view", "seeAudit", "archive"]);

/** The caller's effective project role: org owners and admins are leads everywhere. */
export function projectRoleOf(project: ProjectRec, userId: string): ProjectRole | null {
  const orgRole = roleIn(project.orgId, userId);
  if (!orgRole) return null;
  if (orgRole === "owner" || orgRole === "admin") return "lead";
  return db().projectMembers.find((m) => m.projectId === project.id && m.userId === userId)?.role ?? null;
}

export function projectPermissions(project: ProjectRec, role: ProjectRole | null): Record<ProjectPermission, boolean> {
  return Object.fromEntries(
    (Object.keys(PROJECT_PERMISSIONS) as ProjectPermission[]).map((key) => {
      const allowed = !!role && (PROJECT_PERMISSIONS[key] as readonly ProjectRole[]).includes(role);
      return [key, allowed && (project.status === "active" || READ_ONLY_KEYS.has(key))];
    }),
  ) as Record<ProjectPermission, boolean>;
}

/** The project if the user may see it, else 404 (not visible = not found, conventions.md). */
export function visibleProject(user: UserRec, projectId: string) {
  const project = db().projects.find((p) => p.id === projectId);
  const role = project ? projectRoleOf(project, user.id) : null;
  if (!project || !role || db().deletedOrgIds.includes(project.orgId)) throw notFound("project");
  return { project, role };
}

/**
 * The project for a write: the role must allow `permission`, and an archived project refuses
 * every write with `409 project_archived` (F02 §7).
 */
export function writableProject(user: UserRec, projectId: string, permission: ProjectPermission) {
  const found = visibleProject(user, projectId);
  if (!(PROJECT_PERMISSIONS[permission] as readonly ProjectRole[]).includes(found.role)) throw forbidden(PROJECT_PERMISSIONS[permission].join("|"));
  if (found.project.status === "archived" && permission !== "archive") throw conflict("project_archived", "The project is archived and read-only.");
  return found;
}

/** Active projects that count towards the plan (the sample doesn't, FL-1). */
export const activeProjectCount = (orgId: string) => db().projects.filter((p) => p.orgId === orgId && p.status === "active" && !p.sample).length;
