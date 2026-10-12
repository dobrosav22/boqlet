"""
measure.py - ParsedModel + dictionaries -> MeasuredElement[]  (packages/types/src/measured.ts)

This is where the engine decides WHICH number to trust for each element. It never
looks at rules. Rules only consume what is measured here.

Adoption policy (v0, constants below; documented in docs/05-engine.md):
  volume      reported (IFC BaseQuantities, then authoring-tool sets, see
              data/quantity_sources.json) when present, else geometry. If both exist and
              differ beyond TOLERANCE the reported value is still used (it is usually
              join-aware, see the Duplex party wall) and a warning is logged.
              Geometry volume is used only from a closed mesh (watertight, or closed with
              T-junctions, see parse.closed_surface).
  thickness   material layer set total, else reported, else smallest extent of the
              oriented bounding box (world axes would give a rotated wall's diagonal).
  wall area   net_volume / thickness  (keeps area, volume and layers consistent;
              authoring-tool "Area" is often inconsistent), else reported area.
  other area  reported area, else net_volume / thickness, else (open surface models
              such as road markings) the one-sided mesh area.
  gross       net + area of the openings hosted by the element.
  length      reported, else the oriented box: columns and piles along the most vertical
              axis, other linear elements the longest extent (sloped and rotated members),
              others the longest horizontal extent.
  aggregates  an element without its own body (a roof made of slabs) takes the sum of
              its parts' adopted volume and planar area.
  class       IFC2x3 generic distribution occurrences take the class their type names
              (IfcFlowSegment + IfcDuctSegmentType -> IfcDuctSegment).
  family      the nearest listed class up the schema's supertypes (families.ts).
  discipline  "mep" for distribution elements, else the model's discipline guess.
  height      door/window OverallHeight, else reported, else vertical geometry extent.
  faces       walls: side a and b, each = main area (v0 approximation; no per-face
              geometry yet). Slabs/coverings: top and bottom.
  layers      one per material layer: area = main net area, volume = area x thickness.
  steel mass  nominal kg/m parsed from the profile name (metric W shapes), see
              nominal_mass_per_length(); otherwise rules use volume x density.
"""
from __future__ import annotations

import fnmatch
import json
import os
import re
from collections import defaultdict
from functools import lru_cache

import ifcopenshell.ifcopenshell_wrapper as ifc_schema

from .expr import fmt
from .log import CalcLog
from .names import Resolver

HERE = os.path.dirname(os.path.abspath(__file__))
FAMILIES = json.load(open(os.path.join(HERE, "data", "families.json"), encoding="utf-8"))["IFC_FAMILIES"]
SOURCES = json.load(open(os.path.join(HERE, "data", "quantity_sources.json"), encoding="utf-8"))
TOLERANCE = 0.01
PLANAR_VERTICAL = ("IfcWall", "IfcCurtainWall", "IfcPlate")
LINEAR_VERTICAL = ("IfcColumn", "IfcPile")
PHASE_MAP = {"new construction": "new", "new": "new", "existing": "existing"}
# IFC2x3 distribution occurrences are generic; the specific class is on the type (IfcDuctSegmentType)
GENERIC_2X3 = {"IfcFlowSegment", "IfcFlowFitting", "IfcFlowTerminal", "IfcFlowController", "IfcFlowMovingDevice",
               "IfcFlowStorageDevice", "IfcFlowTreatmentDevice", "IfcEnergyConversionDevice",
               "IfcDistributionControlElement", "IfcDistributionFlowElement", "IfcDistributionElement"}


@lru_cache(maxsize=None)
def ancestry(cls: str, schema: str = "IFC4X3_ADD2") -> tuple[str, ...]:
    """cls and its supertypes, nearest first. Looks in the model's schema, then IFC4.3
    (an IFC2x3 type can name an IFC4 class). Just (cls,) if no schema knows it."""
    for name in (schema, {"IFC4X3": "IFC4X3_ADD2"}.get(schema), "IFC4X3_ADD2"):
        if not name:
            continue
        try:
            d = ifc_schema.schema_by_name(name).declaration_by_name(cls)
        except Exception:
            continue
        out = []
        while d is not None:
            out.append(d.name())
            d = d.supertype()
        return tuple(out)
    return (cls,)


