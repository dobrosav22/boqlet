/**
 * Dev and test endpoints outside the contract (mock-api.md): seeded users for the sign-in page,
 * the clock, the email outbox, plan checkout, emitting SSE events, and a reset for tests.
 * `/_test/clock` is the test-only endpoint the shared suites use (testing.md); Java has it too.
 */
import { Hono } from "hono";
import { advance, clockOffsetMs, now, resetClock, setNow } from "./clock.js";
import { emit } from "./events.js";
import { listOutbox, readOutboxHtml } from "./outbox.js";
import { buildSeed } from "./seed.js";
import { db, flush, persist, replaceStore } from "./store.js";

export function devRoutes() {
  const dev = new Hono();

  dev.get("/_dev/users", (c) => {
    const store = db();
    return c.json(
      store.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        platformRole: u.platformRole ?? null,
        token: `mock:${u.id}`,
        memberships: store.memberships
          .filter((m) => m.userId === u.id)
          .map((m) => ({ orgId: m.orgId, orgSlug: store.orgs.find((o) => o.id === m.orgId)?.slug, role: m.role })),
      })),
    );
  });

  const clock = new Hono();
  clock.get("/", (c) => c.json({ now: now().toISOString(), offsetMs: clockOffsetMs() }));
  clock.post("/", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { advanceMs?: number; advanceDays?: number; set?: string; reset?: boolean };
    if (body.reset) resetClock();
    else if (body.set) setNow(body.set);
    else advance((body.advanceMs ?? 0) + (body.advanceDays ?? 0) * 86_400_000);
    return c.json({ now: now().toISOString(), offsetMs: clockOffsetMs() });
  });
  dev.route("/_dev/clock", clock);
  dev.route("/_test/clock", clock);

  dev.get("/_dev/outbox", (c) => {
    const mails = listOutbox();
    if (c.req.query("format") !== "html") return c.json(mails);
    const rows = mails
      .map((m) => `<tr><td>${m.sentAt}</td><td>${esc(m.to)}</td><td><a href="/_dev/outbox/${m.id}">${esc(m.subject)}</a></td></tr>`)
      .join("");
    return c.html(`<!doctype html><meta charset="utf-8"><title>Outbox</title><table>${rows}</table>`);
  });
  dev.get("/_dev/outbox/:id", (c) => {
    const html = readOutboxHtml(c.req.param("id"));
    return html === null ? c.notFound() : c.html(html);
  });

  // The `manual` billing adapter: checkout switches the plan at once (F14, FE-035 links here).
  dev.get("/_dev/checkout", (c) => {
    const org = db().orgs.find((o) => o.id === c.req.query("org"));
    const plan = db().plans.find((p) => p.id === c.req.query("plan"));
    if (!org || !plan) return c.json({ code: "not_found", message: "org or plan not found" }, 404);
    org.planId = plan.id;
    persist();
    emit("entity.changed", { entityType: "org", entityId: org.id });
    const back = c.req.query("returnUrl");
    return back ? c.redirect(back) : c.json({ orgId: org.id, planId: plan.id });
  });

  dev.post("/_dev/emit", async (c) => {
    const body = (await c.req.json()) as { event: string; data?: unknown; userIds?: string[] };
    return c.json(emit(body.event, body.data ?? {}, { userIds: body.userIds }));
  });

  dev.post("/_dev/reset", (c) => {
    replaceStore(buildSeed());
    resetClock();
    flush();
    return c.json({ ok: true });
  });

  return dev;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
