"""
import_codelist.py - turn a published code list (CSV) into a CodeList JSON.

Works with any CSV that has a code column and a title column. Parents and
levels are derived from the code separator when the CSV has no parent column.
A Uniclass preset reads the table files NBS publishes (also mirrored as CSV at
github.com/buildig/uniclass-2015).

Usage:
    python import_codelist.py table.csv out.json --preset uniclass --id uniclass2015-ef \
        --name "Uniclass 2015 - Elements/functions" --version "v1.10 (2021-07)"
    python import_codelist.py codes.csv out.json --code-col Code --title-col Title --separator . \
        --id acme-cost-codes --name "ACME cost codes" --kind company
"""
from __future__ import annotations

import argparse
import csv
import json
import sys

PRESETS = {
    "uniclass": {
        "code_col": "Code", "title_col": "Title", "separator": "_", "kind": "official",
        "publisher": "NBS", "levels": ["Table", "Group", "Sub group", "Section", "Object"],
        "extra_cols": ["NRM", "NBS Code"],
        "licence": {"name": "Uniclass 2015 terms (NBS)", "url": "https://uniclass.thenbs.com/",
                    "attribution": "Uniclass 2015 © NBS", "redistributable": False},
    },
}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv")
    ap.add_argument("out")
    ap.add_argument("--preset", choices=PRESETS)
    ap.add_argument("--id", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--version")
    ap.add_argument("--kind", choices=["official", "company", "client", "other"])
    ap.add_argument("--code-col")
    ap.add_argument("--title-col")
    ap.add_argument("--parent-col")
    ap.add_argument("--separator")
    ap.add_argument("--locale", default="en")
    a = ap.parse_args(argv)
    p = dict(PRESETS.get(a.preset, {}))
    for k in ("code_col", "title_col", "separator", "kind"):
        if getattr(a, k):
            p[k] = getattr(a, k)
    p.setdefault("kind", "other")
    if "code_col" not in p or "title_col" not in p:
        ap.error("--code-col and --title-col are required without a preset")

    with open(a.csv, newline="", encoding="utf-8-sig") as fh:
        rows = list(csv.DictReader(fh))
    codes, seen = [], set()
    for r in rows:
        code = (r.get(p["code_col"]) or "").strip()
        title = (r.get(p["title_col"]) or "").strip()
        if not code or code in seen:
            continue
        seen.add(code)
        c = {"code": code, "title": title}
        if a.parent_col and r.get(a.parent_col):
            c["parent"] = r[a.parent_col].strip()
        extra = {k: r[k].strip() for k in p.get("extra_cols", []) if r.get(k) and r[k].strip()}
        if extra:
            c["extra"] = extra
        codes.append(c)

    sep = p.get("separator")
    if sep:
        for c in codes:
            if "parent" in c:
                continue
            parts = c["code"].split(sep)
            while len(parts) > 1:
                parts = parts[:-1]
                cand = sep.join(parts)
                if cand in seen:
                    c["parent"] = cand
                    break
    by = {c["code"]: c for c in codes}
    for c in codes:
        lvl, cur = 0, c
        while cur.get("parent") in by:
            lvl += 1
            cur = by[cur["parent"]]
        c["level"] = lvl

    doc = {"schemaVersion": "1.0", "id": a.id, "name": a.name, "kind": p["kind"], "locale": a.locale, "codes": codes}
    for k in ("publisher", "levels", "licence"):
        if k in p:
            doc[k] = p[k]
    if a.version:
        doc["version"] = a.version
    if sep:
        doc["separator"] = sep
    json.dump(doc, open(a.out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"{len(codes)} codes -> {a.out}")


if __name__ == "__main__":
    sys.exit(main())
