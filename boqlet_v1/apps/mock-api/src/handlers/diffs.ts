/**
 * F08 §3–7 change report (FE-030): `POST /runs/{runId}/compare` starts a `diff` job (or answers the
 * cached diff), `GET /diffs/{id}` with its lines and elements (paged, filtered in memory) and the change
 * report export. The comparison is the "Change report" fake (`engine/fakes/diff.ts`, EN-002).
 */
import { gunzipSync, gzipSync } from "node:zlib";
import type { SceneIndex } from "@ifc-boq/types";
import { audit } from "../audit.js";
import { getBlob, putBlob } from "../blobs.js";
import { nowIso } from "../clock.js";
import { changeReportXlsx, diffRuns, type DiffResult, type DiffSide } from "../engine/fakes/diff.js";
import { HttpError, notFound } from "../http.js";
import { newId } from "../ids.js";
import { createJob, jobView, runJob } from "../jobs.js";
import { notify } from "../notify.js";
import { visibleProject } from "../projects.js";
import { json, type Handlers } from "../router.js";
import { db, persist, type DiffRec, type ExportRec, type RunRec, type UserRec } from "../store.js";
import { revisionLabel } from "./boqs.js";
import { exportFileName } from "./exports.js";
import { runFor, runResult } from "./lines.js";
import { sceneOf } from "./viewer.js";

const bodies = new Map<string, Pick<DiffResult, "lines" | "elements">>();

async function bodyOf(diff: DiffRec) {
  const hit = bodies.get(diff.id);
  if (hit) return hit;
  const body = JSON.parse(gunzipSync(await getBlob(diff.key)).toString("utf8")) as Pick<DiffResult, "lines" | "elements">;
  bodies.set(diff.id, body);
  if (bodies.size > 8) bodies.delete(bodies.keys().next().value!);
  return body;
}

const diffView = (d: DiffRec) => ({ id: d.id, fromRunId: d.fromRunId, toRunId: d.toRunId, summary: d.summary, questions: d.questions });

function projectOfRun(run: RunRec) {
  const revision = db().revisions.find((r) => r.id === run.revisionId)!;
  const boq = db().boqs.find((b) => b.id === revision.boqId)!;
  return { revision, boq, project: db().projects.find((p) => p.id === boq.projectId)! };
}

function diffOf(user: UserRec, diffId: string) {
  const diff = db().diffs.find((d) => d.id === diffId);
  if (!diff) throw notFound("diff");
  visibleProject(user, diff.projectId);
  return diff;
}

/** What the fake compares: the run's result, request, asked questions and models with their scenes. */
async function sideOf(run: RunRec, other: RunRec): Promise<DiffSide> {
  const versionsOther = new Map(other.request.inputs.models.map((m) => [m.modelId, m.modelVersionId]));
  const models = await Promise.all(
    run.request.inputs.models.map(async (m) => {
      const model = db().models.find((x) => x.id === m.modelId);
      const version = db().modelVersions.find((v) => v.id === m.modelVersionId);
      // Scenes are only needed when the other run has another version of the model (or none).
      const scene: SceneIndex | undefined = version && versionsOther.get(m.modelId) !== m.modelVersionId ? await sceneOf(version) : undefined;
      return { modelId: m.modelId, name: model?.name ?? m.modelId, versionId: m.modelVersionId, ...(scene ? { scene } : {}) };
    }),
  );
  return { result: await runResult(run), request: run.request as DiffSide["request"], askedQuestionIds: run.askedQuestionIds ?? [], models };
}

