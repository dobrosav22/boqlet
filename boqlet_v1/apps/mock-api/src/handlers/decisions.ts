/**
 * F05 Questions and decisions (FE-010): a run's questions joined with the project's decisions,
 * answering one or many (with a dry run listing the versions that would go back to draft, BR-23),
 * clearing, promoting a name answer to a company dictionary, the term picker and the CSV export.
 */
import type { BoqResult } from "@ifc-boq/types";
import { audit } from "../audit.js";
import { nowIso } from "../clock.js";
import {
  answeredAfterRun,
  currentDecisionMap,
  currentDecisions,
  latestRuns,
  nameQuestionParts,
  projectRuns,
  revisionsReopenedBy,
  usedByLatestRuns,
  type Answer,
} from "../decisions.js";
import { emit } from "../events.js";
import { conflict, HttpError, notFound } from "../http.js";
import { newId } from "../ids.js";
import { projectAudience } from "../jobs.js";
import { memberOrg, requireOrgAction } from "../permissions.js";
import { visibleProject, writableProject } from "../projects.js";
import { json, noContent, type Handlers } from "../router.js";
import { db, persist, type DecisionRec, type PresetRec, type ProjectRec, type QuestionRec, type RevisionRec, type RunRec, type UserRec } from "../store.js";
import { revisionLabel, withdrawReview } from "./boqs.js";
import { runResult } from "./lines.js";
import { latestPublished, presetVersionView } from "./presets.js";

const KINDS = new Set(["unknown_name", "missing_data", "unmatched", "double_claim", "unclassified", "classification_conflict", "contradiction", "overlap", "orphan_override"]);

const userRef = (id: string) => {
  const u = db().users.find((x) => x.id === id);
  return u ? { id: u.id, name: u.name, email: u.email } : { id, name: "Unknown" };
};

/** Engine fields left `null` by the PoC are dropped (the contract has them optional). */
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T;

export function decisionView(d: DecisionRec, runs: RunRec[] = latestRuns(d.projectId)) {
  return {
    id: d.id,
    projectId: d.projectId,
    questionId: d.questionId,
    kind: d.kind,
    answer: d.answer,
    ...(d.note ? { note: d.note } : {}),
    summary: d.question?.message ?? d.questionId,
    decidedBy: userRef(d.decidedBy),
    decidedAt: d.decidedAt,
    usedByLatestRuns: usedByLatestRuns(d, runs),
    promotedToPresetVersionId: d.promotedToPresetVersionId,
    ...(d.question ? { answerType: d.question.answer } : {}),
  };
}

const revisionRef = (r: RevisionRec, status = r.status) => {
  const boq = db().boqs.find((b) => b.id === r.boqId)!;
  return { boqId: boq.id, boqName: boq.name, revisionId: r.id, label: revisionLabel(r.number), status };
};

/** F05 §1 order: unanswered first, blocking first, then by kind, then by occurrences. */
function questionOrder(a: { kind: string; blocking: boolean; occurrences?: number; decision?: unknown; id: string }, b: typeof a) {
  return (
    Number(!!a.decision) - Number(!!b.decision) ||
    Number(b.blocking) - Number(a.blocking) ||
    a.kind.localeCompare(b.kind) ||
    (b.occurrences ?? 0) - (a.occurrences ?? 0) ||
    a.id.localeCompare(b.id)
  );
}

/** The question as a run of the project last asked it (open questions of the newest runs first). */
async function findQuestion(projectId: string, questionId: string): Promise<QuestionRec | undefined> {
  for (const run of projectRuns(projectId)) {
    if (run.askedQuestionIds?.includes(questionId) && run.resultKey) {
      const result: BoqResult = await runResult(run);
      const q = result.questions.find((x) => x.id === questionId);
      if (q) return clean(q);
    }
    const sent = run.request.decisions?.find((d) => d.questionId === questionId && d.question);
    if (sent?.question) return sent.question;
  }
  return db().decisions.find((d) => d.projectId === projectId && d.questionId === questionId && d.question)?.question;
}

const invalidAnswer = (questionId: string, message: string) => new HttpError(400, "invalid_answer", message, { questionId });

