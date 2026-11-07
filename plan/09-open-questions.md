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
| Q3 | Contractors will price in a portal (or via Excel round-trip) instead of their own sheets | Ask pilot firms' usual bidders; test the bidder page with 3 contractors | Make Excel the primary bidder path; the portal becomes a viewer + upload |
| Q4 | Firms want one BoQ split into packages, not separate BoQs per trade | Interviews | Allow tenders across several BoQs |
| Q5 | Sealed bids by default is right | Interviews (public vs private clients) | Default unsealed; sealed as an option |
| Q6 | Clients (investors) don't need to approve in the app in v1 | Interviews | Add a client approval step after issue (guest action) |
| Q7 | Clarification questions from bidders can stay in email for v1 | Pilot | Add a tender Q&A thread (questions and answers shared with all bidders) |

## Product and engine

| # | Question | Notes |
|---|---|---|
| Q8 | How should unknown local-language names be handled at scale: per-language seed dictionaries, bSDD, or AI suggestions with confirmation? | docs/11 marks this as the main blocker on real files. AI suggestions are out of v1 (03-v1-scope) but may need to come early if Q2 shows many names |
| Q9 | Which first rulebook preset ships beside "As modelled" (e.g. an NRM-style preset written in our own words)? | D33; needs a QS partner and a legal check (docs/08) |
| Q10 | Are MEP models in scope for the first pilots? | Federation runs on MEP untested (docs/11); affects ownership defaults |
| Q11 | Is coordinate alignment needed for v1 pilots (models exported with different origins)? | Out of v1; check pilots' export practice |
| Q12 | Do firms need GAEB / ÖNORM export at launch in DACH? | Excel only in v1 |
| Q13 | Is a per-line rate history (rate library from past offers) the natural next product? | Tender data accumulates; possible "pricing" follow-up (P04) |
| Q14 | Should bidders be able to propose alternative items or quantities? | Today: notes per line + qualifications |
| Q15 | Is the line key stable enough across rule-set edits for change reports that users trust? | Rule-set changes show as remove + add; may need a key-mapping table on rule renames |
| Q22 | Which rule-set questions are the setup wizard's essential ones (F16 step 1)? | A first list of about ten in "As modelled" (EN-011); to be checked with a QS or engineer who has made BoQs by hand, and per market preset (Q9) |
| Q23 | How should "start from your last BoQ" (F16, after v1) match a past BoQ's items to kinds of line: name matching, rules on units, or AI suggestions with confirmation? | Same family as Q8. Only the firm's own documents (BR-53) |
| Q24 | Do firms need item texts in two languages in one BoQ (bilingual tenders)? | P14 stores one text per code; `CodeList.locale` gives its language. A second text would be `Code.titles`-style translations, later |
| Q25 | Is a reminder enough for work not in the models (P15), or do firms want a checklist of typical non-modelled items per market to tick through? | Reminder in v1 (BR-12); a checklist would be data per market, like the rule sets |

## Platform

| # | Question | Owner of the answer |
|---|---|---|
| Q16 | Authentication provider | Owner, at BE-000 (07-backend D1) |
| Q17 | Hosting provider and region | Owner, before staging (D8) |
| Q18 | Plan limits and prices | Owner, before public launch (00-product/05) |
| Q19 | Legal: terms of service, DPA, bidder terms (bidders are not customers) | Owner + lawyer |
| Q20 | Data retention for bidders' offers after org deletion (BR-52) | Owner + lawyer |
| Q21 | Support model for custom presets (service revenue with a QS partner, doc 10) | Owner |

## Planning assumptions

- One frontend owner (the product owner) builds M0–M4. Coding agents help with tasks.
- Backend agents start after the contract and the scenario suites are stable (end of M4).
- Engine tasks EN-001, EN-003, EN-004 and EN-007 are needed for M1. The others can follow.
