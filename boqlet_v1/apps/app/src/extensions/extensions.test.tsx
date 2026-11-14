// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import common from "../../messages/en/common.json";
import notifications from "../../messages/en/notifications.json";
import settings from "../../messages/en/settings.json";
import shell from "../../messages/en/shell.json";
import { orgCan, type OrgRole } from "@/lib/permissions";
import { extensions, register, resetExtensions } from "./registry";
import { registerTestModule, TEST_MODULE } from "./testing/test-module";

/** FE-039: the extension registries (P36), with the core alone and with a test module that registers one of each. */

const nav = vi.hoisted(() => ({ pathname: "/acme" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));
// Next's Link is hoisted to the workspace root with its React 18; a plain anchor is enough here.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const org = vi.hoisted(() => ({ role: "owner" as OrgRole }));
vi.mock("@/features/orgs/org-context", () => ({
  useOrg: () => ({ org: { id: "o1", name: "Acme", slug: "acme", planId: "free", settings: {} }, role: org.role, can: (a: Parameters<typeof orgCan>[1]) => orgCan(org.role, a) }),
}));

const messages = { common, shell, settings, notifications, testModule: { ready: "Report {name} is ready" } };
const wrap = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
    {children}
  </NextIntlClientProvider>
);

// A small render helper with the app's own React 19 (Testing Library at the workspace root loads the PoC's React 18).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let mounted: { root: Root; el: HTMLElement } | null = null;
function render(ui: ReactNode) {
  cleanup();
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(wrap({ children: ui })));
  mounted = { root, el };
}
function cleanup() {
  if (!mounted) return;
  const { root, el } = mounted;
  act(() => root.unmount());
  el.remove();
  mounted = null;
}
function renderHook<T>(hook: () => T) {
  const result = { current: undefined as T };
  function Probe() {
    result.current = hook();
    return null;
  }
  render(<Probe />);
  return { result };
}
const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${CSS.escape(id)}"]`);
const screen = {
  queryByTestId: byTestId,
  getByTestId: (id: string) => {
    const el = byTestId(id);
    if (!el) throw new Error(`no element with data-testid ${id}`);
    return el;
  },
  getAllByRole: (role: "link") => [...document.querySelectorAll<HTMLElement>(role === "link" ? "a[href]" : role)],
};

beforeEach(() => {
  resetExtensions();
  nav.pathname = "/acme";
  org.role = "owner";
});
afterEach(cleanup);

describe("registry", () => {
  it("is empty with no module; the test module registers one of each point", () => {
    const points = ["nav.orgItems", "boq.workspaceTabs", "sheet.selectionActions", "sheet.lineBadges", "settings.orgSections", "project.overviewCards", "area.routes", "notifications.kinds"] as const;
    for (const p of points) expect(extensions(p)).toHaveLength(0);
    registerTestModule();
    for (const p of points) expect(extensions(p).length).toBeGreaterThanOrEqual(1);
  });

  it("refuses the same key twice on one point", () => {
    register("area.routes", { path: "x", Area: () => null });
    expect(() => register("area.routes", { path: "x", Area: () => null })).toThrow(/registered twice/);
  });
});

describe("core components", () => {
  it("left navigation: the core's items, then a module's, filtered by its visibility", async () => {
    const { LeftNav } = await import("@/components/shell/left-nav");
    render(<LeftNav org="acme" />);
    expect(screen.queryByTestId(`nav-module:${TEST_MODULE.nav}`)).toBeNull();
    cleanup();

    registerTestModule();
    org.role = "member";
    render(<LeftNav org="acme" />);
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links).toEqual(["/acme", "/acme/projects", "/acme/library", "/acme/settings", "/acme/test-reports"]);
    cleanup();
    org.role = "owner";
    render(<LeftNav org="acme" />);
    expect(screen.getByTestId("nav-module:test-owners-only").getAttribute("href")).toBe("/acme/test-owners");
  });

  it("settings navigation: a module's section after the core's, for the roles it names", async () => {
    const { SettingsNav } = await import("@/features/settings/settings-nav");
    registerTestModule();
    render(<SettingsNav org="acme" />);
    expect(screen.getByTestId(`settings-${TEST_MODULE.section}`).getAttribute("href")).toBe(`/acme/settings/${TEST_MODULE.section}`);
    cleanup();
    org.role = "member";
    render(<SettingsNav org="acme" />);
    expect(screen.queryByTestId(`settings-${TEST_MODULE.section}`)).toBeNull();
  });

  it("an area renders below its path; an unknown one is the not-found page", async () => {
    const { AreaHost } = await import("./area-host");
    render(<AreaHost area={TEST_MODULE.area} segments={[]} />);
    expect(screen.queryByTestId("test-area")).toBeNull();
    expect(screen.getByTestId("not-found")).toBeTruthy();
    registerTestModule();
    render(<AreaHost area={TEST_MODULE.area} segments={["requests", "r1"]} />);
    expect(screen.getByTestId("test-area").textContent).toBe("requests/r1");
  });

  it("notification text: a module's kind from its own namespace; core kinds as before", async () => {
    const { useNotificationText } = await import("@/features/notifications/use-notification-text");
    registerTestModule();
    const { result } = renderHook(() => useNotificationText());
    expect(result.current({ kind: TEST_MODULE.kind, params: { name: "Q3" } })).toBe("Report Q3 is ready");
    expect(result.current({ kind: "nobody.knows" })).toBe("nobody.knows");
    expect(result.current({ kind: "boq.confirmed", params: { boq: "Tender" } })).not.toBe("boq.confirmed");
  });
});
