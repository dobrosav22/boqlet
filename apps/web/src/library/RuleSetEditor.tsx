/**
 * Rule set editor (input 2). Works on a standalone RuleSet or a RuleSetPatch.
 *
 * Three tabs, by who needs them (dev build: all shown):
 *   Settings   the questions a standard answers (QuestionsTab)
 *   BoQ items  everything that becomes a BoQ line, in one list: measured from the model (item
 *              rules), calculated from other items (derived rules), entered by hand (manual items)
 *   Advanced   about and defaults, setting up questions (slots), raw JSON
 *
 * For a patch, the parent is shown as the engine flattens it (from the Check endpoint),
 * so every slot and rule is marked inherited, changed here, new here or removed here.
 */
import { useMemo, useState, type ReactNode } from "react";
import type { Breakdown, DerivedRule, ItemRule, ManualItem, OurRuleType, Param, RuleSet, RuleSetPatch, Selector, Value } from "@ifc-boq/types";
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
  isRef,
  matches,
  type RowInfo,
} from "./fields";
import { BoolValue, FormulaValue, NumberValue, OnMissingEditor, QuantityEditor, RoundingEditor, SelectorEditor, UnitInput, describeQuantity, describeSelector } from "./ruleParts";
import { JsonTab } from "./JsonTab";
import { QuestionsTab, type ScopeEntry } from "./QuestionsTab";
import { QuestionSetup } from "./QuestionSetup";
import { isPatch, move, put, removeAt, replaceAt, uniqueId } from "./store";

type Slots = Record<string, Param>;
type Tab = "settings" | "items" | "advanced";
type AdvancedTab = "about" | "setup" | "json";

interface Props {
  doc: OurRuleType;
  onChange: (d: OurRuleType) => void;
  /** Patches: the parent as the engine flattens it; null while loading or when it cannot be resolved. */
  parent: RuleSet | null;
  parentNote?: string;
  ruleSetIds: string[];
  /** An item's id changed; the library offers to update classification maps that use the old id. */
  onItemRenamed?: (from: string, to: string) => void;
}

