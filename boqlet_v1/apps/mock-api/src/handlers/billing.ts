/**
 * F14 for the UI (FE-019): an org's effective entitlements with its usage, the month's processing
 * usage, and the subscription with the `manual` billing adapter: checkout is the dev page
 * `/_dev/checkout`, which switches the plan at once; the portal has nothing to manage and returns.
 */
import { publicBaseUrl } from "../blobs.js";
import { nowIso } from "../clock.js";
import { HttpError, notFound } from "../http.js";
import { memberOrg, requireOrgAction } from "../permissions.js";
import { activeProjectCount } from "../projects.js";
import { json, type Handlers } from "../router.js";
import { db } from "../store.js";
import { planLimits, seatsInUse } from "./orgs.js";

const minutes = (ms: number) => Math.round((ms / 60000) * 100) / 100;
const monthUsage = (orgId: string, month: string) => db().usage.filter((u) => u.orgId === orgId && u.at.startsWith(month));

export const billingHandlers: Handlers = {
  getEntitlements({ user, params }) {
    const { org } = memberOrg(user!, params.orgId!);
    return json({
      planId: org.planId,
      limits: planLimits(org),
      usage: {
        seats: seatsInUse(org.id),
        activeProjects: activeProjectCount(org.id),
        processingMinutesThisMonth: minutes(monthUsage(org.id, nowIso().slice(0, 7)).reduce((s, u) => s + u.ms, 0)),
      },
    });
  },

  getUsage({ user, params, query }) {
    const { org } = requireOrgAction(user!, params.orgId!, "seeUsage");
    const month = query.month ? String(query.month) : nowIso().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, "invalid_param", "month is YYYY-MM.", { month });
    const rows = monthUsage(org.id, month);
    const byProject = new Map<string, number>();
    const byKind: Record<string, number> = {};
    for (const u of rows) {
      if (u.projectId) byProject.set(u.projectId, (byProject.get(u.projectId) ?? 0) + u.ms);
      byKind[u.kind] = (byKind[u.kind] ?? 0) + u.ms;
    }
    return json({
      month,
      processingMinutes: minutes(rows.reduce((s, u) => s + u.ms, 0)),
      byProject: [...byProject]
        .map(([projectId, ms]) => ({ projectId, projectName: db().projects.find((p) => p.id === projectId)?.name ?? "", minutes: minutes(ms) }))
        .sort((a, b) => b.minutes - a.minutes),
      byKind: Object.fromEntries(Object.entries(byKind).map(([k, ms]) => [k, minutes(ms)])),
    });
  },

  getBilling({ user, params }) {
    const { org } = requireOrgAction(user!, params.orgId!, "manageBilling");
    return json({ planId: org.planId, status: "active", provider: "manual", trialEndsAt: null, currentPeriodEnd: null, plans: db().plans });
  },

  createCheckout({ user, params, body }) {
    const { org } = requireOrgAction(user!, params.orgId!, "manageBilling");
    const b = body as { planId: string; returnUrl: string };
    if (!db().plans.some((p) => p.id === b.planId)) throw notFound("plan");
    const q = new URLSearchParams({ org: org.id, plan: b.planId, returnUrl: b.returnUrl });
    return json({ url: `${publicBaseUrl()}/_dev/checkout?${q.toString()}` });
  },

  createBillingPortal({ user, params, body }) {
    requireOrgAction(user!, params.orgId!, "manageBilling");
    // The manual adapter has no customer portal: cards and invoices don't exist; back to the app.
    return json({ url: (body as { returnUrl: string }).returnUrl });
  },
};
