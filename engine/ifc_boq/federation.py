"""
federation.py - several models -> one set of measured elements, measured once (D43, D44).

Core engine: data in, data out. No files, no HTTP, no storage; the caller hands over each
model's measured elements and bounding boxes. One model is a federation of one.

Input, per model: {"id", "fileName", "discipline", "scope", "elements": [MeasuredElement],
"boxes": {guid: (min xyz, max xyz)}}, plus FederationSettings (engine.ts) and the answers to
earlier `overlap` questions.

  1. storeys      levels of different models within storeyTolerance are one level; the name
                  from an architecture model wins, else the most common one
  2. coordinates  models whose elements do not overlap in space at all: a warning (shared
                  coordinates are assumed; there is no alignment step yet)
  3. same GUID    one object in several models is kept once: the copy with a measurable body,
                  then the copy its model owns, then the first model. Parts of a dropped copy
                  are measured on their own (a structural roof's timber girders under the
                  architectural roof GUID)
  4. ownership    an element is taken from its model when the model's discipline owns it or
                  scope.include selects it; scope.exclude always drops it. An element its model
                  does not own is left to the owning model only if that model has an element of
                  the same IFC class in its place; otherwise it is taken here and a warning says so
                  (a hole avoided). A discipline the settings do not list owns everything.
  5. overlaps     taken elements of one IFC class from different models whose boxes overlap by
                  duplicateOverlap of the smaller box: one `overlap` question per pair of models
                  and IFC class. The answer names the model to keep, or "both". Unanswered,
                  both are kept and a warning flags a possible double count.

Overlap tests use axis-aligned boxes (the parsed model does not carry meshes); good enough for
copies of one object, loose for long diagonal elements.
"""
from __future__ import annotations

from collections import Counter, defaultdict

from .expr import fmt
from .log import CalcLog
from .rules import select

PAD = 0.005          # m added to every box side, so flat or touching elements still compare
COORD_MARGIN = 1.0   # m: models whose extents are further apart than this do not overlap


def model_key(models: list[dict], m: dict) -> str:
    """Stable name for a model in question ids and answers: its discipline, or its file name
    when two models share a discipline (model ids change with every new version)."""
    same = sum(1 for o in models if o["discipline"] == m["discipline"])
    return m["discipline"] if same == 1 else f"{m['discipline']}/{m['fileName']}"


def owned_by_discipline(settings: dict, discipline: str, el: dict, x) -> bool:
    discs = settings.get("disciplines", {})
    d = discs.get(discipline)
    if d is None:
        return True
    if d.get("rest"):
        return not any(any(select(s, el, x) for s in o.get("owns", []))
                       for name, o in discs.items() if name != discipline and not o.get("rest"))
    return any(select(s, el, x) for s in d.get("owns", []))


def ratio(a, b) -> float:
    """Overlap of two boxes as a share of the smaller one (boxes padded by PAD)."""
    inter, va, vb = 1.0, 1.0, 1.0
    for i in range(3):
        alo, ahi, blo, bhi = a[0][i] - PAD, a[1][i] + PAD, b[0][i] - PAD, b[1][i] + PAD
        d = min(ahi, bhi) - max(alo, blo)
        if d <= 0:
            return 0.0
        inter *= d
        va *= ahi - alo
        vb *= bhi - blo
    return inter / min(va, vb)


class _Index:
    """Boxes of one model and IFC class, sorted by min x, for nearby-candidate lookups."""

    def __init__(self, items: list[tuple[str, tuple]]):
        self.items = sorted(items, key=lambda it: it[1][0][0])

    def near(self, box):
        for g, b in self.items:
            if b[0][0] - PAD > box[1][0] + PAD:
                break
            if b[1][0] + PAD >= box[0][0] - PAD:
                yield g, b


