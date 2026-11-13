"use client";

/**
 * The forms of the BoQ items tab, ported from the PoC's `RuleSetEditor.tsx`: an item measured from
 * the model, one calculated from other items, one entered by hand, and the "new item" starter.
 * Each form opens with its sentence (item-story.tsx); a click on a part of it jumps to the field.
 * Strings: `ruleSetEditor.forms` (F15).
 */
import { useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { FAMILY_INFO, IFC_FAMILIES } from "@ifc-boq/types";
import type { Breakdown, DerivedRule, ItemRule, ManualItem, QuantitySpec, Value } from "@ifc-boq/types";
import { cn } from "@/lib/utils";
import { put, removeAt, replaceAt, slug } from "../shared/doc";
import { ExprInput, Field, LazyText, Section, Select, StringList, Text, TextArea, ToggleChips, ValueField, inputClass, isRef, linkButton } from "../shared/fields";
import { cap, useStoryWords } from "../shared/story";
import { useVocab } from "../shared/use-vocab";
import { BREAKDOWNS, LINE_SPLITS, MANUAL_KINDS, MEASURED_FIELDS, SELECTOR_FIELDS } from "../shared/vocab";
import { EXAMPLE } from "./examples";
import { DerivedStory, ItemStory, ManualStory, TemplateWords, useLexicon, useStoryText, type Part } from "./item-story";
import { suggestedKinds, type Slots } from "./model";
import { BoolValue, ClassPicker, FormulaValue, NumberValue, OnMissingEditor, QuantityEditor, RemoveButton, RoundingEditor, UnitInput, WhatEditor } from "./rule-parts";

function TextValue({ label, value, onChange, slots, placeholder, hint }: { label: string; value: Value<string> | undefined; onChange: (v: Value<string>) => void; slots: Slots; placeholder?: string; hint?: string }) {
  return (
    <Field label={label} group wide hint={hint}>
      <ValueField<string> value={value} onChange={(v) => onChange(v ?? "")} slots={slots} slotType="text">
        {(lit, set) => <Text value={lit} onChange={(v) => set(v ?? "")} placeholder={placeholder} optional={false} aria-label={label} data-testid="line-text" />}
      </ValueField>
    </Field>
  );
}

/** Scroll to a part of a form and flash it; the "More options" fold opens first. */
function useJump() {
  const base = useId();
  const id = (p: Part) => `${base}-${p}`;
  const jump = (p: Part) => {
    const el = document.getElementById(id(p));
    if (!el) return;
    if (el instanceof HTMLDetailsElement) el.open = true;
    el.scrollIntoView?.({ behavior: "smooth", block: "start" });
    el.animate?.([{ backgroundColor: "var(--selection)" }, { backgroundColor: "transparent" }], { duration: 1200, easing: "ease-out" });
  };
  return { id, jump };
}

function MoreOptions({ id, changed, children }: { id: string; changed: string[]; children: ReactNode }) {
  const t = useTranslations("ruleSetEditor.forms");
  return (
    <details className="flex flex-col gap-4 border-t border-border pt-4" id={id} data-testid="more-options">
      <summary className="cursor-pointer">
        <span className="label-caps">{t("moreOptions")}</span> <span className="text-muted-foreground">{changed.length ? t("moreChanged", { list: changed.join(t("comma")) }) : t("moreNothing")}</span>
      </summary>
      <div className="mt-4 flex flex-col gap-6">{children}</div>
    </details>
  );
}

const FAMILY_OPTIONS = ["linear", "planar", "volumetric", "countable", "reinforcement", "assembly", "space", "void"] as const;
const CLAIMS = ["body", "finish_side_a", "finish_side_b", "structure"];

export function ItemForm({ item, onChange, slots, counts }: { item: ItemRule; onChange: (i: ItemRule) => void; slots: Slots; counts?: Record<string, number> }) {
  const t = useTranslations("ruleSetEditor.forms");
  const vocab = useVocab();
  const story = useStoryText();
  const set = <K extends keyof ItemRule>(k: K, v: ItemRule[K] | undefined) => onChange(put(item, k, v));
  const { id, jump } = useJump();
  return (
    <div className="flex flex-col gap-6" data-testid="item-form">
      <ItemStory item={item} slots={slots} onJump={jump} />
      <Section id={id("name")} title={t("name")}>
        <Field label={t("nameInList")}>
          <Text value={item.label} onChange={(v) => set("label", v ?? "")} optional={false} data-testid="item-label" />
        </Field>
        <BoolValue label={t("inBoq")} value={item.enabled} onChange={(v) => set("enabled", v)} slots={slots} dflt />
      </Section>

      <Section id={id("what")} title={t("stepWhat")} hint={t("stepWhatHint")}>
        <WhatEditor value={item.match} onChange={(m) => set("match", m)} slots={slots} counts={counts} />
      </Section>

      <Section id={id("how")} title={t("stepHow")}>
        <div className="col-span-full">
          <QuantityEditor value={item.quantity} onChange={(q) => set("quantity", q)} slots={slots} suggest={suggestedKinds(item)} />
        </div>
      </Section>

      <Section id={id("lines")} title={t("stepLines")} hint={t("stepLinesHint")}>
        <LineSplitEditor value={item.lineKey as string[] | undefined} onChange={(v) => set("lineKey", v)} slots={slots} />
      </Section>

      <Section id={id("text")} title={t("stepText")}>
        <DescriptionEditor value={item.description} onChange={(v) => set("description", v)} slots={slots} />
      </Section>

      <MoreOptions id={id("more")} changed={story.itemExtras(item, slots)}>
        <Section title={t("whichInDetail")}>
          <Field label={t("takes")} hint={t("takesHint")}>
            <Select value={item.scope} options={["in", "out"] as const} labels={(o) => t(`scopes.${o}`)} empty={t("scopes.in")} onChange={(v) => set("scope", v === "in" ? undefined : v)} />
          </Field>
          <Field label={t("parts")} hint={t("partsHint")}>
            <Select value={item.parts} options={["skip", "include"] as const} labels={(o) => t(`partsValues.${o}`)} empty={t("partsUsual")} onChange={(v) => set("parts", v)} />
          </Field>
          <Field label={t("breakdown")} group>
            <ValueField<Breakdown> value={item.breakdown} onChange={(v) => set("breakdown", v)} slots={slots} slotType="choice">
              {(lit, s) => <Select<Breakdown> value={lit} options={BREAKDOWNS} labels={(o) => vocab.words("breakdowns", o)} empty={t("ruleSetDefault")} onChange={s} aria-label={t("breakdown")} />}
            </ValueField>
          </Field>
          <Field label={t("partFilter")} wide>
            <ExprInput slots={slots} value={item.partFilter} onChange={(v) => set("partFilter", v)} placeholder={EXAMPLE.partFilter} aria-label={t("partFilter")} />
          </Field>
        </Section>

        <Section title={t("bandsTitle")}>
          <BandsEditor item={item} onChange={onChange} />
        </Section>

        <Section title={t("adjustments")}>
          <NumberValue label={t("factor")} value={item.factor} onChange={(v) => set("factor", v)} slots={slots} placeholder="1" hint={t("factorHint")} />
          {item.minimum ? (
            <>
              <NumberValue label={t("minimum")} value={item.minimum.value} onChange={(v) => set("minimum", { ...item.minimum!, value: v ?? 0 })} slots={slots} />
              <Field label={t("minimumPer")}>
                <Select
                  value={item.minimum.per as "element" | "line"}
                  options={["element", "line"] as const}
                  labels={(o) => t(`per.${o}`)}
                  onChange={(v) => (v ? set("minimum", { ...item.minimum!, per: v }) : set("minimum", undefined))}
                  empty={t("noMinimum")}
                />
              </Field>
            </>
          ) : (
            <Field label={t("minimum")} group>
              <button type="button" className={cn(linkButton, "h-8 self-start")} onClick={() => set("minimum", { value: 0, per: "line" })}>
                {t("setMinimum")}
              </button>
            </Field>
          )}
          <RoundingEditor value={item.rounding} onChange={(v) => set("rounding", v)} slots={slots} />
          <OnMissingEditor value={item.onMissing} onChange={(v) => set("onMissing", v)} slots={slots} />
        </Section>

        <Section title={t("labelsChecks")}>
          <Field label={t("tags")} group hint={t("tagsHint")}>
            <StringList values={item.tags} onChange={(v) => set("tags", v)} aria-label={t("tags")} />
          </Field>
          <Field label={t("claims")} group hint={t("claimsHint")}>
            <StringList values={item.claims} onChange={(v) => set("claims", v)} suggestions={CLAIMS} aria-label={t("claims")} />
          </Field>
          <Field label={t("family")} group wide>
            <ToggleChips options={FAMILY_OPTIONS} selected={[item.family ?? []].flat()} onChange={(l) => set("family", l.length === 0 ? undefined : l.length === 1 ? l[0] : l)} />
          </Field>
          <Field label={t("notes")} wide>
            <TextArea value={item.notes} onChange={(v) => set("notes", v)} rows={2} />
          </Field>
          <Field label={t("id")} hint={t("idHint")}>
            <LazyText mono value={item.id} onCommit={(v) => set("id", v.trim())} aria-label={t("id")} data-testid="item-id" />
          </Field>
        </Section>
      </MoreOptions>
    </div>
  );
}

/** "One line per": common fields as ticks; anything else (a formula, a property) as chips in words. */
function LineSplitEditor({ value, onChange, slots, hint }: { value: string[] | undefined; onChange: (v: string[] | undefined) => void; slots: Slots; hint?: string }) {
  const t = useTranslations("ruleSetEditor.forms");
  const { fieldWords } = useStoryWords();
  const story = useStoryText();
  const lex = useLexicon(slots);
  const list = value ?? [];
  const ticked = list.filter((k) => LINE_SPLITS.includes(k));
  const others = list.filter((k) => !LINE_SPLITS.includes(k));
  const commit = (l: string[]) => onChange(l.length ? l : undefined);
  const splitLabel = (f: string) => (f === "is_external" || f === "ifc_class" ? t(`split.${f}`) : cap(fieldWords(f)));
  return (
    <>
      <Field label={t("onePer")} group wide hint={hint ?? t("onePerHint")}>
        <ToggleChips options={LINE_SPLITS} selected={ticked} labels={splitLabel} onChange={(sel) => commit([...list.filter((k) => !LINE_SPLITS.includes(k) || sel.includes(k)), ...sel.filter((k) => !list.includes(k))])} />
      </Field>
      <Field label={t("alsoSplit")} group wide hint={t("alsoSplitHint")}>
        <div className="flex flex-wrap items-center gap-1">
          {others.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-border px-1.5" title={k}>
              {story.lineKeyWords(k, slots, lex)}
              <RemoveButton label={t("removeSplit", { what: k })} className="h-6" onClick={() => commit(list.filter((x) => x !== k))} />
            </span>
          ))}
          <div className="min-w-56 flex-1">
            <StringList mono values={undefined} onChange={(v) => v && commit([...list, ...v.filter((x) => !list.includes(x))])} suggestions={SELECTOR_FIELDS} placeholder={t("alsoSplitPlaceholder")} />
          </div>
        </div>
      </Field>
    </>
  );
}

