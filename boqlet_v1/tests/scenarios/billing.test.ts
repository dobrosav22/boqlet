import { describe, expect, it } from "vitest";
import { client, TARGET } from "../support/env";
import { invitationToken } from "../support/mail";
import { signUp, uniqueEmail } from "../support/users";

/** F14 for the UI (FE-019): entitlements with usage, the 402 on a limit, checkout lifting it, usage. */

const slug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function freeOrg() {
  const owner = await signUp("Billing Owner", uniqueEmail("billing"));
  const { data: org } = await client(owner.token).POST("/orgs", { body: { name: "Billing Firm", slug: slug("billing") } });
  return { owner, org: org! };
}

describe("F14 entitlements and billing", () => {
  it("shows the plan's limits with their usage; a project over the limit is 402; checkout lifts it", async () => {
    const { owner, org } = await freeOrg();
    const api = client(owner.token);
    const before = (await api.GET("/orgs/{orgId}/entitlements", { params: { path: { orgId: org.id } } })).data!;
    expect(before.planId).toBe("free");
    expect(before.usage).toMatchObject({ seats: 1, activeProjects: 0 });
    const max = before.limits.activeProjects!;
    for (let i = 0; i < max; i++) expect((await api.POST("/orgs/{orgId}/projects", { params: { path: { orgId: org.id } }, body: { name: `P${i}` } })).response.status).toBe(201);
    const over = await api.POST("/orgs/{orgId}/projects", { params: { path: { orgId: org.id } }, body: { name: "One too many" } });
    expect(over.response.status).toBe(402);
    expect((over.error as { details?: Record<string, unknown> }).details).toMatchObject({ limit: "activeProjects", current: max, max });
    expect((await api.GET("/orgs/{orgId}/entitlements", { params: { path: { orgId: org.id } } })).data!.usage.activeProjects).toBe(max);

    const billing = (await api.GET("/orgs/{orgId}/billing", { params: { path: { orgId: org.id } } })).data!;
    expect(billing).toMatchObject({ planId: "free", status: "active" });
    const paid = billing.plans!.find((p) => (p.entitlements.activeProjects ?? Infinity) > max)!;
    const { data: checkout } = await api.POST("/orgs/{orgId}/billing/checkout", { params: { path: { orgId: org.id } }, body: { planId: paid.id, returnUrl: "http://localhost:3000/back" } });
    expect(checkout!.url).toMatch(/^https?:\/\//);
    if (TARGET === "mock") {
      // The manual adapter's checkout page switches the plan and returns.
      const done = await fetch(checkout!.url, { redirect: "manual" });
      expect(done.status).toBe(302);
      expect(done.headers.get("location")).toBe("http://localhost:3000/back");
      expect((await api.GET("/orgs/{orgId}/entitlements", { params: { path: { orgId: org.id } } })).data!.planId).toBe(paid.id);
      expect((await api.POST("/orgs/{orgId}/projects", { params: { path: { orgId: org.id } }, body: { name: "Now it fits" } })).response.status).toBe(201);
    }
    const { data: portal } = await api.POST("/orgs/{orgId}/billing/portal", { params: { path: { orgId: org.id } }, body: { returnUrl: "http://localhost:3000/back" } });
    expect(portal!.url).toBeTruthy();
  });

  it("billing is the owner's; usage the owner's and admins'; members see neither", async () => {
    const { owner, org } = await freeOrg();
    const email = uniqueEmail("billing-member");
    await client(owner.token).POST("/orgs/{orgId}/invitations", { params: { path: { orgId: org.id } }, body: { email, role: "member" } });
    const member = await signUp("Member Person", email);
    await client(member.token).POST("/invitations/{token}/accept", { params: { path: { token: await invitationToken(email) } } });
    const m = client(member.token);
    expect((await m.GET("/orgs/{orgId}/billing", { params: { path: { orgId: org.id } } })).response.status).toBe(403);
    expect((await m.POST("/orgs/{orgId}/billing/checkout", { params: { path: { orgId: org.id } }, body: { planId: "team", returnUrl: "x" } })).response.status).toBe(403);
    expect((await m.GET("/orgs/{orgId}/usage", { params: { path: { orgId: org.id } } })).response.status).toBe(403);
    expect((await m.GET("/orgs/{orgId}/entitlements", { params: { path: { orgId: org.id } } })).response.status).toBe(200);

    const usage = (await client(owner.token).GET("/orgs/{orgId}/usage", { params: { path: { orgId: org.id } } })).data!;
    expect(usage.month).toMatch(/^\d{4}-\d{2}$/);
    expect(usage).toMatchObject({ processingMinutes: 0, byProject: [], byKind: {} });
  });
});
