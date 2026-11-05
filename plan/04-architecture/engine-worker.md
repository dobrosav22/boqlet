# Engine worker contract

The engine (`engine/ifc_boq`) becomes a worker with a fixed JSON contract. The mock API and
the Java backend both use exactly this contract. Today's FastAPI (`engine/ifc_boq/api.py`)
stays as the PoC's dev API. The worker is new code: `engine/ifc_boq/worker.py` (job
execution), `engine/ifc_boq/rpc.py` (quick calls), `engine/ifc_boq/storage.py` (local folder
or S3), `engine/ifc_boq/sheets/` (package/comparison Excel, offer import). Tasks: EN-001…EN-008.

Public engine functions the worker wraps (docs/05): `parse.parse_file`, `pipeline.get_boq`,
`export_xlsx.export`, `pipeline.names_in_model`, `presets.check`, `presets.flattened`,
`codelist_import`. **No engine logic in the worker.** It only maps JSON to calls.

## Job envelope

```json
{
  "jobId": "uuid",
  "type": "parse | run | preview | diff | export_xlsx | export_package | export_comparison | import_offer",
  "orgId": "uuid",
  "input": { "...per type..." },
  "outputPrefix": "orgs/{orgId}/…/",
  "attempt": 1
}
```

Result:
```json
{ "jobId": "uuid", "status": "succeeded | failed | cancelled",
  "output": { "...per type..." },
  "error": { "code": "parse_error", "message": "…", "retryable": false },
  "durationMs": 5120, "metrics": { "elementCount": 218, "modelBytes": 2400000 } }
```

Progress events (any number, before the result):
`{ "jobId": "uuid", "stage": "geometry", "pct": 42, "message": "Meshing 180 of 218 elements" }`

All storage references are **keys** relative to the configured bucket/root. The worker reads
inputs from keys and writes outputs under `outputPrefix`. Writing is idempotent: a retried
job overwrites its own outputs.

## Job types

### parse
Input:
```json
{ "modelVersionId": "uuid", "sourceKey": "orgs/o/uploads/v/source.ifc", "fileName": "Duplex_A.ifc",
  "options": { "overlaps": true } }
```
Output:
```json
{ "summary": "ModelSummary without modelId/cached (packages/types/src/api.ts)",
  "artifacts": { "parsedKey": "…/parsed.json.gz", "geometryKey": "…/geometry.glb",
                 "meshesKey": "…/meshes.npz", "sceneKey": "…/scene.json" },
  "sha256": "…" }
```
Stages: `download`, `read`, `geometry`, `verify`, `write`. Errors: `not_ifc`,
`unsupported_schema`, `corrupt_file`, `parse_timeout` (retryable once), `parse_error`.

### run
Input (everything resolved by the API, so the worker never looks anything up):
```json
{
  "runId": "uuid",
  "models": [ { "id": "modelVersionId", "fileName": "…", "discipline": "architecture",
                "scope": { "exclude": [] }, "parsedKey": "…", "meshesKey": "…" } ],
  "ruleSet": { "doc": "RuleSet | RuleSetPatch", "library": ["parent docs, exact versions"] },
  "classifications": [ { "codeList": "CodeList", "map": "ClassificationMap" } ],
  "dictionaries": ["Dictionary (global → company → project order)"],
  "resolution": "ResolutionSettings",
  "federation": "FederationSettings",
  "decisions": ["Decision (incl. override:{lineKey} decisions, EN-003)"],
  "manualItems": ["ManualItem (appended to the rule set, EN-007)"],
  "unitSystem": "metric | imperial",
  "export": { "xlsx": true, "meta": { "project": "…", "boq": "…", "revision": "A", "status": "draft",
              "groupBy": "classification id", "locale": "en", "watermark": "DRAFT" } }
}
```
Output:
```json
{ "resultKey": "…/result.json.gz", "xlsxKey": "…/boq.xlsx",
  "status": "complete | needs_input", "stats": "BoqResult.stats",
  "counts": { "lines": 41, "questions": 3, "blockingQuestions": 0, "warnings": 2 } }
```
`result.json.gz` is a full engine `BoqResult` (schema `packages/types/schema/boq-result.schema.json`),
validated by the worker before writing. Stages: `load`, `names`, `measure`, `federate`,
`rules`, `classify`, `export`.

### preview
Same input as `run` (with `runId` null), plus optional `compareWith` (a second rule-set doc,
usually the published version). Output: `{resultKey, compareResultKey?, diffKey?}`. Outputs
under `previews/` with a 7-day lifecycle.

### diff (EN-002)
Input: `{ "fromResultKey": "…", "toResultKey": "…", "fromLabel": "Rev A", "toLabel": "Rev B" }`.
Output: `{ "diffKey": "…/diff.json.gz", "summary": { "linesAdded": 2, "linesRemoved": 1, "linesChanged": 7, "elementsAdded": 3, "elementsRemoved": 1, "elementsChanged": 4, "questionsNew": 2, "questionsResolved": 0 } }`.
`diff.json.gz` follows `RunDiff` (data model). It will be added to `packages/types` as
`diff.ts` with a generated schema.