const INSERTS = ["type_name", "storey", "material", "thickness*1000", "ifc_class", "family_name", "profile", "nominal_size", "system", "predefined_type"] as const;
const insertKey = (raw: string) => raw.replace("*1000", "_mm");

/** The line text: typed, with values inserted by a click, and read back in words. */
function DescriptionEditor({ value, onChange, slots, inserts = true }: { value: Value<string> | undefined; onChange: (v: Value<string>) => void; slots: Slots; inserts?: boolean }) {
  const t = useTranslations("ruleSetEditor.forms");
  const lit = isRef(value) ? null : (value ?? "");
  return (
    <>
      <TextValue label={t("lineText")} value={value} onChange={onChange} slots={slots} placeholder={EXAMPLE.lineText} hint={t("lineTextHint")} />
      {inserts && lit !== null && (
        <Field label={t("insert")} group wide>
          <div className="flex flex-wrap gap-1">
            {INSERTS.map((raw) => (
              <button
                key={raw}
                type="button"
                className="rounded-[var(--radius)] border border-border px-1.5 py-0.5 hover:bg-muted"
                onClick={() => onChange(`${lit}${lit && !/[\s,(]$/.test(lit) ? ", " : ""}{${raw}}`)}
              >
                {t("insertValue", { what: t(`inserts.${insertKey(raw)}`) })}
              </button>
            ))}
          </div>
        </Field>
      )}
      {lit && (
        <p className="col-span-full text-muted-foreground" data-testid="reads-as">
          {t("readsAs")} <TemplateWords value={lit} slots={slots} />
        </p>
      )}
    </>
  );
}

