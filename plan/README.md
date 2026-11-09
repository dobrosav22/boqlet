# plan/ — specification of the deployment-ready product

This folder specifies the product built on top of the proof of concept in this repository.
It is written for **coding agents** (and the people steering them) who build the frontend
(Next.js/React) and then the backend (Java), with the existing Python engine as the
computation worker.

`docs/` describes the engine and the proof of concept as they are. `plan/` describes the
product to build. When they disagree about the *product*, `plan/` wins. When they disagree about
*how the engine measures*, `docs/` and the code win.

## How to use this folder

1. Read `00-product/` (what and for whom), then `03-domain/` (the nouns, states and rules),
   then the feature specs you are working on in `01-features/`.
2. Take a task from `08-delivery/` (`tasks-frontend.md`, `tasks-backend.md`, `tasks-engine.md`).
   Every task names the spec sections it implements and its acceptance criteria.
3. The HTTP contract is `05-api/openapi.yaml`. Frontend, mock API and Java backend all
   implement or consume exactly this file. Change the contract first, then the code.
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
| 13 | [05-api/](05-api/) | `openapi.yaml` and API conventions |
| 14 | [06-frontend/](06-frontend/) | Next.js architecture, what to reuse from the PoC, mock API, design system |
| 15 | [07-backend/](07-backend/) | Java architecture, DB schema, decisions to make |
| 16 | [08-delivery/](08-delivery/) | Milestones, task lists, testing |
| 17 | [09-open-questions.md](09-open-questions.md) | What is assumed and must be validated |

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
| P11 | **Frontend first, against a mock API** that implements `openapi.yaml`, keeps CRUD state itself and uses the **real Python engine** for computation. The Java backend replaces the mock by changing a base URL. |
| P12 | Frontend: **React + Next.js**. Backend: **Java** (D62). Engine: **Python workers** (D61). |
| P13 | "Needs input" is a state of a **run and its BoQ revision**, not of a job. A job always ends (succeeded, failed or cancelled); answering questions starts a new run. (Refines doc 10.) |
| P14 | **Item texts live on the classification's codes.** A firm's BoQ item is a number plus a written description that is priced. The text is the code's `description`, a template with blanks the engine fills per line; the line shows it instead of the rule set's short line text. Classification still never changes a number (BR-02, BR-11). |
| P15 | **What isn't in the models is the user's to add.** The engine does not guess missing work. The app says so plainly on the sheet, at submit and in exports, and makes manual lines easy (BR-12). |
| P16 | **A setup wizard in v1** for a new org's first rule set, classification and dictionary (F16). "Start from your last BoQ" comes after v1. |
| P17 | **Sign-up lands in a default tier.** Paid tiers are levels by active projects, seats, or both; the commercial model is undecided, so entitlements stay data (refines P08). |
| P18 | **The setup wizard is required on first start** of a new org, for its rule set and classification (and names). It must be finishable in minutes with suggested answers (refines P16). |
| P19 | **Presets per BoQ.** A project has default presets; any BoQ may use others, chosen when it is created or later. Any preset can be cloned: independent copy, or based on it (a patch). |
| P20 | **The BoQ is fully editable**: overwrite quantity, text and unit, move lines between sections, reorder, exclude, add lines anywhere. Edits are kept across regenerations and model versions and always shown as edits. The BoQ Excel can be edited and imported back. |
| P21 | *(Refined by P33, P34, P36: price requests became offer requests in the pricing module.)* **Vendors are accounts linked to orgs by invitation** (one vendor, many orgs, always free). Anyone working on a project can send the whole BoQ or a part to vendors for prices (price request); the formal tender stays as the advanced path. Any revision can be sent, frozen at sending, unless the org requires issued ones (refines P02, BR-40). |
| P22 | **One active session per account.** Signing in elsewhere shows where the account is open and asks to end that session first. Discourages account sharing. |
| P23 | **UI: shadcn/ui** (Tailwind + Radix) with **one monospace typeface**; very clean, no visual noise, modern (settles the FE-001 styling question). |
| P24 | **Guided preset editing and Excel templates.** New rule sets and classifications start in guided mode; every preset can be downloaded as an Excel template and uploaded back. |
| P25 | **"How it is calculated" and the 3D model are central.** Every line explains its number in plain words; the model sits beside the sheet while editing and in revisions, with filters shared by both. |
| P26 | **Public read-only share links** for BoQ revisions, revocable, with expiry. |
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

## Where the code will live (target monorepo)

```
apps/app          Next.js product frontend (new)
apps/mock-api     Mock backend implementing openapi.yaml, delegating computation to the engine (new)
apps/web          The PoC dev UI (kept as an engine developer tool until the product replaces it)
services/api      Java backend (new, later)
engine/           Python engine; gains worker.py (queue worker) and rpc.py (quick calls)
packages/types    Engine contract (TS -> JSON Schema), unchanged role
packages/pricing-ui  Pricing module frontend (optional, removable, P36)
packages/pricing-api openapi-pricing.yaml + its generated client (module only)
packages/api      openapi.yaml (moved here from plan/05-api in task FE-001) + generated TS client
plan/             This specification
docs/             Engine and PoC documentation
```

## Status

| Part | State |
|---|---|
| Product definition (00) | Written; personas and scope to be validated with users (09) |
| Domain, features, flows (01–03) | Written |
| Architecture, API (04–05) | Written; `openapi.yaml` (core) and `openapi-pricing.yaml` (pricing module) cover every endpoint; the core never references the module (`04-architecture/modules.md`) |
| Frontend, backend specs (06–07) | Written; backend decisions open on purpose |
| Delivery (08) | Task lists written; nothing built yet |
