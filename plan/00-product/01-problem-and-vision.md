# 01 Problem and vision

## The problem

Every building that goes to tender needs a **bill of quantities** (BoQ): every piece of work,
measured, described and coded so contractors can price it. Today that list is mostly made by
hand.

1. **Take-off is manual and slow.** Someone measures walls, slabs, doors and finishes from
   drawings or by reading model schedules into Excel. A medium building takes days to weeks.
2. **Every design change means doing it again.** Models are revised many times before tender.
   Each revision means re-measuring and finding by hand what changed.
3. **The numbers are not traceable.** A spreadsheet cell says "412.6 m²", with no link to the
   walls behind it or the rule that produced it. Reviewers can't check it quickly, and errors
   surface on site, where they are expensive.
4. **Every firm, client and country measures differently.** Opening deductions, units per
   item, what counts as a separate item, how lines are coded and grouped. Tools that do
   model-based take-off (CostX, RIB iTWO, Revit schedules) are rigid, expensive, tied to one
   vendor, or not built for BoQs at all.
5. **Tendering runs on email and Excel.** The BoQ is split into trade packages by hand, sent to
   contractors as spreadsheets, returned in inconsistent formats and compared by copy-paste.

## The product

A web application where the firm that produces the BoQ:

1. **Uploads its IFC models** (architecture, structure, MEP; any authoring tool) as versions.
2. **Gets a measured, coded, traceable BoQ in minutes**, under the firm's own measuring rules,
   code lists and naming conventions. Every number links to the elements, the formula and the
   parameter values behind it.
3. **Answers the questions the engine cannot answer alone.** Unknown material names, missing
   data, elements no rule measures. The answers are kept and never asked again.
4. **Re-runs on each new model version** and sees what changed, line by line.
5. **Reviews, approves and issues** the BoQ. Issued revisions are locked.
6. **Tenders it.** Packages go to invited contractors, who price the lines in the browser. The
   firm compares offers side by side and awards.

The engine that does steps 2–4 exists and is proven (see `docs/00-overview.md`). The product is
everything around it.

## Why this wins

| Strength | Why it matters | Where it comes from |
|---|---|---|
| **Rules are data the firm owns** | Any standard, client rulebook or house style is a preset, not a feature request | Rule language with slots, formulas, patches (docs/06) |
| **Measure once, view many ways** | Switch code system or grouping without recomputing; compare presets in seconds | Classification never changes numbers (D14) |
| **Every number is traceable** | Reviewers check lines in seconds; trust is earned, not claimed | Line traces and calculation log (D26) |
| **Nothing silently dropped** | A missing line in a tender is the worst outcome; we flag instead | Four quantity sources, questions (D06) |
| **Revisions are cheap** | Re-run in seconds, carry answers over, show what changed | Cached parse, deterministic question ids (D16, D19) |
| **Quantities to offers in one place** | No re-keying between BoQ, tender and comparison | Tendering (P04) |
| **IFC from any tool** | No vendor lock-in for design firms on mixed tool stacks | Tested on 309 files from 30 tools (docs/12) |

## What the product is not

- **Not a certified BoQ.** Output is a draft that a qualified person approves and issues (D07).
- **Not a rate database or estimating tool.** Prices come from bidders' offers (P04).
- **Not a model editor.** The model is never changed. Answers live beside it (D18).
- **Not a source of licensed standards.** We ship no DIN, VOB, CSI or other restricted content.
  Firms build presets from their own licensed copies (D30–D32).

## Success measures (to instrument from day one)

| Measure | Target for pilot customers |
|---|---|
| Time from first upload to first issued BoQ revision on a medium project | < 1 working day |
| Time to re-issue after a new model version | < 1 hour |
| Share of BoQ lines with a quantity from the model (measured or derived) | Reported per project; baseline to establish in pilots |
| Questions per new model version after the first | Falls with every version (answers carried over) |
| Tender packages sent and compared in-app instead of by email | > 50% of tenders at pilot firms |