function BandsEditor({ item, onChange }: { item: ItemRule; onChange: (i: ItemRule) => void }) {
  const t = useTranslations("ruleSetEditor.forms");
  const { fieldWords } = useStoryWords();
  const bands = item.bands ?? [];
  const setBands = (b: typeof bands) => onChange(put(item, "bands", b.length ? b : undefined));
  const fmtEdge = (e: Value<number>) => (typeof e === "number" ? String(e) : `p.${e.param}`);
  const parseEdges = (s: string): Value<number>[] =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => (x.startsWith("p.") ? { param: x.slice(2) } : Number(x)));
  return (
    <Field label={t("bands")} group wide hint={t("bandsHint")}>
      {bands.map((b, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
          <Select value={b.field} options={MEASURED_FIELDS} labels={(f) => cap(fieldWords(f))} aria-label={t("bandField")} onChange={(f) => setBands(replaceAt(bands, i, { ...b, field: f ?? "height" }))} />
          <LazyText value={b.edges.map(fmtEdge).join(", ")} placeholder={t("edgesPlaceholder", { example: EXAMPLE.bandEdges })} aria-label={t("edges")} onCommit={(s) => setBands(replaceAt(bands, i, { ...b, edges: parseEdges(s) }))} />
          <LazyText
            value={(b.labels ?? []).join(", ")}
            placeholder={t("bandLabelsPlaceholder")}
            aria-label={t("bandLabels")}
            onCommit={(s) => setBands(replaceAt(bands, i, put(b, "labels", s.trim() ? s.split(",").map((x) => x.trim()) : undefined)))}
          />
          <RemoveButton label={t("removeBand")} onClick={() => setBands(removeAt(bands, i))} />
        </div>
      ))}
      <button type="button" className={cn(linkButton, "self-start")} onClick={() => setBands([...bands, { field: "height", edges: [3.5] }])}>
        {t("addBand")}
      </button>
    </Field>
  );
}

