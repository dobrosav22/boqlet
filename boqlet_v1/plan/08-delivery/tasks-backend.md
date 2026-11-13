# Backend tasks (Java, `services/api`)

**Owner: the backend agent, in phase 2** (`milestones.md`), after the frontend agent's phase 1
on the mock. Order: BE-000 → the engine tasks (`tasks-engine.md`, milestone ME) → M5 → M6 → M7
(ending with BE-032, staging) → MP2 (optional). Paths are relative to the product root
`boqlet_v1/` (P44); FE-000 already moved the engine there. The contract and scenario suites written in phase 1 are the specification:
make them pass against Java without changing them; a suite that looks wrong goes to the owner.

Start with **BE-000**. In it the backend owner (P47) reviews this whole plan: the tasks below
are the default, and BE-000 may change them. After BE-000 the backend owner's answers in
`07-backend/decisions.md` win over this file. Every task is done when the contract suite passes for its endpoints
(08-delivery/testing.md), and when its Policy and state-machine unit tests cover every row of
`03-domain/permissions.md` and `state-machines.md` that it touches.

### BE-000 Backend review and decisions (the backend owner's entry point, P47)
The backend is owned by whoever runs this phase: the backend owner. BE-000 hands it over. The
agent analyses the backend plan and puts **every** backend decision to the backend owner,
including the ones the plan has already made. The backend owner decides. **No backend code
before this task is done.**
1. **Read:**
   - the build log (the phase-1 summary and every entry: what the mock does, what was faked,
     what was learnt);
   - `04-architecture/`, `05-api/conventions.md` and `07-backend/`;
   - `03-domain/`, this file and `tasks-engine.md`;
   - `testing.md`, `06-frontend/mock-api.md`;
   - the shared suites, and the contracts by tag.
2. **Ask the backend owner first** how they want to go through it:
   - every item in depth;
   - or the open items in depth, and the already-made ones one by one with a short summary.

   Either way, every item gets their answer; none is assumed.
3. **Write the analysis** in `07-backend/review.md`. For each item in `decisions-to-make.md`
   (open D1–D9, already made B1–B16) give:
   - what the plan says and why;
   - what phase 1 showed;
   - the alternatives, with risks, costs and effort;
   - a recommendation;
   - which tasks and documents change with each answer.

   Add the items the analysis finds: gaps, contradictions, risks (for example data volumes from
   nfr.md, GDPR, costs). Each becomes a D-item if open, a B-item if the plan already decided it.
4. **Put the items to the backend owner**, one area at a time:
   - accounts and money first: D1 auth, D8 hosting, D6 email, D7 billing;
   - then the shape: B1–B5, B16;
   - then the rest.

   For each item the answer is "confirm", "change to …" or "defer until <task>, because …".
   Deferring is allowed only when no task before that point depends on the item.
5. **Keep the boundary.** A choice that needs a change to the contracts, the shared suites, a
   product P-decision or a BR rule goes to the product owner, with its cost to the frontend
   (`decisions-to-make.md`, "Fixed for BE-000").
6. **Record:**
   - every answer in `07-backend/decisions.md`;
   - platform-level ones also as P-numbers in `plan/README.md` and in `docs/02-decisions.md`.
7. **Apply** the answers to the plan before any code:
   - `07-backend/architecture.md`, `db-schema.md` and the `04-architecture/` files they touch;
   - this file and `tasks-engine.md` (tasks may be rewritten, split, merged, reordered or
     added; keep the ids of tasks that stay, and give new ones new ids);
   - `milestones.md`, if the order changed;
   - FE-043, if D1 changes what the auth adapter must do;
   - `sessions.md` "Tooling", if the stack changed.

   Then check the cross-references (task ids, P, D and B numbers) and lint the contracts.
8. **Write the BE-000 entry** in the build log: the decisions in short, and what changed in the
   plan. Then set Current position to the first task of the (possibly new) order.

- **Accept:**
  - `07-backend/review.md` exists;
  - every D- and B-item, including the added ones, has a recorded answer from the backend owner
    in `07-backend/decisions.md`;
  - the backend plan and task lists agree with the answers;
  - the contracts and the shared suites are unchanged, unless the product owner approved a
    change and it is listed;
  - no backend code was written before this.

