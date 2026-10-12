# 05 Engine

The Python package `engine/ifc_boq`. Public surface (keep it this small; the future worker
wraps exactly these):

```python
from ifc_boq.parse import parse_file                 # IFC path -> (ParsedModel dict, parser)
from ifc_boq.pipeline import get_boq                 # -> BoqResult dict
from ifc_boq.export_xlsx import export               # BoqResult + meta -> xlsx bytes

result = get_boq(parsed, rules, classifications=[(code_list, cmap), ...],
                 dictionaries=[global, company, project], resolution=settings,
                 decisions=[...], rule_library={id: rule_set})   # library only needed for patches
```

`service.py` (preset ids -> run -> stored files) and `presets.py` (load and validate presets)
are conveniences for the dev API and CLI.

## Stages

| # | Stage (log name) | Module | In | Out |
|---|---|---|---|---|
| 1 | parse | `parse.py` | IFC file | `ParsedModel` + `geometry.glb`, verification checks. Slow; cached by file hash. |
| 2 | names | `names.py` | raw names + dictionaries + name decisions | term per (field, raw text); extracted values |
| 3 | measure | `measure.py` | ParsedModel + resolver | `MeasuredElement[]` with one adopted number per quantity and its provenance |
| 4 | match / quantity | `rules.py` `run_items` | elements + flattened rule set + decisions | item lines with traces |
| 5 | derived | `rules.py` `run_derived` | item lines | derived lines |
| 6 | manual | `rules.py` `run_manual` | rule set | manual lines |
| 7 | coverage | `pipeline.py` | matched / excluded / covered sets | `unmatched` questions |
| 8 | names that matter | `pipeline.py` | unresolved names + fields the rules reference | `unknown_name` questions (blocking only if needed) |
| 9 | classify | `classify.py` | lines + each (code list, map) + code decisions | codes per line per system; `unclassified` / conflict questions; warnings |
| 10 | decision, summary | `pipeline.py` | decisions, questions | answered questions removed, status, stats, sorted lines |

Lines are sorted by the first classification's code path, then by rule order, then description.

### 1. Parse (`parse.py`)

ifcopenshell reads the file; `ifcopenshell.geom` meshes every element with openings cut
(world coordinates, parallel iterator). Geometry is requested in file units and scaled with
the parser's own unit factor: the kernel can miss a unit assignment and return millimetres as
metres (ISO sample `wall-with-opening-and-window`: a 6 m2 wall came out as 5,000,000,000 m2).
Each mesh goes into trimesh for volume, area, bounding box and watertightness; inconsistent face
winding is repaired before measuring (this is what fixed the Duplex party wall: 433 m3 raw,
25.83 m3 repaired). `closed` is true when the mesh is watertight, or when its only open edges
are T-junctions (every boundary loop has ~zero vector area), which tessellated exports produce;
an open pipe end or a missing face is a loop with real area. The oriented bounding box
(`obbExtents`, `obbAxes`; numpy only: the better of the minimum-area plan rectangle with the
vertical extent and the principal axes) is taken on the largest disjoint body (`bodyCount`),
so measuring does not depend on world axes. Classification references on a type are inherited
by its occurrences. Pairwise solid intersections
(trimesh booleans on the manifold3d engine, for walls, slabs, footings, beams, columns,
members, coverings, plates, piles, roofs; pairs skipped when bounding boxes do not overlap;
minimum 0.001 m3) catch double counting. The pair loop is O(n²): fine for the Duplex, needs a
spatial index before large models. Material,
type, profile, layer set, property and quantity set extraction keeps everything raw. Checks are
grouped and summarised (`CheckCode`, see 04). The parser makes no decisions.

Run standalone: `python -m ifc_boq.parse model.ifc out_dir [--schema ...] [--no-overlaps]`.

### 2. Names (`names.py`)

