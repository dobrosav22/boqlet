"""
Renovation scope, recesses, columns standing in rooms, and whole-building values.

The hand-written room of test_faces_rooms gets a 1.0 x 1.0 m niche, 100 mm deep, in the inner face
of its north wall and a 300 x 300 column standing in the room; the Duplex gets elements marked
existing or for demolition.
"""
from __future__ import annotations

import copy

import pytest

from ifc_boq import presets
from ifc_boq.parse import parse_file
from ifc_boq.pipeline import get_boq
from test_faces_rooms import ROOM, measured
from test_federation_links import box, models, pair, run  # noqa: F401 (pair is a fixture)

CONTAINED = "#190=IFCRELCONTAINEDINSPATIALSTRUCTURE('0hqIFTRjfCC8VsZJ2gIZz4',$,$,$,(#110,#120,#130,#140,#150,#168,#180),#24);"
ROOM_PLUS = ROOM.replace(CONTAINED, "".join([
    box(300, "IFCOPENINGELEMENT", "1Nc1FTRjfCC8VsZJ2gIZzT", "Niche", 2000, 3050, 500, 1000, 100, 1000, ".RECESS."),
    "#310=IFCRELVOIDSELEMENT('0hqIFTRjfCC8VsZJ2gIZzX',$,$,$,#120,#300);\n",
    box(320, "IFCCOLUMN", "1Cl1FTRjfCC8VsZJ2gIZzT", "Column", 3000, 2000, 0, 300, 300, 2500, ".COLUMN."),
    CONTAINED.replace("#180)", "#180,#320)"),
]))
assert ROOM_PLUS != ROOM


@pytest.fixture(scope="module")
def room_doc(tmp_path_factory) -> dict:
    p = tmp_path_factory.mktemp("room-plus") / "room.ifc"
    p.write_text(ROOM_PLUS, encoding="utf-8")
    return parse_file(str(p), overlaps=False)[0]


def answers(parsed, **params):
    """A patch on the master template holding only these answers."""
    lib = presets.rule_sets()
    patch = {"schemaVersion": "1.0", "id": "answers", "name": "answers", "version": "1", "extends": "as-modelled",
             "params": {k: {"value": v} for k, v in params.items()}}
    lib["answers"] = patch
    return get_boq(parsed, patch, [], [presets.load_dictionary("global-seed")], presets.resolution(), [], lib)


def total(r, rule):
    return sum(l["quantity"] or 0 for l in r["lines"] if l["ruleId"] == rule)


# ---------------------------------------------------------------- recesses

def test_recess_is_its_own_kind_and_not_part_of_the_wall_area(room_doc):
    """North wall 4.4 x 2.5 x 0.2 m: the niche takes 0.1 m3 from the solid, but the wall face is still 11.0 m2."""
    w = measured(room_doc)["North wall"]
    assert [o["kind"] for o in w["openings"]] == ["recess"]
    assert w["net_volume"] == pytest.approx(2.1, abs=1e-3)
    assert w["net_area"] == pytest.approx(11.0, abs=1e-3) and w["gross_area"] == pytest.approx(11.0, abs=1e-3)
    assert w["gross_volume"] == pytest.approx(2.2, abs=1e-3)
    room = measured(room_doc)["R1"]                      # a niche is not an opening of the room
    assert room["wall_area_net"] == pytest.approx(35.0 - 0.9 * 2.1 - 1.2 * 1.0)


def test_recess_deduction_follows_the_answer(room_doc):
    keep = answers(room_doc, wall_unit="volume")
    deduct = answers(room_doc, wall_unit="volume", wall_recess_mode="all")
    small = answers(room_doc, wall_unit="volume", wall_recess_mode="over_threshold", wall_recess_threshold=1.5)
    assert total(keep, "walls") - total(deduct, "walls") == pytest.approx(0.1, abs=0.011)
    assert total(small, "walls") == pytest.approx(total(keep, "walls"))      # 1.0 m2 niche below the 1.5 m2 limit
    area = answers(room_doc, wall_recess_mode="all")                         # walls in m2: recesses never deducted
    assert total(area, "walls") == pytest.approx(total(answers(room_doc), "walls"))


# ---------------------------------------------------------------- columns in rooms

def test_column_standing_in_a_room(room_doc):
    room = measured(room_doc)["R1"]
    assert len(room.get("embedded", [])) == 1
    assert room["embedded"][0]["ifc_class"] == "IfcColumn" and room["embedded"][0]["area"] == pytest.approx(0.09, abs=1e-4)


