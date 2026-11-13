/**
 * One active session per account (BR-54, F01 §10, state-machines.md "Session"): active until
 * sign-out (`ended`), a takeover elsewhere (`replaced`) or 12 h without a request (`expired`,
 * `MOCK_SESSION_IDLE_HOURS`), on the mock's clock.
 */
import { now, nowIso } from "./clock.js";
import { db, persist, type SessionRec } from "./store.js";

const idleMs = () => Number(process.env.MOCK_SESSION_IDLE_HOURS ?? 12) * 3_600_000;

/** Marks an active session that has been idle too long as expired; true when it is (still) active. */
function stillActive(s: SessionRec): boolean {
  if (s.status !== "active") return false;
  if (now().getTime() - new Date(s.lastSeenAt).getTime() > idleMs()) {
    s.status = "expired";
    s.endedAt = nowIso();
    persist();
    return false;
  }
  return true;
}

export function activeSessionOf(userId: string): SessionRec | undefined {
  return db().sessions.find((s) => s.userId === userId && stillActive(s));
}

const MESSAGES = {
  session_replaced: "You were signed out because your account was opened on another device.",
  session_expired: "You were signed out after a long time without activity.",
  unauthenticated: "Sign in first.",
} as const;

/** Why a request with this session is refused, or null when it may go on (its activity is recorded). */
export function checkSession(s: SessionRec): { code: keyof typeof MESSAGES; message: string } | null {
  if (!stillActive(s)) {
    const code = s.status === "replaced" ? "session_replaced" : s.status === "expired" ? "session_expired" : "unauthenticated";
    return { code, message: MESSAGES[code] };
  }
  s.lastSeenAt = nowIso();
  persist();
  return null;
}

export function sessionView(s: SessionRec) {
  return { id: s.id, status: s.status, deviceLabel: s.deviceLabel, ...(s.place ? { place: s.place } : {}), lastSeenAt: s.lastSeenAt, createdAt: s.createdAt };
}
