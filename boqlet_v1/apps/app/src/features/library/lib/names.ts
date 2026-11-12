/**
 * The names formulas can use, ported from the PoC's `apps/web/src/library/vocab.ts` (`NAMES`,
 * reuse-from-poc.md). Only the names and their groups live here; labels and help texts are in the
 * message catalogue (`library.names.<name>.label`, F15).
 */
export type NameGroup = "measured" | "describes" | "lists" | "items" | "line" | "building";

export const NAME_GROUPS: Record<NameGroup, readonly string[]> = {
  measured: [
    "storey_elevation", "length", "width", "height", "thickness", "depth", "diameter", "cross_section_area", "slope",
    "elevation_base", "elevation_top", "profile_girth", "gross_area", "net_area", "footprint_area", "developed_area",
    "floor_area", "ceiling_area", "wall_area", "wall_area_net", "skirting_length", "gross_volume", "net_volume",
    "perimeter", "mass", "nominal_mass_per_length", "density", "bar_diameter", "bar_count", "bar_length",
    "insulation_thickness", "connection_count",
  ],
  describes: [
    "ifc_class", "predefined_type", "type_name", "family", "family_name", "name", "material", "material_raw",
    "element_type", "strength_class", "space_type", "discipline", "storey", "space", "space_name", "zone", "status",
    "is_external", "load_bearing", "system", "profile", "nominal_size", "tag", "guid", "model",
  ],
  lists: ["openings", "layers", "faces", "children", "embedded"],
  items: ["kind", "area", "volume", "side", "index", "function", "filling_class"],
  line: ["qty", "unit", "keys"],
  building: ["building", "gross_floor_area", "net_floor_area", "space_volume", "storeys"],
};

/** Every name once, in the order the PoC listed them (a later group never relabels an earlier name). */
export const NAMES: readonly string[] = [...new Set(Object.values(NAME_GROUPS).flat())];
