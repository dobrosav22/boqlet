# Database schema (Postgres)

Logical schema for the Java backend. Column types are Postgres types. Every table has
`created_at timestamptz not null default now()`, and mutable tables `updated_at`. Ids are
`uuid` (v7 generated in the application). `PII` marks personal data (security.md, GDPR).
Migrations: Flyway, `V{n}__{name}.sql`.

Fields mirror `03-domain/data-model.md`. Where a column holds an engine document it is
`jsonb` (or a storage key if it can be large).

## Identity and tenancy

| Table | Columns | Keys and indexes |
|---|---|---|
| `users` | id, email (PII), name (PII), locale, company (PII, bidders), auth_subject, deleted_at | unique(lower(email)), unique(auth_subject) |
| `orgs` | id, name, slug, settings jsonb, status (`active`,`deleting`), deleting_at | unique(slug) |
| `memberships` | org_id, user_id, role, last_active_at | pk(org_id, user_id), idx(user_id) |
| `org_invitations` | id, org_id, email (PII), role, token_hash, status, expires_at, invited_by | idx(org_id, status), unique(token_hash) |
| `plans` | id text, name, entitlements jsonb, public bool | pk(id) |
| `subscriptions` | org_id, plan_id, status, trial_ends_at, current_period_end, provider, provider_customer_id, provider_subscription_id, overrides jsonb | pk(org_id) |
| `usage_events` | id, org_id, project_id, job_id, kind, duration_ms, model_bytes, element_count, outcome, at | idx(org_id, at) |
| `billing_events` | id, provider, provider_event_id, type, payload jsonb, processed_at | unique(provider, provider_event_id) |

## Projects and models

| Table | Columns | Keys and indexes |
|---|---|---|
| `projects` | id, org_id, name, code, client, location jsonb, currency, unit_system, locale, status, sample bool, defaults jsonb, project_dictionary_id | idx(org_id, status) |
| `project_members` | project_id, user_id, role, status (`active`,`invited`), invite_email (PII), added_by | pk(project_id, user_id), idx(user_id) |
| `models` | id, project_id, name, discipline, scope jsonb, latest_version_id, archived | idx(project_id) |
| `model_versions` | id, model_id, org_id, number, file_name, size_bytes, sha256, source_key, status, parse_job_id, summary jsonb, artifacts jsonb (parsed/geometry/meshes/scene keys), error jsonb, note, uploaded_by, uploaded_at, deleted_at | unique(model_id, number), idx(org_id, sha256) |

## Library

| Table | Columns | Keys and indexes |
|---|---|---|
| `presets` | id, org_id null, project_id null, layer, kind, slug, name, description, based_on, starred, latest_published_version_id, draft_version_id, archived | unique(coalesce(org_id,'system'), coalesce(project_id,'none'), kind, slug) |
| `preset_versions` | id, preset_id, number null, status, doc jsonb, doc_key null (large code lists), extends_version_id, problems jsonb, change_note, etag, published_by, published_at, updated_by | unique(preset_id, number), idx(preset_id, status) |

## Decisions and adjustments

| Table | Columns | Keys and indexes |
|---|---|---|
| `decisions` | id, project_id, question_id text, kind, answer jsonb, note, decided_by, decided_at, superseded_at null, promoted_to_preset_version_id | unique(project_id, question_id) where superseded_at is null |
| `line_overrides` | id, boq_id, line_key, quantity numeric null, reason, created_by | unique(boq_id, line_key) |
| `manual_items` | id, boq_id, item jsonb (engine ManualItem), codes jsonb, sort_hint, created_by | idx(boq_id) |

## BoQs and runs

