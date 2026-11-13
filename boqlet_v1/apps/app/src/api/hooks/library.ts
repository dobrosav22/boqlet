"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

/** F10 Library: presets, versions, usage and the shell's writes (FE-021). */

export type Preset = Schemas["Preset"];
export type PresetKind = Schemas["PresetKind"];
export type PresetLayer = Schemas["PresetLayer"];
export type PresetVersionInfo = Schemas["PresetVersionInfo"];
export type PresetVersion = Schemas["PresetVersion"];
export type PresetCreate = Schemas["PresetCreate"];

export interface PresetFilters {
  kind?: PresetKind;
  layer?: PresetLayer;
  includeArchived?: boolean;
}

/** The Library's list: system plus the org's presets, or a project's own with `projectId`. */
export function useLibraryPresets(orgId: string, projectId: string | undefined, filters: PresetFilters) {
  return useQuery({
    queryKey: [...keys.presets(orgId, projectId), filters],
    queryFn: async () =>
      (
        await api.GET("/orgs/{orgId}/presets", {
          params: { path: { orgId }, query: { ...filters, ...(projectId ? { projectId } : {}) } },
        })
      ).data!,
  });
}

export function usePreset(presetId: string) {
  return useQuery({
    queryKey: keys.preset(presetId),
    queryFn: async () => (await api.GET("/presets/{presetId}", { params: { path: { presetId } } })).data!,
  });
}

export function usePresetVersions(presetId: string | undefined) {
  return useQuery({
    queryKey: keys.presetVersions(presetId ?? "none"),
    enabled: !!presetId,
    queryFn: async () => (await api.GET("/presets/{presetId}/versions", { params: { path: { presetId: presetId! } } })).data!,
  });
}

/**
 * One version with its document. Published versions never change; a draft is keyed by its ETag
 * (from the preset or the versions list), so each save is a new, unchanging entry.
 */
export function usePresetVersion(versionId: string | undefined, etag?: string) {
  return useQuery({
    queryKey: etag ? [...keys.presetVersion(versionId ?? "none"), etag] : keys.presetVersion(versionId ?? "none"),
    enabled: !!versionId,
    staleTime: Infinity,
    queryFn: async () => (await api.GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: versionId! } } })).data!,
  });
}

export function usePresetUsage(presetId: string, enabled = true) {
  return useQuery({
    queryKey: keys.presetUsage(presetId),
    enabled,
    queryFn: async () => (await api.GET("/presets/{presetId}/usage", { params: { path: { presetId } } })).data!,
  });
}

/** Everything a change to one preset can move: lists, the preset, its versions and usage. */
function useRefreshPreset() {
  const client = useQueryClient();
  return async (presetId?: string) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["presets"] }),
      ...(presetId
        ? [
            client.invalidateQueries({ queryKey: keys.preset(presetId) }),
            client.invalidateQueries({ queryKey: keys.presetVersions(presetId) }),
            client.invalidateQueries({ queryKey: keys.presetUsage(presetId) }),
          ]
        : []),
    ]);
  };
}

export function useCreatePreset(orgId: string) {
  const refresh = useRefreshPreset();
  return useMutation({
    mutationFn: async (body: PresetCreate) => (await api.POST("/orgs/{orgId}/presets", { params: { path: { orgId } }, body })).data!,
    onSuccess: async (preset) => refresh(preset.id),
    onError: () => {},
  });
}

export function useUpdatePreset(presetId: string) {
  const refresh = useRefreshPreset();
  return useMutation({
    mutationFn: async (body: { name?: string; description?: string; basedOn?: string; starred?: boolean }) =>
      (await api.PATCH("/presets/{presetId}", { params: { path: { presetId } }, body })).data!,
    onSuccess: async () => refresh(presetId),
    onError: () => {},
  });
}

export function useArchivePreset(presetId: string) {
  const refresh = useRefreshPreset();
  return useMutation({
    mutationFn: async () => (await api.POST("/presets/{presetId}/archive", { params: { path: { presetId } } })).data!,
    onSuccess: async () => refresh(presetId),
  });
}

/** Replaces the draft (or starts one) with a document: "Restore as draft" (F10 §5). */
export function useSaveDraft(presetId: string) {
  const refresh = useRefreshPreset();
  return useMutation({
    mutationFn: async ({ doc, etag }: { doc: unknown; etag?: string }) =>
      (await api.PUT("/presets/{presetId}/draft", { params: { path: { presetId }, ...(etag ? { header: { "If-Match": etag } } : {}) }, body: { doc } })).data!,
    onSuccess: async () => refresh(presetId),
  });
}

export function useDiscardDraft(presetId: string) {
  const refresh = useRefreshPreset();
  return useMutation({
    mutationFn: async () => {
      await api.DELETE("/presets/{presetId}/draft", { params: { path: { presetId } } });
    },
    onSuccess: async () => refresh(presetId),
  });
}
