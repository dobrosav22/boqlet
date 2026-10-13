/**
 * The preset library as the editors see it: drafts held in browser memory until saved.
 *
 * Presets are loaded from the engine when opened and edited in place as drafts; new ones are
 * created here. "Save" writes a draft to presets/user through the engine (dev build); shipped
 * presets are never overwritten, a draft of one is saved under a new id. Real persistence
 * belongs to the future backend.
 */
import type { ClassificationMap, CodeList, Dictionary, OurRuleType, Param, RuleSet, RuleSetPatch } from "@ifc-boq/types";

export type LibKind = "rules" | "dictionaries" | "classifications";

/** A classification preset is a code list plus the map that assigns its codes. */
export interface ClassificationDoc {
  codeList: CodeList;
  map: ClassificationMap;
}

export type AnyDoc = OurRuleType | Dictionary | ClassificationDoc;

export interface LibDoc {
  key: string;
  kind: LibKind;
  origin: "preset" | "new";
  /** For shipped presets: the id it was loaded under (stays stable if the draft id is edited). */
  presetId?: string;
  doc: AnyDoc;
  /** JSON as loaded, to tell whether the draft was edited. */
  original: string;
}

export type LibState = Record<string, LibDoc>;

export const KIND_LABEL: Record<LibKind, string> = {
  rules: "Rule set",
  dictionaries: "Dictionary",
  classifications: "Classification",
};

export const presetKey = (kind: LibKind, id: string) => `${kind}:${id}`;

export const isPatch = (d: OurRuleType): d is RuleSetPatch => "extends" in d && typeof d.extends === "string";

export function docId(kind: LibKind, d: AnyDoc): string {
  return kind === "classifications" ? (d as ClassificationDoc).codeList.id : (d as OurRuleType | Dictionary).id;
}

export function docName(kind: LibKind, d: AnyDoc): string {
  return kind === "classifications" ? (d as ClassificationDoc).codeList.name : (d as OurRuleType | Dictionary).name;
}

export const isEdited = (e: LibDoc) => e.origin === "new" || JSON.stringify(e.doc) !== e.original;

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

/* ---------------------------------------------------------------- blank documents */

export function blankRuleSet(id: string, name: string): RuleSet {
  return {
    schemaVersion: "1.0",
    id,
    name,
    version: "0.1.0",
    meta: { unitSystem: "metric", locale: "en" },
    defaults: { rounding: { step: 0.01, mode: "nearest", at: "line" }, onMissing: "flag", breakdown: "element" },
    params: {},
    items: [],
    derived: [],
    manual: [],
  };
}

export function blankPatch(id: string, name: string, parent: string): RuleSetPatch {
  return { schemaVersion: "1.0", id, name, version: "0.1.0", extends: parent, meta: {}, params: {} };
}

export function blankDictionary(id: string, name: string, layer: Dictionary["layer"]): Dictionary {
  return { schemaVersion: "1.0", id, name, version: "0.1.0", layer, terms: [], entries: [], extractors: [] };
}

export function blankClassification(id: string, name: string): ClassificationDoc {
  return {
    codeList: { schemaVersion: "1.0", id, name, kind: "company", version: "0.1.0", separator: ".", levels: ["Section", "Item"], codes: [] },
    map: {
      schemaVersion: "1.0",
      id: `${id}-map`,
      name: `${name}: map`,
      version: "0.1.0",
      codeList: id,
      sources: ["decision", "map"],
      rules: [],
      onUnmapped: "flag",
      onConflict: "first",
    },
  };
}

/** Guess what an imported JSON file is. */
export function detectKind(x: unknown): { kind: LibKind; doc: AnyDoc } | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (o.codeList && typeof o.codeList === "object" && o.map) return { kind: "classifications", doc: o as unknown as ClassificationDoc };
  if (Array.isArray(o.codes)) {
    const cl = o as unknown as CodeList;
    return { kind: "classifications", doc: { codeList: cl, map: blankClassification(cl.id, cl.name).map } };
  }
  if (Array.isArray(o.entries)) return { kind: "dictionaries", doc: o as unknown as Dictionary };
  if (Array.isArray(o.items) || typeof o.extends === "string") return { kind: "rules", doc: o as unknown as OurRuleType };
  return null;
}

export function downloadJson(fileName: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

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
