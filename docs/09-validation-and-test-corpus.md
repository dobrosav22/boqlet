# 09 Validation and test corpus

Two separate questions: does the engine **work** on varied real files (the corpus), and is its
output **right** (the answer key). Answer keys in hand: the Duplex (Revit 2011) with a hand-made
BoQ, and the buildingSMART certification samples checked against their own quantity sets and
cross-schema agreement. Corpus: 309 public files from 30 tools run without engine errors
(listed, tagged and statused in `12-ifc-corpus-catalogue.md`). No professional BoQ yet.

## The Duplex experiment

The first thing done in the project: a full BoQ generated from a real IFC to see how the logic
works in practice. The approach worked; the data problems it uncovered were the most valuable
result. The prototype scripts are in `docs/reference/prototype-2026-10/`; their workbook is
`fixtures/reference/duplex-hand-boq.xlsx` (every quantity a live formula over an element
register, with QA and parameter sheets).

### The file (`fixtures/ifc/Ifc2x3_Duplex_Architecture.ifc`)

| Property | Value |
|---|---|
| Origin | NIBS / GSA sample duplex (public), US context (Chicago address, GSA areas, OmniClass codes) |
| Authoring tool | Autodesk Revit Architecture 2011 |
| Schema | IFC2x3, Coordination View |
| Size | 2.4 MB, about 39k lines |
| Units | metres, m2, m3 |
| Storeys | T/FDN (-1.25), Level 1 (0.00), Level 2 (+3.10), Roof (+6.00) |
| Content | 218 physical elements + 21 spaces: 57 walls, 21 slabs, 13 ceilings (coverings), 8 steel beams, 7 footings, 24 windows, 14 doors, 2 stairs, 4 railings, 1 roof, 61 furnishings; 50 openings |
| Quantities | **No IFC BaseQuantities.** Only Revit's `PSet_Revit_Dimensions` (Length, Area, Volume, Perimeter) and GSA space areas |
| Materials | 18 materials, 15 layer sets |

Because there were no standard quantities, Revit's numbers were treated as claims and every
element was re-measured from geometry.

### What verification found

About 95% of elements matched Revit to three decimals. The exceptions:

| Finding | Detail | Decision (now encoded in the engine) |
|---|---|---|
| Main party wall: geometry 433 m3 vs reported 25.83 m3 | Exported as a surface model with inconsistent face winding | Normals repaired before measuring; repaired volume 25.830 m3 matches exactly (`inconsistent_winding` check) |
| Party wall stub: geometry +42% | Two 0.379 m3 overlaps with neighbouring walls at T-junctions | Reported (join-aware) value adopted; geometry minus overlaps within about 4% (`volume_mismatch`, `overlap` checks; adoption policy) |
| Revit wall Area inconsistent with Volume on 7 walls | Level 2 exterior walls differ by about 1.2 m2 each, matching two 819 x 759 windows deducted from Volume but not Area; party walls differ 1.2-8.6 m2 | All walls measured as Volume / thickness |
| Steel beams: geometry 3.5-4.7% over reported | Section geometry vs Revit volume | Steel as length x nominal kg/m from the section name (W310X60 = 60 kg/m); volume x density as cross-check |
| Ceilings 187462 / 187470 overlap | About 3.2 m2 of ceiling modelled twice (0.18 m3) | Flagged, not auto-corrected |
| Other overlaps about 0.9 m3 | Beam bearings in brick walls, partitions through the joist floor, ceilings clipping walls | Normal modelling tolerance |
| Party wall `IsExternal = TRUE` | It divides the two units | Classified internal by its dictionary type |
| Skylights `IsExternal = FALSE` | | Logged |
| Space B105 named "Room" while twin A105 is "Stair" | | Name question |
| `PSet_Revit_Other` full of placeholders (InstallationDate = "InstallationDate") | | `placeholder_value` check |
| "Concrete" and "Concrete - Cast In Situ" | Two names, one material | `duplicate_material_name` check; both resolve to concrete terms |
| Footings and stair stringers without material | | `no_material` check; footings assumed concrete from the type name in the prototype |
| Not in the model | MEP, reinforcement, skirtings, sills, ironmongery, external works beyond two slabs | Out of scope or derived/manual |

Lesson: surface-model winding and junction overlaps are invisible unless geometry is measured
independently of the authoring tool's numbers. Every item above is the kind of thing the review
step must surface.

### The hand-made BoQ (prototype, as modelled, NRM1-like grouping)

