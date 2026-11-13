"use client";

/**
 * Small form controls shared by the three Library editors, ported from the PoC's `fields.tsx`
 * (reuse-from-poc.md) and restyled with the design system. They hold no domain logic: formulas are
 * text here (shown with readable names) and only ever parsed by the engine (BR-01, CLAUDE.md rule 4).
 * Every string comes from `library.fields` (F15).
 */
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Param, ParamRef, Value } from "@ifc-boq/types";
import { cn } from "@/lib/utils";
import { fromReadable, sameFormula, toReadable, type Lexicon } from "../lib/readable";
import { NAME_GROUPS, type NameGroup } from "../lib/names";
import { BUILDING_FIELDS, NAME_UNITS } from "./vocab";
import { useVocab } from "./use-vocab";

/** The look of every input in the editors (the app's `Input`, for elements it doesn't cover). */
export const inputClass =
  "h-8 w-full min-w-0 rounded-[var(--radius)] border border-input bg-transparent px-2 text-ui outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
export const textareaClass =
  "w-full min-w-0 rounded-[var(--radius)] border border-input bg-transparent px-2 py-1 text-ui outline-none focus-visible:ring-2 focus-visible:ring-ring";
/** A text button that reads as a link (the PoC's `.link`). */
export const linkButton = "text-link hover:underline disabled:opacity-60";
const chipClass = "inline-flex items-center gap-1 rounded-[var(--radius)] border border-border px-1.5 py-0.5 text-ui";

/* ---------------------------------------------------------------- layout */

export function Field({ label, hint, children, wide, group }: { label: ReactNode; hint?: ReactNode; children: ReactNode; wide?: boolean; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className={cn("flex min-w-0 flex-col gap-1", wide && "col-span-full")}>
      <span className="label-caps text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-muted-foreground">{hint}</span>}
    </Tag>
  );
}

export function Section({ title, hint, children, actions, id }: { title: ReactNode; hint?: ReactNode; children: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4" id={id}>
      <div className="flex items-center gap-3">
        <h3 className="label-caps flex-1">{title}</h3>
        {actions}
      </div>
      {hint && <p className="text-muted-foreground">{hint}</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

/* ---------------------------------------------------------------- inputs */

export function Text({ value, onChange, placeholder, mono, list, optional = true, ...rest }: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  placeholder?: string;
  mono?: boolean;
  list?: string;
  optional?: boolean;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  return (
    <input
      type="text"
      className={cn(inputClass, mono && "font-mono")}
      value={value ?? ""}
      placeholder={placeholder}
      list={list}
      onChange={(e) => onChange(optional && e.target.value === "" ? undefined : e.target.value)}
      {...rest}
    />
  );
}

/** Text that is parsed on commit (blur / Enter), so partial input like "0." or "1," is not mangled. */
export function LazyText({ value, onCommit, placeholder, mono, list, ...rest }: {
  value: string;
  onCommit: (s: string) => void;
  placeholder?: string;
  mono?: boolean;
  list?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  return (
    <input
      type="text"
      className={cn(inputClass, mono && "font-mono")}
      value={draft}
      placeholder={placeholder}
      list={list}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => e.key === "Enter" && onCommit(draft)}
      {...rest}
    />
  );
}

export function Num({ value, onChange, step, placeholder, ...rest }: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
  placeholder?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  return (
    <input
      type="number"
      className={cn(inputClass, "tabular-nums")}
      value={value ?? ""}
      step={step ?? "any"}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      {...rest}
    />
  );
}

export function Select<T extends string>({ value, options, onChange, labels, empty, ...rest }: {
  value: T | undefined;
  options: readonly T[];
  onChange: (v: T | undefined) => void;
  labels?: Partial<Record<T, string>> | ((o: T) => string);
  /** Label for an empty choice (value undefined); omit to require a value. */
  empty?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  const t = useTranslations("library.fields");
  const known = value === undefined || options.includes(value);
  const label = (o: T) => (typeof labels === "function" ? labels(o) : labels?.[o]) ?? o.replace(/_/g, " ");
  return (
    <select className={inputClass} value={value ?? ""} onChange={(e) => onChange((e.target.value || undefined) as T | undefined)} {...rest}>
      {empty !== undefined && <option value="">{empty}</option>}
      {!known && <option value={value}>{t("unknownOption", { value: String(value) })}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {label(o)}
        </option>
      ))}
    </select>
  );
}

export function Check({ checked, onChange, label, ...rest }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; "data-testid"?: string }) {
  return (
    <label className="inline-flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} {...rest} />
      <span>{label}</span>
    </label>
  );
}

export function TextArea({ value, onChange, rows = 3, placeholder, ...rest }: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  rows?: number;
  placeholder?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  return <textarea className={textareaClass} rows={rows} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value || undefined)} {...rest} />;
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
export function StringList({ values, onChange, suggestions, placeholder, mono, ...rest }: {
  values: string[] | undefined;
  onChange: (v: string[] | undefined) => void;
  suggestions?: readonly string[];
  placeholder?: string;
  mono?: boolean;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  const t = useTranslations("library.fields");
  const [draft, setDraft] = useState("");
  const listId = useId();
  const list = values ?? [];
  const add = () => {
    const parts = draft
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !list.includes(s));
    if (parts.length) onChange([...list, ...parts]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      {list.map((v, i) => (
        <span key={`${v}-${i}`} className={cn(chipClass, mono && "font-mono")}>
          {v}
          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={t("remove", { what: v })} onClick={() => onChange(list.length > 1 ? list.filter((_, j) => j !== i) : undefined)}>
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        className={cn(inputClass, "w-40 flex-1", mono && "font-mono")}
        value={draft}
        list={suggestions ? listId : undefined}
        placeholder={placeholder ?? t("add")}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        {...rest}
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
  labels?: Partial<Record<T, string>> | ((o: T) => string);
}) {
  const label = (o: T) => (typeof labels === "function" ? labels(o) : labels?.[o]) ?? o.replace(/_/g, " ");
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            className={cn(chipClass, "hover:bg-muted", on && "border-foreground bg-foreground text-background hover:bg-foreground/90")}
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((x) => x !== o) : [...selected, o])}
          >
            {label(o)}
          </button>
        );
      })}
    </div>
  );
}

