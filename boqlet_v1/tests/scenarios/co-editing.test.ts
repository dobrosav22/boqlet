import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client } from "../support/env";
import { listen } from "../support/events";
import { invitationToken } from "../support/mail";
import { signUp, uniqueEmail, type TestUser } from "../support/users";

/** F06 §14, P31, BR-29 (FE-040): presence in a BoQ and saved edits pushed to everyone in it. */

const slug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

let lead: TestUser;
let estimator: TestUser;
let boqId: string;
type Presence = { boqId: string; users: { userId: string; name: string; lineKey?: string | null }[] };
type Edited = { boqId: string; lineKeys: string[]; by: { id: string; name: string }; at: string };
const streams: { close: () => void }[] = [];

beforeAll(async () => {
  lead = await signUp("Lena Lead", uniqueEmail("coedit-lead"));
  const { data: org } = await client(lead.token).POST("/orgs", { body: { name: "Co-editing Firm", slug: slug("coedit") } });
  const email = uniqueEmail("coedit-est");
  await client(lead.token).POST("/orgs/{orgId}/invitations", { params: { path: { orgId: org!.id } }, body: { email, role: "member" } });
  estimator = await signUp("Eddie Estimator", email);
  await client(estimator.token).POST("/invitations/{token}/accept", { params: { path: { token: await invitationToken(email) } } });
  const { data: project } = await client(lead.token).POST("/orgs/{orgId}/projects", { params: { path: { orgId: org!.id } }, body: { name: "Together" } });
  await client(lead.token).POST("/projects/{projectId}/members", { params: { path: { projectId: project!.id } }, body: { userId: estimator.id, role: "estimator" } });
  const { data: boq } = await client(lead.token).POST("/projects/{projectId}/boqs", { params: { path: { projectId: project!.id } }, body: { name: "Shared BoQ" } });
  boqId = boq!.id;
}, 60_000);

afterAll(() => streams.forEach((s) => s.close()));

describe("presence (F06 §14)", () => {
  it("everyone in the BoQ sees who else is in it and the line they edit; leaving removes them", async () => {
    const leadEvents = await listen(lead.token);
    streams.push(leadEvents);
    const joined = await client(lead.token).PUT("/boqs/{boqId}/presence", { params: { path: { boqId } }, body: {} });
    expect(joined.data!.users.map((u) => u.userId)).toEqual([lead.id]);

    await client(estimator.token).PUT("/boqs/{boqId}/presence", { params: { path: { boqId } }, body: { lineKey: "line-7" } });
    const seen = await leadEvents.next<Presence>("boq.presence", (p) => p.boqId === boqId && p.users.some((u) => u.userId === estimator.id));
    expect(seen.users.find((u) => u.userId === estimator.id)).toMatchObject({ name: "Eddie Estimator", lineKey: "line-7" });

    expect((await client(estimator.token).DELETE("/boqs/{boqId}/presence", { params: { path: { boqId } } })).response.status).toBe(204);
    await leadEvents.next<Presence>("boq.presence", (p) => p.boqId === boqId && !p.users.some((u) => u.userId === estimator.id) && p.users.some((u) => u.userId === lead.id));
  });

  it("only people who can see the BoQ may be in it", async () => {
    const stranger = await signUp("Stranger", uniqueEmail("coedit-stranger"));
    expect((await client(stranger.token).PUT("/boqs/{boqId}/presence", { params: { path: { boqId } }, body: {} })).response.status).toBe(404);
  });
});

describe("saved edits reach everyone in the BoQ (F06 §14, BR-29)", () => {
  it("an edit is announced within a second with its lines and who made it; on the same line the later edit wins", async () => {
    const leadEvents = await listen(lead.token);
    streams.push(leadEvents);
    await client(lead.token).PUT("/boqs/{boqId}/presence", { params: { path: { boqId } }, body: {} });
    await client(estimator.token).PUT("/boqs/{boqId}/presence", { params: { path: { boqId } }, body: { lineKey: "wall-1" } });

    await client(lead.token).POST("/boqs/{boqId}/overrides", { params: { path: { boqId } }, body: { lineKey: "wall-1", quantity: 10, reason: "Lead's measure" } });
    const started = Date.now();
    const saved = await client(estimator.token).POST("/boqs/{boqId}/overrides", { params: { path: { boqId } }, body: { lineKey: "wall-1", quantity: 12, reason: "Estimator's measure" } });
    expect(saved.response.status).toBe(200);
    const edited = await leadEvents.next<Edited>("boq.line_edited", (e) => e.boqId === boqId && e.by.id === estimator.id, 1_000);
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(edited).toMatchObject({ lineKeys: ["wall-1"], by: { name: "Eddie Estimator" } });

    const overrides = (await client(lead.token).GET("/boqs/{boqId}/overrides", { params: { path: { boqId } } })).data!;
    expect(overrides.filter((o) => o.lineKey === "wall-1")).toEqual([expect.objectContaining({ quantity: 12 })]);
  });
});
