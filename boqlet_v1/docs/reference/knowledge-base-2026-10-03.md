## 1. Overview and how to use this document

The goal is a highly dynamic engine that turns IFC building models into a Bill of Quantities (BoQ), with the rulebook, classification and naming dictionary selected as settings rather than hard-coded. A working prototype on a real file (the NIBS Duplex) proved the core approach; the rest of the conversation mapped the industry, the knowledge gaps, and the platform around the engine.

This document collects everything discovered, in the order a reader needs it: terms first, then the experiment, the domain, the engine, the gaps, sourcing, validation, and finally the platform and business side. Tables produced along the way are reproduced here so the document stands on its own; the original files remain as companions.

### The idea in one paragraph

An IFC file holds geometry and properties, not measurement rules. The engine reads the file, verifies what the authoring tool claims against the actual geometry, checks the file against the user's chosen settings, asks the user about anything missing or unclear, then measures, derives and outputs a traceable BoQ. Every quantity is either measured, derived from a proxy, entered manually, or flagged as unknown, and nothing is silently dropped. Rules live in data, so new standards and company conventions are added as presets, not code.

### How the document is organised

1. Glossary
2. The Duplex experiment: what was built and found
3. BoQ domain basics: standards, naming, grouping, the six knobs
4. Choosing settings before generation and the pre-flight check
5. Engine architecture
6. The six knowledge gaps
7. Sourcing rulebooks and classifications, and licensing
8. Remaining gaps and later additions
9. Solvability and sufficiency
10. Test corpus
11. Platform data model, federation and scope rules
12. Users, roles and access
13. Background processing, performance and notifications
14. Pricing model
15. Readiness for engineers, open questions and next steps

### Companion files produced in this conversation

| File | Type | What it contains |
| --- | --- | --- |
| Duplex_BoQ.xlsx | Spreadsheet | Full BoQ for the Duplex: BoQ, element register, openings, material take-off, rooms, QA log, parameters. All quantities are live formulas. |
| pipeline/extract.py | Python | Stage 1: IFC to unified JSON (reported quantities, geometry, materials, links) |
| pipeline/overlap.py | Python | Pairwise solid-intersection check to detect double counting |
| pipeline/classify.py | Python | Stage 2: rule table, quantity adoption with reasoning, QA findings |
| pipeline/build_boq.py | Python | Stage 3: Excel BoQ with SUMIFS formulas over the register |
| pipeline/unified.json | JSON | The intermediate unified record of every element |
| BoQ_Rulebooks_and_Classifications.xlsx | Spreadsheet | Rulebook and classification options with realistic picks |
| BoQ_Naming_Dictionary_and_Item_Library.xlsx | Spreadsheet | Resources for gaps 3 and 4 and the user layers |
| IFC_BoQ_Six_Knowledge_Gaps.docx | Word | The six knowledge gaps, international version |
| IFC_BoQ_Remaining_Gaps.docx | Word | The ten further parts, incl. expanded location breakdown |
| IFC_Test_Corpus_Plan.xlsx | Spreadsheet | 21-file test corpus plan with live coverage tracking |
| IFC_BoQ_Sourcing_Rulebooks_and_Classifications.docx | Word | Where to buy or download each standard, licensing notes, sources |

## 2. Glossary

Plain-language definitions of every industry and technical term used in this document.

| Term | Meaning |
| --- | --- |
| BoQ (Bill of Quantities) | A list of construction work items, each with description, unit and quantity. Contractors add unit rates to price it. Used in tenders and contracts. |
| Predmjer / predračun | Ex-Yugoslav terms: predmjer = the BoQ with quantities; predračun = the same with prices added. |
| Troškovnik | Croatian term for a priced BoQ. |
| IFC (Industry Foundation Classes) | The open, ISO-standard file format (ISO 16739) for exchanging building models between BIM tools. Versions: IFC2x3, IFC4, IFC4.3. |
| BIM | Building Information Modelling: designing buildings as 3D models with data attached to every element. |
| Authoring tool | The software a model is made in: Revit, ArchiCAD, Tekla Structures, Allplan, Vectorworks, BricsCAD, Bonsai/BlenderBIM, FreeCAD. Plain AutoCAD is not a meaningful IFC source. |
| Element | One object in the model: a wall, slab, door, beam, etc. Identified by a permanent GlobalId (GUID). |
| IFC class | The standard type of an element, e.g. IfcWall, IfcSlab, IfcDoor. Standardised; names are free text. |
| Property set (Pset) | A named group of properties on an element. Pset_*Common sets are standard (IsExternal, LoadBearing); PSet_Revit_* are Revit-specific. |
| BaseQuantities | Standard IFC quantity sets (length, area, volume). Often missing in older exports, as in the Duplex. |
| Material layer set | The ordered layers of a wall, slab or roof with thicknesses, e.g. brick 92 mm, cavity 25 mm, insulation 50 mm. |
| Aggregation | A parent object made of parts, e.g. IfcRoof containing an IfcSlab, or IfcStair containing flights and stringers. |
| Measurement rulebook / method of measurement | Rules for how quantities are calculated: units, deductions, what each item includes. Examples: NRM2, VOB/C, CESMM4. Changes the numbers. |
| Classification system | Codes and names for buckets of items, e.g. Uniclass, OmniClass, MasterFormat. Never changes numbers. |
| Elemental grouping | Organising a BoQ by building part: substructure, frame, roof, walls. Used for cost planning (NRM1, UniFormat). |
| Trade / work-section grouping | Organising by trade package: concrete works, masonry works, painting. Used for tendering (NRM2, MasterFormat, ex-YU vrste radova). |
| Naming dictionary | Maps messy names (BETON, C25/30, office codes) to one meaning (concrete). |
| Item library | Maps a recognised element to a BoQ line: standard description, unit, which quantity. |
| Preset | A bundle of dozens of settings representing one rulebook or company convention, adjustable by the user. |
| Measured quantity | Taken from the model and verified against geometry. |
| Derived quantity (proxy) | Calculated from other data with a visible formula, e.g. formwork from wall area, reinforcement from concrete volume x kg/m3. |
| Flagged item | A line whose quantity cannot be determined; kept in the BoQ with a note, never dropped. |
| Preliminaries | Site running costs not tied to any element: setup, scaffolding, cranes, temporary services, site staff, insurance. Often 10-15% of a project. |
| Provisional sum | A placeholder amount for work not yet designed, replaced by measured items later. |
| Lump sum | One fixed price for a package without measured quantities, e.g. a lift supplied and installed. |
| Formwork | Temporary moulds that hold concrete while it sets; usually measured in m2 of contact area. |
| Federated model | A project split into separate files per discipline (architecture, structure, MEP), combined only for viewing or checking. |
| MEP | Mechanical, electrical and plumbing installations. |
| Discipline | Architecture, structure, MEP, etc.; each usually owns its own model. |
| Space boundary (IfcRelSpaceBoundary) | IFC relationship stating which element faces bound which room. Often missing in exports. |
| IDS (Information Delivery Specification) | buildingSMART's machine-readable format for stating what an IFC must contain. |
| bSDD | buildingSMART Data Dictionary: free multilingual dictionary of building concepts, with an API. |
| BCF | BIM Collaboration Format: standard for sending model issues back to designers. |
| GAEB / ÖNORM A 2063 | German / Austrian standard formats for exchanging BoQs between software. |
| NIA (Net Internal Area) | Sum of usable room floor areas. |
| QS (Quantity Surveyor) | The professional who measures and prices construction work. |
| Answer key | Reference projects with a professionally hand-measured BoQ, used to prove engine accuracy. |
| GN norms (Građevinske norme) | Legacy ex-Yugoslav construction norms; e.g. GN 400 series covers concrete works. |

## 3. The Duplex experiment

