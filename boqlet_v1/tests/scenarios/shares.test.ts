import { beforeAll, describe, expect, it } from "vitest";
import type { Schemas } from "@ifc-boq/api";
import { API_URL, client } from "../support/env";
import { invitationToken } from "../support/mail";
import { duplexBytes, uploadVersion, waitForVersion } from "../support/models";
import { signUp, uniqueEmail, type TestUser } from "../support/users";

/** F18 public share links (FE-036, BR-56), through the API only. */

const slug = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

let lead: TestUser;
let estimator: TestUser;
let approver: TestUser;
let viewer: TestUser;
let orgId: string;
let projectId: string;
let boqId: string;
let editedKey: string;
const SECRET_REASON = "Secret reason for the edit";

const as = (u: TestUser) => client(u.token);
const tokenOf = (url: string) => url.split("/s/")[1]!;
const pub = (token: string, rest = "", init: RequestInit = {}) => fetch(`${API_URL}/public/shares/${token}${rest}`, { redirect: "manual", ...init });

async function member(name: string, projectRole: "estimator" | "approver" | "viewer") {
  const email = uniqueEmail(projectRole);
  await as(lead).POST("/orgs/{orgId}/invitations", { params: { path: { orgId } }, body: { email, role: "member" } });
  const person = await signUp(name, email);
  await as(person).POST("/invitations/{token}/accept", { params: { path: { token: await invitationToken(email) } } });
  await as(lead).POST("/projects/{projectId}/members", { params: { path: { projectId } }, body: { userId: person.id, role: projectRole } });
  return person;
}

