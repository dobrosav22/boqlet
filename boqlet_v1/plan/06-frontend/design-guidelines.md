# Design guidelines

**Status: decided by the owner (Nov 2026, P41, P43).** This document overrides
`design-system.md` wherever they differ. It was written from the owner's answers, the shadcn
preset `b38miVKzY` and three reference posters for the product **boqlet**, then confirmed by the
owner in an interactive specimen of the common elements (the "boqlet look lab" artifact, setting
"Guidelines v1", https://claude.ai/artifact/RpVBRtB5PUQaMCcKiMpoaF, private to the owner). An
agent that needs a visual decision this document doesn't cover asks the owner rather than
inventing a style.

## The direction in one paragraph

A precise instrument on paper. Warm paper background, ink text, everything set in a monospace
face, hairline rules, almost-square corners. Colour is rare and means something: a few poster
colours (blue, orange, yellow, red) pop out only where something needs attention or carries
meaning. The working screens (the BoQ sheet, the Library, settings) are calm and dense. The
moments of arrival (sign-in, the setup wizard, onboarding, the dashboard, a shared BoQ) may be
expressive in the poster language: big geometric shapes, a heavy display face, the dimension
line.

## Starting point

- Initialise the app with the shadcn preset **`b38miVKzY`**
  (`npx shadcn@latest init --preset b38miVKzY`): style `base-mira`, components on **Base UI**
  (Radix would also be acceptable; keep Base UI since the preset uses it), Lucide icons,
  JetBrains Mono, compact components.
- Then replace the preset's colour tokens (its neutral greys and indigo primary) and radius
  with the tokens below. Components are restyled through tokens, not one by one.

## Colour

### Palette (from the posters)

| Name | Hex | Role |
|---|---|---|
| Paper | `#F2EDE3` | Page background (light theme); text and surfaces on dark |
| Ink | `#151515` | Text, rules, primary buttons (light); background (dark) |
| Blue | `#1E4FB8` | Interactive accent: links, focus, selection, active tab; "derived" |
| Orange | `#E8590C` | Attention: "to confirm", warnings, things to act on |
| Yellow | `#F2B705` | Marking: manual lines, highlights, the selected element in 3D |
| Red | `#C62423` | Errors and destructive actions only |

There is **no green**. Success is shown in ink with a check mark and plain words.

### What may be text, and what only fill (contrast, WCAG 2.2 AA)

| On paper `#F2EDE3` | Contrast | Use |
|---|---|---|
| Ink | 15.7 | All text |
| Muted `#6B6762` | 4.8 | Secondary text (4.5 needed) |
| Blue `#1E4FB8` | 6.3 | Text, links, icons |
| Red `#C62423` | 4.9 | Error text |
| Orange `#E8590C` | 3.1 | **Fills, markers, large text only**; small text on it in ink (5.1) |
| Yellow `#F2B705` | 1.6 | **Fills only**, with ink text (10.0) |

On ink (dark theme) blue and red get lighter variants for text (`#7D9BE6` 6.7, `#E06A69`
5.6); orange (5.1) and yellow (10.0) work as text and fills.

### Tokens

shadcn variable names, plus the product's own semantic tokens. Light is the default; dark
follows the OS setting and can be switched by the user.

| Token | Light | Dark |
|---|---|---|
| `--background` | `#F2EDE3` paper | `#151515` ink |
| `--foreground` | `#151515` | `#F2EDE3` |
| `--card` | `#F7F4EE` | `#1E1E1E` |
| `--popover` | `#FBF9F5` | `#232323` |
| `--primary` (buttons) | `#151515` | `#F2EDE3` |
| `--primary-foreground` | `#F2EDE3` | `#151515` |
| `--secondary`, `--accent` (hover, quiet fills) | `#E8E2D6` | `#2A2926` |
| `--muted` | `#E8E2D6` | `#2A2926` |
| `--muted-foreground` | `#6B6762` | `#A39E95` |
| `--border` (rules, dividers) | `#D6D0C4` | `#3A3833` |
| `--input` (control borders, 3:1) | `#8A857D` | `#7A766F` |
| `--ring` (focus) | `#1E4FB8` | `#7D9BE6` |
| `--destructive` | `#C62423` | `#E06A69` |
| `--link` | `#1E4FB8` | `#7D9BE6` |
| `--selection` (selected row fill) | `#DCE3F3` + 2 px `--link` bar on the left | `#1F2A44` + bar |
| `--status-derived` | `#1E4FB8` | `#7D9BE6` |
| `--status-manual` | `#F2B705` | `#F2B705` |
| `--status-attention` | `#E8590C` | `#E8590C` |
| `--status-error` | `#C62423` | `#E06A69` |
| `--highlight` (3D selection, search hits) | `#F2B705` | `#F2B705` |

### Status colours (quiet by default, colour for exceptions)

Most lines are plain; colour only where attention is needed or the origin matters.

| Status | Shown as |
|---|---|
| Measured (most lines) | Nothing extra: ink text, no badge colour |
| Derived | `DERIVED` label with a blue outline |
| Manual | Yellow fill tag `MANUAL`, ink text |
| To confirm (flagged) | Orange fill tag `TO CONFIRM`, ink text; quantity shown as "—" |
| Edited | A small blue dot in the edited cell; the engine's value on hover |
| Excluded | Struck through, muted text, no colour |
| Error, failed job | Red text and a red rule; destructive buttons red |
| Warning | Orange marker and ink text |
| Success, done, saved, complete | Ink with a check mark and the word ("Saved", "Complete") |
| Working / Saved / Confirmed (BoQ state) | Ink outline tags; Confirmed has a filled ink tag |
| In review / Approved (approval on) | Blue outline / blue fill tag |

Never use colour alone: every coloured status also has its word or mark.

### Data colours (charts, 3D, code groups)

Built only from the poster hues, in three strengths each, used in this order; beyond 15
categories, repeat with a diagonal hatch.

| Hue | Full | Mid | Pale |
|---|---|---|---|
| Blue | `#1E4FB8` | `#6F8FD8` | `#BFCDEE` |
| Orange | `#E8590C` | `#F09A63` | `#F8D2B8` |
| Yellow | `#F2B705` | `#F6D05C` | `#FAE7AE` |
| Red | `#C62423` | `#DA6F6E` | `#EDBEBD` |
| Ink | `#151515` | `#6B6966` | `#B9B5AE` |

Order: blue, orange, yellow, red, ink (full), then the mids, then the pales.

**3D viewer modes (F07):**
- Selected elements: yellow `#F2B705`. Everything else: ghosted paper-grey at about 15%.
- Coverage: measured in ink-grey, excluded pale, unmatched orange, covered by its parent blue-pale.
- Changes: added blue, changed orange, removed as a red ghost.
- Edited: blue.
- Code groups: the data palette in its order.
- Models: one full hue per discipline (architecture ink, structure blue, services orange).

## Typography

| Use | Face | Size / weight |
|---|---|---|
| All UI, tables, numbers, body text | **JetBrains Mono** (variable, self-hosted, Latin Extended + Cyrillic) | 13 px in tables and controls |
| Prose: explanations, item texts, wizard questions, help | JetBrains Mono | 14 px, line height 1.6, at most about 72 characters per line |
| Labels: column headers, section labels, tabs, badges, small meta | JetBrains Mono, UPPERCASE, letter-spacing 0.08em | 11–12 px, medium |
| Display: the wordmark (until its SVG exists), wizard and onboarding titles, sign-in, empty-dashboard and share-page headers | **Inter Tight** (OFL, self-hosted, Latin Extended + Cyrillic) | 800, 32–64 px, tight letter-spacing (−0.02em) |
| Page and card titles in the working screens | JetBrains Mono | 16–20 px, semibold, sentence case |

- Buttons, menus, questions and all content are in sentence case. Only labels are in caps.
- Numbers are always tabular and right-aligned in tables. Units sit in their own column, with
  superscripts (m², m³).
- No fonts are loaded from Google at runtime: both come from `@fontsource-variable/*` packages.

## Shape, space, density

- **Corners:** no sharp corners anywhere.
  - 2 px on buttons, inputs, cards, panels, dialogs, menus and tags.
  - 3 px on the expressive shapes (squares, the square corners of quarter circles) and the data
    swatches. Triangles get rounded tips of the same size (drawn as SVG with a round line join).
  - Circles only where they are deliberate (avatars, the expressive compositions).
- **Rules, not boxes:** hairline (1 px) borders in `--border` and plenty of whitespace around
  the work area. Shadows only on popovers, menus and dialogs.
- **Spacing:** 4 px grid.
- **Density:**
  - controls and table rows 32 px;
  - a density switch on the sheet: compact 28 px, comfortable 36 px;
  - long text stays in the 14 px prose style.

## The poster language: where it is allowed

Shapes are squares, circles, quarter circles and triangles, in solid poster colours, composed
on a grid.

| Place | What appears |
|---|---|
| Setup wizard and onboarding | Each step has its own composition (a shape and colour per step); large display titles ("NO. 02 — HOW YOU MEASURE" label and an Inter Tight title); the progress is a dimension line |
| Sign-in and sign-up | A poster-like composition beside the form, with the wordmark |
| Public share page (F18) | Header with the wordmark and a colour block, the project and BoQ name in display type; below it the calm sheet |
| Dashboard and project cards | Each project card has a small generated composition: shapes and colours derived from the project id (deterministic), so projects are recognisable at a glance |

**Not** in the working screens: the BoQ sheet, line detail, viewer, Library editors, settings
and the admin console stay plain. Empty states there use a short line of text and, where useful,
a dimension line, but no shapes.

## The dimension line (recurring device)

A line with end ticks and a measurement above it, as on the posters:

```text
          267.16 m²
|──────────────────────────|
```

Used for:
- the setup wizard's progress;
- the progress of a run (the line draws as the stages complete);
- the result line of "How it is calculated" (the final quantity sits on a dimension line);
- section dividers on the share page.

Drawn with 2 px ink rules and 10 px ticks; the measurement is in mono, tabular. Blue when it
represents progress.

## Brand

- The product name is **boqlet**, always lowercase.
- Until the owner supplies the wordmark as SVG, set it in Inter Tight 800.
- The name comes from one config value (`APP_NAME`), not literals spread through the code.
- It appears in the top bar, sign-in, emails and the share page footer ("Made with boqlet" on
  the free plan, F18).
- Poster-style section labels ("NO. 03 — MEASURE", "IFC → BOQ") may be used in the expressive
  places above.

## Icons

**Lucide**, sparingly. An icon only where it carries meaning (viewer tools, file types,
status marks), always with text or a tooltip. No decorative icons.

## Numbers and units

- Default for new orgs (changeable per org and project, P35, F15): thousands separated by a
  **narrow no-break space** (U+202F, "3 800", "12 450"), and the decimal mark from the locale
  ("12 450.75" in English, "12 450,75" in Serbian or German).
- Units are shown with superscripts (m², m³); quantities keep the rule set's rounding.

## Motion

- Working screens: 120–200 ms fades and slides for panels, dialogs and toasts, nothing
  decorative.
- Wizard and onboarding: the shapes move between steps and the dimension line draws as you
  progress, both short (≤ 400 ms).
- `prefers-reduced-motion` turns every movement off.

## Accessibility

WCAG 2.2 AA (nfr.md). The colour rules above are chosen to pass:
- text contrast ≥ 4.5:1 (large text 3:1);
- control boundaries ≥ 3:1 (`--input`);
- focus is always visible (2 px `--ring`).

Every status has a word or mark besides its colour. The expressive compositions are
decorative (`aria-hidden`) and never carry information.

## Still to supply (owner)

- The **boqlet wordmark** as SVG (light and dark), and a favicon.
- Optionally, the poster artwork as SVG for sign-in and onboarding; until then the frontend
  composes the shapes in code from the palette.