def family_of(cls: str, schema: str = "IFC4X3_ADD2") -> str:
    return next((FAMILIES[c] for c in ancestry(cls, schema) if c in FAMILIES), "countable")


def nominal_mass_per_length(profile: str | None) -> float | None:
    """kg/m from a section designation, where the designation itself states it.
    Metric W shapes (W310X60 = 60 kg/m). Other families (IPE, HEA, ...) need a
    section table, which is not bundled; rules fall back to volume x density."""
    if not profile:
        return None
    m = re.match(r"^\s*W\s?\d+\s?[xX×]\s?(\d+(?:\.\d+)?)\s*$", profile)
    return float(m.group(1)) if m else None


def find_reported(el: dict, kind: str):
    """First reported value for a quantity kind: (value, "Set.Prop") or (None, None)."""
    for set_glob, prop in SOURCES.get(kind, []):
        for bucket in (el["quantities"]["reported"], el["psets"]):
            for set_name, props in bucket.items():
                if fnmatch.fnmatch(set_name, set_glob):
                    v = props.get(prop)
                    if isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0:
                        return float(v), f"{set_name}.{prop}"
    return None, None


def common_pset(el: dict) -> dict:
    for name, props in el["psets"].items():
        if name.startswith("Pset_") and name.endswith("Common"):
            return props
    for name, props in el.get("typePsets", {}).items():
        if name.startswith("Pset_") and name.endswith("Common"):
            return props
    return {}


