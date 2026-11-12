"""
Acceptance test: the engine with the 'as-modelled' rule set must reproduce the BoQ
that was produced by hand for the NIBS Duplex (fixtures/reference/duplex-hand-boq.xlsx).
Those numbers were checked line by line against Revit's reported quantities and the
geometry; see docs/09-validation-and-test-corpus.md.
"""
import pytest

from ifc_boq import presets
from ifc_boq.pipeline import get_boq


def run(parsed, rule_set="as-modelled", classes=("acme-cost-codes",), dicts=("global-seed",), decisions=()):
    rs, lib = presets.load_rule_set(rule_set)
    return get_boq(parsed, rs, [presets.load_classification(c) for c in classes],
                   [presets.load_dictionary(d) for d in dicts], presets.resolution(), list(decisions), lib)


def q(result, rule_id, contains=""):
    lines = [l for l in result["lines"] if l["ruleId"] == rule_id and contains in l["description"]]
    assert lines, f"no line {rule_id} / {contains!r}"
    return sum(l["quantity"] for l in lines if l["quantity"] is not None)


# (rule id, description contains, expected, unit) - expected values from the hand-made BoQ
HAND_BOQ = [
    ("footings", "Bearing Footing", 16.528, "m3"),
    ("walls", "Foundation - Concrete (417mm)", 26.861 / 0.417, "m2"),
    ("walls", "Foundation - Concrete (435mm)", 5.430 / 0.435, "m2"),
    ("slab-concrete", "127mm", 16.470, "m3"),
    ("slabs", "127mm Slab on Grade", 129.686, "m2"),
    ("steel-sections", "W310X60", 0.903, "t"),
    ("steel-sections", "W410X60", 1.728, "t"),
    ("slabs", "Wood Joist", 118.563, "m2"),
    ("roofs", "Live Roof", 132.926, "m2"),
    ("walls", "Exterior - Brick on Block", 235.779 + 31.383, "m2"),   # walls + parapet
    ("walls", "Party Wall", 71.670, "m2"),
    ("walls", "Partition (92mm", 106.396, "m2"),
    ("walls", "Plumbing (152mm", 9.390, "m2"),
    ("walls", "Furring (152 mm", 58.557, "m2"),
    ("walls", "Furring (38 mm", 2.555, "m2"),
    ("slabs", "Finish Floor - Wood", 196.921, "m2"),
    ("slabs", "Finish Floor - Ceramic Tile", 44.910, "m2"),
    ("coverings", "Gypsum Board", 243.459, "m2"),
    ("railings", "900mm Handrail", 9.489, "m"),
    ("railings", "1100mm Guard Rail", 16.669, "m"),
    ("slab-concrete", "150mm", 7.626, "m3"),
    ("slabs", "150mm Exterior Slab", 50.840, "m2"),
    ("formwork-walls", "", 153.797, "m2"),
    ("formwork-footings", "", 37.019, "m2"),
    ("paint-walls", "", 703.185, "m2"),
]
COUNTS = [("windows", "M_Fixed, 4835", 2), ("windows", "M_Fixed, 2800", 4), ("windows", "M_Fixed, 750", 4),
          ("windows", "M_Fixed, 819", 8), ("windows", "M_Casement", 4), ("windows", "Skylight", 2),
          ("doors", "1250mm", 2), ("doors", "0813", 2), ("doors", "0762", 4), ("doors", "0864", 6), ("stairs", "", 2)]


@pytest.fixture(scope="module")
def result(duplex_parsed):
    return run(duplex_parsed)


def test_complete_and_covered(result):
    assert result["status"] == "complete"
    s = result["stats"]
    assert s["unmatchedElements"] == 0
    assert s["excludedElements"] == 61 + 21     # loose furniture (61) and the 21 rooms: room finishes are off by default
    assert not [w for w in result["warnings"] if w["code"] == "rule_set"]


