"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

export type Question = Schemas["QuestionWithDecision"];
export type Decision = Schemas["Decision"];
export type DecisionInput = Schemas["DecisionInput"];
export type AnswerType = Schemas["AnswerType"];
export type Answer = DecisionInput["answer"];
export type Term = Schemas["TermInfo"];
export type RevisionRef = Schemas["RevisionRef"];

/** A run's questions joined with the project's decisions (F05 §1); they change when anyone answers. */
export function useQuestions(runId: string | undefined) {
  return useQuery({
    queryKey: keys.questions(runId ?? "none"),
    enabled: !!runId,
    queryFn: async () => (await api.GET("/runs/{runId}/questions", { params: { path: { runId: runId! } } })).data!,
  });
}

export function useDecisions(projectId: string) {
  return useQuery({
    queryKey: keys.decisions(projectId),
    queryFn: async () => (await api.GET("/projects/{projectId}/decisions", { params: { path: { projectId } } })).data!,
  });
}

/** Every term the project can use (a few hundred at most): fetched once, searched in the picker. */
export function useTerms(orgId: string, projectId: string) {
  return useQuery({
    queryKey: keys.terms(orgId, projectId),
    staleTime: 5 * 60_000,
    queryFn: async () => (await api.GET("/orgs/{orgId}/terms", { params: { path: { orgId }, query: { projectId } } })).data!,
  });
}

/** What changes when decisions change: the questions, the decisions, every BoQ's pending changes, the project dictionary. */
function useRefreshAfterDecisions(projectId: string) {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["questions"] }),
      client.invalidateQueries({ queryKey: keys.decisions(projectId) }),
      client.invalidateQueries({ queryKey: ["boq"] }),
      client.invalidateQueries({ queryKey: keys.boqs(projectId) }),
      client.invalidateQueries({ queryKey: ["presets"] }),
      client.invalidateQueries({ queryKey: ["terms"] }),
    ]);
}

export interface AnswerRequest {
  decisions: DecisionInput[];
  addToProjectDictionary?: boolean;
}

/** BR-23: the revisions a change would move back to draft (`?dryRun=true`, nothing is saved). */
export async function reopenedBy(projectId: string, request: AnswerRequest): Promise<RevisionRef[]> {
  const { data } = await api.POST("/projects/{projectId}/decisions", { params: { path: { projectId }, query: { dryRun: true } }, body: request });
  return data!.reopenedRevisions;
}

export function useAnswer(projectId: string) {
  const refresh = useRefreshAfterDecisions(projectId);
  return useMutation({
    mutationFn: async (request: AnswerRequest) => (await api.POST("/projects/{projectId}/decisions", { params: { path: { projectId } }, body: request })).data!,
    onSuccess: refresh,
    onError: () => {},
  });
}

export function useClearDecision(projectId: string) {
  const refresh = useRefreshAfterDecisions(projectId);
  return useMutation({
    mutationFn: async (decisionId: string) => api.DELETE("/decisions/{decisionId}", { params: { path: { decisionId } } }),
    onSuccess: refresh,
    onError: () => {},
  });
}

/** F05 §6: each decision into the chosen org dictionary (one request per decision). */
export function usePromote(projectId: string) {
  const refresh = useRefreshAfterDecisions(projectId);
  return useMutation({
    mutationFn: async ({ decisionIds, dictionaryPresetId }: { decisionIds: string[]; dictionaryPresetId: string }) => {
      for (const decisionId of decisionIds) await api.POST("/decisions/{decisionId}/promote", { params: { path: { decisionId } }, body: { dictionaryPresetId } });
    },
    onSuccess: refresh,
    onError: () => {},
  });
}
