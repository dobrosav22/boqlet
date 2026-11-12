# Design system

**The look is decided in `design-guidelines.md` (P43)**: palette, tokens, typefaces, shapes,
motion. That file wins wherever the two differ. This file keeps the principles and the
component list.

A work tool for professionals who read numbers all day. Very clean, no visual noise, modern,
easy to use, keyboard friendly (P23). Built with **shadcn/ui** components (preset `b38miVKzY`:
Tailwind CSS + Base UI primitives, copied into the repo and restyled through tokens), set in a
monospace face, with a display face for the expressive moments (design-guidelines.md). The PoC's "ruled sheet" look (a printed BoQ) is the visual reference for the sheet.

## Principles

1. **Numbers first.** Tabular figures (`font-variant-numeric: tabular-nums`), right-aligned
   quantities, units in their own column, never truncated numbers.
2. **Status is always explicit.** Source (measured / derived / manual / flagged / overridden),
   version status (working, saved, confirmed), job state and module statuses each have one badge style used everywhere.
   Colour never carries meaning alone (icon + text).
3. **Density with breathing room.** Compact rows in data tables (32 px), comfortable forms.
   A density toggle in the sheet (compact / comfortable).
4. **Plain language.** The PoC Library's sentences ("Walls are measured by area, openings over
   0.5 m² deducted") are the tone everywhere. No jargon without a tooltip linking to the glossary.
5. **Nothing hidden.** Flagged and unclassified lines are visible by default (BR-03). Filters
   show what they hide.
6. **No visual noise.** Hairline borders instead of boxes and shadows; shadows only on
   popovers and dialogs. Colour is rare and means something (the status and accent rules in
   design-guidelines.md). No decorative icons, illustrations or gradients; an icon appears only where
   it carries meaning, always with text or a tooltip. Generous whitespace around the work
   area, density inside tables.
7. **Monospace everywhere, tuned for reading.** Numbers align without effort and the UI reads
   like a precise instrument. Long texts (item texts, explanations, help) are capped at about
   72 characters per line, with 1.6 line height, so monospace prose stays readable.

## Tokens

All tokens (colour for light and dark, data colours, type scale, radius 2 px, spacing 4 px grid,
density, motion) are defined in `design-guidelines.md`. Components read them through CSS
variables; no colour, size or font is hard-coded in a component.

## Components (build in `src/components`, document in Storybook or a `/_dev/ui` page)

Start from the shadcn/ui set (Button, Input, Select, Combobox/Command, Dialog, Sheet, Popover,
Tabs, Table, Tooltip, Toast/Sonner, Dropdown Menu, Breadcrumb, Badge, Progress, Skeleton,
Checkbox, Radio Group, Switch, Resizable panels), restyled to the tokens above. Product
components: App shell (top bar, org switcher, left nav, project sub-nav), Page header with status badge
and actions, Tabs (URL-bound), Data table (virtualised, sticky header, grouping rows with
subtotals, column chooser, keyboard navigation), Detail side panel (resizable), Status badges
(source, version, BoQ, job; module badges use the same component), Progress (job stages), Empty state,
Error state, Skeletons, Toasts, Dialog / Confirm (with "type to confirm" variant), Limit dialog,
Form fields (text, number with unit, decimal money, select, combobox with search, term picker
with hierarchy, code picker for code lists, date-time with timezone, markdown editor light),
File dropzone with upload progress, Selector builder (IFC class / family / term / property /
storey; shared by scope rules and Library), Readable formula display, Diff cells (before →
after, Δ, Δ%), Comparison cell (rate, amount, flags), Notification bell + list, Avatar /
user chip, Breadcrumbs, Keyboard shortcut hint, Wizard step frame (F16: one question, example,
suggested answer, live preview), Shared filter bar (sheet + 3D, F07 §9), Inline editable cell
with edit marker and restore (F06 §6), "How it is calculated" step list (F06 §5), Session
takeover screen (F01 §10).

## Accessibility

WCAG 2.2 AA (nfr.md). Every interactive element is reachable by keyboard. Focus is visible.
Data tables use grid semantics with arrow-key navigation. Dialogs trap focus. Badges include
text. The viewer has a non-3D alternative list.