@pytest.mark.parametrize("rule_id,contains,expected,unit", HAND_BOQ)
def test_matches_hand_boq(result, rule_id, contains, expected, unit):
    assert q(result, rule_id, contains) == pytest.approx(expected, rel=2e-3, abs=0.011)


@pytest.mark.parametrize("rule_id,contains,expected", COUNTS)
def test_counts(result, rule_id, contains, expected):
    assert q(result, rule_id, contains) == expected


def test_every_line_is_explained(result):
    for l in result["lines"]:
        if l["ruleKind"] != "manual":
            assert l["trace"]["elements"], l["key"]
            assert all(e.get("note") for e in l["trace"]["elements"]), l["key"]


def test_every_line_has_a_company_code(result):
    assert all("acme-cost-codes" in l["codes"] for l in result["lines"])


def test_party_wall_internal_by_dictionary_type(result):
    line = [l for l in result["lines"] if "Party Wall" in l["description"]][0]
    assert line["codes"]["acme-cost-codes"]["code"] == "D.02"   # IFC says IsExternal=TRUE; the dictionary type wins


def test_slot_change_changes_numbers(duplex_parsed):
    """demo-tweaked = as-modelled with openings <= 1 m2 not deducted and windows by area."""
    r = run(duplex_parsed, "demo-tweaked")
    small_windows = 12 * 0.819 * 0.759
    assert q(r, "walls", "Exterior - Brick on Block") == pytest.approx(267.162 + small_windows, abs=0.02)
    assert [l for l in r["lines"] if l["ruleId"] == "windows"][0]["unit"] == "m2"


def test_custom_rules_and_classification(duplex_parsed):
    r = run(duplex_parsed, "demo-custom", classes=("demo-trades",))
    units = {l["description"]: l["unit"] for l in r["lines"] if l["ruleId"] == "walls"}
    assert any(u == "m3" for u in units.values()) and any(u == "m2" for u in units.values())
    assert all("demo-trades" in l["codes"] for l in r["lines"])
    assert any(q_["kind"] == "unmatched" for q_ in r["questions"])          # it measures only part of the model
    assert r["status"] == "complete"                                          # unmatched is informative, not blocking


def test_unmatched_decision_assigns_rule(duplex_parsed):
    r = run(duplex_parsed, "demo-custom", classes=("demo-trades",),
            decisions=[{"questionId": "unmatched:IfcCovering:Gypsum Board", "scope": "project", "answer": "floors"}])
    ceilings = {g for q_ in run(duplex_parsed, "demo-custom", classes=("demo-trades",))["questions"]
                if q_["id"] == "unmatched:IfcCovering:Gypsum Board" for g in q_["guids"]}
    measured = {e["guid"] for l in r["lines"] if l["ruleId"] == "floors" for e in l["trace"]["elements"]}
    assert ceilings and ceilings <= measured
    assert "unmatched:IfcCovering:Gypsum Board" not in {q_["id"] for q_ in r["questions"]}


def answers(parsed, **params):
    """A user's standard as answers to the master template: a patch of slot values only."""
    lib = presets.rule_sets()
    patch = {"schemaVersion": "1.0", "id": "answers", "name": "answers", "version": "1", "extends": "as-modelled",
             "params": {k: {"value": v} for k, v in params.items()}}
    lib["answers"] = patch
    return get_boq(parsed, patch, [presets.load_classification("acme-cost-codes")],
                   [presets.load_dictionary("global-seed")], presets.resolution(), [], lib)


