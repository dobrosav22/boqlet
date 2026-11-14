/**
 * F03 models and versions (FE-007): models, versions uploaded straight to storage through signed
 * URLs, completion with the header check and content dedupe, the parse job through the engine,
 * retry, jobs, and the names preview.
 */
import { createHash } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import { audit } from "../audit.js";
import { blobExists, blobPath, signedUrl } from "../blobs.js";
import { nowIso } from "../clock.js";
import { EngineRefused, EngineUnavailable, engine } from "../engine/engine.js";
import { emit } from "../events.js";
import { notify as sendNotification } from "../notify.js";
import { conflict, HttpError, notFound } from "../http.js";
import { limitRefused } from "../limits.js";
import { newId } from "../ids.js";
import { createJob, jobView, projectAudience, requestCancel, runJob } from "../jobs.js";
import { visibleProject, writableProject } from "../projects.js";
import { json, noContent, type Handlers } from "../router.js";
import { db, persist, type ModelRec, type ModelVersionRec, type UserRec } from "../store.js";
import { planLimits } from "./orgs.js";
import { announceNewModelVersion, revisionLabel } from "./boqs.js";

const STAGES = ["download", "read", "geometry", "verify", "write"] as const;
const MESSAGES: Record<string, string> = {
  not_ifc: "This file is not an IFC file.",
  unsupported_schema: "This IFC schema is not supported.",
  corrupt_file: "The file could not be read: it may be damaged or incomplete.",
  parse_timeout: "Processing took too long and was stopped.",
  parse_error: "The model could not be processed.",
  engine_unavailable: "The processing service is not available. Try again.",
  cancelled: "Processing was cancelled.",
};

const userRef = (id: string) => {
  const u = db().users.find((x) => x.id === id);
  return u ? { id: u.id, name: u.name, email: u.email } : { id, name: "Unknown" };
};

export function versionView(v: ModelVersionRec) {
  return {
    id: v.id,
    modelId: v.modelId,
    number: v.number,
    fileName: v.fileName,
    sizeBytes: v.sizeBytes,
    ...(v.sha256 ? { sha256: v.sha256 } : {}),
    status: v.status,
    parseJobId: v.parseJobId,
    ...(v.summary ? { summary: v.summary } : {}),
    identicalToVersion: v.identicalToVersion,
    ...(v.error ? { error: v.error } : {}),
    ...(v.note ? { note: v.note } : {}),
    uploadedBy: userRef(v.uploadedBy),
    uploadedAt: v.uploadedAt,
    usedBy: usedBy(v.id),
  };
}

/** Revisions whose inputs or runs use the version. */
function usedBy(versionId: string) {
  const runRevisions = new Set(db().runs.filter((r) => r.request.inputs.models.some((m) => m.modelVersionId === versionId)).map((r) => r.revisionId));
  return db()
    .revisions.filter((r) => runRevisions.has(r.id) || r.inputs.models.some((m) => m.modelVersionId === versionId))
    .map((r) => {
      const boq = db().boqs.find((b) => b.id === r.boqId)!;
      return { boqId: boq.id, boqName: boq.name, revisionId: r.id, label: revisionLabel(r.number), status: r.status };
    });
}

const versionsOf = (modelId: string) => db().modelVersions.filter((v) => v.modelId === modelId && !v.archived).sort((a, b) => a.number - b.number);

export function modelView(m: ModelRec) {
  const versions = versionsOf(m.id);
  const latest = versions[versions.length - 1];
  return {
    id: m.id,
    projectId: m.projectId,
    name: m.name,
    discipline: m.discipline,
    ...(m.scope ? { scope: m.scope } : {}),
    ...(latest ? { latestVersion: versionView(latest) } : {}),
    versionCount: versions.length,
    archived: m.archived,
  };
}

function modelOf(user: UserRec, modelId: string, write = false) {
  const model = db().models.find((m) => m.id === modelId);
  if (!model) throw notFound("model");
  const access = write ? writableProject(user, model.projectId, "editModels") : visibleProject(user, model.projectId);
  return { model, ...access };
}

export function versionOf(user: UserRec, versionId: string, write = false) {
  const version = db().modelVersions.find((v) => v.id === versionId);
  if (!version) throw notFound("model version");
  return { version, ...modelOf(user, version.modelId, write) };
}

const changed = (projectId: string, entityType: string, entityId: string, change: "created" | "updated" | "deleted") =>
  emit("entity.changed", { entityType, entityId, projectId, change }, { userIds: projectAudience(projectId) });

