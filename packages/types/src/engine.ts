/**
 * getBoq — the engine's outside view.
 *
 *   getBoq({ models, rules, classifications, dictionaries, decisions }) -> BoqResult
 *
 * Inputs:
 *   (1) models           IFC files                      -> ParsedModel (parsed.ts)
 *   (2) rules            OurRuleType                    (rules.ts)
 *   (3) classifications  CodeList + ClassificationMap   (classification.ts)
 *   (4) dictionaries     layered Dictionary + settings  (dictionary.ts)
 *   decisions            user answers filling gaps in 1-4
 *
 * Internally three steps, each a separate module of the Python engine:
 *   parse()       IFC -> ParsedModel                 slow, cached per file version (sha256)
 *   measure()     + dictionaries -> MeasuredElement  cheap, rerun when dictionaries/answers change
 *   applyRules()  + rules + classifications -> BoQ   cheap, rerun on every change
 *
 * The engine is implemented in Python (engine/ifc_boq). These types are the
 * contract between it and any client (the React app now, a Java backend later).
 * JSON Schemas generated from them live in packages/types/schema.
 */

import type { ElementFamily } from "./families";
import type { Unit } from "./measured";
import type { OurRuleType, RuleSet, Selector } from "./rules";
import type { ClassificationInput, LineCode } from "./classification";
import type { DictionaryInput } from "./dictionary";
import type { Check } from "./parsed";

/* ============================================================================
 * Inputs
 * ========================================================================== */

export interface ModelInput {
  id: string;
  ifc: string | Uint8Array;        // path / URL or bytes
  discipline: string;              // architecture | structure | mep | ...
  /** What to take from this model in a federated project (not implemented yet). */
  scope?: { include?: Selector[]; exclude?: Selector[] };
}

/**
 * A user's answer to a Question. Decisions are stored per project (or promoted
 * to company level) and re-applied on every run and every new model version,
 * so the same question is never asked twice.
 */
export interface Decision {
  /** Question.id. Ids are deterministic (built from content), so they stay stable across runs. */
  questionId: string;
  scope: "project" | "company";
  answer: string | number | boolean | null;   // null = "leave it" (dismiss without answering)
  note?: string;
  decidedBy?: string;
  decidedAt?: string;
}

/* ============================================================================
 * Output
 * ========================================================================== */

/** Where a line's quantity comes from. */
export type LineSource = "measured" | "derived" | "manual" | "flagged";

export interface BoqLine {
  key: string;                     // stable within a run: rule id + line key values
  ruleId: string;
  ruleKind: "item" | "derived" | "manual";
  description: string;
  unit: Unit;
  quantity: number | null;         // null = flagged (could not be determined)
  source: LineSource;
  family?: ElementFamily;
  /** Values of the rule's lineKey fields for this line. */
  keys: Record<string, string | number | boolean | null>;
  /** Why this number: the formula, the parameter values used, and every element's share. */
  trace: {
    formula: string;
    params: Record<string, unknown>;
    elements: { guid: string; name?: string; quantity: number | null; note?: string }[];
    sourceLine?: string;           // derived lines: the line they were derived from
  };
  codes: Record<string, LineCode>; // keyed by CodeList.id
  location?: { storey?: string; storeys?: string[] };
  tags: string[];
  notes: string[];
}

export type QuestionKind =
  | "unknown_name"            // dictionary could not resolve a name the rules need
  | "missing_data"            // a rule needs a value the element does not have (onMissing: "ask")
  | "unmatched"               // an element no enabled rule measures
  | "double_claim"            // two rules claim the same element for the same purpose
  | "unclassified"            // a line no map rule codes (onUnmapped: "ask")
  | "classification_conflict"
  | "contradiction"           // file contradicts itself (reported vs geometry etc.)
  | "overlap";

/** What kind of answer a question expects; drives the UI control. */
export type AnswerType =
  | { kind: "term"; category?: string }            // pick a dictionary term
  | { kind: "number"; unit?: Unit }
  | { kind: "rule" }                               // pick an item rule id (or "exclude")
  | { kind: "code"; system: string }               // pick a code from a code list
  | { kind: "choice"; options: { value: string; label: string; recommended?: boolean }[] };

export interface Question {
  id: string;
  kind: QuestionKind;
  /** Blocking questions stop the BoQ from being "complete"; others are informative. */
  blocking: boolean;
  message: string;
  answer: AnswerType;
  guids?: string[];
  /** For unknown_name: the field and raw text. */
  field?: string;
  raw?: string;
  occurrences?: number;
  /** What the engine would use if nobody answers. */
  suggestion?: string | number;
}

export interface Warning {
  code: string;
  message: string;
  guids?: string[];
  ruleId?: string;
}

/**
 * Calculation log: an ordered, human-readable record of what the engine did.
 * Meant for developers and for users checking a number; not a debug dump.
 */
export type LogStage =
  | "parse"      // model loaded, verification summary
  | "names"      // dictionary resolution per distinct name
  | "measure"    // quantity adoption per element (reported vs geometry)
  | "match"      // which rule took which elements, skipped parts, exclusions
  | "quantity"   // formula evaluation per element / line
  | "derived"    // derived lines
  | "manual"     // manual items
  | "classify"   // code assignment per line and system
  | "decision"   // user answers applied
  | "summary";

export interface LogEntry {
  seq: number;
  stage: LogStage;
  level: "info" | "detail" | "warning";
  message: string;
  ruleId?: string;
  lineKey?: string;
  guid?: string;
  data?: Record<string, unknown>;
}

export interface BoqResult {
  status: "complete" | "needs_input";
  /** Ordered calculation log (see LogEntry). */
  log: LogEntry[];
  /** Flattened rule set actually used (snapshot, for reproducibility). */
  ruleSet: RuleSet;
  lines: BoqLine[];
  /** All questions; `blocking` ones are why status is "needs_input". */
  questions: Question[];
  warnings: Warning[];
  /** Verification checks from parsing (volume mismatches, overlaps, ...). */
  checks: Check[];
  stats: {
    elements: number;
    measuredElements: number;
    excludedElements: number;
    unmatchedElements: number;
    lines: number;
    flaggedLines: number;
    decisionsApplied: number;
    durationMs: number;
  };
}

/* ============================================================================
 * Functions (implemented in Python: engine/ifc_boq)
 * ========================================================================== */

export declare function getBoq(input: {
  models: ModelInput[];
  rules: OurRuleType;
  classifications: ClassificationInput[];
  dictionaries: DictionaryInput;
  decisions?: Decision[];
}): Promise<BoqResult>;
