"""log.py - the calculation log (LogEntry in packages/types/src/engine.ts)."""
from __future__ import annotations


class CalcLog:
    def __init__(self):
        self.entries: list[dict] = []

    def add(self, stage: str, message: str, level: str = "info", **kw) -> None:
        e = {"seq": len(self.entries) + 1, "stage": stage, "level": level, "message": message}
        for k in ("ruleId", "lineKey", "guid", "data"):
            if kw.get(k) is not None:
                e[k] = kw[k]
        self.entries.append(e)

    def info(self, stage, message, **kw):
        self.add(stage, message, "info", **kw)

    def detail(self, stage, message, **kw):
        self.add(stage, message, "detail", **kw)

    def warn(self, stage, message, **kw):
        self.add(stage, message, "warning", **kw)
