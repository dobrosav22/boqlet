/**
 * Building blocks of the rule-set editor: selectors, quantity specs (recursive:
 * choose / when nest other specs), deductions, rounding and missing-value handling.
 */
import { useId, useState } from "react";
import type {
  DeductionRule,
  ElementFamily,
  OnMissing,
  Param,
  QuantitySpec,
  Rounding,
  Selector,
  SelectorOp,
  Value,
} from "@ifc-boq/types";
import {
  AREA_SURFACES,
  BREAKDOWNS,
  CLASS_GROUPS,
  COMPARE_BY,
  DEDUCTION_MODES,
  DEDUCTION_WHAT,
  DEDUCT_MODE_WORDS,
  DEDUCT_WHAT_WORDS,
  FAMILIES,
  IFC_CLASSES,
  LENGTH_BASES,
  LENGTH_WORDS,
  MASS_BASES,
  MASS_WORDS,
  MEASURED_FIELDS,
  MODES_WITH_SIZE,
  OP_LABEL,
  QUANTITY_KINDS,
  QUANTITY_KIND_WORDS,
  SELECTOR_OPS,
  START_WORDS,
  SURFACE_WORDS,
  TEXT_FIELDS,
  UNITS,
  classWords,
} from "./vocab";
import { ExprInput, Field, LazyText, LogicTree, Num, Options, Select, Text, ToggleChips, ValueField, isRef, parseLiteral } from "./fields";
import { cap, composeMatch, decomposeMatch, fieldWords } from "./itemStory";
import { put, removeAt, replaceAt } from "./store";

type Slots = Record<string, Param>;

/* ================================================================ selectors */

type LeafKind = "field" | "ifcClass" | "family" | "expr";
const leafKind = (s: Selector): LeafKind => ("field" in s ? "field" : "ifcClass" in s ? "ifcClass" : "family" in s ? "family" : "expr");
const LEAF_TEMPLATES: Record<LeafKind, Selector> = {
  ifcClass: { ifcClass: "IfcWall" },
  field: { field: "material", op: "under", value: "concrete" },
  family: { family: "planar" },
  expr: { expr: "" },
};
const LEAF_LABEL: Record<LeafKind, string> = { field: "A value", ifcClass: "Element kind", family: "Measurement family", expr: "Formula" };

const listOf = (v: unknown) => (Array.isArray(v) ? v : v === undefined || v === "" ? [] : [v]);
const fmtList = (v: unknown) => listOf(v).map(String).join(", ");
const parseList = (s: string) => s.split(",").map((x) => parseLiteral(x)).filter((x) => x !== "");
const oneOrMany = <T,>(l: T[]): T | T[] => (l.length === 1 ? l[0] : l);

