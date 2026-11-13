"use client";

/**
 * Building blocks of the rule-set editor, ported from the PoC's `ruleParts.tsx`: selectors,
 * quantity specs (recursive: choose / when nest other specs), deductions, rounding and
 * missing-value handling. Strings: `ruleSetEditor.parts` (F15).
 */
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { DeductionRule, ElementFamily, OnMissing, QuantitySpec, Rounding, Selector, SelectorOp, Value } from "@ifc-boq/types";
import { cn } from "@/lib/utils";
import { put, removeAt, replaceAt } from "../shared/doc";
import { ExprInput, Field, LazyText, LogicTree, Num, Options, Select, Text, ToggleChips, ValueField, inputClass, isRef, linkButton, parseLiteral } from "../shared/fields";
import { cap, composeMatch, decomposeMatch, listOf, useStoryWords } from "../shared/story";
import { useVocab } from "../shared/use-vocab";
import {
  AREA_SURFACES,
  CLASS_GROUPS,
  COMPARE_BY,
  DEDUCTION_MODES,
  DEDUCTION_WHAT,
  FAMILIES,
  IFC_CLASSES,
  LENGTH_BASES,
  MASS_BASES,
  MEASURED_FIELDS,
  MODES_WITH_SIZE,
  QUANTITY_KINDS,
  SELECTOR_OPS,
  TEXT_FIELDS,
  UNITS,
} from "../shared/vocab";
import { EXAMPLE } from "./examples";
import type { Slots } from "./model";

/** The small × button of a row. */
export function RemoveButton({ label, onClick, disabled, className }: { label: string; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button type="button" className={cn("h-8 shrink-0 px-1 text-muted-foreground hover:text-foreground disabled:opacity-40", className)} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      ×
    </button>
  );
}

/* ================================================================ selectors */

type LeafKind = "field" | "ifcClass" | "family" | "expr";
const LEAF_KINDS: LeafKind[] = ["field", "ifcClass", "family", "expr"];
const leafKind = (s: Selector): LeafKind => ("field" in s ? "field" : "ifcClass" in s ? "ifcClass" : "family" in s ? "family" : "expr");
const LEAF_TEMPLATES: Record<LeafKind, Selector> = {
  ifcClass: { ifcClass: "IfcWall" },
  field: { field: "material", op: "under", value: "concrete" },
  family: { family: "planar" },
  expr: { expr: "" },
};

const fmtList = (v: unknown) => listOf(v).map(String).join(", ");
const parseList = (s: string) =>
  s
    .split(",")
    .map((x) => parseLiteral(x))
    .filter((x) => x !== "");
const oneOrMany = <T,>(l: T[]): T | T[] => (l.length === 1 ? l[0]! : l);

