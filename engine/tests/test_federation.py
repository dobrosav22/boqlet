"""
Federation: several models, one BoQ, measured once (D43, D44; engine/ifc_boq/federation.py).

The buildingSMART certification scene ships the same house as separate discipline models that
share GlobalIds (the chimney, the roof, the placement markers). Expected values come from the
files' own quantity sets or from single-model runs, never from a federated run.
"""
from __future__ import annotations

import json
from collections import defaultdict
from functools import lru_cache

import jsonschema
import pytest

from ifc_boq import presets
from ifc_boq.parse import parse_file
from ifc_boq.paths import FIXTURES, SCHEMAS
from ifc_boq.pipeline import get_boq

SCENE = FIXTURES / "ifc" / "buildingsmart" / "IFC4X3"


@lru_cache(maxsize=None)
def _parse(name: str) -> str:
    return json.dumps(parse_file(str(SCENE / f"Building-{name}.ifc"), overlaps=False)[0])


def parsed(name: str) -> dict:
    return json.loads(_parse(name))


def run(models, decisions=None) -> dict:
    rs, lib = presets.load_rule_set("as-modelled")
    return get_boq(models, rs, [presets.load_classification("acme-cost-codes")], [presets.load_dictionary("global-seed")],
                   presets.resolution(), decisions or [], lib, federation=presets.federation())


def totals(r: dict) -> dict:
    t = defaultdict(float)
    for l in r["lines"]:
        if l["ruleKind"] == "item" and l["quantity"] is not None:
            t[l["ruleId"]] += l["quantity"]
    return {k: round(v, 2) for k, v in t.items()}


def copy_of(doc: dict, tag: str, shift: float = 0.0) -> dict:
    """The same model under new GlobalIds (as if another discipline modelled the same objects)."""
    text = json.dumps(doc)
    for e in doc["elements"]:
        g = e["id"]
        text = text.replace(f'"{g}"', f'"{tag}{g[len(tag):]}"')
    out = json.loads(text)
    out["header"]["source"]["fileName"] = f"{tag}-{doc['header']['source']['fileName']}"
    out["header"]["source"]["sha256"] = tag + out["header"]["source"]["sha256"][len(tag):]
    if shift:
        for e in out["elements"]:
            g = e["quantities"]["geometry"]
            if g.get("bboxMin"):
                g["bboxMin"] = [v + shift for v in g["bboxMin"]]
                g["bboxMax"] = [v + shift for v in g["bboxMax"]]
    return out


def scene():
    return [{"id": "arch", "parsed": parsed("Architecture"), "discipline": "architecture"},
            {"id": "str", "parsed": parsed("Structural"), "discipline": "structure"},
            {"id": "hvac", "parsed": parsed("Hvac"), "discipline": "mep"}]


def test_one_model_is_a_federation_of_one():
    doc = parsed("Architecture")
    a, b = run(doc), run([{"id": "x", "parsed": doc}])
    assert totals(a) == totals(b)
    assert len(b["models"]) == 1 and b["models"][0]["taken"] == b["models"][0]["elements"]


def test_certification_scene_three_disciplines():
    r = run(scene())
    jsonschema.validate(json.loads(json.dumps(r)), json.loads((SCHEMAS / "boq-result.schema.json").read_text(encoding="utf-8")))
    t = totals(r)
    # the chimney is in all three models under one GlobalId: counted once, from the copy with a body (structure)
    chimney = [e for l in r["lines"] for e in l["trace"]["elements"] if e.get("name") == "house - chimney"]
    assert len(chimney) == 1 and chimney[0]["model"] == "str"
    # one roof GlobalId: the architectural roof (two slabs, Qto NetArea 22.401143 + 31.211693) ...
    assert t["roofs"] == pytest.approx(53.61)
    # ... and the structural roof's timber girders are still measured (Qto lengths, 24.7 m)
    assert t["linear-other"] == pytest.approx(24.7)
    # no element is measured twice by one rule (a concrete slab is in both `slabs` and `slab-concrete` by design)
    pairs = [(l["ruleId"], e["guid"]) for l in r["lines"] if l["ruleKind"] == "item" for e in l["trace"]["elements"]]
    assert len(pairs) == len(set(pairs))
    assert not [q for q in r["questions"] if q["kind"] in ("unmatched", "overlap")]