const notify = (userId: string, orgId: string, kind: string, params: Record<string, unknown>, url: string, entity: { type: string; id: string }) =>
  sendNotification({ userId, orgId, kind, params, url, entity });

async function sha256Of(file: string) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function startsLikeIfc(file: string) {
  const fh = await open(file, "r");
  try {
    const buf = Buffer.alloc(64);
    const { bytesRead } = await fh.read(buf, 0, 64, 0);
    return buf.subarray(0, bytesRead).toString("latin1").replace(/^﻿/, "").trimStart().startsWith("ISO-10303-21");
  } finally {
    await fh.close();
  }
}

function markReady(version: ModelVersionRec, model: ModelRec, summary: ModelVersionRec["summary"], engineModelId?: string) {
  version.status = "ready";
  version.summary = summary;
  if (engineModelId) version.engineModelId = engineModelId;
  // "detect": the first version's guess becomes the discipline (F03 §1).
  if (model.discipline === "detect") model.discipline = summary?.disciplineGuess || "architecture";
  persist();
  const project = db().projects.find((p) => p.id === model.projectId)!;
  const org = db().orgs.find((o) => o.id === project.orgId)!;
  notify(version.uploadedBy, org.id, "model_version.ready", { model: model.name, version: version.number }, `/${org.slug}/projects/${project.id}/models/${model.id}/versions/${version.id}`, { type: "modelVersion", id: version.id });
  changed(project.id, "modelVersion", version.id, "updated");
  announceNewModelVersion(model.id, version.number, model.name);
}

function markFailed(version: ModelVersionRec, code: string, retryable: boolean, detail?: string) {
  version.status = "failed";
  version.retryable = retryable;
  version.error = { code, message: MESSAGES[code] ?? MESSAGES.parse_error!, ...(detail ? { details: { detail } } : {}) };
  persist();
  const model = db().models.find((m) => m.id === version.modelId)!;
  changed(model.projectId, "modelVersion", version.id, "updated");
}

/** The parse job: progress stages while the engine parses (the PoC parses in one request). */
function startParse(version: ModelVersionRec, model: ModelRec, user: UserRec) {
  const project = db().projects.find((p) => p.id === model.projectId)!;
  const job = createJob({ type: "parse", subjectType: "modelVersion", subjectId: version.id, projectId: project.id, orgId: project.orgId, createdBy: user.id });
  version.parseJobId = job.id;
  version.status = "queued";
  delete version.error;
  persist();
  void runJob(
    job,
    async (ctx) => {
      version.status = "processing";
      persist();
      changed(project.id, "modelVersion", version.id, "updated");
      let stage = 0;
      ctx.progress(STAGES[0], 2);
      const ticker = setInterval(() => {
        stage = Math.min(stage + 1, STAGES.length - 2);
        ctx.progress(STAGES[stage]!, Math.min(10 + stage * 20, 85));
      }, 700);
      const started = Date.now();
      try {
        const parsed = await engine().parseModel({ path: blobPath(version.blobKey), name: version.fileName });
        // Usage from day one, every parse too (05-plans-and-limits.md, BR-62).
        db().usage.push({ orgId: project.orgId, projectId: project.id, kind: "parse", ms: Date.now() - started, at: nowIso() });
        ctx.progress("write", 95);
        const checkDetails = await engine().checks(parsed.modelId);
        const summary = {
          ifcSchema: String(parsed.ifcSchema ?? ""),
          ...(parsed.authoringApp ? { authoringApp: String(parsed.authoringApp) } : {}),
          ...(parsed.disciplineGuess ? { disciplineGuess: String(parsed.disciplineGuess) } : {}),
          storeys: (parsed.storeys as { name?: string; elevation?: number }[] | undefined) ?? [],
          elementCount: Number(parsed.elementCount ?? 0),
          openingCount: Number(parsed.openingCount ?? 0),
          spaceCount: Number(parsed.spaceCount ?? 0),
          byClass: (parsed.byClass as Record<string, number>) ?? {},
          checks: (parsed.checks as Record<string, number>) ?? {},
          checkDetails: checkDetails as never,
          ...(parsed.parseMs !== undefined ? { parseMs: Number(parsed.parseMs) } : {}),
        };
        if (ctx.cancelled()) return;
        ctx.progress("write", 100);
        markReady(version, model, summary, parsed.modelId);
        return { modelVersionId: version.id };
      } catch (e) {
        if (e instanceof EngineUnavailable) {
          markFailed(version, "engine_unavailable", true, e.message);
          throw Object.assign(new Error(MESSAGES.engine_unavailable), { code: "engine_unavailable", retryable: true });
        }
        const detail = e instanceof EngineRefused ? e.message : (e as Error).message;
        const code = /schema/i.test(detail) ? "unsupported_schema" : e instanceof EngineRefused && e.status === 422 ? "corrupt_file" : "parse_error";
        markFailed(version, code, code !== "unsupported_schema", detail);
        throw Object.assign(new Error(MESSAGES[code]), { code, retryable: code !== "unsupported_schema" });
      } finally {
        clearInterval(ticker);
      }
    },
    (finished) => {
      if (finished.status === "cancelled" && version.status !== "ready") markFailed(version, "cancelled", true);
    },
  );
  return job;
}

