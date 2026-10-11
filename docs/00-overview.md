# 00 Overview

## The product in two sentences

It reads a building's 3D model file and automatically produces a bill of quantities: every
material and piece of work, measured and organised the way your country, client or company
requires. It asks you about anything it can't work out, so you end up with a complete,
traceable list ready for pricing.

## The idea in one paragraph

An IFC file holds geometry and properties, not measurement rules. The engine reads the file,
verifies what the authoring tool claims against the actual geometry, resolves messy names
through dictionaries, measures every element once, then executes a **rule set** (how to
measure) and any number of **classifications** (how to code and group) chosen by the user. It
asks about anything missing or unclear, and outputs a traceable BoQ. Every quantity is
measured, derived from a proxy, entered manually, or flagged as unknown; nothing is silently
dropped. Rules live in data, so a new standard or a company's own conventions are a new preset,
not new code. The engine does not care whether a rule set came from a national standard, a
client or a firm's own invention.

```
getBoq(models, rules, classifications, dictionaries, decisions) -> BoqResult
          (1)     (2)        (3)             (4)          (5)
```

| Input | Decides | Changes numbers? |
|---|---|---|
| 1 Models | What is being measured (IFC files) | Yes (it is the data) |
| 2 Rules | How elements become BoQ lines: which quantity, unit, deductions, splits | Yes |
| 3 Classifications | Which codes and groups each line gets (any number of systems) | Never |
| 4 Dictionaries | What messy names mean ("BETON", "C25/30" -> concrete) | Indirectly (rules match on terms) |
| 5 Decisions | The user's answers to the engine's questions, filling gaps in 1-4 | Yes |

## Who it is for

Not decided (see open questions). Candidates: quantity surveying (QS) firms (daily use),
contractors pricing tenders (bursts), designers checking costs (light use). The product is
international: no country's standard is the default.

## What this repository does today

A development build that proves the engine on a real file and lets developers poke at it.

- **Web app** (`apps/web`, React 18 + Vite): drop an IFC, choose a rule set, classifications
  and dictionaries, generate, then inspect: the BoQ as a ruled sheet, each line's formula and
  element contributions, the full calculation log, questions with answer controls, the inputs
  as JSON, and a side-by-side comparison of two runs. Download the Excel BoQ.
- **Engine** (`engine/ifc_boq`, Python): parse IFC to a cached `ParsedModel`, verify it,
  resolve names, measure, run rules, classify, ask questions, log every step, export Excel.
  Served locally by FastAPI on port 8787, and usable from the command line.
- **Contract** (`packages/types`): every data shape as TypeScript, with JSON Schemas generated
  from it that the engine validates against.
- **Presets** (`presets/`): five rule sets, three dictionaries, three classifications
  (one needs a one-command download), resolution settings.
- **Tests**: 83 engine tests including the Duplex acceptance test, which checks that the
  "as modelled" rule set reproduces the hand-made BoQ exactly.

### Measured on the Duplex (2.4 MB, 218 elements)

| Step | Time |
|---|---|
| First upload (parse, geometry, verification) | about 5 s, then cached by file hash |
| Each generate (names, measure, rules, classify, log) | under 0.2 s |
| Output (as modelled + ACME codes) | 41 lines (3 flagged manual items); 150 of 218 elements measured, 7 covered by their parent (roof slab, stair flights), 61 furniture items excluded because the furniture rule is disabled by a slot; 0 unmatched; about 620 log entries |

## How to run

See the root `README.md` (people) and `CLAUDE.md` (agents). Short version:

```bash
npm install && npm run dev      # http://localhost:5173
npm run test                    # typecheck + engine tests
```

Ports: web 5173 (Vite, proxies `/api`), engine 127.0.0.1:8787 (FastAPI, auto-reload).
Engine data: uploaded models and runs are stored in `engine/.cache/` (safe to delete).

## Status

| Area | State |
|---|---|
| Parse + verify IFC2x3 (Revit) | Working, tested on one file |
| IFC4 / other authoring tools | Written to be general; untested |
| Dictionaries (layers, extractors, term hierarchy) | Working; AI suggestions not built |
| Measuring (adoption policy) | Working; per-face areas approximated |
| Rule language (items, derived, manual, slots, patches, expressions) | Working; `embedded`/`recesses` deductions ignored |
| Classification (multiple systems, maps, lookups, fromSource) | Working |
| Questions and decisions | unknown_name, missing_data, unmatched, unclassified, classification_conflict. Overlap and contradiction questions not yet raised (they appear as checks). |
| Calculation log + line traces | Working |
| Excel export | Working |
| Multiple models per BoQ (federation, scope rules) | Not built |
| Model revisions, carrying decisions over | Decisions are keyed to be stable; revision diff not built |
| Users, projects, jobs, Java backend | Not built (designed, see 10-platform.md) |

## Glossary pointer

If BoQ, QS, IFC, preliminaries or provisional sum are unfamiliar, read
`01-domain-primer.md` before anything else.
