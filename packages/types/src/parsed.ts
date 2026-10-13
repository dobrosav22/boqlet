/**
 * ParsedModel — the reusable JSON produced from one IFC file (one model version).
 *
 * Layer 1 of 2:
 *   ParsedModel       faithful snapshot of the IFC. No decisions, no dictionary,
 *                     no adopted quantities. Reused by the rules pipeline, the 3D
 *                     viewer, revision comparison, review questions and federation.
 *   MeasuredElement   (measured.ts) derived FROM this, with names normalised and
 *                     quantities adopted. Cheap to recompute; this layer is not.
 *
 * Conventions
 *   - Ids are IFC GlobalIds wherever the IFC has one (stable across versions,
 *     used to match elements between revisions). Catalogue entries without a
 *     GlobalId (materials, layer sets) get a deterministic id "mat:<step id>".
 *   - All lengths, areas, volumes are converted to SI (m, m2, m3). The original
 *     unit is recorded in `header.units`.
 *   - Coordinates are world coordinates of the file (before any federation
 *     alignment, which is a separate step).
 *   - Heavy geometry (meshes) is NOT in this JSON. Elements point into a
 *     separate geometry store (e.g. a .glb with one node per GlobalId).
 */

export type Scalar = string | number | boolean | null;
export type PropValue = Scalar | Scalar[];
export type Vec3 = [number, number, number];

/* ============================================================================
 * Header
 * ========================================================================== */

export interface Header {
  source: {
    fileName: string;
    sizeBytes: number;
    sha256: string;                 // identifies the exact file version
  };
  ifcSchema: "IFC2X3" | "IFC4" | "IFC4X1" | "IFC4X2" | "IFC4X3" | (string & {});
  /** Model view definition from the file header, e.g. "CoordinationView_V2.0". */
  modelView?: string;
  authoringApp?: { name?: string; version?: string; vendor?: string; fullName?: string };
  originatingSystem?: string;
  preprocessor?: string;
  author?: string;
  organization?: string;
  fileTimestamp?: string;           // from the IFC header
  project: { id: string; name?: string; longName?: string; phase?: string };
  units: {
    length: string;                 // as declared in the IFC, e.g. "METRE", "MILLIMETRE", "FOOT"
    area?: string;
    volume?: string;
    angle?: string;
    mass?: string;
    /** Factor applied to convert file lengths to metres. */
    lengthToMetre: number;
  };
  georeference?: {
    latitude?: number;
    longitude?: number;
    elevation?: number;
    trueNorthDeg?: number;          // clockwise from project Y axis
    crs?: string;                   // IFC4 IfcProjectedCRS name, if present
    mapConversion?: { eastings: number; northings: number; orthogonalHeight: number; rotationDeg?: number; scale?: number };
  };
  /** Engine's guess; the user confirms it when adding the model to a project. */
  disciplineGuess?: "architecture" | "structure" | "mep" | "infrastructure" | "mixed" | "unknown";
  parse: {
    engineVersion: string;
    ifcopenshellVersion?: string;
    parsedAt: string;               // ISO timestamp
    durationMs: number;
  };
}

/* ============================================================================
 * Spatial structure: site > building > storey > space, plus zones
 * ========================================================================== */

export interface SpatialNode {
  id: string;
  kind: "project" | "site" | "building" | "storey" | "space" | "zone" | "facility" | "facility_part";
  ifcClass: string;
  name?: string;
  longName?: string;
  /** Parent in the spatial tree (zones have none; see memberIds). */
  parentId?: string;
  childIds: string[];
  elevation?: number;               // storeys
  /** Zones group spaces. */
  memberIds?: string[];
  predefinedType?: string;
  psets: Record<string, Record<string, PropValue>>;
  quantities: ReportedQuantities;
  geometry?: GeometryInfo;          // spaces have volumes
}

/* ============================================================================
 * Catalogues: shared definitions referenced by elements
 * ========================================================================== */

export interface TypeObject {
  id: string;
  ifcClass: string;                 // e.g. IfcWallType, IfcDoorStyle
  name?: string;
  predefinedType?: string;
  elementType?: string;
  psets: Record<string, Record<string, PropValue>>;
  materialRef?: MaterialRef;
  instanceIds: string[];
}

export interface Material {
  id: string;                       // "mat:<step id>"
  name: string;                     // raw, as in the IFC
  category?: string;                // IFC4
  description?: string;
  psets: Record<string, Record<string, PropValue>>;
}

export interface LayerSet {
  id: string;                       // "mls:<step id>"
  name?: string;
  totalThickness: number;
  layers: {
    materialId?: string;
    thickness: number;
    isVentilated?: boolean | null;
    name?: string;                  // IFC4
    category?: string;              // IFC4, e.g. "LoadBearing", "Insulation"
  }[];
}

