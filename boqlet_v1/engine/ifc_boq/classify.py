"""
classify.py - input (3): ClassificationMap + CodeList -> codes on BoQ lines.

Classification only labels lines; it never changes a quantity. For each system,
each line gets at most one code, chosen by (in the map's `sources` order):
  decision  a user's answer to an "unclassified" question
  ifc       classification references already on the line's elements in the IFC
  map       the map's rules (highest priority wins; ties -> first, or a question)
Lines no rule codes follow `onUnmapped` (flag | ask | default code).
"""
from __future__ import annotations

import re
from collections import Counter

from .expr import Expr
from .log import CalcLog


def line_fields(line: dict) -> dict:
    """Fields a LineMatch `where` can read (see classification.ts)."""
    f = dict(line.get("_fields", {}))
    f.update({"rule_id": line["ruleId"], "rule_kind": line["ruleKind"], "tags": line.get("tags", []),
              "unit": line["unit"], "source": line["source"], "keys": line.get("keys", {}),
              "manual_kind": line.get("_manual_kind")})
    for k, v in (line.get("keys") or {}).items():
        f.setdefault(k, v)
    return f


def _match(m: dict, line: dict, fields: dict, x: Expr) -> bool:
    if "all" in m:
        return all(_match(y, line, fields, x) for y in m["all"])
    if "any" in m:
        return any(_match(y, line, fields, x) for y in m["any"])
    if "not" in m:
        return not _match(m["not"], line, fields, x)
    if "ruleId" in m:
        return line["ruleId"] in (m["ruleId"] if isinstance(m["ruleId"], list) else [m["ruleId"]])
    if "tag" in m:
        tags = m["tag"] if isinstance(m["tag"], list) else [m["tag"]]
        return any(t in line.get("tags", []) for t in tags)
    if "manualKind" in m:
        return line.get("_manual_kind") in (m["manualKind"] if isinstance(m["manualKind"], list) else [m["manualKind"]])
    if "where" in m:
        return bool(x.evaluate(m["where"], fields))
    raise ValueError(f"Unknown line match {m}")


def _where_fields(m: dict) -> set[str]:
    out = set()
    if "where" in m:
        out |= set(re.findall(r"[A-Za-z_][A-Za-z0-9_.]*", re.sub(r'"[^"]*"', "", m["where"])))
    for k in ("all", "any"):
        for y in m.get(k, []):
            out |= _where_fields(y)
    if "not" in m:
        out |= _where_fields(m["not"])
    return out


def code_targets(target) -> list[str]:
    if isinstance(target, str):
        return [target]
    if isinstance(target, dict) and "table" in target:
        return list(target["table"].values()) + ([target["default"]] if target.get("default") else [])
    return []


def classify(lines: list[dict], code_list: dict, cmap: dict, x: Expr, log: CalcLog,
             decisions: dict, questions: list, warnings: list) -> None:
    system = code_list["id"]
    codes = {c["code"]: c for c in code_list["codes"]}
    for r in cmap["rules"]:
        for c in code_targets(r["code"]):
            if c not in codes:
                warnings.append({"code": "unknown_code", "message": f"[{system}] map rule '{r['id']}' emits code '{c}', not in the code list"})
    sources = cmap.get("sources") or ["decision", "map"]
    by_key = {}
    ordered = sorted(lines, key=lambda l: l["ruleKind"] == "derived")       # sources before derived
    for line in ordered:
        fields = line_fields(line)
        code, src, rule_id, why = None, None, None, ""
        for s in sources:
            if s == "decision":
                ans = decisions.get(f"unclassified:{system}:{line['key']}")
                if ans:
                    code, src, why = ans, "decision", "user answer"
            elif s == "ifc" and cmap.get("ifc"):
                names = {n.lower() for n in cmap["ifc"]["systemNames"]}
                found = Counter(c["code"] for p in line.get("_parts", []) for c in p.get("ifc_classifications", [])
                                if (c.get("system") or "").lower() in names and c.get("code"))
                if found:
                    code, n = found.most_common(1)[0]
                    src, why = "ifc", f"from IFC classification on {n} element(s)"
            elif s == "map":
                cands = [r for r in cmap["rules"] if _match(r["match"], line, fields, x)]
                if not cands:
                    continue
                top = max(r.get("priority", 0) for r in cands)
                best = [r for r in cands if r.get("priority", 0) == top]
                rule = best[0]
                if len(best) > 1 and cmap.get("onConflict") == "ask":
                    questions.append({"id": f"classconflict:{system}:{line['key']}", "kind": "classification_conflict",
                                      "blocking": False, "message": f"[{code_list['name']}] '{line['description']}': map rules "
                                      f"{', '.join(r['id'] for r in best)} all match with priority {top}.",
                                      "answer": {"kind": "code", "system": system}})
                t = rule["code"]
                if isinstance(t, str):
                    code = t
                elif t.get("fromSource"):
                    code = by_key.get(line.get("_source_key"), {}).get("code")
                else:
                    lk = t["lookup"]
                    val = fields.get(lk[5:]) if lk.startswith("keys.") else fields.get(lk)
                    code = t["table"].get(str(val), t.get("default"))
                src, rule_id, why = "map", rule["id"], f"map rule '{rule['id']}'"
                risky = (_where_fields(rule["match"]) | ({t["lookup"]} if isinstance(t, dict) and "lookup" in t else set())) \
                    & set(line.get("_mixed", []))
                if risky:
                    warnings.append({"code": "mixed_line", "ruleId": line["ruleId"],
                                     "message": f"[{system}] '{line['description']}' mixes elements with different "
                                                f"{', '.join(sorted(risky))}; map rule '{rule['id']}' depends on it. "
                                                f"Add the field to the rule's lineKey so the line splits."})
            if code:
                break
        if not code:
            unm = cmap.get("onUnmapped", "flag")
            if isinstance(unm, dict):
                code, src, why = unm["code"], "default", "onUnmapped default"
            elif unm == "ask":
                questions.append({"id": f"unclassified:{system}:{line['key']}", "kind": "unclassified", "blocking": False,
                                  "message": f"[{code_list['name']}] no code for '{line['description']}'.",
                                  "answer": {"kind": "code", "system": system}})
        if code and code not in codes:
            warnings.append({"code": "unknown_code", "message": f"[{system}] line '{line['description']}' got code '{code}', not in the code list"})
            code = None
        if code:
            path, cur, guard = [], codes[code], 0
            while cur and guard < 20:
                path.insert(0, {"code": cur["code"], "title": cur["title"]})
                cur = codes.get(cur.get("parent"))
                guard += 1
            lc = {"system": system, "code": code, "title": codes[code]["title"], "path": path, "source": src}
            if rule_id:
                lc["mapRuleId"] = rule_id
            line.setdefault("codes", {})[system] = lc
            by_key[line["key"]] = lc
            log.detail("classify", f"[{system}] '{line['description']}' -> {code} {codes[code]['title']} ({why})",
                       ruleId=line["ruleId"], lineKey=line["key"])
        else:
            line.setdefault("codes", {})
            log.detail("classify", f"[{system}] '{line['description']}' -> no code", ruleId=line["ruleId"], lineKey=line["key"])
    n = sum(1 for l in lines if system in l.get("codes", {}))
    log.info("classify", f"[{code_list['name']}] {n} of {len(lines)} lines coded")
