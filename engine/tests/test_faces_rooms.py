"""
Real faces and rooms (parse.py faces_and_rooms, measure.py side_faces / measure_rooms).

A hand-written room with known dimensions gives exact expected values; the Duplex checks the
room solids against the authoring tool's own room volumes.
"""
from __future__ import annotations

import json
from functools import lru_cache

import pytest

from ifc_boq import presets
from ifc_boq.log import CalcLog
from ifc_boq.measure import build
from ifc_boq.names import Resolver
from ifc_boq.parse import parse_file
from ifc_boq.pipeline import get_boq

# A 4.0 x 3.0 x 2.5 m room ("Bathroom") inside four 200 mm walls; a 900 x 2100 door in the
# south wall, a 1200 x 1000 window (sill 900) in the east wall; a 200 mm slab below. Millimetres.
ROOM = """ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');
FILE_NAME('room.ifc','2026-10-12T00:00:00',(''),(''),'hand written','hand written','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('0YvctVUKr0kugbFTf53O9L',$,'Room',$,$,$,$,(#10),#5);
#5=IFCUNITASSIGNMENT((#6,#7,#8));
#6=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);
#7=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);
#8=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);
#10=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#11,$);
#11=IFCAXIS2PLACEMENT3D(#12,$,$);
#12=IFCCARTESIANPOINT((0.,0.,0.));
#13=IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,#10,$,.MODEL_VIEW.,$);
#14=IFCDIRECTION((0.,0.,1.));
#20=IFCSITE('1hqIFTRjfCC8VsZJ2gIZzT',$,'Site',$,$,#21,$,$,.ELEMENT.,$,$,$,$,$);
#21=IFCLOCALPLACEMENT($,#11);
#22=IFCBUILDING('2hqIFTRjfCC8VsZJ2gIZzT',$,'Building',$,$,#23,$,$,.ELEMENT.,$,$,$);
#23=IFCLOCALPLACEMENT(#21,#11);
#24=IFCBUILDINGSTOREY('3hqIFTRjfCC8VsZJ2gIZzT',$,'Level 0',$,$,#25,$,$,.ELEMENT.,0.);
#25=IFCLOCALPLACEMENT(#23,#11);
#26=IFCRELAGGREGATES('0hqIFTRjfCC8VsZJ2gIZz1',$,$,$,#1,(#20));
#27=IFCRELAGGREGATES('0hqIFTRjfCC8VsZJ2gIZz2',$,$,$,#20,(#22));
#28=IFCRELAGGREGATES('0hqIFTRjfCC8VsZJ2gIZz3',$,$,$,#22,(#24));
#29=IFCRELAGGREGATES('0hqIFTRjfCC8VsZJ2gIZz5',$,$,$,#24,(#100));
#30=IFCLOCALPLACEMENT(#25,#11);
#100=IFCSPACE('1rqIFTRjfCC8VsZJ2gIZzT',$,'R1',$,$,#30,#101,'Bathroom',.ELEMENT.,.SPACE.,$);
#101=IFCPRODUCTDEFINITIONSHAPE($,$,(#102));
#102=IFCSHAPEREPRESENTATION(#13,'Body','SweptSolid',(#103));
#103=IFCEXTRUDEDAREASOLID(#104,#11,#14,2500.);
#104=IFCRECTANGLEPROFILEDEF(.AREA.,$,#105,4000.,3000.);
#105=IFCAXIS2PLACEMENT2D(#106,$);
#106=IFCCARTESIANPOINT((2000.,1500.));
#110=IFCWALL('1Sw1FTRjfCC8VsZJ2gIZzT',$,'South wall',$,$,#30,#111,$,.SOLIDWALL.);
#111=IFCPRODUCTDEFINITIONSHAPE($,$,(#112));
#112=IFCSHAPEREPRESENTATION(#13,'Body','SweptSolid',(#113));
#113=IFCEXTRUDEDAREASOLID(#114,#11,#14,2500.);
#114=IFCRECTANGLEPROFILEDEF(.AREA.,$,#115,4400.,200.);
#115=IFCAXIS2PLACEMENT2D(#116,$);
#116=IFCCARTESIANPOINT((2000.,-100.));
#120=IFCWALL('1Nw1FTRjfCC8VsZJ2gIZzT',$,'North wall',$,$,#30,#121,$,.SOLIDWALL.);
#121=IFCPRODUCTDEFINITIONSHAPE($,$,(#122));
#122=IFCSHAPEREPRESENTATION(#13,'Body','SweptSolid',(#123));
#123=IFCEXTRUDEDAREASOLID(#124,#11,#14,2500.);
#124=IFCRECTANGLEPROFILEDEF(.AREA.,$,#125,4400.,200.);
#125=IFCAXIS2PLACEMENT2D(#126,$);
#126=IFCCARTESIANPOINT((2000.,3100.));
#130=IFCWALL('1Ww1FTRjfCC8VsZJ2gIZzT',$,'West wall',$,$,#30,#131,$,.SOLIDWALL.);
#131=IFCPRODUCTDEFINITIONSHAPE($,$,(#132));
#132=IFCSHAPEREPRESENTATION(#13,'Body','SweptSolid',(#133));
#133=IFCEXTRUDEDAREASOLID(#134,#11,#14,2500.);
#134=IFCRECTANGLEPROFILEDEF(.AREA.,$,#135,200.,3000.);
#135=IFCAXIS2PLACEMENT2D(#136,$);
#136=IFCCARTESIANPOINT((-100.,1500.));
#140=IFCWALL('1Ew1FTRjfCC8VsZJ2gIZzT',$,'East wall',$,$,#30,#141,$,.SOLIDWALL.);
#141=IFCPRODUCTDEFINITIONSHAPE($,$,(#142));
#142=IFCSHAPEREPRESENTATION(#13,'Body','SweptSolid',(#143));
#143=IFCEXTRUDEDAREASOLID(#144,#11,#14,2500.);
#144=IFCRECTANGLEPROFILEDEF(.AREA.,$,#145,200.,3000.);
#145=IFCAXIS2PLACEMENT2D(#146,$);
#146=IFCCARTESIANPOINT((4100.,1500.));
#150=IFCSLAB('1Sl1FTRjfCC8VsZJ2gIZzT',$,'Floor slab',$,$,#30,#151,$,.FLOOR.);
#151=IFCPRODUCTDEFINITIONSHAPE($,$,(#152));
#152=IFCSHAPEREPRESENTATION(#13,'Body','SweptSolid',(#153));
#153=IFCEXTRUDEDAREASOLID(#154,#157,#14,200.);
#154=IFCRECTANGLEPROFILEDEF(.AREA.,$,#155,4400.,3400.);
#155=IFCAXIS2PLACEMENT2D(#156,$);
#156=IFCCARTESIANPOINT((2000.,1500.));
#157=IFCAXIS2PLACEMENT3D(#158,$,$);
#158=IFCCARTESIANPOINT((0.,0.,-200.));
#160=IFCOPENINGELEMENT('1Od1FTRjfCC8VsZJ2gIZzT',$,'Door opening',$,$,#30,#161,$,.OPENING.);
#161=IFCPRODUCTDEFINITIONSHAPE($,$,(#162));
#162=IFCSHAPEREPRESENTATION(#13,'Body','SweptSolid',(#163));
#163=IFCEXTRUDEDAREASOLID(#164,#11,#14,2100.);
#164=IFCRECTANGLEPROFILEDEF(.AREA.,$,#165,900.,200.);
#165=IFCAXIS2PLACEMENT2D(#166,$);
#166=IFCCARTESIANPOINT((1450.,-100.));
#167=IFCRELVOIDSELEMENT('0hqIFTRjfCC8VsZJ2gIZz6',$,$,$,#110,#160);
#168=IFCDOOR('1Dr1FTRjfCC8VsZJ2gIZzT',$,'Door',$,$,#30,$,$,2100.,900.,.DOOR.,.SINGLE_SWING_LEFT.,$);
#169=IFCRELFILLSELEMENT('0hqIFTRjfCC8VsZJ2gIZz7',$,$,$,#160,#168);
#170=IFCOPENINGELEMENT('1Ow1FTRjfCC8VsZJ2gIZzT',$,'Window opening',$,$,#30,#171,$,.OPENING.);
#171=IFCPRODUCTDEFINITIONSHAPE($,$,(#172));
#172=IFCSHAPEREPRESENTATION(#13,'Body','SweptSolid',(#173));
#173=IFCEXTRUDEDAREASOLID(#174,#177,#14,1000.);
#174=IFCRECTANGLEPROFILEDEF(.AREA.,$,#175,200.,1200.);
#175=IFCAXIS2PLACEMENT2D(#176,$);
#176=IFCCARTESIANPOINT((4100.,1600.));
#177=IFCAXIS2PLACEMENT3D(#178,$,$);
#178=IFCCARTESIANPOINT((0.,0.,900.));
#179=IFCRELVOIDSELEMENT('0hqIFTRjfCC8VsZJ2gIZz8',$,$,$,#140,#170);
#180=IFCWINDOW('1Wn1FTRjfCC8VsZJ2gIZzT',$,'Window',$,$,#30,$,$,1000.,1200.,.WINDOW.,.SINGLE_PANEL.,$);
#181=IFCRELFILLSELEMENT('0hqIFTRjfCC8VsZJ2gIZz9',$,$,$,#170,#180);
#190=IFCRELCONTAINEDINSPATIALSTRUCTURE('0hqIFTRjfCC8VsZJ2gIZz4',$,$,$,(#110,#120,#130,#140,#150,#168,#180),#24);
ENDSEC;
END-ISO-10303-21;
"""


