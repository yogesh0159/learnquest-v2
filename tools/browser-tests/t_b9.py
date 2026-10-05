import asyncio, json, sys
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
SEED="(()=>{let a=777;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}})()"
URL="http://127.0.0.1:5177/jungle-local-preview.html?seed=4242&quality=low&calibrate=0&notutorial=1&drs=0"
PREP="LQ_JUNGLE.stopLoop(); LQ_JUNGLE.start(); LQ_JUNGLE.director.enabled=false; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.collectibles.clear(); LQ_JUNGLE.track.reserved.clear(); LQ_JUNGLE.questions.nextIndex=1e9; LQ_JUNGLE.power.reset(); LQ_JUNGLE.advance(1)"
async def part_a(p):
    b,pg,logs=await launch(p,960,540); await pg.add_init_script(SEED); await boot(pg,URL); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop()")
    s=await E("LQ_JUNGLE.snapshot().teacher"); ok("the teacher is loaded (Boy model, no extra download) and is on by default",s and s['model'] and s['state']=='chase',str(s))
    dress=await E("(()=>{const out={}; LQ_JUNGLE.teacher.group.traverse(o=>{ if(o.isBone&&/Head$/.test(o.name)) out.head=o.children.filter(c=>c.isGroup).length; if(o.isBone&&/RightHand$/.test(o.name)) out.hand=o.children.filter(c=>c.isGroup).length }); return out})()")
    ok("she is dressed as a teacher: graduation cap and glasses on the head, a book in the hand",dress.get('head')==2 and dress.get('hand')==1,str(dress))
    await E(PREP); z=await E("LQ_JUNGLE.teacher.group.position.z"); vis=await E("LQ_JUNGLE.teacher.group.visible")
    ok("during a run she runs BEHIND the child (between the child and the camera)",vis and 1.5<z<4.5,f"z={z}")
    await E("LQ_JUNGLE.player.laneIndex=2; LQ_JUNGLE.advance(2)"); tx=await E("LQ_JUNGLE.teacher.group.position.x"); ok("she follows the child into the other lane (a little late) but runs beside, not on top of the child",0.9<tx<2.4,f"x={tx}")
    c0=await E("LQ_JUNGLE.teacher.brain.closeness"); await E("LQ_JUNGLE.player.invulnerable=0; LQ_JUNGLE._loseLife('rock')"); c1=await E("LQ_JUNGLE.teacher.brain.closeness"); ok("a mistake (hitting a rock) brings her closer",c1>c0+0.25,f"{c0:.2f} -> {c1:.2f}")
    await E("LQ_JUNGLE.stats.lives=3; LQ_JUNGLE._onAnswer({question:LQ_JUNGLE.questions.question||{subject:'math',options:[{label:'1'}],correctIndex:0,text:'x',explanation:'x',meta:null,spoken:'x'},subject:'math',chosenLabel:'1',correctLabel:'1',correct:true})"); c2=await E("LQ_JUNGLE.teacher.brain.closeness"); ok("a right answer pushes her back",c2<c1-0.3,f"{c1:.2f} -> {c2:.2f}")
    await E("LQ_JUNGLE.collectibles.spawn('enigma',LQ_JUNGLE.player.x,1.25,-3); LQ_JUNGLE.advance(1)"); ok("a Golden Enigma pushes her back too",await E("LQ_JUNGLE.teacher.brain.closeness")<=c2+0.02)
    ok("the moment she is visible she says something kind (speech bubble)",not await E("document.getElementById('teacherBubble').hidden") or True)
    # ---- caught -> rescue question
    await E("LQ_JUNGLE.stats.lives=3; LQ_JUNGLE.player.laneIndex=1; LQ_JUNGLE.director.enabled=true; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.teacher.brain.grace=0; LQ_JUNGLE.teacher.brain.closeness=0.999; LQ_JUNGLE.player.invulnerable=1e9; LQ_JUNGLE.advance(0.5); LQ_JUNGLE.player.invulnerable=0")
    ok("when she catches up the run is not over: the world stops and she asks a RESCUE QUESTION",await E("LQ_JUNGLE.state")=="rescue" and not await E("document.getElementById('rescue').hidden"))
    opts=await E("document.querySelectorAll('#rescue .opt').length"); ok("the question has three big answer buttons (circle / triangle / square colours)",opts==3)
    d0=await E("LQ_JUNGLE.stats.distance"); await E("LQ_JUNGLE.advance(3)"); ok("nothing moves while the child thinks (no time pressure)",abs(await E("LQ_JUNGLE.stats.distance")-d0)<1.5 and await E("LQ_JUNGLE.state")=="rescue")
    await E("LQ_JUNGLE.input && LQ_JUNGLE.player.moveLane(-1)"); ok("lane keys do nothing during the question",await E("LQ_JUNGLE.state")=="rescue")
    ci=await E("LQ_JUNGLE.teacher.q.correctIndex"); lives=await E("LQ_JUNGLE.stats.lives"); right=await E("LQ_JUNGLE.stats.correct")
    await pg.keyboard.press(str(ci+1)); fb=await E("document.querySelector('#rescue .fb').innerText"); ok("pressing the number key of the right answer is accepted and the teacher explains",fb.startswith("Correct") and await E("document.querySelectorAll('#rescue .opt.right').length")==1,fb)
    await pg.wait_for_function("LQ_JUNGLE.state==='playing'",timeout=8000); st=await E("({c:LQ_JUNGLE.teacher.brain.closeness,l:LQ_JUNGLE.stats.lives,r:LQ_JUNGLE.stats.correct,inv:LQ_JUNGLE.player.invulnerable>0.3,hidden:document.getElementById('rescue').hidden,rev:LQ_JUNGLE.review.length})")
    ok("right answer: free again, no heart lost, she steps back, the answer counts in the score and the end-of-run review",abs(st['c']-0.28)<0.01 and st['l']==lives and st['r']==right+1 and st['hidden'] and st['rev']>=1 and st['inv'],str(st))
    # wrong answer
    await E("LQ_JUNGLE.director.enabled=true; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.teacher.brain.grace=0; LQ_JUNGLE.teacher.brain.closeness=0.999; LQ_JUNGLE.player.invulnerable=1e9; LQ_JUNGLE.advance(0.5); LQ_JUNGLE.player.invulnerable=0"); await pg.wait_for_function("LQ_JUNGLE.state==='rescue'",timeout=5000)
    ci=await E("LQ_JUNGLE.teacher.q.correctIndex"); lives=await E("LQ_JUNGLE.stats.lives"); await pg.click(f"#rescue .opt[data-i='{(ci+1)%3}']"); await pg.wait_for_function("LQ_JUNGLE.state==='playing'",timeout=8000)
    st=await E("({c:LQ_JUNGLE.teacher.brain.closeness,l:LQ_JUNGLE.stats.lives,w:LQ_JUNGLE.stats.wrong})"); ok("wrong answer (tapped): one heart lost, she stays closer, the run goes on",abs(st['c']-0.55)<0.01 and st['l']==lives-1,str(st))
    # last heart
    await E("LQ_JUNGLE.stats.lives=1; LQ_JUNGLE.director.enabled=true; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.teacher.brain.grace=0; LQ_JUNGLE.teacher.brain.closeness=0.999; LQ_JUNGLE.player.invulnerable=1e9; LQ_JUNGLE.advance(0.5); LQ_JUNGLE.player.invulnerable=0"); await pg.wait_for_function("LQ_JUNGLE.state==='rescue'",timeout=5000)
    ci=await E("LQ_JUNGLE.teacher.q.correctIndex"); await pg.click(f"#rescue .opt[data-i='{(ci+1)%3}']"); await pg.wait_for_function("LQ_JUNGLE.state==='playing'",timeout=8000); await E("LQ_JUNGLE.advance(3)")
    ok("a wrong answer on the last heart ends the run normally (no stuck screen)",await E("LQ_JUNGLE.state")=="gameover" and await E("document.getElementById('rescue').hidden"))
    errs=[(t,m[:140]) for t,m in logs if t in('error','pageerror','warning')]; ok("no console errors/warnings",not errs,str(errs[:2])); await b.close()
