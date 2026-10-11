"""
cli.py - run the engine without the web app.

    npm run boq -- fixtures/ifc/Ifc2x3_Duplex_Architecture.ifc --out boq.xlsx
    python -m ifc_boq.cli model.ifc --rules demo-custom --class demo-trades --json result.json
    python -m ifc_boq.cli model.ifc --rules my-rules.json --dict global-seed my-dict.json \
        --class "my-codes.json,my-map.json" --decisions answers.json --out boq.xlsx

Presets are referenced by id (folder /presets) or by path. Exit code 2 when the result
needs input (blocking questions), so scripts can tell.
"""
from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

from . import presets
from .export_xlsx import export
from .parse import parse_file
from .pipeline import get_boq


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ifc", help="IFC file, or a parsed.json produced earlier (faster)")
    ap.add_argument("--rules", default=presets.DEFAULTS["ruleSet"], help="rule set id or path")
    ap.add_argument("--dict", nargs="+", default=presets.DEFAULTS["dictionaries"], help="dictionary ids or paths")
    ap.add_argument("--class", dest="classes", nargs="*", default=presets.DEFAULTS["classifications"],
                    help="classification ids, or 'codelist.json,map.json'")
    ap.add_argument("--decisions", help="JSON file: list of Decision")
    ap.add_argument("--out", help="write Excel here")
    ap.add_argument("--json", help="write BoqResult JSON here")
    ap.add_argument("--save-parsed", help="also write the ParsedModel JSON here (reuse it as input next time)")
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args(argv)

    src = Path(a.ifc)
    if src.suffix.lower() == ".json":
        parsed = json.loads(src.read_text(encoding="utf-8"))
    else:
        parsed, _ = parse_file(str(src))
        if a.save_parsed:
            Path(a.save_parsed).write_text(json.dumps(parsed), encoding="utf-8")
    rule_set, lib = presets.load_rule_set(a.rules)
    dicts = [presets.load_dictionary(d) for d in a.dict]
    systems = [presets.load_classification(c) for c in a.classes]
    decisions = json.loads(Path(a.decisions).read_text(encoding="utf-8")) if a.decisions else []
    result = get_boq(parsed, rule_set, systems, dicts, presets.resolution(), decisions, lib)

    if not a.quiet:
        primary = systems[0][0]["id"] if systems else None
        for l in result["lines"]:
            code = (l["codes"].get(primary) or {}).get("code", "") if primary else ""
            q = "FLAGGED" if l["quantity"] is None else f"{l['quantity']:,.3f}"
            print(f"{code:8s} {l['description'][:70]:70s} {q:>14s} {l['unit']}")
        for q in result["questions"]:
            print(f"[{'BLOCKING' if q['blocking'] else 'question'}] {q['id']}: {q['message']}")
        s = result["stats"]
        print(f"\n{result['status']}: {s['lines']} lines, {s['flaggedLines']} flagged, {s['measuredElements']} of "
              f"{s['elements']} elements measured, {s['unmatchedElements']} unmatched, {s['durationMs']} ms")
    if a.json:
        Path(a.json).write_text(json.dumps(result, indent=1), encoding="utf-8")
    if a.out:
        meta = {"modelName": parsed["header"]["source"]["fileName"], "modelId": parsed["header"]["source"]["sha256"],
                "dictionaries": [f"{d['name']} ({d['layer']})" for d in dicts],
                "classifications": [{"id": cl["id"], "name": cl["name"]} for cl, _ in systems], "decisions": decisions}
        Path(a.out).write_bytes(export(result, meta))
        if not a.quiet:
            print(f"Excel: {a.out}")
    return 2 if result["status"] == "needs_input" else 0


if __name__ == "__main__":
    sys.exit(main())
