"""Stage 2 - Classify & measure: unified JSON -> element register + QA log.
Each element gets (1) a BoQ item key, (2) adopted quantities with a stated source,
(3) a verification result (reported vs geometry). Rules are data-driven tables below."""
import json, re

d = json.load(open('unified.json'))
E = {r['guid']: r for r in d['elements']}
overlaps = json.load(open('overlaps.json'))

# ---- rule table 1: (ifc_class, type-substring, storey or None) -> BoQ key ---------------------
TYPE_RULES = [
    ('IfcFooting', 'Bearing Footing - 900 x 300', None, '1.01'),
    ('IfcWall', 'Foundation - Concrete (417mm)', None, '1.03'),
    ('IfcWall', 'Foundation - Concrete (435mm)', None, '1.04'),
    ('IfcSlab', '127mm Slab on Grade', None, '1.06'),
    ('IfcBeam', 'W310X60', None, '2.1.1'),
    ('IfcBeam', 'W410X60', None, '2.1.2'),
    ('IfcSlab', 'Residential - Wood Joist with Subflooring', None, '2.2.1'),
    ('IfcRoof', 'Live Roof over Wood Joist Flat Roof', None, '2.3.1'),
    ('IfcWindow', '1180 x 1170mm', None, '2.3.2'),
    ('IfcStair', 'Residential - 200mm Max Riser', None, '2.4.1'),
    ('IfcRailing', '900mm Handrail Only', None, '2.4.2'),
    ('IfcRailing', '1100mm Guard Rail', None, '2.4.3'),
    ('IfcWall', 'Exterior - Brick on Block', 'Roof', '2.5.2'),
    ('IfcWall', 'Exterior - Brick on Block', None, '2.5.1'),
    ('IfcWindow', 'M_Fixed:4835mm x 2420mm', None, '2.6.1'),
    ('IfcWindow', 'M_Fixed:2800mm x 2410mm', None, '2.6.2'),
    ('IfcWindow', 'M_Fixed:750mm x 2200mm', None, '2.6.3'),
    ('IfcWindow', 'M_Fixed:819mm x 759mm', None, '2.6.4'),
    ('IfcWindow', 'M_Casement:819mm x 759mm', None, '2.6.5'),
    ('IfcDoor', '1250mm x 2010mm', None, '2.6.6'),
    ('IfcDoor', '0813 x 2420mm', None, '2.6.7'),
    ('IfcWall', 'Party Wall - CMU', None, '2.7.1'),
    ('IfcWall', 'Interior - Partition (92mm Stud)', None, '2.7.2'),
    ('IfcWall', 'Interior - Plumbing (152mm Stud)', None, '2.7.3'),
    ('IfcWall', 'Interior - Furring (152 mm Stud)', None, '2.7.4'),
    ('IfcWall', 'Interior - Furring (38 mm Stud)', None, '2.7.5'),
    ('IfcDoor', '0762 x 2032mm', None, '2.8.1'),
    ('IfcDoor', '0864 x 2032mm', None, '2.8.2'),
    ('IfcSlab', 'Finish Floor - Wood', None, '3.2.1'),
    ('IfcSlab', 'Finish Floor - Ceramic Tile', None, '3.2.2'),
    ('IfcCovering', 'Compound Ceiling:Gypsum Board', None, '3.3.1'),
    ('IfcFurnishingElement', 'Base Cabinet-Double Door & 2 Drawer', None, '4.1.1'),
    ('IfcFurnishingElement', 'Upper Cabinet-Double Door-Wall', None, '4.1.2'),
    ('IfcFurnishingElement', 'Tall Cabinet-Single Door', None, '4.1.3'),
    ('IfcFurnishingElement', 'Counter Top w Sink Hole', None, '4.1.4'),
    ('IfcFurnishingElement', 'M_Counter Top:', None, '4.1.5'),
    ('IfcFurnishingElement', 'Vanity Cabinet-Double Door Sink Unit:450', None, '4.1.6'),
    ('IfcFurnishingElement', 'Vanity Cabinet-Double Door Sink Unit:650', None, '4.1.7'),
    ('IfcFurnishingElement', 'Bed-Standard:1525', None, '4.2.1'),
    ('IfcFurnishingElement', 'Bed-Standard:1981', None, '4.2.2'),
    ('IfcFurnishingElement', 'M_Sofa', None, '4.2.3'),
    ('IfcFurnishingElement', 'Table-Coffee:0610', None, '4.2.4'),
    ('IfcFurnishingElement', 'Table-Coffee:0915', None, '4.2.5'),
    ('IfcSlab', '150mm Exterior Slab on Grade', None, '8.1'),
]
TOL = 0.01   # 1 % reported-vs-geometry tolerance

