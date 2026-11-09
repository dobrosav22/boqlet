# F16 Setup wizard: measure, number and name the firm's way

## Purpose

A new org's first BoQ uses the system presets: "As modelled" measures as the model has it, with
no market's conventions (walls in m², every opening deducted, no excavation, no reinforcement
estimate), no classification, no item texts. To an engineer that does not look like a BoQ, and
the full Library (F10) asks a lot before the first useful result: 56 rule-set questions, a code
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

Who: org owner, admin, library editor. Members see the dashboard card as "Ask an admin to set
up how your firm measures" with no action.

## Steps

The wizard is one screen (`/{org}/setup`) with a step list on the left, the step in the middle
and a **preview** on the right: the BoQ lines of the chosen model under the current answers,
with changed lines highlighted (the F10 preview, EN-005).

### 0. Start

- **Model to try it on:** pick a model version from any project the user can see, or the
  sample Duplex (FL-1). Optional. Without a model the wizard still works, with no preview.
- **Start from:** "As modelled" (default), or a system or org rule set that is closer, for
  example one written for the firm's market if one exists (Q9). The list shows each preset's
  `basedOn` text.
- Creates the drafts: a rule-set patch, a classification and a company dictionary, named
  "{Org name} rules", "{Org name} items" and "{Org name} names" (editable). Free plan:
  `libraryOrgPresets` is 1 per kind (05-plans-and-limits), so the wizard fits it exactly. If
  the org already has a preset of a kind, the wizard offers to continue in a new draft of that
  preset instead of creating one (no `402`).

### 1. How you measure

- Asks the **setup questions** of the starting rule set, in order: the slots marked
  `setup` (EN-011). The rule set decides which questions are essential, so the list is data
  (CLAUDE.md rule 3), not a list in the frontend. For "As modelled" about ten, for example:
  wall unit (and the thickness above which walls go in m³), which openings are deducted from
  walls and the size limit, the same for slabs, formwork as a separate item, excavation for
  foundations (and working space), reinforcement estimates from concrete volume (kg/m³), room
  finishes, preliminaries, lines per storey.
- Each question uses the Settings tab's control (follow-up questions appear when they apply,
  formula questions offer the ready-made choices). Each answer shows its effect in the
  preview at once, e.g. "Walls, Exterior - Brick on Block: 267.16 m² → 112.40 m³". The preview
  re-runs at most once per second (debounced). Running previews count as processing (BR-62).
- "All settings…" opens the full Settings tab of the same draft in the Library, in a new tab.

### 2. Item numbers and texts

- **Import** the firm's item list from Excel or CSV: the F10 §8 import, with the "Item text"
  column (P14) recognised from headers such as "description", "opis", "Langtext". One sheet,
  one row per item: number, short name, optional parent, optional item text with blanks like
  `{thickness}`.
- Or **skip**: no classification (lines stay grouped as "All lines"), or pick a system list.
- **Which item for which line:** the "Codes per line" table (F10), one row per BoQ item of
  the step-1 rule set. "Suggest codes" proposes items by matching names. The preview shows each
  line with its item number and filled item text, so the user sees the result as it will look
  in Excel.

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

- One question per screen in step 1, in the user's terms ("How do you measure masonry walls:
  in m² or in m³?"), a one-line explanation, a small worked example, and the suggested answer
  preselected. The preview shows what the answer changes, on the model, in numbers.
- Never more than three choices visible at once; advanced options behind "More".
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
- **The starting rule set has no `setup` slots** (an org's own rule set): step 1 lists its
  sections and links to the full Settings tab.
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
- [ ] Changing which slots are `setup` in the system rule set changes the wizard's questions with no frontend change.
