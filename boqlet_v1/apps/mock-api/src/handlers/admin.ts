/**
 * F19 platform admin console (FE-038): `/admin/*`, computed from the store. Only users with
 * `platformRole: "admin"` get answers; everyone else gets `404`, so the console isn't revealed
 * (BR-57). Responses carry account metadata, counts and usage, never project content (no project,
 * file or BoQ names, no lines, texts, decisions or prices).
 *
 * Every action and every view of an org's detail is audited with `actorKind: "platform_admin"`.
 * Actions on the account (plan, trial, overrides, suspend) are in the org's own audit log; views,
 * notes and tags (internal, never shown to the org) are in the platform's (`orgId: null`).
 */
import { audit } from "../audit.js";
import { now, nowIso } from "../clock.js";
import { emit } from "../events.js";
import { HttpError, notFound } from "../http.js";
import { newId } from "../ids.js";
import { activeProjectCount } from "../projects.js";
import { json, noContent, type Handlers } from "../router.js";
import { activeSessionOf, sessionView } from "../sessions.js";
import { db, persist, type OrgOpsRec, type OrgRec, type UserRec } from "../store.js";
import { planLimits, seatsInUse } from "./orgs.js";

const DAY = 86_400_000;
const STEPS = ["signed_up", "org_created", "setup_done", "first_model_ready", "first_boq", "first_saved_version", "first_export_or_share"] as const;
type Step = (typeof STEPS)[number];

function requireAdmin(user: UserRec | null) {
  if (user?.platformRole !== "admin") throw notFound();
}

const minutes = (ms: number) => Math.round((ms / 60000) * 100) / 100;
const ops = (orgId: string): OrgOpsRec => (db().orgOps[orgId] ??= {});
const visibleOrgs = () => db().orgs.filter((o) => !db().deletedOrgIds.includes(o.id));
const minOf = (values: (string | undefined | null)[]) => values.filter((v): v is string => !!v).sort()[0] ?? null;
const maxOf = (values: (string | undefined | null)[]) => values.filter((v): v is string => !!v).sort().at(-1) ?? null;

/** The subscription as the `manual` provider keeps it: trialing while a trial set by an admin runs. */
export function subscriptionOf(org: OrgRec) {
  const trialEndsAt = ops(org.id).trialEndsAt ?? null;
  const status = trialEndsAt && trialEndsAt > nowIso() ? "trialing" : "active";
  return { provider: "manual" as const, status, trialEndsAt };
}

const projectIdsOf = (orgId: string) => new Set(db().projects.filter((p) => p.orgId === orgId).map((p) => p.id));
const runsOf = (orgId: string) => {
  const projects = projectIdsOf(orgId);
  const boqs = new Set(db().boqs.filter((b) => projects.has(b.projectId)).map((b) => b.id));
  const revisions = new Map(db().revisions.filter((r) => boqs.has(r.boqId)).map((r) => [r.id, r]));
  return { projects, boqs, revisions, runs: db().runs.filter((r) => revisions.has(r.revisionId)) };
};

/** When the org first reached each activation step (F19 §2; the backend reads these from audit events). */
function milestones(org: OrgRec): Partial<Record<Step, string>> {
  const d = db();
  const { revisions, runs } = runsOf(org.id);
  const owner = d.memberships.filter((m) => m.orgId === org.id && m.role === "owner").sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  const at: Partial<Record<Step, string | null>> = {
    signed_up: owner ? (d.userCreatedAt[owner.userId] ?? null) : null,
    org_created: org.createdAt ?? null,
    setup_done: org.setup?.status === "done" ? (org.setup.completedAt ?? org.setup.updatedAt) : null,
    first_model_ready: minOf(d.jobs.filter((j) => j.orgId === org.id && j.type === "parse" && j.status === "succeeded").map((j) => j.finishedAt)),
    first_boq: minOf(runs.filter((r) => r.status === "complete" || r.status === "needs_input").map((r) => r.finishedAt ?? r.createdAt)),
    first_saved_version: minOf([...revisions.values()].map((r) => r.issuedAt)),
    first_export_or_share: minOf([...d.exports.filter((e) => e.orgId === org.id).map((e) => e.createdAt), ...d.shareLinks.filter((s) => s.orgId === org.id).map((s) => s.createdAt)]),
  };
  return Object.fromEntries(Object.entries(at).filter(([, v]) => !!v)) as Partial<Record<Step, string>>;
}

