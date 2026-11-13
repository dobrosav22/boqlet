"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

/**
 * F09 version actions (FE-031): save, submit, approve, request changes, withdraw, comment, confirm.
 * Each refreshes the BoQ, its versions and runs, and the project's BoQ list; errors stay with the
 * dialog or button that started them (no global toast: `onError` is set).
 */
function useVersionAction<T>(boqId: string, projectId: string, fn: (input: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    meta: { ownConflicts: true },
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: keys.boq(boqId) }),
        client.invalidateQueries({ queryKey: keys.revisions(boqId) }),
        client.invalidateQueries({ queryKey: ["runs"] }),
        client.invalidateQueries({ queryKey: keys.boqs(projectId) }),
      ]),
    onError: () => {},
  });
}

export interface SaveInput {
  label?: string;
  note?: string;
  notModelledConfirmed?: boolean;
}

export function useSaveVersion(revisionId: string, boqId: string, projectId: string) {
  return useVersionAction(boqId, projectId, async (body: SaveInput) => (await api.POST("/revisions/{revisionId}/issue", { params: { path: { revisionId } }, body })).data!);
}

export function useSubmitForReview(revisionId: string, boqId: string, projectId: string) {
  return useVersionAction(boqId, projectId, async (body: { reviewerIds: string[]; message?: string; notModelledConfirmed: true }) =>
    (await api.POST("/revisions/{revisionId}/submit", { params: { path: { revisionId } }, body })).data!,
  );
}

export function useApprove(revisionId: string, boqId: string, projectId: string) {
  return useVersionAction(boqId, projectId, async (comment?: string) => (await api.POST("/revisions/{revisionId}/approve", { params: { path: { revisionId } }, body: comment ? { comment } : {} })).data!);
}

export function useRequestChanges(revisionId: string, boqId: string, projectId: string) {
  return useVersionAction(boqId, projectId, async (comment: string) => (await api.POST("/revisions/{revisionId}/request-changes", { params: { path: { revisionId } }, body: { comment } })).data!);
}

export function useWithdrawReview(revisionId: string, boqId: string, projectId: string) {
  return useVersionAction(boqId, projectId, async () => (await api.POST("/revisions/{revisionId}/reopen", { params: { path: { revisionId } } })).data!);
}

export function useReviewComment(revisionId: string, boqId: string, projectId: string) {
  return useVersionAction(boqId, projectId, async (body: { text: string; lineKey?: string }) => (await api.POST("/revisions/{revisionId}/comments", { params: { path: { revisionId } }, body })).data!);
}

export function useConfirmBoq(boqId: string, projectId: string) {
  return useVersionAction(boqId, projectId, async (body: SaveInput) => (await api.POST("/boqs/{boqId}/confirm", { params: { path: { boqId } }, body })).data!);
}
