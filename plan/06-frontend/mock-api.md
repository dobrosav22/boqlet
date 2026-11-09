# Mock API (`apps/mock-api`)

A Node service that implements `openapi.yaml` well enough to build and test the whole frontend
before the Java backend exists (P11). CRUD state lives in a JSON file. Computation goes to the
**real Python engine** through the worker contract's HTTP transport
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
| Engine | HTTP transport: `POST {ENGINE_URL}/jobs/{type}` (NDJSON progress → SSE `job.progress`), `POST {ENGINE_URL}/rpc/{op}`. Engine storage root = the mock's blob folder (`ENGINE_STORAGE=file://…/.data/blobs`) |
| SSE | In-process event bus → `GET /api/v1/events` |
| Email | Written to `.data/outbox/*.html` and listed at `GET /_dev/outbox` (dev page) |
| Clock | `GET/POST /_dev/clock` to move time forward (invitation and session expiry; module deadlines) |
| Port | 4010 |

## What it implements

Everything in `openapi.yaml`, with these simplifications:

| Area | Mock behaviour |
|---|---|
| Auth | `Bearer mock:<userId>`; `GET /_dev/users` lists seeded users for the mock sign-in page |
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
  and the decisions. Overrides and manual items are not supported on this path.
- names, check, code lists: the matching PoC endpoints.
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
| Project 2 | **Office (federated)**: architecture + structure pair downloaded by `npm run mock:fetch-fixtures` (NBU office pair from `fixtures/corpus/catalogue.json` URLs, not committed); BoQ Rev A draft in `needs_input` |
| Project 3 | **Empty project** (for empty states) |

Seeding runs the real engine (parse + runs), so the seeded numbers are real. It takes a few
minutes once and the result is cached in `.data/`.

## Scripts (root `package.json`)

| Script | Does |
|---|---|
| `npm run dev:app` | engine (HTTP transport) + mock API + Next app, concurrently |
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
