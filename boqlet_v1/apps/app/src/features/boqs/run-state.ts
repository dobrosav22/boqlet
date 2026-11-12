import type { Boq, Run } from "@/api/hooks/boqs";

/**
 * What the BoQ workspace header shows (F04 "States shown in the BoQ workspace header"):
 * - `active`: a run is queued or running (progress, Cancel);
 * - `failed`: the newest run failed after the current one (error, Retry; the current run stays);
 * - `complete` / `needs_input`: the current run's state;
 * - `none`: never generated.
 */
export type HeaderState =
  | { kind: "none" }
  | { kind: "active"; run: Run; current?: Run }
  | { kind: "failed"; run: Run; current?: Run }
  | { kind: "complete" | "needs_input"; current: Run };

const isActive = (r: Run) => r.status === "queued" || r.status === "running";

/** `runs` newest first, as `GET /revisions/{id}/runs` returns them. */
export function headerState(boq: Pick<Boq, "currentRevision">, runs: Run[] | undefined): HeaderState {
  const current = boq.currentRevision.currentRun;
  const list = runs ?? [];
  const active = list.find((r) => r.status === "running") ?? list.find(isActive);
  if (active) return { kind: "active", run: active, current };
  const newest = list[0];
  if (newest?.status === "failed" && (!current || newest.createdAt >= current.createdAt)) return { kind: "failed", run: newest, current };
  if (current && (current.status === "complete" || current.status === "needs_input")) return { kind: current.status, current };
  return { kind: "none" };
}

/** Save version is possible with a finished current run and nothing pending (BR-22). */
export function saveBlockedReason(boq: Pick<Boq, "currentRevision">): "pending" | "noRun" | null {
  if (!boq.currentRevision.currentRun) return "noRun";
  if (boq.currentRevision.pendingChanges.length > 0) return "pending";
  return null;
}
