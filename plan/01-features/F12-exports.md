# F12 Exports

## Formats in v1

| Export | Content | Produced by | Trigger |
|---|---|---|---|
| **BoQ Excel** (per run) | Sheet grouped by a chosen classification: ref, description, unit, quantity, source, notes; subtotals; a "Lines" sheet with every column; a "Trace" sheet (line → elements); a "Questions" sheet; cover sheet: project, BoQ, revision, run time, presets and versions, status (DRAFT watermark unless issued; free-plan watermark per entitlements) | engine `export_xlsx.export` (extended: EN-006) | `POST /runs/{runId}/exports` |
| **Issued BoQ Excel** | Same, with revision label, issue date, issuer, issue note; frozen at issue (BR-25) | engine | at issue |
| **Change report Excel** | Line changes with before/after/Δ/Δ%/causes; element changes | engine | `POST /diffs/{diffId}/export` |
| **Package Excel** (bidder) | Firm, tender, package, deadline; lines with hidden line ids, protected cells except rate and note columns; totals as formulas for convenience (backend recomputes on import) | engine (EN-006) or backend (Apache POI); see 07-backend | bidder download |
| **Comparison Excel** | Lines × bidders: rate, amount; lowest, median; flags as cell colours; totals; qualifications sheet | backend or engine | `POST /packages/{packageId}/comparison/export` |
| **Decisions CSV** | Project decisions table | backend | decisions page |
| **Audit CSV** | Filtered audit events | backend | audit page |

## Behaviour

- Exports are **jobs** (`export_xlsx`, `export_package`, `export_comparison`), usually done in
  seconds. The UI shows a spinner, then downloads via `GET /exports/{exportId}/download`
  (302 to a signed URL). Small CSVs stream directly.
- Every export records `Export {id, kind, subjectId, fileName, storageKey, createdBy, createdAt}`
  and an audit event. Downloads of issued exports are audited too (`export.downloaded`).
- File names: `{projectCode or name}_{boqName}_Rev{label}_{yyyy-mm-dd}.xlsx`, sanitised.
- Locale: number formats and date formats from the project locale. Column headers are
  translated through the export's message catalogue (English in v1, P07).
- Units: as in the run (metric or imperial per project).

## Later

GAEB DA XML, ÖNORM A 2063, CSV of lines, IfcCostSchedule, PDF print layout.

## API

`POST /runs/{runId}/exports`, `GET /revisions/{revisionId}/exports`, `GET /exports/{exportId}`,
`GET /exports/{exportId}/download`, `POST /diffs/{diffId}/export`,
`POST /packages/{packageId}/comparison/export`, `GET /bids/{invitationId}/package.xlsx`,
`GET /projects/{projectId}/decisions.csv`, `GET /projects/{projectId}/audit.csv`.

## Acceptance criteria

- [ ] A Duplex run's Excel opens in Excel and LibreOffice without repair prompts, and its totals match the sheet.
- [ ] A draft export carries a DRAFT watermark. The issued export doesn't, and is frozen.
- [ ] The package Excel round-trips through the bidder import (F11).
