# 04 Glossary

Domain terms (BoQ, QS, IFC, preliminaries, formwork, federation...) are explained in
[docs/01-domain-primer.md](../../docs/01-domain-primer.md). Read it first if they are new.
This page defines the **platform terms** used in these specs. Use them exactly in code,
API and UI copy.

| Term | Meaning | Code name |
|---|---|---|
| Organisation (org, tenant) | The firm that owns projects, presets and seats. Billing unit. | `Org` |
| Member | A user who belongs to an org with an org role. Uses a seat. | `Membership` |
| Seat | A paid place for an org user. Vendors and public-link visitors don't use seats. | entitlement `seats` |
| Vendor | (Pricing module) A contractor or supplier account, linked to the orgs that invited it; keeps pricebooks and answers offer requests. Free, never a seat. | `VendorProfile`, `VendorLink` (module) |
| Vendor link | (Pricing module) A vendor in one org's directory, with the price list the vendor shares with that org. | `VendorLink` (module) |
| Project | A building or job. Holds models, BoQs and decisions. | `Project` |
| Model | One discipline's model in a project (Architecture, Structure, MEP...). Has versions. | `Model` |
| Model version | One uploaded IFC file of a model (v1, v2...). Parsed once, immutable. | `ModelVersion` |
| Discipline | What a model covers; drives default ownership in federation. | `Model.discipline` |
| Scope rules | Per model include/exclude filters ("ignore furniture from this model"). | `Model.scope` (engine `ModelScope`) |
| Input check | The parse job's report on a model version: element counts, verification checks, problems. | `ModelVersion.summary`, `checks` |
| BoQ | A bill of quantities document in a project, built from chosen model versions and presets. Has revisions. | `Boq` |
| Revision | Internal name of a BoQ version: the working version (`draft`) or a saved version (`issued`, labelled A, B…). Review states only with approval on. A saved version is locked forever. | `BoqRevision` |
| Inputs | What a revision is generated from: model versions (with discipline and scope), rule set version, classification versions, dictionary versions. | `BoqRevision.inputs` |
| Run | One execution of the engine for a revision's inputs + decisions + adjustments. Immutable. The revision points at its current run. | `Run` |
| Snapshot | The exact, flattened preset documents a run used, stored with the run. Editing the Library never changes past runs. | `Run.snapshot` |
| Line | One BoQ row: description, unit, quantity, source, codes, location, trace. | engine `BoqLine` |
| Line key | A line's identity: rule id + split values. Stable across runs while the rule set is unchanged; used to match lines between revisions. | `BoqLine.key` |
| Source | Where a line's quantity comes from: measured, derived, manual, flagged. | `BoqLine.source` |
| Trace | Why a line has its number: formula, parameter values, each element's share. | `BoqLine.trace` |
| Question | Something the engine needs a person to decide. Blocking or informative. Deterministic id. | engine `Question` |
| Decision | A stored answer to a question, at project level (or promoted to the org). Re-applied on every run. | `Decision` |
| Promote | Turn a project name answer into an entry in the org's company dictionary. Needs library-editor rights. | action |
| Line edit (override) | A user change to one line: quantity, description, unit, section (code), position, or exclusion. Kept across runs and model versions, always shown as an edit. | `LineOverride` |
| Manual line | A BoQ line with no model behind it (preliminaries, provisional sums, lump sums), added in the sheet. | `ManualItem` (engine rule) |
| Item number | A code in a classification as the firm uses it in its BoQs ("05.03"). | `Code.code` |
| Item text | The written description of a BoQ item that is priced ("Laying external walls {thickness} cm thick…"). A template on a code, filled per line by the engine. Shown as the line's description when present. | `Code.description` → `LineCode.text` |
| Line text | The rule set's short label for a line ("Wall, Exterior - Brick on Block, 417 mm"). Shown when the line's code has no item text, and always in the line detail as "Measured as". | `BoqLine.description` |
| Setup wizard | The guided first setup of an org's rule set, classification and company dictionary (F16). | `Org.setup` |
| Setup question | A rule-set question the setup wizard asks: every item-switching yes/no question (derived), their follow-ups, and the measuring questions a rule set marks for its setup screens. | `SlotPrompt.setup`, `RuleSet.setupSteps` |
| Share link | A public, read-only, revocable link to a BoQ revision; opens without an account. | `ShareLink` |
| Session | One signed-in device of an account. Only one is active at a time. | `Session` |
| Platform admin | An operator of the product (not a customer) with the admin console. | `User.platformRole` |
| How it is calculated | The plain-words explanation of a line's number, step by step, from the engine's trace. | `BoqLine.trace.steps` |
| Adjustments | A BoQ's overrides and manual lines together. | `Boq.adjustments` |
| Change report | Difference between two runs: lines added / removed / changed, elements added / removed / changed, questions new / resolved. | `RunDiff` |
| Library | The org's presets: rule sets, classifications, dictionaries (and federation/resolution settings). | UI area |
| Preset | One Library document with versions. Kind: `rule_set`, `classification`, `dictionary`, `federation`, `resolution`. | `Preset` |
| Preset version | An immutable published version of a preset, or the one mutable draft. | `PresetVersion` |
| Layer | Where a preset lives: `system` (shipped, read-only), `org`, `project`. | `Preset.layer` |
| Patch | A rule set that extends another and stores only the differences. | engine `RuleSetPatch` |
| Preview | Running a draft preset against a model version without storing a BoQ. | job type `preview` |
| Offer | (Pricing module) A vendor's priced answer to an offer request: rate per line, notes, qualifications. | `Offer`, `OfferLine` (module) |
| Job | A background unit of work (parse, run, preview, diff, export, import). Ends succeeded, failed or cancelled. | `Job` |
| Usage event | A record of metered work (parse, run, preview) for limits and billing. | `UsageEvent` |
| Entitlement | A limit or feature flag the org's plan gives (seats, active projects, max file size...). | `Entitlements` |
| Audit event | Who did what, when, to which entity. Append-only. | `AuditEvent` |
| Working version | The BoQ's always-editable current state (a `draft` revision). | `BoqRevision.status = draft` |
| Saved version | A locked, labelled snapshot of a BoQ (A, B, C…); work continues in a new working version. | `BoqRevision.status = issued` |
| Confirmed BoQ | A BoQ marked as done: read-only until reopened. | `Boq.status = confirmed` |
| Position number | A line's own number inside its section (5.1, 5.2…), automatic, frozen in saved versions. | `RunLine.positionNo` |
| Pricing module | The optional, removable part with vendors, pricebooks, estimates and offer requests (P36). | `modules.pricing` |
| Pricebook | (Pricing module) A firm's or vendor's own list of priced items. | `Pricebook` (module) |
| Estimate | (Pricing module) The firm's priced view of a BoQ, on the Pricing tab. | `Estimate` (module) |
| Remembered match | (Pricing module) A person's pick of a pricebook item for a kind of line, reused next time. | `PriceMatch` (module) |
| Offer request | (Pricing module) A BoQ or part sent to vendors for offers; lines frozen at sending. | `OfferRequest` (module) |
| Extension point | A place in the core where a module adds something (a tab, an action, a nav item) without the core knowing the module. | `04-architecture/modules.md` |
