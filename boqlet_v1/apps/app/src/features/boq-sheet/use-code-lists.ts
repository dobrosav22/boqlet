"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import type { Run } from "@/api/hooks/boqs";
import type { CodeEntry, CodeLists } from "./edits";

type ClassificationDoc = { codeList?: { id?: string; codes?: CodeEntry[] } | null };

/**
 * The code lists of a run's classifications, by the system id its lines' `codes` use (shipped
 * lists under their own id, others under `mock-<versionId>` on the interim engine path). Published
 * versions never change, so they are fetched once.
 */
export function useCodeLists(run: Run | undefined): CodeLists {
  const ids = run?.snapshotVersions?.classificationVersionIds ?? [];
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: keys.presetVersion(id),
      staleTime: Infinity,
      queryFn: async () => (await api.GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: id } } })).data!,
    })),
  });
  const stamp = results.map((r) => r.dataUpdatedAt).join(",");
  return useMemo(() => {
    const out = new Map<string, Map<string, CodeEntry>>();
    results.forEach((r, i) => {
      const list = (r.data?.doc as ClassificationDoc | undefined)?.codeList;
      if (!list?.codes) return;
      const byCode = new Map(list.codes.map((c) => [c.code, c]));
      if (list.id) out.set(list.id, byCode);
      out.set(`mock-${ids[i]}`, byCode);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);
}
