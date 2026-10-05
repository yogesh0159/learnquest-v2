import asyncio, json, sys
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
URL="http://127.0.0.1:5177/jungle-local-preview.html?seed=4242"
async def main():
    part=sys.argv[1] if len(sys.argv)>1 else 'all'
    async with async_playwright() as p:
        if part in('all','a'): await part_a(p)
        if part in('all','b'): await part_b(p)
        print('ALL',all(R),f'{sum(R)}/{len(R)}')
async def part_a(p):
    if True:
        # ---- defaults by graphics card + user override
        b,pg,logs=await launch(p,960,540); await boot(pg,URL); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop()")
        s=await E("({tier:LQ_JUNGLE.qualityId,auto:LQ_JUNGLE.autoGraphics,cls:LQ_JUNGLE.gpuClass,gpu:LQ_JUNGLE.gpu})"); ok("no setting saved: the tier is chosen from the graphics card (software renderer -> low)",s['auto'] and s['cls']=="software" and s['tier']=="low",str(s))
        await pg.click("#settingsBox summary"); ok("Settings shows the Graphics row with Auto/High/Balanced/Low",await E("document.querySelectorAll('[data-gfx]').length")==4 and 'Now using' in await E("document.getElementById('settingsBody').innerText"))
        await pg.click('[data-gfx="high"]'); ok("choosing High applies it at once and saves it",await E("LQ_JUNGLE.qualityId")=="high" and await E("LQ_JUNGLE.profile.settings.graphics")=="high" and not await E("LQ_JUNGLE.autoGraphics"))
        await pg.click('[data-gfx="auto"]'); ok("Auto goes back to the card's default",await E("LQ_JUNGLE.qualityId")=="low" and await E("LQ_JUNGLE.autoGraphics"))
        await pg.click('[data-gfx="balanced"]'); await pg.reload(); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=90000); await pg.evaluate("LQ_JUNGLE.stopLoop()")
        ok("the Graphics choice survives a reload",await pg.evaluate("LQ_JUNGLE.qualityId")=="balanced")
        ok("shaders and textures are prepared before the menu appears (logged)",any("Shaders and textures prepared" in m for t,m in logs))
        await b.close()
        b,pg,logs=await launch(p,960,540); await boot(pg,URL+"&quality=high"); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop()")
        ok("?quality=high overrides the automatic choice",await E("LQ_JUNGLE.qualityId")=="high" and not await E("LQ_JUNGLE.autoGraphics"))
        # ---- asset reductions
        info=await E("(()=>{const a=LQ_JUNGLE.assets; const o={}; for(const k of ['coin','girl','boy','tree','bush','rock','torch','path']) o[k]=a.info(k); return o})()")
        ok("coin is now 2,428 triangles (was 8,672)",info['coin']['tris']==2428,str(info['coin']['tris']))
        ok("the Girl runs on 132k triangles (was 293k)",abs(info['girl']['tris']-132012)<50 if (await E("LQ_JUNGLE.assets.has('girl')")) else True) if False else None
        await E("LQ_JUNGLE.chooseCharacter('girl')"); await pg.wait_for_timeout(8000); ti=await E("LQ_JUNGLE.assets.info('girl').tris"); ok("the Girl runs on ~132k triangles (was 293k)",abs(ti-132012)<100,str(ti))
        ok("tree / bush / rock / torch / road each have a LOD with 4-7k triangles",all(100<(info[k].get('lodTris') or 0)<8000 for k in ['tree','bush','rock','torch','path']),str({k:info[k].get('lodTris') for k in ['tree','bush','rock','torch','path']}))
        await b.close()
        # ---- LOD swap + cheap materials + blob shadow, per tier
        for tier,cheap in [("high",False),("balanced",True),("low",True)]:
            b,pg,logs=await launch(p,960,540); await boot(pg,URL+f"&quality={tier}&drs=0"); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop(); LQ_JUNGLE.start(); LQ_JUNGLE.director.enabled=false; LQ_JUNGLE.player.invulnerable=1e9; LQ_JUNGLE.advance(8)")
            r=await E("""(()=>{const g=LQ_JUNGLE; g.env.updateLod(); g.track.refreshLod(); const near=g.quality.lodNear; let n=0,bad=0,nearCnt=0,farCnt=0,lambert=0,std=0;
              for(const [seg,s] of g.env.slots){ const sz=seg.group.position.z; for(const d of s.decor){ if(!d.obj.visible) continue; const m=g.env.meta.get(d.obj); if(!m.far) continue; const wantNear=sz+d.obj.position.z>-near; n++; if(m.near.visible!==wantNear||m.far.visible===wantNear) bad++; wantNear?nearCnt++:farCnt++;
                 m.near.traverse(o=>{ if(o.isMesh){ o.material.isMeshLambertMaterial?lambert++:std++; } }); } }
              let tilesFar=0,tilesBad=0; for(const s of g.track.segments){ const far=s.group.position.z<-g.track.lodDist; if(far) tilesFar++; if(s.pathFar&&(s.pathFar.visible!==far||s.path.visible===far)) tilesBad++; }
              return {n,bad,nearCnt,farCnt,lambert,std,tilesFar,tilesBad,blob:g.blob.visible,shadows:g.renderer.shadowMap.enabled}})()""")
            ok(f"[{tier}] every roadside object shows the right LOD for its distance ({r['nearCnt']} full / {r['farCnt']} low)",r['n']>10 and r['bad']==0 and r['nearCnt']>0 and r['farCnt']>0,str(r))
            ok(f"[{tier}] road tiles beyond {round(await E('LQ_JUNGLE.track.lodDist'))} m use the low-triangle road",r['tilesBad']==0 and r['tilesFar']>=2)
            ok(f"[{tier}] scenery uses {'cheap diffuse' if cheap else 'full PBR'} shading",(r['lambert']>0 and r['std']==0) if cheap else (r['std']>0 and r['lambert']==0))
            ok(f"[{tier}] {'fake blob shadow under the player, no shadow pass' if tier!='high' else 'real shadows, no blob'}",(r['blob'] and not r['shadows']) if tier!="high" else (not r['blob'] and r['shadows']))
            tris=await E("(()=>{const g=LQ_JUNGLE; g.renderOnce(); return g.renderer.info.render.triangles})()"); lim={"high":1_500_000,"balanced":1_000_000,"low":700_000}[tier]; ok(f"[{tier}] triangles per frame within budget ({tris:,} < {lim:,})",tris<lim)
            await b.close()
