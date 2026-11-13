/**
 * F04 BoQs and runs (FE-008): BoQs with their working version (a `draft` revision), revision
 * inputs, generating runs through the engine as `run` jobs, run history, pending changes, archive.
 * Saving versions, confirming and review come with FE-031. Runs carry the project's decisions (FE-010).
 */
import { gzipSync } from "node:zlib";
import { audit } from "../audit.js";
import { putBlob, signedUrl } from "../blobs.js";
import { nowIso } from "../clock.js";
import { EngineRefused, EngineUnavailable, engine, type PresetFolder } from "../engine/engine.js";
import { emit } from "../events.js";
import { notify as sendNotification } from "../notify.js";
import { codeListsOf } from "../codes.js";
import { decisionsSnapshot, unappliedQuestionIds } from "../decisions.js";
import { applyManualCodes, applyOverrides } from "../engine/fakes/line-edits.js";
import { addTraceSteps } from "../engine/fakes/trace-steps.js";
import { conflict, HttpError, limitReached, notFound } from "../http.js";
import { newId } from "../ids.js";
import { createJob, jobView, projectAudience, runJob } from "../jobs.js";
import { PROJECT_PERMISSIONS, projectPermissions, visibleProject, writableProject } from "../projects.js";
import { json, type Handlers } from "../router.js";
import {
  db,
  persist,
  type BoqRec,
  type PresetRec,
  type PresetVersionRec,
  type ProjectRec,
  type RevisionInputs,
  type RevisionRec,
  type RunRec,
  type UserRec,
} from "../store.js";
import { planLimits } from "./orgs.js";
import { latestPublished } from "./presets.js";

type InputsPatch = Partial<RevisionInputs>;

/** Progress stages of a run job (F04 §3.3). */
export const RUN_STAGES = ["load", "names", "measure", "federate", "rules", "classify", "export", "index"] as const;

const userRef = (id: string) => {
  const u = db().users.find((x) => x.id === id);
  return u ? { id: u.id, name: u.name, email: u.email } : { id, name: "Unknown" };
};

