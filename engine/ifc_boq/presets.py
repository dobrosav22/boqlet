"""
presets.py - load and validate the bundled presets (repo-root /presets).

Layout:
  presets/rules/<id>.json                       RuleSet or RuleSetPatch
  presets/dictionaries/<id>.json                Dictionary (any layer)
  presets/classifications/<id>/codelist.json    CodeList
  presets/classifications/<id>/map.json         ClassificationMap
  presets/settings/resolution.json              ResolutionSettings
  presets/settings/federation.json              FederationSettings (discipline ownership)
  presets/user/{rules,dictionaries,classifications}/...
                                                the same layout, for presets saved from the Library
                                                (USER_PRESETS, git-ignored). A shipped preset wins
                                                over a user one with the same id; save() refuses that.

Every file is validated against packages/types/schema/*.schema.json when those
schemas exist (they are generated from the TypeScript types: npm run codegen).
Override the folders with IFC_BOQ_PRESETS and IFC_BOQ_USER_PRESETS.
"""
from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path

from . import paths
from .paths import PRESETS, SCHEMAS

SCHEMA_FOR = {"rules": "rule-set", "dictionaries": "dictionary", "codelist": "codelist", "map": "classification-map",
              "resolution": "resolution-settings", "federation": "federation-settings"}


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


KINDS = ("rules", "dictionaries", "classifications")


def _roots():
    """(folder, origin), user first so that a shipped preset with the same id replaces it."""
    return [(paths.USER_PRESETS, "user"), (PRESETS, "shipped")]


def _json_docs(kind: str) -> dict[str, tuple[dict, str]]:
    out = {}
    for root, origin in _roots():
        for p in sorted((root / kind).glob("*.json")):
            d = _load(p, kind)
            out[d["id"]] = (d, origin)
    return out


def rule_sets() -> dict[str, dict]:
    return {k: d for k, (d, _) in _json_docs("rules").items()}


def dictionaries() -> dict[str, dict]:
    return {k: d for k, (d, _) in _json_docs("dictionaries").items()}


def classifications() -> dict[str, dict]:
    """id -> {"map": ..., "codeList": ... or None, "available": bool, "reason": str, "origin": shipped | user}"""
    out = {}
    for root, origin in _roots():
        folder = root / "classifications"
        if not folder.is_dir():
            continue
        for d in sorted(p for p in folder.iterdir() if p.is_dir()):
            mp = d / "map.json"
            if not mp.exists():
                continue
            m = _load(mp, "map")
            cl_path = d / "codelist.json"
            entry = {"id": d.name, "map": m, "codeList": None, "available": cl_path.exists(), "reason": None,
                     "origin": origin}
            if cl_path.exists():
                entry["codeList"] = _load(cl_path, "codelist")
            else:
                entry["reason"] = (f"Code list not installed. Run `npm run import:uniclass`" if "uniclass" in d.name
                                   else "codelist.json missing")
            out[d.name] = entry
    return out


def origins(kind: str) -> dict[str, str]:
    """id -> "shipped" | "user" for every preset of a kind."""
    if kind == "classifications":
        return {k: c["origin"] for k, c in classifications().items()}
    return {k: o for k, (_, o) in _json_docs(kind).items()}


SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9._-]{0,79}$")


def _doc_id(kind: str, doc: dict) -> str | None:
    return (doc.get("codeList") or {}).get("id") if kind == "classifications" else doc.get("id")


def save(kind: str, doc: dict) -> list[str]:
    """Write a draft to the user presets folder if the engine accepts it. Returns the problems; [] = saved.

    Shipped presets are never overwritten: a draft of one must be saved under a new id. A user preset
    with the same id is replaced.
    """
    if kind not in KINDS:
        raise ValueError(f"unknown preset kind '{kind}'")
    pid = _doc_id(kind, doc)
    if not isinstance(pid, str) or not SAFE_ID.match(pid):
        return [f"id '{pid}' cannot be a file name: use lower-case letters, digits, '.', '-' or '_'"]
    if origins(kind).get(pid) == "shipped":
        return [f"'{pid}' is a shipped preset and is not overwritten; save it under a new id"]
    problems = check(kind, doc)
    if problems:
        return problems
    text = lambda d: json.dumps(d, indent=2, ensure_ascii=False) + "\n"
    if kind == "classifications":
        folder = paths.USER_PRESETS / kind / pid
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "codelist.json").write_text(text(doc["codeList"]), encoding="utf-8")
        (folder / "map.json").write_text(text(doc["map"]), encoding="utf-8")
    else:
        folder = paths.USER_PRESETS / kind
        folder.mkdir(parents=True, exist_ok=True)
        (folder / f"{pid}.json").write_text(text(doc), encoding="utf-8")
    return []


