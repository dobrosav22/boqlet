/**
 * F01 §10 (FE-012): one active session per account. `POST /sessions` after sign-in opens one, or
 * answers `409 session_active` with the other one; with `takeover` the other is replaced, gets
 * `session.revoked` over SSE and `401 session_replaced` on its next request. Takeovers are audited
 * in every org of the account, so its owners see an account being passed around.
 */
import { audit } from "../audit.js";
import { nowIso } from "../clock.js";
import { emit } from "../events.js";
import { HttpError, unauthenticated } from "../http.js";
import { newId } from "../ids.js";
import { json, noContent, type Handlers } from "../router.js";
import { activeSessionOf, sessionView } from "../sessions.js";
import { db, persist, type SessionRec } from "../store.js";

export const sessionHandlers: Handlers = {
  openSession({ user, session: current, body }) {
    const b = body as { deviceLabel: string; takeover?: boolean };
    const deviceLabel = b.deviceLabel.trim();
    if (!deviceLabel) throw new HttpError(400, "invalid_body", "Name the device, e.g. \"Chrome on Windows\".");
    const active = activeSessionOf(user!.id);
    // Asking again from the session that is already the active one is not a second sign-in.
    if (active && current?.id === active.id) return json(sessionView(active), 201);
    if (active && !b.takeover) {
      return json(
        { code: "session_active", message: `Your account is open on ${active.deviceLabel}. Continue here and sign out there?`, details: { deviceLabel: active.deviceLabel }, activeSession: sessionView(active) },
        409,
      );
    }
    const at = nowIso();
    const next: SessionRec = { id: newId(), userId: user!.id, status: "active", deviceLabel, lastSeenAt: at, createdAt: at };
    if (active) {
      active.status = "replaced";
      active.endedAt = at;
      active.replacedBy = next.id;
      for (const m of db().memberships.filter((x) => x.userId === user!.id))
        audit({ orgId: m.orgId, actorId: user!.id, action: "session.replaced", subjectType: "user", subjectId: user!.id, data: { from: active.deviceLabel, to: deviceLabel } });
      emit("session.revoked", { sessionId: active.id }, { userIds: [user!.id] });
    }
    db().sessions.push(next);
    persist();
    return json(sessionView(next), 201);
  },

  getCurrentSession({ session }) {
    if (!session) throw unauthenticated();
    return json(sessionView(session));
  },

  closeCurrentSession({ session }) {
    if (session && session.status === "active") {
      session.status = "ended";
      session.endedAt = nowIso();
      persist();
    }
    return noContent();
  },
};
