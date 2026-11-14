import { describe, expect, it } from "vitest";
import { client } from "../support/env";
import { user } from "../support/users";

/**
 * F19 criterion 1, BR-57: every `/admin/*` operation answers `404` to anyone but a platform admin,
 * an org owner included, so the console's existence isn't revealed.
 */

const ORG = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";

const calls = (api: ReturnType<typeof client>) => [
  () => api.GET("/admin/overview"),
  () => api.GET("/admin/funnel"),
  () => api.GET("/admin/orgs"),
  () => api.GET("/admin/orgs.csv", { parseAs: "text" }),
  () => api.GET("/admin/orgs/{orgId}", { params: { path: { orgId: ORG } } }),
  () => api.PATCH("/admin/orgs/{orgId}", { params: { path: { orgId: ORG } }, body: { status: "suspended", reason: "test" } }),
  () => api.PUT("/admin/orgs/{orgId}/subscription", { params: { path: { orgId: ORG } }, body: { planId: "team", reason: "test" } }),
  () => api.PUT("/admin/orgs/{orgId}/entitlement-overrides", { params: { path: { orgId: ORG } }, body: { overrides: { seats: 99 }, reason: "test" } }),
  () => api.GET("/admin/orgs/{orgId}/notes", { params: { path: { orgId: ORG } } }),
  () => api.POST("/admin/orgs/{orgId}/notes", { params: { path: { orgId: ORG } }, body: { text: "test" } }),
  () => api.GET("/admin/users"),
  () => api.DELETE("/admin/users/{userId}/session", { params: { path: { userId: USER } } }),
  () => api.GET("/admin/health"),
];

describe("F19 /admin/* isolation", () => {
  it("answers 404 to an org owner and to a member on every admin operation", async () => {
    for (const who of ["olivia", "marko"] as const) {
      const api = client((await user(who)).token);
      for (const call of calls(api)) {
        const { response } = await call();
        expect({ who, url: response.url, status: response.status }).toEqual({ who, url: response.url, status: 404 });
      }
    }
  });

  it("answers 401 without a token", async () => {
    const api = client(null);
    for (const call of calls(api)) expect((await call()).response.status).toBe(401);
  });

  it("answers a platform admin", async () => {
    const api = client((await user("pat")).token);
    expect((await api.GET("/admin/overview")).response.status).toBe(200);
    expect((await api.GET("/admin/health")).response.status).toBe(200);
  });
});
