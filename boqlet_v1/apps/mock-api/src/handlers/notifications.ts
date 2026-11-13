/**
 * F13 (FE-018): the user's notifications (newest first, paged, unread only on request), marking one or
 * all read, and the email preferences per category.
 */
import { nowIso } from "../clock.js";
import { HttpError, notFound } from "../http.js";
import { EMAIL_CATEGORIES, emailPreferences } from "../notify.js";
import { json, noContent, type Handlers } from "../router.js";
import { db, persist, type NotificationRec } from "../store.js";

const view = ({ userId: _u, ...n }: NotificationRec) => n;

export const notificationHandlers: Handlers = {
  listNotifications({ user, query }) {
    const mine = db()
      .notifications.filter((n) => n.userId === user!.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const unreadOnly = query.unreadOnly === true || query.unreadOnly === "true";
    const shown = unreadOnly ? mine.filter((n) => !n.readAt) : mine;
    const start = query.cursor ? Number.parseInt(String(query.cursor), 10) : 0;
    if (!Number.isInteger(start) || start < 0) throw new HttpError(400, "invalid_param", "Bad cursor.");
    const limit = Math.min(Number(query.limit ?? 50), 200);
    return json({
      items: shown.slice(start, start + limit).map(view),
      unreadCount: mine.filter((n) => !n.readAt).length,
      nextCursor: start + limit < shown.length ? String(start + limit) : null,
    });
  },

  markNotificationRead({ user, params }) {
    const n = db().notifications.find((x) => x.id === params.notificationId && x.userId === user!.id);
    if (!n) throw notFound("notification");
    n.readAt ??= nowIso();
    persist();
    return noContent();
  },

  markAllNotificationsRead({ user }) {
    const at = nowIso();
    for (const n of db().notifications) if (n.userId === user!.id && !n.readAt) n.readAt = at;
    persist();
    return noContent();
  },

  getNotificationPreferences({ user }) {
    return json({ email: emailPreferences(user!.id) });
  },

  setNotificationPreferences({ user, body }) {
    const email = ((body ?? {}) as { email?: Record<string, boolean> }).email ?? {};
    const unknown = Object.keys(email).filter((k) => !(EMAIL_CATEGORIES as readonly string[]).includes(k));
    if (unknown.length) throw new HttpError(400, "invalid_body", "Unknown notification category.", { categories: unknown });
    db().notificationPreferences[user!.id] = { ...(db().notificationPreferences[user!.id] ?? {}), ...email };
    persist();
    return json({ email: emailPreferences(user!.id) });
  },
};
