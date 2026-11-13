/**
 * The classification editor's pure logic, ported from the PoC (`classStory.tsx`, `ClassTable.tsx`,
 * `ClassificationEditor.tsx`): the kinds of BoQ line a rule set makes, which map rules give each
 * kind its code, the "Codes per line" table read from and written to ordinary map rules, code
 * suggestions, and the code list as a tree. No words here (they are in `class-story.tsx`, F15) and
 * no numbers: a classification never changes a quantity (BR-02). Conditions are only described,
 * never evaluated (CLAUDE.md rule 4).
 */
import type { ClassificationMap, Code, CodeList, CodeTarget, LineMatch, MapRule, RuleSet } from "@ifc-boq/types";
import { uniqueId } from "../shared/doc";

/* ---------------------------------------------------------------- kinds of BoQ line */

export interface LineKind {
  id: string;
  label: string;
  group: "item" | "derived" | "manual";
  tags: string[];
  manualKind?: string;
  /** Derived items: the items they are calculated from. */
  from?: string[];
  /** A row kept for a rule set that has this item, while the chosen one doesn't. */
  orphan?: boolean;
}

export function lineKinds(rs: RuleSet): LineKind[] {
  return [
    ...rs.items.map((i): LineKind => ({ id: i.id, label: i.label || i.id, group: "item", tags: i.tags ?? [] })),
    ...(rs.derived ?? []).map((d): LineKind => ({ id: d.id, label: d.label || d.id, group: "derived", tags: d.tags ?? [], from: d.from })),
    ...(rs.manual ?? []).map((m): LineKind => ({ id: m.id, label: typeof m.description === "string" ? m.description : m.id, group: "manual", tags: m.tags ?? [], manualKind: m.kind })),
  ];
}

export const asList = (v: string | string[]) => (Array.isArray(v) ? v : [v]);

/* ---------------------------------------------------------------- which rules give a line kind its code */

/** A condition on a line's values, kept as a tree so it can be put in words later. */
export type Cond = { where: string } | { not: Cond } | { all: Cond[] } | { any: Cond[] };

type Fit = { fit: "yes" } | { fit: "no" } | { fit: "maybe"; when: Cond };

/** Does a rule's match take this kind of line: for sure, not at all, or only when a condition holds? */
export function fits(m: LineMatch, k: LineKind): Fit {
  if ("ruleId" in m) return { fit: asList(m.ruleId).includes(k.id) ? "yes" : "no" };
  if ("tag" in m) return { fit: asList(m.tag).some((t) => k.tags.includes(t)) ? "yes" : "no" };
  if ("manualKind" in m) return { fit: k.manualKind && asList(m.manualKind).includes(k.manualKind) ? "yes" : "no" };
  if ("where" in m) return { fit: "maybe", when: { where: m.where } };
  if ("not" in m) {
    const f = fits(m.not, k);
    return f.fit === "yes" ? { fit: "no" } : f.fit === "no" ? { fit: "yes" } : { fit: "maybe", when: { not: f.when } };
  }
  const parts = ("all" in m ? m.all : m.any).map((x) => fits(x, k));
  const maybes = parts.filter((p): p is Extract<Fit, { fit: "maybe" }> => p.fit === "maybe").map((p) => p.when);
  const join = (key: "all" | "any"): Cond => (maybes.length === 1 ? maybes[0]! : key === "all" ? { all: maybes } : { any: maybes });
  if ("all" in m) return parts.some((p) => p.fit === "no") ? { fit: "no" } : maybes.length ? { fit: "maybe", when: join("all") } : { fit: "yes" };
  return parts.some((p) => p.fit === "yes") ? { fit: "yes" } : maybes.length ? { fit: "maybe", when: join("any") } : { fit: "no" };
}

/** Aimed at particular BoQ items (by id, tag or hand-entered kind), rather than at any line meeting a condition. */
export function aimed(m: LineMatch): boolean {
  if ("ruleId" in m || "tag" in m || "manualKind" in m) return true;
  if ("all" in m) return m.all.some(aimed);
  if ("any" in m) return m.any.every(aimed);
  return false;
}

