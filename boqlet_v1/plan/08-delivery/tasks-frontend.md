# Frontend tasks (`apps/app`, `apps/mock-api`, `packages/api`)

**Owner: the frontend agent**, in phase 1 (M0–M4, MP1) and phase 3 (M8a, M8); see
`milestones.md`. In phase 1 the mock talks to the existing proof-of-concept engine API
(`engine/ifc_boq/api.py`) and fakes engine features that don't exist yet
(`06-frontend/mock-api.md`, "Engine fakes"). The frontend agent never edits `engine/`; a needed
engine change becomes a fake plus a note on the matching EN task. (Two exceptions, both named in
their task: FE-000 moves the engine without changing it, and FE-046 deletes the PoC dev API.)
Paths are relative to the product root `boqlet_v1/` (P44).

Each task: specs to read, what to build, acceptance. Every screen handles loading, empty,
error and read-only states (02-flows/screens.md). Every UI string goes through i18n (F15).
Every task adds or extends Playwright e2e coverage of its flow against the mock + engine.

## M0 Consolidation, contract and scaffolding

### FE-000 Consolidate the repository into the product root (P44)
The first task of the build. It moves the proof of concept into `boqlet_v1/` so that everything
the product needs sits under one root. File contents don't change, except the paths listed here.
- **Before:** stop any running dev servers (Windows keeps files open); `git status` clean;
  `npm run test` green at the repository root (the baseline).
- **Move with `git mv`** (history kept) into `boqlet_v1/`: `engine/`, `packages/`, `presets/`,
  `fixtures/`, `scripts/`, `apps/` (the PoC UI becomes `boqlet_v1/apps/web`), `docs/`, `plan/`,
  `README.md`, `notes.md`, `CLAUDE.md`, `.gitignore`, `package.json`, `package-lock.json`.
- **Leave at the repository root:** `.claude/`, and the PoC demo deployment, which Vercel needs
  there: `vercel.json`, `api/index.py`, `requirements.txt`. `.github/` is created there later
  (TS-001).
- **Paths to fix.** The engine (`engine/ifc_boq/paths.py`) and `scripts/` resolve everything
  relative to their own folders, so they need no change. Fix these:
  - **New root `CLAUDE.md`:** a short pointer: the product root is `boqlet_v1/`; read
    `boqlet_v1/CLAUDE.md`; paths there and in the plan are relative to `boqlet_v1/`; the
    repository root holds only CI, agent settings and the PoC demo deployment until FE-046.
  - **`boqlet_v1/CLAUDE.md`:**
    - commands run in `boqlet_v1/`;
    - the repo map gets the product folders from `plan/README.md` "Where the code lives";
    - the status paragraph points to `plan/10-build-log.md`.
  - **`boqlet_v1/package.json`:** name `boqlet`; rename the scripts `dev` → `dev:poc` and
    `build` → `build:poc` (the product adds `dev:app`, `build:app` and so on); workspaces stay
    `apps/*`, `packages/*`.
  - **New root `.gitignore`:** `node_modules/`, `.env`, `.vercel/`. The moved one keeps the
    engine's ignores, now relative to `boqlet_v1/`.
  - **`vercel.json`:**
    - `installCommand`: `cd boqlet_v1 && IFC_BOQ_SKIP_ENGINE_SETUP=1 npm ci`;
    - `buildCommand`: `cd boqlet_v1 && VITE_DEPLOYED=1 VITE_MAX_UPLOAD_MB=4.4 npm run build:poc`;
    - `outputDirectory`: `boqlet_v1/apps/web/dist`;
    - every `excludeFiles` pattern prefixed with `boqlet_v1/`, plus `boqlet_v1/plan/**`,
      `boqlet_v1/tests/**` and `boqlet_v1/services/**`.
  - **`api/index.py`:** the engine path becomes `ROOT / "boqlet_v1" / "engine"`.
  - **`docs/17-deploying-a-demo.md`, `docs/README.md`, `README.md`:** paths and commands from
    `boqlet_v1/`.
  - **The plan itself:** nothing to fix; its paths are already relative to the product root.
- **Recreate local state:** delete the root `node_modules/`. In `boqlet_v1/`, run `npm install`,
  then `npm run setup:engine`: the venv moved with `engine/` and must be rebuilt at its new path.
