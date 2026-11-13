"use client";

import { useMemo } from "react";
import type { Run } from "@/api/hooks/boqs";
import { useTerms } from "@/api/hooks/decisions";
import { usePresetVersion } from "@/api/hooks/sheet";
import { useCodeLists } from "@/features/boq-sheet/use-code-lists";
import type { AnswerContext } from "./answer-control";

type RuleDoc = { items?: { id: string; label?: string }[] };

/**
 * What a run's answer controls choose from: the project's terms, the rule set's items (for
 * `unmatched`) and the attached code lists (for `unclassified`), all from published, immutable
 * versions the run names.
 */
export function useAnswerContext(orgId: string, projectId: string, run: Run | undefined): AnswerContext & { loading: boolean } {
  const terms = useTerms(orgId, projectId);
  const ruleSet = usePresetVersion(run?.snapshotVersions?.ruleSetVersionId);
  const lists = useCodeLists(run);
  const ruleItems = ((ruleSet.data?.flattened ?? ruleSet.data?.doc) as RuleDoc | undefined)?.items;
  const codes = useMemo(() => new Map([...lists].map(([system, byCode]) => [system, [...byCode.values()]])), [lists]);
  const rules = useMemo(() => ruleItems?.map((r) => ({ id: r.id, label: r.label ?? r.id })), [ruleItems]);
  return {
    terms: terms.data ?? [],
    ...(rules ? { rules } : {}),
    codes,
    loading: terms.isPending,
  };
}