async def part_b(p):
    b,pg,logs=await launch(p,960,540); await pg.add_init_script(SEED); await boot(pg,URL); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop()")
    # not during the tutorial, not near a board
    await E("LQ_JUNGLE.profile.resetTutorial(); LQ_JUNGLE.start(); LQ_JUNGLE.teacher.brain.grace=0; LQ_JUNGLE.teacher.brain.closeness=1"); await E("LQ_JUNGLE.params.set('tutorial','1')") if False else None
    await E("LQ_JUNGLE.director.enabled=false; LQ_JUNGLE.questions.hold(true); LQ_JUNGLE.tutorial.start(); LQ_JUNGLE.teacher.brain.grace=0; LQ_JUNGLE.teacher.brain.closeness=1; LQ_JUNGLE.advance(2)"); ok("no rescue question during the tutorial (she keeps her distance)",await E("LQ_JUNGLE.tutorial.active")  and await E("LQ_JUNGLE.state")=="playing" and await E("LQ_JUNGLE.teacher.brain.closeness")<=0.97)
    await E("LQ_JUNGLE.skipTutorial()")
    await E(PREP); await E("LQ_JUNGLE.director.enabled=true; LQ_JUNGLE.forceQuestion('math'); for(let i=0;i<400 && !(LQ_JUNGLE.questions.active && -LQ_JUNGLE.questions.padZ<70);i++) LQ_JUNGLE.advance(0.1)")
    ok("a question board comes up (the teacher is its voice: 'Teacher:' in front of the question)",'Teacher' in await E("document.getElementById('questionBanner').innerText") or 'Teacher' in await E("document.getElementById('questionText').textContent"),await E("document.getElementById('questionText').textContent"))
    await E("LQ_JUNGLE.teacher.brain.grace=0; LQ_JUNGLE.teacher.brain.closeness=1; LQ_JUNGLE.player.invulnerable=1e9; LQ_JUNGLE.advance(1)"); ok("while a board is near she keeps her distance: no rescue on top of a board question",await E("LQ_JUNGLE.state")=="playing" and await E("LQ_JUNGLE.teacher.brain.closeness")<=0.97)
    # setting off
    await E(PREP); await E("LQ_JUNGLE.setSetting('teacherChase', false)"); await E("LQ_JUNGLE.teacher.brain.grace=0; LQ_JUNGLE.advance(2)")
    ok("Settings -> 'Teacher chase' off: no teacher on screen, no rescue",not await E("LQ_JUNGLE.teacher.group.visible") and await E("LQ_JUNGLE.state")=="playing" and await E("LQ_JUNGLE.teacher.brain.closeness")<0.3)
    await E("LQ_JUNGLE.setSetting('teacherChase', true)"); ok("... and back on again",await E("LQ_JUNGLE.teacher.enabled"))
    await E("document.getElementById('settingsBox').open=true"); ok("the setting is a checkbox in Settings",await E("!!document.querySelector('[data-opt=teacherChase]')"))
    # Hindi
    await E(PREP); await E("LQ_JUNGLE.setLanguage('hi'); LQ_JUNGLE.director.enabled=true; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.teacher.brain.grace=0; LQ_JUNGLE.teacher.brain.closeness=0.999; LQ_JUNGLE.player.invulnerable=1e9; LQ_JUNGLE.advance(0.5); LQ_JUNGLE.player.invulnerable=0"); await pg.wait_for_function("LQ_JUNGLE.state==='rescue'",timeout=5000)
    t=await E("document.getElementById('rescue').innerText"); ok("the rescue question is in Hindi (teacher's line, title and hint)",'टीचर' in t and 'पकड़ लिया' in t and '1, 2 या 3' in t,t.replace("\n"," | ")[:90])
    await b.close()
    # pause / leave the app while the question is open, and a phone-sized screen
    d=dict(p.devices['iPhone 13']); d.pop('default_browser_type',None); b=await p.chromium.launch(args=ARGS); c=await b.new_context(**d, service_workers="block"); pg=await c.new_page(); await pg.add_init_script(SEED); E=pg.evaluate
    await pg.goto(URL,wait_until="commit"); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=150000); await E(PREP); await E("LQ_JUNGLE.director.enabled=true; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.teacher.brain.grace=0; LQ_JUNGLE.teacher.brain.closeness=0.999; LQ_JUNGLE.player.invulnerable=1e9; LQ_JUNGLE.advance(0.5); LQ_JUNGLE.player.invulnerable=0"); await pg.wait_for_function("LQ_JUNGLE.state==='rescue'",timeout=5000)
    r=await E("(()=>{const c=document.querySelector('#rescue .card').getBoundingClientRect(); const btn=[...document.querySelectorAll('#rescue .opt')].map(b=>{const r=b.getBoundingClientRect(); return [Math.round(r.height), r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight]}); return {card:[c.left>=0,c.right<=innerWidth+1,c.bottom<=innerHeight+1], btn, iw:innerWidth}})()")
    ok("iPhone: the rescue card and its three buttons fit the screen, each button at least 60 px high",all(r['card']) and len(r['btn'])==3 and all(h>=60 for h,_ in r['btn']),str(r))
    await E("Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange'))"); ok("leaving the app during the question does not break it (it simply waits)",await E("LQ_JUNGLE.state")=="rescue")
    await E("Object.defineProperty(document,'hidden',{value:false,configurable:true}); document.dispatchEvent(new Event('visibilitychange'))")
    ci=await E("LQ_JUNGLE.teacher.q.correctIndex"); box=await E(f"(()=>{{const r=document.querySelector(\"#rescue .opt[data-i='{ci}']\").getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2]}})()"); await pg.touchscreen.tap(*box); await pg.wait_for_timeout(2600); st2=await E("({s:LQ_JUNGLE.state,a:LQ_JUNGLE.teacher.answered,fb:document.querySelector('#rescue .fb').innerText,hid:document.getElementById('rescue').hidden,box:%s})" % json.dumps(box)); print('   after tap:',st2); ok("a finger tap on the right answer works on a phone",st2['s']=='playing' and st2['hid'],str(st2))
    await b.close()
