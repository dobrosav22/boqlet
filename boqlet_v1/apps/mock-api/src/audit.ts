import { nowIso } from "./clock.js";
import { newId } from "./ids.js";
import { db, persist, type AuditRec } from "./store.js";

/** Appends an audit event (testing.md: every new write action is audited). */
export function audit(e: Omit<AuditRec, "id" | "at">): AuditRec {
  const rec: AuditRec = { id: newId(), at: nowIso(), ...e };
  db().audit.push(rec);
  persist();
  return rec;
}

/**
 * The audit page's filters (F09 audit: actor, action, entity, date), newest first, within the plan's
 * retention (`auditLogRetentionDays`, 05-plans-and-limits.md; missing = kept).
 */
export function filterAudit(items: AuditRec[], query: Record<string, unknown>, orgId: string): AuditRec[] {
  const org = db().orgs.find((o) => o.id === orgId);
  const days = org ? (db().plans.find((p) => p.id === org.planId)?.entitlements as { auditLogRetentionDays?: number } | undefined)?.auditLogRetentionDays : undefined;
  const since = days ? new Date(Date.parse(nowIso()) - days * 86_400_000).toISOString() : "";
  return items
    .filter((a) => !since || a.at >= since)
    .filter((a) => !query.actorId || a.actorId === query.actorId)
    .filter((a) => !query.action || a.action === query.action)
    .filter((a) => !query.entityType || a.subjectType === query.entityType)
    .filter((a) => !query.from || a.at >= String(query.from))
    .filter((a) => !query.to || a.at <= String(query.to))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** An event as the contract's `AuditEvent`. */
export function auditView(a: AuditRec) {
  const u = a.actorId ? db().users.find((x) => x.id === a.actorId) : undefined;
  return {
    id: a.id,
    ...(a.actorId ? { actor: { id: a.actorId, name: u?.name ?? "Unknown", ...(u?.email ? { email: u.email } : {}) }, actorKind: "user" as const } : { actorKind: "system" as const }),
    action: a.action,
    entityType: a.subjectType,
    entityId: a.subjectId,
    projectId: a.projectId ?? null,
    data: a.data ?? {},
    at: a.at,
  };
}

/** F12 "Audit CSV": BOM, CRLF, columns at, actor, action, entityType, entityId, project, data (JSON). */
export function auditCsv(items: AuditRec[], fileName: string): Response {
  const cell = (v: unknown) => {
    const t = v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
    return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const project = (id?: string | null) => (id ? (db().projects.find((p) => p.id === id)?.name ?? id) : "");
  const rows: unknown[][] = [
    ["at", "actor", "action", "entityType", "entityId", "project", "data"],
    ...items.map((a) => [a.at, a.actorId ? (db().users.find((u) => u.id === a.actorId)?.name ?? a.actorId) : "system", a.action, a.subjectType, a.subjectId, project(a.projectId), a.data ?? {}]),
  ];
  return new Response("﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n", {
    status: 200,
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${fileName.replace(/[^\w.-]+/g, "-")}"` },
  });
}
