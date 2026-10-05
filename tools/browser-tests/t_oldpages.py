import asyncio, json
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
JS="""async(key)=>{
 const THREE=await import('three'); const {CharacterController}=await import('/js/game/character-controller.js'); await import('/js/character-presets.js');
 const preset=window.LQCharacters.get(key); const scene=new THREE.Scene(); const c=new CharacterController({scene,preset}); const res=await c.load();
 const out={model:preset.model,mode:res.mode,states:[...c.actions.keys()]};
 const box=new THREE.Box3().setFromObject(c.root); out.height=+(box.max.y-box.min.y).toFixed(2); out.feet=+box.min.y.toFixed(2);
 let hips=null; c.visual.traverse(o=>{if(o.isBone&&/Hips$/.test(o.name)&&!hips)hips=o});
 const drift={}; const v=new THREE.Vector3();
 for(const st of ['run','jump','slide','hit','fall','dodgeLeft','land','victory','idle']){
   c.setState(st,{immediate:true}); c.update(0.02); hips.getWorldPosition(v); const z0=v.z,x0=v.x,y0=v.y; let maxY=y0, dur=0;
   for(let i=0;i<60;i++){ c.update(1/60); hips.getWorldPosition(v); maxY=Math.max(maxY,v.y); }
   hips.getWorldPosition(v); drift[st]={dz:+(v.z-z0).toFixed(2),dx:+(v.x-x0).toFixed(2),rise:+(maxY-y0).toFixed(2),action:c.activeAction?.getClip().name};
 }
 out.drift=drift; return out; }"""
async def main():
    async with async_playwright() as p:
        b,pg,logs=await launch(p,900,500,bypass_csp=True); E=pg.evaluate
        await pg.goto("http://127.0.0.1:4000/explorer.html",wait_until="commit"); await pg.wait_for_selector("#tabs button")
        for key,name in [("human_boy_v1","Boy"),("human_girl_v1","Girl")]:
            r=await pg.evaluate(JS,key); print("  ",name,r['model'],r['states']); print("  ",json.dumps(r['drift']))
            ok(f"{name}: the NEW model file is used (not boy-explorer/girl-explorer)","runtime" in r['model'] and "explorer" not in r['model'])
            ok(f"{name}: loads as a real 3D model (no procedural fallback)",r['mode']=="gltf")
            ok(f"{name}: fitted to 2.85 height, feet on the ground",abs(r['height']-2.85)<0.1 and abs(r['feet'])<0.1,f"height {r['height']} feet {r['feet']}")
            ok(f"{name}: all runner states exist (idle/run/sprint/jump/slide/hit/fall/victory)",all(s in r['states'] for s in ['idle','run','sprint','jump','slide','hit','fall','victory']))
            d=r['drift']; ok(f"{name}: no state carries the character away (|dx|,|dz| < 0.4)",all(abs(v['dz'])<0.4 and abs(v['dx'])<0.4 for v in d.values()),str({k:(v['dx'],v['dz']) for k,v in d.items() if abs(v['dz'])>=0.4 or abs(v['dx'])>=0.4}))
            ok(f"{name}: lane dodge keeps running instead of a body-turning clip",d['dodgeLeft']['action']=="Running" and d['land']['action']=="Running",f"{d['dodgeLeft']['action']}")
            ok(f"{name}: jump does not add its own big hop on top of the runner's arc (rise < 0.5)",d['jump']['rise']<0.5,str(d['jump']['rise']))
        errs=[m[:150] for t,m in logs if t in("error","pageerror") and "ERR_FAILED" not in m]; ok("no console errors",not errs,str(errs[:2]))
        print("ALL",all(R),f"{sum(R)}/{len(R)}"); await b.close()
asyncio.run(main())
