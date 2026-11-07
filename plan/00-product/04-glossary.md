# 04 Glossary

Domain terms (BoQ, QS, IFC, preliminaries, formwork, federation...) are explained in
[docs/01-domain-primer.md](../../docs/01-domain-primer.md). Read it first if they are new.
This page defines the **platform terms** used in these specs. Use them exactly in code,
API and UI copy.

| Term | Meaning | Code name |
|---|---|---|
| Organisation (org, tenant) | The firm that owns projects, presets and seats. Billing unit. | `Org` |
| Member | A user who belongs to an org with an org role. Uses a seat. | `Membership` |
| Seat | A paid place for a member. Guests and bidders don't use seats. | entitlement `seats` |
| Guest | An external user added to one project with a narrow role (e.g. client viewing issued BoQs). Not a member, no seat. | `ProjectMember` with role `guest` |
| Bidder | A contractor user invited to price one or more tender packages. Belongs to no org of the tenant. | `BidInvitation`, `Offer` |
| Project | A building or job. Holds models, BoQs, decisions, tenders. | `Project` |
| Model | One discipline's model in a project (Architecture, Structure, MEP...). Has versions. | `Model` |
| Model version | One uploaded IFC file of a model (v1, v2...). Parsed once, immutable. | `ModelVersion` |
| Discipline | What a model covers; drives default ownership in federation. | `Model.discipline` |
| Scope rules | Per model include/exclude filters ("ignore furniture from this model"). | `Model.scope` (engine `ModelScope`) |
| Input check | The parse job's report on a model version: element counts, verification checks, problems. | `ModelVersion.summary`, `checks` |
| BoQ | A bill of quantities document in a project, built from chosen model versions and presets. Has revisions. | `Boq` |
| Revision | One numbered state of a BoQ (Rev A, Rev B...). Goes draft → in review → approved → issued. An issued revision is locked forever. | `BoqRevision` |
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
| Override | A user-set quantity for one line, with a reason, kept across runs. Shown as overridden, never hidden. | `LineOverride` |
| Manual line | A BoQ line with no model behind it (preliminaries, provisional sums, lump sums), added in the sheet. | `ManualItem` (engine rule) |
| Item number | A code in a classification as the firm uses it in its BoQs ("05.03"). | `Code.code` |
| Item text | The written description of a BoQ item that bidders price ("Laying external walls {thickness} cm thick…"). A template on a code, filled per line by the engine. Shown as the line's description when present. | `Code.description` → `LineCode.text` |
| Line text | The rule set's short label for a line ("Wall, Exterior - Brick on Block, 417 mm"). Shown when the line's code has no item text, and always in the line detail as "Measured as". | `BoqLine.description` |
| Setup wizard | The guided first setup of an org's rule set, classification and company dictionary (F16). | `Org.setup` |
| Setup question | A rule-set question the setup wizard asks, marked in the rule set. | `SlotPrompt.setup` |
| Adjustments | A BoQ's overrides and manual lines together. | `Boq.adjustments` |
| Change report | Difference between two runs: lines added / removed / changed, elements added / removed / changed, questions new / resolved. | `RunDiff` |
| Library | The org's presets: rule sets, classifications, dictionaries (and federation/resolution settings). | UI area |
| Preset | One Library document with versions. Kind: `rule_set`, `classification`, `dictionary`, `federation`, `resolution`. | `Preset` |
| Preset version | An immutable published version of a preset, or the one mutable draft. | `PresetVersion` |
| Layer | Where a preset lives: `system` (shipped, read-only), `org`, `project`. | `Preset.layer` |
| Patch | A rule set that extends another and stores only the differences. | engine `RuleSetPatch` |
| Preview | Running a draft preset against a model version without storing a BoQ. | job type `preview` |
| Tender | A request for prices on an issued revision, with a deadline. | `Tender` |
| Package | A subset of the revision's lines sent to a group of bidders (e.g. "Concrete works"). | `TenderPackage` |
| Package line | A frozen copy of a BoQ line inside a package (description, unit, quantity, code). | `PackageLine` |
| Invitation | A bidder's invitation to a package. | `BidInvitation` |
| Offer | A bidder's priced response to a package: rate per line, notes, qualifications. | `Offer`, `OfferLine` |
| Addendum | A change to a tender after it opened (e.g. a new revision issued). Bidders must resubmit affected packages. | `TenderAddendum` |
| Sealed | Offer amounts stay hidden from the firm until the deadline. | `Tender.sealed` |
| Award | Choosing one offer per package. | `TenderPackage.awardedOfferId` |
| Job | A background unit of work (parse, run, preview, diff, export, import). Ends succeeded, failed or cancelled. | `Job` |
| Usage event | A record of metered work (parse, run, preview) for limits and billing. | `UsageEvent` |
| Entitlement | A limit or feature flag the org's plan gives (seats, active projects, max file size...). | `Entitlements` |
| Audit event | Who did what, when, to which entity. Append-only. | `AuditEvent` |