- **Accept:**
  - `git show --stat -M` of the move commit lists renames only, plus the files above.
  - In `boqlet_v1/`:
    - `npm run test` is green: typecheck, and every engine test including the Duplex
      acceptance test;
    - `npm run dev:poc` serves the PoC with the Duplex sample;
    - `VITE_DEPLOYED=1 npm run build:poc` builds.
  - The engine's Python loads `api/index.py` from the repository root without errors.
  - The live demo is not affected: it deploys from `main`, and the build is on `v_1` (P46). If
    Vercel builds previews of `v_1`, the preview builds.

### FE-001 Contract package
- Move `plan/05-api/openapi.yaml` to `packages/api/openapi.yaml` and `plan/05-api/openapi-pricing.yaml`
  to `packages/pricing-api/openapi-pricing.yaml` (its client is generated into the module package,
  never into the core client) (fix `$ref` prefix to
  `../types/schema/`), leave a pointer in `plan/05-api/`. Add `redocly.yaml`, `npm run api:lint`,
  `npm run api:gen` (openapi-typescript → `packages/api/src/schema.d.ts`), and the
  `openapi-fetch` client factory exported from `@ifc-boq/api`.
- Styling: initialise shadcn/ui with `npx shadcn@latest init --preset b38miVKzY` (Base UI,
  `base-mira`), then set every token from `06-frontend/design-guidelines.md` (paper and ink, the
  accent and status colours, data colours, 2 px radius, type scale, light and dark). Pin the
  current stable Next.js version and record it in `06-frontend/architecture.md`.
- **Accept:** lint passes; types generated; CI step fails on contract drift.

### FE-002 Next app skeleton
- `apps/app` per 06-frontend/architecture.md: route groups, providers (QueryClient,
  next-intl with `en` + `en-XA`), the design tokens and both themes from design-guidelines.md
  (light default, dark switch following the OS), self-hosted JetBrains Mono and Inter Tight,
  `APP_NAME` = "boqlet", app shell (top bar with the wordmark, left nav), error and
  not-found pages, `can()` helper, `ApiError` + global handlers (401/402/404/409), dev rewrite
  `/api/v1` → mock.
- **Accept:** `npm run dev:app` serves the shell in both themes with the guidelines' tokens (spot-check the contrast table); the lint rule blocks a literal string in JSX.

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

### FE-012 Single session (F01 §10)
`POST /sessions` after sign-in in the auth adapter; S31 takeover screen; `session.revoked` SSE
handler and `401 session_replaced` interceptor showing the signed-out message. Mock: sessions
table, takeover, SSE event.
**Accept:** F01 criterion 5, v1 criterion 16.

### FE-013 How it is calculated (F06 §5)
Step list from `trace.steps` in plain words (message catalogue), expandable to elements, links
from rule-set values to their Settings question, derived chain, edit step. Depends on EN-013.
**Accept:** F06 criterion 5.

### FE-014 Sheet and model together (F07 §9)
Default split layout ≥ 1280 px (resizable panels), one filter bar for sheet and viewer, group
row → elements, box/shift selection in the model → lines panel with bulk actions, Changes and
Edited colour modes, keyboard shortcuts.
**Accept:** F07 criteria 5, 6.

### FE-015 Not in the models (F06 §12, F09 §2)
Sheet notice with counts by source and "Add line", collapsible per user; same text as the
empty state of empty groups and in the "Add line" help; the tick in the save-version dialog
(built in M3 with FE-031). Strings from the message catalogue.
**Accept:** F06 criterion 8; saving a version (approval off) without the tick is impossible.

### FE-016 Viewer (F07)
Port `SceneView.ts`/`links.ts`; multi-model load; line ↔ element; element panel; colour modes
coverage/code/source/model; storey filter, section box, isolate/hide; "Show in 3D" entry
points (sheet, questions, checks).
**Accept:** F07 criteria.

### FE-017 Exports (run Excel) (F12 part)
Export button, job toast, download.
**Accept:** a Duplex run downloads an xlsx that opens and matches the sheet totals.

### FE-018 Notifications (F13 part)
Bell, list page, toasts for own jobs, preferences page.
**Accept:** F13 criterion 1.

