# Business rules

Invariants every component (frontend, mock API, Java backend, engine worker) must keep. Each
rule has an id. Tests and code comments cite it (`// BR-07`).

## Numbers and the engine

| ID | Rule | Origin |
|---|---|---|
| BR-01 | **Only the engine computes quantities.** No measuring, rule or formula evaluation in the frontend, mock or Java. Previews go through the engine. Plain arithmetic on results (subtotals, rate × quantity, deltas) is allowed anywhere. | D21, CLAUDE.md 4 |
| BR-02 | **Classification never changes a number.** Switching or adding a code system only regroups lines. A test asserts quantities are identical across classification choices. | D14 |
| BR-03 | **Nothing is silently dropped.** Unmeasured elements become `unmatched` questions; missing values become flagged lines or questions; overrides are visible on the line; excluded elements are counted and listed. The UI never hides flagged lines by default. | D06 |
| BR-04 | **Question ids are deterministic** and come from the engine. Backend and frontend never invent question ids. Decisions are keyed by question id per project. | D19 |
| BR-05 | **Decisions belong to the project** and are re-applied on every run of every BoQ in it. Promoting a name answer copies it into the org's company dictionary as a new published version; the project decision stays. | D18 |
| BR-06 | **Runs are immutable.** A run's request, snapshot and result never change after it finishes. | D67 |
| BR-07 | **Every run stores a snapshot** of the flattened presets it used. Publishing a new preset version never changes an existing run or revision. | D15, doc 10 |
| BR-08 | **Model versions are immutable.** A new file is always a new version. Identical content (same sha256 in the org) reuses parse artifacts. | D16, D41 |
| BR-09 | **Overrides are explicit.** An overridden line shows both the engine quantity and the override, with the reason, in the sheet, the exports and the change report. An override whose line disappears becomes an `orphan_override` question, never silently dropped. | BR-03 |
| BR-10 | Only `blocking` questions keep a run in `needs_input`. Informative questions are listed but don't block submission. | D20 |

## Revisions and workflow

| ID | Rule |
|---|---|
| BR-20 | **Issued means locked**, for every role including owner. Changes need a new revision. |
| BR-21 | A BoQ has at most one non-issued revision. |
| BR-22 | Submitting for review needs a finished, complete run that reflects current inputs, decisions and adjustments. |
| BR-23 | Any change that would alter the current run's result (inputs, decisions used by it, adjustments) moves an `in_review` or `approved` revision back to `draft`. The user is warned, with the affected revisions listed, before the change is saved. |
| BR-24 | With four-eyes on, the submitter cannot approve or issue the same revision. |
| BR-25 | Issuing writes an Excel export frozen with the revision. Later exports of an issued revision return that same file. |
| BR-26 | Revision labels are sequential per BoQ (A, B, C... then AA, AB). They are never reused. |

## Federation

| ID | Rule |
|---|---|
| BR-30 | One model is a federation of one. All BoQ code handles 1..n models the same way. |
| BR-31 | Discipline ownership and scope rules come from the revision inputs (copied from the models, editable per revision). Overlaps between models become `overlap` / `double_claim` questions. |
| BR-32 | Shared coordinates are assumed in v1. When models don't overlap in space, the run carries a warning and the UI shows it at the top of the sheet. |

## Tendering

| ID | Rule |
|---|---|
| BR-40 | A tender prices **one issued revision** at a time (the latest addendum's). |
| BR-41 | A line belongs to at most one package per tender. |
| BR-42 | Package lines are **frozen copies**. Later revisions don't change them except through an addendum. |
| BR-43 | An addendum supersedes all current offers on the affected packages. Rates carry over by line key and unit. Bidders must resubmit. |
| BR-44 | **Sealed:** before the deadline the firm cannot read rates or totals, by API, export or notification. |
| BR-45 | After the deadline no offer changes. Extending the deadline reopens the tender for everyone invited. |
| BR-46 | Bidders see only their package lines, the tender information and their own offers (permissions). |
| BR-47 | `amount = round(quantity × rate)` to the currency's minor units, computed by the backend. Totals are sums of rounded amounts. Decimal arithmetic, never binary floating point. |
| BR-48 | Award is one submitted offer of the latest addendum per package, after close. |

## Data and tenancy

| ID | Rule |
|---|---|
| BR-50 | Every read and write is scoped to the caller's org, project role or bidder invitation. Cross-tenant access returns `404`. |
| BR-51 | Everything a user does that changes data writes an audit event. Audit events are never edited or deleted, except when the whole org is deleted. |
| BR-52 | Deleting an org removes all its data, files included, within 30 days. Bidders keep a read-only copy of their own submitted offers (company, lines, rates) for their records. |
| BR-53 | No licensed standard content is shipped. System presets are illustrative placeholders. UI copy never claims compliance with a standard. | D30–D32 |

## Limits

| ID | Rule |
|---|---|
| BR-60 | Limits are checked before the action and reported as `402 limit_reached` with the limit name, current value and maximum. |
| BR-61 | Limits never block reading, exporting, answering questions, or acting on an open tender. |
| BR-62 | A usage event is written for every parse, run and preview job that ends, whatever the plan. |
