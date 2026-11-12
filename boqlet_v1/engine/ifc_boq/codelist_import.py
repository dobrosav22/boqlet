"""
codelist_import.py - turn a spreadsheet of codes (CSV, TSV, Excel) into CodeList codes.

Two steps, so a user can map columns while seeing the file:
  read_table(file name, bytes)  -> sheets of text rows, with a guess of header row, columns, separator
  build_codes(rows, mapping)    -> codes with parents and levels, plus problems found

The hierarchy comes from one of:
  separator  parents derived from the code ("B.01" is under "B"; "EF_25_10" under "EF_25")
  parent     a parent-code column
  level      a level column (1, 2, 3...): each code's parent is the nearest code above it one level up
  flat       no hierarchy
Used by the dev API (POST /api/codelists/read, /build) and scripts/import_codelist.py.
"""
from __future__ import annotations

import csv
import io
import re
from collections import Counter

MAX_ROWS = 100_000
MAX_COLS = 80

HEADER_GUESS = {
    "code": r"^(code|codes|nr\.?|no\.?|number|ref(erence)?|pos(ition)?|item|šifra|sifra|oznaka|kennung|ordnungszahl|oz)$|code",
    "title": r"^(title|name|naziv|bezeichnung|titel|kurztext|item name)$|title|name|naziv",
    "parent": r"parent|nadređen|nadreden|übergeordnet",
    "description": r"^(description|desc|opis|beschreibung|langtext|notes?)$|descr",
    "level": r"^(level|lvl|razina|nivo|ebene|depth)$",
}


