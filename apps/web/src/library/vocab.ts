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
  exists: "is filled in", missing: "is missing", under: "is a kind of",
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

/* ---------------------------------------------------------------- the same lists in plain words */

/** IFC classes as people call them (plural). Classes not listed are spelled out from their name. */
const CLASS_WORDS: Record<string, string> = {
  IfcWall: "walls", IfcCurtainWall: "curtain walls", IfcSlab: "slabs", IfcRoof: "roofs", IfcCovering: "coverings (finishes, cladding)",
  IfcPlate: "plates and panels", IfcBeam: "beams", IfcColumn: "columns", IfcMember: "members (studs, rafters, mullions)",
  IfcRailing: "railings", IfcFooting: "footings", IfcPile: "piles", IfcChimney: "chimneys", IfcStair: "stairs",
  IfcStairFlight: "stair flights", IfcRamp: "ramps", IfcRampFlight: "ramp flights", IfcDoor: "doors", IfcWindow: "windows",
  IfcShadingDevice: "shading devices", IfcBuildingElementProxy: "unclassified objects (proxies)", IfcBuildingElementPart: "element parts",
  IfcElementAssembly: "element assemblies", IfcReinforcingBar: "reinforcing bars", IfcReinforcingMesh: "reinforcing meshes",
  IfcTendon: "tendons", IfcTendonAnchor: "tendon anchors", IfcFurnishingElement: "furnishing", IfcFurniture: "furniture",
  IfcTransportElement: "lifts and escalators", IfcGeographicElement: "trees and terrain features", IfcPipeSegment: "pipes",
  IfcDuctSegment: "ducts", IfcCableSegment: "cables", IfcCableCarrierSegment: "cable trays", IfcFlowSegment: "pipes and ducts (generic)",
  IfcPipeFitting: "pipe fittings", IfcDuctFitting: "duct fittings", IfcFlowTerminal: "terminals (sanitary, lights, outlets)",
  IfcFlowController: "valves, dampers, switches", IfcFlowMovingDevice: "pumps and fans", IfcFlowStorageDevice: "tanks",
  IfcEnergyConversionDevice: "boilers, chillers, heat pumps", IfcDistributionControlElement: "sensors and controls",
  IfcDistributionChamberElement: "manholes and pits", IfcEarthworksCut: "earthworks cut", IfcEarthworksFill: "earthworks fill",
  IfcCourse: "pavement courses", IfcPavement: "pavements", IfcKerb: "kerbs", IfcRail: "rails", IfcSpace: "rooms", IfcZone: "zones",
  IfcOpeningElement: "openings", IfcBuiltElement: "built elements (generic)",
};
/** "IfcCableCarrierFitting" -> "cable carrier fittings". */
export function classWords(c: string): string {
  if (CLASS_WORDS[c]) return CLASS_WORDS[c];
  const w = c.replace(/^Ifc/, "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return w.endsWith("s") ? w : `${w}s`;
}

/** The class picker's groups. A class of IFC_FAMILIES missing here is offered under "Other". */
export const CLASS_GROUPS: [string, string[]][] = [
  ["Building", ["IfcWall", "IfcCurtainWall", "IfcSlab", "IfcRoof", "IfcCovering", "IfcPlate", "IfcDoor", "IfcWindow", "IfcStair", "IfcStairFlight", "IfcRamp", "IfcRampFlight", "IfcRailing", "IfcChimney", "IfcShadingDevice"]],
  ["Structure", ["IfcBeam", "IfcColumn", "IfcMember", "IfcFooting", "IfcPile", "IfcReinforcingBar", "IfcReinforcingMesh", "IfcTendon", "IfcTendonAnchor", "IfcBuildingElementPart", "IfcElementAssembly"]],
  ["Services (MEP)", ["IfcPipeSegment", "IfcDuctSegment", "IfcCableSegment", "IfcCableCarrierSegment", "IfcFlowSegment", "IfcPipeFitting", "IfcDuctFitting", "IfcFlowFitting", "IfcFlowTerminal", "IfcFlowController", "IfcFlowMovingDevice", "IfcFlowStorageDevice", "IfcFlowTreatmentDevice", "IfcEnergyConversionDevice", "IfcDistributionControlElement", "IfcDistributionChamberElement", "IfcJunctionBox"]],
  ["Rooms", ["IfcSpace", "IfcZone"]],
  ["Furniture and equipment", ["IfcFurnishingElement", "IfcFurniture", "IfcSystemFurnitureElement", "IfcTransportElement"]],
  ["Infrastructure and site", ["IfcEarthworksCut", "IfcEarthworksFill", "IfcReinforcedSoil", "IfcCourse", "IfcPavement", "IfcKerb", "IfcRail", "IfcTrackElement", "IfcBearing", "IfcDeepFoundation", "IfcCaissonFoundation", "IfcSign", "IfcSignal", "IfcSurfaceFeature", "IfcGeographicElement"]],
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

export const QUANTITY_KIND_WORDS: Record<QuantitySpec["kind"], string> = {
  count: "Count them", length: "Length", area: "Area", volume: "Volume", mass: "Weight", perimeter: "Perimeter",
  formula: "My own formula", when: "Depends on a condition (if / else)", choose: "Let a Settings answer choose",
};
export const SURFACE_WORDS: Record<AreaSurface, string> = {
  main: "main face", side_a: "one face (side a)", side_b: "the other face (side b)", both: "both faces", larger: "the larger face",
  smaller: "the smaller face", mean: "average of both faces", top: "top", bottom: "underside", edges: "edges",
  footprint: "plan area", developed: "true sloped / unfolded area",
};
export const LENGTH_WORDS: Record<LengthBasis, string> = {
  axis: "along the axis", overall: "overall, with overlaps", clear: "clear span", centreline: "centreline", girth: "girth (developed width)", perimeter: "perimeter",
};
export const MASS_WORDS: Record<MassBasis, string> = {
  nominal_per_length: "length × kg/m of the section", volume_density: "volume × density", reported: "as the model reports it",
};
export const START_WORDS = { gross: "gross, openings left in", net: "net, the model's openings taken out" };
export const DEDUCT_WHAT_WORDS: Record<DeductionRule["what"], string> = {
  openings: "openings", doors: "doors", windows: "windows", voids: "holes without a door or window",
  embedded: "elements passing through", recesses: "recesses",
};
export const DEDUCT_MODE_WORDS: Record<DeductionMode, string> = {
  none: "never", all: "all of them", over_threshold: "only those larger than a size, in full",
  excess_only: "only the part above a size", per_element_sum: "all, when together they exceed a size",
};
/** Modes that need a size. */
export const MODES_WITH_SIZE: DeductionMode[] = ["over_threshold", "excess_only", "per_element_sum"];
export const BREAKDOWN_WORDS: Record<Breakdown, string> = {
  element: "whole elements", layer: "each material layer", face: "each face (side)", material: "each material", child: "each part of an assembly",
};

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

/* ---------------------------------------------------------------- names in formulas */

/**
 * What every name a formula can use means, in words: the readable form of formulas
 * (`[Length] + 2 * [Working space]`, see readable.ts) and the "Names" list next to them.
 * Labels must be unique (case-insensitive): the readable form is turned back into names by label.
 */
export interface NameInfo {
  name: string;
  label: string;
  group: NameGroup;
  unit?: string;
  help?: string;
}
export type NameGroup = "measured" | "describes" | "lists" | "items" | "line" | "building";
export const NAME_GROUP_LABEL: Record<NameGroup, string> = {
  measured: "Measured on the element",
  describes: "Describing the element",
  lists: "Lists (use with SUM, COUNT, MIN, MAX, AVG)",
  items: "Fields of list items (inside WHERE, or after a list: Openings › Area)",
  line: "On a BoQ line (calculated items per line)",
  building: "The whole building (after Building ›, e.g. [Building › Gross volume])",
};

const MEASURED_INFO: Record<MeasuredField, [string, string, string?]> = {
  storey_elevation: ["Storey elevation", "m"],
  length: ["Length", "m", "Along the element's axis"],
  width: ["Width", "m"],
  height: ["Height", "m"],
  thickness: ["Thickness", "m"],
  depth: ["Depth", "m"],
  diameter: ["Diameter", "m"],
  cross_section_area: ["Cross-section area", "m2"],
  slope: ["Slope", "°"],
  elevation_base: ["Base elevation", "m"],
  elevation_top: ["Top elevation", "m"],
  profile_girth: ["Profile girth", "m", "Developed width of a profile (flashings, gutters)"],
  gross_area: ["Gross area", "m2", "Main face, before openings"],
  net_area: ["Net area", "m2", "Main face, after all openings"],
  footprint_area: ["Plan area", "m2", "Projection on plan"],
  developed_area: ["Developed area", "m2", "True sloped or unfolded area (roofs, stairs)"],
  floor_area: ["Room floor area", "m2", "Rooms only"],
  ceiling_area: ["Room ceiling area", "m2", "Rooms only"],
  wall_area: ["Room wall area", "m2", "Rooms only, before openings"],
  wall_area_net: ["Room wall area, net", "m2", "Rooms only, less doors and windows"],
  skirting_length: ["Room skirting length", "m", "Rooms only, perimeter less door widths"],
  gross_volume: ["Gross volume", "m3", "Before openings"],
  net_volume: ["Net volume", "m3", "After openings"],
  perimeter: ["Perimeter", "m"],
  mass: ["Mass", "kg", "Reported in the model, if any"],
  nominal_mass_per_length: ["Nominal mass per metre", "kg/m", "From the section designation"],
  density: ["Density", "kg/m3"],
  bar_diameter: ["Bar diameter", "m"],
  bar_count: ["Bar count", "nr"],
  bar_length: ["Bar length", "m", "Per bar"],
  insulation_thickness: ["Insulation thickness", "m"],
  connection_count: ["Connection count", "nr"],
};

const DESCRIBES: [string, string, string?][] = [
  ["ifc_class", "IFC class", "e.g. \"IfcWall\""],
  ["predefined_type", "Predefined type", "e.g. \"FLOORING\""],
  ["type_name", "Type name"],
  ["family", "Measurement family", "linear, planar, volumetric, countable…"],
  ["family_name", "Family name", "Authoring-tool family, e.g. a Revit family"],
  ["name", "Name"],
  ["material", "Material", "Dictionary term, e.g. use UNDER([Material], \"concrete\")"],
  ["material_raw", "Material as in the model"],
  ["element_type", "Element type", "Dictionary term from the type name"],
  ["strength_class", "Strength class", "e.g. \"C30/37\""],
  ["space_type", "Room type", "Dictionary term from the room name"],
  ["discipline", "Discipline"],
  ["storey", "Storey"],
  ["space", "Room"],
  ["space_name", "Room name"],
  ["zone", "Zone"],
  ["status", "Status", "new, existing, demolish, temporary"],
  ["is_external", "External", "true / false"],
  ["load_bearing", "Load bearing", "true / false"],
  ["system", "System"],
  ["profile", "Profile", "Section designation, e.g. \"IPE200\""],
  ["nominal_size", "Nominal size", "e.g. \"DN50\""],
  ["tag", "Tag"],
  ["guid", "GlobalId"],
  ["model", "Model"],
];

const LISTS: [string, string, string][] = [
  ["openings", "Openings", "Doors, windows and voids in the element"],
  ["layers", "Layers", "Material layers of the build-up"],
  ["faces", "Faces", "Sides of the element (walls: side a and b, with the room on each)"],
  ["children", "Parts", "Parts of an assembly (stair flights, roof slabs)"],
  ["embedded", "Elements passing through", "Columns and beams through a slab or wall"],
];

const ITEM_FIELDS: [string, string, string?, string?][] = [
  ["kind", "Opening kind", undefined, "\"door\", \"window\", \"void\" or \"recess\""],
  ["area", "Area", "m2"],
  ["volume", "Volume", "m3"],
  ["side", "Face side", undefined, "\"a\", \"b\", \"top\", \"bottom\", \"edge\""],
  ["index", "Layer number", undefined, "0 = first layer"],
  ["function", "Layer function", undefined, "structure, insulation, finish, membrane, air_gap"],
  ["filling_class", "Filling class", undefined, "IFC class of the door or window in an opening"],
];

const LINE_NAMES: [string, string, string?, string?][] = [
  ["qty", "Line quantity", undefined, "The source line's quantity"],
  ["unit", "Line unit"],
  ["keys", "Line key", undefined, "The values that split the source line, e.g. Line key › Type name"],
];

/** BuildingMeasures (measured.ts). Fields already labelled above (Height, Plan area) are reused. */
const BUILDING_NAMES: [string, string, string?, string?][] = [
  ["building", "Building", undefined, "Whole-building values; the log says whether each is from the model or derived"],
  ["gross_floor_area", "Gross floor area", "m2", "Building: floor slab plan areas, or the model's own value"],
  ["net_floor_area", "Net floor area", "m2", "Building: sum of room floor areas, or the model's own value"],
  ["space_volume", "Volume of rooms", "m3", "Building: sum of room volumes"],
  ["storeys", "Number of storeys", "nr"],
];

/** What `building.<field>` offers, in the order the Names list shows it. */
export const BUILDING_FIELDS = ["gross_floor_area", "net_floor_area", "footprint_area", "gross_volume", "space_volume", "height", "storeys"];

export const NAMES: NameInfo[] = [
  ...Object.entries(MEASURED_INFO).map(([name, [label, unit, help]]): NameInfo => ({ name, label, group: "measured", unit, help })),
  ...DESCRIBES.map(([name, label, help]): NameInfo => ({ name, label, group: "describes", help })),
  ...LISTS.map(([name, label, help]): NameInfo => ({ name, label, group: "lists", help })),
  ...ITEM_FIELDS.map(([name, label, unit, help]): NameInfo => ({ name, label, group: "items", unit, help })),
  ...LINE_NAMES.map(([name, label, unit, help]): NameInfo => ({ name, label, group: "line", unit, help })),
  ...BUILDING_NAMES.map(([name, label, unit, help]): NameInfo => ({ name, label, group: "building", unit, help })),
];

/** Line fields classification maps can read (classification.ts, LineMatch). */
export const LINE_FIELDS = [
  "rule_id", "rule_kind", "manual_kind", "tags", "unit", "source", "family", "ifc_class", "predefined_type",
  "material", "element_type", "storey", "storey_elevation", "keys.type_name", "keys.material", "keys.thickness",
];

void [_mf, _ops, _qk, _as, _lb, _mb, _dm, _dw, _bd, _mk, _tc];
