# Build log

The memory of the build, kept by the agents that build it (P45). The specs say what to build.
This log says **where the build stands** and **what the agents decided along the way** that a
later agent needs to know and can't see in the specs. How sessions use it: `08-delivery/sessions.md`.

- **Current position** is rewritten by every session: after every task, and before the
  session ends or stops.
- **Entries** are added, newest first:
  - at the end of every milestone and phase;
  - when a session takes an implementation decision a later agent must know;
  - when it deviates from a spec.

  Entries are never rewritten; a later entry corrects an earlier one.

Not here: finished tasks one by one (`docs/11` "Done"), product decisions (the owner's,
`plan/README.md`), open questions (`09-open-questions.md`).

## Current position

| | |
|---|---|
| Phase | 1 (frontend on the mock), milestone M4 (Admin console, extension points, co-editing) |
| Role | Frontend agent |
| Last task done | FE-040 Position numbers and live co-editing (2662a36) |
| Next task | Close M4 and phase 1: the shared suites' coverage of every core operation, the "Needs you" list (still empty, docs/11), the M4 entry and the phase summary |
| Waiting for the owner | — |
| In progress (not committed) | — |
| Notes for the next session | **MP1 and MP2 (the pricing module) are for a later phase (P48, the owner, 2026-11-14): skip them; phase 1 ends after M4, phase 2 after M7.** Read the FE-040, FE-039 and FE-038 entries, then the M3 entry and the M3 decision entries (FE-037 … FE-029), then the M2 entry, then the FE-026…FE-028, FE-022…FE-027 and FE-021 entries, then the M1 entry and the M1 decision entries below. Read the M0 entry below ("For the next agent"). In short: run npm in `boqlet_v1/`; `npm run dev:app` starts engine + mock + app; sign in at http://localhost:3000 as a seeded user; add mock handlers per operationId in `apps/mock-api/src/handlers/` and register them in `app.ts`; turn the scenario todos into tests as their tasks land. Whether Vercel builds previews of `v_1` was not checked (no Vercel access in the session). |

## Entry template

```markdown
### <YYYY-MM-DD> — <milestone or phase> (<role>)
- **Built:** task ids, first..last commit.
- **Exit criteria:** each one and how it was checked; criteria passed only on a fake marked "(fake)".
- **Decisions taken:** what was decided, why, and the file that shows it (libraries and versions,
  layout, internal interfaces).
- **Deviations from the spec:** what differs, why, and the spec that was changed or the question
  opened (Qnn).
- **Fakes:** rows added to or removed from `06-frontend/mock-api.md`.
- **Known issues and debt:** each with the task that should deal with it.
- **For the next agent:** anything that isn't obvious from the code and the specs.
```

## Entries