/** Rows of key -> value (strings; numbers and booleans are parsed back). */
export function KeyValue({ value, onChange, keyLabel, valueLabel, parse = false, keyList }: {
  value: Record<string, string | number | boolean> | undefined;
  onChange: (v: Record<string, string | number | boolean> | undefined) => void;
  keyLabel?: string;
  valueLabel?: string;
  parse?: boolean;
  keyList?: string;
}) {
  const t = useTranslations("library.fields");
  const rows = Object.entries(value ?? {});
  const commit = (next: [string, string | number | boolean][]) => onChange(next.length ? Object.fromEntries(next) : undefined);
  return (
    <div className="flex flex-col gap-1">
      {rows.length > 0 && (
        <div className="label-caps grid grid-cols-[1fr_1fr_2rem] gap-2 text-muted-foreground">
          <span>{keyLabel ?? t("key")}</span>
          <span>{valueLabel ?? t("value")}</span>
          <span />
        </div>
      )}
      {rows.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_2rem] gap-2">
          <LazyText value={k} list={keyList} aria-label={keyLabel ?? t("key")} onCommit={(nk) => commit(rows.map((r, j) => (j === i ? [nk, r[1]] : r)))} />
          <LazyText value={String(v)} aria-label={valueLabel ?? t("value")} onCommit={(nv) => commit(rows.map((r, j) => (j === i ? [r[0], parse ? (parseLiteral(nv) as string | number | boolean) : nv] : r)))} />
          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={t("removeRow")} onClick={() => commit(rows.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className={cn(linkButton, "self-start")} onClick={() => commit([...rows, [`key${rows.length + 1}`, ""]])}>
        {t("addRow")}
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

function ExprHelp() {
  const t = useTranslations("library.fields.exprHelp");
  return (
    <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1">
      {(["operators", "functions", "lists", "names"] as const).map((k) => (
        <div key={k} className="contents">
          <dt className="label-caps text-muted-foreground">{t(`${k}.term`)}</dt>
          <dd className="font-mono">{t(`${k}.text`)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A formula, shown and edited with readable names (`[Length] * [Height]`, see readable.ts). "code"
 * shows the stored text exactly. The engine is the only thing that parses or evaluates it.
 */
export function ExprInput({ value, onChange, placeholder, rows = 1, slots, ...rest }: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  placeholder?: string;
  rows?: number;
  /** The rule set's slots, so `p.<slot>` reads as the slot's label. */
  slots?: Record<string, Param>;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  const t = useTranslations("library");
  const vocab = useVocab();
  const lex = useMemo(() => vocab.lexicon(slots ?? {}), [vocab, slots]);
  const errors = useMemo(() => ({ unclosed: (text: string) => t("formula.unclosed", { text }), unknown: (label: string) => t("formula.unknown", { label }) }), [t]);
  const [panel, setPanel] = useState<"names" | "help" | null>(null);
  const [code, setCode] = useState(false);
  const [draft, setDraft] = useState(() => toReadable(value ?? "", lex));
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  // Follow changes made elsewhere (a picked choice, the JSON tab), but keep the user's own wording.
  const [seen, setSeen] = useState({ value, lex });
  if (seen.value !== value || seen.lex !== lex) {
    setSeen({ value, lex });
    const r = fromReadable(draft, lex, errors);
    if (!("raw" in r) || r.raw !== (value ?? "")) {
      setDraft(toReadable(value ?? "", lex));
      setError(null);
    }
  }

  const edit = (text: string) => {
    setDraft(text);
    const r = fromReadable(text, lex, errors);
    if ("error" in r) return setError(r.error);
    setError(null);
    onChange(r.raw || undefined);
  };
  const insert = (readable: string, raw: string) => {
    const el = area.current;
    const cur = code ? (value ?? "") : draft;
    const [a, b] = el ? [el.selectionStart, el.selectionEnd] : [cur.length, cur.length];
    const piece = code ? raw : readable;
    const next = cur.slice(0, a) + piece + cur.slice(b);
    if (code) onChange(next || undefined);
    else edit(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(a + piece.length, a + piece.length);
    });
  };
  const toggle = (p: "names" | "help") => setPanel(panel === p ? null : p);
  const ph = placeholder ? t("fields.example", { text: code ? placeholder : toReadable(placeholder, lex) }) : t("fields.formula");
  const btn = (on: boolean) => cn("h-8 rounded-[var(--radius)] border border-border px-2 text-ui hover:bg-muted", on && "border-foreground");

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-start gap-1">
        {code ? (
          <textarea ref={area} className={cn(textareaClass, "font-mono")} rows={rows} value={value ?? ""} placeholder={ph} spellCheck={false} onChange={(e) => onChange(e.target.value || undefined)} {...rest} />
        ) : (
          <textarea ref={area} className={cn(textareaClass, error && "border-error")} rows={rows} value={draft} placeholder={ph} spellCheck={false} onChange={(e) => edit(e.target.value)} aria-invalid={!!error} {...rest} />
        )}
        <button type="button" className={btn(panel === "names")} aria-expanded={panel === "names"} title={t("fields.namesTitle")} onClick={() => toggle("names")}>
          {t("fields.names")}
        </button>
        <button type="button" className={btn(panel === "help")} aria-expanded={panel === "help"} title={t("fields.syntaxTitle")} onClick={() => toggle("help")}>
          {t("fields.fx")}
        </button>
        <button type="button" className={btn(code)} aria-pressed={code} title={t("fields.codeTitle")} onClick={() => setCode(!code)}>
          {t("fields.code")}
        </button>
      </div>
      {error && !code && (
        <span className="text-error" role="alert">
          {error}
        </span>
      )}
      {panel === "help" && (
        <div className="rounded-[var(--radius)] border border-border bg-muted p-2">
          <ExprHelp />
        </div>
      )}
      {panel === "names" && <NamesList lex={lex} slots={slots ?? {}} onPick={insert} />}
    </div>
  );
}

/** Everything a formula can read, grouped, with what it means. A click inserts it at the cursor. */
function NamesList({ lex, slots, onPick }: { lex: Lexicon; slots: Record<string, Param>; onPick: (readable: string, raw: string) => void }) {
  const t = useTranslations("library.fields");
  const vocab = useVocab();
  const fmt = useFmtParam();
  const [q, setQ] = useState("");
  const settings = [...lex.slotLabels].filter(([k, l]) => matches(q, k, l));
  const groups = (Object.keys(NAME_GROUPS) as NameGroup[])
    .filter((g) => g !== "building")
    .map((g) => [g, NAME_GROUPS[g].filter((n) => matches(q, n, vocab.nameLabel(n), vocab.nameHelp(n)))] as const);
  const building = BUILDING_FIELDS.map((f) => ({ raw: `building.${f}`, text: `${vocab.nameLabel("building")} › ${vocab.nameLabel(f)}`, name: f })).filter((b) => matches(q, b.raw, b.text));
  const item = (key: string, text: string, raw: string, meta: ReactNode) => (
    <li key={key}>
      <button type="button" className={linkButton} onClick={() => onPick(`[${text}]`, raw)} title={raw}>
        {text}
      </button>
      {meta}
    </li>
  );
  return (
    <div className="flex max-h-80 flex-col gap-2 overflow-auto rounded-[var(--radius)] border border-border bg-muted p-2" data-testid="names-list">
      <input type="search" className={inputClass} placeholder={t("findName")} value={q} onChange={(e) => setQ(e.target.value)} />
      {settings.length > 0 && (
        <section>
          <h4 className="label-caps text-muted-foreground">{t("answersHere")}</h4>
          <ul>{settings.map(([k, label]) => item(k, label, `p.${k}`, <span className="text-muted-foreground"> {t("now", { value: fmt(slots[k]) })}</span>))}</ul>
        </section>
      )}
      {groups.map(([g, list]) =>
        list.length === 0 ? null : (
          <section key={g}>
            <h4 className="label-caps text-muted-foreground">{vocab.words("nameGroups", g)}</h4>
            <ul>
              {list.map((n) =>
                item(
                  n,
                  vocab.nameLabel(n),
                  n,
                  <>
                    {NAME_UNITS[n] && <span className="text-muted-foreground"> {NAME_UNITS[n]}</span>}
                    {vocab.nameHelp(n) && <span className="text-muted-foreground"> · {vocab.nameHelp(n)}</span>}
                  </>,
                ),
              )}
            </ul>
          </section>
        ),
      )}
      {building.length > 0 && (
        <section>
          <h4 className="label-caps text-muted-foreground">{vocab.words("nameGroups", "building")}</h4>
          <ul>{building.map((b) => item(b.raw, b.text, b.raw, NAME_UNITS[b.name] ? <span className="text-muted-foreground"> {NAME_UNITS[b.name]}</span> : null))}</ul>
        </section>
      )}
      <p className="text-muted-foreground">{t("propertySets")}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- slot binding */

export const isRef = (v: unknown): v is ParamRef => !!v && typeof v === "object" && !Array.isArray(v) && "param" in v;

/** A slot's current answer in words ("yes", "0.5 m2", the choice's label). */
export function useFmtParam() {
  const t = useTranslations("library.fields");
  return (p: Param | undefined): string => {
    if (!p) return t("notDefined");
    if (p.type === "boolean") return p.value ? t("yes") : t("no");
    if (p.type === "choice") return p.optionLabels?.[p.value] ?? p.value.replace(/_/g, " ");
    if (p.type === "formula") return p.choices?.find((c) => sameFormula(c.value, p.value))?.label ?? (p.value ? t("customFormula") : t("emptyFormula"));
    const v = String(p.value);
    return "unit" in p && p.unit ? `${v} ${p.unit}` : v;
  };
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
  const t = useTranslations("library.fields");
  const fmt = useFmtParam();
  const candidates = Object.entries(slots).filter(([, p]) => !slotType || p.type === slotType);
  const ref = isRef(value) ? value : null;
  const toggle = () => {
    if (ref) onChange(slots[ref.param]?.value as T | undefined);
    else if (candidates.length) onChange({ param: candidates[0]![0] });
  };
  return (
    <div className="flex min-w-0 items-center gap-1">
      {ref ? (
        <>
          <select className={inputClass} value={ref.param} onChange={(e) => onChange({ param: e.target.value })} aria-label={t("slot")}>
            {!slots[ref.param] && <option value={ref.param}>{t("slotNotDefined", { name: ref.param })}</option>}
            {candidates.map(([k, p]) => (
              <option key={k} value={k}>
                {p.label || k}
              </option>
            ))}
          </select>
          <span className="whitespace-nowrap text-muted-foreground" title={ref.param}>
            {t("now", { value: fmt(slots[ref.param]) })}
          </span>
        </>
      ) : (
        <div className="min-w-0 flex-1">{children(value as T | undefined, onChange as (v: T | undefined) => void)}</div>
      )}
      {(ref || candidates.length > 0) && (
        <button
          type="button"
          className={cn("h-8 rounded-[var(--radius)] border border-border px-2 text-ui hover:bg-muted", ref && "border-link text-link")}
          aria-pressed={!!ref}
          onClick={toggle}
          title={ref ? t("useFixed") : t("useSlot")}
        >
          {t("slotToggle")}
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
  const t = useTranslations("library.fields");
  const op = groupOp(value);
  const asNode = (g: Group<N>) => g as unknown as N;
  if (!op) {
    return (
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">{renderLeaf(value, onChange)}</div>
        <div className="flex items-center gap-2">
          {!onRemove && (
            <button type="button" className={linkButton} onClick={() => onChange(asNode({ all: [value, newLeaf()] }))}>
              {t("andMore")}
            </button>
          )}
          {onRemove && (
            <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={t("removeCondition")} onClick={onRemove}>
              ×
            </button>
          )}
        </div>
      </div>
    );
  }
  const g = value as unknown as Group<N>;
  const kids: N[] = "not" in g ? [g.not] : "all" in g ? g.all : g.any;
  const setOp = (next: "all" | "any" | "not") => onChange(asNode(next === "not" ? { not: kids[0] ?? newLeaf() } : next === "all" ? { all: kids } : { any: kids }));
  const setKids = (k: N[]) => onChange(asNode(op === "not" ? { not: k[0] ?? newLeaf() } : op === "all" ? { all: k } : { any: k }));
  return (
    <div className="flex flex-col gap-2 border-l-2 border-border pl-3">
      <div className="flex items-center gap-2">
        <select className={cn(inputClass, "w-auto")} value={op} onChange={(e) => setOp(e.target.value as "all" | "any" | "not")} aria-label={t("groupType")}>
          <option value="all">{t("allOf")}</option>
          <option value="any">{t("anyOf")}</option>
          <option value="not">{t("noneOf")}</option>
        </select>
        {onRemove ? (
          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={t("removeGroup")} onClick={onRemove}>
            ×
          </button>
        ) : (
          kids.length === 1 &&
          op !== "not" && (
            <button type="button" className={linkButton} onClick={() => onChange(kids[0]!)}>
              {t("ungroup")}
            </button>
          )
        )}
      </div>
      <div className="flex flex-col gap-2">
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
        <div className="flex gap-3">
          <button type="button" className={linkButton} onClick={() => setKids([...kids, newLeaf()])}>
            {t("addCondition")}
          </button>
          <button type="button" className={linkButton} onClick={() => setKids([...kids, asNode({ any: [newLeaf()] })])}>
            {t("addGroup")}
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
  /** Heading shown above the first row of each section (rows arrive grouped). */
  section?: string;
}

const BADGE_TONE: Record<NonNullable<NonNullable<RowInfo["badge"]>["tone"]>, string> = {
  new: "border-link text-link",
  changed: "border-link text-link",
  removed: "border-error text-error",
  inherited: "text-muted-foreground",
};

/** The left-hand list of a list/detail editor. */
export function RowList({ rows, selected, onSelect, onAdd, addLabel, filter, onFilter, empty, tools }: {
  rows: RowInfo[];
  selected: string | null;
  onSelect: (key: string) => void;
  onAdd?: () => void;
  addLabel?: string;
  filter?: string;
  onFilter?: (q: string) => void;
  empty?: string;
  /** More controls next to the filter, e.g. several add buttons. */
  tools?: ReactNode;
}) {
  const t = useTranslations("library.fields");
  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="row-list">
      <div className="flex flex-wrap items-center gap-2">
        {onFilter && <input type="search" className={cn(inputClass, "flex-1")} placeholder={t("filter")} aria-label={t("filter")} value={filter ?? ""} onChange={(e) => onFilter(e.target.value)} />}
        {onAdd && (
          <button type="button" className="h-8 rounded-[var(--radius)] border border-border px-2 text-ui hover:bg-muted" onClick={onAdd}>
            {addLabel ?? t("addItem")}
          </button>
        )}
        {tools}
      </div>
      <ul className="flex flex-col">
        {rows.length === 0 && <li className="py-2 text-muted-foreground">{empty ?? t("nothingYet")}</li>}
        {rows.map((r, i) => [
          r.section !== undefined && r.section !== rows[i - 1]?.section && (
            <li key={`section-${r.section}`} className="label-caps pt-3 pb-1 text-muted-foreground">
              {r.section}
            </li>
          ),
          <li key={r.key}>
            {/* Not a <button>: a read-only editor sits in a disabled <fieldset>, and choosing a row to
                look at it must keep working there. */}
            <div
              role="button"
              tabIndex={0}
              aria-pressed={selected === r.key}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(r.key);
                }
              }}
              data-testid="row"
              data-key={r.key}
              className={cn(
                "flex w-full cursor-pointer flex-col items-start rounded-[var(--radius)] px-2 py-1 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                selected === r.key && "bg-selection",
                r.badge?.tone === "removed" && "text-muted-foreground line-through",
              )}
              onClick={() => onSelect(r.key)}
            >
              <span className="flex items-center gap-2">
                {r.title}
                {r.badge && <span className={cn("label-caps rounded-[var(--radius)] border border-border px-1", BADGE_TONE[r.badge.tone ?? "inherited"])}>{r.badge.text}</span>}
              </span>
              {r.sub && <span className="text-muted-foreground">{r.sub}</span>}
            </div>
          </li>,
        ])}
      </ul>
    </div>
  );
}

export const matches = (q: string, ...texts: (string | undefined)[]) => !q || texts.some((t) => t?.toLowerCase().includes(q.toLowerCase()));
