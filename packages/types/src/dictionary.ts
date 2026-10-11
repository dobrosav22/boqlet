/**
 * Dictionary — input (4) of getBoq.
 *
 * Turns the messy, free-text names in an IFC ("BETON MB30", "C25/30",
 * "Concrete - Cast In Situ", "Gipsana ploča", "Z-25") into clean, canonical
 * TERMS ("concrete.in_situ", "plasterboard", "acme.wall.z25"). Rules then match
 * on terms, never on raw names, so one rule set works on any model.
 *
 * It runs BEFORE rules: ParsedModel + dictionaries -> MeasuredElement.
 *
 * Layers, checked most specific first:
 *   project  one-off names in this model (often promoted from user answers)
 *   company  the office's habits and codes
 *   global   shipped seed: authoring-tool defaults, common synonyms in many languages
 *
 * Three building blocks:
 *   Term        the canonical vocabulary, with a hierarchy (concrete.in_situ is under concrete)
 *   Entry       raw text -> term
 *   Extractor   pulls structured values out of names (Revit "Family:Type:Id", "25 cm", "C30/37")
 */

import type { Expr } from "./rules";
import type { Unit } from "./measured";

/* ============================================================================
 * Vocabulary
 * ========================================================================== */

export type TermCategory =
  | "material"
  | "product"        // a manufactured item: brick, plasterboard sheet, window unit
  | "element_type"   // a kind of element: party wall, partition, curtain wall
  | "space"          // room usage: bathroom, kitchen, corridor
  | "system"         // MEP system: domestic cold water, supply air
  | "other";

export interface Term {
  /** Stable canonical id, dotted for hierarchy: "concrete", "concrete.in_situ". */
  id: string;
  category: TermCategory;
  label: string;
  labels?: Record<string, string>;   // per locale
  /** Parent term. Rules can match a term and everything under it (selector op "under"). */
  broader?: string;
  /** Values rules may use, e.g. density for mass-by-volume. User-editable. */
  props?: Record<string, number | string | boolean>;
  /** Links to external dictionaries and classifications. */
  refs?: { system: string; code: string; uri?: string }[];   // e.g. bSDD URI, Uniclass Pr code
  deprecated?: boolean;
}

/* ============================================================================
 * Entries: raw text -> term
 * ========================================================================== */

/** Which raw field an entry or extractor reads. */
export type DictField =
  | "material"           // element material name(s)
  | "layer_material"     // material of each layer in a layer set
  | "type_name"
  | "name"
  | "object_type"
  | "ifc_class"
  | "predefined_type"
  | "system"
  | "space_name"
  | `props.${string}`;   // any property, e.g. "props.PSet_Revit_Identity Data.Description"

export type TextMatch =
  | { exact: string | string[] }
  | { startsWith: string | string[] }
  | { contains: string | string[] }
  /** ECMAScript regex syntax (as in JavaScript); named groups written (?<name>...). Case-insensitive unless caseSensitive. */
  | { regex: string; flags?: string };

export interface DictionaryEntry {
  id: string;
  field: DictField | DictField[];
  match: TextMatch;
  /** Default false. */
  caseSensitive?: boolean;
  /** Default true: "beton" also matches "béton", "ploca" matches "ploča". */
  ignoreAccents?: boolean;
  /**
   * Only apply in this context. Variables: ifc_class, predefined_type,
   * discipline, family, plus the raw field values. E.g. CT means ceramic tile
   * only on IfcCovering: `ifc_class = "IfcCovering"`.
   */
  when?: Expr;
  term: string;
  /** How sure we are. Seeds and user answers are 1. AI-confirmed keeps the score. */
  confidence?: number;
  source: "seed" | "user" | "import" | "ai_confirmed";
  createdBy?: string;
  createdAt?: string;
  note?: string;
}

/* ============================================================================
 * Extractors: structured values out of names
 * ========================================================================== */

export type ExtractTarget =
  | "type_name"
  | "family"
  | "thickness"
  | "width"
  | "height"
  | "length"
  | "diameter"
  | "strength_class"
  | "profile"
  | "nominal_size"
  | "term"               // the captured text is itself looked up as a term
  | `props.${string}`;

export interface Extractor {
  id: string;
  field: DictField | DictField[];
  /** ECMAScript regular expression with NAMED groups, e.g. "(?<t>\\d+)\\s?mm". */
  regex: string;
  flags?: string;
  outputs: Record<string, {
    target: ExtractTarget;
    unit?: Unit;          // unit of the captured number, converted to SI
  }>;
  when?: Expr;
  /** Default false: never overwrite a value the model already has (geometry wins over names). */
  override?: boolean;
  note?: string;
}

/* ============================================================================
 * The dictionary
 * ========================================================================== */

export interface Dictionary {
  schemaVersion: "1.0";
  id: string;
  name: string;
  version: string;
  layer: "global" | "company" | "project";
  locales?: string[];
  /** Vocabulary. Usually in the global layer; companies may add their own terms. */
  terms?: Term[];
  entries: DictionaryEntry[];
  extractors?: Extractor[];
}

/* ============================================================================
 * Resolution: how names get resolved, and what comes out
 * ========================================================================== */

export interface ResolutionSettings {
  /** Default ["project", "company", "global"]: first layer with a match wins. */
  layerOrder?: ("project" | "company" | "global")[];
  /** Within a layer. Default ["exact", "startsWith", "regex", "contains"]. */
  matchOrder?: ("exact" | "startsWith" | "regex" | "contains")[];
  /** AI suggestions for names no entry matches. */
  ai?: {
    enabled: boolean;
    /** Above this: accept and log. Default 1 (never auto-accept). */
    autoAcceptAbove?: number;
    /** Above this: ask with the suggestion pre-selected. Below: ask without one. */
    suggestAbove?: number;
  };
  /** What to do with a name nothing resolves. */
  unresolved: "ask" | "flag" | "keep_raw";
  /**
   * Which unresolved names are worth a question. Others keep their raw text
   * (rules can still match raw names). A door's type name rarely needs a term;
   * a wall's usually does. Default: every field, always.
   */
  askFor?: { field: DictField; when?: Expr }[];
}

export interface Resolution {
  field: DictField;
  raw: string;
  term: string | null;
  method: "exact" | "startsWith" | "regex" | "contains" | "ai" | "decision" | "none";
  layer?: "project" | "company" | "global";
  entryId?: string;
  confidence: number;
  alternatives?: { term: string; confidence: number }[];
}

/** What getBoq receives. */
export interface DictionaryInput {
  dictionaries: Dictionary[];
  settings?: ResolutionSettings;
}
