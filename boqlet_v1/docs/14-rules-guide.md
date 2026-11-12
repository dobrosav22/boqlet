# 14 How to use: managing rules

A practical guide to rule sets in the app's **Library**: what they are, how to make your own, and
how to do the common things. Written for someone using the app, not reading the code. The
reference behind it is 06 (rule authoring); the standards are in 13.

## The idea in one minute

- A **rule set** decides how quantities are measured: which elements become which BoQ lines, in
  which unit, what is deducted, how lines are split. Change a rule set and the numbers change.
- You do not write one from scratch. **As modelled** is the master template: every item is already
  there, and everything a measurement standard decides is asked as a **question** with a neutral
  answer. Your rule set is **As modelled plus your answers**; only answers that differ are stored.
- Classifications (codes and grouping) and dictionaries (what names in the model mean) are the
  Library's other two inputs. They never change a number; this guide does not cover them.

## Where things are

**Library** (top left) lists rule sets, classifications and dictionaries. A rule set may say
"extends …" (it is based on another) or carry a **saved** badge (you saved it; shipped ones have none).

Opening a rule set shows three tabs:

| Tab | What it is for | Who needs it |
|---|---|---|
| **Settings** | The questions a standard answers, grouped by section | Everyone |
| **BoQ items** | Everything that becomes a BoQ line, in three groups (see below) | When no question covers what you need |
| **Advanced** | About and defaults, what the BoQ leaves out, setting up questions, raw JSON | Whoever maintains templates |

Buttons at the top: **Check** (ask the engine whether it accepts the rule set), **Save** (or **Save
as new…** for a shipped one), **Download JSON**, **Duplicate**, **Reset changes**, **Delete saved**.

## Your first rule set

1. Library › **+ New rule set**. Give it a name, keep **Extend an existing rule set** and **As
   modelled**, then **Create draft**.
2. **Settings**: go through the sections (the chips at the top jump to them) and answer as your
   rulebook does. A changed answer gets a **your answer** badge and a **use default** link.
   **Only my answers** shows just what you changed.
3. **Check**. If the engine lists problems, fix them (see "When something looks wrong").
4. **Save**. The rule set is written to `presets/user/` and gets the **saved** badge.
5. Switch to **Bill of quantities**, drop an IFC file, pick your rule set under **Rules**, **Generate**.
6. Open a line to see its formula, the values used and the elements behind it. To compare with
   another rule set: **Pin for comparison**, pick the other rule set, **Generate**, then the
   **Compare** tab shows both bills side by side.
7. Change answers, **Save** again, **Generate** again.

Unsaved changes live only in the browser tab and are lost on reload. A shipped rule set is never
overwritten: if you change one, **Save as new…** saves a copy under a name you choose.

## The Settings tab

- **In this BoQ / Not in it** at the top lists the optional items your answers switch on or off
  (formwork, excavation, demolition…). Click one to jump to its question.
- **Follow-up questions** sit indented under the question they depend on and appear only when they
  apply. Answer "Do you measure excavation for foundations?" with Yes and the working-space and
  formula questions appear.
- **Formula questions** ("How do you calculate formwork to concrete walls?") offer ready-made
  answers in a list (Both faces, openings not deducted / Both faces, openings deducted / One face
  only…). The formula is always shown below and you can edit it; an edited one shows as **Custom
  formula**.
- **Used by** under each question links to the items that use the answer.

## Formulas in readable form

Formulas show names in square brackets, for example `([Length] + 2 * [Working space]) * [Height]`.

- **Names** (button next to a formula) lists everything a formula can use, with units and a short
  explanation, grouped: measured on the element, describing the element, lists (openings, layers,
  faces, parts), fields of list items, values on a BoQ line, the whole building, and the rule set's
  own answers. Click a name to insert it.
- **fx** shows the syntax: `+ - * /`, comparisons, `AND OR NOT`, `IF(condition, then, else)`, `MIN`,
  `MAX`, `ROUND(x, step)` and so on.
- Lists are summed with `WHERE`: `SUM([Openings › Area] WHERE [Opening kind] = "door")`.
- Whole-building values: `[Building › Gross volume]`, `[Building › Gross floor area]`,
  `[Building › Number of storeys]`. The log says whether each came from the model or was derived
  (derived ones are approximate).
