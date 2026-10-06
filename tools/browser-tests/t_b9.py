import asyncio, json, sys
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
SEED="(()=>{let a=777;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}})()"
URL="http://127.0.0.1:5177/jungle-local-preview.html?seed=4242&quality=low&calibrate=0&notutorial=1&drs=0"
PREP="LQ_JUNGLE.stopLoop(); LQ_JUNGLE.start(); LQ_JUNGLE.director.enabled=true; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.collectibles.clear(); LQ_JUNGLE.track.reserved.clear(); LQ_JUNGLE.questions.nextIndex=1e9; LQ_JUNGLE.power.reset(); LQ_JUNGLE.stats.lives=5; LQ_JUNGLE.stats.maxLives=5; LQ_JUNGLE.advance(1); LQ_JUNGLE.teacher.brain.grace=0"
HIT="LQ_JUNGLE.player.invulnerable=0; LQ_JUNGLE._loseLife('rock')"
FAKEQ="({subject:'math',level:1,text:'8 + 5 = ?',options:[{label:'13',value:13},{label:'12',value:12},{label:'14',value:14}],correctIndex:0,explanation:'8 + 5 = 13',spoken:'8 plus 5 equals?',meta:{kind:'add',a:8,b:5}})"
WRONG="(()=>{const q="+FAKEQ+"; LQ_JUNGLE.player.invulnerable=0; LQ_JUNGLE._onAnswer({question:q,subject:'math',chosenLabel:'12',correctLabel:'13',correct:false})})()"
async def part_a(p):
    b,pg,logs=await launch(p,960,540); await pg.add_init_script(SEED); await boot(pg,URL); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop()")
    s=await E("LQ_JUNGLE.snapshot().teacher"); ok("the teacher is loaded (Boy model, no extra download) and is on by default",s and s['model'] and s['state']=='far',str(s))
    dress=await E("(()=>{const out={}; LQ_JUNGLE.teacher.group.traverse(o=>{ if(o.isBone&&/Head$/.test(o.name)) out.head=o.children.filter(c=>c.isGroup).length; if(o.isBone&&/RightHand$/.test(o.name)) out.hand=o.children.filter(c=>c.isGroup).length }); return out})()")
    ok("she is dressed as a teacher: graduation cap and glasses on the head, a book in the hand",dress.get('head')==2 and dress.get('hand')==1,str(dress))
    await E(PREP); await E("LQ_JUNGLE.advance(3)"); z=await E("LQ_JUNGLE.teacher.group.position.z"); ok("while running she is BEHIND the child, a few steps back, visible on screen",await E("LQ_JUNGLE.teacher.group.visible") and 2.8<z<3.6,f"z={z:.2f}")
    await E("LQ_JUNGLE.player.laneIndex=2; LQ_JUNGLE.advance(2)"); tx=await E("LQ_JUNGLE.teacher.group.position.x"); ok("she follows him into the other lane but runs beside, not on top of him",0.9<tx<2.4,f"x={tx:.2f}")
    # ---- first stumble: she runs right up behind him (no catch yet)
    l0=await E("LQ_JUNGLE.stats.lives"); await E(HIT); await E("LQ_JUNGLE.advance(1.5)"); z=await E("LQ_JUNGLE.teacher.group.position.z")
    st=await E("({s:LQ_JUNGLE.teacher.brain.state,g:LQ_JUNGLE.state,panel:!document.getElementById('rescue').hidden,l:LQ_JUNGLE.stats.lives})")
    ok("FIRST stumble: she runs right up behind him (close) - the game goes on, nobody is caught yet",st['s']=='close' and st['g']=='playing' and not st['panel'] and st['l']==l0-1 and z<2.3,f"{st} z={z:.2f}")
    await E("LQ_JUNGLE.player.laneIndex=1; LQ_JUNGLE.advance(1)"); tx=await E("Math.abs(LQ_JUNGLE.teacher.group.position.x-LQ_JUNGLE.player.x)"); ok("when close she is almost directly behind him",tx<0.9,f"dx={tx:.2f}")
    # ---- second stumble while she is close: she grabs him and asks the escape question
    await E("LQ_JUNGLE.advance(1.5)"); l1=await E("LQ_JUNGLE.stats.lives"); await E(HIT); await E("LQ_JUNGLE.advance(0.4)")
    st=await E("({g:LQ_JUNGLE.state,panel:!document.getElementById('rescue').hidden,opts:document.querySelectorAll('#rescue .opt').length,title:document.querySelector('#rescue .title').innerText,go:document.querySelector('#rescue .go').hidden,b:LQ_JUNGLE.teacher.brain.state})")
    ok("SECOND stumble while she is close: she GRABS him - the world stops and she asks an escape question with 3 answers",st['g']=='rescue' and st['panel'] and st['opts']==3 and st['go'] and st['title']=='Caught!' and st['b']=='caught',str(st))
    d0=await E("LQ_JUNGLE.stats.distance"); await E("LQ_JUNGLE.advance(3)"); ok("nothing moves while he thinks (no time pressure)",abs(await E("LQ_JUNGLE.stats.distance")-d0)<1.5)
    ci=await E("LQ_JUNGLE.teacher.q.correctIndex"); lives=await E("LQ_JUNGLE.stats.lives"); await pg.keyboard.press(str(ci+1)); await pg.wait_for_function("LQ_JUNGLE.state==='playing'",timeout=8000)
    st=await E("({l:LQ_JUNGLE.stats.lives,b:LQ_JUNGLE.teacher.brain.state,inv:LQ_JUNGLE.player.invulnerable>0.3,hidden:document.getElementById('rescue').hidden,rev:LQ_JUNGLE.review.length})")
    ok("escape question answered RIGHT: he wins his heart back, runs free, she stays right behind for a few seconds",st['l']==lives+1 and st['b']=='close' and st['inv'] and st['hidden'] and st['rev']>=1,str(st))
    # ---- wrong answer at a board: grabbed at once, she shows the right answer
    await E("LQ_JUNGLE.teacher.brain.state='far'; LQ_JUNGLE.advance(0.5)"); l2=await E("LQ_JUNGLE.stats.lives"); await E(WRONG); await E("LQ_JUNGLE.advance(0.4)")
    st=await E("({g:LQ_JUNGLE.state,panel:!document.getElementById('rescue').hidden,ans:document.querySelector('#rescue .ans').innerText,fb:document.querySelector('#rescue .fb').innerText,opts:document.querySelectorAll('#rescue .opt').length,go:!document.querySelector('#rescue .go').hidden,l:LQ_JUNGLE.stats.lives,say:document.querySelector('#rescue .say').innerText})")
    ok("WRONG answer: she grabs him at once, shows the RIGHT answer big and explains it (no second question), one heart lost",st['g']=='rescue' and st['panel'] and st['ans']=='13' and '8 + 5 = 13' in st['fb'] and st['opts']==0 and st['go'] and st['l']==l2-1,str(st))
    await pg.click("#rescue .go"); await pg.wait_for_function("LQ_JUNGLE.state==='playing'",timeout=5000); ok("'Run again!' lets him go; she stays right behind for a moment",await E("LQ_JUNGLE.teacher.brain.state")=='close' and await E("document.getElementById('rescue').hidden"))
    # ---- right answers send her back
    await E("LQ_JUNGLE.advance(1)"); await E("for(let i=0;i<4;i++) LQ_JUNGLE.teacher.event('correct')"); ok("right answers push her back (far again)",await E("LQ_JUNGLE.teacher.brain.state")=='far')
    # ---- time heals: she drops back by herself
    await E("LQ_JUNGLE.advance(1); LQ_JUNGLE.player.invulnerable=0; LQ_JUNGLE._loseLife('rock'); LQ_JUNGLE.god=true; LQ_JUNGLE.advance(15); LQ_JUNGLE.god=false"); ok("if he runs well for 14 seconds she drops back by herself",await E("LQ_JUNGLE.teacher.brain.state")=='far')
    # ---- last heart: the run ends normally
    await E("LQ_JUNGLE.stats.lives=1; LQ_JUNGLE.teacher.brain.state='close'; LQ_JUNGLE.teacher.brain.closeLeft=20; LQ_JUNGLE.player.invulnerable=0; LQ_JUNGLE._loseLife('rock'); LQ_JUNGLE.advance(3)")
    ok("a stumble on the last heart ends the run normally (no catch scene, no stuck screen)",await E("LQ_JUNGLE.state")=="gameover" and await E("document.getElementById('rescue').hidden"))
    errs=[(t,m[:140]) for t,m in logs if t in('error','pageerror','warning')]; ok("no console errors/warnings",not errs,str(errs[:2])); await b.close()