def test_room_finishes_deduct_columns_when_asked(room_doc):
    off = answers(room_doc, room_finishes=True)
    on = answers(room_doc, room_finishes=True, room_column_mode="all")
    big_only = answers(room_doc, room_finishes=True, room_column_mode="over_threshold", room_column_threshold=0.1)
    assert total(off, "room-floors") == pytest.approx(12.0) and total(off, "room-ceilings") == pytest.approx(12.0)
    assert total(on, "room-floors") == pytest.approx(11.91) and total(on, "room-ceilings") == pytest.approx(11.91)
    assert total(big_only, "room-floors") == pytest.approx(12.0)             # 0.09 m2 column below 0.1 m2


def test_columns_in_a_room_of_another_model(pair):
    """The federation pair: the room is in the architecture model, the column in the structure model."""
    r = run(models(pair), params={"room_finishes": True, "room_column_mode": "all"})
    assert total(r, "room-floors") == pytest.approx(12.0 - 0.09, abs=1e-3)


# ---------------------------------------------------------------- renovation scope

def marked(duplex_parsed):
    """A copy of the Duplex with one wall existing and two for demolition (Revit phases and IFC Status)."""
    p = copy.deepcopy(duplex_parsed)
    walls = [e for e in p["elements"] if e["ifcClassBase"] == "IfcWall"][:3]
    walls[0]["psets"]["PSet_Revit_Phasing"] = {"Phase Created": "Existing"}
    walls[1]["psets"]["PSet_Revit_Phasing"] = {"Phase Created": "New Construction", "Phase Demolished": "Demolition"}
    walls[2]["psets"].pop("PSet_Revit_Phasing", None)
    walls[2]["psets"].setdefault("Pset_WallCommon", {})["Status"] = "DEMOLISH"
    return p, [w["id"] for w in walls]


def test_everything_is_measured_by_default(duplex_parsed):
    p, ids = marked(duplex_parsed)
    r = answers(p)
    measured_guids = {e["guid"] for l in r["lines"] if l["ruleId"] == "walls" for e in l["trace"]["elements"]}
    assert set(ids) <= measured_guids
    assert not [l for l in r["lines"] if l["ruleId"] == "demolition"]


def test_new_work_only_leaves_existing_and_demolished_out(duplex_parsed):
    p, ids = marked(duplex_parsed)
    base, r = answers(p), answers(p, renovation_scope="new_work")
    measured_guids = {e["guid"] for l in r["lines"] for e in l["trace"]["elements"]}
    assert not set(ids) & measured_guids
    assert not [q for q in r["questions"] if q["kind"] == "unmatched" and set(q["guids"]) & set(ids)]
    assert r["stats"]["excludedElements"] == base["stats"]["excludedElements"] + 3
    assert any("left out of this BoQ" in e["message"] for e in r["log"])


def test_demolition_items_measure_what_is_left_out(duplex_parsed):
    p, ids = marked(duplex_parsed)
    r = answers(p, renovation_scope="new_work", measure_demolition=True)
    demo = [l for l in r["lines"] if l["ruleId"] == "demolition"]
    assert demo and all(l["unit"] == "m3" and l["quantity"] > 0 for l in demo)
    assert {e["guid"] for l in demo for e in l["trace"]["elements"]} == set(ids[1:])   # the existing wall stays out


# ---------------------------------------------------------------- building values

def test_building_values_and_a_manual_item_by_formula(duplex_parsed):
    lib = presets.rule_sets()
    patch = {"schemaVersion": "1.0", "id": "per-volume", "name": "per volume", "version": "1", "extends": "as-modelled",
             "manual": [{"id": "per-100m3", "kind": "other", "description": "Per 100 m3 of building", "unit": "nr",
                         "formula": "building.gross_volume / 100"}]}
    lib["per-volume"] = patch
    r = get_boq(duplex_parsed, patch, [], [presets.load_dictionary("global-seed")], presets.resolution(), [], lib)
    b = r["building"]
    assert b["storeys"] >= 2 and b["height"] > 5 and b["gross_floor_area"] > b["net_floor_area"] > 0
    assert all(b["provenance"][k] == "derived" for k in ("gross_floor_area", "gross_volume", "height"))
    line = next(l for l in r["lines"] if l["ruleId"] == "per-100m3")
    assert line["quantity"] == pytest.approx(round(b["gross_volume"] / 100, 2), abs=0.006)
    assert "building.gross_volume" in line["trace"]["formula"]
