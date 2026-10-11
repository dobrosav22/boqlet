"""paths.py - where things live. Override with environment variables in deployment."""
from __future__ import annotations

import os
from pathlib import Path

ENGINE = Path(__file__).resolve().parents[1]           # engine/
ROOT = ENGINE.parent                                  # repo root
PRESETS = Path(os.environ.get("IFC_BOQ_PRESETS", ROOT / "presets"))
SCHEMAS = Path(os.environ.get("IFC_BOQ_SCHEMAS", ROOT / "packages" / "types" / "schema"))
CACHE = Path(os.environ.get("IFC_BOQ_CACHE", ENGINE / ".cache"))
FIXTURES = ROOT / "fixtures"
