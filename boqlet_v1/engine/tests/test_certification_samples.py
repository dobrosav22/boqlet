"""
buildingSMART certification samples (fixtures/ifc/buildingsmart, CC BY 4.0).

Each test pins something the samples exposed. Expected values come from the files themselves
(profile dimensions, IFC quantity sets) or from geometry worked out by hand, never from the
engine's own output. See docs/09-validation-and-test-corpus.md.
"""
from __future__ import annotations

import json
from functools import lru_cache

import numpy as np
import pytest
import trimesh

from ifc_boq import presets, service
from ifc_boq.log import CalcLog
from ifc_boq.measure import build
from ifc_boq.names import Resolver
from ifc_boq.parse import Parser, parse_file
from ifc_boq.paths import FIXTURES

BSI = FIXTURES / "ifc" / "buildingsmart"
SCHEMAS = ("IFC2X3", "IFC4", "IFC4X3")


@lru_cache(maxsize=None)
def _parse(rel: str) -> str:
    doc, _ = parse_file(str(BSI / rel), overlaps=False)
    return json.dumps(doc)


def parsed(rel: str) -> dict:
    """Parsed once per session; each caller gets its own copy."""
    return json.loads(_parse(rel))


def boq(doc: dict) -> dict:
    return service.run(doc, {})[0]


def measured(doc: dict) -> dict[str, dict]:
    rv = Resolver([presets.load_dictionary(d) for d in presets.DEFAULTS["dictionaries"]], presets.resolution())
    return {m["guid"]: m for m in build(doc, rv, CalcLog())[0]}


def lines(result: dict, rule_id: str) -> list[dict]:
    return [l for l in result["lines"] if l["ruleId"] == rule_id]


def total(result: dict, rule_id: str) -> float:
    return sum(l["quantity"] for l in lines(result, rule_id))


# ------------------------------------------------------------------ units
def test_millimetre_geometry_is_scaled_by_our_unit_factor():
    """ISO wall-with-opening-and-window: the geometry kernel misses this file's millimetre unit
    and returns raw millimetres. The wall is a 3000 x 300 profile extruded 2000 with a
    1000 x 1000 window: 3.0 x 2.0 - 1.0 x 1.0 = 5.0 m2, volume 1.8 - 0.3 = 1.5 m3."""
    doc = parsed("IFC4/wall-with-opening-and-window.ifc")
    wall = next(m for m in measured(doc).values() if m["ifc_class"] == "IfcWall")
    assert wall["thickness"] == pytest.approx(0.3)
    assert wall["net_volume"] == pytest.approx(1.5, rel=1e-6)
    assert wall["net_area"] == pytest.approx(5.0, rel=1e-6)
    assert total(boq(doc), "walls") == pytest.approx(5.0)


def test_conversion_based_inch_unit():
    """ISO column: an 8 x 8 inch section, 120 inches tall, in a file whose length unit is the inch."""
    doc = parsed("IFC4/column-straight-rectangle-tessellation.ifc")
    col = next(iter(measured(doc).values()))
    assert col["length"] == pytest.approx(120 * 0.0254, rel=1e-6)
    assert col["net_volume"] == pytest.approx((8 * 0.0254) ** 2 * 120 * 0.0254, abs=1e-6)   # parse rounds to 6 decimals


# ------------------------------------------------------------------ one scene, three schemas
@pytest.mark.parametrize("model", ["Building-Architecture", "Building-Structural"])
def test_same_scene_measures_the_same_in_every_schema(model):
    """IFC2x3 (faceted Brep) and IFC4 / IFC4.3 (triangulated face sets) of one SketchUp scene
    must give the same numbers for every class that exists in all three schemas."""
    rules = ("walls", "slabs", "slab-concrete", "roofs", "footings", "linear-other", "formwork-footings", "formwork-slab-edges")
    results = {s: boq(parsed(f"{s}/{model}.ifc")) for s in SCHEMAS}
    for rid in rules:
        values = {s: round(total(r, rid), 2) for s, r in results.items()}
        assert len(set(values.values())) == 1, (rid, values)


def test_walls_match_the_ifc_quantity_sets():
    """Wall area = volume / thickness must agree with the exporter's Qto_WallBaseQuantities.NetSideArea."""
    doc = parsed("IFC4X3/Building-Architecture.ifc")
    m = measured(doc)
    walls = [e for e in doc["elements"] if e["ifcClass"] == "IfcWall"]
    assert walls
    for e in walls:
        assert m[e["id"]]["net_area"] == pytest.approx(e["quantities"]["reported"]["Qto_WallBaseQuantities"]["NetSideArea"], rel=1e-5)


