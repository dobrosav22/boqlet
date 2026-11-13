import { describe, expect, it } from "vitest";
import { client } from "../support/env";
import { invitationToken } from "../support/mail";
import { signUp, uniqueEmail } from "../support/users";

/** F16 setup progress (FE-028): `GET/PUT /orgs/{orgId}/setup`; the presets themselves are Library presets. */

const slug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

describe("F16 setup progress", () => {
  it("a new org has none (204); the owner saves steps and drafts; done sets completedAt; members read but can't write", async () => {
    const owner = await signUp("Setup Owner", uniqueEmail("setup"));
    const api = client(owner.token);
    const org = (await api.POST("/orgs", { body: { name: "Setup Firm", slug: slug("setup") } })).data!;
    const none = await api.GET("/orgs/{orgId}/setup", { params: { path: { orgId: org.id } } });
    expect(none.response.status).toBe(204);

    const rules = (await api.POST("/orgs/{orgId}/presets", { params: { path: { orgId: org.id } }, body: { kind: "rule_set", name: "Setup rules", start: { mode: "empty" } } })).data!;
    const started = await api.PUT("/orgs/{orgId}/setup", { params: { path: { orgId: org.id } }, body: { status: "in_progress", step: "measure", ruleSetPresetId: rules.id } });
    expect(started.data).toMatchObject({ status: "in_progress", step: "measure", ruleSetPresetId: rules.id, startedBy: { id: owner.id } });
    expect(started.data!.completedAt).toBeUndefined();
    // Leaving and coming back: the step and the drafts are kept.
    await api.PUT("/orgs/{orgId}/setup", { params: { path: { orgId: org.id } }, body: { step: "items" } });
    expect((await api.GET("/orgs/{orgId}/setup", { params: { path: { orgId: org.id } } })).data).toMatchObject({ step: "items", ruleSetPresetId: rules.id });

    const email = uniqueEmail("setup-member");
    await api.POST("/orgs/{orgId}/invitations", { params: { path: { orgId: org.id } }, body: { email, role: "member" } });
    const member = await signUp("Setup Member", email);
    await client(member.token).POST("/invitations/{token}/accept", { params: { path: { token: await invitationToken(email) } } });
    expect((await client(member.token).GET("/orgs/{orgId}/setup", { params: { path: { orgId: org.id } } })).data).toMatchObject({ status: "in_progress" });
    expect((await client(member.token).PUT("/orgs/{orgId}/setup", { params: { path: { orgId: org.id } }, body: { status: "done" } })).response.status).toBe(403);

    const done = (await api.PUT("/orgs/{orgId}/setup", { params: { path: { orgId: org.id } }, body: { status: "done", step: "review" } })).data!;
    expect(done.status).toBe("done");
    expect(done.completedAt).toBeTruthy();
    const me = (await api.GET("/me")).data!;
    expect(me.memberships.find((m) => m.org.id === org.id)!.org.setup).toMatchObject({ status: "done" });
  });
});
