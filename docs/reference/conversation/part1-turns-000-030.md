# IFC BoQ conversation — Part 1 (turns 0–30)

Source: claude.ai chat 8655a050-1d83-4c49-a07f-5a107f1c518e ("Generating a book of quantities from IFC file")

### Turn 0 (user)

This is an ifc file. I want you to read it through, then work out whatever logic you find best to generate a book of quantities for it. 
The goal is to see how you work it out. Once generated, i want you to explain your process.

(Attached: Ifc2x3_Duplex_Architecture.ifc)

### Turn 1 (assistant)

The BoQ workbook is above, along with the four pipeline scripts and the intermediate `unified.json`, so you can follow every step.

## What I found when I read the file

The file is a 2011 Revit export in IFC2x3, about 39k lines. It holds 218 physical elements and 21 spaces on four storeys (T/FDN, Level 1, Level 2, Roof).

The key finding was that there are no IFC BaseQuantities at all. The only quantities are Revit's own `PSet_Revit_Dimensions` values (Length, Area, Volume, Perimeter) plus GSA area values on the spaces. That shaped the whole approach. I couldn't trust a single source, so I treated Revit's numbers as claims and re-measured every element from its actual geometry to test them.

## The pipeline, in four stages

**1. Extract.** `extract.py` turns the IFC into one flat JSON record per element. Each record holds:
- the reported quantities;
- the volume and area measured from geometry (ifcopenshell meshes each solid with openings already cut out);
- the type name, storey and material layer set;
- host links (door → opening → wall) and aggregate links (roof → slab, stair → flight/stringers/rails).

No decisions are made at this stage; it's just a faithful snapshot.

**2. Verify.** I compared reported and geometric volume for every element, with a 1% tolerance. About 95% matched to three decimals. The exceptions were the interesting part:

- **Main party wall: 433 m³ by geometry vs 25.83 m³ reported.** It was exported as a surface model with inconsistent face winding. After repairing the normals it came out at exactly 25.830 m³.
- **Short party wall stub: +42%.** I wrote `overlap.py` to run solid intersections between all fabric elements. It found two 0.379 m³ overlaps where this wall runs into its neighbours at T-junctions. Revit's figure is join-aware, so I adopted it. Geometry minus the overlaps lands within about 4% of Revit.
- **Revit's wall "Area" vs volume.** On 7 walls the Area didn't agree with Volume ÷ layer thickness. On the Level 2 exterior walls the gap is about 1.2 m², which is exactly two small windows that were deducted from Volume but not from Area. So I measure every wall as V/t, which keeps area, volume and the material layers consistent with each other.
- **Steel beams: geometry 3.5–4.7% over reported.** I sidestepped this by measuring steel the way a QS would: length × nominal kg/m from the W-section name. Volume × density stays in the Register as a cross-check.
- **Ceilings 187462 and 187470.** These overlap by about 3.2 m² of ceiling modelled twice. I flagged this but did not auto-correct it, because silently fixing a modelling error felt wrong.

**3. Classify and measure.** `classify.py` uses a rule table that maps IFC class + type name (+ storey) to an item key. Storey is only needed to separate the roof-level brick walls out as parapets. The grouping follows the NRM1 elemental structure.

A few rules override what the model says:
- The party wall is flagged `IsExternal=TRUE` in the model, but I classify it as internal by its type.
- Roof and stairs are measured at the parent object. Their child parts stay in the Register with count 0, so nothing is counted twice. Railings are the exception and are measured on their own.
- Footings have no material assigned, so concrete is assumed from the type name and logged.

Each element ends up with an adopted quantity and a written reason for how that quantity was chosen.

**4. Present.** In the workbook, every BoQ quantity is a SUMIFS formula over the Register, not a pasted number. Changing a key, a parameter or a material name re-flows everything. Two of these are worth noting:
- **Opening add-back threshold (Params sheet).** Set it to 1.0 m² and the external wall area goes from 235.78 to 243.24 m², because the small windows get added back. This lets you apply whichever measurement standard's deduction rule you need.
- **Naming dictionary (Materials sheet).** It merges "Concrete" and "Concrete - Cast In Situ" into one material.

Derived items such as formwork and paint are marked as derived, and their formulas are visible.

## What's in the workbook

- **BoQ:** priced-bill layout with the rates column left blank.
- **Register:** one row per element, with its reasoning and a flag.
- **Openings:** door and window schedule with each host wall.
- **Materials:** layer-by-layer take-off.
- **Rooms:** space schedule, giving 276.3 m² net internal area excluding the roof space.
- **QA:** log of every finding and the decision taken.

## Limits

This is an elemental bill, not a full trade-by-trade bill. The model doesn't support anything finer: there is no MEP, no reinforcement, the stair material is undefined, and worktop lengths weren't exported. For the same reason I left out skirtings, sills and ironmongery rather than inventing them.

The structure deliberately mirrors your planned IFC → unified JSON → rules → BoQ architecture. Every item in the QA sheet is the kind of thing your mid-run review queue would need to surface, especially the surface-model winding issue and the junction overlaps. Neither is visible unless you measure geometry independently of the authoring tool's numbers.

Files created: Duplex_BoQ.xlsx (sheets: BoQ, Register, Openings, Materials, Rooms, QA, Params), pipeline/extract.py, pipeline/overlap.py, pipeline/classify.py, pipeline/build_boq.py, pipeline/unified.json (intermediate) — four-stage IFC → unified JSON → verify → classify → Excel BoQ pipeline. Source model: Ifc2x3_Duplex_Architecture.ifc.

