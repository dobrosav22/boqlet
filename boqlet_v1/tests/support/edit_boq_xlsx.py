"""Edits an exported BoQ workbook the way a person would in Excel (FE-037 scenarios and e2e):
one quantity changed, one row moved to another section (its Ref set to another section's code), one
row deleted, one row added (no key) under the first section. Prints what it did as JSON.
Usage: edit_boq_xlsx.py <file.xlsx>"""
import json
import sys

from openpyxl import load_workbook

KEY = 9
path = sys.argv[1]
wb = load_workbook(path)
ws = wb["BoQ"]
rows = [r for r in range(6, ws.max_row + 1) if ws.cell(row=r, column=KEY).value]
section = {}
current = None
for r in range(6, ws.max_row + 1):
    if not ws.cell(row=r, column=KEY).value and ws.cell(row=r, column=1).value and ws.cell(row=r, column=4).value in (None, ""):
        current = ws.cell(row=r, column=1).value
    elif ws.cell(row=r, column=KEY).value:
        section[r] = current
numeric = [r for r in rows if isinstance(ws.cell(row=r, column=4).value, (int, float)) and ws.cell(row=r, column=4).value]
qty_row = numeric[0]
others = [r for r in numeric if section[r] != section[qty_row]]
move_row = next(r for r in numeric if r != qty_row and section[r] == section[qty_row]) if any(r != qty_row and section[r] == section[qty_row] for r in numeric) else numeric[1]
target = next(r for r in others if section[r] != section[move_row])
delete_row = next(r for r in rows if r not in (qty_row, move_row) and section[r] != section[qty_row] and r != target)

done = {
    "quantity": {"key": ws.cell(row=qty_row, column=KEY).value, "from": ws.cell(row=qty_row, column=4).value},
    "moved": {"key": ws.cell(row=move_row, column=KEY).value, "to": ws.cell(row=target, column=1).value},
    "deleted": {"key": ws.cell(row=delete_row, column=KEY).value},
    "added": {"description": "Site hoarding", "unit": "m", "quantity": 42},
}
ws.cell(row=qty_row, column=4, value=ws.cell(row=qty_row, column=4).value * 2)
ws.cell(row=move_row, column=1, value=ws.cell(row=target, column=1).value)
ws.delete_rows(delete_row)
insert_at = qty_row + 1 if delete_row > qty_row else qty_row
ws.insert_rows(insert_at)
ws.cell(row=insert_at, column=2, value="Site hoarding")
ws.cell(row=insert_at, column=3, value="m")
ws.cell(row=insert_at, column=4, value=42)
wb.save(path)
print(json.dumps(done))
