# F06 BoQ sheet

## Purpose

The working view of a BoQ: every line, grouped and subtotalled by any attached code system,
traceable to its elements and formula, and fully editable: any line's quantity, text, unit,
section and position can be changed, lines added or excluded (P20). Edits are kept across
regenerations and new model versions, and are always visible as edits (BR-09).

## Layout (BoQ workspace)

```text
┌ Project / BoQ name · Working (last saved B) · run 14:02 · 412 lines · 3 flagged ─ [Generate] [Save version] ┐
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
2. **Columns:** No. (position number, §13), Item (code in the "Group by" system), Description, Unit, Quantity, Source, Storey, Family, Tags, Notes,
   and one column per extra classification (toggleable). Units are displayed with superscripts
   (m² m³), and numbers use the project locale and the rule set's rounding (already applied by
   the engine). Quantity of flagged lines shows "—" with the reason.
   **Description** shows the line's **item text** in the "Group by" system
   (`codes[system].text`, P14, EN-010) when that code has one, else the rule set's line text
   (`description`). Switching "Group by" switches the texts with the grouping, client-side,
   because every line carries the filled text of each of its codes. Long item texts wrap,
   clamped to three lines in the row and shown in full in the line detail.
3. **Subtotals:** per group, the count of lines and (only when all lines in a group share one
   unit) the sum of quantities. No money in the sheet: prices live only in the optional pricing
   module's own Pricing tab (P32, F20).
4. **Filters:** source (measured, derived, manual, flagged, overridden), storey, family, model,
   text search over description and code. Filters never change the data, and the header shows
   "Filtered: 37 of 412 lines".
5. **Line detail panel** (`GET /runs/{runId}/lines/by-key?key=`): the item text in full,
   with the rule set's line text under it as "Measured as: Wall, Exterior - Brick on Block,
   417 mm" (so the user always sees what was measured), unit, quantity, source; the **trace**: formula in readable form (reuse `apps/web/src/library/readable.ts`),
   parameter values, elements table (GlobalId, name, model, share of quantity, note), source
   line for derived lines (clickable); codes in every system with their source (map rule,
   decision, IFC, default); location; notes; log entries for this line (filtered log).
   "Show in 3D" selects the line's elements in the viewer (F07).
   **How it is calculated** (P25, a main selling point): the top of the detail answers the
   question in plain words before any formula, built from the engine's structured trace
   steps (EN-013) with the PoC's readable-formula and item-sentence code:
   *"Area of both faces of 12 walls of type 'Exterior - Brick on Block' = 312.40 m². Minus 8
   openings larger than 0.5 m² (rule set answer 'Wall opening size limit') = −45.24 m².
   Result 267.16 m²."* Each step can be expanded to its elements; each rule-set value links to
   the Settings question it came from ("Your answer: 0.5 m²" → the Library); a derived line
   shows its chain ("Formwork = 2 × wall area of line 2.5.1" → that line); an edited line
   shows the engine's value, the edit, who and why. The formula in readable form, the
   parameters and the elements table stay below for checking. The same explanation is in the
   Excel "Calculation" sheet (F12) and in share links (F18).
6. **Line edits** (draft revisions, estimator+, P20). The sheet is edited like a spreadsheet:
   - **Overwrite** a cell: quantity (or "mark as flagged"), description (the item text or line
     text), unit. Changing the unit needs a new quantity too (`409 unit_needs_quantity`): a
     number in m² doesn't become m³ by relabelling.
   - **Move** a line to another section: drag it onto a group row, or change its Ref to another
     code of the "Group by" system. The move is the line's code in that system; other
     systems keep theirs.
   - **Reorder** lines within a section by dragging. Order is presentation only.
   - **Exclude** a line: it leaves the totals and the exports' BoQ sheet, but stays in the sheet
     struck through under the "Excluded" filter, and in an "Excluded lines" sheet of the
     Excel (BR-03).
   - **Bulk:** select lines (checkboxes, shift-click, a section, a filter result or elements in
     the 3D view) → move to section, exclude, plus any action a module adds (extension point
     `sheet.selectionActions`; pricing: request offers).
   Every edit of a line is one `LineOverride` (by line key) with the changed fields. A reason
   is required for quantity changes and exclusions, optional for text, unit, moves and order.
   Edits are saved as they are made (`POST /boqs/{boqId}/overrides`), show at once, and apply
   on the next run; quantity edits feed derived lines (formwork follows an edited concrete
   area, EN-003). Edited cells carry a marker; hovering shows the engine's value; "Restore"
   per field or per line removes the edit. The last 20 edits can be undone (Ctrl+Z). Filter
   "Edited" lists them. Edits are carried to new revisions and appear in the change report
   (`override_changed`), the review screen (F09) and the Excel (F12).
7. **Manual lines** (draft, estimator+): "Add line" between any two rows or at the end of any
   group, or a toolbar button: description, unit, quantity (or a formula over `building.*`, validated by the
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
11. **Read-only modes:** saved versions, confirmed BoQs, and users without edit rights, see the sheet with no
    edit actions. Saved versions and confirmed BoQs are read-only for everyone (F09).
12. **Not in the models** (P15, BR-12): the app says plainly that it measures only what the
    models contain, and that the rest is the user's to add:
    - A notice at the top of the sheet, under the header: "This BoQ contains what the models
      contain. Work not modelled as objects (for example earthworks, plaster, screed,
      waterproofing, reinforcement, scaffolding, site setup) is in it only if your rule set
      derives it or you add it. [Add line]". With the counts by source: "120 measured · 8
      derived · 3 manual · 2 to confirm". Collapsible to the counts line per user; never
      removed.
    - The same paragraph is the empty state of a group with no lines and of the "Add line"
      dialog's help.
    - Submitting for review asks for a confirmation (F09 §1).
    - The Excel export carries it as a note (F12).
    The examples come from the message catalogue (EN-004), not from the rule set: they are a
    reminder, not a check. The app does not try to guess what is missing.

13. **Position numbers** (P30, BR-28): every line has its own number inside its section: the
    section's code plus a running number (`5.1`, `5.2`, … or `D.01.1` under a deeper code; the
    separator comes from the code list). Numbers follow the line order (engine order, then
    reorders and moves, F06 §6) and renumber at once in the working version as lines are added,
    moved, reordered or excluded (excluded lines get no number). A saved version freezes them:
    its Excel, share links and (pricing module) offer requests keep those numbers. Lines without
    a code in the grouping system are numbered under "Unclassified" (`0.1`, `0.2`). The backend
    computes them (presentation, BR-01 allows it) and returns them as `positionNo`.
14. **Live co-editing** (P31, BR-29): everyone with the BoQ open sees who else is in it
    (avatars in the header, a coloured marker on the line someone is editing). Each saved edit is
    pushed to the others within a second (SSE `boq.line_edited`) and applied to their sheet
    without a reload; generated runs and saved versions arrive the same way. Two people editing
    the same line: the later save wins, and the earlier editor sees "Ana changed this line just
    now" with her value and an undo for their own. Undo (Ctrl+Z) is per person and only for their
    own edits. Edits to different lines never conflict.

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
`DELETE /manual-items/{itemId}`, `POST /boqs/{boqId}/overrides/batch`, `POST /presets/check`;
share: `POST /boqs/{boqId}/share-links` (F18). Modules add their own actions through extension
points (pricing: offer requests, F11).

## Acceptance criteria

- [ ] Switching "Group by" between two attached classifications regroups instantly (no request) and keeps every line visible.
- [ ] Every line's detail shows formula, parameters and element shares that sum to the line quantity (within rounding).
- [ ] A quantity edit, a text edit, a move to another section, a reorder and an exclusion each survive regeneration and a new model version, and appear in the Excel export (the quantity edit with its reason).
- [ ] Changing a unit without a quantity is refused with the reason shown; Ctrl+Z undoes the last edit.
- [ ] Every line's detail starts with a plain-words "How it is calculated" whose steps add up to the line quantity, with each rule-set value linked to its Settings question.
- [ ] A manual line added under group "9 Preliminaries" appears there after regeneration, with the code of that group.
- [ ] With a classification that has item texts, Description shows the filled item texts; switching "Group by" to a system without texts shows the rule set's line texts; the line detail shows both.
- [ ] The "not in the models" notice and the counts by source are visible on every draft BoQ sheet, and collapsing it is remembered per user.
- [ ] Position numbers renumber at once after a move or exclusion in the working version and stay unchanged in a saved version.
- [ ] Two browsers on the same BoQ: an edit in one appears in the other within 1 s; editing the same line in both keeps the later edit and tells the earlier editor.
- [ ] The sheet scrolls smoothly at 20,000 lines (60 fps target on a mid-range laptop; measured in a perf test).
