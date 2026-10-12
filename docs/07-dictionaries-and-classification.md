# 07 Dictionaries and classification

Inputs (4) and (3) of `getBoq`. Types: `packages/types/src/dictionary.ts` and
`classification.ts` (their header comments explain the design). Engine: `engine/ifc_boq/names.py`
and `classify.py`.

Order of use: models -> **dictionaries** (names cleaned) -> rules (lines) -> **classifications**
(codes on lines). The dictionary is input 4 but runs second, because rules match on clean terms.

## Dictionaries: messy names to terms

IFC names are free text: "BETON MB30", "C25/30", "Concrete - Cast In Situ", "Gipsana ploča",
"Z-25", "CT". A dictionary turns them into canonical **terms** (`concrete.in_situ`,
`board.plasterboard`, `acme.wall.z25`). Rules and maps then match on terms, so one rule set
works on any model, from any office, in any language.

### Names in a model (normal way in)

A dictionary is normally edited from a loaded model, in the Library's "Names in the model" tab: every
distinct material, layer material and type name in the IFC, how many elements use it and on which
classes, what it currently means and which dictionary entry says so (layer and match method), and
what extractors read from it. Giving a name a term is a pick from the vocabulary; several names can
be given one term at once, as exact names or as one "starts with" entry when they share a prefix,
optionally "only on" their IFC classes (writes a `when` condition). Names a BoQ run would ask about
(`askFor` in the resolution settings) are marked "worth answering". Resolution is done by the engine
(`pipeline.names_in_model`, `POST /api/models/{modelId}/names`, which accepts unsaved draft
dictionaries); the browser only writes entries. The Entries tab remains for regex and expressions.

### Building blocks

| Block | What it is | Example |
|---|---|---|
| `Term` | Canonical vocabulary with a hierarchy (`broader`), category, labels per locale, properties (e.g. density), references to external systems (bSDD URI, Uniclass Pr code) | `concrete.in_situ` (broader `concrete`, category material) |
| `DictionaryEntry` | Raw text -> term. `field` (material, layer_material, type_name, name, object_type, ifc_class, predefined_type, system, space_name, props.*), `match` (exact, startsWith, contains, regex), optional `when` context condition, `confidence`, `source` (seed, user, import, ai_confirmed), who and when | `{"field": "type_name", "match": {"regex": "^Z-?25\\b"}, "term": "acme.wall.z25"}` |
| `Extractor` | Pulls structured values out of names: Revit "Family:Type:Id", thickness hints ("25 cm"), strength classes ("C30/37", "MB30"), steel profiles, pipe sizes (DN50). Outputs can themselves be looked up as terms | `revit-name`, `thickness-cm`, `strength-class`, `steel-profile`, `pipe-dn` |

Term categories: `material`, `product` (brick, plasterboard sheet, window unit), `element_type`
(party wall, partition, curtain wall), `space` (bathroom, kitchen), `system` (MEP), `other`.
The hierarchy is what makes `material under "concrete"` match `concrete.in_situ` and
`concrete.screed`.

### Layers and resolution

```
decision (this project's answers) -> project -> company -> global
within a layer: exact -> startsWith -> regex -> contains
first match wins; case and accents folded; `when` conditions can make the same text mean different things by context
```

| Layer | Holds | Who writes it |
|---|---|---|
| global | Shipped seed: authoring-tool defaults (Revit material and type names), common synonyms in several languages | Product team |
| company | The office's habits and codes ("Z-25" is our 25 cm wall; "CT" on coverings is ceramic tile) | Company rules editors; promoted answers |
| project | One-off names in this model ("Roofing - Barrier"; "CT" on slabs is a screed) | Estimators; answers |
| decision | Answers to `unknown_name` questions in this run | Generated from decisions |

`ResolutionSettings` (`presets/settings/resolution.json`): layer order, match order,
`unresolved` (ask, flag, keep_raw) and `askFor`, which limits questions to names that matter
(materials, layer materials, space names, and type names of walls, coverings and proxies; a door's
type name rarely needs a term). A name question is **blocking** only when `unresolved` is "ask"
and the field is referenced by the current rules or maps. The settings also carry an `ai` block
(suggestion thresholds); **AI suggestions are not implemented** yet.

