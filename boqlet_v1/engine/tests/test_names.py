import json
from pathlib import Path

from ifc_boq import presets
from ifc_boq.names import Resolver, decision_entries

MESSY = json.loads((Path(__file__).parent / "messy_names.json").read_text(encoding="utf-8"))


def resolver(*ids, decisions=()):
    return Resolver([presets.load_dictionary(i) for i in ids], presets.resolution(), decision_entries(list(decisions)))


def test_multilingual_names_resolve():
    rv = resolver("global-seed", "acme-company", "project-duplex")
    got = {(x["raw"], x["ctx"]["ifc_class"]): rv.resolve(x["field"], x["raw"], x["ctx"])["term"] for x in MESSY}
    assert got[("BETON MB30", "IfcSlab")] == "concrete"
    assert got[("Gipsana ploča 12,5 mm", "IfcWall")] == "board.plasterboard"
    assert got[("Ytong 25cm", "IfcWall")] == "masonry.block.aac"
    assert got[("Stahl S355", "IfcBeam")] == "metal.steel"
    assert got[("Kupatilo", "IfcSpace")] == "space.bathroom"
    assert got[("Porotherm 25 S P+E", "IfcWall")] == "masonry.block.clay"      # company layer
    assert got[("CT", "IfcCovering")] == "finish.ceramic_tile"                  # company layer, context
    assert got[("CT", "IfcSlab")] == "concrete.screed"                          # project layer, context
    assert got[("CT", "IfcWall")] is None                                       # unknown -> question
    assert got[("Material X9", "IfcWall")] is None


def test_decision_layer_wins():
    rv = resolver("global-seed", decisions=[{"questionId": "name:material:Material X9", "answer": "masonry.brick"}])
    assert rv.resolve("material", "Material X9", {"ifc_class": "IfcWall"})["term"] == "masonry.brick"


def test_extractors():
    rv = resolver("global-seed")
    out = rv.extract("name", "M_W-Wide Flange:W310X60:W310X60:207325", {"ifc_class": "IfcBeam"})
    assert out["type_name"]["value"] == "W310X60"
    assert out["family"]["value"] == "M_W-Wide Flange"
    assert rv.extract("material", "Armirani beton C30/37", {})["strength_class"]["value"] == "C30/37"
