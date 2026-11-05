# System architecture

## Components

```text
                ┌──────────────────────────── Browser ────────────────────────────┐
                │  Next.js app (apps/app): UI only, typed client from openapi.yaml │
                └───────┬──────────────────────────────┬───────────────────────────┘
                        │ HTTPS JSON + SSE              │ PUT/GET signed URLs
                        ▼                               ▼
   ┌───────────────────────────────────────┐   ┌──────────────────────────────┐
   │ API: apps/mock-api (phase 1)           │   │ Object storage (S3 API)      │
   │      services/api Java (phase 2)       │◄─►│ IFC, parsed.json, glb, npz,  │
   │ auth, orgs, projects, models, BoQs,    │   │ results, exports, attachments│
   │ library, decisions, tenders, jobs,     │   └──────────────▲───────────────┘
   │ notifications, entitlements, audit     │                  │
   └──────┬───────────────┬─────────────────┘                  │
          │ SQL           │ jobs (table) + rpc (HTTP)           │
          ▼               ▼                                     │
   ┌─────────────┐  ┌──────────────────────────────────────────┴─┐
   │ Postgres    │  │ Engine (Python, engine/ifc_boq)             │
   │ (phase 2;   │  │  worker: parse, run, preview, diff, exports,│
   │  mock: JSON │  │          offer import                       │
   │  file)      │  │  rpc: check, names, codelist read/build     │
   └─────────────┘  └─────────────────────────────────────────────┘
          ▲
          │ email provider, billing provider (adapters)
```

## Responsibilities

| Component | Owns | Never |
|---|---|---|
| **Next.js app** | Screens, interaction, client state, optimistic UI, i18n rendering, 3D display | Computes quantities or evaluates formulas (BR-01); talks to the engine or storage except through signed URLs the API hands out; holds secrets |
| **API** (mock, then Java) | Identity mapping, tenancy, permissions, all entities in `03-domain`, state machines, entitlements, usage, audit, notifications, email, billing adapter, job orchestration, ingesting engine results into rows, tender arithmetic (BR-47) | Measures, applies rules, evaluates formulas, parses IFC, reads spreadsheets |
| **Engine worker** | Everything that reads IFC, applies rules, writes or reads spreadsheets: job types in `engine-worker.md` | Knows about users, orgs, permissions, plans; writes to any table except its own job row |
| **Storage** | Large immutable blobs | Holds anything that needs querying |
| **Postgres** | Queryable state, the job table | Holds IFC or big JSON blobs (store keys instead) |

## Phases

| Phase | API | Engine transport | Data |
|---|---|---|---|
| **1. Frontend build** | `apps/mock-api` (Node) implementing `openapi.yaml` | HTTP to the engine's internal endpoints (`engine-worker.md`, "HTTP transport") | JSON file + local folder as storage |
| **2. Backend build** | `services/api` (Java) implementing the same `openapi.yaml` | Job table in Postgres, claimed by Python workers; rpc over HTTP | Postgres + S3-compatible storage |
| **3. Production** | Java, several instances | Worker pools sized per job type | Managed Postgres, S3, email, billing |

The frontend switches from phase 1 to 2 by changing `NEXT_PUBLIC_API_BASE_URL` and the auth
adapter. Nothing else (P11).

## Request types

1. **CRUD** (most calls): API ↔ DB, synchronous.
2. **Quick engine calls** (rpc): preset check, names in a model, code-list read/build. The API
   calls the engine rpc service with a timeout (10 s). These are needed while editing, so they
   can't be queued.
3. **Jobs**: parse, run, preview, diff, exports, offer import. The API creates a `Job`, the
   worker executes, the API ingests the output and notifies. The UI follows progress over SSE.
4. **Uploads/downloads**: signed URLs straight to storage.

## Key design choices (with reasons)

| Choice | Why |
|---|---|
| Engine as a worker with a JSON job contract | Heavy work never blocks the API; Java needs no Python; same contract for mock and Java (D61, D67) |
| Postgres job table first (`FOR UPDATE SKIP LOCKED`) | One less moving part; enough for v1 volumes (doc 10). A broker can replace it behind the same contract |
| Results ingested into rows | Paging, filtering, grouping, viewer index and comparisons without loading big JSON (D65) |
| SSE (not WebSocket) for live updates | One-way server → browser is all v1 needs; works through proxies; simple in Java and Node |
| OpenAPI as the contract, JSON Schemas from `packages/types` for engine shapes | One source of truth for three languages (D64) |
| Engine owns all spreadsheet I/O | One implementation (openpyxl) shared by mock and Java phases; the existing exporter is extended rather than rewritten |
