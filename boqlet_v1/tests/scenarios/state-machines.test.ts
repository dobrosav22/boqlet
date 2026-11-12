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

describe("ModelVersion (upload, parse, failure, dedupe: scenarios/models.test.ts)", () => {
  it.todo("awaiting_upload → failed when the upload isn't completed within 24 h (scheduler, M6)");
  it.todo("a failed parse with a retryable error goes back to queued on retry (needs a corrupt-file fixture)");
});

// Job (run jobs: queued → running → succeeded, never needs input, P13; cancelled by the user) and
// Run (queued → running → complete | needs_input; immutable once finished; currentRunId moves to the
// newest finished run) are covered in scenarios/boqs.test.ts (FE-008).

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
