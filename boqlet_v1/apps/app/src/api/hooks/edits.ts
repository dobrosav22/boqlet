"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

export type LineOverride = Schemas["LineOverride"];
export type LineOverrideInput = Schemas["LineOverrideInput"];
export type ManualItemRecord = Schemas["ManualItemRecord"];
export type ManualItemInput = Schemas["ManualItemInput"];

/** A BoQ's line edits (F06 §6): shown at once over the run's lines, applied on the next run. */
export function useOverrides(boqId: string) {
  return useQuery({
    queryKey: keys.overrides(boqId),
    queryFn: async () => (await api.GET("/boqs/{boqId}/overrides", { params: { path: { boqId } } })).data!,
  });
}

export function useManualItems(boqId: string) {
  return useQuery({
    queryKey: keys.manualItems(boqId),
    queryFn: async () => (await api.GET("/boqs/{boqId}/manual-items", { params: { path: { boqId } } })).data!,
  });
}

/** Line edits as one change: replaced overrides, restored lines, added manual lines (one request). */
export interface EditBatch {
  overrides?: LineOverrideInput[];
  removeOverrideLineKeys?: string[];
  manualItems?: ManualItemInput[];
}

/**
 * Writes line edits. The overrides list updates optimistically, so an edit shows at once (F06 §6);
 * a refused one rolls back. The BoQ refreshes after (pending changes).
 */
export function useEditLines(boqId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (batch: EditBatch) => (await api.POST("/boqs/{boqId}/overrides/batch", { params: { path: { boqId } }, body: batch })).data!,
    onMutate: async (batch) => {
      await client.cancelQueries({ queryKey: keys.overrides(boqId) });
      const before = client.getQueryData<LineOverride[]>(keys.overrides(boqId));
      if (before) {
        const changed = new Set([...(batch.removeOverrideLineKeys ?? []), ...(batch.overrides ?? []).map((o) => o.lineKey)]);
        const now = new Date().toISOString();
        client.setQueryData<LineOverride[]>(keys.overrides(boqId), [
          ...before.filter((o) => !changed.has(o.lineKey)),
          ...(batch.overrides ?? []).map((o) => ({ ...o, id: before.find((x) => x.lineKey === o.lineKey)?.id ?? `pending:${o.lineKey}`, boqId, createdAt: now })),
        ]);
      }
      return { before };
    },
    onError: (_e, _batch, context) => {
      if (context?.before) client.setQueryData(keys.overrides(boqId), context.before);
    },
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: keys.overrides(boqId) }),
        client.invalidateQueries({ queryKey: keys.manualItems(boqId) }),
        client.invalidateQueries({ queryKey: keys.boq(boqId) }),
      ]),
  });
}

export function useSaveManualItem(boqId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ManualItemInput }) =>
      id
        ? (await api.PATCH("/manual-items/{itemId}", { params: { path: { itemId: id } }, body: input })).data!
        : (await api.POST("/boqs/{boqId}/manual-items", { params: { path: { boqId } }, body: input })).data!,
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: keys.manualItems(boqId) }), client.invalidateQueries({ queryKey: keys.boq(boqId) })]),
    onError: () => {},
  });
}

export function useRemoveManualItem(boqId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.DELETE("/manual-items/{itemId}", { params: { path: { itemId: id } } }),
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: keys.manualItems(boqId) }), client.invalidateQueries({ queryKey: keys.boq(boqId) })]),
    onError: () => {},
  });
}

/** The engine's check of a rule-set patch over the run's rule set (a manual line's formula, F06 §7). */
export async function checkRuleSetPatch(doc: Record<string, unknown>, parentVersionId: string) {
  const { data } = await api.POST("/presets/check", { body: { kind: "rule_set", doc, parentVersionIds: [parentVersionId] } });
  return data!;
}