Planned behaviour around answers (D18): an estimator's answer is saved at project level; with
permission it can be promoted to the company layer, and the question then never appears on any
project. In the dev build, answers live in the browser session and are sent with each run.

### Presets

| File | Layer | Content |
|---|---|---|
| `global-seed.json` | global | 46 terms (28 materials, 7 spaces, 6 element types, 5 products), 45 entries (Revit defaults plus multilingual synonyms), 6 extractors |
| `acme-company.json` | company | An office code (Z-25), "CT" on coverings, a brick brand family, a regional screed name |
| `project-duplex.json` | project | "Roofing - Barrier" and "CT" on slabs, as if answered by an estimator |

Tested results: on the Duplex every material resolves (18 Revit defaults from the global seed,
"Roofing - Barrier" from the project layer); the only open name questions are genuine ones (a
roof space called "Roof" and the stair space mislabelled "Room"). Of 26 messy multilingual names
("BETON MB30", "Gipsana ploča", "Ytong 25cm", "Stahl S355", "Kupatilo", "Porotherm"), all expected
ones resolve, strength classes and profiles are extracted, and "CT" resolves differently on
coverings and slabs and stays a question on walls.

### Public sources for growing the global layer

bSDD (free, API, multilingual), the IFC schema, Uniclass Pr (products), ÖKOBAUDAT (materials with
densities), ETIM (free) / ECLASS (paid) for MEP products, IATE (EU terminology), authoring-tool
default libraries, manufacturer catalogues. Missing everywhere: local-language trade terms, full
brand-to-generic coverage, office abbreviations. Users always need their own layers. More in 08.

## Classification: codes on lines

Classification **only labels lines**. It never changes a quantity (D14). Two separate things:

| Shape | What it is |
|---|---|
| `CodeList` | The codes: `code`, `title`, `parent`, level, translations, deprecated flag; plus list metadata: kind (official, company, client, other), publisher, version, licence (with a `redistributable` flag), level names, separator. Loaded once, shared. |
| `ClassificationMap` | Which code each BoQ line gets from one code list. Written by you, a company, or imported from a tender. Can `extends` another map and `remove` rules. |

`getBoq` takes any number of `{ codeList, map }` pairs, so one line can carry a Uniclass code, a
company code and a client's tender position at once. The UI groups the sheet by the **first**
ticked system; the Excel Lines sheet shows all.

### The table: codes per line kind (normal way in)

A map is normally edited as a table in the Library ("Codes per line"): one row per kind of BoQ line,
taken from a rule set (by default the master template, whose rule ids every standard built on it
shares), and a code picked from the code list for each row. Derived rows can take "same as its
source line". A row can be **split** by a fixed choice: inside / outside, material, or element type
(material and element-type values are dictionary terms), each value with its own code plus an
"everything else" code. "Suggest codes" proposes codes for empty rows by matching words of the line
name to code titles; the user accepts them.

The table reads and writes ordinary map rules, so the engine is unchanged (`ClassTable.tsx`):

| Row | Map rule written | Priority |
|---|---|---|
| plain | `{ "id": "t-walls", "match": { "ruleId": "walls" }, "code": "D.01" }` | 5 |
| split value | `{ "id": "t-walls-true", "match": { "all": [ { "ruleId": "walls" }, { "where": "is_external = true" } ] }, "code": "D.01" }` (also `UNDER(material, "concrete")`, `UNDER(element_type, "wall.party")`) | 6 |

Table rules are put first and given priority 5 and 6, so they win over older or hand-written
("advanced") rules, which keep applying to anything the table does not code. More specific terms are
written first so they win ties ("Concrete block" before "Masonry"). Split values read the line's most
common material or element type; a line that mixes them gets the existing `mixed_line` warning. Tested
in `test_classification_table_shape` (`test_duplex.py`).

### Map rules (advanced)

```json
{ "id": "drywall", "match": { "where": "ifc_class = \"IfcWall\" AND (UNDER(element_type, \"wall.partition\") OR UNDER(element_type, \"wall.lining\"))" },
  "code": "03", "priority": 1 }
```

