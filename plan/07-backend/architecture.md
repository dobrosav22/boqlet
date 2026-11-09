# Backend architecture (Java)

Location: `services/api`. Implements `openapi.yaml` exactly and passes the same contract test
suite as the mock. **Read `decisions-to-make.md` first and ask the owner.** Defaults below
assume the recommendations there (Spring Boot 3, Java 21, Postgres, jOOQ/Spring Data JDBC,
Flyway, Postgres job table).

## Shape: a modular monolith

One deployable, with modules that own their tables and talk through Java interfaces (no
cross-module table access). They can be split later if ever needed.

| Module | Owns (tables) | Main responsibilities |
|---|---|---|
| `identity` | users | Auth integration (D1), `GET /me`, just-in-time user creation |
| `orgs` | orgs, memberships, org_invitations | Orgs, members, invitations, org settings |
| `entitlements` | plans, subscriptions, usage_events | Plans, effective limits, `EntitlementService.check`, usage, billing adapter, webhooks |
| `projects` | projects, project_members | Projects, membership, defaults, archive, attention list |
| `models` | models, model_versions | Upload instructions, complete, dedupe, version lifecycle, scene/geometry URLs |
| `library` | presets, preset_versions | CRUD, drafts with ETag, publish, check (rpc), preview (job), usage, terms, code-list import (rpc) |
| `decisions` | decisions, line_overrides, manual_items | Decisions upsert/dry-run, promote, adjustments |
| `boqs` | boqs, boq_revisions, review_comments | BoQ and version state machines, inputs, pending changes, save version, optional review/approval, confirm/reopen, position numbers, live edit events |
| `runs` | runs, run_lines, run_line_elements, run_questions, run_warnings, run_log_entries, run_diffs | Building run job input, ingestion, paging/grouping queries, coverage, compare |
| `exports` | exports | Export jobs, frozen exports, downloads |
| `jobs` | jobs | Enqueue, watch (LISTEN), dispatch ingestion to the owning module, retries, cancel, dead-job re-queue |
| `notifications` | notifications, notification_preferences, sse ring buffer | In-app notifications, email rendering/sending (adapter), SSE fan-out |
| `audit` | audit_events | Append-only writer used by all modules, queries |
| `storage` | — | S3 client, signed URLs, key layout |
| `engine` | — | rpc client (timeouts, circuit breaker), job input builders shared by runs/library (modules add their own) |
| `scheduler` | — | Scheduled tasks (storage-jobs-realtime.md), leader election via advisory lock |
| `extensions` | — | Core extension interfaces and registries (modules.md): notifications, audit actions, entitlement keys, admin metrics, `me` extensions, scheduled tasks; public read services (`BoqReadService`, `ExportDataService`, `IdentityService`) and core events |
| **`pricing`** (module, removable) | schema `pricing` | Vendors, pricebooks, estimates, offer requests, vendor endpoints; depends on core only through `extensions` (P36). Packaged as a separate Gradle/Maven module; the service builds and runs without it |

## Cross-cutting

- **Request context:** `(userId, sessionId, orgId?, projectRole?)` (the pricing module adds its own vendor context), resolved once per
  request. Repository methods take the context. A query helper adds `org_id = :orgId` (BR-50).
  Endpoints for another org's resource return `404`.
- **Permission checks:** one `Policy` class per module, mapping (role, state) → allowed, from
  `03-domain/permissions.md`. It also fills the `permissions` objects in responses, so the UI
  and enforcement never drift.
- **State machines:** explicit transition tables per entity (`state-machines.md`). Invalid
  transitions → `409 invalid_transition`.
- **Transactions:** one per request. Jobs are enqueued in the same transaction as the subject
  change (outbox-style), so a failed request never leaves an orphan job.
- **Audit:** `AuditWriter.record(ctx, action, entity, data)` inside the same transaction.
- **Idempotency:** `idempotency_keys(key, user_id, endpoint, response, created_at)` for
  POSTs that start jobs or send emails.
- **Errors:** an exception hierarchy mapped to `{code, message, details}` (conventions.md).
- **Generated contract:** OpenAPI generator, interfaces only (`interfaceOnly=true`); DTOs
  generated. Engine shapes inside DTOs (`BoqLine`, `RuleSet`...) are generated from the same
  JSON Schemas (jsonschema2pojo) or kept as `JsonNode` where the backend only stores and
  forwards them (preset docs, traces). **Prefer `JsonNode` for preset docs:** the backend
  never interprets rules (BR-01).

## Key flows inside the backend

### Generate a run (`POST /revisions/{id}/runs`)
1. Policy: estimator or lead, and the revision is `draft`. Revisions in review or approved
   are not regenerated; reviewers look at the existing run.
2. Entitlements: `processingMinutesPerMonth` not exceeded.
3. Resolve inputs: model versions must be `ready` (else `409 model_not_ready`); load preset
   version docs; for rule-set patches, load the parent chain (exact versions); order
   dictionaries (global → company → project, with the project dictionary's latest published
   version last); load decisions (project), overrides and manual items (BoQ).
4. Build `RunJobInput` (engine-worker.md), insert `runs` (queued, `request` JSON,
   `snapshot_versions`) and `jobs` in one transaction. Audit `run.created`.
5. On `job_finished`: stream `result.json.gz` from storage, validate the top-level shape, bulk
   insert rows (COPY), compute `status`, set `revision.current_run_id` if newer than the
   current one, usage event, notifications, SSE `entity.changed`.

### Pending changes (`BoqRevision.pendingChanges`)
Computed on read by comparing the current run's `request` fingerprint parts (inputs,
decisions hash over the questions the run asked + any new decisions for those ids,
overrides hash, manual-items hash) with current state. Cache per revision, invalidated by
writes to those tables.

### Save version
Transaction: check policy (and, with approval on, state `approved` and four-eyes), no pending
changes → set `issued`, freeze (`frozen_run_id`, copy of line edits and manual lines as JSON,
position numbers), create the next `draft` revision (unless confirming), enqueue `export_xlsx`
with the version's meta → on finish, attach the export id to `frozen.exportIds`. Audit, notify,
publish the core event `version.saved` after commit.

### Live co-editing
Line edits are single-row upserts on `line_overrides` (one row per line key) with
`updated_at`; last write wins per line (BR-29). After commit the backend publishes
`boq.line_edited {boqId, lineKeys, by}` on the BoQ's SSE channel; presence is kept in memory
per instance (heartbeat every 20 s through the SSE connection) and fanned out like other
events.

## Testing (backend)

- Unit tests per Policy and state machine (tables of role × state × action).
- Integration tests with Testcontainers (Postgres, MinIO) and a **fake engine worker** that
  answers jobs from recorded outputs (fixtures produced by the real engine, checked in).
- The shared **contract suite** (08-delivery/testing.md) against the running service.
- One nightly end-to-end run with the real Python worker on the Duplex (v1 acceptance 1).
- A **core-only** build and test run without the `pricing` module on every change (P36).