# ------------------------------------------------------------------ aggregates
def test_roof_without_a_body_takes_the_area_of_its_slabs():
    """IfcRoof has no geometry of its own; its two slabs report NetArea 22.401143 and 31.211693.
    The roof line is their sum, and the slabs are not measured again as floors."""
    doc = parsed("IFC4X3/Building-Architecture.ifc")
    slabs = {e["name"]: e["quantities"]["reported"]["Qto_SlabBaseQuantities"]["NetArea"]
             for e in doc["elements"] if e["ifcClass"] == "IfcSlab"}
    roof_slabs = [v for k, v in slabs.items() if "roof" in k]
    assert sorted(roof_slabs) == pytest.approx([22.401143, 31.211693])
    r = boq(doc)
    assert total(r, "roofs") == pytest.approx(round(sum(roof_slabs), 2))
    assert total(r, "slabs") == pytest.approx(slabs["floor"])


def test_parent_no_rule_can_measure_is_measured_through_its_parts():
    """The structural roof is six timber girders and two beam shoes: no area for the whole.
    Before, the roof became a flagged line and the girders were skipped as its parts.
    Now the girders are measured (Qto lengths 2.7 + 5.8 + 0.6 + 4.0 + 5.8 + 5.8 = 24.7 m)."""
    doc = parsed("IFC4X3/Building-Structural.ifc")
    lengths = [e["quantities"]["reported"]["Qto_BeamBaseQuantities"]["Length"] for e in doc["elements"] if e["ifcClass"] == "IfcBeam"]
    r = boq(doc)
    assert not lines(r, "roofs")
    assert total(r, "linear-other") == pytest.approx(round(sum(lengths), 2)) == pytest.approx(24.7)
    assert total(r, "other-components") == 3          # the chimney and two beam shoes
    assert not [q for q in r["questions"] if q["kind"] in ("unmatched", "missing_data")]
    assert any("measured through its" in e["message"] for e in r["log"])


# ------------------------------------------------------------------ geometry
def test_tessellated_volume_with_t_junctions_is_trusted():
    """SketchUp's triangulation leaves T-junctions: not watertight, but closed. The footing's
    volume must equal the IFC2x3 Brep export of the same footing, and not become a question."""
    tess = parsed("IFC4X3/Building-Structural.ifc")
    brep = parsed("IFC2X3/Building-Structural.ifc")
    g = next(e for e in tess["elements"] if e["ifcClass"] == "IfcFooting")["quantities"]["geometry"]
    g2 = next(e for e in brep["elements"] if e["ifcClass"] == "IfcFooting")["quantities"]["geometry"]
    assert g["watertight"] is False and g["closed"] is True
    assert g["volume"] == pytest.approx(g2["volume"], rel=1e-6)
    r = boq(tess)
    assert total(r, "footings") == pytest.approx(round(g2["volume"], 2))
    assert not [q for q in r["questions"] if q["kind"] == "missing_data"]


def _t_junction_cube():
    v = np.array([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1], [0.5, 0, 1]], float)
    f = [[0, 2, 1], [0, 3, 2],                       # bottom
         [4, 8, 7], [8, 6, 7], [8, 5, 6],            # top, with vertex 8 on edge 4-5
         [0, 1, 5], [0, 5, 4],                       # front keeps the long edge 4-5: T-junction
         [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]]
    return trimesh.Trimesh(v, f, process=True)


def test_closed_surface_accepts_t_junctions_and_rejects_holes():
    cube = _t_junction_cube()
    assert not cube.is_watertight
    assert Parser.closed_surface(cube)
    assert abs(cube.volume) == pytest.approx(1.0)
    tube = trimesh.creation.cylinder(radius=0.1, height=2.0, sections=24)
    tube.update_faces(np.abs(tube.face_normals[:, 2]) < 0.5)        # open pipe: no end caps
    tube.remove_unreferenced_vertices()
    assert not Parser.closed_surface(tube)
    box = trimesh.creation.box((1, 2, 3))
    box.update_faces(np.arange(len(box.faces)) > 1)                # one side missing
    assert not Parser.closed_surface(box)


