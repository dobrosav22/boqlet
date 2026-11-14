/**
 * The core's extension points. Importing them runs `src/modules.ts` first, so a module has
 * registered before any core component reads a registry.
 */
import "@/modules";
import { extensions } from "./registry";

export { extensions, type AreaRoute, type BoqWorkspaceTab, type NotificationKind, type OrgContextInfo, type OrgNavItem, type OrgSettingsSection, type ProjectOverviewCard, type SheetLineBadges, type SheetSelectionAction } from "./registry";

/** The area registered at a first URL segment, if any (`area.routes`). */
export const areaAt = (segment: string) => extensions("area.routes").find((a) => a.path === segment);