def combine(models: list[dict], settings: dict, x, log: CalcLog, answers: dict | None = None):
    """Returns (elements, reports, questions, warnings)."""
    answers = answers or {}
    questions: list[dict] = []
    warnings: list[dict] = []
    reports = {m["id"]: {"id": m["id"], "fileName": m["fileName"], "discipline": m["discipline"],
                         "elements": len(m["elements"]), "taken": 0, "leftToOthers": 0, "excludedByScope": 0,
                         "duplicates": 0, "takenWithoutOwner": 0} for m in models}
    by_id = {m["id"]: m for m in models}
    keys = {m["id"]: model_key(models, m) for m in models}
    federated = len(models) > 1
    if federated:
        log.info("match", "federation: " + "; ".join(f"{m['fileName']} as {m['discipline']} ({len(m['elements'])} elements)"
                                                     for m in models))
        _storeys(models, settings, log, warnings)
        _coordinates(models, log, warnings)

    # 3. same GUID in several models ---------------------------------------------------
    copies = defaultdict(list)
    for m in models:
        for e in m["elements"]:
            copies[e["guid"]].append((m, e))
    keep_copy: dict[str, str] = {}             # guid -> model id kept
    for g, cs in copies.items():
        if len(cs) == 1:
            continue
        def score(me):
            m, e = me
            body = any(e.get(k) is not None for k in ("net_volume", "net_area", "length")) or bool(e.get("child_guids"))
            return (body, owned_by_discipline(settings, m["discipline"], e, x), -models.index(m))
        best = max(cs, key=score)
        keep_copy[g] = best[0]["id"]
        dropped = [m for m, _ in cs if m is not best[0]]
        for m in dropped:
            reports[m["id"]]["duplicates"] += 1
        log.detail("match", f"{best[1].get('name') or g}: same GlobalId in {len(cs)} models; kept from "
                            f"{best[0]['fileName']}, dropped from {', '.join(m['fileName'] for m in dropped)}", guid=g)

    # 4. ownership ------------------------------------------------------------------------
    index: dict[tuple, _Index] = {}
    for m in models:
        groups = defaultdict(list)
        for e in m["elements"]:
            if e["guid"] in m["boxes"]:
                groups[e["ifc_class"]].append((e["guid"], m["boxes"][e["guid"]]))
        for cls, items in groups.items():
            index[(m["id"], cls)] = _Index(items)

    def counterpart(owner: dict, e: dict, box) -> str | None:
        idx = index.get((owner["id"], e["ifc_class"]))
        if idx is None or box is None:
            return None
        return next((g for g, b in idx.near(box) if ratio(box, b) >= settings.get("duplicateOverlap", 0.5)), None)

    taken: list[tuple[dict, dict]] = []
    holes = defaultdict(list)
    for m in models:
        scope = m.get("scope") or {}
        for e in m["elements"]:
            g = e["guid"]
            if g in keep_copy and keep_copy[g] != m["id"]:
                continue
            if any(select(s, e, x) for s in scope.get("exclude", [])):
                reports[m["id"]]["excludedByScope"] += 1
                log.detail("match", f"{e.get('name') or g}: excluded by the scope of {m['fileName']}", guid=g)
                continue
            own = owned_by_discipline(settings, m["discipline"], e, x) or any(select(s, e, x) for s in scope.get("include", []))
            if own or g in keep_copy or not federated:
                taken.append((m, e))
                continue
            owners = [o for o in models if o is not m and owned_by_discipline(settings, o["discipline"], e, x)]
            box = m["boxes"].get(g)
            hit = next(((o, c) for o in owners for c in [counterpart(o, e, box)] if c), None)
            if hit:
                reports[m["id"]]["leftToOthers"] += 1
                log.detail("match", f"{e.get('name') or g} ({e['ifc_class']}): left to {hit[0]['fileName']} "
                                    f"({hit[0]['discipline']}), which has it as {hit[1]}", guid=g)
                continue
            taken.append((m, e))
            if owners:
                reports[m["id"]]["takenWithoutOwner"] += 1
                holes[(m["id"], e["ifc_class"], tuple(o["discipline"] for o in owners))].append(g)
    for (mid, cls, owner_discs), guids in sorted(holes.items()):
        msg = (f"{len(guids)} {cls} taken from {by_id[mid]['fileName']} ({by_id[mid]['discipline']}): "
               f"{' / '.join(owner_discs)} owns them, but its model has nothing in their place.")
        warnings.append({"code": "federation_hole", "message": msg, "guids": guids})
        log.warn("match", msg)

    # parts of a dropped copy have no parent in the combined set: measure them on their own
    kept_guids = {e["guid"] for _, e in taken}
    for m, e in taken:
        p = e.get("parent_guid")
        if p and p in keep_copy and keep_copy[p] != m["id"]:
            log.detail("match", f"{e.get('name') or e['guid']}: its parent {p} was kept from "
                                f"{by_id[keep_copy[p]]['fileName']}; measured on its own", guid=e["guid"])
            e["parent_guid"] = None
        elif p and p not in kept_guids:
            e["parent_guid"] = None

    # 5. overlaps between models -------------------------------------------------------------
    if federated:
        taken = _overlaps(taken, keys, by_id, settings, answers, questions, warnings, log)

    for m, _ in taken:
        reports[m["id"]]["taken"] += 1
    if federated:
        for r in reports.values():
            log.info("match", f"{r['fileName']} ({r['discipline']}): {r['taken']} of {r['elements']} elements taken"
                              + "".join(f", {n} {label}" for n, label in (
                                  (r["leftToOthers"], "left to other models"), (r["duplicates"], "duplicate GlobalIds"),
                                  (r["excludedByScope"], "excluded by scope"),
                                  (r["takenWithoutOwner"], "taken although another discipline owns them")) if n))
    return [e for _, e in taken], [reports[m["id"]] for m in models], questions, warnings


