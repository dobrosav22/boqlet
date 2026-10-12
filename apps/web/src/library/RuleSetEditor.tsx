/**
 * Rule set editor (input 2). Works on a standalone RuleSet or a RuleSetPatch.
 *
 * For a patch, the parent is shown as the engine flattens it (from the Check endpoint),
 * so every slot and rule is marked inherited, changed here, new here or removed here.
 */
import { useMemo, useState, type ReactNode } from "react";
import type { Breakdown, DerivedRule, ItemRule, ManualItem, OurRuleType, Param, RuleSet, RuleSetPatch, Value } from "@ifc-boq/types";
import { BREAKDOWNS, MANUAL_KINDS, MEASURED_FIELDS, SELECTOR_FIELDS } from "./vocab";
import {
  ExprInput,
  Field,
  LazyText,
  RowList,
  Section,
  Select,
  StringList,
  Text,
  TextArea,
  ToggleChips,
  ValueField,
  fmtParam,
  isRef,
  matches,
  type RowInfo,
} from "./fields";
import { BoolValue, FormulaValue, NumberValue, OnMissingEditor, QuantityEditor, RoundingEditor, SelectorEditor, UnitInput, describeQuantity, describeSelector } from "./ruleParts";
import { JsonTab } from "./JsonTab";
import { Answer, QuestionsTab } from "./QuestionsTab";
import { isPatch, move, put, removeAt, replaceAt, uniqueId } from "./store";

type Slots = Record<string, Param>;
type Tab = "questions" | "overview" | "slots" | "items" | "derived" | "manual" | "json";

interface Props {
  doc: OurRuleType;
  onChange: (d: OurRuleType) => void;
  /** Patches: the parent as the engine flattens it; null while loading or when it cannot be resolved. */
  parent: RuleSet | null;
  parentNote?: string;
  ruleSetIds: string[];
}