/** "A", "B", … "Z", "AA" (data-model.md: label from number). */
export function revisionLabel(n: number): string {
  let s = "";
  for (let k = n; k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(65 + ((k - 1) % 26)) + s;
  return s;
}

// ───────────────────────────── inputs ─────────────────────────────

const readyVersionsOf = (modelId: string) =>
  db()
    .modelVersions.filter((v) => v.modelId === modelId && v.status === "ready" && !v.archived)
    .sort((a, b) => b.number - a.number);

/** Inputs of a new working version: project defaults and every model's latest ready version (F04 §1). */
function defaultInputs(project: ProjectRec): RevisionInputs {
  const models = db()
    .models.filter((m) => m.projectId === project.id && !m.archived)
    .flatMap((m) => {
      const latest = readyVersionsOf(m.id)[0];
      return latest ? [{ modelId: m.id, modelVersionId: latest.id, discipline: m.discipline, ...(m.scope ? { scope: m.scope as never } : {}) }] : [];
    });
  return {
    models,
    ruleSetVersionId: project.defaults.ruleSetVersionId ?? "",
    classificationVersionIds: project.defaults.classificationVersionIds ?? [],
    dictionaryVersionIds: project.defaults.dictionaryVersionIds ?? [],
    federationVersionId: project.defaults.federationVersionId ?? null,
    resolutionVersionId: null,
  };
}

const invalid = (message: string, details?: Record<string, unknown>) => new HttpError(400, "invalid_inputs", message, details);

/** A published preset version of `kind` that the project may use (system, its org's, its own). */
function usableVersion(project: ProjectRec, versionId: string, kind: PresetRec["kind"]) {
  const version = db().presetVersions.find((v) => v.id === versionId);
  const preset = version ? db().presets.find((p) => p.id === version.presetId) : undefined;
  const visible = preset && (preset.layer === "system" || (preset.orgId === project.orgId && (preset.projectId === null || preset.projectId === project.id)));
  if (!version || !preset || !visible || preset.kind !== kind || version.status !== "published") throw invalid(`Not a published ${kind} version this project can use.`, { versionId, kind });
  if (preset.available === false) throw conflict("preset_unavailable", `${preset.name} can't be used yet.`, { presetId: preset.id, reason: preset.unavailableReason });
  return { version, preset };
}

function validateInputs(project: ProjectRec, inputs: RevisionInputs) {
  const seen = new Set<string>();
  for (const m of inputs.models) {
    const model = db().models.find((x) => x.id === m.modelId && x.projectId === project.id && !x.archived);
    const version = db().modelVersions.find((v) => v.id === m.modelVersionId && v.modelId === m.modelId);
    if (!model || !version) throw invalid("A model or model version is not part of this project.", { modelId: m.modelId, modelVersionId: m.modelVersionId });
    if (seen.has(m.modelId)) throw invalid("A model can be used only once in a BoQ.", { modelId: m.modelId });
    seen.add(m.modelId);
  }
  if (inputs.ruleSetVersionId) usableVersion(project, inputs.ruleSetVersionId, "rule_set");
  for (const id of inputs.classificationVersionIds) usableVersion(project, id, "classification");
  for (const id of inputs.dictionaryVersionIds) {
    const { preset } = usableVersion(project, id, "dictionary");
    if (preset.id === project.projectDictionaryId) throw invalid("The project dictionary is always added last; don't list it.", { versionId: id });
  }
  if (inputs.federationVersionId) usableVersion(project, inputs.federationVersionId, "federation");
  if (inputs.resolutionVersionId) usableVersion(project, inputs.resolutionVersionId, "resolution");
  if (new Set(inputs.classificationVersionIds).size !== inputs.classificationVersionIds.length || new Set(inputs.dictionaryVersionIds).size !== inputs.dictionaryVersionIds.length)
    throw invalid("A preset is listed twice.");
}

function checkModelLimit(project: ProjectRec, count: number) {
  const org = db().orgs.find((o) => o.id === project.orgId)!;
  const max = planLimits(org).maxModelsPerBoq;
  if (max !== undefined && count > max) throw limitReached("maxModelsPerBoq", count, max);
}

function mergeInputs(base: RevisionInputs, patch: InputsPatch): RevisionInputs {
  const next = { ...base };
  for (const key of Object.keys(patch) as (keyof RevisionInputs)[]) if (patch[key] !== undefined) (next as Record<string, unknown>)[key] = patch[key];
  return next;
}

/** The latest published version of the project's own dictionary, always the last layer (F04 §2). */
function projectDictionaryVersionId(project: ProjectRec) {
  return latestPublished(project.projectDictionaryId)?.id ?? null;
}

// ───────────────────────────── pending changes ─────────────────────────────

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const modelsKey = (models: RevisionInputs["models"]) =>
  models.map((m) => ({ modelId: m.modelId, modelVersionId: m.modelVersionId, discipline: m.discipline, scope: m.scope ?? null })).sort((a, b) => a.modelId.localeCompare(b.modelId));

/**
 * What differs from the current run's request (F04 §4, 07-backend/architecture.md): the inputs,
 * the project dictionary's version and the decisions (an answer given, changed or cleared since).
 */
export function pendingChanges(revision: RevisionRec, project: ProjectRec): string[] {
  const run = revision.currentRunId ? db().runs.find((r) => r.id === revision.currentRunId) : undefined;
  if (!run) return [];
  const was = run.request.inputs;
  const is = revision.inputs;
  const out: string[] = [];
  if (!same(modelsKey(was.models), modelsKey(is.models))) out.push("inputs.models");
  if (was.ruleSetVersionId !== is.ruleSetVersionId) out.push("inputs.ruleSet");
  if (!same(was.classificationVersionIds, is.classificationVersionIds)) out.push("inputs.classifications");
  if (!same(was.dictionaryVersionIds, is.dictionaryVersionIds) || run.request.projectDictionaryVersionId !== projectDictionaryVersionId(project)) out.push("inputs.dictionaries");
  if ((was.federationVersionId ?? null) !== (is.federationVersionId ?? null)) out.push("inputs.federation");
  if ((was.resolutionVersionId ?? null) !== (is.resolutionVersionId ?? null)) out.push("inputs.resolution");
  if (unappliedQuestionIds(run).length) out.push("decisions");
  const boq = db().boqs.find((b) => b.id === revision.boqId)!;
  if (adjustmentsKey(run.request.adjustments ?? adjustmentsOf(boq.id, true)) !== adjustmentsKey(adjustmentsOf(boq.id))) out.push("adjustments");
  return out;
}

/** The BoQ's line edits and manual lines, as a run is sent them (`empty`: none, for runs from before FE-011). */
export function adjustmentsOf(boqId: string, empty = false) {
  if (empty) return { overrides: [], manualItems: [] };
  return {
    overrides: structuredClone(db().overrides.filter((o) => o.boqId === boqId)),
    manualItems: structuredClone(db().manualItems.filter((m) => m.boqId === boqId)),
  };
}

/** What of the edits changes a run's result: their content, not who made them or when. */
function adjustmentsKey(a: ReturnType<typeof adjustmentsOf>) {
  const overrides = a.overrides
    .map(({ lineKey, quantity, description, unit, codes, sortAfter, excluded }) => ({ lineKey, quantity, description, unit, codes, sortAfter, excluded }))
    .sort((x, y) => x.lineKey.localeCompare(y.lineKey));
  const manual = a.manualItems.map(({ item, codes, sortHint }) => ({ item, codes, sortHint })).sort((x, y) => x.item.id.localeCompare(y.item.id));
  return JSON.stringify({ overrides, manual });
}

// ───────────────────────────── views ─────────────────────────────

export function runView(run: RunRec) {
  return {
    id: run.id,
    revisionId: run.revisionId,
    jobId: run.jobId,
    status: run.status,
    ...(run.stats ? { stats: run.stats } : {}),
    ...(run.models ? { models: run.models as never } : {}),
    ...(run.building ? { building: run.building as never } : {}),
    snapshotVersions: {
      ruleSetVersionId: run.request.inputs.ruleSetVersionId,
      classificationVersionIds: run.request.inputs.classificationVersionIds,
      dictionaryVersionIds: [...run.request.inputs.dictionaryVersionIds, ...(run.request.projectDictionaryVersionId ? [run.request.projectDictionaryVersionId] : [])],
      models: run.request.inputs.models.map((m) => {
        const engineId = db().modelVersions.find((v) => v.id === m.modelVersionId)?.engineModelId;
        return { modelId: m.modelId, modelVersionId: m.modelVersionId, discipline: m.discipline, ...(engineId ? { traceId: engineId } : {}) };
      }),
    },
    ...(run.classifications ? { classifications: run.classifications } : {}),
    ...(run.engineVersion ? { engineVersion: run.engineVersion } : {}),
    ...(run.error ? { error: run.error } : {}),
    createdBy: userRef(run.createdBy),
    createdAt: run.createdAt,
    ...(run.finishedAt ? { finishedAt: run.finishedAt } : {}),
  };
}

/** Writes on a BoQ stop when it's archived or confirmed, and on a revision that isn't the working one. */
export function writeBlock(boq: BoqRec, revision?: RevisionRec): HttpError | null {
  if (boq.archived) return conflict("boq_archived", "The BoQ is archived and read-only. Restore it first.");
  if (boq.status === "confirmed") return conflict("boq_confirmed", "The BoQ is confirmed and read-only. Reopen it first.");
  if (revision && revision.status !== "draft") return conflict("revision_locked", "This version is saved and can't be changed.");
  return null;
}

const WRITE_KEYS = new Set(["editBoqs", "answerQuestions", "editLines", "saveVersion"]);

function revisionPermissions(project: ProjectRec, boq: BoqRec, revision: RevisionRec, userId: string) {
  const { role } = visibleProject(db().users.find((u) => u.id === userId)!, project.id);
  const base = projectPermissions(project, role);
  const blocked = !!writeBlock(boq, revision);
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v && !(blocked && WRITE_KEYS.has(k))]));
}

