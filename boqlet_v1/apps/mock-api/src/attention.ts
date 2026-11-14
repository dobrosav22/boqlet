/**
 * F02 §5 "Needs you" (`GET /orgs/{orgId}/attention`): what waits for this person in the org's
 * projects they can see, newest first. Core kinds: versions in review assigned to me
 * (`review_requested`), changes requested on a version I submitted (`changes_requested`), my runs
 * that need input (`needs_input`), newer model versions for BoQs I created (`new_model_version`),
 * my jobs that failed in the last 7 days (`job_failed`). Titles are English fallbacks; the app
 * translates by kind with `params` (F15).
 */
import { now } from "./clock.js";
import { projectRoleOf } from "./projects.js";
import { db, type BoqRec, type ProjectRec } from "./store.js";

const urlOf = (project: ProjectRec, boq: BoqRec, tab?: string) => {
  const org = db().orgs.find((o) => o.id === project.orgId)!;
  return `/${org.slug}/projects/${project.id}/boqs/${boq.id}${tab ? `?tab=${tab}` : ""}`;
};

const labelOf = (number: number, label?: string) => label ?? String.fromCharCode(64 + number);

export function attentionFor(orgId: string, userId: string) {
  const d = db();
  const items: { kind: string; projectId: string; projectName: string; title: string; params: Record<string, unknown>; url: string; at?: string }[] = [];
  const projects = d.projects.filter((p) => p.orgId === orgId && p.status === "active" && projectRoleOf(p, userId));
  const since = new Date(now().getTime() - 7 * 86_400_000).toISOString();
  for (const project of projects) {
    const boqs = d.boqs.filter((b) => b.projectId === project.id && !b.archived);
    for (const boq of boqs) {
      const revision = d.revisions.find((r) => r.id === boq.currentRevisionId);
      if (!revision) continue;
      const label = labelOf(revision.number, revision.label);
      const base = { projectId: project.id, projectName: project.name };
      if (revision.status === "in_review" && revision.reviewerIds?.includes(userId) && revision.submittedBy !== userId)
        items.push({ ...base, kind: "review_requested", title: `Review ${boq.name} ${label}`, params: { boq: boq.name, revision: label }, url: urlOf(project, boq, "review"), ...(revision.submittedAt ? { at: revision.submittedAt } : {}) });
      const lastOutcome = [...(revision.comments ?? [])].reverse().find((c) => c.outcome);
      if (revision.status === "draft" && revision.submittedBy === userId && lastOutcome?.outcome === "changes_requested")
        items.push({ ...base, kind: "changes_requested", title: `Changes requested on ${boq.name} ${label}`, params: { boq: boq.name, revision: label }, url: urlOf(project, boq, "review"), at: lastOutcome.at });
      const run = revision.currentRunId ? d.runs.find((r) => r.id === revision.currentRunId) : undefined;
      if (run?.status === "needs_input" && run.createdBy === userId)
        items.push({ ...base, kind: "needs_input", title: `${boq.name} needs answers`, params: { boq: boq.name }, url: urlOf(project, boq, "questions"), at: run.finishedAt ?? run.createdAt });
      if (boq.createdBy === userId && revision.status !== "issued") {
        for (const input of revision.inputs.models) {
          const chosen = d.modelVersions.find((v) => v.id === input.modelVersionId);
          const newer = d.modelVersions
            .filter((v) => v.modelId === input.modelId && v.status === "ready" && !v.archived && chosen && v.number > chosen.number)
            .sort((a, b) => b.number - a.number)[0];
          const model = d.models.find((m) => m.id === input.modelId);
          if (newer && model) items.push({ ...base, kind: "new_model_version", title: `${model.name} v${newer.number} for ${boq.name}`, params: { boq: boq.name, model: model.name, version: newer.number }, url: urlOf(project, boq, "setup"), at: newer.uploadedAt });
        }
      }
    }
    for (const job of d.jobs.filter((j) => j.projectId === project.id && j.createdBy === userId && j.status === "failed" && (j.finishedAt ?? j.createdAt) >= since)) {
      const org = d.orgs.find((o) => o.id === orgId)!;
      items.push({ projectId: project.id, projectName: project.name, kind: "job_failed", title: `A ${job.type} job failed`, params: { type: job.type, ...(job.error?.code ? { code: job.error.code } : {}) }, url: `/${org.slug}/projects/${project.id}`, at: job.finishedAt ?? job.createdAt });
    }
  }
  return items.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
}
