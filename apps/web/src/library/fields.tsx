/**
 * Small form controls shared by the three editors. They hold no domain logic:
 * expressions are plain text here and are only ever parsed by the engine ("Check").
 */
import { useEffect, useId, useState, type ReactNode } from "react";
import type { Param, ParamRef, Value } from "@ifc-boq/types";

/* ---------------------------------------------------------------- layout */

export function Field({ label, hint, children, wide, group }: { label: string; hint?: ReactNode; children: ReactNode; wide?: boolean; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className={`f ${wide ? "f-wide" : ""}`}>
      <span className="f-label">{label}</span>
      {children}
      {hint && <span className="f-hint">{hint}</span>}
    </Tag>
  );
}

export function Section({ title, hint, children, actions }: { title: string; hint?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="ed-section">
      <div className="ed-section-head">
        <h3>{title}</h3>
        {actions}
      </div>
      {hint && <p className="hint">{hint}</p>}
      <div className="f-grid">{children}</div>
    </section>
  );
}

/* ---------------------------------------------------------------- inputs */

export function Text({ value, onChange, placeholder, mono, list, optional = true }: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  placeholder?: string;
  mono?: boolean;
  list?: string;
  optional?: boolean;
}) {
  return (
    <input
      type="text"
      className={mono ? "mono" : undefined}
      value={value ?? ""}
      placeholder={placeholder}
      list={list}
      onChange={(e) => onChange(optional && e.target.value === "" ? undefined : e.target.value)}
    />
  );
}

/** Text that is parsed on commit (blur / Enter), so partial input like "0." or "1," is not mangled. */
export function LazyText({ value, onCommit, placeholder, mono, list }: {
  value: string;
  onCommit: (s: string) => void;
  placeholder?: string;
  mono?: boolean;
  list?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      type="text"
      className={mono ? "mono" : undefined}
      value={draft}
      placeholder={placeholder}
      list={list}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => e.key === "Enter" && onCommit(draft)}
    />
  );
}

export function Num({ value, onChange, step, placeholder }: { value: number | undefined; onChange: (v: number | undefined) => void; step?: number; placeholder?: string }) {
  return (
    <input
      type="number"
      value={value ?? ""}
      step={step ?? "any"}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
    />
  );
}

export function Select<T extends string>({ value, options, onChange, labels, empty }: {
  value: T | undefined;
  options: readonly T[];
  onChange: (v: T | undefined) => void;
  labels?: Partial<Record<T, string>>;
  /** Label for an empty choice (value undefined); omit to require a value. */
  empty?: string;
}) {
  const known = value === undefined || options.includes(value);
  return (
    <select value={value ?? ""} onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}>
      {empty !== undefined && <option value="">{empty}</option>}
      {!known && <option value={value}>{value} (unknown)</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {labels?.[o] ?? o.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="option inline">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function TextArea({ value, onChange, rows = 3, placeholder }: { value: string | undefined; onChange: (v: string | undefined) => void; rows?: number; placeholder?: string }) {
  return <textarea rows={rows} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value || undefined)} />;
}

/** Datalist helper: <Options id=... values=[...] /> next to an input with list=id. */
export function Options({ id, values, labels }: { id: string; values: readonly string[]; labels?: Record<string, string> }) {
  return (
    <datalist id={id}>
      {values.map((v) => (
        <option key={v} value={v}>
          {labels?.[v]}
        </option>
      ))}
    </datalist>
  );
}

/* ---------------------------------------------------------------- lists */

/** A list of strings as removable chips plus an input. Enter or comma adds. */
export function StringList({ values, onChange, suggestions, placeholder, mono }: {
  values: string[] | undefined;
  onChange: (v: string[] | undefined) => void;
  suggestions?: readonly string[];
  placeholder?: string;
  mono?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const list = values ?? [];
  const add = () => {
    const parts = draft.split(",").map((s) => s.trim()).filter((s) => s && !list.includes(s));
    if (parts.length) onChange([...list, ...parts]);
    setDraft("");
  };
  return (
    <div className="slist">
      {list.map((v, i) => (
        <span key={`${v}-${i}`} className={`chip ${mono ? "mono" : ""}`}>
          {v}
          <button type="button" className="chip-x" aria-label={`Remove ${v}`} onClick={() => onChange(list.length > 1 ? list.filter((_, j) => j !== i) : undefined)}>
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        className={mono ? "mono" : undefined}
        value={draft}
        list={suggestions ? listId : undefined}
        placeholder={placeholder ?? "Add…"}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
      {suggestions && <Options id={listId} values={suggestions} />}
    </div>
  );
}

/** Multi-select as toggle chips. */
export function ToggleChips<T extends string>({ options, selected, onChange, labels }: {
  options: readonly T[];
  selected: readonly T[];
  onChange: (v: T[]) => void;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            className={`chip toggle ${on ? "on" : ""}`}
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((x) => x !== o) : [...selected, o])}
          >
            {labels?.[o] ?? o.replace(/_/g, " ")}
          </button>
        );
      })}
    </div>
  );
}