def delete(kind: str, pid: str) -> bool:
    """Remove a user preset. False when there is no user preset with that id (shipped ones are never removed)."""
    if kind not in KINDS or origins(kind).get(pid) != "user" or not SAFE_ID.match(pid):
        return False
    if kind == "classifications":
        folder = paths.USER_PRESETS / kind / pid
        for f in folder.glob("*.json"):
            f.unlink()
        folder.rmdir()
    else:
        (paths.USER_PRESETS / kind / f"{pid}.json").unlink()
    return True


def resolution() -> dict:
    p = PRESETS / "settings" / "resolution.json"
    return _load(p, "resolution") if p.exists() else {"unresolved": "ask"}


FEDERATION_DEFAULT = {"schemaVersion": "1.0", "id": "federation-none", "name": "No ownership", "version": "1",
                      "disciplines": {}, "storeyTolerance": 0.25, "duplicateOverlap": 0.5}


def federation() -> dict:
    p = PRESETS / "settings" / "federation.json"
    return _load(p, "federation") if p.exists() else dict(FEDERATION_DEFAULT)


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


EXPR_KEYS = {"if", "expr", "where", "partFilter", "when"}


def _schema_problems(doc, kind: str, where: str) -> list[str]:
    schema = _schema(SCHEMA_FOR[kind])
    if schema is None:
        return []
    import jsonschema
    v = jsonschema.Draft7Validator(schema)
    return [f"{where}{'/'.join(str(p) for p in e.absolute_path) or '(root)'}: {e.message[:300]}"
            for e in sorted(v.iter_errors(doc), key=lambda e: list(map(str, e.absolute_path)))[:25]]


def _expr_problems(node, path: str = "") -> list[str]:
    """Syntax-check every expression in a preset (keys known to hold one), without evaluating."""
    from .expr import syntax_problem
    out = []
    if isinstance(node, dict):
        base = f"{path}[{node['id']}]" if isinstance(node.get("id"), str) else path
        for k, v in node.items():
            here = f"{base}.{k}" if base else k
            if isinstance(v, str) and (k in EXPR_KEYS or (k == "quantity" and "from" in node)):
                if (p := syntax_problem(v)):
                    out.append(f"{here}: {p}")
            elif k == "lineKey" and isinstance(v, list):
                out += [f"{here}: {p}" for s in v if isinstance(s, str) and (p := syntax_problem(s))]
            else:
                out += _expr_problems(v, here)
    elif isinstance(node, list):
        for x in node:
            out += _expr_problems(x, path)
    return out


