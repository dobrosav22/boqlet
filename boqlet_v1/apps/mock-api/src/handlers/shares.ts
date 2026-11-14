/**
 * F18 public share links (FE-036): create, list, edit, revoke (per BoQ and for the whole org), and the
 * public, read-only endpoints under `/public/shares/{token}` (BR-56): `404` for unknown, expired, revoked
 * or suspended tokens, nothing about members, decisions, questions, reviewers, vendors or prices.
 */
import { createHash, randomBytes } from "node:crypto";
import type { BoqLine } from "@ifc-boq/types";
import { audit } from "../audit.js";
import { putBlob, signedUrl } from "../blobs.js";
import { nowIso } from "../clock.js";
import { exportXlsx } from "../engine/fakes/export-xlsx.js";
import { conflict, forbidden, HttpError, notFound } from "../http.js";
import { limitRefused } from "../limits.js";
import { newId } from "../ids.js";
import { roleIn } from "../permissions.js";
import { projectPermissions, projectRoleOf, visibleProject } from "../projects.js";
import { json, noContent, type Handlers } from "../router.js";
import { db, persist, type BoqRec, type RevisionRec, type RunRec, type ShareLinkRec, type UserRec } from "../store.js";
import { changed, labelOf, userRef } from "./boqs.js";
import { runResult } from "./lines.js";
import { planLimits } from "./orgs.js";
import { geometryUrl, sceneOf } from "./viewer.js";

const APP_URL = () => process.env.APP_URL ?? "http://localhost:3000";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const DEFAULT_INCLUDE = { lineDetail: true, viewer: true, log: false, excel: false };

// ───────────────────────────── state ─────────────────────────────

/** revoked > suspended (the org turned public links off) > expired > active (F18 §3–4). */
function statusOf(link: ShareLinkRec): "active" | "revoked" | "expired" | "suspended" {
  if (link.revokedAt) return "revoked";
  const org = db().orgs.find((o) => o.id === link.orgId);
  if (!org || db().deletedOrgIds.includes(org.id)) return "revoked";
  if (org.settings?.publicLinksAllowed === false) return "suspended";
  if (link.expiresAt && link.expiresAt <= nowIso()) return "expired";
  return "active";
}

/** The run a link shows now: its pinned run, or the latest saved version's (null: nothing saved yet). */
function shownRun(link: ShareLinkRec): { run: RunRec; revision: RevisionRec } | null {
  if (link.mode === "pinned") {
    const run = db().runs.find((r) => r.id === link.runId);
    if (!run) return null;
    // The pinned run's version may have been saved since: the link is labelled with the saved one (F18 edge cases).
    const saved = db().revisions.find((r) => r.status === "issued" && r.frozen?.runId === run.id);
    return { run, revision: saved ?? db().revisions.find((r) => r.id === run.revisionId)! };
  }
  const boq = db().boqs.find((b) => b.id === link.boqId)!;
  const saved = boq.latestIssuedRevisionId ? db().revisions.find((r) => r.id === boq.latestIssuedRevisionId) : undefined;
  const run = saved?.frozen ? db().runs.find((r) => r.id === saved.frozen!.runId) : undefined;
  return saved && run ? { run, revision: saved } : null;
}

function linkView(link: ShareLinkRec, userId?: string) {
  const boq = db().boqs.find((b) => b.id === link.boqId);
  const project = db().projects.find((p) => p.id === link.projectId);
  const shown = shownRun(link);
  return {
    id: link.id,
    boqId: link.boqId,
    mode: link.mode,
    runId: link.runId,
    include: link.include,
    ...(link.label ? { label: link.label } : {}),
    status: statusOf(link),
    expiresAt: link.expiresAt,
    views: link.views,
    lastViewedAt: link.lastViewedAt,
    createdBy: userRef(link.createdBy),
    createdAt: link.createdAt,
    projectId: link.projectId,
    ...(project ? { projectName: project.name } : {}),
    ...(boq ? { boqName: boq.name } : {}),
    revisionLabel: shown ? labelOf(shown.revision) : null,
    ...(userId ? { permissions: { edit: mayEdit(link, userId), revoke: mayRevoke(link, userId) } } : {}),
  };
}

// ───────────────────────────── permissions (F18 "Permissions") ─────────────────────────────

