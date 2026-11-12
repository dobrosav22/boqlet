# 01 Domain primer

For developers who have never priced a building. Everything here was explained in plain
language during the original conversation (the product owner is a frontend developer, not a
quantity surveyor). Verbatim originals: `reference/knowledge-base-2026-10-03.md` sections 2, 4, 5.

## What a BoQ is

A **Bill of Quantities** is a list of construction work items. Each row has a reference, a
description, a unit and a quantity. Contractors add unit rates; rate x quantity = amount;
amounts sum to a price. BoQs are the backbone of tenders and construction contracts, which is
why they must be traceable and why a qualified person signs them off.

| Ref | Description | Unit | Qty | Rate | Amount |
|---|---|---|---|---|---|
| B.01 | In-situ concrete strip footings 900 x 300 | m3 | 16.53 | (contractor) | = qty x rate |

The column set is close to universal. What varies is which rows exist, how they are measured,
how they are coded and grouped, and the wording.

## Glossary

| Term | Meaning |
|---|---|
| BoQ (Bill of Quantities) | List of work items with description, unit and quantity; priced by adding rates. Regional names include "predmjer" (ex-Yugoslav, quantities only), "predračun" (priced), "troškovnik" (Croatian, priced), "Leistungsverzeichnis" (German). |
| QS (Quantity Surveyor) | The professional who measures and prices construction work. Signs the BoQ. |
| IFC (Industry Foundation Classes) | Open ISO standard (ISO 16739) for exchanging building models between BIM tools. Versions in use: IFC2x3, IFC4, IFC4.3 (infrastructure). |
| BIM | Building Information Modelling: designing buildings as 3D models with data on every element. |
| Authoring tool | Software a model is made in: Revit, Archicad, Tekla Structures, Allplan, Vectorworks, BricsCAD, Bonsai (BlenderBIM), FreeCAD. Plain AutoCAD is not a meaningful IFC source. |
| Element | One object in the model (wall, slab, door, beam), identified by a permanent GlobalId (GUID). |
| IFC class | The standardised type of an element: IfcWall, IfcSlab, IfcDoor. Names, by contrast, are free text. |
| Property set (Pset) | Named group of properties. `Pset_*Common` are standard (IsExternal, LoadBearing); `PSet_Revit_*` are tool-specific. |
| Quantity set / BaseQuantities | Standard IFC quantities (length, area, volume). Often missing in older exports, as in the Duplex. |
| Material layer set | Ordered layers of a wall, slab or roof with thicknesses, e.g. brick 92 mm, cavity 25 mm, insulation 50 mm. |
| Aggregation | A parent made of parts: IfcRoof containing an IfcSlab, IfcStair containing flights and stringers. Measure the parent or the parts, never both. |
| Opening | A void cut into a host (wall, slab), usually filled by a door or window. |
| Measurement rulebook / method of measurement | Rules for how quantities are calculated: units, deductions, inclusions, rounding. Examples: NRM2 (UK), VOB/C (Germany), CESMM4 (UK civil). **Changes the numbers.** |
| Classification system | Codes and names for buckets of items: Uniclass, OmniClass, MasterFormat, DIN 276, a company's own codes. **Never changes the numbers.** |
| Elemental grouping | BoQ organised by building part (substructure, frame, roof, walls). Used for cost planning (NRM1, UniFormat). |
| Trade / work-section grouping | BoQ organised by trade package (concrete works, masonry, painting). Used for tendering because sections map to subcontractors (NRM2, MasterFormat). |
| Naming dictionary | Maps messy names (BETON, C25/30, office codes) to one meaning (concrete). |
| Item library | Maps a recognised element to a standard BoQ line: description, unit, which quantity. |
| Preset | A bundle of dozens of settings representing one rulebook or one company's conventions, adjustable by the user. |
| Measured quantity | Taken from the model and verified against geometry. |
| Derived quantity (proxy) | Calculated from other data with a visible formula: formwork from wall area, reinforcement from concrete volume x kg/m3, paint from plasterboard area. |
| Flagged item | A line whose quantity cannot be determined. Kept in the BoQ, quantity blank, reason stated. Never dropped. |
| Preliminaries | Site running costs not tied to any element: fencing, site office, scaffolding, cranes, temporary power and water, site manager, insurance. Often 10-15% of a project. |
| Provisional sum | A placeholder amount for work not yet designed ("kitchen fit-out: 20,000"). Replaced by measured items later. |
| Lump sum | One fixed price for a package with no measured quantities ("lift supplied and installed"). |
| Daywork | Work paid by time and materials rather than measured quantity. |
| Formwork | Temporary moulds holding concrete while it sets; usually measured as m2 of contact area. |
| Federated model | A project split into one model per discipline (architecture, structure, MEP), combined only for viewing and checking. The norm on real projects. |
| Discipline | Architecture, structure, MEP (mechanical, electrical, plumbing), etc. Each usually owns its own model. |
| Space / room | IfcSpace. Rooms usually exist only in the architectural model. |
| Space boundary | IfcRelSpaceBoundary: which element face bounds which room. Often missing from exports. |
| NIA | Net internal area: sum of usable room floor areas. |
| IDS | buildingSMART Information Delivery Specification: machine-readable statement of what an IFC must contain. |
| bSDD | buildingSMART Data Dictionary: free multilingual dictionary of building concepts, with an API. |
| BCF | BIM Collaboration Format: standard for sending model issues back to designers. |
| GAEB / ÖNORM A 2063 | German / Austrian file formats for exchanging BoQs between programs. Tenders in Germany arrive as GAEB files. |
| Answer key | Reference projects with a professionally hand-measured BoQ, used to prove the engine's accuracy. |