export const modelHandlers: Handlers = {
  listModels({ user, params }) {
    const { project } = visibleProject(user!, params.projectId!);
    return json(db().models.filter((m) => m.projectId === project.id && !m.archived).map(modelView));
  },

  createModel({ user, params, body }) {
    const { project } = writableProject(user!, params.projectId!, "editModels");
    const b = body as { name: string; discipline?: string; scope?: Record<string, unknown> };
    if (!b.name.trim()) throw new HttpError(400, "invalid_body", "The name can't be empty.");
    const model: ModelRec = { id: newId(), projectId: project.id, name: b.name.trim(), discipline: b.discipline || "detect", ...(b.scope ? { scope: b.scope } : {}), archived: false, createdAt: nowIso() };
    db().models.push(model);
    persist();
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "model.created", subjectType: "model", subjectId: model.id, data: { name: model.name, discipline: model.discipline } });
    changed(project.id, "model", model.id, "created");
    return json(modelView(model), 201);
  },

  getModel({ user, params }) {
    return json(modelView(modelOf(user!, params.modelId!).model));
  },

  updateModel({ user, params, body }) {
    const { model, project } = modelOf(user!, params.modelId!, true);
    const b = body as { name?: string; discipline?: string; scope?: Record<string, unknown> };
    if (b.name !== undefined) model.name = b.name.trim() || model.name;
    if (b.discipline !== undefined) model.discipline = b.discipline;
    if (b.scope !== undefined) model.scope = b.scope;
    persist();
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "model.updated", subjectType: "model", subjectId: model.id, data: { fields: Object.keys(b) } });
    changed(project.id, "model", model.id, "updated");
    return json(modelView(model));
  },

  archiveModel({ user, params }) {
    const { model, project } = modelOf(user!, params.modelId!, true);
    model.archived = true;
    persist();
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "model.archived", subjectType: "model", subjectId: model.id });
    changed(project.id, "model", model.id, "deleted");
    return noContent();
  },

  listModelVersions({ user, params }) {
    const { model } = modelOf(user!, params.modelId!);
    return json(versionsOf(model.id).reverse().map(versionView));
  },

  createModelVersion({ user, params, body }) {
    const { model, project } = modelOf(user!, params.modelId!, true);
    const b = body as { fileName: string; sizeBytes: number; sha256?: string; note?: string };
    const org = db().orgs.find((o) => o.id === project.orgId)!;
    const maxMb = planLimits(org).maxModelVersionMb;
    const sizeMb = Math.ceil(b.sizeBytes / (1024 * 1024));
    if (maxMb !== undefined && b.sizeBytes > maxMb * 1024 * 1024) throw limitRefused(org.id, "maxModelVersionMb", sizeMb, maxMb);
    const id = newId();
    const number = db().modelVersions.filter((v) => v.modelId === model.id).reduce((n, v) => Math.max(n, v.number), 0) + 1;
    const version: ModelVersionRec = {
      id,
      modelId: model.id,
      number,
      fileName: b.fileName,
      sizeBytes: b.sizeBytes,
      ...(b.sha256 ? { sha256: b.sha256 } : {}),
      status: "awaiting_upload",
      parseJobId: null,
      identicalToVersion: null,
      ...(b.note ? { note: b.note } : {}),
      uploadedBy: user!.id,
      uploadedAt: nowIso(),
      blobKey: `orgs/${org.id}/uploads/${id}/source.ifc`,
    };
    db().modelVersions.push(version);
    persist();
    const upload = signedUrl(version.blobKey, "PUT", 3600);
    audit({ orgId: org.id, projectId: project.id, actorId: user!.id, action: "model_version.created", subjectType: "modelVersion", subjectId: id, data: { model: model.name, number, fileName: b.fileName } });
    changed(project.id, "modelVersion", id, "created");
    return json({ version: versionView(version), upload: { method: "PUT", url: upload.url, headers: { "Content-Type": "application/octet-stream" }, expiresAt: upload.expiresAt } }, 201);
  },

  getModelVersion({ user, params }) {
    return json(versionView(versionOf(user!, params.versionId!).version));
  },

  deleteModelVersion({ user, params }) {
    const { version, project } = versionOf(user!, params.versionId!, true);
    // Used by a BoQ → archived (hidden from pickers, runs keep it); otherwise removed.
    if (usedBy(version.id).length) version.archived = true;
    else db().modelVersions.splice(db().modelVersions.indexOf(version), 1);
    persist();
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "model_version.deleted", subjectType: "modelVersion", subjectId: version.id });
    changed(project.id, "modelVersion", version.id, "deleted");
    return noContent();
  },

  async completeModelUpload({ user, params }) {
    const { version, model, project } = versionOf(user!, params.versionId!, true);
    if (version.status !== "awaiting_upload") return json(versionView(version)); // idempotent
    if (!(await blobExists(version.blobKey))) throw new HttpError(400, "upload_missing", "The file has not been uploaded yet.");
    const file = blobPath(version.blobKey);
    if (!(await startsLikeIfc(file))) {
      // Not retryable: the same file will never parse (F03 §4, F03-AC3). No job is created.
      markFailed(version, "not_ifc", false);
      return json(versionView(version));
    }
    version.sha256 = await sha256Of(file);
    // Identical content anywhere in the org: reuse the parse, no job (BR-08, F03-AC4).
    const projectsOfOrg = new Set(db().projects.filter((p) => p.orgId === project.orgId).map((p) => p.id));
    const twin = db().modelVersions.find(
      (v) => v.id !== version.id && v.sha256 === version.sha256 && v.status === "ready" && projectsOfOrg.has(db().models.find((m) => m.id === v.modelId)?.projectId ?? ""),
    );
    if (twin) {
      version.identicalToVersion = twin.modelId === model.id ? twin.number : null;
      markReady(version, model, twin.summary, twin.engineModelId);
      return json(versionView(version));
    }
    startParse(version, model, user!);
    return json(versionView(version));
  },

  retryModelVersion({ user, params }) {
    const { version, model } = versionOf(user!, params.versionId!, true);
    if (version.status !== "failed" || !version.retryable) throw conflict("invalid_transition", "Only a failed version with a retryable error can be retried.", { status: version.status, code: version.error?.code });
    startParse(version, model, user!);
    return json(versionView(version));
  },

  async namesInModel({ user, params, body }) {
    const { version, project } = versionOf(user!, params.versionId!);
    if (version.status !== "ready" || !version.engineModelId) throw conflict("model_not_ready", "The model version is not ready yet.");
    const b = (body ?? {}) as { dictionaryVersionIds?: string[]; draftDictionaries?: unknown[] };
    const ids = b.dictionaryVersionIds ?? [...(project.defaults.dictionaryVersionIds ?? []), ...projectDictionaryVersionIds(project.projectDictionaryId)];
    const docs = ids.map((id) => db().presetVersions.find((v) => v.id === id)?.doc).filter(Boolean);
    try {
      return json(await engine().names(version.engineModelId, [...docs, ...(b.draftDictionaries ?? [])]));
    } catch (e) {
      if (e instanceof EngineUnavailable) throw new HttpError(503, "engine_unavailable", MESSAGES.engine_unavailable!);
      throw new HttpError(422, "preset_invalid", (e as Error).message);
    }
  },

  getJob({ user, params }) {
    const job = db().jobs.find((j) => j.id === params.jobId);
    if (!job) throw notFound("job");
    visibleProject(user!, job.projectId);
    return json(jobView(job));
  },

  cancelJob({ user, params }) {
    const job = db().jobs.find((j) => j.id === params.jobId);
    if (!job) throw notFound("job");
    visibleProject(user!, job.projectId);
    if (job.status !== "queued" && job.status !== "running") throw conflict("invalid_transition", `The job is ${job.status}.`, { status: job.status });
    requestCancel(job);
    return json(jobView(job));
  },
};

/** The published version of the project's own dictionary (always the most specific layer). */
export function projectDictionaryVersionIds(presetId: string) {
  const versions = db().presetVersions.filter((v) => v.presetId === presetId && v.status === "published");
  const latest = versions.sort((a, b) => (b.number ?? 0) - (a.number ?? 0))[0];
  return latest ? [latest.id] : [];
}
