import struct, json, sys, os, math
import numpy as np

def read_glb(path):
    with open(path,'rb') as f:
        magic,ver,length = struct.unpack('<III', f.read(12))
        assert magic==0x46546C67, 'not glb'
        j=None; binoff=None; binlen=0
        while f.tell()<length:
            clen,ctype = struct.unpack('<II', f.read(8))
            if ctype==0x4E4F534A:
                j=json.loads(f.read(clen))
            elif ctype==0x004E4942:
                binoff=f.tell(); binlen=clen; f.seek(clen,1)
            else: f.seek(clen,1)
    return j,binoff,binlen

def mat_from_node(n):
    if 'matrix' in n:
        return np.array(n['matrix'],dtype=float).reshape(4,4).T
    t=np.array(n.get('translation',[0,0,0]),float)
    r=n.get('rotation',[0,0,0,1]); s=np.array(n.get('scale',[1,1,1]),float)
    x,y,z,w=r
    R=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
    M=np.eye(4); M[:3,:3]=R*s; M[:3,3]=t
    return M

def analyze(path):
    j,_,_=read_glb(path)
    out={'file':os.path.basename(path),'size_mb':round(os.path.getsize(path)/1e6,2)}
    acc=j.get('accessors',[]); nodes=j.get('nodes',[]); meshes=j.get('meshes',[])
    out['nodes']=len(nodes); out['meshes']=len(meshes)
    prims=0; verts=0; tris=0
    for m in meshes:
        for p in m['primitives']:
            prims+=1
            verts+=acc[p['attributes']['POSITION']]['count']
            if 'indices' in p: tris+=acc[p['indices']]['count']//3
            else: tris+=acc[p['attributes']['POSITION']]['count']//3
    out['primitives']=prims; out['vertices']=verts; out['triangles']=tris
    # world bbox from node tree
    parent={}
    for i,n in enumerate(nodes):
        for c in n.get('children',[]): parent[c]=i
    def world(i):
        M=mat_from_node(nodes[i]); 
        while i in parent:
            i=parent[i]; M=mat_from_node(nodes[i])@M
        return M
    mn=np.array([1e9]*3); mx=np.array([-1e9]*3)
    for i,n in enumerate(nodes):
        if 'mesh' in n:
            W=world(i)
            for p in meshes[n['mesh']]['primitives']:
                a=acc[p['attributes']['POSITION']]
                if 'min' not in a: continue
                lo,hi=np.array(a['min']),np.array(a['max'])
                for cx in (lo[0],hi[0]):
                    for cy in (lo[1],hi[1]):
                        for cz in (lo[2],hi[2]):
                            v=(W@np.array([cx,cy,cz,1]))[:3]
                            mn=np.minimum(mn,v); mx=np.maximum(mx,v)
    out['bbox_min']=[round(float(x),3) for x in mn]; out['bbox_max']=[round(float(x),3) for x in mx]
    out['size']=[round(float(x),3) for x in (mx-mn)]
    # root node transforms
    scene=j['scenes'][j.get('scene',0)]
    out['scene_roots']=[{'name':nodes[r].get('name'),'t':nodes[r].get('translation'),'r':nodes[r].get('rotation'),'s':nodes[r].get('scale'),'has_matrix':'matrix' in nodes[r]} for r in scene['nodes']][:4]
    # materials/textures
    mats=j.get('materials',[])
    out['materials']=len(mats)
    out['material_names']=[m.get('name') for m in mats][:12]
    out['material_flags']=sorted({k for m in mats for k in m.keys() if k not in('name',)} | {k for m in mats for k in m.get('extensions',{}).keys()})
    out['alpha_modes']=sorted({m.get('alphaMode','OPAQUE') for m in mats})
    out['emissive_materials']=sum(1 for m in mats if m.get('emissiveFactor') and any(m['emissiveFactor']) or 'emissiveTexture' in m)
    out['textures']=len(j.get('textures',[])); 
    imgs=j.get('images',[])
    out['images']=[{'name':i.get('name'),'mime':i.get('mimeType'),'bufferView':i.get('bufferView'),'bytes':j['bufferViews'][i['bufferView']]['byteLength'] if 'bufferView' in i else None,'uri':(i.get('uri') or '')[:40]} for i in imgs]
    out['extensionsUsed']=j.get('extensionsUsed',[]); out['extensionsRequired']=j.get('extensionsRequired',[])
    # skins
    skins=j.get('skins',[])
    out['skins']=len(skins); out['joints']=[len(s['joints']) for s in skins]
    # animations
    anims=[]
    for a in j.get('animations',[]):
        dur=0; roots_t=0; paths={}
        tr_nodes=set()
        for ch in a['channels']:
            s=a['samplers'][ch['sampler']]
            ia=acc[s['input']]
            if 'max' in ia: dur=max(dur,ia['max'][0])
            p=ch['target']['path']; paths[p]=paths.get(p,0)+1
            if p=='translation': tr_nodes.add(ch['target'].get('node'))
        anims.append({'name':a.get('name'),'dur':round(dur,3),'channels':len(a['channels']),'paths':paths,
                      'translation_nodes':[nodes[n].get('name') for n in list(tr_nodes)[:6]] if tr_nodes else []})
    out['animations']=anims
    out['has_morph']=any('targets' in p for m in meshes for p in m['primitives'])
    return out

if __name__=='__main__':
    res=[]
    for p in sys.argv[1:]:
        try: res.append(analyze(p))
        except Exception as e: res.append({'file':os.path.basename(p),'error':repr(e)})
    json.dump(res,open('/home/claude/tools/analysis_raw.json','w'),indent=1)
    print(json.dumps(res,indent=1)[:200000])
