/**
 * Fake: "Preview" (mock-api.md "Engine fakes", replaced by EN-005). A preset's draft (or a version)
 * is run on model versions through the PoC engine and, optionally, compared with the preset's latest
 * published version: two runs, diffed by line key. Every document goes to the engine under ids unique
 * to the job (`mock-preview-<jobId>-…`, a rule set flattened by the engine's check, so no parent has
 * to be saved) and is deleted afterwards; runs' own presets are never touched.
 */
import { db, type PresetRec, type PresetVersionRec } from "../../store.js";
import { checkDoc, FOLDER, shippedId } from "../../preset-docs.js";
import { engine, type PresetFolder } from "../engine.js";
import type { BoqResult } from "@ifc-boq/types";

type Doc = Record<string, unknown>;

export interface PreviewInputs {
  models: { modelId: string; discipline?: string }[];
  ruleSet: PresetVersionRec;
  classifications: PresetVersionRec[];
  /** Most general first; the project dictionary last. */
  dictionaries: PresetVersionRec[];
}

export interface PreviewLine {
  key: string;
  ruleId: string;
  keys?: Record<string, unknown>;
  description: string;
  quantity: number | null;
  unit: string;
  storey?: string;
}

export interface PreviewChange {
  key: string;
  change: "added" | "removed" | "changed";
  before?: PreviewLine;
  after?: PreviewLine;
}

/** The JSON behind `previewResultUrl` (openapi `PreviewResult`). */
export interface PreviewResult {
  lines: PreviewLine[];
  questions: number;
  blockingQuestions: number;
  warnings: number;
  compare: null | { versionId: string; versionNumber: number; presetName?: string; added: number; removed: number; changed: number };
  changes: PreviewChange[];
}

const presetOf = (v: PresetVersionRec) => db().presets.find((p) => p.id === v.presetId)!;

/**
 * Runs the inputs with `override` standing in for its preset's version: the draft's or a chosen
 * version's document. Returns the engine's result.
 */
export async function previewRun(jobId: string, tag: string, inputs: PreviewInputs, override: { preset: PresetRec; doc: unknown; extendsVersionId: string | null } | null): Promise<BoqResult> {
  const saved: [PresetFolder, string][] = [];
  let n = 0;
  const save = async (kind: PresetRec["kind"], doc: unknown, extendsVersionId: string | null) => {
    const folder = FOLDER[kind]!;
    const id = `mock-preview-${jobId}-${tag}-${n++}`;
    let out = structuredClone(doc) as Doc;
    if (kind === "rule_set") {
      // A patch goes flattened (its parents resolved by the engine's check), so nothing else is saved.
      const flat = (await checkDoc("rule_set", doc, extendsVersionId)).flattened as Doc | undefined;
      if (flat) out = structuredClone(flat);
      // The flattened form also says where it came from (`chain`), which a saved preset may not carry.
      delete out.extends;
      delete out.chain;
    }
    if (kind === "classification") {
      (out.codeList as Doc).id = id;
      (out.map as Doc).codeList = id;
    } else out.id = id;
    await engine().savePreset(folder, id, out);
    saved.push([folder, id]);
    return id;
  };
  const idOf = async (v: PresetVersionRec) => {
    const preset = presetOf(v);
    if (override && override.preset.id === preset.id) return save(preset.kind, override.doc, override.extendsVersionId);
    return shippedId(v) ?? save(preset.kind, v.doc, v.extendsVersionId);
  };
  try {
    const ruleSet = await idOf(inputs.ruleSet);
    const classifications: string[] = [];
    for (const v of inputs.classifications) classifications.push(await idOf(v));
    const dictionaries: string[] = [];
    for (const v of inputs.dictionaries) dictionaries.push(await idOf(v));
    // A previewed classification or dictionary that the inputs don't list yet goes in as well.
    if (override && override.preset.kind === "classification" && !inputs.classifications.some((v) => v.presetId === override.preset.id)) classifications.unshift(await save("classification", override.doc, null));
    if (override && override.preset.kind === "dictionary" && !inputs.dictionaries.some((v) => v.presetId === override.preset.id)) dictionaries.push(await save("dictionary", override.doc, null));
    const { result } = await engine().run({ models: inputs.models, ruleSet, dictionaries, classifications, decisions: [] });
    return result;
  } finally {
    for (const [folder, id] of saved.reverse()) await engine().deletePreset(folder, id).catch(() => {});
  }
}

const lineOf = (l: BoqResult["lines"][number]): PreviewLine => ({
  key: l.key,
  ruleId: l.ruleId,
  ...(l.keys && Object.keys(l.keys).length ? { keys: l.keys } : {}),
  description: String(l.description ?? ""),
  quantity: l.quantity ?? null,
  unit: String(l.unit ?? ""),
  ...(l.location?.storey ? { storey: l.location.storey } : {}),
});

const sameLine = (a: PreviewLine, b: PreviewLine) => a.quantity === b.quantity && a.unit === b.unit && a.description === b.description;

/** The preview's result: the lines of `after`, and what changed against `before` (by line key). */
export function previewResult(after: BoqResult, before: BoqResult | null, compareWith: PresetVersionRec | null, presetName?: string): PreviewResult {
  const lines = after.lines.map(lineOf);
  const changes: PreviewChange[] = [];
  if (before) {
    const old = new Map(before.lines.map((l) => [l.key, lineOf(l)]));
    const now = new Map(lines.map((l) => [l.key, l]));
    for (const l of lines) {
      const b = old.get(l.key);
      if (!b) changes.push({ key: l.key, change: "added", after: l });
      else if (!sameLine(b, l)) changes.push({ key: l.key, change: "changed", before: b, after: l });
    }
    for (const [key, b] of old) if (!now.has(key)) changes.push({ key, change: "removed", before: b });
  }
  const count = (c: PreviewChange["change"]) => changes.filter((x) => x.change === c).length;
  return {
    lines,
    questions: after.questions.length,
    blockingQuestions: after.questions.filter((q) => q.blocking).length,
    warnings: after.warnings.length,
    compare: before && compareWith ? { versionId: compareWith.id, versionNumber: compareWith.number ?? 0, ...(presetName ? { presetName } : {}), added: count("added"), removed: count("removed"), changed: count("changed") } : null,
    changes,
  };
}
