/**
 * OurRuleType — the universal shape of a measurement rule set.
 *
 * One shape, any standard. DIN-based, NRM-based, regional, client-imposed or a
 * firm's own invented rules are all just *filled-in copies* of this type.
 *
 * Standards differ in three ways, so the type has three kinds of slots:
 *   - NUMBER  slots: thresholds, factors, coefficients      (e.g. opening threshold 0.5 m2)
 *   - CHOICE  slots: which way to measure, from a fixed list (e.g. windows by count | area)
 *   - TEXT    slots: descriptions, labels                    (e.g. "Window {width}x{height}")
 * Plus one safety valve: a FORMULA override for the rare rule no slot covers.
 *
 * Any field typed `Value<T>` can hold a literal OR a reference to a named
 * parameter (`{ param: "opening_threshold" }`). Parameters are the slots a
 * standard fills in; items reference them, so changing a value never means
 * editing a rule.
 *
 * Rules contain no measuring logic. The engine measures every element once into
 * `MeasuredElement` (see measured.ts); rules only select, combine and label.
 */

import type { ElementFamily } from "./families";
import type { MeasuredField, Unit } from "./measured";

/* ============================================================================
 * 1. Slots: parameters and values
 * ========================================================================== */

/** A named, editable slot. This is what a standard "fills in". */
export type Param =
  | {
      type: "number";
      value: number;
      unit?: Unit;
      label: string;
      help?: string;
      min?: number;
      max?: number;
    }
  | {
      type: "choice";
      value: string;
      options: readonly string[];
      label: string;
      help?: string;
    }
  | { type: "boolean"; value: boolean; label: string; help?: string }
  | { type: "text"; value: string; label: string; help?: string };

/** Reference to a named parameter in `RuleSet.params`. */
export interface ParamRef {
  param: string;
}

/** A literal value, or a slot to be filled from `params`. */
export type Value<T> = T | ParamRef;

/**
 * A formula in the small, safe expression language.
 *
 * Grammar (evaluated only by the engine, never by `eval`):
 *   literals      12  0.5  "text"  true  false
 *   operators     + - * /  ( )  = != > >= < <=  AND OR NOT
 *   functions     IF(c,a,b)  MIN(a,b,..)  MAX(a,b,..)  ROUND(x,step)  CEIL(x,step)
 *                 FLOOR(x,step)  ABS(x)  SQRT(x)  PI()  COALESCE(a,b,..)
 *                 UNDER(term, "concrete")   true if a dictionary term is that term or beneath it
 *   variables     any MeasuredField           e.g. net_area, thickness, length
 *                 props["Pset_WallCommon.FireRating"]
 *                 p.<param>                   e.g. p.opening_threshold
 *                 src.<field> / src.qty       (derived rules only: the source element / line)
 *   aggregates    SUM | COUNT | MIN | MAX | AVG over a collection, with optional WHERE:
 *                   SUM(openings.area WHERE area > p.opening_threshold)
 *                   SUM(layers.volume WHERE material = "concrete")
 *                   COUNT(openings WHERE kind = "door")
 *                   SUM(faces.net_area WHERE side = "a")
 *                 collections: openings, layers, faces, children
 */
export type Expr = string;

/** Template text with {placeholders}: any MeasuredField, p.<param>, or {expr:...}. */
export type Template = string;

/* ============================================================================
 * 2. Selecting elements
 * ========================================================================== */

export type SelectorField =
  | MeasuredField
  | "ifc_class"
  | "predefined_type"
  | "type_name"
  | "family"
  | "family_name"
  | "material"
  | "element_type"
  | "space_type"
  | "discipline"
  | "storey"
  | "space"
  | "zone"
  | "status"
  | "is_external"
  | "load_bearing"
  | "system"
  | "profile"
  | "nominal_size"
  | "tag"
  | `props.${string}`;

export type SelectorOp =
  | "eq" | "neq"
  | "in" | "not_in"
  | "gt" | "gte" | "lt" | "lte"
  | "between"
  | "contains" | "starts_with" | "matches" // matches = regex
  | "exists" | "missing"
  | "under"; // dictionary term or anything beneath it: material under "concrete" matches "concrete.in_situ"

export type Selector =
  | { all: Selector[] }
  | { any: Selector[] }
  | { not: Selector }
  | { field: SelectorField; op: SelectorOp; value?: Value<unknown> }
  | { family: ElementFamily | ElementFamily[] }
  | { ifcClass: string | string[]; includeSubtypes?: boolean }
  | { expr: Expr }; // escape hatch: any boolean expression

/* ============================================================================
 * 3. Quantities: what gets measured
 * ========================================================================== */

