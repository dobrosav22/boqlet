/**
 * Mock auth (conventions.md): `Authorization: Bearer mock:<userId>[:<sessionId>]`.
 *
 * The app opens a session after sign-in (`POST /sessions`, F01 §10) and from then on sends the
 * session's id with its token, the way a `sid` claim is bound at session creation
 * (04-architecture/security.md). Every request with a session id is checked against the account's
 * one active session (BR-54): a replaced one gets `401 session_replaced`, an idle one
 * `401 session_expired`. Tokens without a session id are the test clients' (suites, e2e helpers,
 * dev tools) and skip that check; the app never sends one after sign-in.
 */
import { HttpError, unauthenticated } from "./http.js";
import { checkSession } from "./sessions.js";
import { db, type SessionRec, type UserRec } from "./store.js";

export function parseToken(header: string | undefined | null): { userId: string; sessionId?: string } | null {
  const m = /^Bearer mock:([^:\s]+)(?::(\S+))?$/i.exec(header ?? "");
  if (!m) return null;
  return { userId: m[1]!, ...(m[2] ? { sessionId: m[2] } : {}) };
}

/** The user (and session) a request is made as; throws 401 for a session that isn't the active one. */
export function authenticate(header: string | undefined | null): { user: UserRec; session?: SessionRec } | null {
  const token = parseToken(header);
  if (!token) return null;
  const user = db().users.find((u) => u.id === token.userId);
  if (!user) return null;
  if (!token.sessionId) return { user };
  const session = db().sessions.find((s) => s.id === token.sessionId && s.userId === user.id);
  if (!session) throw unauthenticated();
  const problem = checkSession(session);
  if (problem) throw new HttpError(401, problem.code, problem.message);
  return { user, session };
}

/** For callers that only need the user (public operations, dev pages). */
export function userFromAuthorization(header: string | undefined | null): UserRec | null {
  const token = parseToken(header);
  return token ? (db().users.find((u) => u.id === token.userId) ?? null) : null;
}
