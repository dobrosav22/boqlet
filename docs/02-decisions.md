# 02 Decisions

Every decision reached so far, oldest first within each theme. Status is one of:
**Active**, **Revised** (still holds, with changes noted), **Superseded** (replaced; kept so
nobody re-proposes it without knowing why it changed), **Open** (direction agreed, details not).

Sources: two earlier planning chats (1 Aug and 9 Sep 2026) and the main conversation
(3-9 Oct 2026, `reference/conversation/`). Where a later decision changed an earlier one, the
later one wins.

## Product and scope

| ID | Date | Decision | Why | Status |
|---|---|---|---|---|
| D01 | Aug 2026 | Input is **IFC only**. No native Revit/Archicad files, no other BIM formats. | IFC is the open ISO standard every tool exports; one parser, no vendor SDKs. | Active |
| D02 | Aug 2026 | The output must be **flexible**: users can play with, change and select data in the result, not just download a fixed report. | Professionals adjust BoQs; the value is in control, not a black box. | Active |
| D03 | Aug 2026 | Users choose from **presets** (rules, classifications, dictionaries) or create and edit their own. | Every market, client and firm measures differently. | Active |
| D04 | Oct 2026 | The product is **international**. No country's standard is the default; regional practices are examples, not the target. | Owner instruction ("do not focus on Bosnian/Serbian/Croatian, it was an example"). | Active |
| D05 | Oct 2026 | The engine **cannot calculate what is not in the model**. It derives proxies where possible, flags the rest, and moves on; the user may supply the information or not. | Agreed realistic expectation; magic is not a requirement. | Active |
| D06 | Oct 2026 | Four quantity sources: **measured, derived, manual, flagged**. Nothing is silently dropped. | A silently missing line is the worst possible outcome in a BoQ. | Active |
| D07 | Oct 2026 | Output is a **draft for professional approval**, never a certified BoQ. | Liability sits with the qualified person who signs it. | Active |

## Engine design

