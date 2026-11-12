# Conversation extract — Part 2 (turns 31–60)

Source: claude.ai chat "Generating a book of quantities from IFC file" (8655a050-1d83-4c49-a07f-5a107f1c518e)

### Turn 31 (assistant)
Not quite. Resolving all the gaps gives you a **fully functional engine and core product**: you put an IFC in, choose your settings, answer the review questions, and get a trustworthy, traceable BoQ. A *platform* means many companies and users working on it daily, and that needs another layer the gaps didn't cover.

## What's still needed

**Running it for many users**
- **Accounts, companies and permissions:** who can edit rules, who can only view, and who signs off.
- **Data separation between companies:** firm A must never see firm B's models, dictionaries or prices.
- **Handling big files:** real models can be hundreds of MB, so you need background processing, queues and progress tracking, not a script that runs while the user waits.
- **Security:** building models are confidential and sometimes sensitive, so you need encryption, access logs and GDPR compliance in Europe.

**Working the way real teams work**
- **Collaboration:** several people on one project, with comments, task assignment, and an approval flow (prepared, checked, approved).
- **Talking back to designers:** when the tool finds a model problem (missing material, double ceiling), it should send it back to the architect. **BCF** is the standard format for exactly this, and design tools can read it.
- **Project history:** who changed what and when, across revisions.

**Connecting to the ecosystem**
- **Where models live:** firms keep models in shared project platforms such as Autodesk Construction Cloud or Trimble Connect, so users expect to pull from those directly rather than upload files.
- **Pricing:** once quantities exist, everyone's next question is cost, which means rate databases, company price lists and tender comparison. That's arguably a second product built on the first.

**The business side**
- Billing and subscriptions, onboarding, help documentation, support.
- Translations of the interface, not just of BoQ descriptions.
- A clear decision on **who the user is**. A quantity surveyor, a contractor bidding on a tender, and a designer checking costs all want different workflows from the same engine.

## Two things to keep in mind

**"Fully functional" will always include a human.** The partly-solvable gaps (new names, judgement on derived items, missing model data) mean review and sign-off are permanent parts of the workflow. That's normal for this industry, and it doesn't count as unfinished.

**You don't need all of it to be useful.** A version with the engine, one or two rulebook presets, the review step, Excel export and a basic viewer would already be valuable to one type of user in one market. Most of the platform layer gets added as real customers ask for it.

So: solving the gaps gives you the hard, unique part, the part competitors would struggle to copy. The platform layer is more conventional software work, but there's a lot of it.

### Turn 32 (user)
no no, thats basic stuff, just focusing on the business logic, would that be 100% functional?

### Turn 33 (assistant)
Functionally complete, yes. Producing 100% of a correct BoQ automatically from any file, no. Those are two different meanings of "100%".

**Complete:** with all the gaps resolved, every piece of logic exists. Any file can go through the whole process and come out as a correct, traceable BoQ, with nothing missing in the chain.

**Not 100% automatic, by nature:**
- **Some answers aren't in the file.** No logic can recover reinforcement, installations or materials that were never modelled. The system can only flag them, estimate them by rule, or ask.
- **Some decisions are judgement.** Unusual derived items, ambiguous names and conflicting models need a person, and that will stay true.
- **Output quality follows model quality.** A well-modelled file might come out almost fully automatic. A messy one produces many review questions. The logic is the same; the input differs.

So the realistic ceiling is: **the logic is 100% complete, and the automation is high but not total, depending on the file.** That's how it should work in this industry. Don't count it as a failure.

## Two business-logic pieces I haven't mentioned yet

Thinking it through again, two pieces belong in the logic and weren't on either list.

**1. Room-based finishes.** Many finishes depend on the room, not the element. Bathroom walls get tiles up to 2 m and paint above. One side of a wall is a kitchen and the other a bedroom, with different finishes. That requires knowing which face of each wall faces which room. IFC has a mechanism for this (space boundaries), but many exports don't include it, so the engine would have to compute it from geometry. My duplex BoQ dodged this by measuring paint as total plasterboard area.

**2. Items with no model behind them.** Every real BoQ contains lines no model can produce:
- **Preliminaries:** site setup, scaffolding, temporary works, insurance.
- **Provisional sums:** placeholder amounts for undecided work.
- **Lump-sum items.**

These come from the template and the user, not from the IFC. The logic must allow them to live alongside the model-generated lines.

With those two added, I don't see further gaps in the business logic itself.

### Turn 34 (user)
No, so, I dont expect it to be magic. It can derive anything that is not there. 
Some quantities and works - I asssume yes, could be proxy derived from other stuff, but other things, withouth data - cant be calculated.
That is fine, we just flag it and move it, either provide info or not.

Having that in mind (and succesffully deriving proxy values where possible) - will it work?

### Turn 35 (assistant)
Yes, it will work. With that expectation it's a realistic, buildable system, and it's essentially how the duplex BoQ already behaved, just generalised.

Every quantity ends up in one of three states:

1. **Measured:** taken from the model and verified against geometry.
2. **Derived:** calculated from a proxy, with the formula shown (for example, formwork from wall area, or reinforcement from concrete volume × kg/m³).
3. **Flagged:** can't be determined. The line still appears in the BoQ with no quantity and a note saying what's missing. The user fills it in or leaves it.

Four conditions make it work reliably rather than just in principle:

