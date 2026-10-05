import asyncio, base64, json
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
URL="http://127.0.0.1:5177/jungle-local-preview.html?quality=low&seed=5"
async def shot(pg,name):
    d=await pg.evaluate("LQ_JUNGLE.renderOnce()"); open(f"shots/{name}.png","wb").write(base64.b64decode(d.split(",")[1]))
async def main():
    async with async_playwright() as p:
        # ---------------- tutorial (fresh player) ----------------
        b,pg,logs=await launch(p,960,540,tutorial_done=False); await boot(pg,URL); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop()")
        ok("fresh profile: tutorial not done",not await E("LQ_JUNGLE.profile.data.tutorialDone"))
        await pg.keyboard.press("Enter"); await E("LQ_JUNGLE.advance(0.3); LQ_JUNGLE.player.invulnerable=1e9")   # the open road after the tutorial must not end the test run
        coach=lambda: E("({show:!document.getElementById('coach').hidden,text:document.getElementById('coachText').textContent,step:document.getElementById('coachStep').textContent})")
        c=await coach(); ok("tutorial step 1 asks to change lane",c['show'] and 'lane' in c['text'] and c['step']=='1/5',str(c))
        ok("no obstacles / question board during the tutorial",not await E("LQ_JUNGLE.director.enabled") and await E("LQ_JUNGLE.questions.held"))
        await shot(pg,"20_tutorial_1")
        await pg.keyboard.press("ArrowRight"); await E("LQ_JUNGLE.advance(0.4)"); ok("praise shown after the right action",'Nice' in (await coach())['text'])
        await E("LQ_JUNGLE.advance(1.0)"); ok("step 2: jump",'JUMP' in (await coach())['text'])
        await pg.keyboard.press("ArrowUp"); await E("LQ_JUNGLE.advance(2.0)"); ok("step 3: slide",'SLIDE' in (await coach())['text'])
        await pg.keyboard.press("ArrowDown"); await E("LQ_JUNGLE.advance(2.0)"); c=await coach(); ok("step 4: coins appear ahead",'coins' in c['text'] and await E("LQ_JUNGLE.collectibles.active.length")>=15,str(await E("LQ_JUNGLE.collectibles.active.length")))
        await E("LQ_JUNGLE.player.laneIndex=1"); await E("LQ_JUNGLE.advance(4)")
        c0=await E("LQ_JUNGLE.stats.coins"); ok("collecting a coin completes the step",c0>=1 and 'RIGHT answer' in (await coach())['text'],str(await coach()))
        await E("LQ_JUNGLE.advance(7)")
        ok("tutorial ends, is remembered and gameplay unlocks",not (await coach())['show'] and await E("LQ_JUNGLE.profile.data.tutorialDone") and await E("LQ_JUNGLE.director.enabled") and not await E("LQ_JUNGLE.questions.held"))
        await E("LQ_JUNGLE.advance(3)"); ok("road ahead is populated after the tutorial (obstacles/coins exist)",await E("LQ_JUNGLE.obstacles.active.length + LQ_JUNGLE.collectibles.active.length")>3)
        await E("LQ_JUNGLE.player.invulnerable=1e9"); await E("LQ_JUNGLE.advance(25)"); qz=await E("({asked:LQ_JUNGLE.questions.asked,next:LQ_JUNGLE.questions.nextIndex,max:LQ_JUNGLE.track.maxIndex,held:LQ_JUNGLE.questions.held,state:LQ_JUNGLE.state,dist:Math.round(LQ_JUNGLE.stats.distance)})"); ok("question board appears some tiles after the tutorial",qz['asked']>0,str(qz))
        # second run: no tutorial
        await E("LQ_JUNGLE.start()"); ok("second run has no tutorial",not (await coach())['show'] and not await E("LQ_JUNGLE.tutorial.active"))
        # replay tutorial from settings
        await E("LQ_JUNGLE.state='menu'; document.getElementById('menuScreen').hidden=false"); await pg.click("#settingsBox summary"); await pg.click('[data-act="tutorial"]')
        ok("'Show tutorial again' resets the flag",not await E("LQ_JUNGLE.profile.data.tutorialDone"))
        await E("LQ_JUNGLE.start()"); await E("LQ_JUNGLE.advance(0.2)"); ok("tutorial replays",await E("LQ_JUNGLE.tutorial.active"))
        await pg.click("#coachSkip"); ok("Skip button ends it immediately and unlocks the game",not await E("LQ_JUNGLE.tutorial.active") and await E("LQ_JUNGLE.director.enabled") and await E("LQ_JUNGLE.profile.data.tutorialDone"))
        # idle child never stuck
        await E("LQ_JUNGLE.profile.resetTutorial(); LQ_JUNGLE.start(); LQ_JUNGLE.player.invulnerable=1e9; LQ_JUNGLE.advance(90)"); ok("a child who does nothing is not stuck (auto-advances)",not await E("LQ_JUNGLE.tutorial.active"))
        errs=[(t,m[:120]) for t,m in logs if t in('error','pageerror','warning')]; ok("no console errors (tutorial)",not errs,str(errs[:2])); await b.close()

        # ---------------- touch device ----------------
        b,pg,logs=await launch(p,844,390,has_touch=True,is_mobile=True,device_scale_factor=2); await boot(pg,URL); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop()")
        await pg.add_init_script("window.__vib=[]; Object.defineProperty(navigator,'vibrate',{value:(ms)=>{window.__vib.push(ms);return true},configurable:true});")
        await pg.reload(); await pg.wait_for_function("window.LQ_JUNGLE && window.LQ_JUNGLE.ready===true",timeout=120000); await E("LQ_JUNGLE.stopLoop()")
        ok("touch device gets on-screen controls",await E("document.body.classList.contains('touch')"))
        await pg.tap("#playBtn"); await E("LQ_JUNGLE.director.enabled=false; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.advance(0.5)")
        ok("touchpad is visible while playing",await E("getComputedStyle(document.getElementById('touchPad')).display")=="block" and await E("document.getElementById('tJump').getBoundingClientRect().width")>=60)
        await pg.tap("#tLeft"); ok("tap ◀ moves left",await E("LQ_JUNGLE.player.laneIndex")==0)
        await pg.tap("#tRight"); await pg.tap("#tRight"); ok("tap ▶ twice moves to right lane",await E("LQ_JUNGLE.player.laneIndex")==2)
        await E("LQ_JUNGLE.advance(0.5)"); await pg.tap("#tJump"); ok("tap ⬆ jumps",await E("LQ_JUNGLE.player.state")=="jump"); await E("LQ_JUNGLE.advance(1.3)")
        await pg.tap("#tSlide"); ok("tap ⬇ slides",await E("LQ_JUNGLE.player.state")=="slide")
        await E("LQ_JUNGLE.advance(1.3); LQ_JUNGLE.player.invulnerable=0; LQ_JUNGLE.obstacles.spawn('rock',LQ_JUNGLE.player.x,-3); LQ_JUNGLE.advance(0.8)")
        ok("phone vibrates when you get hit",70 in await E("window.__vib"),str(await E("window.__vib")))
        await shot(pg,"21_touch")
        errs=[(t,m[:120]) for t,m in logs if t in('error','pageerror','warning')]; ok("no console errors (touch)",not errs,str(errs[:2])); await b.close()

        # ---------------- desktop: no touch pad; report ----------------
        b,pg,logs=await launch(p,960,540); await boot(pg,URL); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop()")
        ok("desktop does not show the touch pad",await E("getComputedStyle(document.getElementById('touchPad')).display")=="none")
        await E("LQ_JUNGLE.profile.recordRun({coins:30,score:500,distance:300,correct:9,wrong:4,bestStreak:4,tally:{math:{right:8,wrong:1},science:{right:1,wrong:3}}}); LQ_JUNGLE.refreshMenuStats()")
        await pg.click("#settingsBox summary")
        rows=await E("[...document.querySelectorAll('.rep-row')].map(r=>r.innerText.replace(/\\s+/g,' '))"); print("   ",rows[:3])
        ok("report shows accuracy per subject",any('Math' in r and '89%' in r for r in rows) and any('Science' in r and '25%' in r for r in rows))
        ok("report gives practise advice",'Practise Science' in await E("document.querySelector('.rep-advice').innerText"))
        await E("window.__printed=0; window.print=()=>{window.__printed++}; 0"); await pg.click('[data-act="print"]')
        pr=await E("document.getElementById('printReport').innerText"); npr=await E("window.__printed"); ok("print builds a clean printable report",npr==1 and 'Progress report' in pr and 'Science' in pr and '25%' in pr,f"printed={npr} :: "+pr.replace("\n"," | ")[:400])
        pg.on("dialog",lambda d: asyncio.ensure_future(d.accept()))
        await pg.click('[data-act="reset"]'); await pg.wait_for_timeout(300)
        d=await E("LQ_JUNGLE.profile.data"); ok("reset wipes progress (after confirmation)",d['games']==0 and d['totalCoins']==0 and d['subjectStats']=={} ,str(d['games']))
        errs=[(t,m[:120]) for t,m in logs if t in('error','pageerror','warning')]; ok("no console errors (desktop)",not errs,str(errs[:2]))
        print("ALL",all(R),f"{sum(R)}/{len(R)}"); await b.close()
asyncio.run(main())