export const diffHandlers: Handlers = {
  compareRuns({ user, params, body }) {
    const to = runFor(user!, params.runId!);
    const againstRunId = (body as { againstRunId?: string } | undefined)?.againstRunId;
    if (!againstRunId) throw new HttpError(400, "invalid_body", "Say which run to compare with (againstRunId).");
    const from = runFor(user!, againstRunId);
    const { project } = projectOfRun(to);
    if (projectOfRun(from).project.id !== project.id) throw new HttpError(400, "invalid_body", "Runs of different projects can't be compared.");
    for (const r of [to, from]) if (!r.resultKey) throw new HttpError(409, "run_not_finished", "The run has no result yet.", { runId: r.id, status: r.status });
    const cached = db().diffs.find((d) => d.fromRunId === from.id && d.toRunId === to.id);
    if (cached) return json(diffView(cached));

    const job = createJob({ type: "diff", subjectType: "run", subjectId: to.id, projectId: project.id, orgId: project.orgId, createdBy: user!.id });
    void runJob(job, async (ctx) => {
      // Two requests for the same pair may both start a job: the second answers the first's diff.
      const done = db().diffs.find((d) => d.fromRunId === from.id && d.toRunId === to.id);
      if (done) return { diffId: done.id };
      ctx.progress("load", 10);
      const [a, b] = await Promise.all([sideOf(from, to), sideOf(to, from)]);
      ctx.progress("diff", 60);
      const result = diffRuns(a, b);
      const id = newId();
      const key = `orgs/${project.orgId}/diffs/${id}/diff.json.gz`;
      await putBlob(key, gzipSync(JSON.stringify({ lines: result.lines, elements: result.elements })));
      const rec: DiffRec = { id, fromRunId: from.id, toRunId: to.id, projectId: project.id, orgId: project.orgId, summary: result.summary, questions: result.questions, key, jobId: job.id, createdAt: nowIso() };
      db().diffs.push(rec);
      bodies.set(id, { lines: result.lines, elements: result.elements });
      persist();
      ctx.progress("diff", 100);
      return { diffId: id };
    });
    return json(jobView(job), 202);
  },

  getDiff({ user, params }) {
    return json(diffView(diffOf(user!, params.diffId!)));
  },

  async listDiffLines({ user, params, query }) {
    const diff = diffOf(user!, params.diffId!);
    const { lines } = await bodyOf(diff);
    const change = query.change as string | undefined;
    if (change && !["added", "removed", "changed"].includes(change)) throw new HttpError(400, "invalid_param", "change is added, removed or changed.");
    const min = query.minDeltaPct === undefined ? null : Number(query.minDeltaPct);
    if (min !== null && !Number.isFinite(min)) throw new HttpError(400, "invalid_param", "minDeltaPct must be a number.");
    // The threshold applies to changed lines; added and removed lines always pass it (they change by 100 %).
    const items = lines.filter((l) => (!change || l.change === change) && (min === null || l.change !== "changed" || l.deltaPct === null || Math.abs(l.deltaPct) >= min));
    return json(page(items, query));
  },

  async listDiffElements({ user, params, query }) {
    const diff = diffOf(user!, params.diffId!);
    const { elements } = await bodyOf(diff);
    return json(page(elements, query));
  },

  exportDiff({ user, params }) {
    const diff = diffOf(user!, params.diffId!);
    const to = db().runs.find((r) => r.id === diff.toRunId)!;
    const from = db().runs.find((r) => r.id === diff.fromRunId)!;
    const { revision, boq, project } = projectOfRun(to);
    const fromRevision = projectOfRun(from).revision;
    const job = createJob({ type: "export_xlsx", subjectType: "diff", subjectId: diff.id, projectId: project.id, orgId: project.orgId, createdBy: user!.id });
    const org = db().orgs.find((o) => o.id === project.orgId)!;
    void runJob(job, async (ctx) => {
      ctx.progress("export", 10);
      const { lines, elements } = await bodyOf(diff);
      const system = (to.classifications ?? [])[0]?.id;
      const group = (l: (typeof lines)[number]) => {
        const top = system ? (l.after ?? l.before)?.codes?.[system]?.path?.[0] : undefined;
        return top ? `${top.code} ${top.title}` : "";
      };
      const s = diff.summary as DiffResult["summary"];
      const label = (r: typeof revision) => `${revisionLabel(r.number)}${r.status === "draft" ? " (working)" : ""}`;
      const bytes = await changeReportXlsx({
        title: `${project.name} / ${boq.name}: changes`,
        subtitle: `${label(fromRevision)} (run of ${from.finishedAt ?? from.createdAt}) to ${label(revision)} (run of ${to.finishedAt ?? to.createdAt})`,
        summary: [
          ["Lines added", s.linesAdded],
          ["Lines removed", s.linesRemoved],
          ["Lines changed", s.linesChanged],
          ["Lines unchanged", s.linesUnchanged],
          ["Elements added", s.elementsAdded],
          ["Elements removed", s.elementsRemoved],
          ["Elements changed", s.elementsChanged],
          ["Questions new", s.questionsNew],
          ["Questions resolved", s.questionsResolved],
          ["Inputs that differ", s.inputsChanged.join(", ") || "none"],
          ...s.byModel.map((m): [string, string] => [`Elements in ${m.model}`, `${m.added} added, ${m.removed} removed, ${m.changed} changed`]),
          ...(s.guidChurnWarning ? [["Warning", "More than 50% of elements changed id. Check the export settings of the authoring tool."] as [string, string]] : []),
        ],
        lines: lines.map((l) => ({
          group: group(l),
          lineKey: l.lineKey,
          description: (l.after ?? l.before)!.description,
          unit: (l.after ?? l.before)!.unit,
          change: l.change,
          before: l.before?.quantity ?? null,
          after: l.after?.quantity ?? null,
          delta: l.delta,
          deltaPct: l.deltaPct,
          causes: l.causes.join(", "),
        })),
        elements: elements.map((e) => ({ guid: e.guid, model: e.model, change: e.change, fields: e.fields.join(", "), lines: e.lineKeys.join(", ") })),
      });
      const id = newId();
      const createdAt = nowIso();
      const fileName = exportFileName(project.code || project.name, boq.name, revisionLabel(revision.number), createdAt).replace(/\.xlsx$/, "_changes.xlsx");
      const storageKey = `orgs/${project.orgId}/exports/${id}/${fileName}`;
      await putBlob(storageKey, bytes);
      const rec: ExportRec = { id, kind: "changes_xlsx", subjectType: "diff", subjectId: diff.id, revisionId: revision.id, projectId: project.id, orgId: project.orgId, fileName, storageKey, sizeBytes: bytes.byteLength, jobId: job.id, createdBy: user!.id, createdAt };
      db().exports.push(rec);
      persist();
      audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "export.created", subjectType: "export", subjectId: id, data: { boq: boq.name, fileName, kind: "changes_xlsx" } });
      ctx.progress("export", 100);
      notify({ userId: user!.id, orgId: project.orgId, kind: "job.succeeded", params: { boq: boq.name, type: "export", file: fileName, jobId: job.id }, url: `/${org.slug}/projects/${project.id}/boqs/${boq.id}?tab=changes`, entity: { type: "export", id } });
      return { exportId: id };
    });
    return json(jobView(job), 202);
  },
};

function page<T>(items: T[], query: Record<string, unknown>) {
  const start = query.cursor ? Number.parseInt(String(query.cursor), 10) : 0;
  if (!Number.isInteger(start) || start < 0) throw new HttpError(400, "invalid_param", "Bad cursor.");
  const limit = Math.min(Number(query.limit ?? 100), 1000);
  return { items: items.slice(start, start + limit), nextCursor: start + limit < items.length ? String(start + limit) : null };
}
