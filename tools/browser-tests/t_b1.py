import asyncio, base64, json
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
async def shot(pg,name):
    d=await pg.evaluate("LQ_JUNGLE.renderOnce()"); open(f"shots/{name}.png","wb").write(base64.b64decode(d.split(",")[1]))
async def main():
    async with async_playwright() as p:
        b,pg,logs=await launch(p,960,540)
        await boot(pg,"http://127.0.0.1:5177/jungle-local-preview.html?quality=balanced&seed=21"); E=pg.evaluate; await E("LQ_JUNGLE.setSetting('readTime', 'off')")        # this suite is about power-ups: the question pause has its own tests
        await E("LQ_JUNGLE.stopLoop()")
        # ---- LAB
        await pg.keyboard.press("F2"); await pg.wait_for_timeout(700); await E("LQ_JUNGLE.advance(0.3)")
        ok("lab opens, menu screen hidden",await E("document.body.classList.contains('lab') && getComputedStyle(document.getElementById('menuScreen')).display==='none'"))
        n=await E("document.querySelectorAll('#labClip option').length"); ok("lab lists every clip of the Boy",n==13,str(n))
        ok("lab shows both running characters",await E("[...document.querySelectorAll('#labChars button')].map(b=>b.textContent)")==["Boy explorer","Girl explorer"])
        opts=await E("[...document.querySelectorAll('#labClip option')].map(o=>o.textContent)"); print("   ",opts[:4])
        ok("clip list shows alias mapping",any('RUN' in o for o in opts) and any('SLIDE' in o for o in opts))
        rig=await E("document.getElementById('labRig').textContent"); print("   rig:",rig.replace("\n"," | ")[:230]); ok("rig info lists removed root drift",'slide_light' in rig and 'removed' in rig)
        # play slide neutral vs original: measure hips world z
        meas="""(name,orig)=>{const g=LQ_JUNGLE; g.labPlay(name,{loop:false,original:orig,timeScale:1}); let hips=null; g.player.model.traverse(o=>{if(o.isBone&&/Hips$/.test(o.name)&&!hips)hips=o});
          g.advance(0.05); const z0=hips.getWorldPosition(new g.camera.position.constructor()).z; g.advance(1.2); const z1=hips.getWorldPosition(new g.camera.position.constructor()).z; return +(z1-z0).toFixed(3);}"""
        d_neutral=await E(f"({meas})('slide_light',false)"); d_orig=await E(f"({meas})('slide_light',true)")
        ok("slide: neutralised clip stays in place, original drifts forward",abs(d_neutral)<0.15 and abs(d_orig)>1.0,f"neutral {d_neutral} m vs original {d_orig} m")
        await E("LQ_JUNGLE.labPlay('Running',{loop:true}); LQ_JUNGLE.advance(0.3)"); await shot(pg,"13_lab_boy_run")
        await pg.click("#labChars button:nth-child(2)"); await pg.wait_for_timeout(1500); await E("LQ_JUNGLE.advance(0.2)")
        ok("switching to Girl in lab works",await E("LQ_JUNGLE.characterKey")=="girl" and await E("document.querySelectorAll('#labClip option').length")==13)
        ok("girl exposes her own clips (Hit_in_Back_While_Running)",await E("[...document.querySelectorAll('#labClip option')].some(o=>o.value==='Hit_in_Back_While_Running')"))
        await E("LQ_JUNGLE.labPlay('Running',{loop:true}); LQ_JUNGLE.advance(0.3)"); await shot(pg,"14_lab_girl_run")
        await pg.keyboard.press("F2"); await pg.wait_for_timeout(300)
        # ---- POWER-UPS
        await pg.keyboard.press("Enter"); await E("LQ_JUNGLE.director.enabled=false; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.collectibles.clear(); LQ_JUNGLE.advance(0.5)")
        got=[]
        for i in range(4):
            await E("LQ_JUNGLE.collectibles.spawn('enigma',LQ_JUNGLE.player.x,1.25,-3); LQ_JUNGLE.advance(0.8)"); got.append(await E("LQ_JUNGLE.power.list().map(p=>p.id)"))
        seen=set(x for g in got for x in g); ok("4 enigmas grant all 4 different power-ups before repeating",seen=={'magnet','shield','slowmo','double'},str(got[-1]))
        ok("HUD lists active power-ups",await E("document.getElementById('hudPower').children.length")>=1)
        await E("LQ_JUNGLE.power.reset(); LQ_JUNGLE.power.give('magnet'); LQ_JUNGLE.collectibles.clear()")
        await E("LQ_JUNGLE.collectibles.spawn('coin',-2.2,1.0,-9); LQ_JUNGLE.collectibles.spawn('coin',2.2,1.0,-11)"); c0=await E("LQ_JUNGLE.stats.coins"); await E("LQ_JUNGLE.advance(1.6)")
        ok("magnet pulls coins from other lanes",await E("LQ_JUNGLE.stats.coins")==c0+2,f"{c0}->{await E('LQ_JUNGLE.stats.coins')}")
        await E("LQ_JUNGLE.power.reset(); LQ_JUNGLE.collectibles.clear(); LQ_JUNGLE.collectibles.spawn('coin',-2.2,1.0,-9); LQ_JUNGLE.advance(1.6)")
        ok("without magnet the far-lane coin is NOT collected",await E("LQ_JUNGLE.stats.coins")==c0+2)
        await E("LQ_JUNGLE.power.reset(); LQ_JUNGLE.power.give('shield'); LQ_JUNGLE.player.invulnerable=0; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.obstacles.spawn('rock',LQ_JUNGLE.player.x,-3)")
        l0=await E("LQ_JUNGLE.stats.lives"); await E("LQ_JUNGLE.advance(1.0)")
        ok("shield absorbs a rock hit (no life lost) and is consumed",await E("LQ_JUNGLE.stats.lives")==l0 and not await E("LQ_JUNGLE.power.has('shield')"))
        await E("LQ_JUNGLE.advance(1.5); LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.obstacles.spawn('rock',LQ_JUNGLE.player.x,-3); LQ_JUNGLE.advance(1.0)")
        ok("second rock hurts after the shield is gone",await E("LQ_JUNGLE.stats.lives")==l0-1)
        await E("LQ_JUNGLE.advance(2.5); LQ_JUNGLE.power.reset()"); s1=await E("LQ_JUNGLE.speed"); await E("LQ_JUNGLE.power.give('slowmo'); LQ_JUNGLE.advance(3)"); s2=await E("LQ_JUNGLE.speed")
        ok("slow-time reduces world speed",s2<s1*0.8,f"{s1:.1f} -> {s2:.1f}")
        await E("LQ_JUNGLE.power.reset(); LQ_JUNGLE.advance(7)"); ok("speed recovers after slow-time",await E("LQ_JUNGLE.speed")>s2*1.25)
        await E("LQ_JUNGLE.power.reset(); LQ_JUNGLE.collectibles.clear(); LQ_JUNGLE.stats.score=0; LQ_JUNGLE.stats.combo=0; LQ_JUNGLE.advance(0.1)")
        sc0=await E("LQ_JUNGLE.stats.score"); await E("LQ_JUNGLE.power.give('double'); LQ_JUNGLE.collectibles.spawn('coin',LQ_JUNGLE.player.x,1.0,-1.5); LQ_JUNGLE.advance(0.6)")
        ok("double coins doubles the coin value",await E("LQ_JUNGLE.stats.score")-sc0>=19.5,str(await E("LQ_JUNGLE.stats.score")-sc0))
        await E("LQ_JUNGLE.power.reset(); LQ_JUNGLE.stats.combo=0; for(let i=0;i<8;i++){LQ_JUNGLE.collectibles.spawn('coin',LQ_JUNGLE.player.x,1.0,-1.5-i*1.4);} LQ_JUNGLE.advance(2.2)")
        ok("combo counts chained coins",await E("LQ_JUNGLE.stats.bestCombo")>=7,str(await E("LQ_JUNGLE.stats.bestCombo")))
        ok("combo chip appears",'Combo' in await E("document.getElementById('hudCombo').textContent"))
        await E("LQ_JUNGLE.advance(2.0)"); ok("combo resets after a pause in coins",await E("LQ_JUNGLE.stats.combo")==0)
        await E("LQ_JUNGLE.power.give('shield')"); await E("LQ_JUNGLE.advance(0.2)"); await shot(pg,"15_shield")
        errs=[(t,m[:140]) for t,m in logs if t in('error','pageerror','warning')]; ok("no console errors/warnings",not errs,str(errs[:3]))
        print("ALL",all(R),f"{sum(R)}/{len(R)}"); await b.close()
asyncio.run(main())
