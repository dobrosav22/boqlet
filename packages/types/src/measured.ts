/**
 * MeasuredElement — the engine's contract with rules.
 *
 * The engine measures every element ONCE (slow, cached per model version) into
 * this shape. Rules can only refer to what is here. Anything not applicable to
 * an element is simply absent (undefined), which is what drives `onMissing`.
 *
 * All values are SI: metres, m2, m3, kg. Units on BoQ lines are converted at output.
 */

import type { ElementFamily } from "./families";

export type Unit =
  | "nr" | "item" | "sum"
  | "mm" | "m" | "km"
  | "m2" | "m3"
  | "kg" | "t"
  | "ft" | "ft2" | "ft3" | "yd2" | "yd3" | "lb"
  | "h"  // hours (daywork)
  | (string & {}); // custom units allowed

export type Provenance = "reported" | "geometry" | "derived" | "user";

export interface Face {
  side: "a" | "b" | "top" | "bottom" | "edge" | "end";
  gross_area: number;
  net_area: number;
  /** Room this face bounds (computed from geometry: the room's surface lying on the face). */
  space?: string;
  space_name?: string;
  /** Dictionary term of the room, e.g. "space.bathroom". */
  space_type?: string;
  is_external?: boolean;
  /** Outward normal, for orientation-based rules (facade direction). */
  normal?: [number, number, number];
}

export interface Opening {
  kind: "door" | "window" | "void";
  width: number;
  height: number;
  area: number;
  /** Depth of the opening through the host = reveal depth. */
  depth?: number;
  perimeter: number;
  filling_guid?: string;
  filling_class?: string;
}

export interface Layer {
  index: number;
  material: string;               // normalised by the dictionary
  material_raw: string;           // as in the IFC
  thickness: number;
  area: number;
  volume: number;
  function?: "structure" | "insulation" | "finish" | "membrane" | "air_gap" | "other";
}

export interface MeasuredElement {
  /* ---- identity ---------------------------------------------------- */
  guid: string;
  model_id: string;
  discipline: string;             // "mep" for distribution elements, else the model's guess (architecture | structure | infrastructure | unknown)
  ifc_class: string;              // normalised (IfcWallStandardCase -> IfcWall; IFC2x3 IfcFlowSegment typed IfcDuctSegmentType -> IfcDuctSegment)
  ifc_class_raw: string;
  predefined_type?: string;
  family: ElementFamily;          // measurement family (linear, planar, ...)
  name?: string;
  family_name?: string;           // authoring-tool family, e.g. Revit "M_Fixed" (from the dictionary extractor)
  type_name?: string;
  material?: string;              // main material: dictionary term (thickest non-air layer for layer sets)
  element_type?: string;          // dictionary term from the type name, e.g. "wall.party"
  space_type?: string;            // spaces: dictionary term from the room name, e.g. "space.bathroom"
  materials: string[];
  system?: string;                // MEP system name / type
  profile?: string;               // section designation, e.g. "W310X60", "IPE200"
  nominal_size?: string;          // e.g. "DN50", "200x100"
  strength_class?: string;        // e.g. "C30/37", "MB30" (from names)
  material_raw?: string;          // main material name as in the IFC

  /* ---- location & status ------------------------------------------- */
  site?: string;
  building?: string;
  storey?: string;
  storey_elevation?: number;
  spaces: string[];
  zone?: string;
  status: "new" | "existing" | "demolish" | "temporary";
  design_option?: string;

  /* ---- common flags ------------------------------------------------ */
  is_external?: boolean;
  load_bearing?: boolean;

  /* ---- dimensions -------------------------------------------------- */
  length?: number;
  width?: number;
  height?: number;
  thickness?: number;
  depth?: number;
  diameter?: number;
  cross_section_area?: number;
  slope?: number;                 // degrees
  elevation_base?: number;
  elevation_top?: number;
  profile_girth?: number;         // developed width of a profile

  /* ---- areas ------------------------------------------------------- */
  gross_area?: number;            // main face, before openings
  net_area?: number;              // main face, after all openings
  footprint_area?: number;        // plan projection
  developed_area?: number;        // true sloped / unfolded area
  faces: Face[];

  /* ---- rooms (IfcSpace) -------------------------------------------- */
  floor_area?: number;
  ceiling_area?: number;
  /** Room wall surface, before openings (perimeter x height for a simple room). */
  wall_area?: number;
  /** Room wall surface less the doors and windows in the walls bounding it. */
  wall_area_net?: number;
  /** Perimeter less the widths of the doors in the walls bounding it. */
  skirting_length?: number;
  /** Elements whose faces bound the room. */
  bounded_by?: string[];

  /* ---- volumes, perimeters, mass ----------------------------------- */
  gross_volume?: number;
  net_volume?: number;
  perimeter?: number;
  mass?: number;                  // reported mass, if any
  nominal_mass_per_length?: number;
  density?: number;

  /* ---- reinforcement ----------------------------------------------- */
  bar_diameter?: number;
  bar_count?: number;
  bar_length?: number;            // per bar

  /* ---- MEP --------------------------------------------------------- */
  insulation_thickness?: number;
  connection_count?: number;

  /* ---- parts & relationships --------------------------------------- */
  openings: Opening[];
  layers: Layer[];
  host_guid?: string;
  parent_guid?: string;
  child_guids: string[];

  /** Classification references already in the IFC (used by maps with source "ifc"). */
  ifc_classifications?: { system?: string; code?: string; title?: string }[];

  /* ---- everything else --------------------------------------------- */
  /** All property sets flattened: "Pset_WallCommon.FireRating" -> "EI60". */
  props: Record<string, string | number | boolean | null>;

  /* ---- trust ------------------------------------------------------- */
  /** Where each numeric value came from, keyed by MeasuredField. */
  provenance: Partial<Record<string, Provenance>>;
  /** Reported vs geometry disagreements found during verification. */
  warnings: string[];
}

/**
 * Numeric fields rules may use as variables in formulas, selectors and bands.
 * Written out explicitly so the JSON Schema (for the Python engine) can list them;
 * the check below fails to compile if this list drifts from MeasuredElement.
 */
export type MeasuredField =
  | "storey_elevation"
  | "length" | "width" | "height" | "thickness" | "depth" | "diameter"
  | "cross_section_area" | "slope" | "elevation_base" | "elevation_top" | "profile_girth"
  | "gross_area" | "net_area" | "footprint_area" | "developed_area"
  | "floor_area" | "ceiling_area" | "wall_area" | "wall_area_net" | "skirting_length"
  | "gross_volume" | "net_volume" | "perimeter"
  | "mass" | "nominal_mass_per_length" | "density"
  | "bar_diameter" | "bar_count" | "bar_length"
  | "insulation_thickness" | "connection_count";

type _NumericKeys = {
  [K in keyof MeasuredElement]-?: NonNullable<MeasuredElement[K]> extends number ? K : never;
}[keyof MeasuredElement];
type _Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _measuredFieldsInSync: _Same<MeasuredField, _NumericKeys> = true;
void _measuredFieldsInSync;
