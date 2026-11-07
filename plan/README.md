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
| 7 | [03-domain/state-machines.md](03-domain/state-machines.md) | Lifecycles of versions, jobs, runs, revisions, tenders, offers |
| 8 | [03-domain/permissions.md](03-domain/permissions.md) | Who may do what |
| 9 | [03-domain/business-rules.md](03-domain/business-rules.md) | Invariants every component must keep |
| 10 | [01-features/](01-features/) | One spec per feature (F01–F16) |
| 11 | [02-flows/flows.md](02-flows/flows.md), [02-flows/screens.md](02-flows/screens.md) | End-to-end flows, screen inventory, wireframes |
| 12 | [04-architecture/](04-architecture/) | System, engine worker contract, storage/jobs/realtime, security, deployment, NFRs |
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
| P02 | **Bidders are contractors and subcontractors**, invited per tender package. One global bidder identity can receive invitations from many tenants. Bidders see only what they were sent. |
| P03 | **v1 is federated and versioned**: several discipline models per project; new model versions carry decisions over; change report per line between revisions. |
| P04 | **No rate database.** Pricing happens through **tendering**: an issued BoQ is split into packages, bidders price lines, the firm compares offers side by side and awards per package. |
| P05 | **Full Library in v1**: org rule sets, classifications and dictionaries, versioned, with preview against a project model. |
| P06 | **v1 includes** the 3D viewer, review → approve → issue with an audit log, and an i18n-ready UI. **BCF is out.** |
| P07 | **English only at launch**; every UI string goes through i18n from day one; engine messages get codes and parameters. |
| P08 | **Public sign-up with a limited free plan.** Billing is provider-agnostic (Paddle likely): entitlements and usage events in the backend, the payment provider behind an adapter. |
| P09 | **Cloud-neutral deployment**: containers, Postgres, S3-compatible storage. The provider is chosen at deploy time. |
| P10 | **Authentication is not decided.** The agent that starts the backend asks the owner (options in `07-backend/decisions-to-make.md`). The frontend codes against an auth adapter. |
| P11 | **Frontend first, against a mock API** that implements `openapi.yaml`, keeps CRUD state itself and uses the **real Python engine** for computation. The Java backend replaces the mock by changing a base URL. |
| P12 | Frontend: **React + Next.js**. Backend: **Java** (D62). Engine: **Python workers** (D61). |
| P13 | "Needs input" is a state of a **run and its BoQ revision**, not of a job. A job always ends (succeeded, failed or cancelled); answering questions starts a new run. (Refines doc 10.) |
| P14 | **Item texts live on the classification's codes.** A firm's BoQ item is a number plus a written description that bidders price. The text is the code's `description`, a template with blanks the engine fills per line; the line shows it instead of the rule set's short line text. Classification still never changes a number (BR-02, BR-11). |
| P15 | **What isn't in the models is the user's to add.** The engine does not guess missing work. The app says so plainly on the sheet, at submit and in exports, and makes manual lines easy (BR-12). |
| P16 | **A setup wizard in v1** for a new org's first rule set, classification and dictionary (F16). "Start from your last BoQ" comes after v1. |

## Where the code will live (target monorepo)

```
apps/app          Next.js product frontend (new)
apps/mock-api     Mock backend implementing openapi.yaml, delegating computation to the engine (new)
apps/web          The PoC dev UI (kept as an engine developer tool until the product replaces it)
services/api      Java backend (new, later)
engine/           Python engine; gains worker.py (queue worker) and rpc.py (quick calls)
packages/types    Engine contract (TS -> JSON Schema), unchanged role
packages/api      openapi.yaml (moved here from plan/05-api in task FE-001) + generated TS client
plan/             This specification
docs/             Engine and PoC documentation
```

## Status

| Part | State |
|---|---|
| Product definition (00) | Written; personas and scope to be validated with users (09) |
| Domain, features, flows (01–03) | Written |
| Architecture, API (04–05) | Written; `openapi.yaml` covers every endpoint the features use |
| Frontend, backend specs (06–07) | Written; backend decisions open on purpose |
| Delivery (08) | Task lists written; nothing built yet |