### export_xlsx
Input: `{ "resultKey": "…", "diffKey": null, "meta": { …as run.export.meta…, "issuedBy": "…", "issuedAt": "…", "issueNote": "…" }, "fileName": "…" }`.
Output: `{ "xlsxKey": "…", "sizeBytes": 123 }`. With `diffKey` it writes the change report
instead.

### export_package (EN-006)
Input: `{ "tender": {…name, firm, deadline, timezone, currency…}, "package": {…name, code…}, "lines": [PackageLine], "offer": null | {lines: [{lineKey, rate, note}]}, "fileName": "…" }`.
Output: `{ "xlsxKey": "…" }`. A protected sheet with a hidden `lineKey` column. Only rate and
note are editable.

### import_offer (EN-006)
Input: `{ "fileKey": "…", "lines": [PackageLine] }`.
Output: `{ "lines": [{lineKey, rate, note}], "report": { "matched": 120, "unknownRows": [3, 17], "invalid": [{row, column, value}], "missing": ["lineKey…"] } }`.
The API writes the matched rates into the bidder's draft offer.

### export_comparison (EN-006)
Input: `{ "tender": {…}, "package": {…}, "comparison": "the API's comparison response" }`.
Output: `{ "xlsxKey": "…" }`.

## RPC (quick, synchronous)

`POST {ENGINE_RPC_URL}/rpc/{op}`, JSON in and out, 10 s timeout, stateless:

| op | Input | Output | Engine function |
|---|---|---|---|
| `check` | `{kind, doc, library?}` | `CheckPresetResponse` (problems, flattened) | `presets.check`, `presets.flattened` |
| `names` | `{parsedKey, dictionaries[]}` | `NamesResponse` | `pipeline.names_in_model` |
| `codelist-read` | `{fileKey}` (uploaded by the API) | `TableReadResponse` | `codelist_import` |
| `codelist-build` | `CodeListBuildRequest` | `CodeListBuildResponse` | `codelist_import` |
| `expr-check` | `{expr, context: "line" \| "element" \| "building"}` | `{ok, problems, readable}` | `expr.py` parser |

The rpc service caches parsed models by key (LRU, memory-bounded) for `names`.

## Transports

### HTTP transport (phase 1, also usable in phase 2 for small deployments)
- `POST {ENGINE_URL}/jobs/{type}` with the envelope → response `application/x-ndjson`:
  progress events, one per line, then the result as the last line. Closing the connection
  cancels the job.
- `POST {ENGINE_URL}/rpc/{op}`.
- Storage: `ENGINE_STORAGE=file://C:/…/data` (local folder shared with the mock API) or `s3://bucket`.

### Queue transport (phase 2)
- Table `jobs` (see `07-backend/db-schema.md`). The worker loop:
  `SELECT … WHERE status='queued' AND type = ANY(:types) ORDER BY priority, created_at FOR UPDATE SKIP LOCKED LIMIT 1`
  → set `running`, `started_at`, `worker_id`, `heartbeat_at` → execute → write `progress`
  (throttled to 1/s) → write `output`/`error`, `status`, `finished_at` →
  `NOTIFY job_finished, '{jobId}'`.
- **Heartbeat** every 15 s. The API re-queues `running` jobs whose heartbeat is older than 2
  min (worker died), up to `max_attempts` = 3.
- **Cancel:** the API sets `cancel_requested=true`. The worker checks it between stages and
  ends `cancelled`.
- **Pools:** workers start with `--types parse,run,preview` and `--max-model-mb`. Large parses
  can go to a large pool (`jobs.pool = 'large'` set by the API from file size).
- The worker writes only to its job row (BR: worker never touches other tables).

## Versioning and validation

- The envelope carries `"contract": "1"`. The worker refuses unknown major versions
  (`error.code = "contract_mismatch"`).
- The worker validates inputs (engine docs) against `packages/types/schema` and its outputs
  against the same schemas before writing (the engine already validates results: docs/05).
- A `GET /health` on both transports reports engine version, contract version and parse format
  (`PARSE_FORMAT` in `parse.py`). The API stores `engineVersion` on every run for
  reproducibility.

## Mapping to today's code

| Today | Worker |
|---|---|
| `service.py` resolves preset ids from `presets/` | The API resolves preset **versions** and sends docs inline |
| `store.py` (`engine/.cache`) | `storage.py` (local folder or S3) keyed by the API |
| `POST /api/models` parses synchronously | `parse` job |
| `POST /api/runs` with `RunRequest` | `run` job |
| `export_xlsx.export(result, meta)` | `export_xlsx` job; meta extended (EN-006) |
| `POST /api/models/{id}/names` | rpc `names` |
| `POST /api/presets/{kind}/check` | rpc `check` |
| `POST /api/codelists/read` / `build` | rpc `codelist-read` / `codelist-build` |