def test_template_answers_change_the_bill(duplex_parsed, result):
    # walls in m3 from 300 mm: the 417 mm foundation walls become m3, the 92 mm partitions stay m2
    r = answers(duplex_parsed, wall_unit="volume_from_thickness", masonry_volume_from=0.3)
    assert q(r, "walls", "Foundation - Concrete (417mm)") == pytest.approx(26.861, rel=2e-3)
    units = {l["description"]: l["unit"] for l in r["lines"] if l["ruleId"] == "walls"}
    assert units[next(d for d in units if "417mm" in d)] == "m3" and units[next(d for d in units if "Partition" in d)] == "m2"

    # one line per storey; the total is unchanged
    r = answers(duplex_parsed, lines_by_storey=True)
    ext = [l for l in r["lines"] if l["ruleId"] == "walls" and "Exterior - Brick on Block" in l["description"]]
    assert len(ext) > 1 and all(l["location"].get("storey") in l["description"] for l in ext)
    assert sum(l["quantity"] for l in ext) == pytest.approx(q(result, "walls", "Exterior - Brick on Block"), abs=0.05)

    # formwork included in the concrete item: no formwork lines at all
    r = answers(duplex_parsed, formwork_separate=False)
    assert not [l for l in r["lines"] if "formwork" in l["tags"]]

    # "tell me your formula": one face only halves wall formwork
    r = answers(duplex_parsed, formwork_walls_formula='SUM(src.faces.gross_area WHERE side = "a")')
    assert q(r, "formwork-walls") == pytest.approx(q(result, "formwork-walls") / 2, rel=1e-3)
    assert "from slot formwork_walls_formula" in [l for l in r["lines"] if l["ruleId"] == "formwork-walls"][0]["trace"]["formula"]

    # reinforcement estimates per m3 of concrete, only where a rate is given
    r = answers(duplex_parsed, rebar_estimates=True, rebar_footing_kg_m3=50)
    assert q(r, "rebar-estimate-footings") == pytest.approx(16.53 * 50 / 1000, abs=0.006)   # line rounded to 0.01 t
    assert not [l for l in r["lines"] if l["ruleId"] in ("rebar-estimate-walls", "rebar-estimate-slabs")]


def test_template_sections_beyond_walls(duplex_parsed, result):
    lines = lambda r, rid: [l for l in r["lines"] if l["ruleId"] == rid]

    # earthworks: excavation with no working space is the footing volume; working space adds to it
    flat = answers(duplex_parsed, excavation=True, working_space=0)
    assert q(flat, "excavation-footings") == pytest.approx(16.528, rel=0.03)
    assert q(answers(duplex_parsed, excavation=True), "excavation-footings") > q(flat, "excavation-footings") * 1.2
    r = answers(duplex_parsed, blinding=True, hardcore=True)
    assert q(r, "blinding-footings") > 0 and q(r, "hardcore-slabs") > 0

    # finishes: paint to ceilings matches the hand-made BoQ (3.3.2, 243.46 m2)
    assert q(answers(duplex_parsed, paint_ceilings=True), "paint-ceilings") == pytest.approx(243.46, abs=0.05)
    merged = lines(answers(duplex_parsed, finishes_by_type=False), "coverings")      # one line per kind of finish
    assert len(merged) == len({l["keys"]["predefined_type"] for l in lines(result, "coverings")})
    assert sum(l["quantity"] for l in merged) == pytest.approx(q(result, "coverings"), abs=0.05)
    assert not lines(answers(duplex_parsed, paint_walls=False), "paint-walls")

    # roofs: one line per layer of the build-up, each with the roof's area
    layered = lines(answers(duplex_parsed, roof_breakdown="layer"), "roofs")
    assert len(layered) > 1 and all(l["quantity"] == pytest.approx(132.93, abs=0.05) for l in layered)

    # stairs by plan area, railings by count
    r = answers(duplex_parsed, stairs_measure="plan_area", railing_measure="count")
    assert {l["unit"] for l in lines(r, "stairs")} == {"m2"} and q(r, "railings") == 4

    # preliminaries and sums can be left out
    r = answers(duplex_parsed, include_prelims=False, include_provisional=False)
    assert not [l for l in r["lines"] if l["ruleKind"] == "manual"]


