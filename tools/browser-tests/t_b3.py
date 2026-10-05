import asyncio, base64
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
async def main():
    async with async_playwright() as p:
        b,pg,logs=await launch(p,960,540)
        await boot(pg,"http://127.0.0.1:5177/jungle-local-preview.html?quality=balanced&seed=11&character=girl"); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop(); localStorage.clear()")
        await E("LQ_JUNGLE.start(); LQ_JUNGLE.director.enabled=false; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.collectibles.clear(); LQ_JUNGLE.player.invulnerable=1e9; LQ_JUNGLE.advance(1)")
        info=lambda: E("({biome:LQ_JUNGLE.biome.name,fog:LQ_JUNGLE.scene.fog.color.getHexString(),sun:+LQ_JUNGLE.sun.intensity.toFixed(2),exp:+LQ_JUNGLE.renderer.toneMappingExposure.toFixed(2),torch:+LQ_JUNGLE.env.torchBoost.toFixed(2),ff:+LQ_JUNGLE.ambient.mat.opacity.toFixed(2)})")
        res={}
        for name,dist in [("day",100),("sunset",800),("night",1400),("dawn",2000),("loop",2500)]:
            await E(f"LQ_JUNGLE.stats.distance={dist}; LQ_JUNGLE.stats.score=0; LQ_JUNGLE.hitMark={dist}; LQ_JUNGLE.advance(0.1)"); res[name]=await info()
            if name in("sunset","night","dawn"):
                d=await E("LQ_JUNGLE.renderOnce()"); open(f"shots/19_{name}.png","wb").write(base64.b64decode(d.split(",")[1]))
        print("  ",res)
        ok("daytime is the default look",res['day']['biome']=="Sunny Jungle" and res['day']['fog']=="c4ead8")
        ok("sunset: warmer fog, lower sun",res['sunset']['biome']=="Golden Sunset" and res['sunset']['sun']<res['day']['sun'])
        ok("night: dark fog, dim sun, torches ~2x brighter, fireflies visible",res['night']['biome']=="Firefly Night" and res['night']['sun']<1 and res['night']['torch']>2 and res['night']['ff']>0.6)
        ok("dawn follows night",res['dawn']['biome']=="Misty Dawn")
        ok("cycle loops back to day after 2400 m",res['loop']['biome']=="Sunny Jungle")
        # smooth transition: sample every 10 m across the sunset->night edge, no fog colour jump
        jumps=await E("""(()=>{const g=LQ_JUNGLE; let prev=null, maxJump=0; for(let d=1000;d<=1230;d+=2){ g.stats.distance=d; g.biome.update(d,true); const c=g.scene.fog.color; const v=[c.r,c.g,c.b]; if(prev) maxJump=Math.max(maxJump,Math.abs(v[0]-prev[0]),Math.abs(v[1]-prev[1]),Math.abs(v[2]-prev[2])); prev=v;} return maxJump;})()""")
        ok("biome change is a smooth fade (max fog step per 2 m is tiny)",jumps<0.02,f"{jumps:.4f}")
        # toast on entering
        await E("LQ_JUNGLE.stats.distance=470; LQ_JUNGLE.biome.update(470,true); LQ_JUNGLE.advance(0.05); LQ_JUNGLE.stats.distance=520; LQ_JUNGLE.advance(0.2)")
        ok("player is told when a new area begins","Golden Sunset" in await E("document.getElementById('toast').textContent"))
        # speed lines + reduced motion
        await E("LQ_JUNGLE.speedMultiplier=2; LQ_JUNGLE.stats.distance=10; LQ_JUNGLE.advance(8)"); s1=float(await E("document.getElementById('speedLines').style.opacity||0"))
        ok("speed lines appear at high speed",s1>0.15,f"opacity {s1} at {await E('LQ_JUNGLE.speed.toFixed(1)')} m/s")
        await E("LQ_JUNGLE.setSetting('reducedMotion',true); LQ_JUNGLE.advance(0.5)"); s2=float(await E("document.getElementById('speedLines').style.opacity||0"))
        ok("reduced motion switches speed lines off",s2==0)
        await E("LQ_JUNGLE.setSetting('reducedMotion',false); LQ_JUNGLE.speedMultiplier=1")
        # ambient particles scroll and stay in bounds
        z=await E("(()=>{const a=LQ_JUNGLE.ambient; LQ_JUNGLE.advance(30); const p=a.points.geometry.attributes.position.array; let mn=1e9,mx=-1e9; for(let i=0;i<a.n;i++){mn=Math.min(mn,p[i*3+2]);mx=Math.max(mx,p[i*3+2]);} return [mn,mx];})()")
        ok("ambient particles recycle inside the play volume forever",z[0]>-85 and z[1]<9,str([round(x,1) for x in z]) if False else str(z))
        snap=await E("LQ_JUNGLE.snapshot()"); print("   render:",snap['render']); ok("draw load unchanged by biomes/ambient (<200 calls)",snap['render']['calls']<200)
        errs=[(t,m[:150]) for t,m in logs if t in('error','pageerror','warning','reqfail')]; ok("no console errors/warnings",not errs,str(errs[:3]))
        print("ALL",all(R),f"{sum(R)}/{len(R)}"); await b.close()
asyncio.run(main())
