"""
federation.py - several models -> one set of measured elements, measured once (D43, D44).

Core engine: data in, data out. No files, no HTTP, no storage; the caller hands over each
model's measured elements and bounding boxes. One model is a federation of one.

Input, per model: {"id", "fileName", "discipline", "scope", "elements": [MeasuredElement],
"boxes": {guid: (min xyz, max xyz)}, "parsed": ParsedModel, "meshes": {guid: mesh} or None (the
mesh sidecar, geometry.py)}, plus FederationSettings (engine.ts) and the answers to earlier
`overlap` questions.

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
  5. overlaps     taken elements of one IFC class from different models that overlap by
                  duplicateOverlap of the smaller one: one `overlap` question per pair of models
                  and IFC class. The answer names the model to keep, or "both". Unanswered,
                  both are kept and a warning flags a possible double count.
  6. aggregates   an aggregate (a roof made of slabs) some of whose parts were left to another
                  model or excluded loses those parts, and its rolled-up quantities are summed
                  again from the parts kept; one with no part left is left to the other models
  7. links        (link) what one model's elements mean for another's:
                  - a door or window whose host is not taken (left to the structural model, or
                    never hosted) fills the unfilled opening of a taken element in the same place
                  - rooms lie on walls and slabs of other models (faces with the room, room
                    openings, net wall area and skirting from the walls actually taken)
                  - columns and beams of one model passing through walls and slabs of another
                    become `embedded` there

"Overlap" (steps 4 and 5) is the share of the smaller solid inside the other, from the meshes
when both models have the mesh sidecar and both solids are closed; else the share of the smaller
axis-aligned box (loose for long diagonal elements). Rooms across models and embedded elements
across models need the meshes; without them they are skipped and the log says so.
"""
from __future__ import annotations

from collections import Counter, defaultdict

from . import geometry
from .expr import fmt
from .log import CalcLog
from .measure import (PLANAR_VERTICAL, add_embedded, facing_openings, opening_record, roll_up_parts,
                      set_room_openings, side_faces)
from .rules import select

PAD = 0.005          # m added to every box side, so flat or touching elements still compare
COORD_MARGIN = 1.0   # m: models whose extents are further apart than this do not overlap
BOX_PREFILTER = 0.02  # box overlap below this share: the solids are not compared
FILL_OVERLAP = 0.5   # a door's box inside an opening's box by this share of the smaller: it fills it
HOSTED = ("IfcDoor", "IfcWindow")


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


class _Solids:
    """Overlap of two elements of different models: solids when both meshes are there and closed,
    else boxes. Counts which test decided, for the log."""

    def __init__(self, models: list[dict]):
        self.closed = {}
        for m in models:
            self.closed[m["id"]] = {e["id"] for e in m["parsed"]["elements"]
                                    if e["quantities"]["geometry"].get("closed", e["quantities"]["geometry"].get("watertight"))}
        self.by_mesh = self.by_box = 0

    def mesh(self, m: dict, g: str):
        ms = m.get("meshes")
        return ms.get(g) if ms and g in self.closed[m["id"]] else None

    def ratio(self, ma: dict, ga: str, mb: dict, gb: str) -> float:
        r = ratio(ma["boxes"][ga], mb["boxes"][gb])
        if r < BOX_PREFILTER:
            return r
        a, b = self.mesh(ma, ga), self.mesh(mb, gb)
        small = min(abs(a.volume), abs(b.volume)) if a is not None and b is not None else 0
        v = geometry.shared_volume(a, b) if small > 1e-9 else None
        if v is None:
            self.by_box += 1
            return r
        self.by_mesh += 1
        return v / small


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
    solids = _Solids(models)
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

    def counterpart(owner: dict, m: dict, e: dict, box) -> str | None:
        idx = index.get((owner["id"], e["ifc_class"]))
        if idx is None or box is None:
            return None
        return next((g for g, b in idx.near(box)
                     if solids.ratio(m, e["guid"], owner, g) >= settings.get("duplicateOverlap", 0.5)), None)

    taken: list[tuple[dict, dict]] = []
    holes = defaultdict(list)
    for m in models:
        scope = m.get("scope") or {}
        mine = {e["guid"]: e for e in m["elements"]}

        def whole_owned(e, depth=0):
            """A part of an aggregate this model owns (a curtain wall's mullions, a stair's stringers)."""
            p = mine.get(e.get("parent_guid"))
            return p is not None and depth < 20 and (owned_by_discipline(settings, m["discipline"], p, x)
                                                     or whole_owned(p, depth + 1))
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
            hit = next(((o, c) for o in owners for c in [counterpart(o, m, e, box)] if c), None)
            if hit:
                reports[m["id"]]["leftToOthers"] += 1
                log.detail("match", f"{e.get('name') or g} ({e['ifc_class']}): left to {hit[0]['fileName']} "
                                    f"({hit[0]['discipline']}), which has it as {hit[1]}", guid=g)
                continue
            taken.append((m, e))
            if owners and whole_owned(e):
                log.detail("match", f"{e.get('name') or g} ({e['ifc_class']}): taken with the aggregate it is part of", guid=g)
            elif owners:
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
        taken = _overlaps(taken, keys, by_id, settings, answers, questions, warnings, log, solids)
        if solids.by_mesh or solids.by_box:
            log.info("match", f"overlap tests between models: {solids.by_mesh} by solid intersection"
                              + (f", {solids.by_box} by bounding boxes (no closed mesh)" if solids.by_box else ""))

    # 6. aggregates that lost parts ------------------------------------------------------------
    if federated:
        taken = _reroll(taken, models, reports, log)
        link([e for _, e in taken], models, log, warnings)

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