const orgAdmin = (orgId: string, userId: string) => ["owner", "admin"].includes(roleIn(orgId, userId) ?? "");

function projectCan(link: { projectId: string }, userId: string, key: "share" | "revokeShares") {
  const project = db().projects.find((p) => p.id === link.projectId);
  if (!project) return false;
  return projectPermissions(project, projectRoleOf(project, userId))[key] === true;
}

function mayEdit(link: ShareLinkRec, userId: string) {
  return projectCan(link, userId, "share");
}

function mayRevoke(link: ShareLinkRec, userId: string) {
  return projectCan(link, userId, "revokeShares") || orgAdmin(link.orgId, userId) || (link.createdBy === userId && projectCan(link, userId, "share"));
}

function boqFor(user: UserRec, boqId: string) {
  const boq = db().boqs.find((b) => b.id === boqId);
  if (!boq) throw notFound("BoQ");
  return { boq, ...visibleProject(user, boq.projectId) };
}

function linkFor(user: UserRec, id: string) {
  const link = db().shareLinks.find((l) => l.id === id);
  if (!link) throw notFound("share link");
  // Visible to the project's members, and to the org's owners and admins (org settings › Share links).
  if (!orgAdmin(link.orgId, user.id)) visibleProject(user, link.projectId);
  return link;
}

function normalizeInclude(boq: BoqRec, include: Partial<ShareLinkRec["include"]> | undefined, base: ShareLinkRec["include"] = DEFAULT_INCLUDE) {
  const next = { ...base, ...(include ?? {}) };
  if (next.groupBy) {
    const revision = db().revisions.find((r) => r.id === boq.currentRevisionId)!;
    if (!revision.inputs.classificationVersionIds.length) delete next.groupBy;
  }
  return next;
}

function checkExpiry(expiresAt: string | null | undefined) {
  if (expiresAt && Number.isNaN(Date.parse(expiresAt))) throw new HttpError(400, "invalid_body", "expiresAt is not a date.", { field: "expiresAt" });
}

// ───────────────────────────── public access ─────────────────────────────

/** The link behind a token, if it may be shown (BR-56: else 404, whatever the reason). */
function publicLink(token: string) {
  const link = db().shareLinks.find((l) => l.tokenHash === hash(token));
  if (!link || statusOf(link) !== "active") throw notFound("share link");
  return link;
}

/** A line as a visitor sees it: no edit history (who, why, what the engine said), no member names. */
function publicLine(line: BoqLine & { overridden?: unknown; excluded?: boolean }, sortIndex: number) {
  const { overridden: _o, ...rest } = line;
  const steps = line.trace.steps?.map((s) => {
    if (s.kind !== "edit" || !s.params) return s;
    const { by: _b, reason: _r, ...params } = s.params as Record<string, unknown>;
    return { ...s, params };
  });
  return { ...rest, trace: { ...line.trace, ...(steps ? { steps } : {}) }, sortIndex };
}

async function shownResult(link: ShareLinkRec) {
  const shown = shownRun(link);
  if (!shown) return null;
  return { ...shown, result: await runResult(shown.run) };
}

