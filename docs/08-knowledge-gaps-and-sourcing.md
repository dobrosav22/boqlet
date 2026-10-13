# 08 Knowledge gaps, sourcing and licensing

Parsing and geometry are solved problems. What remains is mostly **knowledge**: rules,
code lists, vocabularies, item wording, and proof of accuracy. This page lists the gaps, where
each kind of content can come from, and what licences allow. Prices and terms were checked in
early October 2026. Nothing here is legal advice; have an IP lawyer confirm before launch.

Originals: `reference/files/IFC_BoQ_Six_Knowledge_Gaps.docx`,
`IFC_BoQ_Remaining_Gaps.docx`, `IFC_BoQ_Sourcing_Rulebooks_and_Classifications.docx`,
`BoQ_Rulebooks_and_Classifications.xlsx`, `BoQ_Naming_Dictionary_and_Item_Library.xlsx`, and
`reference/knowledge-base-2026-10-03.md` sections 7-10.

## The six knowledge gaps

| # | Gap | Controls | Who fills it | In this repo |
|---|---|---|---|---|
| 1 | Measurement rulebooks | How quantities are calculated | A domain expert (QS) translating a standard into slot values and rules | The rule type and illustrative presets; no real standard encoded |
| 2 | Classification systems | Labels and codes (never numbers) | Download and load existing lists | Code-list type, importer, an invented company list, a demo trade list, a Uniclass map |
| 3 | Naming dictionary | Recognising what each element is | Seeded from public sources, grown by users | Layered dictionary type, a small global seed, company and project examples |
| 4 | Item library | Turning a recognised element into a BoQ line with standard wording | Seeded per standard, extended by companies, imported from client templates | Partly covered by rule descriptions; no item library or template import yet |
| 5 | Missing or broken model data | Whether the input supports the output | Mostly the engine; partly the user | Verification checks, adoption policy, questions |
| 6 | Answer key | Proof the output is correct | Developer, against professionally measured projects | One hand-made BoQ (Duplex); no professional reference yet |

### Gap 1: measurement rulebooks

None exist in machine-readable form. They are prose; someone must translate "deduct openings
over X m2", "masonry over Y cm in m3", "formwork measured separately" into slots. The RICS NRM
Excel templates are the closest structured starting point.

The table below is the short list from the original conversation. The wider world (Australia and
New Zealand, Hong Kong, South Africa, Nigeria, China, Japan, India, the Nordics, civil and
floor-area standards) and **how much of our rule template each standard covers** are in
[13-measurement-standards.md](13-measurement-standards.md).

| Rulebook | Region | Used for | Access |
|---|---|---|---|
| NRM2 (RICS) | UK, Commonwealth, Middle East | Detailed BoQs for building works; the main UK standard | Free PDF and Excel templates on rics.org |
| NRM1 (RICS) | UK | Early cost estimates by element | Free PDF |
| SMM7 | UK (legacy) | Replaced by NRM2 from 1 Jan 2013 | Reference only |
| CESMM4 (ICE) | UK | Civil engineering, not buildings | Paid book |
| VOB Part C (DIN 18299 + trade standards DIN 18300-18451) | Germany | Trade-specific measurement ("Abrechnung" section per trade) | Paid (DIN Media) |
| ÖNORM B 22xx | Austria | Trade contract standards including measurement | Paid |
| SIA / NPK | Switzerland | Standard item catalogue and conditions | Paid |
| CIQS Method of Measurement | Canada | Canadian method | Via CIQS |
| No single standard | USA | Firm practice organised by MasterFormat | |
| Legacy regional norms (e.g. GN norms in former Yugoslavia) | Various | Work descriptions with labour and material norms | Scattered publications |
| "As modelled" | Anywhere | Net quantities, no standard | The base preset here |
| Client / tender template | Anywhere | The client dictates rules and format | From the client; always needed |

### Gap 2: classification systems

Small gap: download, load, map once. Classifications are independent of rulebooks.