## Why one IFC can give many different BoQs: the six knobs

Think of the IFC as raw facts and the BoQ as a report written under rules. Six independent
choices shape the report. Only the first three change numbers.

| # | Knob | What it decides | Changes numbers? | Where it lives here |
|---|---|---|---|---|
| 1 | Scope | What counts at all: furniture, formwork, scaffolding, demolition | Yes | Rule set (which items/derived/manual exist, `enabled` slots) |
| 2 | Breakdown | How finely things split: one line per wall type, or one per layer, per storey | Yes | Rule set (`breakdown`, `lineKey`, `bands`) |
| 3 | Measurement rules | Units, deductions, inclusions, rounding | Yes | Rule set (`quantity`, `deductions`, `rounding`, params) |
| 4 | Classification | Which code and label each line gets | No | Classification (code list + map) |
| 5 | Grouping | By building part, by trade, or by a client template's order | No | Pick which classification's hierarchy groups the sheet |
| 6 | Presentation | Language, wording, columns, currency, metric or imperial | No | Description templates, export |

A seventh step applies whatever the standard: **cleaning the input** (trusting the authoring
tool's numbers vs the geometry, overlaps, missing materials). It affects numbers but is data
repair, not a standard. In this repo that is `measure.py`'s adoption policy plus questions.

So: knobs 1-3 belong in the calculation; 4-6 are a switchable view over the same results.

### One wall, three setups

A wall 10 m x 3 m with one 0.6 m2 window (thresholds illustrative):

| Setup | What the BoQ shows |
|---|---|
| As modelled | 1 line: cavity wall, 29.4 m2 (window subtracted) |
| A detailed UK-style method | 4-5 lines (brick, insulation, block, plasterboard), each 30 m2, because openings under about 1 m2 are not deducted |
| A regional trade-section style (e.g. ex-Yugoslav practice) | Spread over trade sections: masonry block in m3 (about 5.8), facade brick, insulation, drywall and painting each in m2 in their own sections |

## Measurement standards

There are many; none can be deduced from an IFC, because IFC carries geometry and properties,
not measurement rules. A file only hints at its origin (Revit metric families, a US address,
GSA area properties, OmniClass codes).

Switching standards keeps the overall logic. Extraction, verification, overlap checks and
classification are standard-agnostic. What changes is the rules layer:

- deduction thresholds (below what size an opening is ignored);
- units per item (some practices measure thick masonry in m3 and thin in m2; NRM measures walls in m2);
- whether formwork is a separate item or included in the concrete;
- which face, centreline or dimension is measured;
- rounding, item descriptions and language.

The standards landscape (which exist, where, access, licensing) is in
`08-knowledge-gaps-and-sourcing.md`.

## Element names: defaults vs custom

Only the IFC class is standardised; names are free text. The Duplex names are mostly Revit
defaults (families `M_Single-Flush`, `M_Fixed`; wall types "Exterior - Brick on Block";
materials "Masonry - Concrete Block"), with a few customised ("Party Wall - CMU Residential
Unit Dimising Wall", typo included). Real projects carry office naming conventions, local
languages and internal codes. Matching rules on raw names is the fragile part of any
prototype; this engine matches on **dictionary terms** instead.

An element carries more evidence than its name: IFC class and predefined type, layer
structure and thicknesses, `Pset_*Common` flags, classification references already in the
file, material properties (a strength class like C25/30 implies concrete), position (below
grade), host. Resolution runs in layers: exact match, aliases and translations, context, and
finally a question to the user. An answer is saved so the question never repeats. Ambiguous
cases like "CT" (ceramic tile? cement screed? an internal code?) always go to review, never a
silent guess. See `07-dictionaries-and-classification.md`.

## Grouping and formatting

Two philosophies dominate: **elemental** (by building part, for cost planning) and **trade /
work section** (by trade, for tendering). Firms customise numbering, detail level,
preliminaries, provisional sums and summary pages; public tenders often fix the format
exactly. Because each line can carry several codes at once (an elemental code and a trade
code), the same quantities pivot into either structure, or a client's template, without
recalculation.

## The four kinds of quantity

The agreed expectation: the engine cannot calculate what is not there. It derives proxies where
possible, flags the rest, and moves on; the user supplies the information or not.

| Source | Meaning | Example |
|---|---|---|
| Measured | From the model, verified against geometry | Wall area from volume / thickness |
| Derived | From a proxy, formula shown | Formwork from wall area; reinforcement from concrete volume x kg/m3 |
| Manual | No model behind it: preliminaries, provisional sums, lump sums, dayworks | Site setup, 1 item |
| Flagged | Cannot be determined; line present, quantity blank, reason stated | Worktop length when only a count exists |

Conditions for this to be trustworthy: flagged items stay in the bill (a silently missing line
is the worst outcome); derived values are visibly marked with proxy and factor; proxy factors
are editable parameters, not hidden constants; accuracy is validated against professional BoQs
before it is claimed.

## Items with no model behind them

Every real BoQ has lines no IFC can produce. They come from the rule set or the user and sit
alongside model lines under the same grouping and totals (`LineSource = "manual"`).

| Type | Examples |
|---|---|
| Preliminaries (general items) | Fences, site office, toilets, containers, scaffolding, cranes, temporary power and water, site manager, security, insurance, permits, final cleaning |
| Provisional sums | "Kitchen fit-out: provisional sum 20,000"; "Landscaping: 15,000" |
| Lump sums | "Lift supplied and installed"; "Fire alarm system complete" |

## Two smaller pieces of logic

- **Renovation status.** Models mark elements new, existing or to be demolished (Revit phases).
  Renovation BoQs measure demolition separately and exclude existing elements. A filter (`status`
  field) plus a few demolition items, not a subsystem.
- **Design options.** Some models hold alternatives (two roof variants). Pick one or produce a
  BoQ per option; never count both.

## Location matters

Professionals price floor by floor, flat by flat, phase by phase. Every quantity should keep
site, building, storey, room, zone, unit and phase. Many finishes depend on the **room**, not
the element: bathroom walls tiled to a height and painted above; the two faces of one wall
finished differently because they face different rooms. That needs to know which face bounds
which room (`IfcRelSpaceBoundary`, often missing, so computed from geometry). This repo keeps
storey per line; per-face room relationships are not built yet (see 11).