def build(parsed: dict, rv: Resolver, log: CalcLog, model_id: str | None = None,
          discipline: str | None = None) -> tuple[list[dict], list[dict]]:
    """Returns (MeasuredElement dicts, name resolutions for questions).
    model_id / discipline: set by federation (the run's id for this model, the user's tag);
    default to the file hash and the parser's discipline guess."""
    mats = {m["id"]: m["name"] for m in parsed["catalogues"]["materials"]}
    lsets = {l["id"]: l for l in parsed["catalogues"]["layerSets"]}
    types = {t["id"]: t for t in parsed["catalogues"]["types"]}
    profiles = {p["id"]: p for p in parsed["catalogues"]["profiles"]}
    classifications = {c["id"]: c for c in parsed["catalogues"]["classifications"]}
    spatial = {s["id"]: s for s in parsed["spatial"]}
    openings_by_host = defaultdict(list)
    for o in parsed["openings"]:
        if o.get("hostId"):
            openings_by_host[o["hostId"]].append(o)
    spaces_of = defaultdict(set)
    for r in parsed["relationships"]:
        if r["kind"] == "space_boundary":
            spaces_of[r["elementId"]].add(r["spaceId"])
    by_id = {e["id"]: e for e in parsed["elements"]}
    model_discipline = discipline or parsed["header"].get("disciplineGuess", "unknown")
    model_id = model_id or parsed["header"]["source"]["sha256"][:12]
    schema = parsed["header"].get("ifcSchema", "IFC4")
    resolutions: list[dict] = []
    out: list[dict] = []

    for el in parsed["elements"]:
        cls = el["ifcClassBase"]
        notes: list[str] = []
        prov: dict[str, str] = {}
        type_cls = types.get(el.get("typeId"), {}).get("ifcClass", "")
        cls_note = None
        if cls in GENERIC_2X3 and type_cls.endswith("Type") and type_cls[:-4] != cls:
            cls_note = f"class {cls} taken as {type_cls[:-4]} (from its type {type_cls})"
            cls = type_cls[:-4]
        fam = family_of(cls, schema)
        discipline = "mep" if "IfcDistributionElement" in ancestry(cls, schema) else model_discipline
        ctx = {"ifc_class": cls, "predefined_type": el.get("predefinedType"), "discipline": discipline}

        # ---------- names (dictionary) ----------
        hints: dict = {}
        for fld, raw in (("name", el.get("name")), ("object_type", el.get("objectType"))):
            for k, v in rv.extract(fld, raw, ctx).items():
                hints.setdefault(k, v["value"])
        type_name = hints.pop("type_name", None) or types.get(el.get("typeId"), {}).get("name") or el.get("objectType")
        family_name = hints.pop("family", None)
        if type_name:
            for k, v in rv.extract("type_name", type_name, ctx).items():
                hints.setdefault(k, v["value"])
        layer_res, main_raw, materials_raw = [], None, []
        ref = el.get("materialRef")
        layer_set = None
        if ref:
            if ref["kind"] == "single":
                main_raw = mats.get(ref["materialId"])
            elif ref["kind"] == "list":
                materials_raw = [mats.get(i) for i in ref["materialIds"] if mats.get(i)]
                main_raw = materials_raw[0] if materials_raw else None
            elif ref["kind"] == "layerSet":
                layer_set = lsets.get(ref["layerSetId"])
                for i, layer in enumerate((layer_set or {"layers": []})["layers"]):
                    raw = mats.get(layer.get("materialId"))
                    r = rv.resolve("layer_material", raw, ctx)
                    resolutions.append({**r, "ctx": ctx, "guid": el["id"]})
                    for k, v in rv.extract("layer_material", raw, ctx).items():
                        hints.setdefault(k, v["value"])
                    layer_res.append({"index": i, "term": r["term"], "raw": raw, "thickness": layer["thickness"]})
                solid = [l for l in layer_res if not (l["term"] and rv.under(l["term"], "air_gap"))]
                if layer_res:
                    main_raw = max(solid or layer_res, key=lambda l: l["thickness"])["raw"]
            elif ref["kind"] in ("profileSet", "constituentSet"):
                items = ref.get("items", [])
                main_raw = next((mats.get(i["materialId"]) for i in items if i.get("materialId")), None)
        mat = rv.resolve("material", main_raw, ctx) if main_raw else None
        if mat:
            resolutions.append({**mat, "ctx": ctx, "guid": el["id"]})
            for k, v in rv.extract("material", main_raw, ctx).items():
                hints.setdefault(k, v["value"])
        typ = rv.resolve("type_name", type_name, ctx) if type_name else None
        if typ:
            resolutions.append({**typ, "ctx": ctx, "guid": el["id"]})

        # ---------- geometry & reported values ----------
        g = el["quantities"]["geometry"]
        kids = [by_id[c] for c in el.get("childIds", []) if c in by_id]
        geo_vol = g.get("volume")
        if not geo_vol and kids:
            vols = [k["quantities"]["geometry"].get("volume") for k in kids]
            geo_vol = sum(v for v in vols if v) or None
        bmin, bmax = g.get("bboxMin"), g.get("bboxMax")
        if not bmin and kids:
            ks = [k["quantities"]["geometry"] for k in kids if k["quantities"]["geometry"].get("bboxMin")]
            if ks:
                bmin = [min(k["bboxMin"][i] for k in ks) for i in range(3)]
                bmax = [max(k["bboxMax"][i] for k in ks) for i in range(3)]
        ext = [bmax[i] - bmin[i] for i in range(3)] if bmin and bmax else None
        obb, obb_axes = g.get("obbExtents"), g.get("obbAxes")
        closed = g.get("closed", g.get("watertight", True))

        rep = {k: find_reported(el, k) for k in ("volume", "area", "length", "width", "height", "thickness", "perimeter", "mass")}

        # thickness
        thickness = None
        if layer_set and layer_set.get("totalThickness"):
            thickness, prov["thickness"] = layer_set["totalThickness"], "reported"
            t_note = "material layer set"
        elif fam == "planar" and rep["thickness"][0]:
            thickness, prov["thickness"] = rep["thickness"][0], "reported"
            t_note = rep["thickness"][1]
        elif fam == "planar" and obb:
            thickness, prov["thickness"] = min(obb), "geometry"
            t_note = "smallest oriented-box extent"
        elif fam == "planar" and ext:
            thickness = min(ext[2], min(ext[0], ext[1])) if cls not in PLANAR_VERTICAL else min(ext[0], ext[1])
            prov["thickness"] = "geometry"
            t_note = "smallest geometry extent"
        else:
            t_note = None

        # volume
        net_volume, v_note = None, None
        if rep["volume"][0]:
            net_volume, prov["net_volume"] = rep["volume"][0], "reported"
            v_note = f"{fmt(net_volume)} m3 from {rep['volume'][1]}"
            if geo_vol:
                diff = (geo_vol - net_volume) / net_volume
                v_note += f"; geometry {fmt(round(geo_vol, 4))} m3 ({diff:+.1%})"
                if abs(diff) > TOLERANCE:
                    notes.append(f"geometry volume differs from reported by {diff:+.1%}; reported used")
                    log.warn("measure", f"{el.get('name') or el['id']}: geometry volume {fmt(round(geo_vol, 3))} m3 vs reported "
                             f"{fmt(round(net_volume, 3))} m3 ({diff:+.1%}). Using reported (join-aware).", guid=el["id"])
        elif geo_vol and closed is not False:
            net_volume, prov["net_volume"] = geo_vol, "geometry"
            v_note = f"{fmt(round(geo_vol, 4))} m3 from geometry"
            if g.get("watertight") is False:
                v_note += " (closed mesh with T-junctions)"
        elif geo_vol:
            notes.append("mesh not closed: geometric volume unreliable, not used")

        # openings hosted by this element
        ops = []
        for o in openings_by_host.get(el["id"], []):
            kind = {"IfcDoor": "door", "IfcWindow": "window"}.get(o.get("fillingClass") or "", "void")
            w, h = o.get("width"), o.get("height")
            ops.append({"kind": kind, "width": w, "height": h, "area": o.get("area"),
                        "depth": o.get("depth") or thickness, "perimeter": 2 * ((w or 0) + (h or 0)),
                        "filling_guid": o.get("fillingId"), "filling_class": o.get("fillingClass")})
        open_area = sum(o["area"] or 0 for o in ops)

        # areas
        net_area = gross_area = None
        a_note = None
        if fam in ("planar", "assembly") or cls in ("IfcRoof",):
            if cls in PLANAR_VERTICAL and net_volume and thickness:
                net_area, prov["net_area"] = net_volume / thickness, "derived"
                a_note = f"net area = volume / thickness = {fmt(round(net_volume, 4))} / {fmt(thickness)} = {fmt(round(net_area, 3))} m2"
                if rep["area"][0] and abs(rep["area"][0] - net_area) / net_area > TOLERANCE:
                    a_note += f" (reported {rep['area'][1]} = {fmt(round(rep['area'][0], 3))} ignored: inconsistent with volume)"
            elif rep["area"][0]:
                net_area, prov["net_area"] = rep["area"][0], "reported"
                a_note = f"net area {fmt(round(net_area, 3))} m2 from {rep['area'][1]}"
            elif net_volume and thickness:
                net_area, prov["net_area"] = net_volume / thickness, "derived"
                a_note = f"net area = volume / thickness = {fmt(round(net_area, 3))} m2"
            elif closed is False and "SurfaceModel" in g.get("representationTypes", []) and g.get("surfaceArea"):
                net_area, prov["net_area"] = g["surfaceArea"], "geometry"
                a_note = f"net area {fmt(round(net_area, 3))} m2 = one-sided area of the open surface model"
            if net_area is not None:
                gross_area = net_area + open_area
                prov["gross_area"] = "derived"
        gross_volume = None
        if net_volume is not None:
            gross_volume = net_volume + sum((o["area"] or 0) * (thickness or 0) for o in ops)

        # linear dimensions
        length = rep["length"][0]
        if length:
            prov["length"] = "reported"
        elif obb and cls in LINEAR_VERTICAL:              # along the most vertical axis (a squat pier is wider than tall)
            length, prov["length"] = max(zip(obb, obb_axes), key=lambda ea: abs(ea[1][2]))[0], "geometry"
        elif obb and fam == "linear":
            length, prov["length"] = max(obb), "geometry"
        elif obb and any(abs(ax[2]) < 0.5 for ax in obb_axes):
            length, prov["length"] = max(e for e, ax in zip(obb, obb_axes) if abs(ax[2]) < 0.5), "geometry"
        elif ext:
            length, prov["length"] = max(ext[0], ext[1]), "geometry"
        width = el["attributes"].get("OverallWidth") or rep["width"][0]
        height = el["attributes"].get("OverallHeight") or rep["height"][0]
        if height:
            prov["height"] = "reported"
        elif ext:
            height, prov["height"] = ext[2], "geometry"

        # perimeter: reported, else for a closed slab-like prism S = 2V/t + P*t  ->  P = (S - 2V/t) / t
        # (includes the edges of openings, which is what edge formwork needs)
        perimeter, p_note = rep["perimeter"][0], None
        if perimeter:
            prov["perimeter"] = "reported"
        elif (fam == "planar" and cls not in PLANAR_VERTICAL and closed and g.get("volume") and g.get("surfaceArea")
              and thickness and not g.get("bodyCount")):
            p = (g["surfaceArea"] - 2 * g["volume"] / thickness) / thickness
            if p > 0:
                perimeter, prov["perimeter"] = p, "geometry"
                p_note = f"perimeter = (surface {fmt(round(g['surfaceArea'], 3))} - 2 x volume / thickness) / thickness = {fmt(round(p, 3))} m"

        # profile & mass
        profile = hints.pop("profile", None)
        if not profile and el.get("profileId") in profiles:
            profile = profiles[el["profileId"]].get("name")
        nmpl = nominal_mass_per_length(profile)
        density = rv.term_prop(mat["term"] if mat else None, "density_kg_m3")

        # faces
        faces = []
        sp = sorted(spaces_of.get(el["id"], []))
        if net_area is not None:
            sides = ("a", "b") if cls in PLANAR_VERTICAL else ("top", "bottom")
            for s in sides:
                faces.append({"side": s, "gross_area": gross_area, "net_area": net_area})

        # layers
        layers = [{"index": l["index"], "material": l["term"], "material_raw": l["raw"], "thickness": l["thickness"],
                   "area": net_area, "volume": (net_area * l["thickness"]) if net_area is not None else None}
                  for l in layer_res]

        # status
        phase = (el["psets"].get("PSet_Revit_Phasing", {}) or {}).get("Phase Created")
        demolished = (el["psets"].get("PSet_Revit_Phasing", {}) or {}).get("Phase Demolished")
        status = "demolish" if demolished and str(demolished).lower() not in ("none", "") else PHASE_MAP.get(str(phase or "new").lower(), "new")

        common = common_pset(el)
        storey = spatial.get(el.get("storeyId"), {})
        props = {}
        for bucket in (el.get("typePsets", {}), el["psets"]):
            for ps, vals in bucket.items():
                for k, v in vals.items():
                    props[f"{ps}.{k}"] = v
        ifc_codes = [classifications[c] for c in el.get("classificationIds", []) if c in classifications]

        m = {
            "guid": el["id"], "model_id": model_id, "discipline": discipline,
            "ifc_class": cls, "ifc_class_raw": el["ifcClass"], "predefined_type": el.get("predefinedType"),
            "family": fam, "name": el.get("name"), "family_name": family_name, "type_name": type_name,
            "material": mat["term"] if mat else None, "material_raw": main_raw,
            "materials": sorted({l["term"] for l in layer_res if l["term"]} | ({mat["term"]} if mat and mat["term"] else set())),
            "element_type": typ["term"] if typ else None,
            "profile": profile, "nominal_size": hints.pop("nominal_size", None),
            "strength_class": hints.pop("strength_class", None),
            "storey": storey.get("name"), "storey_elevation": storey.get("elevation"),
            "spaces": sp, "status": status,
            "is_external": common.get("IsExternal"), "load_bearing": common.get("LoadBearing"),
            "count": 1,
            "length": length, "width": width, "height": height, "thickness": thickness,
            "gross_area": gross_area, "net_area": net_area,
            "footprint_area": net_area if cls not in PLANAR_VERTICAL else None,
            "developed_area": net_area if cls not in PLANAR_VERTICAL else None,
            "faces": faces,
            "gross_volume": gross_volume, "net_volume": net_volume,
            "perimeter": perimeter, "mass": rep["mass"][0],
            "nominal_mass_per_length": nmpl, "density": density,
            "openings": ops, "layers": layers,
            "host_guid": el.get("hostId"), "parent_guid": el.get("parentId"), "child_guids": el.get("childIds", []),
            "props": props, "ifc_classifications": ifc_codes,
            "provenance": prov, "warnings": notes,
        }
        for k, v in hints.items():                       # name hints only fill gaps (geometry wins)
            if m.get(k) is None:
                m[k] = v
                prov[k] = "derived"
        out.append(m)

        bits = [cls_note or cls]
        if mat:
            bits.append(f"material '{main_raw}' -> {mat['term'] or 'UNRESOLVED'}")
        if t_note:
            bits.append(f"thickness {fmt(thickness)} m ({t_note})")
        if v_note:
            bits.append(f"volume {v_note}")
        if a_note:
            bits.append(a_note)
        if p_note:
            bits.append(p_note)
        if ops:
            bits.append(f"{len(ops)} opening(s) {fmt(round(open_area, 3))} m2 -> gross {fmt(round(gross_area or 0, 3))} m2")
        if nmpl:
            bits.append(f"profile {profile}: {fmt(nmpl)} kg/m")
        log.detail("measure", f"{el.get('name') or el['id']}: " + "; ".join(bits), guid=el["id"])
    roll_up_parts(out, by_id, log)
    return out, resolutions


