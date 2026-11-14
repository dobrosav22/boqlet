import type { QueryKey } from "@tanstack/react-query";
import { keys } from "@/api/keys";

/**
 * Realtime events → the queries to refetch (architecture.md, data layer rule 4; payloads in
 * 04-architecture/storage-jobs-realtime.md). Events are hints: correctness never depends on them.
 * Query keys are prefixes, so `["projects"]` refetches every projects list.
 */
export interface RealtimeEvent {
  event: string;
  data: Record<string, unknown>;
}

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

/** Lists an entity appears in, by entity type (its parent's key, or every list of that kind). */
const LISTS: Record<string, (projectId?: string) => QueryKey[]> = {
  // A plan change (checkout, F14) arrives as a changed org.
  org: () => [keys.me(), keys.orgs(), ["entitlements"], ["billing"]],
  membership: () => [keys.me(), ["members"]],
  user: () => [keys.me(), ["members"]],
  project: () => [["projects"]],
  model: (p) => [p ? keys.models(p) : ["models"], ["modelVersions"]],
  // "Needs you" (F02 §5) follows reviews, runs, BoQs and new model versions.
  modelVersion: (p) => [p ? keys.models(p) : ["models"], ["modelVersions"], ["model"], ["attention"]],
  boq: (p) => [p ? keys.boqs(p) : ["boqs"], ["revisions"], ["attention"]],
  revision: () => [["boq"], ["revisions"], ["revisionExports"], ["attention"]],
  run: () => [["runs"], ["attention"]],
  // Decisions belong to the project: its decisions, and every run's questions (joined with them).
  decision: (p) => [p ? keys.decisions(p) : ["decisions"], ["questions"]],
  // A preset's lists, versions and where it is used. A draft's document is keyed by its ETag, which
  // the refetched preset carries, so published versions (large code lists) are never refetched.
  preset: () => [["presets"], ["terms"], ["presetVersions"], ["presetUsage"]],
  // A BoQ's line edits and manual lines (entityId = the BoQ).
  override: () => [["overrides"]],
  manualItem: () => [["manualItems"]],
  // A BoQ's share links changed (entityId = the BoQ).
  shareLink: () => [["shareLinks"]],
  notification: () => [keys.notifications()],
};

export function invalidationsFor({ event, data }: RealtimeEvent): QueryKey[] {
  const projectId = str(data.projectId);
  switch (event) {
    case "job.finished": {
      const subjectId = str(data.subjectId);
      const out: QueryKey[] = [];
      if (str(data.jobId)) out.push(keys.job(str(data.jobId)!), keys.jobProgress(str(data.jobId)!));
      if (data.type === "parse") {
        if (subjectId) out.push(keys.modelVersion(subjectId));
        out.push(projectId ? keys.models(projectId) : ["models"], ["modelVersions"], ["model"]);
      } else if (data.type === "run") {
        if (subjectId) out.push(keys.run(subjectId));
        out.push(["revision"], ["runs"], ["boq"]);
      } else if (subjectId) {
        out.push([str(data.subjectType) ?? "unknown", subjectId]);
      }
      // A finished export is listed with its version (S12g).
      if (data.type === "export_xlsx") out.push(["revisionExports"]);
      // A failed job, or a run that needs input, is in "Needs you" (F02 §5).
      out.push(["attention"]);
      return out;
    }
    case "entity.changed": {
      const type = str(data.entityType);
      const id = str(data.entityId);
      if (!type) return [];
      const out: QueryKey[] = id ? [[type, id]] : [];
      out.push(...(LISTS[type]?.(projectId) ?? []));
      return out;
    }
    case "notification.created":
      return [keys.notifications(), ["attention"]];
    // A saved edit in a BoQ someone has open (F06 §14): its edits and manual lines.
    case "boq.line_edited": {
      const boqId = str(data.boqId);
      return boqId ? [keys.overrides(boqId), keys.manualItems(boqId)] : [];
    }
    default:
      return [];
  }
}
