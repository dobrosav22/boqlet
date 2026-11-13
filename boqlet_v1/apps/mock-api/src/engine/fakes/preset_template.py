"""Fake "Preset Excel templates" (mock-api.md, replaced by EN-012), run with the engine's Python.

  python preset_template.py write <input.json> <out.xlsx>
  python preset_template.py read  <input.json> <in.xlsx>   -> JSON {doc, changes, problems} on stdout

input.json: {kind, doc, effective?, parentParams?, items?, terms?, source}
  kind        rule_set | classification | dictionary
  doc         the preset document (a rule-set patch, or a whole document)
  effective   rule sets: the flattened rule set (every slot with its current answer)
  parentParams rule-set patches: the parent's slots (their answers are the defaults)
  items       classifications: [{id, label}] the BoQ items of a rule set (Codes per line)
  terms       dictionaries: [term id] offered as meanings
  source      draft | latest | empty (empty: answers left at their defaults, no codes, no names)

The workbook is read data-only (formulas are not evaluated, F10 §14 / security.md). Nothing is
measured here (BR-01): answers, codes and names are what a person typed.
"""
import copy
import json
import sys

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

YELLOW = PatternFill("solid", fgColor="FFF2B3")
GREY = PatternFill("solid", fgColor="EEEDE8")
BOLD = Font(bold=True)
MATCH_KINDS = {"exact": "exact", "startsWith": "starts with", "contains": "contains", "regex": "regex"}
MATCH_BY_WORD = {v: k for k, v in MATCH_KINDS.items()}


def header(ws, names, widths):
    ws.append(names)
    for i, w in enumerate(widths):
        ws.column_dimensions[chr(65 + i)].width = w
        ws.cell(row=1, column=i + 1).font = BOLD
    ws.freeze_panes = "A2"


def readme(wb, lines):
    ws = wb.create_sheet("Read me", 0)
    ws.column_dimensions["A"].width = 110
    for line in lines:
        ws.append([line])
    ws["A1"].font = Font(bold=True, size=13)


def list_range(lists, values):
    """A column of the hidden Lists sheet holding `values`; returns its absolute range."""
    col = lists.max_column + 1 if lists.max_row > 1 or lists["A1"].value is not None else 1
    letter = lists.cell(row=1, column=col).column_letter
    for i, v in enumerate(values):
        lists.cell(row=i + 1, column=col, value=v)
    return f"Lists!${letter}$1:${letter}${max(len(values), 1)}"


# ------------------------------------------------------------------------------------------ rule sets

def answer_text(p, v):
    t = p.get("type")
    if t == "boolean":
        return "yes" if v else "no"
    if t == "choice":
        return (p.get("optionLabels") or {}).get(v, v)
    return v


def parse_answer(p, raw):
    """(value, error message)."""
    t = p.get("type")
    if raw is None or (isinstance(raw, str) and raw.strip() == ""):
        return None, "No answer. Leave the row as it was or give an answer."
    if t == "number":
        try:
            v = float(str(raw).replace(",", ".")) if not isinstance(raw, (int, float)) else float(raw)
        except ValueError:
            return None, f"'{raw}' is not a number."
        if p.get("min") is not None and v < p["min"]:
            return None, f"{v} is below the smallest allowed answer, {p['min']}."
        if p.get("max") is not None and v > p["max"]:
            return None, f"{v} is above the largest allowed answer, {p['max']}."
        return (int(v) if v.is_integer() and isinstance(p.get("value"), int) else v), None
    if t == "boolean":
        s = str(raw).strip().lower()
        if s in ("yes", "true", "1", "y"):
            return True, None
        if s in ("no", "false", "0", "n"):
            return False, None
        return None, f"'{raw}' is not yes or no."
    if t == "choice":
        s = str(raw).strip()
        labels = p.get("optionLabels") or {}
        for o in p.get("options", []):
            if s == o or s.lower() == str(labels.get(o, "")).strip().lower():
                return o, None
        allowed = ", ".join(str(labels.get(o, o)) for o in p.get("options", []))
        return None, f"'{raw}' is not one of the answers: {allowed}."
    return str(raw), None