ROTATED = """ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');
FILE_NAME('rotated.ifc','2026-10-12T00:00:00',(''),(''),'hand written','hand written','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('0YvctVUKr0kugbFTf53O9L',$,'Rotated',$,$,$,$,(#10),#5);
#5=IFCUNITASSIGNMENT((#6,#7,#8));
#6=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);
#7=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);
#8=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);
#10=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#11,$);
#11=IFCAXIS2PLACEMENT3D(#12,$,$);
#12=IFCCARTESIANPOINT((0.,0.,0.));
#13=IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,#10,$,.MODEL_VIEW.,$);
#20=IFCSITE('1hqIFTRjfCC8VsZJ2gIZzT',$,'Site',$,$,#21,$,$,.ELEMENT.,$,$,$,$,$);
#21=IFCLOCALPLACEMENT($,#11);
#22=IFCBUILDING('2hqIFTRjfCC8VsZJ2gIZzT',$,'Building',$,$,#23,$,$,.ELEMENT.,$,$,$);
#23=IFCLOCALPLACEMENT(#21,#11);
#24=IFCBUILDINGSTOREY('3hqIFTRjfCC8VsZJ2gIZzT',$,'Level 0',$,$,#25,$,$,.ELEMENT.,0.);
#25=IFCLOCALPLACEMENT(#23,#11);
#26=IFCRELAGGREGATES('0hqIFTRjfCC8VsZJ2gIZz1',$,$,$,#1,(#20));
#27=IFCRELAGGREGATES('0hqIFTRjfCC8VsZJ2gIZz2',$,$,$,#20,(#22));
#28=IFCRELAGGREGATES('0hqIFTRjfCC8VsZJ2gIZz3',$,$,$,#22,(#24));
#30=IFCWALL('1wqIFTRjfCC8VsZJ2gIZzT',$,'Wall rotated 30 degrees',$,$,#31,#36,$,.SOLIDWALL.);
#31=IFCLOCALPLACEMENT(#25,#32);
#32=IFCAXIS2PLACEMENT3D(#33,#34,#35);
#33=IFCCARTESIANPOINT((1000.,2000.,0.));
#34=IFCDIRECTION((0.,0.,1.));
#35=IFCDIRECTION((0.866025403784439,0.5,0.));
#36=IFCPRODUCTDEFINITIONSHAPE($,$,(#37));
#37=IFCSHAPEREPRESENTATION(#13,'Body','SweptSolid',(#38));
#38=IFCEXTRUDEDAREASOLID(#39,#11,#34,3000.);
#39=IFCRECTANGLEPROFILEDEF(.AREA.,$,#40,4000.,250.);
#40=IFCAXIS2PLACEMENT2D(#41,$);
#41=IFCCARTESIANPOINT((0.,0.));
#50=IFCBEAM('1bqIFTRjfCC8VsZJ2gIZzT',$,'Beam sloping 30 degrees',$,$,#51,#56,$,.BEAM.);
#51=IFCLOCALPLACEMENT(#25,#52);
#52=IFCAXIS2PLACEMENT3D(#53,#54,#55);
#53=IFCCARTESIANPOINT((10000.,0.,0.));
#54=IFCDIRECTION((0.866025403784439,0.,0.5));
#55=IFCDIRECTION((-0.5,0.,0.866025403784439));
#56=IFCPRODUCTDEFINITIONSHAPE($,$,(#57));
#57=IFCSHAPEREPRESENTATION(#13,'Body','SweptSolid',(#58));
#58=IFCEXTRUDEDAREASOLID(#59,#11,#34,5000.);
#59=IFCRECTANGLEPROFILEDEF(.AREA.,$,#40,200.,300.);
#60=IFCRELCONTAINEDINSPATIALSTRUCTURE('0hqIFTRjfCC8VsZJ2gIZz4',$,$,$,(#30,#50,#80,#90),#24);
#70=IFCWALLTYPE('1tqIFTRjfCC8VsZJ2gIZzT',$,'Plain wall',$,$,$,$,$,$,.SOLIDWALL.);
#71=IFCRELDEFINESBYTYPE('0hqIFTRjfCC8VsZJ2gIZz5',$,$,$,(#30),#70);
#72=IFCCLASSIFICATION('Example','1',$,'Example codes',$,$,$);
#73=IFCCLASSIFICATIONREFERENCE($,'W-01','External wall',#72,$,$);
#74=IFCRELASSOCIATESCLASSIFICATION('0hqIFTRjfCC8VsZJ2gIZz6',$,$,$,(#70),#73);
#80=IFCSLAB('1sqIFTRjfCC8VsZJ2gIZzT',$,'Slab rotated 30 degrees',$,$,#81,#84,$,.FLOOR.);
#81=IFCLOCALPLACEMENT(#25,#82);
#82=IFCAXIS2PLACEMENT3D(#83,#34,#35);
#83=IFCCARTESIANPOINT((0.,10000.,0.));
#84=IFCPRODUCTDEFINITIONSHAPE($,$,(#85));
#85=IFCSHAPEREPRESENTATION(#13,'Body','SweptSolid',(#86));
#86=IFCEXTRUDEDAREASOLID(#87,#11,#34,200.);
#87=IFCRECTANGLEPROFILEDEF(.AREA.,$,#40,4000.,2500.);
#90=IFCWALL('1mqIFTRjfCC8VsZJ2gIZzT',$,'Wall in two pieces',$,$,#91,#92,$,.SOLIDWALL.);
#91=IFCLOCALPLACEMENT(#25,#94);
#94=IFCAXIS2PLACEMENT3D(#95,$,$);
#95=IFCCARTESIANPOINT((20000.,0.,0.));
#92=IFCPRODUCTDEFINITIONSHAPE($,$,(#93));
#93=IFCSHAPEREPRESENTATION(#13,'Body','SweptSolid',(#96,#97));
#96=IFCEXTRUDEDAREASOLID(#100,#11,#34,2500.);
#97=IFCEXTRUDEDAREASOLID(#100,#98,#34,2500.);
#98=IFCAXIS2PLACEMENT3D(#99,$,$);
#99=IFCCARTESIANPOINT((0.,10000.,0.));
#100=IFCRECTANGLEPROFILEDEF(.AREA.,$,#40,3000.,200.);
ENDSEC;
END-ISO-10303-21;
"""


