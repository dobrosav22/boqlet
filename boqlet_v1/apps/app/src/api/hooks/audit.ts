"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";

export type AuditEvent = Schemas["AuditEvent"];

/** The audit page's filters (F09 audit: actor, action, entity, date). Dates are ISO date-times. */
export interface AuditFilters {
  actorId?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
}

export type AuditScope = { kind: "project"; projectId: string } | { kind: "org"; orgId: string };

const clean = (f: AuditFilters) => Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as AuditFilters;

/** S18 / S25: the audit, newest first, 100 at a time. */
export function useAuditPages(scope: AuditScope, filters: AuditFilters) {
  const query = clean(filters);
  return useInfiniteQuery({
    queryKey: [scope.kind === "project" ? "projectAudit" : "orgAudit", scope.kind === "project" ? scope.projectId : scope.orgId, "pages", query],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const q = { limit: 100, ...query, ...(pageParam ? { cursor: pageParam } : {}) };
      return scope.kind === "project"
        ? (await api.GET("/projects/{projectId}/audit", { params: { path: { projectId: scope.projectId }, query: q } })).data!
        : (await api.GET("/orgs/{orgId}/audit", { params: { path: { orgId: scope.orgId }, query: q } })).data!;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** The audit with the same filters as CSV (F12 "Audit CSV", S25). */
export async function auditCsv(scope: AuditScope, filters: AuditFilters): Promise<Blob> {
  const query = clean(filters);
  const { data } =
    scope.kind === "project"
      ? await api.GET("/projects/{projectId}/audit.csv", { params: { path: { projectId: scope.projectId }, query }, parseAs: "blob" })
      : await api.GET("/orgs/{orgId}/audit.csv", { params: { path: { orgId: scope.orgId }, query }, parseAs: "blob" });
  return data as unknown as Blob;
}

/** Who can be filtered for: the project's members, or the org's. */
export function useAuditActors(scope: AuditScope) {
  return useQuery({
    queryKey: ["auditActors", scope.kind, scope.kind === "project" ? scope.projectId : scope.orgId],
    queryFn: async () =>
      scope.kind === "project"
        ? ((await api.GET("/projects/{projectId}/members", { params: { path: { projectId: scope.projectId } } })).data ?? []).map((m) => m.user)
        : ((await api.GET("/orgs/{orgId}/members", { params: { path: { orgId: scope.orgId } } })).data ?? []).map((m) => m.user),
    staleTime: 60_000,
  });
}