def write_rule_set(data, wb):
    eff = data["effective"]
    params = eff.get("params", {})
    parent = data.get("parentParams") or {}
    sections = {s["id"]: s.get("title", s["id"]) for s in eff.get("sections", [])}
    order = {s["id"]: i for i, s in enumerate(eff.get("sections", []))}
    lists = wb.create_sheet("Lists")
    lists.sheet_state = "hidden"
    ws = wb.active
    ws.title = "Settings"
    header(ws, ["Setting", "Section", "Question", "Explanation", "Unit", "Your answer", "Default"], [24, 22, 52, 60, 8, 26, 18])
    names = sorted(params, key=lambda n: (order.get(params[n].get("section"), 999), list(params).index(n)))
    for n in names:
        p = params[n]
        if p.get("type") == "formula":
            continue
        default = parent[n]["value"] if n in parent else p.get("value")
        current = default if data.get("source") == "empty" else p.get("value")
        ws.append([n, sections.get(p.get("section"), ""), p.get("question") or p.get("label") or n, p.get("help", ""), p.get("unit", ""), answer_text(p, current), answer_text(p, default)])
        row = ws.max_row
        ws.cell(row=row, column=6).fill = YELLOW
        for c in (1, 7):
            ws.cell(row=row, column=c).fill = GREY
        if p.get("type") in ("boolean", "choice"):
            values = ["yes", "no"] if p["type"] == "boolean" else [str((p.get("optionLabels") or {}).get(o, o)) for o in p.get("options", [])]
            dv = DataValidation(type="list", formula1=list_range(lists, values), allow_blank=False)
            dv.error = "Pick one of the answers in the list."
            ws.add_data_validation(dv)
            dv.add(ws.cell(row=row, column=6))
    items = wb.create_sheet("BoQ items")
    header(items, ["Item", "Name", "Measures", "Uses answers"], [26, 50, 14, 50])
    for kind in ("items", "derived", "manual"):
        for it in eff.get(kind, []) or []:
            used = sorted(set(_param_refs(it)))
            q = it.get("quantity")
            label = it.get("label") or it.get("description") or ""
            items.append([it.get("id"), label if isinstance(label, str) else "", q.get("kind", kind) if isinstance(q, dict) else kind, ", ".join(used)])
    items.protection.sheet = True
    readme(wb, [
        f"{eff.get('name', '')}: settings template",
        "Change the answers in the yellow 'Your answer' column of the Settings sheet; leave the other columns as they are.",
        "Each answer must be one of the allowed answers (a list where there is one). Numbers are in the unit of their row.",
        "Upload the file back on the rule set's page: you'll see every change before anything is saved.",
        "The 'BoQ items' sheet shows what each item measures and which answers it uses (read only).",
    ])


def _param_refs(x):
    if isinstance(x, dict):
        if set(x) == {"param"}:
            yield x["param"]
        for v in x.values():
            yield from _param_refs(v)
    elif isinstance(x, list):
        for v in x:
            yield from _param_refs(v)
    elif isinstance(x, str):
        import re
        yield from re.findall(r"\bp\.([A-Za-z_]\w*)", x)


