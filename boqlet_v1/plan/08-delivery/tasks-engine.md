# Engine tasks (Python, `engine/ifc_boq`)

**Owner: the backend agent, in phase 2, milestone ME** (after BE-000, before the Java work; P39).
The engine sits in the product root since FE-000 (`boqlet_v1/engine`, P44).
During phase 1 the frontend agent's mock faked these features on top of the proof-of-concept
engine API; `06-frontend/mock-api.md` "Engine fakes" lists each fake and the task that replaces
it. When a task lands, switch the mock to the real behaviour and delete its fake. Suggested
order: EN-001 (worker + HTTP transport; switch the mock to it), EN-004, EN-003, EN-007, EN-013,
EN-010, EN-011, EN-012, EN-005, EN-002, EN-008, EN-006; EN-009 in M6; EN-P1 with MP2, in a later phase (P48).

Rules (from CLAUDE.md): types first (`packages/types/src` → `npm run codegen`), no measuring
logic in rules and no rule logic in measuring, formulas only in `expr.py`, deterministic
question ids, keep the Duplex acceptance test green. Worker code holds **no engine logic**.

---

### EN-001 Worker package and HTTP transport
- **Specs:** 04-architecture/engine-worker.md (envelope, parse, run, rpc, HTTP transport, health).
- **Do:**
  1. `storage.py`: `Storage` interface with `LocalStorage(root)` and `S3Storage(bucket)`, plus
     `get_bytes/put_bytes/open/exists` by key, gzip helpers.
  2. Optional `progress(stage, pct, message)` callback parameter on `parse.parse_file` and
     `pipeline.get_boq` (calls only, no behaviour change).
  3. `worker.py`: `execute(envelope, storage, progress) -> result` for `parse` and `run`.
     `run` takes inline docs: flattens the rule set with `presets.flattened(doc, library)`,
     applies `unitSystem` to the flattened `meta.unitSystem`, loads `parsed.json.gz` + `meshes.npz`
     per model from storage, calls `get_boq`, validates the result against the schema, writes
     `result.json.gz` and `boq.xlsx`.
  4. `rpc.py` + an ASGI app `ifc_boq.worker_http:app` exposing `POST /jobs/{type}` (NDJSON
     progress + final result; cancel on disconnect), `POST /rpc/{op}` (check, names,
     codelist-read, codelist-build, expr-check), `GET /health` (engine version, contract
     version, `PARSE_FORMAT`).
  5. npm script `dev:engine-worker` (port 8788) via `scripts/run-engine.mjs`.
- **Acceptance:** pytest: parse the Duplex through `execute`; run it with the `as-modelled`,
  `acme-cost-codes` and `global-seed` docs inline and get the `HAND_BOQ` lines; NDJSON stream
  has ≥ 5 progress events; rpc `check` returns the same problems as `presets.check`; the PoC
  API still works.

### EN-002 Run diff
- **Specs:** F08, data-model RunDiff, engine-worker.md `diff`.
- **Do:** add `packages/types/src/diff.ts` (`RunDiff`, `LineChange`, `ElementChange`,
  `DiffSummary`) + schema; `engine/ifc_boq/diff.py`: lines by key; elements by (model,
  GlobalId) from traces and ModelReports; causes (elements added/removed/changed, rules
  changed via flattened rule-set hash per rule id, decision changed via the decisions applied,
  override changed); question ids new/resolved; GUID-churn warning (> 50% changed ids); `diff`
  job type; `export_xlsx` with a diff.
- **Acceptance:** fixture pair Duplex v1/v2 (EN-008) produces the expected changes exactly;
  identical runs give an empty diff; diff of a 40k-line synthetic result in < 5 s.

### EN-003 Line overrides and orphan question
- **Specs:** data-model LineOverride, BR-09, F06 §6.
- **Do:** types: `QuestionKind` adds `orphan_override`; `BoqLine` adds optional
  `overridden: {engineQuantity, quantity, reason}`; decisions with id `override:{lineKey}` and
  answer `{quantity, reason}` (extend `Decision.answer` type to allow an object, or add
  `Decision.value`); pipeline applies them after classification (source unchanged, the line
  flagged as overridden, logged in stage `decision`); unmatched override → `orphan_override`
  question (non-blocking, id `orphan:{lineKey}`).
- **Acceptance:** an override changes exactly one line and appears in the log and the xlsx;
  removing the line's rule gives an orphan question; Duplex test unchanged without overrides.