A full BoQ was generated from a real IFC file to see how the logic would work in practice. The approach worked, and the interesting results were the data problems it uncovered. Companion files: Duplex_BoQ.xlsx and the pipeline/ folder.

### 3.1 The file

| Property | Value |
| --- | --- |
| File | Ifc2x3_Duplex_Architecture.ifc (2.4 MB, ~39k lines) |
| Origin | NIBS / GSA sample duplex, Chicago address, US context |
| Authoring tool | Autodesk Revit Architecture 2011 |
| Schema | IFC2x3, Coordination View |
| Units | Metres, m2, m3 |
| Storeys | T/FDN (-1.25), Level 1 (0.00), Level 2 (+3.10), Roof (+6.00) |
| Content | 218 physical elements + 21 spaces: 57 walls, 21 slabs, 13 ceilings, 8 steel beams, 7 footings, 24 windows, 14 doors, 2 stairs, 4 railings, 1 roof, 61 furnishings |
| Quantities available | No IFC BaseQuantities. Only PSet_Revit_Dimensions (Length, Area, Volume, Perimeter) and GSA space areas. |
| Materials | 18 materials, 15 layer sets on walls, slabs, roof and ceilings |

Because there were no standard quantities, Revit's numbers were treated as claims to verify, and every element was re-measured from its geometry.

### 3.2 The four-stage pipeline

1. **Extract** (extract.py): IFC to unified JSON. Per element: reported quantities, geometry-measured volume and area, type, storey, material layers, host links (door to opening to wall) and aggregation links (roof to slab, stair to parts). No decisions at this stage.
2. **Verify** (extract.py + overlap.py): every solid re-meshed and measured; reported vs geometric volume compared at 1% tolerance; pairwise solid intersections to catch double counting.
3. **Classify and measure** (classify.py): a rule table maps IFC class + type name (+ storey) to a BoQ item key; each element gets an adopted quantity with a written reason.
4. **Present** (build_boq.py): Excel workbook in which every BoQ quantity is a SUMIFS formula over the element register, so keys, parameters and the naming dictionary can be edited live.

### 3.3 What verification found

About 95% of elements matched Revit to three decimals. The exceptions were the most valuable findings.

| Finding | Detail | Decision |
| --- | --- | --- |
| Main party wall: geometry 433 m3 vs reported 25.83 m3 | Exported as a surface model with inconsistent face winding | Normals repaired before measuring; repaired volume 25.830 m3 matches exactly |
| Short party wall stub: +42% | Solid-intersection test found two 0.379 m3 overlaps with neighbouring walls at T-junctions | Revit's join-aware value adopted; geometry minus overlaps within ~4% |
| Revit wall Area inconsistent with Volume on 7 walls | Level 2 exterior walls differ by ~1.2 m2 each, matching two 819 x 759 windows deducted from Volume but not Area; party walls differ 1.2-8.6 m2 | All walls measured as Volume / layer thickness, keeping area, volume and layers consistent |
| Steel beams: geometry 3.5-4.7% over reported | Section geometry vs Revit volume | Steel measured as length x nominal kg/m from the section name (W310x60 = 60 kg/m); volume x density kept as cross-check |
| Ceilings 187462 / 187470 overlap | ~3.2 m2 of ceiling modelled twice | Flagged, not auto-corrected |
| Other overlaps ~0.9 m3 | Beam bearings inside brick walls, partitions through the joist floor, ceilings clipping walls | Treated as normal modelling tolerance |

### 3.4 Classification and measurement rules used

- Grouping modelled on the NRM1 elemental structure.
- Measurement "as modelled": net quantities, all openings deducted, walls at mean area. Not any formal standard; the opening add-back threshold is a live parameter.
- Roof and stairs measured at the parent object; child parts kept with count 0 (railings measured separately).
- Party wall classified as internal by type, overriding IsExternal = TRUE in the model.
- Footings had no material: concrete assumed from the type name and logged.
- Materials "Concrete" and "Concrete - Cast In Situ" merged through an editable naming dictionary.
- Derived items marked as derived: formwork (footings, foundation walls, slab edges) and paint (from plasterboard layers).

### 3.5 Resulting BoQ

| Ref | Description | Unit | Qty |
| --- | --- | --- | --- |
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
| 4.1.x | Fixed fittings (7 types: cabinets, worktops, vanity units) | nr | 43 total |
| 4.2.x | Loose furniture, for information (5 types) | nr | 18 total |
| 8.1 | External concrete slab 150 mm | m3 | 7.63 |
| 8.2 | External slab surface area | m2 | 50.84 |
| 8.3 | Edge formwork to external slab (derived) | m2 | 6.11 |

Room schedule result: net internal area 141.79 m2 on Level 1 and 134.53 m2 on Level 2, total 276.32 m2 (roof space R301 excluded). Changing the opening add-back threshold to 1.0 m2 raises 2.5.1 from 235.78 to 243.24 m2, demonstrating a live measurement rule.

### 3.6 Data-quality log

- Party wall flagged IsExternal = TRUE although it divides the two units.
- Skylights flagged IsExternal = FALSE.
- Space B105 named "Room" while twin A105 is "Stair".
- PSet_Revit_Other full of placeholder values (InstallationDate = "InstallationDate").
- Two names for one material ("Concrete" and "Concrete - Cast In Situ").
- Not in the model: MEP, reinforcement, skirtings, sills, ironmongery, external works beyond two slabs.

### 3.7 Lesson for the app

The surface-model winding and the junction overlaps are invisible unless geometry is measured independently of the authoring tool's numbers. Every QA item above is the kind of question the app's review queue must surface.

## 4. BoQ domain basics

The same IFC file can produce very different BoQs, because several independent choices shape the result. Only three of them change the numbers.

### 4.1 Measurement standards

No formal standard was used for the Duplex: the grouping followed NRM1 and the measurement was "net, as modelled". A standard cannot be deduced from an IFC, because IFC carries geometry and properties, not measurement rules. The file only revealed its origin: Revit metric library (M_ families), a Chicago address, GSA areas and OmniClass codes, i.e. a US-context model. North America has no single mandated measurement standard; practice follows MasterFormat or UniFormat for structure plus firm conventions, with Canada having the CIQS method.

Switching standards keeps the overall logic. Extraction, verification, overlap checks and classification are standard-agnostic. What changes is the rules layer:

- deduction thresholds (below what size an opening is ignored);
- units per item (e.g. ex-YU practice commonly measures thicker masonry in m3 and thinner in m2, while NRM measures walls in m2);
- whether formwork is a separate item or included in concrete;
- which face or centreline is measured;
- rounding, item descriptions and language.

### 4.2 Element naming: defaults vs custom

The Duplex names are mostly Revit defaults: families such as M_Single-Flush and M_Fixed, wall types such as "Exterior - Brick on Block", and default library materials such as "Masonry - Concrete Block". A few are lightly customised, e.g. "Party Wall - CMU Residential Unit Dimising Wall" (typo included). Only the IFC class is standardised; names are free text. Real projects carry office naming conventions, local language and internal codes. The prototype's rule table matched substrings of these specific names, which is the fragile part that a real engine must replace.

### 4.3 Handling unclear names

An element carries far more evidence than its name: IFC class and predefined type, layer structure and thicknesses, Pset_*Common flags, any classification reference, material properties (a strength class like C25/30 or MB30 implies concrete), position (below grade) and host. Resolution runs in layers:

1. exact match in the naming dictionary;
2. known aliases, synonyms and translations (BETON = concrete in most European languages);
3. contextual matching with a confidence score, where an AI model can help;
4. below the threshold, the review queue. A user's answer is saved to the project or company dictionary, so the question never repeats.

Ambiguous cases such as "CT" (ceramic tile? cement screed? internal code?) always go to review, never a silent guess.

### 4.4 Grouping and formatting

