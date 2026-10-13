"""
geometry.py - mesh measurements shared by parse.py (within one file) and federation.py (across files).

Core engine: meshes in, numbers out. No IFC, no decisions (which number to trust is measure.py's).

  room_surfaces    a room solid's floor / ceiling / wall areas, perimeter, height
  element_sides    a planar element's face area on each side of its thin axis
  side_contacts    where a room's surface lies on a side of a planar element (m2 per room and side)
  shared_volume    solid volume two closed meshes have in common (columns through slabs, duplicates)

Mesh sidecar: every mesh the parser built (elements, openings, spaces), in world coordinates and
float64, saved beside the ParsedModel (`meshes.npz`, save_meshes / load_meshes). The ParsedModel
carries measurements, not meshes; work that needs two models' meshes together (room contacts and
solid overlaps across a federation) reads the sidecar. Without it that work is skipped and logged.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import trimesh

CONTACT_TOL = 0.1    # m: a room surface this close to an element face, and facing it, lies on it
SHARED_MIN = 1e-3    # m3: solids sharing less than this only touch


def clip_area(poly: list, ur: tuple, vr: tuple) -> float:
    """Area of a 2D polygon inside the rectangle ur x vr (Sutherland-Hodgman clipping)."""
    def clip(pts, axis, val, keep_ge):
        out = []
        for i in range(len(pts)):
            p, q = pts[i], pts[(i + 1) % len(pts)]
            pin = p[axis] >= val if keep_ge else p[axis] <= val
            qin = q[axis] >= val if keep_ge else q[axis] <= val
            if pin:
                out.append(p)
            if pin != qin:
                t = (val - p[axis]) / (q[axis] - p[axis])
                out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
        return out
    pts = poly
    for axis, val, ge in ((0, ur[0], True), (0, ur[1], False), (1, vr[0], True), (1, vr[1], False)):
        pts = clip(pts, axis, val, ge)
        if len(pts) < 3:
            return 0.0
    return abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))) / 2


def room_surfaces(m: trimesh.Trimesh) -> dict:
    """Floor (facing down), ceiling (facing up) and wall (vertical) area of a room solid, the floor
    outline length and the height."""
    nz, area = m.face_normals[:, 2], m.area_faces
    floor, ceil, wall = nz < -0.9, nz > 0.9, np.abs(nz) < 0.1
    perimeter = 0.0
    if floor.any():                     # edges used by one floor triangle only: the outline
        fe = np.sort(m.faces[floor][:, [0, 1, 1, 2, 2, 0]].reshape(-1, 2), axis=1)
        uniq, counts = np.unique(fe, axis=0, return_counts=True)
        b = uniq[counts == 1]
        perimeter = float(np.linalg.norm(m.vertices[b[:, 0]] - m.vertices[b[:, 1]], axis=1).sum())
    return {"floorArea": float(area[floor].sum()), "ceilingArea": float(area[ceil].sum()),
            "wallArea": float(area[wall].sum()), "perimeter": perimeter,
            "height": float(np.ptp(m.vertices[:, 2]))}


def thin_axis(obb_axes) -> np.ndarray:
    """The oriented box's thin axis with a stable sign: up for slabs, else the first clear
    horizontal component positive."""
    n = np.array(obb_axes[2], dtype=float)
    k = 2 if abs(n[2]) > 0.5 else (0 if abs(n[0]) > 1e-6 else 1)
    return n if n[k] > 0 else -n


def element_sides(m: trimesh.Trimesh, obb_axes) -> dict:
    """{axis, a, b}: area of the mesh faces facing along (a) and against (b) the thin axis."""
    n = thin_axis(obb_axes)
    dots = m.face_normals @ n
    return {"axis": [float(v) for v in n], "a": float(m.area_faces[dots > 0.9].sum()),
            "b": float(m.area_faces[dots < -0.9].sum())}


def room_index(m: trimesh.Trimesh) -> tuple:
    """What side_contacts needs of a room solid."""
    return (m, m.triangles_center, m.face_normals, m.vertices.min(0), m.vertices.max(0))


def side_contacts(m: trimesh.Trimesh, axis, obb_axes, rooms: dict) -> list[dict]:
    """[{spaceId, side, area}]: the area of each room surface lying on side a or b of a planar
    element (facing it, within CONTACT_TOL), clipped to the element's extent along its face."""
    n = np.asarray(axis, dtype=float)
    proj = m.vertices @ n
    da, db = proj.max(), proj.min()
    u, v = np.array(obb_axes[0], dtype=float), np.array(obb_axes[1], dtype=float)
    ur = (float((m.vertices @ u).min()), float((m.vertices @ u).max()))
    vr = (float((m.vertices @ v).min()), float((m.vertices @ v).max()))
    lo, hi = m.vertices.min(0) - CONTACT_TOL, m.vertices.max(0) + CONTACT_TOL
    out = []
    for sid, (rm, cen, nrm, rlo, rhi) in rooms.items():
        if np.any(rhi < lo) or np.any(rlo > hi):
            continue
        rd, rc = nrm @ n, cen @ n
        # a room on side a faces back towards the element (its outward normal is -n)
        for side, mask in (("a", (rd < -0.9) & (np.abs(rc - da) < CONTACT_TOL)),
                           ("b", (rd > 0.9) & (np.abs(rc - db) < CONTACT_TOL))):
            if not mask.any():
                continue
            a = sum(clip_area([(float(p @ u), float(p @ v)) for p in tri], ur, vr) for tri in rm.vertices[rm.faces[mask]])
            if a > 0.01:
                out.append({"spaceId": sid, "side": side, "area": round(a, 6)})
    return out


def boxes_touch(a: trimesh.Trimesh, b: trimesh.Trimesh, gap: float = 1e-4) -> bool:
    lo, hi = np.maximum(a.bounds[0], b.bounds[0]), np.minimum(a.bounds[1], b.bounds[1])
    return bool(np.all(hi - lo > gap))


def shared_volume(a: trimesh.Trimesh, b: trimesh.Trimesh) -> float | None:
    """Volume of the intersection of two solids (m3); 0 when their boxes do not overlap, None when
    the boolean fails (open or broken meshes)."""
    if not boxes_touch(a, b):
        return 0.0
    try:
        return abs(float(a.intersection(b, engine="manifold").volume))
    except Exception:
        return None


def save_meshes(meshes: dict[str, trimesh.Trimesh], path: str | Path):
    ids = list(meshes)
    verts = [np.asarray(meshes[i].vertices, dtype=np.float64) for i in ids]
    faces = [np.asarray(meshes[i].faces, dtype=np.int32) for i in ids]
    np.savez_compressed(path, ids=np.array(ids), vcount=np.array([len(v) for v in verts], dtype=np.int64),
                        fcount=np.array([len(f) for f in faces], dtype=np.int64),
                        verts=np.concatenate(verts) if verts else np.zeros((0, 3)),
                        faces=np.concatenate(faces) if faces else np.zeros((0, 3), dtype=np.int32))


def load_meshes(path: str | Path) -> dict[str, trimesh.Trimesh]:
    d = np.load(path, allow_pickle=False)
    out, vo, fo = {}, 0, 0
    for i, nv, nf in zip(d["ids"], d["vcount"], d["fcount"]):
        out[str(i)] = trimesh.Trimesh(d["verts"][vo:vo + nv], d["faces"][fo:fo + nf], process=False)
        vo, fo = vo + nv, fo + nf
    return out