@pytest.fixture(scope="module")
def rotated(tmp_path_factory) -> dict:
    path = tmp_path_factory.mktemp("rotated") / "rotated.ifc"
    path.write_text(ROTATED, encoding="utf-8")
    doc, _ = parse_file(str(path), overlaps=False)
    return doc


def test_rotated_wall_and_sloped_beam_use_the_oriented_box(rotated):
    """A 4000 x 250 x 3000 wall turned 30 degrees in plan and a 5000 long beam sloping 30
    degrees, no material layers and no quantity sets: thickness, area and length must come
    from the element's own axes, not world axes (which gave the wall's diagonal as thickness)."""
    m = {e["name"]: e for e in measured(rotated).values()}
    wall, beam = m["Wall rotated 30 degrees"], m["Beam sloping 30 degrees"]
    assert wall["thickness"] == pytest.approx(0.25, abs=1e-6)
    assert wall["net_area"] == pytest.approx(4.0 * 3.0, rel=1e-6)
    assert wall["length"] == pytest.approx(4.0, abs=1e-6)
    assert beam["length"] == pytest.approx(5.0, abs=1e-6)
    assert beam["net_volume"] == pytest.approx(0.2 * 0.3 * 5.0, rel=1e-6)


def test_slab_perimeter_from_its_geometry(rotated):
    """A 4000 x 2500 x 200 slab turned 30 degrees, no reported perimeter:
    P = (S - 2V/t) / t = 2 x (4.0 + 2.5) = 13.0 m; area = V / t = 10.0 m2."""
    slab = next(e for e in measured(rotated).values() if e["name"] == "Slab rotated 30 degrees")
    assert slab["thickness"] == pytest.approx(0.2, abs=1e-6)
    assert slab["net_area"] == pytest.approx(10.0, rel=1e-6)
    assert slab["perimeter"] == pytest.approx(13.0, rel=1e-6)
    assert slab["provenance"]["perimeter"] == "geometry"


def test_classification_inherited_from_the_type(rotated):
    """The code is associated with the IfcWallType only; the wall occurrence carries it."""
    codes = {c["id"]: c for c in rotated["catalogues"]["classifications"]}
    wall = next(e for e in rotated["elements"] if e["ifcClass"] == "IfcWall")
    assert [codes[c]["code"] for c in wall["classificationIds"]] == ["W-01"]