/** The answer fits the question's control (F05 table): a term, a number or "flag", a rule or "exclude", a code, an option; null dismisses. */
function checkAnswer(questionId: string, answer: Answer, question: QuestionRec | undefined) {
  if (answer === null || !question) return;
  const type = question.answer;
  switch (type.kind) {
    case "number":
      if (typeof answer !== "number" && answer !== "flag") throw invalidAnswer(questionId, "Enter a number, or flag the line.");
      if (typeof answer === "number" && (!Number.isFinite(answer) || answer < 0)) throw invalidAnswer(questionId, "Enter a number that is zero or more.");
      return;
    case "choice":
      if (typeof answer !== "string" || !type.options.some((o) => o.value === answer)) throw invalidAnswer(questionId, "Choose one of the options.");
      return;
    default:
      if (typeof answer !== "string" || !answer.trim()) throw invalidAnswer(questionId, "The answer can't be empty.");
  }
}

/** A dictionary entry answering a name question (F05 §5): the raw text, exactly, means the term. */
function nameEntry(questionId: string, term: string, user: UserRec, note?: string) {
  const parts = nameQuestionParts(questionId)!;
  return {
    id: `answer:${parts.field}:${parts.raw}`,
    field: parts.field,
    match: { exact: parts.raw },
    caseSensitive: true,
    term,
    source: "user",
    createdBy: user.name,
    createdAt: nowIso().slice(0, 10),
    ...(note ? { note } : {}),
  };
}

type Entry = ReturnType<typeof nameEntry>;

/** Publishes the next version of a dictionary with these entries added (an entry with the same id is replaced). */
function publishWithEntries(preset: PresetRec, entries: Entry[], user: UserRec) {
  const latest = latestPublished(preset.id);
  const base = (latest ? structuredClone(latest.doc) : { schemaVersion: "1.0", id: preset.slug, name: preset.name, version: "0", layer: preset.layer === "project" ? "project" : "company", entries: [] }) as {
    version: string;
    entries: { id: string }[];
  };
  const ids = new Set(entries.map((e) => e.id));
  base.entries = [...(base.entries ?? []).filter((e) => !ids.has(e.id)), ...entries];
  const number = (latest?.number ?? 0) + 1;
  base.version = String(number);
  const at = nowIso();
  const version = { id: newId(), presetId: preset.id, number, status: "published" as const, doc: base, extendsVersionId: null, problems: [], createdAt: at, publishedAt: at };
  db().presetVersions.push(version);
  preset.updatedAt = at;
  preset.updatedBy = user.id;
  return version;
}

function decisionOf(user: UserRec, decisionId: string) {
  const decision = db().decisions.find((d) => d.id === decisionId && !d.supersededAt);
  if (!decision) throw notFound("decision");
  return { decision, ...visibleProject(user, decision.projectId) };
}

/** Every BoQ's header and the questions refresh: pending changes and answers moved. */
function decisionsChanged(project: ProjectRec, revisions: RevisionRec[]) {
  const userIds = projectAudience(project.id);
  emit("entity.changed", { entityType: "decision", entityId: project.id, projectId: project.id, change: "updated" }, { userIds });
  for (const b of db().boqs.filter((x) => x.projectId === project.id)) emit("entity.changed", { entityType: "boq", entityId: b.id, projectId: project.id, change: "updated" }, { userIds });
  for (const r of revisions) emit("entity.changed", { entityType: "revision", entityId: r.id, projectId: project.id, change: "updated" }, { userIds });
}

