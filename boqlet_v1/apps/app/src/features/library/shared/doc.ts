/**
 * Pure helpers over preset documents, ported from the PoC Library's `store.ts` (reuse-from-poc.md):
 * immutable list and object updates, ids, and renames that follow a name through a document. The
 * PoC's in-memory draft store is replaced by the API's drafts (`use-draft.ts`).
 */
import type { ClassificationMap, CodeList, Dictionary, OurRuleType, Param, RuleSet, RuleSetPatch } from "@ifc-boq/types";

/** A classification preset is a code list plus the map that assigns its codes. */
export interface ClassificationDoc {
  codeList: CodeList;
  map: ClassificationMap;
}

export type AnyDoc = OurRuleType | Dictionary | ClassificationDoc;

export const isPatch = (d: OurRuleType): d is RuleSetPatch => "extends" in d && typeof d.extends === "string";

export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";


/* ---------------------------------------------------------------- small immutable helpers */

/** Copy of `obj` with `key` set, or removed when the value is undefined. Keeps JSON free of empty keys. */
export function put<T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | undefined): T {
  const out = { ...obj };
  if (value === undefined) delete out[key];
  else out[key] = value;
  return out;
}

/**
 * Rename a slot everywhere in a rule set: its key in `params` (order kept), every `{ "param": from }`
 * (bound fields, `dependsOn`) and every `p.from` in formulas and templates.
 */
export function renameParam<T extends object>(doc: T, from: string, to: string): T {
  const re = new RegExp(`\\bp\\.${from}\\b`, "g");
  const walk = (x: unknown): unknown =>
    typeof x === "string"
      ? x.replace(re, `p.${to}`)
      : Array.isArray(x)
        ? x.map(walk)
        : x && typeof x === "object"
          ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === "param" && v === from ? to : walk(v)]))
          : x;
  const out = walk(doc) as T & { params?: Record<string, unknown> };
  if (out.params) out.params = Object.fromEntries(Object.entries(out.params).map(([k, v]) => [k === from ? to : k, v]));
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Rename a rule-set item id inside a classification map: `{ ruleId }` matches, `rule_id` lookup
 * tables and `rule_id = "…"` in `where` conditions. Returns the map and how many places changed.
 */
export function renameRuleInMap<T>(map: T, from: string, to: string): { map: T; changes: number } {
  let changes = 0;
  const re = new RegExp(`(\\brule_id\\s*!?=\\s*)"${escapeRe(from)}"`, "g");
  const walk = (x: unknown, key?: string): unknown => {
    if (typeof x === "string") {
      if (key === "where") {
        const out = x.replace(re, (_m, pre: string) => (changes++, `${pre}"${to}"`));
        return out;
      }
      return x;
    }
    if (Array.isArray(x)) return x.map((v) => (key === "ruleId" && v === from ? (changes++, to) : walk(v)));
    if (!x || typeof x !== "object") return x;
    const o = x as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(o).map(([k, v]) => {
        if (k === "ruleId" && v === from) return (changes++, [k, to]);
        if (k === "table" && o.lookup === "rule_id" && v && typeof v === "object" && from in (v as object))
          return (changes++, [k, Object.fromEntries(Object.entries(v as object).map(([tk, tv]) => [tk === from ? to : tk, tv]))]);
        return [k, walk(v, k)];
      }),
    );
  };
  const out = walk(map) as T;
  return { map: out, changes };
}

/**
 * Rename one answer of a choice slot everywhere in a rule set: the options of items that "choose"
 * by that slot, follow-up questions (`dependsOn` values) and `p.slot = "…"` in formulas. For a
 * patch, inherited items and questions that use it are copied into the patch with the new name.
 */
export function renameChoiceOption(doc: OurRuleType, parent: RuleSet | null, slot: string, from: string, to: string): OurRuleType {
  const re = new RegExp(`(\\bp\\.${slot}\\s*!?=\\s*)"${escapeRe(from)}"|"${escapeRe(from)}"(\\s*!?=\\s*p\\.${slot}\\b)`, "g");
  const walk = (x: unknown): unknown => {
    if (typeof x === "string") return x.replace(re, (_m, a?: string, b?: string) => (a !== undefined ? `${a}"${to}"` : `"${to}"${b}`));
    if (Array.isArray(x)) return x.map(walk);
    if (!x || typeof x !== "object") return x;
    const o = x as Record<string, unknown>;
    const picksSlot = o.kind === "choose" && (o.pick as { param?: string } | undefined)?.param === slot;
    const dependsHere = (o.dependsOn as { param?: string } | undefined)?.param === slot;
    return Object.fromEntries(
      Object.entries(o).map(([k, v]) => {
        if (picksSlot && k === "options") return [k, Object.fromEntries(Object.entries(v as object).map(([ok, ov]) => [ok === from ? to : ok, walk(ov)]))];
        if (dependsHere && k === "dependsOn") {
          const d = v as { param: string; values: unknown[] };
          return [k, { ...d, values: d.values.map((x2) => (x2 === from ? to : x2)) }];
        }
        return [k, walk(v)];
      }),
    );
  };
  const out = walk(doc) as OurRuleType;
  if (!isPatch(out) || !parent) return out;
  // inherited items and questions that use the answer: copy them here, renamed
  const removed = new Set(out.remove ?? []);
  const copyChanged = <E extends { id: string }>(own: E[] | undefined, inherited: E[] | undefined): E[] | undefined => {
    const ids = new Set((own ?? []).map((e) => e.id));
    const add = (inherited ?? []).filter((e) => !ids.has(e.id) && !removed.has(e.id)).map((e) => [e, walk(e) as E] as const).filter(([a, b]) => JSON.stringify(a) !== JSON.stringify(b));
    return add.length ? [...(own ?? []), ...add.map(([, b]) => b)] : own;
  };
  const params = { ...(out.params ?? {}) } as Record<string, Param | { value: Param["value"] }>;
  for (const [k, p] of Object.entries(parent.params)) {
    if (k === slot || (params[k] && "type" in params[k])) continue;
    const renamed = walk(p) as Param;
    if (JSON.stringify(renamed) !== JSON.stringify(p)) params[k] = { ...renamed, ...(params[k] ? { value: params[k].value } : {}) } as Param;
  }
  return { ...out, params, items: copyChanged(out.items, parent.items), derived: copyChanged(out.derived, parent.derived) } as OurRuleType;
}

export const replaceAt = <T,>(list: T[], i: number, v: T) => list.map((x, j) => (j === i ? v : x));
export const removeAt = <T,>(list: T[], i: number) => list.filter((_, j) => j !== i);
export function move<T>(list: T[], i: number, by: -1 | 1): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
