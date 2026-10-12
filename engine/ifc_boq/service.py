"""
service.py - preset ids -> get_boq -> stored run. Shared by the API and the CLI.
"""
from __future__ import annotations

from datetime import datetime

from . import presets, store
from .export_xlsx import export
from .pipeline import get_boq


def model_scene(parsed: dict, mesh_ids: set[str]) -> dict:
    """What the 3D viewer needs to connect geometry.glb to BoQ lines (SceneIndex in api.ts).

    `parts` are the mesh nodes that draw an element: itself, or for aggregates without their own
    body (a roof, a stair) the meshes of their parts, recursively."""
    els = {e["id"]: e for e in parsed["elements"]}
    storeys = {s["id"]: s.get("name") for s in parsed["spatial"] if s["kind"] == "storey"}

    def parts(eid: str, depth: int = 0) -> list[str]:
        if eid in mesh_ids:
            return [eid]
        if depth > 10:
            return []
        return [p for c in els.get(eid, {}).get("childIds", []) for p in parts(c, depth + 1)]

    return {
        "elements": {i: {k: v for k, v in {
            "ifcClass": e["ifcClassBase"], "name": e.get("name"), "type": e.get("objectType"),
            "storey": storeys.get(e.get("storeyId")), "parent": e.get("parentId"), "parts": parts(i),
        }.items() if v not in (None, [])} for i, e in els.items()},
        "spaces": [s["id"] for s in parsed["spatial"] if s["kind"] == "space" and s["id"] in mesh_ids],
        "openings": [o["id"] for o in parsed.get("openings", []) if o["id"] in mesh_ids],
    }


def model_summary(model_id: str, parsed: dict, cached: bool) -> dict:
    h, st = parsed["header"], parsed["stats"]
    return {
        "modelId": model_id, "fileName": h["source"]["fileName"], "sizeBytes": h["source"]["sizeBytes"],
        "ifcSchema": h["ifcSchema"], "authoringApp": (h.get("authoringApp") or {}).get("fullName"),
        "disciplineGuess": h.get("disciplineGuess"),
        "storeys": sorted(({"name": s.get("name"), "elevation": s.get("elevation")} for s in parsed["spatial"] if s["kind"] == "storey"),
                          key=lambda s: s.get("elevation") or 0),
        "elementCount": st["elementCount"], "openingCount": st["openingCount"], "spaceCount": st["spaceCount"],
        "byClass": st["byClass"], "checks": parsed["verification"]["summary"], "parseMs": h["parse"]["durationMs"],
        "cached": cached,
    }


def run(models, request: dict) -> tuple[dict, dict]:
    """models: one ParsedModel, or [{"id", "parsed", "discipline"?, "scope"?}] (federation).
    request = RunRequest (preset ids). Returns (BoqResult, export meta)."""
    rule_set, lib = presets.load_rule_set(request.get("ruleSet") or presets.DEFAULTS["ruleSet"])
    dicts = [presets.load_dictionary(d) for d in (request.get("dictionaries") or presets.DEFAULTS["dictionaries"])]
    systems = [presets.load_classification(c) for c in (request.get("classifications") or [])]
    result = get_boq(models, rule_set, systems, dicts, presets.resolution(), request.get("decisions") or [], lib,
                     federation=presets.federation())
    parsed_list = [models] if isinstance(models, dict) else [m["parsed"] for m in models]
    meta = {
        "modelName": " + ".join(p["header"]["source"]["fileName"] for p in parsed_list),
        "modelId": ", ".join(p["header"]["source"]["sha256"] for p in parsed_list),
        "dictionaries": [f"{d['name']} ({d['layer']})" for d in dicts],
        "classifications": [{"id": cl["id"], "name": cl["name"]} for cl, _ in systems],
        "decisions": request.get("decisions") or [],
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
    }
    return result, meta


def run_and_store(request: dict) -> tuple[str, dict]:
    """Dev server: the stored models a RunRequest names (`models`, or the single `modelId`)."""
    wanted = request.get("models") or ([{"modelId": request["modelId"]}] if request.get("modelId") else [])
    if not wanted:
        raise ValueError("No model in the request: give modelId or models.")
    models = [{"id": m["modelId"], "parsed": store.get_parsed(m["modelId"]),
               **({"discipline": m["discipline"]} if m.get("discipline") else {}),
               **({"scope": m["scope"]} if m.get("scope") else {})} for m in wanted]
    result, meta = run(models, request)
    run_id = store.save_run(request, result)
    store.run_path(run_id, "xlsx").write_bytes(export(result, meta))
    return run_id, result
