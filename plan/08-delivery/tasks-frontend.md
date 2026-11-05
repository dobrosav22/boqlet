# Frontend tasks (`apps/app`, `apps/mock-api`, `packages/api`)

Each task: specs to read, what to build, acceptance. Every screen handles loading, empty,
error and read-only states (02-flows/screens.md). Every UI string goes through i18n (F15).
Every task adds or extends Playwright e2e coverage of its flow against the mock + engine.

## M0 Contract and scaffolding

### FE-001 Contract package
- Move `plan/05-api/openapi.yaml` to `packages/api/openapi.yaml` (fix `$ref` prefix to
  `../types/schema/`), leave a pointer in `plan/05-api/`. Add `redocly.yaml`, `npm run api:lint`,
  `npm run api:gen` (openapi-typescript → `packages/api/src/schema.d.ts`), and the
  `openapi-fetch` client factory exported from `@ifc-boq/api`.
- Confirm with the owner: styling choice (Tailwind + Radix recommended), Next.js version.
- **Accept:** lint passes; types generated; CI step fails on contract drift.

### FE-002 Next app skeleton
- `apps/app` per 06-frontend/architecture.md: route groups, providers (QueryClient,
  next-intl with `en` + `en-XA`), design tokens, app shell (top bar, left nav), error and
  not-found pages, `can()` helper, `ApiError` + global handlers (401/402/404/409), dev rewrite
  `/api/v1` → mock.
- **Accept:** `npm run dev:app` serves the shell; the lint rule blocks a literal string in JSX.

### FE-003 Mock API skeleton
- `apps/mock-api` per 06-frontend/mock-api.md: Hono server, OpenAPI validation, JSON store,
  blob folder with signed URL emulation, SSE bus, dev endpoints (`/_dev/users`, `/_dev/clock`,
  `/_dev/outbox`, `/_dev/checkout`), seed script skeleton with plans, orgs, users and system
  presets from `presets/`.
- **Accept:** `GET /me` with `mock:<userId>` returns the seeded memberships; invalid requests
  get `400` from validation.

### FE-004 Auth adapter (mock) and realtime client
- `AuthAdapter` interface, mock adapter with a user picker sign-in page; SSE client with
  reconnect and `Last-Event-ID`; invalidation map.
- **Accept:** switching seeded users changes `GET /me`; a `/_dev/emit` event invalidates the
  right query.

## M1 Core loop

### FE-005 Onboarding, orgs, members (F01)
Screens S01–S04, S21, S22. Mock: org endpoints, invitations, outbox emails.
**Accept:** F01 acceptance criteria against the mock.

### FE-006 Projects and dashboard (F02)
Screens S05–S07, S17, S18. Mock: projects, members, attention, audit.
**Accept:** F02 criteria; sample project creation (FL-1 step 5).

### FE-007 Models and uploads (F03)
Screens S08–S10 (without viewer tab). Upload with progress (single and multipart), complete,
live parse progress from SSE, input-check report, names preview. Mock: parse job via the engine.
**Accept:** F03 criteria 1–4, 6.

### FE-008 BoQ create, setup, generate (F04)
S11, S12 header, Setup tab, run history (S12h basic). Preset pickers with versions. Generate
with progress, needs-input state, pending-changes indicator.
**Accept:** F04 criteria.

### FE-009 BoQ sheet (F06 §1–5, 8–11)
Virtualised grouped table, group-by switch, columns, filters, line detail panel with trace
(readable formula via the ported `readable.ts`), warnings bar, log tab.
**Accept:** F06 criteria 1, 2, 5.

### FE-010 Questions and decisions (F05)
S12b with answer controls per `AnswerType`, bulk answer, dryRun warning, "N answers not applied
– Regenerate", term picker; S13 decisions page; promote (library editors).
**Accept:** F05 criteria 1, 3, 4 (5 after M2).

### FE-011 Overrides and manual lines (F06 §6–7)
Override dialog, struck-through engine value, manual line form (formula check via
`/presets/check`), edit/delete. Depends on EN-003, EN-007.
**Accept:** F06 criteria 3, 4.

### FE-012 Viewer (F07)
Port `SceneView.ts`/`links.ts`; multi-model load; line ↔ element; element panel; colour modes
coverage/code/source/model; storey filter, section box, isolate/hide; "Show in 3D" entry
points (sheet, questions, checks).
**Accept:** F07 criteria.