### 2026-11-14 — M4 decisions: FE-040 (frontend agent)
- **Built:** FE-040, 2662a36. Mock `positions.ts`, `presence.ts`, presence handlers and `boq.line_edited` in `handlers/adjustments.ts`, `positionNo` in `handlers/lines.ts`; app `features/boq-sheet/positions.ts`, `features/boqs/presence.tsx`, `realtime/boq-events.ts`, the No. column, markers and the conflict notice in `sheet.tsx`. Checked by `tests/scenarios/co-editing.test.ts` (3), `e2e/co-editing.spec.ts` (F06-AC9, AC10) and unit tests.
- **Decisions taken:**
  - Position numbers are in the Group-by system the sheet shows (F06 §2 puts No. beside "Item (code in the Group-by system)"); the backend's `positionNo` uses `groupBy`, else the run's first classification. The section is the line's code; the separator is the code list's (`.` by default). The sheet numbers its own overlaid lines with the same rule (the backend rule is duplicated in the mock and the app, both tested on the same cases), because edits are laid over the run on the client and must renumber at once.
  - Contract additions (a gap against F06 §14 and storage-jobs-realtime.md, which name `boq.presence` but gave the client no way to say it is in a BoQ): `PUT`/`DELETE /boqs/{boqId}/presence`, and the shapes `BoqPresence` and `BoqLineEdited` for the two events (redocly warns that `BoqLineEdited` is unused: SSE payloads can't be referenced). Presence writes are allowed in a suspended org.
  - `BoqRevision.frozen.adjustments` (BR-25): a saved version opened read-only showed the working version's current edits (pre-existing bug); it now shows the edits it was saved with, so its sheet and numbers stay.
  - The "undo for their own" of F06 §14 reads here as "Keep mine" in the notice: my value saved again, as the later edit. My undo entries for a line someone else changed are dropped (Ctrl+Z undoes only my own edits). Undo stacks are per tab.
  - The marker shows while a person has a cell editor open on a line.
  - Fixed: re-editing a quantity with Enter submitted the reason dialog that opened with the old reason (the cell editor's Enter now prevents its default).
- **For the next agent:** a closed browser context doesn't run the page's `pagehide` reliably; e2e that need someone to leave a BoQ navigate away instead.

### 2026-11-14 — M4 decisions: FE-039 (frontend agent)
- **Built:** FE-039, 23ab381. `apps/app/src/extensions/` (`registry.ts`, `index.ts`, `area-host.tsx`, `testing/test-module.tsx`, `extensions.test.tsx`), `src/modules.ts`, `settings/[section]` and `areas/[area]/[[...segments]]` routes; the core screens read the registries.
- **Decisions taken:**
  - Labels, panels, cards and actions are components (a module renders its own namespace and queries); badges are a hook per module (`useBadges`), called once per sheet in registration order. A key registered twice throws.
  - Importing `@/extensions` runs `src/modules.ts` first, so registration always precedes reading. `src/modules.ts` registers nothing: the pricing module is for a later phase (P48), and `MODULE_PRICING=1` throws in next.config until it exists.
  - Areas: an `[org]` catch-all broke the real 404 for unknown org paths (a page-level `notFound()` after streaming starts answers 200). Instead next.config rewrites `/{area}/…` to `/areas/{area}/…` (`beforeFiles`, so it wins over `[org]`) for the areas of the modules in the build (`MODULE_AREAS`, empty).
  - Org slugs refuse the app's route names and `areas` (mock `RESERVED_SLUGS`; a bug before: an org named `admin` was unreachable). A module's backend reserves its area paths.
  - Component tests render with the app's React 19 through a small helper: Testing Library and next-intl sit at the workspace root next to the PoC's React 18; vitest inlines next-intl/use-intl with aliases to the app's React, and `next/link` is mocked as an anchor.
- **For the next agent:** deleting a route leaves stale `.next/dev/types` (typecheck fails on the missing page) until the dev server runs once or the folder is removed.

### 2026-11-14 — M4 decisions: FE-038 (frontend agent)
- **Built:** FE-038, 280ee74. Mock `handlers/admin.ts`, `org-status.ts` (the suspension guard in the router), `request-context.ts` (the refused operation for limit events); app `features/admin/`, `api/hooks/admin.ts`, routes under `app/(admin)/admin/`. Checked by `tests/contract/admin.test.ts` (3), `tests/scenarios/admin.test.ts` (11), `e2e/admin.spec.ts` (6).
- **Decisions taken:**
  - Contract fixes: `Org.status` (`active`, `suspended`; data-model.md has it, the contract didn't), `adminListOrgs` gained `country` (F19 §3 lists it) and `stuckAt` (F19 §2 "click a step to list the orgs stuck at it"; "stuck at" = reached the step before, not this one), and `adminExportOrgs` takes the same filters and sort; the funnel step enum became the `AdminFunnelStep` schema.
  - Suspended means read-only and no new jobs (data-model.md): every POST/PUT/PATCH/DELETE into the org answers `409 org_suspended` (a new code, in the 409 "blocked by state" family of conventions.md). The router resolves the org from the path parameters; `/admin/*`, `/me`, sessions and notifications are never refused. The app shows a banner in the org chrome and the global 409 toast translates the code.
  - Audit: account changes (plan, trial, overrides, suspend, reactivate) go into the org's own log with `actorKind: platform_admin`; detail views, notes, tags and ended sessions only into the platform's (`orgId: null`), because notes and tags are internal (data-model.md "never shown to the org").
  - Every `402` writes a limit event: `limitHit` (with the F13 notification) and the new `limitRefused` (per-action limits and features, no notification) both record it.
  - The contract asks for a reason on every `PATCH /admin/orgs/{id}`, tags included; the tag dialog asks for one.
  - The mock computes the overview and the funnel live (the nightly reporting table is the backend's choice); the funnel reads the records, not audit events. Users got a sign-up date (`userCreatedAt`; seeded users at seed time).
  - No Vendors section (the pricing module's, P48) and no ops-dashboard links (BE-025) in Health.
- **Known issues:** docs/11 "Platform admin". A dev-server warning from the notification bell's dropdown shows during e2e runs with the org chrome (pre-existing, not from this task).

### 2026-11-14 — Owner decision: the pricing module is for a later phase (frontend agent)

The owner said: "Skip the MP1 and make a note that MP1 and MP2 are for a later phase."
Recorded as P48 in `plan/README.md` and carried into `08-delivery/milestones.md` (diagram and
both milestone rows), the three task files (FE-P1…FE-P7, BE-P1…BE-P4, EN-P1 marked "for a later
phase"), `00-product/03-v1-scope.md` criterion 6 and `07-backend/decisions-to-make.md` B16.
Phase 1 is now done after M4; phase 2 after M7. What stays: the module boundary of P36 (FE-039's
extension points, `openapi-pricing.yaml` linted and its types generated, the core-only build,
"the app builds with no module" in M4's exit criteria). The mock's pricing plugin, if any of it
exists, is left as it is.

### 2026-11-13 — M3 Versions, exports, sharing, notifications (frontend agent)
- **Built:** FE-029…FE-037, 966a5b7..151e16e (plus the record commits).
- **Exit criteria:**
  - *FL-2 (models to a confirmed BoQ):* upload, parse, generate (M1), save version, confirm, reopen: `e2e/versions.spec.ts`, `e2e/versions-flow.spec.ts`, `tests/scenarios/versions.test.ts`.
  - *FL-3 (new model version → next saved version):* `e2e/versions-flow.spec.ts` end to end (v2 = the Duplex with one wall renamed until EN-008), plus `e2e/new-versions.spec.ts` (badge, notification, Use v2).
  - *FL-9 (editing with the model):* steps 1–5 and 7 were M1's (`sheet-model.spec.ts`, `line-edits.spec.ts`); step 6, the Excel round-trip, in `e2e/exports.spec.ts` (FE-037).
  - *FL-11 (share a BoQ):* `e2e/shares.spec.ts` (private window, no account, revoke).
  - *v1 criterion 3 (revision):* `e2e/versions-flow.spec.ts` (the change report lists exactly the changed element; no question asked again); exact lines on EN-008's fixture are checked on synthetic results in `apps/mock-api/test/diff.test.ts` (fake).
  - *v1 criterion 4 (traceability):* the automated part in `versions-flow.spec.ts` (formula, parameters, shares and the 3D view one click from a line); **not walked through by a person (M)**.
  - *v1 criterion 5 (versions):* `versions.test.ts` (409 revision_locked for the owner, 409 boq_confirmed, approval and four-eyes) and the e2e specs above.
  - *v1 criterion 13 (editing):* the Excel part (quantity, move, exclusion, manual line imported back) in `edits-import.test.ts` and `exports.spec.ts` (fake: the round-trip); **live co-editing is FE-040 (M4)**.
  - *v1 criterion 15 (share link):* `shares.test.ts` (F18-AC1…AC4, BR-56 over every public response) and `shares.spec.ts`.
  - Last full runs: typecheck, lint, app 194, mock 62, contract 172, scenarios 149, engine 194, e2e: the first full run failed six viewer tests on Studio's 50-project limit (fixed by the e2e global setup, 151e16e); the second passed 95 of 97, the two others (`library-editors.spec.ts` FE-022 and F10-AC2) failed on the engine race below and pass alone (8 of 8).
- **Decisions taken:** in the FE-029 … FE-036 entries and below.
- **Deviations from the spec:** contract additions and fixes, each in its task's entry: `DiffSummary.byModel`, audit `from`/`to` and `exportOrgAuditCsv`, the project audit CSV's filters, `PublicShare` nullable for following links, the public scene's `versionId`, `ShareLink` names and hints.
- **Fakes:** "Change report" built; "BoQ export meta, edits import" extended with the round-trip; "Duplex v2 fixture" described as the renamed-wall v2 (mock-api.md).
- **Known issues and debt:** docs/11 (new model versions, change report, versions, exports, audit, notifications, versions e2e, share links, edits import). `e2e/boqs.spec.ts` F04-AC2's 10 s budget missed once under parallel load (FE-031 entry). **Engine race under parallel e2e load (pre-existing, phase-1 path):** creating a preset (the engine's check) can answer 500 when a preview is deleting its temporary preset from the engine's user folder at the same moment (`FileNotFoundError` on `presets/user/rules/mock-preview-…`); FE-028 serialised previews with runs, but checks don't wait for preview cleanup. Next session: make the check wait like runs do (`presetsSettled`, `handlers/presets.ts`), or give previews their own folder.
- **For the next agent:** M4 starts with FE-038. The e2e global setup (`e2e/global-setup.ts`) puts Studio Demo on Enterprise; test limits with `createOrg`. Writing Python edits to files through the shell: here-docs with single quotes break in this environment's Bash wrapper; write a script file instead.

### 2026-11-13 — M3 decisions: FE-037 (frontend agent)
- **Built:** FE-037, 4e284ad (and 151e16e). `engine/fakes/boq_roundtrip.py` (annotate after export, read an edited file), `handlers/edits-import.ts`, `features/exports/edits-import.tsx`; `tests/support/edit_boq_xlsx.py` edits a workbook as a person would (scenarios and e2e share it).
- **Decisions taken:**
  - The import compares the edited sheet with a very hidden `_boqlet` snapshot of what was exported (Ref, description, unit, quantity per key, the BoQ's id, the grouping system), not with the run: an item text in the Description column or a number format never reads as an edit. openpyxl, as the other fakes, instead of SheetJS (mock-api.md said SheetJS).
  - Report shape per the contract: `manualItems[].item` is a `ManualItemInput` (`{item, codes}`), with `row`; new manual lines get ids `xlsx-<job>-<row>`. The job's output is `{importReport: {overrides, manualItems, problems}}` (counts); the report itself is kept in the blob folder.
  - Import into the working version only (`409 revision_in_review` / `revision_locked` otherwise), with `editLines`; a BoQ without a run is `409 no_run`.
  - The review ticks everything by default; quantity changes and exclusions need a reason before Apply (F06 §6).

### 2026-11-13 — M3 decisions: FE-036 (frontend agent)
- **Built:** FE-036, 2f2d757. Mock `handlers/shares.ts`, `geometryUrl` in `viewer.ts`; app `features/shares/` (dialog, public page), `api/hooks/shares.ts`, `/{org}/settings/shares`, `/s/[token]` in the `(public)` group. Checked by `tests/scenarios/shares.test.ts` (10) and `e2e/shares.spec.ts` (2).
- **Decisions taken:**
  - Contract fixes: `PublicShare.revisionLabel`, `revisionStatus` and `runAt` are nullable (F18 §1: a link following the latest saved version shows nothing until one is saved), plus `systems`; `getPublicShareScene` takes `versionId` (F18: a BoQ of several models); `ShareLink` gained `projectId`, `projectName`, `boqName`, `revisionLabel` and `permissions` (`edit`, `revoke`) for the lists.
  - Who may (F18 "Permissions"): create and edit with the project's `share`; revoke with `revokeShares` (lead, approver), as the link's creator, or as an org owner or admin; the org list is `manageShareLinks`. Creating while `publicLinksAllowed` is off is `409 public_links_off`; a plan without `shareLinks` is `402`.
  - BR-56 in the mock: public lines drop `overridden` and an edit step's `by` and `reason` (the scenario scans every public response for member names, emails, the edit's reason, `decision`, `questions`, `reviewComments`, `createdBy`, prices). It caught the trace steps' author on the first run.
  - The public page reuses `LineDetailBody` (split out of `LineDetailPanel`) and `ModelViewer` with `publicToken` (its scenes and geometry through the public endpoints).
  - "Made with" badge: plans whose entitlements have `exportWatermark` (Free); 05-plans-and-limits names no separate flag.
- **For the next agent:** test hooks `share-boq`, `share-dialog`, `share-label`, `share-create`, `share-url`, `share-link[data-status][data-label]`, `share-views`, `share-revoke`, `share-revoke-confirm`, `org-share-links`, `public-share[data-working]`, `share-line[data-source]`, `share-detail`, `share-gone`.

### 2026-11-13 — M3 decisions: FE-035 (frontend agent)
- **Built:** FE-035, 0e73150. `e2e/versions-flow.spec.ts` (one flow, about 50 s).
- **Decisions taken:** until EN-008, v2 is made in the test from the Duplex by renaming wall `2O2Fr$t4X7Zf8NOew3FNld` (`:138584` → `:138584 moved` in its Name): a valid IFC with the same geometry, parsed for real by the PoC engine, so the change report has exactly one changed element (`name`) and no moved quantity. The test checks the report's lines against `GET /diffs/{id}/lines` (every one caused by `elements_changed`) rather than a fixed list. "No question asked again" is `summary.questionsNew === 0` against version A plus no answers pending. The "Duplex v2 fixture" row in mock-api.md says this.
- **For the next agent:** when EN-008 lands, point this spec at the real v2 fixture and assert F08-AC1's exact lines and elements.

### 2026-11-13 — M3 decisions: FE-034 (frontend agent)
- **Built:** FE-034, 94b079d. `apps/mock-api/src/limits.ts` (`limitHit` for 402s of org usage limits, `usageNow` after the actions that use them), `project_member.added` in `addProjectMember`, messages for every core kind, `src/features/notifications/kinds.test.ts`.
- **Decisions taken:**
  - Limit notifications go to owners and admins, linking to `/{org}/settings/usage`, with `params {limit, current, max}`; a kind is sent once per org and limit per period (calendar month for processing minutes, else 30 days), so a refused action doesn't repeat it. Reaching a limit with a successful action (the last allowed project) sends `limit.reached` at once.
  - The kinds test reads F13's kind table from `apps/mock-api/src/notify.ts` and renders each kind with `next-intl`'s `createTranslator` (adding `intl-messageformat` as a direct dependency failed in npm's workspace install, and it isn't needed).
- **For the next agent:** a new notification kind needs a row in `notify.ts` `KINDS` and a message in `messages/en/notifications.json` (`kinds.<kind with dots as underscores>`); the kinds test fails otherwise.

### 2026-11-13 — M3 decisions: FE-033 (frontend agent)
- **Built:** FE-033, 8029dcb. `features/audit/audit-view.tsx` (S18 and S25), `api/hooks/audit.ts`, `/{org}/settings/audit`; mock `src/audit.ts` (`filterAudit`, `auditView`, `auditCsv`). Checked by `tests/scenarios/audit.test.ts` (5), `apps/mock-api/test/audit.test.ts` (retention) and `e2e/audit.spec.ts`.
- **Decisions taken:**
  - Contract additions: `from`/`to` on `listProjectAudit` and `exportProjectAuditCsv` (F09: filter by date), `GET /orgs/{orgId}/audit.csv` (`exportOrgAuditCsv`, S25 "filter, CSV"). CSV columns: `at, actor, action, entityType, entityId, project, data` (data as JSON).
  - Retention (`auditLogRetentionDays`) applies to both the project and the org audit and their CSVs, counted from the mock clock.
  - Dates in the filter are whole days in the browser's time zone, sent as ISO date-times (start of the first day, end of the last).
  - Action names are translated in `projects.activity.actions` (dots as underscores); unknown ones show their code. Entity names in the new `audit` namespace.
- **For the next agent:** test hooks `audit-view`, `audit-actor`, `audit-action`, `audit-entity`, `audit-from`, `audit-to`, `audit-csv`, `audit-row[data-action]`, `audit-more`, `settings-audit`.

### 2026-11-13 — M3 decisions: FE-032 (frontend agent)
- **Built:** FE-032, 8d49e51. `features/exports/exports-tab.tsx`, the CSV button on S18, mock `exportRun` /
  `downloadExport` / `exportProjectAuditCsv`. Checked by `tests/scenarios/versions.test.ts` "frozen exports and
  the audit CSV" (3) and `e2e/exports.spec.ts` (F12-AC3).
- **Decisions taken:**
  - BR-25 in the mock: `POST /runs/{runId}/exports` on a run frozen in a saved version (and not the working
    version's current run) answers a job that succeeds at once with the frozen `exportId` (output also has
    `frozen: true`); if that file isn't written yet, it writes it as the saved version's. The working version's
    export of the run it shares with the last saved version is a WORKING `boq_xlsx` recorded on the working
    version.
  - Contract: `exportProjectAuditCsv` takes the audit page's filters (`actorId`, `action`, `entityType`), as
    F12 says ("filtered audit events"). The CSV has a BOM, CRLF lines, columns `at, actor, action, entityType,
    entityId, data`.
  - The Exports tab lists exports per revision (`GET /revisions/{id}/exports` for every listed version);
    `job.finished` of an `export_xlsx` job and a revision's `entity.changed` refresh them.

### 2026-11-13 — M3 decisions: FE-031 (frontend agent)
- **Built:** FE-031, f7e9428. Mock `handlers/versions.ts` (issue, submit, request changes, approve, withdraw =
  `reopenRevision`, comments, confirm, reopen; `reopenBoq` moved here from `boqs.ts`); app
  `features/versions/` (dialogs, review strip, Review tab, Versions tab), `api/hooks/versions.ts`. Checked by
  `tests/scenarios/versions.test.ts` (14; the BoqRevision and Boq todos of `state-machines.test.ts` point there)
  and `e2e/versions.spec.ts` (4: save and read-only, confirm and "Reopen to update", the approval flow with two
  browser contexts, withdraw).
- **Decisions taken:**
  - Revision `permissions` (free-form hints) gained state-aware keys: `saveVersion` (approval off and the working
    version can be saved), `submit`, `approve` (approve and request changes; four-eyes applied), `saveApproved`,
    `withdraw`, `comment`, `confirm`, `reopen`. Write keys are false while in review: the UI changes nothing
    until the review is withdrawn. The API still takes edits in review and withdraws it (BR-23,
    `settleReviews` after inputs, line edits and answers: any pending change on a revision in review sends it
    back); generating in review is `409 revision_in_review`.
  - Error codes: `not_ready` (details `reason`: `no_run`, `run_not_finished`, `pending` with `pendingChanges`),
    `label_taken`, `not_approved`, `four_eyes` (403), `revision_in_review`, `approval_off`, `invalid_reviewer`,
    `not_saved` (confirm with approval on while the working version differs from the last saved one).
    `400 invalid_body` with `field: notModelledConfirmed` without the tick.
  - Saving: the label defaults to the number's letter; another label is stored on the revision and must not be
    any other version's (saved label or letter). The next working version keeps the saved run as its current
    run (`basedOnRunId` = the saved one's frozen run), so the sheet stays until the next generate. The frozen
    Excel (`issued_boq_xlsx`) is written by `startRunExport` (exports.ts), its id added to `frozen.exportIds`,
    and the revision announced (`entity.changed`) when it is there.
  - Confirm with nothing new marks the working version `closed` (hidden from `listRevisions`) instead of
    deleting it (a deleted revision made open queries 404 into the not-found page); reopen takes a closed
    working version up again, so letters stay in sequence.
  - Approval is on when `settings.approvalRequired` and the plan's `approvalWorkflow`; switching it on without
    the feature is `402 limit_reached` (`limit: approvalWorkflow`). The app reads `org.settings.approvalRequired`
    as the hint for the confirm dialog.
  - Mutations with `meta.ownConflicts` show their 409s inline, without the global toast (query-client.ts).
  - The submit message is stored as the first review comment.
- **Known issues:** `e2e/boqs.spec.ts` F04-AC2 (a run within 10 s) missed its budget once while four workers ran
  engine jobs at the same time; it passes alone. Watch it in the full e2e run.
- **For the next agent:** test hooks: `save-version`, `submit-for-review`, `save-approved`, `save-version-dialog
  [data-mode]`, `version-label`, `version-note`, `save-not-modelled-tick`, `save-version-submit`, `submit-dialog`,
  `reviewer[data-name]`, `review-strip[data-status]`, `approve`, `request-changes`, `withdraw-review`,
  `withdraw-confirm`, `confirm-boq` (in `boq-menu`), `reopen-boq`, `saved-version[data-label]`, `version-excel`,
  `open-version`, `viewing-version`, `back-to-working`, `review-tab`, `review-comment[data-line][data-outcome]`.

### 2026-11-13 — M3 decisions: FE-030 (frontend agent)
- **Built:** FE-030, 8444b84. `features/changes/` (tab, model), `api/hooks/diffs.ts`, the viewer's "changes"
  mode (`links.ts` `CHANGE_COLORS`, `SceneView.loadGhost`), Compare in the run history; mock
  `handlers/diffs.ts` and the fake `engine/fakes/diff.ts` + `change_report.py`. Checked by
  `tests/scenarios/changes.test.ts` (8), `apps/mock-api/test/diff.test.ts` (5), `features/changes/model.test.ts`
  (5), `links.test.ts` (changes mode) and `e2e/changes.spec.ts` (3, F08-AC4's 3 s on `next dev`).
- **Decisions taken:**
  - Contract fix: `DiffSummary.byModel` (F08 §4 asks for element counts per model; the summary had totals
    only). `RunDiff`'s lines and elements stay behind their paged endpoints.
  - The compare is a `diff` job (subject: the newer run), output `{diffId}`; a pair already compared answers
    `200` with the `RunDiff`. Diffs are cached per (from, to) pair, so A→B and B→A are two diffs. `400
    invalid_body` for runs of different projects or no `againstRunId`, `409 run_not_finished`.
  - `minDeltaPct` hides only changed lines (added and removed always pass). The tab filters in the browser
    (the report is fetched whole, 1000 per page), with the same rule plus: a line whose text or unit changed
    always shows.
  - Element changes only for models whose version differs between the runs (versions are immutable, BR-08):
    the fake reads both scene indexes (the viewer's), so a compare across versions fetches their scenes from
    the engine once.
  - Comparison choice lives in the URL (`?tab=changes&from=&to=`); picking uses `history.replaceState`
    (a `router.replace` cost a server round trip on `next dev` and broke the 3 s budget).
  - The tab shows for `seeAudit` (lead, approver) or `editBoqs` (lead, estimator), S12d; an estimator on an
    archived project loses it with `editBoqs`.
  - The change report Excel is an `Export` of kind `changes_xlsx` with `subjectType: "diff"` (ExportRec
    widened), file `…_Rev<label>_<date>_changes.xlsx`, listed with the revision's exports.
- **Fakes:** "Change report" built (row rewritten in mock-api.md).
- **For the next agent:** FE-031's saved versions make the default comparison work (`basedOnRevisionId`'s
  run); `candidates()` in `features/changes/model.ts` already lists saved versions first. Test hooks:
  `changes-from`, `changes-report[data-diff]`, `summary-<key>[data-value]`, `change-line[data-key][data-change]`,
  `change-causes`, `changes-filter-*`, `change-element`, `changes-export`, `run-pick`, `compare-runs`;
  the viewer has `data-mode` and `data-ghosts`.

### 2026-11-13 — M3 decisions: FE-029 (frontend agent)
- **Built:** FE-029, 966a5b7. `features/boqs/new-model-versions.tsx` in the header (replaces the M1 line that
  only linked to Setup), `reopen-boq-dialog.tsx` (F09 §6, for FE-031 to reuse), badges in the BoQ list and
  the overview. Checked by `tests/scenarios/boqs.test.ts` (2), `apps/mock-api/test/new-versions.test.ts`
  (4) and `e2e/new-versions.spec.ts` (2).
- **Decisions taken:**
  - The mock announces from `markReady` (`announceNewModelVersion` in `handlers/boqs.ts`), so a re-upload
    of identical content (dedupe, no parse) announces too. Every non-archived BoQ whose current revision
    uses an older version is told, confirmed ones included (they show "Reopen to update"). Recipients: the
    project's leads and estimators by effective role (org owners and admins are leads everywhere).
  - `reopenBoq` is in the mock now (FE-031 needs it too): `reopen` permission, `400 invalid_body` without a
    reason, `409 invalid_transition` unless confirmed, `409 boq_archived`; the new draft copies the last
    saved version's inputs and keeps its run as current (so the sheet stays until the next generate), with
    `basedOnRevisionId` = that version. Audit `boq.reopened` with the reason.
  - "Use vN" sends the whole `models` input (PATCH replaces the list) through `useUpdateInputs`, so the
    swap is optimistic like the Setup tab's.
- **For the next agent:** FE-031 builds Confirm; add "Reopen to update" to its e2e flow
  (`reopen-to-update`, `reopen-reason`, `reopen-submit`). Test hooks: `new-model-version[data-confirmed]`,
  `newer-<model>`, `use-newer-version-<model>`, `use-all-newer`, `boq-new-version` (list).

### 2026-11-13 — M2 Library and setup (frontend agent)
- **Built:** FE-021…FE-028, 829d61e..210e7fa (plus the record commits).
- **Exit criteria:**
  - *FL-6 (encode the office standard):* step 1 (New → changes on As modelled) and 2 (Settings, autosave)
    in `e2e/library.spec.ts` and `e2e/library-editors.spec.ts` (FE-022 test); 3 (preview on a project model
    beside the editor) and 5 (publish v1 with a note) in the criterion-7 test; 4 (add a company item, edit a
    formula in its readable form) only through the editor's unit tests (`rule-set-editor.test.tsx` renders
    every item of As modelled and its forms), not end to end; 6 (import the office code list) through the
    API in `tests/scenarios/codelists.test.ts` (F10-AC4, 3 levels and a duplicate) and the import panel's
    unit tests, not end to end in the UI; 7 (starred presets prefill new projects) in
    `apps/mock-api/test/presets.test.ts` and the wizard's "Publish all".
  - *The setup wizard works:* `e2e/setup.spec.ts`: the dashboard waits for it (P18), the 14-switch checklist,
    "Use the suggested answers", resume after a reload, Publish all on a free org without `402`, then the
    Duplex: the preview follows each answer against As modelled, reinforcement estimates can't be left at
    0 kg/m³, walls in m³ show in the preview. F16 step derivation in `src/features/setup/steps.test.ts`
    (14 switches, six measuring screens, a new switch appears with no frontend change).
  - *v1 criterion 7 on the mock:* `e2e/library-editors.spec.ts` "F10-AC1 / v1 criterion 7": a patch on As
    modelled, three settings changed, previewed on the Duplex with changed lines beside the editor,
    published; a new BoQ on version 2 has its windows in m², one on version 1 doesn't. "BoQ versions saved
    earlier are unchanged": saved versions come with FE-031; BR-07 (a BoQ pinned to version 1 keeps it after
    version 2) in `tests/scenarios/library-publish.test.ts`. (fake: preview)
  - *v1 criterion 12 on the mock:* the flow is automated (above); the "person new to the app, under 15
    minutes" part is **not checked**: it needs a person (M).
  - F10 criteria: AC1 (above, fake), AC2 (`library-editors.spec.ts`, `library-publish.test.ts`), AC3 (BR-07
    part only, FE-031 for saved versions), AC4 (`codelists.test.ts`), AC5 (item texts: import labels the
    column, the box with Reads as, lines and Excel carry the filled text: `item-texts.test.ts`,
    `library-editors.spec.ts`; the Reads-as sample with a preview model's value is unit-tested; fake),
    AC6 (`library.spec.ts`, `library.test.ts`), AC7 (`library-publish.test.ts` "F10-AC7 clone": "Based on it"
    stores only changes and follows the original's version 2 from its next save, an independent copy doesn't;
    checked with an org original, since a system preset can't get a version 2 in the mock), AC8
    (`templates.test.ts`, fake).
- **Decisions taken:** in the FE-021 and FE-022…FE-027 entries and below.
- **Deviations from the spec:** the editor ports landed together (FE-022…FE-027 entry); the wizard's items and
  names steps are the full editors (docs/11 "Setup wizard"); contract additions `PreviewResult` (with
  `ruleId`, `keys`, `compare.presetName`), types `LineCode.text` and the setup markers.
- **Fakes:** Preview, Item texts filled, Preset Excel templates, Setup markers built (mock-api.md).
- **Known issues and debt:** docs/11 (Library, Library drafts, Library preview, Item texts, Excel templates,
  Setup wizard, Component tests).
- **For the next agent:** M3 starts with FE-029. Orgs created through `createOrg` in e2e finish setup by
  default (`{ setupDone: false }` to test the wizard); a new org's owner lands in `/{org}/setup`.

### 2026-11-13 — M2 decisions: FE-026…FE-028 (frontend agent)
- **Built:** 210e7fa. FE-026's guided mode (`?mode=guided` on the preset page; new rule sets and classifications
  open in it) and the "bring your own licence" notice; FE-027's item-text box in the code list (insert
  buttons, Reads as with a preview line's values) and the sample text under Codes per line; FE-028 the setup
  wizard (S30), the dashboard gate, onboarding into the wizard, the Library's Guided setup button, the sheet
  hint on system rules.
- **Decisions taken:**
  - The wizard's step 1 is derived in `src/features/setup/steps.ts` from the flattened rule set: the mock now
    serves `flattened` for every rule-set version (not only patches), so As modelled's markers reach a
    patch's parent. Answers go into the draft through the rule-set editor's `answerParams` (a patch stores
    only differences) and its `Answer` control; the screen index is kept in the page, the step in `Org.setup`.
  - Start: a kind the org already has is continued in a new draft of that preset (its first org preset of
    the kind), so a free org never hits `libraryOrgPresets`; otherwise the wizard creates "{Org} rules"
    (a patch on the chosen start), "{Org} items" and "{Org} names" (empty). Publish all publishes what has
    content (a classification with codes, a dictionary with names or terms), stars it, optionally sets the
    preview model's project defaults, then `PUT setup {status: done}`.
  - The preview panel takes a `fixed` model (runs at once) and `otherInputs` (the wizard previews the item
    list and names with its own rule-set draft); the latest result is shared through
    `PreviewResultContext` for item-text samples.
  - Fixed after the full e2e run: previews deleted their temporary presets from the engine's user folder
    while a run (the other queue) was loading it, so runs failed with `FileNotFoundError`; preview jobs now
    share the runs' queue (`runJob(…, queue)`) and wait for the runs' cleanup. Serving `flattened` for every
    rule-set version asked the (busy) engine on every page; it is cached per version and draft revision
    (`flattenedOf` in `handlers/presets.ts`).
  - The dashboard gate: owners, admins and library editors of an org whose setup isn't `done` are sent to
    `/{org}/setup`; members see "Your firm's setup isn't finished yet". Other pages stay open.
- **For the next agent:** wizard test hooks: `setup-wizard[data-step]`, `measure-step[data-screen]`
  (`checklist`, `detail:<slot>`, `measure:<step>`), `setup-switch`, `setup-question`, `setup-next`,
  `setup-suggested`, `setup-skip`, `setup-publish-all`.

### 2026-11-13 — M2 decisions: FE-022…FE-027 (frontend agent)
- **Built:** 5551323. The three editors (FE-022 rule sets, FE-023 classifications with code-list import,
  FE-024 dictionaries with Names in a model), publish and preview (FE-025), clone and Excel templates
  (FE-026 without guided mode), item texts in runs, sheet, line detail and Excel (FE-027 without the code
  list's item-text box). Checked by `e2e/library-editors.spec.ts` (6: autosave and the `?question=` deep
  link, F10-AC1 / v1 criterion 7's flow, F10-AC2, both other editors, clone and template download, item
  texts in the sheet), `tests/scenarios/library-publish.test.ts` (4: publish rules, BR-07, a Duplex preview
  with changed lines), `templates.test.ts` (3: F10-AC8), `codelists.test.ts` (4: F10-AC4), unit tests in
  each editor folder and `apps/mock-api/test/item-texts.test.ts`.
- **Order deviation:** the three editor ports ran in parallel (separate folders and message namespaces:
  `ruleSetEditor`, `classificationEditor`, `dictionaryEditor`) on a shared base built first
  (`features/library/shared/`: the PoC's `fields.tsx` restyled and through `library.fields`, the PoC's
  lists in `vocab.ts` with their words in `library.vocab` (dumped from the PoC's `vocab.ts`, nothing
  rewritten), `story.ts`, `doc.ts` (the PoC's `store.ts` helpers), `json-tab.tsx`, `use-draft.ts`). They
  and FE-025…FE-027 land in one commit because the preset page wires them together; FE-026's guided mode
  and FE-027's code-list item-text box follow with FE-028 (guided mode reuses the wizard's steps).
- **Decisions taken:**
  - Drafts (`use-draft.ts`, no Zustand: React state in one hook): the editor works on a local copy, saved
    1 s after the last change with `If-Match`; `draft_conflict` is handled there (reload or keep mine),
    outside the global 409 toast, by calling the client directly. Edits made while a newer server document
    arrives (e.g. right after publishing) win; only the ETag follows. Read-only users get the editor in a
    disabled `<fieldset>`; navigation uses non-button elements so it keeps working (`RowList` rows are
    `role="button"` divs).
  - A patch's draft follows its parent's latest published version when saved; a published version keeps
    its exact parent (data-model.md says "the exact parent version", F10 §2 "follows the original's future
    versions": both hold).
  - `libraryOrgPresets` counts per kind (05-plans-and-limits.md); FE-021 had counted all kinds.
  - Publish: `400 change_note_required`, `409 no_draft`, `409 draft_has_problems` (details `problems`,
    checked again at publish). Audit `preset.published`.
  - Preview: contract addition `PreviewResult` (the JSON behind `Job.output.previewResultUrl`, which the
    contract named but didn't describe). Output also has `presetVersionId`, `lines`, `compare`. The app waits
    by asking `GET /jobs/{id}` (as exports do) and fetches the signed URL. The panel sits beside the editor
    (≥ 1280 px), remembers the model version in `localStorage`, and runs again after each save ("Follow my
    changes"). Errors: `no_models`, `invalid_inputs`, `model_not_ready`, `no_rule_set`, `preview_error`.
  - Templates: openpyxl through the engine's Python instead of SheetJS (no new dependency, real dropdowns);
    `400 invalid_file` for a file that isn't a workbook; applying puts the proposed document into the draft
    (rows with problems are listed and left out). Clone replaces "Make a copy" on the preset page; the list
    keeps "Make a copy" for system rows.
  - Types first: `Code.description` documented as the item text, `LineCode.text`, `SlotPrompt.setup`,
    `SetupStep`, `RuleSet.setupSteps`, `RuleSetPatch.setupSteps` (EN-010 / EN-011 step 1, as FE-013 did for
    trace steps); `npm run codegen`. The Description column and the export use `codes[groupBy].text`, else the
    line text; an edited description wins.
  - Fixed in earlier work: a run with an org classification saved its code list under a new id but left the
    map's `codeList` on the old one, so the engine failed (FE-008's path; the seeded "Studio trades" hit it).
- **Fakes:** Preview, Item texts filled, Preset Excel templates built; Setup markers' data in place for FE-028
  (mock-api.md).
- **Known issues:** in docs/11 (Library, Library drafts, Library preview, Item texts, Excel templates,
  Component tests).
- **For the next agent:** component render tests need the in-file workaround of
  `rule-set-editor.test.tsx` (two Reacts in the workspace until FE-046); dedupe/alias in `vitest.config.ts`
  was tried and doesn't work because Testing Library and next-intl are external to Vite. Settings test hooks:
  `question` cards with `data-slot`, `data-mine`, `data-focused`; `answer`; `use-default`.

### 2026-11-13 — M2 decisions: FE-021 (frontend agent)
- **Built:** FE-021, 829d61e. S19 `/{org}/library` (a tab per kind, layer filter, archived toggle, New, "Make a copy"
  on system rows), S16 `/{org}/projects/{p}/library` (the project's own presets), create
  `/{org}/library/{kind}/new` (empty / a copy of a version / changes on a rule set; `?mode=&from=&project=`),
  S20 `/{org}/library/{kind}/{presetId}` (header with details, star, copy, archive; tabs Edit, Versions,
  Where used). Checked by `tests/scenarios/library.test.ts` (10), `apps/mock-api/test/presets.test.ts` (3),
  `e2e/library.spec.ts` (8, F10-AC6 included) and `src/features/library/json-diff.test.ts`.
- **Decisions taken:**
  - Mock (mock-api.md "What it implements", Library row): create modes, slugs unique per org and kind
    (system slugs included), the document's id is the slug; a patch keeps `extends` = the parent document's
    id plus `extendsVersionId`. `src/preset-docs.ts` holds the blank documents and `withParents`, which
    passes org parents to the engine's check as `library` documents under `mock-<versionId>`;
    `enginePresetId(version, parents)` saves the same chain for a run.
  - Drafts: ETag `"<versionId>.<rev>"`, in `PresetVersionInfo.etag` and the `ETag` header of
    `GET /preset-versions/{draft}` and `PUT /presets/{id}/draft`. A different `If-Match` is
    `409 draft_conflict` (details `etag`, `updatedAt`); no `If-Match` overwrites (restore as draft). Every
    save runs the engine's check (`503 engine_unavailable` saves nothing). New error code: `preset_archived`
    (409, any edit of an archived preset).
  - Archive is one-way (no unarchive in the contract) and unstars. "Used by" and the usage list count BoQ
    revisions in projects the caller can see.
  - New projects' defaults (F02 §2): the newest starred rule set, every starred classification (by name),
    the global seed dictionary then the starred company dictionaries; only published versions count.
  - Seed: Studio Demo's "Studio rules" (patch on As modelled: wall openings over 0.5 m², windows by area;
    v1 published, a draft that adds lines per storey), "Studio trades", "Studio names"; ids in `SEED_PRESETS`.
    None is starred, so new Studio projects keep As modelled.
  - App: hooks in `src/api/hooks/library.ts`. A draft's document is cached under its ETag
    (`[presetVersion, id, etag]`), so a preset's `entity.changed` refreshes lists, versions and usage but
    never refetches published versions (large code lists on open sheets). The org layer is called
    "Company" in the UI. `src/components/confirm-dialog.tsx`: the registry's `AlertDialogAction` is a plain
    button that never closes its dialog; use `ConfirmDialog` for confirmations that don't navigate away.
  - The Edit tab shows the draft (or the latest version) read-only as JSON, with its problems, "Start a
    draft" and "Discard draft": the editors of FE-022…FE-024 go there.
  - `tests/run.mjs` takes a file filter: `node run.mjs scenarios library --mock`.
- **Deviations from the spec:** none; what F10 §1, 2, 5 leave for later tasks is in docs/11 (Library).
- **For the next agent:** the query client's global 409 handler toasts and refetches on any mutation's 409:
  FE-022's autosave must handle `draft_conflict` itself (the reload-or-overwrite dialog) without that
  toast. The rule-set editor opens the Settings question named by `?question=<slot>` on this page.

### 2026-11-13 — M1 Core loop (frontend agent)
- **Built:** FE-005…FE-020, 8d00621..d7ace66 (plus the record commits). Order deviation: FE-016 (viewer)
  before FE-014 (sheet and model together), which is built on it.
- **Exit criteria:**
  - *FL-1 end to end:* sign-up and sign-in through the mock adapter, the session takeover (1a), onboarding
    with the org on the default tier (2), invitations (3), the empty dashboard (4) and the sample project
    (5): `e2e/auth.spec.ts`, `orgs.spec.ts`, `sessions.spec.ts`, `projects.spec.ts`, and the F01/F02
    scenarios. **Not met:** step 2a, the setup wizard, is FE-028 (M2), and the sample project opens empty
    (docs/11 "Known limitations": its Duplex model, BoQ and answers aren't filled in yet).
  - *FL-2 up to "run complete" end to end:* add a model, upload (presigned PUT), parse job with live
    progress, report, BoQ with presets, generate, run complete with notification and toast:
    `e2e/models.spec.ts`, `boqs.spec.ts`, `notifications.spec.ts`, `duplex.spec.ts`.
  - *v1 criterion 1 (Duplex reproduction) on the mock:* `e2e/duplex.spec.ts` (FE-020) through the UI and
    the lines API against `HAND_BOQ` / `COUNTS` from the engine test; green locally, in the CI e2e job from
    this push on.
  - *Sheet* (F06-AC1…AC8 except AC9–AC11's position numbers and co-editing, FE-040; AC11 measured in FE-008),
    *questions* (F05, FE-010), *viewer* (F07-AC1…AC5, AC7; AC6 with FE-030), *line edits and manual lines*
    (FE-011), *explanations* (F06-AC5 on the "Trace steps" fake), *sessions* (F01-AC5): their e2e specs and
    shared scenarios, all green in the last full run (typecheck, lint, app 89, mock 46, contract 171,
    scenarios 80, engine 194, e2e 64).
  - Criteria passed on a fake (re-checked in phase 3): F06-AC3 (line edits, export), F06-AC5 (trace
    steps), F12-AC1 (the export's layout).
- **Decisions taken:** in the FE-005…FE-020 entries below.
- **Deviations from the spec:** contract fixes (all additive or corrections): `RunLine` and
  `QuestionWithDecision` by reference, `RunLine.excluded` / `overridden.fields`, `Decision.answerType`,
  `BoqLine.trace.steps`, `Run.snapshotVersions.models`.
- **Fakes:** "Line edits applied", "Manual items with codes", "Trace steps", "BoQ export meta" built;
  the others wait for their tasks (mock-api.md).
- **Known issues and debt:** the empty sample project (above); everything else is in docs/11 "Known
  limitations of the product build".
- **Fixed at the end of M1:** a tab signed out with a reason (`session_replaced`) could land on the sign-in
  page without it: a late 401 or the auth gate's own redirect overtook the sign-out's navigation
  (`src/auth/leaving.ts`); the limit dialog asked `GET /me` on every page, which made it likely, and now
  asks only when it opens. Caught by `e2e/sessions.spec.ts` in the M1 run.
- **For the next agent:** M2 starts with FE-021 (Library shell). The rule-set editor (FE-022) must open
  the Settings question named by `?question=<slot>` (FE-013's links from "How it is calculated").

### 2026-11-13 — M1 decisions: FE-020 (frontend agent)
- **Built:** FE-020, d7ace66. `e2e/duplex.spec.ts` (see the M1 entry).
- **Decisions taken:** the expected lines are not copied into the app: the test reads `HAND_BOQ` and
  `COUNTS` from `engine/tests/test_duplex.py` with the engine's Python (`import test_duplex`), and applies
  the engine test's `q` and tolerance (2e-3 relative, 0.011 absolute) to the lines API.

### 2026-11-13 — M1 decisions: FE-019 (frontend agent)
- **Built:** FE-019, b27d039. `e2e/billing.spec.ts`: the Small Firm seed shows the limit dialog on New project
  with "Upgrade" (the seed is left at its limit); on a fresh free org, Upgrade → plan card →
  `/_dev/checkout` → back with the new plan, and the project now fits; members see neither billing nor
  usage. `tests/scenarios/billing.test.ts`: entitlements with usage, the 402 details, checkout (mock
  only), portal, who may see what.
- **Decisions taken:**
  - The limit dialog finds the org from the page's first path segment and the user's role from
    `GET /me`: an owner gets "Upgrade" (a link to `/{org}/settings/billing`), others "Ask your owner".
  - Billing and Usage are tabs of the org settings, shown by role (`manageBilling`, `seeUsage`).
    Checkout and portal only fetch the provider's URL and go there (F14); the return URL is the page.
  - A plan change arrives as `entity.changed` on the org, which now also refreshes entitlements and
    billing.
  - Mock: usage rows carry `projectId`; parses are recorded too (05-plans-and-limits.md).
- **For the next agent:** don't run checkout on the seeded Small Firm in tests: other tests need it at
  its limit; use `createOrg` for a fresh free org.

### 2026-11-13 — M1 decisions: FE-018 (frontend agent)
- **Built:** FE-018, 94026ce. F13-AC1 in `e2e/notifications.spec.ts` (two tabs: the run the other tab starts
  shows here as a toast, the new run in the header and a bell item within 2 s); bell, list page, read
  state and email preferences there too; endpoints in `tests/scenarios/sheet.test.ts`; who gets an email
  in `apps/mock-api/test/notify.test.ts`. F13-AC2 and AC3 are the pricing module's (MP1).
- **Decisions taken:**
  - Mock: one `notify()` (`src/notify.ts`) for every notification: the row, the SSE event, and an email
    when F13 emails the kind and the recipient's category is on. Kinds map to the contract's core
    categories (jobs, versions, reviews, membership, limits); preferences are stored per user, missing =
    on; `PUT` with an unknown category is `400 invalid_body`.
  - Job notifications carry `params.jobId`; `src/realtime/local-jobs.ts` holds the jobs this tab shows
    itself (exports), whose notifications go to the bell without a toast. A finished run is
    `job.succeeded` (or `run.needs_input`), an export `job.succeeded` with the file name.
  - The bell queries `GET /notifications?limit=8` (its count is the response's `unreadCount`); the page
    is `/notifications` outside the org shell, like `/account`. Email checkboxes keep a local value so a
    tick shows at once.
- **For the next agent:** e2e tests run in parallel as the same seeded users: don't compare unread
  counts; look for the item. `current-run` now has `data-run` (the run id).

### 2026-11-13 — M1 decisions: FE-017 (frontend agent)
- **Built:** FE-017, da07e51. F12-AC1 and F06-AC3's export part in `e2e/exports.spec.ts`: a Duplex BoQ with a
  quantity edit and an exclusion downloads from the sheet; read back with openpyxl (the engine's venv), it
  has every line of the BoQ and none excluded, the sheet's totals per unit, and the edit with its reason.
  The job, record and download in `tests/scenarios/sheet.test.ts`.
- **Decisions taken:**
  - The export is the PoC engine's own writer, run by the mock with the engine's Python
    (`engine/fakes/export-xlsx.ts`, `IFC_BOQ_PYTHON` or `engine/.venv`), over the result the mock keeps
    (with the line-edit fake applied). No new spreadsheet library in the mock; `engine/` is unchanged.
  - The app waits for the job by asking `GET /jobs/{id}` every 500 ms (independent of SSE), then fetches
    the file through the API client (`parseAs: "blob"`) and saves it with the export's file name.
  - The button sits in the sheet toolbar and exports grouped by the sheet's Group-by system. Every
    project role may export (permissions.md: exports are visible to all).
  - Mock store: `exports` (ExportRec, with `storageKey` under `orgs/<org>/exports/<id>/`); audit
    `export.created`. Error: `400 invalid_body` for a `groupBy` the run doesn't have.
- **Fakes:** "BoQ export meta" row updated (what the fake writes, what it lacks until EN-006).
- **For the next agent:** to read an exported xlsx in a test, use the engine's openpyxl
  (`boqRows` in `e2e/exports.spec.ts`).

### 2026-11-13 — M1 decisions: FE-014 (frontend agent)
- **Built:** FE-014, 4a372cd. F07-AC5 in `e2e/sheet-model.spec.ts` (storey + code group narrow the sheet to
  the expected lines and the model's scope to exactly their meshes; a Shift-drag box selection lists
  "N lines from M elements" with "Select these lines" → the bulk bar and "Only these lines"); group row →
  its elements, `I` isolates, Esc clears, a selected line is highlighted, the divider resizes; the
  *Edited* mode counts an edited line's elements. F07-AC6 (Changes) waits for FE-030.
- **Decisions taken:**
  - The split is the Sheet tab itself at ≥ 1280 px (`matchMedia` on first render), toggled by a "Model"
    button; the sheet keeps 55 % (30–75 %, pointer or arrow keys on the divider). The line detail moves
    under the model in the split. The Viewer tab stays for narrower screens and "Show in 3D" links.
  - Filters are the sheet's (`SheetFilters` gained `group`, the Group-by system's top-level code, and
    `keys`); the model gets the filtered lines as `scope` and ghosts every other element.
  - Selection: the sheet's line → `focusLine`; a selected group row (click outside its name) →
    `focusKeys`; picks in the model come back through `onSelectionChange`. Shift-drag is box selection
    (elements whose bounding-box centre is inside the box); Shift-click adds to the pick.
  - Keyboard in the model (when it has focus): Esc, F, H, I (F07 §9).
- **Deviations from the spec:** none; the filters not built are in docs/11.
- **For the next agent:** Playwright's Desktop Chrome is 1280 px wide, so e2e tests run with the split
  view open; a group row is wider than the sheet's half, so click it with `dispatchEvent("click")`.

### 2026-11-13 — M1 decisions: FE-016 (frontend agent)
- **Built:** FE-016, 2b39f98. F07 criteria 1–4 and 7 in `e2e/viewer.spec.ts` (a line highlights exactly its
  elements' meshes, a roof line its slabs; an element lists every line it feeds with its share; coverage's
  unmatched count equals the unmatched questions' occurrences, on the "demo-custom" rule set, which
  leaves 117 Duplex elements unmatched; a two-model run (buildingSMART IFC4 Building-Architecture +
  Building-Structural) toggles each model; warm-cache opening under 3 s on `next dev`). Viewer data in
  `tests/scenarios/sheet.test.ts`; links and colour modes in `src/features/viewer/links.test.ts`.
  Criterion 5 (one filter bar, box selection) is FE-014's, criterion 6 (Changes) F08's.
- **Decisions taken:**
  - three 0.169.0 (the PoC's), imported on demand when a viewer opens (`features/viewer/scene-view.ts`,
    a port of `SceneView.ts` with a group per model, storey filter, hide, isolate, a section box as six
    global clipping planes, shift-pick). `links.ts` is the PoC's links over run lines, plus
    `directLinesOf` (an aggregate's parts aren't counted twice; picking a roof slab picks the roof).
  - The glb comes through the API client (`parseAs: "arrayBuffer"`, the 302 followed), so the bearer
    token goes with the first request; the mock's signed URL for geometry is stable for a day and
    served `immutable`, so the browser cache makes reopening fast.
  - The Viewer is a tab of the BoQ workspace (between Questions and Log). "Show in 3D" links are
    `?tab=viewer&line=<key>` or `&guids=<a,b,…>` (at most 300); "Open in the sheet" is `?tab=sheet&line=`,
    which the sheet now selects and scrolls to. The model version page shows a run-less viewer (type
    colours only) for "View in 3D" and each check's "Show in 3D".
  - Test hooks on the viewer element: `data-ready`, `data-meshes`, `data-visible`, `data-focus` (meshes
    highlighted), `data-picked`.
- **Deviations from the spec:** contract fix: `Run.snapshotVersions.models` (model, version, discipline,
  `traceId`): F07 §2 loads the run's model versions, and the Run didn't say which they were.
- **Fakes:** none; mock-api.md "What it implements" gains a Viewer row (coverage semantics).
- **For the next agent:** FE-014 builds the split view on `ModelViewer` (`features/viewer/model-viewer.tsx`):
  lift its selection (`picked`, focus) to the workspace so sheet and model share it.

### 2026-11-13 — M1 decisions: FE-013 (frontend agent)
- **Built:** FE-013, 04f24c7. F06-AC5 runs on the Duplex (fake) in `tests/scenarios/sheet.test.ts` (every
  line's steps add up to its quantity; the brick wall line has start, deduct with
  `param: "wall_opening_threshold"`, result; derived lines name their source lines) and `e2e/sheet.spec.ts`
  (the section comes before the formula, the steps add up, the setting links to its question, a derived
  line opens its source, an edited line shows who and why). Unit tests of the fake:
  `apps/mock-api/test/trace-steps.test.ts`.
- **Decisions taken:**
  - Types first: `BoqLine.trace.steps?: TraceStep[]` is in `packages/types/src/engine.ts` now, as EN-013
    specifies, so EN-013 only has to fill it. A step's `value` is its **contribution** in its unit
    (deductions negative, a factor or a rounding as the difference it makes, an edit as the new quantity
    minus the engine's); the values before `result` add up to `result.value`, which is the line quantity.
    Codes (EN-004 style) are listed in the type's comment; the app looks them up as
    `boqs.how.codes.<code with dots as underscores>` and shows the raw code if it has no message.
  - A deduction step's `param` is the threshold's slot (EN-013 acceptance), and `params.modeParam` names
    the mode's slot; the app links both. A derived step carries `sourceLines` (all of them) besides the
    engine's `sourceLine`.
  - The edit step uses the override's author (`params.by`, the user's name) and reason, as applied by
    the run; the step order is start → add/deduct → factor → minimum → round → (derive) → edit → result.
  - Settings links go to `/{org}/library/rule_set/{presetId}?question=<slot>` (S20 with a query for the
    question): FE-021/FE-022 must serve it and open that Settings question.
- **Deviations from the spec:** none.
- **Fakes:** "Trace steps" built (`engine/fakes/trace-steps.ts`), its row in mock-api.md updated.
- **For the next agent:** steps are written into the stored result at run time; runs made before this
  change have none (the detail says to generate again).
- **FE-015 (bf3c48b), decided:** collapsing the "not in the models" notice is kept in `localStorage`
  per user id (the contract has no user preferences besides notifications); the counts leave excluded
  lines out. The second half of FE-015's acceptance (no saved version without the tick) is FE-031's.
  e2e: `signInAs` signs in only when nobody is; to switch users in one page, overwrite
  `boqlet-mock-session` in `localStorage` (as `F06-AC8` in `e2e/sheet.spec.ts` does).
- **Order:** FE-016 (viewer) goes before FE-014 (sheet and model together), which needs it.

### 2026-11-13 — M1 decisions: FE-012 (frontend agent)
- **Built:** FE-012, 924857e. F01-AC5 / v1 criterion 16 in `e2e/sessions.spec.ts`; the Session state
  machine's two todos are scenarios now (`tests/scenarios/state-machines.test.ts`).
- **Decisions taken:**
  - The session id travels in the mock's bearer token, `mock:<userId>:<sessionId>` (a `sid` claim bound
    at session creation, 04-architecture/security.md). `AuthAdapter` gained `appSession()` and
    `bindAppSession(id)`; the generic `AuthGate` opens the session after sign-in (`src/auth/app-session.ts`),
    so a real adapter only has to bind the id its own way (cookie: nothing to do).
  - Tokens without a session id are test clients' (shared suites, e2e `signInAs`, dev tools): the mock
    accepts them without the one-session check, so parallel tests as one seeded user don't take over each
    other. e2e helpers mark such sign-ins `sessionless`; `pickOnSignIn` signs in through the page and takes
    over when asked. The suites get a session with `inSession(user, id)`.
  - The start page (`/`) is gated too. Signed-out reasons (`session_replaced`, `session_expired`) reach the
    sign-in page as `?reason=` from three places: the `session.revoked` event, any query's 401, and a 401 on
    the event stream (a page that asks nothing else learns it there).
  - Error codes: `session_active` (409, body `SessionConflict`), `session_replaced`, `session_expired` (401).
    `ApiError` keeps the whole error body (`body`) for errors with more than `details`.
  - The mock sign-in moved from `sessionStorage` to `localStorage` (architecture.md updated): F01 §10 says
    the tabs of a browser share one session.
  - Seeded Marko session: "Firefox on macOS", place "Amsterdam" (mock-api.md "Seed data").
- **Deviations from the spec:** none.
- **Fixes in earlier work:** the mock left every preset it saved for a run in the engine's user folder
  (`presets/user`, read on every run); after many e2e runs ~100 project dictionaries slowed runs past the
  e2e's 10 s budget. They are deleted after each run now (`startRun` in `handlers/boqs.ts`), without
  holding the run's job (awaiting the deletions made the job finish after its run, which CI caught in
  `scenarios/boqs.test.ts`); the next run and `POST /presets/check` wait for the deletions first
  (`presetsSettled`), so a late deletion never removes a preset just saved again under the same id.
  Of six local scenario passes after this fix, one stalled in `boqs.test.ts` (F04 run tests) without an
  error to go on; if CI shows it again, look at the engine calls in `startRun` first.
- **For the next agent:** the suites still don't exercise the app's session; with a seeded user, sign in
  through `signInAs` (session-less) unless the test is about sessions.

### 2026-11-13 — M1 decisions: FE-011 (frontend agent)
- **Built:** FE-011, fb0a50c..55d8bc2. F06-AC3 (without the Excel part, FE-017), AC4 and AC6 run in
  `tests/scenarios/line-edits.test.ts` (fake) and `e2e/line-edits.spec.ts`.
- **Decisions taken:**
  - An override is replaced whole (`setOverride` and every batch entry): the app always sends a line's
    complete edit (`withChange` in `apps/app/src/features/boq-sheet/edits.ts`). The app writes every edit
    through `POST /boqs/{id}/overrides/batch`, so an edit of many lines is one request and its undo is one
    batch too (`batchFor`).
  - Display: the sheet rebuilds each line from the engine's values (`RunLine.overridden` keeps them) and
    lays the BoQ's *current* overrides over them, so an edit shows at once and a restored edit disappears
    before the next run. Manual lines saved since the run are pending rows (italic, "Next run").
  - Order: `sortAfter` applies within the section of the Group-by system shown; dropping a line on a line
    of another section also moves it there; `null` means first. Excluded lines stay in the count of a
    group but leave its sum.
  - Unit edits are sent as typed: without a quantity edit the API refuses them (`409 unit_needs_quantity`)
    and the sheet shows the reason (F06-AC4). Restoring a quantity restores its unit; a reason is kept only
    with a quantity or an exclusion.
  - Clicking a line now selects it (FE-009 toggled it off on a second click): the toggle closed the detail
    on the first click of a double-click and moved the cells under the pointer. Escape and the close button
    close the detail.
  - The run's `classifications` use the engine's system id (`engineIdOf` in `handlers/boqs.ts`): shipped
    lists keep their slug, others are `mock-<versionId>`, the key of the lines' `codes`.
  - Error codes added: `unit_needs_quantity` (409), `reason_required`, `unknown_code`, `invalid_quantity`
    (400), `duplicate_id` (409, a manual line id used twice in a BoQ).
- **Deviations from the spec:** contract fix: `RunLine.excluded` and `overridden.fields` with the engine's
  values per field (EN-003 extended describes them; the contract only had the quantity).
- **Fakes:** "Line edits applied" and "Manual items with codes" built (`engine/fakes/line-edits.ts`).
- **Known issues and debt:** the engine's check skips manual items' `formula` (docs/11; for EN-007).
- **For the next agent:** e2e: select a line before double-clicking one of its cells (the detail opens and
  the sheet narrows); line keys go into selectors as `[data-key=${JSON.stringify(key)}]`.

### 2026-11-13 — M1 decisions: FE-010 (frontend agent)
- **Built:** FE-010, fa27738..5050aea. F05 criteria 1 and 3 run on the Duplex (`tests/scenarios/questions.test.ts`,
  `e2e/questions.spec.ts`): a BoQ with no dictionaries needs input (the Duplex's materials and wall types
  are unknown names), answering them and regenerating gives `complete`, bulk answers are one request.
  Criterion 4 (BR-23) is checked in `apps/mock-api/test/decisions.test.ts` with an approved revision
  written into the store: reaching `approved` through the API comes with FE-031, whose scenario should
  repeat it end to end. Criterion 5 waits for org dictionaries (FE-021, M2); the promote endpoint is tested.
- **Decisions taken:**
  - A run's `request.decisions` is the snapshot of the project's decisions it was sent, each with the
    question it answers; `askedQuestionIds` / `blockingQuestionIds` are the result's open questions.
    "Answered after this run" and the pending change `decisions` both mean: for a question the run asked
    or was sent an answer for, the current answer differs from the one sent (`apps/mock-api/src/decisions.ts`).
    The engine drops answered questions from its result, so `GET /runs/{id}/questions` adds them back from
    the snapshot, listed as answered.
  - Decisions keep history (`supersededAt`); repeating an answer unchanged keeps its row. Name answers
    become exact, case-sensitive entries `answer:{field}:{raw}` in the project dictionary (a new published
    version per request), and the same entry goes to an org dictionary on promote.
  - Answer values per control: a term id; a number or `"flag"` (flag the line); a rule id or `"exclude"`;
    a code; an option value; `null` = "leave it". The mock checks the answer against the question the
    project's runs asked (`400 invalid_answer`); kind mismatch is `400 invalid_body`. Error codes added:
    `invalid_answer`, `not_promotable` (409), `invalid_preset` (400).
  - BR-23 in the app: the dry run is sent only when a BoQ of the project is `in_review` or `approved`
    (from the BoQ list), so an answer is otherwise one request (F05-AC3). Clearing has no dry run in the
    contract: the app dry-runs a different valid answer for the same question, which lists the same
    revisions; clearing reopens them like an answer does.
  - Bulk selection: same kind and same control (`term:<category>`, `code:<system>`, `number:<unit>`,
    the choice's option values); "Select all like these" fills it from the first selected row.
  - The decisions page is shown to every project member; changing is for `answerQuestions`. Edit uses
    `Decision.answerType`; rule and code answers are typed there (their lists come from a run's presets).
  - New message namespace `questions` (tab and decisions page). Realtime: `entity.changed` with
    `entityType: "decision"` (entityId = the project) refreshes decisions and every run's questions.
- **Deviations from the spec:**
  - Contract fix: `QuestionWithDecision` lists Question's fields by reference (as `RunLine`) and
    `answeredAfterRun` is required. `Decision.answerType` added (optional): S13 must edit an answer, and
    a decision had no way to say which control its question takes.
  - No "Show in 3D" or model filter yet (F05 §1, §9): the viewer is FE-016 (docs/11).
- **Fakes:** none added; mock-api.md "What it implements" gains a Decisions row (how "used by latest runs"
  is approximated until EN-002).
- **Known issues and debt:** the sample project is still created empty (docs/11).
- **For the next agent:**
  - `generatedDuplexBoq(bytes, slugs, inputs)` (e2e helpers) takes input overrides; `{ dictionaryVersionIds: [] }`
    gives a run that needs input. In the mock, that run asks 34 blocking questions (materials and wall
    types); the engine CLI with `presets/dictionaries/project-duplex.json` asks 33.
  - The PoC CLI on Windows needs `PYTHONUTF8=1` to read its own JSON output.

### 2026-11-12 — M1 decisions: FE-008 and FE-009 (frontend agent)
- **Decisions taken:**
  - Runs on the interim engine path (`apps/mock-api/src/handlers/boqs.ts`): shipped system presets
    (version 1) go to the PoC by their own id; any other preset version is saved once as
    `mock-<versionId>` (doc id rewritten). The project dictionary's latest published version is appended
    as the last dictionary (it is never listed in `inputs.dictionaryVersionIds`; listing it answers
    `400 invalid_inputs`). The full `BoqResult` is stored gzipped at `orgs/<orgId>/runs/<runId>/result.json.gz`;
    lines, line detail, warnings and log are read from it (`handlers/lines.ts`, cached per run).
  - A run's `request` keeps the inputs and the project dictionary version it used; `pendingChanges`
    compares them with the revision (`inputs.models`, `inputs.ruleSet`, `inputs.classifications`,
    `inputs.dictionaries`, `inputs.federation`, `inputs.resolution`). FE-010 adds `decisions`
    (`request.decisionsHash` is there, empty).
  - The revision's `currentRunId` moves only on `complete` / `needs_input`, to the newest run by creation
    time; a failed or cancelled newer run leaves it. The header derives its state from the run list
    (`apps/app/src/features/boqs/run-state.ts`).
  - Mock error codes added: `boq_archived`, `no_models`, `no_rule_set`, `invalid_inputs`,
    `preset_unavailable`, `run_not_finished`. Run failures carry `engine_unavailable` or `run_error`.
    Notifications: `run.needs_input`, and `job.failed` for a failed run.
  - BoQ archive and restore are the lead's (`archive` permission key); revision `permissions` turn
    `editBoqs`, `answerQuestions`, `editLines`, `saveVersion` off for an archived or confirmed BoQ and a
    revision that isn't `draft`.
  - Setup edits are saved one change at a time (`PATCH /revisions/{id}`), optimistically in the app.
  - The sheet groups, filters and subtotals client-side (`features/boq-sheet/model.ts`, pure, tested);
    TanStack Table only owns the columns and their visibility; rows are virtualised at 32 px in their
    own component with memoised rows. A group whose lines are all "to confirm" shows no sum.
  - `readable.ts` is ported to `apps/app/src/features/library/lib` with labels from the `library`
    message namespace (`library.names.<name>.label`); slot labels come from the run's rule-set version
    (`GET /preset-versions/{id}`, which returns `flattened` for patches through the engine's check).
- **Deviations from the spec:**
  - Contract fix: `RunLine` was `allOf` the generated `BoqLine`, whose `additionalProperties: false`
    rejects `sortIndex`, so no response could validate. It now lists BoqLine's properties by reference
    (`openapi.yaml`). `QuestionWithDecision` has the same construction over `Question`: FE-010 must fix it
    the same way.
  - Fixed in the mock router (FE-008): an operation's inline query parameters were validated against
    the wrong schema when the path has parameters of its own (the merged list shifted the pointers).
- **Measured (F06-AC11, nfr.md):** 20,000 lines, Chromium 1440×1000 on the owner's machine:
  production build 60.0 fps scrolling (p95 frame 16.8 ms), Group by switch 27 ms; `next dev` 58.3 fps,
  switch 379 ms. `e2e/sheet.perf.spec.ts` holds 300 ms only with `E2E_PRODUCTION=1` (start the app with
  `API_PROXY_TARGET=http://localhost:4010 npm run build:app` then `npm run start -w @ifc-boq/app`;
  production builds proxy `/api/v1` only when `API_PROXY_TARGET` is set at build time).
- **Known issues and debt:** run results are read from the mock's blob folder per request (cached for
  8 runs); fine for the mock, not a pattern for Java (which ingests rows, 07-backend).
- **For the next agent:**
  - `tests/run.mjs` gives the suites' private engine its own `IFC_BOQ_USER_PRESETS` (the suite's temp
    folder), so runs don't fill `presets/user`.
  - e2e helpers `modelWithVersion` and `generatedDuplexBoq` set up a ready model and a finished run
    through the API in a few seconds (the second upload of the Duplex reuses the parse).
  - Message keys can't contain dots: pending-change codes like `inputs.ruleSet` are looked up as
    `inputs_ruleSet`.
  - Don't edit `apps/app` files while Playwright runs against `next dev`: a reload breaks a running
    test (seen once in `shell.spec.ts`).

### 2026-11-12 — M1 decisions so far: FE-005…FE-007 (frontend agent)
- **Decisions taken:**
  - Project `permissions` keys are fixed in `03-domain/permissions.md` (FE-006); the mock computes
    them in `apps/mock-api/src/projects.ts`. Org-level gating uses `orgCan` from `GET /me` roles.
  - Mock error codes added where the contract left them open: `own_role`, `already_invited`,
    `email_mismatch`, `confirm_mismatch` (F01), `not_org_member`, `last_lead` (F02), `upload_missing`
    (F03). Java should use the same codes; the shared scenarios assert them.
  - The mock signs people up with `POST /_dev/users {name, email}`; the suites read invitation
    links from `/_dev/outbox` (`tests/support/mail.ts`). Java needs a test-only mail sink and a
    token strategy (`tests/support/users.ts`) after BE-000.
  - `node tests/run.mjs <suite> --mock` starts a private PoC engine (the venv's uvicorn, no reload,
    free port) and a fresh mock pointed at it; scenarios that parse need it.
  - Jobs in the mock: `apps/mock-api/src/jobs.ts` (one at a time per type, progress over SSE);
    model versions in `handlers/models.ts`. The app shows job progress from the `jobProgress`
    query, which SSE `job.progress` events overwrite.
  - Codegen keeps fields with a `default` optional (`defaultNonNullable: false`).
- **Deviations from the spec:** none beyond those listed in `docs/11` "Known limitations of the
  product build".
- **Known issues and debt:** the PoC sends `null` for optional `NameUse` fields (the mock drops
  them; EN-001's worker should omit them).
- **For the next agent:**
  - e2e: Playwright starts engine, mock and app (or reuses running ones); run with two workers;
    give every created model, project and org a unique name: tests run in parallel as the same
    seeded users and receive each other's notifications.
  - Forms that must not submit before hydration render after a client fetch (the mock sign-up form).
  - Audit action codes contain dots; message keys use underscores (`project_created`).

### 2026-11-12 — M0 Consolidation, contract and scaffolding (frontend agent)
- **Built:** FE-000, FE-001, FE-002, FE-003, FE-004, TS-001; 0921ea9..dfa66f0 (plus the record commits).
- **Exit criteria:**
  - The PoC runs from `boqlet_v1/` (`npm run dev:poc` served the app and the Duplex sample;
    `VITE_DEPLOYED=1 npm run build:poc` built; `api/index.py` loads the engine from
    `boqlet_v1/engine`). The live demo deploys from `main`, which is untouched (P46); a Vercel
    preview of `v_1` was **not checked** (no Vercel access from the session).
  - `packages/api/openapi.yaml` lints: `npm run api:lint`, CI job "Contract".
  - Next app and mock start with `npm run dev:app` (with the PoC engine): checked by hand,
    `GET /api/v1/me` through the Next proxy on 3000 answered for Marko.
  - The mock answers `GET /me` for seeded users: `tests/contract/me.test.ts` (every seeded user).
  - The mock runs the Duplex through the PoC engine: `apps/mock-api/test/engine.test.ts`, green
    locally and in CI (engine job, 19 passed, none skipped).
  - CI runs lint, typecheck, engine tests and the contract tests: `.github/workflows/ci.yml`,
    run 43253334880 green (contract, typecheck and build, e2e, engine, suites).
- **Decisions taken:**
  - Versions pinned and listed in `06-frontend/architecture.md` "Pinned versions" (Next 16.4.6,
    React 19.3.1, Tailwind 4.3.5, Base UI 1.9.0, next-intl 4.15.1, TanStack Query 5.107.1,
    ESLint 9.39.5, Vitest 5.1.0, Playwright 1.65.0, Hono 4.13.18, openapi-typescript 7.13.0,
    openapi-fetch 0.17.0, Redocly 2.77.0).
  - shadcn/ui: the preset `b38miVKzY` decodes to style `base-mira`, Lucide, JetBrains Mono, radius
    small; colours and radius replaced by the guidelines' tokens in `apps/app/app/globals.css`.
    The registry's components import an npm package `cn`, which this repo doesn't take:
    components are added with `npm run ui:add -w @ifc-boq/app -- <name>` (the CLI's own dry run,
    `cn` pointed at `src/lib/utils.ts`). Local changes: `dialog.tsx` translates "Close",
    `button.tsx` is 32 px / 13 px.
  - i18n: next-intl without a locale in the URL; the cookie `boqlet-locale` holds the language;
    `en-XA` is generated from `messages/en` before dev, build and typecheck (git-ignored).
    Namespaces are listed in `src/i18n/config.ts`.
  - Theme: next-themes, default "system" (light unless the OS is dark), class on `<html>`.
  - Data layer: one `api` client (`src/api/client.ts`), `ApiError` thrown by middleware, global
    handlers registered by their owners (`src/api/global-errors.ts`), keys in `src/api/keys.ts`.
  - Mock: every `/api/v1` request is matched against the bundled contract, authenticated and
    validated before its handler; operations without a handler answer `501 not_implemented`;
    in dev every JSON response is validated (drift → 500). Unknown fields are rejected at the
    top level of a body only. Seed ids are stable (`seedId`); Olivia owns both Studio Demo and
    Small Firm (the seed table names no owner for Small Firm); a plan limit that is unlimited
    or "custom" is left out of `entitlements`.
  - The contract loader is `@ifc-boq/api/spec` (shared by the mock and the suites).
  - Suites: `tests/` is a workspace; `node run.mjs <suite> --mock` starts a fresh mock. The
    token strategy per backend lives in `tests/support/users.ts` (mock now, Java after BE-000).
- **Deviations from the spec:**
  - FE-001 created a minimal `apps/app` (shadcn needs a project to initialise); FE-002 built the
    skeleton on it.
  - TS-001 "one scenario per state machine run green": the scenario suite has one group per
    state machine, but only the clock scenario runs; each transition is an `it.todo` naming the
    task that builds the behaviour (the mock has no projects, models or BoQs yet). Those tasks
    turn their todos into tests.
  - SSE responses carry `Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no`
    (added to `05-api/conventions.md`): without `no-transform` the Next dev rewrite gzips and
    buffers the stream.
  - The 402 body's details are `limit`, `current`, `max` (conventions.md); FE-002's limit dialog
    first read `used` and was fixed in FE-003.
- **Fakes:** none yet (`apps/mock-api/src/engine/fakes/` holds only its README).
- **Known issues and debt:**
  - `OrgSettings.numberFormat.thousands` in `openapi.yaml` has no narrow no-break space (U+202F),
    the default F15 and the design guidelines name: fix the contract in FE-005 (org settings).
  - e2e runs against `next dev` with two workers (more make first visits time out); a production
    build would be faster in CI (FE-045 or earlier if it gets slow).
  - The start page (`/`) has its own query client (it sits outside the signed-in layout).
- **For the next agent:**
  - Run every npm command in `boqlet_v1/`. `npm install <pkg> -w <ws>` can fail on this machine
    with npm's "Cannot read properties of null (reading 'location')": add the dependency to the
    workspace's `package.json` by hand and run a plain `npm install`.
  - Vitest is started through `scripts/vitest.mjs` (app, mock) and `tests/run.mjs`, which
    upper-case a Windows drive letter in the cwd; started from Git Bash otherwise, Vitest loads
    itself twice and every suite fails.
  - Stopping servers on Windows: `Get-NetTCPConnection -State Listen` returns nothing on this
    machine; look up the owner of a port without `-State` and stop that process tree. A background
    `npm run dev:*` leaves its children (Vite, Next, tsx, uvicorn and its `spawn_main`) running
    after the parent stops.
  - Long shell heredocs with many files sometimes fail to parse in the Bash tool; write files
    with the editor tool instead.
  - `next dev` writes `apps/app/AGENTS.md` (Next's own agent notes); it is committed.