/** BR-23: the revisions go back to draft, audited. */
/** BR-23: answers a run in review used or asked about send it back to the working state (reviewers told). */
function reopen(_project: ProjectRec, revisions: RevisionRec[], user: UserRec) {
  for (const r of revisions) withdrawReview(r, user.id, "decision_changed");
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const decisionHandlers: Handlers = {
  async listQuestions({ user, params }) {
    const run = db().runs.find((r) => r.id === params.runId);
    if (!run) throw notFound("run");
    const revision = db().revisions.find((r) => r.id === run.revisionId)!;
    const boq = db().boqs.find((b) => b.id === revision.boqId)!;
    const { project } = visibleProject(user!, boq.projectId);
    const result = await runResult(run);
    const current = currentDecisionMap(project.id);
    const runs = latestRuns(project.id);
    const row = (q: QuestionRec) => {
      const d = current.get(q.id);
      return { ...clean(q), ...(d ? { decision: decisionView(d, runs) } : {}), answeredAfterRun: answeredAfterRun(run, q.id, current) };
    };
    const asked = new Set(result.questions.map((q) => q.id));
    // Questions the run didn't ask because it was generated with an answer: listed as answered.
    const answered = (run.request.decisions ?? []).filter((d) => d.question && !asked.has(d.questionId)).map((d) => row(d.question!));
    return json([...result.questions.map(row), ...answered].sort(questionOrder));
  },

  listDecisions({ user, params, query }) {
    const { project } = visibleProject(user!, params.projectId!);
    const runs = latestRuns(project.id);
    return json(
      currentDecisions(project.id)
        .filter((d) => !query.kind || d.kind === query.kind)
        .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt) || a.questionId.localeCompare(b.questionId))
        .map((d) => decisionView(d, runs)),
    );
  },

  async upsertDecisions({ user, params, query, body }) {
    const { project } = writableProject(user!, params.projectId!, "answerQuestions");
    const b = body as { decisions: { questionId: string; kind: string; answer: Answer; note?: string }[]; addToProjectDictionary?: boolean };
    if (!b.decisions.length) throw new HttpError(400, "invalid_body", "Send at least one decision.");
    const seen = new Set<string>();
    for (const d of b.decisions) {
      if (!d.questionId.trim()) throw new HttpError(400, "invalid_body", "A decision needs a question id.");
      if (!KINDS.has(d.kind)) throw new HttpError(400, "invalid_body", `Unknown question kind "${d.kind}".`, { questionId: d.questionId });
      if (seen.has(d.questionId)) throw new HttpError(400, "invalid_body", "A question is answered twice in one request.", { questionId: d.questionId });
      seen.add(d.questionId);
    }
    const current = currentDecisionMap(project.id);
    const questions = new Map<string, QuestionRec | undefined>();
    for (const d of b.decisions) {
      const q = await findQuestion(project.id, d.questionId);
      if (q && q.kind !== d.kind) throw new HttpError(400, "invalid_body", `The question is of kind "${q.kind}".`, { questionId: d.questionId });
      checkAnswer(d.questionId, d.answer, q);
      questions.set(d.questionId, q);
    }
    const note = (d: { note?: string }) => d.note?.trim() || undefined;
    // A decision repeated as it is stays the same row; only a new or changed answer alters a run (BR-23).
    const unchanged = (d: (typeof b.decisions)[number]) => {
      const was = current.get(d.questionId);
      return !!was && was.answer === d.answer && was.note === note(d);
    };
    const answerChanges = b.decisions.filter((d) => !current.has(d.questionId) || current.get(d.questionId)!.answer !== d.answer);
    const affected = revisionsReopenedBy(project.id, answerChanges.map((d) => d.questionId));
    const at = nowIso();
    const records: DecisionRec[] = b.decisions.map((d) => {
      const was = current.get(d.questionId);
      if (was && unchanged(d)) return was;
      const q = questions.get(d.questionId) ?? was?.question;
      return {
        id: newId(),
        projectId: project.id,
        questionId: d.questionId,
        kind: d.kind,
        answer: d.answer,
        ...(note(d) ? { note: note(d) } : {}),
        ...(q ? { question: q } : {}),
        decidedBy: user!.id,
        decidedAt: at,
        promotedToPresetVersionId: null,
      };
    });
    if (query.dryRun === true) {
      return json({ decisions: records.map((d) => decisionView(d)), reopenedRevisions: affected.map((r) => revisionRef(r)) });
    }

    const fresh = records.filter((r) => current.get(r.questionId) !== r);
    for (const r of fresh) {
      const was = current.get(r.questionId);
      if (was) was.supersededAt = at;
    }
    db().decisions.push(...fresh);
    reopen(project, affected, user!);
    // F05 §5: name answers also go to the project dictionary (default on); the decision stays the record.
    if (b.addToProjectDictionary !== false) {
      const entries = fresh.filter((d) => d.kind === "unknown_name" && typeof d.answer === "string" && nameQuestionParts(d.questionId)).map((d) => nameEntry(d.questionId, d.answer as string, user!, d.note));
      const dictionary = db().presets.find((p) => p.id === project.projectDictionaryId);
      if (entries.length && dictionary) {
        const version = publishWithEntries(dictionary, entries, user!);
        audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "preset.published", subjectType: "preset", subjectId: dictionary.id, data: { name: dictionary.name, version: version.number, entries: entries.length, from: "decisions" } });
      }
    }
    for (const d of fresh)
      audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "decision.set", subjectType: "decision", subjectId: d.id, data: { questionId: d.questionId, kind: d.kind, answer: d.answer } });
    persist();
    if (fresh.length) decisionsChanged(project, affected);
    const runs = latestRuns(project.id);
    return json({ decisions: records.map((d) => decisionView(d, runs)), reopenedRevisions: affected.map((r) => revisionRef(r, "draft")) });
  },

  clearDecision({ user, params }) {
    const { decision, project } = decisionOf(user!, params.decisionId!);
    writableProject(user!, project.id, "answerQuestions");
    const affected = revisionsReopenedBy(project.id, [decision.questionId]);
    decision.supersededAt = nowIso();
    reopen(project, affected, user!);
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "decision.cleared", subjectType: "decision", subjectId: decision.id, data: { questionId: decision.questionId, kind: decision.kind } });
    persist();
    decisionsChanged(project, affected);
    return noContent();
  },

  promoteDecision({ user, params, body }) {
    const { decision, project } = decisionOf(user!, params.decisionId!);
    requireOrgAction(user!, project.orgId, "promoteDecisions");
    if (decision.kind !== "unknown_name" || typeof decision.answer !== "string" || !nameQuestionParts(decision.questionId))
      throw conflict("not_promotable", "Only an answer to a name question can go to a company dictionary.");
    const presetId = (body as { dictionaryPresetId: string }).dictionaryPresetId;
    const preset = db().presets.find((p) => p.id === presetId);
    if (!preset || preset.orgId !== project.orgId || preset.layer !== "org" || preset.kind !== "dictionary" || preset.archived)
      throw new HttpError(400, "invalid_preset", "Choose one of the organisation's dictionaries.", { presetId });
    const version = publishWithEntries(preset, [nameEntry(decision.questionId, decision.answer, user!, decision.note)], user!);
    decision.promotedToPresetVersionId = version.id;
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "decision.promoted", subjectType: "decision", subjectId: decision.id, data: { questionId: decision.questionId, dictionary: preset.name, version: version.number } });
    persist();
    emit("entity.changed", { entityType: "preset", entityId: preset.id, change: "updated" }, { userIds: db().memberships.filter((m) => m.orgId === project.orgId).map((m) => m.userId) });
    decisionsChanged(project, []);
    return json(presetVersionView(version));
  },

  exportDecisionsCsv({ user, params }) {
    const { project } = visibleProject(user!, params.projectId!);
    const runs = latestRuns(project.id);
    const head = ["kind", "question", "question_id", "answer", "note", "decided_by", "decided_at", "used_by_latest_runs", "promoted"];
    const rows = currentDecisions(project.id)
      .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))
      .map((d) => {
        const v = decisionView(d, runs);
        return [v.kind, v.summary, v.questionId, v.answer === null ? "(dismissed)" : v.answer, v.note ?? "", v.decidedBy.name, v.decidedAt, v.usedByLatestRuns ? "yes" : "no", v.promotedToPresetVersionId ? "yes" : "no"];
      });
    const csv = [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
    const file = `decisions-${(project.code ?? project.name).replace(/[^\w.-]+/g, "-")}.csv`;
    return new Response(`﻿${csv}`, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}"` } });
  },

  listTerms({ user, params, query }) {
    const { org } = memberOrg(user!, params.orgId!);
    const projectId = query.projectId as string | undefined;
    if (projectId) visibleProject(user!, projectId);
    const layerRank: Record<string, number> = { system: 0, org: 1, project: 2 };
    const dictionaries = db()
      .presets.filter((p) => p.kind === "dictionary" && !p.archived && (p.layer === "system" || (p.orgId === org.id && (p.projectId === null || p.projectId === projectId))))
      .sort((a, b) => layerRank[a.layer]! - layerRank[b.layer]!);
    // Later layers relabel a term of an earlier one.
    const terms = new Map<string, { id: string; label: string; category: string; parent?: string; layer: PresetRec["layer"] }>();
    for (const p of dictionaries) {
      const doc = latestPublished(p.id)?.doc as { terms?: { id: string; label: string; category: string; broader?: string; labels?: Record<string, string> }[] } | undefined;
      for (const t of doc?.terms ?? []) terms.set(t.id, { id: t.id, label: t.label, category: t.category, ...(t.broader ? { parent: t.broader } : {}), layer: p.layer });
    }
    const q = String(query.q ?? "").trim().toLowerCase();
    const category = query.category as string | undefined;
    return json(
      [...terms.values()]
        .filter((t) => !category || t.category === category)
        .filter((t) => !q || t.id.toLowerCase().includes(q) || t.label.toLowerCase().includes(q))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
  },
};
