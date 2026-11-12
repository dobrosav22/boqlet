/**
 * BoQ items in plain words: one sentence per item ("Measure the area (both faces) of walls where
 * material is a kind of concrete, minus openings larger than 0.5 m2, one line per type name,
 * written as …"). Each part of the sentence is a button that jumps to where it is edited.
 *
 * Words only: formulas are shown in their readable form (readable.ts) and never evaluated here.
 */
import { useMemo, type ReactNode } from "react";
import type { DeductionRule, DerivedRule, ItemRule, ManualItem, Param, QuantitySpec, Selector, Value } from "@ifc-boq/types";
import { fmtParam, isRef } from "./fields";
import { lexicon, toReadable, type Lexicon } from "./readable";
import {
  BREAKDOWN_WORDS,
  DEDUCT_MODE_WORDS,
  DEDUCT_WHAT_WORDS,
  LENGTH_WORDS,
  MASS_WORDS,
  NAMES,
  OP_LABEL,
  START_WORDS,
  SURFACE_WORDS,
  classWords,
} from "./vocab";

type Slots = Record<string, Param>;
/** Where a part of the sentence is edited. */
export type Part = "name" | "what" | "how" | "lines" | "text" | "more";

const listOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === "" ? [] : [v]);
/** Lower-case the first letter unless the word is an abbreviation ("IFC class"). */
const lc = (s: string) => (s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s);
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const joinAnd = (l: string[]) => (l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} and ${l[l.length - 1]}`);

/** A field name in words: "type_name" -> "type name", "props.Pset_WallCommon.FireRating" -> "property …". */
export function fieldWords(f: string): string {
  if (f.startsWith("props.")) return `property ${f.slice(6)}`;
  const n = NAMES.find((x) => x.name === f);
  return n ? lc(n.label) : f.replace(/_/g, " ");
}

/**
 * A formula in prose: readable names without their brackets, and a few common shapes in words:
 * "= null" as "is empty", COALESCE(a, b) as "a or b", UNDER(Material, "concrete") as "material is a
 * kind of concrete", IFC class = "IfcWall" as "element kind is walls". Only words: nothing is evaluated.
 */
export const prose = (expr: string, lex: Lexicon) =>
  toReadable(expr, lex)
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/\s*!=\s*null\b/gi, " is filled in")
    .replace(/\s*=\s*null\b/gi, " is empty")
    .replace(/\bCOALESCE\(([^()]*)\)/g, (_, args: string) => args.split(",").map((a) => a.trim()).join(" or "))
    .replace(/\bUNDER\(\s*([^,()"]+?)\s*,\s*"([^"]+)"\s*\)/g, (_, f: string, term: string) => `${lc(f)} is a kind of ${term}`)
    .replace(/\bIFC class\s*(!=|=)\s*"(Ifc\w+)"/g, (_, op: string, c: string) => `element kind ${op === "=" ? "is" : "is not"} ${classWords(c)}`)
    .replace(/"[^"]*"|\b(AND|OR|NOT)\b/g, (m, word?: string) => (word ? word.toLowerCase() : m));

const slotName = (name: string, slots: Slots) => `“${slots[name]?.label || name}”`;
/** A value in words; one taken from Settings reads as its current answer (the sentence lists those answers below). */
function valueWords<T>(v: Value<T> | undefined, words: Partial<Record<string, string>>, slots: Slots): string | undefined {
  if (v === undefined) return undefined;
  if (isRef(v)) {
    const p = slots[v.param];
    const now = p ? String(p.value) : undefined;
    return now === undefined ? "?" : words[now] ?? fmtParam(p);
  }
  return words[String(v)] ?? String(v).replace(/_/g, " ");
}

/** A formula answer: the ready-made formula's name and the formula, e.g. "Both faces: 2 × Net area". */
function formulaAnswer(name: string, slots: Slots, lex: Lexicon): string {
  const p = slots[name];
  if (!p || p.type !== "formula") return `${slotName(name, slots)} (not defined)`;
  const f = prose(p.value, lex) || "an empty formula";
  const label = fmtParam(p);
  return label === "custom formula" || label === "(empty formula)" ? f : `${label}: ${f}`;
}

/** The Settings answers an entry follows, in the order it uses them (its own switch excluded). */
function answersUsed(entry: object): string[] {
  const { enabled: _skip, ...rest } = entry as { enabled?: unknown };
  const blob = JSON.stringify(rest);
  const names = [...blob.matchAll(/"param":"([^"]+)"/g), ...blob.matchAll(/\bp\.([A-Za-z_]\w*)/g)].map((m) => m[1]);
  return [...new Set(names)];
}

function FollowsNote({ entry, slots }: { entry: object; slots: Slots }) {
  const used = answersUsed(entry);
  if (!used.length) return null;
  return (
    <span className="story-follows">
      Follows Settings:{" "}
      {used.map((n, i) => (
        <span key={n}>
          {i > 0 && "; "}
          {slotName(n, slots)} <span className="muted">(now {fmtParam(slots[n])})</span>
        </span>
      ))}
      .
    </span>
  );
}

/* ---------------------------------------------------------------- which elements */

/** A match as "kinds of element" plus further conditions: `{ifcClass}` or `{all: [{ifcClass}, …]}`. */
export function decomposeMatch(s: Selector): { classes: string[]; extra: Selector[] } {
  if ("ifcClass" in s) return { classes: listOf(s.ifcClass).map(String), extra: [] };
  if ("all" in s) {
    const first = s.all[0];
    return first && "ifcClass" in first ? { classes: listOf(first.ifcClass).map(String), extra: s.all.slice(1) } : { classes: [], extra: s.all };
  }
  return { classes: [], extra: [s] };
}
export function composeMatch(classes: string[], extra: Selector[]): Selector {
  const parts: Selector[] = [...(classes.length ? [{ ifcClass: classes.length === 1 ? classes[0] : classes }] : []), ...extra];
  return parts.length === 1 ? parts[0] : parts.length === 0 ? { ifcClass: [] } : { all: parts };
}

/** One condition in words. */
export function condWords(s: Selector, slots: Slots, lex: Lexicon): string {
  if ("all" in s) return s.all.map((x) => condWords(x, slots, lex)).join(" and ");
  if ("any" in s) return `either ${s.any.map((x) => condWords(x, slots, lex)).join(" or ")}`;
  if ("not" in s) return `not (${condWords(s.not, slots, lex)})`;
  if ("ifcClass" in s) return `they are ${joinAnd(listOf(s.ifcClass).map((c) => classWords(String(c))))}`;
  if ("family" in s) return `they are ${listOf(s.family).join(" or ")} elements`;
  if ("expr" in s) return prose(s.expr, lex) || "(empty formula)";
  const v = isRef(s.value)
    ? fmtParam(slots[s.value.param])
    : listOf(s.value)
        .map((x) => (x === true ? "yes" : x === false ? "no" : String(x)))
        .join(s.op === "between" ? " and " : " or ");
  return `${fieldWords(s.field)} ${OP_LABEL[s.op]}${v ? ` ${v}` : ""}`;
}

/** "walls and slabs" (or "elements" when no kind is named). */
export function whatShort(s: Selector): string {
  const { classes } = decomposeMatch(s);
  return classes.length ? joinAnd(classes.map(classWords)) : "elements";
}

/* ---------------------------------------------------------------- how it is measured */

const COMPARE_UNIT: Record<string, string> = { area: "m2", width: "m", height: "m", length: "m", volume: "m3" };

export function deductionWords(d: DeductionRule, slots: Slots, lex: Lexicon): string | null {
  const what = DEDUCT_WHAT_WORDS[d.what];
  const mode = isRef(d.mode) ? (slots[d.mode.param]?.value as string | undefined) : d.mode;
  if (mode === "none" && !isRef(d.mode)) return null;
  const by = isRef(d.compareBy) ? (slots[d.compareBy.param]?.value as string) : d.compareBy ?? "area";
  const size = d.threshold === undefined ? "?" : `${isRef(d.threshold) ? slots[d.threshold.param]?.value ?? "?" : d.threshold} ${COMPARE_UNIT[by] ?? ""}`.trim();
  const sizeBy = by && by !== "area" ? ` (by ${by})` : "";
  let text =
    mode === "all" ? `minus all ${what}`
    : mode === "over_threshold" ? `minus ${what} larger than ${size}${sizeBy}`
    : mode === "excess_only" ? `minus the part of ${what} above ${size}${sizeBy}`
    : mode === "per_element_sum" ? `minus all ${what} when together they exceed ${size}`
    : mode === "none" ? `nothing taken out for ${what}`
    : `minus ${what} (${DEDUCT_MODE_WORDS[mode as keyof typeof DEDUCT_MODE_WORDS] ?? mode})`;
  if (d.where) text += ` where ${prose(d.where, lex)}`;
  if (d.addReveals === true || isRef(d.addReveals)) text += ", reveals added back";
  return text;
}

/** "area (both faces)", "volume", "length (along the axis)": a way of measuring without its verb. */
export function qtyShort(q: QuantitySpec, slots: Slots, lex?: Lexicon): string {
  const L = lex ?? lexicon(slots);
  const bits = (...b: (string | undefined)[]) => {
    const l = b.filter(Boolean);
    return l.length ? ` (${l.join(", ")})` : "";
  };
  const unit = "unit" in q && q.unit && q.kind !== "formula" ? ` in ${q.unit}` : "";
  switch (q.kind) {
    case "count":
      return `count${unit}`;
    case "length":
      return `length${bits(valueWords(q.basis, LENGTH_WORDS, slots))}${unit}`;
    case "area":
      return `area${bits(valueWords(q.surface, SURFACE_WORDS, slots), valueWords(q.start, START_WORDS, slots))}${unit}`;
    case "volume":
      return `volume${bits(valueWords(q.start, START_WORDS, slots))}${unit}`;
    case "mass":
      return `weight${bits(valueWords(q.basis, MASS_WORDS, slots))}${unit}`;
    case "perimeter":
      return `perimeter${unit}`;
    case "formula":
      return `${isRef(q.expr) ? formulaAnswer(q.expr.param, slots, L) : prose(q.expr, L) || "an empty formula"}, in ${q.unit}`;
    case "when":
      return `if ${prose(q.if, L) || "…"}: ${qtyShort(q.then, slots, L)}, otherwise ${qtyShort(q.else, slots, L)}`;
    case "choose": {
      const now = isRef(q.pick) ? (slots[q.pick.param]?.value as string | undefined) : q.pick;
      const chosen = now !== undefined ? q.options[now] : undefined;
      const from = isRef(q.pick) ? `Settings ${slotName(q.pick.param, slots)}` : "a fixed choice";
      return `as ${from} says (now ${chosen ? qtyShort(chosen, slots, L) : `“${now ?? "?"}”, which has no way of measuring`})`;
    }
  }
}

/* ---------------------------------------------------------------- lines and text */

const IF_FIELD = /^IF\((.+),\s*([A-Za-z_][\w.]*)\s*,\s*""\s*\)$/;
const condProse = (c: string, slots: Slots, lex: Lexicon) => {
  const m = /^p\.([A-Za-z_]\w*)$/.exec(c.trim());
  return m && slots[m[1]]?.type === "boolean" ? `${slotName(m[1], slots)} is yes` : prose(c, lex);
};

/** One "split lines by" entry in words: a field, or "storey, when “Lines per storey” is yes". */
export function lineKeyWords(k: string, slots: Slots, lex: Lexicon): string {
  if (/^[A-Za-z_][\w]*$/.test(k) || k.startsWith("props.")) return fieldWords(k);
  const m = IF_FIELD.exec(k.trim());
  if (m) return `${fieldWords(m[2])}, when ${condProse(m[1], slots, lex)}`;
  return prose(k, lex);
}

/** A line text template as pieces: plain text, and placeholders in words. */
export function templatePieces(t: string, slots: Slots, lex: Lexicon): { text: string; value?: boolean }[] {
  const out: { text: string; value?: boolean }[] = [];
  const re = /\{(expr:)?([^{}]*)\}/g;
  let last = 0;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    if (m.index > last) out.push({ text: t.slice(last, m.index) });
    const inner = m[2].trim();
    const glued = /^IF\((.+),\s*"([^"]*)"\s*\+\s*([A-Za-z_][\w.]*)\s*,\s*""\s*\)$/.exec(inner);
    out.push({ value: true, text: glued ? `${glued[2]}${fieldWords(glued[3])} when ${condProse(glued[1], slots, lex)}` : prose(inner.replace(/\*\s*1000$/, ""), lex) + (/\*\s*1000$/.test(inner) ? " in mm" : "") });
    last = m.index + m[0].length;
  }
  if (last < t.length) out.push({ text: t.slice(last) });
  return out;
}

export function TemplateWords({ value, slots }: { value: Value<string>; slots: Slots }) {
  const lex = useMemo(() => lexicon(slots), [slots]);
  if (isRef(value)) return <>the text from Settings {slotName(value.param, slots)}</>;
  if (!value) return <span className="muted">(no text)</span>;
  return (
    <span className="tpl">
      “
      {templatePieces(value, slots, lex).map((p, i) =>
        p.value ? (
          <span key={i} className="tpl-value">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
      ”
    </span>
  );
}

/* ---------------------------------------------------------------- the sentences */

function Seg({ part, onJump, children, title }: { part: Part; onJump: (p: Part) => void; children: ReactNode; title?: string }) {
  // a span, not a button: inherited items are shown in a disabled fieldset, and jumping must still work
  return (
    <span
      role="button"
      tabIndex={0}
      className={`story-seg story-${part}`}
      onClick={() => onJump(part)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onJump(part))}
      title={title ?? "Show where this is set"}
    >
      {children}
    </span>
  );
}

function SwitchNote({ enabled, slots }: { enabled: Value<boolean> | undefined; slots: Slots }) {
  if (isRef(enabled)) {
    const on = slots[enabled.param]?.value === true;
    return (
      <span className={on ? "" : "story-off"}>
        {on ? "In the BoQ" : "Not in the BoQ"}: switched by Settings {slotName(enabled.param, slots)} (now {on ? "yes" : "no"}).{" "}
      </span>
    );
  }
  if (enabled === false) return <span className="story-off">Switched off: not in the BoQ. </span>;
  return null;
}

/** What "More options" changes, in a few words; also its summary line. */
export function itemExtras(item: ItemRule, slots: Slots): string[] {
  const out: string[] = [];
  if (item.scope === "out") out.push("only elements left out of this BoQ");
  if (item.parts === "include") out.push("parts of assemblies included");
  if (item.breakdown !== undefined) out.push(`split into ${valueWords(item.breakdown, BREAKDOWN_WORDS, slots)}`);
  if (item.partFilter) out.push("only some parts");
  if (item.bands?.length) out.push(`bands by ${item.bands.map((b) => fieldWords(b.field)).join(", ")}`);
  if (item.factor !== undefined) out.push(`× ${isRef(item.factor) ? slots[item.factor.param]?.value ?? "?" : item.factor}`);
  if (item.minimum) out.push("a minimum quantity");
  if (item.rounding) out.push("own rounding");
  if (item.onMissing !== undefined) out.push(`missing values: ${typeof item.onMissing === "string" ? item.onMissing : "default value"}`);
  return out;
}

export function ItemStory({ item, slots, onJump }: { item: ItemRule; slots: Slots; onJump: (p: Part) => void }) {
  const lex = useMemo(() => lexicon(slots), [slots]);
  const { classes, extra } = decomposeMatch(item.match);
  const q = item.quantity;
  const verb =
    q.kind === "count" ? "Count" : q.kind === "formula" ? "Calculate" : q.kind === "when" || q.kind === "choose" ? "Measure" : `Measure the ${qtyShort(q, slots, lex)} of`;
  const after = q.kind === "formula" ? `: ${qtyShort(q, slots, lex)}` : q.kind === "when" || q.kind === "choose" ? `: ${qtyShort(q, slots, lex)}` : q.kind === "count" && q.unit ? ` (in ${q.unit})` : "";
  const forEach = q.kind === "formula" ? "for each of the " : "";
  const only = extra.filter((x) => !("not" in x)).map((x) => condWords(x, slots, lex));
  const except = extra.filter((x): x is { not: Selector } => "not" in x).map((x) => condWords(x.not, slots, lex));
  const deductions = "deductions" in q ? (q.deductions ?? []).map((d) => deductionWords(d, slots, lex)).filter((x): x is string => !!x) : [];
  const keys = (item.lineKey ?? []).map((k) => lineKeyWords(String(k), slots, lex));
  const extras = itemExtras(item, slots);

  return (
    <div className="story">
      <p>
        <Seg part="how" onJump={onJump}>{verb}</Seg> {forEach}
        <Seg part="what" onJump={onJump}>
          {classes.length ? joinAnd(classes.map(classWords)) : "elements"}
          {only.length > 0 && ` where ${only.join(" and ")}`}
          {except.length > 0 && `, except where ${except.join(" or ")}`}
        </Seg>
        {after && <Seg part="how" onJump={onJump}>{after}</Seg>}
        {deductions.length > 0 && (
          <>
            , <Seg part="how" onJump={onJump}>{deductions.join("; ")}</Seg>
          </>
        )}
        ,{" "}
        <Seg part="lines" onJump={onJump}>
          {keys.length ? `one line per ${keys.join("; ")}` : "all in one line"}
        </Seg>
        , written as{" "}
        <Seg part="text" onJump={onJump}>
          <TemplateWords value={item.description} slots={slots} />
        </Seg>
        .
      </p>
      <p className="story-meta">
        <SwitchNote enabled={item.enabled} slots={slots} />
        {extras.length > 0 && (
          <>
            Also: <Seg part="more" onJump={onJump}>{extras.join(", ")}</Seg>.{" "}
          </>
        )}
        <FollowsNote entry={item} slots={slots} />
      </p>
    </div>
  );
}

export function DerivedStory({ rule, slots, ruleLabel, onJump }: { rule: DerivedRule; slots: Slots; ruleLabel: (id: string) => string; onJump: (p: Part) => void }) {
  const lex = useMemo(() => lexicon(slots), [slots]);
  const formula = isRef(rule.quantity) ? formulaAnswer(rule.quantity.param, slots, lex) : prose(rule.quantity, lex) || "an empty formula";
  const lines = rule.lineKey === undefined ? "one line for each source line" : rule.lineKey.length === 0 ? "all in one line" : `one line per ${rule.lineKey.map((k) => lineKeyWords(String(k), slots, lex)).join("; ")}`;
  return (
    <div className="story">
      <p>
        For each <Seg part="what" onJump={onJump}>{rule.scope === "line" ? "line" : "element"} of {rule.from.length ? joinAnd(rule.from.map((f) => `“${ruleLabel(f)}”`)) : "(no item chosen)"}{rule.where ? ` where ${prose(rule.where, lex)}` : ""}</Seg>, calculate{" "}
        <Seg part="how" onJump={onJump}>{formula} {rule.unit}</Seg>, <Seg part="lines" onJump={onJump}>{lines}</Seg>, written as{" "}
        <Seg part="text" onJump={onJump}>
          <TemplateWords value={rule.description} slots={slots} />
        </Seg>
        .
      </p>
      <p className="story-meta">
        <SwitchNote enabled={rule.enabled} slots={slots} />
        <FollowsNote entry={rule} slots={slots} />
      </p>
    </div>
  );
}

export function ManualStory({ item, slots, onJump }: { item: ManualItem; slots: Slots; onJump: (p: Part) => void }) {
  const lex = useMemo(() => lexicon(slots), [slots]);
  const qty =
    item.formula !== undefined
      ? `calculated as ${isRef(item.formula) ? formulaAnswer(item.formula.param, slots, lex) : prose(item.formula, lex)}`
      : item.quantity === undefined ? "a quantity left for you to fill in"
      : isRef(item.quantity) ? String(slots[item.quantity.param]?.value ?? "?")
      : String(item.quantity);
  return (
    <div className="story">
      <p>
        A line with no model behind it (<Seg part="name" onJump={onJump}>{item.kind.replace(/_/g, " ")}</Seg>), written as{" "}
        <Seg part="text" onJump={onJump}>
          <TemplateWords value={item.description} slots={slots} />
        </Seg>
        , with <Seg part="how" onJump={onJump}>{qty}</Seg> {item.unit}
        {item.amount !== undefined && <>, amount {isRef(item.amount) ? slots[item.amount.param]?.value ?? "?" : item.amount}</>}.
      </p>
      <p className="story-meta">
        <SwitchNote enabled={item.enabled} slots={slots} />
        <FollowsNote entry={item} slots={slots} />
      </p>
    </div>
  );
}
