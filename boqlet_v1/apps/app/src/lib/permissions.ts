import type { Schemas } from "@ifc-boq/api";

type Permissions = Schemas["Permissions"];
export type OrgRole = Schemas["OrgRole"];

/**
 * UI gating from the `permissions` object the API returns with each project, BoQ and preset
 * (architecture.md, data layer rule 7). Hiding is never the security boundary; the API enforces.
 */
export function can(permissions: Permissions | null | undefined, action: string): boolean {
  return permissions?.[action] === true;
}

/**
 * Org-level actions from the caller's org role (`GET /me` memberships), per
 * 03-domain/permissions.md "Org roles". The only place roles are turned into permissions.
 */
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

export function orgCan(role: OrgRole | null | undefined, action: OrgAction): boolean {
  return !!role && (ORG_ACTIONS[action] as readonly OrgRole[]).includes(role);
}