def test_walls_only_in_the_structural_model_are_not_lost():
    """Structure does not own a non-load-bearing sand-lime wall (architecture does), but the
    architectural model has no wall in its place: the walls are taken from structure, and a
    warning says so. Walls total = both models' Qto NetSideArea. (Matching by family instead of
    IFC class once paired a structural wall with the architectural roof slab.)"""
    arch, struc = parsed("Architecture"), parsed("Structural")
    q = lambda doc: sum(e["quantities"]["reported"]["Qto_WallBaseQuantities"]["NetSideArea"]
                        for e in doc["elements"] if e["ifcClass"] == "IfcWall")
    r = run(scene())
    assert totals(r)["walls"] == pytest.approx(round(q(arch) + q(struc), 2), abs=0.02)
    rep = {m["id"]: m for m in r["models"]}
    assert rep["str"]["leftToOthers"] == 0 and rep["str"]["takenWithoutOwner"] >= 4
    assert any(w["code"] == "federation_hole" and "IfcWall" in w["message"] for w in r["warnings"])


def test_a_retagged_copy_adds_nothing():
    """Federating a model with a copy of itself under new GlobalIds and another discipline must
    give the single-model BoQ: every element is left to the one discipline that owns it."""
    struc = parsed("Structural")
    single = totals(run(struc))
    r = run([{"id": "str", "parsed": struc, "discipline": "structure"},
             {"id": "copy", "parsed": copy_of(struc, "ZZ"), "discipline": "architecture"}])
    assert totals(r) == single
    assert not [q for q in r["questions"] if q["kind"] == "overlap"]


def test_overlap_question_and_answer():
    """If both models take the beams (scope include), the engine asks which model provides them;
    unanswered, both are kept and flagged; answered, one is dropped."""
    struc = parsed("Structural")
    models = [{"id": "str", "parsed": struc, "discipline": "structure"},
              {"id": "copy", "parsed": copy_of(struc, "ZZ"), "discipline": "architecture",
               "scope": {"include": [{"ifcClass": "IfcBeam"}]}}]
    r = run(models)
    q = next(q for q in r["questions"] if q["kind"] == "overlap")
    assert q["id"] == "overlap:architecture|structure:IfcBeam" and q["occurrences"] == 6
    assert totals(r)["linear-other"] == pytest.approx(2 * 24.7)
    assert any(w["code"] == "federation_overlap" for w in r["warnings"])
    r2 = run(models, [{"questionId": q["id"], "scope": "project", "answer": "structure"}])
    assert totals(r2)["linear-other"] == pytest.approx(24.7)
    assert not [q for q in r2["questions"] if q["kind"] == "overlap"]


def test_scope_exclude():
    r = run([{"id": "arch", "parsed": parsed("Architecture"), "discipline": "architecture",
              "scope": {"exclude": [{"ifcClass": "IfcEarthworksFill"}]}}])
    assert "earthworks-modelled" not in totals(r)
    assert r["models"][0]["excludedByScope"] == 1


def test_storeys_are_aligned():
    """'00 groundfloor' at 0.00 in the structural model and 'Ground floor' at +0.05 in the
    architectural one are one level; the architectural name wins. (These files carry no storey
    elevation, so both are set here.)"""
    struc = parsed("Structural")
    other = copy_of(struc, "ZZ")
    for doc, name, z in ((struc, "00 groundfloor", 0.0), (other, "Ground floor", 0.05)):
        for s in doc["spatial"]:
            if s["kind"] == "storey":
                s["name"], s["elevation"] = name, z
    r = run([{"id": "str", "parsed": struc, "discipline": "structure"},
             {"id": "copy", "parsed": other, "discipline": "architecture"}])
    storeys = {l.get("location", {}).get("storey") for l in r["lines"] if l["ruleKind"] == "item"} - {None}
    assert storeys == {"Ground floor"}
    assert any("storey '00 groundfloor'" in e["message"] for e in r["log"])


def test_models_far_apart_are_reported():
    struc = parsed("Structural")
    r = run([{"id": "str", "parsed": struc, "discipline": "structure"},
             {"id": "copy", "parsed": copy_of(struc, "ZZ", shift=5000.0), "discipline": "architecture"}])
    assert any(w["code"] == "federation_coordinates" for w in r["warnings"])
