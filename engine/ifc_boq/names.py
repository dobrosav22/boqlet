"""
names.py - input (4): layered dictionaries -> canonical terms.

Resolver turns raw names from the IFC (materials, layer materials, type names,
space names, ...) into dictionary terms, and runs extractors that pull values
out of names (Revit Family:Type:Id, thickness hints, strength classes, profiles).

Resolution order (see packages/types/src/dictionary.ts):
  decision layer (user answers in this run)  ->  project  ->  company  ->  global
  within a layer: exact -> startsWith -> regex -> contains   (settings.matchOrder)
First match wins. Unresolved names become `unknown_name` questions (pipeline.py).
"""
from __future__ import annotations

import re
import unicodedata
from collections import defaultdict

from .expr import Expr

LAYERS = ("decision", "project", "company", "global")
METHODS = ("exact", "startsWith", "regex", "contains")
UNIT_TO_M = {"mm": 0.001, "cm": 0.01, "m": 1.0, "in": 0.0254, "ft": 0.3048}


def fold(s: str | None, accents: bool = True, lower: bool = True) -> str:
    if s is None:
        return ""
    if accents:
        s = s.replace("đ", "dj").replace("Đ", "Dj")
        s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    return s.lower() if lower else s


def py_regex(pattern: str) -> str:
    """Dictionaries use ECMAScript named groups (?<name>...); Python needs (?P<name>...)."""
    return re.sub(r"\(\?<(?![=!])", "(?P<", pattern)


def as_list(x):
    return x if isinstance(x, list) else [x]


class Resolver:
    def __init__(self, dictionaries: list[dict], settings: dict | None = None, decision_entries: list[dict] | None = None):
        self.settings = settings or {}
        order = self.settings.get("layerOrder", ["project", "company", "global"])
        self.layer_order = ["decision"] + [l for l in order if l != "decision"]
        self.match_order = self.settings.get("matchOrder", list(METHODS))
        self.terms: dict[str, dict] = {}
        self.entries: dict[str, list] = defaultdict(list)
        self.extractors: list[dict] = []
        self.dictionary_ids = [d["id"] for d in dictionaries]
        # global first so company/project terms can refine global ones
        for d in sorted(dictionaries, key=lambda d: LAYERS[::-1].index(d["layer"])):
            for t in d.get("terms", []):
                self.terms[t["id"]] = t
            for e in d["entries"]:
                self.entries[d["layer"]].append({**e, "_dict": d["id"]})
        for e in decision_entries or []:
            self.entries["decision"].append({**e, "_dict": "decisions"})
        for layer in self.layer_order:
            for d in dictionaries:
                if d["layer"] == layer:
                    self.extractors += d.get("extractors", [])
        self.broader = {k: v.get("broader") for k, v in self.terms.items()}
        self.expr = Expr(self.broader)
        self.cache: dict = {}

    # ---------------------------------------------------------------- matching
    def matches(self, entry, raw: str) -> bool:
        m = entry["match"]
        lower = not entry.get("caseSensitive", False)
        acc = entry.get("ignoreAccents", True)
        r = fold(raw.strip(), acc, lower)
        if "exact" in m:
            return any(r == fold(x.strip(), acc, lower) for x in as_list(m["exact"]))
        if "startsWith" in m:
            return any(r.startswith(fold(x, acc, lower)) for x in as_list(m["startsWith"]))
        if "contains" in m:
            return any(fold(x, acc, lower) in r for x in as_list(m["contains"]))
        if "regex" in m:
            flags = re.I if lower else 0
            pat = py_regex(m["regex"])
            return bool(re.search(pat, raw, flags) or re.search(pat, fold(raw, acc, False), flags))
        return False

    def when_ok(self, item, ctx) -> bool:
        w = item.get("when")
        return True if not w else bool(self.expr.evaluate(w, ctx))

    def resolve(self, field: str, raw: str | None, ctx: dict) -> dict:
        if not raw:
            return {"field": field, "raw": raw or "", "term": None, "method": "none", "confidence": 0}
        key = (field, raw, ctx.get("ifc_class"), ctx.get("predefined_type"))
        if key in self.cache:
            return self.cache[key]
        res = {"field": field, "raw": raw, "term": None, "method": "none", "confidence": 0}
        for layer in self.layer_order:
            hit = None
            for method in self.match_order:
                for e in self.entries.get(layer, []):
                    if next(iter(e["match"])) != method or field not in as_list(e["field"]):
                        continue
                    if self.when_ok(e, ctx) and self.matches(e, raw):
                        hit = e
                        break
                if hit:
                    break
            if hit:
                res = {"field": field, "raw": raw, "term": hit["term"], "method": next(iter(hit["match"])),
                       "layer": layer, "entryId": hit["id"], "dictionary": hit["_dict"],
                       "confidence": hit.get("confidence", 1)}
                break
        self.cache[key] = res
        return res

    # ---------------------------------------------------------------- extractors
    def extract(self, field: str, raw: str | None, ctx: dict) -> dict:
        out = {}
        if not raw:
            return out
        for x in self.extractors:
            if field not in as_list(x["field"]) or not self.when_ok(x, ctx):
                continue
            m = re.search(py_regex(x["regex"]), raw, re.I)
            if not m:
                continue
            for group, spec in x["outputs"].items():
                val = m.groupdict().get(group)
                if val is None:
                    continue
                if "unit" in spec:
                    try:
                        val = round(float(val.replace(",", ".")) * UNIT_TO_M[spec["unit"]], 6)
                    except (ValueError, KeyError):
                        continue
                out.setdefault(spec["target"], {"value": val, "extractor": x["id"],
                                                "override": x.get("override", False)})
        return out

    def under(self, term, root) -> bool:
        return self.expr.under(term, root)

    def term_prop(self, term: str | None, prop: str):
        """A term's property, inherited from broader terms (e.g. density)."""
        seen = 0
        while term and seen < 50:
            t = self.terms.get(term, {})
            if prop in t.get("props", {}):
                return t["props"][prop]
            term = t.get("broader")
            seen += 1
        return None


def decision_entries(decisions: list[dict]) -> list[dict]:
    """Answers to unknown_name questions become exact-match entries in the decision layer."""
    out = []
    for d in decisions:
        qid = d.get("questionId", "")
        if not qid.startswith("name:") or not d.get("answer"):
            continue
        _, field, raw = qid.split(":", 2)
        out.append({"id": f"decision:{field}:{raw}", "field": field, "match": {"exact": raw},
                    "term": d["answer"], "source": "user", "caseSensitive": True})
    return out
