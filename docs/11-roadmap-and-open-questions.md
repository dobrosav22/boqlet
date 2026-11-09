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
  `npm run dev` runs without a console window (started by an IDE task or a background tool rather than a
  terminal), the event never arrives: the reload hangs and the old worker keeps serving the old code
  (new endpoints answer "Not Found"). Run it in a terminal, or restart it after engine changes and end
  any leftover `python.exe ... spawn_main` processes.
- The full result (lines, log) is returned in every response; fine for small models, page it in
  the platform.
- The UI loads the Archivo font from Google Fonts; offline it falls back to the system font.
- `npm audit` reports a moderate advisory in Vite 5's bundled esbuild that affects only the dev
  server; upgrading to Vite 6+ is a breaking change left for later.

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

- [x] Who is the primary user for v1? The firm that produces the BoQ: design and engineering firms first, QS firms on the same flows; contractors are invited bidders (P01, P02). To validate with interviews (plan Q1).
- [ ] Which market and rulebook first (e.g. "as modelled" + an NRM-style preset)?
- [x] What exactly is in and out of v1 scope? `plan/00-product/03-v1-scope.md` (federated + versions, viewer, approval, tendering, Excel).
- [ ] Which QS or civil engineer partner translates rulebooks into presets and reviews the logic?
- [ ] Legal check per standard: does encoding NRM, VOB, CESMM or ÖNORM rules as parameters need a licence?
- [ ] CSI licence: only if North America is targeted.
- [ ] Where will messy real files and the professional reference BoQs come from?
- [ ] How is AI used for name resolution, and with which confidence thresholds?
- [ ] Pricing validation and regional price levels.
- [x] Is pricing part of the product? No rate database; pricing through tendering: packages, bidder offers, comparison, award (P04).
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
| 2026-11-09 | (uncommitted) | Final plan review: F16 corrected against the data (61 rule-set questions, no market preset, one topic per screen, no dashboard card for members, edge case for rule sets without `setupSteps`); README (P11 and P15 marked refined, both contracts named, reading order with the pricing contract and design guidelines, which phase builds which part of the repo); BR-12 and FE-042 speak of the save-version dialog; mock seed wording; the 2026-11-05 plan row gets its commit. Contracts and cross-references check clean |
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
