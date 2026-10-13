/**
 * Building blocks of the rule-set editor: selectors, quantity specs (recursive:
 * choose / when nest other specs), deductions, rounding and missing-value handling.
 */
import { useId } from "react";
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
  COMPARE_BY,
  DEDUCTION_MODES,
  DEDUCTION_WHAT,
  FAMILIES,
  IFC_CLASSES,
  LENGTH_BASES,
  MASS_BASES,
  OP_LABEL,
  QUANTITY_KINDS,
  QUANTITY_KIND_LABEL,
  SELECTOR_FIELDS,
  SELECTOR_OPS,
  UNITS,
} from "./vocab";
import { ExprInput, Field, LazyText, LogicTree, Num, Options, Select, Text, ToggleChips, ValueField, isRef, parseLiteral } from "./fields";
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
const LEAF_LABEL: Record<LeafKind, string> = { ifcClass: "IFC class", field: "Field", family: "Family", expr: "Expression" };

const listOf = (v: unknown) => (Array.isArray(v) ? v : v === undefined || v === "" ? [] : [v]);
const fmtList = (v: unknown) => listOf(v).map(String).join(", ");
const parseList = (s: string) => s.split(",").map((x) => parseLiteral(x)).filter((x) => x !== "");
const oneOrMany = <T,>(l: T[]): T | T[] => (l.length === 1 ? l[0] : l);

