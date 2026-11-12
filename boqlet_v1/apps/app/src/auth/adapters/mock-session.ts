/**
 * The mock adapter's session: the token `mock:<userId>` and the user's name and email, kept in
 * `sessionStorage` (one tab, one user) as architecture.md says. A tiny store so React can
 * subscribe to sign-in and sign-out.
 */
export interface MockSession {
  token: string;
  userId: string;
  name: string;
  email: string;
}

const KEY = "boqlet-mock-session";
const listeners = new Set<() => void>();
let cached: MockSession | null | undefined;

export function readMockSession(): MockSession | null {
  if (cached !== undefined) return cached;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as MockSession) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function writeMockSession(session: MockSession | null) {
  cached = session;
  try {
    if (session) window.sessionStorage.setItem(KEY, JSON.stringify(session));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the session lives for this page only */
  }
  listeners.forEach((l) => l());
}

export function subscribeMockSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
