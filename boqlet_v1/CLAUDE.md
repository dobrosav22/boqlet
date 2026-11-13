# CLAUDE.md

Guidance for AI agents (and people) working on boqlet. This folder, `boqlet_v1/`, is the
**product root** (P44): every path below and in `plan/` is relative to it, and every command runs
in it. Read this first, then `docs/README.md` (the engine and the proof of concept) and
`plan/README.md` (the product being built).

## What this is

A tool that turns IFC building models into a Bill of Quantities (BoQ). The measuring rules,
the classification (codes and grouping) and the naming dictionary are **data the user
chooses**, not code. Every number in the output can be traced to a formula, the parameter
values used and the elements that contributed.

```
getBoq(models, rules, classifications, dictionaries, decisions) -> BoqResult
```

The proof of concept (a React dev app plus a local Python engine) is the seed of the product
monorepo specified in `plan/`: a Next.js app, a mock API (phase 1), a **Java** backend (phase 2,
owns users, projects, storage, jobs) and the Python engine as its worker. Java backend code starts
only in phase 2, after BE-000 (the backend owner's review and decisions, P47).
`api.py`, `store.py` and the request shapes in `api.ts` are a **temporary demo backend**: keep them
thin CRUD. Anything that decides something belongs in the engine as plain functions over the
contract types (see `docs/03-architecture.md`, code boundaries).

## Run it

In `boqlet_v1/`:

```bash
npm install          # also creates engine/.venv and installs the Python engine (Python 3.10-3.13)
npm run dev:poc      # PoC: engine on 127.0.0.1:8787 + web on http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev:poc` | The proof of concept: engine and PoC web app (concurrently). Vite proxies `/api` to the engine. |
| `npm run dev:app` | The product in development: PoC engine API (8787) + mock API (`apps/mock-api`, 4010) + app (`apps/app`, Next.js, http://localhost:3000; `/api/v1` proxied to the mock). Sign in as a seeded user (`/_dev/users` on 4010). |
| `npm run dev:mock` / `npm run mock:seed` / `npm run mock:reset` | The mock API alone / seed `apps/mock-api/.data` if empty / wipe and reseed. |
| `npm run test` | Typecheck all workspaces, lint the app, the app's and the mock's tests, the contract and scenario suites against a fresh mock, then the engine tests (pytest). The mock's Duplex test runs only when the engine is up (`npm run dev:engine`). |
| `npm run test:contract:mock` / `npm run test:scenarios:mock` | The shared suites (`tests/contract`, `tests/scenarios`) against a fresh mock they start themselves. Without `:mock` they run against `API_URL` (a running mock, or Java in phase 2). |
| `npm run lint` / `npm run test:app` / `npm run e2e:app` | The app's ESLint (no literal UI strings, F15) / Vitest unit tests / Playwright end-to-end tests (starts the app if it isn't running). |
| `npm run test:engine` | Engine tests only. Includes the Duplex acceptance test. |
| `npm run typecheck` / `npm run build:poc` | Typecheck all workspaces / production build of the PoC web app. |
| `npm run api:lint` | Lint both HTTP contracts (`packages/api/openapi.yaml`, `packages/pricing-api/openapi-pricing.yaml`). |
| `npm run api:gen` / `npm run api:check` | Regenerate the clients' types from the contracts / fail if they are out of date (CI). Run `api:gen` after editing a contract. |
| `npm run build:app` | Production build of the product app (`apps/app`, Next.js). |
| `npm run ui:add -w @ifc-boq/app -- <name>` | Add a shadcn/ui component (style base-mira); never `npx shadcn add` (`plan/06-frontend/architecture.md`). |
| `npm run boq -- <file.ifc> --out boq.xlsx` | Command-line run, no UI. `--help` for options. |
| `npm run corpus -- <folder>` | Run every IFC in a folder; one summary row per file, schema-validated. Use before adding fixtures. |
| `npm run catalogue` | Regenerate `docs/12-ifc-corpus-catalogue.md` from `fixtures/corpus/catalogue.json` (every IFC looked at, tagged). |
| `npm run codegen` | Regenerate JSON Schemas from the TypeScript types. Run after editing `packages/types/src`. |
| `npm run setup:engine` | Recreate the Python venv (after editing `engine/requirements.txt`). |
| `npm run import:uniclass` | Download Uniclass 2015 EF into `presets/classifications/uniclass2015-ef/codelist.json`. |

Environment: `IFC_BOQ_PYTHON` (python to use), `IFC_BOQ_SKIP_ENGINE_SETUP=1`,
`IFC_BOQ_ENGINE_PORT` (default 8787), `IFC_BOQ_USER_PRESETS` (where the Library saves, default `presets/user`).

## Repo map

| Path | What lives there |
|---|---|
| `apps/app` | The product frontend, Next.js (phase 1; wired to Java in phase 3). |
| `apps/mock-api` | Mock backend implementing both contracts (phase 1): the PoC engine API plus engine fakes, later the engine worker; afterwards an e2e test double. |
| `apps/web` | React 18 + Vite PoC dev UI and its Guide, behind the live demo: drop IFC, choose presets, generate, inspect lines, log, questions, compare, download Excel. Deleted in FE-046. |
| `packages/api` | `openapi.yaml` (the core HTTP contract) and its generated client (`@ifc-boq/api`). |
| `packages/pricing-api`, `packages/pricing-ui` | The optional, removable pricing module's contract, client and frontend (P36). |
| `packages/types/src` | **The engine contract.** Every shape as TypeScript: rules, parsed model, measured element, dictionary, classification, BoQ result, HTTP API. Source of truth. |
| `packages/types/schema` | JSON Schemas generated from the types (`npm run codegen`). The Python engine validates presets and its own output against them. Do not edit by hand. |
| `services/api` | The Java backend (phase 2). |
| `engine/ifc_boq` | The Python engine: parse, names, measure, rules, classify, pipeline, export, API, CLI. Gains the worker in phase 2. |
| `engine/tests` | pytest. `test_duplex.py` is the acceptance test against the hand-made BoQ. |
| `presets/` | Rule sets, dictionaries, classifications, resolution settings, as JSON. Loaded from disk on every run, so edits apply without restarting. `presets/user/` (git-ignored) holds what the Library saves; shipped presets are never written. |
| `fixtures/` | The NIBS Duplex IFC and the hand-made reference BoQ; buildingSMART certification samples (CC BY 4.0) in `ifc/buildingsmart/`. |
| `scripts/` | Node helpers that set up and run the Python engine from npm. |
| `tests/contract`, `tests/scenarios`, `tests/perf` | Shared contract and behaviour suites (run against the mock and against Java), performance suite. |
| `plan/` | The product specification, with `10-build-log.md` (where the build stands). |
| `docs/` | The engine and proof of concept, everything decided so far, written for the next developer or agent. |

Outside the product root, at the repository root until FE-046: `.github/workflows/` (CI),
`.claude/`, and the PoC demo deployment on Vercel (`vercel.json`, `api/index.py`,
`requirements.txt`, docs/17), pointed into `boqlet_v1/`. Keep the root `requirements.txt` in sync
with `engine/requirements.txt`.

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
| Which measurement standards exist and what each covers | `docs/13-measurement-standards.md` |
| Why something is the way it is | `docs/02-decisions.md` |
| Add or change an engine stage | `docs/05-engine.md` |
| Write or change a rule set | `docs/06-rules-authoring.md` |
| Use the Library to manage rule sets (user guide) | `docs/14-rules-guide.md` |
| Use the Library to manage classifications (user guide) | `docs/15-classifications-guide.md` |
| Use the Library to manage dictionaries (user guide) | `docs/16-dictionaries-guide.md` |
| Deploy a demo on Vercel | `docs/17-deploying-a-demo.md` |
| Dictionaries and code lists | `docs/07-dictionaries-and-classification.md` |
| What is not built yet, open questions | `docs/11-roadmap-and-open-questions.md` |
| Build the product (Next.js frontend, mock API, Java backend, engine worker): specs, API contract, phases, tasks | `plan/README.md` "Start here", then `plan/08-delivery/sessions.md` and `plan/10-build-log.md` |
| Everything from the original conversation, verbatim | `docs/reference/` |

## Status in one paragraph

Working end to end on the NIBS Duplex (Revit 2011, IFC2x3): parse, verify,
dictionary resolution, measuring, federation of several models into one BoQ, rule execution
(items, derived, manual), classification
into any number of code lists, questions and answers, calculation log, Excel export, and a dev
UI, plus real wall faces with the rooms on them and room-by-room finishes. The engine reproduces the
hand-made Duplex BoQ exactly. Across federated models the engine links doors to openings, rooms to walls
and columns through slabs (with the `meshes.npz` sidecar), and it asks about contradictions and double claims.
Not yet built: coordinate alignment between models, AI name suggestions, model revisions, background jobs, users and projects, the
Java backend. Also run on 309 public IFC files from 30 authoring tools (buildingSMART samples,
DURAARK, the Auckland OpenIFC repository, Schependomlaan): no engine errors, output valid
against the contract; quantities checked only for the Duplex and the buildingSMART samples.
What was run and what is still uncovered: `docs/12-ifc-corpus-catalogue.md`.

The product built on top of this is specified in `plan/` (decisions P01–P47, phases,
milestones, tasks). Every build session starts with the prompt in `plan/08-delivery/sessions.md`
and works by that file. **Where the build stands** (phase, role, next task, what agents decided
along the way) is in `plan/10-build-log.md`. The build happens on the branch `v_1` (P46); `main`
keeps the proof of concept and its live demo until the release.
