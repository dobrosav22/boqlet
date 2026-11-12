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