export const shareHandlers: Handlers = {
  listShareLinks({ user, params }) {
    const { boq } = boqFor(user!, params.boqId!);
    return json(db().shareLinks.filter((l) => l.boqId === boq.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((l) => linkView(l, user!.id)));
  },

  createShareLink({ user, params, body }) {
    const { boq, project, role } = boqFor(user!, params.boqId!);
    if (!projectPermissions(project, role).share) throw forbidden("lead|estimator|approver");
    const org = db().orgs.find((o) => o.id === project.orgId)!;
    if (planLimits(org).shareLinks === false) throw limitRefused(org.id, "shareLinks", 0, 0);
    if (org.settings?.publicLinksAllowed === false) throw conflict("public_links_off", "Public links are switched off for this organisation.");
    const b = (body ?? {}) as { mode?: "pinned" | "latest_issued"; revisionId?: string; include?: Partial<ShareLinkRec["include"]>; label?: string; expiresAt?: string | null };
    if (b.mode !== "pinned" && b.mode !== "latest_issued") throw new HttpError(400, "invalid_body", "mode is pinned or latest_issued.", { field: "mode" });
    checkExpiry(b.expiresAt);
    let runId: string | null = null;
    if (b.mode === "pinned") {
      const revision = db().revisions.find((r) => r.id === (b.revisionId ?? boq.currentRevisionId) && r.boqId === boq.id);
      if (!revision) throw new HttpError(400, "invalid_body", "That version isn't this BoQ's.", { field: "revisionId" });
      const run = revision.currentRunId ? db().runs.find((r) => r.id === revision.currentRunId) : undefined;
      if (!run?.resultKey) throw conflict("no_run", "Generate the BoQ before sharing this version.");
      runId = run.id;
    }
    const token = randomBytes(32).toString("base64url");
    const at = nowIso();
    const link: ShareLinkRec = {
      id: newId(),
      boqId: boq.id,
      projectId: project.id,
      orgId: project.orgId,
      mode: b.mode,
      runId,
      include: normalizeInclude(boq, b.include),
      ...(b.label?.trim() ? { label: b.label.trim() } : {}),
      tokenHash: hash(token),
      expiresAt: b.expiresAt ?? null,
      views: 0,
      lastViewedAt: null,
      createdBy: user!.id,
      createdAt: at,
    };
    db().shareLinks.push(link);
    persist();
    audit({ orgId: project.orgId, projectId: project.id, actorId: user!.id, action: "share_link.created", subjectType: "shareLink", subjectId: link.id, data: { boq: boq.name, mode: link.mode, label: link.label ?? null } });
    changed(project.id, "shareLink", boq.id, "created");
    return json({ ...linkView(link, user!.id), url: `${APP_URL()}/s/${token}` }, 201);
  },

  updateShareLink({ user, params, body }) {
    const link = linkFor(user!, params.shareLinkId!);
    if (!mayEdit(link, user!.id)) throw forbidden("lead|estimator|approver");
    if (link.revokedAt) throw conflict("invalid_transition", "The link is revoked.");
    const b = (body ?? {}) as { label?: string; include?: Partial<ShareLinkRec["include"]>; expiresAt?: string | null };
    checkExpiry(b.expiresAt);
    const boq = db().boqs.find((x) => x.id === link.boqId)!;
    if (b.include) link.include = normalizeInclude(boq, b.include, link.include);
    if (b.expiresAt !== undefined) link.expiresAt = b.expiresAt;
    if (b.label !== undefined) link.label = b.label.trim() || undefined;
    persist();
    audit({ orgId: link.orgId, projectId: link.projectId, actorId: user!.id, action: "share_link.updated", subjectType: "shareLink", subjectId: link.id, data: { fields: Object.keys(b) } });
    changed(link.projectId, "shareLink", link.boqId, "updated");
    return json(linkView(link, user!.id));
  },

  revokeShareLink({ user, params }) {
    const link = linkFor(user!, params.shareLinkId!);
    if (!mayRevoke(link, user!.id)) throw forbidden("lead|approver|creator");
    if (!link.revokedAt) {
      link.revokedAt = nowIso();
      persist();
      audit({ orgId: link.orgId, projectId: link.projectId, actorId: user!.id, action: "share_link.revoked", subjectType: "shareLink", subjectId: link.id, data: { label: link.label ?? null } });
      changed(link.projectId, "shareLink", link.boqId, "updated");
    }
    return noContent();
  },

  listOrgShareLinks({ user, params }) {
    if (!orgAdmin(params.orgId!, user!.id)) {
      if (!roleIn(params.orgId!, user!.id)) throw notFound("organisation");
      throw forbidden("owner|admin");
    }
    return json(db().shareLinks.filter((l) => l.orgId === params.orgId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((l) => linkView(l, user!.id)));
  },

  // ───────────── public (security: []) ─────────────

  async getPublicShare({ params }) {
    const link = publicLink(params.token!);
    link.views += 1;
    link.lastViewedAt = nowIso();
    persist();
    const org = db().orgs.find((o) => o.id === link.orgId)!;
    const project = db().projects.find((p) => p.id === link.projectId)!;
    const boq = db().boqs.find((b) => b.id === link.boqId)!;
    const shown = shownRun(link);
    return json({
      firmName: org.name,
      projectName: project.name,
      boqName: boq.name,
      revisionLabel: shown ? labelOf(shown.revision) : null,
      revisionStatus: shown ? shown.revision.status : null,
      runAt: shown ? (shown.run.finishedAt ?? shown.run.createdAt) : null,
      include: link.include,
      ...(shown && link.include.viewer ? { modelVersionIds: shown.run.request.inputs.models.map((m) => m.modelVersionId) } : {}),
      systems: shown?.run.classifications ?? [],
      // Free plan's links carry the "Made with" badge (05-plans-and-limits: shareLinks on Free, with badge).
      madeWithBadge: planLimits(org).exportWatermark === true,
    });
  },

  async listPublicShareLines({ params, query }) {
    const link = publicLink(params.token!);
    const shown = await shownResult(link);
    if (!shown) return json({ items: [], total: 0, nextCursor: null });
    const q = String(query.q ?? "").trim().toLowerCase();
    const items = (shown.result.lines as (BoqLine & { excluded?: boolean })[])
      .map((l, i) => publicLine(l, i))
      .filter((l) => !l.excluded)
      .filter((l) => !q || l.description.toLowerCase().includes(q) || Object.values(l.codes).some((c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || (c.text ?? "").toLowerCase().includes(q)));
    const start = query.cursor ? Number.parseInt(String(query.cursor), 10) || 0 : 0;
    const limit = 5000;
    return json({ items: items.slice(start, start + limit), total: items.length, nextCursor: start + limit < items.length ? String(start + limit) : null });
  },

  async getPublicShareLine({ params, query }) {
    const link = publicLink(params.token!);
    if (!link.include.lineDetail) throw notFound("line");
    const shown = await shownResult(link);
    const index = shown ? shown.result.lines.findIndex((l) => l.key === query.key) : -1;
    if (!shown || index < 0) throw notFound("line");
    const line = publicLine(shown.result.lines[index]!, index);
    return json({ ...line, ...(link.include.log ? { log: shown.result.log.filter((e) => e.lineKey === line.key) } : {}) });
  },

  async getPublicShareScene({ params, query }) {
    const link = publicLink(params.token!);
    const shown = shownRun(link);
    if (!link.include.viewer || !shown) throw notFound("scene");
    const ids = shown.run.request.inputs.models.map((m) => m.modelVersionId);
    const versionId = query.versionId ? String(query.versionId) : ids[0];
    if (!versionId || !ids.includes(versionId)) throw notFound("scene");
    return json(await sceneOf(db().modelVersions.find((v) => v.id === versionId)!));
  },

  async getPublicShareGeometry({ params }) {
    const link = publicLink(params.token!);
    const shown = shownRun(link);
    if (!link.include.viewer || !shown || !shown.run.request.inputs.models.some((m) => m.modelVersionId === params.versionId)) throw notFound("geometry");
    // Short-lived, issued per request (F18 "Security").
    return new Response(null, { status: 302, headers: { Location: await geometryUrl(db().modelVersions.find((v) => v.id === params.versionId)!, 300) } });
  },

  async getPublicShareExport({ params }) {
    const link = publicLink(params.token!);
    const shown = await shownResult(link);
    if (!link.include.excel || !shown) throw notFound("export");
    // A saved version's file is the one frozen with it (BR-25); otherwise the link's own, written once per run.
    const frozen = shown.revision.status === "issued" ? db().exports.find((e) => e.id === shown.revision.frozen?.exportIds[0]) : undefined;
    let key = frozen?.storageKey ?? link.exportKeys?.[shown.run.id];
    if (!key) {
      const project = db().projects.find((p) => p.id === link.projectId)!;
      const boq = db().boqs.find((b) => b.id === link.boqId)!;
      const systems = shown.run.classifications ?? [];
      const ordered = link.include.groupBy ? [...systems.filter((s) => s.id === link.include.groupBy), ...systems.filter((s) => s.id !== link.include.groupBy)] : systems;
      const working = shown.revision.status !== "issued";
      const bytes = await exportXlsx(shown.result, {
        classifications: ordered,
        modelName: `${project.name} / ${boq.name}, revision ${labelOf(shown.revision)}${working ? " (WORKING)" : ""}`,
        generatedAt: shown.run.finishedAt ?? shown.run.createdAt,
      });
      key = `orgs/${link.orgId}/share-links/${link.id}/${shown.run.id}.xlsx`;
      await putBlob(key, bytes);
      link.exportKeys = { ...(link.exportKeys ?? {}), [shown.run.id]: key };
      persist();
    }
    return new Response(null, { status: 302, headers: { Location: signedUrl(key, "GET", 300).url } });
  },
};
