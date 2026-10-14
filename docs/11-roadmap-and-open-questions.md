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
- No auth, single user, CORS allows only localhost:5173. Not for deployment.
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

- [ ] Who is the primary user for v1: QS firm, contractor bidding tenders, or designer checking costs?
- [ ] Which market and rulebook first (e.g. "as modelled" + an NRM-style preset)?
- [ ] What exactly is in and out of v1 scope (single model or federated? Excel only? viewer?)
- [ ] Which QS or civil engineer partner translates rulebooks into presets and reviews the logic?
- [ ] Legal check per standard: does encoding NRM, VOB, CESMM or ÖNORM rules as parameters need a licence?
- [ ] CSI licence: only if North America is targeted.
- [ ] Where will messy real files and the professional reference BoQs come from?
- [ ] How is AI used for name resolution, and with which confidence thresholds?
- [ ] Pricing validation and regional price levels.
- [ ] Is pricing (rates, tender comparison) part of the product or a second product?
- [ ] MEP and infrastructure (IFC4.3) in scope, and when?
- [ ] Non-functional targets: maximum file size, processing-time goals, data residency, security requirements.
- [ ] Acceptance criteria for v1, e.g. "within X% of a professional BoQ on these 3 reference projects".
- [ ] Frontend framework for the product UI (Vite SPA as now, or Next.js) given a Java backend.

## What an engineer still needs before building the platform

From the readiness review (Oct 2026): a v1 scope; the data model with fields (10 gives the
entity tree); key user flows as wireframes (upload, review questions, approve, export);
non-functional targets; acceptance criteria; the open decisions above. The glossary (01), the
rule format (06) and the engine (05) now exist.

## Done

Newest first. One line per piece of work; details are in the commit and the linked docs.

| Date | Commit | What |
|---|---|---|
| 2026-10-14 | 5e0bc4f | Dictionaries in plain words: the editor opens with what the dictionary is and which one wins (`dictStory.tsx`); four tabs instead of six (Names in the model, Names it explains, Meanings, Advanced: values read from names, about, JSON); a sentence per entry, meaning and value reader; plain labels for fields, match kinds, categories and value targets; record details, other languages, values and links folded under More options. Guide: 16 |
| 2026-10-14 | 5e0bc4f | Classifications in plain words: the editor opens with what the classification does and the order a line gets its code from (`classStory.tsx`); three tabs instead of five (Codes per line, Code list with "About this list", Advanced: rules by condition, where codes come from, JSON); under each table row what decides its code, in the engine's order; rules not aimed at any item listed once as "Rules for any line"; map rules with a sentence, BoQ items picked by name, plain labels; formulas read UNDER(…) as "is a kind of" and IFC class tests as element kinds. Docs 07; guide: 15 |
| 2026-10-14 | 5e0bc4f | BoQ items in plain words: each item opens with a sentence of what it does (`itemStory.tsx`), parts click through to the form; form regrouped into What is measured / How it is measured / How lines are split / What each line says, the rest under More options; element kinds by name with counts from the loaded model; plain words for ways of measuring, surfaces, deductions, fields; "one line per" ticks; line text with insert buttons and "Reads as"; "+ From the model" starts from a kind of element or a copy. Guide 14 updated (items tab, Settings and items, questions setup and sections) |
| 2026-10-13 | d4430bc | Rules management review: rule-set editor regrouped into Settings / BoQ items (one list: from the model, calculated, by hand) / Advanced; follow-up questions nested and hidden when they do not apply; "In this BoQ" summary; formula questions with ready-made choices (`choices` on formula slots, all six in as-modelled); formulas shown and edited with readable names (`readable.ts`, `NAMES` in `vocab.ts`); Save / Save as new / Delete saved to `presets/user/` (`PUT` / `DELETE /api/presets/{kind}/{id}`). New doc 13: measurement standards worldwide and what each covers. Then every part of a rule set got a form (Questions setup: sections, wording, kind, rename with references, answers and their texts, ranges, ready-made formulas, follow-ups; item id rename follows calculated items); patches can carry `sections`; Check reports answers out of range and unknown sections; unused `includeSubtypes` removed from the selector type. Then what the rules could not express: renovation scope (`RuleSet.scope`, `scope: "out"` items, demolition item; status also from IFC `Status`), recesses (own opening kind and deduction), columns standing in rooms (room `embedded`, room finish answer), whole-building values (`building.*`, `BoqResult.building`, manual items by formula); renames across documents (classification maps, parent items, choice answers); parse format number so old cached parses are redone. Guide: 14 |
| 2026-10-13 | 97810c1 | Links across federated models: doors into other models' openings, rooms on other models' walls and slabs, columns and beams through other models' elements (`embedded`); aggregates re-summed when parts go elsewhere; overlaps by solids (mesh sidecar `meshes.npz`, D68). `embedded` deductions; `contradiction` (volume, thickness) and `double_claim` questions. First real federations (NBU Office, Medical Clinic) and three fixes from them (steel-stud ownership, aggregate parts as holes, false thickness contradictions). Catalogue (12) corrected |
| 2026-10-12 | e73f2b2 | Real wall faces with the rooms on them; rooms measured (floor, ceiling, wall, net wall, skirting); as-modelled room finish rules |
| 2026-10-12 | e485ef2 | Federation v1: several models, one BoQ; ownership presets, scopes, same-GlobalId merge, storeys, overlap questions; multi-model UI |
| 2026-10-12 | 236fcd6 | 309 public IFC files from 30 tools run and catalogued (12); fixes for what they exposed (units, oriented boxes, closed meshes, aggregates, IFC4.3 classes, names) |
| 2026-10-11 | ddf7adc | Engine, contract types, presets and dev UI; Duplex BoQ reproduced exactly |
