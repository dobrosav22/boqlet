"""
Links between models of a federation (federation.py steps 6-7), elements passing through others
(`embedded`), and the questions the engine can now raise: `contradiction` and `double_claim`.

Hand-written files with known dimensions (millimetres), as in test_faces_rooms.py: the
architecture model has the room, the floor slab and the doors and windows (not hosted: their
walls are in the other file); the structure model has the four load-bearing walls with unfilled
openings, and a column that passes through the architectural slab.
"""
from __future__ import annotations

import copy
import json

import pytest

from ifc_boq import presets
from ifc_boq.federation import combine
from ifc_boq.log import CalcLog
from ifc_boq.measure import build
from ifc_boq.names import Resolver
from ifc_boq.parse import parse_file
from ifc_boq.pipeline import get_boq
from ifc_boq.rules import flatten

HEAD = """ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');
FILE_NAME('{name}','2026-10-13T00:00:00',(''),(''),'hand written','hand written','');
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
#30=IFCLOCALPLACEMENT(#25,#11);
"""
TAIL = """ENDSEC;
END-ISO-10303-21;
"""


def box(n: int, cls: str, guid: str, name: str, x: float, y: float, z: float, dx: float, dy: float, dz: float,
        extra: str = "$", tag: str = "$") -> str:
    """An element with a rectangular body centred on (x, y) from height z, dz tall. `tag` is the
    attribute after the representation (Tag; an IfcSpace's LongName)."""
    return f"""#{n}={cls}('{guid}',$,'{name}',$,$,#30,#{n + 1},{tag},{extra});
#{n + 1}=IFCPRODUCTDEFINITIONSHAPE($,$,(#{n + 2}));
#{n + 2}=IFCSHAPEREPRESENTATION(#13,'Body','SweptSolid',(#{n + 3}));
#{n + 3}=IFCEXTRUDEDAREASOLID(#{n + 4},#{n + 7},#14,{dz:.1f});
#{n + 4}=IFCRECTANGLEPROFILEDEF(.AREA.,$,#{n + 5},{dx:.1f},{dy:.1f});
#{n + 5}=IFCAXIS2PLACEMENT2D(#{n + 6},$);
#{n + 6}=IFCCARTESIANPOINT(({x:.1f},{y:.1f}));
#{n + 7}=IFCAXIS2PLACEMENT3D(#{n + 8},$,$);
#{n + 8}=IFCCARTESIANPOINT((0.,0.,{z:.1f}));
"""


# architecture: room R1 4.0 x 3.0 x 2.5 m, floor slab 4.4 x 3.4 x 0.2 m below it, a 900 x 2100 door
# leaf in the south wall line and a 1200 x 1000 window (sill 900) in the east wall line, unhosted
ARCH = HEAD.format(name="arch.ifc") + "".join([
    box(100, "IFCSPACE", "1rqIFTRjfCC8VsZJ2gIZzT", "R1", 2000, 1500, 0, 4000, 3000, 2500, ".ELEMENT.,.SPACE.,$", "'Bathroom'"),
    box(150, "IFCSLAB", "1Sl1FTRjfCC8VsZJ2gIZzT", "Floor slab", 2000, 1500, -200, 4400, 3400, 200, ".FLOOR."),
    box(170, "IFCDOOR", "1Dr1FTRjfCC8VsZJ2gIZzT", "Door", 1450, -100, 0, 900, 50, 2100, "2100.,900.,.DOOR.,.SINGLE_SWING_LEFT.,$"),
    box(180, "IFCWINDOW", "1Wn1FTRjfCC8VsZJ2gIZzT", "Window", 4100, 1600, 900, 50, 1200, 1000, "1000.,1200.,.WINDOW.,.SINGLE_PANEL.,$"),
]) + """#29=IFCRELAGGREGATES('0hqIFTRjfCC8VsZJ2gIZz5',$,$,$,#24,(#100));
#190=IFCRELCONTAINEDINSPATIALSTRUCTURE('0hqIFTRjfCC8VsZJ2gIZz4',$,$,$,(#150,#170,#180),#24);
""" + TAIL