- **Extended for full line edits (P20, F06 §6):** the decision answer carries the edited fields
  `{quantity?, description?, unit?, codes?, excluded?, reason?}`. Quantity is applied **before**
  derived rules, so derived lines follow it (their trace names the edited source); `codes` act as
  the line's classification decision per system; description, unit and exclusion are applied to
  the final line; `BoqLine.overridden` lists every edited field with the engine's value; an
  excluded line keeps its row with `excluded: true`, is left out of group totals and goes to an
  "Excluded lines" sheet in the xlsx. Unit without quantity is rejected by the check. Acceptance
  adds: editing the Duplex foundation wall area changes its formwork line by the same factor; a
  moved line lands in the new group in one system only.

### EN-004 Message codes and params
- **Specs:** F15 §4.
- **Do:** `Question`, `Warning`, `LogEntry` gain `code` and `params` (keep `message`); every
  place that builds them passes a stable code (`question.unknown_name`, `warning.models_apart`,
  `log.measure.adopted_reported`…) and params. List all codes in
  `packages/types/src/messages.ts` (union type) for the frontend catalogue.
- **Acceptance:** no question, warning or log entry in the Duplex and NBU runs lacks a code;
  a test asserts every emitted code is in the union.

### EN-005 Preview job
- **Specs:** F10 §6, engine-worker.md `preview`.
- **Do:** `preview` job = run without export, outputs under `previews/`; optional
  `compareWith` runs a second rule-set doc and diffs (EN-002).
- **Acceptance:** preview of a draft patch vs its published version on the Duplex lists the
  changed lines only.

### EN-006 Spreadsheets
- **Specs:** F12 (incl. importing edits back), engine-worker.md.
- **Do:** extend `export_xlsx` meta (project, BoQ, version label, status/watermark, save info,
  groupBy system, position numbers, locale number formats) and expose the workbook data so a
  module can add columns (`ExportDataService`, modules.md).
  BoQ round-trip (P20): a hidden protected line-key column in the BoQ sheet;
  `sheets/boq_import.py` and job `import_boq_edits` producing an `EditsImportReport`.
- **Acceptance:** an exported BoQ edited in LibreOffice and in Excel (fixture files checked in)
  imports with the expected edits; corrupted cells reported by row/column; files open without
  repair prompts.

### EN-007 Platform manual items with codes
- **Specs:** F06 §7, data-model ManualItem.
- **Do:** `ManualItem.codes?: Record<string, string>` (classification id → code); the run
  input's `manualItems` are appended to the flattened rule set (ids prefixed `boq.`); classify
  uses `codes` first with `LineCode.source = "item"` (add to the union).
- **Acceptance:** a manual item with a code lands in that group in every system that has a
  code for it, and goes through the map otherwise.

### EN-008 Revision fixtures
- **Do:** a script (`engine/scripts/make_duplex_v2.py`, ifcopenshell) writing
  `fixtures/ifc/Ifc2x3_Duplex_Architecture_v2.ifc`: delete one wall, change one door type,
  add one window, keep all other GlobalIds. Expected diff stored in
  `engine/tests/fixtures/duplex_v1_v2_diff.json`.
- **Acceptance:** file parses; EN-002 test uses it.