### BE-001 Service skeleton
Spring Boot (or the chosen framework) project in `services/api`; OpenAPI generator
(interfaces + DTOs from `packages/api/openapi.yaml`); Flyway; Testcontainers (Postgres,
MinIO); request context; error mapping; idempotency keys; audit writer; health endpoints;
Dockerfile; CI job.

### BE-002 Identity (auth integration per D1)
Token or session validation, just-in-time users, `GET/PATCH /me`, notification preferences.

### BE-027 Sessions (F01 §10, BR-54)
`sessions` table, `POST /sessions` with takeover, `GET/DELETE /sessions/current`, a request
filter rejecting non-active sessions with `401 session_replaced`, idle expiry, `session.revoked`
on SSE (with BE-014), provider session revocation where available, audit `session.replaced`.

### BE-003 Orgs, members, invitations (F01)
Including slug rules, last-owner rule, invitation emails through the notifications module
(stub email adapter until BE-020). `GET/PUT /orgs/{orgId}/setup` (F16): one `Org.setup` JSON
per org, writable by owner, admin and library editor.

### BE-004 Entitlements core (F14 part)
Plans seed, subscriptions (free on org creation), `EntitlementService.check`, `402` mapping,
`GET /orgs/{orgId}/entitlements`, usage events table and `GET /orgs/{orgId}/usage`.

### BE-005 Projects (F02)
Projects, members (org members only, P28), defaults, project dictionary creation, archive/unarchive, attention
list, project audit endpoint.

### BE-006 Storage and models (F03)
Storage module (S3, signed URLs, multipart), model and version endpoints, complete (HEAD,
header check), dedupe by sha256 within org, scene/geometry redirects.

### BE-007 Jobs core
Jobs table, enqueue in transaction, `GET /jobs/{id}`, cancel, ingestion dispatch by type. In
M5, jobs run through the engine **HTTP transport** (synchronous worker call from a background
executor). Switching to the queue is BE-013.

### BE-008 Library (F10)
Presets, versions, drafts with ETag, publish (engine rpc check must be clean), check, terms,
code-list read/build proxies, usage, archive; system presets seeded from `presets/` by a
migration-time loader.

### BE-009 Decisions and adjustments (F05, F06 §6–7)
Line edits with every field of `LineOverrideInput` (unit needs quantity, reasons where required),
`/overrides/batch` (all or nothing), ordering by `sortAfter` when serving lines.
Decisions upsert with dryRun (affected revisions), clear, promote (publishes a dictionary
version), overrides, manual items; revision reopen rules (BR-23).

### BE-010 BoQs and versions (F04, F09)
BoQ create (working version with defaults), inputs, pending changes, save version (frozen
export, position numbers, next working version in one transaction), BoQ confirm/reopen
(`409 boq_confirmed`), optional approval (submit, request changes, approve, four-eyes, review
withdrawn), comments; position numbers on line queries (BR-28); `boq.line_edited` and presence
events (BR-29); core events `run.completed`, `version.saved`, `boq.confirmed`, `boq.reopened`.

### BE-011 Runs and ingestion (F04, F06, F07)
Run job input builder (engine-worker.md), ingestion with COPY into `run_*` tables, lines
paging with filters and server-side grouping, line detail, questions joined with decisions,
warnings, log paging, element lines, coverage.

### BE-012 Diffs and exports (F08, F12)
Compare (cached diff or diff job), diff lines/elements paging, export jobs, downloads,
saved-version frozen export, CSV exports (decisions, audit), BoQ edits import job and its report,
preset template download/import through the engine rpc (F10 §14).

### BE-013 Queue transport
Switch job execution to the Postgres queue (EN-009 workers): `LISTEN job_finished`, sweeper
for dead jobs, retries with backoff, pools and priority.

### BE-014 SSE
`GET /events` with per-user fan-out, ring buffer replay, `NOTIFY`-based cross-instance
delivery (D5), heartbeats; emits `job.progress`, `job.finished`, `entity.changed`,
`notification.created`.

### BE-015 Notifications (in-app)
Notification rows for every kind in F13, batching, `GET /notifications`, read endpoints.

