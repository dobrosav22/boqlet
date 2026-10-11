"""
service.py - preset ids -> get_boq -> stored run. Shared by the API and the CLI.
"""
from __future__ import annotations

from datetime import datetime

from . import presets, store
from .export_xlsx import export
from .pipeline import get_boq


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


def run(parsed: dict, request: dict) -> tuple[dict, dict]:
    """request = RunRequest (preset ids). Returns (BoqResult, export meta)."""
    rule_set, lib = presets.load_rule_set(request.get("ruleSet") or presets.DEFAULTS["ruleSet"])
    dicts = [presets.load_dictionary(d) for d in (request.get("dictionaries") or presets.DEFAULTS["dictionaries"])]
    systems = [presets.load_classification(c) for c in (request.get("classifications") or [])]
    result = get_boq(parsed, rule_set, systems, dicts, presets.resolution(), request.get("decisions") or [], lib)
    meta = {
        "modelName": parsed["header"]["source"]["fileName"], "modelId": parsed["header"]["source"]["sha256"],
        "dictionaries": [f"{d['name']} ({d['layer']})" for d in dicts],
        "classifications": [{"id": cl["id"], "name": cl["name"]} for cl, _ in systems],
        "decisions": request.get("decisions") or [],
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
    }
    return result, meta


def run_and_store(model_id: str, request: dict) -> tuple[str, dict]:
    parsed = store.get_parsed(model_id)
    result, meta = run(parsed, request)
    run_id = store.save_run(request, result)
    store.run_path(run_id, "xlsx").write_bytes(export(result, meta))
    return run_id, result