export function RuleSetEditor({ doc, onChange, parent, parentNote, ruleSetIds, onItemRenamed }: Props) {
  const patch = isPatch(doc);
  const [tab, setTab] = useState<Tab>(patch || (doc as RuleSet).sections?.length ? "settings" : "items");
  const [advanced, setAdvanced] = useState<AdvancedTab>("about");
  /** Item to select when the items tab opens (from "Used by" links in the questionnaire). */
  const [focus, setFocus] = useState<string | null>(null);
  const slots = useMemo(() => effectiveSlots(doc, parent), [doc, parent]);
  const removed = (patch && doc.remove) || [];

  const items = rowsFor(parent?.items, doc.items, removed, patch);
  const derived = rowsFor(parent?.derived, doc.derived, removed, patch);
  const manual = rowsFor(parent?.manual, doc.manual, removed, patch);
  const live = <T,>(rows: Row<T>[]) => rows.filter((r) => r.status !== "removed").map((r) => r.entry);
  const entries = [...live(items), ...live(derived), ...live(manual)] as (ItemRule | DerivedRule | ManualItem)[];
  const usage = useMemo(() => {
    const u = slotUsage(entries);
    // a slot read inside a formula slot (p.working_space in the excavation formula) is used by that formula's rules
    for (const [name, p] of Object.entries(slots))
      if (p.type === "formula")
        for (const m of p.value.matchAll(/\bp\.([A-Za-z_]\w*)/g)) u[m[1]] = [...new Set([...(u[m[1]] ?? []), ...(u[name] ?? [])])];
    return u;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, derived, manual, slots]);
  const scope = useMemo(() => scopeOf(entries, slots), [entries, slots]);

  const setList = (key: "items" | "derived" | "manual", list: unknown[]) =>
    onChange(patch ? put(doc as RuleSetPatch, key, list.length ? (list as never) : undefined) : ({ ...doc, [key]: list } as RuleSet));
  const setRemoved = (ids: string[]) => onChange(put(doc as RuleSetPatch, "remove", ids.length ? ids : undefined));

  const openRule = (id: string) => {
    setFocus(`${items.some((r) => r.id === id) ? "model" : derived.some((r) => r.id === id) ? "calculated" : "manual"}:${id}`);
    setTab("items");
  };
  const ruleLabel = (id: string) => {
    const r = [...items, ...derived].find((x) => x.id === id);
    return (r?.entry as { label?: string } | undefined)?.label ?? id;
  };
  const itemIds = live(items).map((i) => (i as ItemRule).id);

  const groups: Group[] = [
    group<ItemRule>({
      key: "model",
      title: "From the model",
      noun: "item-rule",
      hint: "Takes model elements and measures them into BoQ lines.",
      rows: items,
      own: doc.items ?? [],
      setOwn: (l) => setList("items", l),
      rename: (from, list) => {
        const to = (list as ItemRule[]).find((x) => !(doc.items ?? []).some((y) => y.id === x.id))?.id;
        if (!to) return;
        const follow = (d: DerivedRule) => (d.from.includes(from) ? { ...d, from: d.from.map((f) => (f === from ? to : f)) } : d);
        let derivedOwn = (doc.derived ?? []).map(follow);
        let remove = patch ? [...((doc as RuleSetPatch).remove ?? [])] : undefined;
        if (patch && parent?.items.some((x) => x.id === from)) {
          // the parent's item goes, the renamed one replaces it; the parent's calculated items follow
          remove = [...new Set([...(remove ?? []), from])];
          const ownIds = new Set(derivedOwn.map((d) => d.id));
          derivedOwn = [...derivedOwn, ...(parent.derived ?? []).filter((d) => !ownIds.has(d.id) && !remove!.includes(d.id) && d.from.includes(from)).map(follow)];
        }
        onChange({ ...doc, items: list as ItemRule[], ...(derivedOwn.length ? { derived: derivedOwn } : {}), ...(remove?.length ? { remove } : {}) } as OurRuleType);
        onItemRenamed?.(from, to);
      },
      make: (id) => ({ id, label: "New item", match: { ifcClass: "IfcWall" }, quantity: { kind: "area" }, description: "{type_name}" }),
      summary: (e) => ({ title: e.label || e.id, sub: `${describeSelector(e.match)} → ${describeQuantity(e.quantity)}` }),
      form: (e, set) => <ItemForm item={e} onChange={set} slots={slots} />,
    }),
    group<DerivedRule>({
      key: "calculated",
      title: "Calculated from other items",
      noun: "derived-rule",
      hint: "Work that is not modelled (formwork, paint, reinforcement estimates), calculated from the lines or elements of other items.",
      rows: derived,
      own: doc.derived ?? [],
      setOwn: (l) => setList("derived", l),
      make: (id) => ({ id, label: "New calculated item", from: itemIds.slice(0, 1), scope: "line", quantity: "qty", unit: "m2", description: "Calculated" }),
      summary: (e) => ({ title: e.label || e.id, sub: `from ${e.from.join(", ") || "—"}: ${isRef(e.quantity) ? slots[e.quantity.param]?.label ?? e.quantity.param : e.quantity}` }),
      form: (e, set) => <DerivedForm rule={e} onChange={set} slots={slots} itemIds={itemIds} />,
    }),
    group<ManualItem>({
      key: "manual",
      title: "Entered by hand",
      noun: "manual-item",
      hint: "Lines with no model behind them: preliminaries, provisional sums, lump sums, dayworks. No quantity = a flagged line for the user to fill.",
      rows: manual,
      own: doc.manual ?? [],
      setOwn: (l) => setList("manual", l),
      make: (id) => ({ id, kind: "preliminary", description: "New item", unit: "item" }),
      summary: (e) => ({ title: typeof e.description === "string" ? e.description : e.id, sub: `${e.kind.replace(/_/g, " ")}, ${e.unit}` }),
      form: (e, set) => <ManualForm item={e} onChange={set} slots={slots} />,
    }),
  ];

  const tabs: [Tab, string][] = [
    ["settings", "Settings"],
    ["items", `BoQ items (${entries.length})`],
    ["advanced", "Advanced"],
  ];
  const advancedTabs: [AdvancedTab, string][] = [
    ["about", "About and defaults"],
    ["setup", `Questions setup (${Object.keys(slots).length})`],
    ["json", "JSON"],
  ];

  return (
    <>
      {patch && (
        <p className="note small">
          Based on <b>{doc.extends}</b>; only the differences are stored. {parentNote ?? (parent ? "" : "Loading the parent…")}
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
            onOpenSetup={() => (setTab("advanced"), setAdvanced("setup"))}
          />
        )}
        {tab === "items" && <ItemsTab key={focus ?? ""} groups={groups} initial={focus} patch={patch} removed={removed} setRemoved={setRemoved} />}
        {tab === "advanced" && (
          <>
            <div className="seg adv-nav" role="tablist">
              {advancedTabs.map(([id, label]) => (
                <button key={id} role="tab" aria-selected={advanced === id} className={advanced === id ? "on" : ""} onClick={() => setAdvanced(id)}>
                  {label}
                </button>
              ))}
            </div>
            {advanced === "about" && <Overview doc={doc} onChange={onChange} slots={slots} ruleSetIds={ruleSetIds} />}
            {advanced === "setup" && <QuestionSetup doc={doc} onChange={onChange} parent={parent} slots={slots} usage={usage} ruleLabel={ruleLabel} onOpenRule={openRule} />}
            {advanced === "json" && <JsonTab value={doc} onChange={onChange} />}
          </>
        )}
      </div>
    </>
  );
}