/** Which surface of a planar element is measured. */
export type AreaSurface =
  | "main"        // engine's default face (centreline / mean for walls, top for slabs)
  | "side_a"      // one face
  | "side_b"      // the other face
  | "both"        // sum of both faces (e.g. formwork, paint both sides)
  | "larger"      // the larger face
  | "smaller"     // the smaller face
  | "mean"        // average of both faces
  | "top"
  | "bottom"
  | "edges"       // edge faces (e.g. slab edge formwork)
  | "footprint"   // plan projection
  | "developed";  // true sloped / unfolded area (roofs, stairs)

/** Which dimension of a linear element is measured. */
export type LengthBasis =
  | "axis"        // along the element axis
  | "overall"     // full length incl. overlaps
  | "clear"       // clear span between supports
  | "centreline"
  | "girth"       // developed width of a profile (flashings, gutters)
  | "perimeter";

/** How a mass is obtained. */
export type MassBasis =
  | "nominal_per_length" // length x nominal kg/m from the section designation
  | "volume_density"     // volume x density
  | "reported";          // a mass property already in the model

/**
 * How openings / voids / embedded parts are treated. Covers the common patterns
 * across measurement standards without encoding any particular one.
 */
export type DeductionMode =
  | "none"            // never deduct
  | "all"             // deduct every opening
  | "over_threshold"  // deduct openings larger than threshold, in full
  | "excess_only"     // deduct only the part of each opening above the threshold
  | "per_element_sum";// deduct if the SUM of openings in the element exceeds threshold

export interface DeductionRule {
  /** What is deducted. */
  what:
    | "openings"      // all openings
    | "doors"
    | "windows"
    | "voids"         // openings without a filling (shafts, holes)
    | "embedded"      // elements passing through (columns through slabs, beams in walls)
    | "recesses";
  mode: Value<DeductionMode>;
  /** Threshold value, compared using `compareBy`. */
  threshold?: Value<number>;
  compareBy?: Value<"area" | "width" | "height" | "length" | "volume">;
  /** Add reveal / jamb surfaces back when an opening is deducted. */
  addReveals?: Value<boolean>;
  /** Restrict which openings this rule applies to. */
  where?: Expr;
}

export interface Rounding {
  step: Value<number>;                 // e.g. 0.01
  mode: Value<"nearest" | "up" | "down">;
  /** Round each element before summing, or the summed line. */
  at: Value<"element" | "line">;
}

/**
 * The quantity specification. A discriminated union by measurement kind, plus
 * the two structural slots (`choose`, `when`) that let standards differ in the
 * *way* of measuring, and the `formula` safety valve.
 */
export type QuantitySpec =
  | { kind: "count"; unit?: Unit }
  | {
      kind: "length";
      basis?: Value<LengthBasis>;
      deductions?: DeductionRule[];
      unit?: Unit;
    }
  | {
      kind: "area";
      surface?: Value<AreaSurface>;
      /** Gross ignores openings unless `deductions` say otherwise. */
      start?: Value<"gross" | "net">;
      deductions?: DeductionRule[];
      unit?: Unit;
    }
  | {
      kind: "volume";
      start?: Value<"gross" | "net">;
      deductions?: DeductionRule[];
      unit?: Unit;
    }
  | {
      kind: "mass";
      basis: Value<MassBasis>;
      density?: Value<number>;           // kg/m3, used with volume_density
      unit?: Unit;
    }
  | { kind: "perimeter"; unit?: Unit }
  /** CHOICE slot: pick one of several ways of measuring. */
  | {
      kind: "choose";
      pick: Value<string>;
      options: Record<string, QuantitySpec>;
    }
  /** Conditional way of measuring, e.g. m3 above a thickness, m2 below. */
  | {
      kind: "when";
      if: Expr;
      then: QuantitySpec;
      else: QuantitySpec;
    }
  /** Safety valve: any formula. */
  | { kind: "formula"; expr: Expr; unit: Unit };

/* ============================================================================
 * 4. Item rules: element -> BoQ line
 * ========================================================================== */

/** What one rule produces lines from. */
export type Breakdown =
  | "element"   // one source per element (whole wall)
  | "layer"     // one source per material layer (brick, insulation, block...)
  | "face"      // one source per face (side a, side b) — for room-based finishes
  | "material"  // one source per distinct material
  | "child";    // one source per aggregated part (stair flight, stringer)

/** What happens when a needed value is missing on an element. */
export type OnMissing =
  | "flag"                         // keep the line, quantity blank, reason stated
  | "skip"                         // leave this element out (still reported in QA)
  | "ask"                          // pre-flight question to the user
  | { default: Value<number> };    // use a logged default value

/** Split lines into bands by a numeric field, e.g. work above 3.5 m height. */
export interface Band {
  field: MeasuredField;
  edges: Value<number>[];          // [0.1, 0.25] => <0.1, 0.1-0.25, >0.25
  labels?: string[];
}

export interface ItemRule {
  id: string;
  label: string;
  /** Informative; also lets the editor offer only valid quantity kinds. */
  family?: ElementFamily | ElementFamily[];