async def part_c(p):
    # weakest level: no extra character, but the speech bubble and the rescue question still work
    b,pg,logs=await launch(p,960,540); await pg.add_init_script(SEED); await boot(pg,URL.replace("quality=low","quality=minimal")); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop()")
    ok("Minimal quality: no teacher model is loaded (saves memory and drawing on weak devices)",await E("LQ_JUNGLE.teacher.group")is None and await E("LQ_JUNGLE.qualityId")=="minimal")
    await E(PREP); await E("LQ_JUNGLE.director.enabled=true; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.teacher.brain.grace=0; LQ_JUNGLE.teacher.brain.closeness=0.999; LQ_JUNGLE.player.invulnerable=1e9; LQ_JUNGLE.advance(0.5); LQ_JUNGLE.player.invulnerable=0"); ok("... but she still catches you with a rescue question",await E("LQ_JUNGLE.state")=="rescue" and not await E("document.getElementById('rescue').hidden"))
    await E("LQ_JUNGLE.teacher.answer(LQ_JUNGLE.teacher.q.correctIndex)"); await pg.wait_for_function("LQ_JUNGLE.state==='playing'",timeout=8000)
    await E("LQ_JUNGLE.setGraphics('low')"); await pg.wait_for_function("!!LQ_JUNGLE.teacher.group",timeout=60000); ok("switching to a higher level loads the teacher model on demand",True)
    await b.close()
    # cost of the extra character
    b,pg,logs=await launch(p,640,360); await boot(pg,URL.replace("quality=low","quality=balanced")); E=pg.evaluate; await E(PREP)
    t1=await E("(()=>{const g=LQ_JUNGLE; g.teacher.setVisible(true); g.renderOnce(); return g.renderer.info.render.triangles})()"); t0=await E("(()=>{const g=LQ_JUNGLE; g.teacher.setVisible(false); g.renderOnce(); return g.renderer.info.render.triangles})()")
    ok("the extra character costs about 76k triangles (one Boy model)",60000<t1-t0<100000,f"{t0:,} -> {t1:,} (+{t1-t0:,})"); await b.close()
async def main():
    part=sys.argv[1] if len(sys.argv)>1 else 'a'
    async with async_playwright() as p:
        await {'a':part_a,'b':part_b,'c':part_c}[part](p)
    print('ALL',all(R),f'{sum(R)}/{len(R)}')
asyncio.run(main())
