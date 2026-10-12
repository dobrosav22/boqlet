"""
api.py - local HTTP service for the web app (contract: packages/types/src/api.ts).

    GET  /api/health
    GET  /api/presets                     -> PresetsResponse
    GET  /api/presets/{kind}/{id}         -> raw preset JSON (kind: rules | dictionaries | classifications)
    POST /api/presets/{kind}/check        -> CheckPresetResponse (problems in a draft preset; nothing is saved)
    POST /api/models/{modelId}/names      -> NamesResponse (every name in the model and what it resolves to)
    GET  /api/models/{modelId}/geometry.glb -> meshes, one node per GlobalId (elements, openings, spaces)
    GET  /api/models/{modelId}/scene      -> SceneIndex (element -> mesh nodes, names, storeys) for the viewer
    POST /api/codelists/read (multipart)  -> TableReadResponse (sheets of a CSV / Excel file, with guesses)
    POST /api/codelists/build             -> CodeListBuildResponse (rows + column mapping -> codes)
    POST /api/models    (multipart file)  -> ModelSummary   (parses once per file content)
    GET  /api/models/{modelId}            -> ModelSummary
    POST /api/runs      (RunRequest)      -> RunResponse    (BoqResult + xlsx url)
    GET  /api/runs/{runId}/boq.xlsx       -> Excel file

Synchronous on purpose: this is a dev tool. In the platform, parsing and runs become
background jobs owned by the (Java) backend, with this engine as the worker
(docs/03-architecture.md). Keep handlers thin: all logic lives in service.py / pipeline.py.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from . import __version__, codelist_import, pipeline, presets, service, store

app = FastAPI(title="IFC -> BoQ engine", version=__version__)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])
MAX_UPLOAD_MB = int(os.environ.get("IFC_BOQ_MAX_UPLOAD_MB", "300"))


class DecisionIn(BaseModel):
    questionId: str
    scope: str = "project"
    answer: str | float | bool | None = None
    note: str | None = None


class CheckPresetRequest(BaseModel):
    doc: dict
    library: list[dict] = []


class NamesRequest(BaseModel):
    dictionaries: list[dict]


class CodeListBuildRequest(BaseModel):
    rows: list[list[str]]
    headerRow: int = 0
    mapping: dict
    hierarchy: str = "separator"
    separator: str | None = None


class RunRequest(BaseModel):
    modelId: str
    ruleSet: str
    dictionaries: list[str] = []
    classifications: list[str] = []
    decisions: list[DecisionIn] = []


@app.get("/api/health")
def health():
    return {"ok": True, "version": __version__}


@app.get("/api/presets")
def list_presets():
    try:
        rs = presets.rule_sets()
        ds = presets.dictionaries()
        cs = presets.classifications()
    except ValueError as e:
        raise HTTPException(500, str(e))
    return {
        "ruleSets": [{"id": r["id"], "name": r["name"], "description": (r.get("meta") or {}).get("description"),
                      "extends": r.get("extends")} for r in rs.values()],
        "dictionaries": [{"id": d["id"], "name": d["name"], "layer": d["layer"]} for d in ds.values()],
        "classifications": [{"id": c["id"], "name": (c["codeList"] or {}).get("name") or c["map"]["name"],
                             "available": c["available"], "reason": c["reason"]} for c in cs.values()],
        "terms": presets.terms(),
    }


@app.get("/api/presets/{kind}/{preset_id}")
def get_preset(kind: str, preset_id: str):
    if kind == "rules":
        lib = presets.rule_sets()
    elif kind == "dictionaries":
        lib = presets.dictionaries()
    elif kind == "classifications":
        c = presets.classifications().get(preset_id)
        if not c:
            raise HTTPException(404, "not found")
        return {"codeList": c["codeList"], "map": c["map"]}
    else:
        raise HTTPException(404, "unknown kind")
    if preset_id not in lib:
        raise HTTPException(404, "not found")
    return lib[preset_id]


@app.post("/api/presets/{kind}/check")
def check_preset(kind: str, req: CheckPresetRequest):
    if kind not in ("rules", "dictionaries", "classifications"):
        raise HTTPException(404, "unknown kind")
    try:
        problems = presets.check(kind, req.doc, req.library)
        flat = presets.flattened(req.doc, req.library) if kind == "rules" else None
    except ValueError as e:  # the bundled presets on disk are broken
        raise HTTPException(500, str(e))
    return {"ok": not problems, "problems": problems, "flattened": flat}


@app.post("/api/models")
def upload_model(file: UploadFile = File(...)):
    name = file.filename or "model.ifc"
    if not name.lower().endswith(".ifc"):
        raise HTTPException(400, "Only .ifc files are supported (not .ifczip / .ifcxml yet).")
    with tempfile.NamedTemporaryFile(delete=False, suffix=".ifc") as tmp:
        size = 0
        while chunk := file.file.read(1 << 20):
            size += len(chunk)
            if size > MAX_UPLOAD_MB * (1 << 20):
                raise HTTPException(413, f"File larger than {MAX_UPLOAD_MB} MB")
            tmp.write(chunk)
        tmp_path = Path(tmp.name)
    try:
        model_id, parsed, cached = store.put_model(tmp_path, name)
    except Exception as e:  # parsing errors are user-facing
        raise HTTPException(422, f"Could not parse IFC: {e}")
    finally:
        tmp_path.unlink(missing_ok=True)
    return service.model_summary(model_id, parsed, cached)


@app.get("/api/models/{model_id}")
def get_model(model_id: str):
    try:
        return service.model_summary(model_id, store.get_parsed(model_id), True)
    except (KeyError, ValueError):
        raise HTTPException(404, "Model not found. Upload it again.")


@app.post("/api/models/{model_id}/names")
def model_names(model_id: str, req: NamesRequest):
    for i, d in enumerate(req.dictionaries):
        try:
            presets.validate(d, "dictionaries", f"dictionary {d.get('id', i)}")
        except ValueError as e:
            raise HTTPException(400, str(e))
    try:
        parsed = store.get_parsed(model_id)
    except (KeyError, ValueError):
        raise HTTPException(404, "Model not found. Upload it again.")
    return {"names": pipeline.names_in_model(parsed, req.dictionaries, presets.resolution())}


def _glb_path(model_id: str) -> Path:
    try:
        p = store.model_dir(model_id) / "geometry.glb"
    except ValueError:
        raise HTTPException(404, "Model not found.")
    if not p.exists():
        raise HTTPException(404, "No geometry for this model. Upload it again.")
    return p


@app.get("/api/models/{model_id}/geometry.glb")
def model_geometry(model_id: str):
    return FileResponse(_glb_path(model_id), media_type="model/gltf-binary")


@app.get("/api/models/{model_id}/scene")
def model_scene(model_id: str):
    import json as _json
    import struct
    data = _glb_path(model_id).read_bytes()
    n = struct.unpack("<I", data[12:16])[0]                  # glb: header, then the JSON chunk
    mesh_ids = {x.get("name") for x in _json.loads(data[20:20 + n]).get("nodes", []) if "mesh" in x}
    try:
        parsed = store.get_parsed(model_id)
    except (KeyError, ValueError):
        raise HTTPException(404, "Model not found. Upload it again.")
    return service.model_scene(parsed, mesh_ids)


@app.post("/api/codelists/read")
def read_codelist_file(file: UploadFile = File(...)):
    data = file.file.read(MAX_UPLOAD_MB * (1 << 20) + 1)
    if len(data) > MAX_UPLOAD_MB * (1 << 20):
        raise HTTPException(413, f"File larger than {MAX_UPLOAD_MB} MB")
    try:
        return codelist_import.read_table(file.filename or "codes.csv", data)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:  # a corrupt or password-protected workbook
        raise HTTPException(400, f"Could not read the file: {e}")


@app.post("/api/codelists/build")
def build_codelist(req: CodeListBuildRequest):
    if req.mapping.get("code") is None or req.mapping.get("title") is None:
        raise HTTPException(400, "Choose the code column and the title column.")
    return codelist_import.build_codes(req.rows, req.headerRow, req.mapping, req.hierarchy, req.separator)


@app.post("/api/runs")
def create_run(req: RunRequest):
    try:
        run_id, result = service.run_and_store(req.modelId, req.model_dump())
    except KeyError:
        raise HTTPException(404, "Model not found. Upload it again.")
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"runId": run_id, "result": result, "xlsxUrl": f"/api/runs/{run_id}/boq.xlsx"}


@app.get("/api/runs/{run_id}/boq.xlsx")
def download(run_id: str):
    try:
        p = store.run_path(run_id, "xlsx")
    except ValueError:
        raise HTTPException(404, "not found")
    if not p.exists():
        raise HTTPException(404, "not found")
    return FileResponse(p, filename=f"boq-{run_id}.xlsx",
                        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
