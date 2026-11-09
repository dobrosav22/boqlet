# F12 Exports

## Formats in v1

| Export | Content | Produced by | Trigger |
|---|---|---|---|
| **BoQ Excel** (per run) | Sheet grouped by a chosen classification: ref, description, unit, quantity, source, notes; subtotals; a "Lines" sheet with every column; a "Trace" sheet (line → elements); a "Questions" sheet; cover sheet: project, BoQ, revision, run time, presets and versions, status (DRAFT watermark unless issued; free-plan watermark per entitlements) | engine `export_xlsx.export` (extended: EN-006) | `POST /runs/{runId}/exports` |
| **Saved version Excel** | Same, with version label, save date, who saved it, note; frozen when saved (BR-25) | engine | at issue |
| **Change report Excel** | Line changes with before/after/Δ/Δ%/causes; element changes | engine | `POST /diffs/{diffId}/export` |
| **Decisions CSV** | Project decisions table | backend | decisions page |
| **Audit CSV** | Filtered audit events | backend | audit page |

## Behaviour

- **Description column:** the line's item text in the export's grouping classification when
  its code has one (P14), else the rule set's line text. Item texts wrap in the cell. The
  "Lines" sheet has both: a column "Measured as" (rule set's line text) and one item-text
  column per classification that has texts.
- **Not in the models** (P15, BR-12): a note above the BoQ table: "Quantities are taken from
  the models only. Work not modelled as objects is included only where derived or added by
  hand (N manual lines)." Translated through the export's message catalogue.

- Exports are **jobs** (`export_xlsx`; modules add their own, e.g. `pricing.*`), usually done in
  seconds. The UI shows a spinner, then downloads via `GET /exports/{exportId}/download`
  (302 to a signed URL). Small CSVs stream directly.
- Every export records `Export {id, kind, subjectId, fileName, storageKey, createdBy, createdAt}`
  and an audit event. Downloads of issued exports are audited too (`export.downloaded`).
- File names: `{projectCode or name}_{boqName}_Rev{label}_{yyyy-mm-dd}.xlsx`, sanitised.
- Locale: number formats and date formats from the project locale. Column headers are
  translated through the export's message catalogue (English in v1, P07).
- Units: as in the run (metric or imperial per project).

## Editing in Excel and importing back (P20)

The BoQ Excel can be edited and uploaded back, so people who prefer Excel lose nothing on the
next revision.

- The BoQ sheet carries each line's key in a hidden, protected column; the workbook is
  otherwise free to edit.
- **Import edits** (BoQ workspace › Exports, draft revisions, estimator+): upload the edited
  file → `import_boq_edits` job (engine, EN-006) → a review list: quantity, description and
  unit changes per line, lines moved to another section (a row moved under another group
  heading or its Ref changed), lines deleted (proposed as exclusions), new rows without a key
  (proposed as manual lines under the group they sit in), rows it couldn't read. The user
  ticks what to apply and gives a reason where F06 §6 requires one. Applied changes become
  line edits and manual lines like any made in the sheet.
- Rate and Amount columns are ignored on import (no prices in the BoQ, P04).
- A file exported from another BoQ, or from a run whose line keys no longer exist, is reported
  line by line ("line not in this BoQ"), never applied blindly.

Pricing module exports (priced BoQ, offer comparison, offer request workbook, pricebook
template) belong to the module (F20 §5); the core export offers module code the BoQ workbook
data through `ExportDataService` and knows nothing about prices.

## Later

GAEB DA XML, ÖNORM A 2063, CSV of lines, IfcCostSchedule, PDF print layout.

## API

`POST /runs/{runId}/exports`, `GET /revisions/{revisionId}/exports`, `GET /exports/{exportId}`,
`GET /exports/{exportId}/download`, `POST /diffs/{diffId}/export`,
`GET /projects/{projectId}/decisions.csv`, `GET /projects/{projectId}/audit.csv`,
`POST /revisions/{revisionId}/edits-import`, `GET /jobs/{jobId}/edits-import-report`,
`POST /boqs/{boqId}/overrides/batch` (apply the reviewed edits).

## Acceptance criteria

- [ ] A Duplex run's Excel opens in Excel and LibreOffice without repair prompts, and its totals match the sheet.
- [ ] With a classification that has item texts, the BoQ sheet's Description column holds the filled texts, and the "Lines" sheet holds both texts.
- [ ] A draft export carries a DRAFT watermark. The issued export doesn't, and is frozen.
- [ ] A Duplex BoQ Excel with one quantity changed, one row moved to another section, one row deleted and one row added imports as exactly one quantity edit, one move, one proposed exclusion and one proposed manual line.
