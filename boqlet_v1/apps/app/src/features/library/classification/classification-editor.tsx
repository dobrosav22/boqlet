"use client";

/**
 * Classification editor (F10 §3, the PoC's `ClassificationEditor.tsx`): the code list (a tree of
 * codes) and the map that gives BoQ lines their codes. Classification only labels lines; nothing
 * here changes a number (BR-02).
 *
 * Three tabs, like the rule-set editor:
 *   Codes per line  one code per BoQ item (class-table.tsx), with what else decides each row's code
 *   Code list       the codes, about the list (publisher, licence, levels), import (code-import.tsx)
 *   Advanced        rules by condition, where codes come from and what happens when none fits, JSON
 * Above them, the classification in a few sentences (class-story.tsx).
 */
import { useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { RuleSet } from "@ifc-boq/types";
import { api } from "@/api/client";
import { useLibraryPresets, usePresetVersion } from "@/api/hooks/library";
import { keys } from "@/api/keys";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { useOrg } from "@/features/orgs/org-context";
import type { EditorProps } from "../preset-editor";
import type { ClassificationDoc } from "../shared/doc";
import { JsonTab } from "../shared/json-tab";
import { usePreviewResult } from "../preview/preview-context";
import { Options } from "../shared/fields";
import { ClassStory, type JumpTarget } from "./class-story";
import { ClassTable, type Term } from "./class-table";
import { CodesTab } from "./code-list";
import { firstLineByItem, sampleLines } from "./item-text";
import { MapSettings } from "./map-settings";
import { MapTab } from "./map-rules";
import { codeUsage, lineKinds, readTable } from "./model";
import { CodesContext, Tabs } from "./nav";

type Tab = "table" | "codes" | "advanced";
type AdvancedTab = "rules" | "settings" | "json";

/** The rule set whose items the table lists by default: the master template, as in the PoC. */
const MASTER_NAME = "As modelled (master template)";
const MASTER_SLUG = "as-modelled";

/**
 * Dictionary terms for splits by material or element type. Fetched here because `useTerms`
 * (api/hooks/decisions.ts) needs a project, and a Library preset may have none.
 */
function useLibraryTerms(orgId: string, projectId: string | undefined) {
  return useQuery({
    queryKey: keys.terms(orgId, projectId),
    staleTime: 5 * 60_000,
    queryFn: async () => (await api.GET("/orgs/{orgId}/terms", { params: { path: { orgId }, query: projectId ? { projectId } : {} } })).data!,
  });
}

export function ClassificationEditor({ preset, doc, onChange }: EditorProps<ClassificationDoc>) {
  const t = useTranslations("classificationEditor");
  const message = useErrorMessage();
  const { org } = useOrg();
  // an empty code list has nothing to map yet: start where the codes come in
  const [tab, setTab] = useState<Tab>(doc.codeList.codes.length ? "table" : "codes");
  const [advanced, setAdvanced] = useState<AdvancedTab>("rules");
  /** Map rule to select when the rules list opens (from a "rule …" link under a table row). */
  const [focus, setFocus] = useState<number | null>(null);
  const { codeList, map } = doc;
  const setMap = (m: ClassificationDoc["map"]) => onChange({ ...doc, map: m });
  const titles = useMemo(() => new Map(codeList.codes.map((c) => [c.code, c.title])), [codeList]);
  const usage = useMemo(() => codeUsage(map), [map]);
  const { used: table } = useMemo(() => readTable(map), [map]);
  const texts = useMemo(() => new Map(codeList.codes.flatMap((c) => (c.description ? [[c.code, c.description] as const] : []))), [codeList]);
  const listId = useId();
  const codes = useMemo(() => ({ titles, texts, listId }), [titles, texts, listId]);

  // the BoQ items whose lines get codes: the table's rows, and names for rules aimed at items
  const projectId = preset.projectId ?? undefined;
  const presets = useLibraryPresets(org.id, projectId, { kind: "rule_set" });
  const ruleSets = useMemo(() => (presets.data ?? []).filter((p) => !p.archived), [presets.data]);
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const rsId = picked ?? (ruleSets.find((p) => p.name === MASTER_NAME) ?? ruleSets.find((p) => p.slug === MASTER_SLUG) ?? ruleSets[0])?.id;
  const chosen = ruleSets.find((p) => p.id === rsId);
  const version = usePresetVersion(chosen?.latestPublishedVersion?.id);
  const rs = version.data ? ((version.data.flattened ?? version.data.doc) as RuleSet | undefined) : undefined;
  const resolved = rs && Array.isArray(rs.items) ? rs : null;
  const kinds = useMemo(() => (resolved ? lineKinds(resolved) : null), [resolved]);
  const rsError = presets.error
    ? message(presets.error)
    : chosen && !chosen.latestPublishedVersion
      ? t("table.noPublished")
      : version.error
        ? message(version.error)
        : version.data && !resolved
          ? t("table.cannotResolve")
          : null;
  const itemLabel = (id: string) => kinds?.find((k) => k.id === id)?.label ?? id;
  const terms = useLibraryTerms(org.id, projectId);

  // item texts read back with a line of the latest preview (F10 §13), when one has run
  const preview = usePreviewResult();
  const previewLines = preview?.lines;
  const samples = useMemo(() => (previewLines ? sampleLines(map, previewLines, kinds ?? []) : null), [map, previewLines, kinds]);
  const byItem = useMemo(() => (previewLines ? firstLineByItem(previewLines) : null), [previewLines]);

  const openRule = (i: number) => {
    setFocus(i);
    setTab("advanced");
    setAdvanced("rules");
  };
  const jump = (to: JumpTarget) => {
    if (to === "rules" || to === "settings") {
      setTab("advanced");
      setAdvanced(to);
    } else setTab(to);
  };

  return (
    <CodesContext.Provider value={codes}>
      <div className="flex flex-col gap-4" data-testid="classification-editor">
        <Options id={listId} values={[...titles.keys()]} labels={Object.fromEntries(titles)} />
        <ClassStory codeList={codeList} map={map} table={table} kinds={kinds} ruleSetName={chosen?.name} onJump={jump} />
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "table", label: t("tabs.lines"), testId: "class-tab-lines" },
            { id: "codes", label: t("tabs.codes", { n: codeList.codes.length }), testId: "class-tab-codes" },
            { id: "advanced", label: t("tabs.advanced"), testId: "class-tab-advanced" },
          ]}
        />
        <div role="tabpanel" className="min-w-0">
          {tab === "table" && (
            <ClassTable
              codeList={codeList}
              map={map}
              onChange={setMap}
              ruleSets={ruleSets}
              rsId={rsId}
              setRsId={setPicked}
              kinds={kinds}
              rsError={rsError}
              terms={(terms.data ?? []) as Term[]}
              onOpenRule={openRule}
              previewLines={byItem}
            />
          )}
          {tab === "codes" && (
            <CodesTab
              list={codeList}
              onChange={(cl) => onChange({ ...doc, codeList: cl })}
              usage={usage}
              samples={samples}
              itemLabel={itemLabel}
              onRenameId={(v) => onChange({ codeList: { ...codeList, id: v }, map: { ...map, codeList: v } })} />
          )}
          {tab === "advanced" && (
            <div className="flex flex-col gap-4">
              <Tabs<AdvancedTab>
                small
                value={advanced}
                onChange={setAdvanced}
                tabs={[
                  { id: "rules", label: t("advancedTabs.rules", { n: map.rules.length - table.size }), testId: "class-adv-rules" },
                  { id: "settings", label: t("advancedTabs.settings"), testId: "class-adv-settings" },
                  { id: "json", label: t("advancedTabs.json"), testId: "class-adv-json" },
                ]}
              />
              {advanced === "rules" && <MapTab key={focus ?? ""} map={map} onChange={setMap} titles={titles} table={table} initial={focus} kinds={kinds ?? []} itemLabel={itemLabel} onTable={() => setTab("table")} />}
              {advanced === "settings" && <MapSettings doc={doc} onChange={onChange} titles={titles} />}
              {advanced === "json" && <JsonTab value={doc} onChange={onChange} note={t("jsonNote")} />}
            </div>
          )}
        </div>
      </div>
    </CodesContext.Provider>
  );
}
