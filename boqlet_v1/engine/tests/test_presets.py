"""Every bundled preset must be valid against the schemas generated from packages/types."""
import pytest

from ifc_boq import presets
from ifc_boq.paths import SCHEMAS
from ifc_boq.rules import flatten, integrity


def test_schemas_exist():
    assert (SCHEMAS / "rule-set.schema.json").exists(), "run: npm run codegen"


def test_all_presets_load_and_validate():
    assert presets.rule_sets()
    assert presets.dictionaries()
    assert presets.classifications()
    presets.resolution()
    assert presets.federation()["disciplines"]


@pytest.mark.parametrize("rid", sorted(presets.rule_sets()))
def test_rule_sets_flatten_cleanly(rid):
    lib = presets.rule_sets()
    flat = flatten(lib[rid], lib)
    assert integrity(flat) == [], integrity(flat)


def test_classification_maps_only_emit_known_codes():
    from ifc_boq.classify import code_targets
    for cid, c in presets.classifications().items():
        if not c["available"]:
            continue
        known = {x["code"] for x in c["codeList"]["codes"]}
        for r in c["map"]["rules"]:
            for code in code_targets(r["code"]):
                assert code in known, f"{cid}: {r['id']} -> {code}"


def test_check_accepts_every_bundled_preset():
    for rid, r in presets.rule_sets().items():
        assert presets.check("rules", r) == [], rid
    for did, d in presets.dictionaries().items():
        assert presets.check("dictionaries", d) == [], did
    for cid, c in presets.classifications().items():
        if c["available"]:
            assert presets.check("classifications", {"codeList": c["codeList"], "map": c["map"]}) == [], cid


def test_check_reports_draft_problems():
    import copy
    lib = presets.rule_sets()
    draft = copy.deepcopy(lib["demo-custom"])
    draft["items"][0]["partFilter"] = "thickness >"
    draft["derived"] = [{"id": "x", "label": "x", "from": ["gone"], "scope": "line",
                         "quantity": "FOO(src.qty)", "unit": "m2", "description": "x"}]
    problems = presets.check("rules", draft)
    assert any("partFilter" in p for p in problems)
    assert any("Unknown function FOO" in p for p in problems)
    assert any("'gone'" in p for p in problems)
    assert presets.check("rules", {**lib["demo-tweaked"], "extends": "nope"})
    patch = {"schemaVersion": "1.0", "id": "p2", "name": "p2", "version": "1", "extends": "draft-base"}
    base = {**lib["demo-tweaked"], "id": "draft-base"}
    assert presets.check("rules", patch, [base]) == []

    c = presets.classifications()["demo-trades"]
    m = copy.deepcopy(c["map"])
    m["rules"][0]["code"] = "ZZ"
    assert any("'ZZ'" in p for p in presets.check("classifications", {"codeList": c["codeList"], "map": m}))

    d = copy.deepcopy(presets.dictionaries()["acme-company"])
    d["entries"][0]["term"] = "no.such.term"
    d["entries"][1]["match"] = {"regex": "(unclosed"}
    problems = presets.check("dictionaries", d)
    assert any("no.such.term" in p for p in problems) and any("regex" in p for p in problems)


def test_patch_sections_merge_and_slots_are_checked():
    lib = presets.rule_sets()
    patch = {"schemaVersion": "1.0", "id": "ours", "name": "ours", "version": "1", "extends": "as-modelled",
             "sections": [{"id": "walls", "title": "Masonry and walls"}, {"id": "site", "title": "Site works"}],
             "params": {"fence": {"type": "boolean", "value": True, "label": "Fence", "section": "site"}}}
    flat = flatten(patch, {**lib, "ours": patch})
    titles = {s["id"]: s["title"] for s in flat["sections"]}
    assert titles["walls"] == "Masonry and walls" and titles["site"] == "Site works"
    assert [s["id"] for s in flat["sections"]][-1] == "site"            # new sections go last
    assert presets.check("rules", patch) == []

    bad = {**patch, "sections": None, "params": {"fence": {**patch["params"]["fence"], "section": "nowhere"},
                                                 "working_space": {"value": -1}}}
    bad.pop("sections")
    lib["as-modelled"]["params"]["working_space"]["min"] = 0             # not on disk, only in this test's copy
    problems = presets.check("rules", bad, [lib["as-modelled"]])
    assert any("section 'nowhere'" in p for p in problems)
    assert any("working_space" in p and "range" in p for p in problems)


def test_save_writes_user_presets_and_never_shipped_ones(tmp_path, monkeypatch):
    import copy
    from ifc_boq import paths
    monkeypatch.setattr(paths, "USER_PRESETS", tmp_path)
    lib = presets.rule_sets()

    assert "shipped preset" in presets.save("rules", copy.deepcopy(lib["as-modelled"]))[0]
    assert not (tmp_path / "rules").exists()

    mine = {"schemaVersion": "1.0", "id": "our-rules", "name": "Our rules", "version": "1",
            "extends": "as-modelled", "params": {"wall_opening_threshold": {"value": 0.5}}}
    assert presets.save("rules", mine) == []
    assert presets.rule_sets()["our-rules"]["params"] == mine["params"]
    assert presets.origins("rules")["our-rules"] == "user" and presets.origins("rules")["as-modelled"] == "shipped"
    assert presets.save("rules", {**mine, "params": {"wall_opening_threshold": {"value": 1}}}) == []  # replaces
    assert presets.rule_sets()["our-rules"]["params"]["wall_opening_threshold"]["value"] == 1

    assert presets.save("rules", {**mine, "id": "x2", "extends": "nope"})        # problems: not written
    assert "x2" not in presets.rule_sets()
    assert "file name" in presets.save("rules", {**mine, "id": "../evil"})[0]

    c = presets.classifications()["demo-trades"]
    cl = {**c["codeList"], "id": "our-codes"}
    assert presets.save("classifications", {"codeList": cl, "map": {**c["map"], "codeList": "our-codes"}}) == []
    assert presets.classifications()["our-codes"]["origin"] == "user"

    assert presets.delete("rules", "our-rules") and "our-rules" not in presets.rule_sets()
    assert presets.delete("classifications", "our-codes") and "our-codes" not in presets.classifications()
    assert not presets.delete("rules", "as-modelled")


def test_dictionary_entries_point_to_defined_terms():
    terms = {t["id"] for d in presets.dictionaries().values() for t in d.get("terms", [])}
    for d in presets.dictionaries().values():
        for e in d["entries"]:
            assert e["term"] in terms, f"{d['id']}: entry {e['id']} -> undefined term {e['term']}"