export interface Profile {
  id: string;                       // "prf:<step id>"
  ifcClass: string;                 // IfcIShapeProfileDef, IfcRectangleProfileDef...
  name?: string;                    // e.g. "W310X60"
  params: Record<string, number>;   // overall depth, flange width, ...
  area?: number;
}

export interface SystemDef {
  id: string;
  ifcClass: string;                 // IfcSystem, IfcDistributionSystem...
  name?: string;
  predefinedType?: string;
  memberIds: string[];
}

export interface ClassificationRef {
  id: string;                       // "cls:<step id>"
  system?: string;                  // e.g. "OmniClass", "Uniclass"
  edition?: string;
  code?: string;
  title?: string;
}

export interface Catalogues {
  types: TypeObject[];
  materials: Material[];
  layerSets: LayerSet[];
  profiles: Profile[];
  systems: SystemDef[];
  classifications: ClassificationRef[];
}

/* ============================================================================
 * Elements
 * ========================================================================== */

/** How an element's material is defined. Mirrors IFC's material options. */
export type MaterialRef =
  | { kind: "single"; materialId: string }
  | { kind: "list"; materialIds: string[] }
  | {
      kind: "layerSet";
      layerSetId: string;
      direction?: "AXIS1" | "AXIS2" | "AXIS3";
      sense?: "POSITIVE" | "NEGATIVE";
      offset?: number;
    }
  | { kind: "profileSet"; items: { materialId?: string; profileId?: string; name?: string }[] }
  | { kind: "constituentSet"; items: { materialId?: string; name?: string; fraction?: number; category?: string }[] };

/** Quantity sets exactly as reported in the file (BaseQuantities, Qto_*, authoring-tool sets). */
export type ReportedQuantities = Record<string, Record<string, number>>;

/** Measured from the actual geometry by the engine. Independent of reported values. */
export interface GeometryInfo {
  /** IFC representation types found, e.g. ["SweptSolid"], ["Brep"], ["SurfaceModel"]. */
  representationTypes: string[];
  hasBody: boolean;
  /** Node / object id in the geometry store, normally the GlobalId. */
  meshRef?: string;
  bboxMin?: Vec3;
  bboxMax?: Vec3;
  centroid?: Vec3;
  volume?: number;
  surfaceArea?: number;
  triangleCount?: number;
  /** Every mesh edge is shared by exactly two triangles. */
  watertight?: boolean;
  /** The surface encloses a volume: watertight, or geometrically closed although the
   *  triangulation has T-junctions (area-weighted normals sum to ~0). The geometric
   *  volume is trusted only when this is true. */
  closed?: boolean;
  /** Oriented bounding box: extents in metres, largest first, and the unit axis of each.
   *  Unlike bboxMin/bboxMax it does not depend on world axes (rotated walls, sloped members). */
  obbExtents?: Vec3;
  obbAxes?: [Vec3, Vec3, Vec3];
  /** Disjoint pieces in the mesh, when more than one; the oriented box then describes the largest. */
  bodyCount?: number;
  /**
   * Planar elements (walls, slabs, coverings, plates): area of the mesh faces on each side of the
   * thin axis, openings already cut. `a` faces along `axis` (up for slabs), `b` against it.
   */
  sides?: { axis: Vec3; a: number; b: number };
  /** Where a room's surface lies on a side of this element: contact area per space (m2). */
  contacts?: { spaceId: string; side: "a" | "b"; area: number }[];
  /** Solids this element shares volume with (m3), from the overlap check (columns through slabs,
   *  beams in walls, clashes). Only between overlap-checked classes; absent when the check is off. */
  intersections?: { elementId: string; volume: number }[];
  /** Spaces: the surfaces of the room solid (m2, m). */
  room?: { floorArea: number; ceilingArea: number; wallArea: number; perimeter: number; height: number };
  /** Face winding was inconsistent and repaired before measuring. */
  normalsRepaired?: boolean;
  volumeBeforeRepair?: number;
  /** Set when geometry could not be generated. */
  error?: string;
}

export interface ParsedElement {
  id: string;                       // GlobalId
  stepId: number;                   // #id in the IFC file (debugging only, not stable)
  ifcClass: string;                 // as in the file, e.g. IfcWallStandardCase
  ifcClassBase: string;             // normalised for IFC2x3 StandardCase classes, e.g. IfcWall
  predefinedType?: string;
  objectType?: string;
  name?: string;                    // raw, e.g. "Basic Wall:Exterior - Brick on Block:138405"
  description?: string;
  tag?: string;                     // authoring-tool id, e.g. Revit element id