### FE-019 Entitlement UX (F14 part)
Limit dialog on 402, usage page (S24), billing page (S23) with the manual adapter.
**Accept:** the Small Firm seed shows the dialog on "New project"; checkout on `/_dev/checkout` lifts the limit.

### FE-020 Duplex end-to-end test
Playwright: sign in → create project → upload the Duplex → generate with As modelled + ACME
codes → compare lines with `HAND_BOQ` (exported from the engine test as JSON).
**Accept:** v1 criterion 1 green against the mock in CI.

## M2 Library

### FE-021 Library shell (F10 §1, 2, 5, 9, 10, 11)
S19, S20 frame: lists per kind and layer, create (empty/copy/patch), versions list, version
view, archive, usage.

### FE-022 Rule-set editor port (F10 §3)
Port `RuleSetEditor`, `QuestionSetup`, `QuestionsTab`, `ruleParts`, `fields`, `itemStory`,
`readable`, `vocab` (reuse-from-poc.md); autosave drafts with ETag; problems inline.

### FE-023 Classification editor port (F10 §3, §8)
Port `ClassificationEditor`, `ClassTable`, `CodeImport`, `classStory`; import flow via
`/codelists/read` and `/build`; paged tables for large lists.

### FE-024 Dictionary editor port (F10 §3, §7)
Port `DictionaryEditor`, `NamesTab`, `dictStory`; names against a chosen model version.

### FE-025 Publish and preview (F10 §4, §6)
Publish dialog with change note, preview panel (job, SSE, compact sheet + changed lines vs
published). Depends on EN-005.
**Accept (M2):** F10 criteria; v1 criterion 7 against the mock.

### FE-026 Clone, guided creation, Excel templates (F10 §2, §14)
"Clone" with independent copy / based on it; guided mode for new rule sets and classifications
(reuse the wizard steps of FE-028); template download and upload with the change review and
problems by cell. Depends on EN-012.
**Accept:** F10 criteria 7, 8.

### FE-027 Item texts (F10 §8, §13; F06 §2, §5)
Code list tab: "Item text" box under each code with insert buttons and "Reads as" (port the
rule-set line text field); import mapping labels the description column "Item text"; Codes per
line shows each row's sample text. Sheet: Description from `codes[groupBy].text` with fallback,
three-line clamp, detail shows the item text and "Measured as". Depends on EN-010.
**Accept:** F10 criterion 5; F06 criterion 7.

### FE-028 Setup wizard (F16)
S30 `/{org}/setup`: step list, start step (model picker incl. sample Duplex, start-from preset),
step 1 built from the rule set's data as F16 says (1a checklist derived from item-switching yes/no slots, 1b follow-ups of what was switched on, 1c screens from `setupSteps`), with the Settings controls, preview panel with
changed lines (EN-005), import and Codes per line (reuse FE-023), names (reuse FE-024), review
and "Publish all" (publish, star, optional project defaults), resume from `Org.setup`, dashboard
card and Library button, hint on sheets generated with system presets only; mock endpoints
`GET/PUT /orgs/{orgId}/setup`. Depends on EN-011, FE-021…FE-025.
**Accept:** F16 criteria (the 15-minute one walked through by hand, v1 criterion 12).
Required on first start (P18): onboarding routes the owner into S30 and the dashboard stays
closed until done; "Use the suggested answers" per step.

## M3 Versions, exports, sharing

### FE-029 New model versions (F08 §1–2)
"New version available" badges; "Use v4" in the working version; "Reopen to update" on a confirmed BoQ.

### FE-030 Change report (F08 §3–7)
Changes tab with summary, lines and elements tables, filters, viewer "changes" colour mode,
change report export. Depends on EN-002.

### FE-031 Versions, confirmation, optional approval (F09)
Save version dialog (label, note, "not in the models" tick, open-questions warning), Versions tab
(S12h), saved-version read-only mode, Confirm / Reopen BoQ; with `approvalRequired`: submit with
reviewers, review screen (change report first), line comments, request changes, approve, save,
four-eyes, withdrawn-review warnings. Org settings toggles.

### FE-032 Exports tab and frozen exports (F12)
S12g; saved-version exports; decisions CSV, audit CSV.