Two philosophies dominate:

- **Elemental**, by building part (NRM1, UniFormat), mainly for early cost planning.
- **Trade / work-section**, by trade package (NRM2, MasterFormat, ex-YU predmjer by vrste radova), used for tendering because sections map to subcontractors.

On top, firms customise numbering, detail level, preliminaries, provisional sums and summary pages (rekapitulacija). The column set is close to universal: item no., description, unit, quantity, unit rate, amount. Public tenders often fix the format exactly. Grouping is therefore a display layer: if each item carries both an elemental and a trade code, the same quantities pivot into either structure or a client template without recalculation.

### 4.5 The six knobs, from raw file to finished BoQ

Think of the IFC as raw facts and the BoQ as a report written under rules.

| # | Knob | What it decides | Changes numbers? |
| --- | --- | --- | --- |
| 1 | Scope | What counts at all: furniture, formwork, scaffolding, demolition | Yes |
| 2 | Breakdown | How finely things split: one line per wall or one per layer | Yes |
| 3 | Measurement rules | Units, deductions, inclusions, rounding | Yes |
| 4 | Classification | Which code and label each item gets | No |
| 5 | Grouping | By building part, by trade, or client template order | No |
| 6 | Presentation | Language, description wording, columns, currency, metric/imperial | No |

A seventh step applies whatever the standard: cleaning the input (trusting Revit vs geometry, overlaps, missing materials). It affects numbers but is data repair, not a standard choice.

### 4.6 One wall under three setups

A wall 10 m x 3 m with one 0.6 m2 window (thresholds illustrative):

| Setup | What the BoQ shows |
| --- | --- |
| As modelled (Duplex approach) | 1 line: cavity wall, 29.4 m2 (window subtracted) |
| UK-style detailed | 4-5 lines (brick, insulation, block, plasterboard), each 30 m2, because openings under ~1 m2 are not deducted |
| Ex-YU predmjer style | Spread across trade sections: masonry block in m3 (~5.8), facade brick, insulation, drywall and painting each in m2 in their own sections |

The split for the app: knobs 1-3 belong in the calculation engine; knobs 4-6 are a switchable view on top of the same results.

## 5. Choosing settings before generation

Yes, every knob can be selected before pressing "generate", and the engine then checks the file against those choices and reports back before calculating.

### 5.1 Presets

Picking "UK detailed" or "ex-YU predmjer" is not one switch but a bundle of dozens of small settings: a unit per item type, a deduction threshold, whether formwork is separate, how finely walls split. The user picks a preset, then tweaks ("...but deduct all openings"). This is the Params sheet idea from the Duplex workbook, scaled up.

### 5.2 Two kinds of choices

| Choice | When it must be set | Effect of changing later |
| --- | --- | --- |
| Scope, breakdown, measurement rules | Before calculation | Requires recalculation |
| Classification, grouping, presentation | Any time | Instant re-label and re-sort of existing results |

### 5.3 What can stop a simple pick

- **The file must contain what the choices need.** "Split walls into layers" needs layer data; "measure footings by material" needs a material (absent in the Duplex). The engine falls back to a default, makes a logged assumption, or asks.
- **Some combinations contradict each other.** "One line per wall" plus "block in m3" is impossible, because a single line has no separate block. Presets avoid most of this; custom mixes need a warning.
- **Input cleaning cannot be fully preselected.** Defaults like "trust Revit unless geometry differs by more than 1%" help, but cases like a mystery material "CT" or overlapping ceilings need a human mid-run.

Flow: pick a preset and adjust, generate, resolve flags, get the BoQ. Classification, grouping and look stay switchable at the end.

### 5.4 The pre-flight check

Before calculating, the engine compares the choices with the file and reports three kinds of problems:

1. **Missing information**: the choices need something the file lacks (footings with no material; worktops counted but no length).
2. **The choices contradict each other** (one line per wall + block in m3).
3. **The file contradicts itself** (Revit volume 2.0 m3 vs actual shape 2.9 m3; a party wall marked external; two ceilings on top of each other).

Each problem comes with options. Example report for the Duplex:

| Issue | Explanation | Options |
| --- | --- | --- |
| Footings: no material | Name says "Bearing Footing", probably concrete | Use concrete / Let me pick / Skip |
| Worktops: no length in file | Only a count is available | Count as pieces / Enter lengths manually |
| Party wall: Revit volume differs from shape | Explained by overlap with neighbouring walls | Use Revit's number (recommended) / Use shape |
| Ceilings 187462 and 187470 overlap (~3.2 m2) | Likely modelled twice | Keep both / Subtract overlap / Flag for designer |
| Everything else (210 elements) | No issues | Calculating |

Every answer is written into the BoQ notes, so later readers know what was assumed. This is the Duplex QA sheet turned around: questions first, decisions by the user.

### 5.5 The three quantity states

The agreed expectation: the engine cannot calculate what is not there. It derives proxies where possible and flags the rest; the user may supply the information or not.

| State | Meaning | Example |
| --- | --- | --- |
| Measured | Taken from the model, verified against geometry | Wall area from volume / thickness |
| Derived | Calculated from a proxy with the formula shown | Formwork from wall area; reinforcement from concrete volume x kg/m3 |
| Flagged | Cannot be determined; line present, quantity blank, reason stated | Worktop length when only a count exists |

A fourth source joins later: manual or template items (preliminaries, provisional sums, lump sums), see section 9.

Conditions for this to work reliably:

- flagged items stay in the bill; a silently missing line is the worst outcome;
- derived values are visibly marked, with proxy and factor shown;
- proxy factors are editable settings, not hidden constants, since reinforcement ratios and waste vary by project and region;
- accuracy is validated against real professional BoQs before it is claimed.

## 6. Engine architecture

The Duplex scripts are roughly 70% of an engine, written for one file. The engine takes two inputs, the IFC file(s) and a settings file, and runs fixed stages.

### 6.1 Stages

1. **Read**: IFC to clean JSON (elements, numbers, shape, materials, relationships). Already general.
2. **Check**: re-measure geometry, compare with the file's claims, find overlaps, test whether the file has what the settings need. Already general.
3. **Ask**: if anything is missing or contradictory, pause and return questions; continue when answered. New compared with the prototype.
4. **Measure**: apply scope, breakdown and rules; produce quantities, each with a "why" note.
5. **Output**: apply classification, grouping and layout; export to Excel, JSON or other formats.

### 6.2 Settings file (illustrative)

```yaml
preset: ex-yu-predmjer        # fills in all the small rules
scope:
  include_furniture: false
breakdown: per_layer
rules:
  opening_deduction_below_m2: 0.5
  masonry_unit: m3
grouping: by_trade
language: sr
```

Run as something like `boq run duplex.ifc --settings my-settings.yaml`, returning either a BoQ or a list of questions.

### 6.3 What must change from the prototype

- **Hard-coded rule table**: the prototype matched names from this exact file. The engine must recognise elements by class, layers, properties and a naming dictionary.
- **Rules in data, not code**: every standard becomes a preset file; adding "UK" or "US" means writing settings, not Python.
- **Ask and resume**: the prototype decided silently; the engine must stop, save state and continue after answers.

### 6.4 What is genuinely hard

- **Writing correct presets**: a domain expert must translate rulebooks into settings. The code is the easy part.
- **Recognising unclear names**: dictionary + AI suggestions + human confirmation, improving as answers are saved.
- **Authoring-tool quirks**: Revit, ArchiCAD and Tekla export differently, like the broken wall in the Duplex. Fixes accumulate from testing many real files.

### 6.5 What can be built in this setting

A working engine taking IFC + selected rulebook + classification + dictionary and returning a structured BoQ, with user prompts for missing data, is buildable over a few working sessions.

