"""Code-list import from spreadsheets (ifc_boq/codelist_import.py), as the Library's import wizard uses it."""
import io

import pytest

from ifc_boq.codelist_import import build_codes, guess_separator, read_table


def test_csv_with_bom_semicolons_and_local_headers():
    data = "﻿Šifra;Naziv;Napomena\nA;Pripremni radovi;\nA.01;Gradilište;ograda\nA.02;Skele;\nB;Zemljani radovi;\nB.01;Iskop;\n".encode("utf-8")
    sheet = read_table("troskovnik.csv", data)["sheets"][0]
    g = sheet["guess"]
    assert (g["headerRow"], g["code"], g["title"], g["separator"]) == (0, 0, 1, ".")
    out = build_codes(sheet["rows"], g["headerRow"], {"code": g["code"], "title": g["title"], "extra": [2]}, "separator", g["separator"])
    by = {c["code"]: c for c in out["codes"]}
    assert by["A.01"]["parent"] == "A" and by["A.01"]["level"] == 1 and by["B"]["level"] == 0
    assert by["A.01"]["title"] == "Gradilište" and by["A.01"]["extra"] == {"Napomena": "ograda"}
    assert out["stats"] == {"codes": 5, "top": 2, "levels": 2, "skipped": 0, "duplicates": 0}


def test_excel_with_a_title_block_and_a_parent_column():
    openpyxl = pytest.importorskip("openpyxl")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Codes"
    ws.append(["ACME cost codes 2026"])
    ws.append([])
    ws.append(["Code", "Parent code", "Title"])
    for row in (["10", None, "Substructure"], ["1010", "10", "Foundations"], [1020, 10, "Ground slabs"], ["20", None, "Frame"]):
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    sheet = read_table("codes.xlsx", buf.getvalue())["sheets"][0]
    g = sheet["guess"]
    assert sheet["name"] == "Codes" and (g["headerRow"], g["code"], g["parent"], g["title"]) == (2, 0, 1, 2)
    out = build_codes(sheet["rows"], g["headerRow"], {"code": 0, "title": 2, "parent": 1}, "parent")
    by = {c["code"]: c for c in out["codes"]}
    assert by["1020"]["parent"] == "10" and by["1020"]["level"] == 1    # numbers read as text, no ".0"
    assert out["stats"]["top"] == 2


def test_level_column_duplicates_and_missing_parents():
    rows = [["Level", "Code", "Title"], ["1", "01", "Concrete"], ["2", "01.1", "Footings"], ["2", "01.2", "Slabs"],
            ["3", "01.2.1", "Ground slab"], ["1", "02", "Masonry"], ["1", "02", "Masonry again"], ["", "", ""]]
    out = build_codes(rows, 0, {"level": 0, "code": 1, "title": 2}, "level")
    by = {c["code"]: c for c in out["codes"]}
    assert by["01.2.1"]["parent"] == "01.2" and by["01.2.1"]["level"] == 2 and "parent" not in by["02"]
    assert out["stats"]["duplicates"] == 1 and any("02 appears again" in p for p in out["problems"])
    out = build_codes([["c", "t", "p"], ["X1", "x", "NOPE"]], 0, {"code": 0, "title": 1, "parent": 2}, "parent")
    assert any("NOPE is not in the list" in p for p in out["problems"])


def test_separator_guess_and_unsupported_files():
    assert guess_separator(["EF", "EF_25", "EF_25_10", "EF_30"]) == "_"
    assert guess_separator(["100", "200", "300"]) is None
    with pytest.raises(ValueError, match="xlsx"):
        read_table("old.xls", b"")
    with pytest.raises(ValueError):
        read_table("codes.pdf", b"%PDF")