- **Flagged items stay in the bill.** A missing line with a note is fine. A line that silently disappears is the worst outcome, because nobody knows it's missing.
- **Derived values are visibly marked as derived**, showing the proxy and the factor used, so a reviewer knows which numbers are estimates.
- **The proxy factors are editable settings, not hidden constants.** Reinforcement ratios and waste factors vary by project and region.
- **You validate against real professional BoQs** before claiming accuracy. That's the answer-key step, and it's the only way to know whether your proxies are sensible.

Meet those and the remaining risk isn't about whether it works. It's about how well you execute the hard parts: good proxy rules, handling multiple models, and the review flow.

### Turn 36 (user)
Would you be able to make a proper calculation engine that takes ifc, selected rulebook, selected classification and selected dictionary and provides a structured boq (assuming to prompt user for missing or unclear data etc)?

### Turn 37 (assistant)
Yes. I can build a working engine like that, and the duplex scripts are already its skeleton. What matters is being honest about which parts would be genuinely real and which would be placeholders that need an expert.

## What I can build properly

- **The engine itself:** read IFC, verify geometry, check against your settings, ask questions, measure, derive, then output.
- **Rule formats as data:** rulebooks, classifications and dictionaries as separate files you select and swap, with no code changes.
- **Pre-flight check:** compares your selections with what the file contains, and lists what's missing, contradictory or ambiguous.
- **Ask and resume:** the engine stops, returns a structured list of questions, saves its state, and continues when you answer. Your answers are saved at project or company level.
- **The three quantity states:** measured, derived (proxy with its formula shown) and flagged (line present, quantity blank, reason stated).
- **Layered dictionaries and item libraries:** project overrides company, company overrides global.
- **Derived-item rules:** formwork, paint, reinforcement by ratio and so on, with editable factors.
- **Structured output:** BoQ as JSON (for your app), plus Excel, with full traceability from each line to its elements.

## What would be illustrative, not authoritative

- **Rulebook presets:** I can write an "as modelled" preset fully, plus *approximate* NRM2-style and VOB-style presets showing the mechanism works. They wouldn't be certified implementations. I don't have the full copyrighted texts, and a quantity surveyor would need to complete and verify them.
- **Classification tables:** the mechanism is real. Full Uniclass and OmniClass tables can be loaded if I can download them; otherwise I'd include partial mappings sufficient for testing.
- **Seed dictionary:** a real starting set (IFC, Revit/ArchiCAD defaults, common multilingual synonyms), but small compared with what grows from real use.

## What I couldn't guarantee

- **Robustness across all authoring tools:** I can test on the duplex and a few public sample models, not hundreds of real-world files.
- **Proven accuracy:** without professionally measured reference projects, I can show the engine is consistent, not that it matches a quantity surveyor.
- **Multi-model federation at scale:** I can implement the overlap and ownership logic, but only lightly test it.

The result would be a working engine with real mechanisms throughout, where the *content* (presets, libraries) is a good starting point rather than final. That's the right split anyway: the engine is the part I can build well, and the content is what domain experts add to it.

Whenever you're ready, it would take a few working sessions here.

### Turn 38 (user)
What is the minimum viable number and type (revit, acad etc) of different ifc files you would need to be relatively confident in a working engine?

### Turn 39 (assistant)
It depends less on the *number* of files than on *variety*. Fifty Revit files teach you less than ten from different tools. Here's a practical answer.

One correction first: plain AutoCAD isn't really an IFC source. IFC comes from BIM tools. The ones that matter are below.

## What variety you need to cover

| Dimension | Why it matters | Minimum to cover |
|---|---|---|
| **Authoring tool** | Each exports differently (materials, quantities, geometry types, naming) | Revit, ArchiCAD, Tekla Structures, plus one of Allplan / Vectorworks / BricsCAD, plus one native-IFC tool (Bonsai/BlenderBIM or FreeCAD) |
| **IFC version** | IFC2x3, IFC4 and IFC4.3 store things differently | At least IFC2x3 and IFC4. IFC4.3 if you go into infrastructure. |
| **Exporter age** | Your duplex came from Revit 2011, and modern Revit exports very differently | One old export, several current ones |
| **Discipline** | Architecture, structure and installations each stress different logic | All three, ideally from the *same* project |
| **Building type** | Small timber residential ≠ concrete multi-storey ≠ steel hall | 3 types |
| **Model quality** | Clean sample files hide real-world mess | At least 2 messy real-project files |
| **Export settings** | The same model exported with base quantities on/off, or split differently, tests robustness | 1 model exported 2–3 ways |

## The numbers

- **Absolute minimum, for a basic test:** about 6 files. One each from Revit, ArchiCAD and Tekla, in both IFC2x3 and IFC4, plus one federated set (architecture + structure). That's enough to know the engine isn't tied to one tool.
- **Relatively confident: about 15–20 files** covering the table above. That's the realistic answer to your question.
- **Plus 2–3 projects with a professional hand-measured BoQ.** These are a separate requirement. The 15–20 prove the engine *works* on varied input; these prove it's *accurate*.

After that, confidence grows through real-user files. Every new exporter quirk you find becomes a repair rule.

## Free sources to start with

- **buildingSMART Sample-Test-Files** (on GitHub): official test files across IFC versions.
- **NIBS / COBie sample buildings:** your Duplex comes from this family. There are also Office and Clinic models, some with structural and MEP files, which are useful as federated sets.
- **Schependomlaan dataset:** a real Dutch residential project with multiple disciplines, also on GitHub.