### FE-013 Exports (run Excel) (F12 part)
Export button, job toast, download.
**Accept:** a Duplex run downloads an xlsx that opens and matches the sheet totals.

### FE-014 Notifications (F13 part)
Bell, list page, toasts for own jobs, preferences page.
**Accept:** F13 criterion 1.

### FE-015 Entitlement UX (F14 part)
Limit dialog on 402, usage page (S24), billing page (S23) with the manual adapter.
**Accept:** the Small Firm seed shows the dialog on "New project"; checkout on `/_dev/checkout` lifts the limit.

### FE-016 Duplex end-to-end test
Playwright: sign in → create project → upload the Duplex → generate with As modelled + ACME
codes → compare lines with `HAND_BOQ` (exported from the engine test as JSON).
**Accept:** v1 criterion 1 green against the mock in CI.

## M2 Library

### FE-017 Library shell (F10 §1, 2, 5, 9, 10, 11)
S19, S20 frame: lists per kind and layer, create (empty/copy/patch), versions list, version
view, archive, usage.

### FE-018 Rule-set editor port (F10 §3)
Port `RuleSetEditor`, `QuestionSetup`, `QuestionsTab`, `ruleParts`, `fields`, `itemStory`,
`readable`, `vocab` (reuse-from-poc.md); autosave drafts with ETag; problems inline.

### FE-019 Classification editor port (F10 §3, §8)
Port `ClassificationEditor`, `ClassTable`, `CodeImport`, `classStory`; import flow via
`/codelists/read` and `/build`; paged tables for large lists.

### FE-020 Dictionary editor port (F10 §3, §7)
Port `DictionaryEditor`, `NamesTab`, `dictStory`; names against a chosen model version.

### FE-021 Publish and preview (F10 §4, §6)
Publish dialog with change note, preview panel (job, SSE, compact sheet + changed lines vs
published). Depends on EN-005.
**Accept (M2):** F10 criteria; v1 criterion 7 against the mock.

## M3 Revisions, workflow, exports

### FE-022 New versions and revisions (F08 §1–2)
"New version available" badges; use newer version in a draft; start revision from issued.

### FE-023 Change report (F08 §3–7)
Changes tab with summary, lines and elements tables, filters, viewer "changes" colour mode,
change report export. Depends on EN-002.

### FE-024 Review, approve, issue (F09)
Submit dialog with reviewers, review screen (change report first), line comments, request
changes, approve, issue dialog, reopen warnings, issued read-only mode.

### FE-025 Exports tab and frozen exports (F12)
S12g; issued exports; decisions CSV, audit CSV.

### FE-026 Activity and audit (F09 audit)
S18, S25 with filters.

### FE-027 Notifications complete (F13)
All kinds rendered via i18n; email preference categories.

### FE-028 Revision e2e
Playwright: FL-3 with Duplex v1 → v2 (EN-008), assert the change report and no repeated questions.
**Accept (M3):** v1 criteria 3, 4, 5 against the mock.

## M4 Tendering

### FE-029 Tender create and settings (F11 §1)
### FE-030 Packages builder (F11 §2): selection by codes/families/lines, preview-selection with conflicts, from-groups quick start, unassigned lines panel
### FE-031 Bidders and opening (F11 §3–4): invitations per package, address book, open with validation
### FE-032 While open (F11 §5): status board (sealed-aware), remind, addendum dialog with dryRun preview, extend, close
### FE-033 Comparison and award (F11 §6–7): comparison grid (virtualised), flags, normalise view toggle, export, award dialog
### FE-034 Bidder area (F11 bidder §1–3, 5–6): `/bid-invite/[token]`, `/bids`, `/bids/[id]` with rate entry, autosave, totals with `big.js`, submit/withdraw/decline, addendum banner
### FE-035 Excel round-trip (F11 bidder §4): download package, upload priced file, import report review. Depends on EN-006
### FE-036 Tender e2e
Playwright: FL-4 + FL-5 with three bidders (browser, Excel, decline), sealed checks, award.
**Accept (M4):** v1 criterion 6 against the mock.

## M8 Hardening (frontend)

### FE-037 Real auth adapter (after backend decision D1)
### FE-038 Accessibility pass (axe in Playwright on main screens) and pseudo-locale pass (v1 criterion 11)
### FE-039 Performance pass: bundle budgets, 20k-line sheet test, viewer on a medium model (nfr.md)
