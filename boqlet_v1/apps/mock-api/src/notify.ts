/**
 * F13 notifications in the mock: a row per recipient (`{kind, params, entity, url}`, never rendered
 * text), pushed over SSE as `notification.created`, and an email when the kind's category is one the
 * recipient wants by email. Kinds, their category and their default email follow F13 "Events".
 */
import { nowIso } from "./clock.js";
import { emit } from "./events.js";
import { newId } from "./ids.js";
import { sendEmail } from "./outbox.js";
import { db, persist } from "./store.js";

/** Core email categories (contract `NotificationPreferences`); modules add their own later (P36). */
export const EMAIL_CATEGORIES = ["jobs", "versions", "reviews", "membership", "limits"] as const;
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number];

/** Kind → category, and whether it is emailed at all (F13 "Email (default)"). */
const KINDS: Record<string, { category: EmailCategory; email: boolean }> = {
  "job.succeeded": { category: "jobs", email: false },
  "job.failed": { category: "jobs", email: true },
  "model_version.ready": { category: "jobs", email: false },
  "run.needs_input": { category: "jobs", email: false },
  "boq.new_version_available": { category: "versions", email: false },
  "version.saved": { category: "versions", email: false },
  "boq.confirmed": { category: "versions", email: true },
  "boq.reopened": { category: "versions", email: true },
  "revision.review_requested": { category: "reviews", email: true },
  "revision.changes_requested": { category: "reviews", email: true },
  "revision.approved": { category: "reviews", email: true },
  "revision.review_withdrawn": { category: "reviews", email: false },
  "project_member.added": { category: "membership", email: true },
  "limit.near": { category: "limits", email: true },
  "limit.reached": { category: "limits", email: true },
};

/** Subjects of the emails the mock sends (the backend renders them per language, F13 "Behaviour"). */
const SUBJECTS: Record<string, (p: Record<string, unknown>) => string> = {
  "job.failed": (p) => (p.type === "run" ? `Generating ${String(p.boq ?? "the BoQ")} failed` : `A ${String(p.type ?? "job")} failed`),
  "boq.confirmed": (p) => `${String(p.boq ?? "A BoQ")} was confirmed`,
  "boq.reopened": (p) => `${String(p.boq ?? "A BoQ")} was reopened`,
  "project_member.added": (p) => `You were added to ${String(p.project ?? "a project")}`,
};

/** A user's email choices: every core category on unless turned off. */
export function emailPreferences(userId: string): Record<EmailCategory, boolean> {
  const saved = db().notificationPreferences[userId] ?? {};
  return Object.fromEntries(EMAIL_CATEGORIES.map((c) => [c, saved[c] ?? true])) as Record<EmailCategory, boolean>;
}

export function notify(n: { userId: string; orgId: string | null; kind: string; params: Record<string, unknown>; url: string; entity: { type: string; id: string } }) {
  const rec = { id: newId(), userId: n.userId, orgId: n.orgId, kind: n.kind, params: n.params, entityType: n.entity.type, entityId: n.entity.id, url: n.url, readAt: null, createdAt: nowIso() };
  db().notifications.push(rec);
  persist();
  const { userId: _u, ...view } = rec;
  emit("notification.created", view, { userIds: [n.userId] });
  const kind = KINDS[n.kind];
  const user = db().users.find((u) => u.id === n.userId);
  if (kind?.email && user && emailPreferences(n.userId)[kind.category]) {
    const subject = (SUBJECTS[n.kind] ?? (() => n.kind))(n.params);
    const link = `${process.env.APP_URL ?? "http://localhost:3000"}${n.url}`;
    sendEmail({ to: user.email, subject, kind: n.kind, html: `<p>${subject}.</p><p><a href="${link}">Open in boqlet</a></p>` });
  }
  return rec;
}