def read_rule_set(data, wb, problems, changes):
    doc = copy.deepcopy(data["doc"])
    eff = data["effective"]["params"]
    parent = data.get("parentParams") or {}
    patch = isinstance(doc.get("extends"), str)
    own = doc.setdefault("params", {})
    if "Settings" not in wb.sheetnames:
        problems.append({"sheet": "Settings", "message": "The workbook has no Settings sheet."})
        return doc
    ws = wb["Settings"]
    for r, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row or row[0] is None:
            continue
        name = str(row[0]).strip()
        if name not in eff:
            problems.append({"sheet": "Settings", "row": r, "column": "A", "message": f"'{name}' is not a setting of this rule set."})
            continue
        p = eff[name]
        if p.get("type") == "formula":
            continue
        value, err = parse_answer(p, row[5] if len(row) > 5 else None)
        if err:
            problems.append({"sheet": "Settings", "row": r, "column": "F", "message": err})
            continue
        if value == p.get("value"):
            continue
        question = p.get("question") or p.get("label") or name
        changes.append({"what": "answer", "summary": f"{question}: {answer_text(p, p.get('value'))} → {answer_text(p, value)}", "before": p.get("value"), "after": value})
        mine = own.get(name)
        if mine and "type" in mine:
            own[name] = {**mine, "value": value}
        elif patch and name in parent and parent[name].get("value") == value:
            own.pop(name, None)
        elif patch:
            own[name] = {"value": value}
        else:
            own[name] = {**p, "value": value}
    return doc


# ------------------------------------------------------------------------------------ classifications

def simple_mappings(m):
    """ruleId -> (index, code) for map rules that give one item one fixed code."""
    out = {}
    for i, r in enumerate(m.get("rules", [])):
        match, code = r.get("match", {}), r.get("code")
        if isinstance(match.get("ruleId"), str) and len(match) == 1 and isinstance(code, str):
            out.setdefault(match["ruleId"], (i, code))
    return out


def write_classification(data, wb):
    doc = data["doc"]
    cl = doc.get("codeList") or {}
    empty = data.get("source") == "empty"
    codes = [] if empty else cl.get("codes", [])
    ws = wb.active
    ws.title = "Codes"
    header(ws, ["Code", "Short name", "Parent", "Item text"], [16, 44, 14, 90])
    for c in codes:
        ws.append([c.get("code"), c.get("title", ""), c.get("parent", ""), c.get("description", "")])
    lines = wb.create_sheet("Codes per line")
    header(lines, ["BoQ item", "Item name", "Code"], [28, 50, 16])
    mapped = {} if empty else simple_mappings(doc.get("map") or {})
    items = data.get("items") or []
    seen = set()
    for it in items:
        seen.add(it["id"])
        lines.append([it["id"], it.get("label", ""), mapped.get(it["id"], (0, ""))[1]])
    for rid, (_, code) in mapped.items():
        if rid not in seen:
            lines.append([rid, "", code])
    for row in range(2, lines.max_row + 1):
        lines.cell(row=row, column=3).fill = YELLOW
        lines.cell(row=row, column=1).fill = GREY
    if lines.max_row > 1:
        dv = DataValidation(type="list", formula1=f"Codes!$A$2:$A${max(ws.max_row, 2)}", allow_blank=True)
        lines.add_data_validation(dv)
        dv.add(f"C2:C{lines.max_row}")
    readme(wb, [
        f"{cl.get('name', '')}: code list template",
        "Codes: one row per code. The parent is optional when the code's own form shows it (e.g. 5.2 under 5).",
        "Item text is the written description that is priced; blanks like {thickness} are filled per line.",
        "Codes per line: pick the code for each BoQ item in the yellow column (from the codes in the Codes sheet).",
        "Upload the file back on the classification's page: you'll see every change before anything is saved.",
    ])


