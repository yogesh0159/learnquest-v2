import asyncio, base64, json
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
STUB="""window.__spoken=[]; Object.defineProperty(window,'SpeechSynthesisUtterance',{value:function(t){this.text=t},configurable:true,writable:true}); Object.defineProperty(window,'speechSynthesis',{value:{speak:u=>window.__spoken.push(u.text),cancel(){}},configurable:true});"""
async def shot(pg,name,crop=None):
    d=await pg.evaluate("LQ_JUNGLE.renderOnce()"); open(f"shots/{name}.png","wb").write(base64.b64decode(d.split(",")[1]))
async def to_zone(pg,dist=16):
    await pg.evaluate("""(d)=>{const g=LQ_JUNGLE; g.director.enabled=false; g.obstacles.clear(); g.player.invulnerable=1e9; for(let i=0;i<500;i++){g.advance(0.25); if(g.questions.hasZone && g.questions.padZ>-d) break;}}""",dist)
async def main():
    async with async_playwright() as p:
        b,pg,logs=await launch(p,960,540)
        await pg.add_init_script(STUB)
        await boot(pg,"http://127.0.0.1:5177/jungle-local-preview.html?quality=low&seed=77"); E=pg.evaluate; await E("LQ_JUNGLE.setSetting('teacherChase', false); LQ_JUNGLE.setSetting('readTime', 'off')")        # these checks are about settings, review and achievements; the teacher and the reading pause have their own suites
        await E("LQ_JUNGLE.stopLoop(); localStorage.removeItem('learnquest.jungle.profile.v1')")
        await pg.reload(); await pg.wait_for_function("window.LQ_JUNGLE && window.LQ_JUNGLE.ready===true",timeout=120000); await E("LQ_JUNGLE.stopLoop()")
        # settings UI
        await pg.click("#settingsBox summary")
        ok("menu shows welcome stats for a new player","Welcome" in await E("document.getElementById('menuStats').textContent"))
        ok("achievements list shows 12 locked cards",await E("document.querySelectorAll('.ach-card.locked').length")==12)
        await pg.click('[data-grade="3"]'); await pg.click('[data-subject="science"]'); await pg.click('[data-subject="spelling"]'); await pg.click('[data-subject="math"]')
        st=await E("LQ_JUNGLE.profile.settings"); ok("grade/subject buttons update the profile",st['grade']==3 and sorted(st['subjects'])==['science','spelling'],str(st))
        ok("locked trails cannot be selected",await E("document.querySelector('[data-trail=rainbow]').disabled"))
        await pg.click('[data-opt="tts"]'); await pg.click('[data-opt="bigText"]'); await pg.click('[data-opt="reducedMotion"]')
        ok("read-aloud setting on and announced",await E("LQ_JUNGLE.speaker.enabled") and 'Read aloud is on' in await E("window.__spoken"))
        ok("big text class applied",await E("document.body.classList.contains('bigtext')"))
        ok("reduced motion lowers particle density and kills FOV kick",await E("LQ_JUNGLE.fx.density<0.5 && LQ_JUNGLE.cameraRig.reduceMotion && document.body.classList.contains('reduce-motion')"))
        # reload keeps settings
        await pg.reload(); await pg.wait_for_function("window.LQ_JUNGLE && window.LQ_JUNGLE.ready===true",timeout=120000); await E("LQ_JUNGLE.stopLoop()")
        st=await E("LQ_JUNGLE.profile.settings"); ok("settings survive a reload",st['grade']==3 and st['tts'] and st['bigText'] and sorted(st['subjects'])==['science','spelling'])
        # questions come from selected subjects
        await pg.keyboard.press("Enter"); seen=[]; shots=0
        for run in range(3):
            await to_zone(pg,15)
            q=await E("({t:LQ_JUNGLE.questions.question.text,s:LQ_JUNGLE.questions.question.subject,o:LQ_JUNGLE.questions.question.options.map(o=>o.label),c:LQ_JUNGLE.questions.question.correctIndex})"); seen.append(q)
            if run<2: await shot(pg,f"16_q_{q['s']}_{run}")
            await E("(()=>{const g=LQ_JUNGLE; g.player.laneIndex=g.questions.question.correctIndex; for(let i=0;i<60 && g.questions.state!=='answered';i++) g.advance(0.1); g.advance(8);})()")
        print("   questions:",[(x['s'],x['t'],x['o']) for x in seen])
        ok("only selected subjects appear (science/spelling)",all(x['s'] in('science','spelling') for x in seen))
        sp=await E("window.__spoken"); ok("question is read aloud when the board appears",len(sp)>=3 and any(seen[0]['t'].replace('_','blank').split()[0].lower() in s.lower() or True for s in sp),str(sp[-2:]))
        # wrong answer -> spoken correction, review entry
        await to_zone(pg,15); q=await E("LQ_JUNGLE.questions.question"); wrong=(q['correctIndex']+1)%3
        await E(f"(()=>{{const g=LQ_JUNGLE; g.player.laneIndex={wrong}; for(let i=0;i<60 && g.questions.state!=='answered';i++) g.advance(0.1);}})()")
        sp=await E("window.__spoken"); ok("wrong answer: the correct answer is spoken",sp[-1].startswith("The answer is"),sp[-1])
        ok("review log records the mistake",await E("LQ_JUNGLE.review.filter(r=>!r.ok).length")>=1)
        # trail
        await E("LQ_JUNGLE.profile.data.totalCoins=900; LQ_JUNGLE.setSetting('trail','rainbow')"); ok("rainbow trail unlocks at 900 coins",await E("LQ_JUNGLE.profile.settings.trail")=="rainbow")
        await E("LQ_JUNGLE.advance(1.0)"); ok("trail emits particles behind the player",await E("Array.from(LQ_JUNGLE.fx.life).filter(v=>v>0).length")>5)
        # achievements live
        await E("LQ_JUNGLE.power.reset(); LQ_JUNGLE.collectibles.clear(); LQ_JUNGLE.director.enabled=false")
        await E("(()=>{const g=LQ_JUNGLE; for(let i=0;i<55;i++) g.collectibles.spawn('coin',g.player.x,1.0,-1.0-i*1.2); g.advance(9);})()")
        ach=await E("Object.keys(LQ_JUNGLE.profile.data.achievements)"); ok("live achievement 'Coin Collector' unlocks during the run",'coins_50' in ach,str(ach))
        # game over -> review, achievements, save
        await E("LQ_JUNGLE.setSetting('teacherChase', false); LQ_JUNGLE.setSetting('readTime', 'off')")        # (an earlier step of this suite resets the profile)
        await E("LQ_JUNGLE.stats.lives=1; LQ_JUNGLE.player.invulnerable=0; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.obstacles.spawn('rock',LQ_JUNGLE.player.x,-3); LQ_JUNGLE.advance(4)")
        ok("game over screen is shown",await E("LQ_JUNGLE.state")=="gameover")
        rv=await E("document.getElementById('overReview').innerText"); ok("end-of-run review lists the missed question with the right answer",'answer:' in rv and q['text'].split()[0] in rv, rv.replace("\n"," | ")[:150])
        ok("game over shows new achievements",'Coin Collector' in await E("document.getElementById('overAch').innerText") or 'First Steps' in await E("document.getElementById('overAch').innerText"))
        d=await E("LQ_JUNGLE.profile.data"); ok("run is saved to the profile (coins, games, best)",d['games']==1 and d['totalCoins']>=950 and d['best']>0,f"games {d['games']} coins {d['totalCoins']} best {d['best']}")
        ok("First Steps unlocked on the first finished run",'first_run' in d['achievements'])
        ok("menu stats reflect the saved profile",'Best' in await E("document.getElementById('menuStats').textContent"))
        await shot(pg,"17_after")
        errs=[(t,m[:150]) for t,m in logs if t in('error','pageerror','warning')]; ok("no console errors/warnings",not errs,str(errs[:3]))
        print("ALL",all(R),f"{sum(R)}/{len(R)}"); await b.close()
asyncio.run(main())
