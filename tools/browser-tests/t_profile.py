import asyncio, json
from browser_test import *
JS="""async()=>{
 const g=LQ_JUNGLE; g.stopLoop(); g.start(); g.director.enabled=true; g.player.invulnerable=1e9; g.advance(6);
 const targets=[['player','update',g.player],['track','update',g.track],['collectibles','update',g.collectibles],['obstacles','update',g.obstacles],['questions','update',g.questions],['fx','update',g.fx],['env','update',g.env],['ambient','update',g.ambient],['biome','update',g.biome],['power','update',g.power],['collision.collect','collectibles',g.collision],['collision.obstacle','obstacle',g.collision],['hud','update',g.hud],['camera','update',g.cameraRig]];
 const acc={}; for(const [name,fn,obj] of targets){ const orig=obj[fn].bind(obj); acc[name]=0; obj[fn]=(...a)=>{const t=performance.now(); const r=orig(...a); acc[name]+=performance.now()-t; return r;}; }
 const N=1200; const t0=performance.now(); for(let i=0;i<N;i++) g.step(1/60); const total=(performance.now()-t0)/N;
 const out={total_ms_per_step:+total.toFixed(3)}; for(const k in acc) out[k]=+(acc[k]/N).toFixed(4); out.other=+(total-Object.values(acc).reduce((a,b)=>a+b,0)/N).toFixed(3); out.active=g.collectibles.active.length+'/'+g.obstacles.active.length; return out; }"""
async def main():
    async with async_playwright() as p:
        b,pg,logs=await launch(p,640,360); await boot(pg,"http://127.0.0.1:5177/jungle-local-preview.html?quality=high&seed=4242&drs=0&calibrate=0"); E=pg.evaluate
        r=await E(JS); print(json.dumps(r,indent=1)); await b.close()
asyncio.run(main())
