"""
parse.py - IFC file -> ParsedModel JSON (+ geometry.glb)

Layer 1 of the engine: a faithful, reusable snapshot of one IFC model version.
No decisions are made here: no dictionary, no adopted quantities, no rules.
The output conforms to schema/parsed-model.schema.json (generated from src/parsed.ts).

Usage (library):  doc, parser = parse_file(path)
Usage (CLI):      python -m ifc_boq.parse model.ifc out_dir [--schema parsed-model.schema.json] [--no-overlaps]

Outputs:
    out_dir/parsed.json      the ParsedModel document
    out_dir/geometry.glb     one mesh node per GlobalId (world coordinates), for viewers
    out_dir/meshes.npz       the same meshes in float64, for the engine (geometry.py, mesh sidecar)
"""
from __future__ import annotations

import argparse
import hashlib
import itertools
import json
import math
import multiprocessing
import os
import re
import sys
import time
from datetime import datetime, timezone

import numpy as np
import trimesh
import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.util.element as ue
import ifcopenshell.util.placement as up
import ifcopenshell.util.unit as uu

from . import geometry

ENGINE_VERSION = "0.1.0"
TOLERANCE = 0.01                     # 1 % reported vs geometry
OVERLAP_MIN_M3 = geometry.SHARED_MIN
OVERLAP_CLASSES = ("IfcWall", "IfcSlab", "IfcFooting", "IfcBeam", "IfcColumn", "IfcMember",
                   "IfcCovering", "IfcPlate", "IfcPile", "IfcRoof")
NEEDS_MATERIAL = ("IfcWall", "IfcSlab", "IfcFooting", "IfcBeam", "IfcColumn", "IfcMember",
                  "IfcCovering", "IfcPlate", "IfcPile", "IfcRamp", "IfcChimney")
MEP_ROOTS = ("IfcDistributionElement",)
STRUCT_CLASSES = ("IfcBeam", "IfcColumn", "IfcFooting", "IfcPile", "IfcReinforcingElement", "IfcMember")
ARCH_CLASSES = ("IfcDoor", "IfcWindow", "IfcCovering", "IfcFurnishingElement", "IfcRailing", "IfcStair")
INFRA_FACILITIES = ("IfcBridge", "IfcRoad", "IfcRailway", "IfcMarineFacility")
FACE_CLASSES = ("IfcWall", "IfcSlab", "IfcCovering", "IfcPlate")   # elements whose two sides are measured
SPATIAL_KIND = {"IfcProject": "project", "IfcSite": "site", "IfcBuilding": "building",
                "IfcBuildingStorey": "storey", "IfcSpace": "space", "IfcZone": "zone",
                "IfcFacility": "facility", "IfcFacilityPart": "facility_part"}
LENGTH_MEASURES = {"IfcLengthMeasure", "IfcPositiveLengthMeasure", "IfcNonNegativeLengthMeasure"}
AREA_MEASURES = {"IfcAreaMeasure"}
VOLUME_MEASURES = {"IfcVolumeMeasure"}


# --------------------------------------------------------------------------- helpers
def r6(x):
    return None if x is None else float(round(float(x), 6))


def vec(a):
    return [r6(v) for v in a]


def scalar(v):
    """Coerce any IFC value into a JSON scalar."""
    if v is None or isinstance(v, (bool, str)):
        return v
    if isinstance(v, (int, float)):
        return None if isinstance(v, float) and (math.isnan(v) or math.isinf(v)) else v
    if isinstance(v, ifcopenshell.entity_instance):
        try:
            return scalar(v.wrappedValue)
        except Exception:
            return str(v)
    if isinstance(v, (list, tuple)):
        return str(v)
    return str(v)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def class_base(cls: str) -> str:
    return re.sub(r"(StandardCase|ElementedCase)$", "", cls)


def is_any(e, classes):
    return any(e.is_a(c) for c in classes)


def _hull2d(p: np.ndarray) -> np.ndarray:
    """Convex hull of 2D points (Andrew's monotone chain), counter-clockwise."""
    p = np.unique(np.round(p, 9), axis=0)                 # sorted by x, then y
    if len(p) < 3:
        return p

    def half(points):
        h: list = []
        for q in points:
            while len(h) >= 2 and ((h[-1][0] - h[-2][0]) * (q[1] - h[-2][1])
                                   - (h[-1][1] - h[-2][1]) * (q[0] - h[-2][0])) <= 0:
                h.pop()
            h.append(q)
        return h
    lower, upper = half(p), half(p[::-1])
    return np.array(lower[:-1] + upper[:-1])


