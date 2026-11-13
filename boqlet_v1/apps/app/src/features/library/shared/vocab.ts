/**
 * The option lists the Library editors offer, ported from the PoC's `vocab.ts` (reuse-from-poc.md).
 * The types in @ifc-boq/types are unions, which don't exist at runtime, so the values are written
 * out here and checked against their type at compile time. The words for them are in the message
 * catalogue (`library.vocab`, F15): `useVocab()` reads them.
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

export const FAMILIES = Object.keys(FAMILY_INFO) as ElementFamily[];
export const IFC_CLASSES = Object.keys(IFC_FAMILIES).sort();

export const QUANTITY_KINDS = [
  "count", "length", "area", "volume", "mass", "perimeter", "choose", "when", "formula",
] as const satisfies readonly QuantitySpec["kind"][];
const _qk: Same<(typeof QUANTITY_KINDS)[number], QuantitySpec["kind"]> = true;

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

/** The class picker's groups (labels: `library.vocab.classGroups`). A class not listed is offered under "Other". */
export type ClassGroup = "building" | "structure" | "services" | "rooms" | "furniture" | "site";
export const CLASS_GROUPS: [ClassGroup, string[]][] = [
  ["building", ["IfcWall", "IfcCurtainWall", "IfcSlab", "IfcRoof", "IfcCovering", "IfcPlate", "IfcDoor", "IfcWindow", "IfcStair", "IfcStairFlight", "IfcRamp", "IfcRampFlight", "IfcRailing", "IfcChimney", "IfcShadingDevice"]],
  ["structure", ["IfcBeam", "IfcColumn", "IfcMember", "IfcFooting", "IfcPile", "IfcReinforcingBar", "IfcReinforcingMesh", "IfcTendon", "IfcTendonAnchor", "IfcBuildingElementPart", "IfcElementAssembly"]],
  ["services", ["IfcPipeSegment", "IfcDuctSegment", "IfcCableSegment", "IfcCableCarrierSegment", "IfcFlowSegment", "IfcPipeFitting", "IfcDuctFitting", "IfcFlowFitting", "IfcFlowTerminal", "IfcFlowController", "IfcFlowMovingDevice", "IfcFlowStorageDevice", "IfcFlowTreatmentDevice", "IfcEnergyConversionDevice", "IfcDistributionControlElement", "IfcDistributionChamberElement", "IfcJunctionBox"]],
  ["rooms", ["IfcSpace", "IfcZone"]],
  ["furniture", ["IfcFurnishingElement", "IfcFurniture", "IfcSystemFurnitureElement", "IfcTransportElement"]],
  ["site", ["IfcEarthworksCut", "IfcEarthworksFill", "IfcReinforcedSoil", "IfcCourse", "IfcPavement", "IfcKerb", "IfcRail", "IfcTrackElement", "IfcBearing", "IfcDeepFoundation", "IfcCaissonFoundation", "IfcSign", "IfcSignal", "IfcSurfaceFeature", "IfcGeographicElement"]],
];

/** How a model's raw class counts read (IfcWallStandardCase counts as IfcWall, as in the engine). */
export function classCounts(byClass: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [c, n] of Object.entries(byClass ?? {})) {
    const k = c.replace(/(StandardCase|ElementedCase)$/, "");
    out[k] = (out[k] ?? 0) + n;
  }
  return out;
}

/** Modes that need a size. */
export const MODES_WITH_SIZE: DeductionMode[] = ["over_threshold", "excess_only", "per_element_sum"];
/** Fields offered as "one line per …" ticks, in order. */
export const LINE_SPLITS = ["type_name", "storey", "material", "thickness", "is_external", "ifc_class", "predefined_type", "family_name", "profile", "nominal_size", "system", "space_type"];

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

/** What `building.<field>` offers, in the order the Names list shows it. */
export const BUILDING_FIELDS = ["gross_floor_area", "net_floor_area", "footprint_area", "gross_volume", "space_volume", "height", "storeys"];

/** The unit of a name a formula can read (symbols, not words). */
export const NAME_UNITS: Record<string, string> = {
  storey_elevation: "m",
  length: "m",
  width: "m",
  height: "m",
  thickness: "m",
  depth: "m",
  diameter: "m",
  cross_section_area: "m2",
  slope: "°",
  elevation_base: "m",
  elevation_top: "m",
  profile_girth: "m",
  gross_area: "m2",
  net_area: "m2",
  footprint_area: "m2",
  developed_area: "m2",
  floor_area: "m2",
  ceiling_area: "m2",
  wall_area: "m2",
  wall_area_net: "m2",
  skirting_length: "m",
  gross_volume: "m3",
  net_volume: "m3",
  perimeter: "m",
  mass: "kg",
  nominal_mass_per_length: "kg/m",
  density: "kg/m3",
  bar_diameter: "m",
  bar_count: "nr",
  bar_length: "m",
  insulation_thickness: "m",
  connection_count: "nr",
  area: "m2",
  volume: "m3",
  gross_floor_area: "m2",
  net_floor_area: "m2",
  space_volume: "m3",
  storeys: "nr",
};

/** Line fields classification maps can read (classification.ts, LineMatch). */
export const LINE_FIELDS = [
  "rule_id", "rule_kind", "manual_kind", "tags", "unit", "source", "family", "ifc_class", "predefined_type",
  "material", "element_type", "storey", "storey_elevation", "keys.type_name", "keys.material", "keys.thickness",
];

void [_mf, _ops, _qk, _as, _lb, _mb, _dm, _dw, _bd, _mk, _tc];
