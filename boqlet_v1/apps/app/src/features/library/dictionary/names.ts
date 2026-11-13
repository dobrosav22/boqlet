/**
 * Pure helpers of "Names in the model" (the PoC's NamesTab.tsx): rows from the engine's name uses,
 * term suggestions, and the entries that assigning a term writes into the draft. Nothing is
 * matched here: the engine resolves names (`POST /model-versions/{id}/names`).
 */
import type { DictField, Dictionary, DictionaryEntry, NameUse } from "@ifc-boq/types";
import { slug, uniqueId } from "../shared/doc";

/** A term a dictionary can point to: the draft's own and those of the more general layers. */
export interface KnownTerm {
  id: string;
  label: string;
  category: string;
}

export type Group = "materials" | "types";
export type Status = "all" | "unresolved" | "here" | "elsewhere";

export const LAYER_RANK = { global: 0, company: 1, project: 2, decision: 3 } as const;
export const MATERIAL_FIELDS: DictField[] = ["material", "layer_material"];

/** One row on screen: material and layer-material uses of the same text are shown together. */
export interface Row {
  key: string;
  group: Group;
  raw: string;
  fields: DictField[];
  uses: NameUse[];
  term: string | null;
  count: number;
  classes: string[];
  worthAsking: boolean;
}

export function rowsOf(names: NameUse[]): Row[] {
  const out = new Map<string, Row>();
  for (const n of names) {
    const group: Group = MATERIAL_FIELDS.includes(n.field) ? "materials" : "types";
    const key = `${group}|${n.raw}|${n.term ?? ""}`;
    const r = out.get(key) ?? { key, group, raw: n.raw, fields: [], uses: [], term: n.term, count: 0, classes: [], worthAsking: false };
    r.fields = [...new Set([...r.fields, n.field])];
    r.uses.push(n);
    r.count = Math.max(r.count, n.count); // the same elements report a material and its layers
    r.classes = [...new Set([...r.classes, ...(n.classes ?? [])])].sort();
    r.worthAsking ||= n.worthAsking;
    out.set(key, r);
  }
  return [...out.values()];
}

/** Not understood first, then the ones worth answering, then by name. */
export const rowOrder = (a: Row, b: Row) => Number(!!a.term) - Number(!!b.term) || Number(b.worthAsking) - Number(a.worthAsking) || a.raw.localeCompare(b.raw);

/* ---------------------------------------------------------------- suggestions */

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !/^\d+$/.test(w));

/** The known term whose words overlap the name most (more specific terms win a tie). */
export function suggestTerm(raw: string, terms: KnownTerm[]): KnownTerm | null {
  const want = words(raw);
  let best: { t: KnownTerm; score: number } | null = null;
  for (const t of terms) {
    const have = new Set([...words(t.label), ...t.id.split(/[._]/)]);
    const hits = want.filter((w) => [...have].some((h) => h === w || (h.length > 3 && w.startsWith(h)) || (w.length > 3 && h.startsWith(w)))).length;
    if (!hits) continue;
    const score = hits + t.id.split(".").length * 0.01;
    if (!best || score > best.score) best = { t, score };
  }
  return best?.t ?? null;
}

/** The start several names share (case ignored), when it is long enough to mean something. */
export function commonPrefix(list: string[]): string {
  if (list.length < 2) return "";
  let p = list[0]!;
  for (const s of list) while (!s.toLowerCase().startsWith(p.toLowerCase())) p = p.slice(0, -1);
  return p.trim().length >= 4 ? p : "";
}

/* ---------------------------------------------------------------- writing entries */

export function entryFor(doc: Dictionary, fields: DictField[], match: DictionaryEntry["match"], term: string, classes?: string[]): DictionaryEntry {
  const first = (v: string | string[]) => (Array.isArray(v) ? v[0] ?? "" : v);
  const base = "exact" in match ? first(match.exact) : "startsWith" in match ? first(match.startsWith) : "entry";
  const e: DictionaryEntry = {
    id: uniqueId(slug(`${fields[0] === "type_name" ? "type" : "mat"}-${base}`), doc.entries.map((x) => x.id)),
    field: fields.length === 1 ? fields[0]! : fields,
    match,
    term,
    source: "user",
  };
  if (classes?.length) e.when = classes.map((c) => `ifc_class = "${c}"`).join(" OR ");
  return e;
}

/** Remove `raw` from this dictionary's exact entries for these fields (dropping entries left empty). */
export function withoutExact(doc: Dictionary, raw: string, fields: DictField[]): DictionaryEntry[] {
  return doc.entries.flatMap((e) => {
    const ef = Array.isArray(e.field) ? e.field : [e.field];
    if (!("exact" in e.match) || !ef.some((f) => fields.includes(f))) return [e];
    const list = (Array.isArray(e.match.exact) ? e.match.exact : [e.match.exact]).filter((x) => x !== raw);
    if (list.length === 0) return [];
    return [{ ...e, match: { exact: list.length === 1 ? list[0]! : list } }];
  });
}

const fieldsOf = (r: Row): DictField[] => (r.group === "materials" ? MATERIAL_FIELDS : r.fields);

/**
 * Give these names a term in this dictionary: an exact entry per set of fields, or one "starts
 * with" entry for several similar names, optionally only on some IFC classes. Earlier exact
 * entries for the same names are replaced.
 */
export function assignNames(doc: Dictionary, list: Row[], term: string, opts: { prefix?: string; classes?: string[] } = {}): Dictionary {
  let entries = doc.entries;
  for (const r of list) entries = withoutExact({ ...doc, entries }, r.raw, fieldsOf(r));
  const byFields = new Map<string, Row[]>();
  for (const r of list) byFields.set(fieldsOf(r).join(","), [...(byFields.get(fieldsOf(r).join(",")) ?? []), r]);
  for (const [f, rs] of byFields) {
    const fields = f.split(",") as DictField[];
    const raws = [...new Set(rs.map((r) => r.raw))];
    const match = opts.prefix ? { startsWith: opts.prefix } : { exact: raws.length === 1 ? raws[0]! : raws };
    entries = [...entries, entryFor({ ...doc, entries }, fields, match, term, opts.classes)];
  }
  return { ...doc, entries };
}

/** Take a name out of this dictionary's exact entries again. */
export const forgetName = (doc: Dictionary, r: Row): Dictionary => ({ ...doc, entries: withoutExact(doc, r.raw, fieldsOf(r)) });