These cover roughly the first half of the list. Messy real-world files and the professional BoQs have to come from actual firms. That's the same data-access constraint as before.

### Turn 40 (user)
Create a spreadsheet from your last answer.

### Turn 41 (assistant)
Files created: IFC_Test_Corpus_Plan.xlsx — IFC test corpus plan workbook with 4 sheets (Test Corpus, Summary, Dimensions, Sources); Status column has Have/Searching/Missing dropdown; Summary uses COUNTIFS formulas per tier and per dimension (IFC4 count adjusted to exclude IFC4.3).

File content (as written by the generating script):

**Sheet "Test Corpus"** — "IFC test corpus plan. Variety matters more than count. Update the yellow Status column as files are collected - the Summary sheet recalculates."

| # | Purpose | Authoring tool | IFC version | Discipline | Building type | Quality | Tier | Suggested source | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Old Revit export baseline | Revit 2011 | IFC2x3 | Architecture | Small residential | Clean | Minimum | NIBS Duplex (already tested) | Have | Exporter quirks found: surface-model winding, junction overlaps |
| 2 | Modern Revit export | Revit (current) | IFC4 | Architecture | Multi-storey residential / office | Clean | Minimum | buildingSMART Sample-Test-Files or own re-export | Missing | Modern exporter differs greatly from 2011 |
| 3 | ArchiCAD architecture | ArchiCAD | IFC2x3 | Architecture | Residential | Real project | Minimum | Schependomlaan dataset (GitHub) - verify authoring tool | Missing | |
| 4 | ArchiCAD architecture, newer schema | ArchiCAD | IFC4 | Architecture | Multi-storey | Clean | Confident | Firm or vendor sample | Missing | |
| 5 | Structural concrete with reinforcement | Tekla Structures | IFC4 | Structure | Concrete frame | Clean | Minimum | Tekla sample / firm | Missing | Tests rebar, precast, assemblies |
| 6 | Structural steel | Tekla Structures | IFC2x3 | Structure | Steel hall / industrial | Clean | Confident | Tekla sample / firm | Missing | Tests profiles, mass by section |
| 7 | Revit structure | Revit (current) | IFC4 | Structure | Office | Clean | Confident | NIBS Office set | Missing | |
| 8 | Installations | Revit MEP | IFC2x3 | MEP | Office / clinic | Clean | Confident | NIBS Office or Clinic set | Missing | Pipes, ducts, fittings: count + length logic |
| 9 | Allplan export | Allplan | IFC4 | Architecture / precast | Residential / commercial | Clean | Confident | Firm or vendor sample | Missing | Strong in DACH markets |
| 10 | Secondary BIM tool | Vectorworks or BricsCAD BIM | IFC4 | Architecture | Any | Clean | Confident | Vendor sample | Missing | |
| 11 | Native-IFC authoring | Bonsai / BlenderBIM | IFC4 | Architecture | Any | Clean | Minimum | Self-created or community samples | Missing | Different patterns: IFC-native, often richer data |
| 12 | Open-source alternative | FreeCAD | IFC4 | Architecture | Any | Varies | Optional | Self-created | Missing | |
| 13 | Federated set (same project) | Revit (mixed) | IFC2x3 | Arch + Struct + MEP | Office | Clean | Minimum | NIBS Office set | Missing | Tests cross-model duplicates and ownership rules |
| 14 | Federated set, real project | Mixed tools | IFC2x3 / IFC4 | Arch + Struct | Any | Real project | Confident | Firm partnership | Missing | Ideally different tools per discipline |
| 15 | Messy real-world architecture | Any | Any | Architecture | Any | Messy | Confident | Firm partnership | Missing | Missing materials, odd naming, overlaps |
| 16 | Messy real-world structure | Any | Any | Structure | Any | Messy | Confident | Firm partnership | Missing | |
| 17 | Export-settings robustness | Revit (current) | IFC4 | Architecture | Same model x3 | Clean | Confident | Own exports: base quantities on/off, split by level | Missing | Same model exported 3 ways |
| 18 | Infrastructure schema | Civil 3D / other | IFC4.3 | Infrastructure | Road / bridge | Clean | Optional | buildingSMART Sample-Test-Files | Missing | Only if scope includes infrastructure |
| 19 | Accuracy reference A | Any | Any | Architecture | Residential | Real project | Accuracy | Firm partnership + professional BoQ | Missing | Needs IFC + hand-measured BoQ under known rulebook |
| 20 | Accuracy reference B | Any | Any | Arch + Struct | Commercial | Real project | Accuracy | Firm partnership + professional BoQ | Missing | |
| 21 | Accuracy reference C | Any | Any | Any | Different type | Real project | Accuracy | Firm partnership + professional BoQ | Missing | |

**Sheet "Summary"** — "Coverage summary. All figures are formulas over the Test Corpus sheet."

| Tier | What it proves |
|---|---|
| Minimum | Basic test: engine is not tied to one tool (~6 files) |
| Confident | Relatively confident working engine (Minimum + Confident = ~15-20 files) |
| Optional | Extra coverage: open-source tools, infrastructure |
| Accuracy | Separate requirement: output matches a professional BoQ |
| Engine-ready | Minimum + Confident |

