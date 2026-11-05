# Engine tasks (Python, `engine/ifc_boq`)

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
- **Specs:** F12, F11 Excel round-trip, engine-worker.md.
- **Do:** extend `export_xlsx` meta (project, BoQ, revision label, status/watermark, issue
  info, groupBy system, locale number formats); `sheets/package.py` (protected sheet, hidden
  lineKey column, rate and note unlocked, totals as formulas); `sheets/offer_import.py`
  (openpyxl read-only, data-only; match by hidden lineKey, else by ref + description; report);
  `sheets/comparison.py`. Job types `export_package`, `import_offer`, `export_comparison`.
- **Acceptance:** package xlsx filled in by LibreOffice and by Excel (fixture files checked in)
  import with 100% matches; corrupted cells reported by row/column; files open without repair
  prompts.

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

### EN-009 Queue transport
- **Specs:** engine-worker.md "Queue transport", db-schema `jobs`.
- **Do:** `python -m ifc_boq.worker --types parse,run,preview --pool standard` loop: claim with
  SKIP LOCKED, heartbeat, progress throttle, cancel check between stages, write output/error,
  `NOTIFY job_finished`; graceful shutdown finishes or releases the current job.
- **Acceptance:** integration test with Postgres (testcontainers or docker compose): two
  workers, ten jobs, no double execution; killing a worker mid-job leads to re-queue by the
  API's sweeper (simulated) and success on retry.
