import type { Page } from "@playwright/test";

export const MOCK_URL = process.env.MOCK_URL ?? "http://localhost:4010";

export interface DevUser {
  id: string;
  name: string;
  email: string;
  token: string;
}

export async function devUsers(): Promise<DevUser[]> {
  const res = await fetch(`${MOCK_URL}/_dev/users`);
  return (await res.json()) as DevUser[];
}

/** A seeded user by the start of their email ("olivia", "marko", ...). */
export async function devUser(key: string): Promise<DevUser> {
  const user = (await devUsers()).find((u) => u.email.startsWith(`${key}@`));
  if (!user) throw new Error(`no seeded user ${key}`);
  return user;
}

/** Signs in through the mock adapter's session, without the sign-in page (for tests of other flows). */
export async function signInAs(page: Page, key: string): Promise<DevUser> {
  const user = await devUser(key);
  const session = { token: user.token, userId: user.id, name: user.name, email: user.email };
  await page.addInitScript((value) => {
    if (!window.sessionStorage.getItem("boqlet-mock-session")) window.sessionStorage.setItem("boqlet-mock-session", value);
  }, JSON.stringify(session));
  return user;
}

export async function emit(event: string, data: Record<string, unknown>, userIds?: string[]) {
  await fetch(`${MOCK_URL}/_dev/emit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, data, userIds }),
  });
}

export const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** A new person in the mock (as if they had signed up). */
export async function createUser(name: string, email: string): Promise<DevUser> {
  const res = await fetch(`${MOCK_URL}/_dev/users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email }) });
  return (await res.json()) as DevUser;
}

/** An org owned by `user`, created through the API. */
export async function createOrg(user: DevUser, name: string, slug: string): Promise<{ id: string; slug: string }> {
  const res = await fetch(`${MOCK_URL}/api/v1/orgs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
    body: JSON.stringify({ name, slug }),
  });
  if (res.status !== 201) throw new Error(`createOrg answered ${res.status}`);
  return (await res.json()) as { id: string; slug: string };
}

/** Links in the newest emails to `email` (the mock's outbox). */
export async function mailLinks(email: string): Promise<string[]> {
  const res = await fetch(`${MOCK_URL}/_dev/outbox`);
  const mails = (await res.json()) as { to: string; links: string[] }[];
  return mails.filter((m) => m.to.toLowerCase() === email.toLowerCase()).flatMap((m) => m.links);
}

/** Signs a page in as an arbitrary mock user (not only the seeded ones). */
export async function signInAsUser(page: Page, user: DevUser) {
  const session = { token: user.token, userId: user.id, name: user.name, email: user.email };
  await page.addInitScript((value) => {
    if (!window.sessionStorage.getItem("boqlet-mock-session")) window.sessionStorage.setItem("boqlet-mock-session", value);
  }, JSON.stringify(session));
}
