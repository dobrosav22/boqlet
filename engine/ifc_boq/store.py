"""
store.py - file-based cache for parsed models and runs (engine/.cache).

  models/<sha256>/model.ifc      the uploaded file
  models/<sha256>/parsed.json    ParsedModel   (parse once per file version)
  models/<sha256>/geometry.glb   meshes for a future 3D viewer
  runs/<runId>.json              RunRequest + BoqResult (immutable)
  runs/<runId>.xlsx              Excel export

This stands in for the future backend's storage (object store + database).
"""
from __future__ import annotations

import hashlib
import json
import shutil
import time
import uuid
from functools import lru_cache
from pathlib import Path

from .parse import parse_file
from .paths import CACHE


def model_dir(model_id: str) -> Path:
    if not model_id.isalnum():
        raise ValueError("bad model id")
    return CACHE / "models" / model_id


def put_model(src: Path, file_name: str) -> tuple[str, dict, bool]:
    """Store + parse a model file. Returns (model_id, parsed, cached)."""
    h = hashlib.sha256()
    with open(src, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    mid = h.hexdigest()
    d = model_dir(mid)
    parsed_path = d / "parsed.json"
    if parsed_path.exists():
        return mid, get_parsed(mid), True
    d.mkdir(parents=True, exist_ok=True)
    ifc = d / "model.ifc"
    shutil.copyfile(src, ifc)
    doc, parser = parse_file(str(ifc))
    doc["header"]["source"]["fileName"] = file_name
    parsed_path.write_text(json.dumps(doc), encoding="utf-8")
    try:
        parser.export_glb(str(d / "geometry.glb"))
    except Exception:
        pass
    get_parsed.cache_clear()
    return mid, doc, False


@lru_cache(maxsize=8)
def get_parsed(model_id: str) -> dict:
    p = model_dir(model_id) / "parsed.json"
    if not p.exists():
        raise KeyError(model_id)
    return json.loads(p.read_text(encoding="utf-8"))


def save_run(request: dict, result: dict) -> str:
    run_id = time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]
    d = CACHE / "runs"
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{run_id}.json").write_text(json.dumps({"request": request, "result": result}), encoding="utf-8")
    return run_id


def run_path(run_id: str, ext: str) -> Path:
    if not all(c.isalnum() or c == "-" for c in run_id):
        raise ValueError("bad run id")
    return CACHE / "runs" / f"{run_id}.{ext}"