class Parser:
    def __init__(self, path: str, overlaps: bool = True):
        self.path = path
        self.f = ifcopenshell.open(path)
        self.schema = self.f.schema
        self.do_overlaps = overlaps
        self.L = uu.calculate_unit_scale(self.f)                                   # length -> m
        self.A = self._scale("AREAUNIT", self.L ** 2)
        self.V = self._scale("VOLUMEUNIT", self.L ** 3)
        self.checks: list[dict] = []
        self.mat_ids: dict[int, str] = {}
        self.meshes: dict[str, trimesh.Trimesh] = {}

    # ----- units -----
    def _scale(self, unit_type, fallback):
        try:
            return uu.calculate_unit_scale(self.f, unit_type)
        except Exception:
            return fallback

    def unit_names(self):
        out = {}
        for ua in self.f.by_type("IfcUnitAssignment"):
            for u in ua.Units:
                if u.is_a("IfcNamedUnit") and getattr(u, "UnitType", None):
                    name = u.Name if u.is_a("IfcSIUnit") else getattr(u, "Name", "")
                    prefix = (u.Prefix or "") if u.is_a("IfcSIUnit") else ""
                    out[u.UnitType] = f"{prefix}{name}"
        return out

    def convert(self, value, measure_type):
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            return value
        if measure_type in LENGTH_MEASURES:
            return value * self.L
        if measure_type in AREA_MEASURES:
            return value * self.A
        if measure_type in VOLUME_MEASURES:
            return value * self.V
        return value

    def check(self, code, severity, ids, message, **data):
        self.checks.append(dict(id=f"chk-{len(self.checks) + 1:04d}", code=code, severity=severity,
                                elementIds=list(ids), message=message,
                                **({"data": {k: scalar(v) for k, v in data.items()}} if data else {})))

    # ----- properties & quantities (own reader so measures get unit-converted) -----
    def prop_value(self, p):
        if p.is_a("IfcPropertySingleValue"):
            nv = p.NominalValue
            if nv is None:
                return None
            return scalar(self.convert(nv.wrappedValue, nv.is_a()))
        if p.is_a("IfcPropertyEnumeratedValue"):
            return [scalar(v.wrappedValue) for v in (p.EnumerationValues or [])]
        if p.is_a("IfcPropertyListValue"):
            return [scalar(self.convert(v.wrappedValue, v.is_a())) for v in (p.ListValues or [])]
        if p.is_a("IfcPropertyBoundedValue"):
            lo = p.LowerBoundValue.wrappedValue if p.LowerBoundValue else None
            hi = p.UpperBoundValue.wrappedValue if p.UpperBoundValue else None
            return [scalar(lo), scalar(hi)]
        return str(p.is_a())

    def pset_dict(self, pset):
        out = {}
        if pset.is_a("IfcPropertySet"):
            for p in pset.HasProperties or []:
                out[p.Name] = self.prop_value(p)
        return out

    def qto_dict(self, qto):
        out = {}
        for q in qto.Quantities or []:
            if q.is_a("IfcQuantityLength"):
                out[q.Name] = q.LengthValue * self.L
            elif q.is_a("IfcQuantityArea"):
                out[q.Name] = q.AreaValue * self.A
            elif q.is_a("IfcQuantityVolume"):
                out[q.Name] = q.VolumeValue * self.V
            elif q.is_a("IfcQuantityCount"):
                out[q.Name] = q.CountValue
            elif q.is_a("IfcQuantityWeight"):
                out[q.Name] = q.WeightValue
            elif q.is_a("IfcQuantityTime"):
                out[q.Name] = q.TimeValue
        return {k: r6(v) for k, v in out.items() if isinstance(v, (int, float))}

    def definitions(self, obj):
        """Instance-level psets and qtos (not inherited from type)."""
        psets, qtos = {}, {}
        for rel in getattr(obj, "IsDefinedBy", []) or []:
            if rel.is_a("IfcRelDefinesByProperties"):
                d = rel.RelatingPropertyDefinition
                if d.is_a("IfcElementQuantity"):
                    qtos[d.Name] = self.qto_dict(d)
                elif d.is_a("IfcPropertySet"):
                    psets[d.Name] = self.pset_dict(d)
        return psets, qtos

    def type_psets(self, t):
        out = {}
        for d in getattr(t, "HasPropertySets", None) or []:
            if d.is_a("IfcPropertySet"):
                out[d.Name] = self.pset_dict(d)
        return out

    # ----- materials -----
    def material_id(self, m):
        if m.id() not in self.mat_ids:
            self.mat_ids[m.id()] = f"mat:{m.id()}"
        return self.mat_ids[m.id()]

    def material_ref(self, obj):
        m = ue.get_material(obj, should_inherit=True)
        if m is None:
            return None
        if m.is_a("IfcMaterial"):
            return {"kind": "single", "materialId": self.material_id(m)}
        if m.is_a("IfcMaterialList"):
            return {"kind": "list", "materialIds": [self.material_id(x) for x in m.Materials]}
        if m.is_a("IfcMaterialLayerSetUsage"):
            ref = {"kind": "layerSet", "layerSetId": f"mls:{m.ForLayerSet.id()}",
                   "direction": str(m.LayerSetDirection), "sense": str(m.DirectionSense)}
            if m.OffsetFromReferenceLine is not None:
                ref["offset"] = r6(m.OffsetFromReferenceLine * self.L)
            return ref
        if m.is_a("IfcMaterialLayerSet"):
            return {"kind": "layerSet", "layerSetId": f"mls:{m.id()}"}
        if m.is_a("IfcMaterialLayer"):
            return {"kind": "single", "materialId": self.material_id(m.Material)} if m.Material else None
        if m.is_a("IfcMaterialProfileSetUsage") or m.is_a("IfcMaterialProfileSet"):
            ps = m.ForProfileSet if m.is_a("IfcMaterialProfileSetUsage") else m
            return {"kind": "profileSet", "items": [
                {k: v for k, v in dict(materialId=self.material_id(p.Material) if p.Material else None,
                                       profileId=f"prf:{p.Profile.id()}" if p.Profile else None,
                                       name=p.Name).items() if v} for p in ps.MaterialProfiles]}
        if m.is_a("IfcMaterialConstituentSet"):
            return {"kind": "constituentSet", "items": [
                {k: v for k, v in dict(materialId=self.material_id(c.Material) if c.Material else None,
                                       name=c.Name, fraction=c.Fraction, category=c.Category).items()
                 if v is not None} for c in (m.MaterialConstituents or [])]}
        return None

    # ----- geometry -----
    @staticmethod
    def closed_surface(m: trimesh.Trimesh) -> bool:
        """True when the mesh encloses a volume. Watertight meshes do; so do meshes whose only
        open edges are T-junctions (a vertex lying on a neighbour's edge, common in tessellated
        exports): every boundary loop of such a mesh is a degenerate crack with ~zero vector area.
        A real hole (open pipe end, missing face) has a loop with real area."""
        if m.is_watertight:
            return True
        idx = trimesh.grouping.group_rows(m.edges_sorted, require_count=1)
        if len(idx) == 0:
            return False                                  # non-manifold (edges used 3+ times)
        edges = m.edges[idx]
        v = m.vertices
        for comp in trimesh.graph.connected_components(edges, min_len=1):
            in_comp = np.isin(edges[:, 0], comp)
            e = edges[in_comp]
            c = v[comp].mean(0)                           # centre first: georeferenced coordinates are large
            a, b = v[e[:, 0]] - c, v[e[:, 1]] - c
            vector_area = 0.5 * np.cross(a, b).sum(0)
            perimeter = np.linalg.norm(b - a, axis=1).sum()
            if perimeter > 0 and np.linalg.norm(vector_area) / perimeter ** 2 > 1e-6:
                return False
        return True

    @staticmethod
    def bodies(m: trimesh.Trimesh) -> list[np.ndarray]:
        """Vertex sets of the disjoint pieces of a mesh (one IfcWall can hold both spandrel walls
        of a bridge), largest surface area first."""
        comps = trimesh.graph.connected_components(m.edges, nodes=np.arange(len(m.vertices)), min_len=1)
        if len(comps) < 2:
            return [np.arange(len(m.vertices))]
        face_comp = np.full(len(m.vertices), -1)
        for i, c in enumerate(comps):
            face_comp[c] = i
        area = np.bincount(face_comp[m.faces[:, 0]], weights=m.area_faces, minlength=len(comps))
        return [comps[i] for i in np.argsort(-area)]

    @staticmethod
    def oriented_box(points: np.ndarray):
        """(extents largest first, unit axes) of an oriented bounding box, numpy only.
        Two candidates, the smaller wins: the minimum-area plan rectangle with the vertical
        extent (exact for rotated walls and slabs), and the principal axes (exact for sloped
        members such as rafters and arch segments)."""
        pts = np.unique(np.round(points, 9), axis=0)
        if len(pts) < 4:
            return None
        cands = []
        hull = _hull2d(pts[:, :2])
        if len(hull) >= 3:
            e = np.roll(hull, -1, axis=0) - hull
            e = e[np.hypot(e[:, 0], e[:, 1]) > 1e-12]
            u = e / np.hypot(e[:, 0], e[:, 1])[:, None]
            v = np.stack([-u[:, 1], u[:, 0]], 1)
            a, b = np.ptp(hull @ u.T, axis=0), np.ptp(hull @ v.T, axis=0)
            i = int(np.argmin(a * b))
            axes = [[u[i, 0], u[i, 1], 0.0], [v[i, 0], v[i, 1], 0.0], [0.0, 0.0, 1.0]]
            cands.append(([a[i], b[i], float(np.ptp(pts[:, 2]))], axes))
        _, vecs = np.linalg.eigh(np.cov((pts - pts.mean(0)).T))
        cands.append((list(np.ptp(pts @ vecs, axis=0)), [list(vecs[:, k]) for k in range(3)]))

        def size(c):
            ext = sorted(c[0], reverse=True)
            return (ext[0] * ext[1] * ext[2], ext[0] * ext[1])   # volume, then area for flat sheets
        ext, axes = min(cands, key=size)
        order = np.argsort(-np.asarray(ext))
        return [r6(ext[k]) for k in order], [vec(axes[k]) for k in order]

    def run_geometry(self):
        s = ifcopenshell.geom.settings()
        s.set("use-world-coords", True)
        # Ask for file units and scale with our own factor: the geometry kernel can miss a unit
        # assignment and silently return millimetres as metres (ISO sample wall-with-opening-and-window).
        s.set("convert-back-units", True)
        geo = {}
        for include_openings in (False, True):
            kwargs = ({"include": list(self.f.by_type("IfcOpeningElement"))} if include_openings
                      else {"exclude": ("IfcOpeningElement",)})
            if include_openings and not kwargs["include"]:
                continue
            it = ifcopenshell.geom.iterator(s, self.f, multiprocessing.cpu_count(), **kwargs)
            if not it.initialize():
                continue
            while True:
                sh = it.get()
                v = np.array(sh.geometry.verts, dtype=float).reshape(-1, 3) * self.L
                fc = np.array(sh.geometry.faces, dtype=int).reshape(-1, 3)
                if len(fc):
                    m = trimesh.Trimesh(v, fc, process=True)
                    raw = abs(float(m.volume))
                    fixed = False
                    if not m.is_winding_consistent:
                        trimesh.repair.fix_normals(m)
                        fixed = True
                    info = dict(hasBody=True, meshRef=sh.guid, bboxMin=vec(v.min(0)), bboxMax=vec(v.max(0)),
                                centroid=vec(m.center_mass if abs(m.volume) > 1e-9 else (v.min(0) + v.max(0)) / 2), volume=r6(abs(m.volume)), surfaceArea=r6(m.area),
                                triangleCount=int(len(fc)), watertight=bool(m.is_watertight),
                                closed=bool(self.closed_surface(m)), normalsRepaired=fixed)
                    pieces = self.bodies(m)
                    obb = self.oriented_box(m.vertices[pieces[0]])
                    if obb:
                        info["obbExtents"], info["obbAxes"] = obb
                    if len(pieces) > 1:
                        info["bodyCount"] = len(pieces)
                    if fixed:
                        info["volumeBeforeRepair"] = r6(raw)
                    geo[sh.guid] = info
                    self.meshes[sh.guid] = m
                if not it.next():
                    break
        return geo

    @staticmethod
    def rep_types(obj):
        rep = getattr(obj, "Representation", None)
        if not rep:
            return []
        return sorted({r.RepresentationType for r in rep.Representations
                       if r.RepresentationIdentifier in ("Body", None) and r.RepresentationType})

    def profile_of(self, obj):
        rep = getattr(obj, "Representation", None)
        if not rep:
            return None
        for r in rep.Representations:
            if r.RepresentationIdentifier != "Body":
                continue
            for item in r.Items:
                while item.is_a("IfcBooleanResult"):
                    item = item.FirstOperand
                if item.is_a("IfcMappedItem"):
                    for sub in item.MappingSource.MappedRepresentation.Items:
                        if sub.is_a("IfcExtrudedAreaSolid"):
                            return sub.SweptArea
                if item.is_a("IfcExtrudedAreaSolid"):
                    return item.SweptArea
        return None

    def profile_record(self, p):
        params = {}
        for k, v in p.get_info(recursive=False).items():
            if k in ("id", "type", "ProfileType", "ProfileName", "Position") or isinstance(v, bool):
                continue
            if isinstance(v, (int, float)):
                params[k] = r6(v * self.L)
        rec = {"id": f"prf:{p.id()}", "ifcClass": p.is_a(), "params": params}
        if p.ProfileName:
            rec["name"] = p.ProfileName
        return rec

    def has_type(self, cls: str) -> bool:
        try:
            return bool(self.f.by_type(cls))
        except RuntimeError:                      # class not in this schema
            return False

    # ----- spatial -----
    def in_building(self, e) -> bool:
        """Spatially inside an IfcBuilding, or not placed in the spatial structure at all.
        Elements on a site or in an infrastructure facility have no storey by design."""
        seen, x = set(), e
        while x is not None and x.id() not in seen:
            seen.add(x.id())
            if x.is_a("IfcBuilding"):
                return True
            c = ue.get_container(x) if not x.is_a("IfcSpatialStructureElement") and not (
                self.schema != "IFC2X3" and x.is_a("IfcSpatialElement")) else None
            nxt = c if c is not None else ue.get_aggregate(x)
            if nxt is None:
                return x is e                     # nothing above the element itself
            x = nxt
        return False

    def storey_of(self, e, seen=None):
        seen = seen or set()
        if e.id() in seen:
            return None
        seen.add(e.id())
        if e.is_a("IfcBuildingStorey"):
            return e
        c = ue.get_container(e) if not e.is_a("IfcSpatialElement") and not e.is_a("IfcSpatialStructureElement") else None
        if c is None:
            c = ue.get_aggregate(e)
        return self.storey_of(c, seen) if c is not None else None

    # ----- main -----
    def parse(self):
        t0 = time.time()
        f = self.f
        with np.errstate(all="ignore"):          # degenerate meshes (furniture) produce harmless warnings
            geo = self.run_geometry()

        # header -----------------------------------------------------------
        hdr = f.header
        fn, fd = hdr.file_name, hdr.file_description
        app = f.by_type("IfcApplication")
        app = app[0] if app else None
        project = f.by_type("IfcProject")[0]
        mvd = next((m.group(1) for d in (fd.description or []) for m in [re.search(r"ViewDefinition\s*\[([^\]]+)\]", d)] if m), None)
        site = (f.by_type("IfcSite") or [None])[0]

        def dms(t):
            if not t:
                return None
            parts = list(t) + [0] * (4 - len(t))
            sign = -1 if any(p < 0 for p in parts if p) else 1
            d, m, s, us = (abs(p) for p in parts[:4])
            return r6(sign * (d + m / 60 + (s + us / 1e6) / 3600))

        geo_ref = {}
        if site is not None:
            if site.RefLatitude:
                geo_ref["latitude"] = dms(site.RefLatitude)
            if site.RefLongitude:
                geo_ref["longitude"] = dms(site.RefLongitude)
            if site.RefElevation is not None:
                geo_ref["elevation"] = r6(site.RefElevation * self.L)
        for ctx in f.by_type("IfcGeometricRepresentationContext"):
            if ctx.is_a("IfcGeometricRepresentationSubContext"):
                continue
            tn = getattr(ctx, "TrueNorth", None)
            if tn is not None:
                x, y = tn.DirectionRatios[:2]
                geo_ref["trueNorthDeg"] = r6(math.degrees(math.atan2(x, y)))
            break
        if self.schema != "IFC2X3":
            for mc in f.by_type("IfcMapConversion"):
                geo_ref["mapConversion"] = {"eastings": r6(mc.Eastings), "northings": r6(mc.Northings),
                                            "orthogonalHeight": r6(mc.OrthogonalHeight)}
                if mc.XAxisAbscissa is not None:
                    geo_ref["mapConversion"]["rotationDeg"] = r6(math.degrees(math.atan2(mc.XAxisOrdinate or 0, mc.XAxisAbscissa)))
                if mc.Scale is not None:
                    geo_ref["mapConversion"]["scale"] = r6(mc.Scale)
                if mc.TargetCRS is not None:
                    geo_ref["crs"] = mc.TargetCRS.Name
        units = self.unit_names()
        header = {
            "source": {"fileName": os.path.basename(self.path), "sizeBytes": os.path.getsize(self.path),
                       "sha256": sha256(self.path)},
            "ifcSchema": self.schema,
            "project": {k: v for k, v in dict(id=project.GlobalId, name=project.Name, longName=project.LongName,
                                              phase=project.Phase).items() if v},
            "units": {k: v for k, v in dict(length=units.get("LENGTHUNIT", "METRE"), area=units.get("AREAUNIT"),
                                            volume=units.get("VOLUMEUNIT"), angle=units.get("PLANEANGLEUNIT"),
                                            mass=units.get("MASSUNIT"), lengthToMetre=r6(self.L)).items() if v is not None},
            "parse": {"engineVersion": ENGINE_VERSION, "ifcopenshellVersion": ifcopenshell.version,
                      "parsedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "durationMs": 0},
        }
        if mvd:
            header["modelView"] = mvd
        if app is not None:
            header["authoringApp"] = {k: v for k, v in dict(name=app.ApplicationIdentifier, version=app.Version,
                                                             vendor=app.ApplicationDeveloper.Name if app.ApplicationDeveloper else None,
                                                             fullName=app.ApplicationFullName).items() if v}
        for key, val in (("originatingSystem", fn.originating_system), ("preprocessor", fn.preprocessor_version),
                         ("fileTimestamp", fn.time_stamp),
                         ("author", ", ".join(a for a in (fn.author or []) if a)),
                         ("organization", ", ".join(o for o in (fn.organization or []) if o))):
            if val:
                header[key] = val
        if geo_ref:
            header["georeference"] = geo_ref

        # catalogues ------------------------------------------------------
        materials = []
        for m in f.by_type("IfcMaterial"):
            rec = {"id": self.material_id(m), "name": m.Name, "psets": {}}
            if self.schema != "IFC2X3":
                if m.Category:
                    rec["category"] = m.Category
                if m.Description:
                    rec["description"] = m.Description
                for mp in getattr(m, "HasProperties", None) or []:
                    rec["psets"][mp.Name or "Properties"] = {p.Name: self.prop_value(p) for p in mp.Properties or []}
            materials.append(rec)
        layer_sets = []
        for ls in f.by_type("IfcMaterialLayerSet"):
            layers = []
            for l in ls.MaterialLayers:
                rec = {"thickness": r6(l.LayerThickness * self.L)}
                if l.Material:
                    rec["materialId"] = self.material_id(l.Material)
                if l.IsVentilated is not None:
                    rec["isVentilated"] = bool(l.IsVentilated) if not isinstance(l.IsVentilated, str) else None
                if self.schema != "IFC2X3":
                    if l.Name:
                        rec["name"] = l.Name
                    if l.Category:
                        rec["category"] = l.Category
                layers.append(rec)
            layer_sets.append({k: v for k, v in dict(id=f"mls:{ls.id()}", name=ls.LayerSetName,
                                                     totalThickness=r6(sum(x["thickness"] for x in layers)),
                                                     layers=layers).items() if v is not None})
        types = []
        for t in f.by_type("IfcTypeObject"):
            if not getattr(t, "GlobalId", None):
                continue
            rec = {"id": t.GlobalId, "ifcClass": t.is_a(), "psets": self.type_psets(t),
                   "instanceIds": [i.GlobalId for i in ue.get_types(t)]}
            for k, attr in (("name", "Name"), ("predefinedType", "PredefinedType"), ("elementType", "ElementType")):
                v = getattr(t, attr, None)
                if v:
                    rec[k] = str(v)
            mr = self.material_ref(t)
            if mr:
                rec["materialRef"] = mr
            types.append(rec)
        systems = []
        for s in f.by_type("IfcSystem"):
            if s.is_a("IfcZone") or s.is_a("IfcStructuralAnalysisModel"):
                continue
            members = [o.GlobalId for rel in (getattr(s, "IsGroupedBy", None) or []) for o in rel.RelatedObjects]
            if self.schema == "IFC2X3":
                members = [o.GlobalId for rel in f.by_type("IfcRelAssignsToGroup") if rel.RelatingGroup == s
                           for o in rel.RelatedObjects]
            systems.append({k: v for k, v in dict(id=s.GlobalId, ifcClass=s.is_a(), name=s.Name,
                                                  predefinedType=str(getattr(s, "PredefinedType", "") or "") or None,
                                                  memberIds=members).items() if v is not None})
        classifications = []
        for c in f.by_type("IfcClassificationReference"):
            src = c.ReferencedSource
            code = c.ItemReference if self.schema == "IFC2X3" else c.Identification
            rec = {"id": f"cls:{c.id()}"}
            for k, v in (("system", getattr(src, "Name", None)), ("edition", getattr(src, "Edition", None)),
                         ("code", code), ("title", c.Name)):
                if v:
                    rec[k] = str(v)
            classifications.append(rec)
        profiles, profile_seen = [], set()

        # spatial ---------------------------------------------------------
        spatial = []
        zone_members = {}
        for rel in f.by_type("IfcRelAssignsToGroup"):
            if rel.RelatingGroup.is_a("IfcZone"):
                zone_members.setdefault(rel.RelatingGroup.GlobalId, []).extend(o.GlobalId for o in rel.RelatedObjects)
        for cls, kind in SPATIAL_KIND.items():
            try:
                items = f.by_type(cls, include_subtypes=False)
            except RuntimeError:
                continue
            for s in items:
                psets, qtos = self.definitions(s)
                parent = ue.get_aggregate(s) if kind != "zone" else None
                kids = [o.GlobalId for rel in (getattr(s, "IsDecomposedBy", None) or []) for o in rel.RelatedObjects]
                rec = {"id": s.GlobalId, "kind": kind, "ifcClass": s.is_a(), "childIds": kids,
                       "psets": psets, "quantities": qtos}
                for k, v in (("name", s.Name), ("longName", getattr(s, "LongName", None)),
                             ("parentId", parent.GlobalId if parent else None),
                             ("predefinedType", str(getattr(s, "PredefinedType", "") or "") or None)):
                    if v:
                        rec[k] = v
                if kind == "storey" and s.Elevation is not None:
                    rec["elevation"] = r6(s.Elevation * self.L)
                if kind == "zone":
                    rec["memberIds"] = zone_members.get(s.GlobalId, [])
                if s.GlobalId in geo:
                    g = dict(geo[s.GlobalId])
                    g["representationTypes"] = self.rep_types(s)
                    rec["geometry"] = g
                spatial.append(rec)

        # elements --------------------------------------------------------
        elements, by_class = [], {}
        for e in f.by_type("IfcElement"):
            if e.is_a("IfcOpeningElement") or e.is_a("IfcFeatureElementSubtraction") or e.is_a("IfcVirtualElement"):   # never physical
                continue
            psets, qtos = self.definitions(e)
            t = ue.get_type(e)
            container = ue.get_container(e)
            storey = self.storey_of(e)
            parent = ue.get_aggregate(e)
            host = None
            fills = None
            for rel in getattr(e, "FillsVoids", None) or []:
                fills = rel.RelatingOpeningElement
                vs = fills.VoidsElements
                if vs:
                    host = vs[0].RelatingBuildingElement
            g = dict(geo.get(e.GlobalId, {"hasBody": False}))
            g["representationTypes"] = self.rep_types(e)
            attrs = {}
            for a in ("OverallWidth", "OverallHeight"):
                v = getattr(e, a, None)
                if v is not None:
                    attrs[a] = r6(v * self.L)
            for a in ("NominalDiameter", "NominalLength"):
                v = getattr(e, a, None)
                if v is not None:
                    attrs[a] = r6(v * self.L)
            rec = {
                "id": e.GlobalId, "stepId": e.id(), "ifcClass": e.is_a(), "ifcClassBase": class_base(e.is_a()),
                "childIds": [o.GlobalId for rel in (getattr(e, "IsDecomposedBy", None) or []) for o in rel.RelatedObjects],
                "openingIds": [rel.RelatedOpeningElement.GlobalId for rel in (getattr(e, "HasOpenings", None) or [])],
                "systemIds": [rel.RelatingGroup.GlobalId for rel in (getattr(e, "HasAssignments", None) or [])
                              if rel.is_a("IfcRelAssignsToGroup") and rel.RelatingGroup.is_a("IfcSystem")
                              and not rel.RelatingGroup.is_a("IfcZone")],
                # occurrence first, then inherited from the type (codes are often assigned to types only)
                "classificationIds": list(dict.fromkeys(
                    f"cls:{rel.RelatingClassification.id()}"
                    for o in (e, t) if o is not None for rel in (getattr(o, "HasAssociations", None) or [])
                    if rel.is_a("IfcRelAssociatesClassification")
                    and rel.RelatingClassification.is_a("IfcClassificationReference"))),
                "attributes": attrs, "psets": psets,
                "typePsets": self.type_psets(t) if t else {},
                "quantities": {"reported": qtos, "geometry": g},
            }
            for k, v in (("predefinedType", str(getattr(e, "PredefinedType", "") or "") or None),
                         ("objectType", e.ObjectType), ("name", e.Name), ("description", e.Description),
                         ("tag", e.Tag), ("typeId", t.GlobalId if t and getattr(t, "GlobalId", None) else None),
                         ("containerId", container.GlobalId if container else None),
                         ("storeyId", storey.GlobalId if storey else None),
                         ("parentId", parent.GlobalId if parent and parent.is_a("IfcElement") else None),
                         ("hostId", host.GlobalId if host else None),
                         ("fillsOpeningId", fills.GlobalId if fills else None)):
                if v:
                    rec[k] = v
            mr = self.material_ref(e)
            if mr:
                rec["materialRef"] = mr
            if e.ObjectPlacement is not None:
                try:
                    m4 = up.get_local_placement(e.ObjectPlacement)
                    rec["placement"] = {"origin": vec(m4[:3, 3] * self.L), "xAxis": vec(m4[:3, 0]), "zAxis": vec(m4[:3, 2])}
                except (AttributeError, TypeError, ValueError):
                    pass    # IfcGridPlacement and other placements the helper cannot resolve; geometry is still in world coordinates
            prof = self.profile_of(e)
            # keep only parametric or named profiles (sections like W310X60); free-form outlines carry no data
            if prof is not None and (prof.ProfileName or not prof.is_a("IfcArbitraryClosedProfileDef")):
                rec["profileId"] = f"prf:{prof.id()}"
                if prof.id() not in profile_seen:
                    profile_seen.add(prof.id())
                    profiles.append(self.profile_record(prof))
            elements.append(rec)
            by_class[e.is_a()] = by_class.get(e.is_a(), 0) + 1

        # openings --------------------------------------------------------
        openings = []
        for o in f.by_type("IfcOpeningElement"):
            psets, qtos = self.definitions(o)
            host = o.VoidsElements[0].RelatingBuildingElement if o.VoidsElements else None
            filling = o.HasFillings[0].RelatedBuildingElement if o.HasFillings else None
            rec = {"id": o.GlobalId, "reported": qtos}
            for k, v in (("hostId", host.GlobalId if host else None),
                         ("fillingId", filling.GlobalId if filling else None),
                         ("fillingClass", filling.is_a() if filling else None),
                         ("predefinedType", str(getattr(o, "PredefinedType", "") or "") or None)):
                if v:
                    rec[k] = v
            mesh = self.meshes.get(o.GlobalId)
            if mesh is not None:
                pts = mesh.vertices
                rec["bboxMin"], rec["bboxMax"] = vec(pts.min(0)), vec(pts.max(0))
                rec["volume"] = r6(abs(mesh.volume))
                # width / depth from the principal axes of the plan footprint (works for rotated hosts)
                xy = pts[:, :2] - pts[:, :2].mean(0)
                _, _, vt = np.linalg.svd(xy, full_matrices=False)
                proj = xy @ vt.T
                ext = np.ptp(proj, axis=0)
                width, depth = float(max(ext)), float(min(ext))
                height = float(np.ptp(pts[:, 2]))
                horizontal = bool(host is not None and is_any(host, ("IfcSlab", "IfcRoof", "IfcCovering", "IfcPlate"))) \
                    or height < min(width, depth)
                if horizontal:          # opening in a slab / roof: plan area
                    rec.update(width=r6(width), height=r6(depth), depth=r6(height), area=r6(width * depth))
                else:
                    rec.update(width=r6(width), height=r6(height), depth=r6(depth), area=r6(width * height))
            openings.append(rec)

        # relationships ---------------------------------------------------
        rels = []

        def gid(x):
            return getattr(x, "GlobalId", None)

        for r in f.by_type("IfcRelContainedInSpatialStructure"):
            rels.append({"kind": "contains", "containerId": r.RelatingStructure.GlobalId,
                         "elementIds": [gid(o) for o in r.RelatedElements if gid(o)]})
        for r in f.by_type("IfcRelAggregates"):
            rels.append({"kind": "aggregates", "parentId": r.RelatingObject.GlobalId,
                         "childIds": [gid(o) for o in r.RelatedObjects if gid(o)]})
        if self.schema != "IFC2X3":
            for r in f.by_type("IfcRelNests"):
                rels.append({"kind": "nests", "parentId": r.RelatingObject.GlobalId,
                             "childIds": [gid(o) for o in r.RelatedObjects if gid(o)]})
        for r in f.by_type("IfcRelVoidsElement"):
            rels.append({"kind": "voids", "hostId": r.RelatingBuildingElement.GlobalId,
                         "openingId": r.RelatedOpeningElement.GlobalId})
        for r in f.by_type("IfcRelFillsElement"):
            rels.append({"kind": "fills", "openingId": r.RelatingOpeningElement.GlobalId,
                         "elementId": r.RelatedBuildingElement.GlobalId})
        for r in f.by_type("IfcRelDefinesByType"):
            if gid(r.RelatingType):
                rels.append({"kind": "defines_type", "typeId": r.RelatingType.GlobalId,
                             "elementIds": [gid(o) for o in r.RelatedObjects if gid(o)]})
        for r in f.by_type("IfcRelSpaceBoundary"):
            if r.RelatedBuildingElement is None:
                continue
            rec = {"kind": "space_boundary", "spaceId": r.RelatingSpace.GlobalId,
                   "elementId": r.RelatedBuildingElement.GlobalId}
            if r.PhysicalOrVirtualBoundary:
                rec["physical"] = r.PhysicalOrVirtualBoundary == "PHYSICAL"
            if r.InternalOrExternalBoundary:
                rec["external"] = r.InternalOrExternalBoundary == "EXTERNAL"
            rels.append(rec)
        for r in f.by_type("IfcRelConnectsElements"):
            if r.RelatingElement is None or r.RelatedElement is None:
                continue
            rec = {"kind": "connects", "elementIds": [r.RelatingElement.GlobalId, r.RelatedElement.GlobalId]}
            if r.is_a("IfcRelConnectsPathElements"):
                rec["connectionType"] = f"{r.RelatingConnectionType}-{r.RelatedConnectionType}"
            rels.append(rec)
        for r in f.by_type("IfcRelAssignsToGroup"):
            g = r.RelatingGroup
            ids = [gid(o) for o in r.RelatedObjects if gid(o)]
            if g.is_a("IfcSystem") and not g.is_a("IfcZone"):
                rels.append({"kind": "assigned_to_system", "systemId": g.GlobalId, "elementIds": ids})
            else:
                rels.append({"kind": "assigned_to_group", "groupId": g.GlobalId, "elementIds": ids})
        for r in f.by_type("IfcRelCoversBldgElements"):
            rels.append({"kind": "covers", "elementId": r.RelatingBuildingElement.GlobalId,
                         "coveringIds": [c.GlobalId for c in r.RelatedCoverings]})
        for r in f.by_type("IfcRelCoversSpaces"):
            space = r.RelatedSpace if self.schema == "IFC2X3" else r.RelatingSpace
            rels.append({"kind": "space_covered", "spaceId": space.GlobalId,
                         "coveringIds": [c.GlobalId for c in r.RelatedCoverings]})

        self.faces_and_rooms(elements, spatial)

        # verification ----------------------------------------------------
        with np.errstate(all="ignore"):
            self.verify(elements, materials, openings)

        # discipline guess -------------------------------------------------
        def count(classes):
            return sum(1 for e in f.by_type("IfcElement") if is_any(e, classes))
        mep, struct, arch = count(MEP_ROOTS), count(STRUCT_CLASSES), count(ARCH_CLASSES) + len(f.by_type("IfcSpace"))
        total = max(1, len(elements))
        # IFC4.3 bridges, roads, railways... (IfcBuilding is an IfcFacility too, so name the others)
        infra = any(self.has_type(c) for c in INFRA_FACILITIES)
        if infra and not f.by_type("IfcBuilding"):
            guess = "infrastructure"
        elif mep / total > 0.6:
            guess = "mep"
        elif arch == 0 and struct > 0:
            guess = "structure"
        elif arch > 0 and mep / total > 0.25:
            guess = "mixed"
        elif arch > 0:
            guess = "architecture"
        elif infra:
            guess = "mixed"
        else:
            guess = "unknown"
        header["disciplineGuess"] = guess

        self.group_checks(elements)
        summary = {}
        for c in self.checks:
            summary[c["code"]] = summary.get(c["code"], 0) + 1
        header["parse"]["durationMs"] = int((time.time() - t0) * 1000)
        doc = {
            "schemaVersion": "1.0",
            "header": header,
            "spatial": spatial,
            "catalogues": {"types": types, "materials": materials, "layerSets": layer_sets, "profiles": profiles,
                           "systems": systems, "classifications": classifications},
            "elements": elements,
            "openings": openings,
            "relationships": rels,
            "verification": {"tolerance": TOLERANCE, "checks": self.checks, "summary": summary},
            "geometry": {"format": "glb", "uri": "geometry.glb", "addressing": "node_name", "worldCoordinates": True},
            "stats": {"elementCount": len(elements), "openingCount": len(openings),
                      "spaceCount": sum(1 for s in spatial if s["kind"] == "space"), "byClass": by_class},
        }
        return doc

    # ----- faces and rooms -----
    def faces_and_rooms(self, elements, spatial):
        """Geometry only (decisions are in measure.py; the measuring is in geometry.py):
        - spaces: floor, ceiling and wall surface of the room solid, floor perimeter, height
        - planar elements: area of the faces on each side of the thin axis (openings already cut),
          and the area of every room surface lying on a side (clipped to the element's extent)."""
        rooms = {}
        for s in spatial:
            if s["kind"] != "space" or s["id"] not in self.meshes:
                continue
            m = self.meshes[s["id"]]
            s["geometry"]["room"] = {k: r6(v) for k, v in geometry.room_surfaces(m).items()}
            rooms[s["id"]] = geometry.room_index(m)
        for e in elements:
            g = e["quantities"]["geometry"]
            if e["ifcClassBase"] not in FACE_CLASSES or e["id"] not in self.meshes or not g.get("obbAxes"):
                continue
            m = self.meshes[e["id"]]
            sides = geometry.element_sides(m, g["obbAxes"])
            g["sides"] = {"axis": vec(sides["axis"]), "a": r6(sides["a"]), "b": r6(sides["b"])}
            contacts = geometry.side_contacts(m, sides["axis"], g["obbAxes"], rooms) if rooms else []
            if contacts:
                g["contacts"] = contacts

    # ----- verification -----
    def verify(self, elements, materials, openings):
        f = self.f
        if not f.by_type("IfcElementQuantity"):
            self.check("no_quantities", "info", [], "No IFC quantity sets (BaseQuantities / Qto_*) in the file; "
                       "only authoring-tool property values and geometry are available.")
        mat_by_id = {m["id"]: m["name"] for m in materials}
        elem_by_id = {e["id"]: e for e in elements}
        for e in elements:
            g = e["quantities"]["geometry"]
            ent = f.by_guid(e["id"])
            has_children_geo = any(elem_by_id.get(c, {}).get("quantities", {}).get("geometry", {}).get("hasBody")
                                   for c in e["childIds"])
            if not g.get("hasBody") and not has_children_geo and (e["ifcClassBase"] != "IfcElementAssembly" or not e["childIds"]):
                self.check("no_geometry", "warning", [e["id"]], f"{e['ifcClass']} '{e.get('name', '')}' has no body geometry"
                           + (" and no parts (its parts may be in another model)." if e["ifcClassBase"] == "IfcElementAssembly" else "."))
            if g.get("normalsRepaired"):
                self.check("inconsistent_winding", "warning", [e["id"]],
                           f"Mesh had inconsistent face winding ({', '.join(g['representationTypes']) or 'unknown representation'}); "
                           f"repaired before measuring.", volumeBeforeRepair=g.get("volumeBeforeRepair"), volume=g.get("volume"))
            if g.get("hasBody") and g.get("closed") is False:
                self.check("not_watertight", "info", [e["id"]], "Mesh is not closed; geometric volume is unreliable.")
            # reported vs geometry volume (any source that names a volume)
            gv = g.get("volume")
            reported = None
            for src_name, src in list(e["quantities"]["reported"].items()) + list(e["psets"].items()):
                for k in ("NetVolume", "GrossVolume", "Volume"):
                    if isinstance(src.get(k), (int, float)) and src.get(k):
                        reported = (src_name, k, src[k])
                        break
                if reported:
                    break
            if reported and gv:
                diff = (gv - reported[2]) / reported[2]
                if abs(diff) > TOLERANCE:
                    self.check("volume_mismatch", "warning", [e["id"]],
                               f"Geometry volume {gv:.3f} m3 vs reported {reported[2]:.3f} m3 ({diff:+.1%}) "
                               f"from {reported[0]}.{reported[1]}.",
                               reported=reported[2], geometry=gv, relativeDifference=round(diff, 4), source=f"{reported[0]}.{reported[1]}")
            parent_has_mat = "materialRef" in elem_by_id.get(e.get("parentId", ""), {})
            if not parent_has_mat and e.get("parentId"):
                pe = f.by_guid(e["parentId"])
                parent_has_mat = ue.get_material(pe, should_inherit=True) is not None
            if is_any(ent, NEEDS_MATERIAL) and "materialRef" not in e and not parent_has_mat:
                self.check("no_material", "warning", [e["id"]], f"{e['ifcClass']} '{e.get('name', '')}' has no material.")
            if e["ifcClassBase"] in ("IfcBuildingElementProxy", "IfcBuiltElement"):   # IFC4.3 generic built element too
                self.check("proxy_element", "info", [e["id"]], f"Unclassified object '{e.get('name', '')}' ({e['ifcClass']}).")
            if "storeyId" not in e and self.in_building(ent):
                self.check("unassigned_storey", "info", [e["id"]], f"{e['ifcClass']} '{e.get('name', '')}' has no storey.")
            # door/window external flag vs host
            if e.get("hostId") and e["hostId"] in elem_by_id:
                def ext(x):
                    for ps, props in x["psets"].items():
                        if ps.startswith("Pset_") and ps.endswith("Common") and "IsExternal" in props:
                            return props["IsExternal"]
                    return None
                a, b = ext(e), ext(elem_by_id[e["hostId"]])
                if a is not None and b is not None and a != b:
                    self.check("flag_conflict", "info", [e["id"], e["hostId"]],
                               f"IsExternal = {a} on {e['ifcClass']} but {b} on its host.")
            # placeholder values: property value equals its own name
            for ps, props in e["psets"].items():
                bad = [k for k, v in props.items() if isinstance(v, str) and v.strip() == k.strip()]
                if bad:
                    self.check("placeholder_value", "info", [e["id"]],
                               f"Placeholder values in {ps}: {', '.join(bad[:5])}{'...' if len(bad) > 5 else ''}.",
                               pset=ps, count=len(bad))
        # materials whose names look like the same thing
        names = sorted({n for n in mat_by_id.values() if n})
        for a, b in itertools.combinations(names, 2):
            if a.lower() == b.lower() or b.lower().startswith(a.lower() + " - ") or a.lower().startswith(b.lower() + " - "):
                self.check("duplicate_material_name", "info", [], f"Materials '{a}' and '{b}' may be the same material.",
                           a=a, b=b)
        # solid overlaps (sweep along x: only pairs whose boxes overlap are intersected). Each
        # element keeps what it shares with others (measure.py turns columns through slabs into
        # `embedded`); larger ones are also reported as checks.
        if self.do_overlaps:
            cand = sorted((e["id"] for e in elements if e["id"] in self.meshes
                           and any(f.by_guid(e["id"]).is_a(c) for c in OVERLAP_CLASSES)),
                          key=lambda g: self.meshes[g].bounds[0][0])
            for i, a in enumerate(cand):
                A = self.meshes[a]
                for b in cand[i + 1:]:
                    B = self.meshes[b]
                    if B.bounds[0][0] >= A.bounds[1][0] - 1e-4:
                        break
                    vol = geometry.shared_volume(A, B)
                    if not vol or vol <= OVERLAP_MIN_M3:
                        continue
                    ea, eb = elem_by_id[a], elem_by_id[b]
                    for x, y in ((ea, b), (eb, a)):
                        x["quantities"]["geometry"].setdefault("intersections", []).append({"elementId": y, "volume": r6(vol)})
                    self.check("overlap", "warning" if vol > 0.05 else "info", [a, b],
                               f"{ea['ifcClassBase']} '{ea.get('name', '')}' and {eb['ifcClassBase']} '{eb.get('name', '')}' "
                               f"overlap by {vol:.3f} m3.", volume=r6(vol))

    GROUPED = ("inconsistent_winding", "not_watertight", "placeholder_value", "unassigned_storey", "proxy_element")

    def group_checks(self, elements):
        """Collapse per-element informational checks into one check per (code, class).
        Per-element detail stays on the element itself (geometry.normalsRepaired, watertight...)."""
        cls = {e["id"]: e["ifcClassBase"] for e in elements}
        keep, groups = [], {}
        for c in self.checks:
            if c["code"] in self.GROUPED and len(c["elementIds"]) == 1:
                extra = c.get("data", {}).get("pset", "")
                klass = "" if c["code"] == "placeholder_value" else cls.get(c["elementIds"][0], "?")
                groups.setdefault((c["code"], klass, extra), []).append(c)
            else:
                keep.append(c)
        for (code, klass, extra), cs in groups.items():
            ids = [c["elementIds"][0] for c in cs]
            label = {"inconsistent_winding": "had inconsistent face winding (repaired before measuring)",
                     "not_watertight": "are not watertight (geometric volume unreliable)",
                     "placeholder_value": f"carry placeholder values in {extra}",
                     "unassigned_storey": "have no storey",
                     "proxy_element": "are unclassified proxies"}[code]
            keep.append(dict(id="", code=code, severity=cs[0]["severity"], elementIds=ids,
                             message=f"{len(ids)} {klass + ' ' if klass else ''}element(s) {label}.",
                             data={"ifcClass": klass or "any", "count": len(ids)}))
        for i, c in enumerate(keep, 1):
            c["id"] = f"chk-{i:04d}"
        self.checks = keep

    def export_glb(self, out_path):
        scene = trimesh.Scene()
        for guid, m in self.meshes.items():
            scene.add_geometry(m, node_name=guid, geom_name=guid)
        scene.export(out_path)


def parse_file(path: str, overlaps: bool = True):
    """Parse one IFC file. Returns (ParsedModel dict, Parser) - keep the parser to export geometry."""
    p = Parser(path, overlaps=overlaps)
    return p.parse(), p


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ifc")
    ap.add_argument("out_dir")
    ap.add_argument("--schema", help="validate output against this JSON Schema")
    ap.add_argument("--no-overlaps", action="store_true", help="skip pairwise solid-overlap checks")
    args = ap.parse_args(argv)
    os.makedirs(args.out_dir, exist_ok=True)
    p = Parser(args.ifc, overlaps=not args.no_overlaps)
    doc = p.parse()
    out_json = os.path.join(args.out_dir, "parsed.json")
    with open(out_json, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=1)
    p.export_glb(os.path.join(args.out_dir, "geometry.glb"))
    geometry.save_meshes(p.meshes, os.path.join(args.out_dir, "meshes.npz"))
    if args.schema:
        import jsonschema
        jsonschema.validate(doc, json.load(open(args.schema, encoding="utf-8")))
        print("schema: valid")
    s = doc["stats"]
    print(f"parsed {s['elementCount']} elements, {s['openingCount']} openings, {s['spaceCount']} spaces "
          f"in {doc['header']['parse']['durationMs']} ms; {len(doc['verification']['checks'])} checks -> {out_json}")


if __name__ == "__main__":
    sys.exit(main())
