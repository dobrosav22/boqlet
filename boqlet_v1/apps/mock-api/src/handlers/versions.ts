/**
 * F09 versions (FE-031): save version (issue) with the next working version, the optional review
 * (submit, request changes, approve, save the approved version, withdraw, comments, four-eyes), and
 * confirming and reopening a BoQ. State machines: 03-domain/state-machines.md (BoqRevision, Boq);
 * rules BR-20…BR-27.
 */
import { audit } from "../audit.js";
import { nowIso } from "../clock.js";
import { conflict, forbidden, HttpError } from "../http.js";
import { newId } from "../ids.js";
import { projectAudience } from "../jobs.js";
import { projectRoleOf, writableProject } from "../projects.js";
import { json, type Handlers } from "../router.js";
import { db, persist, type BoqRec, type ProjectRec, type RevisionRec, type UserRec } from "../store.js";
import {
  adjustmentsKey,
  adjustmentsOf,
  approvalOn,
  boqOf,
  boqView,
  changed,
  fourEyesBlocks,
  labelOf,
  notify,
  pendingChanges,
  revisionLabel,
  revisionOf,
  revisionView,
  userRef,
  withdrawReview,
  writeBlock,
} from "./boqs.js";
import { startRunExport } from "./exports.js";

const urlOf = (project: ProjectRec, boq: BoqRec, tab?: string) => {
  const org = db().orgs.find((o) => o.id === project.orgId)!;
  return `/${org.slug}/projects/${project.id}/boqs/${boq.id}${tab ? `?tab=${tab}` : ""}`;
};

/** Every project member but the actor (F13 "project members"). */
function tellMembers(project: ProjectRec, boq: BoqRec, actorId: string, kind: string, params: Record<string, unknown>, entity: { type: string; id: string }, tab?: string) {
  for (const userId of projectAudience(project.id)) if (userId !== actorId) notify(userId, project, kind, params, urlOf(project, boq, tab), entity);
}

const finished = (status?: string) => status === "complete" || status === "needs_input";

/**
 * BR-22: a finished run that reflects the current inputs, decisions and line edits. Otherwise
 * `409 not_ready` with the reason (`no_run`, `run_not_finished`, `pending` with what is pending).
 */
function readyToSave(revision: RevisionRec, project: ProjectRec) {
  const run = revision.currentRunId ? db().runs.find((r) => r.id === revision.currentRunId) : undefined;
  if (!run) throw conflict("not_ready", "Generate the BoQ before saving a version.", { reason: "no_run" });
  if (!finished(run.status)) throw conflict("not_ready", "Wait for the run to finish.", { reason: "run_not_finished", status: run.status });
  const pending = pendingChanges(revision, project);
  if (pending.length) throw conflict("not_ready", "Generate again: the inputs, answers or line edits changed since the last run.", { reason: "pending", pendingChanges: pending });
  return run;
}

/** F09 §1 / BR-12: the person confirms the work the models don't contain was added. */
function needNotModelled(body: { notModelledConfirmed?: boolean } | undefined) {
  if (body?.notModelledConfirmed !== true)
    throw new HttpError(400, "invalid_body", "Confirm that the work the models don't contain was added (manual lines).", { field: "notModelledConfirmed" });
}

/** Only the working version of a working, active BoQ moves through the review states. */
function liveRevision(boq: BoqRec, revision: RevisionRec) {
  const blocked = writeBlock(boq, revision, "allow");
  if (blocked) throw blocked;
  if (boq.currentRevisionId !== revision.id) throw conflict("revision_locked", "This isn't the working version.");
}

/**
 * Saves the revision (F09 §2): freezes its run, a copy of the line edits and manual lines and an Excel
 * (BR-25); the label is the next letter or the one given, never reused (BR-26). Opens the next working
 * version with the same inputs and the same current run, unless the save is part of confirming.
 */