`Resolver` resolves raw text per field (material, layer_material, type_name, name, object_type,
ifc_class, predefined_type, system, space_name, props.*) to a **term**. Order: decision layer
(this run's answers to `unknown_name` questions) -> project -> company -> global; within a layer
exact -> startsWith -> regex -> contains. Matching folds case and accents (`đ` -> `dj`). Entries
can carry a `when` condition over the element context (so "CT" can mean different things on
ceilings and slabs). Dictionary regexes are ECMAScript syntax; `py_regex` converts named groups.
Extractors pull values out of names (Revit "Family:Type:Id", thicknesses like "25 cm",
strength classes, steel profiles, pipe sizes). Results are cached per (field, raw, context).
`under(term, root)` answers term-hierarchy questions for rules and maps. Details in 07.

### 3. Measure (`measure.py`): the adoption policy

This is where the engine decides **which number to trust**. It never looks at rules. Constants
live at the top of the file; the list of reported-quantity sources is data
(`data/quantity_sources.json`: IFC `Qto_*BaseQuantities` first, then `BaseQuantities`, then
authoring-tool sets such as `PSet_Revit_Dimensions`; ArchiCAD entries are placeholders that
still need checking against a real ArchiCAD export).

| Quantity | Policy (v0) | Why |
|---|---|---|
| volume | reported if present, else geometry, but only from a **closed** mesh (watertight, or closed with T-junctions). If both exist and differ by more than 1%, the reported value is still used and a warning is logged | Reported values are join-aware; geometry double counts at junctions (Duplex party wall stub: geometry +42%). Tessellated exports leave T-junctions; their volume is exact |
| thickness | material layer set total, else reported, else smallest extent of the **oriented** bounding box (of the largest body) | World-axis extents gave a rotated bridge wall a thickness of 10.39 m |
| wall area | net volume / thickness, else reported area | Keeps area, volume and layers consistent; Revit's Area disagreed with Volume on 7 Duplex walls |
| other areas | reported, else net volume / thickness, else for an open surface model (road markings) the one-sided mesh area | |
| gross area / volume | net + the openings hosted by the element | Gives rules both starting points |
| length | reported, else the oriented box: columns and piles along the most vertical axis, other linear elements the longest extent, others the longest horizontal extent | World axes measured rotated girders 12% short and gave columns a plan width |
| perimeter | reported, else for a closed slab-like prism P = (S - 2V/t) / t (includes opening edges) | Slab edge formwork had no perimeter outside Revit |
| aggregates | an element without its own body (IfcRoof made of slabs, IfcElementAssembly) takes the sum of its parts' adopted volumes (only if every part with a body has one) and of its planar parts' areas, nested assemblies bottom up | The certification roof had no geometry of its own |
| class | IFC2x3 generic distribution occurrences take the class their type names (IfcFlowSegment + IfcDuctSegmentType -> IfcDuctSegment); `ifc_class_raw` keeps the original | IFC2x3 has no IfcDuctSegment; rules and IFC4 files use the specific class |
| family | nearest class listed in `families.ts`, walking the schema's supertypes (IfcAirTerminal -> IfcFlowTerminal) | |
| discipline | "mep" for distribution elements, else the model's guess | MEP items in an architecture or infrastructure file were never counted |
| height | door/window OverallHeight, else reported, else vertical extent | |
| faces | walls: side a and b, each = main area (**approximation**; no per-face geometry yet). Slabs and coverings: top and bottom | Room-based finishes need real faces later |
| layers | one per material layer: area = main net area, volume = area x thickness, material resolved to a term | |
| steel mass per metre | parsed from metric W-shape names (W310X60 -> 60 kg/m). Other section families (IPE, HEA...) need a section table, not bundled; rules fall back to volume x density | Geometry was 3.5-4.7% over Revit on Duplex beams |
| main material | thickest non-air layer, resolved to a term | |
| status | from phase properties (new / existing) | Renovation filtering |
| family_name | from the Revit "Family:Type:Id" extractor | Lets rules split windows by family |

Every adopted value records its provenance (`reported`, `geometry`, `derived`, `user`), and the
measure stage logs one detail line per element explaining the choice.

### 4-6. Rules (`rules.py`)

`flatten(target, library)` resolves an `extends` chain: params merge by name, items / derived /
manual override by id, `remove` drops ids; the chain is recorded (`meta.chain` on the
snapshot). `integrity(rules)` reports problems independent of any model (e.g. a derived rule
whose source item was removed). `referenced_fields` lists which element fields the rules and
maps read (used to decide which unknown names matter).

`RuleEngine.run_items()`:

1. Applies `unmatched` decisions: elements answered "exclude" are excluded; elements assigned
   a rule id are forced into that rule.
2. Pass 1: every rule's selector against every element.
3. Pass 2, per enabled rule: skip excluded elements; skip **aggregate parts** whose parent is
   measured by an enabled rule (it takes the parent, `partFilter` included, and gets a value
   for it) unless the rule says `parts: "include"`; apply `partFilter`; add forced elements;
   record `claims`. A parent that rules take but cannot measure (a roof with no body and no
   planar parts) is measured **through its parts** instead of becoming a flagged line that
   hides them; the log says so and coverage counts it as covered. An aggregate whose parts are
   all measured or excluded is covered too.
4. For each element, `parts_of` applies the breakdown (element, layer, face, material, child),
   then `add_part` evaluates the `QuantitySpec`, handles missing values (`onMissing`: flag,
   skip, ask -> `missing_data` question, `{default}`; a numeric decision for
   `missing:{rule}:{guid}` supplies the value), applies `factor`, element `minimum`, unit
   conversion from SI, element rounding, computes line keys and bands, and appends to the line
   with a trace entry and a log detail.
5. Elements matched by a disabled rule are counted as excluded. Two rules claiming the same
   claim name on one element produce a `double_claim` warning.

`finalize_lines()` flags lines where no element had a value, applies line minimum and line
rounding, records the most common value of mixable fields (material, element_type, storey,
ifc_class, is_external...) for classification and notes which are mixed, and sets the line's
location (one storey, or the list).

`run_derived()`: for each enabled derived rule and each source line of its `from` items, either
per **line** (`src.qty`, `src.<field>`, `keys`) or per **element** (`src.<measured field>`),
filtered by `where`, evaluates `quantity`, applies `factor` and `onMissing`. Grouping:
`lineKey` absent = one derived line per source line; present = group by those fields; `[]` = a
single line. Derived lines remember their `sourceLine` (used by `fromSource` codes).

`run_manual()`: one line per enabled manual item; no quantity = flagged line ("quantity to be
entered"); amounts recorded in notes.

`describe_spec` writes the human-readable formula shown in traces, e.g.
`IF thickness >= p.masonry_volume_from THEN volume (gross) - openings[all] ELSE area (main, gross) - openings[all]`.

## The expression language (`expr.py`)

One small, safe language used by rules (`formula`, `when.if`, `where`, `partFilter`,
`lineKey` expressions, template placeholders), dictionaries (`when`) and classification maps
(`where`). Parsed to an AST once (cached), evaluated by a tree walker. No `eval`.

```
literals     12  0.5  "text"  true  false  null
operators    + - * /  ( )  = != > >= < <=  AND OR NOT
functions    IF(c,a,b) MIN(a,..) MAX(a,..) ROUND(x,step) CEIL(x,step) FLOOR(x,step)
             ABS(x) SQRT(x) PI() COALESCE(a,..) UNDER(term,"root") CONTAINS(text,"x") LOWER(x)
variables    net_area, thickness, src.length, p.opening_threshold, keys.type_name,
             props["Pset_WallCommon.FireRating"]
aggregates   SUM | COUNT | AVG | MIN | MAX over a list, optional WHERE per item:
             SUM(openings.area WHERE area > p.min_opening)
             COUNT(openings WHERE kind = "door")
             SUM(src.layers.area WHERE UNDER(material, "board.plasterboard"))
collections  openings, layers, faces, children (and src.* versions in derived rules)
```

Semantics: unknown variables are `null`; arithmetic with `null` gives `null`; comparisons with
`null` are false except `= null` / `!= null`; AND / OR treat `null` as false. Inside `WHERE`,
the item's fields shadow the outer context (`area` is the opening's area) while `p.x` still
reaches parameters. `explain()` returns the expression with values substituted
(`2 * src.length * src.height` -> `2 * 17.383 * 0.3 = 10.43`); that text is what users see in
traces and the log.

To add a function: add it to `default_functions()` in `expr.py`, document it in the `Expr`
comment in `packages/types/src/rules.ts` and here, add a case to `tests/test_expr.py`.

## Questions and decisions

| Kind | Raised by | Id | Blocking | Answer type | Effect of the answer |
|---|---|---|---|---|---|
| `unknown_name` | pipeline (names nobody resolved) | `name:{field}:{raw}` | only if `unresolved = "ask"` and the field is referenced by the rules or maps, and `askFor` allows it | term (filtered by category) | becomes a decision-layer dictionary entry; the name resolves on every later run |
| `missing_data` | rules, `onMissing: "ask"` | `missing:{ruleId}:{guid}` | yes | number (in the line unit) | value used for that element, marked user-supplied |
| `unmatched` | pipeline coverage | `unmatched:{ifc_class}:{type_name}` | no | rule id or `exclude` | elements forced into that rule, or excluded |
| `unclassified` | classify, `onUnmapped: "ask"` | `unclassified:{system}:{lineKey}` | no | code from that list | code applied with source `decision` |
| `classification_conflict` | classify, `onConflict: "ask"` | `classconflict:{system}:{lineKey}` | no | code | (answer currently informative; first rule still wins) |
| `double_claim`, `contradiction`, `overlap` | defined in the type | | | | **not raised yet**: double claims are warnings; contradictions and overlaps appear as parse checks |

Ids are built from content so the same situation produces the same id on every run and every
new model version; that is what lets stored decisions re-apply (D19). A decision with
`answer: null` dismisses a question. Status is `needs_input` only while a blocking question is
open (D20).

## Calculation log (`log.py`)

`CalcLog` collects ordered entries `{seq, stage, level, message, ruleId?, lineKey?, guid?, data?}`.
Levels: `info` (one per step or line), `detail` (one per element or name), `warning`.
Stages: parse, names, measure, match, quantity, derived, manual, classify, decision, summary.
Write messages for a user checking a number, not as a debug dump: say what was chosen and why,
with the numbers. The UI filters by stage, line and text; Excel gets a Log sheet.

## Excel export (`export_xlsx.py`)

| Sheet | Content |
|---|---|
| BoQ | Priced-bill layout grouped by the first classification: Ref, Description, Unit, Qty, Rate (yellow input), Amount (formula), subtotals per group and a total, all live formulas. Flagged lines highlighted. |
| Calculation | Every line with its formula, parameters and each element's contribution |
| Lines | Flat table of all lines with codes in every system (for filters and pivots) |
| Log | The calculation log |
| Questions | Open questions, warnings, verification checks |
| Inputs | Model, rule set chain and parameter values, dictionaries, classifications, decisions |

Formulas were verified to recalculate with zero errors in LibreOffice.

## Command line (`cli.py`)

```bash
npm run boq -- model.ifc [--rules as-modelled] [--dict global-seed acme-company] \
   [--class acme-cost-codes demo-trades] [--decisions answers.json] \
   [--out boq.xlsx] [--json result.json] [--save-parsed parsed.json] [--quiet]
```

Accepts an IFC or a saved `parsed.json` (much faster). Preset arguments take ids or paths.
Prints the BoQ table and a summary; exits with code 2 when the result needs input.

`npm run corpus -- <folder> [--rules id] [--out dir] [--no-overlaps]` (`corpus.py`) runs every
IFC under a folder, validates both outputs against the schemas and prints one row per file
(measured, unmatched, excluded, flagged, blocking questions, parse checks). With `--out` it
keeps parsed.json, result.json and summary.json per file to compare runs after an engine change.

## Tests (`engine/tests`)

| File | Covers |
|---|---|
| `test_expr.py` | Values of many expressions (operators, null semantics, functions, aggregates with WHERE, an opening-deduction formula), `explain()` substitution, proof that Python `eval` is never reachable |
| `test_presets.py` | Schemas exist; every preset loads and validates; every rule set flattens with a clean integrity check; maps only emit codes that exist; dictionary entries point to defined terms |
| `test_names.py` | 26 messy multilingual names (`messy_names.json`) resolve to the right terms, including "CT" meaning different things on coverings and slabs and staying unknown on walls; the decision layer wins over dictionaries; extractors |
| `test_certification_samples.py` | buildingSMART samples and a hand-written IFC: unit scaling (mm the kernel misses, inch), one scene giving the same numbers in IFC2x3 / IFC4 / IFC4.3, walls agree with `Qto_WallBaseQuantities`, roof from its slabs, parent measured through its parts, T-junction volumes trusted and real holes rejected, rotated wall / sloped beam / rotated slab perimeter / two-body wall from the oriented box, IFC2x3 MEP class from type, discipline guess, marker objects excluded, library-style material names, type-level classification |
| `test_duplex.py` | Acceptance: as-modelled reproduces the hand-made BoQ (`HAND_BOQ`, counts); every line explained; every line coded; party wall internal by dictionary type; slot change changes numbers (demo-tweaked); custom rules and classification (demo-custom + demo-trades); unmatched decision assigns a rule; other presets run; unknown material blocks until answered; contract tests for BoqResult and ParsedModel |

`conftest.py` parses the Duplex once per session (about 5 s).

## Extending: where things go

| You want to | Change |
|---|---|
| Support a new authoring tool's quantity set | `data/quantity_sources.json` (data, not code) |
| Fix an exporter quirk (bad geometry, odd property) | `parse.py` (repair or check) or `measure.py` (adoption), plus a test with a fixture file |
| Add a measured field | `measured.ts` + `MeasuredField`, `npm run codegen`, compute it in `measure.py` |
| Add a quantity kind, surface, deduction mode or breakdown | `rules.ts`, codegen, `rules.py` (`quantity`, `surface_values`, `deductions`, `parts_of`), `describe_spec`, docs 06 |
| Add a question kind | `engine.ts` `QuestionKind`, raise it with a deterministic id, apply its decision, add the answer control in `apps/web/src/components/QuestionsView.tsx` |
| Add an export format | a new module beside `export_xlsx.py` taking `BoqResult` |
| Change which number is trusted | `measure.py` only. Never in a rule set. |

Never special-case a preset id in Python. If a rule set cannot express something, extend the
rule type.
