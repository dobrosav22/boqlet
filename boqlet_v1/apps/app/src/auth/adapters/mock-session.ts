/**
 * The mock adapter's sign-in: the token `mock:<userId>` and the user's name and email, plus the
 * app session it is bound to (F01 §10: the token then becomes `mock:<userId>:<sessionId>`).
 * Kept in `localStorage` so the tabs of one browser share one sign-in and one session (F01 §10);
 * a tiny store so React can subscribe to sign-in and sign-out, also from another tab.
 *
 * `sessionless` marks a sign-in made by test helpers (e2e): like the shared suites, they act as
 * API clients and don't open a session, so parallel tests as one seeded user don't take over
 * each other.
 */
export interface MockSession {
  token: string;
  userId: string;
  name: string;
  email: string;
  sessionId?: string;
  sessionless?: boolean;
}

const KEY = "boqlet-mock-session";
const listeners = new Set<() => void>();
let cached: MockSession | null | undefined;

export function readMockSession(): MockSession | null {
  if (cached !== undefined) return cached;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as MockSession) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function writeMockSession(session: MockSession | null) {
  cached = session;
  try {
    if (session) window.localStorage.setItem(KEY, JSON.stringify(session));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the session lives for this page only */
  }
  listeners.forEach((l) => l());
}

export function subscribeMockSession(listener: () => void) {
  listeners.add(listener);
  // Another tab signed in or out.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cached = undefined;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