export function revisionView(revision: RevisionRec, userId: string) {
  const boq = db().boqs.find((b) => b.id === revision.boqId)!;
  const project = db().projects.find((p) => p.id === boq.projectId)!;
  const run = revision.currentRunId ? db().runs.find((r) => r.id === revision.currentRunId) : undefined;
  const models = revision.inputs.models.map((m) => {
    const chosen = db().modelVersions.find((v) => v.id === m.modelVersionId);
    const latest = readyVersionsOf(m.modelId)[0];
    return { ...m, newerVersionAvailable: chosen && latest && latest.number > chosen.number ? latest.number : null };
  });
  return {
    id: revision.id,
    boqId: revision.boqId,
    number: revision.number,
    label: revisionLabel(revision.number),
    status: revision.status,
    inputs: { ...revision.inputs, models },
    ...(run ? { currentRun: runView(run) } : {}),
    basedOnRevisionId: revision.basedOnRevisionId,
    basedOnRunId: null,
    pendingChanges: pendingChanges(revision, project),
    permissions: revisionPermissions(project, boq, revision, userId),
  };
}

export function boqView(boq: BoqRec, userId: string) {
  const revision = db().revisions.find((r) => r.id === boq.currentRevisionId)!;
  const view = revisionView(revision, userId);
  return {
    id: boq.id,
    projectId: boq.projectId,
    name: boq.name,
    ...(boq.description ? { description: boq.description } : {}),
    status: boq.status,
    currentRevision: view,
    latestIssuedRevisionId: boq.latestIssuedRevisionId,
    newModelVersionsAvailable: view.inputs.models.some((m) => m.newerVersionAvailable !== null),
    archived: boq.archived,
    createdAt: boq.createdAt,
    updatedAt: boq.updatedAt,
  };
}

