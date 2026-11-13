"use client";

import { useQuery } from "@tanstack/react-query";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

export type RunDiff = Schemas["RunDiff"];
export type LineChange = Schemas["LineChange"];
export type ElementChange = Schemas["ElementChange"];

const POLL_MS = 150;
const TIMEOUT_MS = 120_000;

/**
 * F08 §3: the change report of `toRunId` against `fromRunId`. `POST /runs/{to}/compare` answers the
 * cached diff (200) or starts a `diff` job (202); then the job is asked until it names its diff. A diff
 * never changes, so it is cached for the session.
 */
export function useDiff(toRunId: string | undefined, fromRunId: string | undefined) {
  return useQuery({
    queryKey: keys.diff(toRunId ?? "none", fromRunId ?? "none"),
    enabled: !!toRunId && !!fromRunId && toRunId !== fromRunId,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const res = await api.POST("/runs/{runId}/compare", { params: { path: { runId: toRunId! } }, body: { againstRunId: fromRunId! } });
      if (res.response.status === 200) return res.data as RunDiff;
      let job = res.data as unknown as Schemas["Job"];
      const deadline = Date.now() + TIMEOUT_MS;
      while (job.status === "queued" || job.status === "running") {
        if (Date.now() > deadline) throw new Error("comparison timed out");
        await new Promise((r) => setTimeout(r, POLL_MS));
        job = (await api.GET("/jobs/{jobId}", { params: { path: { jobId: job.id } } })).data!;
      }
      const diffId = (job.output as { diffId?: string } | undefined)?.diffId;
      if (job.status !== "succeeded" || !diffId) throw Object.assign(new Error(job.error?.message ?? "comparison failed"), { code: job.error?.code });
      return (await api.GET("/diffs/{diffId}", { params: { path: { diffId } } })).data!;
    },
  });
}

/** Every line change of a diff (paged; filtering happens in the browser, the report is small). */
export function useDiffLines(diffId: string | undefined) {
  return useQuery({
    queryKey: keys.diffLines(diffId ?? "none"),
    enabled: !!diffId,
    staleTime: Infinity,
    queryFn: async () => {
      const items: LineChange[] = [];
      let cursor: string | undefined;
      do {
        const page = (await api.GET("/diffs/{diffId}/lines", { params: { path: { diffId: diffId! }, query: { limit: 1000, ...(cursor ? { cursor } : {}) } } })).data!;
        items.push(...page.items);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      return items;
    },
  });
}

export function useDiffElements(diffId: string | undefined) {
  return useQuery({
    queryKey: keys.diffElements(diffId ?? "none"),
    enabled: !!diffId,
    staleTime: Infinity,
    queryFn: async () => {
      const items: ElementChange[] = [];
      let cursor: string | undefined;
      do {
        const page = (await api.GET("/diffs/{diffId}/elements", { params: { path: { diffId: diffId! }, query: { limit: 1000, ...(cursor ? { cursor } : {}) } } })).data!;
        items.push(...page.items);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      return items;
    },
  });
}

/** The BoQ's working version and saved versions (F09 §3), for choosing what to compare with. */
export function useRevisions(boqId: string) {
  return useQuery({
    queryKey: keys.revisions(boqId),
    queryFn: async () => (await api.GET("/boqs/{boqId}/revisions", { params: { path: { boqId } } })).data!,
  });
}
