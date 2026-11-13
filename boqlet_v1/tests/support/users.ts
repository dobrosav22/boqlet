import { ROOT_URL, TARGET } from "./env";

/**
 * Seeded people (mock-api.md "Seed data"), by first name. How a suite gets a token depends on the
 * backend: the mock lists its users at `/_dev/users` (token `mock:<userId>`); the Java backend
 * gets its own strategy here after the auth decision (BE-000), and the tests don't change.
 */
export type SeedUser = "olivia" | "ivana" | "marko" | "ana" | "victor" | "pat";

export interface TestUser {
  id: string;
  name: string;
  email: string;
  token: string;
}

let cache: Promise<TestUser[]> | null = null;

async function mockUsers(): Promise<TestUser[]> {
  const res = await fetch(`${ROOT_URL}/_dev/users`);
  if (!res.ok) throw new Error(`/_dev/users answered ${res.status}`);
  return (await res.json()) as TestUser[];
}

export async function user(key: SeedUser): Promise<TestUser> {
  if (TARGET !== "mock") throw new Error(`no token strategy for target ${TARGET} yet (BE-000)`);
  cache ??= mockUsers();
  const found = (await cache).find((u) => u.email.startsWith(`${key}@`));
  if (!found) throw new Error(`seeded user ${key} not found`);
  return found;
}

/** A new person, as if they signed up (F01). Mock: `POST /_dev/users`; Java: after BE-000. */
export async function signUp(name: string, email: string): Promise<TestUser> {
  if (TARGET !== "mock") throw new Error(`no sign-up strategy for target ${TARGET} yet (BE-000)`);
  const res = await fetch(`${ROOT_URL}/_dev/users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email }) });
  if (!res.ok) throw new Error(`sign-up answered ${res.status}`);
  return (await res.json()) as TestUser;
}

/** A unique email for one test run. */
export const uniqueEmail = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}@example.com`;

/**
 * The same person, signed in to the app's session `sessionId` (F01 §10): every request then carries
 * the session. Mock: the session id joins the token (`mock:<userId>:<sessionId>`); Java: after BE-000.
 */
export function inSession(u: TestUser, sessionId: string): TestUser {
  if (TARGET !== "mock") throw new Error(`no session strategy for target ${TARGET} yet (BE-000)`);
  return { ...u, token: `${u.token}:${sessionId}` };
}