async def part_b(p):
    b,pg,logs=await launch(p,960,540); await pg.add_init_script(SEED); await boot(pg,URL); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop()")
    await E("LQ_JUNGLE.start(); LQ_JUNGLE.director.enabled=false; LQ_JUNGLE.questions.hold(true); LQ_JUNGLE.tutorial.start(); LQ_JUNGLE.advance(1)"); await E(HIT); await E("LQ_JUNGLE.advance(2)"); await E("LQ_JUNGLE.player.invulnerable=0; LQ_JUNGLE._loseLife('rock'); LQ_JUNGLE.advance(1)")
    ok("during the tutorial she never grabs him",await E("LQ_JUNGLE.tutorial.active") and await E("LQ_JUNGLE.state")=="playing" and await E("document.getElementById('rescue').hidden")); await E("LQ_JUNGLE.skipTutorial()")
    await E(PREP); await E("LQ_JUNGLE.setSetting('teacherChase', false)"); await E(HIT+"; LQ_JUNGLE.advance(1); "+HIT+"; LQ_JUNGLE.advance(1)")
    ok("Settings -> 'Teacher chase' off: no teacher on screen and nobody is grabbed",not await E("LQ_JUNGLE.teacher.group.visible") and await E("LQ_JUNGLE.state")=="playing"); await E("LQ_JUNGLE.setSetting('teacherChase', true)")
    await E("document.getElementById('settingsBox').open=true"); ok("the setting is a checkbox in Settings",await E("!!document.querySelector('[data-opt=teacherChase]')"))
    await E(PREP); await E("LQ_JUNGLE.setLanguage('hi')"); await E(WRONG); await E("LQ_JUNGLE.advance(0.4)")
    t=await E("document.getElementById('rescue').innerText"); ok("the catch scene is in Hindi (title, the right answer, button)",'पकड़ लिया' in t and 'फिर दौड़ो' in t and '13' in t,t.replace("\n"," | ")[:100])
    await b.close()
    d=dict(p.devices['iPhone 13']); d.pop('default_browser_type',None); b=await p.chromium.launch(args=ARGS); c=await b.new_context(**d, service_workers="block"); pg=await c.new_page(); await pg.add_init_script(SEED); E=pg.evaluate
    await pg.goto(URL,wait_until="commit"); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=150000); await E(PREP); await E(HIT+"; LQ_JUNGLE.advance(1.2); "+HIT+"; LQ_JUNGLE.advance(0.4)"); await pg.wait_for_function("LQ_JUNGLE.state==='rescue'",timeout=5000)
    r=await E("(()=>{const c=document.querySelector('#rescue .card').getBoundingClientRect(); const btn=[...document.querySelectorAll('#rescue .opt')].map(b=>{const r=b.getBoundingClientRect(); return [Math.round(r.height), r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight]}); return {card:[c.left>=0,c.right<=innerWidth+1,c.bottom<=innerHeight+1], btn}})()")
    ok("iPhone: the escape question fits the screen, three buttons at least 60 px high",all(r['card']) and len(r['btn'])==3 and all(h>=60 and f for h,f in r['btn']),str(r))
    ci=await E("LQ_JUNGLE.teacher.q.correctIndex"); box=await E(f"(()=>{{const r=document.querySelector(\"#rescue .opt[data-i='{ci}']\").getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2]}})()"); await pg.touchscreen.tap(*box); await pg.wait_for_timeout(2600); ok("iPhone: a finger tap answers and lets him go",await E("LQ_JUNGLE.state")=="playing")
    await E(PREP); await E(WRONG); await E("LQ_JUNGLE.advance(0.3)"); r=await E("(()=>{const c=document.querySelector('#rescue .card').getBoundingClientRect(), g=document.querySelector('#rescue .go').getBoundingClientRect(); return [c.left>=0&&c.right<=innerWidth+1&&c.bottom<=innerHeight+1, g.height>=44&&g.right<=innerWidth]})()"); ok("iPhone: the 'wrong answer' scene fits and its button is easy to tap",all(r),str(r)); await b.close()