def check(kind: str, doc: dict, library: list[dict] | None = None) -> list[str]:
    """Problems with a draft preset, as messages. [] = the engine would accept it.

    kind: rules | dictionaries | classifications ({"codeList", "map"}).
    `library`: other unsaved drafts of the same kind, so a draft patch can extend a draft.
    Uses the same checks as loading and the preset tests; never runs a model.
    """
    from .classify import code_targets
    from .rules import flatten, integrity
    if kind == "rules":
        problems = _schema_problems(doc, "rules", "")
        if not problems:
            lib = {**rule_sets(), **{d["id"]: d for d in library or [] if isinstance(d, dict) and "id" in d}}
            lib[doc["id"]] = doc
            try:
                flat = flatten(doc, lib)
                problems += integrity(flat)
                from .expr import syntax_problem
                problems += [f"slot {k}: {sp}" for k, p in flat["params"].items()
                             if p.get("type") == "formula" and (sp := syntax_problem(p.get("value") or ""))]
                problems += [f"slot {k}, choice '{c.get('label')}': {sp}" for k, p in flat["params"].items()
                             for c in p.get("choices") or [] if (sp := syntax_problem(c.get("value") or ""))]
                problems += [f"slot {k}: answer {p['value']} is outside the allowed range {p.get('min', '')}..{p.get('max', '')}"
                             for k, p in flat["params"].items() if p.get("type") == "number" and isinstance(p.get("value"), (int, float))
                             and ((p.get("min") is not None and p["value"] < p["min"]) or (p.get("max") is not None and p["value"] > p["max"]))]
                sections = {s["id"] for s in flat.get("sections", [])}
                problems += [f"slot {k}: section '{p['section']}' is not defined" for k, p in flat["params"].items()
                             if p.get("section") and sections and p["section"] not in sections]
            except (ValueError, KeyError, RecursionError) as e:
                problems.append(str(e) if not isinstance(e, RecursionError) else "The extends chain loops back on itself")
        return problems + _expr_problems({k: v for k, v in doc.items() if k != "id"})
    if kind == "dictionaries":
        problems = _schema_problems(doc, "dictionaries", "")
        if problems:
            return problems
        import re
        from .names import py_regex
        known = {t["id"] for d in dictionaries().values() if d["id"] != doc["id"] for t in d.get("terms", [])}
        known |= {t["id"] for t in doc.get("terms", [])}
        problems += [f"term '{t['id']}' is under '{t['broader']}', which is not defined"
                     for t in doc.get("terms", []) if t.get("broader") and t["broader"] not in known]
        problems += [f"entry '{e['id']}' points to undefined term '{e['term']}'"
                     for e in doc["entries"] if e["term"] not in known]
        for x in doc["entries"] + doc.get("extractors", []):
            rx = x.get("regex") or (x.get("match") or {}).get("regex")
            if rx:
                try:
                    re.compile(py_regex(rx))
                except re.error as err:
                    problems.append(f"'{x['id']}': regex does not compile: {err}")
        for dup in {i for i in [e["id"] for e in doc["entries"]] if [e["id"] for e in doc["entries"]].count(i) > 1}:
            problems.append(f"entry id '{dup}' is used more than once")
        return problems + _expr_problems({k: v for k, v in doc.items() if k != "id"})
    if kind == "classifications":
        cl, m = doc.get("codeList"), doc.get("map")
        problems = _schema_problems(cl, "codelist", "code list: ") + _schema_problems(m, "map", "map: ")
        if problems:
            return problems
        codes = [c["code"] for c in cl["codes"]]
        known = set(codes)
        problems += [f"code '{c}' appears more than once" for c in sorted({c for c in codes if codes.count(c) > 1})]
        problems += [f"code '{c['code']}' has parent '{c['parent']}', which is not in the list"
                     for c in cl["codes"] if c.get("parent") and c["parent"] not in known]
        if m["codeList"] != cl["id"]:
            problems.append(f"map points to code list '{m['codeList']}', but the code list id is '{cl['id']}'")
        for r in m["rules"]:
            problems += [f"map rule '{r['id']}' gives code '{c}', which is not in the code list"
                         for c in code_targets(r["code"]) if c not in known]
        unmapped = m["onUnmapped"]
        if isinstance(unmapped, dict) and unmapped.get("code") not in known:
            problems.append(f"default code for unmapped lines '{unmapped.get('code')}' is not in the code list")
        return problems + _expr_problems({k: v for k, v in m.items() if k != "id"})
    raise ValueError(f"unknown preset kind '{kind}'")


def flattened(doc: dict, library: list[dict] | None = None) -> dict | None:
    """The draft rule set with its extends chain resolved, as the engine would run it; None if it cannot be."""
    from .rules import flatten
    lib = {**rule_sets(), **{d["id"]: d for d in library or [] if isinstance(d, dict) and "id" in d}}
    try:
        lib[doc["id"]] = doc
        return flatten(doc, lib)
    except Exception:  # a broken draft: check() reports why
        return None


def terms() -> list[dict]:
    out = {}
    for d in dictionaries().values():
        for t in d.get("terms", []):
            out[t["id"]] = {"id": t["id"], "label": t["label"], "category": t["category"]}
    return sorted(out.values(), key=lambda t: t["id"])


DEFAULTS = {"ruleSet": "as-modelled", "dictionaries": ["global-seed"], "classifications": ["acme-cost-codes"]}


def env_or(name: str, default: str) -> str:
    return os.environ.get(name, default)
