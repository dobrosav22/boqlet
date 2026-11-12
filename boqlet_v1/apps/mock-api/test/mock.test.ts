import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Each run gets its own data folder; set before the mock's modules read it.
const tmp = mkdtempSync(path.join(os.tmpdir(), "boqlet-mock-"));
process.env.MOCK_DATA_DIR = tmp;

const { createApp } = await import("../src/app.js");
const { SEED } = await import("../src/seed.js");
const { signedUrl } = await import("../src/blobs.js");
const { sendEmail } = await import("../src/outbox.js");
const { emit } = await import("../src/events.js");

type App = Awaited<ReturnType<typeof createApp>>;
let app: App;
const as = (userId: string) => ({ Authorization: `Bearer mock:${userId}` });
const api = (p: string, init: RequestInit = {}) => app.request(`http://localhost:4010/api/v1${p}`, init);

beforeAll(async () => {
  app = await createApp({ reseed: true });
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("GET /me (FE-003 acceptance)", () => {
  it("returns the seeded memberships of the user in the token", async () => {
    const res = await api("/me", { headers: as(SEED.users.olivia) });
    expect(res.status).toBe(200);
    const me = (await res.json()) as { user: { name: string }; memberships: { org: { slug: string }; role: string }[] };
    expect(me.user.name).toBe("Olivia Owner");
    expect(me.memberships.map((m) => [m.org.slug, m.role]).sort()).toEqual([
      ["small-firm", "owner"],
      ["studio-demo", "owner"],
    ]);
  });

  it("gives each seeded user their own role", async () => {
    const res = await api("/me", { headers: as(SEED.users.ivana) });
    const me = (await res.json()) as { memberships: { org: { slug: string }; role: string }[] };
    expect(me.memberships).toHaveLength(1);
    expect(me.memberships[0]).toMatchObject({ org: { slug: "studio-demo" }, role: "library_editor" });
  });

  it("answers 401 unauthenticated without a token or with an unknown user", async () => {
    for (const headers of [{}, as("00000000-0000-4000-8000-000000000000"), { Authorization: "Bearer nope" }]) {
      const res = await api("/me", { headers });
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ code: "unauthenticated" });
    }
  });
});