| Table | Columns | Keys and indexes |
|---|---|---|
| `boqs` | id, project_id, name, description, current_revision_id, latest_issued_revision_id, archived | idx(project_id) |
| `boq_revisions` | id, boq_id, number, label, status, inputs jsonb, current_run_id, based_on_revision_id, reviewers uuid[], submitted_by/at, approved_by/at, issued_by/at, issue_note, frozen jsonb | unique(boq_id, number); partial unique(boq_id) where status <> 'issued' (BR-21) |
| `review_comments` | id, revision_id, by, text, line_key null, outcome null | idx(revision_id) |
| `runs` | id, revision_id, org_id, job_id, status, request jsonb (or request_key), snapshot_versions jsonb, result_key, xlsx_key, stats jsonb, models jsonb, building jsonb, engine_version, error jsonb, created_by, finished_at | idx(revision_id, created_at) |
| `run_lines` | run_id, line_key, sort_index, rule_id, rule_kind, description, unit, quantity numeric null, source, family, keys jsonb, codes jsonb, location jsonb, tags text[], notes text[], trace jsonb, overridden jsonb null, group_paths jsonb (system → path string, for server-side grouping) | pk(run_id, line_key), idx(run_id, sort_index), gin(group_paths) |
| `run_line_elements` | run_id, line_key, guid, model_version_id, quantity numeric null | idx(run_id, guid), idx(run_id, line_key) |
| `run_questions` | run_id, question_id, kind, blocking, message, code, params jsonb, answer_type jsonb, guids text[], field, raw, occurrences, suggestion jsonb | pk(run_id, question_id) |
| `run_warnings` | run_id, seq, code, message, params jsonb, guids text[], rule_id | pk(run_id, seq) |
| `run_log_entries` | run_id, seq, stage, level, message, code, params jsonb, rule_id, line_key, guid, data jsonb | pk(run_id, seq), idx(run_id, stage), idx(run_id, line_key), idx(run_id, guid) |
| `run_diffs` | id, from_run_id, to_run_id, job_id, diff_key, summary jsonb | unique(from_run_id, to_run_id) |

Size note: a large run (50k lines, 500k line-element links, 200k log entries) is ~1 GB with
indexes. Consider partitioning `run_line_elements` and `run_log_entries` by `run_id` hash, and
a retention policy: keep rows for current, issued and recent runs; old superseded runs keep
only their `result_key` in storage and are rehydrated on demand.

## Tenders

| Table | Columns | Keys and indexes |
|---|---|---|
| `tenders` | id, project_id, boq_id, revision_id, name, currency, deadline, timezone, instructions, sealed, allow_partial, deviation_threshold_pct, shared_with_guests, status, current_addendum int, opened_at, closed_at | idx(project_id), idx(status, deadline) |
| `tender_attachments` | id, tender_id, file_name, storage_key, size_bytes, status, uploaded_by | idx(tender_id) |
| `tender_addenda` | id, tender_id, number, revision_id, note, affected_package_ids uuid[], line_changes jsonb, created_by | unique(tender_id, number) |
| `tender_packages` | id, tender_id, name, code, selection jsonb, status, awarded_offer_id, award_note | idx(tender_id) |
| `package_lines` | id, package_id, addendum_number, line_key, sort_index, code, group_path jsonb, description, unit, quantity numeric null, source, notes text[], changed_in_addendum | unique(package_id, addendum_number, line_key) |
| `tender_line_assignments` | tender_id, line_key, package_id | pk(tender_id, line_key) (enforces BR-41) |
| `bid_invitations` | id, package_id, tender_id, email (PII), company_name (PII), contact_name (PII), user_id null, token_hash, status, decline_reason, last_activity_at | idx(package_id), idx(user_id), unique(token_hash) |
| `offers` | id, invitation_id, addendum_number, status, total numeric(18,4), notes, qualifications, valid_until, source, submitted_at, etag, last_import_report jsonb | idx(invitation_id, status) |
| `offer_lines` | offer_id, package_line_id, line_key, rate numeric(18,4) null, amount numeric(18,2) null, note, carried_from_addendum | pk(offer_id, line_key) |

## Platform

| Table | Columns | Keys and indexes |
|---|---|---|
| `jobs` | id, org_id, project_id, type, pool, priority, status, progress jsonb, input jsonb, output jsonb, error jsonb, attempts, max_attempts, cancel_requested, worker_id, heartbeat_at, subject_type, subject_id, created_by, started_at, finished_at, contract_version | idx(status, pool, priority, created_at) where status = 'queued', idx(subject_type, subject_id) |
| `exports` | id, org_id, project_id, kind, subject_type, subject_id, file_name, storage_key, size_bytes, job_id, created_by | idx(subject_type, subject_id) |
| `notifications` | id, user_id, org_id, kind, params jsonb, entity_type, entity_id, url, read_at | idx(user_id, created_at desc), idx(user_id) where read_at is null |
| `notification_preferences` | user_id, email jsonb | pk(user_id) |
| `audit_events` | id, org_id, project_id, actor_id, actor_kind, action, entity_type, entity_id, data jsonb, ip (PII) | idx(org_id, created_at desc), idx(project_id, created_at desc); append-only (no UPDATE/DELETE grants for the app role except org deletion job) |
| `idempotency_keys` | key, user_id, endpoint, status, response jsonb | pk(key, user_id), TTL cleanup 24 h |

## Worker access

The Python worker connects with a role that can only `SELECT … FOR UPDATE SKIP LOCKED` and
`UPDATE` the `jobs` table (columns status, progress, output, error, worker_id, heartbeat_at,
started_at, finished_at) and `NOTIFY`. No other grants.