/** The furthest step in order the org reached without a gap (a later step without the earlier ones doesn't count). */
function reachedSteps(m: Partial<Record<Step, string>>): Step[] {
  const out: Step[] = [];
  for (const s of STEPS) {
    if (s === "signed_up") continue;
    if (!m[s]) break;
    out.push(s);
  }
  return out;
}

function orgRow(org: OrgRec) {
  const d = db();
  const limits = planLimits(org);
  const month = nowIso().slice(0, 7);
  const since30 = new Date(now().getTime() - 30 * DAY).toISOString();
  const sub = subscriptionOf(org);
  const owner = d.memberships.find((m) => m.orgId === org.id && m.role === "owner");
  const lastActivityAt = maxOf([...d.audit.filter((a) => a.orgId === org.id && a.actorKind !== "platform_admin").map((a) => a.at), ...d.memberships.filter((m) => m.orgId === org.id).map((m) => m.lastActiveAt)]);
  return {
    id: org.id,
    name: org.name,
    country: org.settings?.defaultCountry ?? "",
    planId: org.planId,
    status: org.status ?? "active",
    subscriptionStatus: sub.status,
    trialEndsAt: sub.trialEndsAt,
    seats: { used: seatsInUse(org.id), max: limits.seats ?? null },
    activeProjects: { used: activeProjectCount(org.id), max: limits.activeProjects ?? null },
    processingMinutes: { used: minutes(d.usage.filter((u) => u.orgId === org.id && u.at.startsWith(month)).reduce((s, u) => s + u.ms, 0)), max: limits.processingMinutesPerMonth ?? null },
    limitHits30d: d.limitEvents.filter((e) => e.orgId === org.id && e.at >= since30).length,
    lastActivityAt,
    ownerEmail: owner ? (d.users.find((u) => u.id === owner.userId)?.email ?? "") : "",
    tags: ops(org.id).tags ?? [],
    createdAt: org.createdAt ?? d.seededAt,
  };
}
type OrgRow = ReturnType<typeof orgRow>;

function matchesSignal(org: OrgRec, row: OrgRow, signal: string) {
  const t = now().getTime();
  if (signal === "hit_limit") return row.limitHits30d > 0;
  if (signal === "inactive_30d") return !row.lastActivityAt || Date.parse(row.lastActivityAt) < t - 30 * DAY;
  if (signal === "trial_ending_7d") return !!row.trialEndsAt && Date.parse(row.trialEndsAt) > t && Date.parse(row.trialEndsAt) <= t + 7 * DAY;
  if (signal === "stuck_in_setup") return org.setup?.status !== "done";
  return true;
}

function stuckAt(org: OrgRec, step: Step) {
  const i = STEPS.indexOf(step);
  if (i <= 1) return false; // every org has signed up and exists
  const reached = reachedSteps(milestones(org));
  return reached.includes(STEPS[i - 1]!) && !reached.includes(step);
}

const SORTS: Record<string, (r: OrgRow) => string | number> = {
  name: (r) => r.name.toLowerCase(),
  planId: (r) => r.planId,
  country: (r) => r.country,
  createdAt: (r) => r.createdAt,
  lastActivityAt: (r) => r.lastActivityAt ?? "",
  trialEndsAt: (r) => r.trialEndsAt ?? "",
  limitHits30d: (r) => r.limitHits30d,
  seats: (r) => r.seats.used,
  activeProjects: (r) => r.activeProjects.used,
  processingMinutes: (r) => r.processingMinutes.used,
};