| Category | Items |
| --- | --- |
| Built properly | The engine; rule formats as data; pre-flight check; ask and resume with answers saved per project/company; the three quantity states; layered dictionaries and item libraries; derived-item rules with editable factors; structured JSON + Excel output with traceability |
| Illustrative, not authoritative | Rulebook presets: "as modelled" fully, plus approximate NRM2-style and VOB-style presets showing the mechanism (not certified; full texts are copyrighted; a QS must complete and verify); classification tables full if downloadable, otherwise partial; a real but small seed dictionary |
| Not guaranteed | Robustness across all authoring tools (only the Duplex and a few public samples testable); proven accuracy (needs professional reference BoQs); multi-model federation at scale (implementable, lightly testable) |

The right split: the engine is what can be built well now; presets and libraries are content that domain experts add.

## 7. The six knowledge gaps

Parsing and geometry are solved problems; what remains is mostly knowledge. Companion files: IFC_BoQ_Six_Knowledge_Gaps.docx, BoQ_Rulebooks_and_Classifications.xlsx, BoQ_Naming_Dictionary_and_Item_Library.xlsx.

| # | Gap | What it controls | Who fills it |
| --- | --- | --- | --- |
| 1 | Measurement rulebooks | How quantities are calculated (numbers) | Domain expert translating standards into settings |
| 2 | Classification systems | Labels and codes (never numbers) | Download and load existing code lists |
| 3 | Naming dictionary | Recognising what each element is | Seeded from public sources, grown by users |
| 4 | Item library | Turning a recognised element into a BoQ line | Seeded per standard, extended by companies and clients |
| 5 | Missing or broken model data | Whether input supports the output | Mostly the engine; partly the user |
| 6 | Answer key | Proof the output is correct | Developer, against professionally measured projects |

### 7.1 Gap 1: Measurement rulebooks

A rulebook decides units, deductions, inclusions, measured face and rounding.

| Rulebook | Region | Used for | Access | Realistic pick |
| --- | --- | --- | --- | --- |
| NRM2 (RICS) | UK, Commonwealth, Middle East | Detailed BoQs for building works; main UK standard | Free PDF + Excel templates on rics.org | Yes, international reference |
| NRM1 (RICS) | UK | Early cost estimates by element | Free PDF on rics.org | No |
| SMM7 | UK (legacy) | Older detailed method, replaced by NRM2 in 2013 | Reference only | No |
| CESMM4 (ICE) | UK | Civil engineering, not buildings | Paid | No |
| VOB Part C (DIN 18299 + trade parts) | Germany | Trade-specific measurement rules; Central European reference | Paid | Yes, DACH markets |
| ÖNORM B 22xx series | Austria | Trade contract standards incl. measurement (verify) | Paid | No |
| CIQS Method of Measurement | Canada | Canadian measurement method | Paid | No |
| No single standard | USA | Firm practice, organised by MasterFormat | - | No |
| GN norms / Prosječne norme | Ex-YU | Legacy norms, GN 400 = concrete, per m3; plus rule written in each item | Scattered old publications | Local markets only |
| "As modelled" | Anywhere | Net quantities from the model, no standard | - | Yes, default base |
| Client / tender template | Anywhere | Client dictates rules and format | From client | Yes, always needed |

The real gap: none exist in machine-readable form. They are prose; a QS must translate each into parameters ("deduct openings over X m2", "masonry over Y cm in m3", "formwork separate: yes"). The RICS NRM Excel templates are the closest structured starting point.

### 7.2 Gap 2: Classification systems

Classifications never change quantities and are independent of rulebooks: measure by GN rules, label with Uniclass codes, if wanted.

| System | Region | Organised by | Access | Realistic pick |
| --- | --- | --- | --- | --- |
| Uniclass 2015 (NBS) | UK | 12 tables: elements, systems, products, spaces... | Free, API | Yes |
| NRM1 element groups | UK | Building parts (used in the Duplex) | In NRM1 | No |
| ICMS 3 | International | Cost reporting across countries and project types | Free | Yes, neutral international |
| OmniClass | North America | 15 tables | Paid licence (CSI) | If targeting US |
| UniFormat / UniFormat II | North America | Building elements | Paid (CSI / ASTM E1557) | No |
| MasterFormat (CSI) | North America | Trades / work results, 50 divisions | Paid licence | If targeting US |
| DIN 276 | Germany / DACH | Cost groups 100-800 | Paid | DACH markets |
| CCI / CoClass | Nordics and CEE, growing | Object-based, BIM-oriented | CCI free (CC BY 4.0); CoClass check terms | Optional |
| Vrste radova (convention) | Ex-YU | Građevinski (pripremni, zemljani, betonski/AB, armirački, zidarski, izolaterski, tesarski...) and Zanatski (krovopokrivački, limarski, stolarski, bravarski, keramičarski, podopolagački, gipsarski, molersko-farbarski, fasaderski...) | Convention, no code list | Local markets |
| IFC classes + bSDD | International | Shared language other systems map onto | Free | Internal |

Gap size: small; download, load and map once.

### 7.3 Gap 3: Naming dictionary

| Resource | What it is | Official? | Access |
| --- | --- | --- | --- |
| bSDD | Multilingual dictionary of building concepts and properties, hosts classifications | Yes (buildingSMART) | Free, API |
| IFC schema (ISO 16739) | Standard element types with definitions | Yes | Free |
| ISO 12006-3 | Framework behind bSDD | Yes | Paid |
| Uniclass Pr (Products) | Generic product and material names with codes | Yes (NBS) | Free |
| ÖKOBAUDAT | German government material database, German/English, densities | Yes | Free |
| ETIM / ECLASS | Product classification, mainly MEP | Industry | ETIM free, ECLASS paid |
| IATE | EU terminology database (Croatian, not Serbian/Bosnian) | Yes (EU) | Free |
| Revit / ArchiCAD default libraries | Default type and material names | De facto | With software |
| Manufacturer catalogues / BIMobject | Brand names (Knauf, Ytong, Rigips...) | No | Mostly free |

Missing everywhere: local-language trade terms, full brand-to-generic coverage, office abbreviations and codes.

Users always need their own layer. Three layers, checked most specific first:

1. **Project**: one-off names in this model.
2. **Company**: office habits ("Z-25" = their 25 cm wall type).
3. **Global**: shipped dictionary seeded from bSDD, Uniclass, IFC and authoring-tool defaults.

Each review answer is saved at project or company level, so questions dry up over time.

### 7.4 Gap 4: Item library

| Resource | Region | What it is | Official? | Access |
| --- | --- | --- | --- | --- |
| STLB-Bau | Germany | Standard item descriptions tied to VOB/C | Yes (DIN/GAEB) | Paid |
| GAEB | Germany | BoQ exchange format | Yes | Spec available |
| LB-HB | Austria | Standardised item library for building works | Yes (ministry) | Free |
| ÖNORM A 2063 | Austria | BoQ exchange format | Yes | Paid |
| NPK | Switzerland | Standard item catalogue | Yes (CRB) | Paid |
| NRM2 | UK | Rules for structuring descriptions; not a library | Yes (RICS) | Free PDF |
| Commercial QS libraries (CostX, NBS-based) | UK | Ready item libraries | No | Paid |
| RSMeans | USA | Line items, units, unit costs | De facto | Paid |
| Regional norm books (e.g. GN norms) | Various | Legacy work descriptions with labour/material norms | Legacy | Scattered |
| Published tender BoQs | Anywhere | Wording in current use; procurement portals | No | Often free |
| IfcCostSchedule / IfcCostItem | International | Storing a BoQ inside IFC | Yes (IFC) | Free |

Users need their own layer even more than for names:

1. **Client template**: imported from the tender's spreadsheet BoQ; model elements matched to its items.
2. **Company library**: the firm's own items, often built by importing past BoQs.
3. **Base library**: shipped per rulebook preset.