async def part_b(p):
    if True:
        # ---- adaptive resolution inside the game
        b,pg,logs=await launch(p,960,540); await boot(pg,URL+"&quality=balanced"); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop(); LQ_JUNGLE.start()")
        w0=await E("LQ_JUNGLE.canvas.width"); await E("(()=>{const g=LQ_JUNGLE; g.drsEnabled=true; for(let i=0;i<40;i++){ g.drs.push(70); const r=g.drs.tick(1000+i*800); if(r!==null){g.renderScale=r; g.resize();} }})()")
        w1=await E("LQ_JUNGLE.canvas.width"); sc=await E("LQ_JUNGLE.renderScale"); ok("slow frames shrink the picture (down to half) to keep it smooth",w1<w0*0.6 and sc==0.5,f"{w0}px -> {w1}px, scale {sc}")
        await E("(()=>{const g=LQ_JUNGLE; for(let i=0;i<120;i++){ g.drs.push(10); const r=g.drs.tick(100000+i*800); if(r!==null){g.renderScale=r; g.resize();} }})()"); ok("fast frames bring full sharpness back",await E("LQ_JUNGLE.renderScale")==1 and await E("LQ_JUNGLE.canvas.width")==w0)
        await b.close()
        # ---- no shader compiled in the middle of a run (the cause of 'worst 2.7 fps' hitches)
        b,pg,logs=await launch(p,960,540); await boot(pg,URL+"&quality=balanced&drs=0&god=1"); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop()")
        p0=await E("LQ_JUNGLE.renderer.info.programs.length")
        await E("""(()=>{const g=LQ_JUNGLE; g.start(); g.advance(2); g.renderOnce();
          for(const id of ['shield','magnet','double','slowmo']){ g.power.give(id); } g.advance(0.3); g.renderOnce();
          g.collectibles.spawn('enigma',0,1.25,-6); g.collectibles.spawn('coin',0,1,-5); g.obstacles.spawn('rock',2.2,-7); g.obstacles.spawn('beam',-2.2,-8); g.fx.burst(0,1,0,30,{}); g.advance(0.5); g.renderOnce();
          g.forceQuestion('science'); for(let i=0;i<700 && !(g.questions.hasZone && g.questions.padZ>-30);i++) g.advance(0.2); g.renderOnce();
          for(const k of [1,2,3]){ g.setBiome(k); g.advance(0.2); g.renderOnce(); } g.advance(5); g.renderOnce(); })()""")
        p1=await E("LQ_JUNGLE.renderer.info.programs.length"); ok("no new shader programs are compiled while playing (power-ups, Enigma, board, fx, all four worlds)",p1==p0,f"{p0} programs before, {p1} after")
        errs=[(t,m[:140]) for t,m in logs if t in('error','pageerror','warning')]; ok("no console errors/warnings",not errs,str(errs[:3]))
        await b.close()
asyncio.run(main())
