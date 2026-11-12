/**
 * Classification — input (3) of getBoq.
 *
 * Classification only LABELS BoQ lines. It never changes a quantity.
 * Two separate things:
 *
 *   CodeList            the code list itself, loaded once and shared
 *                       (Uniclass, ICMS, CCI, OmniClass, a company's own codes,
 *                       a client's tender chapters)
 *   ClassificationMap   how BoQ lines get codes from one CodeList
 *                       (written by you, a company, or imported from a tender)
 *
 * getBoq takes any number of { codeList, map } pairs, so one line can carry a
 * Uniclass code, a company code and a tender position at the same time.
 * Grouping and subtotals then use the hierarchy of whichever list is chosen.
 */

import type { Expr } from "./rules";

/* ============================================================================
 * Code lists
 * ========================================================================== */

export interface Code {
  code: string;                     // "EF_25_10", "B.03", "03 30 00"
  title: string;
  /** Parent code. Omit to derive it from `CodeList.separator`. */
  parent?: string;
  /** 0 = top level. Omit to derive it. */
  level?: number;
  description?: string;
  /** Translations of the title, by locale. */
  titles?: Record<string, string>;
  deprecated?: boolean;
  /** Free extra columns from the source, e.g. Uniclass "NRM" or "NBS Code". */
  extra?: Record<string, string>;
}

export interface CodeList {
  schemaVersion: "1.0";
  id: string;                       // "uniclass2015-ef", "acme-cost-codes"
  name: string;                     // "Uniclass 2015 – Elements/functions"
  kind: "official" | "company" | "client" | "other";
  publisher?: string;
  version?: string;                 // e.g. "v1.10 (2021-07)"
  locale?: string;
  licence?: {
    name: string;                   // "CC BY 4.0", "NBS terms", "Proprietary – licensed to ACME"
    url?: string;
    attribution?: string;
    /** May this list be shipped to other organisations? */
    redistributable: boolean;
  };
  /** Names of hierarchy levels, top first, e.g. ["Group", "Sub group", "Section", "Object"]. */
  levels?: string[];
  /** Separator used to derive parents from codes, e.g. "_" (EF_25_10 -> EF_25). */
  separator?: string;
  codes: Code[];
}

/* ============================================================================
 * Mapping BoQ lines to codes
 * ========================================================================== */

/**
 * What a map rule can look at. Lines are matched, not elements, because
 * classification labels lines. Fields available to `where`:
 *   rule_id, rule_kind ("item" | "derived" | "manual"), manual_kind, tags,
 *   unit, source ("measured" | "derived" | "manual" | "flagged"),
 *   family, ifc_class, predefined_type, material, element_type (dictionary terms),
 *   storey, storey_elevation, and keys.<lineKey field>
 *   e.g. keys.type_name, keys.material, keys.thickness
 * Fields with several values across the line's elements hold the most common one,
 * and the engine warns when a map rule depends on such a mixed field: the fix is
 * to add that field to the rule's lineKey so the line splits.
 */
export type LineMatch =
  | { ruleId: string | string[] }
  | { tag: string | string[] }
  | { manualKind: string | string[] }
  | { where: Expr }
  | { all: LineMatch[] }
  | { any: LineMatch[] }
  | { not: LineMatch };

/** A fixed code, a code looked up from a line field, or (derived lines) the source line's code. */
export type CodeTarget =
  | string
  | { fromSource: true }
  | {
      /** Line field to look up, e.g. "material" or "keys.type_name". */
      lookup: string;
      table: Record<string, string>;
      default?: string;
    };

export interface MapRule {
  id: string;
  match: LineMatch;
  code: CodeTarget;
  /** Higher wins when several rules match. Default 0; ties go to the first rule. */
  priority?: number;
  note?: string;
}

export interface ClassificationMap {
  schemaVersion: "1.0";
  id: string;
  name: string;
  version: string;
  /** CodeList.id this map points into. Every code must exist in that list. */
  codeList: string;
  /** Inherit rules from another map; rules override by id. */
  extends?: string;
  remove?: string[];

  /**
   * Where codes may come from, in priority order:
   *   "decision"  a user's answer for this project
   *   "map"       the rules below
   *   "ifc"       classification references already on the elements in the IFC
   */
  sources?: ("decision" | "map" | "ifc")[];
  ifc?: {
    /** IfcClassification names that count as this code list, e.g. ["Uniclass", "Uniclass 2015"]. */
    systemNames: string[];
    /** A line has many elements; how to pick one code when they disagree. */
    agreement: "all" | "majority" | "ask";
  };

  rules: MapRule[];

  /** Line matched by no rule. */
  onUnmapped: "flag" | "ask" | { code: string };
  /** Several rules with equal priority match. */
  onConflict: "first" | "ask";
}

/** What getBoq receives per classification system. */
export interface ClassificationInput {
  codeList: CodeList;
  map: ClassificationMap;
}

/** What each BoQ line carries per system (see engine.ts BoqLine.codes). */
export interface LineCode {
  system: string;                   // CodeList.id
  code: string;
  title: string;
  /** Full path from the top level, used for grouping and subtotals. */
  path: { code: string; title: string }[];
  source: "decision" | "map" | "ifc" | "default";
  mapRuleId?: string;
}