// ───────────────────────────── access ─────────────────────────────

function boqOf(user: UserRec, boqId: string, permission?: keyof typeof PROJECT_PERMISSIONS) {
  const boq = db().boqs.find((b) => b.id === boqId);
  if (!boq) throw notFound("BoQ");
  const access = permission ? writableProject(user, boq.projectId, permission) : visibleProject(user, boq.projectId);
  return { boq, ...access };
}

function revisionOf(user: UserRec, revisionId: string, permission?: keyof typeof PROJECT_PERMISSIONS) {
  const revision = db().revisions.find((r) => r.id === revisionId);
  if (!revision) throw notFound("revision");
  return { revision, ...boqOf(user, revision.boqId, permission) };
}

function runOf(user: UserRec, runId: string) {
  const run = db().runs.find((r) => r.id === runId);
  if (!run) throw notFound("run");
  return { run, ...revisionOf(user, run.revisionId) };
}

const changed = (projectId: string, entityType: string, entityId: string, change: "created" | "updated" | "deleted") =>
  emit("entity.changed", { entityType, entityId, projectId, change }, { userIds: projectAudience(projectId) });

const notify = (userId: string, project: ProjectRec, kind: string, params: Record<string, unknown>, url: string, entity: { type: string; id: string }) =>
  sendNotification({ userId, orgId: project.orgId, kind, params, url, entity });

// ───────────────────────────── the run job ─────────────────────────────

/** Minutes of processing used this calendar month (BR-62). */
function minutesUsed(orgId: string) {
  const month = nowIso().slice(0, 7);
  return db().usage.filter((u) => u.orgId === orgId && u.at.startsWith(month)).reduce((sum, u) => sum + u.ms, 0) / 60000;
}

const FOLDER: Record<string, PresetFolder> = { rule_set: "rules", classification: "classifications", dictionary: "dictionaries" };

/**
 * The engine's id for a preset version (mock-api.md "Interim engine path"): shipped system presets
 * by their slug, everything else `mock-<versionId>`. For a classification it is also the system id
 * the lines' `codes` are keyed by.
 */
