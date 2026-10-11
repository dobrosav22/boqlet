"""
pipeline.py - getBoq: ParsedModel + rules + classifications + dictionaries (+ decisions) -> BoqResult.

    result = get_boq(parsed, rules, classifications=[(code_list, map)], dictionaries=[...],
                     resolution=settings, decisions=[...])

`rules` may be a flattened RuleSet or a RuleSetPatch together with `rule_library`
(all rule sets by id) so the chain can be flattened here.

Order of work (each step writes to the calculation log):
  1. parse summary              (the ParsedModel is produced by parse.py and cached)
  2. names + measure            dictionaries -> terms; adopt quantities per element
  3. rules                      items -> lines, then derived lines, then manual lines
  4. coverage                   unmatched / excluded / covered-by-parent elements
  5. classification             codes per line per system
  6. questions                  blocking ones make status "needs_input"
"""
from __future__ import annotations

import time
from collections import defaultdict

from .classify import classify
from .expr import Expr, fmt
from .log import CalcLog
from .measure import build as measure
from .names import Resolver, decision_entries
from .rules import RuleEngine, flatten, integrity, referenced_fields, unmatched_id

INTERNAL = ("_fields", "_mixed", "_parts", "_source_key", "_manual_kind")


def _worth_asking(r: dict, settings: dict, x: Expr) -> bool:
    rules = settings.get("askFor")
    if not rules:
        return True
    return any(a["field"] == r["field"] and (not a.get("when") or x.evaluate(a["when"], r.get("ctx", {}))) for a in rules)