# structure: four 200 mm load-bearing walls around the room, a door opening and a window opening
# (no fillings), a 300 x 300 column through the architectural slab
STRUCT = HEAD.format(name="struct.ifc") + "".join([
    box(110, "IFCWALL", "1Sw1FTRjfCC8VsZJ2gIZzT", "South wall", 2000, -100, 0, 4400, 200, 2500, ".SOLIDWALL."),
    box(120, "IFCWALL", "1Nw1FTRjfCC8VsZJ2gIZzT", "North wall", 2000, 3100, 0, 4400, 200, 2500, ".SOLIDWALL."),
    box(130, "IFCWALL", "1Ww1FTRjfCC8VsZJ2gIZzT", "West wall", -100, 1500, 0, 200, 3000, 2500, ".SOLIDWALL."),
    box(140, "IFCWALL", "1Ew1FTRjfCC8VsZJ2gIZzT", "East wall", 4100, 1500, 0, 200, 3000, 2500, ".SOLIDWALL."),
    box(160, "IFCOPENINGELEMENT", "1Od1FTRjfCC8VsZJ2gIZzT", "Door opening", 1450, -100, 0, 900, 200, 2100, ".OPENING."),
    box(170, "IFCOPENINGELEMENT", "1Ow1FTRjfCC8VsZJ2gIZzT", "Window opening", 4100, 1600, 900, 200, 1200, 1000, ".OPENING."),
    box(200, "IFCCOLUMN", "1Co1FTRjfCC8VsZJ2gIZzT", "Column", 3000, 2000, -200, 300, 300, 2700, ".COLUMN."),
]) + """#179=IFCRELVOIDSELEMENT('0hqIFTRjfCC8VsZJ2gIZz8',$,$,$,#140,#170);
#169=IFCRELVOIDSELEMENT('0hqIFTRjfCC8VsZJ2gIZz6',$,$,$,#110,#160);
#210=IFCPROPERTYSET('0hqIFTRjfCC8VsZJ2gIZzA',$,'Pset_WallCommon',$,(#211));
#211=IFCPROPERTYSINGLEVALUE('LoadBearing',$,IFCBOOLEAN(.T.),$);
#212=IFCRELDEFINESBYPROPERTIES('0hqIFTRjfCC8VsZJ2gIZzB',$,$,$,(#110,#120,#130,#140),#210);
#190=IFCRELCONTAINEDINSPATIALSTRUCTURE('0hqIFTRjfCC8VsZJ2gIZz4',$,$,$,(#110,#120,#130,#140,#200),#24);
""" + TAIL


@pytest.fixture(scope="module")
def pair(tmp_path_factory):
    d = tmp_path_factory.mktemp("fed")
    out = {}
    for name, text in (("arch", ARCH), ("struct", STRUCT)):
        p = d / f"{name}.ifc"
        p.write_text(text, encoding="utf-8")
        doc, parser = parse_file(str(p))
        out[name] = (doc, parser.meshes)
    return out


def models(pair, meshes: bool = True):
    return [{"id": "arch", "parsed": copy.deepcopy(pair["arch"][0]), "discipline": "architecture",
             "meshes": pair["arch"][1] if meshes else None},
            {"id": "struct", "parsed": copy.deepcopy(pair["struct"][0]), "discipline": "structure",
             "meshes": pair["struct"][1] if meshes else None}]


def run(ms, rules="as-modelled", params=None, decisions=None, extra_items=None):
    rs, lib = presets.load_rule_set(rules)
    if params or extra_items:
        rs = copy.deepcopy(flatten(rs, lib) if "extends" in rs else flatten(rs, {}))
        for k, v in (params or {}).items():
            rs["params"][k]["value"] = v
        rs["items"] += extra_items or []
    return get_boq(ms, rs, [presets.load_classification("acme-cost-codes")], [presets.load_dictionary("global-seed")],
                   presets.resolution(), decisions or [], lib, federation=presets.federation())