- Text in quotes is taken as written (`"door"`, dictionary terms like `"board.plasterboard"`).
- A name the editor does not know shows an error and is not stored until fixed. **code** shows the
  formula exactly as stored.

## The BoQ items tab

One list in three groups:

| Group | What it is | Examples |
|---|---|---|
| **From the model** | Takes model elements and measures them | Walls, slabs, windows, pipes |
| **Calculated from other items** | Work that is not modelled, calculated from the lines or elements of other items | Formwork, paint, reinforcement estimates, excavation |
| **Entered by hand** | Lines with no model behind them; empty quantity = a line for you to fill | Site setup, scaffolding, provisional sums |

The list holds the rule set's items, not the lines of a BoQ: it is the same whatever you answer in
Settings. An answer can switch an item off (its **Enabled** field points at a yes/no question); it
stays in the list and the engine skips it. How many lines a generated BoQ has depends on the
answers and on the model (one item can give a line per type, per storey…).

**How Settings and items connect.** Settings holds answers: yes/no, numbers, choices, and whole
formulas. Items hold the structure: which elements, what quantity, how lines are split. Any field
of an item either has a fixed value or takes its value from a question (the **slot** button);
"Used by" under a question lists the items that do. **+ From the model**, **+ Calculated** and **+ By
hand** add a new item. **+ From the model** first asks what you want in the BoQ: pick a kind of
element (those in the loaded model come first, with how many there are) and the item starts
measured the usual way for it, one line per type. Or copy an item that is close, or start empty.
A new item uses no question until you point a field at one.

Change an item only when no question covers what you need.

**The sentence at the top** says what the item does in plain words, for example *"Measure the area
(both faces) of walls where material is a kind of concrete, minus openings larger than 0.5 m2, one
line per type name, written as "Wall, ‹Type name›"."* Click a part of it to jump to where it is
set. Under it: whether the item is in the BoQ (and which answer switches it), what "More options"
changes, and which Settings answers the item follows, with their current values.

Then four steps, the questions a person asks about a BoQ item:

1. **What is measured**: kinds of element (walls, doors, pipes…), then optionally **Only where…** /
   **Except where…** conditions on a value (material is a kind of concrete, external is yes, a
   property set value) or a formula. "Is a kind of" uses the dictionary: concrete also takes
   concrete.in_situ.
2. **How it is measured**: count, length, area, volume, weight, perimeter, your own formula, "depends
   on a condition" (if / else) or "let a Settings answer choose". The ways that suit the chosen
   elements are offered first. Area has a surface (main face, one face, both faces, top…); length,
   area and volume can **take out** openings, doors, windows, holes, elements passing through or
   recesses: all of them, only those larger than a size, only the part above a size….
3. **How lines are split**: tick what separates lines (type name, storey, material, inside /
   outside…); anything else, such as a split that only applies when an answer is yes, shows below
   in words.
4. **What each line says**: the line text, with values inserted by a click and read back in words.

**More options** (folded; its title lists what is changed): which elements in detail (only the
ones left out of this BoQ, for demolition; parts of assemblies; layers or faces), split by ranges
(bands), factor, minimum quantity, rounding, what to do when a value is missing, tags, claims (two
items claiming the same element for the same purpose raise a double-count question), notes and the
id.

A **slot** button on a field makes it take its value from a question instead of a fixed value.

In a rule set based on another, inherited items show **Change in this set**, **Leave out of this
set**, and later **Back to inherited**. Renaming an item's id updates the calculated items that use
it; if classifications refer to the old id, a banner offers to update them (as drafts you then save).

## The Advanced tab

- **About and defaults**: name, version, "based on" (free text, e.g. "our reading of NRM2"; never a
  compliance claim), unit system, **Left out of this BoQ** (conditions; elements matching them are
  not measured and not asked about), and defaults for rounding, missing values and breakdown.
