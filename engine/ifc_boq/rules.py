"""
rules.py - input (2): execute a rule set (OurRuleType, packages/types/src/rules.ts)
against MeasuredElement[] and produce BoQ lines.

  flatten()      RuleSetPatch chain -> one RuleSet (snapshot stored with the result)
  integrity()    problems in a rule set regardless of the model
  RuleEngine     selection, quantities (QuantitySpec), deductions, breakdowns, line keys,
                 bands, rounding, claims, onMissing, derived rules, manual items

Every number is explained in the calculation log ("quantity" / "derived" stages) and in
each line's trace, so a user can see exactly how it was produced.
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict

from .expr import Expr, fmt
from .log import CalcLog

UNIT_DEFAULT = {"count": "nr", "length": "m", "area": "m2", "volume": "m3", "mass": "kg", "perimeter": "m"}
UNIT_FACTOR = {  # from SI base (m, m2, m3, kg, nr)
    "m": 1, "mm": 1000, "km": 0.001, "ft": 3.280839895, "m2": 1, "ft2": 10.7639104, "yd2": 1.19599005,
    "m3": 1, "ft3": 35.3146667, "yd3": 1.30795062, "kg": 1, "t": 0.001, "lb": 2.20462262,
}
MIXABLE = ("material", "element_type", "storey", "storey_elevation", "predefined_type", "is_external", "ifc_class", "family")


# ============================================================================ rule sets
def flatten(target: dict, library: dict[str, dict]) -> dict:
    """params merge by name; items / derived / manual override by id; `remove` drops ids."""
    if "extends" not in target:
        out = json.loads(json.dumps(target))
        out.setdefault("derived", [])
        out.setdefault("manual", [])
        out["chain"] = [target["id"]]
        return out
    if target["extends"] not in library:
        raise ValueError(f"Rule set '{target['id']}' extends unknown rule set '{target['extends']}'")
    base = flatten(library[target["extends"]], library)
    for name, p in (target.get("params") or {}).items():
        base["params"][name] = {**base["params"].get(name, {}), **p}
    removed = set(target.get("remove", []))
    for key in ("items", "derived", "manual"):
        cur = {x["id"]: x for x in base.get(key, [])}
        for x in target.get(key, []):
            cur[x["id"]] = x
        base[key] = [x for x in cur.values() if x["id"] not in removed]
    for k in ("id", "name", "version"):
        base[k] = target[k]
    base["meta"] = {**base.get("meta", {}), **target.get("meta", {})}
    if target.get("defaults"):
        base["defaults"] = {**base.get("defaults", {}), **target["defaults"]}
    base["chain"] = base["chain"] + [target["id"]]
    base.pop("extends", None)
    base.pop("remove", None)
    return base


def integrity(rules: dict) -> list[str]:
    ids = {x["id"] for x in rules["items"]}
    out = [f"derived rule '{d['id']}' reads from '{src}', which does not exist (removed or renamed?)"
           for d in rules.get("derived", []) for src in d["from"] if src not in ids]
    params = set(rules["params"])
    for x in rules["items"] + rules.get("derived", []) + rules.get("manual", []):
        blob = json.dumps(x)
        for ref in re.findall(r'"param":\s*"([^"]+)"', blob) + re.findall(r"\bp\.([A-Za-z_][A-Za-z0-9_]*)", blob):
            if ref not in params:
                out.append(f"'{x['id']}' uses parameter '{ref}', which is not defined")
    return sorted(set(out))


def referenced_fields(rules: dict, maps: list[dict]) -> set[str]:
    """Which element fields rules and maps actually use (drives which questions block)."""
    blob = json.dumps({"rules": rules, "maps": maps})
    fields = set()
    for f in ("material", "element_type", "space_type", "layers", "family_name", "type_name"):
        if re.search(rf'\b{f}\b', blob):
            fields.add(f)
    return fields


# ============================================================================ engine
class RuleEngine:
    def __init__(self, rules: dict, elements: list[dict], expr: Expr, log: CalcLog,
                 decisions: dict[str, object] | None = None):
        self.rules = rules
        self.params = {k: v.get("value") for k, v in rules["params"].items()}
        self.el = elements
        self.by_guid = {e["guid"]: e for e in elements}
        self.x = expr
        self.log = log
        self.decisions = decisions or {}
        self.defaults = rules.get("defaults", {})
        self.questions: list[dict] = []
        self.warnings: list[dict] = []
        self.lines: dict[tuple, dict] = {}
        self.lines_by_rule: dict[str, list[dict]] = defaultdict(list)
        self.matched: set[str] = set()
        self.excluded: set[str] = set()
        self.skipped_parts: set[str] = set()
        self.claims: dict[tuple, list[str]] = defaultdict(list)

    # ---------------------------------------------------------------- helpers
    def val(self, v):
        if isinstance(v, dict) and "param" in v:
            return self.params.get(v["param"])
        return v

    def enabled(self, x) -> bool:
        return self.val(x.get("enabled", True)) is not False

    def ctx(self, part: dict) -> dict:
        return {**part, "p": self.params}

    def select(self, sel: dict, el: dict) -> bool:
        if "all" in sel:
            return all(self.select(s, el) for s in sel["all"])
        if "any" in sel:
            return any(self.select(s, el) for s in sel["any"])
        if "not" in sel:
            return not self.select(sel["not"], el)
        if "ifcClass" in sel:
            cls = sel["ifcClass"] if isinstance(sel["ifcClass"], list) else [sel["ifcClass"]]
            return el["ifc_class"] in cls or el["ifc_class_raw"] in cls
        if "family" in sel:
            fams = sel["family"] if isinstance(sel["family"], list) else [sel["family"]]
            return el["family"] in fams
        if "expr" in sel:
            return bool(self.x.evaluate(sel["expr"], self.ctx(el)))
        f, op, v = sel["field"], sel["op"], self.val(sel.get("value"))
        x = el.get("props", {}).get(f[6:]) if f.startswith("props.") else el.get(f)
        if op == "eq":
            return x == v
        if op == "neq":
            return x != v
        if op == "in":
            return x in (v or [])
        if op == "not_in":
            return x not in (v or [])
        if op == "contains":
            return x is not None and str(v).lower() in str(x).lower()
        if op == "starts_with":
            return x is not None and str(x).lower().startswith(str(v).lower())
        if op == "matches":
            return x is not None and re.search(str(v), str(x), re.I) is not None
        if op == "under":
            return self.x.under(x, v)
        if op == "exists":
            return x is not None
        if op == "missing":
            return x is None
        if op == "between":
            return x is not None and v is not None and v[0] <= x <= v[1]
        if op in ("gt", "gte", "lt", "lte"):
            if x is None or v is None:
                return False
            return {"gt": x > v, "gte": x >= v, "lt": x < v, "lte": x <= v}[op]
        raise ValueError(f"Unknown selector op '{op}'")

    # ---------------------------------------------------------------- quantities
    def deductions(self, gross: float, rules: list[dict], part: dict, per: str) -> tuple[float, list[str]]:
        """Apply DeductionRule[] to a gross value. per = 'area' | 'volume' | 'length'."""
        notes, total = [], 0.0
        thickness = part.get("thickness") or 0
        for d in rules or []:
            what, mode = d["what"], self.val(d["mode"])
            if mode == "none":
                continue
            if what in ("embedded", "recesses"):
                notes.append(f"deduction of {what} not supported yet (ignored)")
                continue
            kinds = {"openings": None, "doors": "door", "windows": "window", "voids": "void"}[what]
            ops = [o for o in part.get("openings", []) if kinds is None or o["kind"] == kinds]
            if d.get("where"):
                ops = [o for o in ops if self.x.evaluate(d["where"], {**self.ctx(part), **o})]
            if not ops:
                continue
            t = self.val(d.get("threshold")) or 0
            by = self.val(d.get("compareBy")) or "area"
            size = lambda o: o.get(by) or 0
            amount = lambda o: (o["area"] or 0) * (thickness if per == "volume" else 1) if per != "length" else (o["width"] or 0)
            if mode == "all":
                chosen = ops
                ded = sum(amount(o) for o in ops)
            elif mode == "over_threshold":
                chosen = [o for o in ops if size(o) > t]
                ded = sum(amount(o) for o in chosen)
            elif mode == "excess_only":
                chosen = [o for o in ops if size(o) > t]
                ded = sum(amount(o) * (size(o) - t) / size(o) for o in chosen if size(o))
            elif mode == "per_element_sum":
                chosen = ops if sum(size(o) for o in ops) > t else []
                ded = sum(amount(o) for o in chosen)
            else:
                raise ValueError(f"Unknown deduction mode {mode}")
            total += ded
            kept = len(ops) - len(chosen)
            msg = f"- {fmt(round(ded, 4))} ({len(chosen)} {what} deducted, mode {mode}"
            if mode != "all":
                msg += f", threshold {fmt(t)} by {by}"
            msg += f"{'; ' + str(kept) + ' kept' if kept else ''})"
            notes.append(msg)
            if self.val(d.get("addReveals")) and per == "area" and chosen:
                rev = sum((2 * (o["height"] or 0) + (o["width"] or 0)) * (o.get("depth") or thickness) for o in chosen)
                total -= rev
                notes.append(f"+ {fmt(round(rev, 4))} reveals")
        return gross - total, notes

    def surface_values(self, part: dict, surface: str) -> tuple[float | None, float | None, str]:
        g, n = part.get("gross_area"), part.get("net_area")
        if surface in ("main", "top", "bottom", "larger", "smaller", "mean", "side_a", "side_b"):
            return g, n, surface
        if surface == "both":
            return (2 * g if g is not None else None), (2 * n if n is not None else None), "both faces"
        if surface == "footprint":
            v = part.get("footprint_area")
            return v, v, "footprint"
        if surface == "developed":
            v = part.get("developed_area") or n
            return v, v, "developed"
        if surface == "edges":
            p, t = part.get("perimeter"), part.get("thickness")
            v = p * t if p and t else None
            return v, v, "edges (perimeter x thickness)"
        return g, n, surface

    def quantity(self, spec: dict, part: dict) -> tuple[float | None, str, str]:
        """(value in SI or None, unit, explanation)."""
        k = spec["kind"]
        unit = spec.get("unit") or UNIT_DEFAULT.get(k, "nr")
        if k == "count":
            return 1.0, unit, "count = 1"
        if k == "perimeter":
            v = part.get("perimeter")
            return v, unit, f"perimeter = {fmt(v)}"
        if k == "length":
            basis = self.val(spec.get("basis")) or "axis"
            field = {"girth": "profile_girth", "perimeter": "perimeter"}.get(basis, "length")
            v = part.get(field)
            if v is None:
                return None, unit, f"length ({basis}) missing"
            if spec.get("deductions"):
                v, notes = self.deductions(v, spec["deductions"], part, "length")
                return v, unit, f"length ({basis}) {fmt(part.get(field))} " + " ".join(notes)
            return v, unit, f"length ({basis}) = {fmt(round(v, 4))}"
        if k == "area":
            surface = self.val(spec.get("surface")) or "main"
            start = self.val(spec.get("start")) or "gross"
            g, n, label = self.surface_values(part, surface)
            if spec.get("deductions"):
                if g is None:
                    return None, unit, f"area ({label}) missing"
                if surface == "both":                      # deduct openings from each face
                    one, notes = self.deductions(g / 2, spec["deductions"], part, "area")
                    v = 2 * one
                    notes = [n + " per face" for n in notes]
                else:
                    v, notes = self.deductions(g, spec["deductions"], part, "area")
                return v, unit, (f"area ({label}, gross {fmt(round(g, 4))}) {' '.join(notes)} = {fmt(round(v, 4))}" if notes
                                 else f"area ({label}) = {fmt(round(v, 4))} (no openings to deduct)")
            v = g if start == "gross" else n
            return v, unit, f"area ({label}, {start}) = {fmt(round(v, 4)) if v is not None else 'missing'}"
        if k == "volume":
            start = self.val(spec.get("start")) or "net"
            if spec.get("deductions"):
                g = part.get("gross_volume")
                if g is None:
                    return None, unit, "volume missing"
                v, notes = self.deductions(g, spec["deductions"], part, "volume")
                return v, unit, (f"volume (gross {fmt(round(g, 4))}) {' '.join(notes)} = {fmt(round(v, 4))}" if notes
                                 else f"volume = {fmt(round(v, 4))} (no openings to deduct)")
            v = part.get("gross_volume" if start == "gross" else "net_volume")
            return v, unit, f"volume ({start}) = {fmt(round(v, 4)) if v is not None else 'missing'}"
        if k == "mass":
            basis = self.val(spec.get("basis")) or "volume_density"
            unit = spec.get("unit") or "kg"
            if basis == "nominal_per_length":
                L, m = part.get("length"), part.get("nominal_mass_per_length")
                if L and m:
                    return L * m, unit, f"mass = length x nominal kg/m = {fmt(round(L, 4))} x {fmt(m)} = {fmt(round(L * m, 3))} kg"
                basis = "volume_density"                       # fall back, explained
                fb = "no nominal kg/m for profile; "
            else:
                fb = ""
            if basis == "volume_density":
                V = part.get("net_volume")
                rho = self.val(spec.get("density")) or part.get("density")
                if V and rho:
                    return V * rho, unit, f"{fb}mass = volume x density = {fmt(round(V, 5))} x {fmt(rho)} = {fmt(round(V * rho, 3))} kg"
                return None, unit, f"{fb}mass: volume or density missing"
            v = part.get("mass")
            return v, unit, f"mass (reported) = {fmt(v)}"
        if k == "choose":
            pick = self.val(spec["pick"])
            if pick not in spec["options"]:
                return None, "nr", f"choose: option '{pick}' not defined"
            v, u, expl = self.quantity(spec["options"][pick], part)
            return v, u, f"[{pick}] {expl}"
        if k == "when":
            cond_val, cond_txt = self.x.explain(spec["if"], self.ctx(part))
            branch = "then" if cond_val else "else"
            v, u, expl = self.quantity(spec[branch], part)
            return v, u, f"when {cond_txt} -> {branch}: {expl}"
        if k == "formula":
            v, txt = self.x.explain(spec["expr"], self.ctx(part))
            return (float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None), spec["unit"], txt
        raise ValueError(f"Unknown quantity kind {k}")

    @staticmethod
    def convert(v: float | None, unit: str) -> float | None:
        if v is None:
            return None
        return v * UNIT_FACTOR.get(unit, 1)

    def round_(self, v, rounding):
        if v is None or not rounding:
            return v
        step = self.val(rounding["step"]) or 0
        if not step:
            return v
        mode = self.val(rounding.get("mode")) or "nearest"
        q = v / step
        q = math.ceil(q - 1e-9) if mode == "up" else math.floor(q + 1e-9) if mode == "down" else round(q)
        return round(q * step, 10)

    # ---------------------------------------------------------------- breakdown
    def parts_of(self, item: dict, el: dict) -> list[dict]:
        bd = self.val(item.get("breakdown")) or self.defaults.get("breakdown") or "element"
        if bd == "layer" and el.get("layers"):
            out = []
            for l in el["layers"]:
                t = l["thickness"]
                out.append({**el, "material": l["material"], "material_raw": l["material_raw"], "thickness": t,
                            "layer_index": l["index"],
                            "net_volume": el["net_area"] * t if el.get("net_area") is not None else None,
                            "gross_volume": el["gross_area"] * t if el.get("gross_area") is not None else None,
                            "_part": f"layer {l['index'] + 1} {l['material_raw']}"})
            return out
        if bd == "face" and el.get("faces"):
            return [{**el, "gross_area": f["gross_area"], "net_area": f["net_area"], "side": f["side"],
                     "_part": f"face {f['side']}"} for f in el["faces"]]
        if bd == "material" and el.get("layers"):
            groups = defaultdict(float)
            for l in el["layers"]:
                groups[l["material"]] += l["thickness"]
            return [{**el, "material": m, "thickness": t,
                     "net_volume": el["net_area"] * t if el.get("net_area") is not None else None,
                     "_part": f"material {m}"} for m, t in groups.items()]
        if bd == "child" and el.get("child_guids"):
            return [{**self.by_guid[c], "_part": f"child {self.by_guid[c].get('name')}"} for c in el["child_guids"] if c in self.by_guid]
        return [el]

    # ---------------------------------------------------------------- template
    def render(self, tpl, part: dict, extra: dict | None = None) -> str:
        tpl = self.val(tpl) or ""
        ctx = {**self.ctx(part), **(extra or {})}

        def sub(m):
            src = m.group(1).strip()
            if src.startswith("expr:"):
                src = src[5:]
            try:
                v = self.x.evaluate(src, ctx)
            except Exception:
                return "{" + m.group(1) + "}"
            if v is None:
                return "-"
            if isinstance(v, str):
                return v
            return fmt(round(v, 3) if isinstance(v, float) else v)
        return re.sub(r"\{([^{}]+)\}", sub, tpl)

    # ---------------------------------------------------------------- items
    def run_items(self):
        items = [i for i in self.rules["items"]]
        enabled = [i for i in items if self.enabled(i)]
        forced = {}                                    # guid -> rule id, from answers to "unmatched" questions
        for e in self.el:
            ans = self.decisions.get(unmatched_id(e))
            if ans == "exclude":
                self.excluded.add(e["guid"])
            elif ans:
                forced[e["guid"]] = ans
        # pass 1: plain matches
        matches = {}
        for i in items:
            matches[i["id"]] = [e for e in self.el if self.select(i["match"], e)]
        parent_measured = {e["guid"] for i in enabled for e in matches[i["id"]]}
        # pass 2: per enabled rule, skip aggregate parts whose parent is measured
        for i in enabled:
            take = []
            for e in matches[i["id"]]:
                if e["guid"] in self.excluded:
                    continue
                if e.get("parent_guid") in parent_measured and (i.get("parts") or "skip") == "skip":
                    self.skipped_parts.add(e["guid"])
                    continue
                if i.get("partFilter") and not self.x.evaluate(i["partFilter"], self.ctx(e)):
                    continue
                take.append(e)
            take += [self.by_guid[g] for g, rid in forced.items() if rid == i["id"] and g in self.by_guid
                     and self.by_guid[g] not in take]
            self.log.info("match", f"rule '{i['id']}' ({i.get('label', '')}) takes {len(take)} element(s)"
                          + (f"; {len([e for e in matches[i['id']] if e['guid'] in self.skipped_parts])} aggregate part(s) skipped (parent measured)"
                             if any(e['guid'] in self.skipped_parts for e in matches[i['id']]) else ""),
                          ruleId=i["id"], data={"guids": [e["guid"] for e in take]})
            for e in take:
                self.matched.add(e["guid"])
                for c in i.get("claims", []):
                    self.claims[(e["guid"], c)].append(i["id"])
                for part in self.parts_of(i, e):
                    if i.get("partFilter") and part is not e and not self.x.evaluate(i["partFilter"], self.ctx(part)):
                        continue
                    self.add_part(i, e, part)
        decided_out = set(self.excluded)
        for i in items:
            if not self.enabled(i):
                for e in matches[i["id"]]:
                    if e["guid"] not in self.matched:
                        self.excluded.add(e["guid"])
                if matches[i["id"]]:
                    self.log.info("match", f"rule '{i['id']}' is disabled: {len(matches[i['id']])} element(s) excluded",
                                  ruleId=i["id"])
        self.excluded -= self.matched
        if decided_out:
            self.log.info("decision", f"{len(decided_out)} element(s) excluded by user answers")
        for (guid, claim), rids in self.claims.items():
            if len(rids) > 1:
                e = self.by_guid[guid]
                self.warnings.append({"code": "double_claim", "guids": [guid],
                                      "message": f"{e.get('name')}: rules {', '.join(rids)} both claim '{claim}' (possible double count)"})

    def add_part(self, item: dict, el: dict, part: dict):
        rid = item["id"]
        v, unit, expl = self.quantity(item["quantity"], part)
        note = None
        source = "measured"
        if v is None:
            on = item.get("onMissing") or self.defaults.get("onMissing") or "flag"
            qid = f"missing:{rid}:{el['guid']}"
            if qid in self.decisions and isinstance(self.decisions[qid], (int, float)):
                v = float(self.decisions[qid])
                note, source = f"value supplied by user ({fmt(v)})", "user"
                expl += f"; user answer {fmt(v)}"
            elif isinstance(on, dict):
                v = float(self.val(on["default"]))
                note = f"default {fmt(v)} used ({expl})"
            elif on == "skip":
                self.log.warn("quantity", f"{el.get('name')}: {expl}; skipped (onMissing skip)", ruleId=rid, guid=el["guid"])
                return
            elif on == "ask":
                self.questions.append({
                    "id": qid, "kind": "missing_data", "blocking": True, "guids": [el["guid"]],
                    "message": f"Rule '{item.get('label', rid)}' needs a quantity for {el.get('name')}: {expl}. Enter it in {unit}.",
                    "answer": {"kind": "number", "unit": unit}})
                note = "waiting for user input"
            else:
                note = f"missing: {expl}"
        factor = self.val(item.get("factor"))
        if v is not None and factor not in (None, 1):
            expl += f"; x factor {fmt(factor)}"
            v *= factor
        mn = item.get("minimum")
        if v is not None and mn and self.val(mn.get("per")) == "element":
            m = self.val(mn["value"])
            if v < m:
                expl += f"; raised to minimum {fmt(m)}"
                v = m
        v = self.convert(v, unit)
        rnd = item.get("rounding") or self.defaults.get("rounding")
        if rnd and self.val(rnd.get("at")) == "element":
            v = self.round_(v, rnd)
        # line key
        keys = {}
        for k in item.get("lineKey", []):
            keys[k] = part.get(k) if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", k) else self.x.evaluate(k, self.ctx(part))
        band_label = None
        for b in item.get("bands", []):
            x = part.get(b["field"])
            edges = [self.val(e) for e in b["edges"]]
            idx = sum(1 for e in edges if x is not None and x > e)
            labels = b.get("labels") or [f"band {i}" for i in range(len(edges) + 1)]
            band_label = labels[idx] if idx < len(labels) else f"band {idx}"
            keys[f"band:{b['field']}"] = band_label
        lk = (rid,) + tuple(_key(v_) for v_ in keys.values()) + (unit,)
        key = " | ".join(str(x) for x in lk)
        line = self.lines.get(lk)
        if line is None:
            desc = self.render(item["description"], part)
            if band_label:
                desc += f" ({band_label})"
            line = {"key": key, "ruleId": rid, "ruleKind": "item", "description": desc, "unit": unit,
                    "quantity": 0.0, "source": "measured", "family": el["family"], "keys": keys,
                    "trace": {"formula": describe_spec(item["quantity"], self), "params": self.params_used(item),
                              "elements": []},
                    "tags": item.get("tags", []), "notes": [], "_parts": [], "_missing": 0, "_rule": item}
            self.lines[lk] = line
            self.lines_by_rule[rid].append(line)
        line["trace"]["elements"].append({"guid": el["guid"], "name": (el.get("name") or "") + (f" [{part['_part']}]" if part.get("_part") else ""),
                                          "quantity": None if v is None else round(v, 6), "note": note or expl})
        line["_parts"].append(part)
        if v is None:
            line["_missing"] += 1
        else:
            line["quantity"] += v
        if source == "user":
            line["notes"].append(f"{el.get('name')}: user-supplied value")
        self.log.detail("quantity", f"{el.get('name') or el['guid']}{' [' + part['_part'] + ']' if part.get('_part') else ''}: "
                        f"{expl} -> {fmt(round(v, 4)) if v is not None else 'MISSING'} {unit}",
                        ruleId=rid, lineKey=key, guid=el["guid"])

    def params_used(self, item) -> dict:
        blob = json.dumps(item)
        names = set(re.findall(r'"param":\s*"([^"]+)"', blob)) | set(re.findall(r"\bp\.([A-Za-z_][A-Za-z0-9_]*)", blob))
        return {n: self.params.get(n) for n in sorted(names)}

    # ---------------------------------------------------------------- finalize
    def finalize_lines(self):
        for line in self.lines.values():
            item = line.pop("_rule")
            parts = line.pop("_parts")
            missing = line.pop("_missing")
            n = len(line["trace"]["elements"])
            if missing == n:
                line["quantity"] = None
                line["source"] = "flagged"
                line["notes"].append("quantity could not be determined for any element")
            elif missing:
                line["notes"].append(f"{missing} of {n} element(s) had no value and are not included")
            mn = item.get("minimum")
            if line["quantity"] is not None and mn and self.val(mn.get("per")) == "line":
                m = self.convert(self.val(mn["value"]), line["unit"])
                if line["quantity"] < m:
                    line["notes"].append(f"raised to line minimum {fmt(m)}")
                    line["quantity"] = m
            rnd = item.get("rounding") or self.defaults.get("rounding")
            if rnd and self.val(rnd.get("at", "line")) == "line":
                line["quantity"] = self.round_(line["quantity"], rnd)
            # summary fields for classification / grouping
            vals = {f: Counter(_key(p.get(f)) for p in parts) for f in MIXABLE}
            line["_fields"] = {f: _unkey(c.most_common(1)[0][0]) for f, c in vals.items()}
            line["_mixed"] = sorted(f for f, c in vals.items() if len(c) > 1)
            storeys = sorted({p.get("storey") for p in parts if p.get("storey")})
            line["location"] = {"storey": storeys[0]} if len(storeys) == 1 else ({"storeys": storeys} if storeys else {})
            line["_parts"] = parts
            self.log.info("quantity", f"line '{line['description']}' = {fmt(line['quantity']) if line['quantity'] is not None else 'FLAGGED'} "
                          f"{line['unit']} from {n} element(s)", ruleId=line["ruleId"], lineKey=line["key"])

    # ---------------------------------------------------------------- derived
    def run_derived(self) -> list[dict]:
        out: dict[tuple, dict] = {}
        for d in self.rules.get("derived", []):
            if not self.enabled(d):
                self.log.info("derived", f"derived rule '{d['id']}' disabled", ruleId=d["id"])
                continue
            unit = d["unit"]
            n_lines = 0
            for src_id in d["from"]:
                for src in self.lines_by_rule.get(src_id, []):
                    if d["scope"] == "line":
                        sctx = {**src["_fields"], **src["keys"], "qty": src["quantity"], "unit": src["unit"], "keys": src["keys"]}
                        sources = [(sctx, None, src)]
                    else:
                        sources = [(p, p.get("guid"), src) for p in src["_parts"]]
                    for sctx, guid, srcline in sources:
                        ctx = {**sctx, "src": sctx, "p": self.params}
                        if d.get("where") and not self.x.evaluate(d["where"], ctx):
                            continue
                        v, txt = self.x.explain(d["quantity"], ctx)
                        v = float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None
                        factor = self.val(d.get("factor"))
                        if v is not None and factor not in (None, 1):
                            txt += f" x factor {fmt(factor)}"
                            v *= factor
                        if v is None:
                            on = d.get("onMissing") or "flag"
                            if isinstance(on, dict):
                                v = float(self.val(on["default"]))
                                txt += f"; default {fmt(v)}"
                            elif on == "skip":
                                continue
                        # lineKey present (even []) = group by those keys; absent = one line per source line
                        grouped = "lineKey" in d
                        keys = {k: sctx.get(k) for k in d["lineKey"]} if grouped else dict(srcline["keys"])
                        lk = (d["id"],) + (tuple(_key(x) for x in keys.values()) if grouped else (srcline["key"],)) + (unit,)
                        line = out.get(lk)
                        if line is None:
                            line = {"key": " | ".join(str(x) for x in lk), "ruleId": d["id"], "ruleKind": "derived",
                                    "description": self.render(d["description"], sctx, {"src": sctx}),
                                    "unit": unit, "quantity": 0.0, "source": "derived", "family": srcline.get("family"),
                                    "keys": keys, "trace": {"formula": d["quantity"], "params": self.params_used(d),
                                                            "elements": [], "sourceLine": srcline["key"]},
                                    "tags": d.get("tags", []), "notes": [], "_fields": dict(srcline["_fields"]),
                                    "_mixed": list(srcline["_mixed"]), "location": srcline.get("location", {}),
                                    "_source_key": srcline["key"], "_missing": 0, "_count": 0}
                            out[lk] = line
                            n_lines += 1
                        line["_count"] += 1
                        line["trace"]["elements"].append({"guid": guid or "", "name": sctx.get("name") if guid else f"line {srcline['description']}",
                                                          "quantity": None if v is None else round(v, 6), "note": txt})
                        if v is None:
                            line["_missing"] += 1
                        else:
                            line["quantity"] += v
                        self.log.detail("derived", f"{d['id']} from {'element ' + str(sctx.get('name')) if guid else 'line ' + srcline['description']}: {txt}",
                                        ruleId=d["id"], lineKey=line["key"], guid=guid)
            if n_lines == 0:
                self.log.info("derived", f"derived rule '{d['id']}' produced no lines (no matching sources)", ruleId=d["id"])
        lines = []
        for line in out.values():
            if line["_missing"] == line["_count"]:
                line["quantity"], line["source"] = None, "flagged"
            elif line["_missing"]:
                line["notes"].append(f"{line['_missing']} source(s) had no value")
            rnd = next((x.get("rounding") for x in self.rules.get("derived", []) if x["id"] == line["ruleId"]), None) \
                or self.defaults.get("rounding")
            line["quantity"] = self.round_(line["quantity"], rnd)
            for k in ("_missing", "_count"):
                line.pop(k)
            self.log.info("derived", f"line '{line['description']}' = {fmt(line['quantity']) if line['quantity'] is not None else 'FLAGGED'} {line['unit']}",
                          ruleId=line["ruleId"], lineKey=line["key"])
            lines.append(line)
        return lines

    # ---------------------------------------------------------------- manual
    def run_manual(self) -> list[dict]:
        lines = []
        for m in self.rules.get("manual", []):
            if not self.enabled(m):
                continue
            q = self.val(m.get("quantity"))
            amount = self.val(m.get("amount"))
            line = {"key": m["id"], "ruleId": m["id"], "ruleKind": "manual", "description": self.render(m["description"], {}),
                    "unit": m["unit"], "quantity": float(q) if q is not None else None,
                    "source": "manual" if q is not None else "flagged", "keys": {},
                    "trace": {"formula": "manual item", "params": {}, "elements": []},
                    "tags": m.get("tags", []), "notes": [f"amount {fmt(amount)}"] if amount is not None else
                    ([] if q is not None else ["no model behind this line: quantity to be entered"]),
                    "_fields": {"manual_kind": m["kind"]}, "_mixed": [], "_manual_kind": m["kind"], "location": {}}
            lines.append(line)
            self.log.info("manual", f"manual item '{line['description']}' ({m['kind']}): "
                          f"{fmt(line['quantity']) + ' ' + line['unit'] if q is not None else 'quantity to be entered'}",
                          ruleId=m["id"], lineKey=line["key"])
        return lines


def unmatched_id(e: dict) -> str:
    """Question id grouping unmatched elements of the same class and type."""
    return f"unmatched:{e['ifc_class']}:{e.get('type_name') or e.get('name') or ''}"


def _key(v):
    if isinstance(v, float):
        return round(v, 6)
    return v


def _unkey(v):
    return v


def describe_spec(spec: dict, eng: RuleEngine | None = None) -> str:
    """Human-readable formula for a QuantitySpec (used in traces and the Excel sheet)."""
    v = (lambda x: eng.val(x)) if eng else (lambda x: x)
    k = spec["kind"]
    if k == "count":
        return "count"
    if k == "length":
        return f"length ({v(spec.get('basis')) or 'axis'})"
    if k in ("area", "volume"):
        base = f"{k}"
        if k == "area":
            base += f" ({v(spec.get('surface')) or 'main'}"
        else:
            base += " ("
        base += f"{', ' if k == 'area' else ''}{v(spec.get('start')) or ('gross' if k == 'area' else 'net')})"
        for d in spec.get("deductions") or []:
            mode = v(d["mode"])
            if mode == "none":
                continue
            base += f" - {d['what']}[{mode}"
            if mode != "all":
                base += f" > {fmt(v(d.get('threshold')) or 0)}"
            base += "]"
        return base
    if k == "mass":
        return f"mass ({v(spec.get('basis'))})"
    if k == "perimeter":
        return "perimeter"
    if k == "choose":
        pick = v(spec["pick"])
        return f"{pick}: " + describe_spec(spec["options"].get(pick, {"kind": "count"}), eng)
    if k == "when":
        return f"IF {spec['if']} THEN {describe_spec(spec['then'], eng)} ELSE {describe_spec(spec['else'], eng)}"
    if k == "formula":
        return spec["expr"]
    return k
