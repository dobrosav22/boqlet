import { expect, type Page } from "@playwright/test";

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

/** Signs in through the mock adapter's storage, without the sign-in page and without an app session (for tests of other flows). */
export async function signInAs(page: Page, key: string): Promise<DevUser> {
  const user = await devUser(key);
  // Session-less (F01 §10), like the shared suites: parallel tests as one seeded user don't take over each other.
  const session = { token: user.token, userId: user.id, name: user.name, email: user.email, sessionless: true };
  await page.addInitScript((value) => {
    if (!window.localStorage.getItem("boqlet-mock-session")) window.localStorage.setItem("boqlet-mock-session", value);
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
  // Session-less (F01 §10), like the shared suites: parallel tests as one seeded user don't take over each other.
  const session = { token: user.token, userId: user.id, name: user.name, email: user.email, sessionless: true };
  await page.addInitScript((value) => {
    if (!window.localStorage.getItem("boqlet-mock-session")) window.localStorage.setItem("boqlet-mock-session", value);
  }, JSON.stringify(session));
}

/** A JSON call to the mock API as `user`. */
export async function apiAs<T>(user: DevUser, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${MOCK_URL}/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} answered ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/** A model with one uploaded version, through the API (signed upload), waited until ready. */
export async function modelWithVersion(user: DevUser, projectId: string, name: string, bytes: Uint8Array, fileName: string) {
  const model = await apiAs<{ id: string }>(user, "POST", `/projects/${projectId}/models`, { name, discipline: "architecture" });
  const { version, upload } = await apiAs<{ version: { id: string }; upload: { method: string; url: string; headers: Record<string, string> } }>(user, "POST", `/models/${model.id}/versions`, { fileName, sizeBytes: bytes.byteLength });
  const put = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: new Blob([bytes as BlobPart]) });
  if (!put.ok) throw new Error(`upload answered ${put.status}`);
  await apiAs(user, "POST", `/model-versions/${version.id}/complete`, {});
  const deadline = Date.now() + 180_000;
  for (;;) {
    const v = await apiAs<{ status: string }>(user, "GET", `/model-versions/${version.id}`);
    if (v.status === "ready") return { modelId: model.id, versionId: version.id };
    if (v.status === "failed" || Date.now() > deadline) throw new Error(`version ${version.id} is ${v.status}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

/**
 * A Studio Demo project with the Duplex and a BoQ under the given classifications (slugs), generated
 * and finished, with `inputs` laid over the defaults. Returns the workspace URL, the project and the run.
 */
export async function generatedDuplexBoq(bytes: Uint8Array, classificationSlugs: string[] = ["acme-cost-codes", "demo-trades"], inputs: Record<string, unknown> = {}) {
  const olivia = await devUser("olivia");
  const me = await apiAs<{ memberships: { org: { id: string; slug: string } }[] }>(olivia, "GET", "/me");
  const org = me.memberships.find((m) => m.org.slug === "studio-demo")!.org;
  const project = await apiAs<{ id: string }>(olivia, "POST", `/orgs/${org.id}/projects`, { name: `Sheet ${unique("p")}` });
  await modelWithVersion(olivia, project.id, "Architecture", bytes, "Duplex_A.ifc");
  const presets = await apiAs<{ slug: string; kind: string; latestPublishedVersion?: { id: string } }[]>(olivia, "GET", `/orgs/${org.id}/presets?kind=classification`);
  const classificationVersionIds = classificationSlugs.map((s) => presets.find((p) => p.slug === s)!.latestPublishedVersion!.id);
  const boq = await apiAs<{ id: string; currentRevision: { id: string } }>(olivia, "POST", `/projects/${project.id}/boqs`, { name: "Tender BoQ", inputs: { classificationVersionIds, ...inputs } });
  const { run } = await apiAs<{ run: { id: string } }>(olivia, "POST", `/revisions/${boq.currentRevision.id}/runs`);
  const deadline = Date.now() + 120_000;
  for (;;) {
    const r = await apiAs<{ id: string; status: string; stats?: { lines?: number } }>(olivia, "GET", `/runs/${run.id}`);
    if (r.status !== "queued" && r.status !== "running") return { url: `/studio-demo/projects/${project.id}/boqs/${boq.id}`, projectUrl: `/studio-demo/projects/${project.id}`, projectId: project.id, run: r, olivia };
    if (Date.now() > deadline) throw new Error(`run ${run.id} still ${r.status}`);
    await new Promise((res) => setTimeout(res, 300));
  }
}

/**
 * Signs in on the sign-in page by picking a user, which opens an app session (F01 §10); when the
 * account is open elsewhere, takes over on the session-conflict screen.
 */
export async function pickOnSignIn(page: Page, email: string) {
  await page.getByTestId(`sign-in-as-${email}`).click();
  const conflict = page.getByTestId("session-conflict");
  await expect
    .poll(async () => (await conflict.isVisible()) || (await page.locator("html").getAttribute("data-session")) === "active", { timeout: 15_000 })
    .toBe(true);
  if (await conflict.isVisible()) {
    await page.getByTestId("session-continue").click();
    await expect(page.locator("html")).toHaveAttribute("data-session", "active");
  }
}
