import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** F13 in the mock (FE-018): who gets an email for a notification. */
const tmp = mkdtempSync(path.join(os.tmpdir(), "boqlet-notify-"));
process.env.MOCK_DATA_DIR = tmp;

const { createApp } = await import("../src/app.js");
const { SEED } = await import("../src/seed.js");
const { db } = await import("../src/store.js");
const { notify } = await import("../src/notify.js");
const { listOutbox } = await import("../src/outbox.js");

beforeAll(async () => {
  await createApp({ reseed: true });
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const marko = () => db().users.find((u) => u.id === SEED.users.marko)!;
const send = (kind: string) => notify({ userId: marko().id, orgId: null, kind, params: { boq: "Tender BoQ", type: "run" }, url: "/x", entity: { type: "run", id: "r" } });
const mailsTo = () => listOutbox().filter((m) => m.to === marko().email);

describe("notify", () => {
  it("adds a bell row for every kind, and emails only the kinds F13 emails", () => {
    const before = mailsTo().length;
    send("job.succeeded");
    expect(mailsTo()).toHaveLength(before);
    send("job.failed");
    const mails = mailsTo();
    expect(mails).toHaveLength(before + 1);
    expect(mails.at(-1)!.subject).toBe("Generating Tender BoQ failed");
    expect(mails.at(-1)!.links[0]).toMatch(/\/x$/);
    expect(db().notifications.filter((n) => n.userId === marko().id && n.entityId === "r")).toHaveLength(2);
  });

  it("sends no email for a category the user turned off, and keeps the bell row", () => {
    db().notificationPreferences[marko().id] = { jobs: false };
    const before = mailsTo().length;
    const rows = db().notifications.length;
    send("job.failed");
    expect(mailsTo()).toHaveLength(before);
    expect(db().notifications.length).toBe(rows + 1);
  });
});