/** The orgs table with the console's filters, search and sort (F19 §3). */
function orgRows(query: Record<string, unknown>): OrgRow[] {
  const q = String(query.q ?? "").trim().toLowerCase();
  const rows = visibleOrgs()
    .map((org) => ({ org, row: orgRow(org) }))
    .filter(({ row }) => !query.plan || row.planId === query.plan)
    .filter(({ row }) => !query.status || row.status === query.status || row.subscriptionStatus === query.status)
    .filter(({ row }) => !query.country || row.country.toLowerCase() === String(query.country).toLowerCase())
    .filter(({ row }) => !query.tag || row.tags.includes(String(query.tag)))
    .filter(({ org, row }) => !query.signal || matchesSignal(org, row, String(query.signal)))
    .filter(({ org }) => !query.stuckAt || stuckAt(org, query.stuckAt as Step))
    .filter(({ org, row }) => !q || org.name.toLowerCase().includes(q) || org.slug.includes(q) || row.ownerEmail.toLowerCase().includes(q))
    .map(({ row }) => row);
  const sort = String(query.sort ?? "-createdAt");
  const desc = sort.startsWith("-");
  const key = SORTS[sort.replace(/^-/, "")];
  if (!key) throw new HttpError(400, "invalid_param", `Unknown sort: ${sort}`, { sort });
  return rows.sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const c = x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name);
    return desc ? -c : c;
  });
}

function page<T>(items: T[], query: Record<string, unknown>) {
  const offset = Math.max(0, Number(query.cursor ?? 0) || 0);
  const limit = Math.min(1000, Number(query.limit ?? 100) || 100);
  const slice = items.slice(offset, offset + limit);
  return { items: slice, nextCursor: offset + limit < items.length ? String(offset + limit) : null };
}

function orgDetail(org: OrgRec) {
  const d = db();
  const { projects, boqs, revisions, runs } = runsOf(org.id);
  const models = d.models.filter((m) => projects.has(m.projectId));
  const modelIds = new Set(models.map((m) => m.id));
  const o = ops(org.id);
  const byMonthKind = new Map<string, number>();
  for (const u of d.usage.filter((x) => x.orgId === org.id)) {
    const k = `${u.at.slice(0, 7)}|${u.kind}`;
    byMonthKind.set(k, (byMonthKind.get(k) ?? 0) + u.ms);
  }
  return {
    ...orgRow(org),
    settings: org.settings,
    entitlements: planLimits(org),
    overrides: o.overrides ?? {},
    planHistory: o.planHistory ?? [],
    members: d.memberships
      .filter((m) => m.orgId === org.id)
      .map((m) => {
        const u = d.users.find((x) => x.id === m.userId);
        return { userId: m.userId, name: u?.name ?? "", email: u?.email ?? "", role: m.role, lastActiveAt: m.lastActiveAt ?? null, activeSession: !!activeSessionOf(m.userId) };
      }),
    counts: {
      projectsActive: d.projects.filter((p) => p.orgId === org.id && p.status === "active").length,
      projectsArchived: d.projects.filter((p) => p.orgId === org.id && p.status === "archived").length,
      models: models.length,
      versions: d.modelVersions.filter((v) => modelIds.has(v.modelId)).length,
      boqs: boqs.size,
      confirmedBoqs: d.boqs.filter((b) => boqs.has(b.id) && b.status === "confirmed").length,
      savedVersions: [...revisions.values()].filter((r) => !!r.issuedAt).length,
      runs: runs.length,
      exports: d.exports.filter((e) => e.orgId === org.id).length,
      shareLinks: d.shareLinks.filter((s) => s.orgId === org.id).length,
    },
    usageByMonth: [...byMonthKind]
      .map(([k, ms]) => ({ month: k.split("|")[0]!, kind: k.split("|")[1]!, minutes: minutes(ms) }))
      .sort((a, b) => b.month.localeCompare(a.month) || a.kind.localeCompare(b.kind)),
    limitEvents: d.limitEvents
      .filter((e) => e.orgId === org.id)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 100)
      .map((e) => ({ limit: e.limit, current: e.current, max: e.max, action: e.action, at: e.at })),
    ...(org.setup ? { setup: setupRef(org.setup) } : {}),
  };
}

/** `Org.setup` with only the starter's id and name. */
function setupRef(setup: NonNullable<OrgRec["setup"]>) {
  const { startedBy, ...rest } = setup;
  const by = startedBy?.id ? db().users.find((u) => u.id === startedBy.id) : undefined;
  return { ...rest, ...(by ? { startedBy: { id: by.id, name: by.name } } : {}) };
}

function adminOrg(orgId: string) {
  const org = visibleOrgs().find((o) => o.id === orgId);
  if (!org) throw notFound("organisation");
  return org;
}