Key feature: importing an existing BoQ spreadsheet as a template, which is how most firms work.

### 7.5 Gap 5: Missing or broken model data

| Case | Duplex example | Handled by |
| --- | --- | --- |
| Broken export | Wall with flipped faces: 433 m3 instead of 25.8 m3 | Engine, automatically (repair rules from testing many files) |
| Missing but derivable | Worktop length absent, but 3D shape present | Engine, automatically, derivation noted |
| Missing, needs a decision | Footings without material | Human review, or a logged default |
| Not in the model | No reinforcement, no MEP | Nobody: another model, manual input, or out of scope |

Only the third case belongs in the per-file review layer.

### 7.6 Gap 6: Answer key

Checking output against the file proves consistency, not professional accuracy.

1. Collect reference projects with both the IFC and a professionally hand-measured BoQ.
2. Run the engine with the same rulebook and settings.
3. Compare line by line, explain every difference, fix rules.
4. Repeat per preset and after every engine change.

This is development-time validation, invisible to users, and enables a claim like "matches professional output within X%". In production, recurring user corrections to the same quantity signal a faulty rule and feed back into it.

### 7.7 Who handles what

| Responsibility | Covers |
| --- | --- |
| Per-file human review (end user) | Unknown names (3), unmatched items (4), missing data needing a decision (part of 5) |
| Engine work (developer) | Export repairs and derivations (rest of 5), dictionary and library infrastructure |
| Validation (developer, before release) | Answer key (6) |
| Domain expertise (QS) | Rulebooks to presets (1), seeding item libraries (4) |
| Load once | Classification lists (2), public dictionary seeds (3) |

## 8. Sourcing rulebooks and classifications

A low-cost starting set exists: NRM 1 and 2 with their Excel templates, plus Uniclass, ICMS, CCI and bSDD, all free or nearly free. Checking sources corrected two earlier assumptions: NRM is freely published by RICS, and OmniClass is no longer free. Prices as checked on 3 Oct 2026. Companion file: IFC_BoQ_Sourcing_Rulebooks_and_Classifications.docx.

### 8.1 Rulebooks