async def part_c(p):
    b,pg,logs=await launch(p,960,540); await pg.add_init_script(SEED); await boot(pg,URL.replace("quality=low","quality=minimal")); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop()")
    ok("Minimal quality: no teacher model is loaded (saves memory and drawing on weak devices)",await E("LQ_JUNGLE.teacher.group")is None and await E("LQ_JUNGLE.qualityId")=="minimal")
    await E(PREP); await E(HIT+"; LQ_JUNGLE.advance(1); "+HIT+"; LQ_JUNGLE.advance(0.4)"); ok("... but the catch scene still works (escape question)",await E("LQ_JUNGLE.state")=="rescue" and not await E("document.getElementById('rescue').hidden"))
    await E("LQ_JUNGLE.teacher.answer(LQ_JUNGLE.teacher.q.correctIndex)"); await pg.wait_for_function("LQ_JUNGLE.state==='playing'",timeout=8000)
    await E("LQ_JUNGLE.setGraphics('low')"); await pg.wait_for_function("!!LQ_JUNGLE.teacher.group",timeout=60000); ok("switching to a higher level loads the teacher model on demand",True); await b.close()
    b,pg,logs=await launch(p,640,360); await boot(pg,URL.replace("quality=low","quality=balanced")); E=pg.evaluate; await E(PREP)
    t1=await E("(()=>{const g=LQ_JUNGLE; g.teacher.setVisible(true); g.renderOnce(); return g.renderer.info.render.triangles})()"); t0=await E("(()=>{const g=LQ_JUNGLE; g.teacher.setVisible(false); g.renderOnce(); return g.renderer.info.render.triangles})()")
    ok("the extra character costs about 76k triangles (one Boy model)",60000<t1-t0<100000,f"{t0:,} -> {t1:,} (+{t1-t0:,})"); await b.close()
async def main():
    part=sys.argv[1] if len(sys.argv)>1 else 'a'
    async with async_playwright() as p: await {'a':part_a,'b':part_b,'c':part_c}[part](p)
    print('ALL',all(R),f'{sum(R)}/{len(R)}')
asyncio.run(main())