def _storeys(models, settings, log, warnings):
    tol = settings.get("storeyTolerance", 0.25)
    levels = []                                         # (elevation, name, model)
    for m in models:
        seen = {}
        for e in m["elements"]:
            if e.get("storey") is not None and e.get("storey_elevation") is not None:
                seen[e["storey"]] = e["storey_elevation"]
        levels += [(z, n, m) for n, z in seen.items()]
    levels.sort(key=lambda t: t[0])
    clusters, cur = [], []
    for lv in levels:
        if cur and lv[0] - cur[0][0] > tol:
            clusters.append(cur)
            cur = []
        cur.append(lv)
    if cur:
        clusters.append(cur)
    rename = {}                                          # (model id, name) -> (name, elevation)
    for c in clusters:
        arch = [lv for lv in c if lv[2]["discipline"] == "architecture"]
        name = (arch[0][1] if arch else Counter(lv[1] for lv in c).most_common(1)[0][0])
        z = next(lv[0] for lv in c if lv[1] == name)
        for lv in c:
            rename[(lv[2]["id"], lv[1])] = (name, z)
            if lv[1] != name:
                log.info("match", f"storey '{lv[1]}' ({fmt(lv[0])} m) of {lv[2]['fileName']} is '{name}' ({fmt(z)} m)")
    names = defaultdict(set)
    for (mid, n), (canon, _) in rename.items():
        names[n].add(canon)
    for n, canon in names.items():
        if len(canon) > 1:
            msg = f"storey name '{n}' is used at different levels in different models ({', '.join(sorted(canon))})"
            warnings.append({"code": "federation_storeys", "message": msg})
            log.warn("match", msg)
    for m in models:
        for e in m["elements"]:
            r = rename.get((m["id"], e.get("storey")))
            if r:
                e["storey"], e["storey_elevation"] = r


def _coordinates(models, log, warnings):
    ext = {}
    for m in models:
        bs = list(m["boxes"].values())
        if bs:
            ext[m["id"]] = ([min(b[0][i] for b in bs) for i in range(3)], [max(b[1][i] for b in bs) for i in range(3)])
    ids = list(ext)
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            A, B = ext[a], ext[b]
            if any(min(A[1][k], B[1][k]) + COORD_MARGIN < max(A[0][k], B[0][k]) for k in range(3)):
                ma = next(m for m in models if m["id"] == a)
                mb = next(m for m in models if m["id"] == b)
                msg = (f"{ma['fileName']} and {mb['fileName']} do not overlap in space: different coordinate systems? "
                       f"Duplicates and overlaps between them cannot be found.")
                warnings.append({"code": "federation_coordinates", "message": msg})
                log.warn("match", msg)


def _overlaps(taken, keys, by_id, settings, answers, questions, warnings, log):
    thr = settings.get("duplicateOverlap", 0.5)
    groups = defaultdict(list)
    for m, e in taken:
        if e["guid"] in m["boxes"]:
            groups[e["ifc_class"]].append((m, e, m["boxes"][e["guid"]]))
    pairs = defaultdict(list)                            # (key a, key b, class) -> [(ea, eb)]
    for cls_, items in groups.items():
        items.sort(key=lambda t: t[2][0][0])
        for i, (ma, ea, ba) in enumerate(items):
            for mb, eb, bb in items[i + 1:]:
                if bb[0][0] - PAD > ba[1][0] + PAD:
                    break
                if ma is mb or ratio(ba, bb) < thr:
                    continue
                ka, kb = sorted([keys[ma["id"]], keys[mb["id"]]])
                first, second = (ea, eb) if keys[ma["id"]] == ka else (eb, ea)
                pairs[(ka, kb, ea["ifc_class"])].append((first, second))
    drop = set()
    for (ka, kb, cls), ps in sorted(pairs.items()):
        qid = f"overlap:{ka}|{kb}:{cls}"
        guids = sorted({e["guid"] for p in ps for e in p})
        ans = answers.get(qid)
        if ans in (ka, kb):
            lose = 1 if ans == ka else 0
            drop |= {p[lose]["guid"] for p in ps}
            log.info("decision", f"overlap {ka} / {kb} on {len(ps)} {cls}: kept from {ans}")
            continue
        if ans == "both":
            log.info("decision", f"overlap {ka} / {kb} on {len(ps)} {cls}: both kept (answer)")
            continue
        msg = (f"{len(ps)} {cls} appear in both the {ka} and the {kb} model (boxes overlap by {int(thr * 100)}% or more). "
               f"Which model should provide them?")
        questions.append({"id": qid, "kind": "overlap", "blocking": False, "guids": guids, "occurrences": len(ps),
                          "message": msg, "suggestion": "both",
                          "answer": {"kind": "choice", "options": [
                              {"value": ka, "label": f"Take them from {ka}"}, {"value": kb, "label": f"Take them from {kb}"},
                              {"value": "both", "label": "Keep both (they are different objects)"}]}})
        warnings.append({"code": "federation_overlap", "message": f"{len(ps)} {cls} may be counted twice ({ka} and {kb}).",
                         "guids": guids})
        log.warn("match", msg)
    return [(m, e) for m, e in taken if e["guid"] not in drop]
