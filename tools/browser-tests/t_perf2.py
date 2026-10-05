import asyncio, json, sys
from browser_test import *
JS="""async()=>{
 const THREE=await import('three'); const g=LQ_JUNGLE; const cam=g.camera; cam.updateMatrixWorld(true);
 const fr=new THREE.Frustum(); fr.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));
 const cats={}; const add=(k,t)=>{cats[k]=cats[k]||{objs:0,tris:0}; cats[k].objs++; cats[k].tris+=t;};
 g.scene.traverse(o=>{ if(!o.isMesh||!o.visible) return; let p=o,vis=true; while(p){ if(!p.visible){vis=false;break;} p=p.parent; } if(!vis) return;
   if(!fr.intersectsObject(o)) return; const gm=o.geometry; const tris=(gm.index?gm.index.count:gm.attributes.position.count)/3;
   let n=o, key='other'; while(n){ const nm=n.name||''; const m=nm.match(/^(treeNear|treeFar|bushA|bushB|rock|torch|PathTile|Ground|coin|enigma|rockObstacle|beamObstacle|Player|QuestionZone|SkyDome|ShieldBubble|Ambient|FX)/); if(m){key=m[1];break;} n=n.parent; }
   add(key,tris); });
 return cats; }"""
async def run(p,q,url_extra=""):
    b,pg,logs=await launch(p,640,360)
    await boot(pg,f"http://127.0.0.1:5177/jungle-local-preview.html?quality={q}&seed=4242{url_extra}"); E=pg.evaluate
    await E("LQ_JUNGLE.stopLoop(); LQ_JUNGLE.start(); LQ_JUNGLE.player.invulnerable=1e9; LQ_JUNGLE.advance(9)")
    cats=await E(JS); tot=sum(v['tris'] for v in cats.values())
    # relative software-render cost (CPU rasteriser): median of 5 frames
    ms=await E("(()=>{const g=LQ_JUNGLE; g.renderer.render(g.scene,g.camera); const t=[]; for(let i=0;i<5;i++){const a=performance.now(); g.renderer.render(g.scene,g.camera); g.renderer.getContext().finish(); t.push(performance.now()-a);} t.sort((a,b)=>a-b); return t[2];})()")
    snap=await E("LQ_JUNGLE.snapshot().render")
    print(f"== {q}: visible tris {int(tot):,} | draw calls {snap['calls']} | software render {ms:.0f} ms/frame")
    for k,v in sorted(cats.items(),key=lambda x:-x[1]['tris'])[:9]: print(f"   {k:14s} {v['objs']:3d} objs {int(v['tris']):>9,} tris  {100*v['tris']/tot:4.1f}%")
    await b.close()
async def main():
    async with async_playwright() as p:
        for q in sys.argv[1:] or ["high","balanced","low"]: await run(p,q)
asyncio.run(main())
