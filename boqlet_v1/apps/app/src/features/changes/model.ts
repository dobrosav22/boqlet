import type { LineChange } from "@/api/hooks/diffs";

/** F08 §4 filters of the lines table: change type, |Δ%| at or above a threshold (default 1 %), group. */
export interface ChangeFilters {
  change?: "added" | "removed" | "changed";
  /** Changed lines below this |Δ%| are hidden; added and removed lines always pass. */
  minDeltaPct: number;
  /** A top-level code of the grouping system ("" = lines without one). */
  group?: string;
}

export const DEFAULT_THRESHOLD = 1;

const sideOf = (l: LineChange) => (l.after ?? l.before)!;

/** The line's top-level group in a classification (as the sheet groups it), or "" when it has none. */
export function groupOf(l: LineChange, system: string | null): { code: string; title: string } | null {
  if (!system) return null;
  const codes = sideOf(l).codes as Record<string, { path?: { code: string; title: string }[] }> | undefined;
  return codes?.[system]?.path?.[0] ?? null;
}

/** A changed line whose quantity moved, but by less than the threshold: kept out by default. */
export function passes(l: LineChange, f: ChangeFilters, system: string | null): boolean {
  if (f.change && l.change !== f.change) return false;
  if (l.change === "changed" && l.deltaPct !== null && l.deltaPct !== undefined && Math.abs(l.deltaPct) < f.minDeltaPct && l.delta !== null && sameText(l)) return false;
  if (f.group !== undefined && (groupOf(l, system)?.code ?? "") !== f.group) return false;
  return true;
}

/** A changed line with the same description and unit (only its quantity moved). */
const sameText = (l: LineChange) => l.before?.description === l.after?.description && l.before?.unit === l.after?.unit;

/** The lines under their groups, in the report's order (groups in order of first appearance). */
export function groupLines(lines: readonly LineChange[], system: string | null) {
  const groups = new Map<string, { code: string; title: string; lines: LineChange[] }>();
  for (const l of lines) {
    const g = groupOf(l, system);
    const key = g?.code ?? "";
    const entry = groups.get(key) ?? { code: key, title: g?.title ?? "", lines: [] };
    entry.lines.push(l);
    groups.set(key, entry);
  }
  return [...groups.values()];
}

/** Top-level groups present in the report, for the group filter. */
export function groupsIn(lines: readonly LineChange[], system: string | null) {
  return groupLines(lines, system).map(({ code, title, lines: ls }) => ({ code, title, count: ls.length }));
}

export interface Candidate {
  runId: string;
  kind: "saved" | "earlier" | "boq";
  /** Saved version label, other BoQ's name; earlier runs carry their time. */
  label: string;
  at: string;
}

/**
 * What the current run can be compared with (F08 §3, §6): the saved versions' frozen runs, the working
 * version's earlier finished runs, and the current runs of the project's other BoQs. The default is the
 * run of `basedOnRevisionId` (the last saved version), else nothing: the person picks.
 */
export function candidates(input: {
  currentRunId: string;
  revisions: { id: string; label: string; status: string; currentRun?: { id: string; status: string; createdAt: string; finishedAt?: string } | null }[];
  runs: { id: string; status: string; createdAt: string; finishedAt?: string }[];
  otherBoqs: { name: string; currentRun?: { id: string; status: string; createdAt: string; finishedAt?: string } | null }[];
  basedOnRevisionId?: string | null;
}): { list: Candidate[]; defaultRunId: string | null } {
  const done = (s: string) => s === "complete" || s === "needs_input";
  const list: Candidate[] = [];
  const seen = new Set([input.currentRunId]);
  const add = (c: Candidate) => {
    if (seen.has(c.runId)) return;
    seen.add(c.runId);
    list.push(c);
  };
  for (const r of input.revisions)
    if (r.status !== "draft" && r.currentRun && done(r.currentRun.status)) add({ runId: r.currentRun.id, kind: "saved", label: r.label, at: r.currentRun.finishedAt ?? r.currentRun.createdAt });
  for (const r of input.runs) if (done(r.status)) add({ runId: r.id, kind: "earlier", label: "", at: r.finishedAt ?? r.createdAt });
  for (const b of input.otherBoqs) if (b.currentRun && done(b.currentRun.status)) add({ runId: b.currentRun.id, kind: "boq", label: b.name, at: b.currentRun.finishedAt ?? b.currentRun.createdAt });
  const based = input.revisions.find((r) => r.id === input.basedOnRevisionId)?.currentRun;
  return { list, defaultRunId: based && based.id !== input.currentRunId && done(based.status) ? based.id : null };
}