function SelectorLeaf({ value, onChange, slots }: { value: Selector; onChange: (v: Selector) => void; slots: Slots }) {
  const kind = leafKind(value);
  const ids = { fields: useId(), classes: useId() };
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
          <LazyText mono list={ids.fields} value={value.field} placeholder="field or props.Pset.Prop" onCommit={(s) => onChange({ ...value, field: s.trim() as typeof value.field })} />
          <Options id={ids.fields} values={SELECTOR_FIELDS} />
          <Select<SelectorOp> value={value.op} options={SELECTOR_OPS} labels={OP_LABEL} onChange={(op) => onChange(put({ ...value, op: op ?? "eq" }, "value", op === "exists" || op === "missing" ? undefined : value.value))} />
          {value.op !== "exists" && value.op !== "missing" && (
            <ValueField<unknown> value={value.value as Value<unknown>} onChange={(v) => onChange(put(value, "value", v))} slots={slots}>
              {(lit, set) =>
                value.op === "in" || value.op === "not_in" || value.op === "between" ? (
                  <LazyText value={fmtList(lit)} placeholder={value.op === "between" ? "min, max" : "a, b, c"} onCommit={(s) => set(parseList(s))} />
                ) : (
                  <LazyText value={lit === undefined ? "" : String(lit)} placeholder={value.op === "under" ? "term, e.g. concrete" : "value"} onCommit={(s) => set(value.op === "matches" ? s : parseLiteral(s))} />
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

/** One-line text for list rows. */
export function describeSelector(s: Selector): string {
  if ("all" in s) return s.all.map(describeSelector).join(" and ");
  if ("any" in s) return s.any.map(describeSelector).join(" or ");
  if ("not" in s) return `not (${describeSelector(s.not)})`;
  if ("ifcClass" in s) return fmtList(s.ifcClass);
  if ("family" in s) return `${fmtList(s.family)} family`;
  if ("expr" in s) return s.expr;
  const v = isRef(s.value) ? `p.${s.value.param}` : fmtList(s.value);
  return `${s.field} ${OP_LABEL[s.op]}${v ? ` ${v}` : ""}`;
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
function ChoiceValue<T extends string>({ label, value, options, onChange, slots, empty }: {
  label: string;
  value: Value<T> | undefined;
  options: readonly T[];
  onChange: (v: Value<T> | undefined) => void;
  slots: Slots;
  empty?: string;
}) {
  return (
    <Field label={label} group>
      <ValueField<T> value={value} onChange={onChange} slots={slots} slotType="choice">
        {(lit, set) => <Select<T> value={lit} options={options} onChange={set} empty={empty} />}
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

export function QuantityEditor({ value, onChange, slots, depth = 0 }: { value: QuantitySpec; onChange: (v: QuantitySpec) => void; slots: Slots; depth?: number }) {
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
          <Select value={q.kind} options={QUANTITY_KINDS} labels={QUANTITY_KIND_LABEL} onChange={(k) => k && setKind(k)} />
        </Field>
        {q.kind === "length" && <ChoiceValue label="Length basis" value={q.basis} options={LENGTH_BASES} onChange={(v) => onChange(put(q, "basis", v))} slots={slots} empty="default" />}
        {q.kind === "area" && (
          <>
            <ChoiceValue label="Surface" value={q.surface} options={AREA_SURFACES} onChange={(v) => onChange(put(q, "surface", v))} slots={slots} empty="main" />
            <ChoiceValue label="Start from" value={q.start} options={["gross", "net"] as const} onChange={(v) => onChange(put(q, "start", v))} slots={slots} empty="default" />
          </>
        )}
        {q.kind === "volume" && <ChoiceValue label="Start from" value={q.start} options={["gross", "net"] as const} onChange={(v) => onChange(put(q, "start", v))} slots={slots} empty="default" />}
        {q.kind === "mass" && (
          <>
            <ChoiceValue label="Mass from" value={q.basis} options={MASS_BASES} onChange={(v) => onChange({ ...q, basis: v ?? "nominal_per_length" })} slots={slots} />
            <NumberValue label="Density (kg/m3)" value={q.density} onChange={(v) => onChange(put(q, "density", v))} slots={slots} placeholder="from material" />
          </>
        )}
        {q.kind === "choose" && (
          <Field label="Pick option by" group hint="Usually a choice slot, so a standard picks the method.">
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
          <Field label="Unit">
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
          <Field label="If" wide>
            <ExprInput slots={slots} value={q.if} onChange={(v) => onChange({ ...q, if: v ?? "" })} placeholder="thickness >= p.masonry_volume_from" />
          </Field>
          <div className="branch">
            <span className="branch-label">then</span>
            <QuantityEditor value={q.then} onChange={(v) => onChange({ ...q, then: v })} slots={slots} depth={depth + 1} />
          </div>
          <div className="branch">
            <span className="branch-label">else</span>
            <QuantityEditor value={q.else} onChange={(v) => onChange({ ...q, else: v })} slots={slots} depth={depth + 1} />
          </div>
        </div>
      )}

      {q.kind === "choose" && <ChooseOptions q={q} onChange={onChange} slots={slots} depth={depth} />}
    </div>
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

/** Short text for list rows, e.g. "area (main, gross) − openings". */
export function describeQuantity(q: QuantitySpec): string {
  const ref = (v: unknown) => (isRef(v) ? `p.${v.param}` : v === undefined ? "" : String(v));
  switch (q.kind) {
    case "when":
      return `if … ${describeQuantity(q.then)} else ${describeQuantity(q.else)}`;
    case "choose":
      return `by ${ref(q.pick)}: ${Object.keys(q.options).join(" | ")}`;
    case "formula":
      return `formula, ${q.unit}`;
    default: {
      const bits = [("surface" in q && ref(q.surface)) || "", ("basis" in q && ref(q.basis)) || "", ("start" in q && ref(q.start)) || ""].filter(Boolean);
      const ded = "deductions" in q && q.deductions?.length ? " − openings" : "";
      return `${q.kind}${bits.length ? ` (${bits.join(", ")})` : ""}${ded}${"unit" in q && q.unit ? `, ${q.unit}` : ""}`;
    }
  }
}

/* ================================================================ deductions */

function Deductions({ value, onChange, slots }: { value: DeductionRule[] | undefined; onChange: (v: DeductionRule[] | undefined) => void; slots: Slots }) {
  const list = value ?? [];
  const set = (l: DeductionRule[]) => onChange(l.length ? l : undefined);
  return (
    <div className="deductions">
      <div className="ed-section-head">
        <span className="f-label">Deductions</span>
        <button type="button" className="link small" onClick={() => set([...list, { what: "openings", mode: "all" }])}>
          + Deduction
        </button>
      </div>
      {list.length === 0 && <p className="hint">Nothing is deducted.</p>}
      {list.map((d, i) => (
        <div key={i} className="ded">
          <div className="f-grid">
            <Field label="Deduct">
              <Select value={d.what} options={DEDUCTION_WHAT} onChange={(w) => set(replaceAt(list, i, { ...d, what: w ?? "openings" }))} />
            </Field>
            <ChoiceValue label="When" value={d.mode} options={DEDUCTION_MODES} onChange={(m) => set(replaceAt(list, i, { ...d, mode: m ?? "all" }))} slots={slots} />
            <NumberValue label="Threshold" value={d.threshold} onChange={(v) => set(replaceAt(list, i, put(d, "threshold", v)))} slots={slots} />
            <ChoiceValue label="Compare by" value={d.compareBy} options={COMPARE_BY} onChange={(v) => set(replaceAt(list, i, put(d, "compareBy", v)))} slots={slots} empty="area" />
            <BoolValue label="Add reveals back" value={d.addReveals} onChange={(v) => set(replaceAt(list, i, put(d, "addReveals", v)))} slots={slots} dflt={false} />
            <button type="button" className="icon ded-x" aria-label="Remove deduction" onClick={() => set(removeAt(list, i))}>
              ×
            </button>
          </div>
          <Field label="Only openings where" wide>
            <ExprInput slots={slots} value={d.where} onChange={(v) => set(replaceAt(list, i, put(d, "where", v)))} placeholder='kind = "window"' />
          </Field>
          {d.what === "recesses" && <p className="note small">Recesses: openings the model marks as recesses. Deducted as their face area, or area x recess depth for volumes; never part of “openings”.</p>}
          {d.what === "embedded" && <p className="note small">Columns and beams passing through (rooms: columns standing in them), as the area they take, or that area x thickness for volumes.</p>}
        </div>
      ))}
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
