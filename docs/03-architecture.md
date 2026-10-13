# 03 Architecture

Two pictures: what runs today (a dev build on one machine) and what the platform is meant to
become. The engine and the contract are designed to move from the first to the second
without being rewritten.

## Today: the development build

```
 Browser  http://localhost:5173
   │  React 18 + Vite (apps/web)
   │  fetch("/api/...")
   ▼
 Vite dev server ── proxy /api ──►  FastAPI  127.0.0.1:8787   (engine/ifc_boq/api.py)
                                        │
                                        ├─ service.py   preset ids -> get_boq -> stored run
                                        ├─ pipeline.py  get_boq (names, measure, rules, classify, questions, log)
                                        ├─ parse.py     IFC -> ParsedModel (ifcopenshell, trimesh, manifold3d)
                                        ├─ geometry.py  mesh measurements shared by parse and federation
                                        ├─ presets.py   reads /presets/*.json on every run, validates vs schemas
                                        ├─ export_xlsx.py
                                        └─ store.py     engine/.cache/  (stand-in for storage + DB)
                                              models/<sha256>/model.ifc, parsed.json, geometry.glb, meshes.npz
                                              runs/<runId>.json, runs/<runId>.xlsx
```

- `npm install` runs `scripts/setup-engine.mjs`: finds Python 3.10-3.13, creates `engine/.venv`,
  installs `engine/requirements.txt` and the engine package (editable). It writes a hash stamp
  and only reinstalls when `requirements.txt` or `pyproject.toml` change. It never fails the npm
  install; if Python is missing it prints instructions.
- `npm run dev` runs `scripts/run-engine.mjs serve` (uvicorn with reload on `engine/ifc_boq`)
  and Vite together via `concurrently`.
- The API is **synchronous on purpose**: upload parses in the request; a run executes in the
  request. Fine for files up to tens of MB. Uploads are capped by `IFC_BOQ_MAX_UPLOAD_MB` (300).
- Models are keyed by the **SHA-256 of the file content** (`modelId`). Uploading the same file
  again returns the cached parse instantly. This is the "model version" of the platform.
- Runs are immutable: `runs/<runId>.json` holds the request and the full `BoqResult`.
- Presets are read from disk on every run, so editing a JSON file in `presets/` and pressing
  Generate shows the effect immediately (no restart).

### Request flow

| Step | Web | HTTP | Engine |
|---|---|---|---|
| Load presets | on start | `GET /api/presets` | lists `presets/` with names, descriptions, availability (Uniclass shows "not installed" until imported) |
| Drop IFC | `uploadModel(file)` | `POST /api/models` (multipart `file`) | hash, parse once, verify, store; returns `ModelSummary` |
| Generate | `run(request)` | `POST /api/runs` (`RunRequest`: modelId, ruleSet, dictionaries, classifications, decisions) | flatten rule set, `get_boq`, export xlsx, store; returns `RunResponse` (runId, full `BoqResult`, xlsxUrl) |
| Answer questions | merges answers into decisions, generates again | `POST /api/runs` | decisions applied by question id |
| Show preset JSON | Inputs tab | `GET /api/presets/{kind}/{id}` | raw file content |
| Download | link | `GET /api/runs/{runId}/boq.xlsx` | stored file |
| Names in a model (Library, dictionaries) | names tab | `POST /api/models/{modelId}/names` | `pipeline.names_in_model` over the cached parse; nothing is stored |
| Check a draft preset (Library) | Check button, patch parents | `POST /api/presets/{kind}/check` | `presets.check` + `presets.flattened`; nothing is stored |
| Save / delete a preset (Library) | Save, Save as new, Delete saved | `PUT` / `DELETE /api/presets/{kind}/{id}` | `presets.save` (same checks, then writes to `presets/user/`) / `presets.delete`; dev-build stand-in for the backend's preset storage |

The full result (lines, log, questions) is returned with every run. For the Duplex that is a few
hundred KB; for large models the platform should page lines and logs instead.

### Code boundaries inside the engine

| Module | Owns | Must not |
|---|---|---|
| `parse.py` | Reading IFC, geometry, verification checks; output = `ParsedModel` + mesh sidecar | Apply dictionaries or choose quantities |
| `geometry.py` | Mesh measurements (room surfaces, element sides, room contacts, shared volume), mesh sidecar format | Read IFC or decide anything |
| `names.py` | Dictionary resolution, extractors, term hierarchy | Know about rules |
| `measure.py` | Adoption policy: which number to trust per element | Know about rules |
| `rules.py` | Executing a rule set over measured elements | Measure geometry or read IFC |
| `classify.py` | Codes per line per system | Change quantities |
| `federation.py` | Combining several models' measured elements: storeys, same GlobalId, ownership, overlaps, aggregates, links across models (fillings, rooms, embedded) | Read files or know about rules |
| `pipeline.py` | Order of stages, coverage, questions, stats | Contain stage logic |
| `service.py`, `api.py`, `cli.py`, `store.py`, `corpus.py` | Wiring: preset ids, storage, HTTP, terminal | Contain engine logic |