export function DerivedForm({ rule, onChange, slots, itemIds, ruleLabel }: { rule: DerivedRule; onChange: (r: DerivedRule) => void; slots: Slots; itemIds: string[]; ruleLabel: (id: string) => string }) {
  const t = useTranslations("ruleSetEditor.forms");
  const set = <K extends keyof DerivedRule>(k: K, v: DerivedRule[K] | undefined) => onChange(put(rule, k, v));
  const grouping = rule.lineKey === undefined ? "source" : rule.lineKey.length === 0 ? "single" : "fields";
  const unknown = rule.from.filter((f) => !itemIds.includes(f));
  const { id, jump } = useJump();
  const changed = [
    rule.factor !== undefined && t("changed.factor"),
    rule.rounding && t("changed.rounding"),
    rule.onMissing !== undefined && t("changed.missing"),
    rule.tags?.length && t("changed.tags"),
    rule.notes && t("changed.notes"),
  ].filter((x): x is string => !!x);
  return (
    <div className="flex flex-col gap-6" data-testid="derived-form">
      <DerivedStory rule={rule} slots={slots} ruleLabel={ruleLabel} onJump={jump} />
      <Section id={id("name")} title={t("name")}>
        <Field label={t("nameInList")}>
          <Text value={rule.label} onChange={(v) => set("label", v ?? "")} optional={false} data-testid="item-label" />
        </Field>
        <BoolValue label={t("inBoq")} value={rule.enabled} onChange={(v) => set("enabled", v)} slots={slots} dflt />
      </Section>
      <Section id={id("what")} title={t("stepFrom")} hint={t("stepFromHint")}>
        <Field label={t("fromItems")} group wide>
          <ToggleChips options={[...itemIds, ...unknown]} selected={rule.from} labels={Object.fromEntries(itemIds.map((i) => [i, ruleLabel(i)]))} onChange={(l) => set("from", l)} />
          {unknown.length > 0 && <span className="text-error">{t("notInSet", { ids: unknown.join(", ") })}</span>}
        </Field>
        <Field label={t("workOutFor")}>
          <Select value={rule.scope} options={["line", "element"] as const} labels={(o) => t(`derivedScopes.${o}`)} onChange={(v) => set("scope", v ?? "line")} />
        </Field>
        <Field label={t("onlyWhere")} wide hint={t("onlyWhereHint")}>
          <ExprInput slots={slots} value={rule.where} onChange={(v) => set("where", v)} placeholder={EXAMPLE.derivedWhere} aria-label={t("onlyWhere")} />
        </Field>
      </Section>
      <Section id={id("how")} title={t("stepQuantity")}>
        <FormulaValue label={t("formula")} value={rule.quantity} onChange={(v) => set("quantity", v)} slots={slots} placeholder={rule.scope === "line" ? EXAMPLE.derivedLine : EXAMPLE.derivedElement} />
        <Field label={t("unit")}>
          <UnitInput value={rule.unit} onChange={(u) => set("unit", u ?? "")} required />
        </Field>
      </Section>
      <Section id={id("lines")} title={t("stepLines")}>
        <Field label={t("lines")}>
          <Select
            value={grouping}
            options={["source", "fields", "single"] as const}
            labels={(o) => t(`grouping.${o}`)}
            onChange={(g) => set("lineKey", g === "single" ? [] : g === "fields" ? ["type_name"] : undefined)}
          />
        </Field>
        {grouping === "fields" && <LineSplitEditor value={rule.lineKey as string[]} onChange={(v) => set("lineKey", v ?? [])} slots={slots} hint={t("derivedSplitHint")} />}
      </Section>
      <Section id={id("text")} title={t("stepText")}>
        <DescriptionEditor value={rule.description} onChange={(v) => set("description", v)} slots={slots} />
      </Section>
      <MoreOptions id={id("more")} changed={changed}>
        <Section title={t("adjustments")}>
          <NumberValue label={t("factor")} value={rule.factor} onChange={(v) => set("factor", v)} slots={slots} placeholder="1" />
          <RoundingEditor value={rule.rounding} onChange={(v) => set("rounding", v)} slots={slots} />
          <OnMissingEditor value={rule.onMissing} onChange={(v) => set("onMissing", v)} slots={slots} />
        </Section>
        <Section title={t("labels")}>
          <Field label={t("tags")} group>
            <StringList values={rule.tags} onChange={(v) => set("tags", v)} aria-label={t("tags")} />
          </Field>
          <Field label={t("notes")} wide>
            <TextArea value={rule.notes} onChange={(v) => set("notes", v)} rows={2} />
          </Field>
          <Field label={t("id")}>
            <LazyText mono value={rule.id} onCommit={(v) => set("id", v.trim())} aria-label={t("id")} data-testid="item-id" />
          </Field>
        </Section>
      </MoreOptions>
    </div>
  );
}

