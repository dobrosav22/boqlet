"""
store.py - file-based cache for parsed models and runs (engine/.cache).

  models/<sha256>/model.ifc      the uploaded file (model.ifczip when zipped)
  models/<sha256>/parsed.json    ParsedModel   (parse once per file version)
  models/<sha256>/geometry.glb   meshes for the 3D viewer
  models/<sha256>/meshes.npz     the same meshes in float64 for the engine (geometry.py, mesh sidecar)
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
import zipfile
from functools import lru_cache
from pathlib import Path

from .geometry import load_meshes, save_meshes
from .parse import PARSE_FORMAT, parse_file
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
    if parsed_path.exists() and (d / "meshes.npz").exists():      # (parsed before the sidecar existed: parse again)
        doc = get_parsed(mid)
        if doc["header"]["parse"].get("format", 1) >= PARSE_FORMAT:   # older parse output: parse again
            return mid, doc, True
    d.mkdir(parents=True, exist_ok=True)
    ifc = d / ("model.ifczip" if zipfile.is_zipfile(src) else "model.ifc")   # ifcopenshell reads zips by extension
    shutil.copyfile(src, ifc)
    doc, parser = parse_file(str(ifc))
    doc["header"]["source"]["fileName"] = file_name
    parsed_path.write_text(json.dumps(doc), encoding="utf-8")
    try:
        parser.export_glb(str(d / "geometry.glb"))
    except Exception:
        pass
    save_meshes(parser.meshes, d / "meshes.npz")
    get_parsed.cache_clear()
    get_meshes.cache_clear()
    return mid, doc, False


@lru_cache(maxsize=8)
def get_parsed(model_id: str) -> dict:
    p = model_dir(model_id) / "parsed.json"
    if not p.exists():
        raise KeyError(model_id)
    return json.loads(p.read_text(encoding="utf-8"))


@lru_cache(maxsize=4)
def get_meshes(model_id: str) -> dict | None:
    """The model's mesh sidecar, or None (the engine then skips work that needs meshes)."""
    p = model_dir(model_id) / "meshes.npz"
    return load_meshes(p) if p.exists() else None


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