  /* ---- references (convenience copies of canonical relationships) ---- */
  typeId?: string;
  containerId?: string;             // spatial node directly containing it
  storeyId?: string;                // resolved storey (through parents if needed)
  parentId?: string;                // aggregate parent (roof, stair, curtain wall)
  childIds: string[];
  hostId?: string;                  // for doors/windows: the element whose opening they fill
  openingIds: string[];             // openings cut into this element
  fillsOpeningId?: string;
  systemIds: string[];
  materialRef?: MaterialRef;
  classificationIds: string[];

  /* ---- data ---- */
  /** Direct IFC attributes worth keeping, e.g. OverallWidth / OverallHeight on doors. */
  attributes: Record<string, Scalar>;
  psets: Record<string, Record<string, PropValue>>;
  /** Properties inherited from the type, kept separately so origin is visible. */
  typePsets: Record<string, Record<string, PropValue>>;
  quantities: {
    reported: ReportedQuantities;
    geometry: GeometryInfo;
  };
  placement?: { origin: Vec3; xAxis?: Vec3; zAxis?: Vec3 };
  profileId?: string;               // for extruded linear elements
}

/** IfcOpeningElement / voids: not physical, but needed for deductions. */
export interface ParsedOpening {
  id: string;
  hostId?: string;
  fillingId?: string;
  fillingClass?: string;
  predefinedType?: string;          // OPENING, RECESS
  width?: number;
  height?: number;
  depth?: number;
  area?: number;                    // width x height of the opening face
  volume?: number;
  bboxMin?: Vec3;
  bboxMax?: Vec3;
  reported: ReportedQuantities;
}

/* ============================================================================
 * Relationships (canonical list; element fields above are convenience copies)
 * ========================================================================== */

export type Relationship =
  | { kind: "contains"; containerId: string; elementIds: string[] }
  | { kind: "aggregates"; parentId: string; childIds: string[] }
  | { kind: "nests"; parentId: string; childIds: string[] }
  | { kind: "voids"; hostId: string; openingId: string }
  | { kind: "fills"; openingId: string; elementId: string }
  | { kind: "defines_type"; typeId: string; elementIds: string[] }
  | { kind: "space_boundary"; spaceId: string; elementId: string; physical?: boolean; external?: boolean; level?: "1st" | "2nd" | "2a" | "2b" }
  | { kind: "connects"; elementIds: [string, string]; connectionType?: string }
  | { kind: "assigned_to_system"; systemId: string; elementIds: string[] }
  | { kind: "assigned_to_group"; groupId: string; elementIds: string[] }
  | { kind: "covers"; elementId: string; coveringIds: string[] }      // IfcRelCoversBldgElements
  | { kind: "space_covered"; spaceId: string; coveringIds: string[] }; // IfcRelCoversSpaces / IfcRelContainedInSpatialStructure

/* ============================================================================
 * Verification: what the engine found while parsing
 * ========================================================================== */

export type CheckCode =
  | "volume_mismatch"           // reported vs geometry differs beyond tolerance
  | "area_mismatch"
  | "inconsistent_winding"      // mesh faces flipped; repaired
  | "not_watertight"
  | "no_geometry"
  | "geometry_error"
  | "overlap"                   // two solids intersect (possible double counting)
  | "no_material"
  | "duplicate_material_name"   // two materials normalise to the same thing
  | "flag_conflict"             // e.g. IsExternal contradicts context
  | "placeholder_value"         // e.g. InstallationDate = "InstallationDate"
  | "no_quantities"             // no BaseQuantities / Qto sets in the file
  | "unassigned_storey"
  | "proxy_element";            // IfcBuildingElementProxy: unknown object

export interface Check {
  id: string;
  code: CheckCode;
  severity: "info" | "warning" | "error";
  elementIds: string[];
  message: string;
  data?: Record<string, Scalar>;
}

export interface Verification {
  /** Relative tolerance used for reported vs geometry comparisons. */
  tolerance: number;
  checks: Check[];
  summary: Partial<Record<CheckCode, number>>;
}

/* ============================================================================
 * Geometry store
 * ========================================================================== */

export interface GeometryStore {
  format: "glb" | "fragments" | "obj";
  /** Path or URL relative to the parsed model, e.g. "geometry.glb". */
  uri: string;
  /** How meshRef values map into the store. */
  addressing: "node_name";
  worldCoordinates: true;
}

/* ============================================================================
 * The document
 * ========================================================================== */

export interface ParsedModel {
  schemaVersion: "1.0";
  header: Header;
  spatial: SpatialNode[];
  catalogues: Catalogues;
  elements: ParsedElement[];
  openings: ParsedOpening[];
  relationships: Relationship[];
  verification: Verification;
  geometry?: GeometryStore;
  stats: {
    elementCount: number;
    openingCount: number;
    spaceCount: number;
    byClass: Record<string, number>;
  };
}