export function ManualForm({ item, onChange, slots }: { item: ManualItem; onChange: (i: ManualItem) => void; slots: Slots }) {
  const t = useTranslations("ruleSetEditor.forms");
  const set = <K extends keyof ManualItem>(k: K, v: ManualItem[K] | undefined) => onChange(put(item, k, v));
  const { id, jump } = useJump();
  return (
    <div className="flex flex-col gap-6" data-testid="manual-form">
      <ManualStory item={item} slots={slots} onJump={jump} />
      <Section id={id("name")} title={t("kind")}>
        <Field label={t("kindOfLine")}>
          <Select value={item.kind} options={MANUAL_KINDS} labels={(o) => t(`manualKinds.${o}`)} onChange={(v) => set("kind", v ?? "other")} />
        </Field>
        <BoolValue label={t("inBoq")} value={item.enabled} onChange={(v) => set("enabled", v)} slots={slots} dflt />
      </Section>
      <Section id={id("text")} title={t("manualText")}>
        <DescriptionEditor value={item.description} onChange={(v) => set("description", v)} slots={slots} inserts={false} />
      </Section>
      <Section id={id("how")} title={t("quantity")} hint={t("manualQuantityHint")}>
        <Field label={t("unit")}>
          <UnitInput value={item.unit} onChange={(u) => set("unit", u ?? "item")} required />
        </Field>
        <NumberValue label={t("quantity")} value={item.quantity} onChange={(v) => set("quantity", v)} slots={slots} placeholder={t("quantityPlaceholder")} />
        <FormulaValue label={t("orFormula")} value={item.formula} onChange={(v) => set("formula", v || undefined)} slots={slots} placeholder={EXAMPLE.manualFormula} />
        <NumberValue label={t("amount")} value={item.amount} onChange={(v) => set("amount", v)} slots={slots} hint={t("amountHint")} />
      </Section>
      <MoreOptions id={id("more")} changed={item.tags?.length ? [t("changed.tags")] : []}>
        <Section title={t("labels")}>
          <Field label={t("tags")} group>
            <StringList values={item.tags} onChange={(v) => set("tags", v)} aria-label={t("tags")} />
          </Field>
          <Field label={t("id")}>
            <LazyText mono value={item.id} onCommit={(v) => set("id", v.trim())} aria-label={t("id")} data-testid="item-id" />
          </Field>
        </Section>
      </MoreOptions>
    </div>
  );
}