def elements(ms) -> dict[str, dict]:
    """The combined measured elements by name (what the rules see)."""
    rv = Resolver([presets.load_dictionary("global-seed")], presets.resolution())
    log = CalcLog()
    from ifc_boq.pipeline import element_boxes
    for m in ms:
        m["fileName"] = m["parsed"]["header"]["source"]["fileName"]
        m["elements"], _ = build(m["parsed"], rv, log, model_id=m["id"], discipline=m["discipline"])
        m["boxes"] = element_boxes(m["parsed"])
    els, _, qs, ws = combine(ms, presets.federation(), rv.expr, log, {})
    return {e["name"]: e for e in els}, log, qs, ws


# ---------------------------------------------------------------- rooms and openings across models
def test_doors_and_windows_fill_the_other_models_openings(pair):
    els, log, _, ws = elements(models(pair))
    south, east = els["South wall"], els["East wall"]
    assert els["Door"]["host_guid"] == south["guid"] and els["Window"]["host_guid"] == east["guid"]
    (d,) = south["openings"]
    assert d["kind"] == "door" and d["filling_guid"] == els["Door"]["guid"] and d["filling_class"] == "IfcDoor"
    assert east["openings"][0]["kind"] == "window"
    assert not [w for w in ws if w["code"] == "federation_unhosted"]


def test_rooms_lie_on_the_other_models_walls(pair):
    """Same numbers as the single-file room in test_faces_rooms.py: the federation must not change them."""
    els, *_ = elements(models(pair))
    south = els["South wall"]
    inner = [f for f in south["faces"] if f.get("space")]
    assert len(inner) == 1 and inner[0]["space_name"] == "Bathroom" and inner[0]["space_type"] == "space.bathroom"
    assert inner[0]["gross_area"] == pytest.approx(10.0, abs=1e-4)
    assert inner[0]["net_area"] == pytest.approx(10.0 * (11.0 - 1.89) / 11.0, abs=1e-4)
    room = els["R1"]
    assert sorted(room["bounded_by"]) == sorted(els[n]["guid"] for n in ("South wall", "North wall", "West wall",
                                                                          "East wall", "Floor slab"))
    assert room["wall_area_net"] == pytest.approx(35.0 - 0.9 * 2.1 - 1.2 * 1.0)
    assert room["skirting_length"] == pytest.approx(14.0 - 0.9)
    assert sorted(o["kind"] for o in room["openings"]) == ["door", "window"]


def test_room_finishes_in_a_federated_run(pair):
    r = run(models(pair), params={"room_finishes": True})
    q = {l["ruleId"]: l["quantity"] for l in r["lines"] if l["ruleId"].startswith("room-")}
    assert q == {"room-floors": pytest.approx(12.0), "room-ceilings": pytest.approx(12.0),
                 "room-walls": pytest.approx(31.91), "room-skirting": pytest.approx(13.1)}


def test_without_meshes_rooms_are_not_linked_and_the_log_says_so(pair):
    els, log, _, _ = elements(models(pair, meshes=False))
    assert not [f for f in els["South wall"]["faces"] if f.get("space")]
    assert els["R1"]["wall_area_net"] == pytest.approx(35.0)          # no wall of its own model bounds it
    assert els["Door"]["host_guid"] == els["South wall"]["guid"]      # boxes are enough for openings
    assert any("no meshes for" in e["message"] for e in log.entries)


# ---------------------------------------------------------------- embedded
def test_column_of_one_model_passes_through_the_slab_of_another(pair):
    els, *_ = elements(models(pair))
    (x,) = els["Floor slab"]["embedded"]
    assert x["guid"] == els["Column"]["guid"] and x["model"] == "struct"
    assert x["volume"] == pytest.approx(0.3 * 0.3 * 0.2, abs=1e-6) and x["area"] == pytest.approx(0.09, abs=1e-6)


