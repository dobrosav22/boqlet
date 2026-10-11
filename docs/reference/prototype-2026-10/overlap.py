# pairwise solid-overlap check between structural/fabric elements (detects double counting at junctions)
import ifcopenshell, ifcopenshell.geom, numpy as np, trimesh, itertools, json, multiprocessing
f=ifcopenshell.open('/mnt/user-data/uploads/Ifc2x3_Duplex_Architecture.ifc')
s=ifcopenshell.geom.settings(); s.set('use-world-coords',True)
cls=('IfcWall','IfcSlab','IfcFooting','IfcBeam','IfcCovering')
els=[e for c in cls for e in f.by_type(c)]
it=ifcopenshell.geom.iterator(s,f,multiprocessing.cpu_count(),include=els)
meshes={}
it.initialize()
while True:
    sh=it.get(); m=trimesh.Trimesh(np.array(sh.geometry.verts).reshape(-1,3),np.array(sh.geometry.faces).reshape(-1,3))
    trimesh.repair.fix_normals(m); meshes[sh.guid]=m
    if not it.next(): break
out=[]
keys=list(meshes)
for a,b in itertools.combinations(keys,2):
    A,B=meshes[a],meshes[b]
    lo=np.maximum(A.bounds[0],B.bounds[0]); hi=np.minimum(A.bounds[1],B.bounds[1])
    if np.any(hi-lo<=1e-4): continue
    try: v=A.intersection(B, engine='manifold').volume
    except Exception as ex: v=None
    if v and v>1e-3:
        ea,eb=f.by_guid(a),f.by_guid(b)
        out.append(dict(a=a,b=b,a_name=ea.Name,b_name=eb.Name,volume=v))
json.dump(out,open('overlaps.json','w'),indent=1)
for o in sorted(out,key=lambda x:-x['volume']): print(round(o['volume'],3), o['a_name'][:55],'<>',o['b_name'][:55])
print(len(out),'overlapping pairs, total',round(sum(o['volume'] for o in out),3))
