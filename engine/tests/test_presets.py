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


def test_dictionary_entries_point_to_defined_terms():
    terms = {t["id"] for d in presets.dictionaries().values() for t in d.get("terms", [])}
    for d in presets.dictionaries().values():
        for e in d["entries"]:
            assert e["term"] in terms, f"{d['id']}: entry {e['id']} -> undefined term {e['term']}"