def _overlaps(taken, keys, by_id, settings, answers, questions, warnings, log, solids):
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
                if ma is mb or solids.ratio(ma, ea["guid"], mb, eb["guid"]) < thr:
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
        msg = (f"{len(ps)} {cls} appear in both the {ka} and the {kb} model (overlapping by {int(thr * 100)}% or more). "
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


def _reroll(taken, models, reports, log):
    """Step 6: aggregates whose parts were left to other models, excluded or dropped."""
    kept = {e["guid"] for _, e in taken}
    own = {m["id"]: {e["guid"] for e in m["elements"]} for m in models}
    has_body = {e["guid"] for m, e in taken for pe in [_parsed_index(m).get(e["guid"])]
                if pe and pe["quantities"]["geometry"].get("hasBody")}
    changed, emptied = set(), set()
    for m, e in taken:
        gone = [c for c in e.get("child_guids", []) if c in own[m["id"]] and c not in kept]
        if not gone:
            continue
        e["child_guids"] = [c for c in e["child_guids"] if c not in gone]
        if e["guid"] in has_body:
            continue
        if not e["child_guids"]:
            emptied.add(e["guid"])
            reports[m["id"]]["leftToOthers"] += 1
            log.detail("match", f"{e.get('name') or e['guid']} ({e['ifc_class']}): all {len(gone)} of its parts are measured "
                                f"elsewhere or excluded; left to the other models", guid=e["guid"])
            continue
        changed.add(e["guid"])
        if e["provenance"].get("net_volume") == "derived":
            e["net_volume"] = e["gross_volume"] = None
        if e["provenance"].get("net_area") == "derived":
            e["net_area"] = e["gross_area"] = e["footprint_area"] = e["developed_area"] = None
            e["faces"] = []
        log.detail("match", f"{e.get('name') or e['guid']} ({e['ifc_class']}): {len(gone)} of its parts are measured "
                            f"elsewhere or excluded; its quantities are summed again from the {len(e['child_guids'])} kept",
                   guid=e["guid"])
    if changed:
        roll_up_parts([e for _, e in taken], has_body, log, only=changed)
        log.info("match", f"{len(changed)} aggregate(s) re-summed from the parts kept after federation")
    return [(m, e) for m, e in taken if e["guid"] not in emptied]


def _parsed_index(m: dict) -> dict:
    if "_parsed_index" not in m:
        m["_parsed_index"] = {e["id"]: e for e in m["parsed"]["elements"]}
    return m["_parsed_index"]


def link(taken: list[dict], models: list[dict], log: CalcLog, warnings: list[dict]):
    """Step 7, on the combined elements (each carries model_id): fillings to hosts, rooms to the
    elements they lie on, elements passing through others, across models."""
    by_id = {m["id"]: m for m in models}
    tk = {e["guid"]: e for e in taken}
    model_of = {e["guid"]: by_id.get(e.get("model_id")) for e in taken}
    fills = _fill_openings(taken, tk, model_of, models, log, warnings)
    no_mesh = [m["fileName"] for m in models if not m.get("meshes")]
    if no_mesh:
        log.warn("match", f"no meshes for {', '.join(no_mesh)}: rooms on other models' walls and elements passing "
                          f"through other models' elements are not linked")
    _rooms_across(taken, tk, model_of, fills, log)
    _embedded_across(taken, tk, model_of, log)


def _fill_openings(taken, tk, model_of, models, log, warnings) -> dict[str, dict]:
    """Doors and windows whose host is not taken -> the unfilled opening of another model's taken
    element in the same place. Returns {opening guid: filling element}."""
    fills: dict[str, dict] = {}                                  # opening guid -> filling element
    openings = []                                                 # (host element, parsed opening)
    for e in taken:
        m = model_of[e["guid"]]
        if m is None or not e.get("openings"):
            continue
        for o in m["parsed"]["openings"]:
            if o.get("hostId") == e["guid"] and o.get("bboxMin"):
                openings.append((e, o))
    # hosts left to another model, and fillings never hosted that are not part of an aggregate
    # (a curtain wall's doors); only the first are a problem when nothing is found
    stray = [e for e in taken if e["ifc_class"] in HOSTED and e.get("host_guid") not in tk
             and (e.get("host_guid") or not e.get("parent_guid"))
             and model_of[e["guid"]] is not None and e["guid"] in model_of[e["guid"]]["boxes"]]
    matched, unhosted = 0, []
    for d in stray:
        box = model_of[d["guid"]]["boxes"][d["guid"]]
        best = max(((ratio(box, (o["bboxMin"], o["bboxMax"])), h, o) for h, o in openings
                    if (not o.get("fillingId") or o["fillingId"] not in tk) and o["id"] not in fills
                    and model_of[h["guid"]] is not model_of[d["guid"]]), default=None, key=lambda t: t[0])
        if best is None or best[0] < FILL_OVERLAP:
            if d.get("host_guid"):
                unhosted.append(d["guid"])
            continue
        _, h, o = best
        fills[o["id"]] = d
        old = d.get("host_guid")
        d["host_guid"] = h["guid"]
        rec = opening_record({**o, "fillingId": d["guid"], "fillingClass": d["ifc_class"]}, h.get("thickness"))
        h["openings"] = [rec if x.get("guid") == o["id"] else x for x in h["openings"]]
        matched += 1
        log.detail("match", f"{d.get('name') or d['guid']} ({d['ifc_class']}, {model_of[d['guid']]['fileName']}) fills opening "
                            f"{o['id']} of {h.get('name') or h['guid']} ({model_of[h['guid']]['fileName']})"
                            + (f"; its own host {old} is not taken" if old else ""), guid=d["guid"])
    if matched:
        log.info("match", f"{matched} door(s) / window(s) placed in openings of another model's elements")
    if unhosted:
        msg = (f"{len(unhosted)} door(s) / window(s) lost their host to another model, which has no opening in "
               f"their place (the wall may be uncut in the model that provides it)")
        warnings.append({"code": "federation_unhosted", "message": msg, "guids": unhosted})
        log.warn("match", msg)
    return fills


def _rooms_across(taken, tk, model_of, fills, log):
    rooms = [e for e in taken if e["family"] == "space"]
    if not rooms:
        return
    names = {r["guid"]: (r.get("type_name") or r.get("name"), r.get("space_type")) for r in rooms}
    solids = defaultdict(dict)                                   # model id -> {space id: room index}
    for r in rooms:
        m = model_of[r["guid"]]
        mesh = (m.get("meshes") or {}).get(r["guid"]) if m else None
        if mesh is not None:
            solids[m["id"]][r["guid"]] = geometry.room_index(mesh)
    linked = 0
    if solids:
        for e in taken:
            m = model_of[e["guid"]]
            if m is None or not m.get("meshes") or e["guid"] not in m["meshes"]:
                continue
            pe = _parsed_index(m).get(e["guid"])
            g = pe["quantities"]["geometry"] if pe else {}
            if not g.get("sides") or not g.get("obbAxes") or e.get("net_area") is None:
                continue
            others = {sid: ix for mid, rs in solids.items() if mid != m["id"] for sid, ix in rs.items()}
            if not others:
                continue
            new = geometry.side_contacts(m["meshes"][e["guid"]], g["sides"]["axis"], g["obbAxes"], others)
            if not new:
                continue
            contacts = [c for c in g.get("contacts", []) if c["spaceId"] in tk] + new
            labels = ("a", "b") if e["ifc_class"] in PLANAR_VERTICAL else ("top", "bottom")
            e["faces"] = side_faces(g["sides"], contacts, labels, sum(o["area"] or 0 for o in e.get("openings", [])),
                                    names, e.get("is_external"))
            e["spaces"] = sorted(set(e.get("spaces") or []) | {c["spaceId"] for c in new})
            linked += 1
            log.detail("match", f"{e.get('name') or e['guid']} ({m['fileName']}): "
                                + ", ".join(f"{names[c['spaceId']][0] or c['spaceId']} on side {c['side']} {fmt(round(c['area'], 3))} m2"
                                            for c in new), guid=e["guid"])
    if linked:
        log.info("match", f"{linked} element(s) bound rooms of another model")
    # every room: bounded by the elements taken, openings in those elements
    bounding = defaultdict(set)
    for e in taken:
        for f in e.get("faces", []):
            if f.get("space") in names:
                bounding[f["space"]].add(e["guid"])
    for r in rooms:
        m = model_of[r["guid"]]
        sp = next((s for s in m["parsed"]["spatial"] if s["id"] == r["guid"]), {}) if m else {}
        r["bounded_by"] = sorted(bounding.get(r["guid"], ()))
        ops = []
        for h in r["bounded_by"]:
            hm = model_of[h]
            for o in (hm["parsed"]["openings"] if hm else []):
                if o.get("hostId") == h:
                    d = fills.get(o["id"])
                    ops.append({**o, "fillingId": d["guid"], "fillingClass": d["ifc_class"]} if d else o)
        set_room_openings(r, facing_openings(sp.get("geometry") or {}, ops))


def _embedded_across(taken, tk, model_of, log):
    for e in taken:                                              # what passes through it may have been dropped
        if e.get("embedded"):
            e["embedded"] = [x for x in e["embedded"] if x["guid"] in tk] or None
            if e["embedded"] is None:
                del e["embedded"]

    def solid(e):
        m = model_of[e["guid"]]
        return (m.get("meshes") or {}).get(e["guid"]) if m else None
    hosts = [e for e in taken if e["family"] in ("planar", "space") and solid(e) is not None]   # rooms: columns in them
    rods = sorted((e for e in taken if e["family"] == "linear" and solid(e) is not None),
                  key=lambda e: solid(e).bounds[0][0])
    found = 0
    for h in hosts:
        H = solid(h)
        for r in rods:
            R = solid(r)
            if R.bounds[0][0] > H.bounds[1][0]:
                break
            if model_of[r["guid"]] is model_of[h["guid"]] or R.bounds[1][0] < H.bounds[0][0]:
                continue
            v = geometry.shared_volume(H, R)
            if v and v > geometry.SHARED_MIN and add_embedded(h, r, v, model=r.get("model_id")):
                found += 1
                log.detail("match", f"{r.get('name') or r['guid']} ({r['ifc_class']}, {model_of[r['guid']]['fileName']}) passes "
                                    f"through {h.get('name') or h['guid']} ({model_of[h['guid']]['fileName']}): "
                                    f"{fmt(round(v, 4))} m3 shared", guid=h["guid"])
    if found:
        log.info("match", f"{found} element(s) pass through elements of another model (embedded)")
