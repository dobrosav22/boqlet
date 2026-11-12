# Mock API (`apps/mock-api`)

A Node service that implements `openapi.yaml` well enough to build and test the whole frontend
before the Java backend exists (P11). CRUD state lives in a JSON file. Computation goes to the
**real Python engine**: in phase 1 through the existing proof-of-concept engine API
(`engine/ifc_boq/api.py`, port 8787), with the engine features that don't exist yet **faked**
(table below, P39); from phase 2 (milestone ME) through the worker contract's HTTP transport
(`04-architecture/engine-worker.md`). When Java is ready, the frontend points at it and the
mock stays as a test double for frontend e2e tests.

**It is a test double, not a prototype of the backend.** Keep it simple and readable. It
doesn't need to scale, persist safely or be secure. It must be **behaviourally faithful** to
the contract: the same status codes, error codes, state machines, permissions and limits,
because the frontend is built against it.

## Tech

| Concern | Choice |
|---|---|
| Server | Node 20+, **Hono** + `@hono/node-server`, TypeScript |
| Contract | Request/response validation against `packages/api/openapi.yaml` (e.g. `openapi-backend` or Ajv over the bundled spec). In dev, a response that fails validation is a 500 with the validation error, to catch drift early |
| Types | The same generated `schema.d.ts` as the frontend |
| Store | In-memory object, persisted to `apps/mock-api/.data/db.json` (debounced). `npm run mock:reset` reseeds |
| Blobs | `apps/mock-api/.data/blobs/` with the storage key layout of `storage-jobs-realtime.md`. Signed URLs become `http://localhost:4010/_blobs/<key>?sig=…` (PUT/GET) |
| Engine | One `engine` interface with two implementations. **Phase 1:** `PocEngine` over the proof-of-concept API (`POST /api/models`, `GET /api/models/{id}/scene`, `/geometry.glb`, `POST /api/models/{id}/names`, `POST /api/runs`, `GET /api/runs/{id}/boq.xlsx`, `POST /api/presets/{kind}/check`, `PUT /api/presets/{kind}/{id}`, `POST /api/codelists/read`, `/build`), plus the fakes below. **Phase 2:** `WorkerEngine` over the HTTP transport (`POST {ENGINE_URL}/jobs/{type}` with NDJSON progress → SSE `job.progress`, `POST {ENGINE_URL}/rpc/{op}`; storage root = the mock's blob folder) |
| SSE | In-process event bus → `GET /api/v1/events` |
| Email | Written to `.data/outbox/*.html` and listed at `GET /_dev/outbox` (dev page) |
| Clock | `GET/POST /_dev/clock` to move time forward (invitation and session expiry; module deadlines) |
| Port | 4010 |

## Engine fakes (phase 1 only, P39)

Engine features the plan needs but the proof-of-concept engine doesn't have yet. Each fake lives
in `apps/mock-api/src/engine/fakes/<name>.ts`, is behind the `engine` interface, and is deleted
when its task lands in phase 2 (FE-042 checks the table is empty). Fakes **never measure**
(BR-01): they only rearrange, relabel or apply values a person entered. Criteria that depend on
a fake are marked "(fake)" in phase-1 test runs and re-checked in phase 3.

| Fake | What the mock does in phase 1 | Known gap until the real task | Replaced by |
|---|---|---|---|
| Line edits applied | Applies `LineOverride` fields (quantity, text, unit, code, exclusion) to the engine's result lines after the run | Derived lines don't follow an edited quantity; no `orphan_override` question | EN-003 |
| Message codes | None: the UI falls back to the engine's `message` text (F15 §4 allows it) | Questions and warnings untranslated | EN-004 |
| Preview | Saves the draft as a temporary user preset through the PoC API, runs, deletes it; diff of two runs by line key | Slower; no `compareWith` in one job | EN-005 |
| Change report | Diffs two runs' lines by line key and elements by GlobalId (plain comparison, no measuring) | Causes limited to `elements_*` and `override_changed` | EN-002 |
| BoQ export meta, edits import | PoC Excel as is; edits import reads the uploaded xlsx with SheetJS using a hidden line-key column the mock adds on export | Layout differs from the final export | EN-006 |
| Manual items with codes | Adds the chosen codes to manual lines after the run | Map rules don't see them | EN-007 |
| Duplex v2 fixture | Seeds "v2" as a copy of v1 with a different file name | Change report shows no element changes | EN-008 |
| Item texts filled | Fills `{name}` blanks in a code's `description` with the line's values by plain substitution | No expressions (`{thickness*1000}`), no `item_text_blank` warning | EN-010 |
| Setup markers | The F16 "Wizard content for As modelled" markers (`setupSteps`, `setup` per slot) kept in the mock's config and merged into the flattened rule set it serves; parts 1a and 1b are derived from the rule set as F16 says | Only "As modelled" and patches on it have markers | EN-011 |
| Preset Excel templates | SheetJS writes and reads a simple Settings / Codes / Names layout | No data validation dropdowns | EN-012 |
| Trace steps | Builds `start`/`deduct`/`result` steps from the existing trace (formula, params, element shares) | Approximate wording; derived chains shallow | EN-013 |
| Pricing workbooks (MP1) | SheetJS for offer request and pricebook workbooks | Simplified layouts | EN-P1 |

## What it implements

Everything in `openapi.yaml`, with these simplifications:

| Area | Mock behaviour |
|---|---|
| Auth | `Bearer mock:<userId>`; `GET /_dev/users` lists seeded users for the mock sign-in page; `POST /_dev/users {name, email}` signs up a new person (F01, FE-005) |
| Permissions | Full (same matrix, `03-domain/permissions.md`). This is where frontend gating gets tested |
| Entitlements | Full checks and `402` errors from the seeded plans |
| Billing | `manual` adapter: checkout returns `/_dev/checkout?plan=…`, which switches the plan immediately |
| Jobs | Executed immediately, one at a time per type, via the engine HTTP transport. Progress relayed. Cancel closes the stream |
| Ingestion | Lines, questions, log kept as arrays per run (no DB). Paging and filters done in memory |
| Scheduler | Core tasks and module-registered tasks every 10 s against the mock clock |
| Search, audit | Audit events appended. Filters in memory |
| Email | Outbox files |

## Interim engine path (before EN-001 lands)

If the worker HTTP transport is not ready yet, the mock can call the PoC dev API
(`engine/ifc_boq/api.py`, port 8787):
- parse: `POST /api/models` (multipart, synchronous). Simulate progress stages on a timer.
- run: write the resolved preset docs with `PUT /api/presets/{kind}/{id}` under ids
  `mock-<presetVersionId>` (saved in `presets/user/`), then `POST /api/runs` with those ids
  and the decisions. Overrides and manual items are not supported on this path. Shipped system presets
  (version 1, seeded from `presets/`) are passed by their own id, not saved again; the project
  dictionary's latest published version is appended as the last dictionary; the full `BoqResult` is
  kept gzipped at `orgs/<orgId>/runs/<runId>/result.json.gz` in the blob folder (FE-008). The suites'
  private engine saves these presets in the suite's temp folder (`IFC_BOQ_USER_PRESETS`), not
  `presets/user`.
- names, check, code lists: the matching PoC endpoints.
- check details (F03 §5, the elements of each verification check): the PoC API has no endpoint for
  them, so `PocEngine.checks` reads `verification.checks` from the engine's cache
  (`engine/.cache/models/<sha256>/parsed.json`, or `IFC_BOQ_CACHE`) on the same machine (FE-007).
- names: the PoC sends `null` for the optional `layer`, `dictionary`, `entryId` of unresolved names;
  `PocEngine.names` drops them so responses match `NameUse` and the contract (FE-007).
Drop this path as soon as EN-001 is merged.

## Seed data (`npm run mock:seed`)

| Kind | Seed |
|---|---|
| Plans | free, professional, team, enterprise (values from 00-product/05) |
| Orgs | **Studio Demo** (`studio-demo`, team plan), **Small Firm** (`small-firm`, free plan, at its project limit, for limit testing) |
| Users | Olivia (owner), Ivana (library_editor), Marko (member → estimator), Ana (member → approver), Victor (member → viewer), vendors (pricing module plugin): Bob (Alfa Bau), Bea (Beton d.o.o.), Cem (CityBuild), Dana (linked to both orgs), Pat (platform admin) |
| Vendor links | Studio Demo: Bob, Bea, Cem, Dana active, one pending invitation; Small Firm: Dana active |
| Share links | Duplex "Tender BoQ": one pinned link (active), one revoked, one expired |
| Sessions | Marko has an active session on "Firefox on macOS" so the takeover screen can be tested |
| System presets | Everything in `presets/` (rule sets, classifications, dictionaries, settings) as system-layer presets, version 1 |
| Org presets | "Studio rules" (patch on as-modelled, 3 settings changed, v1 published + a draft), "Studio trades" classification (copy of demo-trades), "Studio names" dictionary (copy of acme-company) |
| Project 1 | **Duplex** (`fixtures/ifc/Ifc2x3_Duplex_Architecture.ifc`): Architecture model v1 and v2 (v2 = modified fixture from EN-008), BoQ "Tender BoQ" with version A saved (on v1) and a working version (on v2) with a few decisions and line edits (a quantity, a text, a move, an exclusion); a second BoQ "Cost check" confirmed. Pricing plugin: an org pricebook (200 items), Bob's and Bea's pricebooks shared with Studio Demo, an estimate on "Tender BoQ" with 10 remembered matches, one open offer request to two vendors (one offer in) |
| Project 2 | **Office (federated)**: architecture + structure pair downloaded by `npm run mock:fetch-fixtures` (NBU office pair from `fixtures/corpus/catalogue.json` URLs, not committed); BoQ working version in `needs_input` |
| Project 3 | **Empty project** (for empty states) |

Seeding runs the real engine (parse + runs), so the seeded numbers are real. It takes a few
minutes once and the result is cached in `.data/`.

## Scripts (product root `package.json`)

| Script | Does |
|---|---|
| `npm run dev:app` | engine (the PoC engine API in phase 1, the worker's HTTP transport from EN-001) + mock API + Next app, concurrently |
| `npm run mock:seed` / `mock:reset` | seed / wipe and reseed |
| `npm run mock:fetch-fixtures` | download the federated pair (optional) |
| `npm run test:contract:mock` | run the contract test suite against the mock |

## Unplugging

1. Java implements the same `openapi.yaml` and passes the same contract suite
   (`08-delivery/testing.md`).
2. Point `NEXT_PUBLIC_API_BASE_URL` (or the dev rewrite) at Java, and switch
   `NEXT_PUBLIC_AUTH_ADAPTER` to the real provider.
3. The mock stays for frontend e2e tests in CI (fast, deterministic) and for demos without a
   backend.

The pricing module is a mock **plugin** (`apps/mock-api/plugins/pricing`), registered only when
`MODULE_PRICING=1`. Its seed data and handlers live there; the core mock runs without it.