# ---------------------------------------------------------------------------- reading
def _text(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def _trim(rows: list[list[str]]) -> list[list[str]]:
    rows = [r[:MAX_COLS] for r in rows[:MAX_ROWS]]
    while rows and not any(rows[-1]):
        rows.pop()
    width = max((max((i + 1 for i, c in enumerate(r) if c), default=0) for r in rows), default=0)
    return [r[:width] + [""] * (width - len(r[:width])) for r in rows]


def _read_csv(data: bytes) -> list[list[str]]:
    for enc in ("utf-8-sig", "cp1250", "cp1252", "latin-1"):
        try:
            text = data.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    sample = text[:20000]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        delim = dialect.delimiter
    except csv.Error:
        delim = max(",;\t|", key=sample.count)
    return [[c.strip() for c in row] for row in csv.reader(io.StringIO(text), delimiter=delim)]


def _read_xlsx(data: bytes) -> list[tuple[str, list[list[str]]]]:
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    out = []
    for ws in wb.worksheets:
        rows = []
        for r in ws.iter_rows(values_only=True):
            rows.append([_text(v) for v in r])
            if len(rows) >= MAX_ROWS:
                break
        out.append((ws.title, rows))
    wb.close()
    return out


def read_table(file_name: str, data: bytes) -> dict:
    """{ sheets: [ { name, rows, guess } ] }. Raises ValueError for unsupported files."""
    name = file_name.lower()
    if name.endswith((".xlsx", ".xlsm")):
        raw = _read_xlsx(data)
    elif name.endswith((".csv", ".tsv", ".txt")):
        raw = [(file_name, _read_csv(data))]
    elif name.endswith(".xls"):
        raise ValueError("Old .xls files are not supported; save the sheet as .xlsx or .csv.")
    else:
        raise ValueError("Use a .csv, .tsv, .txt or .xlsx file.")
    sheets = []
    for sheet_name, rows in raw:
        rows = _trim(rows)
        if rows:
            sheets.append({"name": sheet_name, "rows": rows, "guess": guess(rows)})
    if not sheets:
        raise ValueError("The file has no rows.")
    return {"sheets": sheets}


# ---------------------------------------------------------------------------- guessing
def guess(rows: list[list[str]]) -> dict:
    """Header row (0-based), columns for code / title / parent / description / level, and a separator."""
    header = 0
    for i, r in enumerate(rows[:30]):
        filled = [c for c in r if c]
        if len(filled) >= 2 and sum(1 for c in filled if not re.fullmatch(r"[\d.,\s-]+", c)) >= 2:
            header = i
            break
    head = [c.lower() for c in rows[header]] if rows else []
    out: dict = {"headerRow": header}
    taken: set[int] = set()
    for key in ("parent", "level", "code", "description", "title"):   # "Parent code" is a parent, not a code
        for i, h in enumerate(head):
            if i not in taken and h and re.search(HEADER_GUESS[key], h):
                out[key] = i
                taken.add(i)
                break
    body = rows[header + 1:]
    if "code" not in out and body:          # the column whose values look most like codes
        def codeish(i):
            vals = [r[i] for r in body[:200] if i < len(r) and r[i]]
            return sum(1 for v in vals if len(v) <= 20 and re.search(r"\d", v)) / max(len(vals), 1)
        best = max(range(len(head)), key=codeish, default=None)
        if best is not None and codeish(best) > 0.5:
            out["code"] = best
            taken.add(best)
    if "title" not in out and body:         # the longest text column
        lens = {i: sum(len(r[i]) for r in body[:200] if i < len(r)) for i in range(len(head)) if i not in taken}
        if lens:
            out["title"] = max(lens, key=lens.get)
    if "code" in out:
        out["separator"] = guess_separator([r[out["code"]] for r in body if out["code"] < len(r) and r[out["code"]]])
    return out


def guess_separator(codes: list[str]) -> str | None:
    """The separator that turns the most codes into children of other codes in the list."""
    known = set(codes)
    best, best_hits = None, 0
    for sep in (".", "_", "-", " ", "/"):
        hits = sum(1 for c in codes if sep in c and c.rsplit(sep, 1)[0] in known)
        if hits > best_hits:
            best, best_hits = sep, hits
    return best if best_hits >= max(1, len(codes) // 20) else None


# ---------------------------------------------------------------------------- building
def derive_hierarchy(codes: list[dict], separator: str | None) -> None:
    """Fill `parent` from the separator where missing, then `level` for every code (in place)."""
    known = {c["code"] for c in codes}
    if separator:
        for c in codes:
            if c.get("parent"):
                continue
            parts = c["code"].split(separator)
            while len(parts) > 1:
                parts = parts[:-1]
                if separator.join(parts) in known:
                    c["parent"] = separator.join(parts)
                    break
    by = {c["code"]: c for c in codes}
    for c in codes:
        lvl, cur, seen = 0, c, set()
        while cur.get("parent") in by and cur["code"] not in seen:
            seen.add(cur["code"])
            lvl += 1
            cur = by[cur["parent"]]
        c["level"] = lvl


def build_codes(rows: list[list[str]], header_row: int, mapping: dict, hierarchy: str = "separator",
                separator: str | None = None) -> dict:
    """mapping: { code, title, parent?, description?, level?, extra?: [col] } as column indexes."""
    head = rows[header_row] if 0 <= header_row < len(rows) else []
    col = lambda r, k: (r[mapping[k]].strip() if mapping.get(k) is not None and mapping[k] < len(r) else "")
    codes, seen, problems = [], set(), []
    skipped = dup = untitled = 0
    stack: list[tuple[int, str]] = []                # (level, code) for hierarchy = "level"
    for n, r in enumerate(rows[header_row + 1:], start=header_row + 2):
        code, title = col(r, "code"), col(r, "title")
        if not code:
            skipped += 1 if any(r) else 0
            continue
        if code in seen:
            dup += 1
            if dup <= 5:
                problems.append(f"row {n}: code {code} appears again; the first one is kept")
            continue
        seen.add(code)
        if not title:
            untitled += 1
        c: dict = {"code": code, "title": title}
        if col(r, "description"):
            c["description"] = col(r, "description")
        extra = {head[i] or f"column {i + 1}": r[i].strip() for i in mapping.get("extra") or []
                 if i < len(r) and r[i].strip()}
        if extra:
            c["extra"] = extra
        if hierarchy == "parent" and col(r, "parent"):
            c["parent"] = col(r, "parent")
        elif hierarchy == "level":
            try:
                lvl = int(float(col(r, "level").replace(",", ".")))
            except ValueError:
                lvl = None
            if lvl is not None:
                while stack and stack[-1][0] >= lvl:
                    stack.pop()
                if stack:
                    c["parent"] = stack[-1][1]
                stack.append((lvl, code))
        codes.append(c)
    derive_hierarchy(codes, separator if hierarchy == "separator" else None)
    missing = [c for c in codes if c.get("parent") and c["parent"] not in seen]
    for c in missing[:5]:
        problems.append(f"code {c['code']}: parent {c['parent']} is not in the list")
    if len(missing) > 5:
        problems.append(f"... and {len(missing) - 5} more codes whose parent is not in the list")
    if dup > 5:
        problems.append(f"... {dup} repeated codes in all")
    if untitled:
        problems.append(f"{untitled} code(s) have no title")
    if skipped:
        problems.append(f"{skipped} row(s) without a code were skipped")
    levels = Counter(c["level"] for c in codes)
    return {"codes": codes, "problems": problems,
            "stats": {"codes": len(codes), "top": levels.get(0, 0), "levels": len(levels), "skipped": skipped, "duplicates": dup}}