def test_one_wall_made_of_two_bodies(rotated):
    """One IfcWall holding two 3000 x 200 x 2500 pieces 10 m apart: the oriented box describes
    one piece, so thickness is 0.2 m (not 10 m) and area = 2 x 3.0 x 2.5 = 15.0 m2."""
    e = next(e for e in rotated["elements"] if e["name"] == "Wall in two pieces")
    w = measured(rotated)[e["id"]]
    assert e["quantities"]["geometry"]["bodyCount"] == 2
    assert w["thickness"] == pytest.approx(0.2, abs=1e-6)
    assert w["net_area"] == pytest.approx(15.0, rel=1e-6)


def test_bridge_walls_rotated_in_plan():
    """The bridge's spandrel walls run at an angle to the world axes; world-axis extents gave a
    thickness of 10.39 m (the plan diagonal). Area x thickness must give the volume back."""
    doc = parsed("IFC4X3/Infra-Bridge.ifc")
    m = measured(doc)
    walls = [m[e["id"]] for e in doc["elements"] if e["ifcClass"] == "IfcWall"]
    assert walls
    for w in walls:
        assert w["thickness"] < 1.0
        assert w["net_area"] * w["thickness"] == pytest.approx(w["net_volume"], rel=1e-6)


def test_slab_edge_formwork_is_not_flagged_without_a_reported_perimeter():
    r = boq(parsed("IFC4X3/Building-Architecture.ifc"))
    assert lines(r, "formwork-slab-edges") and all(l["quantity"] is not None for l in lines(r, "formwork-slab-edges"))


# ------------------------------------------------------------------ classes, disciplines, names
def test_ifc2x3_distribution_elements_take_the_class_of_their_type():
    """IFC2x3 has no IfcDuctSegment: the occurrence is IfcFlowSegment typed by IfcDuctSegmentType.
    It must be measured as a duct, like the IFC4.3 export of the same scene."""
    old, new = boq(parsed("IFC2X3/Building-Hvac.ifc")), boq(parsed("IFC4X3/Building-Hvac.ifc"))
    m = measured(parsed("IFC2X3/Building-Hvac.ifc"))
    seg = next(e for e in m.values() if e["ifc_class_raw"] == "IfcFlowSegment")
    assert seg["ifc_class"] == "IfcDuctSegment" and seg["discipline"] == "mep"
    assert {e["ifc_class"] for e in m.values() if e["ifc_class_raw"] == "IfcFlowTerminal"} == {"IfcAirTerminal"}
    for rid in ("pipes", "mep-items"):
        assert total(old, rid) == pytest.approx(total(new, rid)) and total(old, rid) > 0
    assert not [q for q in old["questions"] if q["kind"] == "unmatched"]


@pytest.mark.parametrize("rel, guess", [("IFC4X3/Building-Hvac.ifc", "unknown"),
                                        ("IFC4X3/Infra-Road.ifc", "infrastructure"),
                                        ("IFC4X3/Infra-Bridge.ifc", "infrastructure")])
def test_discipline_guess(rel, guess):
    """In IFC4.3 IfcBuilding is an IfcFacility too: a house is not infrastructure."""
    assert parsed(rel)["header"]["disciplineGuess"] == guess


def test_marker_objects_are_excluded_not_counted():
    """'origin' and 'geo-reference' are placement markers with display-only materials (virtual_*)."""
    doc = parsed("IFC4X3/Building-Architecture.ifc")
    m = measured(doc)
    markers = [e for e in m.values() if e["name"] in ("origin", "geo-reference")]
    assert len(markers) == 2 and {e["material"] for e in markers} == {"non_physical"}
    r = boq(doc)
    counted = {e["guid"] for l in r["lines"] for e in l["trace"].get("elements", [])}
    assert not counted & {e["guid"] for e in markers}
    assert r["stats"]["excludedElements"] >= 2


@pytest.mark.parametrize("raw, term", [
    ("concrete_reinforced_in-situ", "concrete.in_situ"), ("concrete_reinforced_prefab", "concrete.precast"),
    ("metal_steel-galvanized", "metal.steel"), ("stone_sand-lime", "masonry.calcium_silicate"),
    ("wood_spruce_beam", "timber"), ("bulk-material_crushed-stone_generic", "aggregate"),
    ("bulk-material_topsoil_generic", "earth.topsoil"), ("bitumen_asphalt_generic", "bituminous"),
    ("vegetation_grass", "landscape.grass"), ("gypsum_fiber-board_panel", "board.plasterboard"),
    ("virtual_black", "non_physical"), ("Prefab timber panel", "timber"), ("composite_element_roof", None),
    # IFC4.x specification models: grades as material names, CamelCase, plain words
    ("S355JR", "metal.steel"), ("S275J2", "metal.steel"), ("ReinforcingSteel", "metal.steel"), ("Masonry", "masonry"),
    ("Room S12", None),
    # real projects (DURAARK, OpenIFC, Schependomlaan): Norwegian layers, US names, plurals
    ("108 mm tegl", "masonry.brick"), ("13 mm gipsplate innvendig kledning", "board.plasterboard"), ("10 mm puss", "finish.plaster"),
    ("Layer-Mineralull         20 mm", "insulation.mineral_wool"), ("148 mm enkelt bindingsverk heltre isolert", "timber"),
    ("12 mm spon", "board"), ("EPDM", "membrane.epdm"), ("Bricks", "masonry.brick"), ("Cast-In-Place", "concrete.in_situ"),
    ("C4000", "concrete"), ("A500 grade B", "metal.steel"), ("19 mm kledning", None), ("Default", None)])
