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
| `boqs` | boqs, boq_revisions, review_comments | Revision state machine, inputs, pending changes, submit/approve/issue |
| `runs` | runs, run_lines, run_line_elements, run_questions, run_warnings, run_log_entries, run_diffs | Building run job input, ingestion, paging/grouping queries, coverage, compare |
| `tenders` | tenders, tender_attachments, tender_addenda, tender_packages, package_lines, bid_invitations, offers, offer_lines | Tender state machine, selection resolution, addenda, sealed rules, comparison, award, bidder endpoints |
| `exports` | exports | Export jobs, frozen exports, downloads |
| `jobs` | jobs | Enqueue, watch (LISTEN), dispatch ingestion to the owning module, retries, cancel, dead-job re-queue |
| `notifications` | notifications, notification_preferences, sse ring buffer | In-app notifications, email rendering/sending (adapter), SSE fan-out |
| `audit` | audit_events | Append-only writer used by all modules, queries |
| `storage` | — | S3 client, signed URLs, key layout |
| `engine` | — | rpc client (timeouts, circuit breaker), job input builders shared by runs/library/tenders |
| `scheduler` | — | Scheduled tasks (storage-jobs-realtime.md), leader election via advisory lock |

## Cross-cutting

- **Request context:** `(userId, orgId?, projectRole?, bidderInvitationId?)`, resolved once per
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

### Issue
Transaction: check policy, four-eyes, state `approved`, no pending changes → set `issued`,
freeze (`frozen_run_id`, copy of overrides/manual items as JSON), enqueue `export_xlsx` with
issued meta → on finish, attach the export id to `frozen.exportIds`. Audit and notify.

### Tender comparison
SQL over `package_lines` × `offer_lines` for the package's latest addendum and submitted offers.
Median and lowest are computed in SQL or Java with `BigDecimal`. Flags against
`deviation_threshold_pct`. **Sealed:** if `tender.sealed` and status `open`, return
`409 sealed_until_close` for comparison and strip totals from the status board (BR-44). A test
asserts no firm endpoint leaks rates before close.

### Addendum
For each package: re-apply the `selection` to the new revision's current run lines →
new `package_lines` with `addendum_number + 1` → compare with the previous lines by
`line_key` (added/removed/changed) → mark affected packages → supersede their offers
(`superseded`), create new drafts carrying rates by `line_key` + same unit → notify.

## Testing (backend)

- Unit tests per Policy and state machine (tables of role × state × action).
- Integration tests with Testcontainers (Postgres, MinIO) and a **fake engine worker** that
  answers jobs from recorded outputs (fixtures produced by the real engine, checked in).
- The shared **contract suite** (08-delivery/testing.md) against the running service.
- One nightly end-to-end run with the real Python worker on the Duplex (v1 acceptance 1).