const memberIds = (orgId: string) => db().memberships.filter((m) => m.orgId === orgId).map((m) => m.userId);
/** The org's members see a plan, trial, limit or status change at once (`GET /me`, entitlements). */
const orgChanged = (orgId: string) => emit("entity.changed", { entityType: "org", entityId: orgId, change: "updated" }, { userIds: memberIds(orgId) });

function adminAudit(user: UserRec, orgId: string | null, action: string, subjectId: string, data: Record<string, unknown>, subjectType = "org") {
  audit({ orgId, actorId: user.id, actorKind: "platform_admin", action, subjectType, subjectId, data });
}

const reasonOf = (body: unknown) => {
  const reason = String((body as { reason?: string }).reason ?? "").trim();
  if (!reason) throw new HttpError(400, "invalid_body", "A reason is required.", { field: "reason" });
  return reason;
};

// ── overview ──

function period(query: Record<string, unknown>) {
  const to = query.to ? String(query.to) : nowIso().slice(0, 10);
  const from = query.from ? String(query.from) : new Date(Date.parse(`${to}T00:00:00Z`) - 29 * DAY).toISOString().slice(0, 10);
  if (from > to) throw new HttpError(400, "invalid_param", "from is after to.", { from, to });
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`) + DAY;
  return { from, to, start, end, days: Math.round((end - start) / DAY) };
}

/** Value in the period, in the period before it, and a series of buckets (days up to 31, else weeks). */
function tile(times: string[], p: ReturnType<typeof period>, weight?: (i: number) => number) {
  const ms = times.map((t) => Date.parse(t));
  const sum = (from: number, to: number) => ms.reduce((s, t, i) => (t >= from && t < to ? s + (weight ? weight(i) : 1) : s), 0);
  const len = p.end - p.start;
  const bucket = p.days <= 31 ? DAY : 7 * DAY;
  const series: number[] = [];
  for (let b = p.start; b < p.end; b += bucket) series.push(round(sum(b, Math.min(b + bucket, p.end))));
  return { value: round(sum(p.start, p.end)), previous: round(sum(p.start - len, p.start)), series };
}
const round = (v: number) => Math.round(v * 100) / 100;
const snapshot = (value: number | null) => ({ value, previous: null, series: [] as number[] });

function overview(query: Record<string, unknown>) {
  const d = db();
  const p = period(query);
  const orgs = visibleOrgs();
  const orgIds = new Set(orgs.map((o) => o.id));
  const firstRunOfOrgs = d.runs; // active orgs: any run in the period, one per org per bucket
  const runOrg = (runId: string) => {
    const rev = d.revisions.find((r) => r.id === d.runs.find((x) => x.id === runId)?.revisionId);
    const boq = d.boqs.find((b) => b.id === rev?.boqId);
    return d.projects.find((x) => x.id === boq?.projectId)?.orgId;
  };
  const activeOrgsIn = (from: number, to: number) => new Set(firstRunOfOrgs.filter((r) => Date.parse(r.createdAt) >= from && Date.parse(r.createdAt) < to).map((r) => runOrg(r.id)).filter((o) => o && orgIds.has(o))).size;
  const len = p.end - p.start;
  const bucket = p.days <= 31 ? DAY : 7 * DAY;
  const activeSeries: number[] = [];
  for (let b = p.start; b < p.end; b += bucket) activeSeries.push(activeOrgsIn(b, Math.min(b + bucket, p.end)));
  const seats = orgs.map((o) => ({ used: seatsInUse(o.id), max: planLimits(o).seats }));
  const usage = d.usage.filter((u) => orgIds.has(u.orgId));
  const confirmed = d.audit.filter((a) => a.action === "boq.confirmed" && a.orgId && orgIds.has(a.orgId));
  const views = d.shareLinks.filter((s) => orgIds.has(s.orgId) && s.lastViewedAt);
  const orgsByPlan: Record<string, number> = {};
  for (const o of orgs) orgsByPlan[o.planId] = (orgsByPlan[o.planId] ?? 0) + 1;
  return {
    period: { from: p.from, to: p.to },
    tiles: {
      signUps: tile(Object.values(d.userCreatedAt), p),
      newOrgs: tile(orgs.map((o) => o.createdAt ?? d.seededAt), p),
      activeOrgs: { value: activeOrgsIn(p.start, p.end), previous: activeOrgsIn(p.start - len, p.start), series: activeSeries },
      payingOrgs: snapshot(orgs.filter((o) => o.planId !== "free").length),
      revenue: snapshot(null),
      seatsUsed: snapshot(seats.reduce((s, x) => s + x.used, 0)),
      seatsAvailable: snapshot(seats.reduce((s, x) => s + (x.max !== undefined ? Math.max(0, x.max - x.used) : 0), 0)),
      activeProjects: snapshot(orgs.reduce((s, o) => s + activeProjectCount(o.id), 0)),
      modelsParsed: tile(d.jobs.filter((j) => j.type === "parse" && j.status === "succeeded" && orgIds.has(j.orgId)).map((j) => j.finishedAt ?? j.createdAt), p),
      runs: tile(d.runs.filter((r) => { const o = runOrg(r.id); return !!o && orgIds.has(o); }).map((r) => r.createdAt), p),
      processingMinutes: tile(usage.map((u) => u.at), p, (i) => usage[i]!.ms / 60000),
      exports: tile(d.exports.filter((e) => orgIds.has(e.orgId)).map((e) => e.createdAt), p),
      savedVersions: tile(d.revisions.filter((r) => r.issuedAt).map((r) => r.issuedAt!), p),
      confirmedBoqs: tile(confirmed.map((a) => a.at), p),
      // Views aren't logged one by one in the mock: a link's views count on the day it was last seen.
      shareLinkViews: tile(views.map((s) => s.lastViewedAt!), p, (i) => views[i]!.views),
    },
    orgsByPlan,
  };
}

// ── funnel ──

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return round(s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2);
};

/** ISO week, e.g. `2026-W46`. */
function isoWeek(iso: string) {
  const date = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / DAY + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function funnel(query: Record<string, unknown>) {
  const d = db();
  const p = period(query);
  const inPeriod = (t?: string | null) => !!t && Date.parse(t) >= p.start && Date.parse(t) < p.end;
  const signUps = Object.entries(d.userCreatedAt).filter(([, at]) => inPeriod(at));
  // The cohort: orgs created in the period, followed through every later step whenever it happened.
  const cohort = visibleOrgs()
    .filter((o) => inPeriod(o.createdAt ?? d.seededAt))
    .map((o) => ({ org: o, m: milestones(o), reached: reachedSteps(milestones(o)) }));
  const counts: Record<Step, number> = Object.fromEntries(STEPS.map((s) => [s, 0])) as Record<Step, number>;
  counts.signed_up = signUps.length;
  for (const c of cohort) for (const s of c.reached) counts[s]++;
  const steps = STEPS.map((step, i) => {
    const prev = i > 0 ? STEPS[i - 1]! : null;
    const hours =
      prev === null
        ? []
        : cohort.filter((c) => c.reached.includes(step) && (prev === "signed_up" ? !!c.m.signed_up : c.reached.includes(prev))).map((c) => (Date.parse(c.m[step]!) - Date.parse(c.m[prev]!)) / 3_600_000).filter((h) => h >= 0);
    return {
      step,
      orgs: counts[step],
      ...(prev ? { conversionPct: counts[prev] ? round((counts[step] / counts[prev]) * 100) : 0 } : {}),
      medianHoursFromPrevious: prev ? median(hours) : null,
    };
  });
  const weeks = new Map<string, number[]>();
  const bump = (week: string, i: number) => {
    const row = weeks.get(week) ?? STEPS.map(() => 0);
    row[i]!++;
    weeks.set(week, row);
  };
  for (const [, at] of signUps) bump(isoWeek(at), 0);
  for (const c of cohort) {
    const week = isoWeek(c.org.createdAt ?? d.seededAt);
    for (const s of c.reached) bump(week, STEPS.indexOf(s));
  }
  return { steps, cohorts: [...weeks].sort(([a], [b]) => a.localeCompare(b)).map(([week, cs]) => ({ week, counts: cs })) };
}

// ── health ──

const percentile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))]!;
};

function health() {
  const d = db();
  const since = new Date(now().getTime() - 30 * DAY).toISOString();
  const failed = new Map<string, number>();
  for (const j of d.jobs.filter((x) => x.status === "failed" && (x.finishedAt ?? x.createdAt) >= since)) {
    const day = (j.finishedAt ?? j.createdAt).slice(0, 10);
    failed.set(day, (failed.get(day) ?? 0) + 1);
  }
  const durations = new Map<string, number[]>();
  for (const j of d.jobs.filter((x) => x.status === "succeeded" && x.startedAt && x.finishedAt && x.finishedAt >= since)) {
    const list = durations.get(j.type) ?? [];
    list.push(Date.parse(j.finishedAt!) - Date.parse(j.startedAt!));
    durations.set(j.type, list);
  }
  return {
    failedJobsPerDay: [...failed].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
    jobDurationsMs: Object.fromEntries([...durations].sort(([a], [b]) => a.localeCompare(b)).map(([type, xs]) => [type, { p50: percentile(xs, 0.5), p95: percentile(xs, 0.95) }])),
    // The mock has no billing provider webhooks and no email bounces.
    billingWebhookFailures: 0,
    emailBounces: 0,
  };
}

// ── users ──

function userRow(u: UserRec) {
  const d = db();
  const session = activeSessionOf(u.id);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    orgs: d.memberships
      .filter((m) => m.userId === u.id && !d.deletedOrgIds.includes(m.orgId))
      .map((m) => ({ orgId: m.orgId, orgName: d.orgs.find((o) => o.id === m.orgId)?.name ?? "", role: m.role })),
    lastSignInAt: maxOf(d.sessions.filter((s) => s.userId === u.id).map((s) => s.createdAt)),
    ...(session ? { activeSession: sessionView(session) } : {}),
    ...(d.userCreatedAt[u.id] ? { createdAt: d.userCreatedAt[u.id] } : {}),
  };
}

// ── CSV ──

function orgsCsv(rows: OrgRow[]): Response {
  const cell = (v: unknown) => {
    const t = v === null || v === undefined ? "" : String(v);
    return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const header = ["id", "name", "country", "planId", "status", "subscriptionStatus", "trialEndsAt", "seatsUsed", "seatsMax", "activeProjects", "activeProjectsMax", "processingMinutes", "processingMinutesMax", "limitHits30d", "lastActivityAt", "createdAt", "ownerEmail", "tags"];
  const lines = rows.map((r) => [r.id, r.name, r.country, r.planId, r.status, r.subscriptionStatus, r.trialEndsAt, r.seats.used, r.seats.max, r.activeProjects.used, r.activeProjects.max, r.processingMinutes.used, r.processingMinutes.max, r.limitHits30d, r.lastActivityAt, r.createdAt, r.ownerEmail, r.tags.join("; ")]);
  return new Response("﻿" + [header, ...lines].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n", {
    status: 200,
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="orgs-${nowIso().slice(0, 10)}.csv"` },
  });
}

