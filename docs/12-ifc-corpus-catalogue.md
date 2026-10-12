# 12 IFC corpus catalogue

Every public IFC file looked at so far, grouped by source and project, tagged from its STEP
header and, where it was run, with what the engine made of it. Generated from
`fixtures/corpus/catalogue.json` by `npm run catalogue`; edit the JSON, not this page.
Last update: 2026-10-12. How the corpus is used: `09-validation-and-test-corpus.md`.

**Tags.** `schema` from FILE_SCHEMA; `view` from the ViewDefinition in FILE_DESCRIPTION; `tool` and
`version` from IFCAPPLICATION, else FILE_NAME (file names are not trusted: the Lakeside file named
RVT is a Vectorworks export and the one named VW is Revit); `exported` from the FILE_NAME time stamp;
`discipline` from the file name, else the engine's guess.

**Status.**

| Status | Meaning |
|---|---|
| tested: complete | Parsed and run (as-modelled, global-seed, acme-cost-codes; no overlap check); both outputs valid against the contract schemas; no blocking question |
| tested: needs input | Same, but a blocking question is open (usually an unknown material name). The engine worked; the dictionary did not know a name |
| engine error / engine timeout | The engine failed or took over 15 minutes. A bug to look at |
| invalid | Not readable: STEP syntax errors, or not a STEP file (Git LFS pointer, HTML) |
| unsupported schema | IFC2x2 and older; ifcopenshell (and so the engine) reads IFC2x3, IFC4 and IFC4.3 only |
| header only | Tagged from its header, not run (over the size cap, or not downloaded) |
| unavailable | Listed somewhere but the link is dead |

Tested means *the engine runs on it and the output is well formed*, not that the quantities were
checked. Quantities are checked only for the Duplex and the buildingSMART samples (`09`).

## Summary

| Source | Files | tested: complete | tested: needs input | engine error | engine timeout | invalid | unsupported schema | header only | unavailable |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| buildingSMART Certification-datasets | 35 | 22 | 13 |  |  |  |  |  |  |
| buildingSMART IFC4.x-specification-models | 46 | 46 |  |  |  |  |  |  |  |
| DURAARK (TIB), listed by BIMData | 86 | 18 | 24 |  |  | 4 | 13 | 27 |  |
| OpenIFC Model Repository (Univ. of Auckland) | 172 | 36 | 65 |  |  | 1 | 34 | 35 | 1 |
| Schependomlaan (openBIMstandards, archive) | 94 | 20 | 65 |  |  |  |  | 9 |  |
| BIMData list: source unavailable | 16 |  |  |  |  |  |  |  | 16 |
| **All** | **449** | **142** | **167** |  |  | **5** | **47** | **71** | **17** |

## Coverage by tool and schema

Each cell is *tested / readable*: files the engine ran on, out of files with a header it can read
(IFC2x3 or newer). Older-schema files are counted in the last column. Sorted by files tested.

| Tool | Versions seen | IFC2x3 | IFC4 | IFC4.3 | Pre-IFC2x3 (unsupported) |
|---|---|---:|---:|---:|---:|
| Archicad | 10.0, 11.0, 16.0, 18.0, 19.0, 20.0, 22.0, 23.0 (+5) | 44 / 48 | 2 / 4 |  | 16 |
| hand-written specification example |  |  |  | 46 / 46 |  |
| Revit | 2011, 2012, 2013, 2014, 2015, 2019, 2020, 2021 (+2) | 33 / 57 | 12 / 21 |  |  |
| SketchUp | 2015, 5.6.0 | 10 / 12 | 10 / 10 | 10 / 10 |  |
| Xella exporter | 1.4.0.1, 1.4.0.3, 5.7.0.2 | 28 / 28 |  |  |  |
| Tekla Structures | 12.0, 18.1, 19.1 Service Release 5, 20.0, 20.1 Service Release 1, 20.1 Service Release 3, 2016i, 2017 Service Pack 10 (+8) | 23 / 27 |  |  |  |
| unknown |  | 20 / 23 |  |  | 1 |
| DDS-CAD | 6.35, 6.40, 6.41, 6.5, 7.1, 7.2, 8.0 | 11 / 16 |  |  | 3 |
| Allplan | 2003.1, 2006, 2006.1, 2008 | 7 / 7 |  |  | 1 |
| Bentley TriForma |  | 7 / 7 |  |  |  |
| Revit Building | 8, 9, 9.1 | 6 / 6 |  |  | 3 |
| AutoCAD Architecture | 2009, 2014 | 5 / 5 |  |  |  |
| Vectorworks | 2010, 2010 SP4, 2013, 2018 SP1 | 5 / 6 |  |  |  |
| Revit MEP | 2011, 2013 | 4 / 10 |  |  |  |
| IFC Engine DLL (test app) | 0.10 | 2 / 2 | 1 / 1 |  |  |
| VDI3805 viewer | 2.0 | 3 / 3 |  |  |  |
| BIMserver COBie |  | 2 / 3 |  |  |  |
| Geometry Gym (Rhino) | 1.0.0.0 |  | 2 / 2 |  |  |
| MagiCAD | 2013, 2015 | 2 / 8 |  |  |  |
| Renga | 4.1, 4.3, 4.5 |  | 2 / 3 |  |  |
| Scia Engineer | 2008 | 2 / 2 |  |  |  |
| SDS/2 |  | 2 / 2 |  |  |  |
| Autodesk Fabrication | 5.5.201.0 | 1 / 1 |  |  |  |
| Constructivity | 0.9 |  | 1 / 1 |  |  |
| Edificius | BIM 2(m) | 1 / 1 |  |  |  |
| EliteCAD | 2008 | 1 / 1 |  |  |  |
| IFC text editor | 1.0 |  | 1 / 1 |  |  |
| SteelVis (CIS/2 translator) | 8.03 | 1 / 1 |  |  |  |
| STEP Caselib |  | 1 / 1 |  |  |  |
| TopSolid | 1.0 | 1 / 1 |  |  |  |
| Architectural Desktop (ADT) |  |  |  |  | 7 |
| BIMserver |  | 0 / 1 |  |  |  |
| Microsoft Visio |  |  |  |  | 16 |
| Synchro (4D) | 5.0.0.1 | 0 / 7 |  |  |  |

## Tested files by discipline and schema

| Discipline | IFC2x3 | IFC4 | IFC4.3 | Total |
|---|---:|---:|---:|---:|
| architecture | 90 | 8 | 1 | 99 |
| structure | 83 | 5 | 1 | 89 |
| concept example |  |  | 46 | 46 |
| infrastructure | 8 | 6 | 6 | 20 |
| mep | 9 | 5 |  | 14 |
| unknown | 10 | 2 |  | 12 |
| hvac | 8 | 1 | 1 | 10 |
| federated | 6 |  |  | 6 |
| electrical | 4 | 1 |  | 5 |
| landscape | 1 | 1 | 1 | 3 |
| plumbing | 2 | 1 |  | 3 |
| fire protection | 1 | 1 |  | 2 |

## Still uncovered

- **IFC4.3 from real authoring tools.** Only the SketchUp certification scene and hand-written specification examples. No Civil 3D, OpenRoads / OpenBridge, Tekla, Allplan Bridge or other infrastructure exports.
- **IFC4 from most tools.** Tested IFC4 comes from Revit (2015, 2019, 2021), Archicad (20, 23), Renga and SketchUp only. Tekla, Allplan, Vectorworks, MagiCAD and DDS-CAD appear in IFC2x3 only.
- **Native-IFC and open-source tools.** No Bonsai (BlenderBIM), FreeCAD or BricsCAD files.
- **Recent versions.** Nothing from Revit 2022+, Archicad 24+, Tekla 2022+, Vectorworks 2019+, Allplan after 2008 or MagiCAD after 2015.
- **Large models.** 30 files over 60 MB (up to 288 MB) were not run; time and memory at that size are unknown. The largest file run is 60 MB, the most elements 11 451. The overlap check was off for the whole corpus.
- **Quantities.** None of these files has a professional BoQ; only the Duplex and the buildingSMART samples have checked numbers (09). Reinforcement, MEP and infrastructure quantities are run, not verified.
- **Federation.** Several multi-model sets are available (NBU Office Building and Medical Clinic, LTU A-House, Schependomlaan, the certification scene) but each file was run alone; federation is not built.
- **Old schemas.** 47 files are IFC2x2, IFC2x or IFC2.0, which ifcopenshell cannot read. Out of scope unless a client sends one.
- **Other formats.** No ifcXML or IFC-JSON samples.

## What these files exposed

- **Crash on IfcGridPlacement** (specification model grid-placement): the placement helper assumed a relative placement. Fixed; placement is optional.
- **IfcSignal counted twice**: in IFC4.3 it is a flow terminal, so both `mep-items` and `other-components` took it. Fixed in as-modelled.
- **Invalid output for unnamed elements**: derived-line traces carried `name: null`, which the BoqResult contract forbids (Tekla and test files). Fixed and tested.
- **Nested aggregates**: HiCAD railings nest bolts in fixings in railings; grandchildren of a measured element became 400 false `unmatched` questions, and parts below an unmeasured sub-assembly could be counted twice. Coverage and part-skipping now walk all ancestors; roll-up counts rolled-up sub-assemblies. Tested.
- **Names**: steel grades used as material names (S355JR, A992, Q345B), CamelCase (ReinforcingSteel), EPDM, plurals, cast-in-place, psi concrete (C4000) and a few Norwegian layer words now resolve. Most remaining `needs input` results are local-language material names (Dutch, Norwegian, German); a general multi-language approach is on the roadmap (11) rather than adding languages one by one.
- **Preset gaps**: no rules for IfcPlate (833 unmatched: curtain-wall panels and steel plates), IfcCurtainWall, IfcBuildingElementPart, untyped IFC2x3 IfcFlowSegment (DDS-CAD), ramps and stand-alone stair flights. as-modelled now has `curtain-walls`, `plates`, steel plates in `steel-sections`, and the classes added to `pipes` and `stairs`.
- **Classes**: IFC4.3 IfcBuiltElement used as a generic object is handled like a proxy; IfcVirtualElement is no longer read as a physical element.
- **Inputs**: `.ifczip` is accepted by the corpus runner, the API and the UI (Schependomlaan ships 27); IFC2x2 and older are skipped with a reason instead of a traceback.
- **Data quality**: four COBie variants of the NBU Duplex and one Auckland sample are not valid STEP; Schependomlaan's `V_L_Constructief.ifc` is a Git LFS pointer unless fetched from the media host; the Lakeside file named RVT is Vectorworks and the one named VW is Revit; placeholder materials (`Default`, `Undefined/Undefined`, `Leer`, `Lege arcering`, `NO PRODUCT MATCHES CRITERIA`) block as unknown names; Tekla exported 447 empty `Steel Assembly` groups in one file (one grouped `unmatched` question).
- **Run time**: up to 409 s for a 25 MB Vectorworks file and 308 s for an 11 MB file with 10 743 elements, without the overlap check. Fine for a dev build; a worker with progress reporting is needed for real projects.

## Files

### buildingSMART Certification-datasets

Files buildingSMART uses for IFC import certification: one SketchUp scene (house, road, railway, two bridges) exported to IFC2x3, IFC4 and IFC4.3, plus small ISO Reference View examples. Licence: CC BY 4.0; a subset is in fixtures/ifc/buildingsmart. Link: https://github.com/buildingSMART/Certification-datasets

