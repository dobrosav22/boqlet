# 04 Types and contracts

`packages/types/src` is the single source of truth for every shape that crosses a boundary:
between presets and the engine, between the engine and the UI, and later between the engine and
the Java backend. Each file opens with a long header comment explaining its design; read those
alongside this page.

## Files

| File | Main exports | Role |
|---|---|---|
| `rules.ts` | `OurRuleType = RuleSet \| RuleSetPatch`, `Param`, `Value<T>`, `Selector`, `QuantitySpec`, `DeductionRule`, `ItemRule`, `DerivedRule`, `ManualItem`, `Breakdown`, `OnMissing`, `Band`, `Rounding` | Input (2): the universal rule set. See `06-rules-authoring.md`. |
| `measured.ts` | `MeasuredElement`, `MeasuredField`, `Opening`, `Layer`, `Face`, `Unit`, `Provenance` | The engine's contract with rules: everything measured per element. Rules can only use these fields. |
| `families.ts` | `ElementFamily`, `IFC_FAMILIES`, `FAMILY_INFO` | Every IFC2x3 / IFC4 / IFC4.3 element class mapped to one of 8 measurement families, with the quantity kinds that make sense for each. |
| `parsed.ts` | `ParsedModel`, `ParsedElement`, `Header`, `SpatialNode`, `Catalogues`, `Relationship`, `Check`, `CheckCode` | Input (1) after parsing: the reusable JSON for one IFC version. |
| `dictionary.ts` | `Dictionary`, `Term`, `DictionaryEntry`, `Extractor`, `ResolutionSettings`, `Resolution`, `DictionaryInput` | Input (4). See `07-dictionaries-and-classification.md`. |
| `classification.ts` | `CodeList`, `Code`, `ClassificationMap`, `MapRule`, `LineMatch`, `CodeTarget`, `LineCode`, `ClassificationInput` | Input (3). |
| `engine.ts` | `getBoq` (declaration), `ModelInput`, `Decision`, `BoqLine`, `LineSource`, `Question`, `QuestionKind`, `AnswerType`, `Warning`, `LogEntry`, `LogStage`, `BoqResult` | The engine's outside view and its output. |
| `api.ts` | `PresetsResponse`, `PresetInfo`, `ClassificationPresetInfo`, `ModelSummary`, `RunRequest`, `RunResponse`, `ApiError` | HTTP contract of the dev engine service. |
| `index.ts` | re-exports everything | Import as `@ifc-boq/types`. |

The package has no build step: `exports` points at `src/index.ts`, and the web app compiles it
directly through Vite and `tsc`.

## Generated artefacts

`npm run codegen` (script `packages/types/scripts/codegen.ts`, using ts-json-schema-generator)
writes:

| Output | From type | Used by |
|---|---|---|
| `schema/rule-set.schema.json` | `OurRuleType` | `presets.py` validates every rule set on load |
| `schema/parsed-model.schema.json` | `ParsedModel` | contract test on the parser output |
| `schema/dictionary.schema.json` | `Dictionary` | `presets.py` |
| `schema/resolution-settings.schema.json` | `ResolutionSettings` | `presets.py` |
| `schema/codelist.schema.json` | `CodeList` | `presets.py`, `import_codelist.py` |
| `schema/classification-map.schema.json` | `ClassificationMap` | `presets.py` |
| `schema/boq-result.schema.json` | `BoqResult` | contract test on the engine output |
| `schema/decision.schema.json` | `Decision` | validation of stored decisions |
| `schema/run-request.schema.json` | `RunRequest` | API contract |
| `engine/ifc_boq/data/families.json` | `IFC_FAMILIES`, `FAMILY_INFO` | `measure.py` (family per IFC class) |

Workflow for any shape change:

1. Edit the type in `packages/types/src`.
2. `npm run codegen`.
3. Update the engine (Python) and, if affected, presets and the UI.
4. `npm run test`. The two contract tests (`test_result_matches_the_typescript_contract`,
   `test_parsed_model_matches_the_typescript_contract`) fail if the engine's output and the
   types disagree; `test_presets.py` fails if a preset no longer validates.

Never hand-edit files in `schema/`. When the Java backend arrives, generate its DTOs from these
schemas too, so all three languages share one definition.

## The data layers

