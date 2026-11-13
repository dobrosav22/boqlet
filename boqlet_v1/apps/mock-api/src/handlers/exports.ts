/**
 * F12 run exports (FE-017): `POST /runs/{runId}/exports` starts an `export_xlsx` job that writes the
 * run's BoQ Excel (the "BoQ export" fake: the engine's exporter over the run's edited result), keeps
 * it in the blob folder and records an `Export`; downloads are a 302 to a signed URL.
 */
import { audit } from "../audit.js";
import { putBlob, signedUrl } from "../blobs.js";
import { nowIso } from "../clock.js";
import { exportXlsx } from "../engine/fakes/export-xlsx.js";
import { HttpError, notFound } from "../http.js";
import { newId } from "../ids.js";
import { notify } from "../notify.js";
import { emit } from "../events.js";
import { createJob, jobView, projectAudience, runJob } from "../jobs.js";
import { visibleProject } from "../projects.js";
import { json, type Handlers } from "../router.js";
import { db, persist, type ExportRec, type RevisionRec, type RunRec, type UserRec } from "../store.js";
import { runFor, runResult } from "./lines.js";

const userRef = (id: string) => {
  const u = db().users.find((x) => x.id === id);
  return { id, name: u?.name ?? "" };
};

export const exportView = (e: ExportRec) => ({
  id: e.id,
  kind: e.kind,
  subjectType: e.subjectType,
  subjectId: e.subjectId,
  fileName: e.fileName,
  sizeBytes: e.sizeBytes,
  jobId: e.jobId,
  createdBy: userRef(e.createdBy),
  createdAt: e.createdAt,
});

/** `{projectCode or name}_{boqName}_Rev{label}_{yyyy-mm-dd}.xlsx`, sanitised (F12). */
export function exportFileName(
  project: string,
  boq: string,
  label: string,
  at: string,
) {
  const clean = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  return `${clean(project)}_${clean(boq)}_Rev${clean(label)}_${at.slice(0, 10)}.xlsx`;
}

function exportOf(user: UserRec, exportId: string) {
  const e = db().exports.find((x) => x.id === exportId);
  if (!e) throw notFound("export");
  visibleProject(user, e.projectId);
  return e;
}

/**
 * Starts the `export_xlsx` job that writes a run's BoQ Excel and records the `Export` (F12). `issued`
 * is a save (F09 §2, BR-25): kind `issued_boq_xlsx`, the version's label and note in the title, no
 * WORKING mark, and the export id goes on the saved version's `frozen.exportIds`.
 */
export function startRunExport(opts: { run: RunRec; user: UserRec; groupBy?: string; issued?: { revision: RevisionRec; label: string; note?: string } }) {
  const { run, user, groupBy, issued } = opts;
  const revision = issued?.revision ?? db().revisions.find((r) => r.id === run.revisionId)!;
  const boq = db().boqs.find((b) => b.id === revision.boqId)!;
  const project = db().projects.find((p) => p.id === boq.projectId)!;
  const systems = run.classifications ?? [];
  const ordered = groupBy ? [...systems.filter((s) => s.id === groupBy), ...systems.filter((s) => s.id !== groupBy)] : systems;
  const job = createJob({ type: "export_xlsx", subjectType: "run", subjectId: run.id, projectId: project.id, orgId: project.orgId, createdBy: user.id });
  const label = issued?.label ?? (revision.label ?? String.fromCharCode(64 + revision.number));
  const working = !issued && revision.status !== "issued";
  const org = db().orgs.find((o) => o.id === project.orgId)!;
  const boqUrl = `/${org.slug}/projects/${project.id}/boqs/${boq.id}`;
  void runJob(
    job,
    async (ctx) => {
      ctx.progress("export", 10);
      const result = await runResult(run);
      const models = ((run.models ?? []) as { fileName: string }[]).map((m) => m.fileName).join(", ");
      const title = `${project.name} / ${boq.name}, revision ${label}${working ? " (WORKING)" : issued?.note ? `: ${issued.note}` : ""}${models ? ` / ${models}` : ""}`;
      const bytes = await exportXlsx(result, { classifications: ordered, modelName: title, generatedAt: run.finishedAt ?? run.createdAt });
      const id = newId();
      const createdAt = nowIso();
      const fileName = exportFileName(project.code || project.name, boq.name, label, createdAt);
      const storageKey = `orgs/${project.orgId}/exports/${id}/${fileName}`;
      await putBlob(storageKey, bytes);
      const rec: ExportRec = {
        id,
        kind: issued ? "issued_boq_xlsx" : "boq_xlsx",
        subjectType: "run",
        subjectId: run.id,
        revisionId: revision.id,
        projectId: project.id,
        orgId: project.orgId,
        fileName,
        storageKey,
        sizeBytes: bytes.byteLength,
        jobId: job.id,
        createdBy: user.id,
        createdAt,
      };
      db().exports.push(rec);
      if (issued?.revision.frozen) issued.revision.frozen.exportIds.push(id);
      persist();
      // The saved version now has its Excel: its views refresh.
      if (issued) emit("entity.changed", { entityType: "revision", entityId: issued.revision.id, projectId: project.id, change: "updated" }, { userIds: projectAudience(project.id) });
      audit({ orgId: project.orgId, projectId: project.id, actorId: user.id, action: "export.created", subjectType: "export", subjectId: id, data: { boq: boq.name, fileName, kind: rec.kind } });
      ctx.progress("export", 100);
      notify({ userId: user.id, orgId: project.orgId, kind: "job.succeeded", params: { boq: boq.name, type: "export", file: fileName, jobId: job.id }, url: boqUrl, entity: { type: "export", id } });
      return { exportId: id };
    },
    (done) => {
      if (done.status === "failed")
        notify({ userId: user.id, orgId: project.orgId, kind: "job.failed", params: { boq: boq.name, type: "export", jobId: job.id }, url: boqUrl, entity: { type: "run", id: run.id } });
    },
  );
  return job;
}

export const exportHandlers: Handlers = {
  async exportRun({ user, params, body }) {
    const run = runFor(user!, params.runId!);
    if (!run.resultKey) throw new HttpError(409, "run_not_finished", "The run has no result yet.", { status: run.status });
    const b = (body ?? {}) as { format?: string; groupBy?: string };
    if (b.groupBy && !(run.classifications ?? []).some((s) => s.id === b.groupBy)) throw new HttpError(400, "invalid_body", "groupBy is not a classification of this run.", { groupBy: b.groupBy });
    return json(jobView(startRunExport({ run, user: user!, groupBy: b.groupBy })), 202);
  },

  getExport({ user, params }) {
    return json(exportView(exportOf(user!, params.exportId!)));
  },

  downloadExport({ user, params }) {
    const e = exportOf(user!, params.exportId!);
    return new Response(null, {
      status: 302,
      headers: { Location: signedUrl(e.storageKey, "GET", 300).url },
    });
  },

  listRevisionExports({ user, params }) {
    const revision = db().revisions.find((r) => r.id === params.revisionId);
    if (!revision) throw notFound("revision");
    const boq = db().boqs.find((b) => b.id === revision.boqId)!;
    visibleProject(user!, boq.projectId);
    return json(
      db()
        .exports.filter((e) => e.revisionId === revision.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(exportView),
    );
  },
};
