"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

export function useModels(projectId: string) {
  return useQuery({
    queryKey: keys.models(projectId),
    queryFn: async () => (await api.GET("/projects/{projectId}/models", { params: { path: { projectId } } })).data!,
  });
}

export function useModel(modelId: string) {
  return useQuery({
    queryKey: keys.model(modelId),
    queryFn: async () => (await api.GET("/models/{modelId}", { params: { path: { modelId } } })).data!,
  });
}

export function useModelVersions(modelId: string) {
  return useQuery({
    queryKey: keys.modelVersions(modelId),
    queryFn: async () => (await api.GET("/models/{modelId}/versions", { params: { path: { modelId } } })).data!,
  });
}

export function useModelVersion(versionId: string) {
  return useQuery({
    queryKey: keys.modelVersion(versionId),
    queryFn: async () => (await api.GET("/model-versions/{versionId}", { params: { path: { versionId } } })).data!,
    // A ready version never changes again (architecture.md, data layer rule 3).
    staleTime: (q) => (q.state.data?.status === "ready" ? Infinity : 30_000),
  });
}

/** Live progress of a job: the last `job.progress` event, or what `GET /jobs/{id}` says. */
export function useJobProgress(jobId: string | null | undefined) {
  return useQuery({
    queryKey: keys.jobProgress(jobId ?? "none"),
    enabled: !!jobId,
    queryFn: async () => {
      const job = (await api.GET("/jobs/{jobId}", { params: { path: { jobId: jobId! } } })).data!;
      return { stage: job.progress?.stage, pct: job.progress?.pct ?? 0, status: job.status };
    },
  });
}

export function useNames(versionId: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.names(versionId),
    enabled,
    queryFn: async () => (await api.POST("/model-versions/{versionId}/names", { params: { path: { versionId } }, body: {} })).data!,
  });
}

export function usePlans() {
  return useQuery({
    queryKey: keys.plans(),
    staleTime: Infinity,
    queryFn: async () => (await api.GET("/plans")).data!,
  });
}
