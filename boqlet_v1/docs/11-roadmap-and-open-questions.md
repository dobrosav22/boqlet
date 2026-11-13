# 11 Roadmap and open questions

What is missing, what is known to be approximate, what to do next, and what is still undecided,
plus a log of what has been done (at the end).
Keep this page current: when you fix a limitation, delete or shrink its row and add a line to
"Done" with the date and commit. When you notice a new limitation or approximation while working,
add a row here before you finish, even if nobody asked: this page is how nothing gets forgotten.

## Known limitations of the engine

| Area | Limitation | Consequence | Where to fix |
|---|---|---|---|
| Validation | Quantities checked only for the Duplex (hand-made BoQ) and the buildingSMART samples; no professional BoQ to compare with; the NBU federations were checked by inspection | Accuracy on real projects unknown: the biggest open question | Reference projects with IFC + professional BoQ (product steps below) |
| Test coverage | 309 files from 30 tools run without engine errors (12); missing: IFC4.3 from real tools, Bonsai / FreeCAD, Revit 2022+, Archicad 24+, files over 60 MB, ifcXML. Federation run only on two Revit 2011 architecture + structure pairs; no MEP model federated | Other tools and big files will surface new quirks | Corpus (09, `npm run corpus`), 12 "Still uncovered" |
| Multi-language names | The seed dictionary resolves English plus a few languages entry by entry. Real projects block on local material names: Dutch (`Kalkzandsteen`, `Staal`, `Metselwerk`, `spaanplaat` in Schependomlaan), Norwegian (`tegl`, `gipsplate` in DURAARK; a few added ad hoc), German (`Leer`) | Most "needs input" results on real files are a name, not an engine problem | Decide a general approach (per-language seed packs, a public term source such as bSDD, or AI suggestions with confirmation) instead of adding languages one at a time |
| Placeholder material names | "Default" (and similar) becomes a blocking name question | Correct but unexplained | A `placeholder_material` parse check, or a dictionary term for "unspecified" with a non-blocking question |
| Infrastructure location | Elements in IfcBridgePart / IfcRoadPart have no storey; lines have no location | Infrastructure BoQs cannot split by part | `storey`-like field for the nearest spatial container |
| Terrain and planting | IfcGeographicElement counted (nr) by as-modelled | Grass, soil, river bed as "1 nr" | Site-works rule set: area / volume by predefined type or material |
| IFC2x3 / IFC4 infrastructure | Exported as proxies and IfcBuilding | Only counted as unknown objects | Dictionary or rules on ObjectType ("sleeper", "rail"); nothing to do in the engine |
| Faces and rooms | Built (Oct 2026): real wall sides, faces per room from geometric contact (0.1 m), rooms measured with net wall area and skirting, also across federated models (needs the mesh sidecar). Limits: openings shared over a side in proportion, not placed; rooms bounded at wall centre lines by a tool are missed by the 0.1 m tolerance; slab top / bottom keep the main area | | Opening placement on faces; `IfcRelSpaceBoundary` 2nd-level geometry where present |
| Footprint / developed area | Only where measured; developed falls back to net area | Sloped roofs and stairs approximated | `measure.py` |
| Deductions | `embedded` works (from solid intersections, also across models) but only where parse's overlap check ran (on by default; the corpus runs had it off), only linear elements in planar ones, and columns (IfcColumn only) in rooms. Recesses only when the IFC marks them (RECESS, ObjectType "Recess"); a void shallower than its host is not detected as a recess | A footing through a slab is not "embedded"; unmarked niches count as through-openings | Recess detection from geometry (depth < host thickness, no filling) if exporters do not mark them |
| Building values | `building.*` are derived when the IFC has no `Qto_BuildingBaseQuantities`: gross floor area = floor slab plan areas, gross volume = slab plan area x storey height (no external envelope), footprint = largest storey | Approximate on stepped or sloped buildings | Envelope from the solids, if a rulebook needs exact gross volume |
| Embedded area | Area taken out of a face = shared volume / host thickness, which assumes the element passes through the whole thickness | A downstand beam half inside a slab deducts half its width from the slab face | Per-face intersection (clip the element's section on each face) if a rulebook needs it |
| Contradiction thresholds | 10% and 5 mm are constants in `measure.py` (`CONTRADICTION`, `THICKNESS_MIN`), not settings; geometric thickness = volume / mean side area, asked only for clear plates | Revit stud walls with joins raise several optional questions per project (NBU: 2-7) | Move to a setting if users find them noisy; review with a QS which differences matter |
| Steel | Nominal kg/m only for metric W shapes parsed from the name | Other sections fall back to volume x density | Bundle a section table (check licence) or read profile area |
| ArchiCAD quantity names | Entries in `quantity_sources.json` are guesses | May miss ArchiCAD quantities | Verify on a real export |
| Questions | `classification_conflict` answers are informative only; contradictions cover volume and thickness (not areas, flags such as IsExternal on a door vs its wall, or materials); overlaps inside one file stay parse checks | | `classify.py`; more contradiction kinds in `measure.py` |
| Overlap check | Sweep along x, then a solid boolean per pair whose boxes overlap | Slow for large or tall models | Spatial index (R-tree / BVH) |
| AI name suggestions | Settings exist, nothing implemented | Unknown names always go to a question | `names.py`; per unique name, cached, thresholds from settings |
| Federation | Built (`federation.py`): ownership, scope, same-GlobalId merge, storeys, overlap questions (solids when the mesh sidecar is there, else boxes), aggregates re-summed, fillings / rooms / embedded linked across models. Shared coordinates assumed | Models in different coordinates are not aligned; without meshes (a parsed.json from an older build, or the CLI given parsed.json without `meshes.npz` beside it) rooms and embedded are not linked across models | Alignment step |
| Federation details | A door is matched to another model's opening by boxes (half of the smaller); if the other model's wall has no opening, only a warning (the wall stays uncut, its area not reduced). Ownership defaults are a first guess: on the NBU sets the structure models also hold roofs, stairs, ramps and some slabs the architecture model does not, reported as `federation_hole` warnings | Possible wrong area on uncut walls; ownership warnings a user must read | Per-project scopes in the platform; review the default ownership table with real project teams |
| Large models | Everything in one synchronous pass; all meshes of every model held in memory during a federated run; nothing over 60 MB tried. The NBU Medical Clinic pair (18 + 19 MB) takes about 2.5 minutes including parse | Unknown time and memory at 100-300 MB | Workers and jobs (10); spatial index; load meshes per need |
| Revisions | No version diff; no change report per line | | Match lines by key and elements by GlobalId |
| Item library / client templates | Not built; no GAEB, no "import a BoQ as template" | | New input or rule-set extension |
| Export | Excel only | | GAEB, ÖNORM A 2063, CSV, IfcCostSchedule |
| Renovation and design options | Renovation: as-modelled's `renovation_scope` / `measure_demolition` (rule-set `scope`, `scope: "out"` items); status read from Revit phasing or IFC `Status` only, other tools' own phase properties not mapped. Design options: field measured, unused | | Map more phase properties as they are met; design options: presets + selectors |
| Units | Imperial output supported by conversion; no imperial presets or descriptions | | Presets |
| Rounding of derived lines | Uses the rule's rounding or the defaults | Fine; noted for QS review | |

## Known limitations of the dev build

- The API is **synchronous**; large files block the request. Upload limit 300 MB (`IFC_BOQ_MAX_UPLOAD_MB`).
- **Answers live in browser memory** for the current model and are sent with every run; reloading
  the page loses them. The CLI accepts a decisions file.
- The **Library** keeps unsaved drafts in browser memory (lost on reload). **Save** writes a draft to
  `presets/user/` (git-ignored, local to this machine, no versions or history); BoQ runs then offer it.
  Shipped presets are never overwritten, a changed one is saved under a new name as a full copy
  (not as a patch on the shipped one). Saving under a renamed id leaves the old file. Runs read
  `presets/` and `presets/user/`; the engine reloads them on every run.
- **Renaming across documents**: renaming an item offers to update the classification maps that use
  its id (as drafts to save) and, in a set based on another, replaces the parent's item and follows its
  calculated items; renaming an answer follows items that choose by it, follow-up questions and
  `p.x = "…"` in formulas. Not followed: description templates that print the old answer, and maps
  or rule sets stored anywhere but this machine (there is no shared store yet).
- **Cached parses** made before parse format 2 are parsed again on the next upload of the same file
  (`PARSE_FORMAT` in `parse.py`), which takes as long as a first upload.
- **Readable formulas** cover formula fields only. Description templates (`{thickness*1000}`) and
  line-split expressions (`IF(p.lines_by_storey, storey, "")`) are read back in words (item sentence,
  "Reads as", split chips) but still typed as code; dictionary terms inside formulas stay as ids
  (`"board.plasterboard"`). The item sentence recognises the common shapes (`IF(cond, field, "")`,
  `COALESCE`, `= null`); other formulas show in their readable form.
- The rule-set editor was clicked through by a headless browser script (item forms, the new-item
  starter, the sentence's jumps), not yet by a person against the 56 questions; expect rough edges.
- **Classification rows** say which rules decide a line's code from the map and the rule set's items
  alone; a condition on line values (material, element type, storey) is shown in words, not checked
  against a model. The BoQ view shows each line's actual code after Generate.
- **BoQ items** have no preview: what an item takes and the lines it makes are seen only after
  Generate. A preview against the loaded model (through the engine) is the next step for the form.
- No auth, single user, CORS allows only localhost:5173. Not for deployment beyond the Vercel demo
  (17): there, IFC files up to 4.4 MB, the engine forgets models between instances (the app re-sends
  them), and Library saves are temporary.
- `engine/.cache` grows with every upload and run; delete it freely.
- On Windows, uvicorn's auto-reload stops the old engine worker with a Ctrl+C console event. When
  `npm run dev:poc` runs without a console window (started by an IDE task or a background tool rather than a
  terminal), the event never arrives: the reload hangs and the old worker keeps serving the old code
  (new endpoints answer "Not Found"). Run it in a terminal, or restart it after engine changes and end
  any leftover `python.exe ... spawn_main` processes.
- The full result (lines, log) is returned in every response; fine for small models, page it in
  the platform.
- The UI loads the Archivo font from Google Fonts; offline it falls back to the system font.
- `npm audit` reports a moderate advisory in Vite 5's bundled esbuild that affects only the dev
  server; upgrading to Vite 6+ is a breaking change left for later.

## Known limitations of the product build (phase 1, `apps/app` + `apps/mock-api`)

Things the product build doesn't do yet, with the task that deals with each.

- The limit dialog (402) says which limit was reached but offers no upgrade path yet (FE-019, FE-035).
- Deleting an org hides it at once; the 30-day removal of its data (BR-52) is not simulated by the
  mock.
- Sign-up in phase 1 is the mock's: any name and email, no verification (the real provider comes
  after BE-000, FE-043).
- Unknown fields are rejected only at the top level of a request body in the mock (nested objects
  pass); Java should reject them at every level.
- The sample project (FL-1 step 5) is created empty: its Duplex model, BoQ and answered questions need
  a parse and a run when the sample is created. Questions exist since FE-010; filling the sample is
  still open (with the seed's Duplex BoQ, mock-api.md "Seed data").
- The dashboard's "Needs you" list is always empty: its items (reviews, runs needing input, new model
  versions, failed jobs) arrive with their features; F02-AC5 (a review request within 5 s) is checked
  in FE-031.
- Project cards count reviews as 0 until those exist (FE-031).
- Project default presets can't be chosen in the project's settings yet. A new project starts with the
  org's starred presets (FE-021, F02 §2), else As modelled and the global seed dictionary; per-BoQ
  pickers exist since FE-008; the wizard's "Publish all" sets defaults (FE-028).
- Models: scope rules can't be edited in the app yet (they need the Library's selector UI, ported with
  the rule-set editor in FE-022; no task names the model setting itself);
  check rows don't open the viewer yet (FE-016, F03-AC5); multipart uploads over 100 MB and resuming an
  interrupted upload are not built; abandoned `awaiting_upload` versions are not cleaned up after 24 h
  (the mock's scheduler, M6); processing minutes are counted for runs only, not parses (FE-019).
- BoQs (FE-008): Save version calls `POST /revisions/{id}/issue`, which the mock answers
  `501 not_implemented` until FE-031 (the button's blocking rule, BR-22, works); the Questions tab shows
  an old run can't be opened or compared from the run history yet (FE-030); a BoQ's model scope is shown, not editable (with the selector UI, FE-022); "Generate a BoQ" is offered on
  the model version page, not yet in the ready notification (FE-018).
- Sheet (FE-009): no position numbers in the No. column (FE-040); Description shows the rule set's line
  text, not item texts (FE-027, EN-010); "Show in 3D" opens the Viewer tab; on
  screens 1280 px and wider the sheet shows the model beside it (FE-014); the app loads up to 20,000 lines at once and doesn't yet switch to the
  server-side grouping above that (the mock serves it; FE-045).
- Sign-out (fixed at the end of M1, FE-012's work): a late 401 or the auth gate could overtake the
  redirect of a tab signed out with a reason; `src/auth/leaving.ts` lets the first redirect win.
- Entitlements (FE-019): the mock bills through the `manual` adapter only (no provider, no webhooks,
  no subscription status other than active; overrides per org come with the backend); the portal just
  returns. The free-plan banner about export watermarks waits for the real export (EN-006, F12). Usage
  before FE-019 has no project and isn't in "by project".
- Notifications (FE-018): the kinds the mock sends so far are a model version ready, a run that needs
  input, and job results for runs and exports; the others arrive with their features (versions,
  reviews, membership, limits, the pricing module's). `model_version.ready` is never emailed (F13: only
  when parsing took over 2 min); offer batching comes with MP1. Email preferences hold the core
  categories only. The bell's count refreshes on new notifications and on this tab's reads, not on reads
  in another tab.
- Run Excel (FE-017): the PoC engine's layout (the "BoQ export" fake until EN-006): no cover sheet,
  "Excluded lines" or "Calculation" sheet, no item-text columns, no hidden line keys; the WORKING mark is
  in the title line, not a watermark; edits are written into the line's notes. The Exports tab, saved
  versions' frozen exports and the CSVs are FE-032; downloads aren't audited yet (`export.downloaded`).
  The export job's toast is the sheet's own; the bell and job notifications are FE-018.
- Viewer (FE-016, FE-014): the *Changes* colour mode and F07-AC6 come with the change report (FE-030,
  EN-002). The shared filter bar has the sheet's filters plus code group and "only these lines": IFC
  class, type and material aren't on a line (they would need the element's properties, F07 §9) and
  "changed since a revision" needs FE-030. In the Viewer tab, *Source* and *Edited* use the run's edits;
  beside the sheet they use its current edits. The split layout and its width aren't remembered. Coverage's "excluded" is every element neither measured,
  unmatched nor covered by a parent (the PoC result doesn't say why an element was left out). Picking
  needs a click on a visible element; above 200,000 elements the merged meshes and id-buffer picking of
  architecture.md are not built (FE-045). "Show in 3D" from a question carries at most 300 GlobalIds in
  its URL.
- Not in the models (FE-015): collapsing the notice is remembered per user in this browser (`localStorage`,
  keyed by user id), not across devices: there is no user-preference endpoint in the contract. The sheet
  builds groups only from lines, so a group with no lines never shows; the paragraph is the empty state of a
  sheet with no lines and the help of the "Add line" dialog. The save-version tick comes with FE-031 (M3).
- How it is calculated (FE-013): the steps come from the mock's "Trace steps" fake, which reads the PoC
  engine's element notes (approximate wording; a line whose notes it can't read is one "sum of n elements"
  step; a derived line's source lines are found by element GlobalId) until EN-013; runs made before FE-013
  have no steps ("Generate again"). Each setting links to `/{org}/library/rule_set/{presetId}?question=<slot>`,
  a page that comes with FE-021, and FE-022 has to open the Settings question named by `?question=`. The edit
  step shows the edit the run applied; an edit made since shows in the line's edits, not in the steps, until
  the next run. The Excel "Calculation" sheet with the same sentences comes with EN-013 / FE-017.
- Sessions (FE-012): the mock knows no place for a session (no IP lookup), so the takeover question
  names the device and the last activity only; a platform admin can't end a session yet (F19, FE-038);
  tokens without a session id (the shared suites, e2e helpers, dev tools) skip the one-session check in
  the mock: Java needs its own test-token strategy (`tests/support/users.ts`, BE-000).
- Line edits and manual lines (FE-011): a derived line doesn't follow an edited quantity and an edit whose line is gone
  raises no question (the mock's "Line edits applied" fake, EN-003); map rules don't see a manual line's
  chosen codes (EN-007); no position numbers to renumber (FE-040), no live co-editing (FE-040); a manual line has no notes (`ManualItem` has no field for them);
  undo keeps the last 20 edits of the open sheet only (not across reloads); edits on a version in review
  are refused (`409 revision_locked`) until FE-031 builds BR-23 for them. The engine's check doesn't
  syntax-check a manual item's `formula` key (`presets.py` EXPR_KEYS): the app sends the formula as a
  formula slot the item points to, which it does check (EN-007 should add `formula` to the checked keys).
- Questions and decisions (FE-010): no "Show in 3D" or element properties from a question (F05 §9,
  FE-016); no model filter (questions carry no model; FE-016 with the element index); promoting needs an
  org dictionary: they can be created since FE-021 (Studio Demo has "Studio names"), and F05-AC5 is
  checked end to end with the dictionary editor (FE-024);
  F05-AC2 (a new model version asks nothing again) is checked with new model versions (FE-029);
  clearing a name answer keeps the entry it added to the project dictionary (edit it in the Library,
  FE-024); on the decisions page, rule and code answers are edited as text (the lists come from a run);
  the BR-23 dry run is skipped when no BoQ of the project is in review or approved, so answering stays one
  request; "used by latest runs" is approximate in the mock (mock-api.md "Decisions").
- Phase-1 interim (FE-008): federation and resolution settings are stored with the inputs but not sent
  to the engine (the PoC API takes neither; EN-001). A rule-set patch on an org or project version is run
  and checked with its parents saved or passed under `mock-<versionId>` (FE-021).
- Library (FE-021…FE-028): the three editors are the PoC's, ported (FE-022 rule sets, FE-023
  classifications, FE-024 dictionaries); federation and resolution settings are edited as JSON. Guided
  mode (FE-026) is the wizard's "How you measure" step for a rule set; for a classification it is the
  full classification editor with a short intro. Not yet: "rebase on latest" for a patch whose parent is
  archived, renaming an item id across classification maps (the PoC's `onItemRenamed`), and the import's
  "keep other columns" (`CodeListBuildRequest` has no `extra`). The "bring your own licence" notice is
  remembered per browser. An item text's "Reads as" sample needs a preview run in the panel beside the
  editor, and codes that only some lines of an item get (split by a condition) show no sample (conditions
  are never evaluated in the browser). Comparing two versions is a line diff of the JSON with sorted keys
  (F10 §5: a structured diff later). Archive can't be undone (the contract has no unarchive). Draft saves
  aren't audited (autosave); creating, renaming, starring, archiving, discarding and publishing are. The
  version list names who published a version, not who last saved a draft.
- Setup wizard (FE-028): steps 0, 1 (1a checklist, 1b details, 1c the six measuring screens, from the
  rule set's data and the "Setup markers" fake), 2, 3 and 4 work, with resume, the dashboard gate (P18),
  the Library's Guided setup button, the members' "not finished yet" notice and the sheet hint. Simpler
  than F16 for now: step 2 is the full classification editor (import, Codes per line with all the rule
  set's items, not only those switched on, no "Suggest codes" by name), step 3 the full dictionary editor
  (its Names tab, not filtered to "worth asking"); the review summarises in counts, not the editors' story
  sentences; the sample Duplex isn't offered as a model (the sample project is still created empty);
  "Setup in progress by {name}" for a second admin and "Start separately" aren't built (both work on the
  same drafts); a wall line measured in m³ shows in the preview as a new line and the m² one as removed
  (the unit is part of a line's key). v1 criterion 12 and F16-AC1 (a person new to the app, under 15
  minutes) are not checked by a person; the flows are automated in `e2e/setup.spec.ts`.
- Library drafts: a patch's draft follows its parent's latest published version when saved (F10 §2
  "Based on it"); a published version keeps the exact parent it was made on (data-model.md). Read-only
  users (members, and everyone on a system preset) see the editors inside a disabled fieldset: tabs,
  list rows and links work, but the filter boxes and pickers used only for looking (the dictionary's
  model-version picker, the classification's rule-set picker and code filter) are disabled too.
- Library preview (FE-025, the "Preview" fake until EN-005): two runs per preview (draft and published),
  queued with runs (they share the engine's user preset folder), so a preview waits for runs in progress; one project's model versions at a time; no BoQ data changes, and the
  time counts as processing. Runs of org classifications now rename the map's `codeList` with the code
  list (fixed: a copied classification failed in runs before).
- Item texts (FE-027, the "Item texts filled" fake until EN-010): plain `{name}` blanks only; an item
  text shows on one line in the sheet (rows are 32 px for the virtualised sheet; F06 §2's three-line
  clamp is not built), in full as a tooltip and in the line detail with "Measured as".
- Excel templates (FE-026, the "Preset Excel templates" fake until EN-012): openpyxl through the
  engine's Python; a classification's Codes per line lists As modelled's items and round-trips only
  single-item map rules; the empty template on the create page is the kind's master preset's layout.
- Component tests: Testing Library and next-intl resolve the workspace root's React 18 while the app
  uses React 19, so render tests need the in-file workaround in
  `src/features/library/rule-set/rule-set-editor.test.tsx` (FE-046 removes the PoC and its React 18).
- New model versions (FE-029): "Reopen to update" is checked in the mock's unit tests only; a confirmed
  BoQ can't be reached in the UI until Confirm lands (FE-031), which adds it to the e2e flow. A BoQ that
  is in review or approved shows the badge without "Use vN" until FE-031 builds the warning that sends it
  back to the working state (BR-23). One notification per BoQ and person: three BoQs on one model give
  three.
- Change report (FE-030, the "Change report" fake until EN-002): causes are inferred from the two runs, not
  traced; materials aren't compared; F08-AC1 (a Duplex with one wall deleted and one door changed) is
  checked on synthetic results in `apps/mock-api/test/diff.test.ts` only, because the v2 fixture is a copy
  of v1 until EN-008, so the viewer's red ghosts of removed elements aren't exercised end to end. The
  default comparison is the last saved version's run; saving versions comes with FE-031, so until then the
  person picks a run. Lines are listed in full (no paging in the table) and the elements table shows 100
  at a time.
- Versions (FE-031): a saved version opened read-only shows its frozen run's lines, but the line edits panel
  lists the BoQ's current edits (the frozen copy is kept, not shown yet). Position numbers aren't frozen
  (they come with FE-040). The review's warning before an edit is the Withdraw review button (the working
  version is read-only while in review); answering a question that a version in review used warns through
  the decisions dry run (FE-010) and withdraws it. Confirming with nothing new closes the working version
  (kept, hidden from the version list) and reopening takes it up again. Approval switched on for an org whose
  plan lacks `approvalWorkflow` is refused with `402`; the settings toggle doesn't say so before trying.
  The Excel export of the working version right after a save shares the saved version's run.
- Exports (FE-032): the Excel is still the PoC layout (no cover sheet, the WORKING mark is in the title line, not
  a watermark) until EN-006; F12-AC1 (opens without repair prompts) and AC2 are checked only through openpyxl;
  importing edits is FE-037. The audit CSV is the project's only (the org audit page and its CSV come with
  FE-033); its data column is the event's JSON.
- Audit (FE-033): the action filter offers a fixed list (F09's minimum set and the actions the build writes; the API has no list of the actions used); details show the event data's plain values. Retention hides older events in lists and CSVs; nothing is deleted in the mock.
- Notifications (FE-034): `limit.near` / `limit.reached` cover the org-wide usage limits; per-action limits (models per BoQ, file size) only answer `402`. The email categories are F13's five core ones (FE-018); modules add theirs with MP1.
- Versions e2e (FE-035): v1 criterion 3 runs on a v2 that renames one wall (no deleted or changed element, so no line changes) until EN-008's Duplex v1/v2 pair; criterion 4 is checked for one click to the formula, parameters, shares and the 3D view, not walked through by a person (M).
- Phase-1 interim: the mock reads check details from the PoC engine's cache on the same machine, and
  drops the `null` optional fields the PoC sends in names (the worker should omit them, EN-001).

## Suggested next steps

Engineering, roughly in order of value:

1. **Collect the minimum corpus** (6 files: modern Revit IFC4, Archicad, Tekla with rebar, Bonsai,
   NIBS Office federated set). Run each with `npm run corpus`, fix quirks, add tests. Nothing else
   de-risks as much: the buildingSMART samples alone found ten engine bugs (09), but they all come
   from one exporter.
2. ~~**Real faces and rooms**~~ built (Oct 2026), also across federated models.
3. ~~**Federation v1**~~ built (Oct 2026), with solid overlaps and links across models; next:
   per-project saved scopes in the platform, coordinate alignment.
4. **Platform skeleton in Java**: orgs, projects, model versions, decisions persisted, job table,
   the engine as a worker (see 03 for the mapping). Generate DTOs from `packages/types/schema`.
5. **Rule editor v1**: the Library has the questionnaire over the master template plus the full editor,
   saving to `presets/user/`; still missing: live preview against a sample model (and "what does this
   answer change" deltas), review of the template's 56 questions and the formula choices by a QS, and an
   engine scope filter so renovation work can exclude existing / demolished elements. Original note: forms over slots (parameters) with live preview through the engine; JSON
   editing for power users.
6. **Revisions**: re-run on a new version, carry decisions, change report per line.
7. **3D viewer for the product**: the dev build has one (three.js over `geometry.glb`, `apps/web/src/viewer`);
   the product may move to That Open Engine (D66) for sections, plans and measuring. The link stays the
   same: line `trace.elements` -> `SceneIndex.parts` -> mesh nodes named by GlobalId.
8. **Client template import** (spreadsheet, then GAEB).
9. **IDS input check** per preset.

Product (non-engineering):

- Find a **QS partner** to review the rules and flow (docs 01, 05, 06) before much more is built,
  and to encode the first real rulebook preset.
- Approach firms for **2-3 reference projects** with IFC + professional BoQ (answer key).
- Legal review of the licensing position (08) for the first target markets.

## Open questions

Questions answered by the product plan (`plan/`, Nov 2026) are ticked with the decision id from
`plan/README.md`. What the plan still assumes is in `plan/09-open-questions.md`.

- [x] Who is the primary user for v1? The firm that produces the BoQ: design and engineering firms first, QS firms on the same flows (P01); contractors and suppliers only as vendors in the optional pricing module (P32–P36). To validate with interviews (plan Q1).
- [x] Which market and rulebook first? None built in: international by design, firms set up their own rules with the setup wizard (P35, P42).
- [x] What exactly is in and out of v1 scope? `plan/00-product/03-v1-scope.md` (federated + versions, viewer, editing, versions and confirmation, sharing, admin console, Excel; no tendering, P34).
- [ ] Which QS or civil engineer partner translates rulebooks into presets and reviews the logic?
- [ ] Legal check per standard: does encoding NRM, VOB, CESMM or ÖNORM rules as parameters need a licence?
- [ ] CSI licence: only if North America is targeted.
- [ ] Where will messy real files and the professional reference BoQs come from?
- [ ] How is AI used for name resolution, and with which confidence thresholds?
- [ ] Pricing validation and regional price levels.
- [x] Is pricing part of the product? Only as an optional, removable module: firms' and vendors' own pricebooks, the firm's estimate, offer requests to vendors (P32–P36). No tendering (P34) and no market price database.
- [ ] MEP and infrastructure (IFC4.3) in scope, and when?
- [x] Non-functional targets: `plan/04-architecture/nfr.md` and `security.md` (region left to the deployment, P09).
- [x] Acceptance criteria for v1: `plan/00-product/03-v1-scope.md` (accuracy against professional BoQs still needs reference projects).
- [x] Frontend framework: Next.js (App Router) against a mock API, then the Java backend (P11, P12).

## What an engineer still needs before building the platform

From the readiness review (Oct 2026): a v1 scope; the data model with fields (10 gives the
entity tree); key user flows as wireframes (upload, review questions, approve, export);
non-functional targets; acceptance criteria; the open decisions above. The glossary (01), the
rule format (06) and the engine (05) now exist.

## Done

Newest first. One line per piece of work; details are in the commit and the linked docs.

| Date | Commit | What |
|---|---|---|
| 2026-11-13 | 0e73150 | FE-035: FL-3 end to end (`e2e/versions-flow.spec.ts`): answers, save A, v2 (v1 with a wall renamed, parsed for real), Use v2, no question asked again, the change report against A lists exactly that element, a line's explanation and 3D one click away, save B, confirm, reopen; v1 criteria 3, 4 (automated part) and 5 on the mock (approval in `e2e/versions.spec.ts`) |
| 2026-11-13 | 94b079d | FE-034: every core notification kind of F13 is sent by the mock and rendered from the catalogue: new `project_member.added`, `limit.near` (80 %) and `limit.reached` to owners and admins (seats, active projects, company presets, processing minutes; once per org and limit per period). A test renders every kind the mock knows; 2 scenarios; 1 e2e check in the bell |
| 2026-11-13 | 8029dcb | FE-033: activity and audit: S18 (project, leads and approvers) and S25 (org settings › Audit, owners and admins) share one view with filters by who, action, entity and date, paging, details, the project link (org), and CSV with the same filters. Mock: shared filtering with the plan's audit retention, the project audit's date filter, the org audit CSV. Contract: `from`/`to` on the project audit and its CSV, `exportOrgAuditCsv`. 5 scenarios, 1 mock test, 1 e2e flow |
| 2026-11-13 | 8d49e51 | FE-032: the Exports tab (S12g): the working version's Excel on demand, every file of the BoQ's versions with download (working, saved, change reports); a saved version's export is always its frozen file (BR-25), downloads of it are audited; the project audit as CSV with the page's filters, from the activity page. Decisions CSV was there since FE-010. 3 scenarios, 1 e2e flow (F12-AC3) |
| 2026-11-13 | f7e9428 | FE-031: versions, confirmation and optional approval (F09): Save version with label, note, open questions and the not-in-the-models tick; the next working version; frozen run, edits and Excel; saved versions read-only (`?version=`), their Excel, compare; Confirm and Reopen; with `approvalRequired`: submit with reviewers, the review strip and Review tab (comments overall or on a line, the change report first), request changes, approve, save the approved version, four-eyes, withdraw; edits during review withdraw it (BR-23). Mock: the version workflow, the plan check on approval. 14 scenarios, 4 e2e flows |
| 2026-11-13 | 8444b84 | FE-030: the change report (F08 §3–7): the Changes tab (compare with the last saved version's run, an earlier run or another BoQ's; summary with inputs that differ and elements per model, lines grouped like the sheet with change, \|Δ%\| and group filters, causes, elements, the viewer's "changes" colour mode with removed elements as a red ghost, Excel export); Compare from the run history. Mock: compare, diffs, lines, elements, export; the "Change report" fake. Contract: `DiffSummary.byModel`. 8 scenarios, 3 e2e flows, unit tests |
| 2026-11-13 | 966a5b7 | FE-029: new model versions (F08 §1–2): the header names each model with a newer ready version, "Use vN" (and "Use all") swaps it into the working version as a pending change, a confirmed BoQ offers "Reopen to update" with the reopen dialog; badges in the BoQ list and the project overview. Mock: `boq.new_version_available` to the project's leads and estimators and a refreshed BoQ when a version becomes ready; `POST /boqs/{boqId}/reopen` (F09 §6). 2 scenarios, 4 mock tests, 2 e2e flows |
| 2026-11-13 | 210e7fa | FE-028: the setup wizard (F16): start, how you measure (checklist, details, the six measuring screens from the rule set's data), item numbers and texts, names, review with Publish all (publish, star, project defaults); progress in `Org.setup` with resume; the dashboard gate for a new org's owner, onboarding into the wizard, Guided setup in the Library, the sheet hint. Mock: `GET/PUT /orgs/{orgId}/setup`, the "Setup markers" fake; previews share the run queue. 1 scenario, 2 e2e flows, step derivation tests |
| 2026-11-13 | 210e7fa | FE-027 (code list): the item-text box with insert buttons and Reads as (sample from the preview model), the sample text under Codes per line |
| 2026-11-13 | 210e7fa | FE-026 (guided mode): new rule sets and classifications open in guided mode; reopen on any draft; the one-time "bring your own licence" notice |
| 2026-11-13 | 5551323 | FE-027 (sheet, detail, Excel, run): item texts on lines (the "Item texts filled" fake), Description from the Group-by system's item text, the line detail's "Measured as", the run Excel's Description; types `LineCode.text`. The code list's item-text box follows with FE-028 |
| 2026-11-13 | 5551323 | FE-026 (clone, templates): Clone with "Independent copy" / "Based on it"; Excel templates (download, empty template on Create, upload with the changes and problems by sheet, row and column, apply to the draft; the "Preset Excel templates" fake). Guided mode follows with FE-028 |
| 2026-11-13 | 5551323 | FE-025: publish (change note, no problems, version n+1, BR-07) and the preview panel beside the editor (draft vs published on a model version, follows each save; the "Preview" fake; contract `PreviewResult`) |
| 2026-11-13 | 5551323 | FE-024: dictionary editor port (Names in the model against a chosen model version, Names it explains, Meanings, Advanced) |
| 2026-11-13 | 5551323 | FE-023: classification editor port (Codes per line, paged Code list, import via `/codelists/read` and `/build` (mock endpoints added), map rules, JSON) |
| 2026-11-13 | 5551323 | FE-022: rule-set editor port (Settings, BoQ items with their stories, Advanced) on the shared Library base, with autosave (1 s, ETag, conflict dialog), problems inline and the `?question=` deep link |
| 2026-11-13 | 829d61e | FE-021: Library shell (F10 §1, 2, 5, 9, 10, 11): the Library (a tab per kind, layer filter, archived, New, Make a copy), a project's own presets, create (empty / a copy of a version / changes on a rule set), the preset page (details, star, copy, archive; Edit with the draft read-only until the editors; Versions with view, JSON compare and restore as draft; Where used). Mock: create, update, archive, usage, draft save with ETag and check, discard; org patch parents for checks and runs; new projects' defaults from starred presets; Studio Demo's seeded presets. 10 scenarios, 3 mock tests, 8 e2e flows |
| 2026-11-13 | d7ace66 | FE-020: the Duplex end-to-end test (v1 criterion 1): in the app, a new project, the Duplex uploaded (parse job), a BoQ with As modelled + ACME cost codes generated (run job); the lines API gives every line and count of the engine's `HAND_BOQ` / `COUNTS` (read from `engine/tests/test_duplex.py`, same tolerance), and the sheet shows every line. Fix: a tab signed out with a reason no longer loses it to a second redirect (late 401s, the auth gate); the limit dialog asks `GET /me` only when it opens |
| 2026-11-13 | b27d039 | FE-019: entitlement UX (F14 part): the limit dialog with "Upgrade" (owner → billing) or "Ask your owner"; Billing (S23: plan, status, limits with usage bars, plan cards → checkout, Manage billing) and Usage (S24: minutes by project and kind, seats, active projects) in the org settings. Mock: entitlements, usage, billing, checkout and portal (manual adapter), usage per parse and run with its project. 2 scenarios, 3 e2e flows |
| 2026-11-13 | 94026ce | FE-018: notifications (F13 part): bell with unread count and the newest items, `/notifications` (S26), email preferences per category on `/account`; toasts for one's own job results (run generated / failed, export ready / failed) without a second toast for an export this tab shows. Mock: the notification and preference endpoints, one `notify()` that also emails the kinds F13 emails. 2 unit tests, 3 scenarios, 3 e2e flows (F13-AC1) |
| 2026-11-13 | da07e51 | FE-017: the run's Excel (F12 part): "Excel" in the sheet toolbar starts `export_xlsx` (grouped as the sheet), a toast while it runs, then the download (`{project}_{boq}_Rev{label}_{date}.xlsx`). Mock: the engine's exporter over the run's edited result (excluded lines out, edits with reason in the notes), Export records, revision list, signed download. 2 unit tests, 2 scenarios, 1 e2e flow (F12-AC1, F06-AC3 export part) |
| 2026-11-13 | 4a372cd | FE-014: sheet and model together (F07 §9): split Sheet tab at ≥ 1280 px (resizable, collapsible), the sheet's filters (plus code group, "only these lines") scope the model, a selected line or group row highlights its elements, Shift-drag box selection → "N lines from M elements" with the bulk actions, *Edited* colour mode, Esc / F / H / I. 4 unit tests, 3 e2e flows (F07-AC5); F07-AC6 waits for FE-030 |
| 2026-11-13 | 2b39f98 | FE-016: the 3D viewer (F07): a Viewer tab with every model of the run (toggle per model), colour modes type / coverage / code group / source / model with a clickable legend, storey filter, section box, isolate, hide, reset; line → its elements (a roof line → its slabs), element → the lines it feeds with its share → the sheet; "Show in 3D" from the line detail, questions and input checks (a run-less viewer on the model version page). Mock: geometry (302, cached), scene, element lines, coverage. Contract fix: `Run.snapshotVersions.models`. 15 unit tests, 4 scenarios, 7 e2e flows (F07-AC1–4, AC7) |
| 2026-11-13 | 7cee885 | Plan: more BE-000 decisions (D10–D18 open: budget and scale, engine compute and fairness, untrusted uploads, sign-up abuse, engine upgrades, environments, operations, data protection, contract changes; B17–B20 to confirm); the backend owner may change the contracts by `plan/05-api/contract-changes.md`, which FE-041 adapts in phase 3. Written by the owner's other session, committed here |
| 2026-11-13 | 9454773 | Plan: BE-000 becomes the backend owner's review and decisions (P47): the agent analyses the backend plan (`07-backend/review.md`) and puts every backend decision to the backend owner, the open ones (D1–D9) and the ones the plan already made (B1–B16); answers go to `07-backend/decisions.md`. Written by the owner's other session, committed here |
| 2026-11-13 | bf3c48b | FE-015: "not in the models" (F06 §12, P15, BR-12): a notice at the top of every sheet with the counts by source and "Add line", collapsible to the counts line (remembered per user), never removed; the same paragraph as the empty state of a sheet without lines and in the "Add line" dialog. 1 unit test (counts), 1 e2e flow (F06-AC8). The save-version tick comes with FE-031 |
| 2026-11-13 | 04f24c7 | FE-013: "How it is calculated" (F06 §5, P25) at the top of the line detail: plain-words steps from `trace.steps` (start, deductions, reveals, factor, minimum, rounding, derive, edit, result), each expandable to its elements, each rule-set value linked to its Settings question (`/{org}/library/rule_set/{presetId}?question=<slot>`), a derived line's source lines clickable, an edited line with the engine's value, who and why. `BoqLine.trace.steps` (`TraceStep`) added to the types as EN-013 specifies; the mock's "Trace steps" fake builds them from the PoC trace. 8 unit tests of the fake, 3 F06-AC5 scenarios on the Duplex (fake), 3 e2e flows |
| 2026-11-13 | 924857e | FE-012: one active session per account (F01 §10, BR-54) on the mock and in the app: sessions opened after sign-in, `409 session_active` with the other device, takeover (audited `session.replaced`, `session.revoked` over SSE), `401 session_replaced` / `session_expired` (12 h idle on the mock clock), sign-out ends the session, `GET /me` carries it; the S31 takeover screen; signed-out reasons on the sign-in page (from the SSE event, any 401, or the event stream's 401); the mock sign-in shared by the tabs of a browser. Fix: the mock removes the presets it saved for a run after the run (the engine's user folder had grown to ~100 dictionaries and slowed runs). 2 session scenarios (the state-machine todos), 2 e2e flows (F01-AC5) |
| 2026-11-13 | fb0a50c, 55d8bc2 | FE-011: F06 §6–7 on the mock and in the app: line edits (one override per line key; replace, restore, batch all or nothing; `unit_needs_quantity`, `reason_required`, `unknown_code`) and manual lines per BoQ, sent with every run (manual lines as a rule-set patch through the PoC engine) and put on the result's lines by the "Line edits applied" / "Manual items with codes" fakes; pending change `adjustments`; `POST /presets/check`. The sheet shows edits at once over the run's lines: in-place description, unit, quantity (with reason) and Item edits, edit markers with the engine's value, exclusions, Edited / Excluded filters, drag to reorder or move, bulk move / exclude / restore, Ctrl+Z (20 edits), Restore per field, manual lines with codes and an engine-checked formula. Contract: `RunLine.excluded` and a fuller `overridden`; runs list classifications under the engine's system id. 2 mock tests, 7 scenarios (F06-AC3 without the Excel part, AC4's refusal, AC6), 2 e2e flows |
| 2026-11-13 | fa27738, 8e0d40f, 5050aea | FE-010: F05 on the mock and in the app: runs send the project's decisions and remember them and the questions they asked; questions joined with decisions (`answeredAfterRun`), answering one or many with a dry run listing the versions BR-23 would reopen, name answers added to the project dictionary, clear, promote to an org dictionary, terms for the picker, CSV; pending changes and the header's "N answers not applied yet – Regenerate"; the Questions tab (answer controls per `AnswerType`, suggestion preselected, leave it, bulk answers of one kind and control) and the Decisions page (edit, clear, promote, export); project cards count open blocking questions; contract fix for `QuestionWithDecision`, `Decision.answerType` added; 13 mock tests, 6 scenarios on the Duplex (F05-AC1, AC3), 2 e2e flows |
| 2026-11-12 | e7bdf31 | Fix (FE-008): a Setup change (e.g. unticking a model) now shows at once even while the BoQ is being refetched (the optimistic update waited for the refetch to be cancelled first; CI caught it in `e2e/boqs.spec.ts`); the 20,000-line perf test warms up for a second before measuring (a cold CI runner measured 44 fps) |
| 2026-11-12 | 94c6cc4 | FE-009: F06 sheet on the mock and in the app: lines, line detail, warnings and the paged log served from the run's stored result (with server-side grouping for large runs); the Sheet tab, virtualised and grouped by any attached classification with subtotals, filters, toggleable columns and keyboard; the line detail with the formula in words (PoC `readable.ts` ported), settings, element shares and their total, codes, notes and log; the warnings bar and the Log tab; contract fix for `RunLine`; 10 sheet scenarios, 5 e2e flows, the 20,000-line perf test (60 fps scrolling, Group by switch 27 ms on a production build) |
| 2026-11-12 | c5d3b33 | FE-008: F04 on the mock and in the app: BoQs with their working version, inputs prefilled from the project defaults and every model's latest ready version, the Setup tab (models with version pickers and the newer-version hint, rule set with versions, ordered classifications and dictionary layers with the project dictionary last, advanced settings), runs as jobs through the PoC engine with live stages, complete / needs input / failed / cancelled, run history, pending changes blocking Save version (BR-22), archive and restore, "Generate a BoQ" from a ready model version; fixes the mock router checking inline query parameters against the wrong schema; 11 F04 scenarios (incl. BR-02), 3 e2e flows |
| 2026-11-12 | dc24b65 | FE-007: F03 on the mock and in the app: models, versions uploaded straight to signed URLs with progress, header check (`not_ifc` fails without a job), content dedupe across the org, the parse job through the PoC engine with live stages over SSE, failure and retry, the input-check report (counts by class, checks with their elements, storeys), names preview, the ready notification as a toast; 6 shared F03 scenarios through mock + engine, 4 e2e flows; CI installs the engine for e2e and suites |
| 2026-11-12 | 2500f97 | FE-006: F02 on the mock and in the app: dashboard (needs-you list, project cards with generated compositions, empty state with the sample project), projects list, new project with the `activeProjects` limit, project overview, settings (members from the org only, archive and restore), activity; project visibility and the `permissions` keys (now listed in 03-domain/permissions.md); archived projects refuse writes with `409 project_archived`; 7 shared F02 scenarios, 6 e2e flows |
| 2026-11-12 | 8d00621 | FE-005: F01 on the mock and in the app: onboarding (create org), invitations (send, resend, withdraw, accept with email check, 14-day expiry), members (roles, remove, leave, last-owner rule), account page, org settings (general, members), org switcher, start-page routing; seat limit answered with 402 and the limit dialog; audit events; 13 shared F01 scenarios and 8 e2e flows |
| 2026-11-12 | dfa66f0 | TS-001: `tests/contract` and `tests/scenarios` (Vitest over the generated client, `API_URL` selects the backend, `npm run test:contract:mock` starts a fresh mock): every tag's operations refuse requests without credentials, `GET /me` per seeded user, plans, validation codes, event-stream headers (171 tests); one scenario group per state machine (clock scenario runs, transitions listed as todos with their tasks); CI runs both suites and the mock's Duplex run through the PoC engine. **M0 done.** |
| 2026-11-12 | 6888ec2 | FE-004: auth adapter interface and the mock adapter (sign-in page listing seeded users, token `mock:<userId>`), auth gate, user menu from `GET /me`; one SSE connection per tab with backoff and `Last-Event-ID`, the invalidation map; the mock's event stream sent with `no-transform` so the Next dev proxy doesn't buffer it |
| 2026-11-12 | 2edb4ae | FE-003: `apps/mock-api` skeleton (Hono, port 4010): every request validated against `openapi.yaml` (400 `invalid_param`, `invalid_body`, `unknown_field`; 501 for operations not built yet; responses checked in dev), JSON store with the seed (plans, Studio Demo, Small Firm, six users, every shipped preset as a system preset), signed blob URLs, SSE bus with `Last-Event-ID`, outbox, clock, `/_dev/*` endpoints, the `Engine` interface with `PocEngine`; `npm run dev:app` starts engine + mock + app |
| 2026-11-12 | 60a71fc | FE-002: `apps/app` skeleton: route groups, app shell (wordmark, left nav, theme switch; light default, dark following the OS), next-intl with `en` and the pseudo-locale `en-XA`, TanStack Query with global error handling (401/402/404/409), `ApiError`, `can()`, dev rewrite to the mock; ESLint blocks literal UI strings; Vitest and Playwright set up (`npm run test:app`, `npm run e2e:app`) |
| 2026-11-12 | 2e9c848 | FE-001: the HTTP contracts moved to `packages/api/openapi.yaml` and `packages/pricing-api/openapi-pricing.yaml` with generated clients (`@ifc-boq/api`, `@ifc-boq/pricing-api`; `npm run api:lint`, `api:gen`, `api:check`); `apps/app` started (Next.js 16.4.6, shadcn/ui preset `b38miVKzY` with the design guidelines' tokens, light and dark); CI at the repository root (contract lint and drift, typecheck, app build, engine tests) |
| 2026-11-12 | 0921ea9 | FE-000: the repository consolidated into the product root `boqlet_v1/` (P44) with `git mv`; the root keeps `.claude/`, a pointer `CLAUDE.md` and the demo deployment (`vercel.json`, `api/index.py`, `requirements.txt`) pointed into `boqlet_v1/`; scripts `dev` → `dev:poc`, `build` → `build:poc`; package name `boqlet` |
| 2026-11-12 | 717bdbf | The build happens on the branch `v_1` (P46): sessions switch to it and push there, CI runs on `v_1` and `main`, staging deploys from `v_1`; `main` keeps the proof of concept and its live demo until FE-047 tags it `poc-final` and merges `v_1` into it |
| 2026-11-12 | 157f495 | Plan ready for an unattended build: one product root `boqlet_v1/` (P44): FE-000 moves the PoC in (demo kept pointed into it), FE-046 removes the PoC (tag `poc-final`) and makes it the repository root; `plan/08-delivery/sessions.md` (P45): one prompt for every session, start/stop/handover rules, what agents decide vs ask, tooling and ports; `plan/10-build-log.md` with Current position and milestone entries; new BE-032 (staging) and FE-047 (production release); FE-043…FE-045 specified; owner inputs per step in 09 "Needed by" |
| 2026-11-12 | ac7d5c9 | Design guidelines decided with the owner (P43), `plan/06-frontend/design-guidelines.md`: product name boqlet; shadcn preset `b38miVKzY` (Base UI, base-mira) as the starting point with its colours replaced; warm paper `#F2EDE3` and ink `#151515`, light default plus dark; ink primary buttons, blue `#1E4FB8` accent; status colour only for exceptions (derived blue, manual yellow, to confirm orange, errors red, no green); data palette of the poster hues in three strengths; JetBrains Mono UI (13 px data, 14 px prose) and Inter Tight display; uppercase tracked labels; 2 px corners, 3 px on shapes and swatches (no sharp corners; confirmed by the owner as "Guidelines v1" in an interactive look lab); poster compositions only in wizard, onboarding, sign-in, share page and dashboard cards; dimension line as a recurring device; Lucide sparingly; thousands with a narrow no-break space by default; restrained motion. Contrast checked against WCAG AA. Design system, frontend architecture, FE-001/002, F08 viewer colours, F15 and data model number default, README (P23, P41, P43), open questions (Q31 closed, wordmark SVG pending) updated |
| 2026-11-12 | ac7d5c9 | Frontend tasks renumbered without the gaps left by dropped tendering: FE-001…FE-045 in build order (M0 FE-001…004, M1 FE-005…020, M2 FE-021…028, M3 FE-029…037, M4 FE-038…040, phase 3 FE-041…045; pricing FE-P1…P7 unchanged). Task-file sections now match the milestones (share links and Excel edits import under M3, real auth under M8a). Old → new (for earlier rows here): 043→012, 044→013, 045→014, 042→015, 012→016, 013→017, 014→018, 015→019, 016→020, 017→021, 018→022, 019→023, 020→024, 021→025, 046→026, 040→027, 041→028, 022→029, 023→030, 024→031, 025→032, 026→033, 027→034, 028→035, 048→036, 049→037, 050→038, 051→039, 052→040, 053→041, 054→042, 037→043, 038→044, 039→045. Remaining product statements about tendering in docs/00, docs/10 and the open questions above updated (P34) |
| 2026-11-09 | 2c4bcf9 | Final plan review: F16 corrected against the data (61 rule-set questions, no market preset, one topic per screen, no dashboard card for members, edge case for rule sets without `setupSteps`); README (P11 and P15 marked refined, both contracts named, reading order with the pricing contract and design guidelines, which phase builds which part of the repo); BR-12 and FE-042 speak of the save-version dialog; mock seed wording; the 2026-11-05 plan row gets its commit. Contracts and cross-references check clean |
| 2026-11-09 | 03b2a79 | Plan made ready for a fresh session (P37–P42): setup wizard content decided from the rule-set data (P42: checklist of the 14 item-switching questions, their follow-ups, six marked measuring screens; step 2 lists only switched-on items; F16, EN-011, Q22 closed); release 1 = full v1; three sequential phases by two agents (frontend on the mock, backend with BE-000 decisions + engine + Java, frontend wires up and releases), engine work owned by the backend agent with the mock faking new engine features in phase 1 (table in `06-frontend/mock-api.md`, FE-054 removes them), commits straight to main, owner-supplied design guidelines (placeholder `06-frontend/design-guidelines.md`, JetBrains Mono fallback). `plan/README.md` "Start here", milestones rewritten by phase, open questions with "Needed by", CLAUDE.md points new sessions there. Read-through fixes: leftover issue/submit wording, BoQ archive vs confirm, save-version contract field, missing extension point. All cross-references and both contracts check clean |
| 2026-11-09 | 9774e16 | Plan review with the owner (P28–P36). No logged-in guests (org users, vendors, public links). BoQ lifecycle: always-editable working version, "Save version" locks labelled snapshots, "Confirm" marks the BoQ done, approval optional per org (F09 rewritten, versions state machine, BR-20–29). Position numbers per section (P30). Live co-editing per line (P31). Pricing is an optional, removable module (P32, P36): vendors (F17), pricebooks and estimates (new F20), offer requests (F11 rewritten; formal tendering with packages, sealed bids, addenda and award dropped, P34); manual price matching, remembered (P33). Module boundary in new `04-architecture/modules.md`: own `openapi-pricing.yaml` under `/pricing/`, own DB schema `pricing`, own frontend package and backend module, generic extension points and core events; core-only CI job. International by design (P35): org-set currency, units, formats; English default. Data model, permissions (rewritten), business rules, flows, screens, db schema, tasks (FE-051/052, FE-P1–P7, BE-031, BE-P1–P4, EN-P1), milestones (MP1/MP2), open questions updated. Both contracts lint clean (core 157 operations, pricing 66) |
| 2026-11-09 | 9774e16 | Plan: the owner's product vision integrated (P17–P27). New specs F17 vendors and price requests (vendor accounts linked to orgs by invitation, whole BoQ or part sent from the sheet or the model, any revision frozen at sending), F18 public share links, F19 platform admin console (metadata only). F01 one active session per account with takeover; F06 full line editing (overwrite quantity/text/unit, move between sections, reorder, exclude, undo) and plain-words "How it is calculated" (EN-013 trace steps); F07 sheet and model side by side with shared filters, Changes and Edited modes; F10 clone (copy or based on), guided creation, Excel templates for presets (EN-012); F12 BoQ Excel edited and imported back; F16 wizard required on first start; tiers undecided (default tier, seats and/or projects); UI decided: shadcn/ui with one monospace font. Business rules BR-54–57, data model, state machines, security, db schema, flows FL-9–12, screens S31–S36, tasks FE-043–050, BE-027–030, EN-012–013, milestones, v1 criteria 13–17, open questions Q26–Q31. `openapi.yaml` 214 operations, lints clean |
| 2026-11-07 | 8199428 | Plan: item texts, "not in the models", setup wizard. P14: a BoQ item's written description lives on the classification's code (`Code.description` as a template, filled per line into `LineCode.text`), shown instead of the rule set's line text in the sheet, Excel and tender packages (F06, F10 §13, F11 `textSystem`, F12, BR-11, EN-010, FE-040). P15: the app says plainly that it measures only what the models contain (sheet notice with counts by source, submit confirmation `notModelledConfirmed`, Excel note; BR-12, FE-042). P16: setup wizard F16 in v1 (setup questions marked in the rule set `SlotPrompt.setup` EN-011, live preview, item list and texts import, names, publish all; `/orgs/{orgId}/setup`, S30, FE-041, v1 criterion 12); "start from your last BoQ" after v1. Open questions Q22–Q25. `openapi.yaml` lints clean |
| 2026-11-07 | d7382db | In-app guide for engineers new to the tool: a third mode **Guide** next to Bill of quantities and Library (`components/Guide.tsx`, content in `guideSr.tsx` and `guideEn.tsx`, same sections and ids; Serbian by default, English one click away, remembered per browser; on-screen labels quoted in English in both). Table of contents marks the section being read; `/#guide` and `/#guide-<section>` links open it, each heading has a # link to copy. The public Duplex sample is served at `/samples/` (Vite plugin reads it from `fixtures/`, no second copy) with **Load the sample model** on the empty BoQ page and in the guide, so the hosted demo can be tried without a file. Checked in Chrome (Playwright): deep links, highlight while scrolling and on click, language switch, sample load and Generate, phone width |
| 2026-11-05 | 530ab39 | Product plan for the deployment-ready app in `plan/`: product (vision, personas, v1 scope, glossary, plans), domain (data model, state machines, permissions, business rules), 15 feature specs, flows and screens, architecture (engine worker contract, storage/jobs/SSE, security, deployment, NFR), `openapi.yaml` (167 operations, lints clean), frontend (Next.js, PoC reuse, mock API), backend (Java modules, DB schema, decisions to ask), milestones and task lists (FE/BE/EN/TS), open questions. Noted: docs/08 R2/R8 and docs/00 test count are out of date |
| 2026-10-14 | 1f1bd5f | Vercel demo deployment: `vercel.json` (Vite build, the engine as one Python function `api/index.py`, `/api/*` rewrite), root `requirements.txt`; the app knows it is deployed (`VITE_DEPLOYED`): demo note, upload limit with a clear message, re-sends a model the engine forgot, regenerates a lost Excel file. Tested locally with the function's entry point and a mid-session engine restart; not yet on Vercel itself. Doc 17 |
| 2026-10-14 | 5e0bc4f | Dictionaries in plain words: the editor opens with what the dictionary is and which one wins (`dictStory.tsx`); four tabs instead of six (Names in the model, Names it explains, Meanings, Advanced: values read from names, about, JSON); a sentence per entry, meaning and value reader; plain labels for fields, match kinds, categories and value targets; record details, other languages, values and links folded under More options. Guide: 16 |
| 2026-10-14 | 5e0bc4f | Classifications in plain words: the editor opens with what the classification does and the order a line gets its code from (`classStory.tsx`); three tabs instead of five (Codes per line, Code list with "About this list", Advanced: rules by condition, where codes come from, JSON); under each table row what decides its code, in the engine's order; rules not aimed at any item listed once as "Rules for any line"; map rules with a sentence, BoQ items picked by name, plain labels; formulas read UNDER(…) as "is a kind of" and IFC class tests as element kinds. Docs 07; guide: 15 |
| 2026-10-14 | 5e0bc4f | BoQ items in plain words: each item opens with a sentence of what it does (`itemStory.tsx`), parts click through to the form; form regrouped into What is measured / How it is measured / How lines are split / What each line says, the rest under More options; element kinds by name with counts from the loaded model; plain words for ways of measuring, surfaces, deductions, fields; "one line per" ticks; line text with insert buttons and "Reads as"; "+ From the model" starts from a kind of element or a copy. Guide 14 updated (items tab, Settings and items, questions setup and sections) |
| 2026-10-13 | d4430bc | Rules management review: rule-set editor regrouped into Settings / BoQ items (one list: from the model, calculated, by hand) / Advanced; follow-up questions nested and hidden when they do not apply; "In this BoQ" summary; formula questions with ready-made choices (`choices` on formula slots, all six in as-modelled); formulas shown and edited with readable names (`readable.ts`, `NAMES` in `vocab.ts`); Save / Save as new / Delete saved to `presets/user/` (`PUT` / `DELETE /api/presets/{kind}/{id}`). New doc 13: measurement standards worldwide and what each covers. Then every part of a rule set got a form (Questions setup: sections, wording, kind, rename with references, answers and their texts, ranges, ready-made formulas, follow-ups; item id rename follows calculated items); patches can carry `sections`; Check reports answers out of range and unknown sections; unused `includeSubtypes` removed from the selector type. Then what the rules could not express: renovation scope (`RuleSet.scope`, `scope: "out"` items, demolition item; status also from IFC `Status`), recesses (own opening kind and deduction), columns standing in rooms (room `embedded`, room finish answer), whole-building values (`building.*`, `BoqResult.building`, manual items by formula); renames across documents (classification maps, parent items, choice answers); parse format number so old cached parses are redone. Guide: 14 |
| 2026-10-13 | 97810c1 | Links across federated models: doors into other models' openings, rooms on other models' walls and slabs, columns and beams through other models' elements (`embedded`); aggregates re-summed when parts go elsewhere; overlaps by solids (mesh sidecar `meshes.npz`, D68). `embedded` deductions; `contradiction` (volume, thickness) and `double_claim` questions. First real federations (NBU Office, Medical Clinic) and three fixes from them (steel-stud ownership, aggregate parts as holes, false thickness contradictions). Catalogue (12) corrected |
| 2026-10-12 | e73f2b2 | Real wall faces with the rooms on them; rooms measured (floor, ceiling, wall, net wall, skirting); as-modelled room finish rules |
| 2026-10-12 | e485ef2 | Federation v1: several models, one BoQ; ownership presets, scopes, same-GlobalId merge, storeys, overlap questions; multi-model UI |
| 2026-10-12 | 236fcd6 | 309 public IFC files from 30 tools run and catalogued (12); fixes for what they exposed (units, oriented boxes, closed meshes, aggregates, IFC4.3 classes, names) |
| 2026-10-11 | ddf7adc | Engine, contract types, presets and dev UI; Duplex BoQ reproduced exactly |
