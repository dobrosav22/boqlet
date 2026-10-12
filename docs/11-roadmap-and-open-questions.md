# 11 Roadmap and open questions

What is missing, what is known to be approximate, what to do next, and what is still undecided.
Keep this page current: when you fix a limitation, delete its row.

## Known limitations of the engine

| Area | Limitation | Consequence | Where to fix |
|---|---|---|---|
| Test coverage | Only one IFC tested (Revit 2011, IFC2x3, architecture only) | Other tools and IFC4 will surface quirks | Corpus (09), `parse.py`, `measure.py`, `data/quantity_sources.json` |
| Faces | Wall sides a and b both equal the main area; no per-face geometry, no face-to-room links | `surface: side_a/side_b/larger/smaller/mean` give the same number; room-based finishes impossible | `measure.py` faces from geometry or `IfcRelSpaceBoundary` (the Duplex has 237 boundaries) |
| Footprint / developed area | Only where measured; developed falls back to net area | Sloped roofs and stairs approximated | `measure.py` |
| Deductions | `embedded` and `recesses` are ignored (a note is written); as-modelled's `deduct_embedded` slot has no effect | Columns through slabs, beams in walls never deducted | Needs embedded-element intersection from parse |
| Steel | Nominal kg/m only for metric W shapes parsed from the name | Other sections fall back to volume x density | Bundle a section table (check licence) or read profile area |
| ArchiCAD quantity names | Entries in `quantity_sources.json` are guesses | May miss ArchiCAD quantities | Verify on a real export |
| Questions | `overlap`, `contradiction` and `double_claim` questions are not raised (overlaps and contradictions are parse checks; double claims are warnings); `classification_conflict` answers are informative only | User cannot resolve those through the UI | `pipeline.py`, `classify.py`, deterministic ids |
| Overlap check | O(n²) pairs with a bounding-box test | Too slow for large models | Spatial index (R-tree / BVH) |
| AI name suggestions | Settings exist, nothing implemented | Unknown names always go to a question | `names.py`; per unique name, cached, thresholds from settings |
| Federation | One model per run; `ModelInput.scope` unused | No multi-discipline BoQs | Design in 10; new pipeline stage before measure |
| Revisions | No version diff; no change report per line | | Match lines by key and elements by GlobalId |
| Item library / client templates | Not built; no GAEB, no "import a BoQ as template" | | New input or rule-set extension |
| Export | Excel only | | GAEB, ÖNORM A 2063, CSV, IfcCostSchedule |
| Renovation and design options | Fields measured, no presets use them | | Presets + selectors |
| Units | Imperial output supported by conversion; no imperial presets or descriptions | | Presets |
| Rounding of derived lines | Uses the rule's rounding or the defaults | Fine; noted for QS review | |

## Known limitations of the dev build

- The API is **synchronous**; large files block the request. Upload limit 300 MB (`IFC_BOQ_MAX_UPLOAD_MB`).
- **Answers live in browser memory** for the current model and are sent with every run; reloading
  the page loses them. The CLI accepts a decisions file.
- The **Library** (rule set, classification and dictionary editors) keeps drafts in browser memory only:
  they are lost on reload and are **not used by BoQ runs**. Download a draft and place it in `presets/`
  to use it. Runs read the files in `presets/`; the engine reloads
  them on every run.
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
   NIBS Office federated set). Run each, fix quirks, add tests. Nothing else de-risks as much.
2. **Real faces and rooms**: per-face areas from geometry and space boundaries; enables
   room-based finishes and makes `side_a/side_b` meaningful.
3. **Federation v1**: several models per run, discipline defaults, include/exclude scope,
   cross-model duplicate check, one BoQ.
4. **Platform skeleton in Java**: orgs, projects, model versions, decisions persisted, job table,
   the engine as a worker (see 03 for the mapping). Generate DTOs from `packages/types/schema`.
5. **Rule editor v1**: the Library has the questionnaire over the master template plus the full editor; still
   missing: live preview against a sample model, review of the template's 53 questions by a QS, and an
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
