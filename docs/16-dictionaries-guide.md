# 16 How to use: dictionaries

A practical guide to dictionaries in the app's **Library**: what they are, how a name in a model
gets its meaning, how to teach the app your office's names and how to do the common things. Written
for someone using the app, not reading the code. The reference behind it is 07 (dictionaries and
classification).

## The idea in one minute

- Names in IFC models are free text: "BETON MB30", "Concrete - Cast In Situ", "Gipsana ploča",
  "Z-25", "CT". Every office, tool and language writes them differently.
- A **dictionary** says what such names **mean**: "BETON MB30" means *concrete*, "Z-25" means *our
  25 cm clay block wall*, "CT" on a floor covering means *ceramic tile*. The meanings are a fixed
  vocabulary (**terms**) with ids like `concrete.in_situ`.
- Rules (14) and classifications (15) work with the meanings, not the raw names, so the same rule set
  works on models from any office, in any language.
- A dictionary does not measure anything. It changes quantities only through the rules that use the
  meanings (which item takes an element, which code a line gets).
- It can also **read values out of names**: a thickness in "Wall 25cm", a strength class in
  "C30/37", Revit's family and type in "Family:Type:123".

## Layers: which dictionary wins

Dictionaries come in three **layers**:

| Layer | Holds | Example |
|---|---|---|
| **global** | Names everyone uses: authoring-tool defaults, common words in several languages. Shipped with the app | "Concrete - Cast In Situ" means in-situ concrete |
| **company** | Your office's names, codes and abbreviations | "Z-25" is our 25 cm wall; "CT" on coverings is ceramic tile |
| **project** | Names of one project | "Roofing - Barrier" in this model is a membrane |

When several dictionaries know a name, **the most specific wins**: your answer in the project (BoQ ›
Questions), then project, then company, then global. Within one dictionary an exact name wins over
"starts with", then a pattern, then "contains". Capitals and accents are ignored unless an entry says
otherwise ("beton" also matches "Béton").

So you never edit the global dictionary to fix one office's habit: you add the name to a company
dictionary, which is asked first.

## Where things are

**Library** (top left) › **Dictionaries** lists them with their layer. Opening one shows a short
explanation and four tabs:

| Tab | What it is for | Who needs it |
|---|---|---|
| **Names in the model** | Every material and type name in the loaded model, what it means, and a quick way to answer the ones not understood | Everyone |
| **Names it explains** | Everything this dictionary knows, one name (or pattern) and its meaning per line | When you need a pattern, a condition, or to tidy up |
| **Meanings** | The meanings this dictionary defines itself, as a tree | When your office has a word the other dictionaries lack |
| **Advanced** | Values read from names, about this dictionary (name, layer), JSON | Whoever maintains dictionaries |

Buttons at the top: **Check**, **Save** (or **Save as new…** for a shipped one), **Download JSON**,
**Duplicate**, **Reset changes**, **Delete saved**. They work as for rule sets (14).

**The explanation at the top** says what layer the dictionary is, an example of a name and its
meaning, how many names it knows, how many meanings it defines and how many value readers it has,
and which dictionary wins. Click an underlined part to jump there.

## Your first dictionary

1. **Bill of quantities**: drop your IFC file, so a model is loaded.
2. Library › **+ New dictionary**. Give it a name, choose the layer (usually **company**), **Create
   draft**.
3. **Names in the model**: the materials and type names of your model. Names not understood yet come
   first; the ones a BoQ would ask about are marked **worth answering**.
4. For each, pick what it means (type to search the meanings), or use the **Suggestion**. Select
   several names to give them one meaning at once.
5. **Check**, then **Save**. It is written to `presets/user/` and gets the **saved** badge.
6. **Bill of quantities** › **Dictionaries**: tick it (keep the global one ticked too), **Generate**.
   The names you answered are now understood, in this model and every model that uses them.

A shipped dictionary is never overwritten: if you change one, **Save as new…** saves a copy.

## The Names in the model tab

The normal way to fill a dictionary. It needs a model loaded in the BoQ view; the model stays loaded
when you switch to the Library.

- **Resolved with**: this dictionary plus the ones it builds on (by default the lower layers: a
  company dictionary is shown together with the global one). Tick others to see the combined
  result.
- **Materials** / **Type names**: the two lists, each with how many names are not understood yet.
  Filter by **not understood yet**, **known from this dictionary** or **known from another
  dictionary**, or by text.
- Each row: the name as written in the model, how many elements use it and on which kinds of element,
  what it means, and which dictionary says so (its layer and how it matched). Values read from the
  name show under it ("read from the name: thickness 0.25").
- **Pick a meaning** in the row: the name is added to this dictionary as an exact name. **remove
  here** takes it out again.
- **Select several** rows to give them one meaning. Options:
  - **as every name starting with "…"**: when the names share a start, one entry covers them all,
    including names other models will have;
  - **only on walls, coverings…**: the meaning applies only on those kinds of element (the same
    abbreviation can mean different things on a floor and on a wall).
