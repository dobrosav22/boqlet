/**
 * The preset library as the editors see it: drafts held in browser memory only.
 *
 * Nothing here is saved. Shipped presets are loaded from the engine when opened and
 * edited in place as drafts; new ones are created here. "Download JSON" is the way to
 * keep a draft (drop the file into /presets). Persistence belongs to the future backend.
 */
import type { ClassificationMap, CodeList, Dictionary, OurRuleType, RuleSet, RuleSetPatch } from "@ifc-boq/types";

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

export const replaceAt = <T,>(list: T[], i: number, v: T) => list.map((x, j) => (j === i ? v : x));
export const removeAt = <T,>(list: T[], i: number) => list.filter((_, j) => j !== i);
export function move<T>(list: T[], i: number, by: -1 | 1): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
