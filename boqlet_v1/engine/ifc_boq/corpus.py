"""
corpus.py - run every IFC in a folder through the engine and summarise what it found.

    npm run corpus -- path/to/folder [--rules as-modelled] [--out corpus-out] [--no-overlaps]
    python -m ifc_boq.corpus path/to/folder --out corpus-out

For each file: parse, run the presets, validate the ParsedModel and the BoqResult against
the contract schemas, and print one row (schema, tool, discipline, measured / unmatched /
excluded elements, flagged lines, blocking questions, parse checks). With --out, also writes
per-file parsed.json, result.json and a summary.json, so runs can be compared after an engine
change. Used to read new exporters before adding fixtures (docs/09).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import traceback
import zipfile
from pathlib import Path

import ifcopenshell.ifcopenshell_wrapper as ifc_schema
import jsonschema

from . import service
from .parse import parse_file
from .paths import SCHEMAS


def schema_errors(doc: dict, name: str) -> list[str]:
    schema = json.loads((SCHEMAS / name).read_text(encoding="utf-8"))
    v = jsonschema.validators.validator_for(schema)(schema)
    return [f"{'/'.join(map(str, e.absolute_path))}: {e.message[:200]}" for e in v.iter_errors(doc)][:5]


def header_schema(path: Path) -> str | None:
    """FILE_SCHEMA from the STEP header, read without parsing the model (.ifczip: its first .ifc)."""
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as z:
            name = next((n for n in z.namelist() if n.lower().endswith(".ifc")), None)
            head = z.open(name).read(65536).decode("latin-1", "replace") if name else ""
    else:
        with open(path, "rb") as fh:
            head = fh.read(65536).decode("latin-1", "replace")
    m = re.search(r"FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'", head)
    return m.group(1).upper() if m else None


def supported(schema: str | None) -> bool:
    try:
        ifc_schema.schema_by_name(schema or "")
        return True
    except Exception:
        return False


def run_one(path: Path, request: dict, overlaps: bool) -> tuple[dict, dict | None, dict | None]:
    rec: dict = {"file": str(path)}
    t0 = time.time()
    schema = header_schema(path)
    if not supported(schema):
        rec["error"] = f"unsupported schema {schema or '(none in header)'}: the engine reads IFC2X3, IFC4 and IFC4X3"
        rec["schema"] = schema
        return rec, None, None
    try:
        parsed, _ = parse_file(str(path), overlaps=overlaps)
        parsed = json.loads(json.dumps(parsed))
        result, _ = service.run(parsed, request)
        result = json.loads(json.dumps(result))
    except Exception:
        rec["error"] = traceback.format_exc()[-2000:]
        return rec, None, None
    h, st = parsed["header"], result["stats"]
    rec.update({
        "seconds": round(time.time() - t0, 1),
        "schema": h["ifcSchema"], "tool": h.get("originatingSystem") or (h.get("authoringApp") or {}).get("fullName"),
        "discipline": h.get("disciplineGuess"), "status": result["status"], "stats": st,
        "blocking": sum(q["blocking"] for q in result["questions"]),
        "checks": parsed["verification"]["summary"],
        "schemaErrors": schema_errors(parsed, "parsed-model.schema.json") + schema_errors(result, "boq-result.schema.json"),
    })
    return rec, parsed, result


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder", help="folder searched recursively for .ifc and .ifczip files")
    ap.add_argument("--rules", default=None, help="rule set id or path (default: as-modelled)")
    ap.add_argument("--out", help="write per-file parsed.json, result.json and summary.json here")
    ap.add_argument("--no-overlaps", action="store_true", help="skip pairwise solid-overlap checks (faster)")
    a = ap.parse_args(argv)
    files = sorted(p for p in Path(a.folder).rglob("*") if p.suffix.lower() in (".ifc", ".ifczip"))
    if not files:
        print(f"no .ifc files under {a.folder}")
        return 1
    out = Path(a.out) if a.out else None
    if out:
        out.mkdir(parents=True, exist_ok=True)
    request = {"ruleSet": a.rules} if a.rules else {}
    rows, failed, skipped = [], 0, 0
    print(f"{'file':52s} {'schema':8s} {'status':11s} {'meas':>5s} {'unm':>4s} {'excl':>4s} {'flag':>4s} {'block':>5s}  checks")
    for f in files:
        rec, parsed, result = run_one(f, request, not a.no_overlaps)
        name = str(f.relative_to(a.folder))
        rows.append(rec)
        if rec.get("error", "").startswith("unsupported schema"):
            skipped += 1
            print(f"{name[-52:]:52s} SKIPPED: {rec['error']}")
            continue
        if "error" in rec:
            failed += 1
            print(f"{name[-52:]:52s} ERROR\n{rec['error']}")
            continue
        st = rec["stats"]
        checks = ", ".join(f"{k} {v}" for k, v in sorted(rec["checks"].items()))
        print(f"{name[-52:]:52s} {rec['schema']:8s} {rec['status']:11s} {st['measuredElements']:>5} {st['unmatchedElements']:>4} "
              f"{st['excludedElements']:>4} {st['flaggedLines']:>4} {rec['blocking']:>5}  {checks}")
        for e in rec["schemaErrors"]:
            failed += 1
            print(f"    SCHEMA: {e}")
        if out:
            stem = name.replace("\\", "__").replace("/", "__").removesuffix(".ifc")
            (out / f"{stem}.parsed.json").write_text(json.dumps(parsed), encoding="utf-8")
            (out / f"{stem}.result.json").write_text(json.dumps(result, indent=1), encoding="utf-8")
    if out:
        (out / "summary.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
    print(f"\n{len(files)} file(s), {failed} failure(s), {skipped} skipped (unsupported schema)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
