# Frontend tasks (`apps/app`, `apps/mock-api`, `packages/api`)

**Owner: the frontend agent**, in phase 1 (M0–M4, MP1) and phase 3 (M8a, M8); see
`milestones.md`. In phase 1 the mock talks to the existing proof-of-concept engine API
(`engine/ifc_boq/api.py`) and fakes engine features that don't exist yet
(`06-frontend/mock-api.md`, "Engine fakes"). The frontend agent never edits `engine/`; a needed
engine change becomes a fake plus a note on the matching EN task.

Each task: specs to read, what to build, acceptance. Every screen handles loading, empty,
error and read-only states (02-flows/screens.md). Every UI string goes through i18n (F15).
Every task adds or extends Playwright e2e coverage of its flow against the mock + engine.

## M0 Contract and scaffolding

### FE-001 Contract package
- Move `plan/05-api/openapi.yaml` to `packages/api/openapi.yaml` and `plan/05-api/openapi-pricing.yaml`
  to `packages/pricing-api/openapi-pricing.yaml` (its client is generated into the module package,
  never into the core client) (fix `$ref` prefix to
  `../types/schema/`), leave a pointer in `plan/05-api/`. Add `redocly.yaml`, `npm run api:lint`,
  `npm run api:gen` (openapi-typescript → `packages/api/src/schema.d.ts`), and the
  `openapi-fetch` client factory exported from `@ifc-boq/api`.
- Styling: shadcn/ui on Tailwind + Radix (P23). The look follows the owner's
  `06-frontend/design-guidelines.md` when it exists (P41); until then keep every visual choice in
  tokens so it can change in one place. Font: as the guidelines say, else **JetBrains Mono**
  (self-hosted). Pin the current stable Next.js version and record it in `06-frontend/architecture.md`.
- **Accept:** lint passes; types generated; CI step fails on contract drift.

### FE-002 Next app skeleton
- `apps/app` per 06-frontend/architecture.md: route groups, providers (QueryClient,
  next-intl with `en` + `en-XA`), design tokens, app shell (top bar, left nav), error and
  not-found pages, `can()` helper, `ApiError` + global handlers (401/402/404/409), dev rewrite
  `/api/v1` → mock.
- **Accept:** `npm run dev:app` serves the shell; the lint rule blocks a literal string in JSX.

### FE-003 Mock API skeleton
- `apps/mock-api` per 06-frontend/mock-api.md (engine connection: the PoC engine API in phase 1,
  with the engine fakes behind one `engine` interface so phase 2 can swap them out): Hono server, OpenAPI validation, JSON store,
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

### FE-005 Onboarding, orgs, members, sessions (F01)
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
**Accept:** F06 criteria 1, 2, 11.

### FE-010 Questions and decisions (F05)
S12b with answer controls per `AnswerType`, bulk answer, dryRun warning, "N answers not applied
– Regenerate", term picker; S13 decisions page; promote (library editors).
**Accept:** F05 criteria 1, 3, 4 (5 after M2).

### FE-011 Line edits and manual lines (F06 §6–7)
Inline editable cells (quantity, description, unit) with edit markers, engine value on hover,
restore per field; drag to reorder and to move between sections; Ref change moves; exclude with
reason and the "Excluded" filter; bulk actions on a selection; undo of the last 20 edits;
manual line between any rows (formula check via `/presets/check`). Depends on EN-003 (extended),
EN-007.
**Accept:** F06 criteria 3, 4, 6.

### FE-043 Single session (F01 §10)
`POST /sessions` after sign-in in the auth adapter; S31 takeover screen; `session.revoked` SSE
handler and `401 session_replaced` interceptor showing the signed-out message. Mock: sessions
table, takeover, SSE event.
**Accept:** F01 criterion 5, v1 criterion 16.

### FE-044 How it is calculated (F06 §5)
Step list from `trace.steps` in plain words (message catalogue), expandable to elements, links
from rule-set values to their Settings question, derived chain, edit step. Depends on EN-013.
**Accept:** F06 criterion 5.

