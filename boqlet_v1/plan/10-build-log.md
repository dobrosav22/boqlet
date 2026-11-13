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
| Phase | 1 (frontend on the mock), milestone M3 (Versions, exports, sharing, notifications) |
| Role | Frontend agent |
| Last task done | FE-029 New model versions (966a5b7) |
| Next task | FE-030 Change report (F08 §3–7) |
| Waiting for the owner | — (the owner asked this session to stop after FE-037, the end of M3) |
| In progress (not committed) | — |
| Notes for the next session | Read the M3 decision entries (newest first), then the M2 entry, then the FE-026…FE-028, FE-022…FE-027 and FE-021 entries, then the M1 entry and the M1 decision entries below. Read the M0 entry below ("For the next agent"). In short: run npm in `boqlet_v1/`; `npm run dev:app` starts engine + mock + app; sign in at http://localhost:3000 as a seeded user; add mock handlers per operationId in `apps/mock-api/src/handlers/` and register them in `app.ts`; turn the scenario todos into tests as their tasks land. Whether Vercel builds previews of `v_1` was not checked (no Vercel access in the session). |

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