### FE-033 Activity and audit (F09 audit)
S18, S25 with filters.

### FE-034 Notifications complete (F13)
All kinds rendered via i18n; email preference categories.

### FE-035 Versions e2e
Playwright: FL-3 with Duplex v1 → v2 (EN-008), assert the change report and no repeated questions;
save, confirm, reopen; approval on and off.
**Accept:** v1 criteria 3, 4, 5 against the mock.

### FE-036 Share links (F18)
Share dialog and list in the BoQ workspace; org list in settings; public page S35 (sheet, line
detail, viewer, Excel as included; DRAFT watermark; expired/revoked page). Mock: public
endpoints with token hashing.
**Accept:** F18 criteria, v1 criterion 15.

### FE-037 Excel edits import (F12)
Upload in Exports, job progress, review list with ticks and reasons, apply via
`/overrides/batch`. Depends on EN-006 (BoQ round-trip).
**Accept:** F12 criterion 4, v1 criterion 13.

## M4 Admin console, extension points, co-editing

### FE-038 Platform admin console (F19)
S36 with its own layout: overview tiles, funnel, orgs table with signals and CSV, org detail
with notes, tags, plan/trial/overrides/suspend (reason dialogs), users, vendors, health. Mock:
`/admin/*` computed from the seed, Pat as platform admin.
**Accept:** F19 criteria against the mock.

### FE-039 Extension registries (core, P36, modules.md)
Typed registries for `nav.orgItems`, `boq.workspaceTabs`, `sheet.selectionActions`,
`sheet.lineBadges`, `settings.orgSections`, `project.overviewCards`, `area.routes`,
`notifications.kinds`; `src/modules.ts` as the only module import, behind `MODULE_PRICING`; lint
rule against other imports; a test module that registers one of each in tests.
**Accept:** the app builds and every core e2e passes with no module registered.

### FE-040 Position numbers and live co-editing (F06 §13–14)
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

## Phase 3, M8a: wire up

### FE-041 Point the app at Java
- **Adapt to the contract changes of phase 2** (`05-api/contract-changes.md`). For each row:
  - adapt the UI properly where the change affects it, and remove the
    `// contract-change: <id>` markers;
  - set "Adapted" with the commit, or "nothing to adapt".

  Read the build log's phase-2 entries for the backend owner's decisions that change behaviour
  (`07-backend/decisions.md`).
- Base URL per environment, and a per-tag switch while the backend lands (a tag is served by
  Java once its contract tests pass).
- SSE against Java; file uploads to real storage.
- The mock stays as the e2e test double.
- Run the full Playwright suite against Java staging.
**Accept:**
- every M1–M4 flow passes against Java staging;
- every row in `05-api/contract-changes.md` is adapted or marked "nothing to adapt";
- `git grep contract-change: apps/app` is empty.

### FE-042 Remove the engine fakes
For each row of `mock-api.md` "Engine fakes": confirm the replacing EN task is done, delete the
fake, re-run the criteria marked "(fake)" in phase 1 against the real engine, adjust the UI where
real behaviour differs (e.g. derived lines now follow edited quantities, real trace steps).
**Accept:** the fakes table is empty; every "(fake)" criterion green on the real engine.

### FE-043 Real auth adapter (after backend decision D1)
- Implement `AuthAdapter` for the provider chosen in D1 (BE-000): sign-in, sign-up, email
  verification, sign-out; token or cookie session as D1 decided; invitation acceptance by email
  match; the single-session takeover screen against Java (BE-027).
- Vendor sign-in, if the pricing module is built (MP2).
- `NEXT_PUBLIC_AUTH_ADAPTER` selects the adapter. The mock adapter stays for e2e on the mock.
- **Accept:**
  - F01 acceptance criteria on Java staging with the real provider;
  - FL-1 sign-up to first BoQ end to end on staging;
  - e2e on the mock still green.

## Phase 3, M8: hardening and release

### FE-044 Accessibility and pseudo-locale pass (nfr.md, F15)
Run TS-003 (axe in Playwright on the main screens) and fix what it finds. Walk the main screens
in the `en-XA` pseudo-locale and fix clipped, overlapping or untranslated strings.
**Accept:** TS-003 green (no serious or critical violations); v1 criterion 11 green.

