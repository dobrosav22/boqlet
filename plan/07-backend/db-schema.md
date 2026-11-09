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
| `users` | id, email (PII), name (PII), locale, platform_role null, auth_subject, deleted_at | unique(lower(email)), unique(auth_subject) |
| `sessions` | id, user_id, status, device_label, place (PII), last_seen_at, replaced_by_session_id, ended_at | partial unique(user_id) where status = 'active' (BR-54), idx(user_id, created_at desc) |
| `orgs` | id, name, slug, settings jsonb (incl. approvalRequired, fourEyes, formats), setup jsonb, status (`active`,`suspended`,`deleting`), tags text[], deleting_at | unique(slug) |
| `limit_events` | id, org_id, user_id, limit_name, current, max, action, at | idx(org_id, at), idx(at) |
| `admin_notes` | id, org_id, author_id, text | idx(org_id, created_at desc) |
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
| `project_members` | project_id, user_id, role, added_by | pk(project_id, user_id), idx(user_id) |
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
| `line_overrides` | id, boq_id, line_key, quantity numeric null, quantity_set bool, description, unit, codes jsonb, sort_after text null, excluded bool, reason, created_by, updated_by | unique(boq_id, line_key) |
| `share_links` | id, boq_id, org_id, mode, run_id null, include jsonb, label, token_hash, expires_at, revoked_at, revoked_by, views int, last_viewed_at, created_by | unique(token_hash), idx(boq_id), idx(org_id) |
| `manual_items` | id, boq_id, item jsonb (engine ManualItem), codes jsonb, sort_hint, created_by | idx(boq_id) |

## BoQs and runs

| Table | Columns | Keys and indexes |
|---|---|---|
| `boqs` | id, project_id, name, description, status (`working`,`confirmed`), confirmed_by, confirmed_at, current_revision_id, latest_issued_revision_id, archived | idx(project_id) |
| `boq_revisions` | id, boq_id, number, label, status, inputs jsonb, current_run_id, based_on_revision_id, reviewers uuid[], submitted_by/at, approved_by/at, issued_by/at, issue_note, open_questions_at_save int, frozen jsonb (incl. position numbers) | unique(boq_id, number); partial unique(boq_id) where status <> 'issued' (BR-21) |
| `review_comments` | id, revision_id, by, text, line_key null, outcome null | idx(revision_id) |
| `runs` | id, revision_id, org_id, job_id, status, request jsonb (or request_key), snapshot_versions jsonb, result_key, xlsx_key, stats jsonb, models jsonb, building jsonb, engine_version, error jsonb, created_by, finished_at | idx(revision_id, created_at) |
| `run_lines` | run_id, line_key, sort_index, rule_id, rule_kind, description, unit, quantity numeric null, source, family, keys jsonb, codes jsonb, location jsonb, tags text[], notes text[], trace jsonb, overridden jsonb null, position_no text, group_paths jsonb (system → path string, for server-side grouping) | pk(run_id, line_key), idx(run_id, sort_index), gin(group_paths) |
| `run_line_elements` | run_id, line_key, guid, model_version_id, quantity numeric null | idx(run_id, guid), idx(run_id, line_key) |
| `run_questions` | run_id, question_id, kind, blocking, message, code, params jsonb, answer_type jsonb, guids text[], field, raw, occurrences, suggestion jsonb | pk(run_id, question_id) |
| `run_warnings` | run_id, seq, code, message, params jsonb, guids text[], rule_id | pk(run_id, seq) |
| `run_log_entries` | run_id, seq, stage, level, message, code, params jsonb, rule_id, line_key, guid, data jsonb | pk(run_id, seq), idx(run_id, stage), idx(run_id, line_key), idx(run_id, guid) |
| `run_diffs` | id, from_run_id, to_run_id, job_id, diff_key, summary jsonb | unique(from_run_id, to_run_id) |

Size note: a large run (50k lines, 500k line-element links, 200k log entries) is ~1 GB with
indexes. Consider partitioning `run_line_elements` and `run_log_entries` by `run_id` hash, and
a retention policy: keep rows for current, issued and recent runs; old superseded runs keep
only their `result_key` in storage and are rehydrated on demand.

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

## Pricing module: schema `pricing` (removable, P36)

Own Flyway location (`db/migration-pricing`), applied only when the module is installed. Foreign
keys point only from `pricing.*` to core tables, `ON DELETE CASCADE`. `DROP SCHEMA pricing
CASCADE` removes the module's data and leaves the core intact. The core never joins these tables.

| Table | Columns | Keys and indexes |
|---|---|---|
| `pricing.module_settings` | org_id, settings jsonb | pk(org_id) |
| `pricing.vendor_profiles` | user_id, company (PII), trades text[], phone (PII) | pk(user_id) |
| `pricing.vendor_links` | id, org_id, vendor_user_id null, email (PII), company_name (PII), contact_name (PII), trades text[], status, shared_pricebook_id null, token_hash, invited_by, accepted_at, removed_at | partial unique(org_id, lower(email)) where status <> 'removed', idx(vendor_user_id), unique(token_hash) |
| `pricing.pricebooks` | id, owner_kind (`org`,`vendor`), owner_id, name, currency, description, created_by | idx(owner_kind, owner_id) |
| `pricing.pricebook_items` | id, pricebook_id, ref, description, unit, rate numeric(18,4), trade, tags text[], price_date, notes | idx(pricebook_id), gin(to_tsvector(description)), idx(pricebook_id, unit) |
| `pricing.pricebook_item_history` | item_id, rate, price_date, changed_by, changed_at | idx(item_id, changed_at desc) |
| `pricing.price_matches` | id, owner_kind, owner_id, for_org_id null, key jsonb, key_hash, pricebook_item_id, created_by | unique(owner_kind, owner_id, coalesce(for_org_id,'none'), key_hash) |
| `pricing.estimates` | id, boq_id, currency, tax_pct, exchange_rates jsonb | unique(boq_id) |
| `pricing.estimate_lines` | estimate_id, line_key, rate numeric(18,4) null, source jsonb, price_date, note | pk(estimate_id, line_key) |
| `pricing.estimate_snapshots` | revision_id, lines jsonb, totals jsonb, taken_at | pk(revision_id) |
| `pricing.offer_requests` | id, org_id, project_id, boq_id, revision_id, run_id, name, message, deadline, timezone, currency, text_system, allow_partial, deviation_threshold_pct, selection jsonb, current_update int, status, created_by, closed_at | idx(project_id), idx(status, deadline) |
| `pricing.offer_request_attachments` | id, request_id, file_name, storage_key, size_bytes, uploaded_by | idx(request_id) |
| `pricing.offer_request_lines` | request_id, update int, line_key, position_no, code, group_path jsonb, description, unit, quantity numeric null, source, notes text[], changed_in_update | pk(request_id, update, line_key) |
| `pricing.offer_invitations` | id, request_id, vendor_link_id, status, decline_reason, last_activity_at | unique(request_id, vendor_link_id) |
| `pricing.offers` | id, invitation_id, update int, status, total numeric(18,4), notes, qualifications, valid_until, exchange_rate numeric null, source, submitted_at, etag, last_import_report jsonb | idx(invitation_id, status) |
| `pricing.offer_lines` | offer_id, line_key, rate numeric(18,4) null, amount numeric(18,2) null, note, pricebook_item_id null | pk(offer_id, line_key) |

