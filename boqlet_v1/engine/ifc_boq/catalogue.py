"""
catalogue.py - render the IFC corpus catalogue (fixtures/corpus/catalogue.json) as Markdown.

    npm run catalogue            # writes docs/12-ifc-corpus-catalogue.md
    python -m ifc_boq.catalogue [catalogue.json] [out.md]

The catalogue lists every public IFC file looked at so far, tagged from its STEP header
(schema, view definition, exporting tool and version, export date) and, where it was run, with
what the engine made of it. Add entries to the JSON (see docs/12 for the fields) and re-render.
"""
from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

from .paths import FIXTURES, ROOT

STATUSES = ["tested: complete", "tested: needs input", "engine error", "engine timeout", "invalid",
            "unsupported schema", "header only", "unavailable"]
TESTED = ("tested: complete", "tested: needs input")
SCHEMA_ORDER = ["IFC20_LONGFORM", "IFC2X_FINAL", "IFC2X2_FINAL", "IFC2X3", "IFC4", "IFC4X3", "IFC4X3_ADD2"]


def cell(text) -> str:
    return str(text if text not in (None, "") else "").replace("|", "/").replace("\n", " ")


def schema_label(s: str | None) -> str:
    return {"IFC20_LONGFORM": "IFC2.0", "IFC2X_FINAL": "IFC2x", "IFC2X2_FINAL": "IFC2x2", "IFC2X3": "IFC2x3",
            "IFC4": "IFC4", "IFC4X3": "IFC4.3", "IFC4X3_ADD2": "IFC4.3"}.get(s or "", s or "?")


