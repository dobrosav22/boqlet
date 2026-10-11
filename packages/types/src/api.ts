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
