"""
cli.py - run the engine without the web app.

    npm run boq -- fixtures/ifc/Ifc2x3_Duplex_Architecture.ifc --out boq.xlsx
    npm run boq -- arch.ifc str.ifc mep.ifc --disciplines architecture structure mep --out boq.xlsx
    python -m ifc_boq.cli model.ifc --rules demo-custom --class demo-trades --json result.json
    python -m ifc_boq.cli model.ifc --rules my-rules.json --dict global-seed my-dict.json \
        --class "my-codes.json,my-map.json" --decisions answers.json --out boq.xlsx

Presets are referenced by id (folder /presets) or by path. Several IFC files are combined into
one BoQ (federation); --disciplines tags them in order (default: each file's discipline guess).
Exit code 2 when the result needs input (blocking questions), so scripts can tell.
"""
from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

from . import presets
from .export_xlsx import export
from .geometry import load_meshes, save_meshes
from .parse import parse_file
from .pipeline import get_boq


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ifc", nargs="+", help="IFC file(s), or parsed.json produced earlier (faster)")
    ap.add_argument("--disciplines", nargs="*", default=[], help="discipline per file, in order (architecture, structure, mep...)")
    ap.add_argument("--rules", default=presets.DEFAULTS["ruleSet"], help="rule set id or path")
    ap.add_argument("--dict", nargs="+", default=presets.DEFAULTS["dictionaries"], help="dictionary ids or paths")
    ap.add_argument("--class", dest="classes", nargs="*", default=presets.DEFAULTS["classifications"],
                    help="classification ids, or 'codelist.json,map.json'")
    ap.add_argument("--decisions", help="JSON file: list of Decision")
    ap.add_argument("--out", help="write Excel here")
    ap.add_argument("--json", help="write BoqResult JSON here")
    ap.add_argument("--save-parsed", help="also write the ParsedModel JSON here (reuse it as input next time; "
                                          "meshes.npz is written beside it)")
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args(argv)

    models = []
    for n, f in enumerate(a.ifc):
        src = Path(f)
        meshes = None
        if src.suffix.lower() == ".json":
            parsed = json.loads(src.read_text(encoding="utf-8"))
            side = src.with_name("meshes.npz")
            meshes = load_meshes(side) if side.exists() else None
        else:
            parsed, parser = parse_file(str(src))
            meshes = parser.meshes
            if a.save_parsed and len(a.ifc) == 1:
                Path(a.save_parsed).write_text(json.dumps(parsed), encoding="utf-8")
                save_meshes(meshes, Path(a.save_parsed).with_name("meshes.npz"))
        models.append({"id": src.stem, "parsed": parsed, "meshes": meshes,
                       **({"discipline": a.disciplines[n]} if n < len(a.disciplines) else {})})
    if len(models) == 1 and not a.disciplines:
        models[0].pop("id")                      # one model: its id is the file hash, as in the dev server
    parsed = models
    rule_set, lib = presets.load_rule_set(a.rules)
    dicts = [presets.load_dictionary(d) for d in a.dict]
    systems = [presets.load_classification(c) for c in a.classes]
    decisions = json.loads(Path(a.decisions).read_text(encoding="utf-8")) if a.decisions else []
    result = get_boq(parsed, rule_set, systems, dicts, presets.resolution(), decisions, lib,
                     federation=presets.federation())

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
        meta = {"modelName": " + ".join(m["parsed"]["header"]["source"]["fileName"] for m in models),
                "modelId": ", ".join(m["parsed"]["header"]["source"]["sha256"] for m in models),
                "dictionaries": [f"{d['name']} ({d['layer']})" for d in dicts],
                "classifications": [{"id": cl["id"], "name": cl["name"]} for cl, _ in systems], "decisions": decisions}
        Path(a.out).write_bytes(export(result, meta))
        if not a.quiet:
            print(f"Excel: {a.out}")
    return 2 if result["status"] == "needs_input" else 0


if __name__ == "__main__":
    sys.exit(main())
