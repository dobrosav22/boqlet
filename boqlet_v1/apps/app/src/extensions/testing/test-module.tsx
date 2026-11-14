/**
 * A module for tests only (FE-039): registers one entry on every extension point, the way a real
 * module does from `src/modules.ts`. Never imported by the app. Its texts are plain on purpose:
 * they are test fixtures, not UI.
 */
import { register } from "../registry";

export const TEST_MODULE = {
  nav: "test-reports",
  tab: "test-tab",
  section: "test-settings",
  area: "test-area",
  kind: "test.ready",
} as const;

/* eslint-disable react/jsx-no-literals -- fixtures */
export function registerTestModule() {
  register("nav.orgItems", { id: TEST_MODULE.nav, href: "/test-reports", Label: () => <>Test reports</> });
  register("nav.orgItems", { id: "test-owners-only", href: "/test-owners", Label: () => <>Owners only</>, visible: (ctx) => ctx.role === "owner" });
  register("boq.workspaceTabs", { id: TEST_MODULE.tab, Label: () => <>Test tab</>, Panel: ({ boqId }) => <p data-testid="test-tab-panel">{boqId}</p> });
  register("sheet.selectionActions", { id: "test-action", Action: ({ lineKeys }) => <button data-testid="test-action">{lineKeys.length}</button> });
  register("sheet.lineBadges", { id: "test-badges", useBadges: () => ({ "line-1": <span data-testid="test-badge">sent</span> }) });
  register("settings.orgSections", { path: TEST_MODULE.section, Label: () => <>Test settings</>, Section: () => <p data-testid="test-section">section</p>, action: "editOrgSettings" });
  register("project.overviewCards", { id: "test-card", Card: ({ projectId }) => <p data-testid="test-card">{projectId}</p> });
  register("area.routes", { path: TEST_MODULE.area, Area: ({ segments }) => <p data-testid="test-area">{segments.join("/")}</p> });
  register("notifications.kinds", { kind: TEST_MODULE.kind, messageKey: "testModule.ready" });
}
/* eslint-enable react/jsx-no-literals */