def get_boq(parsed: dict, rules: dict, classifications: list[tuple[dict, dict]], dictionaries: list[dict],
            resolution: dict | None = None, decisions: list[dict] | None = None,
            rule_library: dict[str, dict] | None = None) -> dict:
    t0 = time.time()
    log = CalcLog()
    resolution = resolution or {}
    decisions = decisions or []
    answers = {d["questionId"]: d.get("answer") for d in decisions}

    # 1. parse summary ------------------------------------------------------------------
    h, st = parsed["header"], parsed["stats"]
    log.info("parse", f"{h['source']['fileName']}: {h['ifcSchema']}, {h.get('authoringApp', {}).get('fullName', 'unknown tool')}, "
                      f"{st['elementCount']} elements, {st['openingCount']} openings, {st['spaceCount']} spaces "
                      f"(discipline guess: {h.get('disciplineGuess')})")
    if parsed["verification"]["summary"]:
        log.info("parse", "verification: " + ", ".join(f"{k} x{v}" for k, v in parsed["verification"]["summary"].items()))

    # 2. names + measure ----------------------------------------------------------------
    flat = rules if "extends" not in rules else flatten(rules, rule_library or {})
    if "chain" not in flat:
        flat = flatten(flat, {})
    dec_entries = decision_entries(decisions)
    rv = Resolver(dictionaries, resolution, dec_entries)
    log.info("names", "dictionaries: " + ", ".join(f"{d['id']} ({d['layer']})" for d in dictionaries)
             + (f"; {len(dec_entries)} name answer(s) from decisions" if dec_entries else ""))
    elements, resolutions = measure(parsed, rv, log)
    distinct = {}
    for r in resolutions:
        distinct.setdefault((r["field"], r["raw"]), {**r, "count": 0})["count"] += 1
    for (field, raw), r in sorted(distinct.items(), key=lambda kv: (kv[0][0], kv[0][1] or "")):
        if r["term"]:
            log.detail("names", f"{field} '{raw}' -> {r['term']} ({r['method']} match, {r['layer']} layer, "
                                f"dictionary {r.get('dictionary')}, entry {r.get('entryId')}) x{r['count']}")
        else:
            log.detail("names", f"{field} '{raw}' -> UNRESOLVED x{r['count']}")
    n_ok = sum(1 for r in distinct.values() if r["term"])
    log.info("names", f"{n_ok} of {len(distinct)} distinct names resolved")

    # 3. rules ----------------------------------------------------------------------------
    log.info("match", f"rule set '{flat['name']}' ({' -> '.join(flat['chain'])}), "
                      f"{len(flat['items'])} item rules, {len(flat.get('derived', []))} derived, {len(flat.get('manual', []))} manual")
    warnings: list[dict] = [{"code": "rule_set", "message": p} for p in integrity(flat)]
    for w in warnings:
        log.warn("match", w["message"])
    eng = RuleEngine(flat, elements, rv.expr, log, answers)
    eng.run_items()
    eng.finalize_lines()
    item_lines = list(eng.lines.values())
    derived_lines = eng.run_derived()
    manual_lines = eng.run_manual()
    lines = item_lines + derived_lines + manual_lines
    warnings += eng.warnings
    questions: list[dict] = list(eng.questions)

    # 4. coverage -------------------------------------------------------------------------
    covered = {e["guid"] for e in elements if e.get("parent_guid") in eng.matched}
    groups = defaultdict(list)
    for e in elements:
        g = e["guid"]
        if g in eng.matched or g in eng.excluded or g in covered:
            continue
        groups[unmatched_id(e)].append(e)
    for qid, els in sorted(groups.items()):
        e0 = els[0]
        questions.append({"id": qid, "kind": "unmatched", "blocking": False, "guids": [e["guid"] for e in els],
                          "occurrences": len(els),
                          "message": f"{len(els)} x {e0['ifc_class']} '{e0.get('type_name') or e0.get('name')}' not measured by any rule. "
                                     f"Assign a rule or exclude.",
                          "answer": {"kind": "rule"}})
    unmatched_n = sum(len(v) for v in groups.values())
    log.info("match", f"coverage: {len(eng.matched)} measured, {len(covered - eng.matched)} covered by their parent, "
                      f"{len(eng.excluded)} excluded, {unmatched_n} unmatched")

    # names that matter -> questions
    refs = referenced_fields(flat, [m for _, m in classifications])
    field_needed = {"material": "material" in refs, "layer_material": "material" in refs or "layers" in refs,
                    "type_name": "element_type" in refs, "space_name": "space_type" in refs}
    for (field, raw), r in sorted(distinct.items(), key=lambda kv: (kv[0][0], kv[0][1] or "")):
        if r["term"] or not raw or not _worth_asking(r, resolution, rv.expr):
            continue
        blocking = resolution.get("unresolved", "ask") == "ask" and field_needed.get(field, False)
        questions.append({"id": f"name:{field}:{raw}", "kind": "unknown_name", "blocking": blocking,
                          "field": field, "raw": raw, "occurrences": r["count"],
                          "message": f"What is '{raw}' ({field.replace('_', ' ')})? Used {r['count']} time(s)."
                                     + ("" if blocking else " Not used by the current rules."),
                          "answer": {"kind": "term", "category": "element_type" if field == "type_name" else
                                     ("space" if field == "space_name" else "material")}})

    # 5. classification -----------------------------------------------------------------
    for code_list, cmap in classifications:
        classify(lines, code_list, cmap, rv.expr, log, answers, questions, warnings)

    # 6. questions & decisions ----------------------------------------------------------
    applied = [q for q in questions if q["id"] in answers]
    for d in decisions:
        log.info("decision", f"answer applied: {d['questionId']} = {d.get('answer')!r}")
    questions = [q for q in questions if q["id"] not in answers]
    for q in questions:
        log.add("summary", f"question ({'blocking' if q['blocking'] else 'info'}): {q['message']}",
                "warning" if q["blocking"] else "info")

    # assemble ---------------------------------------------------------------------------
    primary = classifications[0][0]["id"] if classifications else None
    order = {i["id"]: n for n, i in enumerate(flat["items"] + flat.get("derived", []) + flat.get("manual", []))}

    def sort_key(l):
        path = [p["code"] for p in l.get("codes", {}).get(primary, {}).get("path", [])] if primary else []
        return (0 if path else 1, path, order.get(l["ruleId"], 999), l["description"])

    out_lines = []
    for l in sorted(lines, key=sort_key):
        bl = {k: v for k, v in l.items() if k not in INTERNAL}
        bl.setdefault("codes", {})
        if bl.get("quantity") is not None:
            bl["quantity"] = round(bl["quantity"], 6)
        out_lines.append(bl)
    blocking = [q for q in questions if q["blocking"]]
    status = "needs_input" if blocking else "complete"
    flagged = sum(1 for l in out_lines if l["quantity"] is None)
    log.info("summary", f"{len(out_lines)} lines ({flagged} flagged), {len(questions)} open question(s) "
                        f"({len(blocking)} blocking) -> {status}")
    ruleset_snapshot = {k: v for k, v in flat.items() if k != "chain"}
    ruleset_snapshot["meta"] = {**ruleset_snapshot.get("meta", {}), "chain": " -> ".join(flat["chain"])}
    return {
        "status": status,
        "log": log.entries,
        "ruleSet": ruleset_snapshot,
        "lines": out_lines,
        "questions": questions,
        "warnings": warnings,
        "checks": parsed["verification"]["checks"],
        "stats": {
            "elements": len(elements), "measuredElements": len(eng.matched), "excludedElements": len(eng.excluded),
            "unmatchedElements": unmatched_n, "lines": len(out_lines), "flaggedLines": flagged,
            "decisionsApplied": len(applied), "durationMs": int((time.time() - t0) * 1000),
        },
    }