@pytest.fixture(scope="module")
def room_doc(tmp_path_factory) -> dict:
    p = tmp_path_factory.mktemp("room") / "room.ifc"
    p.write_text(ROOM, encoding="utf-8")
    return parse_file(str(p), overlaps=False)[0]


def measured(doc: dict) -> dict[str, dict]:
    rv = Resolver([presets.load_dictionary("global-seed")], presets.resolution())
    return {m["name"]: m for m in build(doc, rv, CalcLog())[0]}


def test_room_solid_quantities(room_doc):
    r = measured(room_doc)["R1"]
    assert r["family"] == "space" and r["space_type"] == "space.bathroom"
    assert r["floor_area"] == pytest.approx(12.0) and r["ceiling_area"] == pytest.approx(12.0)
    assert r["perimeter"] == pytest.approx(14.0) and r["height"] == pytest.approx(2.5)
    assert r["wall_area"] == pytest.approx(35.0)
    assert r["wall_area_net"] == pytest.approx(35.0 - 0.9 * 2.1 - 1.2 * 1.0)
    assert r["skirting_length"] == pytest.approx(14.0 - 0.9)
    assert r["net_volume"] == pytest.approx(30.0)
    assert sorted(r["bounded_by"]) == sorted(e["id"] for e in room_doc["elements"] if e["ifcClass"] in ("IfcWall", "IfcSlab"))


