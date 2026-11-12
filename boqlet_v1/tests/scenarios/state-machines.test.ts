import { describe, expect, it } from "vitest";
import { advanceDays, resetClock, serverNow } from "../support/clock";

/**
 * Behaviour scenarios, one group per state machine of 03-domain/state-machines.md. They seed
 * through the API only, so they run against the mock and against Java unchanged (testing.md).
 * A transition becomes a real test in the task that builds it (named in each `todo`); until then
 * it is listed here so the coverage still missing is visible in every run.
 */

describe("test clock (testing.md)", () => {
  it("POST /_test/clock moves the server's time, and reset brings it back", async () => {
    const before = await serverNow();
    const later = await advanceDays(3);
    expect(later.getTime() - before.getTime()).toBeGreaterThanOrEqual(3 * 86_400_000 - 5_000);
    const back = await resetClock();
    expect(Math.abs(back.getTime() - Date.now())).toBeLessThan(60_000);
  });
});

describe("ModelVersion", () => {
  it.todo("awaiting_upload → queued on complete, → processing → ready (FE-007)");
  it.todo("awaiting_upload → failed when the upload isn't completed within 24 h (FE-007, clock)");
  it.todo("processing → failed with not_ifc / corrupt_file, failed → queued on retry (FE-007)");
  it.todo("same content hash in the org: straight to ready (FE-007)");
});

describe("Job", () => {
  it.todo("queued → running → succeeded; a job never needs input (P13) (FE-007, FE-008)");
  it.todo("queued or running → cancelled by the user (FE-008)");
});

describe("Run", () => {
  it.todo("queued → running → complete, or needs_input when blocking questions remain (FE-008)");
  it.todo("finished runs are immutable; the revision's currentRunId moves to the newest finished run (FE-008)");
});

describe("BoqRevision", () => {
  it.todo("draft → issued on save version; the next draft is created with the same inputs (FE-031)");
  it.todo("BR-27 a saved version refuses writes with 409 revision_locked (FE-031)");
  it.todo("with approvalRequired: draft → in_review → approved → issued; any edit sends it back to draft (FE-031)");
  it.todo("four-eyes: the approver must not be the submitter (FE-031)");
});

describe("Boq", () => {
  it.todo("working → confirmed; every write answers 409 boq_confirmed (FE-031)");
  it.todo("confirmed → working on reopen by the lead, with a reason (FE-031)");
});

describe("Session (BR-54)", () => {
  it.todo("a second sign-in answers 409 session_active until takeover; the replaced session gets 401 session_replaced (FE-012)");
  it.todo("active → expired after 12 h without requests (FE-012, clock)");
});

describe("ShareLink", () => {
  it.todo("active → revoked; active → expired when expiresAt passes (FE-036, clock)");
  it.todo("active → suspended when the org turns publicLinksAllowed off, and back (FE-036)");
});