/** "+ From the model": start from a kind of element or a copy, instead of an empty form. */
export function NewItemStarter({ counts, existing, onCreate, onEmpty, onCancel }: {
  counts?: Record<string, number>;
  existing: { id: string; label: string; entry: ItemRule }[];
  onCreate: (e: ItemRule) => void;
  onEmpty: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("ruleSetEditor.forms");
  const vocab = useVocab();
  const fromClass = (c: string): ItemRule => {
    const fam = IFC_FAMILIES[c];
    const label = cap(vocab.classWords(c).replace(/\s*\(.*\)$/, ""));
    return {
      id: slug(label),
      label,
      ...(fam ? { family: fam } : {}),
      match: { ifcClass: c },
      quantity: { kind: fam ? FAMILY_INFO[fam].default : "count" } as QuantitySpec,
      lineKey: ["type_name"],
      description: `${label}, {type_name}`,
    };
  };
  return (
    <div className="flex max-w-[72ch] flex-col gap-3" data-testid="new-item-starter">
      <h3 className="text-title">{t("starterTitle")}</h3>
      <p className="text-prose">{t("starterIntro")}</p>
      <ClassPicker prompt={t("starterPick")} counts={counts} onPick={(c) => onCreate(fromClass(c))} />
      {existing.length > 0 && (
        <>
          <p>{t("starterCopy")}</p>
          <select
            className={inputClass}
            value=""
            aria-label={t("copyItem")}
            onChange={(e) => {
              const r = existing.find((x) => x.id === e.target.value);
              if (r) onCreate({ ...structuredClone(r.entry), id: `${r.id}-copy`, label: t("copyLabel", { label: r.label }) });
            }}
          >
            <option value="">{t("copyItem")}</option>
            {existing.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </>
      )}
      <p className="flex gap-3">
        <button type="button" className={linkButton} onClick={onEmpty}>
          {t("starterEmpty")}
        </button>
        <button type="button" className={linkButton} onClick={onCancel}>
          {t("cancel")}
        </button>
      </p>
    </div>
  );
}