def key_for(r):
    if r['parent_guid'] and E[r['parent_guid']]['ifc_class'] in ('IfcRoof', 'IfcStair') and r['ifc_class'] != 'IfcRailing':
        return 'EXCL'
    for cls, sub, storey, key in TYPE_RULES:
        if r['ifc_class'].startswith(cls) and sub in r['name'] and (storey is None or r['storey'] == storey):
            return key
    return 'UNMAPPED'

overlap_by = {}
for o in overlaps:
    for g in (o['a'], o['b']):
        overlap_by.setdefault(g, []).append(o)

reg, qa = [], []
for r in d['elements']:
    if r['ifc_class'] == 'IfcSpace': continue
    rep, g = r['reported'], r['geometry'] or {}
    key = key_for(r)
    layers = (r['material'] or {}).get('layers') or []
    t_mm = round(sum(l['thickness'] for l in layers) * 1000, 1) if layers else None
    rv, gv = rep.get('Volume'), g.get('volume')
    row = dict(guid=r['guid'], ifc_class=r['ifc_class'], family=r['family'], type=r['type'], storey=r['storey'],
               key=key, count=1, length=rep.get('Length'), area=None, area_formula=False, volume=None,
               perimeter=rep.get('Perimeter'), t_mm=t_mm, rep_area=rep.get('Area'), rep_vol=rv, geo_vol=gv,
               kg_per_m=None, source='', flag='', revit_id=r['revit_id'], width=r['attrs'].get('OverallWidth'),
               height=r['attrs'].get('OverallHeight'), host=r['host_guid'], is_ext=r['is_external'])
    if key == 'EXCL':
        row.update(count=0, source=f"Aggregated part of {E[r['parent_guid']]['ifc_class']} - measured at parent (avoids double count)")
        row['geo_vol'] = gv; reg.append(row); continue

    # ---- adopt volume: reported if it agrees with geometry, investigate if not ----
    if rv:
        dv = (gv - rv) / rv if gv else None
        row['volume'] = rv
        if dv is not None and abs(dv) <= TOL:
            row['source'] = 'Reported (Revit), geometry-verified'
        else:
            ov = sum(o['volume'] for o in overlap_by.get(r['guid'], []) if 'Party Wall' in o['a_name'] and 'Party Wall' in o['b_name'])
            if r['ifc_class'] == 'IfcBeam':
                row['source'] = f'Reported (Revit); geometry {dv:+.1%} - steel measured by nominal mass instead'
                row['flag'] = 'Minor'
            elif ov and abs((gv - ov) - rv) / rv < 0.06:
                row['source'] = f'Reported (Revit); geometry {dv:+.1%} = {ov:.3f} m3 junction overlap with adjacent party walls. Reported value is join-aware -> adopted'
                row['flag'] = 'Resolved'
            else:
                row['source'] = f'Reported (Revit); geometry differs {dv:+.1%} - unresolved'; row['flag'] = 'Check'
        if g.get('normals_fixed') and gv:
            row['source'] += '; mesh had inconsistent face winding (repaired before measuring)'
    elif gv and r['ifc_class'] in ('IfcStair',):
        row['volume'] = gv; row['source'] = 'Geometry (sum of child solids: flight, stringers, rails) - for information; no reported quantities'

    # ---- adopt area ----
    if r['ifc_class'].startswith('IfcWall') and t_mm:
        row['area_formula'] = True   # Area = Volume / layer-set thickness (written as live formula)
        if rep.get('Area') and abs(rep['Area'] - rv / (t_mm / 1000)) > 0.05:
            row['flag'] = row['flag'] or 'Resolved'
            row['source'] += f"; Revit Area ({rep['Area']:.2f}) inconsistent with Volume/thickness ({rv/(t_mm/1000):.2f}) - V/t adopted"
        elif not rep.get('Area'):
            row['source'] += '; no reported Area - V/t used'
    elif rep.get('Area'):
        row['area'] = rep['Area']
        if t_mm and rv and abs(rep['Area'] - rv / (t_mm / 1000)) / rep['Area'] > TOL:
            row['flag'] = 'Check'; row['source'] += '; Area vs V/t mismatch'

    if r['ifc_class'] == 'IfcBeam':
        row['kg_per_m'] = float(re.search(r'X(\d+)', r['type']).group(1))
    if r['ifc_class'] in ('IfcDoor', 'IfcWindow', 'IfcFurnishingElement', 'IfcRailing'):
        row['source'] = row['source'] or ('Count' if r['ifc_class'] != 'IfcRailing' else '')
        if r['ifc_class'] == 'IfcRailing': row['source'] = 'Reported length (Revit)'
    if r['ifc_class'] == 'IfcFooting' and not r['material']:
        row['source'] += '; no material assigned in IFC - concrete assumed from type name'
    if key == 'UNMAPPED': row['flag'] = 'Check'
    reg.append(row)