### FE-045 Sheet and model together (F07 §9)
Default split layout ≥ 1280 px (resizable panels), one filter bar for sheet and viewer, group
row → elements, box/shift selection in the model → lines panel with bulk actions, Changes and
Edited colour modes, keyboard shortcuts.
**Accept:** F07 criteria 5, 6.

### FE-042 Not in the models (F06 §12, F09 §1)
Sheet notice with counts by source and "Add line", collapsible per user; same text as the
empty state of empty groups and in the "Add line" help; submit dialog checkbox (M3, with
with FE-024, the submit dialog). Strings from the message catalogue.
**Accept:** F06 criterion 8; submitting without the tick is impossible.

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

### FE-046 Clone, guided creation, Excel templates (F10 §2, §14)
"Clone" with independent copy / based on it; guided mode for new rule sets and classifications
(reuse the wizard steps of FE-041); template download and upload with the change review and
problems by cell. Depends on EN-012.
**Accept:** F10 criteria 7, 8.

### FE-040 Item texts (F10 §8, §13; F06 §2, §5)
Code list tab: "Item text" box under each code with insert buttons and "Reads as" (port the
rule-set line text field); import mapping labels the description column "Item text"; Codes per
line shows each row's sample text. Sheet: Description from `codes[groupBy].text` with fallback,
three-line clamp, detail shows the item text and "Measured as". Depends on EN-010.
**Accept:** F10 criterion 5; F06 criterion 7.

### FE-041 Setup wizard (F16)
S30 `/{org}/setup`: step list, start step (model picker incl. sample Duplex, start-from preset),
step 1 built from the rule set's data as F16 says (1a checklist derived from item-switching yes/no slots, 1b follow-ups of what was switched on, 1c screens from `setupSteps`), with the Settings controls, preview panel with
changed lines (EN-005), import and Codes per line (reuse FE-019), names (reuse FE-020), review
and "Publish all" (publish, star, optional project defaults), resume from `Org.setup`, dashboard
card and Library button, hint on sheets generated with system presets only; mock endpoints
`GET/PUT /orgs/{orgId}/setup`. Depends on EN-011, FE-017…FE-021.
**Accept:** F16 criteria (the 15-minute one walked through by hand, v1 criterion 12).
Required on first start (P18): onboarding routes the owner into S30 and the dashboard stays
closed until done; "Use the suggested answers" per step.

## M3 Versions, exports, sharing

### FE-022 New model versions (F08 §1–2)
"New version available" badges; "Use v4" in the working version; "Reopen to update" on a confirmed BoQ.

### FE-023 Change report (F08 §3–7)
Changes tab with summary, lines and elements tables, filters, viewer "changes" colour mode,
change report export. Depends on EN-002.

### FE-024 Versions, confirmation, optional approval (F09)
Save version dialog (label, note, "not in the models" tick, open-questions warning), Versions tab
(S12h), saved-version read-only mode, Confirm / Reopen BoQ; with `approvalRequired`: submit with
reviewers, review screen (change report first), line comments, request changes, approve, save,
four-eyes, withdrawn-review warnings. Org settings toggles.

### FE-025 Exports tab and frozen exports (F12)
S12g; saved-version exports; decisions CSV, audit CSV.

### FE-026 Activity and audit (F09 audit)
S18, S25 with filters.

### FE-027 Notifications complete (F13)
All kinds rendered via i18n; email preference categories.

### FE-028 Versions e2e
Playwright: FL-3 with Duplex v1 → v2 (EN-008), assert the change report and no repeated questions;
save, confirm, reopen; approval on and off.
**Accept (M3):** v1 criteria 3, 4, 5 against the mock.

## M4 Sharing, admin console, extension points

### FE-048 Share links (F18)
Share dialog and list in the BoQ workspace; org list in settings; public page S35 (sheet, line
detail, viewer, Excel as included; DRAFT watermark; expired/revoked page). Mock: public
endpoints with token hashing.
**Accept:** F18 criteria, v1 criterion 15.

### FE-049 Excel edits import (F12)
Upload in Exports, job progress, review list with ticks and reasons, apply via
`/overrides/batch`. Depends on EN-006 (BoQ round-trip).
**Accept:** F12 criterion 4, v1 criterion 13.

