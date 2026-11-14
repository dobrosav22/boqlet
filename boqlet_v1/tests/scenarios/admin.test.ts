import { beforeAll, describe, expect, it } from "vitest";
import { client } from "../support/env";
import { inSession, signUp, uniqueEmail, user, type TestUser } from "../support/users";

/** F19 platform admin console (FE-038): criteria 2–5 and FL-12, against seed data and fresh orgs. */

const slug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

let pat: TestUser;
const admin = () => client(pat.token);

async function freshOrg(prefix: string) {
  const owner = await signUp(`${prefix} Owner`, uniqueEmail(prefix));
  const { data: org } = await client(owner.token).POST("/orgs", { body: { name: `${prefix} Firm`, slug: slug(prefix) } });
  return { owner, org: org! };
}

async function allOrgRows(query: Record<string, string> = {}) {
  const { data, response } = await admin().GET("/admin/orgs", { params: { query: { limit: 1000, ...query } } });
  expect(response.status).toBe(200);
  return data!.items;
}

beforeAll(async () => {
  pat = await user("pat");
});

describe("F19 orgs table", () => {
  it("shows the same seats, active projects and processing minutes as each org's usage page", async () => {
    const olivia = await user("olivia");
    const rows = await allOrgRows();
    const me = (await client(olivia.token).GET("/me")).data!;
    expect(me.memberships.length).toBeGreaterThan(0);
    for (const m of me.memberships) {
      const row = rows.find((r) => r.id === m.org.id)!;
      expect(row).toBeTruthy();
      const ent = (await client(olivia.token).GET("/orgs/{orgId}/entitlements", { params: { path: { orgId: m.org.id } } })).data!;
      const usage = (await client(olivia.token).GET("/orgs/{orgId}/usage", { params: { path: { orgId: m.org.id } } })).data!;
      expect(row.seats).toEqual({ used: ent.usage.seats, max: ent.limits.seats ?? null });
      expect(row.activeProjects).toEqual({ used: ent.usage.activeProjects, max: ent.limits.activeProjects ?? null });
      expect(row.processingMinutes!.used).toBe(usage.processingMinutes);
      expect(row.ownerEmail).toBeTruthy();
    }
  });

  it("an org that hit activeProjects is under 'hit a limit', with the time of the hit", async () => {
    const { owner, org } = await freshOrg("limit");
    const api = client(owner.token);
    const max = (await api.GET("/orgs/{orgId}/entitlements", { params: { path: { orgId: org.id } } })).data!.limits.activeProjects!;
    for (let i = 0; i < max; i++) await api.POST("/orgs/{orgId}/projects", { params: { path: { orgId: org.id } }, body: { name: `P${i}` } });
    const before = Date.now();
    expect((await api.POST("/orgs/{orgId}/projects", { params: { path: { orgId: org.id } }, body: { name: "Over" } })).response.status).toBe(402);

    const hit = await allOrgRows({ signal: "hit_limit" });
    expect(hit.find((r) => r.id === org.id)?.limitHits30d).toBe(1);
    const others = await allOrgRows({ signal: "hit_limit", q: "no-such-org-anywhere" });
    expect(others).toEqual([]);
    const detail = (await admin().GET("/admin/orgs/{orgId}", { params: { path: { orgId: org.id } } })).data!;
    expect(detail.limitEvents).toEqual([expect.objectContaining({ limit: "activeProjects", current: max, max, action: "createProject" })]);
    expect(Date.parse(detail.limitEvents![0]!.at!)).toBeGreaterThanOrEqual(before - 5_000);
  });

  it("filters, searches, sorts and exports CSV", async () => {
    const { org } = await freshOrg("filters");
    expect((await allOrgRows({ q: org.slug })).map((r) => r.id)).toEqual([org.id]);
    expect((await allOrgRows({ plan: "free" })).every((r) => r.planId === "free")).toBe(true);
    const byName = await allOrgRows({ sort: "name" });
    expect(byName.map((r) => r.name.toLowerCase())).toEqual([...byName.map((r) => r.name.toLowerCase())].sort((a, b) => a.localeCompare(b)));
    expect((await admin().GET("/admin/orgs", { params: { query: { sort: "nonsense" } } })).response.status).toBe(400);
    const csv = await admin().GET("/admin/orgs.csv", { params: { query: { q: org.slug } }, parseAs: "text" });
    expect(csv.response.status).toBe(200);
    const lines = (csv.data as string).replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toMatch(/^id,name,country,planId/);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(org.id);
  });
});

