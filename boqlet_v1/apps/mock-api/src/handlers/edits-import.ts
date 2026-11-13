/**
 * F12 "Editing in Excel and importing back" (FE-037, P20): `POST /revisions/{id}/edits-import` reads an
 * edited BoQ workbook in an `import_boq_edits` job (the round-trip fake, `engine/fakes/boq_roundtrip.py`)
 * and keeps its EditsImportReport; `GET /jobs/{jobId}/edits-import-report` hands it out. Nothing is applied
 * here: the person reviews it and applies what they tick through `applyLineEdits`.
 */
import { getBlob, putBlob } from "../blobs.js";
import { readEditedXlsx, type ImportLine } from "../engine/fakes/export-xlsx.js";
import type { EditedLine } from "../engine/fakes/line-edits.js";
import { conflict, HttpError, notFound } from "../http.js";
import { createJob, jobView, runJob } from "../jobs.js";
import { notify } from "../notify.js";
import { visibleProject, writableProject } from "../projects.js";
import { json, type Handlers } from "../router.js";
import { db, type UserRec } from "../store.js";
import { writeBlock } from "./boqs.js";
import { runResult } from "./lines.js";

interface Report {
  overrides: { edit: Record<string, unknown>; change: string; row?: number }[];
  /** Each proposal is a `ManualItemInput` (the item and its codes), with the row it came from. */
  manualItems: { item: { item: { id: string } & Record<string, unknown>; codes?: Record<string, string> }; row?: number }[];
  problems: { sheet?: string; row: number; column?: string; message: string }[];
}

const reportKey = (orgId: string, jobId: string) => `orgs/${orgId}/imports/${jobId}.json`;

function jobOf(user: UserRec, jobId: string) {
  const job = db().jobs.find((j) => j.id === jobId);
  if (!job || job.type !== "import_boq_edits") throw notFound("import");
  visibleProject(user, job.projectId);
  return job;
}

export const editsImportHandlers: Handlers = {
  async importBoqEdits({ user, params, body }) {
    const revision = db().revisions.find((r) => r.id === params.revisionId);
    if (!revision) throw notFound("revision");
    const boq = db().boqs.find((b) => b.id === revision.boqId)!;
    const { project } = writableProject(user!, boq.projectId, "editLines");
    // Edits go into the working version (F12: "draft revisions").
    const blocked = writeBlock(boq, revision);
    if (blocked) throw blocked;
    if (boq.currentRevisionId !== revision.id) throw conflict("revision_locked", "Import edits into the working version.");
    const run = revision.currentRunId ? db().runs.find((r) => r.id === revision.currentRunId) : undefined;
    if (!run?.resultKey) throw conflict("no_run", "Generate the BoQ before importing edits.");
    const file = (body as FormData).get("file");
    if (!file || typeof file === "string") throw new HttpError(400, "invalid_body", 'Send the workbook as the multipart field "file".');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const job = createJob({ type: "import_boq_edits", subjectType: "revision", subjectId: revision.id, projectId: project.id, orgId: project.orgId, createdBy: user!.id });
    const org = db().orgs.find((o) => o.id === project.orgId)!;
    void runJob(job, async (ctx) => {
      ctx.progress("read", 20);
      const result = await runResult(run);
      const lines: ImportLine[] = (result.lines as EditedLine[]).map((l) => ({ key: l.key, codes: l.codes, ...(l.excluded ? { excluded: true } : {}) }));
      const report = (await readEditedXlsx(bytes, { boqId: boq.id, primary: null, lines })) as Report;
      // Manual lines get ids unique to this import (applying twice never clashes).
      for (const m of report.manualItems) m.item.item.id = `xlsx-${job.id.slice(0, 8)}-${m.row ?? report.manualItems.indexOf(m)}`;
      await putBlob(reportKey(project.orgId, job.id), new TextEncoder().encode(JSON.stringify(report)));
      ctx.progress("read", 100);
      notify({ userId: user!.id, orgId: project.orgId, kind: "job.succeeded", params: { boq: boq.name, type: "import", jobId: job.id }, url: `/${org.slug}/projects/${project.id}/boqs/${boq.id}?tab=exports`, entity: { type: "revision", id: revision.id } });
      return { importReport: { overrides: report.overrides.length, manualItems: report.manualItems.length, problems: report.problems.length } };
    });
    return json(jobView(job), 202);
  },

  async getEditsImportReport({ user, params }) {
    const job = jobOf(user!, params.jobId!);
    if (job.status === "queued" || job.status === "running") throw conflict("job_not_finished", "The import is still being read.", { status: job.status });
    if (job.status !== "succeeded") throw conflict("job_failed", job.error?.message ?? "The file could not be read.", { status: job.status });
    return json(JSON.parse(Buffer.from(await getBlob(reportKey(job.orgId, job.id))).toString("utf8")));
  },
};
