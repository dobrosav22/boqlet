/**
 * Element families — every IFC element is measured in one of a few ways.
 *
 * This is the "element matrix": which IFC classes exist, which family each
 * belongs to, and which quantity kinds make sense for it. The rule editor uses
 * it to offer only valid options; the engine uses it as a default when a rule
 * does not say otherwise. Rule sets may still measure any element any way.
 *
 * Covers IFC2x3, IFC4 and IFC4.3. IFC2x3 "StandardCase" classes are normalised
 * to their parent (IfcWallStandardCase -> IfcWall) before rules run.
 */

import type { QuantitySpec } from "./rules";

export type ElementFamily =
  | "linear"         // measured along a length: beams, pipes, railings, kerbs
  | "planar"         // measured by area: walls, slabs, roofs, coverings
  | "volumetric"     // measured by volume: footings, piles, earthworks
  | "countable"      // measured by number: doors, windows, fixtures, fittings
  | "reinforcement"  // measured by mass or length: bars, meshes, tendons
  | "assembly"       // made of parts: stairs, ramps, roofs, curtain walls
  | "space"          // rooms and zones: areas, perimeters, volumes for finishes
  | "void";          // openings: never measured themselves, deducted from hosts

type Kind = QuantitySpec["kind"];

export interface FamilyInfo {
  /** Quantity kinds that make sense for this family. */
  kinds: Kind[];
  /** Default quantity kind when a rule omits one. */
  default: Kind;
  /** Breakdowns that make sense. */
  breakdowns: ("element" | "layer" | "face" | "material" | "child")[];
}

export const FAMILY_INFO: Record<ElementFamily, FamilyInfo> = {
  linear:        { kinds: ["length", "count", "mass", "volume", "area"], default: "length", breakdowns: ["element", "material"] },
  planar:        { kinds: ["area", "volume", "count", "perimeter"],      default: "area",   breakdowns: ["element", "layer", "face", "material"] },
  volumetric:    { kinds: ["volume", "area", "count", "mass"],           default: "volume", breakdowns: ["element", "layer", "material"] },
  countable:     { kinds: ["count", "area", "length", "perimeter"],      default: "count",  breakdowns: ["element"] },
  reinforcement: { kinds: ["mass", "length", "count", "area"],           default: "mass",   breakdowns: ["element"] },
  assembly:      { kinds: ["count", "area", "length", "volume"],         default: "count",  breakdowns: ["element", "child"] },
  space:         { kinds: ["area", "perimeter", "volume", "count"],      default: "area",   breakdowns: ["element", "face"] },
  void:          { kinds: [],                                            default: "count",  breakdowns: [] },
};

/** IFC class -> default family. Subtypes inherit unless listed. */
export const IFC_FAMILIES: Record<string, ElementFamily> = {
  /* ---- building elements ---- */
  IfcWall: "planar",
  IfcCurtainWall: "assembly",
  IfcSlab: "planar",            // FLOOR, ROOF, LANDING, BASESLAB via predefined_type
  IfcRoof: "assembly",
  IfcCovering: "planar",        // CEILING, FLOORING, CLADDING, ROOFING, INSULATION, MEMBRANE...
  IfcPlate: "planar",
  IfcBeam: "linear",
  IfcColumn: "linear",
  IfcMember: "linear",          // studs, rafters, stringers, mullions
  IfcRailing: "linear",
  IfcFooting: "volumetric",
  IfcPile: "volumetric",
  IfcChimney: "volumetric",
  IfcStair: "assembly",
  IfcStairFlight: "countable",
  IfcRamp: "assembly",
  IfcRampFlight: "planar",
  IfcDoor: "countable",
  IfcWindow: "countable",
  IfcShadingDevice: "countable",
  IfcBuildingElementProxy: "countable", // unknown: always worth a review question
  IfcBuildingElementPart: "planar",

  /* ---- components & reinforcement ---- */
  IfcReinforcingBar: "reinforcement",
  IfcReinforcingMesh: "reinforcement",
  IfcTendon: "reinforcement",
  IfcTendonAnchor: "countable",
  IfcFastener: "countable",
  IfcMechanicalFastener: "countable",
  IfcDiscreteAccessory: "countable",
  IfcVibrationIsolator: "countable",

  /* ---- furnishing, transport, geographic ---- */
  IfcFurnishingElement: "countable",
  IfcFurniture: "countable",
  IfcSystemFurnitureElement: "countable",
  IfcTransportElement: "countable",   // lifts, escalators
  IfcGeographicElement: "countable",  // trees, terrain features

  /* ---- MEP: segments (by length and size) ---- */
  IfcPipeSegment: "linear",
  IfcDuctSegment: "linear",
  IfcCableSegment: "linear",
  IfcCableCarrierSegment: "linear",
  IfcFlowSegment: "linear",

  /* ---- MEP: fittings, terminals, equipment (by count, type and size) ---- */
  IfcPipeFitting: "countable",
  IfcDuctFitting: "countable",
  IfcCableFitting: "countable",
  IfcCableCarrierFitting: "countable",
  IfcJunctionBox: "countable",
  IfcFlowFitting: "countable",
  IfcFlowTerminal: "countable",       // sanitary, air terminals, lights, outlets...
  IfcFlowController: "countable",     // valves, dampers, switches
  IfcFlowMovingDevice: "countable",   // pumps, fans
  IfcFlowStorageDevice: "countable",  // tanks
  IfcFlowTreatmentDevice: "countable",
  IfcEnergyConversionDevice: "countable", // boilers, chillers, heat pumps
  IfcDistributionControlElement: "countable", // sensors, alarms, controllers
  IfcDistributionChamberElement: "countable", // manholes, pits

  /* ---- IFC4.3 infrastructure ---- */
  IfcEarthworksCut: "volumetric",
  IfcEarthworksFill: "volumetric",
  IfcReinforcedSoil: "volumetric",
  IfcCourse: "planar",               // pavement layers: area or volume
  IfcPavement: "planar",
  IfcKerb: "linear",
  IfcRail: "linear",
  IfcTrackElement: "countable",
  IfcBearing: "countable",
  IfcDeepFoundation: "volumetric",
  IfcCaissonFoundation: "volumetric",
  IfcSign: "countable",
  IfcSignal: "countable",

  /* ---- spatial & voids ---- */
  IfcSpace: "space",
  IfcZone: "space",
  IfcOpeningElement: "void",
  IfcVoidingFeature: "void",
};
