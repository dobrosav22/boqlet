# F06 BoQ sheet

## Purpose

The working view of a BoQ: every line, grouped and subtotalled by any attached code system,
traceable to its elements and formula, adjustable with manual lines and overrides.

## Layout (BoQ workspace)

```text
┌ Project / BoQ name · Rev B (draft) · run 14:02 · 412 lines · 3 flagged ───── [Generate] [Submit] ┐
│ Tabs: Sheet | Questions (7) | Viewer | Changes | Log | Setup | Exports                              │
├──────────────────────────────────────────────────────────────┬─────────────────────────────────────┤
│ Group by [ACME cost codes ▾]  Filter [source ▾][storey ▾][family ▾][search…]   Columns ▾          │
│ Ref      Description                          Unit    Qty      Source  Storey   │ Line detail      │
│ ▸ 2 Superstructure                                             subtotal …       │ formula          │
│   2.5  External walls                                                            │ params           │
│     2.5.1  Cavity wall, brick on block 290    m²     412.60   measured  L1      │ elements (n)     │
│     2.5.2  Formwork to walls                  m²     825.20   derived           │ codes per system │
│ ▸ 9 Preliminaries                                                                │ notes, override  │
│     9.1    Site setup                         item     1      manual             │ [Show in 3D]     │
└──────────────────────────────────────────────────────────────┴─────────────────────────────────────┘
```

## Behaviour

1. **Data:** `GET /runs/{runId}/lines` returns lines with `codes`, `location`, `source`,
   `overridden`. The sheet groups client-side by the chosen system's `codes[system].path`
   (paging with server-side grouping only when lines > 20,000, see NFR). Lines without a code
   in the chosen system go to an "Unclassified" group at the end. They are never hidden (BR-03).
2. **Columns:** Ref (code), Description, Unit, Quantity, Source, Storey, Family, Tags, Notes,
   and one column per extra classification (toggleable). Units are displayed with superscripts
   (m² m³), and numbers use the project locale and the rule set's rounding (already applied by
   the engine). Quantity of flagged lines shows "—" with the reason.
3. **Subtotals:** per group, the count of lines and (only when all lines in a group share one
   unit) the sum of quantities. No money in the sheet (P04; amounts live in tenders).
4. **Filters:** source (measured, derived, manual, flagged, overridden), storey, family, model,
   text search over description and code. Filters never change the data, and the header shows
   "Filtered: 37 of 412 lines".
5. **Line detail panel** (`GET /runs/{runId}/lines/by-key?key=`): description, unit,
   quantity, source; the **trace**: formula in readable form (reuse `apps/web/src/library/readable.ts`),
   parameter values, elements table (GlobalId, name, model, share of quantity, note), source
   line for derived lines (clickable); codes in every system with their source (map rule,
   decision, IFC, default); location; notes; log entries for this line (filtered log).
   "Show in 3D" selects the line's elements in the viewer (F07).
6. **Override** (draft revisions, estimator+): "Override quantity" on a line → new quantity (or
   "mark as flagged") + reason (required). Saved as `LineOverride` on the BoQ
   (`POST /boqs/{boqId}/overrides`). It shows at once as a pending change, and applies on
   the next run. Overridden lines show the engine value struck through and the override, with
   a badge and the reason on hover. "Remove override" deletes it.
7. **Manual lines** (draft, estimator+): "Add line" at the end of any group, or a toolbar
   button: description, unit, quantity (or a formula over `building.*`, validated by the
   engine through `POST /presets/check`), code per classification (prefilled with the group
   the user clicked), notes. Saved as `ManualItem` (`POST /boqs/{boqId}/manual-items`), applied on
   the next run as an engine manual item, so it is coded, logged and exported like any line.
   Edit and delete in place.
8. **Warnings** bar above the sheet: run warnings (e.g. models don't overlap in space, missing
   meshes), collapsible, each with affected elements.
9. **Log tab:** `GET /runs/{runId}/log` paged, filter by stage, level, rule, line key, element
   GlobalId. Reuse `apps/web/src/components/LogView.tsx` behaviour.
10. **Keyboard:** arrow keys move the selection, Enter opens detail, `/` focuses search.
    Selection is shared with the viewer.
11. **Read-only modes:** issued revisions, and users without edit rights, see the sheet with no
    override or add actions. Viewers and guests see issued revisions only.

## Edge cases

- 20k+ lines (large federated models): virtualised rows, grouping on the server
  (`GET /runs/{runId}/lines?groupBy=system&level=2` returns group rows with counts), lazy
  loading of children.
- A manual line coded to a code that no longer exists in a new classification version: it
  lands in "Unclassified", and an `unclassified` question appears if the map says so.
- Override on a derived line whose source line changes: the override still wins, and the
  change report lists `override_changed`/`rules_changed` causes.

## API

`GET /runs/{runId}/lines`, `GET /runs/{runId}/lines/by-key`, `GET /runs/{runId}/warnings`,
`GET /runs/{runId}/log`, `GET /boqs/{boqId}/overrides`, `POST /boqs/{boqId}/overrides`,
`DELETE /overrides/{overrideId}`, `GET /boqs/{boqId}/manual-items`,
`POST /boqs/{boqId}/manual-items`, `PATCH /manual-items/{itemId}`,
`DELETE /manual-items/{itemId}`, `POST /presets/check`.

## Acceptance criteria

- [ ] Switching "Group by" between two attached classifications regroups instantly (no request) and keeps every line visible.
- [ ] Every line's detail shows formula, parameters and element shares that sum to the line quantity (within rounding).
- [ ] An override survives regeneration and a new model version, and appears in the Excel export with its reason.
- [ ] A manual line added under group "9 Preliminaries" appears there after regeneration, with the code of that group.
- [ ] The sheet scrolls smoothly at 20,000 lines (60 fps target on a mid-range laptop; measured in a perf test).