### BE-029 Share links (F18)
`share_links`, create (token shown once, hash stored), list, edit, revoke, org list, org setting
`publicLinksAllowed`; public endpoints without auth (token resolution, includes, pinned vs
latest saved, signed URLs), rate limits, view counting, audit; automated check that public
responses carry no forbidden fields (BR-56).

### BE-030 Platform admin (F19)
`platform_role`, `/admin/*` behind a dedicated guard returning `404`, `limit_events` written by
`EntitlementService`, `admin_notes`, org tags and suspension, plan/trial/overrides through the
manual billing provider, ending a user's session, nightly aggregates for overview and funnel
(first occurrence per org from audit events), CSV export; audit with `actorKind:
"platform_admin"`; a test that no admin query selects content columns (BR-57).

### BE-031 Extension interfaces and core events (P36, modules.md)
Interfaces and registries (notification kinds, audit actions, entitlement keys, admin metrics,
`me` extensions, scheduled tasks, account kinds), read services (`BoqReadService`,
`ExportDataService`, `IdentityService`), in-process core events published after commit; an
ArchUnit test that no core package depends on a module package; the core-only CI job.

### BE-020 Email
Email adapter (D6), templates per notification kind (i18n-ready), outbox table with retries,
unsubscribe per category.

### BE-021 Billing adapter (F14)
`manual` adapter + the provider adapter (D7): checkout, portal, webhook verification, event
idempotency, subscription sync job.

### BE-022 Scheduler
Leader election (advisory lock) and the scheduled tasks list (storage-jobs-realtime.md).

### BE-023 Security isolation suite
Automated cross-tenant and role access tests over **every** core endpoint (v1 criterion 8);
the pricing module adds vendor and module-off cases for its endpoints (BE-P4).

### BE-024 Retention and deletion
Org deletion job (BR-52), old-run row pruning with rehydration from `result_key`, export
retention, audit retention per plan.

### BE-032 Staging environment (D8, deployment.md)
- Needs from the owner: the hosting account in the provider and region chosen in D8, with
  credentials the agent can use (`09-open-questions.md` "Needed by").
- Set up staging as code (the tool chosen in D8; recorded in the build log):
  - the services and configuration of deployment.md, with managed Postgres and object storage;
  - the engine worker pools and rpc.
- CI deploys `v_1` to staging after the suites pass (`main` after the release, P46). Seed staging with the corpus reference
  projects.
- Leave BE-025 and BE-026 ready to run, so phase 3 can use them.
**Accept:**
- staging runs Java + worker + web from `v_1`;
- the contract and scenario suites pass against staging;
- a Duplex BoQ is generated on staging.

### BE-025 Observability and ops
Structured logs, OpenTelemetry, metrics and alerts from deployment.md, backups and restore test.

### BE-026 Staging acceptance
Run all v1 acceptance criteria on staging; record results in `plan/README.md` status.

## Pricing module (removable, P36): backend module `pricing`

A separate Gradle/Maven module and Flyway location (schema `pricing`). Start after M7 or in
parallel once BE-031 exists. Implements `openapi-pricing.yaml`.

### BE-P1 Vendors (F17)
Vendor profiles, links with invitations, accept, leave, shared price list per link, module
settings, module-off handling (`404` per org), entitlement `pricingModule`.

### BE-P2 Pricebooks and estimates (F20)
Pricebooks and items with history, batch edits, Excel template and import through the engine
(`pricing.import_pricebook`), price search (own + shared lists, unit filter, full text),
remembered matches, estimates (fill remembered, set/clear rates, exchange rates, totals with
`BigDecimal`), snapshot on `version.saved`, estimate export (`pricing.export_estimate` using
`ExportDataService`).

### BE-P3 Offer requests and offers (F11)
Send (selection resolution through `BoqReadService`, frozen lines, invitations), updates on
`run.completed` (re-freeze, supersede, carry rates), remind, close/extend/cancel, scheduler
tasks (deadlines, reminders), comparison (median, lowest, flags, estimate column), vendor
endpoints (offer drafts with ETag, fill from pricebook, submit, withdraw, decline, Excel
export/import jobs), notifications and audit actions registered through BE-031.

### BE-P4 Module isolation
Vendor and cross-org tests over every `/pricing/*` endpoint (BR-46, BR-55); module-off and
module-absent runs: the core contract suite passes with the module removed (BR-41).