/** Items a yes/no answer switches on or off, for the "In this BoQ" summary. */
function scopeOf(entries: (ItemRule | DerivedRule | ManualItem)[], slots: Slots): ScopeEntry[] {
  const out = new Map<string, ScopeEntry>();
  for (const e of entries) {
    if (!isRef(e.enabled)) continue;
    const s = slots[e.enabled.param];
    if (s?.type !== "boolean") continue;
    const label = "label" in e ? e.label : typeof e.description === "string" ? e.description : e.id;
    out.set(label, { slot: e.enabled.param, label, on: s.value });
  }
  return [...out.values()];
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

/* ================================================================ BoQ items: one list, three kinds */

type Entry = { id: string };
interface GroupOf<T extends Entry> {
  key: "model" | "calculated" | "manual";
  title: string;
  /** Base for new ids. */
  noun: string;
  hint: string;
  rows: Row<T>[];
  own: T[];
  setOwn: (l: T[]) => void;
  /** Set the list after an entry's id changed from `from`, updating what refers to it. Default: setOwn. */
  rename?: (from: string, l: T[]) => void;
  make: (id: string) => T;
  summary: (e: T) => { title: string; sub: string };
  form: (e: T, set: (e: T) => void) => ReactNode;
}
type Group = GroupOf<Entry>;
const group = <T extends Entry>(g: GroupOf<T>) => g as unknown as Group;

const ADD_LABEL: Record<Group["key"], string> = { model: "+ From the model", calculated: "+ Calculated", manual: "+ By hand" };

function ItemsTab({ groups, initial, patch, removed, setRemoved }: { groups: Group[]; initial: string | null; patch: boolean; removed: string[]; setRemoved: (ids: string[]) => void }) {
  const keys = groups.flatMap((g) => g.rows.map((r) => `${g.key}:${r.id}`));
  const [sel, setSel] = useState<string | null>(initial && keys.includes(initial) ? initial : keys[0] ?? null);
  const [q, setQ] = useState("");
  const g = groups.find((x) => sel?.startsWith(`${x.key}:`));
  const row = g?.rows.find((r) => `${g.key}:${r.id}` === sel) ?? null;
  const ownIndex = g && row ? g.own.findIndex((e) => e.id === row.id) : -1;

  const add = (to: Group) => {
    const id = uniqueId(to.noun, to.rows.map((r) => r.id));
    to.setOwn([...to.own, to.make(id)]);
    setSel(`${to.key}:${id}`);
  };
  const update = (e: Entry) => {
    if (!g || !row) return;
    if (e.id === row.id) return g.setOwn(replaceAt(g.own, ownIndex, e));
    if (!e.id.trim() || g.rows.some((r) => r.id === e.id)) return; // empty or taken: keep the old id
    (g.rename ?? ((_from: string, l: Entry[]) => g.setOwn(l)))(row.id, replaceAt(g.own, ownIndex, e));
    setSel(`${g.key}:${e.id}`);
  };
  const editable = row && (row.status === "own" || row.status === "new" || row.status === "changed");

  const rowInfos: RowInfo[] = groups.flatMap((x) =>
    x.rows
      .filter((r) => matches(q, r.id, x.summary(r.entry).title, x.summary(r.entry).sub))
      .map((r) => ({ key: `${x.key}:${r.id}`, ...x.summary(r.entry), badge: BADGE[r.status], section: `${x.title} (${x.rows.filter((y) => y.status !== "removed").length})` })),
  );
  const tools = (
    <span className="add-kinds">
      {groups.map((x) => (
        <button key={x.key} type="button" className="ghost small-btn" onClick={() => add(x)} title={x.hint}>
          {ADD_LABEL[x.key]}
        </button>
      ))}
    </span>
  );

  return (
    <>
      <p className="hint">
        Everything that becomes a line in the BoQ: <b>from the model</b> (elements measured), <b>calculated</b> from other items (formwork, paint, reinforcement estimates) and{" "}
        <b>entered by hand</b> (preliminaries, sums). Settings answers point into these; change an item here only when no answer covers what you need.
      </p>
      <div className="ld">
        <RowList rows={rowInfos} selected={sel} onSelect={setSel} filter={q} onFilter={setQ} tools={tools} />
        <div className="ld-detail">
          {(!g || !row) && <p className="muted">Select an item on the left, or add one.</p>}
          {g && row && (
            <>
              <p className="muted small">
                {g.title}. {g.hint}
              </p>
              <div className="ld-actions">
                {row.status === "inherited" && (
                  <>
                    <span className="muted small">Inherited unchanged from the parent.</span>
                    <button type="button" className="ghost small-btn" onClick={() => g.setOwn([...g.own, structuredClone(row.entry)])}>
                      Change in this set
                    </button>
                    <button type="button" className="ghost small-btn" onClick={() => setRemoved([...removed, row.id])}>
                      Leave out of this set
                    </button>
                  </>
                )}
                {row.status === "removed" && (
                  <>
                    <span className="muted small">The parent has this item; this set leaves it out.</span>
                    <button type="button" className="ghost small-btn" onClick={() => setRemoved(removed.filter((x) => x !== row.id))}>
                      Bring back
                    </button>
                  </>
                )}
                {row.status === "changed" && (
                  <>
                    <span className="muted small">Changed in this set; replaces the parent's version.</span>
                    <button type="button" className="ghost small-btn" onClick={() => g.setOwn(removeAt(g.own, ownIndex))}>
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
                        const id = uniqueId(`${row.id}-copy`, g.rows.map((r) => r.id));
                        g.setOwn([...g.own, { ...structuredClone(row.entry), id }]);
                        setSel(`${g.key}:${id}`);
                      }}
                    >
                      Duplicate
                    </button>
                    {row.status === "own" && (
                      <>
                        <button type="button" className="ghost small-btn" disabled={ownIndex === 0} onClick={() => g.setOwn(move(g.own, ownIndex, -1))}>
                          Move up
                        </button>
                        <button type="button" className="ghost small-btn" disabled={ownIndex === g.own.length - 1} onClick={() => g.setOwn(move(g.own, ownIndex, 1))}>
                          Move down
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="ghost small-btn danger"
                      onClick={() => {
                        g.setOwn(removeAt(g.own, ownIndex));
                        setSel(null);
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
              <fieldset className="ro" disabled={!editable}>
                {g.form(row.entry, update)}
              </fieldset>
            </>
          )}
        </div>
      </div>
      {patch && removed.length > 0 && <p className="muted small">Left out of this set: {removed.join(", ")}</p>}
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
        <Field label="Id" hint="Renaming updates the calculated items of this set that use it; classification maps that name it need the new id too.">
          <LazyText mono value={item.id} onCommit={(v) => set("id", v.trim())} />
        </Field>
        <BoolValue label="Enabled" value={item.enabled} onChange={(v) => set("enabled", v)} slots={slots} dflt />
      </Section>

      <Section title="Which elements" hint="Match on IFC class, measurement family, dictionary terms (op “is under term”) or any measured field.">
        <div className="f-wide">
          <SelectorEditor value={item.match} onChange={(m) => set("match", m)} slots={slots} />
        </div>
        <Field label="Measures" hint="Elements left out of this BoQ (Advanced › About, “Left out of this BoQ”) are only for items that measure them, e.g. demolition.">
          <Select
            value={item.scope}
            options={["in", "out"] as const}
            labels={{ in: "elements in this BoQ", out: "only elements left out of it" }}
            empty="elements in this BoQ"
            onChange={(v) => set("scope", v === "in" ? undefined : v)}
          />
        </Field>
        <Field label="Parts of assemblies" hint="Stair flights, roof slabs… are skipped when their parent is measured, unless included.">
          <Select value={item.parts} options={["skip", "include"] as const} empty="skip (default)" onChange={(v) => set("parts", v)} />
        </Field>
        <Field label="Break each element into" group>
          <ValueField<Breakdown> value={item.breakdown} onChange={(v) => set("breakdown", v)} slots={slots} slotType="choice">
            {(lit, s) => <Select<Breakdown> value={lit} options={BREAKDOWNS} empty="rule set default" onChange={s} />}
          </ValueField>
        </Field>
        <Field label="Keep only parts where" wide>
          <ExprInput slots={slots} value={item.partFilter} onChange={(v) => set("partFilter", v)} placeholder='NOT UNDER(material, "air_gap")' />
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
        <Field label="Items it is calculated from" group wide>
          <ToggleChips options={[...itemIds, ...unknown]} selected={rule.from} onChange={(l) => set("from", l)} />
          {unknown.length > 0 && <span className="error small">Not in this rule set: {unknown.join(", ")}</span>}
        </Field>
        <Field label="Evaluate per">
          <Select value={rule.scope} options={["line", "element"] as const} labels={{ line: "each source line ([Line quantity])", element: "each source element (its measured values)" }} onChange={(v) => set("scope", v ?? "line")} />
        </Field>
        <Field label="Only sources where" wide>
          <ExprInput slots={slots} value={rule.where} onChange={(v) => set("where", v)} placeholder='UNDER(material, "concrete")' />
        </Field>
      </Section>
      <Section title="Quantity">
        <FormulaValue label="Formula" value={rule.quantity} onChange={(v) => set("quantity", v)} slots={slots} placeholder={rule.scope === "line" ? "qty * 1.05" : "SUM(faces.gross_area WHERE side = \"a\")"} />
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
        <FormulaValue label="Or a formula (answers and building values)" value={item.formula} onChange={(v) => set("formula", v || undefined)} slots={slots} placeholder="building.gross_volume / 100" />
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
      <ScopeEditor doc={doc} onChange={onChange} slots={slots} />
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

/* ================================================================ scope */

/** What the BoQ leaves out (RuleSet.scope): each condition drops the elements it matches. */
function ScopeEditor({ doc, onChange, slots }: { doc: OurRuleType; onChange: (d: OurRuleType) => void; slots: Slots }) {
  const patch = isPatch(doc);
  const own = doc.scope;
  const list = own?.exclude ?? [];
  const set = (l: Selector[] | undefined) => onChange(put(doc, "scope", l === undefined ? undefined : { exclude: l }) as OurRuleType);
  return (
    <Section
      title="Left out of this BoQ"
      hint="Elements matching any of these are not measured and not asked about (the log counts them). Items set to measure “only elements left out” take exactly these, e.g. demolition."
    >
      <div className="f-wide">
        {patch && own === undefined ? (
          <p className="muted small">
            As the parent decides.{" "}
            <button type="button" className="link small" onClick={() => set([])}>
              Set it in this set
            </button>
          </p>
        ) : (
          <>
            {list.length === 0 && <p className="muted small">Nothing is left out.</p>}
            {list.map((sel, i) => (
              <div key={i} className="scope-row">
                <SelectorEditor value={sel} onChange={(v) => set(replaceAt(list, i, v))} slots={slots} />
                <button type="button" className="icon" aria-label="Remove condition" onClick={() => set(removeAt(list, i))}>
                  ×
                </button>
              </div>
            ))}
            <div className="lt-add">
              <button type="button" className="link small" onClick={() => set([...list, { field: "status", op: "in", value: ["existing", "demolish"] }])}>
                + Leave out elements where…
              </button>
              {patch && (
                <button type="button" className="link small" onClick={() => set(undefined)}>
                  Back to the parent's
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Section>
  );
}
