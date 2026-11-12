# 06 Rules authoring

How to write a rule set (input 2), and how the rule language is meant to grow. The type is
`OurRuleType` in `packages/types/src/rules.ts`; read its comments alongside this page. The
engine side is `engine/ifc_boq/rules.py` (see 05).

## The idea

Standards, client rules and a firm's own conventions differ in two ways:

1. **Different values.** Same formula, different number: "don't deduct openings up to 0.5 m2"
   vs "up to 1.0 m2".
2. **Different choices.** A different way of measuring: windows by count vs by area; walls in
   m2 below a thickness and m3 above it.

So a rule set has **slots** (`params`) that a standard fills in, and rules that refer to slots
instead of literal values. Values go in number / boolean / text slots; choices go in choice
slots, used by `kind: "choose"` and by `mode`, `surface`, `basis` fields. `kind: "when"`
switches method on a condition. `kind: "formula"` is the safety valve for anything else.

The product owner's framing, which this realises: "windowCalculationExample: a + b / c, opening
coefficient: d, and later I populate a, b, c, d from standards. One unified type and any standard
fits." **The repo ships no values from any standard**; every number in `presets/` is an
illustrative placeholder. Shipped presets are examples to copy, not the product (D23).

Rules contain no measuring logic. They select elements and combine the measured primitives in
`MeasuredElement` (see 04). If a rule needs a value the engine does not measure, extend
`MeasuredElement` and `measure.py`, not the rule set.

## The master template: a standard is a set of answers

Nobody is expected to write a rule set from scratch. `as-modelled` is the **master template**: it
holds the rules (already written and wired to slots) and asks, through its slots, the questions a
measurement standard answers, each with a neutral "as modelled" default. A company standard is a
**patch on the template that stores only the answers that differ**. Someone with the rulebook open
answers the questions in the Library's **Settings** tab; nothing else is needed for a typical
standard, and the defaults keep the Duplex acceptance numbers.

```json
{ "id": "our-standard", "extends": "as-modelled",
  "params": { "wall_unit": { "value": "volume_from_thickness" }, "masonry_volume_from": { "value": 0.2 },
              "wall_opening_mode": { "value": "over_threshold" }, "wall_opening_threshold": { "value": 0.5 },
              "formwork_walls_formula": { "value": "SUM(src.faces.gross_area WHERE side = \"a\") * 2" } } }
```

Control is never lost; each level goes one step deeper:

| Level | How | Example |
|---|---|---|
| Value | number slot | opening size limit 0.5 m2, formwork allowance 1.05 |
| Method | choice slot (`choose` in the rule) | walls in m2 / m3 / m3 from a thickness |
| Include or not | boolean slot (`enabled` or an `IF(p.x, …)` in a line key) | formwork as its own item; wall lines per storey |
| Own formula | **formula slot**, bound where a rule expects an expression | "how do you calculate wall formwork?" |
| Replace a rule | override the rule by id in the patch (Item rules tab, "Change in this set") | anything the template did not foresee |
| Add a rule | new id in the patch | a company-specific item |

How a slot becomes a question (all optional; `rules.ts`, `SlotPrompt`): `section` (one of the rule
set's `sections`, which give titles and order), `question` (worded as the rulebook would answer it),
`help`, `example`, `optionLabels` for choices, and `dependsOn` (`{ param, values }`: the question
only applies when another slot has one of these values; the UI shows it under that question and
hides it otherwise, without evaluating any expression). A formula slot (`type: "formula"`) holds an
expression plus `unit`, `variables` (what the formula can read, in words) and `choices` (ready-made
answers, `{ label, value }`, offered as a pick list; the formula stays visible and editable, and an
edited one is "custom"; the engine reads only `value`). A `formula` quantity's `expr` and a derived
rule's `quantity` accept `{ "param": "<formula slot>" }`, and traces say which slot the formula came
from. Every template formula slot's default is one of its choices (`test_template_formula_choices_run`
runs each choice on the Duplex). A number slot's `min` / `max` are checked: Check (and Save) report
an answer outside them, and a slot's `section` must be one of the rule set's sections.

