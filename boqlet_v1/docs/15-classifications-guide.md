# 15 How to use: classifications

A practical guide to classifications in the app's **Library**: what they are, how a BoQ line gets
its code, how to make your own and how to do the common things. Written for someone using the app,
not reading the code. The reference behind it is 07 (dictionaries and classification).

## The idea in one minute

- A **classification** puts a **code** on every BoQ line, for example `D.01 External walls`. The
  BoQ is then grouped by these codes (the Excel BoQ adds a subtotal per group).
- It **never changes a quantity**. Measuring is the rule set's job (14). A classification only
  labels and sorts the lines the rule set made.
- It has two parts:
  - the **code list**: the codes and their tree (`D` Walls › `D.01` External walls). It can be an
    official list (Uniclass), your company's own cost codes, or a client's tender chapters;
  - the **rules** that say which line gets which code. Most of them sit in one simple table: one
    code per BoQ item ("Walls → D.01").
- You can use several classifications at once: one line can carry a Uniclass code, a company code
  and a client's position. The BoQ is grouped by the first one you tick.

## Where things are

**Library** (top left) › **Classifications** lists them. Opening one shows a short explanation and
three tabs:

| Tab | What it is for | Who needs it |
|---|---|---|
| **Codes per line** | One code per BoQ item, and under each row what decides its code | Everyone |
| **Code list** | The codes as a tree; import from Excel or CSV; "About this list" (publisher, levels, licence) | Whoever sets up the list |
| **Advanced** | Rules by condition, where codes come from, what happens when nothing gives a code, raw JSON | When the table cannot say what you need |

Buttons at the top: **Check**, **Save** (or **Save as new…** for a shipped one), **Download JSON**,
**Duplicate**, **Reset changes**, **Delete saved**. They work as for rule sets (14).

## The explanation at the top

It says, from the classification itself:

- what it does and how many codes its list has, with the level names (`Section › Item`);
- **where a line's code comes from**, in order. The first that gives a code wins:
  1. your answer for the project, if the line was asked about (BoQ › Questions);
  2. a code already on the elements in the IFC, if this classification reads them (only when set
     up, e.g. for Uniclass);
  3. this classification's rules: the table, then the rules by condition, the higher priority
     winning;
  4. otherwise the line stays without a code, is asked about, or gets a default code;
- how many kinds of line **always** get a code, **only in some cases** (a condition decides, e.g.
  external walls get a different code from internal ones) and **none**, for the BoQ items of the
  rule set chosen in the table.

Click an underlined part to jump to where it is set.

## Your first classification

1. Library › **+ New classification**. Give it a name, **Create draft**. It starts empty, on the
   Code list tab, with the import screen open.
2. **Code list**: import your codes from Excel or CSV (see below), or **Cancel** the import and add
   codes by hand with **+ Top-level code** and **+ child**.
3. **Codes per line**: pick a code for each BoQ item. **Suggest codes** proposes codes by matching
   the item names to the code titles; check them and **Accept**.
4. Split a row where one BoQ item needs several codes (external and internal walls).
5. Look at the explanation at the top: rows with no code are counted under "none" and marked with a
   grey bar on the left.
6. **Check**, then **Save**. It is written to `presets/user/` and gets the **saved** badge.
7. **Bill of quantities** › **Classification**: tick it, **Generate**. The sheet is grouped by its
   top-level codes; the Excel BoQ too, with a subtotal per group, and its Lines sheet has a column
   for every ticked classification.

A shipped classification is never overwritten: if you change one, **Save as new…** saves a copy.

## The Codes per line tab

One row per **BoQ item** of a rule set, in the rule set's three groups (measured from the model,
calculated from other items, entered by hand). Every line an item makes gets the row's code.

- **BoQ items of**: which rule set's items are listed. Rule sets built on As modelled share its
  items, so one table serves all of them. A row for an item the chosen rule set does not have is kept
  at the end, for the rule sets that do.
- **Code**: type a code or pick it from the list; its title shows under it, in red if the code is not
  in the code list.
- **Split by**: when one item's lines need different codes. Choose
  - **inside / outside**: a code for external lines, one for internal, one for "not known";
  - **material** or **element type**: add a value (a dictionary term, e.g. *concrete*, *wall.party*)
    with its own code, plus a code for "everything else". A value covers everything under it:
    *concrete* also takes *concrete.in_situ*.
- **Calculated items** (formwork, paint…) can take **the same code as their source line**: formwork
  to walls is then coded like the walls it belongs to.

**Under each row** the app says what else decides its code, in the order the engine uses:

> When element type is a kind of wall.foundation: **B.01 Foundations** (rule "foundation-walls").
> When element type is a kind of wall.external: **D.01 External walls** (rule "external-walls").
> Otherwise: **D.02 Internal walls and partitions** (rule "internal-walls").

The rule names are links to the rule in Advanced. A row whose code comes only from the table shows
nothing extra.

**Rules for any line**: some rules do not name a BoQ item at all, only conditions on a line's values
("anything whose material is a kind of concrete → 01 Concrete works"). They can apply to any row,
so they are listed once, above the table, highest priority first, instead of under every row.

The app works this out from the classification and the rule set alone. A condition (material,
element type, storey) is shown in words but not checked against a model, so "in some cases" means a
condition decides. To see the code each line actually got, generate the BoQ.

## The Code list tab

The codes as a tree. Parents come from the codes themselves when the list has a **separator**
(with ".", `B.01` is under `B`), or are set per code. Edit a code or title in place; **+ child** adds
a code under one; × deletes it. **Given by rules** shows which rules give each code.

**Import from Excel or CSV**: choose an .xlsx, .csv or .tsv file, then say

