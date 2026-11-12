/**
 * Org-level permissions, enforced on every request (03-domain/permissions.md "Org roles").
 * The mock is where the frontend's gating is tested, so this matrix is the spec's, exactly.
 */
import { forbidden, notFound } from "./http.js";
import { db, type OrgRec, type OrgRole, type UserRec } from "./store.js";

export const ORG_ACTIONS = {
  editOrgSettings: ["owner", "admin"],
  manageBilling: ["owner"],
  deleteOrg: ["owner"],
  manageMembers: ["owner", "admin"],
  makeOwner: ["owner"],
  createProjects: ["owner", "admin", "library_editor", "member"],
  seeAllProjects: ["owner", "admin"],
  viewLibrary: ["owner", "admin", "library_editor", "member"],
  editLibrary: ["owner", "admin", "library_editor"],
  promoteDecisions: ["owner", "admin", "library_editor"],
  finishSetup: ["owner", "admin", "library_editor"],
  seeUsage: ["owner", "admin"],
  seeAudit: ["owner", "admin"],
  manageShareLinks: ["owner", "admin"],
} as const satisfies Record<string, readonly OrgRole[]>;
export type OrgAction = keyof typeof ORG_ACTIONS;

export function roleIn(orgId: string, userId: string): OrgRole | null {
  return db().memberships.find((m) => m.orgId === orgId && m.userId === userId)?.role ?? null;
}

export const orgVisible = (orgId: string) => !db().deletedOrgIds.includes(orgId);

/** The org, if the user is a member (others get 404: not visible, conventions.md). */
export function memberOrg(user: UserRec, orgId: string): { org: OrgRec; role: OrgRole } {
  const org = db().orgs.find((o) => o.id === orgId && orgVisible(o.id));
  const role = org ? roleIn(org.id, user.id) : null;
  if (!org || !role) throw notFound("organisation");
  return { org, role };
}

/** Member with a role allowed to do `action`, else 403 with the roles that may. */
export function requireOrgAction(user: UserRec, orgId: string, action: OrgAction) {
  const found = memberOrg(user, orgId);
  if (!(ORG_ACTIONS[action] as readonly OrgRole[]).includes(found.role)) throw forbidden(ORG_ACTIONS[action].join("|"));
  return found;
}

export function orgPermissions(role: OrgRole): Record<string, boolean> {
  return Object.fromEntries(Object.entries(ORG_ACTIONS).map(([k, roles]) => [k, (roles as readonly OrgRole[]).includes(role)]));
}
