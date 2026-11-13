/**
 * Jobs in the mock (mock-api.md "Jobs"): executed at once, one at a time per type, progress
 * relayed over SSE (`job.progress`, `job.finished`, conventions.md). A job always ends:
 * succeeded, failed or cancelled (P13).
 */
import { nowIso } from "./clock.js";
import { emit } from "./events.js";
import { newId } from "./ids.js";
import { projectRoleOf } from "./projects.js";
import { db, persist, type JobRec } from "./store.js";

export interface JobContext {
  job: JobRec;
  progress(stage: string, pct: number, message?: string): void;
  cancelled(): boolean;
}

const queues = new Map<string, Promise<void>>();
const cancelRequests = new Set<string>();

/** Users who see a project's events: its members, and the org's owners and admins. */
export function projectAudience(projectId: string): string[] {
  const project = db().projects.find((p) => p.id === projectId);
  if (!project) return [];
  return db()
    .memberships.filter((m) => m.orgId === project.orgId && projectRoleOf(project, m.userId))
    .map((m) => m.userId);
}

const jobEventData = (job: JobRec) => ({
  jobId: job.id,
  type: job.type,
  subjectType: job.subjectType,
  subjectId: job.subjectId,
  projectId: job.projectId,
});

export function createJob(fields: Pick<JobRec, "type" | "subjectType" | "subjectId" | "projectId" | "orgId" | "createdBy">): JobRec {
  const job: JobRec = { id: newId(), status: "queued", createdAt: nowIso(), ...fields };
  db().jobs.push(job);
  persist();
  return job;
}

/**
 * Runs `work` after the jobs of the same queue (by default its type) queued before it. Previews share
 * the runs' queue: both load the engine's user preset folder, which their temporary presets come and go in.
 */
export function runJob(job: JobRec, work: (ctx: JobContext) => Promise<Record<string, unknown> | void>, onEnd?: (job: JobRec) => void, queue: string = job.type) {
  const previous = queues.get(queue) ?? Promise.resolve();
  const next = previous.then(async () => {
    if (cancelRequests.has(job.id) || job.status === "cancelled") return finish(job, "cancelled", undefined, undefined, onEnd);
    job.status = "running";
    job.startedAt = nowIso();
    persist();
    let lastEmit = 0;
    const ctx: JobContext = {
      job,
      progress(stage, pct, message) {
        job.progress = { stage, pct, ...(message ? { message } : {}) };
        // Throttled to about one event per second per job (storage-jobs-realtime.md), but stage changes always go out.
        const now = Date.now();
        if (now - lastEmit > 250 || pct >= 100) {
          lastEmit = now;
          emit("job.progress", { ...jobEventData(job), stage, pct, message }, { userIds: projectAudience(job.projectId) });
        }
      },
      cancelled: () => cancelRequests.has(job.id),
    };
    try {
      const output = await work(ctx);
      if (cancelRequests.has(job.id)) return finish(job, "cancelled", undefined, undefined, onEnd);
      finish(job, "succeeded", output ?? undefined, undefined, onEnd);
    } catch (e) {
      const err = e as { code?: string; message?: string; retryable?: boolean };
      finish(job, "failed", undefined, { code: err.code ?? "internal", message: err.message ?? "The job failed.", retryable: err.retryable ?? false }, onEnd);
    }
  });
  queues.set(queue, next.catch(() => {}));
  return next;
}

function finish(job: JobRec, status: JobRec["status"], output?: Record<string, unknown>, error?: JobRec["error"], onEnd?: (job: JobRec) => void) {
  job.status = status;
  job.finishedAt = nowIso();
  if (output) job.output = output;
  if (error) job.error = error;
  cancelRequests.delete(job.id);
  persist();
  onEnd?.(job);
  emit("job.finished", { ...jobEventData(job), status, ...(error ? { error } : {}) }, { userIds: projectAudience(job.projectId) });
}

export function requestCancel(job: JobRec) {
  if (job.status === "queued" || job.status === "running") cancelRequests.add(job.id);
  if (job.status === "queued") {
    job.status = "cancelled";
    job.finishedAt = nowIso();
    persist();
  }
}

export function jobView(job: JobRec) {
  const { orgId: _o, projectId: _p, createdBy: _c, ...rest } = job;
  return rest;
}