**Temporary versus lasting.** `api.py`, `store.py` and the request shapes in `api.ts` are a
**temporary demo backend**: store an upload, list it, run it. The production backend (Java, D-series
in 02) will own users, projects, storage and jobs and replace them; keep them thin CRUD and never put
a decision in them. Everything that decides something is engine code: plain functions over the
contract types in `packages/types`, data in and data out, no HTTP, no file paths, no storage. The
Python engine stays as a worker for now; it may move to Java later, so engine code should stay
easy to translate (no reliance on Python-only tricks where a plain loop would do).

## Target: the platform

```
 React app (TS)  ───────►  Java backend (planned)  ───────►  Relational DB (Postgres-class)
   UI only                  auth, orgs, projects,              orgs, users, projects, models, versions,
                            permissions, presets CRUD,         runs, decisions, BoQ lines, element-line links,
                            jobs, notifications, exports       audit log, job table
        ▲                        │           │
        │ progress (WS/SSE)      │ enqueue    │ presigned URLs
        │                        ▼           ▼
        │                   Job queue     Object storage (S3-compatible)
        │                        │         IFC files, parsed.json, geometry.glb, meshes.npz, exports
        │                        ▼           ▲
        └──────────────── Python engine workers (engine/ifc_boq) ─┘
                           parse, verify, measure, rules, classify, export
```

Decisions behind this shape (see 02-decisions.md D60-D67):

- **The web app never touches geometry.** It creates jobs; workers pick them up; results land in
  the database and storage.
- **The engine is a worker**, not a service the UI calls directly. Heavy files never slow the app
  for others; workers scale with load and can be sized per customer; failed jobs retry; users can
  cancel. Workers need real machines (many GB RAM for large models), not serverless functions.
- **Java owns everything that is not measuring**: users, orgs, membership, roles, projects,
  model versions, preset storage and editing, decisions, BoQ lifecycle (draft, review, approved,
  issued), exports, notifications, billing, audit.
- **One schema, three languages.** `packages/types/schema/*.schema.json` is generated from the
  TypeScript types. The React app uses the types directly; the engine validates against the
  schemas; the Java backend should generate its DTOs from the same schemas (for example with
  jsonschema2pojo) rather than hand-writing them.
- **Formulas evaluate only in the engine.** A rule editor previews by sending a rule to an engine
  "preview" job against a sample model. Do not port `expr.py` to Java or the browser.
- **Big data to object storage, queryable data to the database.** Storage: raw IFC, geometry cache,
  parsed JSON per model version (compressed). Database: runs, decisions, BoQ lines, element-to-line
  links (traceability, comparisons, viewer highlighting). Later, if analytics grow: Parquet + DuckDB.

### How the dev build maps onto the platform

| Today | Platform |
|---|---|
| `POST /api/models` parses synchronously | Upload straight to storage via presigned URL; backend enqueues a parse job; worker writes parsed.json and geometry.glb; job ends ready / failed |
| `modelId` = SHA-256 | Model version id; the hash still deduplicates identical uploads |
| `POST /api/runs` computes synchronously | Backend enqueues a run job with a `RunRequest` whose presets are **resolved JSON** (from the DB), not ids from a folder |
| `engine/.cache/runs/*.json` | Run rows + BoQ line rows + element-line link rows; full result JSON in storage |
| `presets/` folder | Preset tables (system, org and project scope) with versions; snapshot stored with each BoQ |
| decisions sent with each run | Decision rows per project (and promoted ones per org), loaded by the backend into each job |
| `status: needs_input` returned to the UI | Job state "needs input" + notification; resumes as a new run when answered |

To make the move easy, keep the engine's public surface to: `parse_file(path)`,
`pipeline.get_boq(parsed, rules, classifications, dictionaries, resolution, decisions, rule_library)`
and `export_xlsx.export(result, meta)`, all JSON in, JSON (or bytes) out. A worker wrapper
(queue consumer) is a thin layer over these, just like `service.py` is today.

### Performance model

Parsing (geometry) is the slow part and happens once per model version; everything after is
arithmetic over cached data. Switching rule set, classification or answering questions takes
seconds even for large models. Estimates for first processing (8-16 cores, optimised code, to be
confirmed with the test corpus): small house under 20 MB, 10-30 s; apartment block or office
(10k-50k elements, 50-300 MB), 1-5 min; hospital or airport federated (200k+ elements, GBs),
10-30+ min. Details and job states in `10-platform.md`.

## Stack summary

| Layer | Now | Planned |
|---|---|---|
| UI | React 18, Vite 5, plain CSS | React (framework open: Vite SPA or Next.js), a virtualised grid (AG Grid or TanStack Table) for large BoQs, That Open Engine viewer |
| Backend | none (FastAPI dev service) | Java |
| Engine | Python 3.10-3.13: ifcopenshell, numpy, trimesh, manifold3d, networkx, openpyxl, jsonschema, FastAPI | Same, as queue workers |
| Contract | TypeScript types -> JSON Schema (ts-json-schema-generator) | Same; Java DTOs generated from the schemas |
| Storage | `engine/.cache` | S3-compatible object storage + Postgres-class DB |
| Jobs | synchronous | Queue (a DB job table with `SKIP LOCKED` is enough to start; a workflow engine if pause/resume grows complex) |
| Notifications | none | WebSocket/SSE progress, email for ready / needs input / failed |

Licences checked: ifcopenshell LGPL (fine server-side), web-ifc MPL and That Open Engine MIT
(fine), xeokit AGPL (needs a commercial licence for a commercial product).