export function RuleSetEditor({ doc, onChange, parent, parentNote, ruleSetIds }: Props) {
  const patch = isPatch(doc);
  const [tab, setTab] = useState<Tab>(patch || (doc as RuleSet).sections?.length ? "questions" : "overview");
  /** Rule to select when a tab opens (from "Used by" links in the questionnaire). */
  const [focus, setFocus] = useState<string | null>(null);
  const slots = useMemo(() => effectiveSlots(doc, parent), [doc, parent]);
  const removed = (patch && doc.remove) || [];

  const items = rowsFor(parent?.items, doc.items, removed, patch);
  const derived = rowsFor(parent?.derived, doc.derived, removed, patch);
  const manual = rowsFor(parent?.manual, doc.manual, removed, patch);
  const live = <T,>(rows: Row<T>[]) => rows.filter((r) => r.status !== "removed").map((r) => r.entry);
  const usage = useMemo(() => {
    const u = slotUsage([...live(items), ...live(derived), ...live(manual)] as { id: string }[]);
    // a slot read inside a formula slot (p.working_space in the excavation formula) is used by that formula's rules
    for (const [name, p] of Object.entries(slots))
      if (p.type === "formula")
        for (const m of p.value.matchAll(/\bp\.([A-Za-z_]\w*)/g)) u[m[1]] = [...new Set([...(u[m[1]] ?? []), ...(u[name] ?? [])])];
    return u;
  }, [items, derived, manual, slots]);

  const setList = (key: "items" | "derived" | "manual", list: unknown[]) =>
    onChange(patch ? put(doc as RuleSetPatch, key, list.length ? (list as never) : undefined) : ({ ...doc, [key]: list } as RuleSet));
  const setRemoved = (ids: string[]) => onChange(put(doc as RuleSetPatch, "remove", ids.length ? ids : undefined));

  const openRule = (id: string) => {
    setFocus(id);
    setTab(items.some((r) => r.id === id) ? "items" : derived.some((r) => r.id === id) ? "derived" : "manual");
  };
  const ruleLabel = (id: string) => {
    const r = [...items, ...derived].find((x) => x.id === id);
    return (r?.entry as { label?: string } | undefined)?.label ?? id;
  };

  const tabs: [Tab, string][] = [
    ["questions", "Questions"],
    ["overview", "Overview"],
    ["slots", `Slots (${Object.keys(slots).length})`],
    ["items", `Item rules (${live(items).length})`],
    ["derived", `Derived (${live(derived).length})`],
    ["manual", `Manual items (${live(manual).length})`],
    ["json", "JSON"],
  ];
  const itemIds = live(items).map((i) => (i as ItemRule).id);

  return (
    <>
      {patch && (
        <p className="note small">
          This set extends <b>{doc.extends}</b> and only stores its differences. {parentNote ?? (parent ? "" : "Loading the parent…")}
        </p>
      )}
      <nav className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "tab active" : "tab"} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="panel">
        {tab === "questions" && (
          <QuestionsTab doc={doc} onChange={onChange} parent={parent} slots={slots} usage={usage} ruleLabel={ruleLabel} onOpenRule={openRule} onOpenSlots={() => setTab("slots")} />
        )}
        {tab === "overview" && <Overview doc={doc} onChange={onChange} slots={slots} ruleSetIds={ruleSetIds} />}
        {tab === "slots" && <SlotsTab doc={doc} onChange={onChange} parent={parent} slots={slots} usage={usage} />}
        {tab === "items" && (
          <Collection<ItemRule>
            noun="item rule"
            initial={focus}
            hint="Each item rule takes model elements and turns them into BoQ lines."
            rows={items}
            patch={patch}
            own={doc.items ?? []}
            removed={removed}
            setOwn={(l) => setList("items", l)}
            setRemoved={setRemoved}
            make={(id) => ({ id, label: "New rule", match: { ifcClass: "IfcWall" }, quantity: { kind: "area" }, description: "{type_name}" })}
            summary={(e) => ({ title: e.label || e.id, sub: `${describeSelector(e.match)} → ${describeQuantity(e.quantity)}` })}
            form={(e, set) => <ItemForm item={e} onChange={set} slots={slots} />}
          />
        )}
        {tab === "derived" && (
          <Collection<DerivedRule>
            noun="derived rule"
            initial={focus}
            hint="Quantities for work that is not modelled (formwork, paint, reinforcement estimates), computed from item lines or their elements."
            rows={derived}
            patch={patch}
            own={doc.derived ?? []}
            removed={removed}
            setOwn={(l) => setList("derived", l)}
            setRemoved={setRemoved}
            make={(id) => ({ id, label: "New derived rule", from: itemIds.slice(0, 1), scope: "line", quantity: "src.qty", unit: "m2", description: "Derived" })}
            summary={(e) => ({ title: e.label || e.id, sub: `from ${e.from.join(", ") || "—"}: ${isRef(e.quantity) ? `formula slot ${e.quantity.param}` : e.quantity}` })}
            form={(e, set) => <DerivedForm rule={e} onChange={set} slots={slots} itemIds={itemIds} />}
          />
        )}
        {tab === "manual" && (
          <Collection<ManualItem>
            noun="manual item"
            initial={focus}
            hint="Lines with no model behind them: preliminaries, provisional sums, lump sums, dayworks. No quantity = a flagged line for the user to fill."
            rows={manual}
            patch={patch}
            own={doc.manual ?? []}
            removed={removed}
            setOwn={(l) => setList("manual", l)}
            setRemoved={setRemoved}
            make={(id) => ({ id, kind: "preliminary", description: "New item", unit: "item" })}
            summary={(e) => ({ title: typeof e.description === "string" ? e.description : e.id, sub: `${e.kind.replace(/_/g, " ")}, ${e.unit}` })}
            form={(e, set) => <ManualForm item={e} onChange={set} slots={slots} />}
          />
        )}
        {tab === "json" && <JsonTab value={doc} onChange={onChange} />}
      </div>
    </>
  );
}

/* ================================================================ inheritance */

type Status = "own" | "new" | "inherited" | "changed" | "removed";
interface Row<T> {
  id: string;
  entry: T;
  status: Status;
}

function rowsFor<T extends { id: string }>(parentList: T[] | undefined, own: T[] | undefined, removed: string[], patch: boolean): Row<T>[] {
  const mine = own ?? [];
  if (!patch) return mine.map((e) => ({ id: e.id, entry: e, status: "own" }));
  const byId = new Map(mine.map((e) => [e.id, e]));
  const parentIds = new Set((parentList ?? []).map((p) => p.id));
  const rows: Row<T>[] = (parentList ?? []).map((p) =>
    removed.includes(p.id)
      ? { id: p.id, entry: p, status: "removed" }
      : byId.has(p.id)
        ? { id: p.id, entry: byId.get(p.id)!, status: "changed" }
        : { id: p.id, entry: p, status: "inherited" },
  );
  return [...rows, ...mine.filter((e) => !parentIds.has(e.id)).map((e): Row<T> => ({ id: e.id, entry: e, status: "new" }))];
}

