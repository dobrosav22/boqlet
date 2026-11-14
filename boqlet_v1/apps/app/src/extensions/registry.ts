import type { ComponentType, ReactNode } from "react";
import type { Schemas } from "@ifc-boq/api";
import type { OrgAction, OrgRole } from "@/lib/permissions";

/**
 * The core's extension points (P36, 04-architecture/modules.md): small typed registries that a
 * module fills once at startup, from `src/modules.ts`. They are generic: no module concept appears
 * in their names. An empty registry is valid; the core renders and works with no module.
 *
 * Labels and panels are components, so a module renders its own i18n namespace and its own queries.
 */

/** What every org-level extension may look at to decide whether it shows. */
export interface OrgContextInfo {
  org: Schemas["Org"];
  role: OrgRole;
  can: (action: OrgAction) => boolean;
}

/** `nav.orgItems`: an entry in the org's left navigation, below the core's. */
export interface OrgNavItem {
  id: string;
  /** Under `/{org}`, e.g. `/reports`. */
  href: string;
  Label: ComponentType;
  visible?: (ctx: OrgContextInfo) => boolean;
}

/** `boq.workspaceTabs`: a tab in the BoQ workspace (S12), after the core's. */
export interface BoqWorkspaceTab {
  /** The `?tab=` value; must not clash with a core tab. */
  id: string;
  Label: ComponentType;
  Panel: ComponentType<{ boqId: string; projectId: string; runId: string | null }>;
  visible?: (ctx: OrgContextInfo & { projectPermissions: Record<string, boolean> }) => boolean;
}

/** `sheet.selectionActions`: an action on the lines ticked in the sheet, in its bulk bar. */
export interface SheetSelectionAction {
  id: string;
  Action: ComponentType<{ boqId: string; runId: string; lineKeys: string[] }>;
}

/**
 * `sheet.lineBadges`: small badges on lines, from the module's own query. A hook, called once per
 * sheet in registration order (the registry doesn't change after startup); line key → badge.
 */
export interface SheetLineBadges {
  id: string;
  useBadges: (ctx: { boqId: string; runId: string }) => Readonly<Record<string, ReactNode>>;
}

/** `settings.orgSections`: a section in org settings at `/{org}/settings/{path}`. */
export interface OrgSettingsSection {
  /** The URL segment; must not clash with a core section. */
  path: string;
  Label: ComponentType;
  Section: ComponentType;
  /** Who sees it; missing = every member. */
  action?: OrgAction;
}

/** `project.overviewCards`: a card on the project overview (S07). */
export interface ProjectOverviewCard {
  id: string;
  Card: ComponentType<{ projectId: string }>;
}

/**
 * `area.routes`: a separate area at `/{path}` with its own layout and sign-in routing (outside any
 * org). `Area` renders everything below the path; `segments` are the URL segments after it.
 */
export interface AreaRoute {
  /** The first URL segment, e.g. `partner`; org slugs never take it (reservedSlugs). */
  path: string;
  Area: ComponentType<{ segments: string[] }>;
}

/** `notifications.kinds`: a module's notification kind, its text from the module's namespace. */
export interface NotificationKind {
  /** e.g. `reports.ready`; the core never sends module kinds itself. */
  kind: string;
  /** The message key, namespace included, e.g. `reports.notifications.ready`. */
  messageKey: string;
}

export interface ExtensionPoints {
  "nav.orgItems": OrgNavItem;
  "boq.workspaceTabs": BoqWorkspaceTab;
  "sheet.selectionActions": SheetSelectionAction;
  "sheet.lineBadges": SheetLineBadges;
  "settings.orgSections": OrgSettingsSection;
  "project.overviewCards": ProjectOverviewCard;
  "area.routes": AreaRoute;
  "notifications.kinds": NotificationKind;
}
export type ExtensionPoint = keyof ExtensionPoints;

const keyOf: { [P in ExtensionPoint]: (e: ExtensionPoints[P]) => string } = {
  "nav.orgItems": (e) => e.id,
  "boq.workspaceTabs": (e) => e.id,
  "sheet.selectionActions": (e) => e.id,
  "sheet.lineBadges": (e) => e.id,
  "settings.orgSections": (e) => e.path,
  "project.overviewCards": (e) => e.id,
  "area.routes": (e) => e.path,
  "notifications.kinds": (e) => e.kind,
};

const registries: { [P in ExtensionPoint]: ExtensionPoints[P][] } = {
  "nav.orgItems": [],
  "boq.workspaceTabs": [],
  "sheet.selectionActions": [],
  "sheet.lineBadges": [],
  "settings.orgSections": [],
  "project.overviewCards": [],
  "area.routes": [],
  "notifications.kinds": [],
};

/** Adds an entry; the same key twice on one point is a module bug and throws. */
export function register<P extends ExtensionPoint>(point: P, entry: ExtensionPoints[P]) {
  const key = keyOf[point](entry);
  const list = registries[point] as ExtensionPoints[P][];
  if (list.some((e) => keyOf[point](e) === key)) throw new Error(`${point}: "${key}" is registered twice`);
  list.push(entry);
}

/** The entries of one point, in registration order. */
export function extensions<P extends ExtensionPoint>(point: P): readonly ExtensionPoints[P][] {
  return registries[point] as ExtensionPoints[P][];
}

/** Tests only: empties every registry. */
export function resetExtensions() {
  for (const list of Object.values(registries)) list.length = 0;
}