  /** Which elements (or parts) this rule takes. */
  match: Selector;
  /**
   * Elements that are parts of an aggregate (a roof's slab, a stair's flights and
   * railings) are skipped by default when some enabled rule measures the parent,
   * to avoid counting twice. "include" measures them anyway (e.g. stair railings).
   */
  parts?: "skip" | "include";
  breakdown?: Value<Breakdown>;
  /** Filter applied after breakdown, e.g. only layers with material = "plasterboard". */
  partFilter?: Expr;

  /** How the quantity is measured. */
  quantity: QuantitySpec;
  /** Multiplier, e.g. allowance or overlap factor. Default 1. */
  factor?: Value<number>;
  /** Minimum chargeable quantity per element or per line. */
  minimum?: { value: Value<number>; per: Value<"element" | "line"> };
  rounding?: Rounding;

  /** What splits elements into separate lines (same key = summed together). */
  lineKey?: (SelectorField | Expr)[];
  bands?: Band[];

  /** Line text. */
  description: Value<Template>;

  /**
   * Double-counting guard. Each element may be claimed once per claim name
   * (e.g. "structure", "finish_side_a"). Two rules claiming the same name on
   * the same element is a pre-flight warning.
   */
  claims?: string[];

  onMissing?: OnMissing;
  /** Free labels used by classification maps and grouping. */
  tags?: string[];
  /** Disable without deleting (useful in derived rule sets). */
  enabled?: Value<boolean>;
  notes?: string;
}

/* ============================================================================
 * 5. Derived rules: quantities for work that is not modelled
 * ========================================================================== */

export interface DerivedRule {
  id: string;
  label: string;
  /** Source item rules this derives from. */
  from: string[];
  /**
   * "element": evaluated per source element (src.* = that element's measured fields).
   * "line":    evaluated per source BoQ line (src.qty = the line quantity).
   */
  scope: "element" | "line";
  /** Optional narrowing of sources. */
  where?: Expr;
  quantity: Expr;                  // e.g. "src.qty * p.rebar_slab_kg_per_m3"
  unit: Unit;
  factor?: Value<number>;
  rounding?: Rounding;
  /**
   * Absent: one derived line per source line (keeps the source's split).
   * Present: group all sources by these fields of the source; [] = a single line.
   */
  lineKey?: (SelectorField | Expr)[];
  description: Value<Template>;
  onMissing?: OnMissing;
  tags?: string[];
  enabled?: Value<boolean>;
  notes?: string;
}

/* ============================================================================
 * 6. Manual items: lines with no model behind them
 * ========================================================================== */

export interface ManualItem {
  id: string;
  kind: "preliminary" | "provisional_sum" | "lump_sum" | "daywork" | "other";
  description: Value<Template>;
  unit: Unit;
  /** Empty = flagged line for the user to fill. */
  quantity?: Value<number>;
  /** Provisional and lump sums may carry an amount instead of a quantity. */
  amount?: Value<number>;
  tags?: string[];
  enabled?: Value<boolean>;
}

/* ============================================================================
 * 7. The rule set
 * ========================================================================== */

export interface RuleSetMeta {
  /** Free text, e.g. "Based on our reading of NRM2". Not a compliance claim. */
  basedOn?: string;
  author?: string;
  locale?: string;                 // description language, e.g. "en", "de", "sr"
  unitSystem: "metric" | "imperial";
  description?: string;
  /** Set by the engine on flattened snapshots: "as-modelled -> demo-tweaked". */
  chain?: string;
}

export interface RuleSetDefaults {
  rounding?: Rounding;
  onMissing?: OnMissing;
  breakdown?: Breakdown;
}

/** OurRuleType: a complete, self-contained rule set. */
export interface RuleSet {
  schemaVersion: "1.0";
  id: string;
  name: string;
  version: string;
  meta: RuleSetMeta;
  defaults?: RuleSetDefaults;

  /** The slots. A standard is mostly a set of values for these. */
  params: Record<string, Param>;

  items: ItemRule[];
  derived?: DerivedRule[];
  manual?: ManualItem[];
}

/**
 * A rule set that extends another. Only differences are stated:
 *   params   merge by name (value override, or new param)
 *   items / derived / manual   override by id, new ids added
 *   remove   ids to drop from the parent
 * The engine flattens the chain into a RuleSet and stores that snapshot.
 */
export interface RuleSetPatch {
  schemaVersion: "1.0";
  id: string;
  name: string;
  version: string;
  extends: string;
  meta?: Partial<RuleSetMeta>;
  defaults?: RuleSetDefaults;
  params?: Record<string, Param | { value: Param["value"] }>;
  items?: ItemRule[];
  derived?: DerivedRule[];
  manual?: ManualItem[];
  remove?: string[];
}

export type OurRuleType = RuleSet | RuleSetPatch;