| Rulebook | Where to get it | Cost / access |
| --- | --- | --- |
| [NRM 1, 2, 3 (RICS)](https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/construction-standards/nrm) | rics.org, Construction standards, NRM | Current editions (Oct 2021, reissued 2022) published as PDFs, e.g. [NRM 2 PDF](https://www.rics.org/content/dam/ricsglobal/documents/standards/october_2021_nrm_2.pdf); downloadable Excel templates for NRM 1, 2, 3 under RICS terms of use |
| SMM7 (legacy) | Same RICS page | Reference only; replaced by NRM2 from 1 Jan 2013 |
| [CESMM4 Revised (ICE)](https://www.ice.org.uk/areas-of-interest/infrastructure-delivery/civil-engineering-standard-measurement) | ICE Publishing or booksellers, ISBN 978-0-7277-6440-9 | Paid book, approx. USD 136, 128 pages; bundle with Handbook and Examples |
| [VOB Part C (DIN Media)](https://www.dinmedia.de/de/themenseiten/voballgemein) | dinmedia.de (formerly Beuth Verlag) | Individual ATVs, e.g. [DIN 18299:2023-09](https://www.dinmedia.de/en/standard/din-18299/369847346) approx. EUR 45 PDF; full set = VOB 2019 complete edition + 2023 supplement (21 revised ATVs); VOB online subscription |
| ÖNORM B 22xx | austrian-standards.at | Paid; current editions not verified |
| CIQS Method of Measurement | ciqs.org | Taught in Canadian estimating courses; check CIQS |

VOB/C structure: DIN 18299 holds general rules for all work; each trade standard (DIN 18300-18451) has its own measurement (Abrechnung) section.

### 8.2 Classifications

| System | Where to get it | Cost / access |
| --- | --- | --- |
| [Uniclass 2015](https://uniclass.thenbs.com/) | uniclass.thenbs.com | Free; 12 tables individually or bundled; quarterly updates; older versions; REST API; NBS Uniclass-IFC alignment; community [CSV version](https://github.com/buildig/uniclass-2015) |
| [ICMS 3](https://icms-coalition.org/the-standard/) | icms-coalition.org; also rics.org | Free; includes a guide to mapping national building elements to ICMS |
| CCI | Via CCIC; national portals (e.g. Czech standards agency) | Free, [CC BY 4.0](https://budweiser.cadstudio.cz/2023/03/report-from-construction-classification.html); based on ISO 81346 + Danish CCS; adopted in Czechia, Slovakia, Estonia and others |
| bSDD | search.bsdd.buildingsmart.org | Free, API; hosts several classifications |
| [OmniClass, MasterFormat, UniFormat (CSI)](https://csiresources.org/standards/overview) | csiresources.org | Paid firm-level CSI Dynamic Standards subscription covering all three; limited free MasterFormat lookup; licence needed for use in specs, templates, models or plugins (so software too) |
| UniFormat II | ASTM E1557, astm.org | Paid |
| DIN 276 | dinmedia.de | Paid |
| CoClass | coclass.byggtjanst.se | Check terms |

### 8.3 Licensing for a software product

Buying a standard to read differs from embedding it in software that is sold.

| Category | Standards | Implication |
| --- | --- | --- |
| Product-friendly | CCI (CC BY 4.0), ICMS, Uniclass | Embed with attribution; check Uniclass redistribution terms |
| Licence needed for software | MasterFormat, UniFormat, OmniClass | Budget a CSI licence before shipping their codes |
| Read, don't reproduce | NRM, VOB/C, CESMM4, ÖNORM | Obtain to understand rules and encode as parameters; whether encoded rules need a licence is a legal question per standard |

Recommended start: NRM 1 + 2 with templates; Uniclass, ICMS, CCI, bSDD. Later per market: VOB/C and DIN 276 for DACH, CSI standards for North America, CESMM4 if civil works enter scope.

## 9. Remaining gaps and later additions

Beyond the six knowledge gaps, ten further parts are needed, plus four business-logic additions found later. Critical: input check, multiple models, derived items. Companion file: IFC_BoQ_Remaining_Gaps.docx.

### 9.1 The ten further parts

| # | Part | What it is | Why it matters | How to address it | Priority |
| --- | --- | --- | --- | --- | --- |
| 1 | Input requirements check | Defined minimum the IFC must meet, checked before running | Poor models produce confident-looking wrong bills | IDS (buildingSMART); each preset ships its own IDS; failures reported with review questions | Critical |
| 2 | Multiple models at once | Separate files per discipline (federated) | Architect and engineer often model the same wall: double counting | Discipline ownership rules, cross-model overlap detection, conflicts to review | Critical |
| 3 | Derived items rules | Quantities for unmodelled work: excavation, formwork, reinforcement (kg/m3), skirtings, paint, waterproofing | Large share of real BoQs; where QS judgement lives | "If this exists, generate that item with this formula"; editable factors; marked as derived | Critical |
| 4 | IFC version differences | IFC2x3, IFC4, IFC4.3 store things differently | A parser tuned to one version silently loses data | Normalise every version into one internal record; test files per version | Needed |
| 5 | Traceability with 3D viewer | Click a line to highlight its elements, or an element to see its lines | Professionals don't trust untraceable numbers | Keep element-line links; open-source viewers (web-ifc / That Open Engine, xeokit) | High |
| 6 | Model revisions | Re-run on v2, show changes vs v1 | Models change weekly; users must not re-answer questions | Match by GlobalId, carry over decisions, change report per line | High |
| 7 | Rule editor | Interface for presets, derived rules, libraries | QSs, not programmers, maintain rules | Form-based editing, test run on a sample, versioning | Needed |
| 8 | Location breakdown: storeys, rooms, zones, units | Every quantity kept with site, building, storey, room, zone, unit, phase | Floor-by-floor pricing and scheduling, per-apartment costing, payment claims; site BoQs need it | Carry IfcSite / IfcBuilding / IfcBuildingStorey / IfcSpace / IfcZone through the pipeline; rules for elements spanning storeys; assign to rooms by geometry | High |
| 9 | Export and integration | Formats beyond Excel; pricing as next step | Some markets and tools require standard formats | Excel first; then GAEB, ÖNORM A 2063, IFC cost schedules, CSV; pricing as a separate step | Needed |
| 10 | Professional responsibility | A qualified person signs the BoQ | Liability sits with the professional | Output = draft for approval; audit trail makes sign-off fast | Needed |

### 9.2 Room-based finishes (part of item 8)

Many finishes depend on the room, not the element: bathroom walls tiled to a set height and painted above; the two faces of one wall finished differently because they face different rooms. This needs to know which face of each wall, floor and ceiling bounds which room. IFC can carry space boundaries (IfcRelSpaceBoundary), but many exports omit them, so the engine must compute room-face relationships from geometry. The Duplex avoided this by measuring paint as total plasterboard area. Because it changes numbers, location breakdown is rated High.

### 9.3 Items with no model behind them

Every real BoQ contains lines no IFC can produce. They come from the template or the user and must sit alongside model lines, under the same grouping and totals, using the same "source" field (manual/template).

| Type | What it is | Examples |
| --- | --- | --- |
| Preliminaries (general items, site overheads) | Cost of running the site, not of any building part; often 10-15% of a project | Fences, site office, toilets, containers, scaffolding, cranes, temporary power and water, site manager, security, insurance, permits, final cleaning |
| Provisional sums | Placeholder amounts for undecided work, replaced by measured items later | "Kitchen fit-out: provisional sum EUR 20,000"; "Landscaping: EUR 15,000" |
| Lump sums | One fixed price for a package, no measured quantities | "Lift supplied and installed"; "Fire alarm system complete" |

### 9.4 Two small additions to the logic

- **Renovation status**: models mark elements as new, existing or to be demolished (Revit phases). Renovation BoQs measure demolition separately and exclude existing elements. A filter plus a few demolition items, not a new subsystem.
- **Design options**: some models hold alternatives (e.g. two roof variants). The engine picks one or produces a BoQ per option, never counts both.

### 9.5 Platform layer (conventional software work)

Solving the gaps gives a fully functional engine and core product. A platform additionally needs the conventional layer, listed here for completeness:

- accounts, companies and permissions; data separation between companies;
- big-file handling with background processing, queues and progress;
- security: encryption, access logs, GDPR in Europe;
- collaboration: comments, assignment, approval flow (prepared, checked, approved);
- sending model problems back to designers via BCF;
- project history across revisions;
- pulling models from common data environments (Autodesk Construction Cloud, Trimble Connect);
- pricing: rate databases, company price lists, tender comparison (arguably a second product);
- billing, onboarding, help, support, interface translations;
- a clear decision on the primary user (QS, contractor bidding, designer checking costs).

## 10. Solvability, sufficiency and expectations

Almost every gap is solvable without a technical breakthrough; the limits are access to experts, reference data, input quality and licences. Commercial tools such as CostX and RIB iTWO already do model-based takeoff, proving the core is achievable; the flexible, multi-standard part is where existing tools tend to be rigid.

### 10.1 Which gaps are solvable how

| Solvable by | Gaps |
| --- | --- |
| Engineering alone | IFC versions (R4), export repairs and derivations (part of 5), input check via IDS (R1), 3D viewer (R5), revisions (R6), location breakdown (R8), export (R9), rule editor (R7), classifications (2) |
| Outside input: expertise, data or money | Rulebooks (1): a QS per standard, plus a legal check on encoding copyrighted rules; item libraries (4): free (LB-HB), licensed (STLB-Bau, NPK) or built from tender BoQs; answer key (6): partnerships for IFC + professional BoQ pairs; multiple models (R2): ownership rules need expert input |
| Only partly, ever | Naming dictionary (3): new names keep appearing, questions become rare but never vanish; derived items (R3): unusual projects need judgement; data not in the model (part of 5): only better models fix it; professional responsibility (R10): permanent by design |

### 10.2 Is it a fully functional system?

- **Logic: complete.** With all gaps resolved, every piece of logic exists, and any file can pass through the full chain to a correct, traceable BoQ.
- **Automation: high but not total.** Some answers are not in the file; some decisions are judgement; output quality follows model quality. A well-modelled file may be almost fully automatic; a messy one raises many review questions.
- **Agreed expectation.** The engine cannot calculate what is absent. It derives proxies where possible, flags the rest, and moves on; the user supplies the information or not. With that expectation, the design works.

### 10.3 Is the business logic sufficient?

Yes, as a complete design to start building from, though not final. Covered: the pipeline; four quantity sources (measured, derived, manual/template, flagged); swappable layered knowledge; multiple models, IDS input requirements, revisions, location breakdown with room-based finishes, traceability; plus renovation status and design options.

Why not final:

- a QS should review the rules and flow (not the code) before much is built, to catch conventions neither side knows;
- the answer-key comparison will expose edge cases, which is expected.

The design absorbs discoveries because rules live in data: most findings mean a new rule, parameter or derived formula, not a redesign.

## 11. Test corpus

About 15-20 varied IFC files give relative confidence in a working engine, plus 2-3 projects with a professional BoQ to prove accuracy. Variety beats volume: 50 Revit files teach less than 10 from different tools. Companion file: IFC_Test_Corpus_Plan.xlsx (21-file plan with live coverage tracking).

### 11.1 Dimensions to cover

| Dimension | Why it matters | Minimum to cover |
| --- | --- | --- |
| Authoring tool | Each exports materials, quantities, geometry and names differently | Revit, ArchiCAD, Tekla Structures, one of Allplan / Vectorworks / BricsCAD, one native-IFC tool (Bonsai/BlenderBIM or FreeCAD) |
| IFC version | Different storage of quantities and materials | IFC2x3 and IFC4 (IFC4.3 for infrastructure) |
| Exporter age | A 2011 Revit export differs greatly from a current one | One old, several current |
| Discipline | Architecture, structure and MEP stress different logic | All three, ideally from the same project |
| Building type | Timber residential vs concrete multi-storey vs steel hall | 3 types |
| Model quality | Clean samples hide real-world mess | At least 2 messy real files |
| Export settings | Same model, base quantities on/off or split differently | 1 model exported 2-3 ways |

### 11.2 Numbers

- **Absolute minimum, about 6 files**: Revit, ArchiCAD and Tekla, in IFC2x3 and IFC4, plus one federated set. Proves the engine is not tied to one tool.
- **Relatively confident, about 15-20 files** covering the table above.
- **Accuracy, 2-3 projects** with both IFC and a professionally hand-measured BoQ. A separate requirement: the 15-20 prove the engine works; these prove it is right.

After that, confidence grows through real user files; every new exporter quirk becomes a repair rule.

### 11.3 Planned corpus (summary of the spreadsheet)

| Tier | Files | Examples |
| --- | --- | --- |
| Minimum | 6 | NIBS Duplex (have), modern Revit IFC4, ArchiCAD IFC2x3, Tekla concrete with rebar, Bonsai native IFC4, NIBS Office federated set |
| Confident | 10 | ArchiCAD IFC4, Tekla steel, Revit structure, Revit MEP, Allplan, Vectorworks/BricsCAD, real federated set, 2 messy real files, one model exported 3 ways |
| Optional | 2 | FreeCAD, IFC4.3 infrastructure |
| Accuracy | 3 | Residential, commercial, different type, each with a professional BoQ |

### 11.4 Free starting sources

- buildingSMART Sample-Test-Files (GitHub): official test files across IFC versions.
- NIBS / COBie sample buildings: Duplex, Office and Clinic, some with structural and MEP files usable as federated sets.
- Schependomlaan dataset (GitHub): real Dutch residential project, multiple disciplines.
- Own exports and self-made Bonsai/FreeCAD models.
- Firm partnerships: the only source of messy real files and professional BoQs.

## 12. Platform data model, federation and scope rules

A project acts as the container; IFCs are versions of discipline models; BoQs belong to the project and reference the model versions and preset they used. The original idea (project folder, IFCs with metadata, several BoQs per IFC from different presets, users pick and export) fits inside this with four refinements.

### 12.1 Four refinements

1. **IFCs are versions of a model, not loose files.** Project > Model (e.g. Architecture) > Versions (v1, v2, v3). Enables change tracking and carrying over decisions.
2. **A BoQ does not belong to one IFC.** With multiple models, one BoQ is built from e.g. architecture v3 + structure v2, so it belongs to the project and references its inputs.
3. **Review answers live at project level** (and company level above), reused by every BoQ, preset and revision.
4. **BoQs have a lifecycle and exports are frozen.** Draft > in review > approved > issued. Issued BoQs are locked; changes create a new revision, because issued BoQs go into contracts.

### 12.2 Entity structure

```text
Company
 ├─ Users & roles
 ├─ Presets (rulebooks, classifications), dictionaries, item libraries
 └─ Projects
     ├─ Metadata (location, currency, default preset, team)
     ├─ Models (Architecture, Structure, MEP…)
     │    └─ Versions (IFC file + tool, schema, upload date, input-check result)
     ├─ Decisions (review answers for this project)
     └─ BoQs
          ├─ Inputs: which model versions
          ├─ Preset snapshot: exact rules + settings used
          ├─ Lines: measured / derived / manual / flagged, linked to elements
          ├─ Status: draft → review → approved → issued
          └─ Exports: frozen files, who and when
```

The BoQ stores a snapshot of the preset, not a link, so editing the company preset later never changes past BoQs. Comparisons come almost free: same model under preset A vs B, or v2 vs v3 under one preset.

### 12.3 Why projects are several files

One project, usually not one file:

- different firms use different software (architect Revit, structural Tekla, MEP other) and cannot author in each other's tools;
- each discipline is legally responsible for, and controls, its own model;
- disciplines update at different rhythms;
- large models reach gigabytes, so files are split by discipline and sometimes by building or floor.

The norm is a federated model, combined only when viewed or checked (Navisworks, Solibri), as assumed by ISO 19650. One file happens on small single-firm projects like the Duplex, and even then exports are often split by discipline. The engine treats one file as a federation of one.

### 12.4 Why merging finished BoQs fails

Several IFCs can feed one BoQ, but the models are combined first, then measured once.

- **Double counting**: architect and structural engineer both model the concrete walls.
- **Things spanning models**: a structural wall gets architectural plaster and paint; formwork comes from structure, finishes from architectural rooms.
- **Rooms and locations**: rooms usually exist only in the architectural model.
- **Disagreeing models**: "Level 1" at 0.00 vs "GF" at +0.05; slightly offset coordinates.

Correct order:

1. load the selected model versions;
2. align coordinates, storey names and levels;
3. remove duplicates via ownership rules, conflicts to review;
4. link across models (walls to rooms, openings to hosts);
5. measure once, one BoQ.

Simple merging is correct only where scopes do not overlap (two buildings, two independently measured phases) and the same preset and classification were used. That is a separate "combine BoQs" feature.

### 12.5 Scope rules per model

Users say, in effect, "take concrete works from this model, ignore X; take electrics from that one, ignore bricks". It works best in three steps:

1. **Tag each model with its discipline; defaults follow** (the engine can usually guess).

| Discipline tag | Model provides by default | Ignored by default |
| --- | --- | --- |
| Structure | Foundations, load-bearing concrete, steel, reinforcement | Everything else |
| Architecture | Partitions, finishes, doors, windows, roofs, rooms | Structural elements |
| MEP | Pipes, ducts, cables, fixtures | Everything else |

2. **Adjust with include/exclude filters** by element type, classification, material or storey, e.g. "take stairs from architecture; the structural ones are placeholders" or "ignore furniture".
3. **The engine checks the result**: overlaps (claimed by two models, would double count) and holes (claimed by none, would go missing), using the same solid-intersection test as in the Duplex, run across files.

Scope settings are saved with the project and reapplied to new versions; companies can save templates such as "our standard three-discipline split".

## 13. Users, roles and access

The company owns everything; people get roles per project. Everything (projects, models, BoQs, presets, dictionaries, libraries) belongs to the organisation, never to a user, so nothing leaves when an employee does. A user can belong to several organisations, common for freelance QSs and consultants.

```text
Organization
 ├─ Members (users) + Teams (groups of users)
 ├─ Company knowledge: presets, dictionaries, item libraries
 └─ Projects
      └─ Project members: users or teams, each with a project role
```

### 13.1 Organisation roles

| Role | Can do |
| --- | --- |
| Owner / Admin | Manage members, teams, billing; create projects |
| Rules editor | Edit company presets, dictionaries, item libraries |
| Member | Access only projects they are added to |

### 13.2 Project roles

| Role | Can do |
| --- | --- |
| Project lead | Manage project members, scope rules, settings |
| Estimator | Upload models, run BoQs, answer review questions, add manual items |
| Approver | Approve and issue BoQs |
| Viewer | See and export issued BoQs only |
| Guest (external) | Narrow access, e.g. the structural engineer uploads only structure versions; a client only views issued BoQs |

Teams receive roles as a group ("Estimating team = Estimator on all projects").

### 13.3 Platform-specific rules

- **Promoting knowledge is a permission**: any estimator can answer "CT = cement screed" for their project; saving it company-wide needs a rules editor.
- **Four-eyes approval** (optional per company): the preparer cannot be the only approver.
- **Issued means locked**: not even admins edit an issued BoQ; changes create a revision.
- **External sharing is narrow and expiring**: read-only links to issued BoQs, or guest access limited to a model or project.
- **Audit log**: who uploaded, answered, approved and exported what and when; the trail behind professional sign-off.

First version: fixed roles, project membership, guests and the audit log. Custom roles and fine-grained permissions later, on customer demand.

## 14. Background processing, performance and notifications

First processing takes from seconds to tens of minutes depending on the model; everything afterwards takes seconds because heavy results are cached per model version. Every run is a background job, so users upload, leave, and get notified.

### 14.1 Measured on the Duplex

The 2.4 MB, ~220-element file needed about 3 seconds of geometry generation; the whole unoptimised pipeline (extract, verify, overlap check, classify, build BoQ) ran in well under a minute in a modest sandbox.

### 14.2 Estimates for real models

Ballpark, assuming an 8-16 core server and reasonably optimised code; to be confirmed with the test corpus.

| Model | Typical size | First processing |
| --- | --- | --- |
| Small (house, duplex) | < 1k elements, < 20 MB | 10-30 seconds |
| Medium (apartment block, office) | 10k-50k elements, 50-300 MB | 1-5 minutes |
| Large / federated (hospital, airport, multiple disciplines) | 200k+ elements, GBs | 10-30+ minutes |

### 14.3 Where the time goes

| Step | Cost | Why |
| --- | --- | --- |
| Reading the file | Fast | Simple parsing |
| Generating geometry | Slowest | Every element turned into a solid with openings cut; curved and complex shapes much slower |
| Overlap checks | Slow | Solid comparisons, especially across federated models; a spatial index keeps it manageable |
| Room-face relationships | Medium | Which wall face touches which room |
| AI name resolution | Small | Per unique name, not per element, and cached |
| Measuring, rules, output | Milliseconds to seconds | Arithmetic over prepared data |

After the first run: switching preset, classification or grouping takes seconds; answering review questions takes seconds; a new revision reprocesses only changed elements, matched by element ID. This makes comparison features feel instant.

### 14.4 Job flow and states

1. Upload goes straight to file storage (direct upload for large IFCs, not through the API).
2. A job is queued; the user sees "Processing started".
3. A worker runs read, geometry, verify, and check against settings.
4. The job ends in one of three notified states: **Ready** ("Architecture v3 processed, BoQ ready"), **Needs input** ("12 questions need your answer"), or **Failed** with a clear reason ("file corrupt", "walls have no materials").

```text
queued → processing (stage 2/5, 40%) → needs input → processing → completed
                                    ↘ failed (reason)       ↘ cancelled
```

The "needs input" state matters: review questions mean a job cannot always finish unattended, so it pauses, saves state, notifies, and resumes after answers.

### 14.5 Notifications

- **In-app**: live progress bar via a WebSocket or server-sent events channel, plus a notification bell.
- **Email**: for ready, needs input and failed, the moments someone must act.
- **Mobile push**: later, if there is an app.
- **Team**: "BoQ approved", "new model version uploaded by the structural engineer", to relevant project members.

### 14.6 Technical shape

The engine (Python, where ifcopenshell lives) runs as separate worker processes behind a job queue, not inside the web app:

- heavy files never slow the app for others;
- workers scale with load, and faster workers can be reserved for enterprise customers (processing as a paid add-on);
- failed jobs retry automatically after crashes; users can cancel long runs.

## 15. Usage tiers and pricing model

A hybrid of seat subscriptions, pay-per-project and add-ons fits the three buyer types best; numbers are illustrative and need testing with real customers.

### 15.1 What to charge for

- **Seats**: standard, predictable for firms.
- **Active projects**: tracks value (30 projects get more value than 3).
- **Processing**: large federated models and AI name resolution cost real compute; cap by model size or processing credits rather than headline price.
- **Rulebook packs**: some standards cost money to license (e.g. CSI), so they become paid add-ons.

### 15.2 Who pays and how

| Buyer | Usage pattern | Preferred model |
| --- | --- | --- |
| QS firms | Daily | Seat subscription |
| Contractors bidding tenders | Bursts | Pay per project |
| Designers checking costs | Light | Cheap entry tier |

### 15.3 Example tiers

| Tier | For | Includes | Indicative price |
| --- | --- | --- | --- |
| Free / Trial | Trying it out | 1 project, small models, "as modelled" preset only, watermarked export | EUR 0 |
| Pay per project | Occasional bidders | One project for 30-90 days, full features, 1-2 presets | EUR X per project |
| Professional | Small firms | 3-5 seats, ~10 active projects, standard presets, review flow, Excel export | EUR Y per month |
| Team | Mid-size firms | More seats and projects, multiple models per project, revisions and comparison, company dictionaries, approval flow | EUR Z per month |
| Enterprise | Large firms | Unlimited usage, custom presets built with you, SSO, API, audit exports, priority support | Custom quote |

Add-ons on any tier: extra rulebook packs (NRM2, VOB, CSI...), extra processing for very large models, API access.

### 15.4 Principles

- **Regional pricing**: the same tier cannot cost the same in the UK and the Balkans.
- **Never price per BoQ generated**: it discourages trying presets, and comparison is a key strength. Charge per project and seat; BoQs inside a project are unlimited.
- **Pay per project is the entry point**: three tenders a year make a subscription look cheaper.
- **Custom preset work is service revenue**: enterprise customers pay to have their in-house rules encoded (with a QS partner).

## 16. Readiness for engineers, open questions and next steps

As a conceptual basis this is solid: an engineer would understand what the product is, why it is hard, and how the pieces fit. It is not yet a specification they could build from without back-and-forth.

### 16.1 Already strong

- The core idea: a rules-as-data engine with swappable presets.
- The pipeline: read, verify, pre-flight check, ask, measure, derive, output, with nothing silently dropped.
- The hard problems named and reasoned through: federation, revisions, room-based finishes, data quality, validation.
- A sensible platform shape: projects, model versions, BoQs with lifecycle, roles, background jobs.
- A working proof: the Duplex scripts and BoQ.

### 16.2 What an engineer would still need

1. One consolidated document (this one).
2. A v1 scope: what is in and explicitly out (e.g. one rulebook, single model, Excel export).
3. A glossary (section 2).
4. The rule / preset format: what a preset looks like as data; the heart of the system, to be designed deliberately.
5. The data model written out with fields.
6. Key user flows (upload, review questions, approve, export), ideally as wireframes.
7. Non-functional targets: maximum file size, processing-time goals, security and data separation.
8. Acceptance criteria, e.g. "matches a professional BoQ within X% on these 3 reference projects".
9. The open decisions below.

### 16.3 Suggested first version

The engine, one or two rulebook presets, the review step, Excel export and a basic viewer would already be valuable to one type of user in one market. Most of the platform layer gets added as customers ask.

### 16.4 Open questions

- [ ] Who is the primary user for v1: QS firm, contractor bidding tenders, or designer checking costs?
- [ ] Which market and rulebook first (e.g. "as modelled" + NRM2, or a regional preset)?
- [ ] What exactly is in and out of v1 scope?
- [ ] Which QS / civil engineer partner will translate rulebooks into presets and review the logic?
- [ ] Legal check per standard: does encoding NRM, VOB, CESMM or ÖNORM rules as parameters need a licence?
- [ ] CSI licence: needed only if North America is targeted.
- [ ] Where will messy real files and the 2-3 professional reference BoQs come from (firm partnerships)?
- [ ] Design of the preset / rule data format.
- [ ] How AI is used for name resolution, and confidence thresholds for sending items to review.
- [ ] Pricing validation and regional price levels.
- [ ] Is pricing (rates) part of the product or a later second product?

### 16.5 Next steps

- [ ] Decide v1 primary user, market and scope.
- [ ] Find a QS partner and have them review sections 4-9.
- [ ] Collect the minimum 6-file test corpus (IFC_Test_Corpus_Plan.xlsx).
- [ ] Design the preset format and write the "as modelled" preset.
- [ ] Turn the Duplex scripts into a v0 engine (IFC + settings in, BoQ or questions out).
- [ ] Approach firms for reference projects with professional BoQs.

### Sources

Pages opened during the conversation:

- [RICS: NRM suite and Excel templates](https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/construction-standards/nrm)
- [RICS: NRM 2 (Oct 2021) PDF](https://www.rics.org/content/dam/ricsglobal/documents/standards/october_2021_nrm_2.pdf)
- [ICE: CESMM](https://www.ice.org.uk/areas-of-interest/infrastructure-delivery/civil-engineering-standard-measurement)
- [DIN Media: DIN 18299:2023-09](https://www.dinmedia.de/en/standard/din-18299/369847346)
- [DIN Media: VOB 2019 and 2023 supplement](https://www.dinmedia.de/de/themenseiten/voballgemein)
- [NBS: Uniclass](https://uniclass.thenbs.com/)
- [GitHub: Uniclass in CSV](https://github.com/buildig/uniclass-2015)
- [ICMS Coalition: ICMS 3](https://icms-coalition.org/the-standard/)
- [CSI: Dynamic Standards](https://csiresources.org/standards/overview)
- [CCIC seminar report: CCI licensing](https://budweiser.cadstudio.cz/2023/03/report-from-construction-classification.html)
- [University of Montenegro: predmjer and GN norms](https://www.ucg.ac.me/skladiste/blog_45298/objava_67552/fajlovi/Proracun%20kolicina%20radova%20i%20predracun%20radova.pdf)
- [Serbian general conditions referencing average construction norms](https://www.divac.com/upload/document/opsti_uslovi.pdf)