export interface Step {
  rule: MapRule;
  index: number;
  /** Undefined: applies to every line of this kind. */
  when?: Cond;
  /** The code, resolved where it can be (a lookup by rule id; "same as source"). */
  code: CodeTarget;
}

export interface Outcome {
  /** Rules that win when their condition holds, before `base`. */
  ifs: Step[];
  /** The rule every other line of this kind falls to; undefined when none is sure to apply. */
  base?: Step;
  /** Rules by condition not aimed at any item that may also apply, when there is no base. */
  general: Step[];
}

const resolve = (t: CodeTarget, k: LineKind): CodeTarget => (typeof t === "object" && "lookup" in t && t.lookup === "rule_id" ? (t.table[k.id] ?? t.default ?? "") : t);

/** Map rules from highest priority down, ties to the earlier rule (as the engine orders them). */
export const byPriority = (rules: MapRule[]) => rules.map((rule, index) => ({ rule, index })).sort((a, b) => (b.rule.priority ?? 0) - (a.rule.priority ?? 0) || a.index - b.index);

/** How lines of one kind get their code from a map. */
export function outcomeFor(map: ClassificationMap, k: LineKind): Outcome {
  const ifs: Step[] = [];
  const general: Step[] = [];
  for (const { rule, index } of byPriority(map.rules)) {
    const f = fits(rule.match, k);
    if (f.fit === "no") continue;
    const step: Step = { rule, index, code: resolve(rule.code, k), ...(f.fit === "maybe" ? { when: f.when } : {}) };
    if (f.fit === "yes") return { ifs, base: step, general: [] };
    (aimed(rule.match) ? ifs : general).push(step);
  }
  return { ifs, general };
}

/** Some rule (table or other) can give lines of this kind a code. */
export const covered = (o: Outcome) => !!o.base || o.ifs.length > 0 || o.general.length > 0;

/** One code a derived line will carry: follows "same as its source" one step. */
export function sourceCode(map: ClassificationMap, k: LineKind, kinds: LineKind[]): string | undefined {
  const src = kinds.find((x) => x.id === k.from?.[0]);
  const b = src && outcomeFor(map, src).base;
  return b && typeof b.code === "string" ? b.code : undefined;
}

/** How many kinds of line always get a code, only in some cases, or never. */
export function coverage(map: ClassificationMap, kinds: LineKind[]) {
  let sure = 0;
  let some = 0;
  for (const k of kinds) {
    const o = outcomeFor(map, k);
    if (o.base && !o.ifs.length) sure++;
    else if (covered(o)) some++;
  }
  return { sure, some, none: kinds.length - sure - some };
}

/* ---------------------------------------------------------------- the table <-> map rules */

/*
 * The table reads and writes ordinary map rules in a fixed shape, so the engine needs nothing new:
 *   plain    { match: { ruleId: X }, code, priority: 5 }
 *   split    { match: { all: [ { ruleId: X }, { where: <canonical condition> } ] }, code, priority: 6 }
 * Rules of any other shape stay "advanced": they still apply, but table rows take priority.
 */

export type SplitKind = "none" | "external" | "material" | "element_type";
export const SPLIT_KINDS = ["none", "external", "material", "element_type"] as const satisfies readonly SplitKind[];
/** null = no code from the table. */
export type Target = string | { fromSource: true } | null;

export interface RowConfig {
  split: SplitKind;
  /** No split: the row's code. Split: the code for "everything else". */
  code: Target;
  values: { value: string; code: Target }[];
}

export const emptyRow = (): RowConfig => ({ split: "none", code: null, values: [] });

export const whereFor = (kind: SplitKind, value: string) => (kind === "external" ? `is_external = ${value}` : `UNDER(${kind}, "${value}")`);

export function parseWhere(w: string): { kind: SplitKind; value: string } | null {
  let m = /^is_external = (true|false)$/.exec(w.trim());
  if (m) return { kind: "external", value: m[1]! };
  m = /^UNDER\((material|element_type), "([^"]+)"\)$/.exec(w.trim());
  return m ? { kind: m[1] as SplitKind, value: m[2]! } : null;
}