export const adminHandlers: Handlers = {
  adminOverview({ user, query }) {
    requireAdmin(user);
    return json(overview(query));
  },

  adminFunnel({ user, query }) {
    requireAdmin(user);
    return json(funnel(query));
  },

  adminListOrgs({ user, query }) {
    requireAdmin(user);
    return json(page(orgRows(query), query));
  },

  adminExportOrgs({ user, query }) {
    requireAdmin(user);
    return orgsCsv(orgRows(query));
  },

  adminGetOrg({ user, params }) {
    requireAdmin(user);
    const org = adminOrg(params.orgId!);
    adminAudit(user!, null, "admin.org_viewed", org.id, { orgId: org.id });
    return json(orgDetail(org));
  },

  /** Tags (internal: audited in the platform's log) and suspend / reactivate (in the org's log too). */
  adminUpdateOrg({ user, params, body }) {
    requireAdmin(user);
    const org = adminOrg(params.orgId!);
    const b = body as { tags?: string[]; status?: "active" | "suspended"; reason: string };
    const reason = reasonOf(b);
    if (b.tags) {
      const tags = [...new Set(b.tags.map((t) => t.trim()).filter(Boolean))].sort();
      const from = ops(org.id).tags ?? [];
      ops(org.id).tags = tags;
      adminAudit(user!, null, "admin.org_tagged", org.id, { orgId: org.id, from, to: tags, reason });
    }
    if (b.status && b.status !== (org.status ?? "active")) {
      const from = org.status ?? "active";
      org.status = b.status;
      adminAudit(user!, org.id, b.status === "suspended" ? "org.suspended" : "org.reactivated", org.id, { from, to: b.status, reason });
      orgChanged(org.id);
    }
    persist();
    return json(orgDetail(org));
  },

  /** F14 through the `manual` provider: the plan and the trial change at once. */
  adminSetSubscription({ user, params, body }) {
    requireAdmin(user);
    const org = adminOrg(params.orgId!);
    const b = body as { planId?: string; trialEndsAt?: string | null; reason: string };
    const reason = reasonOf(b);
    if (b.planId === undefined && b.trialEndsAt === undefined) throw new HttpError(400, "invalid_body", "Change the plan, the trial or both.");
    if (b.planId !== undefined && !db().plans.some((p) => p.id === b.planId)) throw notFound("plan");
    const at = nowIso();
    if (b.planId !== undefined && b.planId !== org.planId) {
      const from = org.planId;
      org.planId = b.planId;
      (ops(org.id).planHistory ??= []).push({ planId: b.planId, at, by: user!.name });
      adminAudit(user!, org.id, "org.plan_changed", org.id, { from, to: b.planId, reason });
    }
    if (b.trialEndsAt !== undefined) {
      const from = ops(org.id).trialEndsAt ?? null;
      ops(org.id).trialEndsAt = b.trialEndsAt;
      adminAudit(user!, org.id, "org.trial_changed", org.id, { from, to: b.trialEndsAt, reason });
    }
    persist();
    orgChanged(org.id);
    return json(orgDetail(org));
  },

  /** Entitlement name → value on top of the plan; `null` removes that override. */
  adminSetEntitlementOverrides({ user, params, body }) {
    requireAdmin(user);
    const org = adminOrg(params.orgId!);
    const b = body as { overrides: Record<string, unknown>; reason: string };
    const reason = reasonOf(b);
    const from = { ...(ops(org.id).overrides ?? {}) };
    const next = { ...from };
    for (const [k, v] of Object.entries(b.overrides)) {
      if (v === null) delete next[k];
      else if (typeof v === "number" || typeof v === "boolean") next[k] = v;
      else throw new HttpError(400, "invalid_body", `An override is a number, a boolean or null: ${k}`, { field: k });
    }
    ops(org.id).overrides = next;
    adminAudit(user!, org.id, "org.entitlements_overridden", org.id, { from, to: next, reason });
    persist();
    orgChanged(org.id);
    return json(orgDetail(org));
  },

  adminListNotes({ user, params }) {
    requireAdmin(user);
    const org = adminOrg(params.orgId!);
    return json(
      db()
        .adminNotes.filter((n) => n.orgId === org.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((n) => {
          const a = db().users.find((u) => u.id === n.authorId);
          return { id: n.id, text: n.text, author: { id: n.authorId, name: a?.name ?? "Unknown", ...(a?.email ? { email: a.email } : {}) }, createdAt: n.createdAt };
        }),
    );
  },

  adminAddNote({ user, params, body }) {
    requireAdmin(user);
    const org = adminOrg(params.orgId!);
    const text = String((body as { text: string }).text).trim();
    if (!text) throw new HttpError(400, "invalid_body", "The note is empty.", { field: "text" });
    const note = { id: newId(), orgId: org.id, authorId: user!.id, text, createdAt: nowIso() };
    db().adminNotes.push(note);
    adminAudit(user!, null, "admin.note_added", note.id, { orgId: org.id }, "adminNote");
    persist();
    return json({ id: note.id, text, author: { id: user!.id, name: user!.name, email: user!.email }, createdAt: note.createdAt }, 201);
  },

  adminListUsers({ user, query }) {
    requireAdmin(user);
    const q = String(query.q ?? "").trim().toLowerCase();
    const users = db()
      .users.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
    return json(page(users.map(userRow), query));
  },

  /** F19 §5: the support case "I'm locked out on another device". The person signs in again. */
  adminEndUserSession({ user, params }) {
    requireAdmin(user);
    const target = db().users.find((u) => u.id === params.userId);
    if (!target) throw notFound("user");
    const session = activeSessionOf(target.id);
    if (!session) throw notFound("session");
    session.status = "ended";
    session.endedAt = nowIso();
    adminAudit(user!, null, "admin.session_ended", target.id, { sessionId: session.id }, "user");
    persist();
    return noContent();
  },

  adminHealth({ user }) {
    requireAdmin(user);
    return json(health());
  },
};