function SelectorLeaf({ value, onChange, slots }: { value: Selector; onChange: (v: Selector) => void; slots: Slots }) {
  const kind = leafKind(value);
  const ids = { classes: useId() };
  return (
    <div className="leaf">
      <select value={kind} onChange={(e) => onChange(LEAF_TEMPLATES[e.target.value as LeafKind])} aria-label="Condition type">
        {(Object.keys(LEAF_LABEL) as LeafKind[]).map((k) => (
          <option key={k} value={k}>
            {LEAF_LABEL[k]}
          </option>
        ))}
      </select>
      {"ifcClass" in value && (
        <>
          <LazyText mono list={ids.classes} value={fmtList(value.ifcClass)} placeholder="IfcWall, IfcSlab" onCommit={(s) => onChange({ ...value, ifcClass: oneOrMany(s.split(",").map((x) => x.trim()).filter(Boolean)) })} />
          <Options id={ids.classes} values={IFC_CLASSES} />
        </>
      )}
      {"family" in value && (
        <ToggleChips<ElementFamily> options={FAMILIES} selected={listOf(value.family) as ElementFamily[]} onChange={(l) => onChange({ family: oneOrMany(l) })} />
      )}
      {"expr" in value && <ExprInput slots={slots} value={value.expr} onChange={(v) => onChange({ expr: v ?? "" })} placeholder='thickness > 0.2 AND UNDER(element_type, "wall.party")' />}
      {"field" in value && (
        <>
          <FieldPicker value={value.field} onChange={(f) => onChange({ ...value, field: f as typeof value.field })} />
          <Select<SelectorOp> value={value.op} options={SELECTOR_OPS} labels={OP_LABEL} onChange={(op) => onChange(put({ ...value, op: op ?? "eq" }, "value", op === "exists" || op === "missing" ? undefined : value.value))} />
          {value.op !== "exists" && value.op !== "missing" && (
            <ValueField<unknown> value={value.value as Value<unknown>} onChange={(v) => onChange(put(value, "value", v))} slots={slots}>
              {(lit, set) =>
                value.op === "in" || value.op === "not_in" || value.op === "between" ? (
                  <LazyText value={fmtList(lit)} placeholder={value.op === "between" ? "min, max" : "a, b, c"} onCommit={(s) => set(parseList(s))} />
                ) : (
                  <LazyText value={lit === undefined ? "" : String(lit)} placeholder={value.op === "under" ? "dictionary term, e.g. concrete" : "value"} onCommit={(s) => set(value.op === "matches" ? s : parseLiteral(s))} />
                )
              }
            </ValueField>
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
  const known = (TEXT_FIELDS as readonly string[]).includes(value) || (MEASURED_FIELDS as readonly string[]).includes(value);
  return (
    <>
      <select value={known ? value : "__prop"} onChange={(e) => onChange(e.target.value === "__prop" ? "props." : e.target.value)} aria-label="Field">
        <optgroup label="Describing the element">
          {TEXT_FIELDS.map((f) => (
            <option key={f} value={f}>
              {cap(fieldWords(f))}
            </option>
          ))}
        </optgroup>
        <optgroup label="Measured">
          {MEASURED_FIELDS.map((f) => (
            <option key={f} value={f}>
              {cap(fieldWords(f))}
            </option>
          ))}
        </optgroup>
        <option value="__prop">A property set value…</option>
      </select>
      {!known && <LazyText mono value={value.replace(/^props\./, "")} placeholder="Pset_WallCommon.FireRating" onCommit={(s) => onChange(`props.${s.trim()}`)} />}
    </>
  );
}

/** A select that adds one kind of element: those in the loaded model first, with their counts. */
export function ClassPicker({ onPick, exclude = [], counts, prompt }: { onPick: (c: string) => void; exclude?: string[]; counts?: Record<string, number>; prompt: string }) {
  const inModel = Object.entries(counts ?? {})
    .filter(([c, n]) => n > 0 && !exclude.includes(c) && c !== "IfcOpeningElement")
    .sort((a, b) => b[1] - a[1]);
  const grouped = new Set(CLASS_GROUPS.flatMap(([, l]) => l));
  const other = IFC_CLASSES.filter((c) => !grouped.has(c) && !exclude.includes(c));
  const opt = (c: string) => (
    <option key={c} value={c}>
      {cap(classWords(c))}
      {counts?.[c] ? ` (${counts[c]})` : ""}
    </option>
  );
  return (
    <select className="class-pick" value="" onChange={(e) => e.target.value && onPick(e.target.value)} aria-label={prompt}>
      <option value="">{prompt}</option>
      {inModel.length > 0 && <optgroup label="In the loaded model">{inModel.map(([c]) => opt(c))}</optgroup>}
      {CLASS_GROUPS.map(([title, list]) => (
        <optgroup key={title} label={title}>
          {list.filter((c) => !exclude.includes(c)).map(opt)}
        </optgroup>
      ))}
      {other.length > 0 && <optgroup label="Other">{other.map(opt)}</optgroup>}
    </select>
  );
}

/**
 * "Which elements" as people think of it: kinds of element (walls, doors), then conditions that
 * narrow them down ("only where", "except where"). Any selector fits: what is not a list of kinds
 * shows as conditions, so nothing is lost.
 */
export function WhatEditor({ value, onChange, slots, counts }: { value: Selector; onChange: (v: Selector) => void; slots: Slots; counts?: Record<string, number> }) {
  const { classes, extra } = decomposeMatch(value);
  const set = (c: string[], e: Selector[]) => onChange(composeMatch(c, e));
  const leaf = (l: Selector, s: (v: Selector) => void) => <SelectorLeaf value={l} onChange={s} slots={slots} />;
  const blank: Selector = { field: "material", op: "under", value: "" };
  return (
    <>
      <Field label="Kinds of element" group wide hint={counts ? "Numbers are how many the loaded model has." : "Load a model in the BoQ view to see how many of each it has."}>
        <div className="slist">
          {classes.map((c, i) => (
            <span key={c} className="chip" title={c}>
              {cap(classWords(c))}
              {counts && <span className="chip-count">{counts[c] ?? 0}</span>}
              <button type="button" className="chip-x" aria-label={`Remove ${classWords(c)}`} onClick={() => set(removeAt(classes, i), extra)}>
                ×
              </button>
            </span>
          ))}
          <ClassPicker prompt={classes.length ? "+ another kind…" : "+ pick a kind of element…"} exclude={classes} counts={counts} onPick={(c) => set([...classes, c], extra)} />
        </div>
        {classes.length === 0 && extra.length === 0 && <span className="error small">Nothing picked: this item takes no elements.</span>}
        {classes.length === 0 && extra.length > 0 && <span className="f-hint">No kind picked: any element that meets the conditions below.</span>}
      </Field>
      <Field label="Narrow it down" group wide hint="Optional. “Is a kind of” uses the dictionary: material is a kind of concrete also takes “concrete.in_situ”.">
        {extra.length === 0 && <span className="muted small">No conditions: all of them.</span>}
        {extra.map((x, i) => (
          <div key={i} className="what-cond">
            <span className="what-tag">{"not" in x ? "except where" : "only where"}</span>
            <LogicTree<Selector>
              value={"not" in x ? x.not : x}
              onChange={(v) => set(classes, replaceAt(extra, i, "not" in x ? { not: v } : v))}
              onRemove={() => set(classes, removeAt(extra, i))}
              renderLeaf={leaf}
              newLeaf={() => blank}
            />
          </div>
        ))}
        <div className="lt-add">
          <button type="button" className="link small" onClick={() => set(classes, [...extra, blank])}>
            + Only where…
          </button>
          <button type="button" className="link small" onClick={() => set(classes, [...extra, { not: blank }])}>
            + Except where…
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
  const id = useId();
  return (
    <>
      <Text value={value} onChange={(v) => onChange(required ? v ?? "" : v)} list={id} placeholder={required ? "unit" : "default"} />
      <Options id={id} values={UNITS} />
    </>
  );
}

/** Choice-valued field that may be bound to a slot. */
function ChoiceValue<T extends string>({ label, value, options, onChange, slots, empty, labels, hint }: {
  label: string;
  value: Value<T> | undefined;
  options: readonly T[];
  onChange: (v: Value<T> | undefined) => void;
  slots: Slots;
  empty?: string;
  labels?: Partial<Record<T, string>>;
  hint?: string;
}) {
  return (
    <Field label={label} group hint={hint}>
      <ValueField<T> value={value} onChange={onChange} slots={slots} slotType="choice">
        {(lit, set) => <Select<T> value={lit} options={options} onChange={set} empty={empty} labels={labels} />}
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
        {(lit, set) => <Num value={lit} onChange={set} placeholder={placeholder} />}
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
        {(lit, set) => <ExprInput slots={slots} value={lit} onChange={(v) => set(v ?? "")} rows={2} placeholder={placeholder} />}
      </ValueField>
    </Field>
  );
}

export function BoolValue({ label, value, onChange, slots, dflt }: { label: string; value: Value<boolean> | undefined; onChange: (v: Value<boolean> | undefined) => void; slots: Slots; dflt: boolean }) {
  return (
    <Field label={label} group>
      <ValueField<boolean> value={value} onChange={onChange} slots={slots} slotType="boolean">
        {(lit, set) => (
          <label className="option inline">
            <input type="checkbox" checked={lit ?? dflt} onChange={(e) => set(e.target.checked === dflt ? undefined : e.target.checked)} />
            <span>{(lit ?? dflt) ? "yes" : "no"}</span>
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
  const q = value;
  const setKind = (k: QuantitySpec["kind"]) => {
    const t = KIND_TEMPLATE[k];
    const unit = "unit" in q ? q.unit : undefined;
    onChange(unit && k !== "choose" && k !== "when" ? ({ ...t, unit } as QuantitySpec) : t);
  };
  return (
    <div className={`qty ${depth ? "qty-nested" : ""}`}>
      <div className="f-grid">
        <Field label="Measure by">
          <KindSelect value={q.kind} suggest={suggest} onChange={setKind} />
        </Field>
        {q.kind === "length" && <ChoiceValue label="Length taken" value={q.basis} options={LENGTH_BASES} labels={LENGTH_WORDS} onChange={(v) => onChange(put(q, "basis", v))} slots={slots} empty="usual (along the axis)" />}
        {q.kind === "area" && (
          <>
            <ChoiceValue label="Which surface" value={q.surface} options={AREA_SURFACES} labels={SURFACE_WORDS} onChange={(v) => onChange(put(q, "surface", v))} slots={slots} empty="main face (usual)" />
            <ChoiceValue label="Start from" value={q.start} options={["gross", "net"] as const} labels={START_WORDS} onChange={(v) => onChange(put(q, "start", v))} slots={slots} empty="usual" />
          </>
        )}
        {q.kind === "volume" && <ChoiceValue label="Start from" value={q.start} options={["gross", "net"] as const} labels={START_WORDS} onChange={(v) => onChange(put(q, "start", v))} slots={slots} empty="usual" />}
        {q.kind === "mass" && (
          <>
            <ChoiceValue label="Weight from" value={q.basis} options={MASS_BASES} labels={MASS_WORDS} onChange={(v) => onChange({ ...q, basis: v ?? "nominal_per_length" })} slots={slots} />
            <NumberValue label="Density (kg/m3)" value={q.density} onChange={(v) => onChange(put(q, "density", v))} slots={slots} placeholder="from material" />
          </>
        )}
        {q.kind === "choose" && (
          <Field label="Which answer chooses" group hint="Usually a Settings question with a choice of answers; each answer gets its own way of measuring below.">
            <ValueField<string> value={q.pick} onChange={(v) => onChange({ ...q, pick: v ?? "" })} slots={slots} slotType="choice">
              {(lit, set) => <Text value={lit} onChange={(v) => set(v ?? "")} placeholder="option name" />}
            </ValueField>
          </Field>
        )}
        {q.kind === "formula" && (
          <Field label="Unit">
            <UnitInput value={q.unit} onChange={(u) => onChange({ ...q, unit: u ?? "" })} required />
          </Field>
        )}
        {q.kind !== "choose" && q.kind !== "when" && q.kind !== "formula" && (
          <Field label="Unit" hint="Empty: the usual unit (nr, m, m2, m3, kg).">
            <UnitInput value={q.unit} onChange={(u) => onChange(put(q, "unit", u))} />
          </Field>
        )}
      </div>

      {q.kind === "formula" && (
        <FormulaValue label="Formula" value={q.expr} onChange={(v) => onChange({ ...q, expr: v })} slots={slots} placeholder="net_area - SUM(openings.area WHERE area > p.opening_threshold)" />
      )}

      {(q.kind === "length" || q.kind === "area" || q.kind === "volume") && (
        <Deductions value={q.deductions} onChange={(d) => onChange(put(q, "deductions", d))} slots={slots} />
      )}

      {q.kind === "when" && (
        <div className="branches">
          <Field label="If" wide hint="A condition on the element, e.g. [Thickness] >= 0.25: then measure one way, otherwise the other.">
            <ExprInput slots={slots} value={q.if} onChange={(v) => onChange({ ...q, if: v ?? "" })} placeholder="thickness >= p.masonry_volume_from" />
          </Field>
          <div className="branch">
            <span className="branch-label">then</span>
            <QuantityEditor value={q.then} onChange={(v) => onChange({ ...q, then: v })} slots={slots} depth={depth + 1} />
          </div>
          <div className="branch">
            <span className="branch-label">otherwise</span>
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
  const opt = (k: QuantitySpec["kind"]) => (
    <option key={k} value={k}>
      {QUANTITY_KIND_WORDS[k]}
    </option>
  );
  const first = (suggest ?? []).filter((k) => QUANTITY_KINDS.includes(k));
  const rest = QUANTITY_KINDS.filter((k) => !first.includes(k));
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as QuantitySpec["kind"])}>
      {first.length ? (
        <>
          <optgroup label="Usual for these elements">{first.map(opt)}</optgroup>
          <optgroup label="Other ways">{rest.map(opt)}</optgroup>
        </>
      ) : (
        QUANTITY_KINDS.map(opt)
      )}
    </select>
  );
}

function ChooseOptions({ q, onChange, slots, depth }: { q: Extract<QuantitySpec, { kind: "choose" }>; onChange: (v: QuantitySpec) => void; slots: Slots; depth: number }) {
  const entries = Object.entries(q.options);
  const slot = isRef(q.pick) ? slots[q.pick.param] : undefined;
  const missing = slot?.type === "choice" ? slot.options.filter((o) => !(o in q.options)) : [];
  const setEntries = (e: [string, QuantitySpec][]) => onChange({ ...q, options: Object.fromEntries(e) });
  return (
    <div className="branches">
      {entries.map(([name, spec], i) => (
        <div className="branch" key={i}>
          <span className="branch-label">
            <LazyText mono value={name} onCommit={(n) => setEntries(entries.map((e, j) => (j === i ? [n, e[1]] : e)))} />
            {slot?.type === "choice" && slot.optionLabels?.[name] && <span className="branch-name">{slot.optionLabels[name]}</span>}
            <button type="button" className="icon" aria-label={`Remove option ${name}`} onClick={() => setEntries(entries.filter((_, j) => j !== i))}>
              ×
            </button>
          </span>
          <QuantityEditor value={spec} onChange={(v) => setEntries(entries.map((e, j) => (j === i ? [e[0], v] : e)))} slots={slots} depth={depth + 1} />
        </div>
      ))}
      <div className="lt-add">
        <button type="button" className="link small" onClick={() => setEntries([...entries, [`option${entries.length + 1}`, { kind: "count" }]])}>
          + Option
        </button>
        {missing.length > 0 && (
          <button type="button" className="link small" onClick={() => setEntries([...entries, ...missing.map((m): [string, QuantitySpec] => [m, { kind: "count" }])])}>
            + Add the slot's options ({missing.join(", ")})
          </button>
        )}
      </div>
    </div>
  );
}

/* ================================================================ deductions */

function Deductions({ value, onChange, slots }: { value: DeductionRule[] | undefined; onChange: (v: DeductionRule[] | undefined) => void; slots: Slots }) {
  const list = value ?? [];
  const set = (l: DeductionRule[]) => onChange(l.length ? l : undefined);
  return (
    <div className="deductions">
      <div className="ed-section-head">
        <span className="f-label">Taken out (deductions)</span>
        <button type="button" className="link small" onClick={() => set([...list, { what: "openings", mode: "all" }])}>
          + Take something out
        </button>
      </div>
      {list.length === 0 && <p className="hint">Nothing is taken out: openings, doors and windows stay in the quantity.</p>}
      {list.map((d, i) => (
        <Deduction key={i} d={d} slots={slots} onChange={(x) => set(replaceAt(list, i, x))} onRemove={() => set(removeAt(list, i))} />
      ))}
    </div>
  );
}

function Deduction({ d, slots, onChange, onRemove }: { d: DeductionRule; slots: Slots; onChange: (d: DeductionRule) => void; onRemove: () => void }) {
  const [narrow, setNarrow] = useState(!!d.where);
  const sized = isRef(d.mode) || MODES_WITH_SIZE.includes(d.mode) || d.threshold !== undefined;
  return (
    <div className="ded">
      <div className="f-grid">
        <Field label="Take out">
          <Select value={d.what} options={DEDUCTION_WHAT} labels={DEDUCT_WHAT_WORDS} onChange={(w) => onChange({ ...d, what: w ?? "openings" })} />
        </Field>
        <ChoiceValue label="Which ones" value={d.mode} options={DEDUCTION_MODES} labels={DEDUCT_MODE_WORDS} onChange={(m) => onChange({ ...d, mode: m ?? "all" })} slots={slots} />
        {sized && (
          <>
            <NumberValue label="Size" value={d.threshold} onChange={(v) => onChange(put(d, "threshold", v))} slots={slots} placeholder="e.g. 0.5" />
            <ChoiceValue label="Size measured as" value={d.compareBy} options={COMPARE_BY} onChange={(v) => onChange(put(d, "compareBy", v))} slots={slots} empty="area (m2)" />
          </>
        )}
        <BoolValue label="Add the reveals back" value={d.addReveals} onChange={(v) => onChange(put(d, "addReveals", v))} slots={slots} dflt={false} />
        <button type="button" className="icon ded-x" aria-label="Remove deduction" onClick={onRemove}>
          ×
        </button>
      </div>
      {narrow ? (
        <Field label="Only those where" wide>
          <ExprInput slots={slots} value={d.where} onChange={(v) => onChange(put(d, "where", v))} placeholder='kind = "window"' />
        </Field>
      ) : (
        <button type="button" className="link small" onClick={() => setNarrow(true)}>
          + only some of them…
        </button>
      )}
      {d.what === "recesses" && <p className="note small">Recesses: openings the model marks as recesses. Deducted as their face area, or area x recess depth for volumes; never part of “openings”.</p>}
      {d.what === "embedded" && <p className="note small">Columns and beams passing through (rooms: columns standing in them), as the area they take, or that area x thickness for volumes.</p>}
    </div>
  );
}

/* ================================================================ rounding, missing values */

export function RoundingEditor({ value, onChange, slots, inherit = "rule set default" }: { value: Rounding | undefined; onChange: (v: Rounding | undefined) => void; slots: Slots; inherit?: string }) {
  if (!value)
    return (
      <Field label="Rounding" group>
        <span className="muted small">
          Uses the {inherit}.{" "}
          <button type="button" className="link small" onClick={() => onChange({ step: 0.01, mode: "nearest", at: "line" })}>
            Set own rounding
          </button>
        </span>
      </Field>
    );
  return (
    <>
      <NumberValue label="Round to step" value={value.step} onChange={(v) => onChange({ ...value, step: v ?? 0.01 })} slots={slots} />
      <ChoiceValue label="Round" value={value.mode} options={["nearest", "up", "down"] as const} onChange={(v) => onChange({ ...value, mode: v ?? "nearest" })} slots={slots} />
      <ChoiceValue label="Round at" value={value.at} options={["element", "line"] as const} onChange={(v) => onChange({ ...value, at: v ?? "line" })} slots={slots} />
      <Field label=" " group>
        <button type="button" className="link small" onClick={() => onChange(undefined)}>
          Use the {inherit}
        </button>
      </Field>
    </>
  );
}

const MISSING = ["flag", "skip", "ask", "default"] as const;
const MISSING_LABEL = { flag: "flag the line", skip: "skip the element", ask: "ask the user", default: "use a default value" };

export function OnMissingEditor({ value, onChange, slots, empty = "rule set default" }: { value: OnMissing | undefined; onChange: (v: OnMissing | undefined) => void; slots: Slots; empty?: string }) {
  const mode = value === undefined ? undefined : typeof value === "string" ? value : "default";
  return (
    <>
      <Field label="When a value is missing">
        <Select value={mode} options={MISSING} labels={MISSING_LABEL} empty={empty} onChange={(m) => onChange(m === "default" ? { default: 0 } : m)} />
      </Field>
      {typeof value === "object" && <NumberValue label="Default value" value={value.default} onChange={(v) => onChange({ default: v ?? 0 })} slots={slots} />}
    </>
  );
}

export { BREAKDOWNS };
