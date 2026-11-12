import { describe, expect, it } from "vitest";
import type { Boq, Run } from "@/api/hooks/boqs";
import { headerState, saveBlockedReason } from "./run-state";

const run = (id: string, status: Run["status"], createdAt: string): Run => ({ id, revisionId: "r", status, createdAt });
const boq = (current?: Run, pendingChanges: string[] = []) =>
  ({ currentRevision: { currentRun: current, pendingChanges } }) as unknown as Pick<Boq, "currentRevision">;

describe("headerState (F04 header states)", () => {
  it("none before the first run", () => {
    expect(headerState(boq(), [])).toEqual({ kind: "none" });
  });

  it("active while a run is queued or running, keeping the current run underneath", () => {
    const current = run("a", "complete", "2026-01-01T10:00:00Z");
    const queued = run("b", "queued", "2026-01-01T11:00:00Z");
    expect(headerState(boq(current), [queued, current])).toMatchObject({ kind: "active", run: { id: "b" }, current: { id: "a" } });
  });

  it("prefers the running run over a newer queued one", () => {
    const running = run("b", "running", "2026-01-01T11:00:00Z");
    const queued = run("c", "queued", "2026-01-01T12:00:00Z");
    expect(headerState(boq(), [queued, running])).toMatchObject({ kind: "active", run: { id: "b" } });
  });

  it("failed when the newest run failed after the current one; the current run stays", () => {
    const current = run("a", "needs_input", "2026-01-01T10:00:00Z");
    const failed = run("b", "failed", "2026-01-01T11:00:00Z");
    expect(headerState(boq(current), [failed, current])).toMatchObject({ kind: "failed", run: { id: "b" }, current: { id: "a" } });
  });

  it("the current run's state otherwise (a cancelled newer run is ignored)", () => {
    const current = run("a", "needs_input", "2026-01-01T10:00:00Z");
    expect(headerState(boq(current), [run("b", "cancelled", "2026-01-01T11:00:00Z"), current])).toEqual({ kind: "needs_input", current });
  });
});

describe("saveBlockedReason (BR-22)", () => {
  it("blocks without a run and with pending changes", () => {
    expect(saveBlockedReason(boq())).toBe("noRun");
    const current = run("a", "complete", "2026-01-01T10:00:00Z");
    expect(saveBlockedReason(boq(current, ["inputs.ruleSet"]))).toBe("pending");
    expect(saveBlockedReason(boq(current))).toBeNull();
  });
});
