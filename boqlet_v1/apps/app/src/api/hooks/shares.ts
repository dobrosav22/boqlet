"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";

export type ShareLink = Schemas["ShareLink"];
export type ShareInclude = Schemas["ShareInclude"];
export type PublicShare = Schemas["PublicShare"];

/** F18 §3: a BoQ's links. */
export function useShareLinks(boqId: string, enabled = true) {
  return useQuery({
    queryKey: ["shareLinks", boqId],
    enabled,
    queryFn: async () => (await api.GET("/boqs/{boqId}/share-links", { params: { path: { boqId } } })).data!,
  });
}

/** Org settings › Share links (owners and admins). */
export function useOrgShareLinks(orgId: string) {
  return useQuery({
    queryKey: ["shareLinks", "org", orgId],
    queryFn: async () => (await api.GET("/orgs/{orgId}/share-links", { params: { path: { orgId } } })).data!,
  });
}

function useShareMutation<T, R>(fn: (input: T) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    meta: { ownConflicts: true },
    onSuccess: () => client.invalidateQueries({ queryKey: ["shareLinks"] }),
    onError: () => {},
  });
}

export function useCreateShareLink(boqId: string) {
  return useShareMutation(async (body: Schemas["ShareLinkCreate"]) => (await api.POST("/boqs/{boqId}/share-links", { params: { path: { boqId } }, body })).data!);
}

export function useUpdateShareLink() {
  return useShareMutation(async ({ id, ...body }: { id: string; include?: ShareInclude; expiresAt?: string | null; label?: string }) =>
    (await api.PATCH("/share-links/{shareLinkId}", { params: { path: { shareLinkId: id } }, body })).data!,
  );
}

export function useRevokeShareLink() {
  return useShareMutation(async (id: string) => api.DELETE("/share-links/{shareLinkId}", { params: { path: { shareLinkId: id } } }));
}

// ───────────── public (no account) ─────────────

export function usePublicShare(token: string) {
  return useQuery({
    queryKey: ["publicShare", token],
    retry: false,
    // A missing link is a state of this page, not the not-found route.
    throwOnError: false,
    queryFn: async () => (await api.GET("/public/shares/{token}", { params: { path: { token } } })).data!,
  });
}

export function usePublicLines(token: string, enabled: boolean) {
  return useQuery({
    queryKey: ["publicLines", token],
    enabled,
    retry: false,
    throwOnError: false,
    queryFn: async () => (await api.GET("/public/shares/{token}/lines", { params: { path: { token } } })).data!.items,
  });
}

export function usePublicLine(token: string, key: string | null) {
  return useQuery({
    queryKey: ["publicLine", token, key],
    enabled: !!key,
    retry: false,
    throwOnError: false,
    queryFn: async () => (await api.GET("/public/shares/{token}/lines/by-key", { params: { path: { token }, query: { key: key! } } })).data!,
  });
}

/** The share's Excel: a 302 to a short-lived signed URL, followed by the client. */
export async function publicExport(token: string): Promise<Blob> {
  return (await api.GET("/public/shares/{token}/export", { params: { path: { token } }, parseAs: "blob" })).data as unknown as Blob;
}