# ---- QA log (model-level findings) -------------------------------------------------------
def n(k): return sum(1 for x in reg if x['key'] == k)
pw = [x for x in reg if x['key'] == '2.7.1']
qa += [
 ('Info', 'Whole model', 'No IFC BaseQuantities present (Revit 2011 export). Only PSet_Revit_Dimensions and GSA space areas.',
  'Used Revit-reported values as primary source and recomputed every solid from geometry as an independent check.'),
 ('Resolved', 'Party wall 2.7.1 (Level 2, IfcWall)', 'Body exported as IfcFaceBasedSurfaceModel with inconsistent face winding: naive mesh volume 432.97 m3 vs reported 25.83 m3.',
  'Repaired normals before measuring; repaired volume 25.830 m3 matches reported exactly.'),
 ('Resolved', 'Party wall 2.7.1 (Level 1, 2.2 m stub)', 'Geometry 2.856 m3 vs reported 2.011 m3 (+42%). Solid-intersection test shows two 0.379 m3 overlaps with the adjacent party walls at T-junctions.',
  'Adopted reported (join-aware) volume. Geometry minus overlaps = 2.098 m3, within ~4% of reported.'),
 ('Resolved', 'Walls 2.5.1 (Level 2) and 2.7.1 (Level 1)', 'Revit "Area" does not equal Volume / layer-set thickness on 7 walls: the 4 Level 2 exterior walls differ by ~1.2 m2 each (matches two 819x759 windows not deducted from Area but deducted from Volume); the party walls differ by 1.2-8.6 m2.',
  'Wall areas adopted as Volume / thickness for every wall, so area, volume and material layers are internally consistent. Opening add-back threshold is a parameter.'),
 ('Minor', 'Steel beams 2.1.x', 'Geometric volume 3.5-4.7% above Revit volume.',
  'Steel measured by length x nominal mass per metre (W-section designation), with volume x density as a cross-check in the register.'),
 ('Check', 'Ceilings 3.3.1 (187462 / 187470)', f"Two ceiling elements overlap by {next(o['volume'] for o in overlaps if '187462' in o['a_name'] and '187470' in o['b_name']):.3f} m3 (~3.2 m2 of ceiling modelled twice).",
  'Not auto-deducted. Flagged for the modeller; possible over-measure of ~3.2 m2.'),
 ('Info', 'Beams vs exterior walls; partitions vs floor zone', 'Remaining solid overlaps (beam bearings inside brick walls, partitions running through the joist floor, ceilings clipping walls) total ~0.9 m3.',
  'Treated as normal modelling tolerance; each element measured on its own. Listed in overlaps.json.'),
 ('Info', 'IfcRoof / IfcStair', 'Roof geometry lives on a child IfcSlab; stairs are aggregates of flights, stringers (IfcMember) and railings.',
  'Measured at the parent object; child parts kept in register with count 0 (except railings, which are measured as their own items).'),
 ('Assumption', 'Strip footings 1.01', 'No material association on IfcFooting.', 'Concrete assumed from type name "Bearing Footing - 900 x 300"; 300 mm depth used for formwork derivation.'),
 ('Data quality', 'Party wall type', 'Pset_WallCommon.IsExternal = TRUE on the party (unit-dividing) wall.', 'Classified as internal wall (2.7) by type, overriding the flag.'),
 ('Data quality', 'Skylights 2.3.2', 'Pset_WindowCommon.IsExternal = FALSE on roof lights.', 'Classified under Roof by host element.'),
 ('Data quality', 'Space B105', 'Named "Room" while its twin A105 is named "Stair" (both category Stairway).', 'Treated as stair space.'),
 ('Data quality', 'PSet_Revit_Other', 'Placeholder values (e.g. InstallationDate = "InstallationDate") on most elements.', 'Ignored.'),
 ('Scope', 'Not in model', 'No MEP, no reinforcement, no external works beyond two slabs, no skirtings/sills/cills.', 'Not measured - would need separate models or derived rules.'),
]
unm = [x for x in reg if x['key'] == 'UNMAPPED']
if unm: qa.append(('Check', 'Unmapped elements', ', '.join(x['type'] for x in unm), 'Need a rule'))
json.dump(dict(register=reg, qa=qa), open('register.json', 'w'), indent=1, default=float)
print(len(reg), 'register rows; unmapped:', len(unm), '; flags:', {f: sum(1 for x in reg if x['flag'] == f) for f in set(x['flag'] for x in reg)})
