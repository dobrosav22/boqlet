"use client";

/**
 * Rule set editor (F10 §3, FE-022), ported from the PoC's `RuleSetEditor.tsx`. Works on a standalone
 * RuleSet or a RuleSetPatch.
 *
 * Three tabs, by who needs them:
 *   Settings   the questions a standard answers (questions-tab.tsx)
 *   BoQ items  everything that becomes a BoQ line, in one list: measured from the model (item
 *              rules), calculated from other items (derived rules), entered by hand (manual items)
 *   Advanced   about and defaults, setting up questions (slots), raw JSON
 *
 * For a patch, the parent comes from the host as the engine flattens it, so every slot and rule is
 * marked inherited, changed here, new here or removed here. Saving (autosave with ETag) and the
 * draft's problems are the host's (preset-editor.tsx); this only edits the document.
 */
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { DerivedRule, ItemRule, ManualItem, OurRuleType, RuleSet, RuleSetPatch } from "@ifc-boq/types";
import type { EditorProps } from "../preset-editor";
import { isPatch, put } from "../shared/doc";
import { JsonTab } from "../shared/json-tab";
import { cap } from "../shared/story";
import { DerivedForm, ItemForm, ManualForm } from "./item-forms";
import { useLexicon, useStoryText } from "./item-story";
import { ItemsTab, group, type Group, type GroupKey } from "./items-tab";
import { effectiveSlots, rowsFor, scopeOf, slotUsage, type Entry, type Row } from "./model";
import { TabBar } from "./nav";
import { Overview } from "./overview";
import { QuestionSetup } from "./question-setup";
import { QuestionsTab } from "./questions-tab";

type Tab = "settings" | "items" | "advanced";
type AdvancedTab = "about" | "setup" | "json";

const live = <T,>(rows: Row<T>[]) => rows.filter((r) => r.status !== "removed").map((r) => r.entry);

