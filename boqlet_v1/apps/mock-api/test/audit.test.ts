import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** F09 audit retention by plan (FE-033, 05-plans-and-limits.md `auditLogRetentionDays`). */
const tmp = mkdtempSync(path.join(os.tmpdir(), "boqlet-audit-"));
process.env.MOCK_DATA_DIR = tmp;

const { createApp } = await import("../src/app.js");
const { SEED } = await import("../src/seed.js");
const { db } = await import("../src/store.js");
const { newId } = await import("../src/ids.js");

let app: Awaited<ReturnType<typeof createApp>>;
const get = async (p: string, userId: string) =>
  (await (await app.request(`http://localhost:4010/api/v1${p}`, { headers: { Authorization: `Bearer mock:${userId}` } })).json()) as { items: { id: string }[] };

beforeAll(async () => {
  app = await createApp({ reseed: true });
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("audit retention", () => {
  it("shows only the plan's days: 30 on Free, 365 on Team", async () => {
    const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
    const event = (orgId: string, at: string) => {
      const id = newId();
      db().audit.push({ id, orgId, actorId: SEED.users.olivia, action: "org.updated", subjectType: "org", subjectId: orgId, at });
      return id;
    };
    const smallOld = event(SEED.orgs.small, days(40));
    const smallRecent = event(SEED.orgs.small, days(10));
    const studioOld = event(SEED.orgs.studio, days(200));
    const studioAncient = event(SEED.orgs.studio, days(400));
    const small = (await get(`/orgs/${SEED.orgs.small}/audit`, SEED.users.olivia)).items.map((e) => e.id);
    expect(small).toContain(smallRecent);
    expect(small).not.toContain(smallOld);
    const studio = (await get(`/orgs/${SEED.orgs.studio}/audit?limit=1000`, SEED.users.olivia)).items.map((e) => e.id);
    expect(studio).toContain(studioOld);
    expect(studio).not.toContain(studioAncient);
  });
});