**Everything about questions has a form** (Library › rule set › Advanced › Questions setup): sections
(title, introduction, order, add, remove; a patch can retitle the parent's and add its own), and per
question its wording, short name, section, kind of answer (changing it resets the answer), stored
name (renaming updates every `{ "param" }` and `p.name` in the set), help, example, unit, allowed
range, the possible answers with their texts, ready-made formulas, and "only ask when" (`dependsOn`).
Renaming an item's id updates the calculated items of the same set that read from it. The JSON tab
stays for everything else, but nothing in the rule type needs it.

**Formulas in the editor** are shown with readable names: `(src.length + 2 * p.working_space) *
src.height` reads `([Length] + 2 * [Working space]) * [Height]`. Brackets hold a label from the
"Names" list (measured values, element descriptions, lists such as `[Openings › Area]`, line values,
and the rule set's own answers by their label); text in quotes is taken as written; "code" shows the
stored text. The editor only renames (`apps/web/src/library/readable.ts`, labels in `vocab.ts`
`NAMES`); the engine still parses and evaluates everything. `src.` is optional in calculated
(derived) items, because their context holds the source's fields under their own names too, so
edited formulas are stored without it.

Template v1 has 13 sections and 62 questions: general (lines per storey), earthworks and
substructure, concrete with formwork and reinforcement, walls, openings and deductions, floors and
slabs, roofs, stairs and railings, finishes, steel and other members, services (MEP), preliminaries
and sums, and what is included. Work that is rarely modelled (excavation, blinding, hardcore,
formwork, reinforcement, ceiling paint, skirting) is derived and **off by default**, so the defaults
still reproduce the Duplex acceptance numbers; `test_template_*` in `test_duplex.py` switch each
answer on and check the effect (ceiling paint matches the hand-made BoQ's 243.46 m2). Renovation
work is an answer too (`renovation_scope`: everything, or new work only, with `measure_demolition` as a
follow-up), as are recesses in walls measured in m3 (`wall_recess_mode`), columns standing in rooms
(`room_column_mode`, with room finishes) and elements passing through slabs (`deduct_embedded`), all
neutral by default (`test_scope_recess_building.py`). Growing it: when standards
keep needing a question the template lacks, add a slot with a neutral default, point the rule at
it, and keep the acceptance test green. Patches built on the template pick up new questions with
their defaults automatically. The questions still need review by someone who knows the standards
(see 11).

## Anatomy of a rule set

```jsonc
{
  "schemaVersion": "1.0",
  "id": "as-modelled", "name": "As modelled", "version": "0.1.0",
  "meta": { "unitSystem": "metric", "locale": "en", "basedOn": "...", "description": "..." },
  "defaults": { "rounding": { "step": 0.01, "mode": "nearest", "at": "line" }, "onMissing": "flag", "breakdown": "element" },
  "params":  { /* slots */ },
  "items":   [ /* element -> BoQ line */ ],
  "derived": [ /* line or element -> extra line (formwork, paint, rebar estimates) */ ],
  "manual":  [ /* lines with no model: preliminaries, provisional sums, lump sums */ ]
}
```

### Slots (`params`)

```json
"wall_opening_mode":      { "type": "choice",  "value": "all", "options": ["none","all","over_threshold","excess_only","per_element_sum"], "label": "Wall opening deduction" },
"wall_opening_threshold": { "type": "number",  "value": 0, "unit": "m2", "label": "Wall opening threshold" },
"wall_add_reveals":       { "type": "boolean", "value": false, "label": "Add reveals of deducted openings" },
"include_furniture":      { "type": "boolean", "value": false, "label": "Include loose furniture" }
```

Any field typed `Value<T>` takes a literal or `{ "param": "name" }`. In expressions, write
`p.name`. A patch can override just the value: `"wall_opening_threshold": { "value": 0.5 }`.

### Selecting elements (`match`)

```jsonc
{ "ifcClass": "IfcWall" }                                    // class (subtypes normalised, e.g. IfcWallStandardCase)
{ "family": ["planar", "volumetric"] }                       // measurement family
{ "field": "material", "op": "under", "value": "concrete" }  // dictionary term or anything beneath it
{ "field": "is_external", "op": "eq", "value": true }
{ "all": [ ... ] }  { "any": [ ... ] }  { "not": { ... } }
{ "expr": "thickness > 0.2 AND UNDER(element_type, \"wall.party\")" }   // escape hatch
```

Ops: eq, neq, in, not_in, gt, gte, lt, lte, between, contains, starts_with, matches (regex),
exists, missing, under. Fields: any measured field, plus ifc_class, predefined_type, type_name,
family, family_name, material, element_type, space_type, discipline, storey, space, zone,
status, is_external, load_bearing, system, profile, nominal_size, tag, `props.<Pset.Prop>`.

**Match on terms, not raw names.** `material under "concrete"` works on "Beton C25/30",
"Concrete - Cast In Situ" and "BETON MB30" alike, because the dictionary resolved them first.

### Quantity (`quantity: QuantitySpec`)

| Kind | Options | Default unit |
|---|---|---|
| `count` | | nr |
| `length` | `basis`: axis, overall, clear, centreline, girth, perimeter; `deductions` | m |
| `area` | `surface`: main, side_a, side_b, both, larger, smaller, mean, top, bottom, edges, footprint, developed; `start`: gross or net; `deductions` | m2 |
| `volume` | `start`: gross or net; `deductions` | m3 |
| `mass` | `basis`: nominal_per_length, volume_density, reported; `density` | kg (use `unit: "t"` for tonnes) |
| `perimeter` | | m |
| `choose` | `pick` (usually a choice slot), `options`: map of name -> QuantitySpec | from the option |
| `when` | `if` (expression), `then`, `else` | from the branch |
| `formula` | `expr`, `unit` (required) | as given |

Units are converted from SI at output (mm, km, ft, ft2, yd2, ft3, yd3, t, lb supported).

### Deductions

```json
{ "what": "openings", "mode": { "param": "wall_opening_mode" }, "threshold": { "param": "wall_opening_threshold" },
  "compareBy": "area", "addReveals": { "param": "wall_add_reveals" }, "where": "kind = \"window\"" }
```

| Mode | Meaning |
|---|---|
| `none` | never deduct |
| `all` | deduct every opening |
| `over_threshold` | deduct openings larger than the threshold, in full |
| `excess_only` | deduct only the part of each opening above the threshold |
| `per_element_sum` | deduct all if the element's openings together exceed the threshold |

`what`: openings, doors, windows, voids; `embedded`: columns, beams and members passing through
the element (`embedded[]` on the measured element, from the solids, also across federated models):
an area measure deducts the area they take out of the face (shared volume / thickness), a volume
measure that area x the part's thickness (so a layer gets its share); `compareBy` defaults to
volume for them, and `where` sees `guid`, `ifc_class`, `volume`, `area`, `model`. Rooms carry the
columns standing in them as `embedded` too (area = shared volume / room height), so a room's floor area
can lose them. `recesses`: openings the model marks as recesses (IFC4 `IfcOpeningElement` RECESS, or
ObjectType "Recess" in IFC2x3); deducted as their face area, or area x recess depth for volumes. They
are never part of `openings` / `voids`, of an element's gross and net area, or of a room's openings.
`compareBy`: area, width, height, length, volume. On `surface: "both"`, openings are deducted from each face.

### Scope: what the BoQ leaves out

`RuleSet.scope.exclude` is a list of selectors; elements matching any of them are left out of the BoQ:
not measured, not asked about as unmatched, counted in the log ("left out of this BoQ by the rule
set's scope"). Items with `scope: "out"` measure exactly those elements and nothing else, e.g. as-modelled's
`demolition` item (elements with status `demolish`, m3 where they have a volume, else counted). A
patch's `scope` replaces its parent's. as-modelled's scope is one condition bound to an answer:
`p.renovation_scope = "new_work" AND (status = "existing" OR status = "demolish")`. An element's
`status` comes from Revit phasing properties or, in any other tool, the IFC `Status` property of its
common property set (NEW, EXISTING, DEMOLISH, TEMPORARY).

### Whole-building values

Every formula can read `building.<field>` (`BuildingMeasures` in `measured.ts`): `gross_floor_area`,
`net_floor_area`, `footprint_area`, `gross_volume`, `space_volume`, `height`, `storeys`. They come from
the IFC building's own quantities (`Qto_BuildingBaseQuantities`) where present, else are derived from
all models of the run (floor slab plan areas, room areas and volumes, storey heights; marked
approximate). `BoqResult.building` holds them with their provenance, and the log says how each was
found. A manual item may take its quantity from a `formula` over answers and building values, e.g.
`building.gross_volume / 100` for an item priced per 100 m3 of building.

### Breakdown, splitting and labels

| Field | Effect |
|---|---|
| `breakdown` | element (default), layer (one source per material layer; layer volume = area x layer thickness), face, material (layers grouped by material), child (aggregate parts) |
| `partFilter` | expression applied after breakdown, e.g. `NOT UNDER(material, "air_gap")` |
| `parts` | `skip` (default): when an enabled rule measures an aggregate's parent (roof, stair), its parts are not measured again. `include`: measure them anyway (as-modelled uses it for railings that belong to stairs) |
| `lineKey` | fields or expressions whose values split lines; same values are summed. The unit is always part of the key |
| `bands` | split by numeric ranges of a field, e.g. height above 3.5 m; labels appended to the description |
| `description` | template: `{type_name}`, `{thickness*1000}`, `{p.x}`, `{expr: ...}`; missing values render as "-" |
| `factor`, `minimum` (per element or line), `rounding` (step, nearest/up/down, at element or line) | |
| `onMissing` | flag (line kept, value missing noted), skip (element left out, warned), ask (blocking `missing_data` question), `{ "default": n }` (logged default) |
| `claims` | double-count guard: two rules claiming the same name ("body", "finish_side_a") on one element give a warning |
| `tags` | free labels that classification maps can match |
| `enabled` | boolean or slot; disabled rules exclude what they match (as-modelled's furniture rule is off via `include_furniture`) |

### Derived rules

Quantities for work that is not modelled: formwork, paint, skirting, reinforcement estimates.

```json
{ "id": "paint-walls", "from": ["walls"], "scope": "element",
  "where": "COUNT(src.layers WHERE UNDER(material, \"board.plasterboard\")) > 0",
  "quantity": "SUM(src.layers.area WHERE UNDER(material, \"board.plasterboard\"))",
  "unit": "m2", "description": "Paint to plasterboard wall surfaces", "lineKey": [], "tags": ["finish"] }
```

- `scope: "element"`: evaluated per source element; `src.*` are its measured fields.
- `scope: "line"`: evaluated per source line; `src.qty` is the line quantity, `keys.*` its line keys.
- `lineKey` **absent**: one derived line per source line (keeps the source's split).
  **Present**: group by those source fields. **`[]`**: one single line.
- `factor`, `rounding`, `onMissing`, `enabled` (e.g. `{ "param": "rebar_estimates" }`) as for items.

### Manual items

```json
{ "id": "prelims-site-setup", "kind": "preliminary", "description": "Site setup and welfare", "unit": "item" }
```

Kinds: preliminary, provisional_sum, lump_sum, daywork, other. No `quantity` = a flagged line for
the user to fill. `amount` can carry a money value for sums.

## Extending a rule set (patches)

A firm's rules usually extend a base and state only the differences:

```json
{
  "schemaVersion": "1.0", "id": "acme-house-rules", "name": "ACME Ltd house rules", "version": "0.1.0",
  "extends": "standard-style-example",
  "meta": { "basedOn": "ACME internal practice" },
  "params": { "wall_opening_threshold": { "value": 1 }, "formwork_factor": { "value": 1.05 }, "include_furniture": { "value": true } },
  "derived": [ { "id": "skirting", "from": ["coverings"], "scope": "element",
                 "quantity": "src.perimeter - SUM(src.openings.width WHERE kind = \"door\")", "unit": "m", "description": "Skirting" } ],
  "manual": [ { "id": "acme-cleaning", "kind": "lump_sum", "description": "Final cleaning", "unit": "sum" } ]
}
```

Merge rules: params merge by name; `sections` merge by id (a new title or intro replaces the parent's,
new sections come after the parent's, so a patch can group its own questions); items, derived and
manual override by `id`, new ids are added;
`remove: ["walls"]` drops ids from the parent. The engine flattens the chain at run time and
stores the flattened snapshot with the result (`ruleSet.meta.chain`, e.g.
`as-modelled -> standard-style-example -> acme-house-rules`). `integrity()` catches a removed
item that derived rules still read from; it found exactly that bug in an early version of
`standard-style-example`.

## The presets in this repo

| Preset | Extends | What it demonstrates |
|---|---|---|
| `as-modelled` | | The master template (see above): 13 sections, 62 questions, 6 formula slots (each with ready-made choices), a scope for renovation work. Defaults give net quantities as modelled, all openings deducted, walls in m2 (m3 switch off by default), windows and doors counted, steel in t by nominal kg/m, roofs by developed area, 30 item rules covering every measurement family (including demolition, off by default), 12 derived (formwork walls / slab edges / footings; rebar estimates for slabs / walls / footings; paint to walls and ceilings; skirting; excavation, blinding, hardcore), 3 manual. Every standard-sensitive value is a slot. Reproduces the hand-made Duplex BoQ. |
| `standard-style-example` | as-modelled | What encoding a detailed standard looks like: openings over 0.5 m2 deducted with reveals added back, walls of 120 mm and more in m3, windows by area, rebar estimates on, walls replaced by `wall-layers` (one line per element type, material and thickness, air gaps skipped), derived formwork and paint re-pointed at `wall-layers`, a height band slot. Values are placeholders. |
| `acme-house-rules` | standard-style-example | A firm's tweaks on top of a standard: three slot values, a skirting derived rule, a lump sum. |
| `demo-tweaked` | as-modelled | The smallest possible custom rules: only three slot values changed (openings up to 1.0 m2 kept, windows by area). Compare it with as-modelled in the app. |
| `demo-custom` | | A complete small rule set from scratch: thick walls (25 cm and more) in m3 and thin ones in m2 by element type; openings up to 1 m2 kept; all concrete in one line per class and material; floors by material; windows by area; doors counted; formwork to footings with an allowance factor; one manual item. Leaves the rest of the model unmeasured on purpose, which shows up as non-blocking `unmatched` questions. |

Numbers on the Duplex: as-modelled gives 41 lines. demo-tweaked raises the external
brick-on-block wall total (walls and parapet) from 267.16 to 274.62 m2, because the twelve
819 x 759 mm windows (0.62 m2 each) are no longer deducted, and turns the window lines into m2
(`test_slot_change_changes_numbers`). demo-custom gives 19 lines and 21 grouped
unmatched-element questions, and the status stays complete because those are not blocking.

## Writing a new rule set

1. Decide whether it is a patch (most cases) or standalone. Patches are shorter and inherit fixes.
2. In the Library: "+ New rule set", extend `as-modelled` (or copy `demo-custom` for a standalone
   set), answer the Settings questions, and **Save**: it is written to `presets/user/<id>.json` and
   appears in the BoQ's rule-set choices. By hand: copy `presets/rules/demo-tweaked.json` (patch)
   or `demo-custom.json` (standalone) and give it a new `id` matching the file name.
3. Set slot values. Override or add items (BoQ items tab) only where the method differs.
4. Generate in the app, open lines to check formulas and contributions, read the log for
   `match` (what each rule took) and `warning` entries, and answer or inspect questions.
5. `npm run test:engine` validates every preset against the schema and checks integrity.

When something cannot be expressed: first try `when`, `choose` or a `formula`; if the same
pattern appears in more than one standard, add a slot or option to the type (`rules.ts`), run
codegen, implement it in `rules.py`, and document it here.

## Rule-language levels and limits

| Level | What users do | Status |
|---|---|---|
| Parameters | Set slot values in forms | Supported; the planned v1 editor |
| Formulas | Arithmetic, conditions, aggregates over openings / layers / faces / children | Supported |
| Scripts | Custom code for anything else | Not planned (security and support cost) |

"Any rules" means any rules built from the engine's measured fields and the expression language.
The engine runs whatever it is given and does not judge it: a wrong rule gives a wrong BoQ,
faithfully calculated. It does catch mechanical problems: schema errors, integrity, references
to missing data (questions), unmatched or double-claimed elements.

Faces and rooms: wall `side_a` / `side_b` / `larger` / `smaller` / `mean` / `both` are real sides; the
`face` breakdown gives one part per face with `space`, `space_name`, `space_type`, `is_external`
(e.g. paint per room type: breakdown face, lineKey `space_type`). Rooms (IfcSpace, family `space`) carry
`floor_area`, `ceiling_area`, `wall_area`, `wall_area_net`, `skirting_length`, `perimeter`, `height`,
`openings` (in their walls) and `bounded_by`; as-modelled's `room-floors`, `room-ceilings`, `room-walls`
and `room-skirting` measure them when `room_finishes` is on.

Known gaps in what rules can express today (see 11): where exactly an opening sits on a face
(openings are shared over a side in proportion); standard item wording and client templates (the
item library, 08 gap 4).