def test_embedded_deduction_follows_the_slot(pair):
    def slab(r):
        return sum(l["quantity"] for l in r["lines"] if l["ruleId"] == "slabs")
    assert slab(run(models(pair))) == pytest.approx(4.4 * 3.4)
    deducted = run(models(pair), params={"deduct_embedded": "all"})
    assert slab(deducted) == pytest.approx(4.4 * 3.4 - 0.09)
    line = next(l for l in deducted["lines"] if l["ruleId"] == "slabs")
    assert "embedded deducted" in json.dumps(line["trace"])


def test_embedded_within_one_file(duplex_parsed):
    """Duplex: beams through six exterior walls (parse's overlap check -> measure.py)."""
    rv = Resolver([presets.load_dictionary("global-seed")], presets.resolution())
    out, _ = build(duplex_parsed, rv, CalcLog())
    hosts = [m for m in out if m.get("embedded")]
    assert len(hosts) == 6 and all(m["ifc_class"] == "IfcWall" for m in hosts)
    assert all(x["ifc_class"] == "IfcBeam" and x["area"] == pytest.approx(x["volume"] / m["thickness"], abs=1e-5)
               for m in hosts for x in m["embedded"])


# ---------------------------------------------------------------- overlaps by solids
MEMBERS = HEAD.format(name="{name}") + """#100=IFCMEMBER('{guid}',$,'Brace',$,$,#101,#102,$,.BRACE.);
#101=IFCLOCALPLACEMENT(#25,#103);
#103=IFCAXIS2PLACEMENT3D(#12,#14,#104);
#104=IFCDIRECTION(({dx},{dy},0.));
#102=IFCPRODUCTDEFINITIONSHAPE($,$,(#105));
#105=IFCSHAPEREPRESENTATION(#13,'Body','SweptSolid',(#106));
#106=IFCEXTRUDEDAREASOLID(#107,#11,#14,100.);
#107=IFCRECTANGLEPROFILEDEF(.AREA.,$,#108,10000.,100.);
#108=IFCAXIS2PLACEMENT2D(#110,$);
#109=IFCRELCONTAINEDINSPATIALSTRUCTURE('0hqIFTRjfCC8VsZJ2gIZz4',$,$,$,(#100),#24);
#110=IFCCARTESIANPOINT((0.,0.));
""" + TAIL


def test_crossing_diagonal_members_are_not_duplicates(tmp_path):
    """Two braces crossing in plan: their boxes are almost the same, their solids share 1%."""
    ms = []
    for n, (guid, dx, dy) in enumerate((("1Mb1FTRjfCC8VsZJ2gIZzT", 1, 1), ("1Mb2FTRjfCC8VsZJ2gIZzT", 1, -1))):
        p = tmp_path / f"m{n}.ifc"
        p.write_text(MEMBERS.replace("{name}", p.name).replace("{guid}", guid).replace("{dx}", f"{dx}.")
                     .replace("{dy}", f"{dy}."), encoding="utf-8")
        doc, parser = parse_file(str(p), overlaps=False)
        ms.append({"id": f"m{n}", "parsed": doc, "discipline": "structure", "meshes": parser.meshes})
    with_meshes = run(ms)
    assert not [q for q in with_meshes["questions"] if q["kind"] == "overlap"]
    assert any("by solid intersection" in e["message"] for e in with_meshes["log"])
    boxes_only = run([{**m, "meshes": None} for m in ms])
    assert [q["kind"] for q in boxes_only["questions"] if q["kind"] == "overlap"] == ["overlap"]


# ---------------------------------------------------------------- aggregates re-rolled
def _el(guid, cls, family, **kw):
    e = {"guid": guid, "ifc_class": cls, "ifc_class_raw": cls, "family": family, "name": guid, "discipline": kw.pop("discipline", "architecture"),
         "child_guids": [], "parent_guid": None, "net_volume": None, "gross_volume": None, "net_area": None,
         "gross_area": None, "thickness": None, "faces": [], "openings": [], "provenance": {}, "warnings": [], "materials": []}
    e.update(kw)
    return e