Columns: Target files / Have / Remaining / % collected (formulas). "Coverage by dimension" block: Tool (Revit, ArchiCAD, Tekla, Allplan, Bonsai), IFC version (IFC2x3, IFC4, IFC4.3), Discipline (Architecture, Structure, MEP), Quality (Messy) — files planned vs have. Note: "plain AutoCAD is not a meaningful IFC source - IFC comes from BIM authoring tools."

**Sheet "Dimensions"** — same 7-row table as Turn 39 ("What variety the corpus must cover"; "variety beats volume - 50 Revit files teach less than 10 from different tools").

**Sheet "Sources"** — "Free starting sources. Cover roughly the first half of the plan. Messy files and professional BoQs must come from firms."

| Source | What it offers | Where |
|---|---|---|
| buildingSMART Sample-Test-Files | Official test files across IFC versions (incl. IFC4.3) | GitHub (buildingSMART) |
| NIBS / COBie sample buildings | Duplex (already tested), Office and Clinic models; some with structural and MEP files - usable as federated sets | NIBS common BIM files |
| Schependomlaan dataset | Real Dutch residential project, multiple disciplines | GitHub |
| Own exports | Same model exported with different settings; Bonsai/FreeCAD models created yourself | Self-made |
| Firm partnerships | Messy real-world files, federated real projects, and professional BoQs for accuracy | Required - no public substitute |

Prose answer:

The spreadsheet has four tabs:

- **Test Corpus:** 21 planned files, each with its purpose, authoring tool, IFC version, discipline, building type, quality, tier and suggested source. The yellow Status column has a dropdown (Have / Searching / Missing) for tracking collection.
- **Summary:** live progress per tier (Minimum, Confident, Optional, Accuracy), plus coverage by tool, IFC version, discipline and messy files. It updates as you change statuses.
- **Dimensions:** the seven kinds of variety the files need to cover.
- **Sources:** the free starting points, plus a note that firm partnerships are needed for messy real files and professional BoQs.

The Duplex is already marked as Have, so the Summary currently shows 1 of 16 engine-ready files collected.

### Turn 42 (user)
Where could i look for (purchase, source etc) the rulebook and classification data sets?
If possible, provide sources for each available one.

### Turn 43 (assistant)
(Web searches run: "RICS NRM2 detailed measurement for building works purchase"; "RICS NRM 1 cost estimating cost planning 3rd edition pdf rics.org"; "VOB Teil C ATV DIN 18299 Gesamtausgabe 2023 DIN Media kaufen"; "CESMM4 Civil Engineering Standard Method of Measurement ICE Publishing"; "CIQS Method of Measurement of Construction Works Canada purchase"; "Uniclass 2015 download tables xlsx NBS free"; "OmniClass tables download CSI free Excel"; "ICMS 3rd edition International Cost Management Standard download free icms-coalition"; "MasterFormat UniFormat license purchase CSI csiresources.org"; "CCI Construction Classification International CoClass free download tables". Search result contents were not preserved in the transcript; the findings used are in the answer below.)

Two corrections to my earlier lists came out of checking this: NRM is easier to get than I said, and OmniClass is no longer free.

## Rulebooks

| Rulebook | Where to get it | Cost / access |
|---|---|---|
| **NRM1, NRM2, NRM3** (UK) | RICS NRM page: rics.org → Standards → Construction standards → NRM | See note below this table |
| **SMM7** (UK, legacy) | Older editions are on the same RICS page | Reference only. NRM2 superseded SMM7, and the 2012 suite is out of date for new projects but still downloadable for reference. |
| **CESMM4 Revised** (civil works) | ICE Publishing (ice.org.uk), or any technical bookseller (ISBN 978-0-7277-6440-9) | Paid book, about USD 136, 128 pages. There's also a bundle with the Handbook and Examples. |
| **VOB Part C** (Germany) | DIN Media (dinmedia.de, formerly Beuth Verlag) | See note below this table |
| **ÖNORM B 22xx series** (Austria) | Austrian Standards (austrian-standards.at) | Paid. I didn't verify current editions, so check there. |
| **CIQS Method of Measurement** (Canada) | Canadian Institute of Quantity Surveyors (ciqs.org) | It's the standard taught in Canadian estimating courses. Check CIQS for purchase. |

**NRM:** RICS hosts PDFs of the current editions publicly. The NRM 2 (Oct 2021) PDF sits on rics.org. The NRM page also offers downloadable Excel templates for NRM 1, 2 and 3, subject to RICS terms of use. Those templates are useful to you: they're structured spreadsheets, not prose, so they're the closest thing to a machine-readable starting point.

**VOB/C:** you can buy individual standards. For example, the general rules standard DIN 18299:2023-09 is about EUR 45 as a PDF. The full set is the VOB complete edition 2019 plus the 2023 supplement. The 2023 supplement contains 21 new or revised ATVs, which replace the 2019 versions; the rest stay valid. There's also a digital subscription, VOB online, with updates. Each trade standard (DIN 18300 to 18451) has its own measurement section.

## Classifications

| System | Where to get it | Cost / access |
|---|---|---|
| **Uniclass 2015** (UK) | uniclass.thenbs.com | See note below this table |
| **ICMS 3** (international) | icms-coalition.org → The Standard, also on rics.org | Free download. It also comes with a guide to mapping national standard building elements to ICMS. |
| **CCI** (Construction Classification International) | Via CCIC; national portals such as the Czech standards agency's | See note below this table |
| **OmniClass, MasterFormat, UniFormat** (North America) | csiresources.org → Standards | See note below this table |
| **UniFormat II** | ASTM E1557, from astm.org | Paid standard. This is a separate, public-standard version of UniFormat. |
| **DIN 276** (Germany) | DIN Media (dinmedia.de) | Paid |
| **CoClass** (Sweden) | coclass.byggtjanst.se | Check terms |
| **bSDD** (buildingSMART Data Dictionary) | search.bsdd.buildingsmart.org | Free, with an API. It hosts several classifications in one place. |

