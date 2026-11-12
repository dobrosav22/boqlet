# F16 Setup wizard: measure, number and name the firm's way

## Purpose

A new org's first BoQ uses the system presets: "As modelled" measures as the model has it, with
no market's conventions (walls in m², every opening deducted, no excavation, no reinforcement
estimate), no classification, no item texts. To an engineer that does not look like a BoQ, and
the full Library (F10) asks a lot before the first useful result: 61 rule-set questions, a code
list, a map, a dictionary.

The wizard is the short path. In about fifteen minutes, on a model the user can see, it sets
up the three things the firm's BoQs need, as ordinary Library presets:

| Step | Produces | Library editor it shortens |
|---|---|---|
| How you measure | a rule set (patch on "As modelled") with the answers that move numbers most | rule set › Settings |
| Item numbers and texts | a classification: the firm's item numbers, item texts (P14) and which line gets which item | classification › Code list, Codes per line |
| Names | a company dictionary with the model's names the engine did not understand | dictionary › Names in the model |

Nothing in the wizard is new engine behaviour. It puts existing editors in order, asks only the
essential questions, and shows each answer's effect on the model. Whatever it creates can
later be edited in the Library like any preset.

## When it appears

1. **On first start, required** (P18, FL-1): right after creating the org, the owner goes
   straight into the wizard, and the org's dashboard opens only when it is finished. Signing
   out and back in returns to the step they left. Because it is required, it must be quick:
   every question comes with a suggested answer, and **"Use the suggested answers"** on each
   step finishes the whole wizard in under three minutes. Members invited later never see it;
   if they arrive before it is finished, they can work with the system presets and see "Your
   firm's setup isn't finished yet".
2. **From the Library home** (F10 §1): a "Guided setup" button, always available. Running it
   again creates new drafts. It never overwrites published versions.
3. **When a BoQ is generated with system presets only** (S12 sheet): a one-line hint "These
   numbers use the neutral 'As modelled' rules. Set up your firm's rules →". Dismissible per
   user.

Who: org owner, admin, library editor. Members without library rights never run it; while it is
unfinished they see "Your firm's setup isn't finished yet" and work with the system presets.

## Steps

The wizard is one screen (`/{org}/setup`) with a step list on the left, the step in the middle
and a **preview** on the right: the BoQ lines of the chosen model under the current answers,
with changed lines highlighted (the F10 preview, EN-005).

### 0. Start

- **Model to try it on:** pick a model version from any project the user can see, or the
  sample Duplex (FL-1). Optional. Without a model the wizard still works, with no preview.
- **Start from:** "As modelled" (default), or any system or org rule set that is closer (no
  market is built in, P35; a firm running the wizard again may start from its own). The list
  shows each preset's `basedOn` text.
- Creates the drafts: a rule-set patch, a classification and a company dictionary, named
  "{Org name} rules", "{Org name} items" and "{Org name} names" (editable). Free plan:
  `libraryOrgPresets` is 1 per kind (05-plans-and-limits), so the wizard fits it exactly. If
  the org already has a preset of a kind, the wizard offers to continue in a new draft of that
  preset instead of creating one (no `402`).

### 1. How you measure

The questions come from the starting rule set's own data, never from a list in the frontend
(CLAUDE.md rule 3, P42). A rule set's questions (slots) are of two kinds, and the wizard treats
them differently:

**1a. What your BoQ includes (derived automatically).** Every top-level yes/no question that
switches BoQ items on or off (it is the `enabled` value of at least one item, calculated item or
by-hand item) becomes one checkbox on a single checklist screen, grouped by the rule set's
sections, labelled with the slot's `label` and its `question` as the help text, preselected with
the starting rule set's answer. A slot marked `setup: "skip"` is left out (technical switches).
Nothing has to be maintained for this screen: a new switch in a rule set appears in it by itself.

**1b. Details for what you switched on (derived automatically).** For each switch the user
turned on, its follow-up questions (`dependsOn`) follow, one screen per switch: working space and
formula for excavation, allowance and formulas for formwork, kg per m³ for reinforcement
estimates, thicknesses for blinding and hardcore, column deduction for room finishes, formulas
for paint and skirting. A number follow-up whose current value is 0 has no suggested answer and
must be filled in (a reinforcement estimate of 0 kg/m³ or a size limit of 0 is never what a
person means).

**1c. How the main items are measured (marked in the rule set).** Questions that change how
the items present in almost every building model are measured: walls, wall and slab openings,
roofs, windows and doors, and how lines are split. The rule set marks each with `setup: "<step
id>"` and lists the screens in `setupSteps`, in order; questions sharing a step appear on one
screen, each with its follow-ups underneath when they apply.

Every screen uses the Settings tab's controls (choice labels, ready-made formula choices), the
suggested answer is the starting rule set's current answer, and each answer shows its effect in
the preview at once, e.g. "Walls, Exterior - Brick on Block: 267.16 m² → 112.40 m³" (re-run at
most once per second; previews count as processing, BR-62). "All settings…" opens the full
Settings tab of the same draft in the Library.