- **Worth answering**: names that change how elements are measured or coded (materials, layer
  materials, room names, and type names of walls, coverings and unknown objects). A BoQ asks about
  these; the others (a door's type name) can stay as they are.
- "A … dictionary answers this first; an answer here would not be used": a more specific layer
  already gives this name a meaning. Change it there, or here if this dictionary is the more specific.

## The Names it explains tab

Everything this dictionary knows, one per line, with a sentence on top:

> A type name that matches the pattern ^Z-?25\b means ACME Z-25: 25 cm clay block wall (acme.wall.z25).

1. **When the model says**:
   - **In its**: which names to look at: material, layer material, type name, name, object type, IFC
     class, predefined type, system, room name, or a property (`props.Pset_WallCommon.Reference`);
   - **Text**: **is exactly**, **starts with**, **contains**, or **matches a pattern** (a regular
     expression, for codes like Z-25 / Z25 / Z 25);
   - **Matching**: whether capitals matter, whether accents are ignored;
   - **Only when** (optional): a condition, so the same name can mean different things on different
     elements: "CT" is ceramic tile only when `ifc_class = "IfcCovering"`.
2. **It means**: the meaning (type to search; meanings from every dictionary are offered).

**More options** (folded): where the entry came from (shipped, a person, an import, a confirmed AI
suggestion), how sure it is, who added it, a note, the id.

## The Meanings tab

The meanings (terms) this dictionary defines itself, as a tree. Most come with the global dictionary;
add one when your office has a word the others lack (a product family, a wall type code).

- **Name**, **What it is** (a material, a product, a kind of element, a room use, a service system,
  other), **A kind of** (its broader meaning) and **Id** (what rules and other dictionaries write,
  e.g. `concrete.in_situ`).
- **A kind of** matters: a rule for "material is a kind of concrete" also takes in-situ concrete,
  precast concrete and screed, because they are kinds of concrete. **+ A kind of this** adds a
  narrower meaning under the selected one.
- Renaming an id updates the names in this dictionary that use it.
- **More options** (folded): the name in other languages, values rules may use (e.g. a density for
  weight by volume), links to other systems (a bSDD URI, a Uniclass Pr code), and **retired** (kept
  for old answers, no longer offered).

## The Advanced tab

### Values read from names

Readers that find values written in names. Each has a sentence on top:

> From the type name, text matching (?<t>\d+)\s?cm gives the thickness (written in cm) from the part "t". A value the model already has is kept.

1. **Where to look**: which names (type name, material…), the **pattern** (a regular expression;
   name each part you want, e.g. `(?<t>\d+)\s?cm` reads the number before "cm" as part *t*), and
   whether to **overwrite** values the model already has (usually not: measured geometry wins over
   names). Optionally **only when** a condition holds.
2. **What each part gives**: thickness, width, height, length, diameter, strength class, steel
   profile, nominal size, type name, family, or **a name to look up** (the part is itself looked up
   in the dictionaries, e.g. a material written inside a type name). Numbers take the unit they are
   written in (mm, cm, m) and are converted.

To test a reader, load a model and look at Names in the model: what each name gives shows under it.

### About this dictionary

Name, id, version, **layer** (global, company, project) and languages.

### JSON

The dictionary exactly as stored. Everything can also be done in the forms.

## Questions in a BoQ

A name nothing explains becomes a question in BoQ › **Questions** ("unknown name"), offering the
meanings to choose from. It **blocks** the BoQ only when the current rules or classifications use that
kind of name; otherwise it is optional. Your answer applies to the next runs while the page is open.
To keep it for good, give the name a meaning in a project or company dictionary (Names in the model),
then it is never asked again.

## Common tasks

| You want to… | Do this |
|---|---|
| Teach the app your office's material names | New **company** dictionary; Names in the model; pick meanings; save; tick it in the BoQ |
| One name for a whole family ("Porotherm 25", "Porotherm 30"…) | Names in the model: select them › **as every name starting with "Porotherm"** |
| An abbreviation that means different things on floors and walls | Give it a meaning with **only on** coverings (or add **Only when** `ifc_class = "IfcCovering"` in Names it explains) |
| A wall code with variants (Z-25, Z25, Z 25) | Names it explains › **+ New name**: type name **matches a pattern** `^Z-?\s?25\b` |
| A word of your own for rules to use | Meanings › **+ New meaning** (e.g. *acme.wall.z25*, a kind of element, a kind of *wall.external*); then point names to it |
| Thickness from type names like "Wall 25cm" | Usually already read by the global dictionary; otherwise Advanced › **+ New reader** |
| Fix a name for one project only | A **project** dictionary: it wins over company and global |
| Stop being asked about door type names | Nothing to do: they are not "worth answering" and do not block the BoQ |
| See why a name means what it means | Names in the model: **Known from** says which dictionary, layer and match |

## When something looks wrong

- **A name means the wrong thing**: Names in the model › its row › **Known from**. If another
  dictionary decides it, give it the right meaning in a more specific layer (company over global,
  project over company), or change it in that dictionary.
- **"Unknown meaning"** on a name in Names it explains: it points to a meaning no dictionary defines.
  Pick an existing one, or add it under Meanings.
- **A pattern matches too much**: patterns are tried after exact names and "starts with"; anchor it
  (`^…`, `\b`) or add **Only when**.
- **A value read from a name is ignored**: the model already has that value from its geometry, which
  wins. Tick **overwrite** on the reader only if the names are more reliable than the model.
- **Blocking name questions**: the rules or classifications use that kind of name. Answer them, or
  give the names meanings in a dictionary so every later run understands them.
- **Check** lists problems before you save, e.g. an entry id used twice or a condition the engine
  cannot read.

## Limits today

- The order of the layers, which names are worth asking about, and what happens to names nothing
  explains are set in `presets/settings/resolution.json`, not in the app.
- "Suggestion" in Names in the model matches words of the name to the meanings; AI suggestions are
  not built yet.
- Answers to name questions are not saved into a dictionary automatically; give the names a meaning
  in Names in the model to keep them. Promoting answers to the company layer is planned (07, D18).
- Saved dictionaries live on this machine (`presets/user/`), without versions or history.