**Uniclass:** completely free. All 12 tables can be downloaded individually or as a bundle, they're updated quarterly, and older versions are available too. There's also a REST API for navigating and retrieving classifications. NBS has published an alignment between Uniclass and IFC, which is directly useful to you. A community GitHub repo (buildig/uniclass-2015) has the tables converted to CSV.

**CCI:** free, under a Creative Commons CC BY 4.0 licence. It's based on ISO 81346 with elements of the Danish CCS, and is being adopted in Czechia, Slovakia, Estonia and others.

**CSI (OmniClass, MasterFormat, UniFormat):** this is where my earlier "free" was wrong for OmniClass. CSI now sells a firm-level CSI Dynamic Standards subscription that includes licences for all three, with only a limited free lookup of MasterFormat numbers and titles. It applies to anyone using CSI numbers or titles in specs, templates, models or plugins, so it would cover your software too.

## What matters most for a product

Buying a standard for personal reading is different from building it into software you sell. Before you embed anything, check each licence for commercial or software use:

- **Clearly product-friendly:** CCI (CC BY 4.0), ICMS (free), and Uniclass (free; check redistribution terms).
- **Licence explicitly needed for software:** the CSI standards (MasterFormat, UniFormat, OmniClass).
- **Read it, don't reproduce it:** NRM, VOB, CESMM and ÖNORM. You buy or download them to understand the rules and encode them as parameters. Whether that encoding needs a licence is a question for a lawyer, per standard.

A practical, low-cost starting set would be NRM 1 and 2 with their Excel templates, plus Uniclass, ICMS, CCI and bSDD. That gives you one full rulebook and four classifications at little or no cost, with the paid standards added per market later.

### Turn 44 (user)
Create a Word document from your last answer.

### Turn 45 (assistant)
Files created: IFC_BoQ_Sourcing_Rulebooks_and_Classifications.docx — 3-page Word doc "IFC to BoQ: Sourcing Rulebooks and Classifications" (subtitle: "Where to purchase, download or license each data set, and what that means for a software product").

Document content (as written by the generating script; refines Turn 43 with a few extra details):

> Where to buy, download or license each measurement rulebook and classification system, with cost and access notes. Prices and licence terms were checked in October 2026 and should be re-verified before purchase.
>
> **Corrections to earlier notes:** NRM is more accessible than first stated (current editions are published on rics.org with Excel templates), and OmniClass is no longer free (CSI now licenses it together with MasterFormat and UniFormat).

**1. Measurement rulebooks**

| Rulebook | Where to get it | Cost / access |
|---|---|---|
| NRM 1, NRM 2, NRM 3 (UK, RICS) | rics.org → Standards → Construction standards → NRM | Free PDFs of current editions (Oct 2021 / reissued 2022) published on rics.org, plus downloadable Excel templates for NRM 1, 2 and 3, subject to RICS terms of use |
| SMM7 (UK, legacy) | Older editions on the same RICS page | Reference only; replaced by NRM 2 in 2013 |
| CESMM4 Revised (civil engineering) | ICE Publishing (ice.org.uk) or technical booksellers; ISBN 978-0-7277-6440-9 | Paid book, approx. USD 136, 128 pages; bundle with Handbook and Examples available |
| VOB Part C (Germany) | DIN Media (dinmedia.de, formerly Beuth Verlag) | Paid. Individual ATVs e.g. DIN 18299:2023-09 approx. EUR 45 PDF; full set = VOB complete edition 2019 + 2023 supplement (21 revised ATVs); VOB online subscription available |
| ÖNORM B 22xx series (Austria) | Austrian Standards (austrian-standards.at) | Paid; current editions not verified |
| CIQS Method of Measurement (Canada) | Canadian Institute of Quantity Surveyors (ciqs.org) | Standard used in Canadian estimating education; check CIQS for purchase |

> **Most useful for a software engine:** the RICS NRM Excel templates. They are structured spreadsheets rather than prose, so they are the closest available starting point to machine-readable measurement rules.

**VOB/C structure:** DIN 18299 holds the general rules for all construction work; each trade standard (DIN 18300 to 18451) has its own measurement ("Abrechnung") section.

**2. Classification systems** (free ones highlighted in the doc)

| System | Where to get it | Cost / access |
|---|---|---|
| Uniclass 2015 (UK, NBS) | uniclass.thenbs.com | Free. 12 tables, individually or as a bundle; quarterly updates; older versions available; REST API; NBS Uniclass–IFC alignment published; community CSV conversion on GitHub (buildig/uniclass-2015) |
| ICMS 3 (international) | icms-coalition.org → The Standard; also rics.org | Free download, plus a guide to mapping national standard building elements to ICMS |
| CCI (Construction Classification International) | Via CCIC; national portals such as the Czech standards agency | Free, Creative Commons CC BY 4.0. Based on ISO 81346 with elements of Danish CCS; adoption in Czechia, Slovakia, Estonia and others |
| bSDD (buildingSMART Data Dictionary) | search.bsdd.buildingsmart.org | Free, with API; hosts several classifications in one place |
| OmniClass, MasterFormat, UniFormat (North America, CSI) | csiresources.org → Standards | Paid. Firm-level CSI Dynamic Standards subscription covers all three; limited free MasterFormat lookup only. Licence required for use in specs, templates, models or plugins, i.e. software too |
| UniFormat II | ASTM E1557 (astm.org) | Paid standard; separate public-standard version of UniFormat |
| DIN 276 (Germany) | DIN Media (dinmedia.de) | Paid |
| CoClass (Sweden) | coclass.byggtjanst.se | Check terms |