def test_wall_faces_and_the_room_on_them(room_doc):
    """South wall 4.4 x 2.5 m, door 0.9 x 2.1 m: each side 11.0 m2 gross, 9.11 m2 net. The room lies
    on 4.0 x 2.5 = 10.0 m2 of the inner side; the 2 x 0.2 m corner strips are no room's."""
    w = measured(room_doc)["South wall"]
    inner = [f for f in w["faces"] if f.get("space")]
    assert len(inner) == 1 and inner[0]["space_name"] == "Bathroom" and inner[0]["space_type"] == "space.bathroom"
    assert inner[0]["gross_area"] == pytest.approx(10.0, abs=1e-4)
    assert inner[0]["net_area"] == pytest.approx(10.0 * (11.0 - 1.89) / 11.0, abs=1e-4)
    side = inner[0]["side"]
    same = [f for f in w["faces"] if f["side"] == side]
    assert sum(f["gross_area"] for f in same) == pytest.approx(11.0, abs=1e-4)
    other = [f for f in w["faces"] if f["side"] != side]
    assert len(other) == 1 and not other[0].get("space") and other[0]["gross_area"] == pytest.approx(11.0, abs=1e-4)
    east = measured(room_doc)["East wall"]                       # 3.0 x 2.5, window 1.2 x 1.0
    assert sum(f["gross_area"] for f in east["faces"] if f.get("space")) == pytest.approx(7.5, abs=1e-4)


