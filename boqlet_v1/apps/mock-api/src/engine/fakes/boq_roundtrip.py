"""Fake "BoQ round-trip" (mock-api.md "BoQ export meta, edits import", replaced by EN-006).

annotate <in.xlsx> <info.json> <out.xlsx>
    After the PoC exporter wrote the BoQ: a hidden "Line key" column on the BoQ sheet (the exporter's own
    row order: groups by the grouping system's top code, sorted, lines in order), and a very hidden sheet
    "_boqlet" with what was exported per line (key, ref, description, unit, quantity) and the BoQ's id.

read <in.xlsx> <info.json>
    Compares an edited BoQ sheet with that snapshot and prints an EditsImportReport (F12 "Editing in Excel
    and importing back"): quantity, description and unit edits, rows moved to another section (another
    heading or another Ref), rows deleted (proposed exclusions), new rows without a key (proposed manual
    lines under their heading), and what it couldn't read. Rate and Amount are ignored. Nothing is measured.
"""
import json
import sys
from io import BytesIO

from openpyxl import load_workbook

KEY_COL = 9  # I, after Ref, Description, Unit, Quantity, Rate, Amount, Source, Notes
FIRST = 6
COLS = {"ref": "A", "description": "B", "unit": "C", "quantity": "D"}


def order(lines, primary):
    groups = {}
    for l in lines:
        c = (l.get("codes") or {}).get(primary) if primary else None
        top = (c["path"][0]["code"], c["path"][0]["title"]) if c else ("~", "Unclassified")
        groups.setdefault(top, []).append(l)
    return sorted(groups.items(), key=lambda kv: kv[0][0])


def annotate(src, info_path, out):
    info = json.load(open(info_path, encoding="utf8"))
    lines, primary = info["lines"], info.get("primary")
    wb = load_workbook(src)
    ws = wb["BoQ"]
    ws.cell(row=FIRST - 1, column=KEY_COL, value="Line key")
    snap = wb.create_sheet("_boqlet")
    snap.append(["boqId", info.get("boqId", ""), "primary", primary or ""])
    snap.append(["key", "ref", "description", "unit", "quantity", "top"])
    r = FIRST
    for (code, _title), ls in order(lines, primary):
        r += 1  # the section row
        for l in ls:
            ws.cell(row=r, column=KEY_COL, value=l["key"])
            snap.append([l["key"], ws.cell(row=r, column=1).value or "", ws.cell(row=r, column=2).value or "", ws.cell(row=r, column=3).value or "", ws.cell(row=r, column=4).value, "" if code == "~" else code])
            r += 1
        r += 2  # subtotal and the blank row
    ws.column_dimensions["I"].hidden = True
    snap.sheet_state = "veryHidden"
    wb.save(out)


def number(v):
    if v is None or v == "":
        return None, True
    if isinstance(v, (int, float)):
        return float(v), True
    try:
        return float(str(v).replace(" ", "").replace(" ", "").replace(",", ".")), True
    except ValueError:
        return None, False


def read(src, info_path):
    info = json.load(open(info_path, encoding="utf8"))
    report = {"overrides": [], "manualItems": [], "problems": []}
    try:
        wb = load_workbook(src, data_only=True)
    except Exception:
        report["problems"].append({"row": 0, "message": "This file is not an Excel workbook."})
        return report
    if "BoQ" not in wb.sheetnames or "_boqlet" not in wb.sheetnames:
        report["problems"].append({"row": 0, "message": "This workbook wasn't exported from boqlet (its BoQ sheet or line keys are missing)."})
        return report
    snap = wb["_boqlet"]
    head = [c.value for c in snap[1]]
    if str(head[1] or "") != info["boqId"]:
        report["problems"].append({"sheet": "BoQ", "row": 0, "message": "This workbook was exported from another BoQ: nothing is applied."})
        return report
    primary = info.get("primary") or (head[3] or None)
    exported = {}
    for row in snap.iter_rows(min_row=3, values_only=True):
        if row and row[0]:
            exported[row[0]] = {"ref": row[1] or "", "description": row[2] or "", "unit": row[3] or "", "quantity": row[4], "top": row[5] or ""}
    current = {l["key"]: l for l in info["lines"]}
    ws = wb["BoQ"]
    seen = set()
    heading = ""
    for r in range(FIRST, ws.max_row + 1):
        ref, desc, unit, qty = (ws.cell(row=r, column=c).value for c in (1, 2, 3, 4))
        key = ws.cell(row=r, column=KEY_COL).value
        desc_s = str(desc or "").strip()
        if not key:
            if not any(v not in (None, "") for v in (ref, desc, unit, qty)):
                continue
            if desc_s.startswith("Subtotal") or desc_s == "TOTAL":
                continue
            if qty in (None, "") and not unit:
                heading = str(ref or "").strip()  # a section heading: its code
                continue
            q, ok = number(qty)
            if not ok:
                report["problems"].append({"sheet": "BoQ", "row": r, "column": COLS["quantity"], "message": f"\"{qty}\" is not a number."})
                continue
            if not desc_s:
                report["problems"].append({"sheet": "BoQ", "row": r, "column": COLS["description"], "message": "A new row needs a description."})
                continue
            item = {"id": f"xlsx-{r}", "kind": "other", "description": desc_s, "unit": str(unit or "item").strip(), **({"quantity": q} if q is not None else {})}
            code = str(ref or "").strip() or heading
            report["manualItems"].append({"item": {"item": item, **({"codes": {primary: code}} if primary and code else {})}, "row": r})
            continue
        key = str(key)
        if key not in current or key not in exported:
            report["problems"].append({"sheet": "BoQ", "row": r, "column": "I", "message": "This line isn't in this BoQ any more: it is left out."})
            continue
        seen.add(key)
        was = exported[key]
        edit = {"lineKey": key}
        changes = []
        q, ok = number(qty)
        if not ok:
            report["problems"].append({"sheet": "BoQ", "row": r, "column": COLS["quantity"], "message": f"\"{qty}\" is not a number."})
            continue
        before, _ = number(was["quantity"])
        if (q is None) != (before is None) or (q is not None and before is not None and abs(q - before) > 1e-9):
            edit["quantity"] = q
            changes.append("quantity")
        if desc_s != str(was["description"]).strip():
            edit["description"] = desc_s
            changes.append("description")
        unit_s = str(unit or "").strip()
        if unit_s != str(was["unit"]).strip():
            edit["unit"] = unit_s
            if "quantity" not in edit:
                edit["quantity"] = q
            changes.append("unit")
        ref_s = str(ref or "").strip()
        if primary and (ref_s != str(was["ref"]).strip() or (heading and heading != str(was["top"]))):
            code = ref_s if ref_s != str(was["ref"]).strip() else heading
            if code:
                edit["codes"] = {primary: code}
                changes.append("moved")
        if changes:
            kind = changes[0] if len(changes) == 1 else "mixed"
            report["overrides"].append({"edit": edit, "change": kind, "row": r})
    for key in exported:
        if key not in seen and key in current and not current[key].get("excluded"):
            report["overrides"].append({"edit": {"lineKey": key, "excluded": True}, "change": "excluded"})
    return report


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "annotate":
        annotate(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "read":
        print(json.dumps(read(sys.argv[2], sys.argv[3])))
    else:
        raise SystemExit("annotate | read")