async function generate() {
  const boq = (await as(lead).GET("/boqs/{boqId}", { params: { path: { boqId } } })).data!;
  const { data } = await as(lead).POST("/revisions/{revisionId}/runs", { params: { path: { revisionId: boq.currentRevision.id } } });
  const deadline = Date.now() + 120_000;
  for (;;) {
    const { data: run } = await as(lead).GET("/runs/{runId}", { params: { path: { runId: data!.run.id } } });
    if (run && run.status !== "queued" && run.status !== "running") return run;
    if (Date.now() > deadline) throw new Error("run did not finish");
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function share(u: TestUser, body: Schemas["ShareLinkCreate"]) {
  const res = await as(u).POST("/boqs/{boqId}/share-links", { params: { path: { boqId } }, body });
  return res;
}

async function save() {
  const boq = (await as(lead).GET("/boqs/{boqId}", { params: { path: { boqId } } })).data!;
  const res = await as(lead).POST("/revisions/{revisionId}/issue", { params: { path: { revisionId: boq.currentRevision.id } }, body: { notModelledConfirmed: true } });
  expect(res.response.status).toBe(200);
  return res.data!;
}

beforeAll(async () => {
  lead = await signUp("Lena Sharer", uniqueEmail("shares"));
  const { data: org } = await as(lead).POST("/orgs", { body: { name: "Share Firm", slug: slug("shares") } });
  orgId = org!.id;
  // Four people: more seats than the free plan has (and its "Made with" badge goes away).
  const { data: checkout } = await as(lead).POST("/orgs/{orgId}/billing/checkout", { params: { path: { orgId } }, body: { planId: "team", returnUrl: "http://localhost:3000/back" } });
  await fetch(checkout!.url, { redirect: "manual" });
  const { data: project } = await as(lead).POST("/orgs/{orgId}/projects", { params: { path: { orgId } }, body: { name: "Shared Duplex" } });
  projectId = project!.id;
  estimator = await member("Erik Estimator", "estimator");
  approver = await member("Ana Approver", "approver");
  viewer = await member("Vic Viewer", "viewer");
  const { data: model } = await as(lead).POST("/projects/{projectId}/models", { params: { path: { projectId } }, body: { name: "Architecture", discipline: "architecture" } });
  const version = await uploadVersion(lead, model!.id, await duplexBytes(), "Duplex_A.ifc");
  expect((await waitForVersion(lead, version.id)).status).toBe("ready");
  boqId = (await as(lead).POST("/projects/{projectId}/boqs", { params: { path: { projectId } }, body: { name: "Tender" } })).data!.id;
  const run = await generate();
  const { data: lines } = await as(lead).GET("/runs/{runId}/lines", { params: { path: { runId: run.id } } });
  editedKey = lines!.items.find((l) => l.quantity && l.quantity > 1)!.key;
  await as(lead).POST("/boqs/{boqId}/overrides", { params: { path: { boqId } }, body: { lineKey: editedKey, quantity: 1234, reason: SECRET_REASON } });
  await generate();
}, 300_000);

describe("create and the public page (F18 §1–2)", () => {
  let token: string;

  it("a pinned link: the full URL once, the token stored hashed", async () => {
    const res = await share(estimator, { mode: "pinned", label: "For the client", include: { lineDetail: true, viewer: true } });
    expect(res.response.status).toBe(201);
    expect(res.data).toMatchObject({ mode: "pinned", status: "active", label: "For the client", include: { lineDetail: true, viewer: true, log: false, excel: false }, views: 0, revisionLabel: "A" });
    expect(res.data!.url).toMatch(/\/s\/[A-Za-z0-9_-]{43}$/);
    token = tokenOf(res.data!.url);
    const { data: list } = await as(lead).GET("/boqs/{boqId}/share-links", { params: { path: { boqId } } });
    expect(JSON.stringify(list)).not.toContain(token);
    expect(list!.find((l) => l.id === res.data!.id)).not.toHaveProperty("url");
  });

  it("opens with no account: the sheet, the line detail, the 3D view; views are counted", async () => {
    const res = await pub(token);
    expect(res.status).toBe(200);
    const shared = (await res.json()) as Schemas["PublicShare"];
    expect(shared).toMatchObject({ firmName: "Share Firm", projectName: "Shared Duplex", boqName: "Tender", revisionLabel: "A", revisionStatus: "draft", madeWithBadge: false });
    expect(shared.modelVersionIds).toHaveLength(1);
    const lines = (await (await pub(token, "/lines")).json()) as Schemas["LinesPage"];
    expect(lines.items.length).toBeGreaterThan(10);
    expect(lines.items.find((l) => l.key === editedKey)!.quantity).toBe(1234);
    const detail = await pub(token, `/lines/by-key?key=${encodeURIComponent(editedKey)}`);
    expect(detail.status).toBe(200);
    expect(((await detail.json()) as { log?: unknown }).log).toBeUndefined();
    expect((await pub(token, "/scene")).status).toBe(200);
    expect((await pub(token, `/geometry/${shared.modelVersionIds![0]}`)).status).toBe(302);
    expect((await pub(token, "/export")).status).toBe(404);
    const { data: list } = await as(lead).GET("/boqs/{boqId}/share-links", { params: { path: { boqId } } });
    expect(list!.find((l) => l.status === "active" && l.label === "For the client")!.views).toBeGreaterThanOrEqual(1);
  });

  it("BR-56: no public response carries member names, edits' reasons, decisions, questions or prices", async () => {
    const shared = (await (await pub(token)).json()) as Schemas["PublicShare"];
    const bodies = [JSON.stringify(shared)];
    bodies.push(await (await pub(token, "/lines")).text());
    bodies.push(await (await pub(token, `/lines/by-key?key=${encodeURIComponent(editedKey)}`)).text());
    bodies.push(await (await pub(token, "/scene")).text());
    const all = bodies.join("\n");
    for (const banned of ["Lena Sharer", "Erik Estimator", "Ana Approver", lead.email, SECRET_REASON, '"overridden"', '"decision', '"questions"', '"reviewComments"', '"createdBy"', '"price', '"rate"']) expect(all, banned).not.toContain(banned);
  });

  it("editing changes includes and expiry, never the token; the Excel when included", async () => {
    const { data: list } = await as(lead).GET("/boqs/{boqId}/share-links", { params: { path: { boqId } } });
    const id = list!.find((l) => l.label === "For the client")!.id;
    const res = await as(estimator).PATCH("/share-links/{shareLinkId}", { params: { path: { shareLinkId: id } }, body: { include: { excel: true, log: true } } });
    expect(res.data!.include).toMatchObject({ excel: true, log: true, viewer: true });
    const file = await pub(token, "/export");
    expect(file.status).toBe(302);
    expect((await fetch(file.headers.get("location")!)).ok).toBe(true);
    expect(((await (await pub(token, `/lines/by-key?key=${encodeURIComponent(editedKey)}`)).json()) as { log?: unknown[] }).log).toBeInstanceOf(Array);
  });
});

describe("revoke, org switch, expiry (F18 §3–4, BR-56)", () => {
  it("revoking makes every public endpoint 404 at once", async () => {
    const { data } = await share(lead, { mode: "pinned" });
    const token = tokenOf(data!.url);
    expect((await pub(token)).status).toBe(200);
    expect((await as(lead).DELETE("/share-links/{shareLinkId}", { params: { path: { shareLinkId: data!.id } } })).response.status).toBe(204);
    for (const rest of ["", "/lines", "/scene", "/export"]) expect((await pub(token, rest)).status).toBe(404);
    expect((await as(lead).GET("/boqs/{boqId}/share-links", { params: { path: { boqId } } })).data!.find((l) => l.id === data!.id)!.status).toBe("revoked");
  });

  it("publicLinksAllowed off suspends every link of the org, and on again brings them back", async () => {
    const { data } = await share(lead, { mode: "pinned" });
    const token = tokenOf(data!.url);
    await as(lead).PATCH("/orgs/{orgId}", { params: { path: { orgId } }, body: { settings: { publicLinksAllowed: false } } });
    expect((await pub(token)).status).toBe(404);
    expect((await as(lead).GET("/orgs/{orgId}/share-links", { params: { path: { orgId } } })).data!.find((l) => l.id === data!.id)!.status).toBe("suspended");
    expect((await share(lead, { mode: "pinned" })).response.status).toBe(409);
    await as(lead).PATCH("/orgs/{orgId}", { params: { path: { orgId } }, body: { settings: { publicLinksAllowed: true } } });
    expect((await pub(token)).status).toBe(200);
  });

  it("an expired link is 404", async () => {
    const { data } = await share(lead, { mode: "pinned", expiresAt: new Date(Date.now() - 60_000).toISOString() });
    expect(data!.status).toBe("expired");
    expect((await pub(tokenOf(data!.url))).status).toBe(404);
  });

  it("who may: viewers can't share; estimators revoke their own only; approvers revoke any; the org list is the owners' and admins'", async () => {
    expect((await share(viewer, { mode: "pinned" })).response.status).toBe(403);
    const mine = (await share(estimator, { mode: "pinned" })).data!;
    const leads = (await share(lead, { mode: "pinned" })).data!;
    expect((await as(estimator).DELETE("/share-links/{shareLinkId}", { params: { path: { shareLinkId: leads.id } } })).response.status).toBe(403);
    expect((await as(estimator).DELETE("/share-links/{shareLinkId}", { params: { path: { shareLinkId: mine.id } } })).response.status).toBe(204);
    expect((await as(approver).DELETE("/share-links/{shareLinkId}", { params: { path: { shareLinkId: leads.id } } })).response.status).toBe(204);
    expect((await as(estimator).GET("/orgs/{orgId}/share-links", { params: { path: { orgId } } })).response.status).toBe(403);
    const all = (await as(lead).GET("/orgs/{orgId}/share-links", { params: { path: { orgId } } })).data!;
    expect(all.every((l) => l.projectName === "Shared Duplex" && l.boqName === "Tender")).toBe(true);
  });
});

describe("follow the latest saved version (F18 §1, F18-AC3)", () => {
  it("shows nothing until a version is saved, then A, then B, with the same link", async () => {
    const { data } = await share(lead, { mode: "latest_issued" });
    const token = tokenOf(data!.url);
    const before = (await (await pub(token)).json()) as Schemas["PublicShare"];
    expect(before).toMatchObject({ revisionLabel: null, runAt: null });
    expect(((await (await pub(token, "/lines")).json()) as Schemas["LinesPage"]).items).toEqual([]);
    await save();
    expect(((await (await pub(token)).json()) as Schemas["PublicShare"]).revisionLabel).toBe("A");
    await as(lead).POST("/boqs/{boqId}/overrides", { params: { path: { boqId } }, body: { lineKey: editedKey, quantity: 99, reason: "x" } });
    await generate();
    await save();
    const after = (await (await pub(token)).json()) as Schemas["PublicShare"];
    expect(after).toMatchObject({ revisionLabel: "B", revisionStatus: "issued" });
    expect(((await (await pub(token, "/lines")).json()) as Schemas["LinesPage"]).items.find((l) => l.key === editedKey)!.quantity).toBe(99);
  }, 180_000);

  it("a pinned link whose version was saved since is labelled with the saved version", async () => {
    const { data: links } = await as(lead).GET("/boqs/{boqId}/share-links", { params: { path: { boqId } } });
    const pinned = links!.find((l) => l.label === "For the client")!;
    expect(pinned.revisionLabel).toBe("A");
  });
});
