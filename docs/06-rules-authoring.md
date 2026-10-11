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

`what`: openings, doors, windows, voids (working); embedded, recesses (accepted by the type,
**ignored by the engine** with a note; needs embedded-element geometry). `compareBy`: area,
width, height, length, volume. On `surface: "both"`, openings are deducted from each face.

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

Merge rules: params merge by name; items, derived and manual override by `id`, new ids are added;
`remove: ["walls"]` drops ids from the parent. The engine flattens the chain at run time and
stores the flattened snapshot with the result (`ruleSet.meta.chain`, e.g.
`as-modelled -> standard-style-example -> acme-house-rules`). `integrity()` catches a removed
item that derived rules still read from; it found exactly that bug in an early version of
`standard-style-example`.

## The presets in this repo

| Preset | Extends | What it demonstrates |
|---|---|---|
| `as-modelled` | | The base: net quantities as modelled, all openings deducted, walls in m2 (m3 switch off by default), windows and doors counted, steel in t by nominal kg/m, roofs by developed area, 17 item rules covering every measurement family, 5 derived (formwork walls / slab edges / footings, rebar estimate, paint), 3 manual. Every standard-sensitive value is a slot. Reproduces the hand-made Duplex BoQ. |
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
2. Copy `presets/rules/demo-tweaked.json` (patch) or `demo-custom.json` (standalone), give it a
   new `id` matching the file name.
3. Set slot values. Override or add items only where the method differs.
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

Known gaps in what rules can express today (see 11): real per-face areas (faces are
approximated), embedded-element deductions, room-based finishes (needs faces bounded to spaces),
cross-model scope (federation).