def test_library_style_material_names(raw, term):
    """Material libraries name by category_subtype_detail; '_' must not hide the words."""
    rv = Resolver([presets.load_dictionary("global-seed")], presets.resolution())
    assert rv.resolve("material", raw, {"ifc_class": "IfcWall"})["term"] == term


# ------------------------------------------------------------------ corpus runner
def test_corpus_reads_ifczip_and_skips_old_schemas(tmp_path):
    """Schependomlaan ships .ifczip files (ifcopenshell opens them by extension); DURAARK and the
    Auckland repository hold IFC2x2 / IFC2.0 files the engine cannot read: skip with a reason."""
    import zipfile
    from ifc_boq.corpus import header_schema, run_one
    src = BSI / "IFC4" / "wall-with-opening-and-window.ifc"
    z = tmp_path / "wall.ifczip"
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(src, "wall.ifc")
    assert header_schema(z) == "IFC4"
    rec, parsed_doc, result = run_one(z, {}, overlaps=False)
    assert "error" not in rec and result["stats"]["measuredElements"] == 2
    old = tmp_path / "old.ifc"
    old.write_text("ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((''),'2;1');\nFILE_NAME('','',(''),(''),'','','');\n"
                   "FILE_SCHEMA(('IFC2X2_FINAL'));\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n", encoding="utf-8")
    rec, _, _ = run_one(old, {}, overlaps=False)
    assert rec["error"].startswith("unsupported schema IFC2X2_FINAL")


def test_unnamed_elements_keep_the_result_valid():
    """Elements without a Name (common in Tekla and test files) reached derived-line traces as
    null; BoqResult requires a string there. Found on the OpenIFC and DURAARK files."""
    import jsonschema
    from ifc_boq.paths import SCHEMAS as SCHEMA_DIR
    doc = parsed("IFC4X3/Building-Structural.ifc")
    for e in doc["elements"]:
        e.pop("name", None)
    r = json.loads(json.dumps(boq(doc)))
    assert lines(r, "formwork-footings")
    jsonschema.validate(r, json.loads((SCHEMA_DIR / "boq-result.schema.json").read_text(encoding="utf-8")))


def test_nested_parts_are_neither_double_counted_nor_unmatched():
    """Roof (measured) -> IfcElementAssembly (no rule) -> two slabs. The slabs are parts of a
    measured ancestor: skipped, and covered, and the roof still takes their area through the
    assembly. Before, only the direct parent was checked: the slabs were measured twice (roof
    and floors) and the assembly was unmatched. Seen nested three deep in HiCAD railings."""
    import copy
    doc = parsed("IFC4X3/Building-Architecture.ifc")
    els = {e["id"]: e for e in doc["elements"]}
    roof = next(e for e in doc["elements"] if e["ifcClass"] == "IfcRoof")
    slabs = [els[c] for c in roof["childIds"]]
    asm = copy.deepcopy(roof)
    asm.update(id="0ASSEMBLY0000000000000", ifcClass="IfcElementAssembly", ifcClassBase="IfcElementAssembly",
               name="roof panels", parentId=roof["id"], childIds=[s["id"] for s in slabs], typeId=None)
    asm.pop("typeId")
    roof["childIds"] = [asm["id"]]
    for s in slabs:
        s["parentId"] = asm["id"]
    doc["elements"].append(asm)
    r = boq(doc)
    assert total(r, "roofs") == pytest.approx(53.61)
    assert total(r, "slabs") == pytest.approx(25.75)                 # the floor only
    assert not [q for q in r["questions"] if q["kind"] == "unmatched"]