export function RuleSetEditor({ doc, onChange, parent, question }: EditorProps<OurRuleType>) {
  const t = useTranslations("ruleSetEditor");
  const story = useStoryText();
  /** How many of each kind the model has; there is no model in the Library until preview (FE-025). */
  const counts: Record<string, number> | undefined = undefined;
  const patch = isPatch(doc);
  const [tab, setTab] = useState<Tab>(question || patch || (doc as RuleSet).sections?.length ? "settings" : "items");
  const [advanced, setAdvanced] = useState<AdvancedTab>("about");
  // A new `?question=` (a link followed while the page is open) brings the Settings tab back.
  const [seenQuestion, setSeenQuestion] = useState(question);
  if (question !== seenQuestion) {
    setSeenQuestion(question);
    if (question) setTab("settings");
  }
  /** Item to select when the items tab opens (from "Used by" links in the questionnaire). */
  const [focus, setFocus] = useState<string | null>(null);
  const slots = useMemo(() => effectiveSlots(doc, parent), [doc, parent]);
  const lex = useLexicon(slots);
  const removed = useMemo(() => (patch && (doc as RuleSetPatch).remove) || [], [patch, doc]);

  const { items, derived, manual, entries } = useMemo(() => {
    const items = rowsFor(parent?.items, doc.items, removed, patch);
    const derived = rowsFor(parent?.derived, doc.derived, removed, patch);
    const manual = rowsFor(parent?.manual, doc.manual, removed, patch);
    const entries: Entry[] = [...live(items), ...live(derived), ...live(manual)];
    return { items, derived, manual, entries };
  }, [parent, doc, removed, patch]);
  const usage = useMemo(() => slotUsage(entries, slots), [entries, slots]);
  const scope = useMemo(() => scopeOf(entries, slots), [entries, slots]);

  const setList = (key: "items" | "derived" | "manual", list: unknown[]) =>
    onChange(patch ? put(doc as RuleSetPatch, key, list.length ? (list as never) : undefined) : ({ ...doc, [key]: list } as RuleSet));
  const setRemoved = (ids: string[]) => onChange(put(doc as RuleSetPatch, "remove", ids.length ? ids : undefined));

  const openRule = (id: string) => {
    const key: GroupKey = items.some((r) => r.id === id) ? "model" : derived.some((r) => r.id === id) ? "calculated" : "manual";
    setFocus(`${key}:${id}`);
    setTab("items");
  };
  const ruleLabel = (id: string) => {
    const r = [...items, ...derived].find((x) => x.id === id);
    return (r?.entry as { label?: string } | undefined)?.label || id;
  };
  const itemIds = live(items).map((i) => i.id);

  const groups: Group[] = [
    group<ItemRule>({
      key: "model",
      noun: "item-rule",
      rows: items,
      own: doc.items ?? [],
      setOwn: (l) => setList("items", l),
      rename: (from, list) => {
        const to = list.find((x) => !(doc.items ?? []).some((y) => y.id === x.id))?.id;
        if (!to) return;
        const follow = (d: DerivedRule) => (d.from.includes(from) ? { ...d, from: d.from.map((f) => (f === from ? to : f)) } : d);
        let derivedOwn = (doc.derived ?? []).map(follow);
        let remove = patch ? [...((doc as RuleSetPatch).remove ?? [])] : undefined;
        if (patch && parent?.items.some((x) => x.id === from)) {
          // the parent's item goes, the renamed one replaces it; the parent's calculated items follow
          const gone = [...new Set([...(remove ?? []), from])];
          remove = gone;
          const ownIds = new Set(derivedOwn.map((d) => d.id));
          derivedOwn = [...derivedOwn, ...(parent.derived ?? []).filter((d) => !ownIds.has(d.id) && !gone.includes(d.id) && d.from.includes(from)).map(follow)];
        }
        onChange({ ...doc, items: list, ...(derivedOwn.length ? { derived: derivedOwn } : {}), ...(remove?.length ? { remove } : {}) } as OurRuleType);
      },
      make: (id) => ({ id, label: t("items.newItem"), match: { ifcClass: "IfcWall" }, quantity: { kind: "area" }, description: "{type_name}" }),
      summary: (e) => ({
        title: e.label || e.id,
        sub: t("items.itemSub", {
          what: cap(story.whatShort(e.match)),
          how: e.quantity.kind === "choose" ? t("items.howChoose") : e.quantity.kind === "when" ? t("items.howWhen") : e.quantity.kind === "formula" ? t("items.howFormula") : story.qtyShort(e.quantity, slots, lex),
        }),
      }),
      form: (e, set) => <ItemForm item={e} onChange={set} slots={slots} counts={counts} />,
    }),
    group<DerivedRule>({
      key: "calculated",
      noun: "derived-rule",
      rows: derived,
      own: doc.derived ?? [],
      setOwn: (l) => setList("derived", l),
      make: (id) => ({ id, label: t("items.newCalculated"), from: itemIds.slice(0, 1), scope: "line", quantity: "qty", unit: "m2", description: t("items.newCalculatedText") }),
      summary: (e) => ({ title: e.label || e.id, sub: t("items.derivedSub", { from: e.from.map(ruleLabel).join(", ") || "—", unit: e.unit }) }),
      form: (e, set) => <DerivedForm rule={e} onChange={set} slots={slots} itemIds={itemIds} ruleLabel={ruleLabel} />,
    }),
    group<ManualItem>({
      key: "manual",
      noun: "manual-item",
      rows: manual,
      own: doc.manual ?? [],
      setOwn: (l) => setList("manual", l),
      make: (id) => ({ id, kind: "preliminary", description: t("items.newManual"), unit: "item" }),
      summary: (e) => ({ title: typeof e.description === "string" ? e.description : e.id, sub: t("items.manualSub", { kind: t(`story.manualKind.${e.kind}`), unit: e.unit }) }),
      form: (e, set) => <ManualForm item={e} onChange={set} slots={slots} />,
    }),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="rule-set-editor">
      {patch && (
        <p className="text-muted-foreground" data-testid="patch-note">
          {t.rich(parent?.name ? "patchNoteNamed" : "patchNote", { id: doc.extends, name: parent?.name ?? "", b: (c) => <b className="text-foreground">{c}</b> })}
          {!parent && (
            <>
              {" "}
              {t("loadingParent")}
            </>
          )}
        </p>
      )}
      <TabBar<Tab>
        label={t("tabs.label")}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "settings", label: t("tabs.settings"), testId: "rule-tab-settings" },
          { id: "items", label: t("tabs.items", { n: entries.length }), testId: "rule-tab-items" },
          { id: "advanced", label: t("tabs.advanced"), testId: "rule-tab-advanced" },
        ]}
      />
      <div role="tabpanel" className="min-w-0">
        {tab === "settings" && (
          <QuestionsTab
            doc={doc}
            onChange={onChange}
            parent={parent}
            slots={slots}
            usage={usage}
            scope={scope}
            ruleLabel={ruleLabel}
            onOpenRule={openRule}
            onOpenSetup={() => {
              setTab("advanced");
              setAdvanced("setup");
            }}
            focus={question}
          />
        )}
        {tab === "items" && <ItemsTab key={focus ?? ""} groups={groups} initial={focus} patch={patch} removed={removed} setRemoved={setRemoved} counts={counts} />}
        {tab === "advanced" && (
          <div className="flex flex-col gap-4">
            <TabBar<AdvancedTab>
              quiet
              label={t("tabs.advancedLabel")}
              value={advanced}
              onChange={setAdvanced}
              tabs={[
                { id: "about", label: t("tabs.about"), testId: "rule-tab-about" },
                { id: "setup", label: t("tabs.setup", { n: Object.keys(slots).length }), testId: "rule-tab-setup" },
                { id: "json", label: t("tabs.json"), testId: "rule-tab-json" },
              ]}
            />
            {advanced === "about" && <Overview doc={doc} onChange={onChange} slots={slots} parent={parent} />}
            {advanced === "setup" && <QuestionSetup doc={doc} onChange={onChange} parent={parent} slots={slots} usage={usage} ruleLabel={ruleLabel} onOpenRule={openRule} />}
            {advanced === "json" && <JsonTab value={doc} onChange={onChange} />}
          </div>
        )}
      </div>
    </div>
  );
}