| System | Region | Organised by | Access |
|---|---|---|---|
| Uniclass 2015 (NBS) | UK | 12 tables (elements/functions, systems, products, spaces...) | Free, quarterly updates, API, NBS Uniclass-IFC alignment, community CSV mirror |
| ICMS 3 | International | Cost reporting across countries and project types | Free; includes a guide to mapping national elements |
| CCI | Czechia, Slovakia, Estonia and others | Object-based, built on ISO 81346 + Danish CCS | Free, CC BY 4.0 |
| CoClass | Sweden | Object-based | Check terms |
| OmniClass | North America | 15 tables | CSI licence |
| UniFormat / UniFormat II | North America | Building elements | CSI / ASTM E1557, paid |
| MasterFormat | North America | Work results, 50 divisions | CSI licence |
| DIN 276 | Germany, DACH | Cost groups 100-800 | Paid |
| NRM1 element groups | UK | Building parts | In NRM1 |
| Regional trade-section conventions | e.g. former Yugoslavia | Trades (preparatory, earthworks, concrete, masonry, carpentry, roofing, joinery...) | Convention, no code list |
| IFC classes + bSDD | International | Shared language others map onto | Free |

### Gap 3: naming dictionary

| Resource | What it is | Access |
|---|---|---|
| bSDD (buildingSMART) | Multilingual dictionary of building concepts and properties; hosts classifications | Free, API |
| IFC schema (ISO 16739) | Standard element types with definitions | Free |
| ISO 12006-3 | Framework behind bSDD | Paid |
| Uniclass Pr (Products) | Generic product and material names with codes | Free |
| ÖKOBAUDAT | German government material database, German/English, densities | Free |
| ETIM / ECLASS | Product classification, mainly MEP | ETIM free, ECLASS paid |
| IATE | EU terminology database (covers Croatian, not Serbian or Bosnian) | Free |
| Authoring-tool default libraries | Default type and material names | With the software |
| Manufacturer catalogues, BIMobject | Brand names | Mostly free |

Missing everywhere: local-language trade terms, full brand-to-generic coverage, office
abbreviations. Hence the three user-facing layers (project, company, global), see 07.

### Gap 4: item library

| Resource | Region | Access |
|---|---|---|
| STLB-Bau | Germany (tied to VOB/C) | Paid data product, licensed to software vendors |
| GAEB | Germany | BoQ exchange format; spec available |
| LB-HB | Austria | Free (ministry) |
| ÖNORM A 2063 | Austria | Exchange format, paid |
| NPK | Switzerland | Paid (CRB) |
| NRM2 | UK | Rules for structuring descriptions, not a library |
| Commercial QS libraries (CostX, NBS-based) | UK | Paid |
| RSMeans | USA | Line items and unit costs, paid |
| Published tender BoQs | Anywhere | Wording in current use, procurement portals, often free |
| IfcCostSchedule / IfcCostItem | International | Storing a BoQ inside IFC |