A rule set with no `setupSteps` (a firm's own, not based on "As modelled") still gets 1a and 1b;
1c then shows its sections with a link to each in the full editor. A patch inherits the markers of
the rule set it is based on and may change them.

#### Wizard content for "As modelled" (decided, P42)

Derived from `presets/rules/as-modelled.json`: 61 questions in 13 sections, 37 of them
top-level; 16 top-level yes/no questions switch BoQ items on or off (of its 30 items, 12
calculated items and 3 by-hand items).

**1a checklist** (derived; 14 switches after `skip`), with "As modelled"'s suggested answer:

| Section | Switch (slot) | Switches on | Suggested |
|---|---|---|---|
| Earthworks and substructure | Excavation for footings (`excavation`) | excavation | off |
| | Blinding under footings (`blinding`) | blinding | off |
| | Hardcore under ground slabs (`hardcore`) | hardcore | off |
| Concrete, formwork and reinforcement | Formwork as its own item (`formwork_separate`) | 3 formwork items | on |
| | Reinforcement estimates (`rebar_estimates`) | 3 estimates | off |
| Floors and slabs | Concrete in slabs as its own item (`slab_concrete_separate`) | slab concrete | on |
| Finishes | Room-by-room finishes (`room_finishes`) | 4 room items | off |
| | Paint to plasterboard walls (`paint_walls`) | paint | on |
| | Paint to ceilings (`paint_ceilings`) | paint | off |
| | Skirting (`skirting`) | skirting | off |
| Services (MEP) | Building services (`include_mep`) | pipes, MEP items | on |
| Preliminaries and sums | Preliminaries (`include_prelims`) | site setup, scaffolding | on |
| | Provisional sums (`include_provisional`) | landscaping | on |
| What is included | Loose furniture (`include_furniture`) | furniture | off |

Marked `setup: "skip"`: `include_proxies` (unknown objects counted as items) and
`include_non_physical` (markers and display objects): technical, the defaults are right for
almost every firm, and they stay in the full Settings tab.

**1c screens** (`setupSteps` in order; follow-ups appear under their parent):

| Step | Questions | Why it is essential |
|---|---|---|
| `walls` "Walls" | `wall_unit` (+ `masonry_volume_from`), `wall_surface` | walls are in every model; m² vs m³ and which face are the commonest differences between practices |
| `wall-openings` "Openings in walls" | `wall_opening_mode` (+ `wall_opening_threshold`, `opening_compare_by`, `wall_add_reveals`) | deduction rules for windows and doors change every wall line |
| `slab-openings` "Openings in floors and roofs" | `slab_opening_mode` (+ `slab_opening_threshold`) | the same for every slab line |
| `roofs` "Roofs" | `roof_surface` | slope vs plan changes every roof line |
| `windows-doors` "Windows and doors" | `window_measure`, `door_measure` | count vs area changes units of every window and door line |
| `layout` "How lines are split" | `lines_by_storey` | used by 29 of the 30 items: one line per type, or per type and storey |

Not in the wizard: renovation scope and demolition (`renovation_scope`, `measure_demolition`,
a follow-up of it), because they describe a project, not how a firm measures. Left to the full
Settings tab (rarer, or with suggestions that suit almost everyone): wall
recesses, columns through slabs, railings, stairs, steel weight and density, member lengths,
pipe lengths and allowance, finishes split by type, roof build-up layers, slab surface.

So a new firm sees one checklist, a detail screen for each thing it switched on, and six short
screens; with "Use the suggested answers" the step takes about a minute.

### 2. Item numbers and texts

What a classification consists of decides the step: a **code list** (codes with their parent,
short name and optional item text) and a **map** (rules saying which BoQ item gets which code).

- **Item list:** import the firm's list from Excel or CSV (the F10 §8 import; columns for item
  number, short name, parent, item text are recognised from their headers, e.g. "opis" or
  "Langtext" for the text), or start from a copy of a system or org list, or skip (lines stay
  grouped as "All lines" until a classification exists).
- **Which item for which line:** one row per BoQ item of the step-1 rule set **that the step-1
  answers switch on** (items, calculated items and by-hand items whose `enabled` is true or
  unset). Rows are ordered: items with elements in the preview model first (with their element
  count), then switched-on calculated and by-hand items, then the rest folded under "Not in this
  model". "Suggest codes" proposes items by matching each row's label to the codes' short names;
  the user accepts or picks. The wizard writes one map rule per row (`match: {ruleId}` → code).
  Rows left without a code are allowed: the classification's `onUnmapped` is `"flag"`, so those
  lines show under "Unclassified" without asking questions (changeable later in the Library).
- **Item texts:** under each chosen code its item text, editable; with a preview model the text
  is shown filled with a sample line's values.
- The preview shows each line with its item number and filled text, as it will look in Excel.

### 3. Names

- Only with a model. The "Names in the model" table (F10 §7), filtered to the names the engine
  did not understand and that a rule needs ("worth asking"). Each answer goes into the
  company-dictionary draft. "Skip" leaves them as questions on the first BoQ (F05).

### 4. Review and publish

