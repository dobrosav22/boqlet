# Backend tasks (Java, `services/api`)

**Owner: the backend agent, in phase 2** (`milestones.md`), after the frontend agent's phase 1
on the mock. Order: BE-000 → the engine tasks (`tasks-engine.md`, milestone ME) → M5 → M6 → M7
→ MP2 (optional). The contract and scenario suites written in phase 1 are the specification:
make them pass against Java without changing them; a suite that looks wrong goes to the owner.

Start with **BE-000**. Every task is done when the contract suite passes for its endpoints
(08-delivery/testing.md), and when its Policy and state-machine unit tests cover every row of
`03-domain/permissions.md` and `state-machines.md` that it touches.

### BE-000 Decisions (stop and ask)
Present `07-backend/decisions-to-make.md` D1–D9 to the owner and record the answers (README
decisions table, docs/02). **No code before this.**

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

