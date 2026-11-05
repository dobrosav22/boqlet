# Design system

A work tool for professionals who read numbers all day. Dense, calm, legible, keyboard
friendly. The PoC's "ruled sheet" look (a printed BoQ) is the visual reference for the sheet.

## Principles

1. **Numbers first.** Tabular figures (`font-variant-numeric: tabular-nums`), right-aligned
   quantities, units in their own column, never truncated numbers.
2. **Status is always explicit.** Source (measured / derived / manual / flagged / overridden),
   revision status, tender status and job state each have one badge style used everywhere.
   Colour never carries meaning alone (icon + text).
3. **Density with breathing room.** Compact rows in data tables (32 px), comfortable forms.
   A density toggle in the sheet (compact / comfortable).
4. **Plain language.** The PoC Library's sentences ("Walls are measured by area, openings over
   0.5 m² deducted") are the tone everywhere. No jargon without a tooltip linking to the glossary.
5. **Nothing hidden.** Flagged and unclassified lines are visible by default (BR-03). Filters
   show what they hide.

## Tokens

- Colour: neutral greys for chrome; one brand accent; semantic: `success`, `warning`,
  `danger`, `info`; source colours: measured (neutral), derived (blue), manual (violet),
  flagged (amber), overridden (orange outline). Light theme in v1. Tokens are ready for dark.
- Type: one sans for UI (system stack or a self-hosted variable font; no runtime Google Fonts
  dependency), tabular numbers. Sizes 12 / 13 / 14 / 16 / 20 / 24.
- Spacing 4 px grid. Radius 4 / 6. Elevation: two levels (popover, dialog).
- Motion: 120–200 ms, reduced-motion respected.

## Components (build in `src/components`, document in Storybook or a `/_dev/ui` page)

App shell (top bar, org switcher, left nav, project sub-nav), Page header with status badge
and actions, Tabs (URL-bound), Data table (virtualised, sticky header, grouping rows with
subtotals, column chooser, keyboard navigation), Detail side panel (resizable), Status badges
(source, revision, tender, invitation, offer, job), Progress (job stages), Empty state,
Error state, Skeletons, Toasts, Dialog / Confirm (with "type to confirm" variant), Limit dialog,
Form fields (text, number with unit, decimal money, select, combobox with search, term picker
with hierarchy, code picker for code lists, date-time with timezone, markdown editor light),
File dropzone with upload progress, Selector builder (IFC class / family / term / property /
storey; shared by scope rules and Library), Readable formula display, Diff cells (before →
after, Δ, Δ%), Comparison cell (rate, amount, flags), Notification bell + list, Avatar /
user chip, Breadcrumbs, Keyboard shortcut hint.

## Accessibility

WCAG 2.2 AA (nfr.md). Every interactive element is reachable by keyboard. Focus is visible.
Data tables use grid semantics with arrow-key navigation. Dialogs trap focus. Badges include
text. The viewer has a non-3D alternative list.