def test_classification_table_shape(duplex_parsed):
    """The map rules the Library's classification table writes (apps/web/src/library/ClassTable.tsx)."""
    cl, base = presets.load_classification("acme-cost-codes")
    split = lambda rid, cond, code: {"id": f"t-{rid}-{cond}", "match": {"all": [{"ruleId": rid}, {"where": cond}]},
                                     "code": code, "priority": 6}
    plain = lambda rid, code: {"id": f"t-{rid}", "match": {"ruleId": rid}, "code": code, "priority": 5}
    cmap = {**base, "id": "table", "onUnmapped": "flag", "rules": [
        split("walls", "is_external = true", "D.01"), split("walls", "is_external = false", "D.02"), plain("walls", "D.01"),
        split("slabs", 'UNDER(material, "concrete")', "C.02"), plain("slabs", "F.01"),
        plain("formwork-walls", {"fromSource": True}),
    ]}
    rs, lib = presets.load_rule_set("as-modelled")
    r = get_boq(duplex_parsed, rs, [(cl, cmap)], [presets.load_dictionary("global-seed")], presets.resolution(), [], lib)
    code = lambda rid, text="": {l["codes"]["acme-cost-codes"]["code"] for l in r["lines"]
                                 if l["ruleId"] == rid and text in l["description"] and "acme-cost-codes" in l["codes"]}
    assert code("walls", "Exterior - Brick on Block") == {"D.01"}
    assert code("walls", "Partition") == {"D.02"}
    assert code("slabs", "Slab on Grade") == {"C.02"}
    assert code("formwork-walls") <= code("walls") and code("formwork-walls")
    assert not code("footings")                                        # not in the table, onUnmapped = flag


def test_names_in_model(duplex_parsed):
    """The dictionary editor's 'Names in this model' view (pipeline.names_in_model)."""
    from ifc_boq.pipeline import names_in_model
    seed = presets.load_dictionary("global-seed")
    names = names_in_model(duplex_parsed, [seed], presets.resolution())
    by = {(n["field"], n["raw"]): n for n in names}
    brick = by[("layer_material", "Masonry - Brick")]
    assert brick["term"] == "masonry.brick" and brick["dictionary"] == "global-seed" and brick["count"] > 0
    assert "IfcWall" in brick["classes"]
    footing = by[("type_name", "Bearing Footing - 900 x 300")]
    assert footing["term"] is None and footing["classes"] == ["IfcFooting"] and footing["count"] == 7
    # an unsaved draft dictionary (as the editor sends it) resolves it, and says where the answer came from
    draft = {"schemaVersion": "1.0", "id": "draft", "name": "draft", "version": "1", "layer": "project",
             "entries": [{"id": "e1", "field": "type_name", "match": {"exact": "Bearing Footing - 900 x 300"},
                          "term": "concrete.in_situ", "source": "user"}]}
    after = {(n["field"], n["raw"]): n for n in names_in_model(duplex_parsed, [seed, draft], presets.resolution())}
    footing = after[("type_name", "Bearing Footing - 900 x 300")]
    assert (footing["term"], footing["layer"], footing["dictionary"]) == ("concrete.in_situ", "project", "draft")


def test_scene_index_maps_aggregates_to_their_parts(duplex_parsed):
    """The 3D viewer highlights a line's elements; a roof or stair has no mesh of its own, only its parts."""
    from ifc_boq.service import model_scene
    els = duplex_parsed["elements"]
    meshes = {e["id"] for e in els if e["ifcClassBase"] not in ("IfcRoof", "IfcStair")}   # as in geometry.glb
    scene = model_scene(duplex_parsed, meshes)
    assert all(e.get("parts") for e in scene["elements"].values())
    roof = next(e for e in els if e["ifcClassBase"] == "IfcRoof")
    assert scene["elements"][roof["id"]]["parts"] and set(scene["elements"][roof["id"]]["parts"]) <= set(roof["childIds"])
    wall = next(e for e in els if e["ifcClassBase"] == "IfcWall")
    assert scene["elements"][wall["id"]]["parts"] == [wall["id"]] and scene["elements"][wall["id"]]["storey"]