| Ref | Description | Unit | Qty |
|---|---|---|---|
| 1.01 | In-situ concrete strip footings 900 x 300 | m3 | 16.53 |
| 1.02 | Formwork to sides of footings (derived) | m2 | 37.02 |
| 1.03 | Concrete foundation walls 417 mm | m3 | 26.86 |
| 1.04 | Concrete foundation walls 435 mm | m3 | 5.43 |
| 1.05 | Formwork to foundation walls, both faces (derived) | m2 | 153.80 |
| 1.06 | Concrete ground slab 127 mm | m3 | 16.47 |
| 1.07 | Ground slab surface area | m2 | 129.69 |
| 1.08 | Edge formwork to ground slab (derived) | m2 | 8.78 |
| 2.1.1 | Steel beam W310x60 | t | 0.903 |
| 2.1.2 | Steel beam W410x60 | t | 1.728 |
| 2.2.1 | Timber joist upper floor, 305 mm | m2 | 118.56 |
| 2.3.1 | Flat green roof on timber joists, 457 mm | m2 | 132.93 |
| 2.3.2 | Roof light 1180 x 1170 | nr | 2 |
| 2.4.1 | Stair, 16 risers, 1000 mm wide | nr | 2 |
| 2.4.2 | Handrail 900 mm high | m | 9.49 |
| 2.4.3 | Guard rail 1100 mm high | m | 16.67 |
| 2.5.1 | Brick-on-block cavity wall, 417 mm | m2 | 235.78 |
| 2.5.2 | Ditto, parapet above roof | m2 | 31.38 |
| 2.6.1-2.6.5 | Windows (5 types) | nr | 2 / 4 / 4 / 8 / 4 |
| 2.6.6-2.6.7 | External doors (2 types) | nr | 2 / 2 |
| 2.7.1 | Party wall, 550 mm | m2 | 71.67 |
| 2.7.2 | Partition, 92 mm stud | m2 | 106.40 |
| 2.7.3 | Plumbing wall, 152 mm stud | m2 | 9.39 |
| 2.7.4 | Wall lining, 136 mm stud | m2 | 58.56 |
| 2.7.5 | Wall lining, 38 mm stud | m2 | 2.56 |
| 2.8.1-2.8.2 | Internal doors (2 types) | nr | 4 / 6 |
| 3.1.1 | Paint to plasterboard walls (derived) | m2 | 703.19 |
| 3.2.1 | Timber floor finish | m2 | 196.92 |
| 3.2.2 | Ceramic floor tiling | m2 | 44.91 |
| 3.3.1 | Suspended plasterboard ceiling | m2 | 243.46 |
| 3.3.2 | Paint to ceilings (derived) | m2 | 243.46 |
| 4.1.x | Fixed fittings (7 types) | nr | 43 total |
| 4.2.x | Loose furniture, for information (5 types) | nr | 18 total |
| 8.1 | External concrete slab 150 mm | m3 | 7.63 |
| 8.2 | External slab surface area | m2 | 50.84 |
| 8.3 | Edge formwork to external slab (derived) | m2 | 6.11 |

Room schedule: net internal area 141.79 m2 (Level 1) + 134.53 m2 (Level 2) = 276.32 m2 (roof
space excluded). Changing the opening add-back threshold to 1.0 m2 raised 2.5.1 from 235.78 to
243.24 m2.

## Acceptance test (`engine/tests/test_duplex.py`)

The engine with `as-modelled`, `global-seed` and `acme-cost-codes` must reproduce the hand-made
numbers. `HAND_BOQ` lists them as (rule id, description fragment, expected, unit); for example
footings 16.528 m3, foundation walls 26.861/0.417 and 5.430/0.435 m2 (the engine measures walls
in m2 by default; the m3 switch is a slot), steel 0.903 t and 1.728 t, external brick wall
235.779 + 31.383 m2, party wall 71.670 m2, formwork to walls 153.797 m2, formwork to footings
37.019 m2, paint 703.185 m2, and counts per window and door type. All pass.

Also tested: every line explained (formula and contributions present), every line coded, party
wall internal by dictionary type, slot change changes numbers, custom rules plus trade
classification, unmatched decision assigns a rule, standard-style and ACME presets run, unknown
material blocks until answered, and the engine's output and parsed model validate against the
TypeScript-generated schemas.

**Important caveat:** this proves the engine reproduces our own hand measurement of one file.
It does not prove professional accuracy (gap 6) or robustness on other tools.

## The buildingSMART certification samples (2026-10)