**3. Licensing for a software product**

Buying a standard to read is different from building it into software that is sold. Before embedding any data, check each licence for commercial or software use.

| Category | Standards | Implication |
|---|---|---|
| Clearly product-friendly | CCI (CC BY 4.0), ICMS, Uniclass | Can be embedded; attribute as required and check redistribution terms (Uniclass) |
| Licence explicitly needed for software | MasterFormat, UniFormat, OmniClass (CSI) | Budget a CSI licence before shipping any feature that uses their codes |
| Read, don't reproduce | NRM, VOB/C, CESMM4, ÖNORM | Obtain to understand the rules and encode them as parameters. Whether encoded rules need a licence is a legal question to answer per standard |

**4. Recommended starting set** — a practical, low-cost start covering one full rulebook and four classifications at little or no cost:
- **Rulebook:** NRM 1 and NRM 2, including the RICS Excel templates.
- **Classifications:** Uniclass, ICMS, CCI, and bSDD as the mapping hub.
- **Later, per market:** VOB/C and DIN 276 for German-speaking markets; CSI standards for North America; CESMM4 if civil works enter scope.

**Sources**
- RICS – NRM suite and Excel templates: https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/construction-standards/nrm
- RICS – NRM 2 (Oct 2021) PDF: https://www.rics.org/content/dam/ricsglobal/documents/standards/october_2021_nrm_2.pdf
- ICE – CESMM4: https://www.ice.org.uk/areas-of-interest/infrastructure-delivery/civil-engineering-standard-measurement
- DIN Media – DIN 18299:2023-09: https://www.dinmedia.de/en/standard/din-18299/369847346
- DIN Media – VOB 2019 and 2023 supplement: https://www.dinmedia.de/de/themenseiten/voballgemein
- NBS – Uniclass: https://uniclass.thenbs.com/
- Uniclass tables in CSV (community): https://github.com/buildig/uniclass-2015
- ICMS Coalition – ICMS 3: https://icms-coalition.org/the-standard/
- CSI – Dynamic Standards (MasterFormat, UniFormat, OmniClass): https://csiresources.org/standards/overview
- CCIC seminar report – CCI licensing (CC BY 4.0): https://budweiser.cadstudio.cz/2023/03/report-from-construction-classification.html

Prose answer:

The Word document is three pages, with four sections:

1. **Measurement rulebooks:** where to get each one, plus cost and access notes.
2. **Classification systems:** the same layout, with the free ones highlighted.
3. **Licensing for a software product:** which standards are product-friendly, which need a licence, and which you should read but not reproduce.
4. **Recommended starting set.**

It opens with the two corrections to my earlier notes and ends with clickable links to every source used.

### Turn 46 (user)
make a note somewhere if you didnt about the need to separate stuff by stories/rooms etc

### Turn 47 (assistant)
Files created (updated): IFC_BoQ_Remaining_Gaps.docx — existing "Remaining Gaps" Word doc; item 8 expanded and retitled, priority raised to High.

Text inserted into the document (item 8):

**8. Location breakdown: storeys, rooms, zones, units** — Priority: High (category: Makes it work / adoption; previously "Trust and adoption", Needed)
- **What:** Every quantity is kept with its location (site, building, storey, room or space, zone, residential unit, construction phase) so the BoQ can be split and subtotalled by any of them, in addition to grouping by element or trade.
- **Why:** Contractors price and schedule work floor by floor; phased projects, multi-building sites and unit-level costing (e.g. per apartment) all need it; finishes are specified per room; payment claims are usually measured by area of the building. A BoQ that only gives building-wide totals is often unusable on site.
- **How:** Carry each element's spatial containment (IfcSite, IfcBuilding, IfcBuildingStorey, IfcSpace, IfcZone) through the whole pipeline and expose location as a switchable view axis. Handle the awkward cases explicitly: elements spanning several storeys (columns, stair cores, curtain walls) need a rule (split by height, or assign to base storey); elements contained only at storey level need assigning to rooms by geometry.
- **Room-based finishes (part of this item).** Many finishes depend on the room, not the element: bathroom walls tiled to a set height and painted above, or the two faces of one wall finished differently because they face different rooms. This requires knowing which face of each wall, floor and ceiling bounds which room. IFC can carry this as space boundaries (IfcRelSpaceBoundary), but many exports omit them, so the engine must be able to compute room-face relationships from geometry. Without it, finishes can only be measured as building-wide totals.
- **Note on priority:** splitting by storey and room is a presentation choice, but room-based finishes change the numbers themselves, which is why this item is rated High rather than Needed.

Priority summary in the doc updated to: "High: 5, 6, 8. Without traceability, revision handling and location breakdown (including room-based finishes), nobody adopts it for daily work." and "Needed: 4, 7, 9, 10."

Prose answer:

The Remaining Gaps document already mentioned location breakdown briefly as item 8, but too thinly. I've expanded it:

- **Retitled** to "Location breakdown: storeys, rooms, zones, units".
- **What it covers:** site, building, storey, room, zone, residential unit and construction phase, all as ways to split and subtotal the BoQ.
- **Why it matters:** floor-by-floor pricing and scheduling, per-apartment costing, phased projects, and payment claims.
- **How to handle it:** carry the IFC spatial structure through the whole pipeline, with explicit rules for elements that span several storeys (columns, stair cores) and for assigning elements to rooms by geometry.
- **Room-based finishes:** added as part of this item, since it's closely related and wasn't in any document yet. For example, bathroom tiles to a set height, or the two faces of one wall finished differently. This needs wall-face-to-room relationships, which many IFC exports lack, so the engine has to compute them.
- **Priority raised** from Needed to High, because room-based finishes change the actual quantities, not just the presentation.

One other point from our later discussion isn't in either document yet: items with no model behind them (preliminaries, provisional sums, lump sums).

### Turn 48 (user)
What is that

### Turn 49 (assistant)
These are BoQ lines that don't correspond to anything physical in the building model, so no IFC file can produce them. There are three kinds.

**1. Preliminaries (also called "general items" or "site overheads").** This is the cost of running the construction site itself, not of building any particular part:
- Site setup: fences, site office, toilets, storage containers
- Scaffolding and cranes
- Temporary electricity and water
- Site manager and security
- Insurance, permits, cleaning at the end

None of this is in the model, but it's real cost, often 10–15% of a project.

**2. Provisional sums.** These are placeholder amounts for work that isn't fully decided when the BoQ is written. For example: "Kitchen fit-out: provisional sum €20,000 (design not finalised)" or "Landscaping: provisional sum €15,000". The line says "we know this will cost roughly this much; details later". When the design is settled, it gets replaced with properly measured items.

**3. Lump sums.** One fixed price for a package, without measuring quantities. For example: "Supply and install lift: lump sum", or "Fire alarm system complete: lump sum". These are typically used when a specialist supplier quotes the whole thing as one price.

**Why it matters for your engine:** these lines come from the template or the user, not the model. The engine must let them sit alongside the model-generated lines in the same BoQ, under the same grouping and in the same totals, so the final bill is complete. Technically this is simple: they're just lines with a manual or template source instead of a model source, using the same "source" field you already have for measured and derived items.

### Turn 50 (user)
Okay. Would it be safe to assume this would be sufficient business logic?

### Turn 51 (assistant)
Yes, it's safe to treat this as a complete business-logic design to start building from. I'd hold back from calling it final, though, for one reason: sufficiency can only be confirmed by people who measure buildings for a living, and by real projects.

**What you now have covered**
- **The pipeline:** read, verify, pre-flight check, ask, measure, derive, classify, group, output.
- **Three quantity sources:** measured from the model, derived by proxy, and manual or template items (preliminaries, provisional sums, lump sums). Anything that can't be determined is flagged, never dropped.
- **Swappable knowledge:** rulebooks, classifications, naming dictionaries and item libraries, each layered global → company → project.
- **The hard cases:** multiple models, input requirements (IDS), revisions, location breakdown with room-based finishes, and traceability.

**Two small additions I'd make so nothing obvious is missing**
- **Renovation status:** models often mark elements as new, existing or to-be-demolished (Revit calls these phases). Renovation BoQs measure demolition as its own work and exclude existing elements. This is a filter plus a few demolition items, not a new subsystem.
- **Design options:** some models contain alternatives, such as two roof variants. The engine should either pick one or produce a BoQ per option, rather than counting both.

**Why it isn't final yet**
- **A quantity surveyor should review the logic** before you build too much. Not the code, just the rules and flow. They'll spot conventions that neither of us knows about.
- **The answer-key comparison will expose edge cases.** That's expected, and it's fine.

The design absorbs discoveries well because rules live in data. Most new findings will mean adding a rule, a parameter or a derived-item formula, not redesigning the system. That's the real test of sufficiency, and this design passes it.

### Turn 52 (user)
Lets briefly discuss the other part of the platform that we touched before. Managing users, projects etc.

To start from ifc/boq - would it be good to have a project entity that acts as a folder that hold different ifcs with some metadata and each ifc may have different boqs thst may be different due to different presets chosen? When users are hapy they choose boqs they want and export.

Would this work?

### Turn 53 (assistant)
Yes, that works, and it's the right basic shape. Four refinements would save you a redesign later.

**1. Treat IFCs as versions of a model, not loose files.** The architect will send `building.ifc` again next week. That's a new version of the same model, not an unrelated file. So: Project → Model (e.g. "Architecture") → Versions (v1, v2, v3). This is what makes change tracking and carrying over user decisions possible.

**2. A BoQ shouldn't belong to a single IFC.** With multiple models, one BoQ is built from architecture v3 plus structure v2 together. So the BoQ belongs to the **project** and *references* the model versions it used, rather than sitting under one file.

**3. Keep review answers at project level, not inside each BoQ.** If a user answers "CT = cement screed" once, every BoQ in that project should reuse it, whatever the preset or revision. Otherwise they re-answer the same questions for every variant. Company-wide answers go one level higher still.

**4. Give BoQs a lifecycle, and freeze what gets exported.** "Users choose the BoQs they're happy with" is really an approval step: draft → in review → approved → issued. Once issued and exported, that BoQ is locked. Any later change creates a new revision, because issued BoQs end up in contracts and must never silently change.