| Part | Options |
|---|---|
| `match` (`LineMatch`) | `ruleId`, `tag`, `manualKind`, `where` (expression over line fields), `all` / `any` / `not` |
| Line fields for `where` | rule_id, rule_kind, manual_kind, tags, unit, source, family, ifc_class, predefined_type, material, element_type, storey, storey_elevation, and `keys.<lineKey field>` |
| `code` (`CodeTarget`) | a fixed code; `{ lookup: "material", table: {...}, default }`; or `{ fromSource: true }` (derived lines such as formwork take their source line's code) |
| `priority` | highest wins; ties go to the first, or become a `classification_conflict` question with `onConflict: "ask"` |
| map-level `sources` | order of evidence: `decision` (answers to `unclassified` questions), `ifc` (classification references already in the IFC, for named systems), `map` |
| map-level `onUnmapped` | `flag` (no code), `ask` (non-blocking `unclassified` question), or `{ code }` default |

A line can contain elements whose fields differ (party and external walls in one line because
they share a type). Fields like that hold the most common value, and the engine warns
(`mixed_line`) when a map rule depends on a mixed field. The fix is to add that field to the
rule's `lineKey` so the line splits. The engine also warns when a map emits a code that is not in
the code list.

### Presets

| Preset | Code list | Map |
|---|---|---|
| `acme-cost-codes` | An invented company list, 40 codes, two levels (A Preliminaries, B Substructure, C Frame, D Walls, E Openings, ...; items like B.01 Foundations, D.02 Internal walls and partitions) | 29 rules, mostly by rule id and terms; `onUnmapped: "ask"`. Classifies the party wall as internal by its dictionary type although the IFC says `IsExternal = TRUE`. |
| `demo-trades` | 10 trade sections: 00 Preliminaries, 01 Concrete works, 02 Masonry, 03 Drywall and partitions, 04 Carpentry and joinery, 05 Steelwork and metalwork, 06 Finishes, 07 Roofing, 08 Furniture, 99 Other | 10 rules by material term and IFC class rather than rule id, so it works with any rule set; unmapped lines go to 99 |
| `uniclass2015-ef` | **Not committed.** `npm run import:uniclass` downloads the Elements/functions table from a community CSV mirror (github.com/buildig/uniclass-2015) and converts it with `engine/scripts/import_codelist.py`. Production should load NBS's current release under NBS terms. | 15 rules; sources include `ifc` for files that already carry Uniclass references. On the Duplex 64 of 68 line skeletons got an EF code; the 4 without are preliminaries and sums, which EF does not cover. |

Import a code list in the Library (Code list tab, "Import from Excel or CSV"): choose a .xlsx, .csv,
.tsv or .txt file, see it, and pick the sheet, header row, code / title / description columns, where
the hierarchy comes from (separator in the codes, a parent-code column, a level column, or none) and
which other columns to keep as `extra`. The engine guesses all of these (local-language headers,
title blocks above the header, `;` delimiters, legacy encodings), builds the codes and reports
duplicates, missing parents and empty titles; the import adds to or replaces the list.
Engine: `ifc_boq/codelist_import.py` (`read_table`, `build_codes`; tested in `test_codelist_import.py`),
`POST /api/codelists/read` and `/build`. Old .xls files are not read (save as .xlsx).

Command line, for published lists: `python engine/scripts/import_codelist.py table.csv out.json --preset uniclass --id ... --name ...`
(see the script's `--help` for column options).

## Choosing a code list for a market (summary of 08)

Free and product-friendly: Uniclass 2015 (UK, 12 tables, API), ICMS 3 (international cost
reporting), CCI (CC BY 4.0; Czechia, Slovakia, Estonia and others), bSDD (hosts several).
Licence required for software use: MasterFormat, UniFormat, OmniClass (CSI). Paid: DIN 276
(Germany), UniFormat II (ASTM). Company and client lists are user data. Regional conventions
without a published code list (for example trade sections used across former Yugoslavia) are
written as company lists.