Tool-output findings used (from the analysis, not separately stated beyond the prose above): the assistant read the existing memory file /areas/ifc-boq-app.md (the user's planned IFC → unified JSON → rules → BoQ app architecture) before starting; it used ifcopenshell to survey entity types, property sets, materials, storeys; geometry volumes were compared to Revit-reported volumes; pairwise solid intersection checks were run (overlaps.json); a register.json of adopted quantities was produced; the opening add-back threshold parameter was tested (235.78 → 243.24 m² at 1.0 m²); a railing-exclusion bug was fixed and the workbook rebuilt and recalculated.

### Turn 2 (user)

Few uninformed questions:

* i understand there are different measurement standards, which one did you use, were you able to deduce a specific one, and would using a different one (like north america or yu or gb one) keep the general logic same/similar?
* i also understand there are some naming of elemets that might be custom by the user, is that the case here or are they some default values?
* If they were unclear (for example having 'BETON' instead of concrete or CT or somethin internal), how would you handle it?
* i also understand that boq may have different grouping and formatting, is that something common or does everyone has their own way of organizing it?

### Turn 3 (assistant)

**1. Which measurement standard did I use?**

None, strictly. I borrowed the NRM1 *grouping* (the UK elemental cost-planning structure). The *measurement* itself was simply "net, as modelled": deduct every opening, measure walls at mean area. That isn't any standard's rule set. It's a neutral default, and that's why I made the opening threshold a parameter.

I couldn't deduce a standard, because IFC carries geometry and properties, not measurement rules. I could only deduce where the file came from:
- The `M_` families are Revit's metric library.
- The address is Chicago.
- The spaces carry GSA BIM areas and OmniClass codes.

So it's a US-context model, and this one is the well-known NIBS/GSA sample duplex. Even then, North America has no single mandated measurement standard the way the UK has NRM. Practice there leans on CSI MasterFormat or UniFormat for structure, with firm-level takeoff conventions (Canada has the CIQS method).

Switching standards keeps the logic the same. Extraction, geometry verification, overlap checks and classification are standard-agnostic. What changes is the rules layer:
- **Deduction thresholds:** below what size is an opening ignored.
- **Units per item:** ex-YU practice commonly measures thicker masonry in m³ and thinner walls in m², where NRM measures walls in m².
- **Formwork:** measured separately or included in the concrete item.
- **Measuring face:** which face or centreline a wall is measured on.
- **Rounding**, and **item descriptions and language**.

For ex-YU predmjer conventions I'd work from the actual norms document rather than quote thresholds from memory, since details vary. Structurally, all of this fits your parameterized-rules design: same engine, different parameter set per standard.

**2. Are the element names custom or defaults?**

Mostly Revit defaults:
- Families like `M_Single-Flush` and `M_Fixed`.
- Wall types like "Exterior - Brick on Block".
- Materials like "Masonry - Concrete Block", which come straight from Revit's default library.

A few are lightly customised; "Party Wall - CMU Residential Unit Dimising Wall", typo included, looks hand-made.

Only the IFC class (IfcWall, IfcSlab, etc.) is standardised. Names are free text. Real projects usually carry office naming conventions, local language and internal codes.

My rule table matched on substrings of *these* names, so it's file-specific. That's the fragile part of what I built, and in a real tool it can't be the main mechanism.

**3. How would I handle unclear names like "BETON" or "CT"?**

I wouldn't rely on the name alone. An element carries plenty of other evidence:
- **Its IFC class and predefined type.**
- **Its layer structure and thicknesses.** A 10 mm layer over 3 mm on a floor is almost certainly a finish.
- **`Pset_*Common` flags** like IsExternal and LoadBearing.
- **Any IfcClassificationReference** (Uniclass, OmniClass) if present.
- **Material properties** like density, or a strength class such as C25/30 or MB30, which implies concrete.
- **Position:** below grade, hosted by what.

Then I'd resolve the name in layers:
1. Exact match in the naming dictionary.
2. Known aliases and multilingual synonyms. "BETON" is easy: it means concrete in most European languages.
3. Fuzzy or contextual matching that produces a proposal with a confidence score. An LLM is useful here, given the surrounding evidence.

"CT" is genuinely ambiguous: it could be ceramic tile, cement screed, or something internal. Anything below the confidence threshold goes to the review queue, never a silent guess. Once a person resolves it, the mapping is saved to the org dictionary so it's automatic next time.

That's the same mechanism I used here in miniature. The footings had no material, so I inferred concrete from the type name and logged it as an assumption rather than hiding it.

**4. Is BoQ grouping and formatting standard, or does everyone do it their own way?**

Both. There are two dominant philosophies:
- **Elemental:** by building part, e.g. NRM1 or UniFormat. Used mainly for early cost planning.
- **Trade / work-section:** by trade package, e.g. NRM2, CSI MasterFormat, or ex-YU predmjer organised by work type (zemljani, betonski, armirački, zidarski, izolaterski, keramičarski, molersko-farbarski…). Used for tendering, because each section maps to a subcontractor.

On top of that skeleton, firms customise numbering, level of detail, preliminaries, provisional sums and summary pages (rekapitulacija). The column set is close to universal: item no., description, unit, quantity, unit rate, amount.

Public tenders often fix the format. In BiH procurement the contracting authority issues the predmjer and bidders only fill in rates, so you must match their structure exactly.

This supports your decision to treat grouping as a display layer. If every measured item carries both an elemental code and a trade code, the same quantities can be pivoted into either structure, or a client's template, without recalculating anything.

### Turn 4 (user)

Now, again, dumb it down as I dont fully understand the industry.
Imagine its the same file but there are different standards, classifications, whatever - can you planily tell me what are all the variants of doing this thing?
Like I assume it only affects calculation? What might affect it?

### Turn 5 (assistant)

No, it's not only the calculation. Think of the IFC file as a pile of raw facts ("this wall is 10 m long, 3 m high, made of these layers"). A BoQ is a report written from those facts. Different countries and companies write that report under different rules, and those rules touch several separate things.

## The knobs, from raw file to finished BoQ

**1. Scope: what counts at all.** Does furniture go in? Are formwork and scaffolding listed as their own items? Do you include only new construction, or demolition too? Same file, but you decide which parts of it end up in the bill.

**2. Breakdown: how finely you split things.** One wall can be one line ("cavity wall, 29.4 m²") or five lines, one per layer (brick, insulation, block, plasterboard, paint). Splitting creates new quantities that didn't exist as separate lines before.

**3. Measurement rules: the actual math.** This is the "calculation" part you were thinking of. It covers:
- **Unit:** the same wall in m², or in m³ for the block part.
- **Deductions:** do you subtract a small window from the wall area, or ignore openings under some size?
- **What's included in an item:** e.g. whether formwork is folded into the concrete item.
- **Rounding.**

**4. Classification: what you call each item.** Which code and label each item gets in some coding system (Uniclass, OmniClass, a local one, or the company's own). This doesn't change any number. It's like choosing which product codes go on an invoice.

**5. Grouping: how items are organised.** Either by building part (foundations, walls, roof…) or by trade (concrete works, masonry works, painting works…), or in whatever order the client's template demands. The numbers don't change, only the order and the subtotals.

**6. Presentation: how it looks.** Language, how descriptions are worded, column layout, currency, metric or imperial units, the summary page.

There's also a step that applies no matter which standard you pick: **cleaning the input**. That means deciding whether to trust Revit's numbers or the geometry, handling overlapping walls, and guessing missing materials. It's what most of my QA sheet was about. It affects numbers, but it isn't a "standard" choice; it's fixing bad data.

## The same wall under three setups

Take a wall 10 m × 3 m with one small 0.6 m² window. The thresholds below are illustrative, not quoted from any specific rulebook.

| Setup | What the BoQ shows |
|---|---|
| What I did ("as modelled") | 1 line: cavity wall, **29.4 m²** (window subtracted) |
| UK-style, detailed | 4–5 lines (brick, insulation, block, plasterboard), each **30 m²**, because openings under ~1 m² are not deducted |
| Ex-YU predmjer style | Spread across trade sections: masonry gives block in **m³** (~5.8), with facade brick, insulation, drywall and painting each in m² under their own sections |

All three come from the same file and the same wall, but the bills look completely different.

## The short version

Only knobs 1–3 (scope, breakdown, measurement rules) change the numbers. Knobs 4–6 (classification, grouping, presentation) only change labels and layout. That split is useful for your app: the first group belongs in the calculation engine, and the second can be a switchable view on top of the same results.

### Turn 6 (user)

Okay - now could those be 'selected' before generation?
Like, if i told you scope A, breakdown B, rules D. ?

### Turn 7 (assistant)

Yes. The way to picture it is a settings screen you fill in before pressing "generate". Here's how that works in practice.

**Picking a standard really means picking a preset bundle.** Something like "UK detailed" or "ex-YU predmjer" isn't one switch. It's dozens of small settings at once: a unit for each item type, a deduction threshold, whether formwork is its own line, how finely walls get split, and so on. So you'd pick a preset ("Rules: ex-YU"), which fills in all those small settings, and then tweak whatever you need ("…but deduct all openings"). That's the same idea as the threshold cell in my Params sheet, just with many more cells.

**There are two kinds of choices, and they behave differently:**
- **Choices that must be made before calculation:** scope, breakdown and measurement rules. Change one of these afterwards and you have to recalculate.
- **Choices that can wait, or change at any time:** classification codes, grouping and presentation. These just re-label and re-sort results that already exist, so you can flip a finished BoQ from "by building part" to "by trade" instantly.

**What can stop you from simply picking:**
- **The file has to contain what your choices need.** If you select "split walls into layers" but a wall has no layer data, or "measure footings by material" when they have no material (like this file), the system can't invent it. It has to fall back to a default, make a logged assumption, or ask you.
- **Some combinations don't make sense together.** For example, "lump each wall into one line" combined with "measure block in m³" contradicts itself, because once the wall is a single line there's no separate block to measure. Presets avoid most of this, but custom mixes need a check that warns you.
- **Cleaning the input can't be fully preselected.** You can set defaults like "trust Revit's numbers unless geometry differs by more than 1%". Weird cases, though, such as a mystery material called "CT" or two overlapping ceilings, still need a human decision partway through. That's your review step.

So the flow would be: pick a preset and adjust it, run the generation, resolve anything flagged, and get the BoQ. Classification, grouping and look stay switchable at the end.

And yes, you can do exactly that with me right now. Give me something like "scope: building fabric only, no furniture; breakdown: per layer; rules: ex-YU style, openings under 0.5 m² not deducted; grouping by trade". I'll rerun the same file through the pipeline and you can compare it side by side with the first BoQ. Want to try a combination?

### Turn 8 (user)

So, again, assume I dont get it very well. 
I could choose stuff, then you could figure okay this ifc doesnt have info about it or contradits itself and report back?

### Turn 9 (assistant)

Yes, exactly. Before calculating anything, the system checks your choices against the file and tells you what it can't do. Think of it as a pre-flight check.

It looks for three kinds of problems.

**1. Missing information.** Your choices need something the file doesn't have. In this file:
- You choose "split everything by material layer", but the footings have no material at all.
- You choose "worktops in metres", but the file only says how many worktops there are, not how long they are.

**2. Your choices contradict each other.** For example, "one line per wall" together with "measure the block part in m³". If a wall is a single line, there's no separate block to measure.

**3. The file contradicts itself.** These are things I found earlier in this file:
- Revit says a wall is 2.0 m³, but its actual 3D shape is 2.9 m³.
- A wall is marked "external" but is actually the wall between the two apartments.
- Two ceilings sit on top of each other.

For each problem, the report says what's wrong and offers a way out. Here's what that could look like for this file:

> ⚠ **Footings: no material.** The name says "Bearing Footing", so probably concrete. *Use concrete / Let me pick / Skip*
>
> ⚠ **Worktops: no length in file.** *Count them as pieces instead / Enter lengths manually*
>
> ⚠ **Party wall: Revit volume ≠ actual shape.** The difference is explained by overlap with neighbouring walls. *Use Revit's number (recommended) / Use shape*
>
> ⚠ **Ceilings 187462 & 187470 overlap (~3.2 m²).** *Keep both / Subtract overlap / Flag for designer*
>
> ✓ **Everything else (210 elements) is fine.** Calculating.

You answer the questions, or accept the recommended defaults, and then it produces the BoQ. Every answer you gave is written into the BoQ's notes, so anyone reading it later knows what was assumed.

That's basically what my QA sheet already was. The difference is that I made those decisions myself and told you afterwards. In the version you're describing, you'd get the questions first and decide yourself.

### Turn 10 (user)

And could this logic overall be transformed into an engine/script?

### Turn 11 (assistant)

Yes. What I did is already about 70% of an engine, just written for this one file. The scripts I gave you are that rough version.

## What the engine looks like

It takes two inputs, the IFC file and a settings file (your choices), and runs fixed steps:

1. **Read.** Turn the IFC into clean JSON: every element, its numbers, its shape, its materials, what it belongs to. This works on any IFC already.
2. **Check.** Re-measure the geometry, compare it with what the file claims, find overlaps, and test whether the file has what your settings need. This also works generally already.
3. **Ask.** If something is missing or contradictory, pause and return a list of questions. When you answer, it continues. This part is new.
4. **Measure.** Apply your scope, breakdown and rules to get quantities, each with a "why" note.
5. **Output.** Apply classification, grouping and layout, then export to Excel, JSON or whatever you want.

The settings file would look something like this:

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

You run it with something like `boq run duplex.ifc --settings my-settings.yaml`. You get back either a BoQ or a list of questions.

## What has to change from my scripts

- **The rule table is hardcoded.** I matched on names from this exact file, like "Exterior - Brick on Block". An engine needs to recognise elements by class, layers, properties and a naming dictionary, not by exact names.
- **Rules have to live in data, not code.** Every standard becomes a preset file, so adding the "UK" or "US" way means writing a new settings file, not new Python.
- **Asking and resuming.** My scripts made decisions silently. The engine has to stop, save its state, and continue after you answer.

## What's actually hard

- **Writing correct presets.** The code is the easy part. Someone who knows ex-YU or UK measurement rules has to translate them into settings, and that needs a domain expert, not a programmer.
- **Recognising unclear names.** This takes a dictionary, plus AI suggestions, plus human confirmation, and the system improves over time as answers are saved.
- **Different authoring tools export IFC differently.** Revit, ArchiCAD and Tekla each have quirks, like the broken wall shape in this file. You'd collect fixes over time by testing on many real files.

If you want, I can turn the current scripts into a small working v0 engine. It would take an IFC plus a settings file, return either questions or a BoQ, and include one or two example presets, tested on this duplex file.

### Turn 12 (user)

No i am still trying to learn and understand, for now i just want answers and explanation.

What.exactly.are.the.gaps.here.
Do you need dictionaries, standards? Ehich one?

### Turn 13 (assistant)

There are six gaps. Only some of them are solved by dictionaries or standards.

## 1. Measurement rulebooks (the "how to calculate" rules)

These say what unit to use, what to subtract, and what's included in each item.

- **UK:** RICS **NRM2** is used for detailed BoQs, and **NRM1** for early cost estimates. They're paid documents from RICS.
- **Germany** (useful as a reference, since Balkan practice borrows from it): **VOB Part C**. Each trade has its own section with a measurement chapter.
- **North America:** there's no single rulebook. Practice is firm-specific; Canada has a CIQS method of measurement.
- **Ex-YU / BiH:** this is the murkiest. Practice is a mix of old Yugoslav construction norms, technical conditions, and the habit of writing the rule into each item ("obračun po m² …"). There's no single modern document I can point to with confidence.

**The real gap:** none of these exist in a form a program can read. They're prose PDFs. Someone has to translate them into settings like "deduct openings over X m²" or "masonry over Y cm thick in m³". That's the biggest gap, and it needs a quantity surveyor, not a programmer.

## 2. Classification code lists (the "labels and buckets")

These are lists of codes and names for each kind of item.

- **Uniclass 2015** (UK): free from NBS.
- **OmniClass** (North America): free.
- **UniFormat / MasterFormat** (North America): MasterFormat is paid.
- **ICMS** (international cost reporting): free.
- **DIN 276** (Germany): paid.
- **Ex-YU:** no shared code system. Chapter numbering in a predmjer is convention.

This is the easiest gap. They're just tables you download and load.

## 3. Naming dictionary (messy name → what it actually is)

This turns "BETON", "MB30", "C25/30", "Concrete" and "Concrete - Cast In Situ" into one meaning, *concrete*. It also covers opeka/cigla → *brick*, Knauf/Rigips/gips ploča → *plasterboard*.

- **What exists to start from:** the **bSDD** (buildingSMART Data Dictionary), which is free and multilingual. You can also use the IFC class definitions themselves and Revit's default library names.
- **What doesn't exist:** a complete dictionary of brand names, local terms and office abbreviations. You build it over time, with AI suggestions plus human confirmation, saving every answer.

## 4. Item library (meaning → actual BoQ line)

Once you know something is "19 cm block wall", you need the standard description text, the unit and the quantity to use, for each standard and language. For example: *"Zidanje zidova blokovima d=19 cm u produžnom malteru… obračun po m³."*

- Germany has **STLB-Bau** (standard descriptions). The UK has NBS-based libraries inside commercial software.
- In ex-YU, these live in each firm's own templates and old predmjeri. Collecting a set of real local predmjeri would be the practical source.

## 5. Missing data in the model itself

No dictionary fixes this. If the file has no worktop lengths, no footing material, no reinforcement and no installations, the information simply isn't there. Your options are defaults, user input, or a better model. A related gap is that every authoring tool exports IFC differently, so you need many real test files to collect the quirks. buildingSMART publishes free sample models to start with.

## 6. An answer key (how do you know the output is right?)

I produced numbers, and I verified them against the file. Nobody has verified them against a human professional. To know the engine is correct, you need the same model measured by a real quantity surveyor under a known standard, and then you compare the two. This is the gap most people forget, and without it you can't prove anything.

## In short

- **Easy to get:** classification lists (#2), and a starter for the naming dictionary (#3).
- **Must be built over time:** the naming dictionary (#3), the item library (#4), and IFC quirk fixes (#5).
- **Needs a human expert:** turning rulebooks into settings (#1), and an answer key (#6).

For the BiH/ex-YU market specifically, the single most valuable thing would be one local quantity surveyor or civil engineer. They'd give you their measurement rules, a few real predmjeri as item templates, and one project where you have both the IFC and their manual predmjer to compare against.

### Turn 14 (user)

okay, provide me now:
list of possible or realistic rulebook options
list of classifications

### Turn 15 (assistant)

(Tool use: one web search — "predmjer radova građevinske norme GN obračun radova standard BiH". No source links were printed in the answer.)

## 1. Rulebooks (how quantities are calculated)

| Rulebook | Region | Used for | Access |
|---|---|---|---|
| **NRM2** (RICS) | UK, plus many Commonwealth / Middle East markets | Detailed BoQs for building works. This is the main UK standard today. | Paid |
| **NRM1** (RICS) | UK | Early cost estimates, measured roughly by building element | Paid |
| **SMM7** | UK (legacy) | Older detailed method, replaced by NRM2. Still appears on older projects. | Paid |
| **CESMM4** (ICE) | UK | Civil engineering (roads, bridges, utilities), not buildings | Paid |
| **VOB Part C** (DIN 18299 + trade-specific parts) | Germany | Each trade has its own measurement section. Common reference in Central Europe. | Paid |
| **ÖNORM B 22xx series** | Austria | Trade-specific contract standards that include measurement rules (verify details before relying on them) | Paid |
| **CIQS Method of Measurement** | Canada | Canadian equivalent of a measurement standard | Paid |
| No single standard | USA | Firm practice. Organisation usually follows MasterFormat (see classifications). | — |
| **GN norms / Prosječne norme u građevinarstvu** | Ex-YU (BiH, Serbia, Montenegro, partly Croatia) | See note below this table. | Old publications, scattered |
| **"As modelled"** | Anywhere | Net quantities straight from the model, with no standard applied. This is what I did. | — |
| **Client / tender template** | Anywhere | The client dictates the rules and format. Very common in public procurement. | Provided by client |

For ex-YU, a university teaching material from Montenegro explains how the system works. The mandatory construction norms apply to measurement unless another method is specified, and items are marked by norm type (GN = građevinska norma). Concrete works fall under the GN 400 series, measured per m³ of placed concrete. Serbian general conditions documents say the same thing: measurement and classification of completed work follow the average construction norms and Yugoslav standards, together with the descriptions of the individual items in the bill.

So in practice, ex-YU = GN norms + the rule written inside each item + firm habit.

**Realistic options for you:** "As modelled" as the base, then **ex-YU/GN-style** for the local market, then **NRM2** if you want an international or English-speaking market. The client-template option is needed regardless, for tenders.

## 2. Classifications (labels and buckets, no effect on numbers)

| System | Region | Organised by | Access |
|---|---|---|---|
| **Uniclass 2015** (NBS) | UK | Multiple tables: elements, systems, products, spaces… | Free |
| **NRM1 element groups** | UK | Building parts (substructure, frame, roof…). This is what I used. | Paid (part of NRM1) |
| **ICMS** | International | Cost reporting across countries and project types | Free |
| **OmniClass** | North America | 15 tables (spaces, elements, work results, products…). This file already uses its Table 13 for rooms. | Free |
| **UniFormat** (CSI / ASTM UniFormat II) | North America | Building elements, for early estimates | Paid / ASTM |
| **MasterFormat** (CSI) | North America | Trades / work results (50 divisions). The US standard for specs and bids. | Paid |
| **DIN 276** | Germany (influences Croatia/Austria) | Cost groups 100–800 | Paid |
| **CCI / CoClass** | Nordics, growing internationally | Modern, BIM-oriented, object-based | Mostly free |
| **Vrste radova** (convention) | Ex-YU | Trade sections: *Građevinski* (pripremni, zemljani, betonski/AB, armirački, zidarski, izolaterski, tesarski…) and *Zanatski* (krovopokrivački, limarski, stolarski, bravarski, keramičarski, podopolagački, gipsarski, molersko-farbarski, fasaderski…) | Convention, no official code list |
| **IFC classes + bSDD** | International | Not a BoQ classification, but the shared language that the systems above get mapped onto | Free |

**Realistic options for you:** **ex-YU vrste radova** (essential locally), **Uniclass** (free, well documented, UK/EU), **OmniClass** or **MasterFormat** if you ever target the US, and **ICMS** if you want a neutral international option.

One thing to keep in mind: rulebooks and classifications pair naturally but aren't locked together. You could measure by GN rules and still label items with Uniclass codes. That's exactly why your app can treat them as separate choices.

### Turn 16 (user)

Create a spreadsheet from your last answer.

### Turn 17 (assistant)

The spreadsheet has three tabs:
- **Rulebooks:** 11 options, with publisher, region, purpose, status, access, and whether it's a realistic pick for you.
- **Classifications:** 10 systems, in the same layout.
- **Notes:** the key takeaways, plus source links for the ex-YU rows.

The realistic picks are highlighted, and both tables have filters, so you can narrow by region or access.

Files created: BoQ_Rulebooks_and_Classifications.xlsx — three sheets (Rulebooks, Classifications, Notes); realistic picks highlighted in light purple, header fill dark purple (#3B2A6B), filters and frozen panes. Content written into the file (adds Publisher/Status columns and sources not in the turn-15 prose):

**Sheet "Rulebooks"** — title "Measurement rulebooks - how quantities are calculated"; note "These change the NUMBERS: units, deductions, what each item includes."

| Rulebook | Publisher | Region | Used for | Status | Access | Realistic pick? |
|---|---|---|---|---|---|---|
| NRM2 | RICS | UK, plus many Commonwealth / Middle East markets | Detailed BoQs for building works | Main UK standard today | Paid | Yes - for international / English-speaking market |
| NRM1 | RICS | UK | Early cost estimates, measured roughly by building element | Current | Paid | No |
| SMM7 | RICS | UK | Older detailed measurement method | Legacy - replaced by NRM2; still seen on older projects | Paid | No |
| CESMM4 | ICE | UK | Civil engineering works (roads, bridges, utilities), not buildings | Current | Paid | No |
| VOB Part C (DIN 18299 + trade parts) | DIN | Germany | Trade-specific measurement rules; common Central European reference | Current | Paid | No |
| ONORM B 22xx series | Austrian Standards | Austria | Trade-specific contract standards incl. measurement rules | Current - verify details before relying on them | Paid | No |
| CIQS Method of Measurement | CIQS | Canada | Canadian measurement standard | Current | Paid | No |
| No single standard | - | USA | Firm practice; organisation usually follows MasterFormat | - | - | No |
| GN norms / Prosjecne norme u gradjevinarstvu | Ex-YU legacy norms | BiH, Serbia, Montenegro, partly Croatia | Measurement per norm type (e.g. GN 400 = concrete works, per m3 placed) + rule written inside each item + firm habit | Legacy but still referenced in general conditions | Old publications, scattered | Yes - for local market |
| "As modelled" | - | Anywhere | Net quantities straight from the model, no standard applied (used in the Duplex BoQ) | - | - | Yes - base / default |
| Client / tender template | Client | Anywhere | Client dictates rules and format; very common in public procurement | - | Provided by client | Yes - needed regardless, for tenders |

**Sheet "Classifications"** — title "Classification systems - labels and buckets"; note "These change LABELS and GROUPING only, never the numbers."

| System | Publisher | Region | Organised by | Access | Realistic pick? |
|---|---|---|---|---|---|
| Uniclass 2015 | NBS | UK | Multiple tables: elements, systems, products, spaces... | Free | Yes - free, well documented, UK/EU |
| NRM1 element groups | RICS | UK | Building parts (substructure, frame, roof...) - used in the Duplex BoQ | Paid (part of NRM1) | No |
| ICMS | ICMS Coalition | International | Cost reporting across countries and project types | Free | Yes - neutral international option |
| OmniClass | CSI / CSC | North America | 15 tables (spaces, elements, work results, products...); the Duplex file uses Table 13 for rooms | Free | Yes - if targeting the US |
| UniFormat (CSI / ASTM UniFormat II) | CSI / ASTM | North America | Building elements, for early estimates | Paid / ASTM | No |
| MasterFormat | CSI | North America | Trades / work results (50 divisions); US standard for specs and bids | Paid | Yes - if targeting the US |
| DIN 276 | DIN | Germany (influences Croatia/Austria) | Cost groups 100-800 | Paid | No |
| CCI / CoClass | CCI / BIM Alliance | Nordics, growing internationally | Modern, BIM-oriented, object-based | Mostly free | No |
| Vrste radova (convention) | Convention | Ex-YU | Gradjevinski: pripremni, zemljani, betonski/AB, armiracki, zidarski, izolaterski, tesarski... Zanatski: krovopokrivacki, limarski, stolarski, bravarski, keramicarski, podopolagacki, gipsarski, molersko-farbarski, fasaderski... | Convention, no official code list | Yes - essential locally |
| IFC classes + bSDD | buildingSMART | International | Not a BoQ classification - the shared language other systems map onto | Free | No (used internally) |

**Sheet "Notes":**
- Rulebooks and classifications pair naturally but are not locked together: you can measure by GN rules and label items with Uniclass codes.
- Ex-YU summary: GN norms + the measurement rule written inside each predmjer item + firm habit. Concrete works fall under the GN 400 series, measured per m3 of placed concrete.
- Sources for the ex-YU rows:
  - University of Montenegro teaching material on predmjer/predracun (GN norm marking, GN 400 concrete): https://www.ucg.ac.me/skladiste/blog_45298/objava_67552/fajlovi/Proracun%20kolicina%20radova%20i%20predracun%20radova.pdf
  - Serbian general conditions referencing average construction norms and Yugoslav standards: https://www.divac.com/upload/document/opsti_uslovi.pdf
- Other rows are from general industry knowledge; verify current editions and pricing with the publishers before relying on them.
- Footer on both tables: "Highlighted rows = realistic starting options for an IFC-to-BoQ app aimed at BiH / ex-YU first, international second."

### Turn 18 (user)

that covers point 1 and 2
now, lets do similar for naming dictionary (point 3), is there something existing, official, used
also - dos it need users to define their own as well?

same for point 4

### Turn 19 (assistant)

Short answer: for the naming dictionary there are good international starting points, but nothing official covers Bosnian/Serbian/Croatian names or office abbreviations. For the item library, Germany, Austria and Switzerland have strong official ones, the UK and US rely on commercial ones, and ex-YU has nothing modern or official. Users need their own layer for both.

## 3. Naming dictionary (messy name → what it actually is)

| Resource | What it is | Official? | Access | Useful for |
|---|---|---|---|---|
| **bSDD** (buildingSMART Data Dictionary) | Online multilingual dictionary of building concepts and properties; hosts many classifications | Yes, buildingSMART (IFC's owner) | Free, has an API | The main backbone: linking names to IFC concepts across languages |
| **IFC schema** | The standard element types (IfcWall, IfcSlab…) with definitions | Yes, ISO 16739 | Free | The fixed meaning layer everything maps onto |
| **ISO 12006-3** | The framework standard behind bSDD (how to structure such dictionaries) | Yes | Paid | Design reference only |
| **Uniclass Pr (Products) table** | Generic product and material names with codes | Yes, NBS | Free | A normalised vocabulary for materials and products |
| **ÖKOBAUDAT** | German government database of building materials (built for environmental data) | Yes, German ministry | Free | Material names in German and English, with densities |
| **ETIM / ECLASS** | Product classification for technical products | Industry standards | ETIM free, ECLASS paid | Mainly installations (MEP), less so for structure |
| **IATE** | EU terminology database | Yes, EU | Free | Translating terms; includes Croatian, though not Serbian or Bosnian officially |
| **Revit / ArchiCAD default libraries** | Default material and type names like the ones in your duplex file | De facto | Comes with the software | Recognising untouched default names automatically |
| **Manufacturer catalogues / BIMobject** | Brand product names (Knauf, Ytong, Rigips…) | No | Mostly free | Mapping brands to generic materials |

What doesn't exist anywhere: a dictionary of local terms (opeka, cigla, gips ploča, beton MB30), shorthand like "CT", or office codes.

**Do users need their own?** Yes, always. Think of it as three layers, checked from the most specific to the most general:

1. **Project:** one-off names used only in this model.
2. **Company:** the office's own naming habits ("Z-25" means their 25 cm wall type).
3. **Global:** the dictionary you ship, seeded from bSDD, Uniclass, Revit defaults and local synonyms.

When a user answers a review question ("CT = cement screed"), they choose whether that answer applies to this project only or to their whole company. Over time, the questions dry up.

## 4. Item library (meaning → actual BoQ line with text and unit)

| Resource | Region | What it is | Official? | Access |
|---|---|---|---|---|
| **STLB-Bau** | Germany | Standard item descriptions, tied to VOB/C | Yes (DIN / GAEB) | Paid |
| **GAEB** | Germany | The standard file format for exchanging BoQs between software | Yes | Spec available |
| **LB-HB** (Leistungsbeschreibung Hochbau) | Austria | Standardised item library for building works | Yes, ministry-published | Free |
| **ÖNORM A 2063** | Austria | BoQ exchange format | Yes | Paid |
| **NPK** (Normpositionen-Katalog) | Switzerland | Standard item catalogue | Yes (CRB) | Paid |
| **NRM2 itself** | UK | Defines how item descriptions are built (structured levels), but isn't a ready-made library | Yes (RICS) | Paid |
| **Commercial QS software libraries** (CostX, NBS-based tools) | UK | Ready-made item libraries | No, commercial | Paid |
| **RSMeans** | USA | Line items with descriptions, units and unit costs | De facto standard | Paid |
| **GN norm books / Prosječne norme** | Ex-YU | Describe each type of work, with labour and material norms; the traditional basis for predmjer item text | Legacy, semi-official | Old printed books, scattered |
| **Real predmjeri from local firms and tenders** | Ex-YU | The actual wording people use today | No | Public tenders are a good free source |
| **IfcCostSchedule / IfcCostItem** | International | A way to store a BoQ inside IFC itself | Yes (IFC) | Free |

For BiH specifically, the practical item library is built from old public tender predmjeri (procurement portals publish them) and GN norm descriptions. A local engineer cleans them up into templates.

**Do users need their own?** Even more than for names. Three reasons:
- Every firm words items its own way and decides how finely to split them.
- Public tenders force the client's exact wording and numbering.
- Firms want their past predmjeri to be reusable.

So it uses the same three layers:

1. **Client template:** imported from the tender's Excel predmjer. The system reads its items and matches model elements to them.
2. **Company library:** the firm's own items, possibly built by importing their old predmjeri.
3. **Base library:** the one you ship, per rulebook preset.

The useful feature here is **importing an existing Excel predmjer as a template**. That's how firms in BiH actually work: they start from a previous bill and edit it.

## The pattern behind both

Official resources give you a starting point. Real use always needs a company layer and a project or client layer on top. The difference between the two points is the starting point itself: decent and free for names (bSDD plus Uniclass), but for local items you'd have to collect it yourself.

### Turn 20 (user)

Create a spreadsheet from your last answer.

### Turn 21 (assistant)

The spreadsheet has three tabs:
- **Naming dictionary:** 9 resources, what's missing everywhere, and the three user layers (project, company, global).
- **Item library:** 11 resources by region, the BiH sourcing note, and the three user layers (client template, company, base).
- **Summary:** both points compared side by side.

Highlighted rows are the key starting points. bSDD, IFC, Uniclass and the Revit defaults are highlighted for names; GN norms and real tender predmjeri are highlighted for the BiH item library.

Files created: BoQ_Naming_Dictionary_and_Item_Library.xlsx — three sheets. The resource tables replicate the turn-19 tables, with an extra flag column ("Key starting point?" — Yes for bSDD, IFC schema, Uniclass Pr, Revit/ArchiCAD default libraries; "Key starting point for BiH?" — Yes for GN norm books and real predmjeri from local firms/tenders). Additional content written into the file beyond the turn-19 prose:

Sheet "Naming dictionary" — subtitle: "Official resources are a starting point; nothing official covers local BCS terms or office abbreviations." Layer table:

| Layer | What it holds | Example |
|---|---|---|
| 1. Project | One-off names used only in this model | A typo-ed type name in one file |
| 2. Company | The office's own naming habits | "Z-25" = their 25 cm wall type |
| 3. Global | The dictionary you ship, seeded from bSDD, Uniclass, Revit defaults and local synonyms | BETON / MB30 / C25/30 -> concrete |

Note: Review answers ("CT = cement screed") are saved to project or company level; over time the questions dry up.

Sheet "Item library" — subtitle: "DACH has strong official libraries; UK/US rely on commercial ones; ex-YU has nothing modern or official." Layer table:

| Layer | What it holds | Why |
|---|---|---|
| 1. Client template | Items imported from the tender's Excel predmjer; model elements matched to them | Public tenders force the client's exact wording and numbering |
| 2. Company library | The firm's own items, e.g. built by importing old predmjeri | Every firm words and splits items its own way |
| 3. Base library | The one you ship, per rulebook preset | Gives a usable default out of the box |

Note: Key feature: import an existing Excel predmjer as a template - that is how BiH firms actually work (start from a previous bill and edit it).

Sheet "Summary" — "Same pattern for both: official start + company layer + project/client layer."

| | Naming dictionary (3) | Item library (4) |
|---|---|---|
| Official starting point | Decent and free: bSDD + Uniclass + IFC | Strong in DACH (STLB-Bau, LB-HB, NPK); commercial in UK/US; none for ex-YU |
| Local (BCS) coverage | None official - must be built | None official - collect from tenders + GN norms |
| User layers needed | Project + Company | Client template + Company |
| How it grows | Review-queue answers saved back | Imported predmjeri become templates |

### Turn 22 (user)

do not focus on bosnian serbian croatian, it was an example but this whole thing is international

ultimately, point 5 and 6 basically are just human review layer, correct?

### Turn 23 (assistant)

Understood, I'll keep it international from here on.

On your question: not quite. Point 5 is only partly human review, and point 6 isn't human review in the same sense at all.

## Point 5: missing or broken data in the model

This splits into four different cases, and only one of them is human review:

| Case | Example from the duplex file | Who fixes it |
|---|---|---|
| **Broken export** | Wall with flipped faces giving 433 m³ instead of 25.8 m³ | **Engine, automatically.** Known exporter quirks get repair rules, collected by testing many files from different software. |
| **Missing, but derivable** | Worktop length isn't reported, but the worktop's 3D shape is there, so the length can be measured from it | **Engine, automatically**, with the derivation noted |
| **Missing, needs a decision** | Footings have no material assigned | **Human review**, or an accepted default ("assume from type name") that gets logged |
| **Simply not in the model** | No reinforcement, no plumbing or electrical | **Nobody.** It needs another model or manual input, or it's marked out of scope. |

So the review layer only handles the third case. The first two are engineering work, and the fourth is a scope statement.

## Point 6: the answer key

This is not something that happens on each run. It's **testing the engine itself**, done during development:

1. Take a set of IFC files that professionals have already measured by hand under a known rulebook.
2. Run the engine on them with the same settings.
3. Compare line by line, find where they differ and why, and fix the rules.

You do this once per rulebook preset, and again whenever you change the engine. The end user never sees it. It's what lets you say "this preset matches professional output within X%".

The everyday version of point 6 is user corrections. When users regularly change a certain quantity after generation, that tells you a rule is wrong. But that's feedback into point 6, not a replacement for it.

## So the overall picture

- **Human review layer (per file, by the user):** unknown names (3), unmatched items (4), and missing data that needs a decision (part of 5).
- **Engine work (by you):** export repairs and derivations (rest of 5).
- **Validation (by you, before release):** the answer key (6).

### Turn 24 (user)

having all 6 points, plus your logic/script to parse the data, would that actually allow for a highly dynamic ifc->boq tool?

are there remaining gaps or missing 'parts' to make it work?

### Turn 25 (assistant)

Yes. Those six points plus the parsing logic are the core of a highly dynamic tool, because every rule lives in data rather than code. But there are a few more parts, some needed to make it work at all and some needed for people to actually use it in real projects.

## Missing parts that affect whether it works

**1. Input requirements check.** Not every IFC is good enough to produce a BoQ. You need a defined minimum ("walls must have materials, doors must have sizes…") and an automatic check against it before anything runs. There's an official format for this: **IDS** (Information Delivery Specification, from buildingSMART). It's a machine-readable list of what an IFC must contain. Each rulebook preset could ship with its own IDS.

**2. Multiple models at once.** Real projects usually have separate files for architecture, structure and installations, and they overlap. The architect models a concrete wall, and the structural engineer models the same wall again. Without rules for which model owns which elements, you count things twice. Your duplex was a single file, so this never came up.

**3. Derived items: quantities for things not modelled.** Much of a real BoQ isn't in the model as objects: excavation, formwork, reinforcement (often estimated as kg per m³ of concrete), skirtings, paint, waterproofing. I did a few of these by hand (formwork, paint). A real tool needs a proper rules system for "if this exists, generate that item with this formula". This is where most of a quantity surveyor's judgement lives.

**4. IFC version differences.** IFC2x3, IFC4 and IFC4.3 store some things differently, for example how quantities and materials are attached. The parser has to handle all of them, not just the one this file used.

## Missing parts that affect whether people trust and use it

**5. Traceability with a 3D viewer.** Click a BoQ line and see the elements behind it highlighted in 3D, or click a wall and see which lines it feeds. Without this, nobody will trust the numbers. Open-source web IFC viewers already exist (web-ifc / That Open Engine, xeokit), so this is UI work, not research.

**6. Model revisions.** Models change weekly. You need to re-run on version 2 and show what changed against version 1, while keeping every decision the user already made, matched by element ID. Otherwise users re-answer the same review questions on every update.

**7. Rule editor.** Presets will be maintained by quantity surveyors, not programmers. They need a way to edit rules, test them on a sample file, and version them.

**8. Location breakdown.** Besides grouping by element or trade, BoQs are often split by building, floor, zone or apartment. It's another switchable view, but the engine has to keep each element's location attached.

**9. Export and integration.** Excel covers most cases, but some markets expect standard exchange formats (GAEB in Germany, IFC cost schedules, CSV for estimating software). Users will also want to attach prices next, which is a separate step after the BoQ but an expected one.

## Not technical, but real

**10. Responsibility.** A BoQ goes into contracts and tenders, so a qualified person has to sign it off. The tool should present itself as producing a draft that a professional checks and approves. The audit trail from points 5 and 6 is what makes that sign-off practical.

## Priority

The critical ones are **1, 2 and 3**. Without them you either can't trust the input, count things twice, or miss a big part of the bill. Then **5 and 6**, without which nobody adopts it day to day. The rest (4, 7, 8, 9) are needed, but they're normal product work.

### Turn 26 (user)

Create a word document covering the 6 points you mentioned first (answering my gaps question)
then create a word document covering these remaining gaps

### Turn 27 (assistant)

I made both Word documents:

- **IFC_BoQ_Six_Knowledge_Gaps.docx** (5 pages) covers the six gaps, each with the international resource tables, the user layers, the four cases of missing data, and the answer-key process. It ends with a summary of who handles what.
- **IFC_BoQ_Remaining_Gaps.docx** (3 pages) covers the ten further parts. Each one has three short sections: what it is, why it matters, and how to address it. It ends with the priority ranking.

Both are written for an international audience. Regional norms such as the ex-Yugoslav ones appear only as one example row, not as the focus.

Files created: IFC_BoQ_Six_Knowledge_Gaps.docx (5 pages, A4, Arial, purple accent #3B2A6B) and IFC_BoQ_Remaining_Gaps.docx (3 pages) — generated with docx-js, rendered to PDF to check layout. Both were rewritten for an international audience, so their text differs from the earlier chat answers. Full text content of each document follows.

#### Document 1: IFC_BoQ_Six_Knowledge_Gaps.docx

**Title:** IFC to BoQ: The Six Knowledge Gaps
**Subtitle:** What a dynamic IFC-to-BoQ tool needs beyond parsing, what exists internationally, and who fills each gap

Reading an IFC file and measuring its geometry is a solved technical problem: open-source tools parse every element, compute volumes and areas, and verify what the authoring software claims. The gaps that remain are mostly knowledge, not code. This document describes the six pieces of knowledge an IFC-to-BoQ tool needs, what exists for each internationally, and who has to supply what is missing.

| # | Gap | What it controls | Who fills it |
|---|---|---|---|
| 1 | Measurement rulebooks | How quantities are calculated (changes the numbers) | Domain expert translating standards into settings |
| 2 | Classification systems | Labels and codes (never changes numbers) | Download and load existing code lists |
| 3 | Naming dictionary | Recognising what each element actually is | Seeded from public sources, grown by users |
| 4 | Item library | Turning a recognised element into a BoQ line | Seeded per standard, extended by companies and clients |
| 5 | Missing or broken model data | Whether the input can support the output | Mostly the engine; partly the user |
| 6 | Answer key | Proof that the output is correct | Developer, against professionally measured projects |

**1. Measurement rulebooks**

A rulebook (method of measurement) decides the unit for each kind of work, what is deducted (for example, openings below a certain size), what each item includes (for example, whether formwork is separate from concrete), which face or centreline is measured, and rounding. Applying a different rulebook to the same file produces different numbers.

| Rulebook | Region | Used for | Access | Realistic pick? |
|---|---|---|---|---|
| NRM2 (RICS) | UK, Commonwealth, Middle East | Detailed BoQs for building works; main UK standard | Paid | Yes – international reference |
| NRM1 (RICS) | UK | Early cost estimates by building element | Paid | No |
| SMM7 | UK (legacy) | Older detailed method, replaced by NRM2 | Paid | No |
| CESMM4 (ICE) | UK | Civil engineering works, not buildings | Paid | No |
| VOB Part C (DIN 18299 + trade parts) | Germany | Trade-specific measurement rules; Central European reference | Paid | Yes – DACH markets |
| ÖNORM B 22xx series | Austria | Trade contract standards incl. measurement (verify details) | Paid | No |
| CIQS Method of Measurement | Canada | Canadian measurement method | Paid | No |
| No single standard | USA | Firm practice; organised by MasterFormat | – | No |
| Regional legacy norms (e.g. ex-Yugoslav GN norms) | Various | Older national norms still referenced in contracts | Scattered | No |
| "As modelled" | Anywhere | Net quantities straight from the model, no standard applied | – | Yes – default base |
| Client / tender template | Anywhere | Client dictates rules and format; common in public procurement | From client | Yes – always needed |

> **The real gap:** none of these rulebooks exist in machine-readable form. They are prose documents. Someone with quantity-surveying expertise has to translate each one into parameters, for example "deduct openings larger than X m²", "masonry thicker than Y in m³", "formwork measured separately: yes". A rulebook preset is a bundle of dozens of such parameters, which users can then adjust.

**2. Classification systems**

A classification system assigns codes and names to items and decides which bucket they fall in. It never changes a quantity. Classifications are independent of rulebooks: you can measure under one standard and label with another country's codes.

| System | Region | Organised by | Access | Realistic pick? |
|---|---|---|---|---|
| Uniclass 2015 (NBS) | UK | Multiple tables: elements, systems, products, spaces | Free | Yes – well documented |
| NRM1 element groups | UK | Building parts (substructure, frame, roof…) | Paid (in NRM1) | No |
| ICMS | International | Cost reporting across countries and project types | Free | Yes – neutral international |
| OmniClass | North America | 15 tables (spaces, elements, work results, products) | Free | Yes – North America |
| UniFormat (CSI / ASTM UniFormat II) | North America | Building elements, for early estimates | Paid | No |
| MasterFormat (CSI) | North America | Trades / work results, 50 divisions | Paid | Yes – US bids and specs |
| DIN 276 | Germany / DACH | Cost groups 100–800 | Paid | Yes – DACH markets |
| CCI / CoClass | Nordics, growing | Modern, object-based, BIM-oriented | Mostly free | No |
| National trade-section conventions | Many countries | Chapters by type of work, without an official code list | Convention | No |
| IFC classes + bSDD | International | Shared language other systems map onto | Free | No (internal) |

> **Gap size:** small. These are code lists that can be downloaded, loaded and mapped once.

**3. Naming dictionary**

Element and material names in IFC are free text. The same material may appear as "Concrete", "Concrete - Cast In Situ", "BETON", "C25/30" or an office abbreviation. The naming dictionary turns all of these into one meaning.

*What exists*

| Resource | What it is | Official? | Access | Key start? |
|---|---|---|---|---|
| bSDD (buildingSMART Data Dictionary) | Multilingual dictionary of building concepts and properties; hosts classifications | Yes – buildingSMART | Free, API | Yes |
| IFC schema (ISO 16739) | Standard element types with definitions | Yes | Free | Yes |
| ISO 12006-3 | Framework behind bSDD | Yes | Paid | No |
| Uniclass Pr (Products) table | Generic product and material names with codes | Yes – NBS | Free | Yes |
| ÖKOBAUDAT | German government material database (German/English, densities) | Yes | Free | No |
| ETIM / ECLASS | Product classification for technical products (mainly MEP) | Industry | ETIM free / ECLASS paid | No |
| IATE | EU multilingual terminology database | Yes – EU | Free | No |
| Revit / ArchiCAD default libraries | Default type and material names | De facto | With software | Yes |
| Manufacturer catalogues / BIMobject | Brand names mapped to products | No | Mostly free | No |

**What exists nowhere:** local-language trade terms, brand-to-generic mappings at full coverage, and office-specific abbreviations and codes.

*How names get resolved*
1. Exact match in the dictionary.
2. Known aliases, synonyms and translations.
3. Contextual evidence: IFC class, layer structure and thicknesses, common property sets (IsExternal, LoadBearing), classification references, material properties, position and host. An AI model can propose a match with a confidence score.
4. Below the confidence threshold: send to human review. Never guess silently for anything that affects cost.

*Do users need their own?*
Yes, always. The dictionary works in three layers, checked from most specific to most general:
- **Project:** one-off names used only in this model.
- **Company:** the office's naming habits, e.g. "Z-25" means their 25 cm wall type.
- **Global:** the dictionary shipped with the tool, seeded from bSDD, Uniclass, IFC and authoring-tool defaults.

Each review answer is saved to project or company level, so repeated questions disappear over time.

**4. Item library**

Once an element is recognised (for example, "190 mm concrete block wall"), the item library supplies the BoQ line: standard description text, unit, and which quantity to use, for each rulebook and language.

| Resource | Region | What it is | Official? | Access |
|---|---|---|---|---|
| STLB-Bau | Germany | Standard item descriptions tied to VOB/C | Yes (DIN/GAEB) | Paid |
| GAEB | Germany | Standard BoQ exchange file format | Yes | Spec available |
| LB-HB (Leistungsbeschreibung Hochbau) | Austria | Standardised item library for building works | Yes | Free |
| ÖNORM A 2063 | Austria | BoQ exchange format | Yes | Paid |
| NPK (Normpositionen-Katalog) | Switzerland | Standard item catalogue | Yes (CRB) | Paid |
| NRM2 | UK | Rules for structuring item descriptions; not a ready library | Yes (RICS) | Paid |
| Commercial QS libraries (CostX, NBS-based) | UK | Ready-made item libraries | No | Paid |
| RSMeans | USA | Line items with descriptions, units, unit costs | De facto | Paid |
| Regional norm books | Various | Legacy descriptions of work types with labour/material norms | Legacy | Scattered |
| Published tender BoQs | Anywhere | Real wording in current use; public procurement portals | No | Often free |
| IfcCostSchedule / IfcCostItem | International | Storing a BoQ inside IFC | Yes (IFC) | Free |

Coverage is strong in German-speaking countries, commercial in the UK and US, and thin or absent in many other markets, where published tender BoQs are the most practical source.

*Do users need their own?*
Even more than for names, because firms word and split items differently and tenders impose the client's exact format. Three layers:
- **Client template:** items imported from the tender's BoQ spreadsheet; model elements are matched to them.
- **Company library:** the firm's own items, typically built by importing past BoQs.
- **Base library:** shipped per rulebook preset.

> **Key feature:** importing an existing BoQ spreadsheet as a template. That is how most firms actually work: they start from a previous bill and edit it.

**5. Missing or broken model data**

Not every problem in the input is a question for the user. Four distinct cases exist:

| Case | Example (Duplex test file) | Handled by |
|---|---|---|
| Broken export | A wall exported with flipped faces measured 433 m³ instead of 25.8 m³ | Engine, automatically. Repair rules for known exporter quirks, collected by testing many files. |
| Missing but derivable | Worktop length not reported, but its 3D shape is present | Engine, automatically, with the derivation noted. |
| Missing, needs a decision | Footings have no material assigned | Human review, or an accepted default that is logged. |
| Simply not in the model | No reinforcement, no plumbing or electrical | Nobody. Needs another model, manual input, or an out-of-scope statement. |

Only the third case belongs in the per-file review layer. The first two are engineering work; the fourth is a scope statement.

**6. Answer key**

Checking output against the file proves internal consistency. It does not prove the output matches what a professional would produce. That needs reference projects: IFC files that qualified quantity surveyors have measured by hand under a known rulebook.
1. Collect reference projects with both the IFC and a professionally measured BoQ.
2. Run the engine with the same rulebook and settings.
3. Compare line by line; explain every difference; fix rules.
4. Repeat for each rulebook preset and after every engine change.

This is development-time validation, invisible to end users. It allows a claim such as "this preset matches professional output within X%". In production, recurring user corrections to the same quantity signal a faulty rule and feed back into this process.

**Summary: who handles what**

| Responsibility | Covers |
|---|---|
| Per-file human review (end user) | Unknown names (3), unmatched items (4), missing data needing a decision (part of 5) |
| Engine work (developer) | Export repairs and derivations (rest of 5), dictionary and library infrastructure |
| Validation (developer, before release) | Answer key (6) |
| Domain expertise (quantity surveyor) | Translating rulebooks into presets (1), seeding item libraries (4) |
| Load once | Classification code lists (2), public dictionary seeds (3) |

#### Document 2: IFC_BoQ_Remaining_Gaps.docx

**Title:** IFC to BoQ: Remaining Gaps
**Subtitle:** The parts still needed beyond the six knowledge gaps to build a working, trusted tool

The six knowledge gaps plus the parsing and verification logic form the core of a highly dynamic IFC-to-BoQ tool, because every rule lives in data rather than code. Ten further parts are needed: four to make it work at all, five for people to trust and use it on real projects, and one that is not technical.

| # | Part | Category | Priority |
|---|---|---|---|
| 1 | Input requirements check (IDS) | Makes it work | Critical |
| 2 | Multiple models at once | Makes it work | Critical |
| 3 | Derived items rules | Makes it work | Critical |
| 4 | IFC version differences | Makes it work | Needed |
| 5 | Traceability with a 3D viewer | Trust and adoption | High |
| 6 | Model revisions and change tracking | Trust and adoption | High |
| 7 | Rule editor for experts | Trust and adoption | Needed |
| 8 | Location breakdown | Trust and adoption | Needed |
| 9 | Export and integration | Trust and adoption | Needed |
| 10 | Professional responsibility | Non-technical | Needed |

**Parts that affect whether it works**

*1. Input requirements check*
- What it is: A defined minimum the IFC must meet before a BoQ can be produced (walls must have materials, doors must have sizes, and so on), checked automatically before anything runs.
- Why it matters: Not every IFC is good enough. Without a gate, poor models produce confident-looking but wrong bills.
- How to address it: Use IDS (Information Delivery Specification), the machine-readable buildingSMART standard for stating what an IFC must contain. Each rulebook preset ships with its own IDS; the pre-flight check runs it and reports failures alongside the review questions.

*2. Multiple models at once*
- What it is: Real projects split the building into separate files for architecture, structure and installations (federated models).
- Why it matters: Models overlap: the architect and the structural engineer often both model the same concrete wall. Without ownership rules, elements are counted twice.
- How to address it: Define discipline ownership rules (e.g. load-bearing concrete belongs to the structural model), detect cross-model duplicates using the same solid-overlap checks used inside a single file, and report conflicts for review.

*3. Derived items rules*
- What it is: Quantities for work that is not modelled as objects: excavation, formwork, reinforcement (often estimated as kg per m³ of concrete), skirtings, paint, waterproofing.
- Why it matters: A large share of a real BoQ is derived rather than modelled. This is where most of a quantity surveyor's judgement lives.
- How to address it: A rules system of the form "if this exists, generate that item with this formula", with formulas and factors as editable parameters per preset. Every derived line is marked as derived and shows its formula.

*4. IFC version differences*
- What it is: IFC2x3, IFC4 and IFC4.3 store some information differently, including how quantities and materials are attached.
- Why it matters: A parser tested on one version silently loses data on another.
- How to address it: Normalise every version into the same internal record during extraction, and keep test files for each version in the test suite.

**Parts that affect whether people trust and use it**

*5. Traceability with a 3D viewer*
- What it is: Click a BoQ line to see the elements behind it highlighted in 3D; click an element to see which lines it feeds.
- Why it matters: Professionals do not trust numbers they cannot trace. This is the single strongest adoption feature.
- How to address it: Keep the element-to-line links already present in the register; build the viewer on existing open-source web IFC viewers (web-ifc / That Open Engine, xeokit). This is UI work, not research.

*6. Model revisions and change tracking*
- What it is: Re-running the tool on a new version of the model and showing what changed against the previous one.
- Why it matters: Models change weekly. Without this, users re-answer the same review questions on every update and cannot see the cost impact of design changes.
- How to address it: Match elements across versions by their permanent IFC identifier (GlobalId), carry over all user decisions, and produce a change report: added, removed, and changed quantities per BoQ line.

*7. Rule editor for experts*
- What it is: An interface for maintaining rulebook presets, derived-item rules and libraries.
- Why it matters: Presets are maintained by quantity surveyors, not programmers. If every rule change needs a developer, the tool cannot scale across standards.
- How to address it: Form-based editing of parameters and formulas, a test run against a sample model before publishing, and versioning so any BoQ records which rule version produced it.

*8. Location breakdown*
- What it is: Splitting the BoQ by building, floor, zone or unit, in addition to grouping by element or trade.
- Why it matters: Phased construction, multi-building sites and unit-level costing all require it.
- How to address it: Keep each element's spatial location (from IFC storeys, spaces and zones) attached through the pipeline, and expose location as another switchable view axis.

*9. Export and integration*
- What it is: Output formats beyond the spreadsheet, and the next step users expect: pricing.
- Why it matters: Some markets and software expect standard exchange formats; users will want to attach rates once quantities exist.
- How to address it: Spreadsheet export first; then standard formats where markets require them (GAEB, ÖNORM A 2063, IFC cost schedules, CSV for estimating software). Keep pricing a separate step that reads the BoQ.

**Non-technical**

*10. Professional responsibility*
- What it is: A BoQ is used in contracts and tenders, so a qualified person must sign it off.
- Why it matters: Liability sits with the professional, not the software. Presenting output as final invites risk and erodes trust.
- How to address it: Position the output as a draft for professional approval. The audit trail (sources, assumptions, review decisions, rule versions) is what makes sign-off fast and defensible.

**Priority**
- **Critical: 1, 2, 3.** Without them the tool cannot trust its input, counts elements twice, or misses a large part of the bill.
- **High: 5, 6.** Without them nobody adopts it for daily work.
- **Needed: 4, 7, 8, 9, 10.** Normal product work, required before a commercial release.

### Turn 28 (user)

Can these gaps be solved?

### Turn 29 (assistant)

Yes, almost all of them can be solved. But they're solved in different ways, and a few can only ever be solved partly. Here's an honest sort of all sixteen.

## Solvable with engineering alone

You can build these yourself, and nothing about them is unknown.

- **IFC versions (R4), export repairs and derivations (part of 5):** solid open-source tooling exists (ifcopenshell). It just takes testing on many files.
- **Input check (R1):** IDS is already a published standard with existing validators.
- **3D viewer (R5):** open-source web viewers exist, so this is UI work.
- **Revisions (R6), location breakdown (R8), export (R9), rule editor (R7):** normal product engineering.
- **Classifications (2):** download the lists and map them once.

## Solvable, but needs outside input (expertise, data or money)

The technical part is easy here. The bottleneck is getting the right people or material.

- **Rulebooks (1):** needs a quantity surveyor per standard to translate it into settings. One more thing to check: standards like NRM2 or VOB are copyrighted. Encoding their *rules* as parameters is different from copying their *text*, but I'm not a lawyer, so that's worth a proper legal check per standard.
- **Item libraries (4):** some are free (Austria's LB-HB), some can be licensed (STLB-Bau, NPK), and elsewhere you build them from published tender BoQs.
- **Answer key (6):** you need real projects where you have both the IFC and a professional's hand-measured BoQ. That's a data-access problem. You get it through partnerships with firms, not by coding.
- **Multiple models (R2):** the technique (overlap detection) is the same one I already used. The ownership rules need expert input, though, and every project's model setup differs.

## Only partly solvable, ever

These improve over time, but they never reach 100%.

- **Naming dictionary (3):** new names, brands and abbreviations appear constantly. With the layered setup and saved review answers, the questions become rare, but they never disappear.
- **Derived items (R3):** reinforcement estimates, excavation and waste involve professional judgement. You can encode the common cases. Unusual projects will always need a human.
- **Missing data that isn't in the model (part of 5):** if a model has no reinforcement, no software can produce real reinforcement quantities. The only real fix is better models, which is outside your control.
- **Professional responsibility (R10):** this is permanent by design. The tool speeds up the professional's work; it doesn't replace their signature.

## The real constraints

None of these gaps needs a technical breakthrough. Commercial tools such as CostX and RIB iTWO already do model-based quantity takeoff, which proves the core is achievable. What actually limits a project like this:

1. **Domain expertise:** someone who knows each measurement standard deeply.
2. **Reference data:** real projects to validate against.
3. **Input quality:** you depend on how well other people model their buildings.
4. **Licensing:** for standards and item libraries.

The flexible part, where any rulebook, classification and template can be switched in as settings, is exactly where existing tools tend to be rigid. So it's solvable, and the hardest parts are about access to people and data, not code.

(Note: "sixteen" = the six knowledge gaps (1–6) plus the ten remaining parts, referred to as R1–R10.)

### Turn 30 (user)

resolving them all - would that make a fully functionable platform?