def roll_up_parts(out: list[dict], by_id: dict, log: CalcLog):
    """An aggregate without its own body (IfcRoof made of slabs, IfcElementAssembly) takes its
    quantities from its parts: volume = sum of the parts' adopted volumes (only if every part
    with a body has one), area = sum of the planar parts' areas. Parts are still measurable on
    their own; rules decide whether the whole or the parts are measured (rules.py)."""
    by_guid = {m["guid"]: m for m in out}

    def depth(m, seen=0):
        p = by_guid.get(m.get("parent_guid"))
        return 0 if p is None or seen > 20 else 1 + depth(p, seen + 1)

    for m in sorted(out, key=lambda m: -depth(m)):              # nested assemblies: deepest first
        if by_id[m["guid"]]["quantities"]["geometry"].get("hasBody") or not m["child_guids"]:
            continue
        parts = [by_guid[c] for c in m["child_guids"] if c in by_guid]
        bodies = [p for p in parts if by_id[p["guid"]]["quantities"]["geometry"].get("hasBody") or p["child_guids"]]
        bits = []
        if bodies and all(p["net_volume"] is not None for p in bodies):
            m["net_volume"] = sum(p["net_volume"] for p in bodies)
            m["gross_volume"] = sum(p["gross_volume"] or p["net_volume"] for p in bodies)
            m["provenance"]["net_volume"] = "derived"
            bits.append(f"volume = sum of {len(bodies)} part(s) = {fmt(round(m['net_volume'], 4))} m3")
        elif bodies:
            m["net_volume"] = m["gross_volume"] = None
            m["warnings"].append("some parts have no reliable volume: no volume for the whole")
        planar = [p for p in parts if p["net_area"] is not None and (p["family"] == "planar" or (      # incl. rolled-up
            p["child_guids"] and not by_id[p["guid"]]["quantities"]["geometry"].get("hasBody")))]     # sub-assemblies
        if m["net_area"] is None and planar:
            m["net_area"] = sum(p["net_area"] for p in planar)
            m["gross_area"] = sum(p["gross_area"] or p["net_area"] for p in planar)
            m["footprint_area"] = m["developed_area"] = m["net_area"]
            m["faces"] = [{"side": s, "gross_area": m["gross_area"], "net_area": m["net_area"]} for s in ("top", "bottom")]
            m["provenance"]["net_area"] = m["provenance"]["gross_area"] = "derived"
            if len({p["thickness"] for p in planar}) == 1 and m["thickness"] is None:
                m["thickness"] = planar[0]["thickness"]
            bits.append(f"area = sum of {len(planar)} planar part(s) = "
                        f"{' + '.join(fmt(round(p['net_area'], 3)) for p in planar)} = {fmt(round(m['net_area'], 3))} m2")
        if bits:
            log.detail("measure", f"{m.get('name') or m['guid']}: no body of its own; " + "; ".join(bits), guid=m["guid"])
