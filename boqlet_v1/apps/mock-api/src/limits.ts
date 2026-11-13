/**
 * F13 `limit.near` (80 % of a limit) and `limit.reached` to the org's owners and admins (F14). Each is
 * sent once per org and limit until the period turns: the calendar month for processing minutes, else
 * 30 days. The 402 itself stays the caller's (BR-60).
 */
import { nowIso } from "./clock.js";
import { HttpError, limitReached } from "./http.js";
import { notify } from "./notify.js";
import { db } from "./store.js";

const NEAR = 0.8;

function sentRecently(orgId: string, kind: string, limit: string) {
  const now = nowIso();
  const since = limit === "processingMinutesPerMonth" ? `${now.slice(0, 7)}-01T00:00:00.000Z` : new Date(Date.parse(now) - 30 * 86_400_000).toISOString();
  return db().notifications.some((n) => n.orgId === orgId && n.kind === kind && n.params.limit === limit && n.createdAt >= since);
}

function tellAdmins(orgId: string, kind: "limit.near" | "limit.reached", params: Record<string, unknown>) {
  if (sentRecently(orgId, kind, String(params.limit))) return;
  const org = db().orgs.find((o) => o.id === orgId);
  if (!org) return;
  const admins = db().memberships.filter((m) => m.orgId === orgId && (m.role === "owner" || m.role === "admin"));
  for (const m of admins) notify({ userId: m.userId, orgId, kind, params, url: `/${org.slug}/settings/usage`, entity: { type: "org", id: orgId } });
}

/** The 402 for a limit, and `limit.reached` to the owners and admins. Feature limits (max 0) aren't announced. */
export function limitHit(orgId: string, limit: string, current: number, max: number): HttpError {
  if (max > 0) tellAdmins(orgId, "limit.reached", { limit, current, max });
  return limitReached(limit, current, max);
}

/** After an action that uses up a limit: `limit.near` once usage is at 80 % or more (and still under it). */
export function usageNow(orgId: string, limit: string, current: number, max: number | undefined) {
  if (max === undefined || max <= 0 || current < Math.ceil(max * NEAR)) return;
  tellAdmins(orgId, current >= max ? "limit.reached" : "limit.near", { limit, current: Math.ceil(current), max });
}