describe("F19 actions", () => {
  it("changing the plan needs a reason, takes effect at once and shows in the org's audit log", async () => {
    const { owner, org } = await freshOrg("plan");
    const noReason = await admin().PUT("/admin/orgs/{orgId}/subscription", { params: { path: { orgId: org.id } }, body: { planId: "team", reason: " " } });
    expect(noReason.response.status).toBe(400);
    const done = await admin().PUT("/admin/orgs/{orgId}/subscription", { params: { path: { orgId: org.id } }, body: { planId: "team", reason: "Pilot with sales" } });
    expect(done.response.status).toBe(200);
    expect(done.data!.planHistory).toEqual([expect.objectContaining({ planId: "team" })]);
    expect((await client(owner.token).GET("/orgs/{orgId}/entitlements", { params: { path: { orgId: org.id } } })).data!.planId).toBe("team");
    const events = (await client(owner.token).GET("/orgs/{orgId}/audit", { params: { path: { orgId: org.id }, query: { action: "org.plan_changed" } } })).data!.items;
    expect(events).toEqual([expect.objectContaining({ actorKind: "platform_admin", data: expect.objectContaining({ from: "free", to: "team", reason: "Pilot with sales" }) })]);
  });

  it("FL-12: a note, a tag and a trial extended by 14 days (the trial in the org's log, notes and tags not)", async () => {
    const { owner, org } = await freshOrg("fl12");
    const note = await admin().POST("/admin/orgs/{orgId}/notes", { params: { path: { orgId: org.id } }, body: { text: "Called them, wants a demo" } });
    expect(note.response.status).toBe(201);
    expect(note.data).toMatchObject({ text: "Called them, wants a demo", author: { id: pat.id } });
    expect((await admin().GET("/admin/orgs/{orgId}/notes", { params: { path: { orgId: org.id } } })).data!.map((n) => n.text)).toEqual(["Called them, wants a demo"]);

    const tagged = await admin().PATCH("/admin/orgs/{orgId}", { params: { path: { orgId: org.id } }, body: { tags: ["lead", "demo"], reason: "Sales follow-up" } });
    expect(tagged.data!.tags).toEqual(["demo", "lead"]);
    expect((await allOrgRows({ tag: "lead" })).map((r) => r.id)).toContain(org.id);

    const trialEndsAt = new Date(Date.now() + 14 * 86_400_000).toISOString();
    const trial = await admin().PUT("/admin/orgs/{orgId}/subscription", { params: { path: { orgId: org.id } }, body: { trialEndsAt, reason: "Asked for more time" } });
    expect(trial.data).toMatchObject({ trialEndsAt, subscriptionStatus: "trialing" });
    expect((await client(owner.token).GET("/orgs/{orgId}/billing", { params: { path: { orgId: org.id } } })).data).toMatchObject({ status: "trialing", trialEndsAt });

    const log = (await client(owner.token).GET("/orgs/{orgId}/audit", { params: { path: { orgId: org.id } } })).data!.items;
    expect(log.map((e) => e.action)).toContain("org.trial_changed");
    expect(JSON.stringify(log)).not.toContain("Called them");
    expect(JSON.stringify(log)).not.toContain("Sales follow-up");
  });

  it("overrides an entitlement on top of the plan; null removes it", async () => {
    const { owner, org } = await freshOrg("override");
    const ent = () => client(owner.token).GET("/orgs/{orgId}/entitlements", { params: { path: { orgId: org.id } } });
    const planSeats = (await ent()).data!.limits.seats;
    const set = await admin().PUT("/admin/orgs/{orgId}/entitlement-overrides", { params: { path: { orgId: org.id } }, body: { overrides: { seats: 40 }, reason: "Partner deal" } });
    expect(set.data!.overrides).toEqual({ seats: 40 });
    expect((await ent()).data!.limits.seats).toBe(40);
    await admin().PUT("/admin/orgs/{orgId}/entitlement-overrides", { params: { path: { orgId: org.id } }, body: { overrides: { seats: null }, reason: "Deal ended" } });
    expect((await ent()).data!.limits.seats).toBe(planSeats);
  });

  it("a suspended org is read-only until it is reactivated", async () => {
    const { owner, org } = await freshOrg("suspend");
    const api = client(owner.token);
    const project = (await api.POST("/orgs/{orgId}/projects", { params: { path: { orgId: org.id } }, body: { name: "Before" } })).data!;
    expect((await admin().PATCH("/admin/orgs/{orgId}", { params: { path: { orgId: org.id } }, body: { status: "suspended", reason: "Payment dispute" } })).data!.status).toBe("suspended");
    expect((await api.GET("/me")).data!.memberships.find((m) => m.org.id === org.id)!.org.status).toBe("suspended");
    const refused = await api.POST("/orgs/{orgId}/projects", { params: { path: { orgId: org.id } }, body: { name: "During" } });
    expect(refused.response.status).toBe(409);
    expect(refused.error).toMatchObject({ code: "org_suspended" });
    expect((await api.PATCH("/projects/{projectId}", { params: { path: { projectId: project.id } }, body: { name: "Renamed" } })).response.status).toBe(409);
    expect((await api.GET("/projects/{projectId}", { params: { path: { projectId: project.id } } })).response.status).toBe(200);
    await admin().PATCH("/admin/orgs/{orgId}", { params: { path: { orgId: org.id } }, body: { status: "active", reason: "Resolved" } });
    expect((await api.PATCH("/projects/{projectId}", { params: { path: { projectId: project.id } }, body: { name: "Renamed" } })).response.status).toBe(200);
    const actions = (await api.GET("/orgs/{orgId}/audit", { params: { path: { orgId: org.id } } })).data!.items.map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["org.suspended", "org.reactivated"]));
  });

  it("ends a user's active session (support: locked out on another device)", async () => {
    const person = await signUp("Locked Out", uniqueEmail("lockedout"));
    const opened = await client(person.token).POST("/sessions", { body: { deviceLabel: "Office PC" } });
    expect(opened.response.status).toBe(201);
    const row = (await admin().GET("/admin/users", { params: { query: { q: person.email } } })).data!.items;
    expect(row).toEqual([expect.objectContaining({ id: person.id, activeSession: expect.objectContaining({ deviceLabel: "Office PC" }) })]);
    expect((await admin().DELETE("/admin/users/{userId}/session", { params: { path: { userId: person.id } } })).response.status).toBe(204);
    expect((await client(inSession(person, opened.data!.id).token).GET("/me")).response.status).toBe(401);
    expect((await client(person.token).POST("/sessions", { body: { deviceLabel: "Laptop" } })).response.status).toBe(201);
    expect((await admin().DELETE("/admin/users/{userId}/session", { params: { path: { userId: uniqueId() } } })).response.status).toBe(404);
  });
});