### FE-050 Platform admin console (F19)
S36 with its own layout: overview tiles, funnel, orgs table with signals and CSV, org detail
with notes, tags, plan/trial/overrides/suspend (reason dialogs), users, vendors, health. Mock:
`/admin/*` computed from the seed, Pat as platform admin.
**Accept:** F19 criteria against the mock.

### FE-051 Extension registries (core, P36, modules.md)
Typed registries for `nav.orgItems`, `boq.workspaceTabs`, `sheet.selectionActions`,
`sheet.lineBadges`, `settings.orgSections`, `project.overviewCards`, `area.routes`,
`notifications.kinds`; `src/modules.ts` as the only module import, behind `MODULE_PRICING`; lint
rule against other imports; a test module that registers one of each in tests.
**Accept:** the app builds and every core e2e passes with no module registered.

### FE-052 Position numbers and live co-editing (F06 §13–14)
`positionNo` column, renumbering after edits; presence avatars and line markers, `boq.line_edited`
applied without reload, conflict toast on the same line, per-user undo.
**Accept:** F06 criteria 9, 10.

## Pricing module (removable, P36): `packages/pricing-ui`

Built after M3 against the mock's pricing plugin. Nothing in M0–M4 depends on it.

### FE-P1 Module skeleton
Package, `register.ts` (routes, tabs, actions, badges, nav, settings section, i18n namespace
`pricing`), generated client from `openapi-pricing.yaml`, `/vendor` area layout and vendor
sign-in routing, module-off behaviour (nothing rendered, `404` pages).
**Accept:** with `MODULE_PRICING` off the build has no pricing code (bundle check).

### FE-P2 Vendors (F17)
S32 directory with shared lists, S33 invitation, S34 vendor firms and profile (choose list per firm).
**Accept:** F17 criteria.

### FE-P3 Pricebooks (F20 §1)
S37 editor (virtualised table, bulk edit, history), Excel template download and import review,
copy; for firms and vendors.
**Accept:** F20 criterion 1.

### FE-P4 Pricing tab and estimate (F20 §2–4)
S38: fill remembered, pick a price (search across own and shared lists, unit filter), type,
sources and dates, stale flags, exchange rates, totals, export.
**Accept:** F20 criteria 2–5.

### FE-P5 Offer requests, firm side (F11 firm §1–3)
"Request offers" selection action (sheet and model), dialog, S14/S15 list and request page,
status per vendor, send update, close/extend/cancel, comparison grid with estimate column, use
rates.
**Accept:** F11 criteria 1, 3, 4.

### FE-P6 Vendor request page (F11 vendor §1–6)
S28/S29: requests list, request page with fill from pricebook, pick, type, autosave, submit,
withdraw, decline, Excel round-trip, update banner.
**Accept:** F11 criteria 2, 5.

### FE-P7 Pricing e2e
Playwright: FL-4 and FL-5 end to end; module switched off for an org hides everything.
**Accept:** v1 criterion 6 (if the module ships), F17 criterion 3.

## Phase 3: wire up and release (M8a, M8)

### FE-053 Point the app at Java
Base URL per environment, per-tag switch while the backend lands (a tag served by Java once its
contract tests pass), SSE against Java, file uploads to real storage; the mock stays as the e2e
test double. Run the full Playwright suite against Java staging.
**Accept:** every M1–M4 flow passes against Java staging.

### FE-054 Remove the engine fakes
For each row of `mock-api.md` "Engine fakes": confirm the replacing EN task is done, delete the
fake, re-run the criteria marked "(fake)" in phase 1 against the real engine, adjust the UI where
real behaviour differs (e.g. derived lines now follow edited quantities, real trace steps).
**Accept:** the fakes table is empty; every "(fake)" criterion green on the real engine.

## M8 Hardening (frontend, phase 3)

### FE-037 Real auth adapter (after backend decision D1)
### FE-038 Accessibility pass (axe in Playwright on main screens) and pseudo-locale pass (v1 criterion 11)
### FE-039 Performance pass: bundle budgets, 20k-line sheet test, viewer on a medium model (nfr.md)