**ISO Reference View examples (IFC 4.0.2.1)** (5 files, 5 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [basin-tessellation.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.0.2.1%20%28IFC%204%20ADD2%20TC1%29/ISO%20Spec%20-%20ReferenceView_V1.2) | IFC4 | ReferenceView_V1.2 | Geometry Gym (Rhino) | 1.0.0.0 |  | mep | 0.01 | tested: complete | 1/1 measured, 0 unmatched |  |
| [column-straight-rectangle-tessellation.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.0.2.1%20%28IFC%204%20ADD2%20TC1%29/ISO%20Spec%20-%20ReferenceView_V1.2) | IFC4 | ReferenceView_V1.2 | Constructivity | 0.9 | 2014-07-08 | structure | 0.0 | tested: complete | 1/1 measured, 0 unmatched | in fixtures/; no_material 1 |
| [tessellated-item.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.0.2.1%20%28IFC%204%20ADD2%20TC1%29/ISO%20Spec%20-%20ReferenceView_V1.2) | IFC4 | ReferenceView_V1.2 | IFC text editor | 1.0 |  | unknown | 0.01 | tested: complete | 1/1 measured, 0 unmatched |  |
| [tessellation-with-individual-colors.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.0.2.1%20%28IFC%204%20ADD2%20TC1%29/ISO%20Spec%20-%20ReferenceView_V1.2) | IFC4 | ReferenceView_V1.2 | Geometry Gym (Rhino) | 1.0.0.0 |  | unknown | 0.0 | tested: complete | 1/1 measured, 0 unmatched |  |
| [wall-with-opening-and-window.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.0.2.1%20%28IFC%204%20ADD2%20TC1%29/ISO%20Spec%20-%20ReferenceView_V1.2) | IFC4 | ReferenceView_V1.2 | IFC Engine DLL (test app) | 0.10 | 2011-12-12 | architecture | 0.01 | tested: needs input | 2/2 measured, 0 unmatched | in fixtures/; blocking names: Name of the material used for the wall, Name of the material used for the wall |

**Simple-Scene (IFC 2.3.0.1)** (10 files, 10 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [Building-Architecture.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%202.3.0.1%20%28IFC%202x3%20TC1%29/Simple-Scene) | IFC2x3 | CoordinationView_V2.0 | SketchUp | 5.6.0 | 2026-06-23 | architecture | 0.09 | tested: needs input | 8/14 measured, 0 unmatched | in fixtures/; blocking names: composite_element_roof; no_geometry 1 |
| [Building-Hvac.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%202.3.0.1%20%28IFC%202x3%20TC1%29/Simple-Scene) | IFC2x3 | CoordinationView_V2.0 | SketchUp | 5.6.0 | 2026-06-23 | hvac | 0.07 | tested: complete | 4/6 measured, 0 unmatched | in fixtures/; no_geometry 1 |
| [Building-Landscaping.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%202.3.0.1%20%28IFC%202x3%20TC1%29/Simple-Scene) | IFC2x3 | CoordinationView_V2.0 | SketchUp | 5.6.0 | 2026-06-23 | landscape | 0.53 | tested: complete | 4/6 measured, 0 unmatched |  |
| [Building-Structural.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%202.3.0.1%20%28IFC%202x3%20TC1%29/Simple-Scene) | IFC2x3 | CoordinationView_V2.0 | SketchUp | 5.6.0 | 2026-06-23 | structure | 0.11 | tested: complete | 14/17 measured, 0 unmatched | in fixtures/ |
| [Infra-Bridge.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%202.3.0.1%20%28IFC%202x3%20TC1%29/Simple-Scene) | IFC2x3 | CoordinationView_V2.0 | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 0.83 | tested: complete | 47/68 measured, 2 unmatched | unmatched: IfcElementAssembly x1; no_geometry 2 |
| [Infra-Electrical.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%202.3.0.1%20%28IFC%202x3%20TC1%29/Simple-Scene) | IFC2x3 | CoordinationView_V2.0 | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 0.07 | tested: needs input | 5/6 measured, 0 unmatched | blocking names: Default; no_geometry 2 |
| [Infra-Landscaping.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%202.3.0.1%20%28IFC%202x3%20TC1%29/Simple-Scene) | IFC2x3 | CoordinationView_V2.0 | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 1.21 | tested: needs input | 100/111 measured, 0 unmatched | blocking names: Default, bulk-material_water_surfacewater |
| [Infra-Plumbing.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%202.3.0.1%20%28IFC%202x3%20TC1%29/Simple-Scene) | IFC2x3 | CoordinationView_V2.0 | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 0.19 | tested: needs input | 26/29 measured, 2 unmatched | blocking names: Default; unmatched: IfcElementAssembly x1; not_watertight 2; no_geometry 2 |
| [Infra-Rail.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%202.3.0.1%20%28IFC%202x3%20TC1%29/Simple-Scene) | IFC2x3 | CoordinationView_V2.0 | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 0.11 | tested: complete | 72/77 measured, 2 unmatched | unmatched: IfcElementAssembly x1; no_geometry 2 |
| [Infra-Road.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%202.3.0.1%20%28IFC%202x3%20TC1%29/Simple-Scene) | IFC2x3 | CoordinationView_V2.0 | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 0.18 | tested: complete | 32/61 measured, 20 unmatched | unmatched: IfcElementAssembly x3; no_geometry 2 |

**Simple-Scene (IFC 4.0.2.1)** (10 files, 10 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [Building-Architecture.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.0.2.1%20%28IFC%204%20ADD2%20TC1%29/Simple-Scene) | IFC4 | ReferenceView_V1.2 | SketchUp | 5.6.0 | 2026-06-23 | architecture | 0.14 | tested: needs input | 8/13 measured, 0 unmatched | in fixtures/; blocking names: composite_element_roof; no_geometry 1 |
| [Building-Hvac.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.0.2.1%20%28IFC%204%20ADD2%20TC1%29/Simple-Scene) | IFC4 | ReferenceView_V1.2 | SketchUp | 5.6.0 | 2026-06-23 | hvac | 0.11 | tested: complete | 4/6 measured, 0 unmatched | no_geometry 1 |
| [Building-Landscaping.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.0.2.1%20%28IFC%204%20ADD2%20TC1%29/Simple-Scene) | IFC4 | ReferenceView_V1.2 | SketchUp | 5.6.0 | 2026-06-23 | landscape | 1.07 | tested: complete | 4/6 measured, 0 unmatched |  |
| [Building-Structural.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.0.2.1%20%28IFC%204%20ADD2%20TC1%29/Simple-Scene) | IFC4 | ReferenceView_V1.2 | SketchUp | 5.6.0 | 2026-06-23 | structure | 0.19 | tested: complete | 14/17 measured, 0 unmatched | in fixtures/ |
| [Infra-Bridge.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.0.2.1%20%28IFC%204%20ADD2%20TC1%29/Simple-Scene) | IFC4 | ReferenceView_V1.2 | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 1.74 | tested: complete | 47/68 measured, 2 unmatched | unmatched: IfcElementAssembly x1; no_geometry 2 |
| [Infra-Electrical.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.0.2.1%20%28IFC%204%20ADD2%20TC1%29/Simple-Scene) | IFC4 | ReferenceView_V1.2 | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 0.12 | tested: needs input | 5/6 measured, 0 unmatched | blocking names: Default; no_geometry 2 |
| [Infra-Landscaping.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.0.2.1%20%28IFC%204%20ADD2%20TC1%29/Simple-Scene) | IFC4 | ReferenceView_V1.2 | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 2.35 | tested: needs input | 100/111 measured, 0 unmatched | blocking names: Default, bulk-material_water_surfacewater |
| [Infra-Plumbing.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.0.2.1%20%28IFC%204%20ADD2%20TC1%29/Simple-Scene) | IFC4 | ReferenceView_V1.2 | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 0.35 | tested: needs input | 26/29 measured, 2 unmatched | blocking names: Default; unmatched: IfcElementAssembly x1; not_watertight 2; no_geometry 2 |
| [Infra-Rail.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.0.2.1%20%28IFC%204%20ADD2%20TC1%29/Simple-Scene) | IFC4 | ReferenceView_V1.2 | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 0.16 | tested: complete | 72/77 measured, 2 unmatched | unmatched: IfcElementAssembly x1; no_geometry 2 |
| [Infra-Road.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.0.2.1%20%28IFC%204%20ADD2%20TC1%29/Simple-Scene) | IFC4 | ReferenceView_V1.2 | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 0.28 | tested: complete | 52/81 measured, 20 unmatched | unmatched: IfcElementAssembly x6; not_watertight 1; no_geometry 2 |

**Simple-Scene (IFC 4.3.2.0)** (10 files, 10 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [Building-Architecture.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.3.2.0%20%28IFC%204.3%20ADD2%29/Simple-Scene) | IFC4.3 | ReferenceView | SketchUp | 5.6.0 | 2026-06-23 | architecture | 0.14 | tested: needs input | 8/13 measured, 0 unmatched | in fixtures/; blocking names: composite_element_roof; no_geometry 1 |
| [Building-Hvac.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.3.2.0%20%28IFC%204.3%20ADD2%29/Simple-Scene) | IFC4.3 | ReferenceView | SketchUp | 5.6.0 | 2026-06-23 | hvac | 0.11 | tested: complete | 4/6 measured, 0 unmatched | in fixtures/; no_geometry 1 |
| [Building-Landscaping.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.3.2.0%20%28IFC%204.3%20ADD2%29/Simple-Scene) | IFC4.3 | ReferenceView | SketchUp | 5.6.0 | 2026-06-23 | landscape | 1.07 | tested: complete | 4/6 measured, 0 unmatched |  |
| [Building-Structural.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.3.2.0%20%28IFC%204.3%20ADD2%29/Simple-Scene) | IFC4.3 | ReferenceView | SketchUp | 5.6.0 | 2026-06-23 | structure | 0.19 | tested: complete | 14/17 measured, 0 unmatched | in fixtures/ |
| [Infra-Bridge.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.3.2.0%20%28IFC%204.3%20ADD2%29/Simple-Scene) | IFC4.3 | ReferenceView | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 1.74 | tested: complete | 47/50 measured, 2 unmatched | in fixtures/; unmatched: IfcElementAssembly x1; no_geometry 2 |
| [Infra-Electrical.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.3.2.0%20%28IFC%204.3%20ADD2%29/Simple-Scene) | IFC4.3 | ReferenceView | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 0.12 | tested: needs input | 5/6 measured, 0 unmatched | blocking names: Default; no_geometry 2 |
| [Infra-Landscaping.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.3.2.0%20%28IFC%204.3%20ADD2%29/Simple-Scene) | IFC4.3 | ReferenceView | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 2.35 | tested: needs input | 100/111 measured, 0 unmatched | blocking names: Default, bulk-material_water_surfacewater |
| [Infra-Plumbing.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.3.2.0%20%28IFC%204.3%20ADD2%29/Simple-Scene) | IFC4.3 | ReferenceView | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 0.35 | tested: needs input | 26/29 measured, 2 unmatched | blocking names: Default; unmatched: IfcElementAssembly x1; not_watertight 2; no_geometry 2 |
| [Infra-Rail.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.3.2.0%20%28IFC%204.3%20ADD2%29/Simple-Scene) | IFC4.3 | ReferenceView | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 0.16 | tested: complete | 72/75 measured, 2 unmatched | unmatched: IfcElementAssembly x1; no_geometry 2 |
| [Infra-Road.ifc](https://github.com/buildingSMART/Certification-datasets/tree/main/IFC%204.3.2.0%20%28IFC%204.3%20ADD2%29/Simple-Scene) | IFC4.3 | ReferenceView | SketchUp | 5.6.0 | 2026-06-23 | infrastructure | 0.26 | tested: complete | 52/55 measured, 2 unmatched | in fixtures/; unmatched: IfcElementAssembly x1; not_watertight 1; no_geometry 2 |

### buildingSMART IFC4.x-specification-models

Small hand-written files that illustrate one IFC concept each (geometry types, placements, alignment, building elements, reinforcement). All in IFC4.3 ADD2. Good for geometry and parser edge cases, not for quantities. Licence: all rights reserved until formal release (final IFC: CC BY-ND 4.0); not copied into this repository. Link: https://github.com/buildingSMART/IFC4.x-specification-models

**advanced-geometric-shape** (5 files, 5 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [basin-advanced-brep.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/advanced-geometric-shape/basin-advanced-brep/basin-advanced-brep.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  |  | concept example | 0.01 | tested: complete | 1/1 measured, 0 unmatched | inconsistent_winding 1 |
| [basin-faceted-brep.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/advanced-geometric-shape/basin-faceted-brep/basin-faceted-brep.ifc) | IFC4.3 | ReferenceView | hand-written specification example |  |  | concept example | 0.03 | tested: complete | 1/1 measured, 0 unmatched |  |
| [basin-tessellation.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/advanced-geometric-shape/basin-tessellation/basin-tessellation.ifc) | IFC4.3 | ReferenceView | hand-written specification example |  |  | concept example | 0.01 | tested: complete | 1/1 measured, 0 unmatched |  |
| [bath-csg-solid.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/advanced-geometric-shape/bath-csg-solid/bath-csg-solid.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  |  | concept example | 0.0 | tested: complete | 1/1 measured, 0 unmatched |  |
| [cube-advanced-brep.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/advanced-geometric-shape/cube-advanced-brep/cube-advanced-brep.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  |  | concept example | 0.01 | tested: complete | 1/1 measured, 0 unmatched |  |

**alignment-geometries-and-linear-positioning** (4 files, 4 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [fixed-reference-swept-area-solid.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/alignment-geometries-and-linear-positioning/fixed-reference-swept-area-solid/fixed-reference-swept-area-solid.ifc) | IFC4.3 | Alignment-basedView | hand-written specification example |  | 2021-05-31 | concept example | 0.01 | tested: complete | 1/1 measured, 0 unmatched | not_watertight 1 |
| [linear-placement-of-signal.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/alignment-geometries-and-linear-positioning/linear-placement-of-signal/linear-placement-of-signal.ifc) | IFC4.3 | Alignment-basedView | hand-written specification example |  | 2023-07-11 | concept example | 0.24 | tested: complete | 2/2 measured, 0 unmatched |  |
| [sectioned-solid-horizontal.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/alignment-geometries-and-linear-positioning/sectioned-solid-horizontal/sectioned-solid-horizontal.ifc) | IFC4.3 | Alignment-basedView | hand-written specification example |  | 2021-05-31 | concept example | 0.01 | tested: complete | 1/1 measured, 0 unmatched | not_watertight 1 |
| [segmented-reference-curve.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/alignment-geometries-and-linear-positioning/segmented-reference-curve/segmented-reference-curve.ifc) | IFC4.3 | Alignment-basedView | hand-written specification example |  | 2024-11-12 | concept example | 0.01 | tested: complete | 0/0 measured, 0 unmatched |  |

**basic-geometric-shape** (5 files, 5 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [brep-model.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/basic-geometric-shape/brep-model/brep-model.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  | 2012-06-18 | concept example | 0.01 | tested: complete | 1/1 measured, 0 unmatched |  |
| [csg-primitive.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/basic-geometric-shape/csg-primitive/csg-primitive.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  | 2012-06-15 | concept example | 0.01 | tested: complete | 1/1 measured, 0 unmatched |  |
| [extruded-solid.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/basic-geometric-shape/extruded-solid/extruded-solid.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  | 2012-06-18 | concept example | 0.01 | tested: complete | 1/1 measured, 0 unmatched |  |
| [surface-model.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/basic-geometric-shape/surface-model/surface-model.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  | 2011-11-07 | concept example | 0.01 | tested: complete | 1/1 measured, 0 unmatched |  |
| [triangulated-item.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/basic-geometric-shape/triangulated-item/triangulated-item.ifc) | IFC4.3 | ReferenceView | hand-written specification example |  | 2012-07-04 | concept example | 0.01 | tested: complete | 1/1 measured, 0 unmatched |  |

**building-elements** (12 files, 12 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [beam-extruded-solid.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/building-elements/beam-extruded-solid/beam-extruded-solid.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  |  | concept example | 0.0 | tested: complete | 1/1 measured, 0 unmatched | no_material 1 |
| [beam-parametric-cross-section.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/building-elements/beam-parametric-cross-section/beam-parametric-cross-section.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  | 2011-11-07 | concept example | 0.04 | tested: complete | 18/18 measured, 0 unmatched |  |
| [beam-revolved-solid.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/building-elements/beam-revolved-solid/beam-revolved-solid.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  |  | concept example | 0.01 | tested: complete | 1/1 measured, 0 unmatched |  |
| [beam-varying-cardinal-points.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/building-elements/beam-varying-cardinal-points/beam-varying-cardinal-points.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  |  | concept example | 0.01 | tested: complete | 4/4 measured, 0 unmatched |  |
| [beam-varying-extrusion-paths.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/building-elements/beam-varying-extrusion-paths/beam-varying-extrusion-paths.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  |  | concept example | 0.0 | tested: complete | 2/2 measured, 0 unmatched |  |
| [beam-varying-profiles.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/building-elements/beam-varying-profiles/beam-varying-profiles.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  |  | concept example | 0.0 | tested: complete | 2/2 measured, 0 unmatched |  |
| [column-extruded-solid.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/building-elements/column-extruded-solid/column-extruded-solid.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  |  | concept example | 0.0 | tested: complete | 1/1 measured, 0 unmatched |  |
| [reinforcing-assembly.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/building-elements/reinforcing-assembly/reinforcing-assembly.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  |  | concept example | 0.02 | tested: complete | 1/36 measured, 0 unmatched |  |
| [reinforcing-stirrup.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/building-elements/reinforcing-stirrup/reinforcing-stirrup.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  |  | concept example | 0.0 | tested: complete | 1/1 measured, 0 unmatched |  |
| [slab-extruded-solid.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/building-elements/slab-extrusion/slab-extruded-solid.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  |  | concept example | 0.0 | tested: complete | 1/1 measured, 0 unmatched |  |
| [slab-openings.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/building-elements/slab-openings/slab-openings.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  |  | concept example | 0.0 | tested: complete | 1/1 measured, 0 unmatched |  |
| [wall-extruded-solid.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/building-elements/wall-extrusion/wall-extruded-solid.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  |  | concept example | 0.0 | tested: complete | 1/1 measured, 0 unmatched |  |

**construction-scheduling** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [construction-scheduling-task.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/construction-scheduling/construction-scheduling-task/construction-scheduling-task.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  | 2010-09-23 | concept example | 0.02 | tested: complete | 5/5 measured, 0 unmatched |  |

**mapped-geometric-shape** (3 files, 3 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [mapped-shape-with-multiple-items.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/mapped-geometric-shape/mapped-shape-with-multiple-items/mapped-shape-with-multiple-items.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  | 2011-11-07 | concept example | 0.01 | tested: complete | 1/1 measured, 0 unmatched |  |
| [mapped-shape-with-transformation.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/mapped-geometric-shape/mapped-shape-with-transformation/mapped-shape-with-transformation.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  | 2011-11-07 | concept example | 0.01 | tested: complete | 1/1 measured, 0 unmatched |  |
| [mapped-shape-without-transformation.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/mapped-geometric-shape/mapped-shape-without-transformation/mapped-shape-without-transformation.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  | 2011-11-07 | concept example | 0.01 | tested: complete | 1/1 measured, 0 unmatched |  |

**placements-and-gis-referencing** (4 files, 4 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [geographic-referencing-gk.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/placements-and-gis-referencing/geographic-referencing-gk/geographic-referencing-gk.ifc) | IFC4.3 |  | hand-written specification example |  |  | concept example | 0.0 | tested: complete | 1/1 measured, 0 unmatched |  |
| [geographic-referencing-rigid-operation.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/placements-and-gis-referencing/geographic-referencing-rigid-operation/geographic-referencing-rigid-operation.ifc) | IFC4.3 | ReferenceView | hand-written specification example |  | 2022-11-16 | concept example | 0.0 | tested: complete | 2/2 measured, 0 unmatched | no_geometry 1 |
| [geographic-referencing-utm.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/placements-and-gis-referencing/geographic-referencing-utm/geographic-referencing-utm.ifc) | IFC4.3 |  | hand-written specification example |  |  | concept example | 0.0 | tested: complete | 1/1 measured, 0 unmatched |  |
| [grid-placement.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/placements-and-gis-referencing/grid-placement/grid-placement.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  | 2013-07-13 | concept example | 0.03 | tested: complete | 35/35 measured, 0 unmatched | no_geometry 25 |

**structural-analysis-model** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [structural-curve-member.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/structural-analysis-model/structural-curve-member/structural-curve-member.ifc) | IFC4.3 |  | hand-written specification example |  | 2023-07-18 | concept example | 0.02 | tested: complete | 0/0 measured, 0 unmatched |  |

**tessellated-shape** (5 files, 5 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [beam-curved-i-shape-tessellated.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/tessellated-shape/beam-curved-i-shape-tessellated/beam-curved-i-shape-tessellated.ifc) | IFC4.3 | ReferenceView | hand-written specification example |  |  | concept example | 0.36 | tested: complete | 1/1 measured, 0 unmatched |  |
| [beam-straight-i-shape-tessellated.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/tessellated-shape/beam-straight-i-shape-tessellated/beam-straight-i-shape-tessellated.ifc) | IFC4.3 | ReferenceView | hand-written specification example |  |  | concept example | 0.01 | tested: complete | 1/1 measured, 0 unmatched | no_material 1 |
| [column-straight-rectangle-tessellation.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/tessellated-shape/column-straight-rectangle-tessellation/column-straight-rectangle-tessellation.ifc) | IFC4.3 | ReferenceView | hand-written specification example |  | 2014-07-08 | concept example | 0.0 | tested: complete | 1/1 measured, 0 unmatched | no_material 1 |
| [polygonal-face-tessellation.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/tessellated-shape/polygonal-face-tessellation/polygonal-face-tessellation.ifc) | IFC4.3 | ReferenceView | hand-written specification example |  |  | concept example | 0.0 | tested: complete | 1/1 measured, 0 unmatched |  |
| [slab-tessellated-unique-vertices.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/tessellated-shape/slab-tessellated-unique-vertices/slab-tessellated-unique-vertices.ifc) | IFC4.3 | ReferenceView | hand-written specification example |  |  | concept example | 0.01 | tested: complete | 1/1 measured, 0 unmatched | no_material 1 |

**tessellated-shape-with-style** (4 files, 4 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [tessellation-with-blob-texture.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/tessellated-shape-with-style/tessellation-with-blob-texture/tessellation-with-blob-texture.ifc) | IFC4.3 |  | hand-written specification example |  | 2016-05-06 | concept example | 0.02 | tested: complete | 0/0 measured, 0 unmatched |  |
| [tessellation-with-image-texture.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/tessellated-shape-with-style/tessellation-with-image-texture/tessellation-with-image-texture.ifc) | IFC4.3 |  | hand-written specification example |  | 2016-05-06 | concept example | 0.01 | tested: complete | 0/0 measured, 0 unmatched |  |
| [tessellation-with-individual-colors.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/tessellated-shape-with-style/tessellation-with-individual-colors/tessellation-with-individual-colors.ifc) | IFC4.3 | ReferenceView | hand-written specification example |  |  | concept example | 0.0 | tested: complete | 1/1 measured, 0 unmatched |  |
| [tessellation-with-pixel-texture.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/tessellated-shape-with-style/tessellation-with-pixel-texture/tessellation-with-pixel-texture.ifc) | IFC4.3 |  | hand-written specification example |  | 2016-05-06 | concept example | 0.8 | tested: complete | 0/0 measured, 0 unmatched |  |

**trimmed-curve-parameters** (2 files, 2 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [curve-parameters-in-degrees.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/trimmed-curve-parameters/curve-parameters-in-degrees/curve-parameters-in-degrees.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  |  | concept example | 0.01 | tested: complete | 3/3 measured, 0 unmatched |  |
| [curve-parameters-in-radians.ifc](https://github.com/buildingSMART/IFC4.x-specification-models/blob/main/models/trimmed-curve-parameters/curve-parameters-in-radians/curve-parameters-in-radians.ifc) | IFC4.3 | NotAssigned | hand-written specification example |  |  | concept example | 0.01 | tested: complete | 3/3 measured, 0 unmatched |  |

### DURAARK (TIB), listed by BIMData

Real project models collected by the EU DURAARK project and hosted by TIB Hannover, reached through the BIMData list. Mostly 2005-2015 exports, IFC2x2 and IFC2x3, several disciplines per project. Licence: not stated on the download; not copied into this repository. Link: https://github.com/bimdata/BIMData-Research-and-Development/blob/master/pages/IFC_FILES.md

**Academic_Autodesk** (2 files, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [Academic_Autodesk-AdvancedSampleProject_Arch.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/Academic_Autodesk_ifc.zip) | IFC2x3 | CoordinationView | Revit | 2013 | 2013-03-01 | architecture | 38.07 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |
| [Academic_Autodesk-BasicSampleProject_Arch.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/Academic_Autodesk_ifc.zip) | IFC2x3 | CoordinationView | Revit | 2013 | 2013-03-01 | architecture | 5.39 | tested: needs input | 199/417 measured, 0 unmatched | blocking names: Siding, Door - Frame, Door - Panel, Porcelain - Ivory...; volume_mismatch 6; inconsistent_winding 2; not_watertight 5; no_material 153 |

**Autodesk_210-King** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [Autodesk-Research_210-King.ifc](https://tib.eu/data/duraark/BuildingData/03_IFC_E57/Autodesk_210-King_ifc.zip) | IFC2x3 |  | BIMserver |  | 2011-12-15 | architecture | 155.15 | header only |  | not run: 155 MB, over the size cap of this pass |

**FOJAB_Landsarkivet** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [FOJAB_Landsarkivet.ifc](https://tib.eu/data/duraark/BuildingData/03_IFC_E57/FOJAB_Landsarkivet_IFC.zip) | IFC2x3 | CoordinationView_V2.0 | Revit | 2015 | 2015-12-02 | unknown | 177.52 | header only |  | not run: 178 MB, over the size cap of this pass; post-processed: Naviate exporter |

**KIT_Institute** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [KIT_Institute_Arch.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/KIT_Institute_ifc.zip) | IFC2x3 |  | Archicad | 11.0 | 2008-07-03 | architecture | 2.84 | tested: needs input | 446/699 measured, 0 unmatched | blocking names: Leer; volume_mismatch 6; inconsistent_winding 1; not_watertight 2 |

**KIT_Smiley-West** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [KIT_Smiley-West_Arch.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/KIT_Smiley-West_ifc.zip) | IFC2x3 |  | Archicad | 10.0 | 2007-07-05 | architecture | 3.37 | tested: needs input | 412/412 measured, 0 unmatched | blocking names: Gips, Massiv, Gips, Leer...; volume_mismatch 25; not_watertight 4; no_material 6 |

**LTU_A-House_2014-09-25** (9 files, 2 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [LTU_A-House_Air.ifc](https://tib.eu/data/duraark/BuildingData/03_IFC_E57/LTU_A-House_2014-09-25_ifc.zip) | IFC2x3 | CoordinationView | MagiCAD | 2013 | 2014-06-19 | hvac | 25.35 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |
| [LTU_A-House_Cooling.ifc](https://tib.eu/data/duraark/BuildingData/03_IFC_E57/LTU_A-House_2014-09-25_ifc.zip) | IFC2x3 | CoordinationView | MagiCAD | 2013 | 2014-09-24 | hvac | 32.28 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |
| [LTU_A-House_Ducting.ifc](https://tib.eu/data/duraark/BuildingData/03_IFC_E57/LTU_A-House_2014-09-25_ifc.zip) | IFC2x3 | CoordinationView | MagiCAD | 2013 | 2014-04-10 | hvac | 8.38 | tested: complete | 4067/4067 measured, 0 unmatched | inconsistent_winding 3; not_watertight 4 |
| [LTU_A-House_Heating.ifc](https://tib.eu/data/duraark/BuildingData/03_IFC_E57/LTU_A-House_2014-09-25_ifc.zip) | IFC2x3 | CoordinationView | MagiCAD | 2013 | 2014-09-24 | hvac | 34.23 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |
| [LTU_A-House_K-modell.ifc](https://tib.eu/data/duraark/BuildingData/03_IFC_E57/LTU_A-House_2014-09-25_ifc.zip) | IFC2x3 | CoordinationView | Revit | 2014 | 2014-09-19 | federated | 32.4 | tested: needs input | 6348/6409 measured, 0 unmatched | blocking names: Default Wall, Tape Covered Tin Roof - Black, Varmförzinkad stålplåt, Varmförzinkad stålplåt; 4 missing quantities; volume_mismatch 15; not_watertight 2; no_geometry 299; no_material 17 |
| [LTU_A-House_Plumbing.ifc](https://tib.eu/data/duraark/BuildingData/03_IFC_E57/LTU_A-House_2014-09-25_ifc.zip) | IFC2x3 | CoordinationView | MagiCAD | 2013 | 2014-03-10 | plumbing | 72.97 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |
| [LTU_A-House_redesign.ifc](https://tib.eu/data/duraark/BuildingData/03_IFC_E57/LTU_A-House_2014-09-25_ifc.zip) | IFC2x3 | CoordinationView | Archicad | 16.0 | 2014-09-22 | architecture | 181.31 | header only |  | not run: 181 MB, over the size cap of this pass |
| [LTU_A-House_Sanitation.ifc](https://tib.eu/data/duraark/BuildingData/03_IFC_E57/LTU_A-House_2014-09-25_ifc.zip) | IFC2x3 | CoordinationView | MagiCAD | 2013 | 2014-09-18 | plumbing | 26.96 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |
| [LTU_A-House_VOIDS.ifc](https://tib.eu/data/duraark/BuildingData/03_IFC_E57/LTU_A-House_2014-09-25_ifc.zip) | IFC2x3 | CoordinationView | MagiCAD | 2013 | 2014-06-12 | architecture | 25.3 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**NBS_Lakeside** (5 files, 3 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [NBS_LakesideAC01_Arch.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBS_Lakeside_ifc.zip) | IFC2x3 | FMHandover, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 16.0 | 07/09/2012 | architecture | 42.26 | tested: needs input | 1202/2873 measured, 0 unmatched | blocking names: Gypsum, MISSING, nbl_Cavity, nbl_Concept...; volume_mismatch 279; inconsistent_winding 3; not_watertight 9; no_material 1517 |
| [NBS_LakesideAC10_Arch.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBS_Lakeside_ifc.zip) | IFC2x3 | FMHandover, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 16.0 | 28/09/2012 | architecture | 39.86 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |
| [NBS_LakesideRVT01_Arch.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBS_Lakeside_ifc.zip) | IFC2x3 | CoordinationView_V2.0 | Vectorworks | 2013 | 2012-09-17 | architecture | 9.6 | tested: needs input | 1189/1217 measured, 0 unmatched | blocking names: BattensTimbeResilientFloor, Cavity, CementiousAdhesive, Component 0...; 21 missing quantities; inconsistent_winding 2; not_watertight 4; no_geometry 5; no_material 10 |
| [NBS_LakesideRVT10_Arch.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBS_Lakeside_ifc.zip) | IFC2x3 | CoordinationView | Revit | 2012 | 2012-09-28 | architecture | 38.18 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |
| [NBS_LakesideVW00_Arch.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBS_Lakeside_ifc.zip) | IFC2x3 | CoordinationView | Revit | 2012 | 2012-08-17 | architecture | 38.2 | tested: needs input | 1410/4875 measured, 0 unmatched | blocking names: Default Roof, Downpipe, nbl_Cavity, nbl_CementitiousAdhesive...; volume_mismatch 116; inconsistent_winding 9; not_watertight 7; no_material 22 |

**NBU_Duplex** (12 files, 6 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [NBU_Duplex-Apt-COBie_Arch-Design.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_Duplex_ifc.zip) | IFC2x3 |  | BIMserver COBie |  | 2012-03-26 | architecture | 0.53 | invalid |  | STEP syntax error (ifcopenshell cannot read it) |
| [NBU_Duplex-Apt-COBie_Arch-Handover.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_Duplex_ifc.zip) | IFC2x3 |  | unknown |  | 2012-03-23 | architecture | 0.56 | invalid |  | STEP syntax error (ifcopenshell cannot read it) |
| [NBU_Duplex-Apt-COBie_Arch-ProductInstall.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_Duplex_ifc.zip) | IFC2x3 |  | unknown |  | 2012-03-26 | architecture | 0.57 | invalid |  | STEP syntax error (ifcopenshell cannot read it) |
| [NBU_Duplex-Apt-COBie_Arch-ProductSelect.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_Duplex_ifc.zip) | IFC2x3 |  | unknown |  | 2012-03-26 | architecture | 0.55 | invalid |  | STEP syntax error (ifcopenshell cannot read it) |
| [NBU_Duplex-Apt-COBie_Arch-Programming.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_Duplex_ifc.zip) | IFC2x3 |  | BIMserver COBie |  | 2012-03-26 | architecture | 0.04 | tested: complete | 0/0 measured, 0 unmatched |  |
| [NBU_Duplex-Apt_Arch-Optimized.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_Duplex_ifc.zip) | IFC2x3 | CoordinationView | Revit | 2011 | 2011-09-07 | architecture | 1.66 | tested: complete | 150/218 measured, 0 unmatched | post-processed: Solibri IFC Optimizer; volume_mismatch 9; inconsistent_winding 5; not_watertight 5; no_material 11 |
| [NBU_Duplex-Apt_Arch.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_Duplex_ifc.zip) | IFC2x3 | CoordinationView | Revit | 2011 | 2011-09-07 | architecture | 2.42 | tested: complete | 150/218 measured, 0 unmatched | volume_mismatch 9; inconsistent_winding 5; not_watertight 5; no_material 11 |
| [NBU_Duplex-Apt_Eng-HVAC.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_Duplex_ifc.zip) | IFC2x3 | CoordinationView | Revit | 2013 | 2012-12-18 | hvac | 32.12 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |
| [NBU_Duplex-Apt_Eng-MEP-1.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_Duplex_ifc.zip) | IFC2x3 | CoordinationView | Revit | 2013 | 2012-12-18 | mep | 1.63 | tested: complete | 103/103 measured, 0 unmatched | inconsistent_winding 2; not_watertight 3 |
| [NBU_Duplex-Apt_Eng-MEP-2.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_Duplex_ifc.zip) | IFC2x3 | CoordinationView | Revit MEP | 2011 | 2011-10-24 | mep | 8.94 | tested: complete | 487/487 measured, 0 unmatched | inconsistent_winding 5; not_watertight 4 |
| [NBU_Duplex-Apt_Eng-MEP-Optimized.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_Duplex_ifc.zip) | IFC2x3 | CoordinationView | Revit MEP | 2011 | 2011-09-07 | mep | 11.13 | tested: complete | 926/926 measured, 0 unmatched | post-processed: Solibri IFC Optimizer; inconsistent_winding 6; not_watertight 5 |
| [NBU_Duplex-Apt_Eng-MEP.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_Duplex_ifc.zip) | IFC2x3 | CoordinationView | Revit MEP | 2011 | 2011-09-07 | mep | 18.18 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**NBU_MedicalClinic** (8 files, 4 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [NBU_MedicalClinic_Arch-Optimized.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_MedicalClinic_ifc.zip) | IFC2x3 | CoordinationView | Revit | 2011 | 2011-09-06 | architecture | 13.21 | tested: needs input | 1782/2620 measured, 0 unmatched | post-processed: Solibri IFC Optimizer; blocking names: Default, Laminate - Ivory, Matte, Default, Laminate - Ivory, Matte; volume_mismatch 47; inconsistent_winding 8; not_watertight 7; no_material 15 |
| [NBU_MedicalClinic_Arch.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_MedicalClinic_ifc.zip) | IFC2x3 | CoordinationView | Revit | 2011 | 2011-09-06 | architecture | 18.14 | tested: needs input | 1782/2620 measured, 0 unmatched | blocking names: Default, Laminate - Ivory, Matte, Default, Laminate - Ivory, Matte; volume_mismatch 47; inconsistent_winding 8; not_watertight 7; no_material 15 |
| [NBU_MedicalClinic_Eng-CON-Optimized.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_MedicalClinic_ifc.zip) | IFC2x3 | CoordinationView | Revit | 2011 | 2011-07-11 | structure | 19.38 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy); post-processed: Solibri IFC Optimizer |
| [NBU_MedicalClinic_Eng-CON.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_MedicalClinic_ifc.zip) | IFC2x3 | CoordinationView | Revit | 2011 | 2011-07-11 | structure | 19.38 | tested: complete | 1078/1087 measured, 0 unmatched | post-processed: Solibri IFC Optimizer; volume_mismatch 891; inconsistent_winding 4; not_watertight 3; no_material 558 |
| [NBU_MedicalClinic_Eng-ELE.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_MedicalClinic_ifc.zip) | IFC2x3 | CoordinationView | Revit | 2013 | 2012-12-18 | electrical | 11.97 | tested: needs input | 2118/2118 measured, 0 unmatched | blocking names: Default Light Source, Paint-Philips Chloride-Black; inconsistent_winding 2; not_watertight 4 |
| [NBU_MedicalClinic_Eng-HVAC.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_MedicalClinic_ifc.zip) | IFC2x3 | CoordinationView | Revit MEP | 2013 | 2012-03-29 | hvac | 27.37 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy); post-processed: Solibri IFC Optimizer |
| [NBU_MedicalClinic_Eng-MEP-Optimized.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_MedicalClinic_ifc.zip) | IFC2x3 | CoordinationView | Revit MEP | 2011 | 2011-09-06 | mep | 125.78 | header only |  | not run: 126 MB, over the size cap of this pass; post-processed: Solibri IFC Optimizer |
| [NBU_MedicalClinic_Eng-MEP.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_MedicalClinic_ifc.zip) | IFC2x3 | CoordinationView | Revit MEP | 2011 | 2011-09-06 | mep | 207.34 | header only |  | not run: 207 MB, over the size cap of this pass |

**NBU_OfficeBuilding** (9 files, 7 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [NBU_OfficeBuilding_Arch-1.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_OfficeBuilding_ifc.zip) | IFC2x3 | CoordinationView | Revit | 2011 | 2011-08-11 | architecture | 4.1 | tested: needs input | 784/805 measured, 0 unmatched | post-processed: Solibri IFC Optimizer; blocking names: Default, Laminate - Ivory, Matte, Default, Laminate - Ivory, Matte; inconsistent_winding 5; not_watertight 6; no_material 10 |
| [NBU_OfficeBuilding_Arch-2.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_OfficeBuilding_ifc.zip) | IFC2x3 |  | BIMserver COBie |  | 2012-03-23 | architecture | 0.61 | tested: complete | 202/209 measured, 0 unmatched | no_geometry 209 |
| [NBU_OfficeBuilding_Arch-Optimized.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_OfficeBuilding_ifc.zip) | IFC2x3 | CoordinationView | Revit | 2011 | 2011-08-11 | architecture | 4.1 | tested: needs input | 784/805 measured, 0 unmatched | post-processed: Solibri IFC Optimizer; blocking names: Default, Laminate - Ivory, Matte, Default, Laminate - Ivory, Matte; inconsistent_winding 5; not_watertight 6; no_material 10 |
| [NBU_OfficeBuilding_Eng-CON-Optimized.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_OfficeBuilding_ifc.zip) | IFC2x3 | CoordinationView | Revit MEP | 2011 | 2011-08-15 | structure | 11.07 | tested: complete | 494/498 measured, 0 unmatched | post-processed: Solibri IFC Optimizer; volume_mismatch 431; inconsistent_winding 2; not_watertight 1; no_material 272 |
| [NBU_OfficeBuilding_Eng-CON.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_OfficeBuilding_ifc.zip) | IFC2x3 | CoordinationView | Revit MEP | 2011 | 2011-08-15 | structure | 11.07 | tested: complete | 494/498 measured, 0 unmatched | post-processed: Solibri IFC Optimizer; volume_mismatch 429; inconsistent_winding 2; not_watertight 1; no_material 272 |
| [NBU_OfficeBuilding_Eng-ELE.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_OfficeBuilding_ifc.zip) | IFC2x3 | CoordinationView | Revit | 2013 | 2012-12-18 | electrical | 6.51 | tested: complete | 887/887 measured, 0 unmatched | inconsistent_winding 1; not_watertight 3 |
| [NBU_OfficeBuilding_Eng-HVAC-Optimized.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_OfficeBuilding_ifc.zip) | IFC2x3 | CoordinationView | Revit MEP | 2011 | 2011-09-13 | hvac | 41.89 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy); post-processed: Solibri IFC Optimizer |
| [NBU_OfficeBuilding_Eng-HVAC.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_OfficeBuilding_ifc.zip) | IFC2x3 | CoordinationView | Revit MEP | 2011 | 2011-09-13 | hvac | 65.83 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |
| [NBU_OfficeBuilding_Eng-MEP.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_OfficeBuilding_ifc.zip) | IFC2x3 |  | unknown |  | 2012-03-23 | mep | 4.12 | tested: complete | 1497/1497 measured, 0 unmatched | no_geometry 1497 |

**NVW_DCR-LOD** (8 files, 5 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [NVW_DCR-LOD100_Arch.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NVW_DCR-LOD_ifc.zip) | IFC2x3 |  | Vectorworks | 2010 | 2009-08-03 | architecture | 0.19 | tested: complete | 11/11 measured, 0 unmatched |  |
| [NVW_DCR-LOD200_Arch.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NVW_DCR-LOD_ifc.zip) | IFC2x3 | CoordinationView, SpaceBoundary1stLevelAddOnView, QuantityTakeOffAddOnView | Vectorworks | 2010 SP4 | 2010-09-07 | architecture | 25.3 | tested: needs input | 1705/1789 measured, 0 unmatched | blocking names: Component 0, C-1, Component 0, Default; inconsistent_winding 5; not_watertight 4 |
| [NVW_DCR-LOD200_Eng-CON-1.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NVW_DCR-LOD_ifc.zip) | IFC2x3 | CoordinationView, SpaceBoundary1stLevelAddOnView, QuantityTakeOffAddOnView | Vectorworks | 2010 SP4 | 2010-09-07 | structure | 1.44 | tested: needs input | 479/479 measured, 0 unmatched | blocking names: C-1, Default; inconsistent_winding 1; not_watertight 1 |
| [NVW_DCR-LOD200_Eng-CON-2.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NVW_DCR-LOD_ifc.zip) | IFC2x3 |  | Scia Engineer | 2008 | 2010-05-05 | structure | 9.36 | tested: complete | 1050/1050 measured, 0 unmatched | not_watertight 2 |
| [NVW_DCR-LOD200_Eng-HVAC.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NVW_DCR-LOD_ifc.zip) | IFC2x3 |  | DDS-CAD | 7.1 | 2010-05-28 | hvac | 33.19 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |
| [NVW_DCR-LOD300_Arch.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NVW_DCR-LOD_ifc.zip) | IFC2x3 | CoordinationView, SpaceBoundary1stLevelAddOnView, QuantityTakeOffAddOnView | Vectorworks | 2010 SP4 | 2010-09-14 | architecture | 288.13 | header only |  | not run: 288 MB, over the size cap of this pass |
| [NVW_DCR-LOD300_Eng-CON.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NVW_DCR-LOD_ifc.zip) | IFC2x3 |  | Scia Engineer | 2008 | 2010-07-21 | structure | 11.07 | tested: complete | 1130/1130 measured, 0 unmatched | not_watertight 2 |
| [NVW_DCR-LOD300_Eng-HVAC.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/NVW_DCR-LOD_ifc.zip) | IFC2x3 |  | DDS-CAD | 7.2 | 2010-09-06 | hvac | 24.13 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**SGD_BARD** (2 files, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [SGD_BARD_Arch.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_BARD_ifc.zip) | IFC2x2 |  | DDS-CAD | 6.35 | 2007-03-29 | architecture | 11.54 | unsupported schema |  | IFC2X2_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |
| [SGD_BARD_Merged.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_BARD_ifc.zip) | IFC2x3 |  | DDS-CAD | 6.40 | 2007-03-06 | federated | 43.75 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**SGD_Blueberry** (10 files, 10 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [SGD_Blueberry_Arch-1.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Blueberry_ifc.zip) | IFC2x3 | Coordination View | AutoCAD Architecture | 2009 | 2008-12-04 | architecture | 4.07 | tested: needs input | 194/206 measured, 0 unmatched | blocking names: 148 mm bjelke, 150 mm isolasjon, 19 mm liggende, utvendig panel m/dobbelfals, 198mm taksperr og isolasjon...; inconsistent_winding 2; not_watertight 2; no_geometry 1; no_material 82 |
| [SGD_Blueberry_Arch-2.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Blueberry_ifc.zip) | IFC2x3 |  | DDS-CAD | 6.5 | 2009-08-12 | architecture | 5.74 | tested: needs input | 278/278 measured, 0 unmatched | blocking names: 0.1mm dampsperre, 12mm panel, 13 mm gips, 13mm himlingsplate/gips...; volume_mismatch 70; inconsistent_winding 1; not_watertight 6; no_geometry 50; no_material 14 |
| [SGD_Blueberry_Arch-3.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Blueberry_ifc.zip) | IFC2x3 |  | DDS-CAD | 6.41 | 2008-03-13 | architecture | 8.04 | tested: needs input | 464/2658 measured, 0 unmatched | blocking names: 19 mm kledning, FL-12mm-0-0-1.00, FL-150mm-0-0-1.00, FL-22mm-0-0-1.00...; inconsistent_winding 1; not_watertight 4; no_geometry 191; no_material 254 |
| [SGD_Blueberry_Eng-HVAC-Plumbing-1.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Blueberry_ifc.zip) | IFC2x3 |  | DDS-CAD | 6.5 | 2009-03-27 | plumbing | 3.41 | tested: needs input | 241/241 measured, 0 unmatched | blocking names: ML-110mm x 3.0m PP avl.rør u/muffe, ML-15 x 2.5 mm wirsbo-pex rør i varerør, ML-16 mm sanipex-rør. hvit pex m/sort varerør, ML-22 x 1,5 kobberrør f/kaplodd...; inconsistent_winding 3; not_watertight 4 |
| [SGD_Blueberry_Eng-HVAC-Plumbing-2.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Blueberry_ifc.zip) | IFC2x3 |  | DDS-CAD | 6.5 | 2009-04-17 | plumbing | 4.91 | tested: needs input | 358/358 measured, 0 unmatched | blocking names: ML-110mm x 3.0m PP avl.rør u/muffe, ML-16 mm sanipex-rør. hvit pex m/sort varerør, ML-22 x 1,5 kobberrør f/kaplodd, ML-32mm x 3,0m PP avl.rør u/muffe...; inconsistent_winding 3; not_watertight 4; no_geometry 1 |
| [SGD_Blueberry_Eng-HVAC-Ventilation.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Blueberry_ifc.zip) | IFC2x3 |  | DDS-CAD | 6.5 | 2009-03-27 | hvac | 1.09 | tested: complete | 95/95 measured, 0 unmatched | inconsistent_winding 2; not_watertight 2 |
| [SGD_Blueberry_Eng-HVAC.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Blueberry_ifc.zip) | IFC2x3 |  | DDS-CAD | 6.5 | 2009-04-21 | hvac | 10.67 | tested: needs input | 1218/1218 measured, 0 unmatched | blocking names: ML-1-½"   stålrør m/gj. sorte DN 40, ML-110mm x 3.0m PP avl.rør u/muffe, ML-15 x 1,2 kobberrør f/kaplodd, ML-15 x 2.5 mm wirsbo-pex rør i varerør...; inconsistent_winding 4; not_watertight 5; no_geometry 1 |
| [SGD_Blueberry_Merged-Plumbing-1.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Blueberry_ifc.zip) | IFC2x3 |  | DDS-CAD | 6.5 | 2009-03-27 | federated | 11.56 | tested: needs input | 705/2899 measured, 0 unmatched | blocking names: 19 mm kledning, FL-12mm-0-0-1.00, FL-150mm-0-0-1.00, FL-22mm-0-0-1.00...; inconsistent_winding 4; not_watertight 8; no_geometry 191; no_material 254 |
| [SGD_Blueberry_Merged-Plumbing-2.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Blueberry_ifc.zip) | IFC2x3 |  | DDS-CAD | 6.5 | 2009-04-17 | federated | 13.1 | tested: needs input | 822/3016 measured, 0 unmatched | blocking names: 19 mm kledning, FL-12mm-0-0-1.00, FL-150mm-0-0-1.00, FL-22mm-0-0-1.00...; inconsistent_winding 4; not_watertight 8; no_geometry 192; no_material 254 |
| [SGD_Blueberry_Merged-Ventilation_.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Blueberry_ifc.zip) | IFC2x3 |  | DDS-CAD | 6.5 | 2009-03-27 | federated | 9.18 | tested: needs input | 559/2753 measured, 0 unmatched | blocking names: 19 mm kledning, FL-12mm-0-0-1.00, FL-150mm-0-0-1.00, FL-22mm-0-0-1.00...; inconsistent_winding 3; not_watertight 6; no_geometry 191; no_material 254 |

**SGD_BODO** (5 files, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [SGD_BODO_Arch-1.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_BODO_ifc.zip) | IFC2x2 |  | Archicad | 7.0 | 2003-09-29 | architecture | 23.87 | unsupported schema |  | IFC2X2_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |
| [SGD_BODO_Arch-2.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_BODO_ifc.zip) | IFC2x2 |  | Archicad | 7.0 | 2003-09-29 | architecture | 23.87 | unsupported schema |  | IFC2X2_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |
| [SGD_BODO_Arch-3.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_BODO_ifc.zip) | IFC2x3 |  | Archicad | 10.0 | 2007-09-14 | architecture | 64.1 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |
| [SGD_BODO_Eng-HVAC-Plumbing.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_BODO_ifc.zip) | IFC2x2 |  | DDS-CAD | 6.35 | 2005-04-01 | plumbing | 72.82 | unsupported schema |  | IFC2X2_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |
| [SGD_BODO_Eng-HVAC-Ventilation.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_BODO_ifc.zip) | IFC2x2 |  | DDS-CAD | 6.35 | 2005-04-01 | hvac | 47.23 | unsupported schema |  | IFC2X2_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**SGD_Duplex** (2 files, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [SGD_Duplex_Eng-HVAC-Plumbing.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Duplex_ifc.zip) | IFC2x3 | CoordinationView_V2.0 | DDS-CAD | 8.0 | 2012-06-27 | plumbing | 92.83 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |
| [SGD_Duplex_Eng-HVAC-Ventilation.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Duplex_ifc.zip) | IFC2x3 | CoordinationView_V2.0 | DDS-CAD | 8.0 | 2012-06-29 | hvac | 3.25 | tested: needs input | 95/95 measured, 0 unmatched | blocking names: ML-INGEN PRODUKTER I DATABASEN PASSER KRITERIER, ML-Sirkulær kanal  125 mm, ML-Sirkulær kanal  160 mm, ML-Spirokanal 160mm; inconsistent_winding 1; not_watertight 2; no_geometry 1 |

**SGD_HiTOS** (3 files, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [SGD_HiTOS_Arch.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_HiTOS_ifc.zip) | IFC2x2 |  | Archicad | 10.0 | 2006-10-25 | architecture | 52.86 | unsupported schema |  | IFC2X2_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |
| [SGD_HiTOS_Eng-ELE.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_HiTOS_ifc.zip) | IFC2x3 |  | DDS-CAD | 6.40 | 2007-03-08 | electrical | 7.52 | tested: complete | 829/838 measured, 0 unmatched | inconsistent_winding 3; not_watertight 3; no_geometry 55 |
| [SGD_HiTOS_Eng-HVAC.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_HiTOS_ifc.zip) | IFC2x3 |  | DDS-CAD | 6.40 | 2007-03-08 | hvac | 18.47 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**SGD_Munkerud** (7 files, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [SGD_Munkerud_Arch-1.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Munkerud_ifc.zip) | IFC2x2 |  | Archicad | 7.0 | 2003-09-30 | architecture | 2.96 | unsupported schema |  | IFC2X2_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |
| [SGD_Munkerud_Arch-2.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Munkerud_ifc.zip) | IFC2x2 |  | Archicad | 8.1 | 2004-04-13 | architecture | 4.01 | unsupported schema |  | IFC2X2_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |
| [SGD_Munkerud_Arch-3.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Munkerud_ifc.zip) | IFC2x2 |  | Archicad | 7.0 | 2003-11-19 | architecture | 3.01 | unsupported schema |  | IFC2X2_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |
| [SGD_Munkerud_Eng-ELE.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Munkerud_ifc.zip) | IFC2x2 |  | Archicad | 7.0 | 2006-03-08 | electrical | 15.1 | unsupported schema |  | IFC2X2_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |
| [SGD_Munkerud_Eng-HVAC-Sanitary.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Munkerud_ifc.zip) | IFC2x2 |  | Archicad | 7.0 | 2006-03-08 | plumbing | 10.72 | unsupported schema |  | IFC2X2_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |
| [SGD_Munkerud_Eng-HVAC-Ventilation.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Munkerud_ifc.zip) | IFC2x2 |  | Archicad | 7.0 | 2006-03-08 | hvac | 5.48 | unsupported schema |  | IFC2X2_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |
| [SGD_Munkerud_Merged.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/SGD_Munkerud_ifc.zip) | IFC2x2 |  | Archicad | 7.0 | 2006-03-03 | federated | 35.21 | unsupported schema |  | IFC2X2_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

### OpenIFC Model Repository (Univ. of Auckland)

User-contributed models, 172 files from IFC2.0 to IFC4 and many tools. The old _models/ links on the BIMData page are dead; files are now served from /api/download/<modelFile> (listing: /api/get-ifc-models). Only files up to 61 MB were downloaded and run. Licence: not stated per file; not copied into this repository. Link: https://openifcmodel.cs.auckland.ac.nz

**01beam_profile_basic_rev_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912102-01beam_profile_basic_rev_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912102-01beam_profile_basic_rev_1.ifc) | IFC2x3 |  | Revit Building | 9.1 | 2006-03-31 | structure | 0.09 | tested: complete | 12/12 measured, 0 unmatched | volume_mismatch 12 |

**01beam_profile_para_ac_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912102-01beam_profile_para_ac_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912102-01beam_profile_para_ac_1.ifc) | IFC2x3 |  | Archicad | 9.0 | 2006-01-23 | structure | 0.18 | tested: needs input | 122/122 measured, 0 unmatched | blocking names: 50 % |

**01col_profile_clip_ben_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912103-01col_profile_clip_ben_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912103-01col_profile_clip_ben_1.ifc) | IFC2x3 |  | Bentley TriForma |  |  | structure | 0.01 | tested: needs input | 3/3 measured, 0 unmatched | blocking names: B1010:-:*default column* |

**01columns_basic_all_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912103-01columns_basic_all_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912103-01columns_basic_all_1.ifc) | IFC2x3 |  | Allplan | 2003.1 | 2006-02-13 | structure | 0.01 | tested: complete | 4/4 measured, 0 unmatched |  |

**01doors_explicit_geom_all_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912105-01doors_explicit_geom_all_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912105-01doors_explicit_geom_all_1.ifc) | IFC2x3 |  | Allplan | 2006 | 2006-05-28 | architecture | 0.31 | tested: complete | 4/4 measured, 0 unmatched | not_watertight 1 |

**01railing_brep_ac_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912109-01railing_brep_ac_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912109-01railing_brep_ac_1.ifc) | IFC2x3 |  | Archicad | 9.0 | 2006-05-26 | infrastructure | 0.03 | tested: needs input | 2/2 measured, 0 unmatched | blocking names: 50 % |

**01railing_extrusion_tek_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912109-01railing_extrusion_tek_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912109-01railing_extrusion_tek_1.ifc) | IFC2x3 |  | Tekla Structures | Next | 2006-02-15 | infrastructure | 0.03 | tested: complete | 7/7 measured, 0 unmatched |  |

**01ramp_geometry_ben_2** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912108-01ramp_geometry_ben_2.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912108-01ramp_geometry_ben_2.ifc) | IFC2x3 |  | Bentley TriForma |  |  | unknown | 0.31 | tested: needs input | 1/1 measured, 0 unmatched | blocking names: IFC:-:IfcRamp; not_watertight 1 |

**01RampAsContainer_rev_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912108-01RampAsContainer_rev_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912108-01RampAsContainer_rev_1.ifc) | IFC2x3 |  | Revit Building | 9.1 | 2006-05-22 | unknown | 0.01 | tested: complete | 1/4 measured, 0 unmatched | no_material 2 |

**01RoofWithGeometry_rev_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [09121010-01RoofWithGeometry_rev_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/09121010-01RoofWithGeometry_rev_1.ifc) | IFC2x3 |  | Revit Building | 9.1 | 2006-05-15 | unknown | 0.17 | tested: needs input | 8/8 measured, 0 unmatched | blocking names: Default Roof, Default Roof; volume_mismatch 8 |

**01slab_profile_basic_ac_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912104-01slab_profile_basic_ac_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912104-01slab_profile_basic_ac_1.ifc) | IFC2x3 |  | Archicad | 9.0 | 2006-06-01 | unknown | 0.01 | tested: complete | 3/3 measured, 0 unmatched |  |

**01stair_geom_ac_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912107-01stair_geom_ac_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912107-01stair_geom_ac_1.ifc) | IFC2x3 |  | Archicad | 9.0 | 2006-05-25 | hvac | 0.22 | tested: complete | 1/1 measured, 0 unmatched | not_watertight 1 |

**01stair_geometry_ben_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912107-01stair_geometry_ben_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912107-01stair_geometry_ben_1.ifc) | IFC2x3 |  | Bentley TriForma |  |  | hvac | 0.09 | tested: needs input | 2/2 measured, 0 unmatched | blocking names: C2010:-:*default stair* |

**01wall_layers_number_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912101-01wall_layers_number_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912101-01wall_layers_number_1.ifc) | IFC2x3 |  | unknown |  | 2005-11-18 | unknown | 0.04 | tested: needs input | 12/12 measured, 0 unmatched | blocking names: Airgap, Brickwork, Facing brinkwork, Isolation...; not_watertight 1 |

**01window_brep_ac_1** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912106-01window_brep_ac_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912106-01window_brep_ac_1.ifc) | IFC2x3 |  | Archicad | 9.0 | 2006-06-13 | unknown | 0.11 | invalid |  | STEP syntax error (ifcopenshell cannot read it) |

**02brep_beams_opening_ben_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912102-02brep_beams_opening_ben_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912102-02brep_beams_opening_ben_1.ifc) | IFC2x3 |  | Bentley TriForma |  |  | structure | 0.06 | tested: needs input | 3/3 measured, 0 unmatched | blocking names: B1010:-:*default beam* |

**02col_brep_opening_ben_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912103-02col_brep_opening_ben_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912103-02col_brep_opening_ben_1.ifc) | IFC2x3 |  | Bentley TriForma |  |  | structure | 0.23 | tested: needs input | 4/4 measured, 0 unmatched | blocking names: B1010:-:*default column* |

**02DoorOperationsPlacementInsideWall_rev_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912105-02DoorOperationsPlacementInsideWall_rev_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912105-02DoorOperationsPlacementInsideWall_rev_1.ifc) | IFC2x3 |  | Revit Building | 9.1 | 2006-05-19 | architecture | 0.05 | tested: complete | 10/10 measured, 0 unmatched | volume_mismatch 2 |

**02extruded_beam_open_tek_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912102-02extruded_beam_open_tek_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912102-02extruded_beam_open_tek_1.ifc) | IFC2x3 |  | Tekla Structures | 12.0 | 2006-05-11 | structure | 0.01 | tested: needs input | 2/2 measured, 0 unmatched | blocking names: K40-1 |

**02OpeningsInExtrudedColumns_rev_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912103-02OpeningsInExtrudedColumns_rev_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912103-02OpeningsInExtrudedColumns_rev_1.ifc) | IFC2x3 |  | Revit Building | 9.1 | 2006-05-24 | structure | 0.02 | tested: complete | 4/4 measured, 0 unmatched | no_material 4 |

**02roof_with_openings_ben_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [09121010-02roof_with_openings_ben_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/09121010-02roof_with_openings_ben_1.ifc) | IFC2x3 |  | Bentley TriForma |  |  | unknown | 0.01 | tested: needs input | 1/1 measured, 0 unmatched | blocking names: B1020:-:*default roof* |

**02wall_opening_straight_ac_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912101-02wall_opening_straight_ac_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912101-02wall_opening_straight_ac_1.ifc) | IFC2x3 |  | Archicad | 9.0 | 2006-02-09 | structure | 0.1 | tested: complete | 11/11 measured, 0 unmatched | not_watertight 2 |

**02windows_placement_inside_wall_all_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912106-02windows_placement_inside_wall_all_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912106-02windows_placement_inside_wall_all_1.ifc) | IFC2x3 |  | Allplan | 2006 | 2006-05-31 | architecture | 0.02 | tested: complete | 10/10 measured, 0 unmatched | no_geometry 5 |

**03extruded_slab_openings_all_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912104-03extruded_slab_openings_all_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912104-03extruded_slab_openings_all_1.ifc) | IFC2x3 |  | Allplan | 2006 | 2006-06-04 | unknown | 0.01 | tested: complete | 1/1 measured, 0 unmatched |  |

**03wall_recess_ben_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912101-03wall_recess_ben_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912101-03wall_recess_ben_1.ifc) | IFC2x3 |  | Bentley TriForma |  |  | unknown | 0.02 | tested: needs input | 5/5 measured, 0 unmatched | blocking names: C1010:-:*Default Interior Partition*, C1010:-:*Default Interior Partition* |

**04slab_recess_tek_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912104-04slab_recess_tek_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912104-04slab_recess_tek_1.ifc) | IFC2x3 |  | Tekla Structures | 12.0 | 2006-05-11 | unknown | 0.0 | tested: needs input | 1/1 measured, 0 unmatched | blocking names: K30-2 |

**04wall_L-shape_all_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [0912101-04wall_L-shape_all_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/0912101-04wall_L-shape_all_1.ifc) | IFC2x3 |  | Allplan | 2006.1 | 2006-04-13 | unknown | 0.01 | tested: complete | 4/4 measured, 0 unmatched |  |

**22Wellness center Sama** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [2022020320211122Wellness center Sama.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/2022020320211122Wellness%20center%20Sama.ifc) | IFC2x3 | CoordinationView_V2.0 | Revit | 2021 | 2021-11-21 | unknown | 21.28 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**31Energy Tower** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [2022032920220131Energy Tower.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/2022032920220131Energy%20Tower.ifc) | IFC2x2 |  | Revit Building | 8 | 2022-01-29 | unknown | 10.56 | unsupported schema |  | IFC2X2_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**AC-11-Smiley-West-04-07-2007** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [231110AC-11-Smiley-West-04-07-2007.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/231110AC-11-Smiley-West-04-07-2007.ifc) | IFC2x3 |  | Archicad | 10.0 | 2007-07-05 | architecture | 3.37 | tested: needs input | 412/412 measured, 0 unmatched | blocking names: Gips, Massiv, Gips, Leer...; volume_mismatch 25; not_watertight 4; no_material 6 |

**AC11-FZK-Haus-IFC** (2 files, 2 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20180425231110AC11-FZK-Haus-IFC.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20180425231110AC11-FZK-Haus-IFC.ifc) | IFC2x3 |  | Archicad | 11.0 | 2008-07-01 | architecture | 4.15 | tested: needs input | 95/110 measured, 0 unmatched | blocking names: Leichtbeton, Solid, Leichtbeton, Radial Gradient Fill...; volume_mismatch 1; inconsistent_winding 1; not_watertight 6 |
| [231110AC11-FZK-Haus-IFC.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/231110AC11-FZK-Haus-IFC.ifc) | IFC2x3 |  | Archicad | 11.0 | 2008-07-01 | architecture | 4.15 | tested: needs input | 95/110 measured, 0 unmatched | blocking names: Leichtbeton, Solid, Leichtbeton, Radial Gradient Fill...; volume_mismatch 1; inconsistent_winding 1; not_watertight 6 |

**AC11-Institute-Var-2-IFC** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [231110AC11-Institute-Var-2-IFC.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/231110AC11-Institute-Var-2-IFC.ifc) | IFC2x3 |  | Archicad | 11.0 | 2008-07-03 | architecture | 2.84 | tested: needs input | 446/699 measured, 0 unmatched | blocking names: Leer; volume_mismatch 6; inconsistent_winding 1; not_watertight 2 |

**AC20-FZK-Haus** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20201030AC20-FZK-Haus.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20201030AC20-FZK-Haus.ifc) | IFC4 | , QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 20.0 | 2016-12-21 | architecture | 2.57 | tested: needs input | 82/82 measured, 0 unmatched | blocking names: Leichtbeton 102890359, Solid 397409098, Leichtbeton 102890359, Radial Gradient Fill 1515460218...; volume_mismatch 9; not_watertight 3 |

**ADT-FZK-Haus-2005-2006** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [231110ADT-FZK-Haus-2005-2006.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/231110ADT-FZK-Haus-2005-2006.ifc) | IFC2x |  | Architectural Desktop (ADT) |  | 2006-07-28 | architecture | 2.9 | unsupported schema |  | IFC2X_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**ADT-Smiley-West-5-Buildings-14-10-2005** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [261110ADT-Smiley-West-5-Buildings-14-10-2005.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/261110ADT-Smiley-West-5-Buildings-14-10-2005.ifc) | IFC2x |  | Architectural Desktop (ADT) |  | 2005-10-14 | architecture | 8.37 | unsupported schema |  | IFC2X_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**ADT-Smiley-West-Project-14-10-2005** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [261110ADT-Smiley-West-Project-14-10-2005.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/261110ADT-Smiley-West-Project-14-10-2005.ifc) | IFC2x |  | Architectural Desktop (ADT) |  | 2005-10-14 | architecture | 8.3 | unsupported schema |  | IFC2X_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**AISC_Sculpture_brep** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [171210AISC_Sculpture_brep.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/171210AISC_Sculpture_brep.ifc) | IFC2x3 |  | unknown |  |  | structure | 0.56 | tested: needs input | 417/466 measured, 0 unmatched | 3 missing quantities; not_watertight 3; no_geometry 66; no_material 9 |

**AISC_Sculpture_param** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [171210AISC_Sculpture_param.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/171210AISC_Sculpture_param.ifc) | IFC2x3 |  | unknown |  |  | structure | 0.32 | tested: complete | 417/466 measured, 0 unmatched | not_watertight 1; no_geometry 66; no_material 9 |

**Allplan-2008-Institute-Var-2-IFC** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [261110Allplan-2008-Institute-Var-2-IFC.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/261110Allplan-2008-Institute-Var-2-IFC.ifc) | IFC2x3 | Coordination View | Allplan | 2008 | 2008-07-03 | architecture | 6.11 | tested: needs input | 424/424 measured, 0 unmatched | blocking names: Betondecke\,  100/150 1.flgl.-D,  100/210 1 flgl., Umfz., offen,  180/210 2 flgl., Umfz., offen...; not_watertight 3; no_geometry 206 |

**Allplan-Smiley-West** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [261110Allplan-Smiley-West.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/261110Allplan-Smiley-West.ifc) | IFC2x |  | Allplan | 2003.1 | 2005-06-03 | architecture | 4.08 | unsupported schema |  | IFC2X_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**analysis_brep** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [171210analysis_brep.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/171210analysis_brep.ifc) | IFC2x3 |  | unknown |  |  | structure | 3.89 | tested: complete | 2208/2208 measured, 0 unmatched | no_material 2208 |

**analysis_param** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [171210analysis_param.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/171210analysis_param.ifc) | IFC2x3 |  | unknown |  |  | structure | 3.29 | tested: complete | 2208/2208 measured, 0 unmatched | no_material 2208 |

**APHS 5-3-19** (2 files, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [2019030617043 - APHS 5-3-19.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/2019030617043%20-%20APHS%205-3-19.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 2017 Service Pack 10 | 2019-03-05 | unknown | 68.37 | header only |  | not run: 68 MB, over the size cap of this pass |
| [2019030617043 - APHS 5-3-19.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/2019030617043%20-%20APHS%205-3-19.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 2017 Service Pack 10 | 2019-03-05 | unknown | 68.37 | header only |  | not run: 68 MB, over the size cap of this pass |

**ARA_ASH_S3B_ARCHITECTURE_wall** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20211108ARA_ASH_S3B_ARCHITECTURE_wall.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20211108ARA_ASH_S3B_ARCHITECTURE_wall.ifc) | IFC2x3 | CoordinationView_V2.0 | Revit | 2019 | 2021-07-06 | architecture | 94.22 | header only |  | not run: 94 MB, over the size cap of this pass |

**Architecture** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20210219Architecture.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20210219Architecture.ifc) | IFC2x3 | CoordinationView_V2.0 | Revit | 2019 | 2020-08-14 | architecture | 113.33 | header only |  | not run: 113 MB, over the size cap of this pass |

**Autodesk_Hospital_Parking Garage_2015** (2 files, 2 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125Autodesk_Hospital_Parking Garage_2015.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125Autodesk_Hospital_Parking%20Garage_2015.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-25 | architecture | 6.41 | tested: needs input | 810/1271 measured, 0 unmatched | blocking names: Air Barrier - Air Infiltration Barrier, Conc Shell, Conc Slab, Door - Hardware...; volume_mismatch 14; inconsistent_winding 1; not_watertight 4; no_geometry 1 |
| [20160125Autodesk_Hospital_Parking Garage_2015.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125Autodesk_Hospital_Parking%20Garage_2015.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-25 | architecture | 6.41 | tested: needs input | 810/1271 measured, 0 unmatched | blocking names: Air Barrier - Air Infiltration Barrier, Conc Shell, Conc Slab, Door - Hardware...; volume_mismatch 14; inconsistent_winding 1; not_watertight 4; no_geometry 1 |

**Autodesk_Hospital_Parking Garage_2015 - IFC4** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125Autodesk_Hospital_Parking Garage_2015 - IFC4.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125Autodesk_Hospital_Parking%20Garage_2015%20-%20IFC4.ifc) | IFC4 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-25 | architecture | 6.45 | tested: needs input | 810/1271 measured, 0 unmatched | blocking names: Air Barrier - Air Infiltration Barrier, Conc Shell, Conc Slab, Door - Hardware...; volume_mismatch 14; inconsistent_winding 1; not_watertight 4; no_geometry 1 |

**AZUMA9** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20191126AZUMA9.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20191126AZUMA9.ifc) | IFC2x3 | CoordinationView_V2.0, SurfaceGeometryAddOnView | Archicad | 23.0 | 2019-11-21 | architecture | 10.49 | tested: complete | 101/119 measured, 0 unmatched | inconsistent_winding 2; not_watertight 5; no_material 3 |

**Bentley1_brep** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [171210Bentley1_brep.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/171210Bentley1_brep.ifc) | IFC2x3 |  | unknown |  |  | architecture | 1.91 | tested: complete | 664/664 measured, 0 unmatched | no_material 6 |

**Bentley1_param** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [171210Bentley1_param.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/171210Bentley1_param.ifc) | IFC2x3 |  | unknown |  |  | architecture | 0.49 | tested: complete | 664/664 measured, 0 unmatched | no_material 6 |

**berlin_schoeneweide_2001** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [202107010001_berlin_schoeneweide_2001.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/202107010001_berlin_schoeneweide_2001.ifc) | IFC2.0 |  | Archicad | 8.0 | 2018-09-07 | unknown | 13.64 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**CADstudio_brep** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [171210CADstudio_brep.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/171210CADstudio_brep.ifc) | IFC2x3 |  | unknown |  |  | structure | 1.02 | tested: complete | 464/464 measured, 0 unmatched | no_material 464 |

**casbah_alger** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [202101082003_casbah_alger.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/202101082003_casbah_alger.ifc) | IFC4 | ReferenceView_V1.2 | Archicad | 23.0 | 2020-12-15 | unknown | 44.74 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**cira** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [202103162102_cira.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/202103162102_cira.ifc) | IFC4 | ReferenceView_V1.2 | Archicad | 23.0 | 2021-03-10 | architecture | 10.62 | tested: needs input | 430/583 measured, 0 unmatched | blocking names: Cloison - Carreaux de plâtre, Couche - Protection mécanique, Eau, Fer...; inconsistent_winding 3; not_watertight 14 |

**curtain_wall_basic_rev_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [09121011curtain_wall_basic_rev_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/09121011curtain_wall_basic_rev_1.ifc) | IFC2x3 |  | Revit Building | 9.1 | 2006-04-13 | structure | 0.07 | tested: complete | 1/57 measured, 0 unmatched |  |

**cutouts_brep** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [171210cutouts_brep.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/171210cutouts_brep.ifc) | IFC2x3 |  | SDS/2 |  |  | structure | 0.02 | tested: complete | 2/3 measured, 0 unmatched | no_material 2 |

**CV** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20200404CV.01.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20200404CV.01.ifc) | IFC2x3 | CoordinationView | TopSolid | 1.0 | 2016-12-19 | architecture | 12.43 | tested: complete | 233/493 measured, 27 unmatched | unmatched: IfcElementAssembly x7; no_geometry 25 |

**DesignData1_brep** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [171210DesignData1_brep.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/171210DesignData1_brep.ifc) | IFC2x3 |  | unknown |  |  | architecture | 0.5 | tested: needs input | 781/818 measured, 0 unmatched | 6 missing quantities; not_watertight 1; no_geometry 122 |

**DesignData3_brep** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [171210DesignData3_brep.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/171210DesignData3_brep.ifc) | IFC2x3 |  | unknown |  |  | architecture | 1.28 | tested: needs input | 840/1017 measured, 0 unmatched | 10 missing quantities; not_watertight 1; no_material 196 |

**DigitalHub_ARC** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20201208DigitalHub_ARC.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20201208DigitalHub_ARC.ifc) | IFC4 | DesignTransferView_V1.0 | Revit | 2019 | 2020-09-04 | architecture | 14.32 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**DigitalHub_HZG** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20201208DigitalHub_HZG.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20201208DigitalHub_HZG.ifc) | IFC4 | DesignTransferView_V1.0 | Revit | 2019 | 2020-07-27 | mep | 9.87 | tested: needs input | 1707/1707 measured, 0 unmatched | blocking names:  <Unnamed>; inconsistent_winding 5; not_watertight 5 |

**DigitalHub_LFT** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20201208DigitalHub_LFT.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20201208DigitalHub_LFT.ifc) | IFC4 | DesignTransferView_V1.0 | Revit | 2019 | 2020-08-25 | mep | 7.37 | tested: needs input | 1309/1309 measured, 0 unmatched | blocking names:  <Unnamed>; inconsistent_winding 2; not_watertight 10 |

**DigitalHub_SAN** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20201208DigitalHub_SAN.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20201208DigitalHub_SAN.ifc) | IFC4 | ReferenceView_V1.2 | Revit | 2019 | 2020-07-06 | plumbing | 16.85 | tested: needs input | 1012/1012 measured, 0 unmatched | blocking names:  <Unnamed>; inconsistent_winding 1; not_watertight 6 |

**Dubal Herrera limpio** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20180731Dubal Herrera limpio.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20180731Dubal%20Herrera%20limpio.ifc) | IFC2x3 | CoordinationView_V2.0 | Revit | 2019 | 2018-07-30 | unknown | 24.41 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**DuplexModel-IFC-2011-05-05** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [030811DuplexModel-IFC-2011-05-05.zip](https://openifcmodel.cs.auckland.ac.nz/api/download/030811DuplexModel-IFC-2011-05-05.zip) |  |  | unknown |  |  | architecture |  | unavailable |  | HTTP Error 404: Not Found |

**eccentricity_physical** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [171210eccentricity_physical.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/171210eccentricity_physical.ifc) | IFC2x3 |  | STEP Caselib |  |  | structure | 0.0 | tested: complete | 1/1 measured, 0 unmatched | no_material 1 |

**Energy Tower** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20220131Energy Tower.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20220131Energy%20Tower.ifc) | IFC2x2 |  | Revit Building | 8 | 2022-01-29 | unknown | 10.56 | unsupported schema |  | IFC2X2_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**Ettenheim-GIS-05-11-2006** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [261110Ettenheim-GIS-05-11-2006.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/261110Ettenheim-GIS-05-11-2006.ifc) | IFC2x |  | Architectural Desktop (ADT) |  | 2006-11-09 | unknown | 31.07 | unsupported schema |  | IFC2X_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**Ettenheim-GIS-05-11-2006_optimized** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [261110Ettenheim-GIS-05-11-2006_optimized.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/261110Ettenheim-GIS-05-11-2006_optimized.ifc) | IFC2x |  | Architectural Desktop (ADT) |  | 2006-11-09 | unknown | 18.38 | unsupported schema |  | IFC2X_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3; post-processed: Solibri IFC Optimizer |

**FJK-Project-Final** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [301110FJK-Project-Final.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/301110FJK-Project-Final.ifc) | IFC2x |  | Architectural Desktop (ADT) |  | 2006-10-05 | unknown | 14.62 | unsupported schema |  | IFC2X_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**FM_ARC_DigitalHub** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20201208FM_ARC_DigitalHub.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20201208FM_ARC_DigitalHub.ifc) | IFC4 | DesignTransferView_V1.0 | Revit | 2019 | 2020-09-04 | architecture | 14.32 | tested: needs input | 597/720 measured, 0 unmatched | blocking names: Faserzementplatte (Equitone - natura), Fußbodenaufbau, Trockenbau - Gipsplatte, Dachdeckung - Bitumenbahn...; inconsistent_winding 3; not_watertight 6; no_geometry 6; no_material 4 |

**FM_HZG_DigitalHub** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20201208FM_HZG_DigitalHub.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20201208FM_HZG_DigitalHub.ifc) | IFC4 | DesignTransferView_V1.0 | Revit | 2019 | 2020-07-27 | mep | 9.87 | tested: needs input | 1707/1707 measured, 0 unmatched | blocking names:  <Unnamed>; inconsistent_winding 5; not_watertight 5 |

**FM_LFT_DigitalHub** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20201208FM_LFT_DigitalHub.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20201208FM_LFT_DigitalHub.ifc) | IFC4 | DesignTransferView_V1.0 | Revit | 2019 | 2020-08-25 | mep | 7.37 | tested: needs input | 1309/1309 measured, 0 unmatched | blocking names:  <Unnamed>; inconsistent_winding 2; not_watertight 10 |

**FM_SAN_DigitalHub** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20201208FM_SAN_DigitalHub.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20201208FM_SAN_DigitalHub.ifc) | IFC4 | ReferenceView_V1.2 | Revit | 2019 | 2020-07-06 | unknown | 16.85 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**footing_ac_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [09121015footing_ac_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/09121015footing_ac_1.ifc) | IFC2x3 |  | Archicad | 9.0 | 2006-05-29 | structure | 0.09 | tested: needs input | 9/9 measured, 0 unmatched | blocking names: 50 % |

**FZK-Haus-EliteCAD** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [301110FZK-Haus-EliteCAD.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/301110FZK-Haus-EliteCAD.ifc) | IFC2x3 | CoordinationView | EliteCAD | 2008 | 2008-06-20 | architecture | 7.36 | tested: needs input | 111/113 measured, 0 unmatched | blocking names: Bodenaufbau, Dachziegel, Porenbeton, Bodenaufbau...; inconsistent_winding 2; not_watertight 3 |

**Gebaeude-Gruppe** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [301110Gebaeude-Gruppe.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/301110Gebaeude-Gruppe.ifc) | IFC2x |  | Architectural Desktop (ADT) |  | 2006-01-16 | unknown | 8.91 | unsupported schema |  | IFC2X_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**GEN_DOE_GSE_ARC_Exploit** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20201126GEN_DOE_GSE_ARC_Exploit.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20201126GEN_DOE_GSE_ARC_Exploit.ifc) | IFC2x3 | CoordinationView_V2.0 | Revit | 2019 | 2019-11-06 | architecture | 112.61 | header only |  | not run: 113 MB, over the size cap of this pass |

**Holter_Tower_10** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20181220Holter_Tower_10.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20181220Holter_Tower_10.ifc) | IFC4 | Design_Transfer_View | Archicad | 20.0 | 2017-05-16 | unknown | 177.47 | header only |  | not run: 177 MB, over the size cap of this pass |

**IFC4_Convenience_store_Renga_4** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20200820IFC4_Convenience_store_Renga_4.1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20200820IFC4_Convenience_store_Renga_4.1.ifc) | IFC4 | \X2\0414041B042F\X0\ \X2\041F0420041E0425041E041604140415041D0418042F\X0\ \X2\042D041A0421041F04150420042204180417042B\X0\ | Renga | 4.1 | 2020-08-18 | unknown | 18.73 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**IFC4_RV_Convenience_store_Renga_4** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20210215IFC4_RV_Convenience_store_Renga_4.5.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20210215IFC4_RV_Convenience_store_Renga_4.5.ifc) | IFC4 | \X2\0414041B042F\X0\ \X2\041F0420041E0425041E041604140415041D0418042F\X0\ \X2\042D041A0421041F04150420042204180417042B\X0\ | Renga | 4.5 | 2021-02-15 | architecture | 10.16 | tested: needs input | 2346/5294 measured, 2 unmatched | blocking names: Бетон, Воздух, Газобетон, Изоляция...; unmatched: IfcRampFlight x1, IfcStairFlight x1; not_watertight 5; no_geometry 567; no_material 63 |

**ifc_saxion_28-09-2016** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20190228ifc_saxion_28-09-2016.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20190228ifc_saxion_28-09-2016.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 20.0 | 2016-09-28 | unknown | 25.3 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**IFCR2_Buildings_1** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [23111022_IFCR2_Buildings_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/23111022_IFCR2_Buildings_1.ifc) | IFC2.0 |  | Microsoft Visio |  |  | unknown | 0.07 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Buildings_2** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [23111023_IFCR2_Buildings_2.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/23111023_IFCR2_Buildings_2.ifc) | IFC2.0 |  | Archicad | 6.5 |  | unknown | 0.21 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_Beams_1** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [29101001_IFCR2_Geo_Beams_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/29101001_IFCR2_Geo_Beams_1.ifc) | IFC2.0 |  | Microsoft Visio |  |  | unknown | 0.04 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_Columns_1** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [05111002_IFCR2_Geo_Columns_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/05111002_IFCR2_Geo_Columns_1.ifc) | IFC2.0 |  | Microsoft Visio |  |  | unknown | 0.03 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_Doors_1** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [13111003_IFCR2_Geo_Doors_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/13111003_IFCR2_Geo_Doors_1.ifc) | IFC2.0 |  | unknown |  |  | unknown | 0.15 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_FloorSlabs_1** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [13111004_IFCR2_Geo_FloorSlabs_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/13111004_IFCR2_Geo_FloorSlabs_1.ifc) | IFC2.0 |  | Microsoft Visio |  |  | unknown | 0.01 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_FloorSlabs_2** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [13111005_IFCR2_Geo_FloorSlabs_2.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/13111005_IFCR2_Geo_FloorSlabs_2.ifc) | IFC2.0 |  | Microsoft Visio |  |  | unknown | 0.03 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_Openings_1** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [13111006_IFCR2_Geo_Openings_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/13111006_IFCR2_Geo_Openings_1.ifc) | IFC2.0 |  | Microsoft Visio |  |  | unknown | 0.02 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_Openings_2** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [13111007_IFCR2_Geo_Openings_2.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/13111007_IFCR2_Geo_Openings_2.ifc) | IFC2.0 |  | Microsoft Visio |  |  | unknown | 0.01 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_Openings_3** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [13111008_IFCR2_Geo_Openings_3.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/13111008_IFCR2_Geo_Openings_3.ifc) | IFC2.0 |  | Archicad | 6.5 |  | unknown | 0.01 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_RoofSlabs_1** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [13111009_IFCR2_Geo_RoofSlabs_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/13111009_IFCR2_Geo_RoofSlabs_1.ifc) | IFC2.0 |  | Archicad | 6.5 |  | unknown | 0.05 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_Spaces_1** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [13111010_IFCR2_Geo_Spaces_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/13111010_IFCR2_Geo_Spaces_1.ifc) | IFC2.0 |  | Microsoft Visio |  |  | unknown | 0.02 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_Spaces_2** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [23111011_IFCR2_Geo_Spaces_2.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/23111011_IFCR2_Geo_Spaces_2.ifc) | IFC2.0 |  | Microsoft Visio |  |  | unknown | 0.05 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_Walls_1** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [23111012_IFCR2_Geo_Walls_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/23111012_IFCR2_Geo_Walls_1.ifc) | IFC2.0 |  | Microsoft Visio |  |  | unknown | 0.01 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_Walls_2** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [23111013_IFCR2_Geo_Walls_2.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/23111013_IFCR2_Geo_Walls_2.ifc) | IFC2.0 |  | Microsoft Visio |  |  | unknown | 0.02 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_Walls_3** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [23111014_IFCR2_Geo_Walls_3.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/23111014_IFCR2_Geo_Walls_3.ifc) | IFC2.0 |  | Microsoft Visio |  |  | unknown | 0.02 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_Walls_4** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [23111015_IFCR2_Geo_Walls_4.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/23111015_IFCR2_Geo_Walls_4.ifc) | IFC2.0 |  | Microsoft Visio |  |  | unknown | 0.03 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_Walls_5** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [23111016_IFCR2_Geo_Walls_5.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/23111016_IFCR2_Geo_Walls_5.ifc) | IFC2.0 |  | Archicad | 6.5 |  | unknown | 0.02 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_Walls_7** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [23111017_IFCR2_Geo_Walls_7.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/23111017_IFCR2_Geo_Walls_7.ifc) | IFC2.0 |  | Archicad | 6.5 |  | unknown | 0.01 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Geo_Windows_1** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [23111018_IFCR2_Geo_Windows_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/23111018_IFCR2_Geo_Windows_1.ifc) | IFC2.0 |  | Microsoft Visio |  |  | unknown | 0.03 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Prop_Assets_1** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [23111019_IFCR2_Prop_Assets_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/23111019_IFCR2_Prop_Assets_1.ifc) | IFC2.0 |  | Microsoft Visio |  |  | unknown | 0.03 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**IFCR2_Prop_BldgElem_1** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [23111020_IFCR2_Prop_BldgElem_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/23111020_IFCR2_Prop_BldgElem_1.ifc) | IFC2.0 |  | Microsoft Visio |  |  | unknown | 0.02 | unsupported schema |  | IFC20_LONGFORM: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**ISO9705revit9-c** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [091210ISO9705revit9-c.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/091210ISO9705revit9-c.ifc) | IFC2x2 |  | Revit Building | 9 | 2006-09-10 | unknown | 0.04 | unsupported schema |  | IFC2X2_FINAL: the engine (ifcopenshell) reads IFC2X3, IFC4 and IFC4X3 |

**KT-ZCB (combined)** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20220221KT-ZCB (combined).ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20220221KT-ZCB%20%28combined%29.ifc) | IFC2x3 | CoordinationView | Revit | 2020 | 2021-09-30 | federated | 117.19 | header only |  | not run: 117 MB, over the size cap of this pass |

**Ludi-prof-h-80-w-50** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20191030Ludi-prof-h-80-w-50.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20191030Ludi-prof-h-80-w-50.ifc) | IFC2x3 | CoordinationView_V2.0 | Archicad | 22.0 | 2019-08-27 | structure | 0.01 | tested: complete | 1/1 measured, 0 unmatched |  |

**mapping IFC4 Convenience store** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20201022mapping IFC4 Convenience store.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20201022mapping%20IFC4%20Convenience%20store.ifc) | IFC4 | \X2\0414041B042F\X0\ \X2\041F0420041E0425041E041604140415041D0418042F\X0\ \X2\042D041A0421041F04150420042204180417042B\X0\ | Renga | 4.3 | 2020-10-21 | architecture | 11.09 | tested: needs input | 2127/5075 measured, 2 unmatched | blocking names: Бетон, Воздух, Газобетон, Изоляция...; unmatched: IfcRampFlight x1, IfcStairFlight x1; not_watertight 5; no_geometry 567; no_material 63 |

**Mechanical Piping** (2 files, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20191002Mechanical Piping.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20191002Mechanical%20Piping.ifc) | IFC2x3 | CoordinationView_V2.0 | Revit | 2019 | 2019-09-27 | hvac | 43.63 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |
| [20201027Mechanical Piping.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20201027Mechanical%20Piping.ifc) | IFC2x3 | CoordinationView_V2.0 | Revit | 2019 | 2019-09-27 | hvac | 43.63 | tested: needs input | 8525/8525 measured, 0 unmatched | blocking names: Cast Iron - Red, Clearance, Error Box, Paint - Zurn - Black...; inconsistent_winding 2; not_watertight 5; no_material 280 |

**mem_profile_basic_tek_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [09121012mem_profile_basic_tek_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/09121012mem_profile_basic_tek_1.ifc) | IFC2x3 |  | Tekla Structures | 12.0 | 2006-02-02 | structure | 0.01 | tested: complete | 7/7 measured, 0 unmatched |  |

**miniExample20080731_CoordView_SweptSolid** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [301110miniExample20080731_CoordView_SweptSolid.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/301110miniExample20080731_CoordView_SweptSolid.ifc) | IFC2x3 | CoordinationView, QuantityTakeOffAddOnView | IFC Engine DLL (test app) | 0.10 | 2008-08-01 | architecture | 0.01 | tested: needs input | 2/2 measured, 0 unmatched | blocking names: Name of the material used for the wall, Name of the material used for the wall |

**miniExample20080731_CoordView_SweptSolid_optimized** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [301110miniExample20080731_CoordView_SweptSolid_optimized.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/301110miniExample20080731_CoordView_SweptSolid_optimized.ifc) | IFC2x3 | CoordinationView, QuantityTakeOffAddOnView | IFC Engine DLL (test app) | 0.10 | 2008-08-01 | architecture | 0.01 | tested: needs input | 2/2 measured, 0 unmatched | post-processed: Solibri IFC Optimizer; blocking names: Name of the material used for the wall, Name of the material used for the wall |

**Model** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [202102183458-Model.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/202102183458-Model.ifc) | IFC2x3 | CoordinationView_V2.0 | Revit | 2021 | 2021-02-18 | structure | 0.42 | tested: needs input | 116/116 measured, 0 unmatched | blocking names:  <Unnamed>; not_watertight 1; no_material 2 |

**MODEL LED SCREED 29032022** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20220402MODEL LED SCREED 29032022.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20220402MODEL%20LED%20SCREED%2029032022.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 2020 Service Pack 5 | 2022-03-29 | architecture | 5.19 | tested: needs input | 4124/4427 measured, 0 unmatched | blocking names: 8.8XOX, 8.8_Gav, HOLE, Undefined/SS400...; volume_mismatch 593; not_watertight 3; no_geometry 481 |

**MODEL REV01** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20220421MODEL REV01.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20220421MODEL%20REV01.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 2016i | 2022-04-20 | structure | 0.7 | tested: needs input | 788/788 measured, 0 unmatched | blocking names: 8.8XOX; volume_mismatch 283; inconsistent_winding 1; not_watertight 1 |

**Model_PNO** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20200205Model_PNO.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20200205Model_PNO.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 2017 Service Pack 12 | 2020-02-04 | structure | 0.16 | tested: needs input | 110/220 measured, 0 unmatched | blocking names: MISCELLANEOUS/8.8.2 |

**Nem-FZK-Haus-2x3** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [301110Nem-FZK-Haus-2x3.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/301110Nem-FZK-Haus-2x3.ifc) | IFC2x3 |  | Allplan | 2006 | 2007-02-16 | architecture | 10.4 | tested: needs input | 49/49 measured, 0 unmatched | blocking names: Betondecke\, Betondecke\; inconsistent_winding 1; not_watertight 5 |

**NG3-009** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20210111NG3-009.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20210111NG3-009.ifc) | IFC2x3 | AISC_Steel_Detailing | Tekla Structures | 2020 | 2020-12-08 | structure | 11.27 | tested: needs input | 9401/10743 measured, 0 unmatched | blocking names: Undefined; not_watertight 1; no_geometry 1780 |

**office_model_CV2_fordesign** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160414office_model_CV2_fordesign.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160414office_model_CV2_fordesign.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 19.0 | 2016-04-14 | architecture | 3.18 | tested: needs input | 71/71 measured, 0 unmatched | blocking names: Background Fill; volume_mismatch 35; not_watertight 3 |

**office_model_CV2b_fordesign** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160613office_model_CV2b_fordesign.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160613office_model_CV2b_fordesign.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 19.0 | 2016-06-07 | architecture | 3.16 | tested: needs input | 69/69 measured, 0 unmatched | blocking names: Background Fill; volume_mismatch 39; not_watertight 3 |

**OTC-Conference Center** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160124OTC-Conference Center.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160124OTC-Conference%20Center.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2015-08-14 | unknown | 70.33 | header only |  | not run: 70 MB, over the size cap of this pass |

**OTC-Conference Center - IFC4** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125OTC-Conference Center - IFC4.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125OTC-Conference%20Center%20-%20IFC4.ifc) | IFC4 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-24 | unknown | 71.7 | header only |  | not run: 72 MB, over the size cap of this pass |

**out-001** (2 files, 2 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20190828out-001.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20190828out-001.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 2018i | 2019-08-05 | structure | 0.1 | tested: needs input | 34/36 measured, 0 unmatched | blocking names: A706-60 |
| [20190828out-001.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20190828out-001.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 2018i | 2019-08-05 | structure | 0.1 | tested: needs input | 34/36 measured, 0 unmatched | blocking names: A706-60 |

**PART02_Wilfer_200302_20070209_IFC** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [301110PART02_Wilfer_200302_20070209_IFC.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/301110PART02_Wilfer_200302_20070209_IFC.ifc) | IFC2x3 |  | VDI3805 viewer | 2.0 | 2007-04-12 | mep | 0.73 | tested: complete | 1/1 measured, 0 unmatched | not_watertight 1 |

**PART03_Buderus_200406_20070209_ifc** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [301110PART03_Buderus_200406_20070209_ifc.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/301110PART03_Buderus_200406_20070209_ifc.ifc) | IFC2x3 |  | VDI3805 viewer | 2.0 | 2007-04-12 | mep | 0.65 | tested: complete | 1/1 measured, 0 unmatched | not_watertight 1 |

**PART06_Kermi_200405_20070401_IFC** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [301110PART06_Kermi_200405_20070401_IFC.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/301110PART06_Kermi_200405_20070401_IFC.ifc) | IFC2x3 |  | VDI3805 viewer | 2.0 | 2007-04-12 | mep | 2.46 | tested: complete | 1/1 measured, 0 unmatched | not_watertight 1 |

**pile_basic_tek_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [09121014pile_basic_tek_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/09121014pile_basic_tek_1.ifc) | IFC2x3 |  | Tekla Structures | Next | 2006-02-20 | structure | 0.01 | tested: needs input | 6/6 measured, 0 unmatched | blocking names: K30-2, K40-1 |

**plate_steel_exam_tek_1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [09121013plate_steel_exam_tek_1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/09121013plate_steel_exam_tek_1.ifc) | IFC2x3 |  | Tekla Structures | 12.0 | 2006-05-12 | structure | 0.02 | tested: complete | 14/14 measured, 0 unmatched |  |

**PlayersTheater_param** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [171210PlayersTheater_param.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/171210PlayersTheater_param.ifc) | IFC2x3 |  | unknown |  |  | structure | 4.26 | tested: needs input | 5345/6821 measured, 0 unmatched | 144 missing quantities; inconsistent_winding 1; not_watertight 3; no_geometry 39; no_material 995 |

**PRIMARK** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20210221PRIMARK.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20210221PRIMARK.ifc) | IFC2x3 | AISC_Steel_Detailing | Tekla Structures | 21.1 Service Release 10 | 2019-02-26 | structure | 12.9 | tested: needs input | 8420/11451 measured, 447 unmatched | blocking names: 931-8.8; unmatched: IfcElementAssembly x1; no_geometry 847 |

**profiles_brep** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [171210profiles_brep.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/171210profiles_brep.ifc) | IFC2x3 |  | SteelVis (CIS/2 translator) | 8.03 |  | structure | 0.06 | tested: complete | 28/28 measured, 0 unmatched |  |

**profilescp1_brep** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [171210profilescp1_brep.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/171210profilescp1_brep.ifc) | IFC2x3 |  | unknown |  |  | structure | 0.09 | tested: complete | 40/40 measured, 0 unmatched |  |

**Prova** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20210125Prova.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20210125Prova.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Edificius | BIM 2(m) | 2020-11-20 | mep | 9.4 | tested: needs input | 97/101 measured, 0 unmatched | blocking names: <nessuno>, Soletta piana laterocemento isolata, <nessuno>, Alluminio semilucidato...; volume_mismatch 4; inconsistent_winding 1; not_watertight 7; double_claim 5 |

**rac_advanced_sample_project** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20200109rac_advanced_sample_project.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20200109rac_advanced_sample_project.ifc) | IFC2x3 | CoordinationView_V2.0 | Revit | 2019 | 2019-12-15 | unknown | 54.06 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**RME_2010_Trapelo_const** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125RME_2010_Trapelo_const.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125RME_2010_Trapelo_const.ifc) | IFC4 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-23 | hvac | 65.31 | header only |  | not run: 65 MB, over the size cap of this pass |

**RME_2010_Trapelo_const-E20-F** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125RME_2010_Trapelo_const-E20-F.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125RME_2010_Trapelo_const-E20-F.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2015-08-08 | hvac | 67.78 | header only |  | not run: 68 MB, over the size cap of this pass |

**RST_2010_Trapelo** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125RST_2010_Trapelo.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125RST_2010_Trapelo.ifc) | IFC4 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-24 | structure | 3.6 | tested: needs input | 1297/1342 measured, 0 unmatched | blocking names: Default Wall, Default Wall; volume_mismatch 1073; not_watertight 1 |

**SD-M-1637-L55-IFC 200318** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20200318SD-M-1637-L55-IFC 200318.IFC](https://openifcmodel.cs.auckland.ac.nz/api/download/20200318SD-M-1637-L55-IFC%20200318.IFC) | IFC2x3 | PresentationView | Autodesk Fabrication | 5.5.201.0 | 2012-01-01 | structure | 60.42 | tested: complete | 1302/1302 measured, 0 unmatched | inconsistent_winding 5; not_watertight 5; no_geometry 2; no_material 150 |

**sections_brep** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [171210sections_brep.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/171210sections_brep.ifc) | IFC2x3 |  | unknown |  |  | structure | 0.07 | tested: needs input | 18/18 measured, 0 unmatched | 2 missing quantities; not_watertight 1 |

**Svaleveien_8_Hus_A** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20190228201620_Svaleveien_8_Hus_A.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20190228201620_Svaleveien_8_Hus_A.ifc) | IFC2x3 | CoordinationView_V2.0 | Vectorworks | 2018 SP1 | 2018-01-16 | architecture | 12.09 | tested: needs input | 113/296 measured, 0 unmatched | blocking names: Bjelkelag, Bjelkelag_Isolasjon, Flis og lim, GU plate...; inconsistent_winding 5; not_watertight 6; no_material 48 |

**threebeams_brep** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [171210threebeams_brep.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/171210threebeams_brep.ifc) | IFC2x3 |  | SDS/2 |  |  | structure | 0.05 | tested: complete | 60/63 measured, 0 unmatched | no_geometry 12; no_material 15 |

**TOWER_TOTAL_00_10006320176** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20200117TOWER_TOTAL_00_10006320176.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20200117TOWER_TOTAL_00_10006320176.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 2019i | 2019-12-16 | structure | 6.72 | tested: needs input | 872/1213 measured, 0 unmatched | blocking names: B; volume_mismatch 170 |

**TrainingStructure_brep** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [171210TrainingStructure_brep.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/171210TrainingStructure_brep.ifc) | IFC2x3 |  | unknown |  |  | structure | 2.15 | tested: needs input | 1742/2145 measured, 0 unmatched | 47 missing quantities; inconsistent_winding 2; not_watertight 3; no_material 14 |

**Trapelo - Existing-RST_2010_Trapelo** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125Trapelo - Existing-RST_2010_Trapelo.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125Trapelo%20-%20Existing-RST_2010_Trapelo.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2015-08-08 | structure | 3.54 | tested: needs input | 1297/1342 measured, 0 unmatched | blocking names: Default Wall, Default Wall; volume_mismatch 1073; not_watertight 1 |

**Trapelo - Existing-Trapelo_Design_Intent** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125Trapelo - Existing-Trapelo_Design_Intent.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125Trapelo%20-%20Existing-Trapelo_Design_Intent.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2015-08-08 | architecture | 22.4 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**Trapelo_Design_Intent** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125Trapelo_Design_Intent.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125Trapelo_Design_Intent.ifc) | IFC4 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-23 | architecture | 27.18 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**UFCSPA-ARQ-PE-R0-correto** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20200404UFCSPA-ARQ-PE-R0-correto.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20200404UFCSPA-ARQ-PE-R0-correto.ifc) | IFC2x3 | CoordinationView_V2.0 | Revit | 2019 | 2019-10-16 | unknown | 24.24 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**V57-3-BA2-01-001** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20191002V57-3-BA2-01-001.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20191002V57-3-BA2-01-001.ifc) | IFC2x3 | CoordinationView_V2.0 | MagiCAD | 2015 | 2017-10-04 | mep | 4.03 | tested: complete | 724/724 measured, 0 unmatched | inconsistent_winding 4; not_watertight 5 |

**Wellness center Sama** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20211122Wellness center Sama.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20211122Wellness%20center%20Sama.ifc) | IFC2x3 | CoordinationView_V2.0 | Revit | 2021 | 2021-11-21 | unknown | 21.28 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**WestRiverSide Hospital - IFC4-Autodesk_Hospital_Metric_Architecture** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20190104WestRiverSide Hospital - IFC4-Autodesk_Hospital_Metric_Architecture.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20190104WestRiverSide%20Hospital%20-%20IFC4-Autodesk_Hospital_Metric_Architecture.ifc) | IFC4 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-24 | architecture | 80.94 | header only |  | not run: 81 MB, over the size cap of this pass |

**WestRiverSide Hospital - IFC4-Autodesk_Hospital_Metric_Electrical** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125WestRiverSide Hospital - IFC4-Autodesk_Hospital_Metric_Electrical.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125WestRiverSide%20Hospital%20-%20IFC4-Autodesk_Hospital_Metric_Electrical.ifc) | IFC4 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-24 | electrical | 4.44 | tested: needs input | 2798/2798 measured, 0 unmatched | blocking names: Red, White; not_watertight 1 |

**WestRiverSide Hospital - IFC4-Autodesk_Hospital_Metric_FireAlarm** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125WestRiverSide Hospital - IFC4-Autodesk_Hospital_Metric_FireAlarm.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125WestRiverSide%20Hospital%20-%20IFC4-Autodesk_Hospital_Metric_FireAlarm.ifc) | IFC4 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-24 | fire protection | 0.91 | tested: needs input | 867/867 measured, 0 unmatched | blocking names: Fire Box |

**WestRiverSide Hospital - IFC4-Autodesk_Hospital_Metric_Mechanical** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20190104WestRiverSide Hospital - IFC4-Autodesk_Hospital_Metric_Mechanical.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20190104WestRiverSide%20Hospital%20-%20IFC4-Autodesk_Hospital_Metric_Mechanical.ifc) | IFC4 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-24 | hvac | 73.05 | header only |  | not run: 73 MB, over the size cap of this pass |

**WestRiverSide Hospital - IFC4-Autodesk_Hospital_Metric_Plumbing** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125WestRiverSide Hospital - IFC4-Autodesk_Hospital_Metric_Plumbing.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125WestRiverSide%20Hospital%20-%20IFC4-Autodesk_Hospital_Metric_Plumbing.ifc) | IFC4 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-24 | plumbing | 23.76 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**WestRiverSide Hospital - IFC4-Autodesk_Hospital_Metric_Structural** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125WestRiverSide Hospital - IFC4-Autodesk_Hospital_Metric_Structural.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125WestRiverSide%20Hospital%20-%20IFC4-Autodesk_Hospital_Metric_Structural.ifc) | IFC4 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-24 | structure | 6.48 | tested: needs input | 2827/2828 measured, 0 unmatched | blocking names: Vapour / Moisture Barriers - Damp-proofing; volume_mismatch 1990 |

**WestRiverSide Hospital - IFC4-Autodesk_Hospital_Sprinkle** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125WestRiverSide Hospital - IFC4-Autodesk_Hospital_Sprinkle.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125WestRiverSide%20Hospital%20-%20IFC4-Autodesk_Hospital_Sprinkle.ifc) | IFC4 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-24 | fire protection | 33.99 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**WestRiverSide Hospital-Ifc2x3-Autodesk_Hospital_Metric_Architecture** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20190104WestRiverSide Hospital-Ifc2x3-Autodesk_Hospital_Metric_Architecture.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20190104WestRiverSide%20Hospital-Ifc2x3-Autodesk_Hospital_Metric_Architecture.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-23 | architecture | 80.32 | header only |  | not run: 80 MB, over the size cap of this pass |

**WestRiverSide Hospital-Ifc2x3-Autodesk_Hospital_Metric_Electrical_2015** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125WestRiverSide Hospital-Ifc2x3-Autodesk_Hospital_Metric_Electrical_2015.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125WestRiverSide%20Hospital-Ifc2x3-Autodesk_Hospital_Metric_Electrical_2015.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-24 | electrical | 4.73 | tested: needs input | 2798/2798 measured, 0 unmatched | blocking names: Red, White; not_watertight 1 |

**WestRiverSide Hospital-Ifc2x3-Autodesk_Hospital_Metric_FireAlarm_2014** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125WestRiverSide Hospital-Ifc2x3-Autodesk_Hospital_Metric_FireAlarm_2014.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125WestRiverSide%20Hospital-Ifc2x3-Autodesk_Hospital_Metric_FireAlarm_2014.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-24 | fire protection | 0.91 | tested: needs input | 867/867 measured, 0 unmatched | blocking names: Fire Box |

**WestRiverSide Hospital-Ifc2x3-Autodesk_Hospital_Metric_Mechanical** (3 files, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20190104WestRiverSide Hospital-Ifc2x3-Autodesk_Hospital_Metric_Mechanical.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20190104WestRiverSide%20Hospital-Ifc2x3-Autodesk_Hospital_Metric_Mechanical.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-24 | hvac | 78.76 | header only |  | not run: 79 MB, over the size cap of this pass |
| [20190104WestRiverSide Hospital-Ifc2x3-Autodesk_Hospital_Metric_Mechanical.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20190104WestRiverSide%20Hospital-Ifc2x3-Autodesk_Hospital_Metric_Mechanical.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-24 | hvac | 78.76 | header only |  | not run: 79 MB, over the size cap of this pass |
| [20190104WestRiverSide Hospital-Ifc2x3-Autodesk_Hospital_Metric_Mechanical.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20190104WestRiverSide%20Hospital-Ifc2x3-Autodesk_Hospital_Metric_Mechanical.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-24 | hvac | 78.76 | header only |  | not run: 79 MB, over the size cap of this pass |

**WestRiverSide Hospital-Ifc2x3-Autodesk_Hospital_Metric_Plumbing_2015** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125WestRiverSide Hospital-Ifc2x3-Autodesk_Hospital_Metric_Plumbing_2015.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125WestRiverSide%20Hospital-Ifc2x3-Autodesk_Hospital_Metric_Plumbing_2015.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-24 | plumbing | 25.0 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**WestRiverSide Hospital-Ifc2x3-Autodesk_Hospital_Metric_Structural_2015** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125WestRiverSide Hospital-Ifc2x3-Autodesk_Hospital_Metric_Structural_2015.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125WestRiverSide%20Hospital-Ifc2x3-Autodesk_Hospital_Metric_Structural_2015.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-24 | structure | 6.4 | tested: complete | 2827/2828 measured, 0 unmatched | volume_mismatch 1990 |

**WestRiverSide Hospital-Ifc2x3-Autodesk_Hospital_Sprinkle_2015** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20160125WestRiverSide Hospital-Ifc2x3-Autodesk_Hospital_Sprinkle_2015.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20160125WestRiverSide%20Hospital-Ifc2x3-Autodesk_Hospital_Sprinkle_2015.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Revit | 2015 | 2016-01-24 | fire protection | 35.66 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |

**Yangsan Pr-HARDWARE** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [20200518Yangsan Pr-HARDWARE.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/20200518Yangsan%20Pr-HARDWARE.ifc) | IFC2x3 | CoordinationView_V2.0 | Tekla Structures | 2018i Service Pack 6 | 2020-03-17 | plumbing | 193.27 | header only |  | not run: 193 MB, over the size cap of this pass |

**КЖ1** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [53d36e5826174834880a795286fa40b1.ifc](https://openifcmodel.cs.auckland.ac.nz/api/download/53d36e5826174834880a795286fa40b1.ifc) | IFC4 | DesignTransferView_V1.0 | Revit | 2021 | 2022-09-28 | structure | 11.16 | tested: needs input | 810/824 measured, 14 unmatched | blocking names: ЭП_БСТ_B25 F100_ГОСТ 7473-2010, ЭП_БСТ_B35 F100_ГОСТ 7473-2010, ЭП_БСТ_B35 F150 W12_ГОСТ 7473-2010, ЭП_БСТ_B40 F100_ГОСТ 7473-2010...; unmatched: IfcStairFlight x14; volume_mismatch 19; inconsistent_winding 3; not_watertight 2 |

### Schependomlaan (openBIMstandards, archive)

A real Dutch housing project: the architect's Archicad model, weekly 4D models from Synchro, and about 30 subcontractor models (Tekla steel and precast, HiCAD railings, Xella masonry, Revit floors, SketchUp utilities). The original repository is empty; the data is in Archive-DataSetSchependomlaan (Git LFS for one file). Files up to 35 MB were run. Licence: not stated (repository licence NOASSERTION); not copied into this repository. Link: https://github.com/openBIMstandards/Archive-DataSetSchependomlaan

**Schependomlaan: as-planned (4D) models** (7 files, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [IFC Schependomlaan incl planningsdata.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/As%20Planned%20models/IFC%20Schependomlaan%20incl%20planningsdata.ifc) | IFC2x3 |  | Synchro (4D) | 5.0.0.1 | 2015-09-07 | federated | 65.08 | header only |  | not run: weekly 4D snapshots of the design model, which was run |
| [Week 26 26 june IFC Schependomlaan incl planningsdata.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/As%20Planned%20models/Week%2026%2026%20june%20IFC%20Schependomlaan%20incl%20planningsdata.ifc) | IFC2x3 |  | Synchro (4D) | 5.0.0.1 | 2015-09-16 | federated | 14.84 | header only |  | not run: weekly 4D snapshots of the design model, which was run |
| [Week 27 3 july IFC Schependomlaan incl planningsdata.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/As%20Planned%20models/Week%2027%203%20july%20IFC%20Schependomlaan%20incl%20planningsdata.ifc) | IFC2x3 |  | Synchro (4D) | 5.0.0.1 | 2015-09-16 | federated | 19.55 | header only |  | not run: weekly 4D snapshots of the design model, which was run |
| [Week 28 10 july IFC Schependomlaan incl planningsdata.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/As%20Planned%20models/Week%2028%2010%20july%20IFC%20Schependomlaan%20incl%20planningsdata.ifc) | IFC2x3 |  | Synchro (4D) | 5.0.0.1 | 2015-09-16 | federated | 26.72 | header only |  | not run: weekly 4D snapshots of the design model, which was run |
| [Week 29 17 july IFC Schependomlaan incl planningsdata.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/As%20Planned%20models/Week%2029%2017%20july%20IFC%20Schependomlaan%20incl%20planningsdata.ifc) | IFC2x3 |  | Synchro (4D) | 5.0.0.1 | 2015-09-16 | federated | 28.77 | header only |  | not run: weekly 4D snapshots of the design model, which was run |
| [Week 30 24 july IFC Schependomlaan incl planningsdata.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/As%20Planned%20models/Week%2030%2024%20july%20IFC%20Schependomlaan%20incl%20planningsdata.ifc) | IFC2x3 |  | Synchro (4D) | 5.0.0.1 | 2015-09-16 | federated | 30.29 | header only |  | not run: weekly 4D snapshots of the design model, which was run |
| [Week 37 11 sept IFC Schependomlaan incl planningsdata.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/As%20Planned%20models/Week%2037%2011%20sept%20IFC%20Schependomlaan%20incl%20planningsdata.ifc) | IFC2x3 |  | Synchro (4D) | 5.0.0.1 | 2015-09-16 | federated | 65.06 | header only |  | not run: weekly 4D snapshots of the design model, which was run |

**Schependomlaan: design model** (1 file, 1 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [IFC Schependomlaan.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Design%20model%20IFC/IFC%20Schependomlaan.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-08-27 | architecture | 49.29 | tested: needs input | 3344/3621 measured, 0 unmatched | blocking names: 01 Hout - hardhout, 01 plaatmateriaal - multiplex, 01 plaatmateriaal - spaanplaat - wit, 03 Metselwerk - kalkzandsteen C...; volume_mismatch 91; inconsistent_winding 3; not_watertight 6; no_geometry 65; no_material 52 |

**Schependomlaan: subcontractor models** (49 files, 48 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [BALKONHEKKEN 23-9-2015.IFC](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/BALKONHEKKEN%2023-9-2015.IFC) | IFC2x3 |  | unknown |  |  | architecture | 2.22 | tested: complete | 1/214 measured, 0 unmatched | no_geometry 48; no_material 7 |
| [BERNTS-Staalconstructie.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/BERNTS-Staalconstructie.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 18.1 | 2011-07-12 | structure | 3.89 | tested: complete | 965/1198 measured, 0 unmatched | not_watertight 1 |
| [FEK - Balkonhekken en borstweringsleuningen.IFC](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/FEK%20-%20Balkonhekken%20en%20borstweringsleuningen.IFC) | IFC2x3 |  | unknown |  |  | structure | 4.02 | tested: complete | 3/446 measured, 0 unmatched | no_geometry 101; no_material 30 |
| [FEK - Franse balkonhekken en doorvalbeveiliging.IFC](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/FEK%20-%20Franse%20balkonhekken%20en%20doorvalbeveiliging.IFC) | IFC2x3 |  | unknown |  |  | architecture | 11.17 | tested: complete | 14/888 measured, 0 unmatched | no_geometry 36; no_material 42 |
| [FEK - Traphekken.IFC](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/FEK%20-%20Traphekken.IFC) | IFC2x3 |  | unknown |  |  | architecture | 12.04 | tested: needs input | 1/679 measured, 0 unmatched | blocking names: PTFE; not_watertight 1; no_geometry 47 |
| [GEELEN-Breedplaat V1.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/GEELEN-Breedplaat%20V1.ifc) | IFC2x3 | CoordinationView | Revit | build 2010-09 | 2012-10-02 | structure | 0.52 | tested: complete | 26/305 measured, 0 unmatched | no_geometry 1; no_material 25 |
| [GEELEN-Breedplaat V2.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/GEELEN-Breedplaat%20V2.ifc) | IFC2x3 | CoordinationView | Revit | build 2010-09 | 2012-10-02 | structure | 0.3 | tested: complete | 15/186 measured, 0 unmatched | no_geometry 1; no_material 14 |
| [GEELEN-Breedplaat V3.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/GEELEN-Breedplaat%20V3.ifc) | IFC2x3 | CoordinationView | Revit | build 2010-09 | 2012-10-02 | structure | 0.33 | tested: complete | 15/193 measured, 0 unmatched | no_geometry 1; no_material 14 |
| [GEELEN-Dakvloer.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/GEELEN-Dakvloer.ifc) | IFC2x3 | CoordinationView | Revit | build 2010-09 | 2012-10-02 | structure | 0.27 | tested: complete | 14/150 measured, 0 unmatched | no_geometry 1; no_material 13 |
| [HB_Nutsvoorzieningen.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/HB_Nutsvoorzieningen.ifc) | IFC2x3 | CoordinationView | SketchUp | 2015 | 2015-02-13 | plumbing | 34.48 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |
| [JORDAHL-Gevelderagers.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/JORDAHL-Gevelderagers.ifc) | IFC2x3 | CoordinationView | Revit | 2015 | 2015-04-20 | structure | 3.57 | tested: complete | 42/42 measured, 0 unmatched | not_watertight 1 |
| [LINDEN - Kozijnen.ifcZIP](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/LINDEN%20-%20Kozijnen.ifcZIP) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 20.1 Service Release 1 | 2015-05-29 | architecture | 0.46 | tested: needs input | 1438/1978 measured, 1 unmatched | blocking names: MISCELLANEOUS/BEPLATING, MISCELLANEOUS/DUMMY, Undefined/Undefined; unmatched: IfcElementAssembly x1; volume_mismatch 326; inconsistent_winding 1; no_geometry 1 |
| [MULTICOM-balkons.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/MULTICOM-balkons.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 20.1 Service Release 3 | 2015-04-16 | structure | 0.64 | tested: needs input | 140/205 measured, 0 unmatched | blocking names: MISCELLANEOUS/ISOL_HARD, MISCELLANEOUS/PVC, MISCELLANEOUS/RUBBER_HARD, MISCELLANEOUS/RUBBER_ZACHT...; volume_mismatch 4; not_watertight 1; no_geometry 42 |
| [MULTICOM-banden.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/MULTICOM-banden.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 20.1 Service Release 3 | 2015-04-16 | structure | 0.4 | tested: needs input | 236/354 measured, 0 unmatched | blocking names: Undefined/Undefined; volume_mismatch 94; no_geometry 118 |
| [MULTICOM-trappen+bordessen.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/MULTICOM-trappen%2Bbordessen.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 20.1 Service Release 3 | 2015-04-16 | structure | 0.33 | tested: needs input | 186/231 measured, 0 unmatched | blocking names: MISCELLANEOUS/RUBBER_HARD, MISCELLANEOUS/RUBBER_ZACHT, Undefined/3500, Undefined/Undefined; no_geometry 36 |
| [ROOT-breedplaatvloeren.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ROOT-breedplaatvloeren.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | structure | 0.12 | tested: needs input | 59/59 measured, 0 unmatched | blocking names: Lege arcering (2) |
| [ROOT-Compleet.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ROOT-Compleet.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | federated | 8.87 | tested: needs input | 3344/3621 measured, 0 unmatched | blocking names: 01 Hout - hardhout, 01 plaatmateriaal - multiplex, 01 plaatmateriaal - spaanplaat - wit, 03 Metselwerk - kalkzandsteen C...; volume_mismatch 91; inconsistent_winding 3; not_watertight 6; no_geometry 65; no_material 52 |
| [ROOT-houten kozijnen.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ROOT-houten%20kozijnen.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | architecture | 1.9 | tested: needs input | 164/164 measured, 0 unmatched | blocking names: 01 Hout - hardhout, 01 Hout - hardhout, 305 loofhout (02), Lege arcering (2); volume_mismatch 88; not_watertight 2; no_geometry 64 |
| [ROOT-kalkzandsteen.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ROOT-kalkzandsteen.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | architecture | 0.26 | tested: needs input | 135/135 measured, 0 unmatched | blocking names: 03 Metselwerk - kalkzandsteen C, 03 mw-baksteen - geel (liggend), 03 Metselwerk - kalkzandsteen C, 03 mw-baksteen - geel (liggend)... |
| [ROOT-kanaalplaatvloer.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ROOT-kanaalplaatvloer.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | structure | 0.08 | tested: needs input | 50/50 measured, 0 unmatched | blocking names: Lege arcering (2); not_watertight 1 |
| [ROOT-kapconstructie_dakkapellen_platdak.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ROOT-kapconstructie_dakkapellen_platdak.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | structure | 0.35 | tested: needs input | 141/141 measured, 0 unmatched | blocking names: 01 plaatmateriaal - multiplex, 01 plaatmateriaal - spaanplaat - wit, 99 Isolatie - Glaswol 190mm, 99 Isolatie - Glaswol zacht...; volume_mismatch 1; inconsistent_winding 2; not_watertight 2 |
| [ROOT-lateien_en_geveldragers.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ROOT-lateien_en_geveldragers.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-06 | structure | 0.09 | tested: needs input | 42/42 measured, 0 unmatched | blocking names: 033 - constructief staal, 05 Staal - RAL 7016, Lege arcering (2) |
| [ROOT-prefab_balkons.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ROOT-prefab_balkons.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | structure | 0.01 | tested: needs input | 4/4 measured, 0 unmatched | blocking names: Lege arcering (2) |
| [ROOT-prefab_trappen.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ROOT-prefab_trappen.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | structure | 0.04 | tested: needs input | 10/10 measured, 0 unmatched | blocking names: Lege arcering (2) |
| [ROOT-prefab_vloer_lifttop.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ROOT-prefab_vloer_lifttop.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | structure | 0.01 | tested: needs input | 2/2 measured, 0 unmatched | blocking names: Lege arcering (2) |
| [ROOT-staal.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ROOT-staal.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | structure | 0.17 | tested: needs input | 78/78 measured, 0 unmatched | blocking names: 033 - constructief staal, 05 Staal - RAL 7016, 05 Staal_bordes_hoeklijnen, Lege arcering (2) |
| [ROOT-traphekken.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ROOT-traphekken.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | architecture | 0.07 | tested: needs input | 14/14 measured, 0 unmatched | blocking names: 05 Staal C, Lege arcering (2) |
| [ROOT-Vebo.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ROOT-Vebo.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | architecture | 0.23 | tested: needs input | 130/130 measured, 0 unmatched | blocking names: 05 Staal - RAL 7016, Lege arcering (2); not_watertight 1 |
| [V_L_Constructief.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/V_L_Constructief.ifc) | IFC2x3 | CoordinationView | Revit | build 2013-03 | 2015-03-02 | structure | 0.94 | tested: needs input | 530/532 measured, 0 unmatched | blocking names: cementdekvloer, dak_schild, dak_underlayment, dampremmende_folie... |
| [WAARDO-Kanaalplaatvloer.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/WAARDO-Kanaalplaatvloer.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 19.1 Service Release 5 | 2015-04-01 | structure | 4.7 | tested: needs input | 574/574 measured, 0 unmatched | blocking names: MISCELLANEOUS/DUMMY, MISCELLANEOUS/EPS60; volume_mismatch 6 |
| [WILLEMSEN-Hoogbouw dakpannen.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/WILLEMSEN-Hoogbouw%20dakpannen.ifc) | IFC2x3 | CoordinationView_V2.0, FMHandOverAddonView, ConceptDesignBIM_2010 | AutoCAD Architecture | 2014 | 2015-06-16 | architecture | 5.22 | tested: complete | 277/277 measured, 0 unmatched |  |
| [WILLEMSEN-Hoogbouw.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/WILLEMSEN-Hoogbouw.ifc) | IFC2x3 | CoordinationView_V2.0, FMHandOverAddonView, ConceptDesignBIM_2010 | AutoCAD Architecture | 2014 | 2015-06-19 | architecture | 6.02 | tested: complete | 2980/2980 measured, 0 unmatched |  |
| [WILLEMSEN-laagbouw dakpannen.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/WILLEMSEN-laagbouw%20dakpannen.ifc) | IFC2x3 | CoordinationView_V2.0, FMHandOverAddonView, ConceptDesignBIM_2010 | AutoCAD Architecture | 2014 | 2015-06-01 | architecture | 1.0 | tested: complete | 58/58 measured, 0 unmatched |  |
| [WILLEMSEN-Laagbouw.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/WILLEMSEN-Laagbouw.ifc) | IFC2x3 | CoordinationView_V2.0, FMHandOverAddonView, ConceptDesignBIM_2010 | AutoCAD Architecture | 2014 | 2015-06-01 | architecture | 1.96 | tested: complete | 978/978 measured, 0 unmatched |  |
| [XELLA-1e verdieping.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/XELLA-1e%20verdieping.ifc) | IFC2x3 |  | Xella exporter | 5.7.0.2 | 2015-04-01 | architecture | 0.56 | tested: needs input | 37/748 measured, 0 unmatched | blocking names: Silka Kalkzandsteen CS12, Silka Kalkzandsteen CS20, Silka Kim CS12, Silka Kim CS20... |
| [XELLA-2e verdieping.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/XELLA-2e%20verdieping.ifc) | IFC2x3 |  | Xella exporter | 5.7.0.2 | 2015-04-14 | architecture | 0.45 | tested: needs input | 30/590 measured, 0 unmatched | blocking names: Silka Kalkzandsteen CS12, Silka Kalkzandsteen CS20, Silka Kim CS12, Silka Kim CS20... |
| [XELLA-3e verdieping.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/XELLA-3e%20verdieping.ifc) | IFC2x3 |  | Xella exporter | 5.7.0.2 | 2015-04-14 | architecture | 0.2 | tested: needs input | 17/257 measured, 0 unmatched | blocking names: Silka Kalkzandsteen CS12, Silka Kalkzandsteen CS20, Silka Kim CS12, Silka Kim CS20... |
| [XELLA-Begane grond.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/XELLA-Begane%20grond.ifc) | IFC2x3 |  | Xella exporter | 5.7.0.2 | 2015-04-01 | architecture | 0.6 | tested: needs input | 37/787 measured, 0 unmatched | blocking names: Silka Kalkzandsteen CS12, Silka Kalkzandsteen CS20, Silka Kim CS12, Silka Kim CS20... |
| [YTONG-Algemeen.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/YTONG-Algemeen.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.3 | 2015-04-13 | architecture | 0.01 | tested: needs input | 3/12 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 01.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/YTONG-Kavel%2001.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.3 | 2015-04-13 | architecture | 0.08 | tested: needs input | 31/124 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 02.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/YTONG-Kavel%2002.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.3 | 2015-04-13 | architecture | 0.06 | tested: needs input | 24/92 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 03.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/YTONG-Kavel%2003.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.3 | 2015-04-13 | architecture | 0.09 | tested: needs input | 37/148 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 04.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/YTONG-Kavel%2004.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.3 | 2015-04-13 | architecture | 0.07 | tested: needs input | 28/112 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 05.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/YTONG-Kavel%2005.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.3 | 2015-04-13 | architecture | 0.06 | tested: needs input | 25/100 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 06.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/YTONG-Kavel%2006.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.3 | 2015-04-13 | architecture | 0.06 | tested: needs input | 24/96 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 07.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/YTONG-Kavel%2007.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.3 | 2015-04-13 | architecture | 0.06 | tested: needs input | 25/100 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 08.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/YTONG-Kavel%2008.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.3 | 2015-04-13 | architecture | 0.06 | tested: needs input | 24/96 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 09.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/YTONG-Kavel%2009.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.3 | 2015-04-13 | architecture | 0.06 | tested: needs input | 24/96 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 10.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/YTONG-Kavel%2010.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.3 | 2015-04-13 | architecture | 0.06 | tested: needs input | 23/91 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |

**Schependomlaan: subcontractor models (ProjectData copy)** (37 files, 36 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [BERNTS-Staalconstructie.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/BERNTS-Staalconstructie.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 18.1 | 2011-07-12 | structure | 4.31 | tested: complete | 1206/1206 measured, 0 unmatched | not_watertight 1 |
| [FEK-Leuningen en hekwerken.IFC](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/FEK-Leuningen%20en%20hekwerken.IFC) | IFC2x3 |  | unknown |  |  | architecture | 2.88 | tested: complete | 2/318 measured, 0 unmatched | no_geometry 75; no_material 17 |
| [GEELEN-Breedplaat V1.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/GEELEN-Breedplaat%20V1.ifc) | IFC2x3 | CoordinationView | Revit | build 2010-09 | 2012-10-02 | structure | 0.49 | tested: complete | 26/304 measured, 0 unmatched | no_geometry 1; no_material 25 |
| [GEELEN-Breedplaat V2.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/GEELEN-Breedplaat%20V2.ifc) | IFC2x3 | CoordinationView | Revit | build 2010-09 | 2012-10-02 | structure | 0.3 | tested: complete | 15/185 measured, 0 unmatched | no_geometry 1; no_material 14 |
| [GEELEN-Breedplaat V3.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/GEELEN-Breedplaat%20V3.ifc) | IFC2x3 | CoordinationView | Revit | build 2010-09 | 2012-10-02 | structure | 0.15 | tested: complete | 15/68 measured, 0 unmatched | no_geometry 1; no_material 14 |
| [GEELEN-Dakvloer.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/GEELEN-Dakvloer.ifc) | IFC2x3 | CoordinationView | Revit | build 2010-09 | 2012-10-02 | structure | 0.12 | tested: complete | 12/56 measured, 0 unmatched | no_geometry 1; no_material 11 |
| [HB_Nutsvoorzieningen.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/HB_Nutsvoorzieningen.ifc) | IFC2x3 | CoordinationView | SketchUp | 2015 | 2015-02-13 | plumbing | 34.48 | header only |  | not run: same tool, version, schema and discipline as files already tested (or a duplicate copy) |
| [JORDAHL-Gevelderagers.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/JORDAHL-Gevelderagers.ifc) | IFC2x3 | CoordinationView | Revit | 2014 | 2015-03-30 | structure | 4.98 | tested: complete | 45/45 measured, 0 unmatched | volume_mismatch 2; not_watertight 1 |
| [MULTICOM-Prefab.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/MULTICOM-Prefab.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 20.1 Service Release 3 | 2015-04-02 | structure | 1.16 | tested: needs input | 301/507 measured, 0 unmatched | blocking names: FeB500, MISCELLANEOUS/ISOL_HARD, MISCELLANEOUS/PVC, MISCELLANEOUS/RUBBER_HARD...; volume_mismatch 98; not_watertight 1 |
| [ROOT-breedplaatvloeren.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/ROOT-breedplaatvloeren.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | structure | 0.12 | tested: needs input | 59/59 measured, 0 unmatched | blocking names: Lege arcering (2) |
| [ROOT-Compleet.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/ROOT-Compleet.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | federated | 8.87 | tested: needs input | 3344/3621 measured, 0 unmatched | blocking names: 01 Hout - hardhout, 01 plaatmateriaal - multiplex, 01 plaatmateriaal - spaanplaat - wit, 03 Metselwerk - kalkzandsteen C...; volume_mismatch 91; inconsistent_winding 3; not_watertight 6; no_geometry 65; no_material 52 |
| [ROOT-houten kozijnen.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/ROOT-houten%20kozijnen.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | architecture | 1.9 | tested: needs input | 164/164 measured, 0 unmatched | blocking names: 01 Hout - hardhout, 01 Hout - hardhout, 305 loofhout (02), Lege arcering (2); volume_mismatch 88; not_watertight 2; no_geometry 64 |
| [ROOT-kalkzandsteen.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/ROOT-kalkzandsteen.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | architecture | 0.26 | tested: needs input | 135/135 measured, 0 unmatched | blocking names: 03 Metselwerk - kalkzandsteen C, 03 mw-baksteen - geel (liggend), 03 Metselwerk - kalkzandsteen C, 03 mw-baksteen - geel (liggend)... |
| [ROOT-kanaalplaatvloer.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/ROOT-kanaalplaatvloer.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | structure | 0.08 | tested: needs input | 50/50 measured, 0 unmatched | blocking names: Lege arcering (2); not_watertight 1 |
| [ROOT-kapconstructie_dakkapellen_platdak.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/ROOT-kapconstructie_dakkapellen_platdak.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | structure | 0.35 | tested: needs input | 141/141 measured, 0 unmatched | blocking names: 01 plaatmateriaal - multiplex, 01 plaatmateriaal - spaanplaat - wit, 99 Isolatie - Glaswol 190mm, 99 Isolatie - Glaswol zacht...; volume_mismatch 1; inconsistent_winding 2; not_watertight 2 |
| [ROOT-lateien_en_geveldragers.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/ROOT-lateien_en_geveldragers.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-06 | structure | 0.09 | tested: needs input | 42/42 measured, 0 unmatched | blocking names: 033 - constructief staal, 05 Staal - RAL 7016, Lege arcering (2) |
| [ROOT-prefab_balkons.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/ROOT-prefab_balkons.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | structure | 0.01 | tested: needs input | 4/4 measured, 0 unmatched | blocking names: Lege arcering (2) |
| [ROOT-prefab_trappen.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/ROOT-prefab_trappen.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | structure | 0.04 | tested: needs input | 10/10 measured, 0 unmatched | blocking names: Lege arcering (2) |
| [ROOT-prefab_vloer_lifttop.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/ROOT-prefab_vloer_lifttop.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | structure | 0.01 | tested: needs input | 2/2 measured, 0 unmatched | blocking names: Lege arcering (2) |
| [ROOT-staal.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/ROOT-staal.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | structure | 0.17 | tested: needs input | 78/78 measured, 0 unmatched | blocking names: 033 - constructief staal, 05 Staal - RAL 7016, 05 Staal_bordes_hoeklijnen, Lege arcering (2) |
| [ROOT-traphekken.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/ROOT-traphekken.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | architecture | 0.07 | tested: needs input | 14/14 measured, 0 unmatched | blocking names: 05 Staal C, Lege arcering (2) |
| [ROOT-Vebo.ifczip](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/ROOT-Vebo.ifczip) | IFC2x3 | 4, QuantityTakeOffAddOnView, SpaceBoundary2ndLevelAddOnView | Archicad | 18.0 | 2015-03-04 | architecture | 0.23 | tested: needs input | 130/130 measured, 0 unmatched | blocking names: 05 Staal - RAL 7016, Lege arcering (2); not_watertight 1 |
| [V_L_Constructief.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/V_L_Constructief.ifc) | IFC2x3 | CoordinationView | Revit | build 2013-03 | 2015-03-02 | structure | 0.94 | tested: needs input | 530/532 measured, 0 unmatched | blocking names: cementdekvloer, dak_schild, dak_underlayment, dampremmende_folie... |
| [WAARDO-Kanaalplaatvloer.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/WAARDO-Kanaalplaatvloer.ifc) | IFC2x3 | CoordinationView_V2.0, QuantityTakeOffAddOnView | Tekla Structures | 19.1 Service Release 5 | 2015-04-01 | structure | 4.7 | tested: needs input | 574/574 measured, 0 unmatched | blocking names: MISCELLANEOUS/DUMMY, MISCELLANEOUS/EPS60; volume_mismatch 6 |
| [XELLA-1e verdieping.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/XELLA-1e%20verdieping.ifc) | IFC2x3 |  | Xella exporter | 5.7.0.2 | 2015-04-01 | architecture | 0.56 | tested: needs input | 37/748 measured, 0 unmatched | blocking names: Silka Kalkzandsteen CS12, Silka Kalkzandsteen CS20, Silka Kim CS12, Silka Kim CS20... |
| [XELLA-Begane grond.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/XELLA-Begane%20grond.ifc) | IFC2x3 |  | Xella exporter | 5.7.0.2 | 2015-04-01 | architecture | 0.6 | tested: needs input | 37/787 measured, 0 unmatched | blocking names: Silka Kalkzandsteen CS12, Silka Kalkzandsteen CS20, Silka Kim CS12, Silka Kim CS20... |
| [YTONG-Algemeen.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/YTONG-Algemeen.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.1 | 2015-03-31 | architecture | 0.01 | tested: needs input | 3/12 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 01.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/YTONG-Kavel%2001.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.1 | 2015-03-31 | architecture | 0.08 | tested: needs input | 30/120 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 02.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/YTONG-Kavel%2002.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.1 | 2015-03-31 | architecture | 0.06 | tested: needs input | 23/88 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 03.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/YTONG-Kavel%2003.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.1 | 2015-03-31 | architecture | 0.1 | tested: needs input | 39/156 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 04.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/YTONG-Kavel%2004.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.1 | 2015-03-31 | architecture | 0.07 | tested: needs input | 27/108 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 05.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/YTONG-Kavel%2005.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.1 | 2015-03-31 | architecture | 0.06 | tested: needs input | 25/100 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 06.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/YTONG-Kavel%2006.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.1 | 2015-03-31 | architecture | 0.07 | tested: needs input | 27/108 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 07.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/YTONG-Kavel%2007.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.1 | 2015-03-31 | architecture | 0.06 | tested: needs input | 25/100 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 08.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/YTONG-Kavel%2008.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.1 | 2015-03-31 | architecture | 0.07 | tested: needs input | 27/108 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 09.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/YTONG-Kavel%2009.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.1 | 2015-03-31 | architecture | 0.06 | tested: needs input | 24/96 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |
| [YTONG-Kavel 10.ifc](https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Coordination%20model%20and%20subcontractors%20models/BIMsight%20Projectdata1/ProjectData/YTONG-Kavel%2010.ifc) | IFC2x3 |  | Xella exporter | 1.4.0.1 | 2015-03-31 | architecture | 0.07 | tested: needs input | 25/99 measured, 0 unmatched | blocking names: Silka Kimmortel, Silka Kimmortel |

### BIMData list: source unavailable

Entries on the BIMData page whose download no longer works. Licence: -. Link: https://github.com/bimdata/BIMData-Research-and-Development/blob/master/pages/IFC_FILES.md

**BIMCollab example project** (9 files, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [BIMCollab_ARC.ifc](https://www.bimcollab.com/Files/Example-Projects/BIMcollab_ifc_models.aspx) |  |  |  |  |  |  |  | unavailable |  | 404; BIMcollab now offers example models from its website after sign-up |
| [BIMCollab_Elevatorshaft.ifc](https://www.bimcollab.com/Files/Example-Projects/BIMcollab_ifc_models.aspx) |  |  |  |  |  |  |  | unavailable |  | 404; BIMcollab now offers example models from its website after sign-up |
| [BIMCollab_HEAT_PLB.ifc](https://www.bimcollab.com/Files/Example-Projects/BIMcollab_ifc_models.aspx) |  |  |  |  |  |  |  | unavailable |  | 404; BIMcollab now offers example models from its website after sign-up |
| [BIMCollab_HollowCoreSlabs.ifc](https://www.bimcollab.com/Files/Example-Projects/BIMcollab_ifc_models.aspx) |  |  |  |  |  |  |  | unavailable |  | 404; BIMcollab now offers example models from its website after sign-up |
| [BIMCollab_LimestoneWalls.ifc](https://www.bimcollab.com/Files/Example-Projects/BIMcollab_ifc_models.aspx) |  |  |  |  |  |  |  | unavailable |  | 404; BIMcollab now offers example models from its website after sign-up |
| [BIMCollab_MEP.ifc](https://www.bimcollab.com/Files/Example-Projects/BIMcollab_ifc_models.aspx) |  |  |  |  |  |  |  | unavailable |  | 404; BIMcollab now offers example models from its website after sign-up |
| [BIMCollab_STR.ifc](https://www.bimcollab.com/Files/Example-Projects/BIMcollab_ifc_models.aspx) |  |  |  |  |  |  |  | unavailable |  | 404; BIMcollab now offers example models from its website after sign-up |
| [BIMCollab_Structural Steel.ifc](https://www.bimcollab.com/Files/Example-Projects/BIMcollab_ifc_models.aspx) |  |  |  |  |  |  |  | unavailable |  | 404; BIMcollab now offers example models from its website after sign-up |
| [BIMCollab_VENT.ifc](https://www.bimcollab.com/Files/Example-Projects/BIMcollab_ifc_models.aspx) |  |  |  |  |  |  |  | unavailable |  | 404; BIMcollab now offers example models from its website after sign-up |

**Holter_Tower** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [Holter_Tower_10.ifc](https://www.dropbox.com/s/ybocflzyt33ilg5/Holter_Tower_10.ifc?dl=0) |  |  |  |  |  |  |  | unavailable |  | Dropbox link returns a web page, not the file |

**IfcCompressor** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [IfcCompressor_M1.ifc](http://cgcad.thss.tsinghua.edu.cn/liuyushen/IFCCompressor/index.html) |  |  |  |  |  |  |  | unavailable |  | host does not respond |

**Medical Clinic (combined set)** (4 files, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [MedicalClinic_ARC.ifc](https://portal.nibs.org/files/wl/?id=ceZq7cZxLUwLm2pouJR0mXjPpf2HuclD) |  |  |  |  |  |  |  | unavailable |  | NIBS portal does not respond (the NBU_MedicalClinic set from DURAARK covers the same building) |
| [MedicalClinic_Combined.ifc](https://portal.nibs.org/files/wl/?id=ceZq7cZxLUwLm2pouJR0mXjPpf2HuclD) |  |  |  |  |  |  |  | unavailable |  | NIBS portal does not respond (the NBU_MedicalClinic set from DURAARK covers the same building) |
| [MedicalClinic_ELE.ifc](https://portal.nibs.org/files/wl/?id=ceZq7cZxLUwLm2pouJR0mXjPpf2HuclD) |  |  |  |  |  |  |  | unavailable |  | NIBS portal does not respond (the NBU_MedicalClinic set from DURAARK covers the same building) |
| [MedicalClinic_MECH.ifc](https://portal.nibs.org/files/wl/?id=ceZq7cZxLUwLm2pouJR0mXjPpf2HuclD) |  |  |  |  |  |  |  | unavailable |  | NIBS portal does not respond (the NBU_MedicalClinic set from DURAARK covers the same building) |

**Plan3D_Haus30** (1 file, 0 tested)

| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|
| [Plan3D_Haus30.ifc](https://tib.eu/data/duraark/BuildingData/01_IFC/KIT_Smiley-West_ifc.zip) |  |  |  |  |  |  |  | unavailable |  | BIMData links the wrong archive; no Plan3D file found on DURAARK |