- which sheet, and which row holds the column names;
- which column is the **code**, the **title** and, optionally, a description;
- where the **hierarchy** comes from: from the codes (B.01 is under B), a parent-code column, a
  level column (1, 2, 3…), or none (a flat list);
- which other columns to keep with each code (e.g. a reference to another system);
- whether to **add** to the existing codes (same code = update) or **replace** them.

The engine reads the file, so the app and the command-line importer give the same result.

**About this list** (folded): name, kind (official, your company's, a client's), publisher, version,
language, separator, level names, id, and licence (with "may be shipped to other organisations").

## The Advanced tab

### Rules by condition

For what one code per BoQ item cannot say. Each rule has a sentence on top ("Lines of items tagged
rebar get C.03 Reinforcement.") and three steps:

1. **Which lines**, one or more of
   - **Lines of BoQ items**: pick items by name;
   - **Lines of items tagged**: the tags the rule set gives its items (wall, finish, formwork…);
   - **Lines entered by hand, of kind**: preliminary, provisional sum, lump sum, daywork;
   - **Lines where (a condition)**: on the line's values, e.g.
     `UNDER(material, "concrete")` (material is a kind of concrete), `ifc_class = "IfcWall"`,
     `storey_elevation <= 0`, `keys.type_name` (a value the line is split by);

   combined with All of / Any of / None of.
2. **Which code**: one code; a code **looked up** from a value of the line (a table of value → code,
   with a code for values not in it); or the code of the line it is calculated from.
3. **Priority**: when several rules give a line a code, the higher priority wins. Table rows have 5,
   split rows 6, so a rule needs 7 or more to win over the table. Between equal priorities the rule
   higher in the list wins (**Move up** / **Move down**), unless the classification asks.

The list also shows, greyed, the rules the table writes. Change those in the table.

### Where codes come from

- **A line's code comes from, in this order**: your answer, this classification's rules, and
  optionally a code already on the elements in the IFC. Reorder with the arrows; remove or add one.
- With the IFC source: the **classification names** that count as this list (e.g. *Uniclass 2015*),
  and what to do when a line's elements carry different codes (only if all agree, the most common
  one, or ask).
- **When nothing gives a code**: the line stays without one, is asked about (does not block the
  BoQ), or gets a default code.
- **When rules of equal priority disagree**: the one higher in the list wins, or ask.
- **About this map** (folded): name, id, version, and "based on map" (take another map's rules and
  replace some by id).

### JSON

The classification exactly as stored: `codelist.json` and `map.json`. Everything can also be done in
the forms.

## Several classifications at once

Tick several under **Bill of quantities** › **Classification**. Each line carries a code from each.
The sheet and the Excel BoQ are grouped by the **first** one ticked (shipped default: ACME cost
codes); the Excel **Lines** sheet has a code and a title column for every one, for filtering and
pivot tables.

## Common tasks

| You want to… | Do this |
|---|---|
| Use your company's cost codes | **+ New classification**; Code list › **Import from Excel or CSV**; then Codes per line |
| External and internal walls in different sections | Codes per line › Walls › Split by **inside / outside**; a code for each |
| Party walls coded as internal, whatever the IFC says | Split by **element type**; value *wall.party* with the internal code |
| Concrete work in one trade, whatever the item | Advanced › **+ New rule**: Lines where `UNDER(material, "concrete")` → the code; priority 7 to win over the table |
| Formwork coded like the element it belongs to | Codes per line › the formwork row › **same as its source line** |
| Preliminaries in section A | Codes per line › the hand-entered rows; or a rule "Lines entered by hand, of kind preliminary" |
| Codes already in the model (Uniclass) used first | Advanced › Where codes come from: add **a code already on the elements in the IFC**, move it up, set the classification names |
| Every line coded, even ones you forgot | Advanced › When nothing gives a code: **gets a default code** (e.g. 99 Other) |
| See which code a line actually got | Generate the BoQ; open the line, or the Excel Lines sheet |
| Fill gaps quickly | Codes per line › **Suggest codes** › check › **Accept** |

## Licences

Official code lists are often licensed. Do not paste licensed lists (OmniClass, MasterFormat,
UniFormat and the like) into the app or the repository (08). Uniclass is not shipped either:
`npm run import:uniclass` downloads it on your machine. Your company's and your clients' own codes are
your data; "About this list" records the licence of each list and whether it may be passed on.

## When something looks wrong

- **Lines under "Unclassified"** in the BoQ: no rule gave them a code. The row shows "No rule gives
  these lines a code" or a grey bar: pick a code in the table, or set a default code. With "is asked
  about", each such line is a question in BoQ › Questions; your answer applies to the next runs
  while the page is open (answers are not stored yet in this dev build).
- **A line has the wrong code**: open the classification, find its BoQ item in the table and read
  what is under the row. A rule by condition with a higher priority may win.
- **A question about two equal rules** (classification conflict): two rules of the same priority
  gave a line different codes and the classification asks. Answer it, or change a priority.
- **"Mixed line" warning**: a rule looks at a value (material, element type) that differs between
  the elements of one line, so the most common one decided. Split the line by that value in the rule
  set (BoQ item › How lines are split).
- **"Code not in the code list" warning**: a rule gives a code the list does not have. The code
  shows in red in the table; fix the code or add it to the list.
- **Check** lists problems before you save: codes used twice, a parent that is not in the list, a
  rule or the default giving a code that is not in the list, a map pointing to another code list's
  id, and conditions the engine cannot read.

## Limits today

- The explanations under the rows are worked out without a model: conditions are shown, not
  checked. A check against the loaded model is planned (11).
- Grouping in the BoQ uses the top level of the first classification only; deeper subtotals are not
  built yet.
- Saved classifications live on this machine (`presets/user/`), without versions or history.
