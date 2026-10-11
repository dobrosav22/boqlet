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
    assert s["excludedElements"] == 61          # loose furniture is off by default
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
