import { beforeAll, describe, expect, it } from "vitest";
import { API_URL, client } from "../support/env";
import { invitationToken } from "../support/mail";
import { signUp, uniqueEmail, type TestUser } from "../support/users";

/** F09 "Audit log" (FE-033): S18 project activity and S25 org audit, with filters and CSV. */

const slug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

let owner: TestUser;
let member: TestUser;
let orgId: string;
let projectId: string;

beforeAll(async () => {
  owner = await signUp("Audit Owner", uniqueEmail("audit"));
  const { data: org } = await client(owner.token).POST("/orgs", { body: { name: "Audit Firm", slug: slug("audit") } });
  orgId = org!.id;
  const email = uniqueEmail("audit-member");
  await client(owner.token).POST("/orgs/{orgId}/invitations", { params: { path: { orgId } }, body: { email, role: "member" } });
  member = await signUp("Audit Member", email);
  await client(member.token).POST("/invitations/{token}/accept", { params: { path: { token: await invitationToken(email) } } });
  const { data: project } = await client(owner.token).POST("/orgs/{orgId}/projects", { params: { path: { orgId } }, body: { name: "Audited", code: "AUD-1" } });
  projectId = project!.id;
  await client(owner.token).PATCH("/projects/{projectId}", { params: { path: { projectId } }, body: { name: "Audited project" } });
  await client(owner.token).POST("/projects/{projectId}/members", { params: { path: { projectId } }, body: { userId: member.id, role: "viewer" } });
}, 60_000);

describe("project activity (S18)", () => {
  it("filters by actor, action, entity and date", async () => {
    const api = client(owner.token);
    const all = (await api.GET("/projects/{projectId}/audit", { params: { path: { projectId } } })).data!.items;
    expect(all.map((e) => e.action)).toEqual(expect.arrayContaining(["project.created", "project.updated", "project.member_added"]));
    const byAction = (await api.GET("/projects/{projectId}/audit", { params: { path: { projectId }, query: { action: "project.updated" } } })).data!.items;
    expect(byAction.map((e) => e.action)).toEqual(["project.updated"]);
    const byEntity = (await api.GET("/projects/{projectId}/audit", { params: { path: { projectId }, query: { entityType: "user" } } })).data!.items;
    expect(byEntity.every((e) => e.entityType === "user")).toBe(true);
    expect((await api.GET("/projects/{projectId}/audit", { params: { path: { projectId }, query: { actorId: member.id } } })).data!.items).toEqual([]);
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect((await api.GET("/projects/{projectId}/audit", { params: { path: { projectId }, query: { from: future } } })).data!.items).toEqual([]);
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect((await api.GET("/projects/{projectId}/audit", { params: { path: { projectId }, query: { to: past } } })).data!.items).toEqual([]);
  });

  it("pages with a cursor", async () => {
    const api = client(owner.token);
    const first = (await api.GET("/projects/{projectId}/audit", { params: { path: { projectId }, query: { limit: 1 } } })).data!;
    expect(first.items).toHaveLength(1);
    const second = (await api.GET("/projects/{projectId}/audit", { params: { path: { projectId }, query: { limit: 1, cursor: first.nextCursor! } } })).data!;
    expect(second.items[0]!.id).not.toBe(first.items[0]!.id);
  });

  it("is for leads and approvers: a viewer gets 403", async () => {
    expect((await client(member.token).GET("/projects/{projectId}/audit", { params: { path: { projectId } } })).response.status).toBe(403);
    expect((await fetch(`${API_URL}/projects/${projectId}/audit.csv`, { headers: { Authorization: `Bearer ${member.token}` } })).status).toBe(403);
  });
});

describe("org audit (S25)", () => {
  it("lists the org's events with filters; the CSV has the same rows", async () => {
    const api = client(owner.token);
    const joined = (await api.GET("/orgs/{orgId}/audit", { params: { path: { orgId }, query: { action: "member.joined" } } })).data!.items;
    expect(joined).toHaveLength(1);
    expect(joined[0]!.actor?.id).toBe(member.id);
    const res = await fetch(`${API_URL}/orgs/${orgId}/audit.csv?action=member.joined`, { headers: { Authorization: `Bearer ${owner.token}` } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    const lines = (await res.text()).replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("at,actor,action,entityType,entityId,project,data");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Audit Member");
  });

  it("is for owners and admins: a member gets 403", async () => {
    expect((await client(member.token).GET("/orgs/{orgId}/audit", { params: { path: { orgId } } })).response.status).toBe(403);
    expect((await fetch(`${API_URL}/orgs/${orgId}/audit.csv`, { headers: { Authorization: `Bearer ${member.token}` } })).status).toBe(403);
  });
});
