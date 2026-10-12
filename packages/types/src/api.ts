/**
 * HTTP contract between the web app and the engine service (engine/ifc_boq/api.py).
 *
 * Today the engine service is a small local FastAPI app. The planned backend is
 * Java; it will own projects, users and storage and call the engine as a worker.
 * Keep this contract small and job-shaped so that move is easy:
 *   upload a model  -> modelId (content hash)    = "model version"
 *   run             -> runId + BoqResult         = "run" (immutable)
 *   export          -> xlsx of a run
 */

import type { BoqResult, Decision } from "./engine";
import type { RuleSet } from "./rules";
import type { DictField, Dictionary, Resolution } from "./dictionary";
import type { Code } from "./classification";
import type { CheckCode } from "./parsed";

export interface PresetInfo {
  id: string;
  name: string;
  description?: string;
  /** Rule sets: parent id when this one is a patch. */
  extends?: string;
  /** Dictionaries: layer. */
  layer?: "global" | "company" | "project";
}

export interface ClassificationPresetInfo extends PresetInfo {
  /** False when the code list is not installed (e.g. Uniclass must be imported first). */
  available: boolean;
  reason?: string;
}

/** GET /api/presets */
export interface PresetsResponse {
  ruleSets: PresetInfo[];
  dictionaries: PresetInfo[];
  classifications: ClassificationPresetInfo[];
  /** Terms available for answering unknown_name questions. */
  terms: { id: string; label: string; category: string }[];
}

/**
 * POST /api/presets/{kind}/check (kind: rules | dictionaries | classifications)
 *
 * Asks the engine whether a draft preset is acceptable: schema, rule-set inheritance
 * and integrity, expression syntax, terms and codes that exist. Nothing is saved.
 * A classification draft is `{ codeList, map }`.
 */
export interface CheckPresetRequest {
  doc: unknown;
  /** Other unsaved drafts of the same kind, so a draft patch can extend a draft. */
  library?: unknown[];
}

export interface CheckPresetResponse {
  ok: boolean;
  problems: string[];
  /** Rule sets only: the draft with its extends chain resolved (what the engine would run), or null. */
  flattened?: RuleSet | null;
}

/**
 * POST /api/models/{modelId}/names
 *
 * Every distinct name in a model (materials, layer materials, type names) and how the given
 * dictionaries resolve it. Dictionaries are sent as documents so unsaved drafts can be tried.
 */
export interface NamesRequest {
  dictionaries: Dictionary[];
}

export interface NameUse {
  field: DictField;
  raw: string;
  /** null = no dictionary entry matched. */
  term: string | null;
  method: Resolution["method"];
  layer?: "project" | "company" | "global" | "decision";
  /** Id of the dictionary whose entry matched. */
  dictionary?: string;
  entryId?: string;
  /** Number of elements that use this name. */
  count: number;
  classes: string[];
  /** Unresolved and of a kind the resolution settings ask about (askFor). */
  worthAsking: boolean;
  /** Values extractors pull out of the name, e.g. { thickness: 0.25 }. */
  extracted: Record<string, string | number>;
}

export interface NamesResponse {
  names: NameUse[];
}

/**
 * Code-list import from a spreadsheet, in two steps so columns can be mapped while seeing the file.
 * POST /api/codelists/read (multipart, field "file": .csv, .tsv, .txt, .xlsx) -> TableReadResponse
 * POST /api/codelists/build (CodeListBuildRequest) -> CodeListBuildResponse
 */
export interface TableColumnGuess {
  /** 0-based row index of the header row. */
  headerRow: number;
  code?: number;
  title?: number;
  parent?: number;
  description?: number;
  level?: number;
  /** Separator that derives parents from codes, if one fits ("." for B.01 under B). */
  separator?: string | null;
}

export interface TableReadResponse {
  sheets: { name: string; rows: string[][]; guess: TableColumnGuess }[];
}

export type CodeHierarchy = "separator" | "parent" | "level" | "flat";

export interface CodeListBuildRequest {
  rows: string[][];
  headerRow: number;
  /** Column indexes. code and title are required; extra columns are kept as Code.extra. */
  mapping: { code: number; title: number; parent?: number; description?: number; level?: number; extra?: number[] };
  hierarchy: CodeHierarchy;
  separator?: string | null;
}

export interface CodeListBuildResponse {
  codes: Code[];
  problems: string[];
  stats: { codes: number; top: number; levels: number; skipped: number; duplicates: number };
}

/**
 * GET /api/models/{modelId}/scene - connects geometry.glb (GET /api/models/{modelId}/geometry.glb,
 * one mesh node per GlobalId) to BoQ lines, whose traces list element GlobalIds.
 */
export interface SceneIndex {
  elements: Record<
    string,
    {
      ifcClass: string;
      name?: string;
      type?: string;
      storey?: string;
      /** Aggregate parent (the roof of a roof slab). */
      parent?: string;
      /** Mesh nodes that draw it: itself, or its parts when it has no body (roofs, stairs). */
      parts?: string[];
    }
  >;
  spaces: string[];
  openings: string[];
}

/** POST /api/models (multipart, field "file") */
export interface ModelSummary {
  modelId: string;                 // sha256 of the file
  fileName: string;
  sizeBytes: number;
  ifcSchema: string;
  authoringApp?: string;
  disciplineGuess?: string;
  storeys: { name?: string; elevation?: number }[];
  elementCount: number;
  openingCount: number;
  spaceCount: number;
  byClass: Record<string, number>;
  checks: Partial<Record<CheckCode, number>>;
  parseMs: number;
  cached: boolean;
}

/** POST /api/runs */
export interface RunRequest {
  modelId: string;
  ruleSet: string;                 // preset id
  dictionaries: string[];          // preset ids, any layer order
  classifications: string[];       // preset ids
  decisions: Decision[];
}

export interface RunResponse {
  runId: string;
  result: BoqResult;
  /** GET this to download the Excel BoQ. */
  xlsxUrl: string;
}

export interface ApiError {
  detail: string;
}
