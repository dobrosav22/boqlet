import { beforeAll, describe, expect, it } from "vitest";
import { client } from "../support/env";
import { invitationToken, mailsTo } from "../support/mail";
import { signUp, uniqueEmail, type TestUser } from "../support/users";

/**
 * BR-50 (every read and write is scoped to the caller's org and project role; others get 404), BR-52
 * (deleting an org), and the core operations no other suite calls: revoking an invitation, editing a
 * model, deleting a model version.
 */

const slug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

let owner: TestUser;
let stranger: TestUser;
let orgId: string;
let projectId: string;
let boqId: string;
let modelId: string;

beforeAll(async () => {
  owner = await signUp("Iso Owner", uniqueEmail("iso-owner"));
  stranger = await signUp("Iso Stranger", uniqueEmail("iso-stranger"));
  const { data: org } = await client(owner.token).POST("/orgs", { body: { name: "Iso Firm", slug: slug("iso") } });
  orgId = org!.id;
  projectId = (await client(owner.token).POST("/orgs/{orgId}/projects", { params: { path: { orgId } }, body: { name: "Private" } })).data!.id;
  boqId = (await client(owner.token).POST("/projects/{projectId}/boqs", { params: { path: { projectId } }, body: { name: "Private BoQ" } })).data!.id;
  modelId = (await client(owner.token).POST("/projects/{projectId}/models", { params: { path: { projectId } }, body: { name: "Arch" } })).data!.id;
}, 60_000);

describe("BR-50: another org's people see nothing of it", () => {
  it("answers 404 on the org, its projects, BoQs, models, library, audit, usage and attention", async () => {
    const api = client(stranger.token);
    const calls = [
      api.GET("/orgs/{orgId}", { params: { path: { orgId } } }),
      api.GET("/orgs/{orgId}/projects", { params: { path: { orgId } } }),
      api.GET("/orgs/{orgId}/members", { params: { path: { orgId } } }),
      api.GET("/orgs/{orgId}/presets", { params: { path: { orgId } } }),
      api.GET("/orgs/{orgId}/attention", { params: { path: { orgId } } }),
      api.GET("/orgs/{orgId}/audit", { params: { path: { orgId } } }),
      api.GET("/orgs/{orgId}/entitlements", { params: { path: { orgId } } }),
      api.GET("/projects/{projectId}", { params: { path: { projectId } } }),
      api.GET("/projects/{projectId}/boqs", { params: { path: { projectId } } }),
      api.GET("/boqs/{boqId}", { params: { path: { boqId } } }),
      api.GET("/boqs/{boqId}/overrides", { params: { path: { boqId } } }),
      api.GET("/models/{modelId}", { params: { path: { modelId } } }),
      api.PATCH("/projects/{projectId}", { params: { path: { projectId } }, body: { name: "Mine now" } }),
      api.PATCH("/models/{modelId}", { params: { path: { modelId } }, body: { name: "Mine now" } }),
      api.POST("/boqs/{boqId}/overrides", { params: { path: { boqId } }, body: { lineKey: "x", excluded: true, reason: "no" } }),
    ];
    for (const res of await Promise.all(calls)) expect({ url: res.response.url, status: res.response.status }).toEqual({ url: res.response.url, status: 404 });
  });
});

describe("operations no other suite calls", () => {
  it("a model's name and discipline change (F03), audited", async () => {
    const res = await client(owner.token).PATCH("/models/{modelId}", { params: { path: { modelId } }, body: { name: "Architecture", discipline: "architecture" } });
    expect(res.data).toMatchObject({ name: "Architecture", discipline: "architecture" });
    const audit = (await client(owner.token).GET("/projects/{projectId}/audit", { params: { path: { projectId }, query: { action: "model.updated" } } })).data!.items;
    expect(audit).toHaveLength(1);
  });

  it("a model version nobody uses is deleted (F03)", async () => {
    const { data } = await client(owner.token).POST("/models/{modelId}/versions", { params: { path: { modelId } }, body: { fileName: "draft.ifc", sizeBytes: 100 } });
    const versionId = data!.version.id;
    expect((await client(owner.token).DELETE("/model-versions/{versionId}", { params: { path: { versionId } } })).response.status).toBe(204);
    expect((await client(owner.token).GET("/model-versions/{versionId}", { params: { path: { versionId } } })).response.status).toBe(404);
  });

  it("a revoked invitation can't be accepted (F01 §5)", async () => {
    const email = uniqueEmail("iso-invitee");
    const { data: inv } = await client(owner.token).POST("/orgs/{orgId}/invitations", { params: { path: { orgId } }, body: { email, role: "member" } });
    const token = await invitationToken(email);
    expect((await client(owner.token).DELETE("/orgs/{orgId}/invitations/{invitationId}", { params: { path: { orgId, invitationId: inv!.id } } })).response.status).toBe(204);
    const invitee = await signUp("Invitee", email);
    expect((await client(invitee.token).POST("/invitations/{token}/accept", { params: { path: { token } } })).response.status).not.toBe(200);
    expect((await client(invitee.token).GET("/me")).data!.memberships.map((m) => m.org.id)).not.toContain(orgId);
  });

  it("BR-52: deleting the org needs its name typed; it disappears for its members at once and they are told", async () => {
    const email = uniqueEmail("iso-member");
    await client(owner.token).POST("/orgs/{orgId}/invitations", { params: { path: { orgId } }, body: { email, role: "member" } });
    const member = await signUp("Iso Member", email);
    await client(member.token).POST("/invitations/{token}/accept", { params: { path: { token: await invitationToken(email) } } });
    expect((await client(owner.token).DELETE("/orgs/{orgId}", { params: { path: { orgId } }, body: { confirmName: "Wrong" } })).response.status).toBe(400);
    expect((await client(member.token).DELETE("/orgs/{orgId}", { params: { path: { orgId } }, body: { confirmName: "Iso Firm" } })).response.status).toBe(403);
    expect((await client(owner.token).DELETE("/orgs/{orgId}", { params: { path: { orgId } }, body: { confirmName: "Iso Firm" } })).response.status).toBe(202);
    for (const u of [owner, member]) expect((await client(u.token).GET("/me")).data!.memberships.map((m) => m.org.id)).not.toContain(orgId);
    expect((await client(owner.token).GET("/projects/{projectId}", { params: { path: { projectId } } })).response.status).toBe(404);
    expect((await mailsTo(email)).some((m) => /being deleted/.test(m.subject))).toBe(true);
  });
});