- **Questions setup**: every part of the questions, without JSON.
  - **Sections** only arrange the Settings tab: its groups, their order and an optional
    introduction for each. They never change a number. A question's section is chosen on the
    question itself (**Section**); removing a section moves its questions to "Other settings". A set
    based on another can retitle the parent's sections and add its own after them, but not reorder
    or remove the parent's.
  - Per question: the question text, short name (also its name in formulas), section, kind of
    answer (number, choice, yes/no, text, formula), default answer, help, example, unit, lowest /
    highest allowed, the possible answers with the text people see, ready-made formulas, and
    **Only ask when** (a follow-up of another question).
  - **Stored as** is the name items use. Renaming it updates every item and formula in the set;
    renaming one of its answers updates the items that choose by it and the follow-ups.
  - A question decides nothing by itself: what its answer does is decided by the item fields that
    point at it (**Used by**). A new question has no effect until an item uses it; deleting one
    that items use leaves them with a missing value (the app warns first).
  - **+ New question**, then point an item's field at it with the **slot** button.
- **JSON**: the rule set exactly as stored. Everything can also be done in the forms.

## Common tasks

| You want to… | Do this |
|---|---|
| Keep small openings in walls (e.g. up to 0.5 m2) | Settings › Openings and deductions: "Which openings … are deducted from walls?" → *Deduct openings larger than a size, in full*; size limit 0.5 |
| Measure thick walls in m3 | Settings › Walls: "In what unit are walls measured?" → *m3 from a thickness, m2 below it*; then the thickness |
| Measure windows by area | Settings › Openings and deductions: "How are windows measured?" → *Area (width x height)* |
| Formwork on one face only | Settings › Concrete…: "How do you calculate formwork to concrete walls?" → *One face only, openings not deducted* |
| Separate lines per storey | Settings › General: "Do you want separate BoQ lines for each storey?" → Yes |
| Renovation: new work only | Settings › What is included: "Does this BoQ cover everything …?" → *New work only*; optionally "Are elements marked for demolition measured…?" → Yes |
| Deduct niches from walls in m3 | Settings › Openings and deductions: "Are recesses … deducted from walls measured in m3?" (only openings the model marks as recesses) |
| Room finishes without the columns | Settings › Finishes: room-by-room finishes → Yes; "…columns standing in a room deducted…?" → *All columns deducted* |
| An item per 100 m3 of building | BoQ items › **+ By hand**; description and unit; "Or a formula": `[Building › Gross volume] / 100` |
| A value of your own that items use | Advanced › Questions setup › **+ New question**; then on an item's field press **slot** and pick it |
| An item the template lacks | BoQ items › **+ From the model** (or **+ Calculated**), then fill the form |
| Drop an item you never want | If a question switches it (Furniture, Formwork…) answer No; otherwise select it › **Leave out of this set** |

## Standards

No measurement standard ships with the app, and none can until licensing is settled (08). Doc 13
lists the standards that exist and how much of the template each covers: some cover a whole
building, some one trade, some only civil works or only floor areas. To work to one, make a rule
set from As modelled, answer the sections your standard covers from your own licensed copy, and
write it in "based on". Never paste text from a standard into the app.

## When something looks wrong

- **Check lists problems**: a misspelled name in a formula, an item reading from an item that no
  longer exists, an answer outside its allowed range, a question in a section that does not exist.
  Each message names the place.
- **Questions after generating** (Questions tab of the BoQ): "not measured by any rule" means no
  item takes those elements (assign one, exclude them, or add an item); a double-count question
  means two items claim the same elements; name questions mean a material or type name is not
  understood (dictionaries).
- **A flagged line** (no quantity) means a value was missing on some element; the line says which.
  The item's "When a value is missing" decides between flagging, skipping, asking or a default.
- **A number you do not expect**: open the line. It shows the formula with the actual values, the
  answers used and every element with its share. The log (BoQ › Log) explains each step.

## Limits today

- Saved rule sets live on this machine (`presets/user/`), without versions or history. The future
  platform will store them per company and project.
- Line texts (`{type_name}`, `{thickness*1000} mm`) and line splits are still written as code.
- **Item library** (not built): a list of standard BoQ items with fixed wording, codes and units,
  for example a client's tender BoQ imported from Excel. The engine would put its measured
  quantities into those items, so the result comes out in the client's structure and words instead
  of the engine's own lines. 08 (gap 4) explains why most firms work this way; nothing decides it yet.
