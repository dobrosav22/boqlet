# plan/ — specification of the deployment-ready product

This folder specifies **boqlet**, the product built on top of the proof of concept in this repository.
It is written for **coding agents** (and the people steering them) who build the frontend
(Next.js/React) and then the backend (Java), with the existing Python engine as the
computation worker.

`docs/` describes the engine and the proof of concept as they are. `plan/` describes the
product to build. When they disagree about the *product*, `plan/` wins. When they disagree about
*how the engine measures*, `docs/` and the code win.

## Start here (a new session)

**Build status: in progress** (phase 1; the owner said go on 2026-11-12; live position in
`10-build-log.md`). Every session, in every phase, starts with the prompt in
`08-delivery/sessions.md` and works by
that file: it says how to start, what to decide yourself and what to ask, when to stop and how
to hand over.

1. Read this README (decisions P01–P47 are settled; don't reopen them),
   `08-delivery/sessions.md`, and `10-build-log.md` "Current position" (where the build
   stands, the next task, and your role).
2. `08-delivery/milestones.md`: phases, milestones, exit criteria.
   - **Phase 1**, frontend role, starts with **FE-000**: it moves the repository into the
     product root `boqlet_v1/` (P44).
   - **Phase 2**, backend role, starts with **BE-000** (P47): the agent analyses the backend
     plan and puts every backend decision, open or already made, to the backend owner (whoever
     runs the session). No backend code before it.
   - **Phase 3**, frontend role, ends with **FE-046** (the product root becomes the repository
     root, the proof of concept is removed) and **FE-047** (production release).
3. Take the next task of your phase in order from `08-delivery/tasks-frontend.md`,
   `tasks-backend.md` or `tasks-engine.md`. Read the specs the task names, build only that, and
   meet its acceptance criteria and the definition of done in `08-delivery/testing.md`.
4. Commit straight to the build branch **`v_1`** (P40, P46). After every task, record it in
   `docs/11-roadmap-and-open-questions.md` ("Done") and in the build log's Current position. At
   the end of a milestone, write its build-log entry and update the status table here.
5. If a spec is silent or contradictory, or a decision is the owner's, add it to
   `09-open-questions.md` and ask; never guess product behaviour. Meanwhile go on with tasks
   that don't depend on it.

Rules that catch people out:
- **Paths in `plan/` are relative to the product root** (`boqlet_v1/` until FE-046; P44).
- The core never depends on the pricing module (P36, `04-architecture/modules.md`).
- Only the engine computes quantities (BR-01). In phase 1 the mock fakes engine features
  without measuring (`06-frontend/mock-api.md`).
- The look follows `06-frontend/design-guidelines.md` (P43).

## How to use this folder

1. Read `00-product/` (what and for whom), then `03-domain/` (the nouns, states and rules),
   then the feature specs you are working on in `01-features/`.
2. Take a task from `08-delivery/` (`tasks-frontend.md`, `tasks-backend.md`, `tasks-engine.md`).
   Every task names the spec sections it implements and its acceptance criteria.
3. The HTTP contract is `packages/api/openapi.yaml` (core) plus `packages/pricing-api/openapi-pricing.yaml` (the optional pricing module; both moved from `05-api/` in FE-001). Frontend, mock API and Java backend all
   implement or consume exactly these files. Change the contract first, then the code.
4. If a spec is silent or contradictory, do not guess on product behaviour: add the question to
   `09-open-questions.md` and ask the owner. Implementation details inside a module are yours.
5. `07-backend/decisions-to-make.md` lists decisions the **backend agent must stop and ask the
   owner about before writing backend code** (auth provider first).

## Reading order

| # | Path | What it gives you |
|---|---|---|
| 1 | [00-product/01-problem-and-vision.md](00-product/01-problem-and-vision.md) | The problem, the product, why it wins |
| 2 | [00-product/02-personas-and-markets.md](00-product/02-personas-and-markets.md) | Who uses it and how they work |
| 3 | [00-product/03-v1-scope.md](00-product/03-v1-scope.md) | What v1 contains, v1 acceptance criteria |
| 4 | [00-product/04-glossary.md](00-product/04-glossary.md) | Every term used in these specs |
| 5 | [00-product/05-plans-and-limits.md](00-product/05-plans-and-limits.md) | Free plan, paid plans, entitlements |
| 6 | [03-domain/data-model.md](03-domain/data-model.md) | Entities, fields, relations |
| 7 | [03-domain/state-machines.md](03-domain/state-machines.md) | Lifecycles of model versions, jobs, runs, BoQ versions, sessions, share links; the pricing module's own |
| 8 | [03-domain/permissions.md](03-domain/permissions.md) | Who may do what |
| 9 | [03-domain/business-rules.md](03-domain/business-rules.md) | Invariants every component must keep |
| 10 | [01-features/](01-features/) | One spec per feature (F01–F20; F11, F17, F20 form the removable pricing module) |
| 11 | [02-flows/flows.md](02-flows/flows.md), [02-flows/screens.md](02-flows/screens.md) | End-to-end flows, screen inventory, wireframes |
| 12 | [04-architecture/](04-architecture/) (start with `modules.md` for the core/module boundary) | System, engine worker contract, storage/jobs/realtime, security, deployment, NFRs |
| 13 | [05-api/](05-api/) | `openapi.yaml` (core), `openapi-pricing.yaml` (pricing module), API conventions |
| 14 | [06-frontend/](06-frontend/) | Next.js architecture, what to reuse from the PoC, mock API (and its engine fakes), design system, the owner's design guidelines (when supplied) |
| 15 | [07-backend/](07-backend/) | Java architecture, DB schema, decisions to make |
| 16 | [08-delivery/](08-delivery/) | Milestones, task lists, testing, how sessions run (`sessions.md`) |
| 17 | [09-open-questions.md](09-open-questions.md) | What is still open, who decides, and by when |
| 18 | [10-build-log.md](10-build-log.md) | Where the build stands, and what the agents decided along the way |

## Decisions taken (Nov 2026, product owner)

These are settled. Do not reopen them without the owner. Earlier engine and platform
decisions D01–D68 are in `docs/02-decisions.md` and still hold unless changed here.

| ID | Decision |
|---|---|
| P01 | **Primary tenant: the firm that produces the BoQ.** Design studios and engineering firms first (in design-led markets they author the model and the tender BoQ). QS / cost consultant firms use the same flows. Per-seat subscription. |
| P02 | *(Superseded by P28, P33, P34.)* **Bidders are contractors and subcontractors**, invited per tender package. One global bidder identity can receive invitations from many tenants. Bidders see only what they were sent. |
| P03 | **v1 is federated and versioned**: several discipline models per project; new model versions carry decisions over; change report per line between revisions. |
| P04 | *(Superseded by P33, P34.)* **No rate database.** Pricing happens through **tendering**: an issued BoQ is split into packages, bidders price lines, the firm compares offers side by side and awards per package. |
| P05 | **Full Library in v1**: org rule sets, classifications and dictionaries, versioned, with preview against a project model. |
| P06 | *(Workflow refined by P29.)* **v1 includes** the 3D viewer, review → approve → issue with an audit log, and an i18n-ready UI. **BCF is out.** |
| P07 | *(Refined by P35.)* **English only at launch**; every UI string goes through i18n from day one; engine messages get codes and parameters. |
| P08 | **Public sign-up with a limited free plan.** Billing is provider-agnostic (Paddle likely): entitlements and usage events in the backend, the payment provider behind an adapter. |
| P09 | **Cloud-neutral deployment**: containers, Postgres, S3-compatible storage. The provider is chosen at deploy time. |
| P10 | **Authentication is not decided.** The agent that starts the backend asks the owner (options in `07-backend/decisions-to-make.md`). The frontend codes against an auth adapter. |
| P11 | *(Refined by P38, P39: phases; in phase 1 the mock uses the PoC engine API plus fakes.)* **Frontend first, against a mock API** that implements `openapi.yaml`, keeps CRUD state itself and uses the **real Python engine** for computation. The Java backend replaces the mock by changing a base URL. |
| P12 | Frontend: **React + Next.js**. Backend: **Java** (D62). Engine: **Python workers** (D61). |
| P13 | "Needs input" is a state of a **run and its BoQ revision**, not of a job. A job always ends (succeeded, failed or cancelled); answering questions starts a new run. (Refines doc 10.) |
| P14 | **Item texts live on the classification's codes.** A firm's BoQ item is a number plus a written description that is priced. The text is the code's `description`, a template with blanks the engine fills per line; the line shows it instead of the rule set's short line text. Classification still never changes a number (BR-02, BR-11). |
| P15 | **What isn't in the models is the user's to add.** The engine does not guess missing work. The app says so plainly on the sheet, when a version is saved and in exports, and makes manual lines easy (BR-12). |
| P16 | **A setup wizard in v1** for a new org's first rule set, classification and dictionary (F16). "Start from your last BoQ" comes after v1. |
| P17 | **Sign-up lands in a default tier.** Paid tiers are levels by active projects, seats, or both; the commercial model is undecided, so entitlements stay data (refines P08). |
| P18 | **The setup wizard is required on first start** of a new org, for its rule set and classification (and names). It must be finishable in minutes with suggested answers (refines P16). |
| P19 | **Presets per BoQ.** A project has default presets; any BoQ may use others, chosen when it is created or later. Any preset can be cloned: independent copy, or based on it (a patch). |
| P20 | **The BoQ is fully editable**: overwrite quantity, text and unit, move lines between sections, reorder, exclude, add lines anywhere. Edits are kept across regenerations and model versions and always shown as edits. The BoQ Excel can be edited and imported back. |
| P21 | *(Refined by P33, P34, P36: price requests became offer requests in the pricing module.)* **Vendors are accounts linked to orgs by invitation** (one vendor, many orgs, always free). Anyone working on a project can send the whole BoQ or a part to vendors for prices (price request); the formal tender stays as the advanced path. Any revision can be sent, frozen at sending, unless the org requires issued ones (refines P02, BR-40). |
| P22 | **One active session per account.** Signing in elsewhere shows where the account is open and asks to end that session first. Discourages account sharing. |
| P23 | **UI: shadcn/ui** (Tailwind + Base UI, from preset `b38miVKzY`; Radix would also do) with a monospace face for the UI; very clean, no visual noise, modern. Look in `06-frontend/design-guidelines.md` (P43). |
| P24 | **Guided preset editing and Excel templates.** New rule sets and classifications start in guided mode; every preset can be downloaded as an Excel template and uploaded back. |
| P25 | **"How it is calculated" and the 3D model are central.** Every line explains its number in plain words; the model sits beside the sheet while editing and in revisions, with filters shared by both. |
| P26 | **Public read-only share links** for BoQ versions, revocable, with expiry. |
| P27 | **Platform admin console** for the operator: all orgs, users, seats, usage and activation, metadata only (no project content); support messages later. |
| P28 | **No logged-in guests.** Three kinds of access: org users, vendor users (pricing module) and public share links (plus platform admins). |
| P29 | **A BoQ is a living document until confirmed.** An always-editable working version; "Save version" locks labelled snapshots and work continues; "Confirm" marks the BoQ done (reopenable). Review and approval are optional per org, off by default. Archiving the project is separate. |
| P30 | **Position numbers per section,** automatic (5.1, 5.2…), renumbered while working, frozen in saved versions. Item numbers (codes) stay a separate column. |
| P31 | **Live co-editing per line.** Everyone in a BoQ sees others' edits within a second; on the same line the later edit wins and the other person is told. |
| P32 | **Pricing is an optional module** (vendors, pricebooks, estimates, offer requests) behind a platform flag and a plan entitlement. The product's lifecycle ends at a confirmed BoQ: no construction-phase features. |
| P33 | **Pricebooks are the core of pricing.** Firms and vendors keep their own; a vendor chooses which list each linked firm sees; a firm prices its BoQ on a separate Pricing tab from its own and shared lists. Matching pricebook items to lines is manual, and remembered. No market price database from us. |
| P34 | **No formal tendering.** Offer requests only: the whole BoQ or a part to vendors, offers filled from their pricebooks, side-by-side comparison. No packages, sealed bids, addenda or award. |
| P35 | **International by design.** No market built in; the wizard and rules are generic. Orgs set currency, units, number and date formats; English is the default UI language and more are added as translations. |
| P36 | **The pricing module is separate and removable.** The core never depends on it: own API file under `/pricing/`, own DB schema, own frontend package, own backend module; it plugs in through generic extension points and core events. Removing it changes no core code (04-architecture/modules.md). |
| P37 | **Release 1 is the full v1**: every v1 acceptance criterion (00-product/03). The pricing module stays optional inside it. |
| P38 | **Three sequential phases by two agents.** Phase 1: the frontend agent builds the whole app and the mock API (the backend's executable spec). Phase 2: the backend agent makes the platform decisions (BE-000), builds the real engine changes and the Java backend against the same contract and scenario suites. Phase 3: the frontend agent wires the app to Java, removes the fakes, hardens and releases. Refines P11. |
| P39 | **Engine (Python) work belongs to the backend agent, in phase 2.** In phase 1 the mock runs the proof-of-concept engine API and fakes the engine features that don't exist yet, never measuring; each fake names the task that replaces it (`06-frontend/mock-api.md`). |
| P40 | *(Branch refined by P46.)* **Everyone commits straight to the build branch**, small commits, no feature branches; the phases don't overlap. |
| P41 | **The owner sets the visual direction**; it is recorded in `06-frontend/design-guidelines.md` (P43), which overrides `design-system.md`. |
| P42 | **The setup wizard's questions come from the rule set's data.** Every yes/no question that switches BoQ items on or off forms one checklist, with the follow-ups of what was switched on; the measuring questions for walls, openings, roofs, windows and doors and line splitting are marked in the rule set (`setupSteps`, six screens for "As modelled"). Step 2 lists only the BoQ items the answers switch on. F16. |
| P43 | **The product is called boqlet** (always lowercase). **Visual direction:** warm paper and ink, JetBrains Mono for the UI and Inter Tight for display, 2 px corners, colour only where it means something (blue accent and "derived", orange "to confirm", yellow "manual" and selection, red errors, no green), poster compositions only in the wizard, onboarding, sign-in, share page and dashboard cards, the dimension line as a recurring device, light theme default plus dark. Details and tokens in `06-frontend/design-guidelines.md`. |
| P44 | **One product root: `boqlet_v1/`.** All product code is built there, as one npm workspace. The first task (FE-000) moves the proof of concept (engine, contract types, presets, fixtures, scripts, PoC UI, docs, this plan) into it, so nothing ever refers across two roots; the PoC demo deployment stays pointed into it. The last structural task (FE-046) removes the PoC leftovers and makes `boqlet_v1/` the repository root. Paths in `plan/` are relative to the product root. |
| P45 | **Agents work on their own from task to task and milestone to milestone**, by `08-delivery/sessions.md`. They stop only for an owner decision that blocks every remaining task, at the end of a phase, or before an irreversible step. Implementation decisions and deviations are written in `10-build-log.md`, which, with its "Current position", is the handover between sessions and agents. |
| P46 | **The build happens on the branch `v_1`**, made from `main`. `main` keeps the proof of concept and its live demo untouched until the release: FE-047 tags `main` as `poc-final` and merges `v_1` into it. CI runs on both branches; staging deploys from `v_1` until the release, production from `main` after it. |
| P47 | **The backend belongs to its backend owner**: the person who runs phase 2 (the product owner or a backend developer they choose). BE-000 is their entry point: the agent analyses the backend plan and asks them about every backend decision, the open ones and the ones the plan already made (`07-backend/decisions-to-make.md`). The plan's backend choices are defaults. Their answers win over the backend plan, which BE-000 rewrites to match. They may change the HTTP contracts when the backend needs it, by `05-api/contract-changes.md`: contract, suites, mock and the smallest app fix in one commit, every change listed, and the frontend adapted in phase 3 (FE-041). Not theirs alone: product behaviour (the product decisions and business rules, what users can do or see) and the engine rules; changes there go to the product owner. |

## Where the code lives (P44)

The **product root is `boqlet_v1/`**. FE-000, the first task of the build, moves the proof of
concept into it. FE-046, the last structural task, removes what is left of the proof of concept
and makes `boqlet_v1/` the repository root. **Every path in `plan/` is relative to the product
root**: `engine/` means `boqlet_v1/engine/` until FE-046, and `engine/` afterwards.

```text
boqlet_v1/                     the product root: one npm workspace (apps/*, packages/*), name "boqlet"
  apps/app                     Next.js product frontend (phase 1; wired to Java in phase 3)
  apps/mock-api                Mock backend implementing both contracts (phase 1): PoC engine API plus
                               engine fakes, then the engine worker from phase 2; afterwards an e2e test double
  apps/web                     PoC dev UI and its Guide, behind the live demo; deleted in FE-046
  packages/api                 openapi.yaml (moved from plan/05-api in FE-001) + generated client (@ifc-boq/api)
  packages/pricing-api         openapi-pricing.yaml + its generated client (pricing module only)
  packages/pricing-ui          Pricing module frontend (optional, removable, P36)
  packages/types               Engine contract (TS -> JSON Schema), unchanged role
  services/api                 Java backend (phase 2); the pricing module is its own build module (BE-P*)
  engine/                      Python engine; gains worker.py, worker_http.py, rpc.py, storage.py, sheets/ (phase 2)
  presets/  fixtures/          as today
  scripts/                     Node helpers that set up and run the engine
  tests/contract               shared contract suite (TS-001): runs against the mock and against Java
  tests/scenarios              shared behaviour suite (TS-001): same
  tests/perf                   performance suite (TS-002)
  plan/                        this specification, with 10-build-log.md
  docs/                        engine and PoC documentation
  CLAUDE.md  README.md  notes.md  .gitignore  package.json  package-lock.json

Outside the product root, at the repository root (until FE-046):
  CLAUDE.md                    a pointer to boqlet_v1/CLAUDE.md
  .github/workflows/           CI (GitHub needs it at the repository root; product jobs run in boqlet_v1/)
  .claude/                     agent settings
  .gitignore                   node_modules/, .env, .vercel/
  vercel.json, api/index.py, requirements.txt
                               the PoC demo deployment (docs/17), pointed into boqlet_v1/; deleted in FE-046
```

After FE-046 the same tree sits at the repository root, without `apps/web`, the PoC dev API
(`engine/ifc_boq/api.py`, `store.py`) and the demo deployment. All of this happens on the build
branch `v_1` (P46); `main` keeps the proof of concept until FE-047 tags it `poc-final` and
merges `v_1` into it.

## Status

| Part | State |
|---|---|
| Product definition (00) | Written; personas and scope to be validated with users (09) |
| Domain, features, flows (01–03) | Written |
| Architecture, API (04–05) | Written; `openapi.yaml` (core) and `openapi-pricing.yaml` (pricing module) cover every endpoint; the core never references the module (`04-architecture/modules.md`) |
| Frontend, backend specs (06–07) | Written; backend decisions open on purpose |
| Delivery (08) | Phases, milestones, task lists, session rules and build log written (P37–P40, P44, P45) |
| Design (06) | Design guidelines decided (P43); wordmark SVG still to come from the owner |
| **Build** | **Phase 1 in progress.** M0 (consolidation, contract, scaffolding) done 2026-11-12; M1 (core loop) done 2026-11-13, except FL-1's setup wizard (FE-028, M2) and the sample project's content (docs/11); next M2, FE-021. Live position: `10-build-log.md` |
