"""Vercel entry point: the engine's API (engine/ifc_boq/api.py) as one Python function.

Used only by the demo deployment (vercel.json, docs/17). Locally the engine runs with
`npm run dev` and never loads this file.

A Vercel function can only write to /tmp, and /tmp belongs to one instance: parsed models, runs and
Library saves live there until the instance is recycled (a few minutes without traffic). The web
app re-uploads a model the engine no longer has; Library saves are temporary in this deployment.
"""
import os
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))

os.environ.setdefault("IFC_BOQ_CACHE", "/tmp/ifc-boq/cache")
os.environ.setdefault("IFC_BOQ_USER_PRESETS", "/tmp/ifc-boq/presets-user")
# Vercel refuses request bodies over 4.5 MB before they reach the function.
os.environ.setdefault("IFC_BOQ_MAX_UPLOAD_MB", "5")

from ifc_boq.api import app as engine  # noqa: E402


async def app(scope, receive, send):
    """The engine, with the path the browser asked for.

    vercel.json rewrites /api/<path> to this function and passes <path> as `__path`. If the platform
    hands the function its own path (/api/index), the original one is put back; `__path` is always
    removed so the engine never sees it.
    """
    if scope["type"] == "http":
        query = parse_qsl(scope.get("query_string", b"").decode("latin-1"), keep_blank_values=True)
        original = next((v for k, v in query if k == "__path"), None)
        if original is not None:
            scope = dict(scope, query_string=urlencode([(k, v) for k, v in query if k != "__path"]).encode("latin-1"))
            if scope["path"].rstrip("/") in ("/api", "/api/index"):
                path = "/api/" + original.lstrip("/")
                scope.update(path=path, raw_path=path.encode())
    await engine(scope, receive, send)