/** Rows of key -> value (strings; numbers and booleans are parsed back). */
export function KeyValue({ value, onChange, keyLabel = "Key", valueLabel = "Value", parse = false, keyList }: {
  value: Record<string, string | number | boolean> | undefined;
  onChange: (v: Record<string, string | number | boolean> | undefined) => void;
  keyLabel?: string;
  valueLabel?: string;
  parse?: boolean;
  keyList?: string;
}) {
  const rows = Object.entries(value ?? {});
  const commit = (next: [string, string | number | boolean][]) => onChange(next.length ? Object.fromEntries(next) : undefined);
  return (
    <div className="kv">
      {rows.length > 0 && (
        <div className="kv-row kv-head">
          <span>{keyLabel}</span>
          <span>{valueLabel}</span>
          <span />
        </div>
      )}
      {rows.map(([k, v], i) => (
        <div key={i} className="kv-row">
          <LazyText value={k} list={keyList} onCommit={(nk) => commit(rows.map((r, j) => (j === i ? [nk, r[1]] : r)))} />
          <LazyText value={String(v)} onCommit={(nv) => commit(rows.map((r, j) => (j === i ? [r[0], parse ? parseLiteral(nv) as string | number | boolean : nv] : r)))} />
          <button type="button" className="icon" aria-label="Remove row" onClick={() => commit(rows.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="link small" onClick={() => commit([...rows, [`key${rows.length + 1}`, ""]])}>
        + Add row
      </button>
    </div>
  );
}

export function parseLiteral(s: string): unknown {
  const t = s.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (t !== "" && !Number.isNaN(Number(t))) return Number(t);
  return t;
}

/* ---------------------------------------------------------------- expressions */

const EXPR_HELP = (
  <div className="expr-help">
    <p>
      Formulas are checked and evaluated only by the engine. Press <b>Check</b> at the top to have it parse them.
    </p>
    <dl className="params">
      <dt>operators</dt>
      <dd>+ - * / ( ) = != &gt; &gt;= &lt; &lt;= AND OR NOT</dd>
      <dt>functions</dt>
      <dd>IF(c,a,b) MIN MAX ROUND(x,step) CEIL FLOOR ABS SQRT PI() COALESCE UNDER(term,"root") CONTAINS(text,"x") LOWER</dd>
      <dt>variables</dt>
      <dd>net_area, thickness, length… · p.&lt;slot&gt; · props["Pset.Prop"] · src.* in derived rules</dd>
      <dt>aggregates</dt>
      <dd>SUM(openings.area WHERE area &gt; p.min) · COUNT(openings WHERE kind = "door") · over openings, layers, faces, children</dd>
    </dl>
  </div>
);

export function ExprInput({ value, onChange, placeholder, rows = 1 }: { value: string | undefined; onChange: (v: string | undefined) => void; placeholder?: string; rows?: number }) {
  const [help, setHelp] = useState(false);
  return (
    <div className="expr">
      <div className="expr-row">
        <textarea className="mono" rows={rows} value={value ?? ""} placeholder={placeholder ? `e.g. ${placeholder}` : "expression"} spellCheck={false} onChange={(e) => onChange(e.target.value || undefined)} />
        <button type="button" className="icon fx" aria-expanded={help} title="Expression syntax" onClick={() => setHelp(!help)}>
          fx
        </button>
      </div>
      {help && EXPR_HELP}
    </div>
  );
}

/* ---------------------------------------------------------------- slot binding */

export const isRef = (v: unknown): v is ParamRef => !!v && typeof v === "object" && !Array.isArray(v) && "param" in v;

export function fmtParam(p: Param | undefined): string {
  if (!p) return "not defined";
  if (p.type === "boolean") return p.value ? "yes" : "no";
  if (p.type === "choice") return p.optionLabels?.[p.value] ?? p.value.replace(/_/g, " ");
  if (p.type === "formula") return p.value || "(empty formula)";
  const v = String(p.value);
  return "unit" in p && p.unit ? `${v} ${p.unit}` : v;
}

/**
 * A `Value<T>` field: either a literal (rendered by `children`) or a reference to a slot.
 * This is how a rule says "use whatever the standard fills in here".
 */
export function ValueField<T>({ value, onChange, slots, slotType, children }: {
  value: Value<T> | undefined;
  onChange: (v: Value<T> | undefined) => void;
  slots: Record<string, Param>;
  slotType?: Param["type"];
  children: (literal: T | undefined, set: (v: T | undefined) => void) => ReactNode;
}) {
  const candidates = Object.entries(slots).filter(([, p]) => !slotType || p.type === slotType);
  const ref = isRef(value) ? value : null;
  const toggle = () => {
    if (ref) onChange(slots[ref.param]?.value as T | undefined);
    else if (candidates.length) onChange({ param: candidates[0][0] });
  };
  return (
    <div className="vf">
      {ref ? (
        <>
          <select className="vf-slot" value={ref.param} onChange={(e) => onChange({ param: e.target.value })}>
            {!slots[ref.param] && <option value={ref.param}>{ref.param} (not defined)</option>}
            {candidates.map(([k, p]) => (
              <option key={k} value={k}>
                {p.label || k}
              </option>
            ))}
          </select>
          <span className="vf-now" title={ref.param}>
            now {fmtParam(slots[ref.param])}
          </span>
        </>
      ) : (
        children(value as T | undefined, onChange as (v: T | undefined) => void)
      )}
      {(ref || candidates.length > 0) && (
        <button type="button" className={`vf-toggle ${ref ? "on" : ""}`} aria-pressed={!!ref} onClick={toggle} title={ref ? "Use a fixed value instead" : "Take this value from a slot"}>
          slot
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- and / or / not trees */

type Group<N> = { all: N[] } | { any: N[] } | { not: N };
const groupOp = (n: object): "all" | "any" | "not" | null => ("all" in n ? "all" : "any" in n ? "any" : "not" in n ? "not" : null);

/**
 * Editor for the boolean trees used by rule selectors and classification map matches:
 * groups (all / any / not) of leaves. The leaf editor is supplied by the caller.
 */
export function LogicTree<N extends object>({ value, onChange, onRemove, renderLeaf, newLeaf }: {
  value: N;
  onChange: (v: N) => void;
  onRemove?: () => void;
  renderLeaf: (leaf: N, set: (v: N) => void) => ReactNode;
  newLeaf: () => N;
}) {
  const op = groupOp(value);
  const asNode = (g: Group<N>) => g as unknown as N;
  if (!op) {
    return (
      <div className="lt-leaf">
        <div className="lt-leaf-body">{renderLeaf(value, onChange)}</div>
        <div className="lt-actions">
          {!onRemove && (
            <button type="button" className="link small" onClick={() => onChange(asNode({ all: [value, newLeaf()] }))}>
              + and…
            </button>
          )}
          {onRemove && (
            <button type="button" className="icon" aria-label="Remove condition" onClick={onRemove}>
              ×
            </button>
          )}
        </div>
      </div>
    );
  }
  const g = value as unknown as Group<N>;
  const kids: N[] = "not" in g ? [g.not] : "all" in g ? g.all : g.any;
  const setOp = (next: "all" | "any" | "not") =>
    onChange(asNode(next === "not" ? { not: kids[0] ?? newLeaf() } : next === "all" ? { all: kids } : { any: kids }));
  const setKids = (k: N[]) => onChange(asNode(op === "not" ? { not: k[0] ?? newLeaf() } : op === "all" ? { all: k } : { any: k }));
  return (
    <div className={`lt-group lt-${op}`}>
      <div className="lt-head">
        <select value={op} onChange={(e) => setOp(e.target.value as "all" | "any" | "not")} aria-label="Group type">
          <option value="all">All of these</option>
          <option value="any">Any of these</option>
          <option value="not">None of this</option>
        </select>
        {onRemove ? (
          <button type="button" className="icon" aria-label="Remove group" onClick={onRemove}>
            ×
          </button>
        ) : (
          kids.length === 1 && op !== "not" && (
            <button type="button" className="link small" onClick={() => onChange(kids[0])}>
              ungroup
            </button>
          )
        )}
      </div>
      <div className="lt-kids">
        {kids.map((k, i) => (
          <LogicTree
            key={i}
            value={k}
            onChange={(v) => setKids(kids.map((x, j) => (j === i ? v : x)))}
            onRemove={op === "not" ? undefined : () => setKids(kids.filter((_, j) => j !== i))}
            renderLeaf={renderLeaf}
            newLeaf={newLeaf}
          />
        ))}
      </div>
      {op !== "not" && (
        <div className="lt-add">
          <button type="button" className="link small" onClick={() => setKids([...kids, newLeaf()])}>
            + Condition
          </button>
          <button type="button" className="link small" onClick={() => setKids([...kids, asNode({ any: [newLeaf()] })])}>
            + Group
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- list + detail */

export interface RowInfo {
  key: string;
  title: string;
  sub?: string;
  badge?: { text: string; tone?: "new" | "changed" | "removed" | "inherited" };
}

/** The left-hand list of a list/detail editor. */
export function RowList({ rows, selected, onSelect, onAdd, addLabel, filter, onFilter, empty }: {
  rows: RowInfo[];
  selected: string | null;
  onSelect: (key: string) => void;
  onAdd?: () => void;
  addLabel?: string;
  filter?: string;
  onFilter?: (q: string) => void;
  empty?: string;
}) {
  return (
    <div className="ld-list">
      <div className="ld-tools">
        {onFilter && <input type="search" placeholder="Filter" value={filter ?? ""} onChange={(e) => onFilter(e.target.value)} />}
        {onAdd && (
          <button type="button" className="ghost small-btn" onClick={onAdd}>
            {addLabel ?? "+ Add"}
          </button>
        )}
      </div>
      <ul>
        {rows.length === 0 && <li className="muted small ld-empty">{empty ?? "Nothing here yet."}</li>}
        {rows.map((r) => (
          <li key={r.key}>
            <button type="button" className={`ld-row ${selected === r.key ? "on" : ""} ${r.badge?.tone === "removed" ? "removed" : ""}`} onClick={() => onSelect(r.key)}>
              <span className="ld-title">
                {r.title}
                {r.badge && <span className={`badge badge-${r.badge.tone ?? "plain"}`}>{r.badge.text}</span>}
              </span>
              {r.sub && <span className="ld-sub">{r.sub}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const matches = (q: string, ...texts: (string | undefined)[]) => !q || texts.some((t) => t?.toLowerCase().includes(q.toLowerCase()));
