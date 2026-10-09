import asyncio, json
from browser_test import *
R={}
def ok(name,cond,detail=""):
    R[name]=bool(cond); print(("PASS" if cond else "FAIL"),name,detail)
async def main():
    async with async_playwright() as p:
        b,pg,logs=await launch(p,800,450)
        await boot(pg,"http://127.0.0.1:5177/jungle-local-preview.html?quality=low&seed=777"); await pg.evaluate("LQ_JUNGLE.setSetting('readTime', 'off')")        # long unattended runs: nobody taps Ready!
        E=lambda js: pg.evaluate(js)
        await E("LQ_JUNGLE.stopLoop(); LQ_JUNGLE.start(); LQ_JUNGLE.track.reserved.clear(); LQ_JUNGLE.questions.nextIndex=1e9")   # no question board while testing collisions
        await E("LQ_JUNGLE.director.enabled=false; LQ_JUNGLE.collectibles.clear(); LQ_JUNGLE.obstacles.clear()")
        wk=await E("LQ_JUNGLE.snapshot().track.walkable"); ok("all 3 lane centres (+character half width) are on the flat walkway, not on the parapet walls",wk["lanesFit"],str(wk))
        # A coin pickup
        await E("LQ_JUNGLE.collectibles.spawn('coin',0,1.0,-6)"); c0=await E("LQ_JUNGLE.stats.coins"); s0=await E("LQ_JUNGLE.stats.score")
        await E("LQ_JUNGLE.advance(1.0)"); c1=await E("LQ_JUNGLE.stats.coins")
        ok("coin collected in-lane",c1==c0+1,f"{c0}->{c1}")
        ok("collected coin removed from active list",await E("LQ_JUNGLE.collectibles.active.filter(c=>c.kind=='coin').length")==0)
        # coin in another lane NOT collected
        await E("LQ_JUNGLE.collectibles.spawn('coin',2.2,1.0,-6)"); await E("LQ_JUNGLE.advance(1.0)")
        ok("coin in other lane not collected",await E("LQ_JUNGLE.stats.coins")==c1)
        # B enigma
        await E("LQ_JUNGLE.collectibles.spawn('enigma',0,1.25,-6)"); await E("LQ_JUNGLE.advance(1.0)")
        ok("enigma collected -> token counter + a power-up is granted",await E("LQ_JUNGLE.stats.tokens")==1 and await E("LQ_JUNGLE.power.list().length")==1)
        await E("LQ_JUNGLE.power.reset()")
        # C rock hit
        await E("LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.obstacles.spawn('rock',0,-6)"); l0=await E("LQ_JUNGLE.stats.lives"); await E("LQ_JUNGLE.advance(0.9)")
        ok("rock hit costs a life",await E("LQ_JUNGLE.stats.lives")==l0-1,f"anim={await E('LQ_JUNGLE.player.anim.currentAlias')}")
        ok("HIT animation played",await E("LQ_JUNGLE.player.state")=="hit")
        await E("LQ_JUNGLE.advance(2.2)"); ok("returns to RUN after hit",await E("LQ_JUNGLE.player.state")=="run" and await E("LQ_JUNGLE.player.anim.currentAlias")=="RUN")
        # jump over rock
        await E("LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.obstacles.spawn('rock',0,-9)"); l0=await E("LQ_JUNGLE.stats.lives")
        await E("LQ_JUNGLE.advance(0.35)"); await E("LQ_JUNGLE.player.jump()"); await E("LQ_JUNGLE.advance(1.3)")
        ok("jumping over rock = no damage",await E("LQ_JUNGLE.stats.lives")==l0)
        # beam: slide ok
        await E("LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.obstacles.spawn('beam',0,-9)"); l0=await E("LQ_JUNGLE.stats.lives")
        await E("LQ_JUNGLE.advance(0.5)"); await E("LQ_JUNGLE.player.slide()"); await E("LQ_JUNGLE.advance(1.4)")
        ok("sliding under beam = no damage",await E("LQ_JUNGLE.stats.lives")==l0)
        await E("LQ_JUNGLE.player.invulnerable=0; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.obstacles.spawn('beam',0,-6)"); await E("LQ_JUNGLE.advance(0.9)")
        ok("standing into beam = damage",await E("LQ_JUNGLE.stats.lives")==l0-1)
        # fast-fall slide in air
        await E("LQ_JUNGLE.advance(2.5)"); await E("LQ_JUNGLE.player.jump()"); await E("LQ_JUNGLE.advance(0.2)"); await E("LQ_JUNGLE.player.slide()"); await E("LQ_JUNGLE.advance(0.4)")
        ok("slide while airborne fast-falls then slides",await E("LQ_JUNGLE.player.state")=="slide",await E("LQ_JUNGLE.player.state"))
        print("   PRE-DEATH:",await E("({gs:LQ_JUNGLE.state,lives:LQ_JUNGLE.stats.lives,alive:LQ_JUNGLE.player.alive,dying:LQ_JUNGLE.dying,ps:LQ_JUNGLE.player.state})"))
        # E death & restart
        await E("LQ_JUNGLE.advance(3)"); await E("LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.power.reset(); LQ_JUNGLE.stats.lives=1; LQ_JUNGLE.player.invulnerable=0; LQ_JUNGLE.obstacles.spawn('rock',0,-4)")
        await E("LQ_JUNGLE.advance(1.0)"); ok("last life lost -> FALL anim",await E("LQ_JUNGLE.player.anim.currentAlias")=="FALL" and not await E("LQ_JUNGLE.player.alive"),str(await E("({lives:LQ_JUNGLE.stats.lives,alive:LQ_JUNGLE.player.alive,anim:LQ_JUNGLE.player.anim.currentAlias,st:LQ_JUNGLE.player.state,inv:LQ_JUNGLE.player.invulnerable,x:LQ_JUNGLE.player.x,pw:LQ_JUNGLE.power.list().map(p=>p.id),obs:LQ_JUNGLE.obstacles.active.map(o=>[o.x,o.z])})")))
        await E("LQ_JUNGLE.advance(2.6)"); ok("game over screen shown",await E("LQ_JUNGLE.state")=="gameover" and not await E("document.getElementById('gameOverScreen').hidden"))
        await E("LQ_JUNGLE.start()"); ok("restart resets run",await E("LQ_JUNGLE.state")=="playing" and await E("LQ_JUNGLE.stats.lives")==3 and await E("LQ_JUNGLE.stats.score")==0)
        # F long run + memory + fairness
        await E("LQ_JUNGLE.player.invulnerable=1e9")
        base=await E("LQ_JUNGLE.snapshot()"); await E("LQ_JUNGLE.advance(5)"); warm=await E("LQ_JUNGLE.snapshot()")
        worst=await E("""(()=>{const g=LQ_JUNGLE; let worstBlock=0, maxAct=0, maxObs=0, nan=false, seam=0, zones=0, lastZone=false;
          for(let i=0;i<60*180;i++){ g.step(1/60); if(i%6) continue;
            const obs=g.obstacles.active; const bins={}; for(const o of obs){const k=Math.round(o.z/3.2); (bins[k]=bins[k]||new Set()).add(o.x); (bins[k+1]=bins[k+1]||new Set()).add(o.x);}
            for(const k in bins) worstBlock=Math.max(worstBlock,bins[k].size);
            maxAct=Math.max(maxAct,g.collectibles.active.length); maxObs=Math.max(maxObs,obs.length);
            if(!Number.isFinite(g.stats.distance)||!Number.isFinite(g.camera.position.z)) nan=true;
            seam=Math.max(seam,g.track.continuity().worstSeamError);
            const z=g.questions.hasZone; if(z&&!lastZone) zones++; lastZone=z; }
          return {worstBlock,maxAct,maxObs,nan,seam,zones};})()""")
        end=await E("LQ_JUNGLE.snapshot()")
        print("   180 s sim:",worst,"recycled",end['segmentsRecycled'],"dist",round(end['distance']),"speed",end['speed'])
        ok("endless recycling works",end['segmentsRecycled']>150,str(end['segmentsRecycled']))
        ok("road seams stay exact (no gaps)",worst['seam']<1e-6,str(worst['seam']))
        ok("never all 3 lanes blocked",worst['worstBlock']<=2,str(worst['worstBlock']))
        ok("pools bounded (no leak)",worst['maxAct']<=52 and worst['maxObs']<=12)
        ok("GPU geometries/textures constant (no leak)",end['render']['geometries']==warm['render']['geometries'] and end['render']['textures']==warm['render']['textures'],f"{warm['render']['geometries']}/{warm['render']['textures']} -> {end['render']['geometries']}/{end['render']['textures']}")
        ok("no NaN in world state",not worst['nan'])
        ok("question zones recur",worst['zones']>=5,str(worst['zones']))
        # H girl
        await E("LQ_JUNGLE.state='menu'"); await pg.evaluate("LQ_JUNGLE.chooseCharacter('girl')"); 
        gi=await E("(()=>{const d=LQ_JUNGLE.player.anim.describe(); return {aliases:Object.fromEntries(Object.entries(d.aliases).map(([k,v])=>[k,v&&v.name])),rm:d.rootMotion.map(r=>[r.alias,r.netBefore,r.netAfter])}})()")
        print("   girl aliases:",gi['aliases']); 
        ok("girl character loads + HIT mapped to Hit_in_Back_While_Running",gi['aliases']['HIT']=='Hit_in_Back_While_Running' and gi['aliases']['RUN']=='Running')
        ok("root motion neutralised (girl)",all(abs(r[2][0])<1e-6 and abs(r[2][2])<1e-6 for r in gi['rm']),str([r for r in gi['rm'] if r[0] in('SLIDE','HIT')]))
        # K lab
        await E("LQ_JUNGLE.toggleLab()"); await pg.wait_for_timeout(600)
        ok("lab mode toggles orbit camera",await E("!!LQ_JUNGLE.orbit && document.body.classList.contains('lab')"))
        # I resize
        await pg.set_viewport_size({'width':420,'height':800}); await pg.wait_for_timeout(300)
        sz=await E("({w:LQ_JUNGLE.canvas.width,h:LQ_JUNGLE.canvas.height,a:LQ_JUNGLE.camera.aspect.toFixed(2),fov:LQ_JUNGLE.camera.fov})")
        ok("canvas + camera follow resize (portrait)",abs(sz['w']/sz['h']-float(sz['a']))<0.05,str(sz))
        errs=[(t,m) for t,m in logs if t in('error','pageerror','reqfail') or (t=='warning')]
        ok("no console errors/warnings",len(errs)==0,str(errs[:3]))
        print(json.dumps(R)); open('/home/claude/work/test_results.json','w').write(json.dumps(R))
        await b.close()
asyncio.run(main())
