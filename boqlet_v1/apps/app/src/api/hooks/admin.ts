"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

/** The platform admin console (F19, S36). Every `/admin/*` call answers 404 to anyone but a platform admin. */

export type AdminOverview = Schemas["AdminOverview"];
export type AdminFunnel = Schemas["AdminFunnel"];
export type AdminFunnelStep = Schemas["AdminFunnelStep"];
export type AdminOrgRow = Schemas["AdminOrgRow"];
export type AdminOrgDetail = Schemas["AdminOrgDetail"];
export type AdminUserRow = Schemas["AdminUserRow"];

export interface Period {
  from?: string;
  to?: string;
}

export interface AdminOrgFilters {
  plan?: string;
  status?: string;
  country?: string;
  tag?: string;
  signal?: "hit_limit" | "inactive_30d" | "trial_ending_7d" | "stuck_in_setup";
  stuckAt?: AdminFunnelStep;
  q?: string;
  sort?: string;
}

const clean = <T extends object>(f: T) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== "")) as T;

export function useAdminOverview(period: Period) {
  const query = clean(period);
  return useQuery({
    queryKey: keys.adminOverview(query),
    queryFn: async () => (await api.GET("/admin/overview", { params: { query } })).data!,
  });
}

export function useAdminFunnel(period: Period) {
  const query = clean(period);
  return useQuery({
    queryKey: keys.adminFunnel(query),
    queryFn: async () => (await api.GET("/admin/funnel", { params: { query } })).data!,
  });
}

/** The orgs table, 100 rows a page. */
export function useAdminOrgs(filters: AdminOrgFilters) {
  const query = clean(filters);
  return useInfiniteQuery({
    queryKey: keys.adminOrgs(query),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => (await api.GET("/admin/orgs", { params: { query: { limit: 100, ...query, ...(pageParam ? { cursor: pageParam } : {}) } } })).data!,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** The orgs table with the same filters as CSV. */
export async function adminOrgsCsv(filters: AdminOrgFilters): Promise<Blob> {
  const { data } = await api.GET("/admin/orgs.csv", { params: { query: clean(filters) }, parseAs: "blob" });
  return data as unknown as Blob;
}

export function useAdminOrg(orgId: string) {
  return useQuery({
    queryKey: keys.adminOrg(orgId),
    queryFn: async () => (await api.GET("/admin/orgs/{orgId}", { params: { path: { orgId } } })).data!,
    // Every view is audited (BR-57): don't refetch on focus.
    refetchOnWindowFocus: false,
  });
}

export function useAdminNotes(orgId: string) {
  return useQuery({
    queryKey: keys.adminNotes(orgId),
    queryFn: async () => (await api.GET("/admin/orgs/{orgId}/notes", { params: { path: { orgId } } })).data!,
  });
}

/** After an action the detail comes back in the answer; the table and the overview are stale. */
function useOrgAction<V>(orgId: string, call: (v: V) => Promise<AdminOrgDetail>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSuccess: (detail) => {
      client.setQueryData(keys.adminOrg(orgId), detail);
      void client.invalidateQueries({ queryKey: ["adminOrgs"] });
      void client.invalidateQueries({ queryKey: ["adminOverview"] });
    },
  });
}

export function useAdminUpdateOrg(orgId: string) {
  return useOrgAction(orgId, async (body: { tags?: string[]; status?: "active" | "suspended"; reason: string }) => (await api.PATCH("/admin/orgs/{orgId}", { params: { path: { orgId } }, body })).data!);
}

export function useAdminSetSubscription(orgId: string) {
  return useOrgAction(orgId, async (body: { planId?: string; trialEndsAt?: string | null; reason: string }) => (await api.PUT("/admin/orgs/{orgId}/subscription", { params: { path: { orgId } }, body })).data!);
}

export function useAdminSetOverrides(orgId: string) {
  return useOrgAction(orgId, async (body: { overrides: Record<string, number | boolean | null>; reason: string }) => (await api.PUT("/admin/orgs/{orgId}/entitlement-overrides", { params: { path: { orgId } }, body })).data!);
}

export function useAdminAddNote(orgId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => (await api.POST("/admin/orgs/{orgId}/notes", { params: { path: { orgId } }, body: { text } })).data!,
    onSuccess: () => client.invalidateQueries({ queryKey: keys.adminNotes(orgId) }),
  });
}

export function useAdminUsers(q: string) {
  return useInfiniteQuery({
    queryKey: keys.adminUsers(q),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => (await api.GET("/admin/users", { params: { query: { limit: 100, ...(q ? { q } : {}), ...(pageParam ? { cursor: pageParam } : {}) } } })).data!,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useAdminEndSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.DELETE("/admin/users/{userId}/session", { params: { path: { userId } } });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["adminUsers"] }),
  });
}

export function useAdminHealth() {
  return useQuery({
    queryKey: keys.adminHealth(),
    queryFn: async () => (await api.GET("/admin/health")).data!,
  });
}

