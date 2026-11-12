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
