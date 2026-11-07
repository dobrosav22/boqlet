# Backend tasks (Java, `services/api`)

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

### BE-003 Orgs, members, invitations (F01)
Including slug rules, last-owner rule, invitation emails through the notifications module
(stub email adapter until BE-020). `GET/PUT /orgs/{orgId}/setup` (F16): one `Org.setup` JSON
per org, writable by owner, admin and library editor.

### BE-004 Entitlements core (F14 part)
Plans seed, subscriptions (free on org creation), `EntitlementService.check`, `402` mapping,
`GET /orgs/{orgId}/entitlements`, usage events table and `GET /orgs/{orgId}/usage`.

### BE-005 Projects (F02)
Projects, members, guests, defaults, project dictionary creation, archive/unarchive, attention
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
Decisions upsert with dryRun (affected revisions), clear, promote (publishes a dictionary
version), overrides, manual items; revision reopen rules (BR-23).

### BE-010 BoQs and revisions (F04, F09)
BoQ create (revision A with defaults), inputs, pending changes, state machine (submit,
request changes, approve, issue with frozen export, reopen), new revision, comments.

### BE-011 Runs and ingestion (F04, F06, F07)
Run job input builder (engine-worker.md), ingestion with COPY into `run_*` tables, lines
paging with filters and server-side grouping, line detail, questions joined with decisions,
warnings, log paging, element lines, coverage.

### BE-012 Diffs and exports (F08, F12)
Compare (cached diff or diff job), diff lines/elements paging, export jobs, downloads,
issued frozen export, CSV exports (decisions, audit).

### BE-013 Queue transport
Switch job execution to the Postgres queue (EN-009 workers): `LISTEN job_finished`, sweeper
for dead jobs, retries with backoff, pools and priority.

### BE-014 SSE
`GET /events` with per-user fan-out, ring buffer replay, `NOTIFY`-based cross-instance
delivery (D5), heartbeats; emits `job.progress`, `job.finished`, `entity.changed`,
`notification.created`.

### BE-015 Notifications (in-app)
Notification rows for every kind in F13, batching, `GET /notifications`, read endpoints.

### BE-016 Tenders core (F11 firm §1–5)
Tenders, attachments, packages with selection resolution and `tender_line_assignments`
(BR-41), preview-selection, from-groups, invitations (token hash, emails), open (package-line
snapshot, `code` and `description` from `textSystem`, P14), status board (sealed-aware), remind, extend, close, cancel, scheduler for deadlines.

### BE-017 Addenda (F11 §5)
Addendum with dryRun, re-snapshot, supersede offers, carry rates, notifications.

### BE-018 Comparison and award (F11 §6–7)
Comparison query with `BigDecimal`, flags, sealed enforcement (`409 sealed_until_close`),
export job, award with notifications.

### BE-019 Bidder endpoints (F11 bidder)
Token preview/accept, `/bids/*`, offer drafts with ETag, submit validation (BR rules), withdraw,
decline/reconsider, package xlsx (export_package job, cached per addendum), offer import job.

### BE-020 Email
Email adapter (D6), templates per notification kind (i18n-ready), outbox table with retries,
unsubscribe per category.

### BE-021 Billing adapter (F14)
`manual` adapter + the provider adapter (D7): checkout, portal, webhook verification, event
idempotency, subscription sync job.

### BE-022 Scheduler
Leader election (advisory lock) and the scheduled tasks list (storage-jobs-realtime.md).

### BE-023 Security isolation suite
Automated cross-tenant, role and bidder access tests over **every** endpoint (v1 criterion 8).

### BE-024 Retention and deletion
Org deletion job (BR-52), old-run row pruning with rehydration from `result_key`, export
retention, audit retention per plan.

### BE-025 Observability and ops
Structured logs, OpenTelemetry, metrics and alerts from deployment.md, backups and restore test.

### BE-026 Staging acceptance
Run all v1 acceptance criteria on staging; record results in `plan/README.md` status.
