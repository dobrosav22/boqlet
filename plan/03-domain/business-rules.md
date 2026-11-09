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
| BR-09 | **Edits are explicit.** A line edit (quantity, text, unit, section, position, exclusion; P20) is kept per line key across runs and model versions. An edited line shows the engine's value and the edit, with the reason where one is required, in the sheet, the exports, share links and the change report. An excluded line stays listed as excluded. An edit whose line disappears becomes an `orphan_override` question, never silently dropped. | BR-03 |
| BR-10 | Only `blocking` questions keep a run in `needs_input`. Informative questions are listed but don't block submission. | D20 |
| BR-11 | **Item texts never change a number.** An item text belongs to a code in a classification (P14). Its blanks are filled by the engine only (BR-01), from the line's values. A blank the line has no value for stays visible and raises a run warning, never an empty or guessed text. | P14 |
| BR-12 | **The app says what it cannot see.** Quantities come only from what the models contain; work not modelled as objects is the user's to add (manual lines) unless the rule set derives it. The sheet, the submit dialog and the exports say so (F06 §12, F09 §2, F12). The app never claims a BoQ is complete. | P15 |

## Revisions and workflow

| ID | Rule |
|---|---|
| BR-20 | **Saved means locked**, for every role including owner. Changes continue in the working version (P29). |
| BR-21 | A BoQ has at most one working (non-saved) version; saving a version opens the next one in the same transaction, unless the BoQ is being confirmed. |
| BR-22 | Saving a version (or submitting it, with approval on) needs a finished run that reflects current inputs, decisions and line edits. Open blocking questions are allowed and recorded on the version. |
| BR-23 | Any change that would alter the current run's result (inputs, decisions used by it, adjustments) moves an `in_review` or `approved` revision back to `draft`. The user is warned, with the affected revisions listed, before the change is saved. |
| BR-24 | With approval and four-eyes on, the submitter cannot approve or save the same version. |
| BR-25 | Saving writes an Excel export and the position numbers frozen with the version. Later exports of a saved version return that same file. |
| BR-26 | Version labels are sequential per BoQ (A, B, C... then AA, AB). They are never reused. |
| BR-27 | **A confirmed BoQ is read-only** (`409 boq_confirmed`) until a lead reopens it with a reason. Confirming and reopening are audited. |
| BR-28 | **Position numbers are unique within a BoQ version**: section code + running number in line order (P30). They renumber in the working version as lines are added, moved, reordered or excluded, and never change in a saved version. |
| BR-29 | **Concurrent edits are per line** (P31): the later edit of the same line wins, the earlier editor is told, and nothing is merged silently across fields of different lines. |

## Federation

| ID | Rule |
|---|---|
| BR-30 | One model is a federation of one. All BoQ code handles 1..n models the same way. |
| BR-31 | Discipline ownership and scope rules come from the revision inputs (copied from the models, editable per revision). Overlaps between models become `overlap` / `double_claim` questions. |
| BR-32 | Shared coordinates are assumed in v1. When models don't overlap in space, the run carries a warning and the UI shows it at the top of the sheet. |

## Pricing module (P32–P36)

Rules of the optional module, enforced by the module's own code. The core rules above never
refer to them.

| ID | Rule |
|---|---|
| BR-40 | An offer request's lines are **frozen copies** of one run of the BoQ, taken when sent and again at each update. Any BoQ state may be sent unless `offersFromSavedVersionsOnly` is on. |
| BR-41 | **The core never depends on the module** (P36): no core table, API shape, screen or test refers to pricing; the module reads the core through its public interfaces and events. A build without the module passes every core test. |
| BR-42 | **Pricing never changes the BoQ.** Estimates, matches and offers change no quantity, line, code or text of the BoQ (extends BR-02). |
| BR-43 | An update supersedes the request's current offers. Rates carry over by line key and unit; vendors must submit again. |
| BR-44 | **Matching is manual** (P33): a price is filled automatically only from a match a person made earlier (a remembered match); nothing is guessed. |
| BR-45 | After the deadline no offer changes. Extending the deadline reopens the request for every invited vendor. |
| BR-46 | **Vendors see only what was sent or is theirs**: the lines of requests sent to them, their own pricebooks, matches and offers. A firm sees of a vendor only the one price list the vendor shares with it. |
| BR-47 | `amount = round(quantity × rate)` to the currency's minor units, computed by the backend. Totals are sums of rounded amounts. Decimal arithmetic, never binary floating point. |
| BR-48 | Every price shows its source (own pricebook item, vendor list, offer, manual) and its price date. |

## Data and tenancy

| ID | Rule |
|---|---|
| BR-50 | Every read and write is scoped to the caller's org and project role, or (pricing module) to the vendor's own data and invitations. Cross-tenant access returns `404`. |
| BR-51 | Everything a user does that changes data writes an audit event. Audit events are never edited or deleted, except when the whole org is deleted. |
| BR-52 | Deleting an org removes all its data, files included, within 30 days. (Pricing module) vendors keep a read-only copy of the offers they submitted to it. |
| BR-53 | No licensed standard content is shipped. System presets are illustrative placeholders. UI copy never claims compliance with a standard. | D30–D32 |
| BR-54 | **One active session per account** (P22). A second sign-in must end the first (takeover, audited) or give up. Every authenticated request checks that its session is the active one. | P22 |
| BR-55 | (Pricing module) **A vendor link belongs to one org**; one org never sees another org's links, shared lists, requests or offers, even for the same vendor. |
| BR-56 | **Share links are read-only, revocable and minimal.** They show only what the creator included, never member names, decisions, questions, vendors or prices; unknown, expired or revoked tokens and orgs with `publicLinksAllowed` off return `404`. Tokens are stored hashed. | P26 |
| BR-57 | **Platform admins see metadata, not content.** The admin console never returns project content (models, file and project names, lines, texts, decisions, offers, prices). Every admin action and org detail view is audited; actions also appear in the org's audit log. | P27 |

## Limits

| ID | Rule |
|---|---|
| BR-60 | Limits are checked before the action and reported as `402 limit_reached` with the limit name, current value and maximum. |
| BR-61 | Limits never block reading, exporting, answering questions, or (pricing module) acting on an open offer request. |
| BR-62 | A usage event is written for every parse, run and preview job that ends, whatever the plan. |