def _model(mid, discipline, els, boxes, bodies):
    parsed = {"elements": [{"id": e["guid"], "quantities": {"geometry": {"hasBody": e["guid"] in bodies, "closed": True}}}
                           for e in els], "openings": [], "spatial": []}
    return {"id": mid, "fileName": f"{mid}.ifc", "discipline": discipline, "elements": els, "boxes": boxes,
            "parsed": parsed, "meshes": None}


def test_aggregate_resummed_when_a_part_goes_to_another_model():
    b1, b2 = ([0, 0, 0], [5, 2, 0.2]), ([5, 0, 0], [10, 2, 0.2])
    roof = _el("roof", "IfcRoof", "planar", child_guids=["s1", "s2"], net_area=20.0, gross_area=20.0, net_volume=4.0,
               gross_volume=4.0, provenance={"net_area": "derived", "net_volume": "derived"})
    s1 = _el("s1", "IfcSlab", "planar", parent_guid="roof", net_area=10.0, gross_area=10.0, net_volume=2.0, gross_volume=2.0)
    s2 = _el("s2", "IfcSlab", "planar", parent_guid="roof", net_area=10.0, gross_area=10.0, net_volume=2.0,
             gross_volume=2.0, load_bearing=True)
    t2 = _el("t2", "IfcSlab", "planar", net_area=10.0, gross_area=10.0, net_volume=2.0, gross_volume=2.0,
             load_bearing=True, discipline="structure")
    arch = _model("arch", "architecture", [roof, s1, s2], {"s1": b1, "s2": b2, "roof": ([0, 0, 0], [10, 2, 0.2])}, {"s1", "s2"})
    struct = _model("struct", "structure", [t2], {"t2": b2}, {"t2"})
    log = CalcLog()
    els, reports, _, _ = combine([arch, struct], presets.federation(), Resolver([], {}).expr, log, {})
    by = {e["guid"]: e for e in els}
    assert "s2" not in by and "t2" in by
    assert by["roof"]["child_guids"] == ["s1"]
    assert by["roof"]["net_area"] == pytest.approx(10.0) and by["roof"]["net_volume"] == pytest.approx(2.0)
    assert any("summed again" in e["message"] for e in log.entries)


# ---------------------------------------------------------------- contradiction questions
PARTY = "contradiction:{}:IfcWall:Party Wall - CMU Residential Unit Dimising Wall"


def test_contradictions_are_asked_and_answers_apply(duplex_parsed):
    rv = Resolver([presets.load_dictionary("global-seed")], presets.resolution())
    qs = []
    out, _ = build(duplex_parsed, rv, CalcLog(), questions=qs)
    ids = {q["id"]: q for q in qs}
    assert set(ids) == {PARTY.format("volume"), PARTY.format("thickness")}
    vq = ids[PARTY.format("volume")]
    assert vq["kind"] == "contradiction" and not vq["blocking"] and vq["suggestion"] == "reported"
    (g,) = vq["guids"]
    before = next(m for m in out if m["guid"] == g)
    assert before["net_volume"] == pytest.approx(2.011, abs=1e-3) and before["provenance"]["net_volume"] == "reported"
    out2, _ = build(duplex_parsed, rv, CalcLog(), answers={PARTY.format("volume"): "geometry"}, questions=(qs2 := []))
    after = next(m for m in out2 if m["guid"] == g)
    assert after["net_volume"] == pytest.approx(2.856, abs=1e-3) and after["provenance"]["net_volume"] == "geometry"
    assert PARTY.format("volume") not in {q["id"] for q in qs2}
    out3, _ = build(duplex_parsed, rv, CalcLog(), answers={PARTY.format("volume"): "reported"}, questions=(qs3 := []))
    assert next(m for m in out3 if m["guid"] == g)["net_volume"] == pytest.approx(2.011, abs=1e-3)
    assert PARTY.format("volume") not in {q["id"] for q in qs3}