def read_classification(data, wb, problems, changes):
    doc = copy.deepcopy(data["doc"])
    cl = doc.setdefault("codeList", {})
    m = doc.setdefault("map", {"rules": []})
    if "Codes" in wb.sheetnames:
        old = {c["code"]: c for c in cl.get("codes", [])}
        new, seen = [], set()
        for r, row in enumerate(wb["Codes"].iter_rows(min_row=2, values_only=True), start=2):
            if not row or all(v in (None, "") for v in row[:4]):
                continue
            code = str(row[0]).strip() if row[0] is not None else ""
            if not code:
                problems.append({"sheet": "Codes", "row": r, "column": "A", "message": "A code is missing."})
                continue
            if code in seen:
                problems.append({"sheet": "Codes", "row": r, "column": "A", "message": f"Code {code} is listed twice."})
                continue
            seen.add(code)
            title = str(row[1] or "").strip()
            parent = str(row[2] or "").strip() if len(row) > 2 else ""
            text = str(row[3] or "").strip() if len(row) > 3 else ""
            c = dict(old.get(code, {}), code=code, title=title)
            if parent:
                c["parent"] = parent
            else:
                c.pop("parent", None)
            if text:
                c["description"] = text
            else:
                c.pop("description", None)
            before = old.get(code)
            if before is None:
                changes.append({"what": "code", "summary": f"Code {code} added: {title}", "after": c})
            else:
                if before.get("description", "") != c.get("description", ""):
                    changes.append({"what": "item_text", "summary": f"Item text of {code} changed", "before": before.get("description"), "after": c.get("description")})
                if before.get("title") != title or before.get("parent") != c.get("parent"):
                    changes.append({"what": "code", "summary": f"Code {code} changed: {title}", "before": before, "after": c})
            new.append(c)
        for code in old:
            if code not in seen:
                changes.append({"what": "code", "summary": f"Code {code} removed", "before": old[code]})
        for c in new:
            if c.get("parent") and c["parent"] not in seen:
                problems.append({"sheet": "Codes", "message": f"Code {c['code']} has parent {c['parent']}, which is not in the list."})
        cl["codes"] = new
    if "Codes per line" in wb.sheetnames:
        codes = {c["code"] for c in cl.get("codes", [])}
        rules = m.setdefault("rules", [])
        mapped = simple_mappings(m)
        drop = set()
        for r, row in enumerate(wb["Codes per line"].iter_rows(min_row=2, values_only=True), start=2):
            if not row or row[0] in (None, ""):
                continue
            rid = str(row[0]).strip()
            code = str(row[2]).strip() if len(row) > 2 and row[2] not in (None, "") else ""
            if code and code not in codes:
                problems.append({"sheet": "Codes per line", "row": r, "column": "C", "message": f"Code {code} is not in the Codes sheet."})
                continue
            current = mapped.get(rid)
            if (current[1] if current else "") == code:
                continue
            changes.append({"what": "code_mapping", "summary": f"{rid}: {current[1] if current else 'no code'} → {code or 'no code'}", "before": current[1] if current else None, "after": code or None})
            if current and code:
                rules[current[0]] = {**rules[current[0]], "code": code}
            elif current:
                drop.add(current[0])
            else:
                rules.append({"id": f"item-{rid}", "match": {"ruleId": rid}, "code": code})
        m["rules"] = [r for i, r in enumerate(rules) if i not in drop]
    return doc


# --------------------------------------------------------------------------------------- dictionaries

def match_cells(match):
    for k, word in MATCH_KINDS.items():
        if k in match:
            v = match[k]
            return word, " | ".join(v) if isinstance(v, list) else str(v)
    return "exact", ""


def write_dictionary(data, wb):
    doc = data["doc"]
    entries = [] if data.get("source") == "empty" else doc.get("entries", [])
    lists = wb.create_sheet("Lists")
    lists.sheet_state = "hidden"
    ws = wb.active
    ws.title = "Names"
    header(ws, ["Entry", "Name or pattern", "Match", "Fields", "Meaning"], [22, 40, 12, 28, 30])
    for e in entries:
        kind, text = match_cells(e.get("match", {}))
        fields = e.get("field")
        ws.append([e.get("id"), text, kind, ", ".join(fields) if isinstance(fields, list) else (fields or ""), e.get("term", "")])
    last = max(ws.max_row, 200)
    for row in range(2, last + 1):
        ws.cell(row=row, column=5).fill = YELLOW
        ws.cell(row=row, column=1).fill = GREY
    kinds = DataValidation(type="list", formula1=list_range(lists, list(MATCH_KINDS.values())), allow_blank=True)
    ws.add_data_validation(kinds)
    kinds.add(f"C2:C{last}")
    terms = sorted(set(data.get("terms") or []) | {t["id"] for t in doc.get("terms", [])})
    if terms:
        meaning = DataValidation(type="list", formula1=list_range(lists, terms), allow_blank=True)
        ws.add_data_validation(meaning)
        meaning.add(f"E2:E{last}")
    readme(wb, [
        f"{doc.get('name', '')}: names template",
        "Names: one row per name or pattern in the models and what it means. Leave 'Entry' empty for a new row.",
        "Match: exact, starts with, contains or regex. Several spellings: separate them with |.",
        "Fields: where the name appears (material, type_name, name, ...); empty means material.",
        "Upload the file back on the dictionary's page: you'll see every change before anything is saved.",
    ])


