"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import type { Run } from "@/api/hooks/boqs";
import { useTerms } from "@/api/hooks/decisions";
import { usePresetVersion } from "@/api/hooks/sheet";
import type { AnswerContext } from "./answer-control";

type RuleDoc = { items?: { id: string; label?: string }[] };
type ClassificationDoc = { codeList?: { id?: string; codes?: { code: string; title: string }[] } | null };

/**
 * What a run's answer controls choose from: the project's terms, the rule set's items (for
 * `unmatched`) and the attached code lists (for `unclassified`), all from published, immutable
 * versions the run names.
 */
export function useAnswerContext(orgId: string, projectId: string, run: Run | undefined): AnswerContext & { loading: boolean } {
  const terms = useTerms(orgId, projectId);
  const ruleSet = usePresetVersion(run?.snapshotVersions?.ruleSetVersionId);
  const classificationIds = run?.snapshotVersions?.classificationVersionIds ?? [];
  const classifications = useQueries({
    queries: classificationIds.map((id) => ({
      queryKey: keys.presetVersion(id),
      staleTime: Infinity,
      queryFn: async () => (await api.GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: id } } })).data!,
    })),
  });
  const ruleItems = ((ruleSet.data?.flattened ?? ruleSet.data?.doc) as RuleDoc | undefined)?.items;
  const codesKey = classifications.map((c) => c.dataUpdatedAt).join(",");
  const codes = useMemo(() => {
    const map = new Map<string, { code: string; title: string }[]>();
    classifications.forEach((c, i) => {
      const list = (c.data?.doc as ClassificationDoc | undefined)?.codeList;
      if (!list?.codes) return;
      // Shipped code lists run under their own id; others under `mock-<versionId>` (mock-api.md, interim engine path).
      if (list.id) map.set(list.id, list.codes);
      map.set(`mock-${classificationIds[i]}`, list.codes);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codesKey]);
  const rules = useMemo(() => ruleItems?.map((r) => ({ id: r.id, label: r.label ?? r.id })), [ruleItems]);
  return {
    terms: terms.data ?? [],
    ...(rules ? { rules } : {}),
    codes,
    loading: terms.isPending,
  };
}
