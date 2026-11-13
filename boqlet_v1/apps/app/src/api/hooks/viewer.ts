"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

export type SceneIndex = Schemas["SceneIndex"];
export type Coverage = Schemas["Coverage"];
export type ElementLines = Schemas["ElementLines"];

/** A model version's scene index and geometry never change (F07 §1). */
const FOREVER = { staleTime: Infinity, gcTime: 10 * 60_000 };

/**
 * Scene index and display geometry (glb bytes) of each model version, loaded in parallel (F07 §8). With
 * `publicToken`, through a share link's public endpoints (F18), no account needed.
 */
export function useModelScenes(versionIds: string[], publicToken?: string) {
  return useQueries({
    queries: versionIds.flatMap((versionId) => [
      {
        queryKey: publicToken ? ["publicScene", publicToken, versionId] : keys.scene(versionId),
        ...FOREVER,
        queryFn: async () =>
          publicToken
            ? ((await api.GET("/public/shares/{token}/scene", { params: { path: { token: publicToken }, query: { versionId } } })).data! as SceneIndex)
            : (await api.GET("/model-versions/{versionId}/scene", { params: { path: { versionId } } })).data!,
      },
      {
        queryKey: publicToken ? ["publicGeometry", publicToken, versionId] : keys.geometry(versionId),
        ...FOREVER,
        // 302 to a signed URL the browser caches; the client follows it and hands back the bytes.
        queryFn: async () =>
          (publicToken
            ? (await api.GET("/public/shares/{token}/geometry/{versionId}", { params: { path: { token: publicToken, versionId } }, parseAs: "arrayBuffer" })).data
            : (await api.GET("/model-versions/{versionId}/geometry", { params: { path: { versionId } }, parseAs: "arrayBuffer" })).data) as unknown as ArrayBuffer,
      },
    ]),
  });
}

export function useCoverage(runId: string | undefined) {
  return useQuery({
    queryKey: keys.coverage(runId ?? "none"),
    enabled: !!runId,
    ...FOREVER,
    queryFn: async () => (await api.GET("/runs/{runId}/coverage", { params: { path: { runId: runId! } } })).data!,
  });
}

/** F07 §4: an element and the lines it feeds, with its share. */
export function useElementLines(runId: string | undefined, guid: string | null) {
  return useQuery({
    queryKey: keys.elementLines(runId ?? "none", guid ?? ""),
    enabled: !!runId && !!guid,
    ...FOREVER,
    queryFn: async () => (await api.GET("/runs/{runId}/elements/{guid}", { params: { path: { runId: runId!, guid: guid! } } })).data!,
  });
}
