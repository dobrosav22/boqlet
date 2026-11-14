/**
 * A suspended org (F19, data-model.md "Org.status") is read-only and starts no jobs: every write to
 * something of the org answers `409 org_suspended`. The router asks before each handler, from the
 * operation's path parameters; reads, the admin console and the person's own things (me, sessions,
 * notifications) are never refused.
 */
import { conflict } from "./http.js";
import { db } from "./store.js";

const WRITES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** The org a request's path parameters point into, if any. */
export function orgOfParams(params: Record<string, string>): string | undefined {
  const d = db();
  if (params.orgId) return params.orgId;
  const projectOrg = (projectId?: string) => (projectId ? d.projects.find((p) => p.id === projectId)?.orgId : undefined);
  const boqOrg = (boqId?: string) => projectOrg(d.boqs.find((b) => b.id === boqId)?.projectId);
  const revisionOrg = (revisionId?: string) => boqOrg(d.revisions.find((r) => r.id === revisionId)?.boqId);
  if (params.projectId) return projectOrg(params.projectId);
  if (params.boqId) return boqOrg(params.boqId);
  if (params.revisionId) return revisionOrg(params.revisionId);
  if (params.runId) return revisionOrg(d.runs.find((r) => r.id === params.runId)?.revisionId);
  if (params.modelId) return projectOrg(d.models.find((m) => m.id === params.modelId)?.projectId);
  if (params.versionId) {
    const v = d.modelVersions.find((x) => x.id === params.versionId);
    return projectOrg(d.models.find((m) => m.id === v?.modelId)?.projectId);
  }
  if (params.presetId) {
    const p = d.presets.find((x) => x.id === params.presetId);
    return p?.orgId ?? projectOrg(p?.projectId ?? undefined);
  }
  if (params.diffId) return d.diffs.find((x) => x.id === params.diffId)?.orgId;
  if (params.exportId) return d.exports.find((x) => x.id === params.exportId)?.orgId;
  if (params.jobId) return d.jobs.find((x) => x.id === params.jobId)?.orgId;
  if (params.shareLinkId) return d.shareLinks.find((x) => x.id === params.shareLinkId)?.orgId;
  if (params.decisionId) return projectOrg(d.decisions.find((x) => x.id === params.decisionId)?.projectId);
  return undefined;
}

export const isSuspended = (orgId: string | undefined) => !!orgId && db().orgs.find((o) => o.id === orgId)?.status === "suspended";

/** Throws `409 org_suspended` for a write into a suspended org. */
export function checkOrgWritable(method: string, tags: string[], params: Record<string, string>) {
  if (!WRITES.has(method) || tags.includes("admin")) return;
  const orgId = orgOfParams(params);
  if (isSuspended(orgId)) throw conflict("org_suspended", "The organisation is suspended and read-only.", { orgId });
}
