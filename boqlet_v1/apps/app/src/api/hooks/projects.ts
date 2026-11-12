"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

export function useProjects(orgId: string, filters: { status?: "active" | "archived"; q?: string } = {}) {
  return useQuery({
    queryKey: [...keys.projects(orgId), filters],
    queryFn: async () => (await api.GET("/orgs/{orgId}/projects", { params: { path: { orgId }, query: filters } })).data!,
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: keys.project(projectId),
    queryFn: async () => (await api.GET("/projects/{projectId}", { params: { path: { projectId } } })).data!,
  });
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: ["projectMembers", projectId],
    queryFn: async () => (await api.GET("/projects/{projectId}/members", { params: { path: { projectId } } })).data!,
  });
}

export function useProjectAudit(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["projectAudit", projectId],
    enabled,
    queryFn: async () => (await api.GET("/projects/{projectId}/audit", { params: { path: { projectId } } })).data!,
  });
}

export function useAttention(orgId: string) {
  return useQuery({
    queryKey: ["attention", orgId],
    queryFn: async () => (await api.GET("/orgs/{orgId}/attention", { params: { path: { orgId } } })).data!,
  });
}
