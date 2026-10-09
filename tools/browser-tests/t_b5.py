import asyncio, base64, re
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
URL="http://127.0.0.1:5177/jungle-local-preview.html?quality=low&seed=7"
DEV=re.compile(r'[\u0900-\u097F]')
async def txt(pg,sel): return await pg.evaluate("(s)=>document.querySelector(s).innerText.trim()",sel)
async def main():
    async with async_playwright() as p:
        # ---- browser language decides when nothing is saved
        b,pg,logs=await launch(p,960,540,tutorial_done=False,locale="hi-IN"); await boot(pg,URL); E=pg.evaluate; await E("LQ_JUNGLE.setSetting('readTime', 'off')")        # this suite collects questions while running: the question pause has its own tests; await E("LQ_JUNGLE.stopLoop()")
        ok("a Hindi browser gets Hindi automatically",await E("document.documentElement.lang")=="hi" and DEV.search(await txt(pg,"#playBtn")),await txt(pg,"#playBtn"))
        await b.close()
        b,pg,logs=await launch(p,960,540,tutorial_done=True); await boot(pg,URL+"&lang=hi"); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop()"); await E("LQ_JUNGLE.setSetting('readTime', 'off')")
        ok("?lang=hi: menu is in Hindi",await txt(pg,"#menuScreen h1")=="जंगल रन" and await txt(pg,"#playBtn")=="खेलो",await txt(pg,"#menuScreen h1"))
        ok("hint line, boy/girl buttons and settings title are Hindi",all(DEV.search(x) for x in [await txt(pg,".hint"),await txt(pg,"[data-character=boy]"),await txt(pg,"#settingsBox summary")]) )
        await pg.click("#settingsBox summary"); body=await txt(pg,"#settingsBody")
        left=[w for w in ["Grade","Subjects","Progress report","Achievements","Reset all","Running trail","Help &","Read questions","Bigger text"] if w in body]
        ok("settings panel, report and achievements are all Hindi (no English UI words left)",not left and DEV.search(body),str(left)+" | "+body[:90].replace("\n"," "))
        ok("the 12 achievements are named in Hindi",await E("[...document.querySelectorAll('.ach-card b')].filter(b=>/[\\u0900-\\u097F]/.test(b.textContent)).length")==12)
        # live switching
        await pg.click('[data-lang="mr"]'); ok("switch to Marathi live",await txt(pg,"#playBtn")=="खेळा" and await E("document.documentElement.lang")=="mr",await txt(pg,"#playBtn"))
        await pg.click('[data-lang="en"]'); ok("switch back to English live",await txt(pg,"#playBtn")=="Play" and "Grade 1" in await txt(pg,"#settingsBody"))
        await pg.click('[data-lang="hi"]'); st=await E("LQ_JUNGLE.profile.settings.language"); ok("the choice is saved in the profile",st=="hi",st)
        await pg.reload(); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=90000); await pg.evaluate("LQ_JUNGLE.stopLoop()")
        ok("...and remembered after a reload (no ?lang needed)",await txt(pg,"#playBtn")=="खेलो")
        await pg.click('[data-lang="en"]')
        # ---- inside the game in Hindi
        await pg.click('[data-lang="hi"]'); await pg.keyboard.press("Enter"); await E("LQ_JUNGLE.director.enabled=false; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.track.reserved.clear(); LQ_JUNGLE.questions.nextIndex=1e9; LQ_JUNGLE.advance(0.5)")
        hud=await txt(pg,".chips"); ok("HUD labels are Hindi",("स्कोर" in hud) and ("दूरी" in hud),hud.replace("\n"," ")[:60])
        await E("for(let i=0;i<5;i++) LQ_JUNGLE.collectibles.spawn('coin',LQ_JUNGLE.player.x,1,-1.2-i*1.2); LQ_JUNGLE.advance(1.5)"); ok("combo chip is Hindi","कॉम्बो" in await E("document.getElementById('hudCombo').textContent"),await E("document.getElementById('hudCombo').textContent"))
        await E("LQ_JUNGLE.power.reset(); LQ_JUNGLE.collectibles.spawn('enigma',LQ_JUNGLE.player.x,1.25,-3); LQ_JUNGLE.advance(1)"); tt=await E("document.getElementById('toast').textContent")+" | "+await E("document.getElementById('hudPower').innerText"); ok("power-up toast and HUD chip are Hindi",bool(DEV.search(tt)),tt)
        # questions in Hindi: shapes + compare + math
        res={}
        for subj in ["shapes","patterns","math","science"]:
            await E(f"LQ_JUNGLE.forceQuestion('{subj}'); LQ_JUNGLE.player.invulnerable=1e9; for(let i=0;i<700 && !(LQ_JUNGLE.questions.hasZone && LQ_JUNGLE.questions.padZ>-20 && LQ_JUNGLE.questions.question.subject==='{subj}');i++) LQ_JUNGLE.advance(0.2)")
            q=await E("({subject:LQ_JUNGLE.questions.question.subject, banner:document.getElementById('questionText').textContent, label:document.getElementById('questionBanner').innerText.split('\\n')[0]})"); res[subj]=q
            if subj=="shapes":
                await E("LQ_JUNGLE.cameraRig.enabled=false; const bz=LQ_JUNGLE.questions.boardZ; LQ_JUNGLE.camera.fov=42; LQ_JUNGLE.camera.updateProjectionMatrix(); LQ_JUNGLE.camera.position.set(0,3.4,bz+14); LQ_JUNGLE.camera.lookAt(0,3.4,bz)")
                d=await E("LQ_JUNGLE.renderOnce()"); open("shots/60_hindi_board.png","wb").write(base64.b64decode(d.split(",")[1])); await E("LQ_JUNGLE.cameraRig.enabled=true")
            await E("(()=>{const g=LQ_JUNGLE; g.player.laneIndex=g.questions.question.correctIndex; for(let i=0;i<80&&g.questions.state!=='answered';i++) g.advance(0.1); g.advance(6);})()")
        print("   ",{k:v['banner'] for k,v in res.items()})
        ok("shape question is asked in Hindi (e.g. 'त्रिभुज की कितनी भुजाएँ होती हैं?')",bool(DEV.search(res['shapes']['banner'])) and res['shapes']['subject']=='shapes',res['shapes']['banner'])
        ok("question label above the banner is Hindi (सवाल)","सवाल" in res['shapes']['label'],res['shapes']['label'])
        ok("maths and pattern questions stay language-neutral digits",re.search(r'\d',res['math']['banner']) is not None and re.search(r'\d',res['patterns']['banner']) is not None)
        sq=res['science']['banner'].split(':',1)[-1]; ok("science questions stay English content (by design); only the teacher's label is translated",not DEV.search(sq) and DEV.search(res['science']['banner']),res['science']['banner'])
        # wrong answer + review in Hindi
        await E("LQ_JUNGLE.forceQuestion('shapes'); LQ_JUNGLE.player.invulnerable=0; LQ_JUNGLE.power.reset(); for(let i=0;i<700 && !(LQ_JUNGLE.questions.hasZone && LQ_JUNGLE.questions.padZ>-14 && LQ_JUNGLE.questions.question.subject==='shapes');i++) LQ_JUNGLE.advance(0.2); LQ_JUNGLE.player.laneIndex=(LQ_JUNGLE.questions.question.correctIndex+1)%3; for(let i=0;i<80&&LQ_JUNGLE.questions.state!=='answered';i++) LQ_JUNGLE.advance(0.1)")
        ok("wrong-answer toast is Hindi",bool(DEV.search(await E("document.getElementById('toast').textContent"))),await E("document.getElementById('toast').textContent"))
        await E("LQ_JUNGLE.stats.lives=1; LQ_JUNGLE.player.invulnerable=0; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.obstacles.spawn('rock',LQ_JUNGLE.player.x,-3); LQ_JUNGLE.advance(4)")
        over=await txt(pg,"#gameOverScreen"); left=[w for w in ["Great run","Play again","Score","Coins","Distance","Questions right","You chose","practise"] if w in over]
        ok("game-over screen, review and achievements are Hindi",not left and "शानदार दौड़!" in over,str(left)+" | "+over.replace("\n"," ")[:100])
        await pg.screenshot(path="shots/61_hindi_over.png",timeout=120000)
        errs=[(t,m[:140]) for t,m in logs if t in('error','pageerror','warning')]; ok("no console errors/warnings",not errs,str(errs[:3]))
        print("ALL",all(R),f"{sum(R)}/{len(R)}"); await b.close()
asyncio.run(main())
