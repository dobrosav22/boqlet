/**
 * Preset documents in the mock (F10): blank documents per kind, copies under a new id, and the
 * engine's check of a document whose rule-set parents may be org versions the engine has never
 * seen (they go along as `library` documents under their engine id, `mock-<versionId>`).
 */
import { engine, type PresetFolder } from "./engine/engine.js";
import { db, type PresetRec, type PresetVersionRec } from "./store.js";

type Doc = Record<string, unknown>;

export const FOLDER: Partial<Record<PresetRec["kind"], PresetFolder>> = { rule_set: "rules", classification: "classifications", dictionary: "dictionaries" };

/** Lower-case words joined by hyphens (the PoC Library's `slug`). */
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";

export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** The engine id a shipped system version goes by; undefined for everything the mock saves itself. */
export function shippedId(version: PresetVersionRec): string | undefined {
  const preset = db().presets.find((p) => p.id === version.presetId);
  return preset?.layer === "system" && version.number === 1 ? preset.slug : undefined;
}

/**
 * Blank documents (the PoC Library's `blank*` in `apps/web/src/library/store.ts`). Federation and
 * resolution settings have no blank form: they start from the system default's document.
 */
export function blankDoc(kind: PresetRec["kind"], id: string, name: string, layer: "org" | "project"): Doc {
  switch (kind) {
    case "rule_set":
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
    case "dictionary":
      return { schemaVersion: "1.0", id, name, version: "0.1.0", layer: layer === "org" ? "company" : "project", terms: [], entries: [], extractors: [] };
    case "classification":
      return {
        codeList: { schemaVersion: "1.0", id, name, kind: "company", version: "0.1.0", separator: ".", levels: ["Section", "Item"], codes: [] },
        map: { schemaVersion: "1.0", id: `${id}-map`, name: `${name}: map`, version: "0.1.0", codeList: id, sources: ["decision", "map"], rules: [], onUnmapped: "flag", onConflict: "first" },
      };
    default: {
      const system = db().presets.find((p) => p.layer === "system" && p.kind === kind);
      const version = system && db().presetVersions.find((v) => v.presetId === system.id && v.status === "published");
      return renamed(kind, (version?.doc as Doc) ?? { schemaVersion: "1.0" }, id, name);
    }
  }
}

/** A rule-set patch on `parentId` (the PoC's `blankPatch`). */
export const blankPatch = (id: string, name: string, parentId: string): Doc => ({ schemaVersion: "1.0", id, name, version: "0.1.0", extends: parentId, meta: {}, params: {} });

/** A deep copy of a document under a new id and name (a classification renames its code list and map). */
export function renamed(kind: PresetRec["kind"], doc: unknown, id: string, name: string): Doc {
  const copy = structuredClone((doc ?? {}) as Doc);
  if (kind === "classification") {
    const codeList = (copy.codeList ?? {}) as Doc;
    const map = (copy.map ?? {}) as Doc;
    copy.codeList = { ...codeList, id, name };
    copy.map = { ...map, id: `${id}-map`, name: `${name}: map`, codeList: id };
    return copy;
  }
  return { ...copy, id, name };
}

/** The id a document goes by (a classification's is its code list's). */
export function docIdOf(kind: PresetRec["kind"], doc: unknown): string | undefined {
  const d = (doc ?? {}) as Doc;
  return String((kind === "classification" ? (d.codeList as Doc | undefined)?.id : d.id) ?? "") || undefined;
}

/**
 * A rule-set document with its parents as the engine can resolve them: `extends` points at the
 * shipped parent by its slug, or at `mock-<versionId>` for an org or project parent, which goes along
 * in `library` (nearest first). Other kinds come back unchanged.
 */
export function withParents(doc: unknown, extendsVersionId: string | null) {
  const root = structuredClone((doc ?? {}) as Doc);
  const library: Doc[] = [];
  let child = root;
  let parentId = extendsVersionId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = db().presetVersions.find((v) => v.id === parentId);
    if (!parent) break;
    const shipped = shippedId(parent);
    if (shipped) {
      child.extends = shipped;
      break;
    }
    const parentDoc = structuredClone(parent.doc as Doc);
    parentDoc.id = `mock-${parent.id}`;
    child.extends = parentDoc.id;
    library.push(parentDoc);
    child = parentDoc;
    parentId = parent.extendsVersionId;
  }
  return { doc: root, library };
}

/** The engine's check of a preset document (problems, and a rule set flattened). */
export async function checkDoc(kind: PresetRec["kind"], doc: unknown, extendsVersionId: string | null): Promise<{ ok: boolean; problems: string[]; flattened?: unknown }> {
  const folder = FOLDER[kind];
  if (!folder) return { ok: true, problems: [] };
  const { doc: resolved, library } = kind === "rule_set" ? withParents(doc, extendsVersionId) : { doc, library: [] };
  return engine().checkPreset(folder, resolved, library);
}