def test_slab_top_carries_the_room(room_doc):
    """The room's floor (12.0 m2) lies on the slab's top face; the bottom face has no room."""
    slab = measured(room_doc)["Floor slab"]
    top = [f for f in slab["faces"] if f["side"] == "top" and f.get("space")]
    assert len(top) == 1 and top[0]["gross_area"] == pytest.approx(12.0, abs=1e-4)
    assert not [f for f in slab["faces"] if f["side"] == "bottom" and f.get("space")]


def test_room_finish_rules(room_doc):
    rs, lib = presets.load_rule_set("as-modelled")
    patch = {"schemaVersion": "1.0", "id": "rooms-on", "name": "rooms on", "version": "1", "extends": "as-modelled",
             "params": {"room_finishes": {"value": True}}}
    lib = {**lib, "rooms-on": patch}
    r = get_boq(room_doc, patch, [presets.load_classification("acme-cost-codes")], [presets.load_dictionary("global-seed")],
                presets.resolution(), [], lib)
    q = {l["ruleId"]: l["quantity"] for l in r["lines"] if l["ruleId"].startswith("room-")}
    assert q == {"room-floors": pytest.approx(12.0), "room-ceilings": pytest.approx(12.0),
                 "room-walls": pytest.approx(31.91), "room-skirting": pytest.approx(13.1)}
    assert all("Bathroom" in l["description"] or "space.bathroom" in l["description"]
               for l in r["lines"] if l["ruleId"].startswith("room-"))
    assert not [x for x in r["questions"] if x["kind"] == "unmatched"]


def test_room_finishes_off_by_default_excludes_rooms(room_doc):
    rs, lib = presets.load_rule_set("as-modelled")
    r = get_boq(room_doc, rs, [], [presets.load_dictionary("global-seed")], presets.resolution(), [], lib)
    assert not [l for l in r["lines"] if l["ruleId"].startswith("room-")]
    assert not [x for x in r["questions"] if x["kind"] == "unmatched"]


@lru_cache(maxsize=None)
def _duplex() -> str:
    from ifc_boq.paths import FIXTURES
    return json.dumps(parse_file(str(FIXTURES / "ifc" / "Ifc2x3_Duplex_Architecture.ifc"), overlaps=False)[0])


def test_duplex_room_solids_agree_with_revit_volumes():
    """Floor area x height of each prismatic room solid (flat ceiling: wall surface = perimeter x
    height) against Revit's own room Volume, an independent number from the authoring tool.
    Revit's room Area is not comparable: it follows a Revit setting and is about 9% larger."""
    doc = json.loads(_duplex())
    rooms = [m for m in measured(doc).values() if m["family"] == "space"]
    assert len(rooms) == 21
    checked = 0
    for m in rooms:
        v = m["props"].get("PSet_Revit_Dimensions.Volume")
        prismatic = m["wall_area"] and m["perimeter"] and abs(m["wall_area"] - m["perimeter"] * m["height"]) < 0.01 * m["wall_area"]
        if isinstance(v, (int, float)) and v > 1 and m["floor_area"] and prismatic:
            assert m["floor_area"] * m["height"] == pytest.approx(v, rel=0.01), m["name"]
            checked += 1
    assert checked >= 10


def test_duplex_party_wall_has_rooms_on_both_sides():
    doc = json.loads(_duplex())
    w = next(m for m in measured(doc).values() if "Party Wall" in (m.get("name") or ""))
    sides = {f["side"] for f in w["faces"] if f.get("space")}
    assert sides == {"a", "b"}
    assert len({f["space"] for f in w["faces"] if f.get("space")}) >= 6