- A summary in plain words, built from the editors' story components
  (`itemStory`/`classStory`/`dictStory` in the PoC): "Walls in m³ above 12 cm, openings over
  0.5 m² deducted, formwork separate…", "47 items imported, 38 of 41 kinds of line have an
  item, 3 have none", "12 names taught".
- The engine check of each draft (`POST /presets/check`). Problems are listed with a link to
  the step that fixes them. Publishing needs zero problems (F10 §4).
- **Publish all** publishes the three drafts with the change note "Initial setup" and stars
  them, so they prefill new projects' defaults (F02 §2). Existing projects are not changed.
  The user is offered "Apply to project X" for the project of the preview model, which sets
  that project's defaults (no existing revision changes, BR-07).
- **Not in the models** reminder (P15): one paragraph saying that the BoQ will contain only
  what the models contain, and that work not modelled as objects is added as manual lines in
  the sheet (F06 §7).

### Leaving and resuming

Progress is kept in `Org.setup` (data model): status, step, preview model, the ids of the three
drafts. Leaving keeps the drafts. They are ordinary Library drafts (autosaved, F10 §3). Coming
back opens the step where the user left. Finishing sets `completedAt`. There is no
"dismiss": the fastest way out is the suggested answers.

### Designed for someone who has never seen the product

- One topic per screen in step 1 (the checklist, one screen per switched-on item, the six
  measuring screens), each question in the user's terms ("How do you measure masonry walls:
  in m² or in m³?") with a one-line explanation, a small worked example, and the suggested
  answer preselected. The preview shows what the answer changes, on the model, in numbers.
- Never more than three answer choices visible per question; advanced options behind "More".
- A progress bar with steps and time left ("about 4 minutes"). Back and forward never lose
  answers.
- Plain words only: no "slot", "patch", "classification map" or IFC class names on screen.
- Tested with people new to the product before release (v1 criterion 12).

## Later (not in v1): start from your last BoQ

Step 0 offers "Upload a BoQ you made before" (xlsx). The engine reads it (`POST /codelists/read`
already returns sheets, rows and column guesses) and suggests:

| From the old BoQ | Suggests |
|---|---|
| Item numbers, short names, chapter rows | the classification's item list (step 2), with no mapping step |
| Item texts | item texts, with the numbers that look like dimensions offered as blanks ("25 cm" → `{thickness}`) |
| Units per kind of work (masonry in m³, formwork lines present, excavation lines present) | answers to setup questions (step 1), marked "suggested from your BoQ" |
| Items no model element can feed (site setup, scaffolding) | manual lines to add on new BoQs (F06 §7) |

Matching texts to kinds of line may use AI suggestions with confirmation (Q8, Q23). Only the
firm's own documents are read. The upload screen says so, and standards documents are never
uploaded for extraction (BR-53, F10 §12).

## Edge cases

- **The preview model has none of an item's elements:** the preview shows "not in this model"
  for that item; the wizard still lets the user give it an item number.
- **The starting rule set has no `setupSteps`** (an org's own rule set): parts 1a and 1b still
  work from its data; 1c lists its sections with links to the full Settings tab.
- **Two admins run the wizard at once:** one `Org.setup`; the second sees "Setup in progress
  by {name}" with "Open" (same drafts, F10 ETag rules) or "Start separately" (new drafts).
- **Processing limit reached** (`402` on preview): the wizard keeps working without the
  preview and says why (BR-61).

## API

Existing: `GET/POST /orgs/{orgId}/presets`, `PUT /presets/{presetId}/draft`,
`POST /presets/check`, `POST /presets/{presetId}/preview`, `POST /presets/{presetId}/publish`,
`PATCH /presets/{presetId}` (`starred`), `POST /codelists/read`, `POST /codelists/build`,
`POST /model-versions/{versionId}/names`, `PATCH /projects/{projectId}` (defaults).
New: `GET /orgs/{orgId}/setup`, `PUT /orgs/{orgId}/setup`.

## Acceptance criteria

- [ ] A new org owner finishes the wizard on the sample Duplex in under 15 minutes (M, with a person new to the app), with walls in m³, an imported item list with item texts and the Duplex names answered.
- [ ] Every setup answer changes the preview within 3 s on the Duplex, and the changed lines are highlighted.
- [ ] After "Publish all", a new project's BoQ uses the three presets without further choices and its Excel shows the item numbers and filled item texts.
- [ ] Leaving at step 2 and coming back the next day reopens step 2 with the answers of step 1 kept.
- [ ] A free-plan org finishes the wizard without hitting `libraryOrgPresets`.
- [ ] A new owner cannot reach the org dashboard before finishing; "Use the suggested answers" on every step finishes in under three minutes.
- [ ] Changing which slots are `setup` in the system rule set, or adding a new item-switching yes/no slot, changes the wizard's screens with no frontend change.
- [ ] Starting from "As modelled", the wizard shows the 14-switch checklist, a detail screen only for switches turned on, and the six measuring screens of the table above.
- [ ] Turning on reinforcement estimates cannot be finished without entering kg per m³ for slabs, walls and footings.