Users need their own layer even more than for names: client template (imported from the
tender's spreadsheet or GAEB file; model elements matched to its items), company library
(often built by importing past BoQs), base library per preset. **Importing an existing BoQ as a
template is how most firms work** and is a key feature not built yet.

### Gap 5: missing or broken model data

| Case | Duplex example | Handled by |
|---|---|---|
| Broken export | Party wall with flipped faces: 433 m3 instead of 25.8 m3 | Engine, automatically (repair rules accumulated from many files) |
| Missing but derivable | Worktop length absent, 3D shape present | Engine, derivation noted |
| Missing, needs a decision | Footings without material | Question, or a logged default |
| Not in the model | No reinforcement, no MEP | Nobody: another model, manual lines, or out of scope |

### Gap 6: answer key

Checking output against the file proves consistency, not professional accuracy. Collect
reference projects with both the IFC and a professionally hand-measured BoQ, run the engine with
the same rules, compare line by line, explain every difference, fix rules; repeat per preset
and after every engine change. Development-time only, invisible to users; it is what allows a
claim like "matches professional output within X%". In production, users repeatedly correcting
the same quantity signals a faulty rule. See 09.

### Who handles what

| Responsibility | Covers |
|---|---|
| End user, per file | Unknown names (3), unmatched items (4), missing data needing a decision (part of 5) |
| Developer, engine | Export repairs and derivations (rest of 5), dictionary and library infrastructure |
| Developer, before release | Answer key (6) |
| Domain expert (QS) | Rulebooks to presets (1), seeding item libraries (4) |
| Load once | Classification lists (2), public dictionary seeds (3) |

## Remaining parts beyond the six gaps

Ten further parts were identified (priority in brackets), plus later additions. Status in this repo:

| # | Part | What and why | Status |
|---|---|---|---|
| R1 | Input requirements check (Critical) | A defined minimum the IFC must meet, checked first; buildingSMART **IDS**, one per preset; failures become questions | Partly: verification checks and missing-data questions; no IDS |
| R2 | Multiple models at once (Critical) | Federated projects; architect and engineer both model the same walls; ownership rules, cross-model overlap detection | Not built (see 10) |
| R3 | Derived items (Critical) | Excavation, formwork, reinforcement (kg/m3), skirtings, paint, waterproofing; where QS judgement lives; editable factors, marked derived | Built (derived rules) |
| R4 | IFC version differences (Needed) | IFC2x3, IFC4, IFC4.3 store things differently; normalise into one record | Parser written for all; tested on IFC2x3 only |
| R5 | Traceability with a 3D viewer (High) | Click a line to highlight its elements and back | Dev viewer beside the BoQ (three.js over the engine's geometry.glb): line -> elements, element -> lines, colour by type / coverage / code group |
| R6 | Model revisions (High) | Re-run on v2, show changes vs v1, carry decisions over by GlobalId | Ids designed for it; diff not built |
| R7 | Rule editor (Needed) | QSs maintain rules, not programmers; forms, test run on a sample, versioning | Dev-build editors for rule sets, classifications and dictionaries (Library mode); drafts saved to `presets/user/` (local files), no versioning, no preview against a model |
| R8 | Location breakdown (High) | Site, building, storey, room, zone, unit, phase per quantity; elements spanning storeys; room-based finishes via faces bounding spaces | Storey per line; no rooms per face |
| R9 | Export and integration (Needed) | Excel first, then GAEB, ÖNORM A 2063, IFC cost schedules, CSV; pricing as a separate step | Excel only |
| R10 | Professional responsibility (Needed) | A qualified person signs; output is a draft; audit trail makes sign-off fast | Design principle (D07) |
| + | Items with no model behind them | Preliminaries, provisional sums, lump sums | Built (manual items) |
| + | Renovation status | New / existing / demolish filtering | `status` field measured; no demolition items in presets |
| + | Design options | Pick one option or a BoQ per option, never both | `design_option` field exists; not used |

## Solvability

| Solvable by | Gaps |
|---|---|
| Engineering alone | IFC versions, export repairs and derivations, IDS input check, viewer, revisions, location breakdown, export formats, rule editor, classifications |
| Outside input (expertise, data, money) | Rulebooks (a QS per standard, plus a legal check), item libraries (free LB-HB, licensed STLB-Bau/NPK, or built from tender BoQs), answer key (firm partnerships), multi-model ownership rules (expert input) |
| Only partly, ever | Naming (new names keep appearing; questions become rare but never vanish), derived items (unusual projects need judgement), data not in the model (only better models fix it), professional responsibility (permanent by design) |

Commercial tools (CostX, RIB iTWO) already do model-based take-off, which proves the core is
achievable. The flexible, multi-standard part is where existing tools tend to be rigid, and
that is this product's angle.

## Where to get rulebooks and classifications

| Item | Where | Cost / access (Oct 2026) |
|---|---|---|
| NRM 1, 2, 3 | rics.org, Construction standards, NRM; e.g. the NRM 2 PDF (Oct 2021 edition, reissued 2022) | Free PDFs; Excel templates for NRM 1, 2, 3 under RICS terms of use |
| SMM7 | same RICS page | Reference only |
| CESMM4 Revised | ICE Publishing, ISBN 978-0-7277-6440-9 | About USD 136, 128 pages; bundles with handbook and examples |
| VOB/C | dinmedia.de (formerly Beuth) | Individual ATVs, e.g. DIN 18299:2023-09 about EUR 45 as PDF; full set = VOB 2019 complete edition + 2023 supplement (21 revised ATVs); online subscription |
| ÖNORM B 22xx | austrian-standards.at | Paid; current editions not verified |
| CIQS method | ciqs.org | Via CIQS courses |
| Uniclass 2015 | uniclass.thenbs.com | Free; tables individually or bundled; API; community CSV at github.com/buildig/uniclass-2015 |
| ICMS 3 | icms-coalition.org (also rics.org) | Free |
| CCI | CCIC and national portals | Free, CC BY 4.0 |
| bSDD | search.bsdd.buildingsmart.org | Free, API |
| OmniClass, MasterFormat, UniFormat | csiresources.org (CSI Dynamic Standards) | Paid firm-level subscription; licence needed for use in specs, templates, models or plugins, so software too; CSI "Crosswalk" product for integration |
| UniFormat II | astm.org (ASTM E1557) | Paid |
| DIN 276 | dinmedia.de | Paid |
| CoClass | coclass.byggtjanst.se | Check terms |

Recommended start: NRM 1 + 2 with templates (written in our own words); Uniclass, ICMS, CCI,
bSDD. Later per market: VOB/C and DIN 276 for German-speaking countries, CSI standards for North
America, CESMM4 if civil works enter scope.

## Licensing

### Three levels of rights

Buying a standard to **read** it (usually single-user) differs from **sharing** it inside a
company (network licence) and from **building it into a product** you sell (specific permission,
often with fees). A software product sits at the most restricted level.

| Publisher / data | Restrictions found |
|---|---|
| DIN (VOB/C, DIN 276) | Purchased PDFs are single-user; several users need a network licence. Reproducing any part, including in software, needs DIN's permission. DIN's General Reproduction Conditions (January 2026) govern reproduction permissions: almost any copying counts (transcribing, scanning, data transfer, partial, with insignificant changes, translations); permissions are narrow, non-exclusive, non-transferable, per reproduction, with fees as a percentage of the standard's price per copy; DIN **reserves its content against text and data mining** and **prohibits using it to develop software, including training ML/AI systems**; with permission, a standard built into software must not be presented as the main feature, must not imply DIN endorsement, must be embedded so it cannot be extracted as a separate file, and needs an attribution note with number and date; German law and courts apply. Source: din.de "general-reproduction-conditions-data.pdf". |
| CSI (MasterFormat, UniFormat, OmniClass) | Any firm using CSI numbers, titles or classifications in specs, templates, models or plugins needs a Dynamic Standards licence. Organising cost information with MasterFormat to generate revenue counts as "Proprietary Use" needing a separate agreement. |
| RICS (NRM) | Most relaxed of the paid group: Excel templates may be used and customised for your own requirements under RICS terms of use; the documents are copyrighted; other use needs RICS's written approval (contactrics@rics.org) before building NRM into a commercial product. |
| CESMM4, ÖNORM, STLB-Bau, NPK, RSMeans, ECLASS | Terms not verified. Expect single-user purchase plus a separate data or software licence; STLB-Bau, NPK and RSMeans are sold to software vendors as partner data products. |
| CCI | CC BY 4.0: usable with attribution. |
| ICMS, Uniclass | Free; check Uniclass redistribution terms (hence the download script instead of a committed file). |

### Learning from a standard vs copying it

| Use | Risk |
|---|---|
| Learning the rules and writing your own presets in your own structure and words | Low |
| Using individual coefficients or values (densities, ratios, thresholds) | Low |
| Saying "based on NRM2" | Low |
| Copying item descriptions or text verbatim | High (copyright protects expression) |
| Reproducing full code lists (e.g. MasterFormat numbers and titles) | High (that is what CSI licenses) |
| Systematically copying large coefficient or norm tables | Medium to high (EU database right protects substantial extraction even of facts) |
| Any use against licence terms you accepted (e.g. DIN's software clause) | High (contract), even where copyright would allow it |
| Claiming "compliant" or "certified" | Medium (implies endorsement; needs permission) |

Copyright protects how something is written, not ideas, methods or single facts. The contract
you accept when you buy can restrict more than copyright. The open question per standard: does
encoding its rules as parameters count as reproduction? For DIN, ask a German IP lawyer or DIN
Legal. **Never feed DIN PDFs into AI tools to extract rules.**

### The chosen position (D30-D34)

- **Bring your own licence.** Ship no DIN content. Ship a generic rule editor. A firm that owns
  VOB/C builds its own preset in its company account from its own copy. That preset stays
  **company-private**; no public marketplace of standard-derived presets.
- **Never ingest the standard itself** (no "upload your DIN PDF and we extract the rules").
- **Terms of service**: users confirm they hold rights to what they enter; a takedown process.
- **Market factually**: "supports custom measurement presets, e.g. for VOB/C", never "VOB-compliant".
- **German-speaking markets later**: BYO is friction where users expect VOB out of the box and
  incumbents ship it under licence. Middle ground: **GAEB import** of client tenders (the client
  supplies VOB-structured items with each tender). License or partner if Germany becomes a target.
- Whether a firm's own licence covers entering rules into a shared company system is the firm's
  licence question.

### How much DIN matters

In Germany VOB is practically unavoidable: public clients must award under VOB/A, which brings
VOB/B and VOB/C into public contracts; private projects use it very widely by choice; DIN 276
is the standard cost structure for architects' cost planning. Outside Germany it is rarely a
working standard: Austria uses ÖNORM, Switzerland SIA/NPK, elsewhere it appears occasionally as
a reference. If Germany is not an early market, leave it until later.

## Authoring tools that produce IFC for BoQs

| Discipline | Tools |
|---|---|
| Architecture (most BoQ input) | Revit, Archicad, Allplan, Vectorworks, BricsCAD BIM, Bentley OpenBuildings Designer, ACCA Edificius, Archline.XP, Rhino + VisualARQ, Bonsai (BlenderBIM) and FreeCAD (open source, native IFC) |
| Structure | Tekla Structures (leads steel and precast detailing), Revit Structure, Allplan Engineering / Planbar, Advance Steel, ProStructures; analysis tools (SCIA, RFEM) export IFC but are rarely BoQ sources |
| MEP | Revit MEP, MagiCAD, DDS-CAD, Trimble Nova / Plancal, OpenBuildings |
| Infrastructure (IFC4.3) | Civil 3D, OpenRoads, Allplan Civil |

No reliable global usage figures exist; surveys swing by country and respondents (UK NBS 2015:
Revit 25%, Archicad 8%; UK NBS 2017: Revit 41%; New Zealand architects 2020: Revit 34%,
Archicad 35%; Austria 2013: Revit 11%, Archicad 20%, AutoCAD 35%). Rough picture (an estimate,
not a measurement): Revit about half or more of BIM authoring worldwide; Archicad roughly 10-20%,
strong in Central and Eastern Europe, the Nordics, Japan, Australia and New Zealand; Allplan a few
percent globally but significant in German-speaking countries; Tekla the structural steel and
precast leader. **Priority for exporter-quirk testing: Revit, Archicad, Tekla.**

## Sources opened during the conversation

- RICS NRM suite and templates: https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/construction-standards/nrm
- RICS NRM 2 (Oct 2021) PDF: https://www.rics.org/content/dam/ricsglobal/documents/standards/october_2021_nrm_2.pdf
- ICE CESMM: https://www.ice.org.uk/areas-of-interest/infrastructure-delivery/civil-engineering-standard-measurement
- DIN Media, DIN 18299:2023-09: https://www.dinmedia.de/en/standard/din-18299/369847346
- DIN Media, VOB: https://www.dinmedia.de/de/themenseiten/voballgemein
- DIN General Reproduction Conditions: https://www.din.de/resource/blob/889396/5494fb06060b3aa4b77a300fc2fc910e/general-reproduction-conditions-data.pdf
- NBS Uniclass: https://uniclass.thenbs.com/ and CSV mirror https://github.com/buildig/uniclass-2015
- ICMS 3: https://icms-coalition.org/the-standard/
- CSI standards: https://csiresources.org/standards/overview
- CCI licensing report: https://budweiser.cadstudio.cz/2023/03/report-from-construction-classification.html