export function engineIdOf(version: PresetVersionRec): string {
  const preset = db().presets.find((p) => p.id === version.presetId)!;
  return preset.layer === "system" && version.number === 1 ? preset.slug : `mock-${version.id}`;
}

/**
 * The removal of the presets the last run saved (see `startRun`). Whatever saves presets waits for it
 * first, so a late removal never takes a preset that was just saved again under the same id.
 */
let cleanup: Promise<void> = Promise.resolve();
export const presetsSettled = () => cleanup;

/** Saves the version through the PoC API when it isn't a shipped one; returns its engine id. */
export async function enginePresetId(version: PresetVersionRec): Promise<string> {
  const preset = db().presets.find((p) => p.id === version.presetId)!;
  const id = engineIdOf(version);
  if (id === preset.slug) return id;
  const doc = structuredClone(version.doc) as Record<string, unknown>;
  if (preset.kind === "classification") (doc.codeList as Record<string, unknown>).id = id;
  else doc.id = id;
  await engine().savePreset(FOLDER[preset.kind]!, id, doc);
  return id;
}

const RUN_MESSAGES: Record<string, string> = {
  engine_unavailable: "The processing service is not available. Try again.",
  run_error: "The BoQ could not be generated.",
};

function startRun(run: RunRec, revision: RevisionRec, boq: BoqRec, project: ProjectRec, user: UserRec) {
  const org = db().orgs.find((o) => o.id === project.orgId)!;
  const job = createJob({ type: "run", subjectType: "run", subjectId: run.id, projectId: project.id, orgId: org.id, createdBy: user.id });
  run.jobId = job.id;
  const inputs = run.request.inputs;
  const finishRun = () => {
    run.finishedAt = nowIso();
    persist();
    changed(project.id, "run", run.id, "updated");
    changed(project.id, "revision", revision.id, "updated");
    changed(project.id, "boq", boq.id, "updated");
  };
  void runJob(
    job,
    async (ctx) => {
      run.status = "running";
      persist();
      changed(project.id, "run", run.id, "updated");
      const started = Date.now();
      let stage = 0;
      ctx.progress(RUN_STAGES[0], 2);
      const ticker = setInterval(() => {
        stage = Math.min(stage + 1, RUN_STAGES.length - 2);
        ctx.progress(RUN_STAGES[stage]!, Math.min(8 + stage * 12, 85));
      }, 400);
      // Presets saved through the PoC API for this run; removed afterwards, so the engine's user folder
      // (read on every run) doesn't grow with every project dictionary version (FE-012).
      const saved: [PresetFolder, string][] = [];
      try {
        await cleanup;
        const version = (id: string) => db().presetVersions.find((v) => v.id === id)!;
        const keep = (folder: PresetFolder) => (id: string) => {
          if (id.startsWith("mock-")) saved.push([folder, id]);
          return id;
        };
        const adjustments = run.request.adjustments ?? adjustmentsOf(boq.id, true);
        let ruleSet = keep("rules")(await enginePresetId(version(inputs.ruleSetVersionId)));
        // Manual lines go to the engine as a patch that appends them to the rule set (data-model.md "ManualItem").
        if (adjustments.manualItems.length) {
          const patchId = `mock-run-${run.id}`;
          await engine().savePreset("rules", patchId, { schemaVersion: "1.0", id: patchId, name: `${boq.name}: manual lines`, version: "1", extends: ruleSet, manual: adjustments.manualItems.map((m) => m.item) });
          ruleSet = keep("rules")(patchId);
        }
        const dictionaryIds = [...inputs.dictionaryVersionIds, ...(run.request.projectDictionaryVersionId ? [run.request.projectDictionaryVersionId] : [])];
        const dictionaries = (await Promise.all(dictionaryIds.map((id) => enginePresetId(version(id))))).map(keep("dictionaries"));
        const classifications = (await Promise.all(inputs.classificationVersionIds.map((id) => enginePresetId(version(id))))).map(keep("classifications"));
        const models = inputs.models.map((m) => {
          const v = db().modelVersions.find((x) => x.id === m.modelVersionId)!;
          return { modelId: v.engineModelId!, discipline: m.discipline, ...(m.scope ? { scope: m.scope as Record<string, unknown> } : {}) };
        });
        const decisions = (run.request.decisions ?? []).map((d) => ({ questionId: d.questionId, scope: "project", answer: d.answer }));
        const { result } = await engine().run({ models, ruleSet, dictionaries, classifications, decisions });
        if (ctx.cancelled()) return;
        const codeLists = codeListsOf(inputs);
        applyManualCodes(result, adjustments.manualItems, codeLists);
        applyOverrides(result, adjustments.overrides, adjustments.manualItems, codeLists);
        addTraceSteps(result, (key) => {
          const by = adjustments.overrides.find((o) => o.lineKey === key && o.quantity !== undefined)?.createdBy;
          return by ? db().users.find((u) => u.id === by)?.name : undefined;
        });
        ctx.progress("index", 95);
        run.resultKey = `orgs/${org.id}/runs/${run.id}/result.json.gz`;
        await putBlob(run.resultKey, gzipSync(JSON.stringify(result)));
        const blocking = result.questions.filter((q) => q.blocking).length;
        run.stats = { ...result.stats, questions: result.questions.length, blockingQuestions: blocking, warnings: result.warnings.length };
        run.askedQuestionIds = result.questions.map((q) => q.id);
        run.blockingQuestionIds = result.questions.filter((q) => q.blocking).map((q) => q.id);
        run.models = result.models;
        if (result.building) run.building = result.building;
        run.classifications = inputs.classificationVersionIds.map((id) => {
          const preset = db().presets.find((p) => p.id === version(id).presetId)!;
          return { id: engineIdOf(version(id)), name: preset.name };
        });
        run.engineVersion = engine().name;
        run.status = blocking > 0 || result.status === "needs_input" ? "needs_input" : "complete";
        // The newest finished run becomes current (F04 edge cases); ids are time-ordered.
        const current = revision.currentRunId ? db().runs.find((r) => r.id === revision.currentRunId) : undefined;
        if (!current || current.createdAt <= run.createdAt) revision.currentRunId = run.id;
        db().usage.push({ orgId: org.id, kind: "run", ms: Date.now() - started, at: nowIso() });
        ctx.progress("index", 100);
        audit({ orgId: org.id, projectId: project.id, actorId: user.id, action: "run.finished", subjectType: "run", subjectId: run.id, data: { boq: boq.name, status: run.status, lines: run.stats.lines } });
        if (run.status === "needs_input")
          notify(user.id, project, "run.needs_input", { boq: boq.name, count: blocking, jobId: job.id }, `/${org.slug}/projects/${project.id}/boqs/${boq.id}?tab=questions`, { type: "run", id: run.id });
        else notify(user.id, project, "job.succeeded", { boq: boq.name, type: "run", jobId: job.id }, `/${org.slug}/projects/${project.id}/boqs/${boq.id}`, { type: "run", id: run.id });
        finishRun();
        return { runId: run.id };
      } catch (e) {
        const code = e instanceof EngineUnavailable ? "engine_unavailable" : "run_error";
        const detail = e instanceof EngineRefused || e instanceof EngineUnavailable ? e.message : (e as Error).message;
        run.status = "failed";
        run.error = { code, message: RUN_MESSAGES[code]!, ...(detail ? { details: { detail } } : {}) } as RunRec["error"];
        db().usage.push({ orgId: org.id, kind: "run", ms: Date.now() - started, at: nowIso() });
        audit({ orgId: org.id, projectId: project.id, actorId: user.id, action: "run.failed", subjectType: "run", subjectId: run.id, data: { boq: boq.name, code } });
        notify(user.id, project, "job.failed", { boq: boq.name, type: "run", jobId: job.id }, `/${org.slug}/projects/${project.id}/boqs/${boq.id}`, { type: "run", id: run.id });
        finishRun();
        throw Object.assign(new Error(RUN_MESSAGES[code]), { code, retryable: true });
      } finally {
        clearInterval(ticker);
        // Not awaited: the run and its job are finished already. The manual-lines patch goes first (it extends the rule set).
        const previous = cleanup;
        cleanup = (async () => {
          await previous;
          for (const [folder, id] of saved.reverse()) await engine().deletePreset(folder, id).catch(() => {});
        })();
      }
    },
    (finished) => {
      if (finished.status === "cancelled" && (run.status === "queued" || run.status === "running")) {
        run.status = "cancelled";
        finishRun();
      }
    },
  );
  return job;
}