function SelectorLeaf({ value, onChange, slots }: { value: Selector; onChange: (v: Selector) => void; slots: Slots }) {
  const t = useTranslations("ruleSetEditor.parts");
  const vocab = useVocab();
  const kind = leafKind(value);
  const classesId = useId();
  return (
    <div className="flex flex-wrap items-start gap-2" data-testid="selector-leaf">
      <select className={cn(inputClass, "w-auto")} value={kind} onChange={(e) => onChange(LEAF_TEMPLATES[e.target.value as LeafKind])} aria-label={t("conditionType")}>
        {LEAF_KINDS.map((k) => (
          <option key={k} value={k}>
            {t(`leaf.${k}`)}
          </option>
        ))}
      </select>
      {"ifcClass" in value && (
        <div className="min-w-48 flex-1">
          <LazyText
            mono
            list={classesId}
            value={fmtList(value.ifcClass)}
            placeholder={EXAMPLE.classes}
            onCommit={(s) =>
              onChange({
                ...value,
                ifcClass: oneOrMany(
                  s
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                ),
              })
            }
          />
          <Options id={classesId} values={IFC_CLASSES} />
        </div>
      )}
      {"family" in value && <ToggleChips<ElementFamily> options={FAMILIES} selected={listOf(value.family) as ElementFamily[]} onChange={(l) => onChange({ family: oneOrMany(l) })} />}
      {"expr" in value && (
        <div className="min-w-48 flex-1">
          <ExprInput slots={slots} value={value.expr} onChange={(v) => onChange({ expr: v ?? "" })} placeholder={EXAMPLE.selectorExpr} />
        </div>
      )}
      {"field" in value && (
        <>
          <FieldPicker value={value.field} onChange={(f) => onChange({ ...value, field: f as typeof value.field })} />
          <div className="w-36">
            <Select<SelectorOp>
              value={value.op}
              options={SELECTOR_OPS}
              labels={(o) => vocab.words("ops", o)}
              aria-label={t("operator")}
              onChange={(op) => onChange(put({ ...value, op: op ?? "eq" }, "value", op === "exists" || op === "missing" ? undefined : value.value))}
            />
          </div>
          {value.op !== "exists" && value.op !== "missing" && (
            <div className="min-w-40 flex-1">
              <ValueField<unknown> value={value.value as Value<unknown>} onChange={(v) => onChange(put(value, "value", v))} slots={slots}>
                {(lit, set) =>
                  value.op === "in" || value.op === "not_in" || value.op === "between" ? (
                    <LazyText value={fmtList(lit)} placeholder={value.op === "between" ? t("betweenPlaceholder") : t("listPlaceholder")} aria-label={t("value")} onCommit={(s) => set(parseList(s))} />
                  ) : (
                    <LazyText
                      value={lit === undefined ? "" : String(lit)}
                      placeholder={value.op === "under" ? t("underPlaceholder") : t("valuePlaceholder")}
                      aria-label={t("value")}
                      onCommit={(s) => set(value.op === "matches" ? s : parseLiteral(s))}
                    />
                  )
                }
              </ValueField>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function SelectorEditor({ value, onChange, slots }: { value: Selector; onChange: (v: Selector) => void; slots: Slots }) {
  return <LogicTree<Selector> value={value} onChange={onChange} newLeaf={() => LEAF_TEMPLATES.field} renderLeaf={(l, set) => <SelectorLeaf value={l} onChange={set} slots={slots} />} />;
}

/** A field to test, by its name in words; property set values are typed. */
function FieldPicker({ value, onChange }: { value: string; onChange: (f: string) => void }) {
  const t = useTranslations("ruleSetEditor.parts");
  const { fieldWords } = useStoryWords();
  const known = (TEXT_FIELDS as readonly string[]).includes(value) || (MEASURED_FIELDS as readonly string[]).includes(value);
  return (
    <>
      <select className={cn(inputClass, "w-auto max-w-56")} value={known ? value : "__prop"} onChange={(e) => onChange(e.target.value === "__prop" ? "props." : e.target.value)} aria-label={t("field")}>
        <optgroup label={t("describing")}>
          {TEXT_FIELDS.map((f) => (
            <option key={f} value={f}>
              {cap(fieldWords(f))}
            </option>
          ))}
        </optgroup>
        <optgroup label={t("measured")}>
          {MEASURED_FIELDS.map((f) => (
            <option key={f} value={f}>
              {cap(fieldWords(f))}
            </option>
          ))}
        </optgroup>
        <option value="__prop">{t("propertyValue")}</option>
      </select>
      {!known && (
        <div className="w-56">
          <LazyText mono value={value.replace(/^props\./, "")} placeholder={EXAMPLE.property} aria-label={t("propertyValue")} onCommit={(s) => onChange(`props.${s.trim()}`)} />
        </div>
      )}
    </>
  );
}

/** A select that adds one kind of element: those in the loaded model first, with their counts. */
export function ClassPicker({ onPick, exclude = [], counts, prompt }: { onPick: (c: string) => void; exclude?: string[]; counts?: Record<string, number>; prompt: string }) {
  const t = useTranslations("ruleSetEditor.parts");
  const vocab = useVocab();
  const inModel = Object.entries(counts ?? {})
    .filter(([c, n]) => n > 0 && !exclude.includes(c) && c !== "IfcOpeningElement")
    .sort((a, b) => b[1] - a[1]);
  const grouped = new Set(CLASS_GROUPS.flatMap(([, l]) => l));
  const other = IFC_CLASSES.filter((c) => !grouped.has(c) && !exclude.includes(c));
  const opt = (c: string) => (
    <option key={c} value={c}>
      {counts?.[c] ? t("classCount", { name: cap(vocab.classWords(c)), n: counts[c] }) : cap(vocab.classWords(c))}
    </option>
  );
  return (
    <select className={cn(inputClass, "w-auto")} value="" onChange={(e) => e.target.value && onPick(e.target.value)} aria-label={prompt} data-testid="class-picker">
      <option value="">{prompt}</option>
      {inModel.length > 0 && <optgroup label={t("inModel")}>{inModel.map(([c]) => opt(c))}</optgroup>}
      {CLASS_GROUPS.map(([id, list]) => (
        <optgroup key={id} label={vocab.words("classGroups", id)}>
          {list.filter((c) => !exclude.includes(c)).map(opt)}
        </optgroup>
      ))}
      {other.length > 0 && <optgroup label={t("otherClasses")}>{other.map(opt)}</optgroup>}
    </select>
  );
}

/**
 * "Which elements" as people think of it: kinds of element (walls, doors), then conditions that
 * narrow them down ("only where", "except where"). Any selector fits: what is not a list of kinds
 * shows as conditions, so nothing is lost.
 */
export function WhatEditor({ value, onChange, slots, counts }: { value: Selector; onChange: (v: Selector) => void; slots: Slots; counts?: Record<string, number> }) {
  const t = useTranslations("ruleSetEditor.parts");
  const vocab = useVocab();
  const { classes, extra } = decomposeMatch(value);
  const set = (c: string[], e: Selector[]) => onChange(composeMatch(c, e));
  const leaf = (l: Selector, s: (v: Selector) => void) => <SelectorLeaf value={l} onChange={s} slots={slots} />;
  const blank: Selector = { field: "material", op: "under", value: "" };
  return (
    <>
      <Field label={t("kinds")} group wide hint={counts ? t("kindsHintCounts") : t("kindsHint")}>
        <div className="flex flex-wrap items-center gap-1">
          {classes.map((c, i) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-border px-1.5 text-ui" title={c}>
              {cap(vocab.classWords(c))}
              {counts && <span className="text-muted-foreground tabular-nums">{counts[c] ?? 0}</span>}
              <RemoveButton label={t("removeWhat", { what: vocab.classWords(c) })} className="h-6" onClick={() => set(removeAt(classes, i), extra)} />
            </span>
          ))}
          <ClassPicker prompt={classes.length ? t("anotherKind") : t("pickKind")} exclude={classes} counts={counts} onPick={(c) => set([...classes, c], extra)} />
        </div>
        {classes.length === 0 && extra.length === 0 && <span className="text-error">{t("nothingPicked")}</span>}
        {classes.length === 0 && extra.length > 0 && <span className="text-muted-foreground">{t("noKindPicked")}</span>}
      </Field>
      <Field label={t("narrow")} group wide hint={t("narrowHint")}>
        {extra.length === 0 && <span className="text-muted-foreground">{t("noConditions")}</span>}
        {extra.map((x, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="label-caps w-24 shrink-0 pt-2 text-muted-foreground">{"not" in x ? t("exceptWhere") : t("onlyWhere")}</span>
            <div className="min-w-0 flex-1">
              <LogicTree<Selector>
                value={"not" in x ? x.not : x}
                onChange={(v) => set(classes, replaceAt(extra, i, "not" in x ? { not: v } : v))}
                onRemove={() => set(classes, removeAt(extra, i))}
                renderLeaf={leaf}
                newLeaf={() => blank}
              />
            </div>
          </div>
        ))}
        <div className="flex gap-3">
          <button type="button" className={linkButton} onClick={() => set(classes, [...extra, blank])}>
            {t("addOnlyWhere")}
          </button>
          <button type="button" className={linkButton} onClick={() => set(classes, [...extra, { not: blank }])}>
            {t("addExceptWhere")}
          </button>
        </div>
      </Field>
    </>
  );
}

/* ================================================================ quantity */

const KIND_TEMPLATE: Record<QuantitySpec["kind"], QuantitySpec> = {
  count: { kind: "count" },
  length: { kind: "length", basis: "axis" },
  area: { kind: "area", surface: "main", start: "net" },
  volume: { kind: "volume", start: "net" },
  mass: { kind: "mass", basis: "nominal_per_length" },
  perimeter: { kind: "perimeter" },
  choose: { kind: "choose", pick: "", options: {} },
  when: { kind: "when", if: "", then: { kind: "area" }, else: { kind: "volume" } },
  formula: { kind: "formula", expr: "", unit: "m2" },
};

export function UnitInput({ value, onChange, required }: { value: string | undefined; onChange: (v: string | undefined) => void; required?: boolean }) {
  const t = useTranslations("ruleSetEditor.parts");
  const id = useId();
  return (
    <>
      <Text value={value} onChange={(v) => onChange(required ? (v ?? "") : v)} list={id} placeholder={required ? t("unit") : t("unitDefault")} />
      <Options id={id} values={UNITS} />
    </>
  );
}

/** Choice-valued field that may be bound to a slot. */
export function ChoiceValue<T extends string>({ label, value, options, onChange, slots, empty, labels, hint }: {
  label: string;
  value: Value<T> | undefined;
  options: readonly T[];
  onChange: (v: Value<T> | undefined) => void;
  slots: Slots;
  empty?: string;
  labels?: Partial<Record<T, string>> | ((o: T) => string);
  hint?: string;
}) {
  return (
    <Field label={label} group hint={hint}>
      <ValueField<T> value={value} onChange={onChange} slots={slots} slotType="choice">
        {(lit, set) => <Select<T> value={lit} options={options} onChange={set} empty={empty} labels={labels} aria-label={label} />}
      </ValueField>
    </Field>
  );
}

export function NumberValue({ label, value, onChange, slots, placeholder, hint }: {
  label: string;
  value: Value<number> | undefined;
  onChange: (v: Value<number> | undefined) => void;
  slots: Slots;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <Field label={label} group hint={hint}>
      <ValueField<number> value={value} onChange={onChange} slots={slots} slotType="number">
        {(lit, set) => <Num value={lit} onChange={set} placeholder={placeholder} aria-label={label} />}
      </ValueField>
    </Field>
  );
}

/** An expression typed here, or taken from a formula slot ("tell me your formula"). */
export function FormulaValue({ label, value, onChange, slots, placeholder }: {
  label: string;
  value: Value<string> | undefined;
  onChange: (v: Value<string>) => void;
  slots: Slots;
  placeholder?: string;
}) {
  return (
    <Field label={label} group wide>
      <ValueField<string> value={value} onChange={(v) => onChange(v ?? "")} slots={slots} slotType="formula">
        {(lit, set) => <ExprInput slots={slots} value={lit} onChange={(v) => set(v ?? "")} rows={2} placeholder={placeholder} aria-label={label} />}
      </ValueField>
    </Field>
  );
}

export function BoolValue({ label, value, onChange, slots, dflt }: { label: string; value: Value<boolean> | undefined; onChange: (v: Value<boolean> | undefined) => void; slots: Slots; dflt: boolean }) {
  const t = useTranslations("ruleSetEditor.parts");
  return (
    <Field label={label} group>
      <ValueField<boolean> value={value} onChange={onChange} slots={slots} slotType="boolean">
        {(lit, set) => (
          <label className="inline-flex h-8 items-center gap-2">
            <input type="checkbox" checked={lit ?? dflt} onChange={(e) => set(e.target.checked === dflt ? undefined : e.target.checked)} />
            <span>{(lit ?? dflt) ? t("yes") : t("no")}</span>
          </label>
        )}
      </ValueField>
    </Field>
  );
}

export function QuantityEditor({ value, onChange, slots, depth = 0, suggest }: {
  value: QuantitySpec;
  onChange: (v: QuantitySpec) => void;
  slots: Slots;
  depth?: number;
  /** The ways of measuring that suit the chosen elements, offered first. */
  suggest?: QuantitySpec["kind"][];
}) {
  const t = useTranslations("ruleSetEditor.parts");
  const vocab = useVocab();
  const q = value;
  const setKind = (k: QuantitySpec["kind"]) => {
    const tpl = KIND_TEMPLATE[k];
    const unit = "unit" in q ? q.unit : undefined;
    onChange(unit && k !== "choose" && k !== "when" ? ({ ...tpl, unit } as QuantitySpec) : tpl);
  };
  const startLabels = (o: string) => vocab.words("start", o);
  return (
    <div className={cn("flex flex-col gap-3", depth > 0 && "border-l-2 border-border pl-3")} data-testid="quantity-editor">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={t("measureBy")}>
          <KindSelect value={q.kind} suggest={suggest} onChange={setKind} />
        </Field>
        {q.kind === "length" && (
          <ChoiceValue label={t("lengthTaken")} value={q.basis} options={LENGTH_BASES} labels={(o) => vocab.words("lengthBases", o)} onChange={(v) => onChange(put(q, "basis", v))} slots={slots} empty={t("lengthUsual")} />
        )}
        {q.kind === "area" && (
          <>
            <ChoiceValue label={t("whichSurface")} value={q.surface} options={AREA_SURFACES} labels={(o) => vocab.words("surfaces", o)} onChange={(v) => onChange(put(q, "surface", v))} slots={slots} empty={t("surfaceUsual")} />
            <ChoiceValue label={t("startFrom")} value={q.start} options={["gross", "net"] as const} labels={startLabels} onChange={(v) => onChange(put(q, "start", v))} slots={slots} empty={t("usual")} />
          </>
        )}
        {q.kind === "volume" && <ChoiceValue label={t("startFrom")} value={q.start} options={["gross", "net"] as const} labels={startLabels} onChange={(v) => onChange(put(q, "start", v))} slots={slots} empty={t("usual")} />}
        {q.kind === "mass" && (
          <>
            <ChoiceValue label={t("weightFrom")} value={q.basis} options={MASS_BASES} labels={(o) => vocab.words("massBases", o)} onChange={(v) => onChange({ ...q, basis: v ?? "nominal_per_length" })} slots={slots} />
            <NumberValue label={t("density")} value={q.density} onChange={(v) => onChange(put(q, "density", v))} slots={slots} placeholder={t("densityPlaceholder")} />
          </>
        )}
        {q.kind === "choose" && (
          <Field label={t("whichAnswer")} group hint={t("whichAnswerHint")}>
            <ValueField<string> value={q.pick} onChange={(v) => onChange({ ...q, pick: v ?? "" })} slots={slots} slotType="choice">
              {(lit, set) => <Text value={lit} onChange={(v) => set(v ?? "")} placeholder={t("optionName")} />}
            </ValueField>
          </Field>
        )}
        {q.kind === "formula" && (
          <Field label={t("unitLabel")}>
            <UnitInput value={q.unit} onChange={(u) => onChange({ ...q, unit: u ?? "" })} required />
          </Field>
        )}
        {q.kind !== "choose" && q.kind !== "when" && q.kind !== "formula" && (
          <Field label={t("unitLabel")} hint={t("unitHint")}>
            <UnitInput value={q.unit} onChange={(u) => onChange(put(q, "unit", u))} />
          </Field>
        )}
      </div>

      {q.kind === "formula" && (
        <FormulaValue label={t("formula")} value={q.expr} onChange={(v) => onChange({ ...q, expr: v })} slots={slots} placeholder={EXAMPLE.quantityFormula} />
      )}

      {(q.kind === "length" || q.kind === "area" || q.kind === "volume") && <Deductions value={q.deductions} onChange={(d) => onChange(put(q, "deductions", d))} slots={slots} />}

      {q.kind === "when" && (
        <div className="flex flex-col gap-3">
          <Field label={t("if")} wide hint={t("ifHint")}>
            <ExprInput slots={slots} value={q.if} onChange={(v) => onChange({ ...q, if: v ?? "" })} placeholder={EXAMPLE.whenIf} aria-label={t("if")} />
          </Field>
          <div className="flex flex-col gap-1">
            <span className="label-caps text-muted-foreground">{t("then")}</span>
            <QuantityEditor value={q.then} onChange={(v) => onChange({ ...q, then: v })} slots={slots} depth={depth + 1} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="label-caps text-muted-foreground">{t("otherwise")}</span>
            <QuantityEditor value={q.else} onChange={(v) => onChange({ ...q, else: v })} slots={slots} depth={depth + 1} />
          </div>
        </div>
      )}

      {q.kind === "choose" && <ChooseOptions q={q} onChange={onChange} slots={slots} depth={depth} />}
    </div>
  );
}

/** Ways of measuring, the ones that suit the elements first. */
function KindSelect({ value, suggest, onChange }: { value: QuantitySpec["kind"]; suggest?: QuantitySpec["kind"][]; onChange: (k: QuantitySpec["kind"]) => void }) {
  const t = useTranslations("ruleSetEditor.parts");
  const vocab = useVocab();
  const opt = (k: QuantitySpec["kind"]) => (
    <option key={k} value={k}>
      {vocab.words("quantityKindWords", k)}
    </option>
  );
  const first = (suggest ?? []).filter((k) => QUANTITY_KINDS.includes(k));
  const rest = QUANTITY_KINDS.filter((k) => !first.includes(k));
  return (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value as QuantitySpec["kind"])} data-testid="quantity-kind">
      {first.length ? (
        <>
          <optgroup label={t("usualKinds")}>{first.map(opt)}</optgroup>
          <optgroup label={t("otherKinds")}>{rest.map(opt)}</optgroup>
        </>
      ) : (
        QUANTITY_KINDS.map(opt)
      )}
    </select>
  );
}

function ChooseOptions({ q, onChange, slots, depth }: { q: Extract<QuantitySpec, { kind: "choose" }>; onChange: (v: QuantitySpec) => void; slots: Slots; depth: number }) {
  const t = useTranslations("ruleSetEditor.parts");
  const entries = Object.entries(q.options);
  const slot = isRef(q.pick) ? slots[q.pick.param] : undefined;
  const missing = slot?.type === "choice" ? slot.options.filter((o) => !(o in q.options)) : [];
  const setEntries = (e: [string, QuantitySpec][]) => onChange({ ...q, options: Object.fromEntries(e) });
  return (
    <div className="flex flex-col gap-3">
      {entries.map(([name, spec], i) => (
        <div className="flex flex-col gap-1" key={i}>
          <div className="flex items-center gap-2">
            <div className="w-48">
              <LazyText mono value={name} aria-label={t("optionName")} onCommit={(n) => setEntries(entries.map((e, j) => (j === i ? [n, e[1]] : e)))} />
            </div>
            {slot?.type === "choice" && slot.optionLabels?.[name] && <span className="text-muted-foreground">{slot.optionLabels[name]}</span>}
            <RemoveButton label={t("removeOption", { name })} onClick={() => setEntries(entries.filter((_, j) => j !== i))} />
          </div>
          <QuantityEditor value={spec} onChange={(v) => setEntries(entries.map((e, j) => (j === i ? [e[0], v] : e)))} slots={slots} depth={depth + 1} />
        </div>
      ))}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={linkButton} onClick={() => setEntries([...entries, [`option${entries.length + 1}`, { kind: "count" }]])}>
          {t("addOption")}
        </button>
        {missing.length > 0 && (
          <button type="button" className={linkButton} onClick={() => setEntries([...entries, ...missing.map((m): [string, QuantitySpec] => [m, { kind: "count" }])])}>
            {t("addSlotOptions", { options: missing.join(", ") })}
          </button>
        )}
      </div>
    </div>
  );
}

/* ================================================================ deductions */

function Deductions({ value, onChange, slots }: { value: DeductionRule[] | undefined; onChange: (v: DeductionRule[] | undefined) => void; slots: Slots }) {
  const t = useTranslations("ruleSetEditor.parts");
  const list = value ?? [];
  const set = (l: DeductionRule[]) => onChange(l.length ? l : undefined);
  return (
    <div className="flex flex-col gap-2" data-testid="deductions">
      <div className="flex items-center gap-3">
        <span className="label-caps text-muted-foreground">{t("deductions")}</span>
        <button type="button" className={linkButton} onClick={() => set([...list, { what: "openings", mode: "all" }])}>
          {t("addDeduction")}
        </button>
      </div>
      {list.length === 0 && <p className="text-muted-foreground">{t("noDeductions")}</p>}
      {list.map((d, i) => (
        <Deduction key={i} d={d} slots={slots} onChange={(x) => set(replaceAt(list, i, x))} onRemove={() => set(removeAt(list, i))} />
      ))}
    </div>
  );
}

function Deduction({ d, slots, onChange, onRemove }: { d: DeductionRule; slots: Slots; onChange: (d: DeductionRule) => void; onRemove: () => void }) {
  const t = useTranslations("ruleSetEditor.parts");
  const vocab = useVocab();
  const [narrow, setNarrow] = useState(!!d.where);
  const sized = isRef(d.mode) || MODES_WITH_SIZE.includes(d.mode) || d.threshold !== undefined;
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-border p-3">
      <div className="flex items-start gap-2">
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
          <Field label={t("takeOut")}>
            <Select value={d.what} options={DEDUCTION_WHAT} labels={(o) => vocab.words("deductWhat", o)} onChange={(w) => onChange({ ...d, what: w ?? "openings" })} />
          </Field>
          <ChoiceValue label={t("whichOnes")} value={d.mode} options={DEDUCTION_MODES} labels={(o) => vocab.words("deductModes", o)} onChange={(m) => onChange({ ...d, mode: m ?? "all" })} slots={slots} />
          {sized && (
            <>
              <NumberValue label={t("size")} value={d.threshold} onChange={(v) => onChange(put(d, "threshold", v))} slots={slots} placeholder={t("sizePlaceholder")} />
              <ChoiceValue label={t("sizeAs")} value={d.compareBy} options={COMPARE_BY} labels={(o) => t(`compareBy.${o}`)} onChange={(v) => onChange(put(d, "compareBy", v))} slots={slots} empty={t("sizeAsEmpty")} />
            </>
          )}
          <BoolValue label={t("addReveals")} value={d.addReveals} onChange={(v) => onChange(put(d, "addReveals", v))} slots={slots} dflt={false} />
        </div>
        <RemoveButton label={t("removeDeduction")} onClick={onRemove} />
      </div>
      {narrow ? (
        <Field label={t("onlyThose")} wide>
          <ExprInput slots={slots} value={d.where} onChange={(v) => onChange(put(d, "where", v))} placeholder={EXAMPLE.deductionWhere} aria-label={t("onlyThose")} />
        </Field>
      ) : (
        <button type="button" className={cn(linkButton, "self-start")} onClick={() => setNarrow(true)}>
          {t("onlySome")}
        </button>
      )}
      {d.what === "recesses" && <p className="text-muted-foreground">{t("recessesNote")}</p>}
      {d.what === "embedded" && <p className="text-muted-foreground">{t("embeddedNote")}</p>}
    </div>
  );
}

/* ================================================================ rounding, missing values */

export function RoundingEditor({ value, onChange, slots, inherit }: { value: Rounding | undefined; onChange: (v: Rounding | undefined) => void; slots: Slots; inherit?: string }) {
  const t = useTranslations("ruleSetEditor.parts");
  const from = inherit ?? t("ruleSetDefault");
  if (!value)
    return (
      <Field label={t("rounding")} group>
        <span className="text-muted-foreground">
          {t("usesDefault", { what: from })}{" "}
          <button type="button" className={linkButton} onClick={() => onChange({ step: 0.01, mode: "nearest", at: "line" })}>
            {t("setRounding")}
          </button>
        </span>
      </Field>
    );
  return (
    <>
      <NumberValue label={t("roundStep")} value={value.step} onChange={(v) => onChange({ ...value, step: v ?? 0.01 })} slots={slots} />
      <ChoiceValue label={t("round")} value={value.mode} options={["nearest", "up", "down"] as const} labels={(o) => t(`roundModes.${o}`)} onChange={(v) => onChange({ ...value, mode: v ?? "nearest" })} slots={slots} />
      <ChoiceValue label={t("roundAt")} value={value.at} options={["element", "line"] as const} labels={(o) => t(`roundAtValues.${o}`)} onChange={(v) => onChange({ ...value, at: v ?? "line" })} slots={slots} />
      <div className="flex items-end">
        <button type="button" className={linkButton} onClick={() => onChange(undefined)}>
          {t("useDefault", { what: from })}
        </button>
      </div>
    </>
  );
}

const MISSING = ["flag", "skip", "ask", "default"] as const;

export function OnMissingEditor({ value, onChange, slots, empty }: { value: OnMissing | undefined; onChange: (v: OnMissing | undefined) => void; slots: Slots; empty?: string }) {
  const t = useTranslations("ruleSetEditor.parts");
  const mode = value === undefined ? undefined : typeof value === "string" ? value : "default";
  return (
    <>
      <Field label={t("whenMissing")}>
        <Select value={mode} options={MISSING} labels={(o) => t(`missing.${o}`)} empty={empty ?? t("ruleSetDefault")} onChange={(m) => onChange(m === "default" ? { default: 0 } : m)} />
      </Field>
      {typeof value === "object" && <NumberValue label={t("defaultValue")} value={value.default} onChange={(v) => onChange({ default: v ?? 0 })} slots={slots} />}
    </>
  );
}