```
IFC file
  │  parse.py (slow, once per file content; cached by sha256)
  ▼
ParsedModel           faithful snapshot: no dictionary, no adopted quantities, no decisions
  │  names.py + measure.py (+ dictionaries, + name decisions)          fast
  ▼
MeasuredElement[]     names resolved to terms, one number adopted per quantity, provenance kept
  │  rules.py (+ rule set, + rule decisions)                          fast
  ▼
BoqLine[]             quantity, unit, description, trace, location, tags
  │  classify.py (+ code lists and maps, + code decisions)            fast
  ▼
BoqResult             lines with codes, questions, warnings, checks, log, stats, rule-set snapshot
```

### ParsedModel (`parsed.ts`)

One JSON per IFC version. Conventions: ids are IFC GlobalIds wherever the file has them
(stable across versions, used to match elements between revisions); catalogue entries without
one get deterministic ids (`mat:<step id>`, `mls:...`, `prf:...`, `cls:...`); all lengths,
areas and volumes converted to SI with the original unit kept in `header.units`; world
coordinates as in the file (federation alignment is a separate, later step); meshes are not in
the JSON but in `geometry.glb` (one node per GlobalId, for viewers) and the mesh sidecar `meshes.npz`
(float64, for the engine's work across models; `engine/ifc_boq/geometry.py`). The sidecar is an
engine file, not part of the TypeScript contract.

| Part | Holds |
|---|---|
| `header` | file name, size, SHA-256, IFC schema, model view, authoring app, units and conversion, georeference, project, discipline guess, parse info |
| `spatial` | project, site, building, storeys (elevations), spaces, zones as a tree; spaces keep psets, quantities and volumes |
| `catalogues` | types, materials, layer sets, profiles, systems, classification references (elements point to these) |
| `elements` | raw names and properties, type properties separately, reported and geometric quantities side by side (never merged), references to storey, parent, children, host, openings, material, type |
| `openings` | host, filling, width, height, depth, area measured from geometry |
| `relationships` | contains, aggregates, nests, voids, fills, type assignment, space boundaries, connections, systems, groups |
| `verification` | checks with severity and elements involved (`CheckCode`: volume_mismatch, area_mismatch, inconsistent_winding, not_watertight, no_geometry, geometry_error, overlap, no_material, duplicate_material_name, flag_conflict, placeholder_value, no_quantities, unassigned_storey, proxy_element) and a summary count per code |
| `geometry` | pointer to the geometry store |
| `stats` | element, opening, space counts, count per class |

Deliberately raw: names, materials and property values exactly as in the file (tool-specific
sets like `PSet_Revit_Dimensions` stay in `psets`; only IFC quantity sets go in
`quantities.reported`), instance and type properties separate.

### MeasuredElement (`measured.ts`)

The vocabulary rules can use. Groups of fields: identity (guid, ifc_class normalised, family,
type_name, family_name, material and element_type as **dictionary terms**, materials, profile,
nominal_size, strength_class, raw names kept), location and status (storey, elevation, spaces,
zone, status new/existing/demolish/temporary, design option), flags (is_external, load_bearing),
dimensions (length, width, height, thickness, depth, diameter, cross-section, slope, elevations,
profile girth), areas (gross, net, footprint, developed, faces), volumes and mass (gross/net
volume, perimeter, mass, nominal mass per length, density), reinforcement and MEP fields, parts
(openings, layers, host, parent, children), classification references already in the IFC, all
properties flattened as `"Pset.Prop"`, `provenance` per numeric field (reported, geometry,
derived, user) and warnings.

Absent means "not applicable or not known", and that is what drives a rule's `onMissing`.
`MeasuredField` is an explicit string union of the numeric fields (kept in sync with the
interface by a compile-time check) so it can appear in the JSON Schema.

### BoqResult (`engine.ts`)

| Field | Meaning |
|---|---|
| `status` | `complete`, or `needs_input` when at least one **blocking** question is open |
| `ruleSet` | the flattened rule set actually used (snapshot; `meta.chain` shows the extends chain) |
| `lines[]` | `BoqLine`: key, ruleId, ruleKind (item/derived/manual), description, unit, quantity (`null` = flagged), source (measured/derived/manual/flagged), family, keys (line-key values), trace (formula, params used, elements with their share and a note, source line for derived), codes per code list, location (storey or storeys), tags, notes |
| `questions[]` | id (deterministic), kind, blocking, message, answer type (drives the UI control), guids, field/raw/occurrences for names, suggestion |
| `warnings[]` | code, message, guids, ruleId (e.g. double claims, mixed fields under a map rule, integrity problems) |
| `checks[]` | verification checks from parsing |
| `log[]` | ordered `LogEntry`: seq, stage, level (info/detail/warning), message, ruleId, lineKey, guid, data |
| `building` | `BuildingMeasures`: whole-building values formulas read as `building.*`, with provenance (reported / derived) and notes |
| `models[]` | `ModelReport` per model combined (one for a single model): file name, discipline, elements, taken, left to others, excluded by scope, duplicate GlobalIds, taken without owner |
| `stats` | elements, measured, excluded, unmatched, lines, flagged lines, decisions applied, duration |

Trace elements carry `model` (the model id) so a line can be followed back to its file.

`FederationSettings` (`engine.ts`, schema `federation-settings`, preset `presets/settings/federation.json`):
`disciplines` (each with `owns` selectors or `rest: true`), `storeyTolerance` (m), `duplicateOverlap`
(0-1). `ModelScope` = `{ include?, exclude? }` selectors per model (D44).

`Decision` = `{ questionId, scope: "project" | "company", answer, note?, decidedBy?, decidedAt? }`.
`answer: null` means "leave it" (dismiss without answering).

## HTTP contract (`api.ts`, served by `engine/ifc_boq/api.py`)

| Method and path | Request | Response |
|---|---|---|
| `GET /api/health` | | `{ ok, version }` |
| `GET /api/presets` | | `PresetsResponse`: rule sets (with `extends`), dictionaries (with `layer`), classifications (with `available` and `reason`), terms for answering name questions |
| `GET /api/presets/{kind}/{id}` | kind = rules, dictionaries, classifications | the raw preset JSON (classification returns `{ codeList, map }`) |
| `POST /api/models` | multipart field `file` | `ModelSummary` (modelId = SHA-256, schema, authoring app, storeys, counts, checks, parse time, cached) |
| `GET /api/models/{modelId}` | | `ModelSummary` |
| `POST /api/runs` | `RunRequest` (`models: [{modelId, discipline?, scope?}]` or a single `modelId`; ruleSet id, dictionary ids, classification ids, decisions) | `RunResponse` (runId, full `BoqResult`, xlsxUrl) |
| `GET /api/runs/{runId}/boq.xlsx` | | the Excel file |
| `POST /api/models/{modelId}/names` | `NamesRequest` (dictionary documents, drafts allowed) | `NamesResponse`: every distinct name in the model with its resolution (term, layer, dictionary, entry), element count, classes, worthAsking, extracted values |
| `GET /api/models/{modelId}/geometry.glb` | | the engine's meshes, one node per GlobalId (elements, openings, spaces) |
| `GET /api/models/{modelId}/scene` | | `SceneIndex`: per element its class, name, storey, aggregate parent and the mesh nodes that draw it (a roof is drawn by its slab) |
| `POST /api/codelists/read` | multipart `file` (.xlsx, .csv, .tsv, .txt) | `TableReadResponse`: sheets of text rows, each with a guess of header row, columns and code separator |
| `POST /api/codelists/build` | `CodeListBuildRequest` (rows, header row, column mapping, hierarchy, separator) | `CodeListBuildResponse`: codes with parents and levels, problems, stats |
| `POST /api/presets/{kind}/check` | `CheckPresetRequest` (doc = a draft preset; classification = `{ codeList, map }`; library = other unsaved drafts) | `CheckPresetResponse` (ok, problems, and for rule sets the flattened set). Schema, extends chain and integrity, expression syntax, unknown terms and codes. Saves nothing. |
| `PUT /api/presets/{kind}/{id}` | `SavePresetRequest` (doc; its id must match) | `SavePresetResponse` (saved, problems). The same checks as above; when there are none, writes the draft to `presets/user/` (`IFC_BOQ_USER_PRESETS`, git-ignored). A shipped preset's id is refused. Dev build only; the backend will own preset storage. |
| `DELETE /api/presets/{kind}/{id}` | | `{ ok }`; 404 for a shipped preset or an unknown id |

Errors return `ApiError` `{ detail }` with a 4xx/5xx status. The contract is deliberately
job-shaped (see 03-architecture.md) so it can move behind the Java backend and a queue.