def render(cat: dict) -> str:
    E = cat["entries"]
    out = [
        "# 12 IFC corpus catalogue",
        "",
        "Every public IFC file looked at so far, grouped by source and project, tagged from its STEP",
        "header and, where it was run, with what the engine made of it. Generated from",
        "`fixtures/corpus/catalogue.json` by `npm run catalogue`; edit the JSON, not this page.",
        f"Last update: {cat.get('generated')}. How the corpus is used: `09-validation-and-test-corpus.md`.",
        "",
        "**Tags.** `schema` from FILE_SCHEMA; `view` from the ViewDefinition in FILE_DESCRIPTION; `tool` and",
        "`version` from IFCAPPLICATION, else FILE_NAME (file names are not trusted: the Lakeside file named",
        "RVT is a Vectorworks export and the one named VW is Revit); `exported` from the FILE_NAME time stamp;",
        "`discipline` from the file name, else the engine's guess.",
        "",
        "**Status.**",
        "",
        "| Status | Meaning |",
        "|---|---|",
        "| tested: complete | Parsed and run (as-modelled, global-seed, acme-cost-codes; no overlap check); both outputs valid against the contract schemas; no blocking question |",
        "| tested: needs input | Same, but a blocking question is open (usually an unknown material name). The engine worked; the dictionary did not know a name |",
        "| engine error / engine timeout | The engine failed or took over 15 minutes. A bug to look at |",
        "| invalid | Not readable: STEP syntax errors, or not a STEP file (Git LFS pointer, HTML) |",
        "| unsupported schema | IFC2x2 and older; ifcopenshell (and so the engine) reads IFC2x3, IFC4 and IFC4.3 only |",
        "| header only | Tagged from its header, not run (over the size cap, or not downloaded) |",
        "| unavailable | Listed somewhere but the link is dead |",
        "",
        "Tested means *the engine runs on it and the output is well formed*, not that the quantities were",
        "checked. Quantities are checked only for the Duplex and the buildingSMART samples (`09`).",
        "",
        "## Summary",
        "",
        "| Source | Files | " + " | ".join(STATUSES) + " |",
        "|---|---:|" + "---:|" * len(STATUSES),
    ]
    by_src = defaultdict(list)
    for e in E:
        by_src[e["source"]].append(e)
    for src, es in by_src.items():
        c = Counter(e["status"] for e in es)
        out.append(f"| {src} | {len(es)} | " + " | ".join(str(c.get(s, "")) for s in STATUSES) + " |")
    c = Counter(e["status"] for e in E)
    out.append(f"| **All** | **{len(E)}** | " + " | ".join(f"**{c[s]}**" if c.get(s) else "" for s in STATUSES) + " |")

    # tool x schema
    out += ["", "## Coverage by tool and schema", "",
            "Each cell is *tested / readable*: files the engine ran on, out of files with a header it can read",
            "(IFC2x3 or newer). Older-schema files are counted in the last column. Sorted by files tested.", ""]
    schemas = [s for s in SCHEMA_ORDER if any(e.get("schema") == s for e in E) and s in ("IFC2X3", "IFC4", "IFC4X3", "IFC4X3_ADD2")]
    merged = []
    for s in schemas:
        lab = schema_label(s)
        if lab not in merged:
            merged.append(lab)
    grid = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    old = Counter()
    for e in E:
        if not e.get("tool"):
            continue
        if e["status"] == "unsupported schema":
            old[e["tool"]] += 1
            continue
        if e["status"] in ("unavailable",) or e.get("schema") not in ("IFC2X3", "IFC4", "IFC4X3", "IFC4X3_ADD2"):
            continue
        g = grid[e["tool"]][schema_label(e["schema"])]
        g[1] += 1
        g[0] += e["status"] in TESTED
    tools = sorted(set(grid) | set(old), key=lambda t: (-sum(v[0] for v in grid[t].values()), t.lower()))
    out.append("| Tool | Versions seen | " + " | ".join(merged) + " | Pre-IFC2x3 (unsupported) |")
    out.append("|---|---|" + "---:|" * len(merged) + "---:|")
    for t in tools:
        vers = sorted({e.get("toolVersion") for e in E if e.get("tool") == t and e.get("toolVersion")})
        vtxt = ", ".join(vers[:8]) + (f" (+{len(vers) - 8})" if len(vers) > 8 else "")
        cells = [f"{grid[t][m][0]} / {grid[t][m][1]}" if grid[t][m][1] else "" for m in merged]
        out.append(f"| {cell(t)} | {cell(vtxt)} | " + " | ".join(cells) + f" | {old.get(t, '') or ''} |")

    # discipline x schema (tested only)
    out += ["", "## Tested files by discipline and schema", ""]
    dg = defaultdict(Counter)
    for e in E:
        if e["status"] in TESTED:
            dg[e.get("discipline") or "unknown"][schema_label(e.get("schema"))] += 1
    out.append("| Discipline | " + " | ".join(merged) + " | Total |")
    out.append("|---|" + "---:|" * (len(merged) + 1))
    for d in sorted(dg, key=lambda d: -sum(dg[d].values())):
        out.append(f"| {d} | " + " | ".join(str(dg[d].get(m, "")) for m in merged) + f" | {sum(dg[d].values())} |")

    if cat.get("uncovered"):
        out += ["", "## Still uncovered", ""] + [f"- {u}" for u in cat["uncovered"]]
    if cat.get("findings"):
        out += ["", "## What these files exposed", ""] + [f"- {u}" for u in cat["findings"]]

    # per source / project
    out += ["", "## Files", ""]
    for src, es in by_src.items():
        meta = (cat.get("sources") or {}).get(src, {})
        out += [f"### {src}", ""]
        if meta:
            out += [f"{meta.get('about', '')} Licence: {meta.get('licence', 'unknown')}. "
                    f"Link: {meta.get('url', '')}", ""]
        projects = defaultdict(list)
        for e in es:
            projects[e["project"]].append(e)
        for proj, pes in projects.items():
            tested = sum(e["status"] in TESTED for e in pes)
            out += [f"**{cell(proj)}** ({len(pes)} file{'s' if len(pes) > 1 else ''}, {tested} tested)", "",
                    "| File | Schema | View | Tool | Version | Exported | Discipline | MB | Status | Engine | Notes |",
                    "|---|---|---|---|---|---|---|---:|---|---|---|"]
            for e in pes:
                eng = e.get("engine") or {}
                etxt = (f"{eng.get('measured')}/{eng.get('elements')} measured, {eng.get('unmatched')} unmatched"
                        if eng else "")
                notes = list(e.get("notes", []))
                if e.get("statusDetail") and e["status"] not in TESTED:
                    notes.insert(0, e["statusDetail"])
                if e.get("inRepoFixtures"):
                    notes.insert(0, "in fixtures/")
                fname = f"[{cell(e['file'])}]({e['url'].replace(' ', '%20')})" if e.get("url") else cell(e["file"])
                out.append(f"| {fname} | {schema_label(e.get('schema')) if e.get('schema') else ''} | {cell(e.get('view'))} | "
                           f"{cell(e.get('tool'))} | {cell(e.get('toolVersion'))} | {cell(e.get('exported'))} | "
                           f"{cell(e.get('discipline'))} | {e.get('sizeMB') if e.get('sizeMB') is not None else ''} | "
                           f"{e['status']} | {etxt} | {cell('; '.join(notes))[:300]} |")
            out.append("")
    return "\n".join(out).rstrip() + "\n"


def main(argv=None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    src = Path(argv[0]) if argv else FIXTURES / "corpus" / "catalogue.json"
    dst = Path(argv[1]) if len(argv) > 1 else ROOT / "docs" / "12-ifc-corpus-catalogue.md"
    dst.write_text(render(json.loads(src.read_text(encoding="utf-8"))), encoding="utf-8")
    print(f"wrote {dst}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
