"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

export type Boq = Schemas["Boq"];
export type Revision = Schemas["BoqRevision"];
export type RevisionInputs = Schemas["RevisionInputs"];
export type Run = Schemas["Run"];
export type Preset = Schemas["Preset"];
export type PresetKind = Schemas["PresetKind"];

export function useBoqs(projectId: string) {
  return useQuery({
    queryKey: keys.boqs(projectId),
    queryFn: async () => (await api.GET("/projects/{projectId}/boqs", { params: { path: { projectId } } })).data!,
  });
}

export function useBoq(boqId: string) {
  return useQuery({
    queryKey: keys.boq(boqId),
    queryFn: async () => (await api.GET("/boqs/{boqId}", { params: { path: { boqId } } })).data!,
  });
}

export function useRuns(revisionId: string | undefined) {
  return useQuery({
    queryKey: keys.runs(revisionId ?? "none"),
    enabled: !!revisionId,
    queryFn: async () => (await api.GET("/revisions/{revisionId}/runs", { params: { path: { revisionId: revisionId! } } })).data!,
  });
}

/** Presets the project may use: system, the org's and the project's own (F04 §2). */
export function usePresets(orgId: string, projectId: string) {
  return useQuery({
    queryKey: keys.presets(orgId, projectId),
    queryFn: async () => (await api.GET("/orgs/{orgId}/presets", { params: { path: { orgId }, query: { projectId } } })).data!,
  });
}

export interface CatalogueEntry {
  preset: Preset;
  version: Schemas["PresetVersionInfo"];
}

/**
 * Every published version of the usable presets, by version id, so a pinned (older) version can
 * be named. One request per preset; there are a handful.
 */
export function usePresetCatalogue(orgId: string, projectId: string) {
  const presets = usePresets(orgId, projectId);
  const list = presets.data ?? [];
  const versions = useQueries({
    queries: list.map((p) => ({
      queryKey: keys.presetVersions(p.id),
      queryFn: async () => (await api.GET("/presets/{presetId}/versions", { params: { path: { presetId: p.id } } })).data!,
      staleTime: 60_000,
    })),
  });
  // A handful of presets: rebuilt on every render, no memo needed.
  const byVersion = new Map<string, CatalogueEntry>();
  list.forEach((preset, i) => {
    for (const version of versions[i]?.data ?? []) if (version.status === "published") byVersion.set(version.id, { preset, version });
    if (preset.latestPublishedVersion && !byVersion.has(preset.latestPublishedVersion.id)) byVersion.set(preset.latestPublishedVersion.id, { preset, version: preset.latestPublishedVersion });
  });
  const versionsOf = (presetId: string) => (versions[list.findIndex((p) => p.id === presetId)]?.data ?? []).filter((v) => v.status === "published");
  return { presets, list, byVersion, versionsOf };
}

/** PATCH /revisions/{id}: changes some inputs; pending changes and the BoQ refresh after. */
export function useUpdateInputs(revisionId: string, boqId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (inputs: Partial<RevisionInputs>) => (await api.PATCH("/revisions/{revisionId}", { params: { path: { revisionId } }, body: { inputs } })).data!,
    // Optimistic: the control shows the change at once; the server's answer (or a rollback) follows.
    onMutate: async (inputs) => {
      const before = client.getQueryData<Boq>(keys.boq(boqId));
      const apply = () => {
        if (!before) return;
        const models = inputs.models?.map((m) => ({ ...m, newerVersionAvailable: before.currentRevision.inputs.models.find((x) => x.modelVersionId === m.modelVersionId)?.newerVersionAvailable ?? null }));
        client.setQueryData<Boq>(keys.boq(boqId), {
          ...before,
          currentRevision: { ...before.currentRevision, inputs: { ...before.currentRevision.inputs, ...inputs, ...(models ? { models } : {}) } },
        });
      };
      // Show the change at once; a refetch in flight is cancelled (so it can't overwrite it), and
      // cancelling reverts the query to its state before that fetch, so the change is applied again.
      apply();
      await client.cancelQueries({ queryKey: keys.boq(boqId) });
      apply();
      return { before };
    },
    onError: (_e, _inputs, context) => {
      if (context?.before) client.setQueryData(keys.boq(boqId), context.before);
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.boq(boqId) }),
  });
}

/** POST /revisions/{id}/runs: a new run; its progress arrives over SSE. */
export function useGenerate(revisionId: string, boqId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.POST("/revisions/{revisionId}/runs", { params: { path: { revisionId } } })).data!,
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: keys.runs(revisionId) }), client.invalidateQueries({ queryKey: keys.boq(boqId) })]);
    },
    onError: () => {},
  });
}