function saveVersion(revision: RevisionRec, boq: BoqRec, project: ProjectRec, user: UserRec, body: { label?: string; note?: string }, openNext: boolean) {
  const run = readyToSave(revision, project);
  const label = body.label?.trim() || revisionLabel(revision.number);
  const others = db().revisions.filter((r) => r.boqId === boq.id && r.id !== revision.id);
  if (others.some((r) => r.status === "issued" && labelOf(r) === label) || (label !== revisionLabel(revision.number) && others.some((r) => revisionLabel(r.number) === label)))
    throw conflict("label_taken", `Version ${label} exists already in this BoQ.`, { label });
  const at = nowIso();
  revision.status = "issued";
  if (label !== revisionLabel(revision.number)) revision.label = label;
  revision.issuedBy = user.id;
  revision.issuedAt = at;
  if (body.note?.trim()) revision.issueNote = body.note.trim();
  revision.openQuestionsAtSave = run.stats?.blockingQuestions ?? 0;
  revision.frozen = { runId: run.id, exportIds: [], adjustments: adjustmentsOf(boq.id) };
  boq.latestIssuedRevisionId = revision.id;
  if (openNext) {
    const next: RevisionRec = {
      id: newId(),
      boqId: boq.id,
      number: Math.max(...db().revisions.filter((r) => r.boqId === boq.id).map((r) => r.number)) + 1,
      status: "draft",
      inputs: structuredClone(revision.inputs),
      currentRunId: run.id,
      basedOnRevisionId: revision.id,
      createdAt: at,
    };
    db().revisions.push(next);
    boq.currentRevisionId = next.id;
    audit({ orgId: project.orgId, projectId: project.id, actorId: user.id, action: "revision.created", subjectType: "revision", subjectId: next.id, data: { boq: boq.name, revision: labelOf(next), basedOn: label } });
  }
  boq.updatedAt = at;
  persist();
  startRunExport({ run, user, issued: { revision, label, ...(revision.issueNote ? { note: revision.issueNote } : {}) } });
  audit({ orgId: project.orgId, projectId: project.id, actorId: user.id, action: "version.saved", subjectType: "revision", subjectId: revision.id, data: { boq: boq.name, label, note: revision.issueNote ?? null, openQuestions: revision.openQuestionsAtSave } });
  tellMembers(project, boq, user.id, "version.saved", { boq: boq.name, label }, { type: "revision", id: revision.id }, "versions");
  changed(project.id, "revision", revision.id, "updated");
  changed(project.id, "boq", boq.id, "updated");
}

/** Whether the working version differs from the last saved one (F09 §5): its run, inputs or edits. */
function changedSinceSave(boq: BoqRec, revision: RevisionRec, project: ProjectRec) {
  const saved = boq.latestIssuedRevisionId ? db().revisions.find((r) => r.id === boq.latestIssuedRevisionId) : undefined;
  if (!saved?.frozen) return true;
  if (revision.currentRunId !== saved.frozen.runId || pendingChanges(revision, project).length) return true;
  return adjustmentsKey(adjustmentsOf(boq.id)) !== adjustmentsKey(saved.frozen.adjustments);
}

