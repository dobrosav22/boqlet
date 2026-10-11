"""
presets.py - load and validate the bundled presets (repo-root /presets).

Layout:
  presets/rules/<id>.json                       RuleSet or RuleSetPatch
  presets/dictionaries/<id>.json                Dictionary (any layer)
  presets/classifications/<id>/codelist.json    CodeList
  presets/classifications/<id>/map.json         ClassificationMap
  presets/settings/resolution.json              ResolutionSettings

Every file is validated against packages/types/schema/*.schema.json when those
schemas exist (they are generated from the TypeScript types: npm run codegen).
Override the folder with IFC_BOQ_PRESETS.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

from .paths import PRESETS, SCHEMAS

SCHEMA_FOR = {"rules": "rule-set", "dictionaries": "dictionary", "codelist": "codelist", "map": "classification-map",
              "resolution": "resolution-settings"}


@lru_cache(maxsize=16)
def _schema(name: str):
    p = SCHEMAS / f"{name}.schema.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def validate(doc: dict, kind: str, where: str = "") -> None:
    schema = _schema(SCHEMA_FOR[kind])
    if schema is None:
        return
    import jsonschema
    try:
        jsonschema.validate(doc, schema)
    except jsonschema.ValidationError as e:
        path = "/".join(str(p) for p in e.absolute_path)
        raise ValueError(f"{where or kind}: invalid at '{path}': {e.message[:300]}") from None


def _load(p: Path, kind: str) -> dict:
    doc = json.loads(p.read_text(encoding="utf-8"))
    validate(doc, kind, str(p.relative_to(PRESETS.parent)) if PRESETS.parent in p.parents else str(p))
    return doc


def rule_sets() -> dict[str, dict]:
    return {d["id"]: d for d in (_load(p, "rules") for p in sorted((PRESETS / "rules").glob("*.json")))}


def dictionaries() -> dict[str, dict]:
    return {d["id"]: d for d in (_load(p, "dictionaries") for p in sorted((PRESETS / "dictionaries").glob("*.json")))}


def classifications() -> dict[str, dict]:
    """id -> {"map": ..., "codeList": ... or None, "available": bool, "reason": str}"""
    out = {}
    for d in sorted(p for p in (PRESETS / "classifications").iterdir() if p.is_dir()):
        mp = d / "map.json"
        if not mp.exists():
            continue
        m = _load(mp, "map")
        cl_path = d / "codelist.json"
        entry = {"id": d.name, "map": m, "codeList": None, "available": cl_path.exists(), "reason": None}
        if cl_path.exists():
            entry["codeList"] = _load(cl_path, "codelist")
        else:
            entry["reason"] = (f"Code list not installed. Run `npm run import:uniclass`" if "uniclass" in d.name
                               else "codelist.json missing")
        out[d.name] = entry
    return out


def resolution() -> dict:
    p = PRESETS / "settings" / "resolution.json"
    return _load(p, "resolution") if p.exists() else {"unresolved": "ask"}


def load_rule_set(ref: str) -> tuple[dict, dict[str, dict]]:
    """A preset id or a path to a JSON file. Returns (rule set, library for flattening)."""
    lib = rule_sets()
    if ref in lib:
        return lib[ref], lib
    p = Path(ref)
    doc = json.loads(p.read_text(encoding="utf-8"))
    validate(doc, "rules", ref)
    lib[doc["id"]] = doc
    return doc, lib


def load_dictionary(ref: str) -> dict:
    lib = dictionaries()
    if ref in lib:
        return lib[ref]
    doc = json.loads(Path(ref).read_text(encoding="utf-8"))
    validate(doc, "dictionaries", ref)
    return doc


def load_classification(ref: str) -> tuple[dict, dict]:
    """A preset id, or 'codelist.json,map.json'. Returns (code list, map)."""
    lib = classifications()
    if ref in lib:
        e = lib[ref]
        if not e["available"]:
            raise ValueError(f"Classification '{ref}' is not available: {e['reason']}")
        return e["codeList"], e["map"]
    cl_path, map_path = ref.split(",")
    cl = json.loads(Path(cl_path).read_text(encoding="utf-8"))
    m = json.loads(Path(map_path).read_text(encoding="utf-8"))
    validate(cl, "codelist", cl_path)
    validate(m, "map", map_path)
    return cl, m


def terms() -> list[dict]:
    out = {}
    for d in dictionaries().values():
        for t in d.get("terms", []):
            out[t["id"]] = {"id": t["id"], "label": t["label"], "category": t["category"]}
    return sorted(out.values(), key=lambda t: t["id"])


DEFAULTS = {"ruleSet": "as-modelled", "dictionaries": ["global-seed"], "classifications": ["acme-cost-codes"]}


def env_or(name: str, default: str) -> str:
    return os.environ.get(name, default)
