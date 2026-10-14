# Documentation

Written for the next developer or AI agent picking this up without the original conversation.
Everything decided between 1 Aug and 9 Oct 2026 is here: the domain, the reasoning, the design,
what is built, what is not, and the open questions.

## Reading order

| # | File | Read it when |
|---|---|---|
| 00 | [00-overview.md](00-overview.md) | First. What the product is, what this repo does today, how to run it. |
| 01 | [01-domain-primer.md](01-domain-primer.md) | You are new to construction cost work. Glossary, how BoQs work, the six knobs. |
| 02 | [02-decisions.md](02-decisions.md) | You want to know why. Every decision, dated, with status. |
| 03 | [03-architecture.md](03-architecture.md) | You are changing how pieces talk: today's dev setup and the target platform. |
| 04 | [04-types-and-contracts.md](04-types-and-contracts.md) | You are touching any shape: the type files, schemas, HTTP API. |
| 05 | [05-engine.md](05-engine.md) | You are changing the Python engine: stages, adoption policy, expressions, questions, log. |
| 06 | [06-rules-authoring.md](06-rules-authoring.md) | You are writing or changing a rule set, or adding a rule-language feature. |
| 07 | [07-dictionaries-and-classification.md](07-dictionaries-and-classification.md) | Names to terms, code lists, maps. |
| 08 | [08-knowledge-gaps-and-sourcing.md](08-knowledge-gaps-and-sourcing.md) | Where rules and code lists come from, and what licences allow. |
| 09 | [09-validation-and-test-corpus.md](09-validation-and-test-corpus.md) | Proving the engine is right: the Duplex findings, acceptance numbers, the file corpus plan. |
| 10 | [10-platform.md](10-platform.md) | Building the product around the engine: data model, federation, roles, jobs, pricing. |
| 11 | [11-roadmap-and-open-questions.md](11-roadmap-and-open-questions.md) | Deciding what to do next. Known limitations, gaps, open questions. |
| 12 | [12-ifc-corpus-catalogue.md](12-ifc-corpus-catalogue.md) | Which public IFC files exist, what each is (schema, tool, version, discipline), which ones the engine was run on, and what is still uncovered. Generated from `fixtures/corpus/catalogue.json`. |
| 13 | [13-measurement-standards.md](13-measurement-standards.md) | You need to know which measurement standards exist worldwide and how much of our rule template each one covers (whole building, per trade, civil, areas only). |
| 14 | [14-rules-guide.md](14-rules-guide.md) | You use the app and want to make or change a rule set: the tabs, step by step, formulas, common tasks, what to do when something looks wrong. |
| 15 | [15-classifications-guide.md](15-classifications-guide.md) | You use the app and want to make or change a classification: how a line gets its code, the tabs, importing a code list, common tasks, what to do when something looks wrong. |
| 16 | [16-dictionaries-guide.md](16-dictionaries-guide.md) | You use the app and want to teach it what names in models mean: layers, Names in the model, patterns, meanings, values read from names, common tasks. |
| 17 | [17-deploying-a-demo.md](17-deploying-a-demo.md) | You want to put the dev build on Vercel for an internal demo: what is deployed, how, and what the demo cannot do. |

## Reference material (`reference/`)

Primary sources, kept verbatim so nothing is lost. The numbered docs above summarise and
organise them; when they disagree, the numbered docs are newer.

| Path | What it is |
|---|---|
| `reference/knowledge-base-2026-10-03.md` | The consolidated 16-section knowledge base written on 3 Oct 2026, before the rule type and the engine were built. The most complete single account of the domain, gaps, sourcing and platform. |
| `reference/conversation/part1..part4` | The original conversation, turn by turn: every question and every answer's prose, verbatim (tool calls and code omitted). Use it to check what was actually said. |
| `reference/files/*.docx, *.xlsx` | Documents produced during the conversation: the six knowledge gaps, the remaining gaps, sourcing of rulebooks and classifications, the rulebook/classification and dictionary/item-library spreadsheets, the test corpus plan. |
| `reference/prototype-2026-10/*.py` | The first prototype pipeline that produced the hand-made Duplex BoQ (extract, overlap check, classify, build Excel). Superseded by `engine/`, kept for comparison. Its output is `fixtures/reference/duplex-hand-boq.xlsx`. |

## Conventions in these docs

- "Engine" means the Python package in `engine/ifc_boq`. "Contract" means `packages/types`.
- Code paths are relative to the repository root.
- Values in presets and examples are illustrative placeholders, never taken from a licensed standard.
- Prices, market shares and licence terms were checked in early October 2026 and will age.
