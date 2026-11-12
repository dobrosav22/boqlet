"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

export type RunLine = Schemas["RunLine"];
export type LineDetail = Schemas["LineDetail"];
export type LogEntry = Schemas["LogPage"]["items"][number];

/** A finished run never changes (architecture.md, data layer rule 3). */
const FOREVER = { staleTime: Infinity, gcTime: 10 * 60_000 };

/** Every line of a run in one request (F06 §1: up to 20,000 lines; grouping is client-side). */
export function useLines(runId: string | undefined) {
  return useQuery({
    queryKey: keys.lines(runId ?? "none"),
    enabled: !!runId,
    ...FOREVER,
    queryFn: async () => {
      const items: RunLine[] = [];
      let cursor: string | undefined;
      do {
        const page = (await api.GET("/runs/{runId}/lines", { params: { path: { runId: runId! }, query: { limit: 20000, ...(cursor ? { cursor } : {}) } } })).data!;
        items.push(...page.items);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      return items;
    },
  });
}

export function useLine(runId: string | undefined, key: string | null) {
  return useQuery({
    queryKey: keys.line(runId ?? "none", key ?? ""),
    enabled: !!runId && !!key,
    ...FOREVER,
    queryFn: async () => (await api.GET("/runs/{runId}/lines/by-key", { params: { path: { runId: runId! }, query: { key: key! } } })).data!,
  });
}

export function useWarnings(runId: string | undefined) {
  return useQuery({
    queryKey: keys.warnings(runId ?? "none"),
    enabled: !!runId,
    ...FOREVER,
    queryFn: async () => (await api.GET("/runs/{runId}/warnings", { params: { path: { runId: runId! } } })).data!,
  });
}

export interface LogFilters {
  stage?: string;
  level?: "info" | "detail" | "warning";
  ruleId?: string;
  lineKey?: string;
  guid?: string;
}

/** The calculation log, paged server-side (F06 §9). */
export function useLog(runId: string | undefined, filters: LogFilters) {
  return useInfiniteQuery({
    queryKey: [...keys.log(runId ?? "none"), filters] as const,
    enabled: !!runId,
    ...FOREVER,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      (await api.GET("/runs/{runId}/log", { params: { path: { runId: runId! }, query: { limit: 200, ...filters, ...(pageParam ? { cursor: pageParam } : {}) } } })).data!,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** A published preset version (immutable): e.g. the rule set a run used, for its slot labels. */
export function usePresetVersion(versionId: string | undefined) {
  return useQuery({
    queryKey: keys.presetVersion(versionId ?? "none"),
    enabled: !!versionId,
    ...FOREVER,
    queryFn: async () => (await api.GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: versionId! } } })).data!,
  });
}