Put together:

```
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

One detail matters: the BoQ stores a **snapshot** of the preset, not a link to it. If someone edits the company's preset next month, already-produced BoQs must stay reproducible exactly as they were.

With that structure, comparisons come almost free: the same model under preset A versus preset B, or version 2 versus version 3 under the same preset. Your original idea of several BoQs per IFC with different presets fits inside this naturally.

### Turn 54 (user)
So youre saying several ifc may be in one boq? Wouls it be as simple as meeging few boqs?

### Turn 55 (assistant)
Yes, several IFCs can feed one BoQ. But no, it's not as simple as merging BoQs. You combine the models first and then make one BoQ from the combined set. Merging finished BoQs would give wrong numbers.

**Why merging finished BoQs fails**

- **Double counting.** The architect models the concrete walls (to show the layout), and the structural engineer models the same walls (to design them). Two BoQs, both containing those walls: merge them and you've counted the concrete twice. Only element-level overlap detection catches this.
- **Things that span models.** A concrete wall exists only in the structural model, but its plaster and paint belong to the architectural design. Formwork is derived from structural concrete; finishes come from architectural rooms. Calculated separately, each BoQ is missing half the picture. Calculated together, the engine can see "this structural wall faces this architectural room, so it gets this finish".
- **Rooms and locations.** Rooms usually exist only in the architectural model. Assigning structural or MEP elements to rooms or storeys needs both models side by side.
- **The models don't always agree.** One file calls a storey "Level 1" at 0.00 and another calls it "GF" at +0.05. Coordinates can be slightly offset. That has to be aligned before anything is measured.

**The right order**

1. Load all selected model versions.
2. **Align** them: coordinates, and matching storey names and levels.
3. **Remove duplicates** using ownership rules (structural concrete belongs to the structural model, partitions to the architectural one, and so on). Conflicts go to review.
4. **Link** across models: walls to rooms, openings to hosts.
5. Measure once, producing one BoQ.

**When simple merging *is* fine:** when scopes genuinely don't overlap. Two separate buildings on one site, for example, or two phases measured independently. Then adding BoQs together is correct, provided they used the same preset and classification. That's a useful feature too ("combine BoQs"), just a different one from building a BoQ out of several models.

### Turn 56 (user)
But isnt it all in one project? One big file?

### Turn 57 (assistant)
One project, yes. One file, usually not. That's how the industry works.

**Why projects are split into several files**

- **Different firms, different software.** The architect works in Revit, the structural engineer in Tekla, the MEP engineer in something else. Each produces their own model, and you can't author in each other's software.
- **Responsibility.** Each discipline is legally responsible for its own design, so each owns and controls its own file. Nobody wants another firm editing their model.
- **Different update rhythms.** The architect updates weekly, while the structural engineer issues revisions at milestones. Separate files can be versioned independently.
- **Size and performance.** A large building with full installations can be gigabytes. Splitting by discipline, and sometimes by building or floor, keeps files workable.

So the normal setup is a **federated model**: separate files, combined only when viewed or checked (in tools like Navisworks or Solibri), never physically merged. International BIM practice (ISO 19650) assumes this setup.

**When it is one file**

- Small projects where one firm does everything in one model. Your duplex is an example: one Revit file, architecture only. That's why the question never came up with it.
- Even then, the IFC export is often split by discipline anyway.

**What it means for your engine:** treat "one file" as just a federation of one. The same pipeline (load, align, deduplicate, link, measure) handles both. With a single file, the align and deduplicate steps simply have nothing to do.

### Turn 58 (user)
Okay so basically for swveral ifcs users should say okay from this one get concrete works disregard x, and from this other one get electrics disregard bricks (bad example maube but you get the idea)

### Turn 59 (assistant)
Yes, exactly. These are the ownership rules from earlier. The user shouldn't have to configure every element by hand, though. It works best in three steps.

**1. Tag each model with its discipline, and defaults follow automatically.** When a file is added, the user marks it as Architecture, Structure or MEP (the engine can usually guess from the content). Each tag comes with a default scope:
- **Structure model provides:** foundations, load-bearing concrete, steel, reinforcement.
- **Architecture model provides:** partitions, finishes, doors, windows, roofs, rooms. Anything structural in it is ignored.
- **MEP model provides:** pipes, ducts, cables, fixtures. Everything else in it is ignored.

For most projects, the defaults alone are enough.

**2. The user adjusts with simple include/exclude filters.** For example: "From the architecture model, also take the stairs. The structural model has them only as rough placeholders." Or: "Ignore the furniture in the architecture model." Filters work by element type, classification, material or storey, the same vocabulary the engine already uses.

**3. The engine checks the result.** Two kinds of problem get flagged for review:
- **Overlaps:** an element claimed by both models, e.g. a concrete wall that's in both and both are set to include it. That would be counted twice.
- **Holes:** an element nobody claims, e.g. stairs excluded from structure *and* architecture. That would be missing from the BoQ.

The overlap check is the same solid-intersection test I ran on the duplex. Here it simply runs across files instead of within one.

These scope settings are saved with the project, so when architecture v4 arrives, the same rules apply automatically. A company can also save its usual setup as a template ("our standard three-discipline split") so every new project starts pre-configured.

### Turn 60 (user)
Olay lets keep it at this stage. How about ownerships users groups and access