def test_contradiction_questions_reach_the_result(duplex_parsed):
    rs, lib = presets.load_rule_set("as-modelled")
    r = get_boq(duplex_parsed, rs, [], [presets.load_dictionary("global-seed")], presets.resolution(), [], lib)
    assert {q["id"] for q in r["questions"] if q["kind"] == "contradiction"} == {PARTY.format("volume"), PARTY.format("thickness")}


# ---------------------------------------------------------------- double claims
def test_double_claim_is_a_question_and_the_answer_keeps_one_rule(pair):
    rs, _ = presets.load_rule_set("as-modelled")
    walls = next(i for i in flatten(rs, {})["items"] if i["id"] == "walls")
    again = {**copy.deepcopy(walls), "id": "walls-again", "label": "Walls again"}
    ms = models(pair)
    r = run(ms, extra_items=[again])
    (q,) = [q for q in r["questions"] if q["kind"] == "double_claim"]
    assert q["id"] == "double_claim:body:walls|walls-again" and q["occurrences"] == 4
    assert {o["value"] for o in q["answer"]["options"]} == {"walls", "walls-again", "both"}
    assert [l for l in r["lines"] if l["ruleId"] == "walls-again"]
    r2 = run(models(pair), extra_items=[again], decisions=[{"questionId": q["id"], "answer": "walls"}])
    assert not [l for l in r2["lines"] if l["ruleId"] == "walls-again"]
    assert not [x for x in r2["questions"] if x["kind"] == "double_claim"]
    assert sum(l["quantity"] for l in r2["lines"] if l["ruleId"] == "walls") == pytest.approx(
        sum(l["quantity"] for l in r["lines"] if l["ruleId"] == "walls"))


# ---------------------------------------------------------------- ownership details found on the NBU sets
def test_steel_studs_and_walls_marked_non_load_bearing_stay_with_architecture():
    """NBU Office / Medical Clinic: 1,500 steel-stud partitions (LoadBearing false) were given to structure."""
    from ifc_boq.federation import owned_by_discipline
    fed, x = presets.federation(), Resolver([presets.load_dictionary("global-seed")], presets.resolution()).expr

    def structure(**kw):
        return owned_by_discipline(fed, "structure", _el("w", kw.pop("cls", "IfcWall"), "planar", **kw), x)
    assert not structure(material="metal.steel.stud", load_bearing=False)
    assert not structure(material="metal.steel.stud")
    assert not structure(material="concrete", load_bearing=False)
    assert structure(material="concrete")
    assert structure(material="masonry", load_bearing=True)
    assert structure(cls="IfcPlate", material="metal.steel")


def test_parts_of_an_aggregate_their_model_owns_are_not_holes():
    """Curtain wall mullions (IfcMember) in the architecture model: structure owns IfcMember, but
    these are parts of an architectural curtain wall; taken without a federation_hole warning."""
    cw = _el("cw", "IfcCurtainWall", "planar", child_guids=["m1"])
    m1 = _el("m1", "IfcMember", "linear", parent_guid="cw", net_volume=0.01, gross_volume=0.01)
    lone = _el("m2", "IfcMember", "linear", net_volume=0.01, gross_volume=0.01)
    col = _el("c1", "IfcColumn", "linear", net_volume=0.1, gross_volume=0.1, discipline="structure")
    arch = _model("arch", "architecture", [cw, m1, lone], {"m1": ([0, 0, 0], [0.1, 0.1, 3]), "m2": ([5, 0, 0], [5.1, 0.1, 3]),
                                                          "cw": ([0, 0, 0], [0.1, 0.1, 3])}, {"m1", "m2"})
    struct = _model("struct", "structure", [col], {"c1": ([20, 0, 0], [20.3, 0.3, 3])}, {"c1"})
    els, reports, _, ws = combine([arch, struct], presets.federation(), Resolver([], {}).expr, CalcLog(), {})
    assert {e["guid"] for e in els} == {"cw", "m1", "m2", "c1"}
    (hole,) = [w for w in ws if w["code"] == "federation_hole"]
    assert hole["guids"] == ["m2"] and reports[0]["takenWithoutOwner"] == 1