// ───────────────────────────── handlers ─────────────────────────────

export const boqHandlers: Handlers = {
  listBoqs({ user, params }) {
    const { project } = visibleProject(user!, params.projectId!);
    return json(
      db()
        .boqs.filter((b) => b.projectId === project.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((b) => boqView(b, user!.id)),
    );
  },

  createBoq({ user, params, body }) {
    const { project } = writableProject(user!, params.projectId!, "editBoqs");
    const b = body as { name: string; description?: string; inputs?: InputsPatch };
    if (!b.name.trim()) throw new HttpError(400, "invalid_body", "The name can't be empty.");
    const inputs = mergeInputs(defaultInputs(project), b.inputs ?? {});
    validateInputs(project, inputs);
    checkModelLimit(project, inputs.models.length);
    const at = nowIso();
    const boqId = newId();
    const revision: RevisionRec = { id: newId(), boqId, number: 1, status: "draft", inputs, currentRunId: null, basedOnRevisionId: null, createdAt: at };
    const boq: BoqRec = {
      id: boqId,
      projectId: project.id,
      name: b.name.trim(),
      ...(b.description?.trim() ? { description: b.description.trim() } : {}),
      status: "working",
      currentRevisionId: revision.id,
      latestIssuedRevisionId: null,
      archived: false,
      createdBy: user!.id,
      createdAt: at,
      updatedAt: at,
    };
    db().boqs.push(boq);
    db().revisions.push(revision);
    persist();
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "boq.created", subjectType: "boq", subjectId: boq.id, data: { name: boq.name, models: inputs.models.length } });
    changed(project.id, "boq", boq.id, "created");
    return json(boqView(boq, user!.id), 201);
  },

  getBoq({ user, params }) {
    return json(boqView(boqOf(user!, params.boqId!).boq, user!.id));
  },

  updateBoq({ user, params, body }) {
    const b = body as { name?: string; description?: string; archived?: boolean };
    // Restoring an archived BoQ is the lead's, like archiving (F04 §6).
    const { boq, project } = boqOf(user!, params.boqId!, b.archived === false ? "archive" : "editBoqs");
    if (b.archived === true) throw new HttpError(400, "invalid_body", "Archive with POST /boqs/{boqId}/archive.");
    if (b.archived !== false && (b.name !== undefined || b.description !== undefined)) {
      const blocked = writeBlock(boq);
      if (blocked) throw blocked;
    }
    if (b.name !== undefined) {
      if (!b.name.trim()) throw new HttpError(400, "invalid_body", "The name can't be empty.");
      boq.name = b.name.trim();
    }
    if (b.description !== undefined) boq.description = b.description.trim() || undefined;
    if (b.archived === false && boq.archived) {
      boq.archived = false;
      audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "boq.restored", subjectType: "boq", subjectId: boq.id, data: { name: boq.name } });
    }
    if (b.name !== undefined || b.description !== undefined)
      audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "boq.updated", subjectType: "boq", subjectId: boq.id, data: { fields: Object.keys(b).filter((k) => k !== "archived") } });
    boq.updatedAt = nowIso();
    persist();
    changed(project.id, "boq", boq.id, "updated");
    return json(boqView(boq, user!.id));
  },

  archiveBoq({ user, params }) {
    const { boq, project } = boqOf(user!, params.boqId!, "archive");
    if (!boq.archived) {
      boq.archived = true;
      boq.updatedAt = nowIso();
      persist();
      audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "boq.archived", subjectType: "boq", subjectId: boq.id, data: { name: boq.name } });
      changed(project.id, "boq", boq.id, "updated");
    }
    return json(boqView(boq, user!.id));
  },

  listRevisions({ user, params }) {
    const { boq } = boqOf(user!, params.boqId!);
    return json(
      db()
        .revisions.filter((r) => r.boqId === boq.id)
        .sort((a, b) => b.number - a.number)
        .map((r) => revisionView(r, user!.id)),
    );
  },

  getRevision({ user, params }) {
    return json(revisionView(revisionOf(user!, params.revisionId!).revision, user!.id));
  },

  updateRevisionInputs({ user, params, body }) {
    const { revision, boq, project } = revisionOf(user!, params.revisionId!, "editBoqs");
    const blocked = writeBlock(boq, revision);
    if (blocked) throw blocked;
    const patch = (body as { inputs: InputsPatch }).inputs;
    const next = mergeInputs(revision.inputs, patch);
    validateInputs(project, next);
    if (patch.models) checkModelLimit(project, next.models.length);
    revision.inputs = next;
    boq.updatedAt = nowIso();
    persist();
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "revision.inputs_changed", subjectType: "revision", subjectId: revision.id, data: { boq: boq.name, fields: Object.keys(patch) } });
    changed(project.id, "revision", revision.id, "updated");
    changed(project.id, "boq", boq.id, "updated");
    return json(revisionView(revision, user!.id));
  },

  listRuns({ user, params }) {
    const { revision } = revisionOf(user!, params.revisionId!);
    return json(
      db()
        .runs.filter((r) => r.revisionId === revision.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .map(runView),
    );
  },

  generateRun({ user, params }) {
    const { revision, boq, project } = revisionOf(user!, params.revisionId!, "editBoqs");
    const blocked = writeBlock(boq, revision);
    if (blocked) throw blocked;
    const inputs = revision.inputs;
    if (!inputs.models.length) throw conflict("no_models", "Choose at least one model for this BoQ.");
    if (!inputs.ruleSetVersionId) throw conflict("no_rule_set", "Choose a rule set for this BoQ.");
    for (const m of inputs.models) {
      const v = db().modelVersions.find((x) => x.id === m.modelVersionId);
      if (!v || v.status !== "ready" || !v.engineModelId) throw conflict("model_not_ready", "A chosen model version is not ready.", { modelId: m.modelId, modelVersionId: m.modelVersionId });
    }
    checkModelLimit(project, inputs.models.length);
    const org = db().orgs.find((o) => o.id === project.orgId)!;
    const maxMinutes = planLimits(org).processingMinutesPerMonth;
    const used = minutesUsed(org.id);
    if (maxMinutes !== undefined && used >= maxMinutes) throw limitReached("processingMinutesPerMonth", Math.ceil(used), maxMinutes);
    const run: RunRec = {
      id: newId(),
      revisionId: revision.id,
      jobId: "",
      status: "queued",
      request: { inputs: structuredClone(inputs), projectDictionaryVersionId: projectDictionaryVersionId(project), decisions: decisionsSnapshot(project.id), adjustments: adjustmentsOf(boq.id) },
      createdBy: user!.id,
      createdAt: nowIso(),
    };
    db().runs.push(run);
    const job = startRun(run, revision, boq, project, user!);
    persist();
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "run.created", subjectType: "run", subjectId: run.id, data: { boq: boq.name, revision: revisionLabel(revision.number) } });
    changed(project.id, "run", run.id, "created");
    return json({ run: runView(run), job: jobView(job) }, 202);
  },

  getRun({ user, params }) {
    return json(runView(runOf(user!, params.runId!).run));
  },

  getRunResult({ user, params }) {
    const { run } = runOf(user!, params.runId!);
    if (!run.resultKey) throw notFound("run result");
    return new Response(null, { status: 302, headers: { Location: signedUrl(run.resultKey, "GET", 300).url } });
  },
};