const BADGE: Record<Status, RowInfo["badge"]> = {
  own: undefined,
  new: { text: "new here", tone: "new" },
  inherited: { text: "inherited", tone: "inherited" },
  changed: { text: "changed here", tone: "changed" },
  removed: { text: "removed here", tone: "removed" },
};

function effectiveSlots(doc: OurRuleType, parent: RuleSet | null): Slots {
  const out: Slots = { ...(parent?.params ?? {}) };
  for (const [k, p] of Object.entries(doc.params ?? {})) {
    if ("type" in p) out[k] = p as Param;
    else if (out[k]) out[k] = { ...out[k], value: p.value } as Param;
  }
  return out;
}

/** slot name -> ids of the rules that read it (as {param} or p.name in a formula). */
function slotUsage(entries: { id: string }[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const e of entries) {
    const blob = JSON.stringify(e);
    const refs = new Set([...blob.matchAll(/"param":"([^"]+)"/g), ...blob.matchAll(/\bp\.([A-Za-z_]\w*)/g)].map((m) => m[1]));
    for (const r of refs) (out[r] ??= []).push(e.id);
  }
  return out;
}

/* ================================================================ list + detail with inheritance */

function Collection<T extends { id: string }>(p: {
  noun: string;
  hint: string;
  rows: Row<T>[];
  patch: boolean;
  own: T[];
  removed: string[];
  setOwn: (l: T[]) => void;
  setRemoved: (ids: string[]) => void;
  make: (id: string) => T;
  summary: (e: T) => { title: string; sub: string };
  form: (e: T, set: (e: T) => void) => ReactNode;
  initial?: string | null;
}) {
  const [sel, setSel] = useState<string | null>(p.initial && p.rows.some((r) => r.id === p.initial) ? p.initial : p.rows[0]?.id ?? null);
  const [q, setQ] = useState("");
  const row = p.rows.find((r) => r.id === sel) ?? null;
  const ownIndex = row ? p.own.findIndex((e) => e.id === row.id) : -1;
  const allIds = p.rows.map((r) => r.id);

  const add = () => {
    const id = uniqueId(p.noun.split(" ")[0] === "manual" ? "manual-item" : p.noun.replace(/ /g, "-"), allIds);
    p.setOwn([...p.own, p.make(id)]);
    setSel(id);
  };
  const update = (e: T) => {
    p.setOwn(replaceAt(p.own, ownIndex, e));
    if (e.id !== row?.id) setSel(e.id);
  };
  const editable = row && (row.status === "own" || row.status === "new" || row.status === "changed");

  const rowInfos: RowInfo[] = p.rows
    .filter((r) => matches(q, r.id, p.summary(r.entry).title, p.summary(r.entry).sub))
    .map((r) => ({ key: r.id, ...p.summary(r.entry), badge: BADGE[r.status] }));

  return (
    <>
      <p className="hint">{p.hint}</p>
      <div className="ld">
        <RowList rows={rowInfos} selected={sel} onSelect={setSel} onAdd={add} addLabel={`+ New ${p.noun}`} filter={q} onFilter={setQ} />
        <div className="ld-detail">
          {!row && <p className="muted">Select a {p.noun} on the left, or add one.</p>}
          {row && (
            <>
              <div className="ld-actions">
                {row.status === "inherited" && (
                  <>
                    <span className="muted small">Inherited unchanged from the parent.</span>
                    <button type="button" className="ghost small-btn" onClick={() => p.setOwn([...p.own, structuredClone(row.entry)])}>
                      Change in this set
                    </button>
                    <button type="button" className="ghost small-btn" onClick={() => p.setRemoved([...p.removed, row.id])}>
                      Leave out of this set
                    </button>
                  </>
                )}
                {row.status === "removed" && (
                  <>
                    <span className="muted small">The parent has this {p.noun}; this set leaves it out.</span>
                    <button type="button" className="ghost small-btn" onClick={() => p.setRemoved(p.removed.filter((x) => x !== row.id))}>
                      Bring back
                    </button>
                  </>
                )}
                {row.status === "changed" && (
                  <>
                    <span className="muted small">Changed in this set; replaces the parent's version.</span>
                    <button type="button" className="ghost small-btn" onClick={() => p.setOwn(removeAt(p.own, ownIndex))}>
                      Back to inherited
                    </button>
                  </>
                )}
                {(row.status === "own" || row.status === "new") && (
                  <>
                    <button
                      type="button"
                      className="ghost small-btn"
                      onClick={() => {
                        const id = uniqueId(`${row.id}-copy`, allIds);
                        p.setOwn([...p.own, { ...structuredClone(row.entry), id }]);
                        setSel(id);
                      }}
                    >
                      Duplicate
                    </button>
                    {row.status === "own" && (
                      <>
                        <button type="button" className="ghost small-btn" disabled={ownIndex === 0} onClick={() => p.setOwn(move(p.own, ownIndex, -1))}>
                          Move up
                        </button>
                        <button type="button" className="ghost small-btn" disabled={ownIndex === p.own.length - 1} onClick={() => p.setOwn(move(p.own, ownIndex, 1))}>
                          Move down
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="ghost small-btn danger"
                      onClick={() => {
                        p.setOwn(removeAt(p.own, ownIndex));
                        setSel(null);
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
              <fieldset className="ro" disabled={!editable}>
                {p.form(row.entry, update)}
              </fieldset>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ================================================================ forms */

function TextValue({ label, value, onChange, slots, placeholder, hint }: { label: string; value: Value<string> | undefined; onChange: (v: Value<string>) => void; slots: Slots; placeholder?: string; hint?: string }) {
  return (
    <Field label={label} group wide hint={hint}>
      <ValueField<string> value={value} onChange={(v) => onChange(v ?? "")} slots={slots} slotType="text">
        {(lit, set) => <Text value={lit} onChange={(v) => set(v ?? "")} placeholder={placeholder} optional={false} />}
      </ValueField>
    </Field>
  );
}

function ItemForm({ item, onChange, slots }: { item: ItemRule; onChange: (i: ItemRule) => void; slots: Slots }) {
  const set = <K extends keyof ItemRule>(k: K, v: ItemRule[K] | undefined) => onChange(put(item, k, v));
  return (
    <div className="form">
      <Section title="Rule">
        <Field label="Label">
          <Text value={item.label} onChange={(v) => set("label", v ?? "")} optional={false} />
        </Field>
        <Field label="Id" hint="Derived rules and classification maps refer to this.">
          <Text mono value={item.id} onChange={(v) => set("id", v ?? "")} optional={false} />
        </Field>
        <BoolValue label="Enabled" value={item.enabled} onChange={(v) => set("enabled", v)} slots={slots} dflt />
      </Section>

      <Section title="Which elements" hint="Match on IFC class, measurement family, dictionary terms (op “is under term”) or any measured field.">
        <div className="f-wide">
          <SelectorEditor value={item.match} onChange={(m) => set("match", m)} slots={slots} />
        </div>
        <Field label="Parts of assemblies" hint="Stair flights, roof slabs… are skipped when their parent is measured, unless included.">
          <Select value={item.parts} options={["skip", "include"] as const} empty="skip (default)" onChange={(v) => set("parts", v)} />
        </Field>
        <Field label="Break each element into" group>
          <ValueField<Breakdown> value={item.breakdown} onChange={(v) => set("breakdown", v)} slots={slots} slotType="choice">
            {(lit, s) => <Select<Breakdown> value={lit} options={BREAKDOWNS} empty="rule set default" onChange={s} />}
          </ValueField>
        </Field>
        <Field label="Keep only parts where" wide>
          <ExprInput value={item.partFilter} onChange={(v) => set("partFilter", v)} placeholder='NOT UNDER(material, "air_gap")' />
        </Field>
      </Section>

      <Section title="Quantity">
        <div className="f-wide">
          <QuantityEditor value={item.quantity} onChange={(q) => set("quantity", q)} slots={slots} />
        </div>
      </Section>

      <Section title="Lines" hint="Elements with the same values for these fields are summed into one line. The unit is always part of the key.">
        <Field label="Split lines by" wide group>
          <StringList mono values={item.lineKey as string[] | undefined} onChange={(v) => set("lineKey", v)} suggestions={SELECTOR_FIELDS} placeholder="type_name, storey, or an expression" />
        </Field>
        <TextValue label="Description" value={item.description} onChange={(v) => set("description", v)} slots={slots} placeholder="Wall, {type_name}, {thickness*1000} mm" hint="Placeholders: {field}, {p.slot}, {expr: …}. Missing values show as “-”." />
        <BandsEditor item={item} onChange={onChange} />
      </Section>

      <Section title="Adjustments">
        <NumberValue label="Factor" value={item.factor} onChange={(v) => set("factor", v)} slots={slots} placeholder="1" hint="Allowance or overlap multiplier." />
        {item.minimum ? (
          <>
            <NumberValue label="Minimum quantity" value={item.minimum.value} onChange={(v) => set("minimum", { ...item.minimum!, value: v ?? 0 })} slots={slots} />
            <Field label="Minimum per">
              <Select value={item.minimum.per as "element" | "line"} options={["element", "line"] as const} onChange={(v) => v ? set("minimum", { ...item.minimum!, per: v }) : set("minimum", undefined)} empty="(no minimum)" />
            </Field>
          </>
        ) : (
          <Field label="Minimum quantity" group>
            <button type="button" className="link small" onClick={() => set("minimum", { value: 0, per: "line" })}>
              Set a minimum
            </button>
          </Field>
        )}
        <RoundingEditor value={item.rounding} onChange={(v) => set("rounding", v)} slots={slots} />
        <OnMissingEditor value={item.onMissing} onChange={(v) => set("onMissing", v)} slots={slots} />
      </Section>

      <Section title="Labels and checks">
        <Field label="Tags" group hint="Classification maps can match on tags.">
          <StringList values={item.tags} onChange={(v) => set("tags", v)} />
        </Field>
        <Field label="Claims" group hint="Two rules claiming the same name on one element raise a double-count warning.">
          <StringList values={item.claims} onChange={(v) => set("claims", v)} suggestions={["body", "finish_side_a", "finish_side_b", "structure"]} />
        </Field>
        <Field label="Family (informative)" group wide>
          <ToggleChips options={["linear", "planar", "volumetric", "countable", "reinforcement", "assembly", "space", "void"] as const} selected={[item.family ?? []].flat()} onChange={(l) => set("family", l.length === 0 ? undefined : l.length === 1 ? l[0] : l)} />
        </Field>
        <Field label="Notes" wide>
          <TextArea value={item.notes} onChange={(v) => set("notes", v)} rows={2} />
        </Field>
      </Section>
    </div>
  );
}

function BandsEditor({ item, onChange }: { item: ItemRule; onChange: (i: ItemRule) => void }) {
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
    <Field label="Bands" group wide hint="Split lines by ranges of a field, e.g. height above 3.5 m. Edges are numbers or p.slot.">
      {bands.map((b, i) => (
        <div key={i} className="band">
          <Select value={b.field} options={MEASURED_FIELDS} onChange={(f) => setBands(replaceAt(bands, i, { ...b, field: f ?? "height" }))} />
          <LazyText value={b.edges.map(fmtEdge).join(", ")} placeholder="edges: 3.5, p.high" onCommit={(s) => setBands(replaceAt(bands, i, { ...b, edges: parseEdges(s) }))} />
          <LazyText value={(b.labels ?? []).join(", ")} placeholder="labels (optional)" onCommit={(s) => setBands(replaceAt(bands, i, put(b, "labels", s.trim() ? s.split(",").map((x) => x.trim()) : undefined)))} />
          <button type="button" className="icon" aria-label="Remove band" onClick={() => setBands(removeAt(bands, i))}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="link small" onClick={() => setBands([...bands, { field: "height", edges: [3.5] }])}>
        + Band
      </button>
    </Field>
  );
}

function DerivedForm({ rule, onChange, slots, itemIds }: { rule: DerivedRule; onChange: (r: DerivedRule) => void; slots: Slots; itemIds: string[] }) {
  const set = <K extends keyof DerivedRule>(k: K, v: DerivedRule[K] | undefined) => onChange(put(rule, k, v));
  const grouping = rule.lineKey === undefined ? "source" : rule.lineKey.length === 0 ? "single" : "fields";
  const unknown = rule.from.filter((f) => !itemIds.includes(f));
  return (
    <div className="form">
      <Section title="Rule">
        <Field label="Label">
          <Text value={rule.label} onChange={(v) => set("label", v ?? "")} optional={false} />
        </Field>
        <Field label="Id">
          <Text mono value={rule.id} onChange={(v) => set("id", v ?? "")} optional={false} />
        </Field>
        <BoolValue label="Enabled" value={rule.enabled} onChange={(v) => set("enabled", v)} slots={slots} dflt />
      </Section>
      <Section title="Derived from">
        <Field label="Item rules" group wide>
          <ToggleChips options={[...itemIds, ...unknown]} selected={rule.from} onChange={(l) => set("from", l)} />
          {unknown.length > 0 && <span className="error small">Not in this rule set: {unknown.join(", ")}</span>}
        </Field>
        <Field label="Evaluate per">
          <Select value={rule.scope} options={["line", "element"] as const} labels={{ line: "source line (src.qty)", element: "source element (src.<field>)" }} onChange={(v) => set("scope", v ?? "line")} />
        </Field>
        <Field label="Only sources where" wide>
          <ExprInput value={rule.where} onChange={(v) => set("where", v)} placeholder='UNDER(src.material, "concrete")' />
        </Field>
      </Section>
      <Section title="Quantity">
        <FormulaValue label="Formula" value={rule.quantity} onChange={(v) => set("quantity", v)} slots={slots} placeholder={rule.scope === "line" ? "src.qty * p.rebar_slab_kg_m3" : "SUM(src.faces.gross_area WHERE side = \"a\")"} />
        <Field label="Unit">
          <UnitInput value={rule.unit} onChange={(u) => set("unit", u ?? "")} required />
        </Field>
        <NumberValue label="Factor" value={rule.factor} onChange={(v) => set("factor", v)} slots={slots} placeholder="1" />
        <RoundingEditor value={rule.rounding} onChange={(v) => set("rounding", v)} slots={slots} />
        <OnMissingEditor value={rule.onMissing} onChange={(v) => set("onMissing", v)} slots={slots} />
      </Section>
      <Section title="Lines">
        <Field label="Lines">
          <Select
            value={grouping}
            options={["source", "fields", "single"] as const}
            labels={{ source: "one per source line", fields: "grouped by fields", single: "one single line" }}
            onChange={(g) => set("lineKey", g === "single" ? [] : g === "fields" ? ["type_name"] : undefined)}
          />
        </Field>
        {grouping === "fields" && (
          <Field label="Group by" group wide>
            <StringList mono values={rule.lineKey as string[]} onChange={(v) => set("lineKey", v ?? [])} suggestions={SELECTOR_FIELDS} />
          </Field>
        )}
        <TextValue label="Description" value={rule.description} onChange={(v) => set("description", v)} slots={slots} />
        <Field label="Tags" group>
          <StringList values={rule.tags} onChange={(v) => set("tags", v)} />
        </Field>
        <Field label="Notes" wide>
          <TextArea value={rule.notes} onChange={(v) => set("notes", v)} rows={2} />
        </Field>
      </Section>
    </div>
  );
}

function ManualForm({ item, onChange, slots }: { item: ManualItem; onChange: (i: ManualItem) => void; slots: Slots }) {
  const set = <K extends keyof ManualItem>(k: K, v: ManualItem[K] | undefined) => onChange(put(item, k, v));
  return (
    <div className="form">
      <Section title="Manual item">
        <Field label="Id">
          <Text mono value={item.id} onChange={(v) => set("id", v ?? "")} optional={false} />
        </Field>
        <Field label="Kind">
          <Select value={item.kind} options={MANUAL_KINDS} onChange={(v) => set("kind", v ?? "other")} />
        </Field>
        <BoolValue label="Enabled" value={item.enabled} onChange={(v) => set("enabled", v)} slots={slots} dflt />
        <TextValue label="Description" value={item.description} onChange={(v) => set("description", v)} slots={slots} />
        <Field label="Unit">
          <UnitInput value={item.unit} onChange={(u) => set("unit", u ?? "item")} required />
        </Field>
        <NumberValue label="Quantity" value={item.quantity} onChange={(v) => set("quantity", v)} slots={slots} placeholder="empty = user fills in" />
        <NumberValue label="Amount" value={item.amount} onChange={(v) => set("amount", v)} slots={slots} hint="Money value for provisional and lump sums." />
        <Field label="Tags" group>
          <StringList values={item.tags} onChange={(v) => set("tags", v)} />
        </Field>
      </Section>
    </div>
  );
}

/* ================================================================ overview */

function Overview({ doc, onChange, slots, ruleSetIds }: { doc: OurRuleType; onChange: (d: OurRuleType) => void; slots: Slots; ruleSetIds: string[] }) {
  const meta = doc.meta ?? {};
  const setMeta = (k: string, v: string | undefined) => onChange({ ...doc, meta: put(meta as Record<string, string>, k, v) } as OurRuleType);
  const defaults = doc.defaults ?? {};
  const setDefaults = (d: typeof defaults) => onChange(put(doc, "defaults", Object.keys(d).length ? d : undefined) as OurRuleType);
  const patch = isPatch(doc);
  return (
    <div className="form">
      <Section title="Identity">
        <Field label="Name">
          <Text value={doc.name} onChange={(v) => onChange({ ...doc, name: v ?? "" })} optional={false} />
        </Field>
        <Field label="Id" hint="Also the file name: presets/rules/<id>.json">
          <Text mono value={doc.id} onChange={(v) => onChange({ ...doc, id: v ?? "" })} optional={false} />
        </Field>
        <Field label="Version">
          <Text value={doc.version} onChange={(v) => onChange({ ...doc, version: v ?? "" })} optional={false} />
        </Field>
        {patch && (
          <Field label="Extends">
            <Select value={doc.extends} options={ruleSetIds.filter((x) => x !== doc.id)} onChange={(v) => v && onChange({ ...doc, extends: v })} />
          </Field>
        )}
      </Section>
      <Section title="About" hint={patch ? "Empty fields are taken from the parent." : undefined}>
        <Field label="Description" wide>
          <TextArea value={meta.description} onChange={(v) => setMeta("description", v)} />
        </Field>
        <Field label="Based on" hint="Free text, e.g. “our reading of NRM2”. Never a compliance claim.">
          <Text value={meta.basedOn} onChange={(v) => setMeta("basedOn", v)} />
        </Field>
        <Field label="Author">
          <Text value={meta.author} onChange={(v) => setMeta("author", v)} />
        </Field>
        <Field label="Description language">
          <Text value={meta.locale} onChange={(v) => setMeta("locale", v)} placeholder="en" />
        </Field>
        <Field label="Unit system">
          <Select value={meta.unitSystem} options={["metric", "imperial"] as const} empty={patch ? "from parent" : undefined} onChange={(v) => setMeta("unitSystem", v)} />
        </Field>
      </Section>
      <Section title="Defaults" hint="Apply to every rule that does not set its own.">
        <RoundingEditor value={defaults.rounding} onChange={(v) => setDefaults(put(defaults, "rounding", v))} slots={slots} inherit={patch ? "parent's default" : "engine default (none)"} />
        <OnMissingEditor value={defaults.onMissing} onChange={(v) => setDefaults(put(defaults, "onMissing", v))} slots={slots} empty={patch ? "from parent" : "flag (engine default)"} />
        <Field label="Break elements into">
          <Select value={defaults.breakdown} options={BREAKDOWNS} empty={patch ? "from parent" : "element"} onChange={(v) => setDefaults(put(defaults, "breakdown", v))} />
        </Field>
      </Section>
    </div>
  );
}

/* ================================================================ slots */

const PARAM_TYPES = ["number", "choice", "boolean", "text", "formula"] as const;

function SlotsTab({ doc, onChange, parent, slots, usage }: { doc: OurRuleType; onChange: (d: OurRuleType) => void; parent: RuleSet | null; slots: Slots; usage: Record<string, string[]> }) {
  const patch = isPatch(doc);
  const own = (doc.params ?? {}) as Record<string, Param | { value: Param["value"] }>;
  const [name, setName] = useState("");
  const [type, setType] = useState<Param["type"]>("number");
  const [q, setQ] = useState("");
  const setOwn = (k: string, v: Param | { value: Param["value"] } | undefined) => onChange({ ...doc, params: put(own, k, v) } as OurRuleType);

  const add = () => {
    const key = name.trim().replace(/\W+/g, "_");
    if (!key || slots[key]) return;
    const blank: Record<Param["type"], Param> = {
      number: { type: "number", value: 0, label: key.replace(/_/g, " ") },
      choice: { type: "choice", value: "a", options: ["a", "b"], label: key.replace(/_/g, " ") },
      boolean: { type: "boolean", value: false, label: key.replace(/_/g, " ") },
      text: { type: "text", value: "", label: key.replace(/_/g, " ") },
      formula: { type: "formula", value: "", unit: "m2", label: key.replace(/_/g, " ") },
    };
    setOwn(key, blank[type]);
    setName("");
  };

  const names = Object.keys(slots).filter((k) => matches(q, k, slots[k].label, slots[k].question));
  const sectionIds = ((patch ? parent?.sections : (doc as RuleSet).sections) ?? []).map((s) => s.id);
  return (
    <div>
      <p className="hint">
        Slots are the values a standard fills in. Rules point at them (the <span className="vf-toggle on static">slot</span> button on a field), so changing a value here never means editing a rule.
        {patch && " Inherited slots can be given a different value in this set."}
      </p>
      <div className="ld-tools">
        <input type="search" placeholder="Filter" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <table className="contrib slots">
        <thead>
          <tr>
            <th>Slot</th>
            <th>Value</th>
            <th>Label and settings</th>
            <th>Used by</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {names.map((k) => {
            const p = slots[k];
            const mine = own[k];
            const defined = !!mine && "type" in mine;
            const inheritedFrom = parent?.params[k];
            const status = !patch ? null : defined ? (inheritedFrom ? "redefined here" : "new here") : mine ? "changed here" : "inherited";
            const setValue = (v: Param["value"]) => {
              if (defined) setOwn(k, { ...(mine as Param), value: v } as Param);
              else if (inheritedFrom && inheritedFrom.value === v) setOwn(k, undefined);
              else setOwn(k, { value: v });
            };
            const used = usage[k] ?? [];
            return (
              <tr key={k}>
                <td>
                  <code>{k}</code>
                  <div className="muted small">
                    {p.type}
                    {status && <span className={`badge badge-${status === "inherited" ? "inherited" : status === "changed here" ? "changed" : "new"}`}>{status}</span>}
                  </div>
                  {status === "changed here" && <div className="muted small">parent: {fmtParam(inheritedFrom)}</div>}
                </td>
                <td>
                  <Answer p={p} onChange={setValue} />
                </td>
                <td>
                  {defined ? <ParamSettings p={mine as Param} onChange={(np) => setOwn(k, np)} sections={sectionIds} /> : <span>{p.label}</span>}
                  {p.help && !defined && <div className="muted small">{p.help}</div>}
                </td>
                <td className="small">{used.length ? used.join(", ") : <span className="muted">not used</span>}</td>
                <td>
                  {mine && (
                    <button type="button" className="link small" onClick={() => setOwn(k, undefined)} title={defined && !inheritedFrom ? "Delete this slot" : "Use the parent's value"}>
                      {defined && !inheritedFrom ? "delete" : "reset"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="add-row">
        <input type="text" className="mono" placeholder="new_slot_name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <Select value={type} options={PARAM_TYPES} onChange={(t) => setType(t ?? "number")} />
        <button type="button" className="ghost" onClick={add} disabled={!name.trim() || !!slots[name.trim()]}>
          + Add slot
        </button>
      </div>
    </div>
  );
}

function ParamSettings({ p, onChange, sections }: { p: Param; onChange: (p: Param) => void; sections: string[] }) {
  return (
    <div className="pset">
      <Text value={p.label} onChange={(v) => onChange({ ...p, label: v ?? "" })} placeholder="label" optional={false} />
      <Text value={p.question} onChange={(v) => onChange(put(p, "question", v))} placeholder="question, as the rulebook would answer it" />
      {sections.length > 0 && <Select value={p.section} options={sections} empty="(no section)" onChange={(v) => onChange(put(p, "section", v))} />}
      {(p.type === "number" || p.type === "formula") && <UnitInput value={p.unit} onChange={(u) => onChange(put(p, "unit", u))} />}
      {p.type === "choice" && <StringList mono values={[...p.options]} onChange={(o) => onChange({ ...p, options: o ?? [] })} placeholder="add option" />}
      <Text value={p.help} onChange={(v) => onChange(put(p, "help", v))} placeholder="help text (optional)" />
    </div>
  );
}