export const versionHandlers: Handlers = {
  /** Save version (F09 §2): approval off, a lead or estimator saves the working version; on, an approver saves the approved one. */
  issueRevision({ user, params, body }) {
    const b = (body ?? {}) as { label?: string; note?: string; notModelledConfirmed?: boolean };
    const found = revisionOf(user!, params.revisionId!);
    const { revision, boq, project } = found;
    const approval = approvalOn(project.orgId);
    writableProject(user!, project.id, approval ? "approve" : "saveVersion");
    liveRevision(boq, revision);
    if (approval) {
      if (revision.status !== "approved") throw conflict("not_approved", "With approval on, a version is saved once it is approved.", { status: revision.status });
      if (fourEyesBlocks(project.orgId, revision, user!.id)) throw new HttpError(403, "four_eyes", "Someone other than the submitter saves this version (four-eyes).");
    } else {
      if (revision.status !== "draft") throw conflict("revision_in_review", "This version is in review.", { status: revision.status });
      needNotModelled(b);
    }
    saveVersion(revision, boq, project, user!, b, true);
    return json(revisionView(revision, user!.id));
  },

  submitRevision({ user, params, body }) {
    const b = (body ?? {}) as { reviewerIds?: string[]; message?: string; notModelledConfirmed?: boolean };
    const { revision, boq, project } = revisionOf(user!, params.revisionId!, "saveVersion");
    if (!approvalOn(project.orgId)) throw conflict("approval_off", "Approval isn't switched on for this organisation: save the version instead.");
    liveRevision(boq, revision);
    if (revision.status !== "draft") throw conflict("invalid_transition", "This version is in review already.", { status: revision.status });
    needNotModelled(b);
    const reviewers = [...new Set(b.reviewerIds ?? [])];
    if (!reviewers.length) throw new HttpError(400, "invalid_body", "Choose at least one reviewer.", { field: "reviewerIds" });
    for (const id of reviewers) {
      const role = projectRoleOf(project, id);
      if (role !== "lead" && role !== "approver") throw new HttpError(400, "invalid_reviewer", "Reviewers are the project's leads and approvers.", { userId: id });
    }
    readyToSave(revision, project);
    const at = nowIso();
    revision.status = "in_review";
    revision.reviewerIds = reviewers;
    revision.submittedBy = user!.id;
    revision.submittedAt = at;
    delete revision.approvedBy;
    delete revision.approvedAt;
    if (b.message?.trim()) (revision.comments ??= []).push({ id: newId(), by: user!.id, at, text: b.message.trim() });
    boq.updatedAt = at;
    persist();
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "revision.submitted", subjectType: "revision", subjectId: revision.id, data: { boq: boq.name, revision: labelOf(revision), reviewers: reviewers.length } });
    for (const id of reviewers)
      if (id !== user!.id) notify(id, project, "revision.review_requested", { boq: boq.name, revision: labelOf(revision), by: userRef(user!.id).name }, urlOf(project, boq, "review"), { type: "revision", id: revision.id });
    changed(project.id, "revision", revision.id, "updated");
    changed(project.id, "boq", boq.id, "updated");
    return json(revisionView(revision, user!.id));
  },

  requestRevisionChanges({ user, params, body }) {
    const comment = String((body as { comment?: string } | undefined)?.comment ?? "").trim();
    const { revision, boq, project } = revisionOf(user!, params.revisionId!, "approve");
    liveRevision(boq, revision);
    if (revision.status !== "in_review") throw conflict("invalid_transition", "Only a version in review can be sent back.", { status: revision.status });
    if (!comment) throw new HttpError(400, "invalid_body", "Say what should change.", { field: "comment" });
    const at = nowIso();
    revision.status = "draft";
    (revision.comments ??= []).push({ id: newId(), by: user!.id, at, text: comment, outcome: "changes_requested" });
    boq.updatedAt = at;
    persist();
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "revision.changes_requested", subjectType: "revision", subjectId: revision.id, data: { boq: boq.name, revision: labelOf(revision) } });
    if (revision.submittedBy && revision.submittedBy !== user!.id)
      notify(revision.submittedBy, project, "revision.changes_requested", { boq: boq.name, revision: labelOf(revision), by: userRef(user!.id).name }, urlOf(project, boq, "review"), { type: "revision", id: revision.id });
    changed(project.id, "revision", revision.id, "updated");
    changed(project.id, "boq", boq.id, "updated");
    return json(revisionView(revision, user!.id));
  },

  approveRevision({ user, params, body }) {
    const comment = String((body as { comment?: string } | undefined)?.comment ?? "").trim();
    const { revision, boq, project } = revisionOf(user!, params.revisionId!, "approve");
    liveRevision(boq, revision);
    if (revision.status !== "in_review") throw conflict("invalid_transition", "Only a version in review can be approved.", { status: revision.status });
    if (fourEyesBlocks(project.orgId, revision, user!.id)) throw new HttpError(403, "four_eyes", "Someone other than the submitter approves this version (four-eyes).");
    const at = nowIso();
    revision.status = "approved";
    revision.approvedBy = user!.id;
    revision.approvedAt = at;
    (revision.comments ??= []).push({ id: newId(), by: user!.id, at, text: comment, outcome: "approved" });
    boq.updatedAt = at;
    persist();
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "revision.approved", subjectType: "revision", subjectId: revision.id, data: { boq: boq.name, revision: labelOf(revision) } });
    if (revision.submittedBy && revision.submittedBy !== user!.id)
      notify(revision.submittedBy, project, "revision.approved", { boq: boq.name, revision: labelOf(revision), by: userRef(user!.id).name }, urlOf(project, boq, "review"), { type: "revision", id: revision.id });
    changed(project.id, "revision", revision.id, "updated");
    changed(project.id, "boq", boq.id, "updated");
    return json(revisionView(revision, user!.id));
  },

  /** Withdraw a review (F09 §4): back to the working state; the reviewers are told. */
  reopenRevision({ user, params }) {
    const { revision, boq, project } = revisionOf(user!, params.revisionId!);
    liveRevision(boq, revision);
    if (revision.status !== "in_review" && revision.status !== "approved") throw conflict("invalid_transition", "This version isn't in review.", { status: revision.status });
    const role = projectRoleOf(project, user!.id);
    if (revision.submittedBy !== user!.id) writableProject(user!, project.id, role === "approver" ? "approve" : "saveVersion");
    withdrawReview(revision, user!.id, "withdrawn");
    return json(revisionView(revision, user!.id));
  },

  addReviewComment({ user, params, body }) {
    const b = (body ?? {}) as { text?: string; lineKey?: string };
    const { revision, boq, project } = revisionOf(user!, params.revisionId!);
    liveRevision(boq, revision);
    if (revision.status !== "in_review") throw conflict("invalid_transition", "Comments are for a version in review.", { status: revision.status });
    const role = projectRoleOf(project, user!.id);
    const may = role === "lead" || role === "estimator" || role === "approver" || (revision.reviewerIds ?? []).includes(user!.id);
    if (!may) throw forbidden("lead|estimator|approver");
    const text = (b.text ?? "").trim();
    if (!text) throw new HttpError(400, "invalid_body", "The comment is empty.", { field: "text" });
    const c = { id: newId(), by: user!.id, at: nowIso(), text, ...(b.lineKey?.trim() ? { lineKey: b.lineKey.trim() } : {}) };
    (revision.comments ??= []).push(c);
    persist();
    changed(project.id, "revision", revision.id, "updated");
    changed(project.id, "boq", boq.id, "updated");
    return json({ ...c, by: userRef(c.by) }, 201);
  },

  /**
   * F09 §5: "Mark this BoQ as done". Saves a final version first when the working version differs from
   * the last saved one (approval off; with approval on it must have been approved and saved already);
   * the working version is closed and the BoQ read-only for everyone (BR-27).
   */
  confirmBoq({ user, params, body }) {
    const b = (body ?? {}) as { label?: string; note?: string; notModelledConfirmed?: boolean };
    const { boq, project } = boqOf(user!, params.boqId!, "confirm");
    const approval = approvalOn(project.orgId);
    if (!approval && projectRoleOf(project, user!.id) !== "lead") throw forbidden("lead");
    if (boq.archived) throw conflict("boq_archived", "The BoQ is archived and read-only. Restore it first.");
    if (boq.status === "confirmed") throw conflict("invalid_transition", "The BoQ is confirmed already.");
    const revision = db().revisions.find((r) => r.id === boq.currentRevisionId)!;
    if (revision.status === "in_review") throw conflict("revision_in_review", "This version is in review: finish or withdraw the review first.");
    if (changedSinceSave(boq, revision, project)) {
      if (approval) throw conflict("not_saved", "With approval on, the working version must be approved and saved before the BoQ is confirmed.");
      needNotModelled(b);
      saveVersion(revision, boq, project, user!, b, false);
    } else {
      // Nothing changed since the last save: the working version closes (kept, so links to it still
      // answer; reopening takes it up again), and the saved one is current.
      revision.closed = true;
      boq.currentRevisionId = boq.latestIssuedRevisionId!;
    }
    const at = nowIso();
    boq.status = "confirmed";
    boq.confirmedBy = user!.id;
    boq.confirmedAt = at;
    boq.updatedAt = at;
    persist();
    const saved = db().revisions.find((r) => r.id === boq.currentRevisionId)!;
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "boq.confirmed", subjectType: "boq", subjectId: boq.id, data: { name: boq.name, version: labelOf(saved) } });
    tellMembers(project, boq, user!.id, "boq.confirmed", { boq: boq.name, label: labelOf(saved) }, { type: "boq", id: boq.id });
    changed(project.id, "boq", boq.id, "updated");
    return json(boqView(boq, user!.id));
  },

  /**
   * F09 §6 (lead, reason required, audited): a confirmed BoQ becomes workable again, in a new working
   * version carried over from the last saved one. Also F08 §1's "Reopen to update".
   */
  reopenBoq({ user, params, body }) {
    const { boq, project } = boqOf(user!, params.boqId!, "reopen");
    if (boq.archived) throw conflict("boq_archived", "The BoQ is archived and read-only. Restore it first.");
    const reason = ((body as { reason?: string } | undefined)?.reason ?? "").trim();
    if (!reason) throw new HttpError(400, "invalid_body", "Say why the BoQ is reopened.", { field: "reason" });
    if (boq.status !== "confirmed") throw conflict("invalid_transition", "Only a confirmed BoQ can be reopened.", { status: boq.status });
    const revisions = db().revisions.filter((r) => r.boqId === boq.id);
    const saved = revisions.filter((r) => r.status === "issued").sort((a, b) => b.number - a.number)[0];
    const from = saved ?? db().revisions.find((r) => r.id === boq.currentRevisionId)!;
    const at = nowIso();
    // The working version confirming closed is taken up again (its letter stays in sequence, BR-26).
    const closed = revisions.find((r) => r.closed && r.status === "draft");
    const fresh = {
      status: "draft" as const,
      inputs: structuredClone(from.inputs),
      // The saved version's run stays the working version's current run until the next generate.
      currentRunId: from.frozen?.runId ?? from.currentRunId,
      basedOnRevisionId: saved?.id ?? null,
    };
    const revision: RevisionRec = closed
      ? Object.assign(closed, fresh, { closed: false })
      : { id: newId(), boqId: boq.id, number: Math.max(...revisions.map((r) => r.number)) + 1, createdAt: at, ...fresh };
    if (!closed) db().revisions.push(revision);
    boq.status = "working";
    delete boq.confirmedBy;
    delete boq.confirmedAt;
    boq.currentRevisionId = revision.id;
    boq.updatedAt = at;
    persist();
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "boq.reopened", subjectType: "boq", subjectId: boq.id, data: { name: boq.name, reason, revision: labelOf(revision) } });
    tellMembers(project, boq, user!.id, "boq.reopened", { boq: boq.name, reason }, { type: "boq", id: boq.id });
    changed(project.id, "boq", boq.id, "updated");
    return json(boqView(boq, user!.id));
  },
};