def read_dictionary(data, wb, problems, changes):
    doc = copy.deepcopy(data["doc"])
    terms = set(data.get("terms") or []) | {t["id"] for t in doc.get("terms", [])}
    old = {e["id"]: e for e in doc.get("entries", [])}
    if "Names" not in wb.sheetnames:
        problems.append({"sheet": "Names", "message": "The workbook has no Names sheet."})
        return doc
    new, seen, n = [], set(), 0
    for r, row in enumerate(wb["Names"].iter_rows(min_row=2, values_only=True), start=2):
        if not row or all(v in (None, "") for v in row[:5]):
            continue
        eid = str(row[0]).strip() if row[0] not in (None, "") else ""
        text = str(row[1] or "").strip()
        kind = MATCH_BY_WORD.get(str(row[2] or "exact").strip().lower())
        fields = [f.strip() for f in str(row[3] or "material").split(",") if f.strip()]
        term = str(row[4] or "").strip()
        if not text:
            problems.append({"sheet": "Names", "row": r, "column": "B", "message": "The name or pattern is missing."})
            continue
        if not kind:
            problems.append({"sheet": "Names", "row": r, "column": "C", "message": f"'{row[2]}' is not a match kind: exact, starts with, contains or regex."})
            continue
        if not term or (terms and term not in terms):
            problems.append({"sheet": "Names", "row": r, "column": "E", "message": f"'{term}' is not a meaning this dictionary knows." if term else "The meaning is missing."})
            continue
        if not eid:
            n += 1
            eid = f"name-{n}"
            while eid in old or eid in seen:
                n += 1
                eid = f"name-{n}"
        seen.add(eid)
        values = [v.strip() for v in text.split("|")] if kind != "regex" else text
        match = {kind: values if kind == "regex" or len(values) > 1 else values[0]}
        e = dict(old.get(eid, {}), id=eid, field=fields if len(fields) > 1 else fields[0], match=match, term=term)
        before = old.get(eid)
        if before is None:
            changes.append({"what": "name", "summary": f"'{text}' means {term} (new)", "after": e})
        elif before != e:
            changes.append({"what": "name", "summary": f"'{text}' means {term}", "before": before, "after": e})
        new.append(e)
    for eid, e in old.items():
        if eid not in seen:
            changes.append({"what": "name", "summary": f"'{match_cells(e.get('match', {}))[1]}' removed", "before": e})
    doc["entries"] = new
    return doc


WRITE = {"rule_set": write_rule_set, "classification": write_classification, "dictionary": write_dictionary}
READ = {"rule_set": read_rule_set, "classification": read_classification, "dictionary": read_dictionary}


def main():
    mode, input_path, xlsx = sys.argv[1], sys.argv[2], sys.argv[3]
    data = json.load(open(input_path, encoding="utf8"))
    if mode == "write":
        wb = Workbook()
        WRITE[data["kind"]](data, wb)
        wb.save(xlsx)
        return
    try:
        wb = load_workbook(xlsx, read_only=False, data_only=True)
    except Exception as e:  # not a workbook
        print(json.dumps({"error": f"The file can't be read as an Excel workbook: {e}"}))
        return
    problems, changes = [], []
    doc = READ[data["kind"]](data, wb, problems, changes)
    sys.stdout.write(json.dumps({"doc": doc, "changes": changes, "problems": problems}, ensure_ascii=False))


if __name__ == "__main__":
    main()