describe("F19 overview, funnel, health", () => {
  it("counts sign-ups and new orgs in the period; the funnel lists orgs stuck at a step", async () => {
    const { org } = await freshOrg("funnel");
    const overview = (await admin().GET("/admin/overview")).data!;
    expect(overview.tiles!.signUps!.value).toBeGreaterThanOrEqual(1);
    expect(overview.tiles!.newOrgs!.value).toBeGreaterThanOrEqual(1);
    expect(overview.tiles!.newOrgs!.series).toHaveLength(30);
    expect(Object.values(overview.orgsByPlan!).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(3);
    const funnel = (await admin().GET("/admin/funnel")).data!;
    expect(funnel.steps!.map((s) => s.step)).toEqual(["signed_up", "org_created", "setup_done", "first_model_ready", "first_boq", "first_saved_version", "first_export_or_share"]);
    const created = funnel.steps!.find((s) => s.step === "org_created")!;
    expect(created.orgs).toBeGreaterThanOrEqual(1);
    // A new org has no setup yet: it is stuck at "setup done".
    expect((await allOrgRows({ stuckAt: "setup_done" })).map((r) => r.id)).toContain(org.id);
    expect((await allOrgRows({ stuckAt: "first_model_ready" })).map((r) => r.id)).not.toContain(org.id);
    expect((await admin().GET("/admin/overview", { params: { query: { from: "2026-02-01", to: "2026-01-01" } } })).response.status).toBe(400);
  });

  it("health has failed jobs per day and job durations", async () => {
    const { data } = await admin().GET("/admin/health");
    expect(Array.isArray(data!.failedJobsPerDay)).toBe(true);
    expect(typeof data!.jobDurationsMs).toBe("object");
  });
});

describe("F19 shows metadata, never content (BR-57)", () => {
  it("no admin response contains project names, file names, BoQ names or line descriptions", async () => {
    const { owner, org } = await freshOrg("content");
    const api = client(owner.token);
    const secret = `Zq${Math.random().toString(36).slice(2, 8)}`;
    const project = (await api.POST("/orgs/{orgId}/projects", { params: { path: { orgId: org.id } }, body: { name: `Tower ${secret}`, client: `Client ${secret}` } })).data!;
    const model = (await api.POST("/projects/{projectId}/models", { params: { path: { projectId: project.id } }, body: { name: `Model ${secret}` } })).data!;
    expect((await api.POST("/models/{modelId}/versions", { params: { path: { modelId: model.id } }, body: { fileName: `file-${secret}.ifc`, sizeBytes: 1000 } })).response.status).toBe(201);
    const boq = (await api.POST("/projects/{projectId}/boqs", { params: { path: { projectId: project.id } }, body: { name: `BoQ ${secret}` } })).data!;
    await api.POST("/boqs/{boqId}/manual-items", { params: { path: { boqId: boq.id } }, body: { item: { id: `m-${secret}`, kind: "preliminary", description: `Hoarding ${secret}`, unit: "m", quantity: 1 } } });
    await admin().POST("/admin/orgs/{orgId}/notes", { params: { path: { orgId: org.id } }, body: { text: "Internal note" } });

    const bodies = await Promise.all([
      admin().GET("/admin/overview"),
      admin().GET("/admin/funnel"),
      admin().GET("/admin/orgs", { params: { query: { limit: 1000 } } }),
      admin().GET("/admin/orgs.csv", { parseAs: "text" }),
      admin().GET("/admin/orgs/{orgId}", { params: { path: { orgId: org.id } } }),
      admin().GET("/admin/orgs/{orgId}/notes", { params: { path: { orgId: org.id } } }),
      admin().GET("/admin/users", { params: { query: { limit: 1000 } } }),
      admin().GET("/admin/health"),
    ]);
    for (const b of bodies) {
      expect(b.response.status).toBe(200);
      expect(typeof b.data === "string" ? b.data : JSON.stringify(b.data)).not.toContain(secret);
    }
    // Seeded content too.
    const all = bodies.map((b) => (typeof b.data === "string" ? b.data : JSON.stringify(b.data))).join("\n");
    for (const name of ["Small Firm house", "Empty project", "NIBS sample", "DPX-01"]) expect(all).not.toContain(name);
  });
});

function uniqueId() {
  return "00000000-0000-4000-8000-" + Date.now().toString(16).padStart(12, "0").slice(-12);
}
