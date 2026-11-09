# Open questions and assumptions to validate

What the plan assumes but nobody has confirmed with real users. Each item has a way to find
out and what changes if the assumption is wrong. The owner decides when each is closed. Product
questions from `docs/11` that this plan answers are marked there by P-decisions in
`plan/README.md`.

## Users and market (highest risk)

| # | Assumption | How to validate | If wrong |
|---|---|---|---|
| Q1 | Design and engineering firms in design-led markets produce tender BoQs themselves and would pay per seat for this (P01) | Interview 5–10 firms (architects, structural/MEP engineers) in 2–3 countries; show the Duplex demo | Lead with QS firms; onboarding and wording change, flows don't |
| Q2 | Their models are good enough that most quantities come from them | Run pilot firms' real models through `npm run corpus` before selling; measure % of lines measured/derived vs flagged | Invest in question UX and dictionaries (Q8) before features |
| Q3 | (Pricing module) Vendors will keep a pricebook in the app and answer offer requests from it, instead of their own sheets | Ask pilot firms' usual vendors; test the vendor pages with 3 contractors | Make Excel the primary vendor path; the portal becomes a viewer + upload |
| Q4 | ~~Firms want one BoQ split into packages~~ | Closed by P34: no packages; offer requests on any selection | — |
| Q5 | ~~Sealed bids by default~~ | Closed by P34: no sealed bids | — |
| Q6 | ~~Clients approve in the app~~ | Closed by P28: clients get share links, no accounts | — |
| Q7 | (Pricing module) Vendors' clarification questions can stay in email | Pilot | Add a message thread per offer request |

## Product and engine

| # | Question | Notes |
|---|---|---|
| Q8 | How should unknown local-language names be handled at scale: per-language seed dictionaries, bSDD, or AI suggestions with confirmation? | docs/11 marks this as the main blocker on real files. AI suggestions are out of v1 (03-v1-scope) but may need to come early if Q2 shows many names |
| Q9 | Which first rulebook preset ships beside "As modelled" (e.g. an NRM-style preset written in our own words)? | D33; needs a QS partner and a legal check (docs/08) |
| Q10 | Are MEP models in scope for the first pilots? | Federation runs on MEP untested (docs/11); affects ownership defaults |
| Q11 | Is coordinate alignment needed for v1 pilots (models exported with different origins)? | Out of v1; check pilots' export practice |
| Q12 | Do firms need GAEB / ÖNORM export at launch in DACH? | Excel only in v1 |
| Q13 | (Pricing module) Should offers a firm receives feed its own pricebook ("save these rates as our prices")? | Pricebooks are the core (P33); offers already flow into estimates |
| Q14 | (Pricing module) Should vendors be able to propose alternative items or quantities? | Today: notes per line + qualifications |
| Q15 | Is the line key stable enough across rule-set edits for change reports that users trust? | Rule-set changes show as remove + add; may need a key-mapping table on rule renames |
| Q22 | Which rule-set questions are the setup wizard's essential ones (F16 step 1)? | A first list of about ten in "As modelled" (EN-011); to be checked with a QS or engineer who has made BoQs by hand, and per market preset (Q9) |
| Q23 | How should "start from your last BoQ" (F16, after v1) match a past BoQ's items to kinds of line: name matching, rules on units, or AI suggestions with confirmation? | Same family as Q8. Only the firm's own documents (BR-53) |
| Q24 | Do firms need item texts in two languages in one BoQ (bilingual tenders)? | P14 stores one text per code; `CodeList.locale` gives its language. A second text would be `Code.titles`-style translations, later |
| Q25 | Is a reminder enough for work not in the models (P15), or do firms want a checklist of typical non-modelled items per market to tick through? | Reminder in v1 (BR-12); a checklist would be data per market, like the rule sets |
| Q26 | What are the paid tiers priced on: active projects, seats, or both (P17)? And what does the default tier include? | Entitlements support any combination; decide before public launch, with Q18 |
| Q27 | Single session (P22): is 12 h idle the right expiry, and should one person be allowed a phone and a laptop at once later (a "same person, second device" allowance)? | v1: strictly one; watch support requests |
| Q28 | Should platform admins ever see project content for support, and how is it granted (owner grants time-limited access, audited)? | v1: metadata only (BR-57) |
| Q29 | (Pricing module) Do vendors need company accounts (several people pricing for one vendor, shared offers)? | v1: one person per vendor account; the firm can invite colleagues of a vendor separately |
| Q30 | Should a share link be able to carry the estimate (pricing module) for a client? | v1: never prices (BR-56); would be a module extension of the share page |
| Q32 | (Pricing module) Should vendors' remembered matches be keyed by the firm's item numbers (as planned) or by the line text, when firms renumber their code lists? | Planned: item number + unit, text when no number (F20 §3) |
| Q31 | Is one monospace font readable enough for long item texts in every target language, or should prose blocks use a proportional companion font? | Test with real item texts in the wizard usability test (v1 criterion 12) |

## Platform

| # | Question | Owner of the answer |
|---|---|---|
| Q16 | Authentication provider | Owner, at BE-000 (07-backend D1) |
| Q17 | Hosting provider and region | Owner, before staging (D8) |
| Q18 | Plan limits and prices | Owner, before public launch (00-product/05) |
| Q19 | Legal: terms of service, DPA, vendor terms (vendors are not customers) | Owner + lawyer |
| Q20 | Data retention for vendors' offers after org deletion (BR-52) | Owner + lawyer |
| Q21 | Support model for custom presets (service revenue with a QS partner, doc 10) | Owner |

## Planning assumptions

- One frontend owner (the product owner) builds M0–M4. Coding agents help with tasks.
- Backend agents start after the contract and the scenario suites are stable (end of M4).
- Engine tasks EN-001, EN-003, EN-004 and EN-007 are needed for M1. The others can follow.
