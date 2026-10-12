# CLAUDE.md

Guidance for AI agents (and people) working in this repository. Read this first, then
`docs/README.md` for the full map.

## What this is

A tool that turns IFC building models into a Bill of Quantities (BoQ). The measuring rules,
the classification (codes and grouping) and the naming dictionary are **data the user
chooses**, not code. Every number in the output can be traced to a formula, the parameter
values used and the elements that contributed.

```
getBoq(models, rules, classifications, dictionaries, decisions) -> BoqResult
```

This repository is a **development build and the seed of a larger monorepo**. Today it is
a React app plus a local Python engine. The planned production backend is **Java** (owns
users, projects, storage, jobs). The Python engine stays as a worker for now (it may move to Java
later, undecided). Nothing for the Java backend has been written yet; do not start it unless asked.
`api.py`, `store.py` and the request shapes in `api.ts` are a **temporary demo backend**: keep them
thin CRUD. Anything that decides something belongs in the engine as plain functions over the
contract types (see `docs/03-architecture.md`, code boundaries).

## Run it

```bash
npm install          # also creates engine/.venv and installs the Python engine (Python 3.10-3.13)
npm run dev          # engine on 127.0.0.1:8787 + web on http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Both servers (concurrently). Vite proxies `/api` to the engine. |
| `npm run test` | Typecheck all workspaces, then the engine tests (pytest). |
| `npm run test:engine` | Engine tests only. Includes the Duplex acceptance test. |
| `npm run typecheck` / `npm run build` | Web + types typecheck / production build of the web app. |
| `npm run boq -- <file.ifc> --out boq.xlsx` | Command-line run, no UI. `--help` for options. |
| `npm run corpus -- <folder>` | Run every IFC in a folder; one summary row per file, schema-validated. Use before adding fixtures. |
| `npm run catalogue` | Regenerate `docs/12-ifc-corpus-catalogue.md` from `fixtures/corpus/catalogue.json` (every IFC looked at, tagged). |
| `npm run codegen` | Regenerate JSON Schemas from the TypeScript types. Run after editing `packages/types/src`. |
| `npm run setup:engine` | Recreate the Python venv (after editing `engine/requirements.txt`). |
| `npm run import:uniclass` | Download Uniclass 2015 EF into `presets/classifications/uniclass2015-ef/codelist.json`. |

Environment: `IFC_BOQ_PYTHON` (python to use), `IFC_BOQ_SKIP_ENGINE_SETUP=1`,
`IFC_BOQ_ENGINE_PORT` (default 8787).

## Repo map

| Path | What lives there |
|---|---|
| `packages/types/src` | **The contract.** Every shape as TypeScript: rules, parsed model, measured element, dictionary, classification, BoQ result, HTTP API. Source of truth. |
| `packages/types/schema` | JSON Schemas generated from the types (`npm run codegen`). The Python engine validates presets and its own output against them. Do not edit by hand. |
| `engine/ifc_boq` | The Python engine: parse, names, measure, rules, classify, pipeline, export, API, CLI. |
| `engine/tests` | pytest. `test_duplex.py` is the acceptance test against the hand-made BoQ. |
| `presets/` | Rule sets, dictionaries, classifications, resolution settings, as JSON. Loaded from disk on every run, so edits apply without restarting. |
| `apps/web` | React 18 + Vite dev UI: drop IFC, choose presets, generate, inspect lines, log, questions, compare, download Excel. |
| `fixtures/` | The NIBS Duplex IFC and the hand-made reference BoQ; buildingSMART certification samples (CC BY 4.0) in `ifc/buildingsmart/`. |
| `scripts/` | Node helpers that set up and run the Python engine from npm. |
| `docs/` | Everything decided so far, written for the next developer or agent. |

## Rules of the road

1. **Types first.** Change a shape in `packages/types/src`, run `npm run codegen`, then update the
   engine and the UI. `test_result_matches_the_typescript_contract` fails if the engine drifts.
2. **No measuring logic in rules, no rule logic in measuring.** `measure.py` decides which number
   to trust per element; `rules.py` only selects, combines and labels. See `docs/05-engine.md`.
3. **Rules are data.** New behaviour for a standard is a new slot, quantity kind or expression
   function in the type, not a special case in Python keyed on a preset id.
4. **Formulas are evaluated in one place**, the engine's safe evaluator (`expr.py`). Never `eval`.
   Never add a second evaluator in the browser; preview through the engine.
5. **Nothing is silently dropped.** An element no rule measures becomes an `unmatched` question;
   a missing value becomes a flagged line or a question; every decision is logged.
6. **Classification never changes a number.** If a change to a code list moves a quantity, it is a bug.
7. **Keep the Duplex acceptance test green.** If a number changes on purpose, update `HAND_BOQ`
   in `engine/tests/test_duplex.py` and say why in the commit.
8. **No licensed standard content in the repo.** No DIN, VOB, CSI (MasterFormat, OmniClass,
   UniFormat) text, tables or code lists, and never feed such documents to AI tools to extract
   rules. Presets here are illustrative placeholders. See `docs/08-knowledge-gaps-and-sourcing.md`.
9. **Question ids are deterministic** (built from content). Do not add random ids; stored
   decisions depend on them matching across runs and model versions.
10. **International product.** Do not bias defaults, language or examples to one country.

## Where to look

| Task | Read |
|---|---|
| Understand the domain (BoQ, IFC, measurement, classification) | `docs/01-domain-primer.md` |
| Which IFC files exist and which were tested | `docs/12-ifc-corpus-catalogue.md` |
| Why something is the way it is | `docs/02-decisions.md` |
| Add or change an engine stage | `docs/05-engine.md` |
| Write or change a rule set | `docs/06-rules-authoring.md` |
| Dictionaries and code lists | `docs/07-dictionaries-and-classification.md` |
| What is not built yet, open questions | `docs/11-roadmap-and-open-questions.md` |
| Everything from the original conversation, verbatim | `docs/reference/` |

## Status in one paragraph

Working end to end on the NIBS Duplex (Revit 2011, IFC2x3): parse, verify,
dictionary resolution, measuring, federation of several models into one BoQ, rule execution
(items, derived, manual), classification
into any number of code lists, questions and answers, calculation log, Excel export, and a dev
UI. The engine reproduces the hand-made Duplex BoQ exactly. Not yet built: per-face geometry for
room-based finishes, contradiction questions, AI name suggestions, model revisions, background jobs, users and projects, the
Java backend. Also run on 309 public IFC files from 30 authoring tools (buildingSMART samples,
DURAARK, the Auckland OpenIFC repository, Schependomlaan): no engine errors, output valid
against the contract; quantities checked only for the Duplex and the buildingSMART samples.
What was run and what is still uncovered: `docs/12-ifc-corpus-catalogue.md`.