Source: [buildingSMART/Certification-datasets](https://github.com/buildingSMART/Certification-datasets)
(CC BY 4.0), the public files used for buildingSMART's IFC import certification. 35 files:

| Set | Files | Notes |
|---|---|---|
| Simple-Scene, IFC2x3 / IFC4 / IFC4.3 | 10 per schema: Building-Architecture, -Structural, -Hvac, -Landscaping; Infra-Bridge, -Road, -Rail, -Plumbing, -Electrical, -Landscaping | One scene (a house on a site, a road, a railway, two bridges) exported by **SketchUp 2026 + Sketchup-IFC-manager 5.6.0** to all three schemas. IFC2x3 uses faceted Breps; IFC4 and IFC4.3 use triangulated face sets. Lengths in mm, areas and volumes in m2 / m3. Some files carry `Qto_*BaseQuantities`. Infrastructure is real IFC4.3 (IfcBridge, IfcRoad, IfcRailway, IfcCourse, IfcEarthworksFill, IfcRail, IfcTrackElement, IfcSurfaceFeature); IFC2x3 and IFC4 flatten it to IfcBuilding and proxies |
| ISO Spec, Reference View 1.2 (IFC4) | 5 small hand-written examples | A wall with an opening and a window, an inch-unit tessellated column, tessellation samples |

Valid files and a good test of **schemas**: the same element can be compared across three
schemas and two geometry types. **Not** a test of tool variety: one exporter made all the scene
files. Subset in `fixtures/ifc/buildingsmart/`; pinned by `engine/tests/test_certification_samples.py`.
Re-run the whole set with `npm run corpus -- <clone>/` after an engine change.

### What the samples found

| Finding | Effect before | Decision (now in the engine) |
|---|---|---|
| ISO wall file: the geometry kernel misses the mm unit and returns raw millimetres as metres | Wall 5,000,000,000 m2 | Geometry requested in file units and scaled with the parser's own factor (`convert-back-units`) |
| Tessellated exports leave T-junctions: meshes geometrically closed but not watertight | Footing and wall volumes rejected as "unreliable"; footing became a blocking `missing_data` question | `closed` = watertight or every boundary loop has ~zero vector area; an open pipe end or missing face still fails. Volume matches the IFC2x3 Brep exactly |
| IfcRoof with no geometry, made of slabs (architecture) or timber girders and beam shoes (structure) | Roof line flagged; its parts skipped as "parent measured", so 53.6 m2 of roof slabs and 24.7 m of girders vanished | Measure: a body-less aggregate takes its parts' volume and planar area. Rules: a parent counts as measured only if a rule gets a value for it; otherwise its parts are measured |
| Walls, girders, railings rotated in plan; sloped arch members; squat bridge piers | Thickness 10.39 m (plan diagonal); lengths 12% short; column length = plan width | Oriented bounding box (numpy, no scipy) on the largest body; columns along the vertical axis |
| IFC2x3 MEP: IfcFlowSegment typed by IfcDuctSegmentType, IfcFlowTerminal by IfcAirTerminalType | Unmatched in IFC2x3, measured in IFC4: same model, different BoQ | Class taken from the type (`ifc_class`; `ifc_class_raw` keeps the original); family found by walking supertypes |
| `mep-items` depended on the file's discipline guess; IFC4.3 guessed "infrastructure" for a house (IfcBuilding is an IfcFacility) | Air terminals, manholes, charging station never counted | Discipline per element ("mep" for distribution elements); infrastructure guessed from IfcBridge / IfcRoad / IfcRailway / IfcMarineFacility only |
| `partFilter` was ignored when deciding that a parent is measured | Bridge piers and track panels (IfcElementAssembly, counted as "countable") hid all their parts: 65 of 68 elements unmatched | `partFilter` applies; IfcElementAssembly is family `assembly`; an assembly whose parts are all measured counts as covered |
| Placement markers "origin" and "geo-reference" and zone volumes are proxies with `virtual_*` materials | Counted as unknown objects; in an MEP file also as MEP items (double count) | Dictionary term `non_physical`; as-modelled excludes them (`include_non_physical`, default off); `mep-items` no longer takes proxies |
| Material names in `category_subtype_detail` form (`concrete_reinforced_in-situ`, `metal_steel-galvanized`) | Nothing resolved: `\bconcrete\b` does not match before `_`. Every file blocked | Regex entries also tried with `_` as a separator; seed terms for calcium silicate, stone, soil, topsoil, aggregate, bituminous, planting, generic metal, grout, precast / in-situ concrete |
| No perimeter outside Revit | Slab edge formwork flagged | Perimeter of a closed slab-like prism: P = (S - 2V/t) / t |
| No rules for IfcCourse, IfcEarthworksFill, IfcRail, IfcSurfaceFeature, IfcTrackElement, IfcSign, IfcGeographicElement, IfcChimney, IfcDiscreteAccessory | Road: 1 of 55 elements measured; rail: 1 of 75 | as-modelled items `earthworks-modelled` (m3), `courses` and `surface-features` (m2; open surface models by mesh area), `kerbs-rails` (m), `other-components` (nr); ACME codes J.02, L.01-L.04 |
| Classification references on the type only | Lost | Inherited by occurrences |
| Elements on a site or in a bridge / road part reported as "no storey" | Noise on every infrastructure element | `unassigned_storey` only inside a building |

Result on all 35 files: no crashes, every ParsedModel and BoqResult valid against the schemas.
The house measures the same in IFC2x3, IFC4 and IFC4.3 for every class all three schemas have.
IFC4.3 road: 52 of 55 elements measured (was 1); rail 72 of 75 (was 1); bridge 47 of 50 (was 40, with wrong lengths).

### Still open (see 11)

- **Federation duplicates.** The discipline models share GUIDs: the chimney is a body-less placeholder in
  Architecture and HVAC and a solid in Structural; the roof aggregates slabs in Architecture and timber in
  Structural under one GUID; manholes appear in Electrical and Plumbing; the marker assemblies are empty
  in four models and filled in Landscaping. Each file alone is measured correctly; a federated BoQ must merge by GUID.
- **Placeholder material names** ("Default") and genuinely ambiguous ones (`composite_element_roof`,
  `bulk-material_water_surfacewater`) still block. That is the intended behaviour; a `placeholder_material` check would explain it better.
- **IFC2x3 / IFC4 infrastructure** arrives as proxies, IfcBuilding, and IfcElementAssembly used as a solid
  (road shoulders with a body and no parts): counted as unknown objects or left as `unmatched` questions,
  which is the intended behaviour. Only IFC4.3 carries the classes.
- **Terrain and planting** (IfcGeographicElement) are counted; area or volume for grass and soil needs a site-works rule set.
- **Location** of infrastructure lines: no storey; facility parts (IfcBridgePart, IfcRoadPart) are not used as a location yet.
- Values in this corpus are checked against the files' own quantity sets, cross-schema agreement and hand-written geometry, **not** a professional BoQ.

## Test corpus plan

About 15-20 varied IFC files give relative confidence in a working engine; 2-3 projects with a
professional BoQ prove accuracy. **Variety beats volume**: 50 Revit files teach less than 10
from different tools. Live tracking: `docs/reference/files/IFC_Test_Corpus_Plan.xlsx`.

### Dimensions to cover

| Dimension | Why | Minimum |
|---|---|---|
| Authoring tool | Each exports materials, quantities, geometry and names differently | Revit, Archicad, Tekla, one of Allplan / Vectorworks / BricsCAD, one native-IFC tool (Bonsai or FreeCAD) |
| IFC version | Different storage of quantities and materials | IFC2x3 and IFC4 (IFC4.3 for infrastructure) |
| Exporter age | A 2011 Revit export differs greatly from a current one | One old, several current |
| Discipline | Architecture, structure, MEP stress different logic | All three, ideally from one project |
| Building type | Timber residential vs concrete multi-storey vs steel hall | 3 types |
| Model quality | Clean samples hide real-world mess | At least 2 messy real files |
| Export settings | Same model, base quantities on/off, split differently | 1 model exported 2-3 ways |

### The 21-file plan

| # | Purpose | Tool | IFC | Discipline | Tier | Suggested source | Status |
|---|---|---|---|---|---|---|---|
| 1 | Old Revit export baseline | Revit 2011 | 2x3 | Arch | Minimum | NIBS Duplex | **Have** |
| 2 | Modern Revit export | Revit current | 4 | Arch | Minimum | buildingSMART samples or own export | **Run** (Revit 2015/2019/2021 IFC4 from OpenIFC; no Revit 2022+ yet) |
| 3 | Archicad architecture | Archicad | 2x3 | Arch | Minimum | Schependomlaan (verify tool) | **Run** (Schependomlaan design model is Archicad 18; KIT and FZK houses Archicad 9-11) |
| 4 | Archicad, newer schema | Archicad | 4 | Arch | Confident | Firm or vendor | **Run** (Archicad 20 and 23, IFC4, OpenIFC) |
| 5 | Structural concrete with rebar | Tekla | 4 | Struct | Minimum | Tekla sample / firm | Partial (Tekla concrete in Schependomlaan precast; no modelled rebar seen) |
| 6 | Structural steel | Tekla | 2x3 | Struct | Confident | Tekla sample / firm | **Run** (Tekla 12-2020, IFC2x3, OpenIFC and Schependomlaan) |
| 7 | Revit structure | Revit current | 4 | Struct | Confident | NIBS Office set | **Run** (NBU Office and Clinic structure, Hospital structure; Revit 2011-2015) |
| 8 | Installations | Revit MEP | 2x3 | MEP | Confident | NIBS Office or Clinic | **Run** (NBU Duplex / Clinic MEP, Revit MEP 2011-2013; also MagiCAD and DDS-CAD) |
| 9 | Allplan export | Allplan | 4 | Arch / precast | Confident | Firm or vendor | Partial (Allplan 2003-2008, IFC2x3 only) |
| 10 | Secondary BIM tool | Vectorworks or BricsCAD | 4 | Arch | Confident | Vendor | Partial (Vectorworks 2010-2018, IFC2x3 only) |
| 11 | Native-IFC authoring | Bonsai | 4 | Arch | Minimum | Self-made / community | Missing |
| 12 | Open-source alternative | FreeCAD | 4 | Arch | Optional | Self-made | Missing |
| 13 | Federated set, same project | Revit mixed | 2x3 | Arch + Struct + MEP | Minimum | NIBS Office set | **Run** (NBU Office Building and Medical Clinic sets; LTU A-House) |
| 14 | Federated set, real project | Mixed tools | 2x3 / 4 | Arch + Struct | Confident | Firm partnership | **Run** (Schependomlaan: Archicad, Tekla, HiCAD, Revit, SketchUp, Xella) |
| 15 | Messy real architecture | Any | Any | Arch | Confident | Firm partnership | Partial (Schependomlaan subcontractor models; DURAARK projects) |
| 16 | Messy real structure | Any | Any | Struct | Confident | Firm partnership | Partial (Schependomlaan Tekla and HiCAD models) |
| 17 | Export-settings robustness | Revit current | 4 | Arch | Confident | Own exports x3 | Partial (Lakeside exported from Archicad, Revit and Vectorworks; Solibri-optimised variants) |
| 18 | Infrastructure schema | Civil 3D / other | 4.3 | Infra | Optional | buildingSMART samples | **Have** (SketchUp, simple scene; a Civil 3D or other road tool still missing) |
| 19-21 | Accuracy references A, B, C | Any | Any | Residential, commercial, other | Accuracy | Firm partnership + professional BoQ | Missing |
| 22 | Same model in three schemas | SketchUp + IFC-manager | 2x3 / 4 / 4.3 | Arch, struct, MEP, infra | Confident | buildingSMART Certification-datasets | **Have** |

Status: **Have** = in hand with checked quantities; **Run** = public files the engine ran on with
schema-valid output, quantities not checked (file by file in `12-ifc-corpus-catalogue.md`);
Partial = only some of the purpose is covered.

Tiers: Minimum (about 6 files) proves the engine is not tied to one tool; Minimum + Confident
(about 16) gives relative confidence; Accuracy (3) is a separate requirement.

### Free starting sources

- buildingSMART Sample-Test-Files (GitHub): official files across IFC versions, incl. IFC4.3.
- NIBS / COBie sample buildings: Duplex, Office, Clinic; some with structural and MEP files usable as federated sets.
- Schependomlaan dataset (GitHub): real Dutch residential project, several disciplines.
- Own exports; self-made Bonsai or FreeCAD models.
- Firm partnerships: the only source of messy real files and professional BoQs.

After that, confidence grows through real user files: every new exporter quirk becomes a repair
rule or a `quantity_sources.json` entry, with a test.

## Adding a fixture

1. Put the IFC in `fixtures/ifc/` (check its licence allows redistribution; otherwise keep it out
   of git and document where to get it).
2. Run `npm run corpus -- <folder> --out <dir>` for the summary, then generate with as-modelled and read
   the parse checks and the measure log for warnings.
3. Fix exporter quirks in `parse.py` / `measure.py` / `data/quantity_sources.json`.
4. Add a test module with the numbers you have verified independently (geometry, the authoring
   tool's schedules, or a professional BoQ). Never write expected values by copying the engine's
   own output.
