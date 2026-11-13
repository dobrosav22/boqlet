/**
 * Project decisions (F05, data-model.md "Decision"): the answers a project keeps, what a run was
 * generated with, and which answers a run doesn't reflect yet. Pure functions over the store; the
 * handlers are in `handlers/decisions.ts`.
 */
import { db, type DecisionRec, type DecisionSnapshot, type RevisionRec, type RunRec } from "./store.js";

export type Answer = DecisionRec["answer"];

/** The project's current decisions (superseded rows are history). */
export const currentDecisions = (projectId: string) => db().decisions.filter((d) => d.projectId === projectId && !d.supersededAt);

export function currentDecisionMap(projectId: string): Map<string, DecisionRec> {
  return new Map(currentDecisions(projectId).map((d) => [d.questionId, d]));
}

/** The decisions as a run is generated with them (run request, F05 §1). */
export function decisionsSnapshot(projectId: string): DecisionSnapshot[] {
  return currentDecisions(projectId).map((d) => ({ questionId: d.questionId, kind: d.kind, answer: d.answer, ...(d.question ? { question: d.question } : {}) }));
}

/** As the engine takes them (engine `Decision`). */
export function engineDecisions(projectId: string) {
  return currentDecisions(projectId).map((d) => ({ questionId: d.questionId, scope: "project" as const, answer: d.answer, ...(d.note ? { note: d.note } : {}) }));
}

type Slot = { answer: Answer } | undefined;
const differs = (a: Slot, b: Slot) => (a === undefined) !== (b === undefined) || (a !== undefined && b !== undefined && a.answer !== b.answer);

/**
 * Question ids whose project answer differs from the one the run was generated with: answered,
 * changed or cleared since (07-backend/architecture.md "Pending changes": the questions the run
 * asked plus the decisions it used).
 */
export function unappliedQuestionIds(run: RunRec, current = currentDecisionMap(projectOfRun(run))): string[] {
  const sent = new Map((run.request.decisions ?? []).map((d) => [d.questionId, d]));
  const ids = new Set([...(run.askedQuestionIds ?? []), ...sent.keys()]);
  return [...ids].filter((id) => differs(sent.get(id), current.get(id)));
}

export function answeredAfterRun(run: RunRec, questionId: string, current: Map<string, DecisionRec>): boolean {
  const sent = (run.request.decisions ?? []).find((d) => d.questionId === questionId);
  return differs(sent, current.get(questionId));
}

export function projectOfRun(run: RunRec): string {
  const revision = db().revisions.find((r) => r.id === run.revisionId)!;
  return db().boqs.find((b) => b.id === revision.boqId)!.projectId;
}

/** The current run of every working version of the project's BoQs (not archived): "latest runs". */
export function latestRuns(projectId: string): RunRec[] {
  return db()
    .boqs.filter((b) => b.projectId === projectId && !b.archived)
    .flatMap((b) => {
      const revision = db().revisions.find((r) => r.id === b.currentRevisionId);
      const run = revision?.currentRunId ? db().runs.find((r) => r.id === revision.currentRunId) : undefined;
      return run ? [run] : [];
    });
}

/** Blocking questions the latest runs asked that nobody has answered since (project cards, F02). */
export function openBlockingQuestions(projectId: string): number {
  const answered = currentDecisionMap(projectId);
  const ids = new Set(latestRuns(projectId).flatMap((r) => r.blockingQuestionIds ?? []));
  return [...ids].filter((id) => !answered.has(id)).length;
}

/** Sent with one of the latest runs, with the same answer. */
export function usedByLatestRuns(decision: DecisionRec, runs = latestRuns(decision.projectId)): boolean {
  return runs.some((run) => (run.request.decisions ?? []).some((d) => d.questionId === decision.questionId && d.answer === decision.answer));
}

/** Every run of the project, newest first. */
export function projectRuns(projectId: string): RunRec[] {
  const revisions = new Set(
    db()
      .revisions.filter((r) => db().boqs.some((b) => b.id === r.boqId && b.projectId === projectId))
      .map((r) => r.id),
  );
  return db()
    .runs.filter((r) => revisions.has(r.revisionId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

/**
 * BR-23: revisions in review or approved whose current run a change to these answers would alter
 * (the run asked the question, or was generated with an answer to it).
 */
export function revisionsReopenedBy(projectId: string, questionIds: string[]): RevisionRec[] {
  const ids = new Set(questionIds);
  return db()
    .boqs.filter((b) => b.projectId === projectId && !b.archived)
    .flatMap((b) => {
      const revision = db().revisions.find((r) => r.id === b.currentRevisionId);
      if (!revision || (revision.status !== "in_review" && revision.status !== "approved")) return [];
      const run = revision.currentRunId ? db().runs.find((r) => r.id === revision.currentRunId) : undefined;
      if (!run) return [];
      const touched = (run.askedQuestionIds ?? []).some((id) => ids.has(id)) || (run.request.decisions ?? []).some((d) => ids.has(d.questionId));
      return touched ? [revision] : [];
    });
}

/** `name:{field}:{raw}` → field and raw text (the raw text may contain colons). */
export function nameQuestionParts(questionId: string): { field: string; raw: string } | null {
  if (!questionId.startsWith("name:")) return null;
  const rest = questionId.slice("name:".length);
  const at = rest.indexOf(":");
  if (at <= 0) return null;
  return { field: rest.slice(0, at), raw: rest.slice(at + 1) };
}
