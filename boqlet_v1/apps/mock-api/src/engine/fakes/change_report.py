"""Fake "change report export" (mock-api.md "Change report", replaced by EN-002/EN-006).

Writes the workbook of a change report with openpyxl (the engine's venv): a Summary sheet, the Lines
(before, after, delta, delta %, causes) and the Elements. Usage: change_report.py in.json out.xlsx,
where in.json is {"title", "subtitle", "summary": [[label, value]...], "lines": [...], "elements": [...]}
with the rows already worded by the mock. Nothing is measured here.
"""
import json
import sys

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

BOLD = Font(bold=True)
HEAD = PatternFill("solid", fgColor="EDEAE3")
FILLS = {"added": "BFCDEE", "removed": "EDBEBD", "changed": "F8D2B8"}


def table(ws, header, rows, change_col=None, widths=None):
    ws.append(header)
    for cell in ws[ws.max_row]:
        cell.font = BOLD
        cell.fill = HEAD
    for row in rows:
        ws.append(row)
        if change_col is not None and row[change_col] in FILLS:
            ws.cell(ws.max_row, change_col + 1).fill = PatternFill("solid", fgColor=FILLS[row[change_col]])
    ws.freeze_panes = ws.cell(ws.max_row - len(rows) + 1 if rows else ws.max_row + 1, 1)
    for i, w in enumerate(widths or [], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w


def main(src, out):
    data = json.load(open(src, encoding="utf8"))
    wb = Workbook()
    ws = wb.active
    ws.title = "Summary"
    ws.append([data["title"]])
    ws["A1"].font = Font(bold=True, size=13)
    ws.append([data.get("subtitle", "")])
    ws.append([])
    for label, value in data["summary"]:
        ws.append([label, value])
    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 60

    lines = wb.create_sheet("Lines")
    table(
        lines,
        ["Group", "Line key", "Description", "Unit", "Change", "Before", "After", "Delta", "Delta %", "Causes"],
        [[l["group"], l["lineKey"], l["description"], l["unit"], l["change"], l["before"], l["after"], l["delta"], l["deltaPct"], l["causes"]] for l in data["lines"]],
        change_col=4,
        widths=[28, 40, 48, 8, 10, 14, 14, 14, 10, 40],
    )
    for row in lines.iter_rows(min_row=2, min_col=6, max_col=8):
        for cell in row:
            cell.number_format = "#,##0.000"
    for row in lines.iter_rows(min_row=2, min_col=9, max_col=9):
        for cell in row:
            cell.number_format = "0.0"

    elements = wb.create_sheet("Elements")
    table(
        elements,
        ["GlobalId", "Model", "Change", "Changed fields", "Lines affected"],
        [[e["guid"], e["model"], e["change"], e["fields"], e["lines"]] for e in data["elements"]],
        change_col=2,
        widths=[26, 24, 10, 30, 60],
    )
    wb.save(out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
