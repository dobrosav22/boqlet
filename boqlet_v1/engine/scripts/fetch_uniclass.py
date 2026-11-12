"""
fetch_uniclass.py - download the Uniclass 2015 EF (Elements/functions) table and install it
as presets/classifications/uniclass2015-ef/codelist.json, so the bundled map can be used.

    npm run import:uniclass
    python scripts/fetch_uniclass.py [--url URL] [--csv local.csv]

Source: NBS publishes Uniclass free of charge at https://uniclass.thenbs.com/ (Excel).
By default this script uses the CSV mirror at github.com/buildig/uniclass-2015 (2022-01 data).
For production, download the current tables from NBS and pass --csv. Uniclass is NBS's work:
the code list is NOT committed to this repo (see docs/08-knowledge-gaps-and-sourcing.md).
"""
from __future__ import annotations

import argparse
import sys
import tempfile
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import import_codelist  # noqa: E402

DEFAULT_URL = "https://raw.githubusercontent.com/buildig/uniclass-2015/main/uniclass2015/Uniclass2015_EF.csv"
OUT = HERE.parents[1] / "presets" / "classifications" / "uniclass2015-ef" / "codelist.json"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--csv", help="use a local CSV instead of downloading")
    a = ap.parse_args(argv)
    if a.csv:
        src = Path(a.csv)
    else:
        print(f"downloading {a.url}")
        tmp = Path(tempfile.mkdtemp()) / "Uniclass2015_EF.csv"
        urllib.request.urlretrieve(a.url, tmp)
        src = tmp
    OUT.parent.mkdir(parents=True, exist_ok=True)
    import_codelist.main([str(src), str(OUT), "--preset", "uniclass", "--id", "uniclass2015-ef",
                          "--name", "Uniclass 2015 - Elements/functions", "--version", "2022-01 (buildig CSV mirror)"])
    print(f"installed {OUT}. Restart the engine to see 'Uniclass 2015 EF' in the app.")


if __name__ == "__main__":
    main()