### EN-010 Item texts on lines
- **Specs:** P14, BR-11, F06 §2 and §5, F10 §13, F11 §2, F12.
- **Do:**
  1. Types first: document `Code.description` as the item text (a template, same syntax as a
     rule's line text) and add `LineCode.text?: string` (the filled text) in
     `packages/types/src/classification.ts`; `npm run codegen`.
  2. `classify.py`: after a line gets a code, fill the code's `description` through the same
     template code that fills rule line texts (one evaluator, `expr.py`), with the same values the
     line's own text can use. A blank with no value for this line stays as `{name}` and adds a
     run warning `item_text_blank` (message code, EN-004) naming the line and the blank.
  3. Preset check: an item text with a syntax error or a name no line can have is a problem.
  4. `export_xlsx`: Description = the grouping system's `text`, else the line text; "Lines"
     sheet gets "Measured as" and one item-text column per system with texts; the "not in the
     models" note above the table (P15) with the manual-line count.
- **Acceptance:** with a copy of `acme-cost-codes` whose walls code has the text
  `External walls {thickness*100} cm, measured per m2`, the Duplex brick wall line carries
  `codes.acme.text = "External walls 41.7 cm, measured per m2"`; quantities are identical with
  and without texts (BR-02 test extended); a blank `{fire_rating}` on a line without one stays
  visible and gives one warning; the Duplex acceptance test is unchanged.

### EN-011 Setup markers in rule sets
- **Specs:** F16 step 1 (and its table "Wizard content for As modelled"), P42.
- **Do:**
  1. Types first (`packages/types/src/rules.ts`, then codegen): `SlotPrompt.setup?: string`: the id
     of a `RuleSet.setupSteps` entry the question appears on (wizard part 1c), or `"skip"` to keep an
     item-switching yes/no question off the wizard's checklist (part 1a). `RuleSet.setupSteps?:
     {id: string; title: string; intro?: string}[]` in screen order. `RuleSetPatch` may set both;
     flattening merges them like other slot fields.
  2. Mark `presets/rules/as-modelled.json` exactly as F16's table: steps `walls`, `wall-openings`,
     `slab-openings`, `roofs`, `windows-doors`, `layout` with their questions; `setup: "skip"` on
     `include_proxies` and `include_non_physical`.
  3. Preset check: a `setup` step id not in `setupSteps` is a problem; `"skip"` on a slot that
     switches no item is a problem; a step with no question is a problem.
  4. The flattened rule set already carries what parts 1a and 1b need (`enabled: {param}` on items,
     `dependsOn` on slots); no other engine change.
- **Acceptance:** the flattened "As modelled" lists six steps with the questions of F16's table;
  the checklist derived from it (every top-level boolean slot that is some item's `enabled`, minus
  `skip`) has 14 entries; changing a marker in the JSON changes the wizard with no code change; the
  check reports a step id that doesn't exist.

### EN-012 Preset Excel templates
- **Specs:** F10 §14, P24, engine-worker.md rpc `template-export` / `template-import`.
- **Do:** `sheets/templates.py`: write a workbook per preset kind (rule set: Settings with data
  validation lists from `options`/`optionLabels` and `min`/`max`, read-only BoQ items, Read me;
  classification: Codes with item texts, Codes per line with a code list dropdown; dictionary:
  Names with a term dropdown), hidden id columns for round-trip; read it back (read-only,
  data-only) into a proposed doc, a list of changes against the given doc, and problems by
  sheet/row/column; run the normal preset check on the proposed doc.
- **Acceptance:** a template written and read back unchanged gives zero changes for every
  shipped preset; three answers changed in LibreOffice give exactly three changes; an answer
  outside the options is a problem with its cell.

### EN-013 Structured trace steps ("How it is calculated")
- **Specs:** F06 §5, P25.
- **Do:** types: `BoqLine.trace.steps?: {kind: "start" | "add" | "deduct" | "factor" | "round" |
  "derive" | "edit" | "result", code: string, params: Record<string, unknown>, value: number | null,
  unit?: Unit, elements?: string[], param?: string}[]`, where `code` is a message code (EN-004)
  and `param` names the rule-set slot a value came from. Measuring and rules emit the steps they
  already compute (gross, deductions with threshold, factors, rounding, derived source, edit).
  Steps must add up to the line quantity (within rounding). The xlsx "Calculation" sheet writes
  them as sentences.
- **Acceptance:** for every line of the Duplex run the steps add up to the quantity; the brick
  wall line has start, deduct (with `param: "wall_opening_threshold"`) and result; derived lines
  have a derive step naming their source line.

### EN-009 Queue transport
- **Specs:** engine-worker.md "Queue transport", db-schema `jobs`.
- **Do:** `python -m ifc_boq.worker --types parse,run,preview --pool standard` loop: claim with
  SKIP LOCKED, heartbeat, progress throttle, cancel check between stages, write output/error,
  `NOTIFY job_finished`; graceful shutdown finishes or releases the current job.
- **Acceptance:** integration test with Postgres (testcontainers or docker compose): two
  workers, ten jobs, no double execution; killing a worker mid-job leads to re-queue by the
  API's sweeper (simulated) and success on retry.

## Pricing module (removable, P36)

**For a later phase (P48):** EN-P1 is built with MP2, not in phase 2.

### EN-P1 Pricing workbooks
- **Specs:** F11, F20, engine-worker.md `pricing.*`.
- **Do:** `engine/ifc_boq/sheets/pricing/`: offer request workbook (protected, hidden line keys,
  rate and note open), offer import (match by hidden key, else by position number + text;
  report), comparison workbook, priced BoQ (core BoQ layout + rate/amount + "Price sources"),
  pricebook template and import (proposed items, changes, problems by cell). Registered as job
  types `pricing.*` only when the folder is present.
- **Acceptance:** request workbooks filled in LibreOffice and Excel import with 100% matches;
  a pricebook template round-trips with zero changes; deleting the folder leaves every core
  engine test passing.