### FE-045 Performance pass (nfr.md)
- Set bundle budgets per route and enforce them in CI.
- Test the sheet with 20 000 lines (scrolling, filtering, group switch) and the viewer on a
  medium model, against the targets in nfr.md, on staging. Fix what misses.
- Record the frontend numbers through TS-002.
**Accept:** every frontend target in nfr.md met on staging and recorded in the NFR table.

### FE-046 Make the product root the repository root and remove the proof of concept (P44)
After FE-041…FE-045 and BE-025, BE-026, TS-002…TS-004 are green, and before the release
(FE-047). This is the last structural change.
- **Check first** that nothing in the product uses the proof of concept any more:
  - `PocEngine` and the interim engine path are gone (EN-001);
  - the fakes table in `mock-api.md` is empty (FE-042);
  - `git grep -n "8787\|ifc_boq.api\|apps/web\|dev:poc"` finds only the PoC itself and
    history docs.
- **Delete:**
  - `apps/web/` (the PoC UI and its Guide);
  - the PoC dev API: `engine/ifc_boq/api.py` and `store.py`, the `serve` command in
    `scripts/run-engine.mjs`, and the `dev:poc`, `dev:web`, `dev:engine` (if it only served the
    PoC) and `build:poc` scripts. This is the one engine change the frontend agent makes.
    Remove Python dependencies only they used (check `engine/requirements.txt` and
    `pyproject.toml`). Engine tests stay green;
  - the demo deployment: `vercel.json`, `api/`, the root `requirements.txt`, and
    `docs/17-deploying-a-demo.md`;
  - the root pointer `CLAUDE.md`.

  `docs/reference/` stays: it is the record of the original conversation.
- **Promote:** `git mv` every entry of `boqlet_v1/` (dotfiles included) to the repository root,
  merge `boqlet_v1/.gitignore` into the root one, and remove the empty folder.
- **Fix references:**
  - CI: drop `working-directory: boqlet_v1`;
  - `CLAUDE.md`: repo map, run commands, status (the PoC UI and dev API are gone; their roles
    live in the product);
  - `README.md` and `docs/README.md`;
  - the engine docs (`docs/03`, `docs/10`) where they describe the PoC UI or dev API as current;
  - `plan/README.md` "Where the code lives": the product root is now the repository root; the
    `boqlet_v1/` story becomes a sentence of history;
  - `sessions.md`: the prompt, ports and tooling rows.
  - Afterwards `git grep -n boqlet_v1` finds only the build log, `docs/11` and that sentence of
    history.
- **Recreate local state** at the root (`npm install`, `npm run setup:engine`) and delete the
  leftover untracked folders under `boqlet_v1/`.
- **Accept:**
  - CI is green on the new layout: every job, including core-only, the contract and scenario
    suites against the mock and Java, the Java build and the Playwright smoke on staging;
  - a fresh clone runs `npm ci` and `npm run test` green;
  - `git ls-files boqlet_v1` is empty;
  - the live demo on `main` is still untouched (the merge happens in FE-047).

### FE-047 Production release (04-architecture/deployment.md)
- Needs from the owner (`09-open-questions.md` "Needed by"): the production account and region
  (D8), the domain, and the provider secrets for auth (D1), email (D6) and billing (D7).
- **Merge into `main`** (P46), once the owner has given the go in the session:
  - tag the current `main` (the proof of concept) `poc-final` and push the tag; the demo can be
    redeployed from it;
  - merge `v_1` into `main` (`git merge --no-ff v_1`), push, and check CI on `main` is green;
  - tell the owner to remove or repoint the Vercel demo project (`main` no longer has it);
  - from now on staging and production deploy from `main`; `v_1` stays as it is.
- Deploy `main` to production with the services and configuration in deployment.md:
  - migrations run before the API takes traffic;
  - the pricing module is switched on or off as the owner says (P32).
- Smoke test on production: sign up, create the Duplex sample project, generate the BoQ, export
  it, open a share link.
- Tag the release `v1.0.0`.
- Write the phase 3 summary and the release notes in the build log; set the status table to
  "Released".
**Accept:** M8 exit criteria; TS-004 (v1 acceptance) green on staging at the tagged commit;
production smoke test green.