describe("contract validation (FE-003 acceptance)", () => {
  const post = (body: unknown) =>
    api("/orgs", { method: "POST", headers: { ...as(SEED.users.olivia), "Content-Type": "application/json" }, body: JSON.stringify(body) });

  it("rejects a body that breaks the schema with 400 invalid_body", async () => {
    const res = await post({ name: "New firm", slug: "Not A Slug" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_body" });
  });

  it("rejects a missing required field", async () => {
    const res = await post({ slug: "new-firm" });
    expect(res.status).toBe(400);
  });

  it("rejects unknown fields with 400 unknown_field", async () => {
    const res = await post({ name: "New firm", slug: "new-firm", colour: "red" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "unknown_field", details: { field: "colour" } });
  });

  it("rejects malformed JSON", async () => {
    const res = await api("/orgs", { method: "POST", headers: { ...as(SEED.users.olivia), "Content-Type": "application/json" }, body: "{" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_body" });
  });

  it("rejects a path parameter that is not a uuid with 400 invalid_param", async () => {
    const res = await api("/orgs/not-a-uuid", { headers: as(SEED.users.olivia) });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_param" });
  });

  it("answers 404 for paths the contract doesn't have and 405 for wrong methods", async () => {
    expect((await api("/nothing-here", { headers: as(SEED.users.olivia) })).status).toBe(404);
    const res = await api("/me", { method: "DELETE", headers: as(SEED.users.olivia) });
    expect(res.status).toBe(405);
  });

  it("answers 501 for valid requests to operations the mock doesn't implement yet", async () => {
    const res = await post({ name: "New firm", slug: "new-firm" });
    expect([201, 501]).toContain(res.status);
  });

  it("serves public operations without a token, and its responses match the contract", async () => {
    const res = await api("/plans");
    expect(res.status).toBe(200);
    const plans = (await res.json()) as { id: string }[];
    expect(plans.map((p) => p.id)).toEqual(["free", "professional", "team", "enterprise"]);
  });
});

describe("SSE bus", () => {
  async function firstEvents(res: Response, count: number) {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    const events: { id: string; event: string; data: unknown }[] = [];
    while (events.length < count) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
      let idx: number;
      while ((idx = text.indexOf("\n\n")) >= 0) {
        const chunk = text.slice(0, idx);
        text = text.slice(idx + 2);
        const field = (name: string) => chunk.split("\n").find((l) => l.startsWith(`${name}:`))?.slice(name.length + 1).trim();
        if (field("event")) events.push({ id: field("id")!, event: field("event")!, data: JSON.parse(field("data")!) });
      }
    }
    await reader.cancel();
    return events;
  }

  it("replays what came after Last-Event-ID, only to the users an event names", async () => {
    const first = emit("entity.changed", { entityType: "org", entityId: "a" });
    emit("notification.created", { id: "for-marko" }, { userIds: [SEED.users.marko] });
    emit("entity.changed", { entityType: "org", entityId: "b" });
    const res = await api("/events", { headers: { ...as(SEED.users.olivia), "Last-Event-ID": first.id } });
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    const events = await firstEvents(res, 1);
    expect(events[0]).toMatchObject({ event: "entity.changed", data: { entityId: "b" } });
  });

  it("delivers events emitted through /_dev/emit", async () => {
    const res = await api("/events", { headers: as(SEED.users.ana) });
    const pending = firstEvents(res, 1);
    await new Promise((r) => setTimeout(r, 50));
    await app.request("http://localhost:4010/_dev/emit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "job.finished", data: { jobId: "j1", type: "parse" } }),
    });
    expect((await pending)[0]).toMatchObject({ event: "job.finished", data: { jobId: "j1" } });
  });
});

describe("dev endpoints and storage", () => {
  it("lists seeded users with their tokens", async () => {
    const users = (await (await app.request("http://localhost:4010/_dev/users")).json()) as { name: string; token: string }[];
    expect(users.map((u) => u.name)).toContain("Pat Platform");
    expect(users[0]!.token).toMatch(/^mock:/);
  });

  it("moves the clock forward", async () => {
    const before = (await (await app.request("http://localhost:4010/_test/clock")).json()) as { now: string };
    const res = await app.request("http://localhost:4010/_test/clock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ advanceDays: 2 }) });
    const after = (await res.json()) as { now: string };
    expect(new Date(after.now).getTime() - new Date(before.now).getTime()).toBeGreaterThanOrEqual(2 * 86_400_000 - 1000);
    await app.request("http://localhost:4010/_test/clock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reset: true }) });
  });

  it("stores and serves blobs through signed URLs only", async () => {
    const key = "orgs/x/models/y/source.ifc";
    const put = new URL(signedUrl(key, "PUT").url);
    expect((await app.request(put.pathname + put.search, { method: "PUT", body: "ISO-10303-21;" })).status).toBe(200);
    const get = new URL(signedUrl(key, "GET").url);
    const res = await app.request(get.pathname + get.search);
    expect(await res.text()).toBe("ISO-10303-21;");
    expect((await app.request(get.pathname + "?method=GET&exp=1&sig=bad")).status).toBe(403);
  });

  it("writes emails to the outbox", async () => {
    sendEmail({ to: "olivia@example.com", subject: "Welcome", kind: "test", html: '<a href="http://localhost:3000/x">open</a>' });
    const mails = (await (await app.request("http://localhost:4010/_dev/outbox")).json()) as { subject: string; links: string[] }[];
    expect(mails[0]).toMatchObject({ subject: "Welcome", links: ["http://localhost:3000/x"] });
  });

  it("switches the plan on checkout", async () => {
    const res = await app.request(`http://localhost:4010/_dev/checkout?org=${SEED.orgs.small}&plan=professional`);
    expect(await res.json()).toMatchObject({ planId: "professional" });
  });
});

describe("parameters of operations under a path with its own parameters", () => {
  it("validates an inline query parameter against its own schema (listPresets ?kind=, FE-008 fix)", async () => {
    const res = await api(`/orgs/${SEED.orgs.studio}/presets?kind=classification&layer=system`, { headers: as(SEED.users.olivia) });
    expect(res.status).toBe(200);
    const presets = (await res.json()) as { kind: string; layer: string }[];
    expect(presets.length).toBeGreaterThan(0);
    expect(presets.every((p) => p.kind === "classification" && p.layer === "system")).toBe(true);
    const bad = await api(`/orgs/${SEED.orgs.studio}/presets?kind=system`, { headers: as(SEED.users.olivia) });
    expect(bad.status).toBe(400);
  });
});