FORMULA_CHOICE_RULES = {  # formula slot -> (derived rule that uses it, the answer that switches it on)
    "excavation_formula": ("excavation-footings", {"excavation": True, "blinding": True}),
    "formwork_walls_formula": ("formwork-walls", {}),
    "formwork_slab_edges_formula": ("formwork-slab-edges", {}),
    "formwork_footings_formula": ("formwork-footings", {}),
    "paint_walls_formula": ("paint-walls", {}),
    # skirting_formula: the Duplex has no FLOORING coverings, so its choices are only syntax-checked (check())
}


@pytest.mark.parametrize("slot", sorted(FORMULA_CHOICE_RULES))
def test_template_formula_choices_run(duplex_parsed, slot):
    """Every ready-made answer of a formula question gives a quantity on the Duplex, and the default is one of them."""
    p = presets.rule_sets()["as-modelled"]["params"][slot]
    assert p["value"] in [c["value"] for c in p["choices"]]
    rule, switches = FORMULA_CHOICE_RULES[slot]
    totals = []
    for c in p["choices"]:
        r = answers(duplex_parsed, **switches, **{slot: c["value"]})
        lines = [l for l in r["lines"] if l["ruleId"] == rule]
        assert lines and all(l["quantity"] is not None for l in lines), (slot, c["label"])
        totals.append(round(sum(l["quantity"] for l in lines), 3))
    assert all(t > 0 for t in totals), (slot, totals)


def test_template_formula_slot_is_checked():
    lib = presets.rule_sets()
    bad = {"schemaVersion": "1.0", "id": "bad", "name": "bad", "version": "1", "extends": "as-modelled",
           "params": {"formwork_walls_formula": {"value": "SUM(src.faces.gross_area WHERE"}}}
    assert any("formwork_walls_formula" in p for p in presets.check("rules", bad))
    assert lib["as-modelled"]["sections"] and all(
        p.get("section") and p.get("question") for p in lib["as-modelled"]["params"].values())


@pytest.mark.parametrize("rid", ["standard-style-example", "acme-house-rules"])
def test_other_presets_run(duplex_parsed, rid):
    r = run(duplex_parsed, rid, dicts=("global-seed", "acme-company", "project-duplex"))
    assert r["lines"] and not [w for w in r["warnings"] if w["code"] == "rule_set"]


def test_unknown_material_blocks_until_answered(duplex_parsed):
    import copy
    p = copy.deepcopy(duplex_parsed)
    for m in p["catalogues"]["materials"]:
        if m["name"] == "Concrete":
            m["name"] = "Mystery Mix 7"
    r = run(p)
    qs = [x for x in r["questions"] if x["id"] == "name:layer_material:Mystery Mix 7"]
    assert qs and qs[0]["blocking"] and r["status"] == "needs_input"
    r2 = run(p, decisions=[{"questionId": "name:layer_material:Mystery Mix 7", "scope": "project", "answer": "concrete"},
                           {"questionId": "name:material:Mystery Mix 7", "scope": "project", "answer": "concrete"}])
    assert r2["status"] == "complete"
    assert q(r2, "slab-concrete", "127mm") == pytest.approx(16.470, abs=0.01)


def test_result_matches_the_typescript_contract(result):
    """BoqResult must validate against the schema generated from packages/types/src/engine.ts."""
    import json
    import jsonschema
    from ifc_boq.paths import SCHEMAS
    jsonschema.validate(json.loads(json.dumps(result)), json.loads((SCHEMAS / "boq-result.schema.json").read_text(encoding="utf-8")))


def test_parsed_model_matches_the_typescript_contract(duplex_parsed):
    import json
    import jsonschema
    from ifc_boq.paths import SCHEMAS
    jsonschema.validate(duplex_parsed, json.loads((SCHEMAS / "parsed-model.schema.json").read_text(encoding="utf-8")))
