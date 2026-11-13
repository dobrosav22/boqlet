import { describe, expect, it } from "vitest";
import { advanceClock, advanceDays, resetClock, serverNow } from "../support/clock";
import { client } from "../support/env";
import { inSession, signUp, uniqueEmail, type TestUser } from "../support/users";

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

// BoqRevision (draft → issued with the next draft; in_review → approved → issued; edits back to draft;
// four-eyes; saved means locked) and Boq (working → confirmed → working on reopen) are covered in
// scenarios/versions.test.ts (FE-031).

describe("Session (BR-54, F01 §10)", () => {
  const open = (u: TestUser, deviceLabel: string, takeover = false) => client(u.token).POST("/sessions", { body: { deviceLabel, takeover } });

  it("a second sign-in answers 409 session_active until takeover; the replaced session gets 401 session_replaced", async () => {
    const person = await signUp("Two Browsers", uniqueEmail("sessions"));
    const first = await open(person, "Chrome on Windows");
    expect(first.response.status).toBe(201);
    expect(first.data).toMatchObject({ status: "active", deviceLabel: "Chrome on Windows" });
    const inFirst = inSession(person, first.data!.id);
    expect((await client(inFirst.token).GET("/me")).data!.session).toMatchObject({ id: first.data!.id });

    const second = await open(person, "Firefox on Linux");
    expect(second.response.status).toBe(409);
    expect(second.error).toMatchObject({ code: "session_active", activeSession: { id: first.data!.id, deviceLabel: "Chrome on Windows" } });
    // Giving up changes nothing for the first browser.
    expect((await client(inFirst.token).GET("/sessions/current")).data).toMatchObject({ status: "active" });
    // The first browser asking again is not a second sign-in.
    expect((await client(inFirst.token).POST("/sessions", { body: { deviceLabel: "Chrome on Windows" } })).response.status).toBe(201);

    const taken = await open(person, "Firefox on Linux", true);
    expect(taken.response.status).toBe(201);
    const inSecond = inSession(person, taken.data!.id);
    const replaced = await client(inFirst.token).GET("/me");
    expect(replaced.response.status).toBe(401);
    expect(replaced.error).toMatchObject({ code: "session_replaced" });
    expect((await client(inSecond.token).GET("/me")).response.status).toBe(200);

    // Signing out ends it: the next sign-in needs no takeover.
    expect((await client(inSecond.token).DELETE("/sessions/current")).response.status).toBe(204);
    expect((await client(inSecond.token).GET("/me")).response.status).toBe(401);
    expect((await open(person, "Safari on iPad")).response.status).toBe(201);
  });

  it("active → expired after 12 h without requests", async () => {
    const person = await signUp("Idle Person", uniqueEmail("sessions"));
    const { data } = await open(person, "Chrome on Windows");
    const inIt = inSession(person, data!.id);
    try {
      await advanceClock(12 * 3_600_000 + 60_000);
      const late = await client(inIt.token).GET("/me");
      expect(late.response.status).toBe(401);
      expect(late.error).toMatchObject({ code: "session_expired" });
      // An expired session doesn't block the next sign-in.
      expect((await open(person, "Chrome on Windows")).response.status).toBe(201);
    } finally {
      await resetClock();
    }
  });
});

// ShareLink (active → revoked; active → expired; active → suspended when the org turns public links off,
// and back) is covered in scenarios/shares.test.ts (FE-036).
