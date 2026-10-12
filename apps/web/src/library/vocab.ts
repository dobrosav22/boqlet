/**
 * Option lists the editors offer. The types in @ifc-boq/types are unions, which do not
 * exist at runtime, so they are written out here. Each list is checked against its type
 * at compile time: adding a value to the type without adding it here fails `tsc`.
 */
import {
  FAMILY_INFO,
  IFC_FAMILIES,
  type AreaSurface,
  type Breakdown,
  type DeductionMode,
  type DeductionRule,
  type DictField,
  type ElementFamily,
  type ExtractTarget,
  type LengthBasis,
  type ManualItem,
  type MassBasis,
  type MeasuredField,
  type QuantitySpec,
  type SelectorOp,
  type TermCategory,
} from "@ifc-boq/types";

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

export const MEASURED_FIELDS = [
  "storey_elevation",
  "length", "width", "height", "thickness", "depth", "diameter",
  "cross_section_area", "slope", "elevation_base", "elevation_top", "profile_girth",
  "gross_area", "net_area", "footprint_area", "developed_area",
  "floor_area", "ceiling_area", "wall_area", "wall_area_net", "skirting_length",
  "gross_volume", "net_volume", "perimeter",
  "mass", "nominal_mass_per_length", "density",
  "bar_diameter", "bar_count", "bar_length",
  "insulation_thickness", "connection_count",
] as const satisfies readonly MeasuredField[];
const _mf: Same<(typeof MEASURED_FIELDS)[number], MeasuredField> = true;

/** Non-numeric fields selectors and line keys can use (plus `props.<Pset.Prop>`). */
export const TEXT_FIELDS = [
  "ifc_class", "predefined_type", "type_name", "family", "family_name", "material", "element_type",
  "space_type", "discipline", "storey", "space", "zone", "status", "is_external", "load_bearing",
  "system", "profile", "nominal_size", "tag",
] as const;
export const SELECTOR_FIELDS: string[] = [...TEXT_FIELDS, ...MEASURED_FIELDS];

export const SELECTOR_OPS = [
  "eq", "neq", "in", "not_in", "gt", "gte", "lt", "lte", "between",
  "contains", "starts_with", "matches", "exists", "missing", "under",
] as const satisfies readonly SelectorOp[];
const _ops: Same<(typeof SELECTOR_OPS)[number], SelectorOp> = true;
export const OP_LABEL: Record<SelectorOp, string> = {
  eq: "is", neq: "is not", in: "is one of", not_in: "is none of", gt: ">", gte: "≥", lt: "<", lte: "≤",
  between: "between", contains: "contains", starts_with: "starts with", matches: "matches regex",
  exists: "exists", missing: "is missing", under: "is under term",
};

export const FAMILIES = Object.keys(FAMILY_INFO) as ElementFamily[];
export const IFC_CLASSES = Object.keys(IFC_FAMILIES).sort();

export const QUANTITY_KINDS = [
  "count", "length", "area", "volume", "mass", "perimeter", "choose", "when", "formula",
] as const satisfies readonly QuantitySpec["kind"][];
const _qk: Same<(typeof QUANTITY_KINDS)[number], QuantitySpec["kind"]> = true;
export const QUANTITY_KIND_LABEL: Record<QuantitySpec["kind"], string> = {
  count: "Count", length: "Length", area: "Area", volume: "Volume", mass: "Mass", perimeter: "Perimeter",
  choose: "Choose by slot", when: "If / else", formula: "Formula",
};

export const AREA_SURFACES = [
  "main", "side_a", "side_b", "both", "larger", "smaller", "mean", "top", "bottom", "edges", "footprint", "developed",
] as const satisfies readonly AreaSurface[];
const _as: Same<(typeof AREA_SURFACES)[number], AreaSurface> = true;
export const LENGTH_BASES = ["axis", "overall", "clear", "centreline", "girth", "perimeter"] as const satisfies readonly LengthBasis[];
const _lb: Same<(typeof LENGTH_BASES)[number], LengthBasis> = true;
export const MASS_BASES = ["nominal_per_length", "volume_density", "reported"] as const satisfies readonly MassBasis[];
const _mb: Same<(typeof MASS_BASES)[number], MassBasis> = true;
export const DEDUCTION_MODES = ["none", "all", "over_threshold", "excess_only", "per_element_sum"] as const satisfies readonly DeductionMode[];
const _dm: Same<(typeof DEDUCTION_MODES)[number], DeductionMode> = true;
export const DEDUCTION_WHAT = ["openings", "doors", "windows", "voids", "embedded", "recesses"] as const satisfies readonly DeductionRule["what"][];
const _dw: Same<(typeof DEDUCTION_WHAT)[number], DeductionRule["what"]> = true;
export const COMPARE_BY = ["area", "width", "height", "length", "volume"] as const;
export const BREAKDOWNS = ["element", "layer", "face", "material", "child"] as const satisfies readonly Breakdown[];
const _bd: Same<(typeof BREAKDOWNS)[number], Breakdown> = true;
export const MANUAL_KINDS = ["preliminary", "provisional_sum", "lump_sum", "daywork", "other"] as const satisfies readonly ManualItem["kind"][];
const _mk: Same<(typeof MANUAL_KINDS)[number], ManualItem["kind"]> = true;

/** Common units; any other text is allowed too. */
export const UNITS = ["nr", "item", "sum", "mm", "m", "km", "m2", "m3", "kg", "t", "ft", "ft2", "ft3", "yd2", "yd3", "lb", "h", "kg/m3"];

export const DICT_FIELDS = [
  "material", "layer_material", "type_name", "name", "object_type", "ifc_class", "predefined_type", "system", "space_name",
] as const satisfies readonly DictField[];
export const TERM_CATEGORIES = ["material", "product", "element_type", "space", "system", "other"] as const satisfies readonly TermCategory[];
const _tc: Same<(typeof TERM_CATEGORIES)[number], TermCategory> = true;
export const EXTRACT_TARGETS = [
  "type_name", "family", "thickness", "width", "height", "length", "diameter", "strength_class", "profile", "nominal_size", "term",
] as const satisfies readonly ExtractTarget[];

/** Line fields classification maps can read (classification.ts, LineMatch). */
export const LINE_FIELDS = [
  "rule_id", "rule_kind", "manual_kind", "tags", "unit", "source", "family", "ifc_class", "predefined_type",
  "material", "element_type", "storey", "storey_elevation", "keys.type_name", "keys.material", "keys.thickness",
];

void [_mf, _ops, _qk, _as, _lb, _mb, _dm, _dw, _bd, _mk, _tc];