| ID | Date | Decision | Why | Status |
|---|---|---|---|---|
| D10 | Aug 2026 | A **Python** step turns raw IFC into a unified JSON holding everything later steps need. | ifcopenshell (the mature IFC library) is Python. | Active, now `ParsedModel` (D16) |
| D11 | Aug 2026 | **Rules are data**, interpreted by a generic engine. v1 = parameterised templates (fixed structures, editable values); v2 = full rule builder. The data model must allow v2 without a rewrite. | New standards must not need code changes. | Revised by D13-D15: the rule type already supports formulas, so the v2 builder is a UI question, not a data-model change |
| D12 | Sep 2026 | Classification is a prerequisite step and **measurement rule sets are keyed by classification codes**, so a rule set targets one classification system. | Seemed natural at the time. | **Superseded** by D14. Rules now select elements by IFC class, dictionary terms and properties; classification labels lines afterwards. A rule set works with any code list, and any number of code lists apply at once. |
| D13 | Oct 2026 | The engine **measures every element once** into a rich set of primitives (`MeasuredElement`); rules only select, combine and label those primitives. Rules contain no measuring logic. | Lets any rule set, from any source, run on the same measurements; makes re-runs cheap. | Active |
| D14 | Oct 2026 | Four independent inputs plus decisions: `getBoq(models, rules, classifications, dictionaries, decisions)`. **Rules change numbers; classification never does.** Classification is a list (zero, one or many systems). | Separates "how to measure" from "how to label"; lets the same quantities pivot into any code structure. | Active |
| D15 | Oct 2026 | One universal rule type (`OurRuleType`) with **slots**: number, choice, boolean, text. Structural differences between standards via `choose` and `when`; `formula` as the safety valve. Rule sets **extend** a base and state only differences (`RuleSetPatch`), flattened at run time; the flattened snapshot is stored with the result. | Standards differ in values and in choices of method; both fit one shape. Any standard becomes a filled-in copy. | Active |
| D16 | Oct 2026 | Two data layers: **ParsedModel** (faithful snapshot of one IFC, no decisions, expensive, cached per file hash) and **MeasuredElement** (dictionary applied, quantities adopted, cheap to recompute). | The parsed model stays reusable when dictionaries or engine logic change. | Active |
| D17 | Oct 2026 | Dictionaries turn raw names into **canonical terms with a hierarchy** (`concrete.in_situ` under `concrete`). Rules match on terms (`material under "concrete"`), not raw names. Layers: project, company, global; most specific wins. | One rule set works on any model in any language. | Active |
| D18 | Oct 2026 | **Decisions** are every answer a user gave (names, missing data, unmatched elements, codes). They are a project-level patch layer beside inputs 1-4, never written into the IFC, the company rule set or an official code list. Name answers can be **promoted** to the company dictionary (a permission). | You do not edit the architect's model or the company standard because of one project. | Active |
| D19 | Oct 2026 | **Question ids are deterministic**, built from content (`name:{field}:{raw}`, `missing:{rule}:{guid}`, `unmatched:{class}:{type}`, `unclassified:{system}:{lineKey}`), so stored decisions re-apply on every run and model version. | The user must never answer the same question twice. | Active |
| D20 | Oct 2026 | Only **blocking** questions stop a BoQ from being complete. Informative ones (unmatched elements, unclassified lines with a default) do not. | A demo rule set that ignores most of the model must still produce a BoQ. | Active |
| D21 | Oct 2026 | **A safe expression language**, parsed to an AST and evaluated by the engine only. Never Python `eval`; never a second evaluator in the browser (preview goes through the engine). | Users write formulas; two evaluators drift apart. | Active |
| D22 | Oct 2026 | Rule language levels: **parameters** (slots) + **formulas**. Scripts as an escape hatch only if ever needed (security and support cost). | Parameters and formulas cover the vast majority of real rules. | Active (no scripts) |
| D23 | Oct 2026 | The engine **runs any rules but does not judge them**. It catches mechanical problems (integrity, missing fields, unmatched or double-claimed elements); whether a rule matches a standard is the author's responsibility. Shipped presets are examples, not the product. | Source-agnostic engine; the product is engine + rule language + editor. | Active |
| D24 | Oct 2026 | Adoption policy: trust **reported quantities** (IFC quantity sets, then authoring-tool sets) over geometry when both exist, log mismatches; wall area = volume / thickness; steel by nominal kg/m from the section name. | The Duplex showed reported values are join-aware while geometry double counts junctions; Revit wall Area was inconsistent with Volume. Details in 05-engine.md and 09. | Active (v0, revisit with more files) |
| D25 | Oct 2026 | Aggregates: measure the **parent** (roof, stair) and skip its parts by default; a rule can opt parts back in (`parts: "include"`, used for stair railings). | Avoids double counting while keeping railings measurable. | Active |
| D26 | Oct 2026 | Every line carries a **trace** (formula, parameter values, each element's share, source line for derived lines) and the run carries an ordered **calculation log**. | Professionals do not trust untraceable numbers; it is also how developers debug rules. | Active |

## Licensing and content

| ID | Date | Decision | Why | Status |
|---|---|---|---|---|
| D30 | Oct 2026 | **Bring your own licence.** The platform ships no DIN/VOB (or other restricted) content. Users build presets from their own licensed copies inside their company account; those presets stay **company-private** (no public marketplace of standard-derived presets). | DIN's reproduction conditions prohibit using content for software development and reserve it against text and data mining; CSI requires licences for software use. | Active |
| D31 | Oct 2026 | **Never ingest standards documents**, by upload or AI extraction. Users type rules into the editor. | Exactly the use DIN reserves; also removes the platform from the distribution chain. | Active |
| D32 | Oct 2026 | Market presets factually: "supports custom presets, e.g. for VOB/C" or "based on our reading of NRM2"; never "compliant" or "certified". | Implying endorsement needs the publisher's permission. | Active |
| D33 | Oct 2026 | First shipped presets build on **friendly sources**: NRM 1/2 (free to read; written in our own words), Uniclass, ICMS, CCI, bSDD. Uniclass code lists are **downloaded by the user**, not committed. | Lowest licensing risk. | Active |
| D34 | Oct 2026 | Middle ground for German-speaking markets later: **GAEB import** of client tender BoQs as templates (the client supplies VOB-structured items). License or partner if Germany becomes a real market. | German users expect VOB out of the box; BYO is friction there. | Open |

## Platform

| ID | Date | Decision | Why | Status |
|---|---|---|---|---|
| D40 | Sep 2026 | Hierarchy: **User** (global, can belong to several orgs) -> **Org** (billing unit) -> Project -> IFC -> Run (versioned, immutable) -> BoQ. | Firms own the work; freelancers work for several firms. | Revised by D41-D43 |
| D41 | Oct 2026 | IFCs are **versions of a model**: Project > Model (Architecture, Structure...) > Versions. | Change tracking and carrying decisions over to a new upload. | Active |
| D42 | Oct 2026 | **A BoQ belongs to the project**, not to one IFC, and references the model versions and the preset snapshot it used. | One BoQ is often built from several discipline models. | Active (replaces "BoQ under IFC" from D40) |
| D43 | Sep 2026 -> Oct 2026 | Sep: a separate **merge action** combines BoQs of several runs (auto or line by line). Oct: combining finished BoQs is wrong where scopes overlap; instead **federate**: load selected model versions, align, de-duplicate by discipline ownership and scope rules, link across models, **measure once**. Simple merging survives only as a narrow "combine BoQs" feature for non-overlapping scopes with the same preset. | Double counting, cross-model items (structural wall gets architectural plaster), rooms only in architecture, disagreeing levels. | **Superseded** (merge) by federation |
| D44 | Oct 2026 | **Scope rules per model**: tag each model's discipline (defaults follow), adjust with include/exclude filters, and the engine checks for overlaps (claimed twice) and holes (claimed by none). Saved per project, re-applied to new versions; companies can save templates. | "Take concrete from this model, electrics from that one." | Active; **built v1** (Oct 2026, `federation.py`): ownership table in `presets/settings/federation.json`, include/exclude per model, same-GlobalId merge, overlap questions, holes reported. Not yet: saved per project, templates, solid (mesh) overlap test |
| D45 | Sep 2026 | The review queue is a **blocking step mid-run**: a run pauses in a needs-input state until questions are answered, then completes. | Ambiguity must be resolved by a person, not guessed. | Active (status `needs_input`, D20 narrows what blocks) |
| D46 | Sep 2026 | BoQ structure (grouping, layout) is a **display layer** applied after calculation. | Same numbers, many presentations. | Active |
| D47 | Oct 2026 | BoQ lifecycle: draft -> in review -> approved -> issued. **Issued is locked** (not even admins edit); changes create a revision. Exports are frozen files. | Issued BoQs go into contracts. | Active, not built |
| D48 | Sep/Oct 2026 | **The organisation owns everything** (projects, models, BoQs, presets, dictionaries). Project membership is the access boundary; the creator is recorded for audit. Fixed roles first; custom roles later on demand. | Nothing leaves when an employee does. | Active, not built |
| D49 | Oct 2026 | Every run is a **background job** with states queued -> processing -> needs input -> completed / failed / cancelled, with notifications. | First processing of large models takes minutes; users upload and leave. | Active, not built |
| D50 | Oct 2026 | Pricing shape: seats + active projects + processing, pay-per-project as entry point, rulebook packs as add-ons. **Never price per BoQ generated.** Regional price levels. | Comparing presets is a key strength; don't tax it. | Open (numbers untested); D51 is the earlier shape |
| D51 | Sep 2026 | Org-level seats plus a monthly IFC-processing quota; custom rule/classification creation gated by tier; projects, BoQs and storage unlimited. | Earlier version of D50. | Revised by D50 |

## Stack

| ID | Date | Decision | Why | Status |
|---|---|---|---|---|
| D60 | Oct 2026 | Frontend: **TypeScript + React**. | Owner's stack. | Active |
| D61 | Oct 2026 | Engine stays **Python** (ifcopenshell, numpy, trimesh, manifold3d, openpyxl) and runs as a worker, never inside the web app. | Only mature IFC geometry stack; heavy jobs must not slow the app. | Active |
| D62 | 9 Oct 2026 | Production backend will be **Java**. It will own users, orgs, projects, storage and jobs and call the engine as a worker. **Do nothing on it yet.** | Owner decision. Supersedes the earlier suggestion of a Next.js/Node backend. | Active |
| D63 | 9 Oct 2026 | Dev build = "option B": React UI + local Python engine behind a small HTTP API, one `npm install` sets up both. Option A (rewrite the engine in TypeScript on web-ifc) was rejected. | Keep the tested Python engine; match the worker architecture. | Active |
| D64 | Oct 2026 | **One schema, both languages.** Shapes are written in TypeScript; JSON Schemas are generated from them; the Python engine validates its inputs and outputs against those schemas. | The rule editor and the engine must agree exactly. The Java backend can generate its classes from the same schemas. | Active |
| D65 | Oct 2026 | Big data in object storage (IFC, geometry cache, parsed JSON), queryable data in a relational DB (runs, decisions, lines, element-to-line links). | Postgres-class databases handle 100k+ element rows per model fine. | Active, not built |
| D66 | Oct 2026 | 3D viewer: That Open Engine (web-ifc + Fragments, MIT/MPL). Avoid xeokit unless its commercial licence is bought (AGPL). | Licence fit for a commercial product. | Active, not built |
| D67 | Oct 2026 | The HTTP contract stays small and **job-shaped**: upload a model -> modelId (content hash) = model version; run -> runId + result (immutable); export -> file of a run. | Easy to move behind the Java backend and a queue. | Active |

## Planning frame

Earlier planning used phases, still a useful map: Phase 0 Foundations, 1 System Architecture,
2 Data Model, 3 Core Engine Design, 4 UI/UX Flow, 5 Non-Functional/Product Concerns, 6 MVP
Scope Definition. The engine (phase 3) is now furthest along; v1 scope (phase 6) is still open.
