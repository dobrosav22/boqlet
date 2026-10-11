"""Stage 1 - Extract: raw IFC -> unified JSON (one record per physical element + spaces).
Pulls three independent things per element: (a) quantities the authoring tool reported,
(b) quantities measured from the actual geometry, (c) semantic context (type, storey, material
layers, hosting/aggregation). Nothing is decided here - this is a faithful snapshot."""
import ifcopenshell, ifcopenshell.geom, ifcopenshell.util.element as ue
import numpy as np, trimesh, json, multiprocessing, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/user-data/uploads/Ifc2x3_Duplex_Architecture.ifc'
f = ifcopenshell.open(SRC)

# ---------- geometry pass (world coords, openings already subtracted by the kernel) ----------
s = ifcopenshell.geom.settings(); s.set('use-world-coords', True)
it = ifcopenshell.geom.iterator(s, f, multiprocessing.cpu_count(), exclude=('IfcOpeningElement',))
geo = {}
if it.initialize():
    while True:
        sh = it.get()
        v = np.array(sh.geometry.verts).reshape(-1, 3); fc = np.array(sh.geometry.faces).reshape(-1, 3)
        m = trimesh.Trimesh(v, fc, process=True)
        raw_vol = abs(m.volume)
        fixed = False
        if not m.is_winding_consistent:          # surface-model exports often have flipped faces
            trimesh.repair.fix_normals(m); fixed = True
        geo[sh.id] = dict(volume=abs(m.volume), surface_area=m.area, watertight=bool(m.is_watertight),
                          normals_fixed=fixed, raw_volume_before_fix=raw_vol if fixed else None,
                          bbox_min=v.min(0).round(4).tolist(), bbox_max=v.max(0).round(4).tolist(),
                          z_min=float(v[:, 2].min()), z_max=float(v[:, 2].max()))
        if not it.next(): break

def storey_of(e):
    if e.is_a('IfcSpace'):
        a = ue.get_aggregate(e); return a.Name if a else None
    c = ue.get_container(e)
    while c is not None and not c.is_a('IfcBuildingStorey'):
        c = ue.get_aggregate(c) if c.is_a('IfcSpace') else None
    if c is None:                         # aggregated parts (roof slab, stair flights) -> parent's storey
        p = ue.get_aggregate(e)
        return storey_of(p) if p else None
    return c.Name

def material_of(e):
    m = ue.get_material(e)
    if m is None: return None
    if m.is_a('IfcMaterialLayerSetUsage'):
        ls = m.ForLayerSet
        return dict(kind='layerset', name=ls.LayerSetName,
                    layers=[dict(material=l.Material.Name if l.Material else None, thickness=l.LayerThickness)
                            for l in ls.MaterialLayers])
    if m.is_a('IfcMaterial'): return dict(kind='single', name=m.Name, layers=[])
    return dict(kind=m.is_a(), name=str(getattr(m, 'Name', None)), layers=[])

def split_name(n):
    parts = (n or '').split(':')
    # Revit pattern: Family:Type[:Type]:ElementId
    fam = parts[0] if parts else ''
    typ = parts[1] if len(parts) > 2 else ''
    return fam, typ, parts[-1]

records = []
targets = [e for e in f.by_type('IfcProduct')
           if e.is_a('IfcElement') and not e.is_a('IfcOpeningElement')] + list(f.by_type('IfcSpace'))
for e in targets:
    ps = ue.get_psets(e)
    fam, typ, rid = split_name(e.Name)
    rep = {k: v for k, v in ps.get('PSet_Revit_Dimensions', {}).items() if k != 'id'}
    common = next((v for k, v in ps.items() if k.startswith('Pset_') and k.endswith('Common')), {})
    parent = ue.get_aggregate(e)
    children = [c for c in (ue.get_decomposition(e) or []) if c.is_a('IfcElement')]
    g = geo.get(e.id())
    if g is None and children:            # container objects (IfcRoof, IfcStair): sum their parts
        kids = [geo[c.id()] for c in children if c.id() in geo]
        if kids:
            g = dict(volume=sum(k['volume'] for k in kids), surface_area=sum(k['surface_area'] for k in kids),
                     watertight=all(k['watertight'] for k in kids), normals_fixed=any(k['normals_fixed'] for k in kids),
                     from_children=True)
    host = None
    if e.is_a('IfcDoor') or e.is_a('IfcWindow'):
        for r in e.FillsVoids:
            host = r.RelatingOpeningElement.VoidsElements[0].RelatingBuildingElement.GlobalId
    rec = dict(
        guid=e.GlobalId, ifc_class=e.is_a(), name=e.Name, family=fam, type=typ, revit_id=rid,
        predefined_type=str(getattr(e, 'PredefinedType', None) or ''),
        storey=storey_of(e), phase=ps.get('PSet_Revit_Phasing', {}).get('Phase Created'),
        parent_guid=parent.GlobalId if parent and parent.is_a('IfcElement') else None,
        child_guids=[c.GlobalId for c in children], host_guid=host,
        is_external=common.get('IsExternal'), load_bearing=common.get('LoadBearing'),
        reported=rep,
        attrs={k: getattr(e, k) for k in ('OverallWidth', 'OverallHeight') if hasattr(e, k) and getattr(e, k)},
        common_pset={k: v for k, v in common.items() if k != 'id'},
        material=material_of(e), geometry=g,
        openings=[r.RelatedOpeningElement.GlobalId for r in getattr(e, 'HasOpenings', [])],
    )
    if e.is_a('IfcSpace'):
        idd = ps.get('PSet_Revit_Identity Data', {})
        rec.update(number=e.Name, room_name=idd.get('Name') or e.LongName,
                   gsa_area=ps.get('GSA Space Areas', {}).get('GSA BIM Area'),
                   category=ps.get('PSet_Revit_Other', {}).get('Category Description'))
    records.append(rec)

meta = dict(source=SRC.split('/')[-1], schema=f.schema,
            authoring_app=f.by_type('IfcApplication')[0].ApplicationFullName,
            units={u.UnitType: (u.Prefix or '') + u.Name for u in f.by_type('IfcSIUnit')},
            storeys={s.Name: s.Elevation for s in f.by_type('IfcBuildingStorey')},
            element_count=len(records))
json.dump(dict(meta=meta, elements=records), open('unified.json', 'w'), indent=1, default=float)
print('wrote', len(records), 'records;', sum(1 for r in records if r['geometry']), 'with geometry')