const asTarget = (c: CodeTarget): Target | undefined => (typeof c === "string" ? c : "fromSource" in c ? { fromSource: true } : undefined);

/** Which map rules the table understands, per line kind; the rest are advanced. */
export function readTable(map: ClassificationMap) {
  const rows = new Map<string, RowConfig>();
  const used = new Set<number>();
  map.rules.forEach((r, i) => {
    const t = asTarget(r.code);
    if (t === undefined) return;
    const m = r.match as Record<string, unknown>;
    if (Object.keys(m).length === 1 && typeof m.ruleId === "string") {
      const row = rows.get(m.ruleId) ?? emptyRow();
      if (row.code !== null) return; // a second plain rule for the same line kind: advanced
      rows.set(m.ruleId, { ...row, code: t });
      used.add(i);
      return;
    }
    const all = m.all as Record<string, unknown>[] | undefined;
    if (Object.keys(m).length === 1 && all?.length === 2 && typeof all[0]!.ruleId === "string" && Object.keys(all[0]!).length === 1 && typeof all[1]!.where === "string") {
      const w = parseWhere(all[1]!.where as string);
      const id = all[0]!.ruleId as string;
      const row = rows.get(id) ?? emptyRow();
      if (!w || (row.split !== "none" && row.split !== w.kind)) return;
      rows.set(id, { ...row, split: w.kind, values: [...row.values, { value: w.value, code: t }] });
      used.add(i);
    }
  });
  return { rows, used };
}

/** Replace the table's rules for one line kind. New rules go first, so they win ties. */
export function writeRow(map: ClassificationMap, id: string, cfg: RowConfig): ClassificationMap {
  const { used } = readTable(map);
  const mine = (r: MapRule, i: number) => {
    if (!used.has(i)) return false;
    const m = r.match as { ruleId?: string; all?: { ruleId?: string }[] };
    return m.ruleId === id || m.all?.[0]?.ruleId === id;
  };
  const kept = map.rules.filter((r, i) => !mine(r, i));
  const depth = (v: string) => v.split(".").length;
  const fresh: MapRule[] = [];
  if (cfg.split !== "none")
    for (const v of [...cfg.values].sort((a, b) => depth(b.value) - depth(a.value)))
      if (v.code && v.value) fresh.push({ id: `t-${id}-${v.value}`, match: { all: [{ ruleId: id }, { where: whereFor(cfg.split, v.value) }] }, code: v.code, priority: 6 });
  if (cfg.code) fresh.push({ id: `t-${id}`, match: { ruleId: id }, code: cfg.code, priority: 5 });
  return { ...map, rules: [...fresh, ...kept] };
}

/** Advanced rules that name a line kind directly (by rule id or a rule-id lookup): `[rule id, code]`. */
export function viaAdvanced(advanced: MapRule[], id: string): [string, string | null][] {
  return advanced.flatMap((r): [string, string | null][] => {
    const m = r.match as { ruleId?: string | string[] };
    const ids = m.ruleId === undefined ? [] : asList(m.ruleId);
    const lookup = typeof r.code === "object" && "lookup" in r.code && r.code.lookup === "rule_id" ? r.code.table[id] : undefined;
    if (lookup) return [[r.id, lookup]];
    if (ids.includes(id)) return [[r.id, typeof r.code === "string" ? r.code : null]];
    return [];
  });
}

/* ---------------------------------------------------------------- suggestions */

const STOP = new Set(["to", "of", "and", "the", "in", "for", "from", "a", "an", "with", "by", "estimate", "estimated", "other"]);
const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => w.replace(/(ings|ing|es|s)$/, ""));

/** Best code for a line kind by word overlap with code titles; deeper (more specific) codes win ties. */
export function suggest(label: string, codes: CodeList["codes"]): string | null {
  const want = new Set(words(label));
  let best: { code: string; score: number } | null = null;
  for (const c of codes) {
    const have = words(c.title);
    const hits = have.filter((w) => want.has(w)).length;
    if (!hits) continue;
    const score = hits / Math.sqrt(have.length) + c.code.length * 0.001;
    if (!best || score > best.score) best = { code: c.code, score };
  }
  return best?.code ?? null;
}

/* ---------------------------------------------------------------- the code list */

export const targetCodes = (t: CodeTarget): string[] => (typeof t === "string" ? [t] : "table" in t ? [...Object.values(t.table), ...(t.default ? [t.default] : [])] : []);

/** Which map rules give each code. */
export function codeUsage(map: ClassificationMap): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of map.rules) for (const c of new Set(targetCodes(r.code))) (out[c] ??= []).push(r.id);
  return out;
}

export function parentOf(c: Code, sep: string | undefined, known: Set<string>): string | undefined {
  if (c.parent) return c.parent;
  if (!sep || !c.code.includes(sep)) return undefined;
  const p = c.code.slice(0, c.code.lastIndexOf(sep));
  return known.has(p) ? p : undefined;
}

export interface TreeRow {
  c: Code;
  /** Index in `codes`. */
  i: number;
  depth: number;
}

/**
 * The codes in depth-first order with their depth, so the list reads as a tree. Linear in the
 * number of codes (a Uniclass table has thousands). Codes whose parent chain loops, or names a
 * code that isn't in the list, are shown at the top level rather than lost.
 */
export function treeOrder(codes: Code[], sep: string | undefined): TreeRow[] {
  const known = new Set(codes.map((c) => c.code));
  const kids = new Map<string | undefined, number[]>();
  codes.forEach((c, i) => {
    const p = parentOf(c, sep, known);
    const key = p !== undefined && known.has(p) && p !== c.code ? p : undefined;
    const list = kids.get(key);
    if (list) list.push(i);
    else kids.set(key, [i]);
  });
  const out: TreeRow[] = [];
  const seen = new Set<number>();
  const walk = (root: number, depth: number) => {
    const stack: [number, number][] = [[root, depth]];
    while (stack.length) {
      const [i, d] = stack.pop()!;
      if (seen.has(i)) continue;
      seen.add(i);
      out.push({ c: codes[i]!, i, depth: d });
      const children = kids.get(codes[i]!.code) ?? [];
      for (let j = children.length - 1; j >= 0; j--) stack.push([children[j]!, d + 1]);
    }
  };
  for (const i of kids.get(undefined) ?? []) walk(i, 0);
  // Codes caught in a parent loop never hang under the top level: show them anyway.
  codes.forEach((_, i) => !seen.has(i) && walk(i, 0));
  return out;
}

/** Rows of the code list per page: big lists (Uniclass) only ever put one page in the DOM. */
export const PAGE_SIZE = 200;

/** One page of rows; a page past the end shows the last one. */
export function pageOf<T>(rows: T[], page: number, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.max(0, Math.min(page, pages - 1));
  return { rows: rows.slice(current * size, (current + 1) * size), current, pages, from: current * size + 1 };
}

/** A fresh code under `parent` (or at the top level), unique in the list. */
export function newCode(codes: Code[], sep: string | undefined, parent: string | undefined, title: string): Code {
  const known = new Set(codes.map((c) => c.code));
  const siblings = codes.filter((c) => parentOf(c, sep, known) === parent).length;
  const suffix = String(siblings + 1).padStart(2, "0");
  const base = parent ? `${parent}${sep ?? "."}${suffix}` : String.fromCharCode(65 + Math.min(siblings, 25));
  const code = uniqueId(base, known);
  return parent && !sep ? { code, title, parent } : { code, title };
}

/** Rename a code, and every code that names it as its parent. */
export const renameCode = (codes: Code[], i: number, code: string): Code[] => {
  const old = codes[i]!.code;
  return codes.map((c, j) => (j === i ? { ...c, code } : c.parent === old ? { ...c, parent: code } : c));
};

/** Import: put built codes into the list, adding to it (same code = update) or replacing it. */
export function mergeCodes(list: CodeList, built: Code[], mode: "merge" | "replace", separator: string | null): CodeList {
  const byCode = new Map((mode === "merge" ? list.codes : []).map((c) => [c.code, c]));
  for (const c of built) byCode.set(c.code, { ...byCode.get(c.code), ...c });
  const next: CodeList = { ...list, codes: [...byCode.values()] };
  if (separator) next.separator = separator;
  else delete next.separator;
  return next;
}
