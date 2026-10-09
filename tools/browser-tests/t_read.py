import asyncio, sys, json
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
URL="http://127.0.0.1:5177/jungle-local-preview.html?seed=4242&quality=low&calibrate=0&notutorial=1&drs=0&freeplays=off"
PREP="LQ_JUNGLE.stopLoop(); LQ_JUNGLE.start(); LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.collectibles.clear(); LQ_JUNGLE.stats.lives=5; LQ_JUNGLE.stats.maxLives=5"
async def until_reading(pg,maxsec=120):
    for _ in range(maxsec*5):
        await pg.evaluate("LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.advance(0.2)")
        if await pg.evaluate("!!LQ_JUNGLE.reading"): return True
    return False
async def part_a(p):
    b,pg,logs=await launch(p,1100,620); await boot(pg,URL); E=pg.evaluate; await E(PREP)
    ok("by default a new player is set to 'wait until I tap Ready!'",await E("LQ_JUNGLE.profile.settings.readTime")=="ready")
    ok("a question appears and the runner STOPS",await until_reading(pg))
    st=await E("({timed:LQ_JUNGLE.reading.timed,total:LQ_JUNGLE.reading.total,d:LQ_JUNGLE.stats.distance,cls:document.getElementById('questionBanner').classList.contains('reading'),ready:!document.getElementById('readyBtn').hidden,listen:!document.getElementById('listenBtn').hidden,bar:document.getElementById('readBar').hidden,hint:document.getElementById('readHint').innerText})")
    ok("the banner moves to the middle with 'Ready!' and 'Listen', no countdown bar, and the hint 'Tap Ready! when you want to run'",st['cls'] and st['ready'] and st['listen'] and st['bar'] and 'Tap Ready' in st['hint'],str(st))
    d0=st['d']; await E("LQ_JUNGLE.advance(120)"); st2=await E("({d:LQ_JUNGLE.stats.distance,speed:LQ_JUNGLE.speed,still:!!LQ_JUNGLE.reading,state:LQ_JUNGLE.state})")
    ok("even after TWO MINUTES he is still standing there: a small child can read as slowly as needed",st2['still'] and abs(st2['d']-d0)<0.5 and st2['speed']<0.5 and st2['state']=="playing",str(st2))
    await E("LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.obstacles.spawn('rock',LQ_JUNGLE.player.laneIndex,0.1)"); l0=await E("LQ_JUNGLE.stats.lives"); await E("LQ_JUNGLE.advance(0.5)"); ok("he cannot be hit while he reads",await E("LQ_JUNGLE.stats.lives")==l0); await E("LQ_JUNGLE.obstacles.clear()")
    await E("window.__said=[]; LQ_JUNGLE.speaker.supported=true; LQ_JUNGLE.speaker.speak=(t,f)=>{window.__said.push([t,!!f]); return true}"); await pg.click("#listenBtn")
    said=[x for x in await E("window.__said") if x[1]]; ok("'Listen' says the question aloud (even if 'read aloud' is off in Settings)",len(said)==1 and said[0][0] and len(said[0][0])>10,str(said)[:90])
    await E("LQ_JUNGLE.pause()"); await E("LQ_JUNGLE.advance(5)"); ok("Pause and resume keep him waiting",await E("!!LQ_JUNGLE.reading")); await E("LQ_JUNGLE.resume()")
    await E("LQ_JUNGLE.start()"); ok("a NEW run never starts inside an old question pause (the runner is not stuck at the start line)",not await E("LQ_JUNGLE.reading") and await E("document.getElementById('readyBtn').hidden")); await E("LQ_JUNGLE.obstacles.clear()")
    ok("... and the new run is not waiting: it moves",(await E("LQ_JUNGLE.advance(1); LQ_JUNGLE.stats.distance"))>2); assert await until_reading(pg)
    await pg.click("#readyBtn"); await E("LQ_JUNGLE.advance(0.3)")
    ok("tapping 'Ready!' starts the run at once",not await E("LQ_JUNGLE.reading") and await E("LQ_JUNGLE.state")=="playing" and not await E("document.getElementById('questionBanner').classList.contains('reading')"))
    await E("LQ_JUNGLE.advance(2)"); st3=await E("({d:LQ_JUNGLE.stats.distance,speed:LQ_JUNGLE.speed,banner:!document.getElementById('questionBanner').hidden})"); ok("then he runs (speed rises) and the question stays on top as a small strip",st3['speed']>2 and st3['d']>d0+1 and st3['banner'],str(st3))
    await E("LQ_JUNGLE.god=true"); got=False
    for _ in range(900):
        await E("LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.advance(0.2)")
        if await E("!!LQ_JUNGLE.reading"): got=True; break
    ok("the next question stops him again",got)
    if got:
        d1=await E("LQ_JUNGLE.stats.distance"); await pg.keyboard.press("Space"); await E("LQ_JUNGLE.advance(0.3)"); ok("Space (or Enter) also means 'ready' - and does not make him jump",not await E("LQ_JUNGLE.reading") and await E("LQ_JUNGLE.player.state")!="jump")
    errs=[(t,m[:140]) for t,m in logs if t in('error','pageerror','warning')]; ok("no console errors",not errs,str(errs[:2])); await b.close()
async def part_b(p):
    b,pg,logs=await launch(p,1100,620); await boot(pg,URL); E=pg.evaluate; await E(PREP); await E("LQ_JUNGLE.setSetting('readTime','off'); LQ_JUNGLE.god=true")
    ok("Settings -> 'No pause': the question does not stop him",not await until_reading(pg,40) and await E("LQ_JUNGLE.state")=="playing")
    await E("LQ_JUNGLE.stopLoop(); document.getElementById('settingsBox').open=true; LQ_JUNGLE.renderSettings&&LQ_JUNGLE.renderSettings()")
    opts=await E("[...document.querySelectorAll('[data-opt=readTime] option')].map(o=>o.value).join()")
    ok("Settings offers: wait until Ready / Long / Normal / Short / No pause",opts=="ready,long,normal,short,off",opts); await b.close()
    res={}
    for mode in ("short","normal","long"):
        b,pg,logs=await launch(p,1100,620); await boot(pg,URL); E=pg.evaluate; await E(PREP); await E(f"LQ_JUNGLE.setSetting('readTime','{mode}')"); got=await until_reading(pg); res[mode]=(got,await E("LQ_JUNGLE.reading.total"),await E("LQ_JUNGLE.reading.timed"),await E("!document.getElementById('readBar').hidden")); await b.close()
    ok("timed choices give a lot of time (even 'Short' is at least 12 s for a Grade 1 child) and show a countdown bar",all(r[0] and r[2] and r[3] for r in res.values()) and res['short'][1]>=12 and res['short'][1]<res['normal'][1]<res['long'][1],str(res))
    b,pg,logs=await launch(p,1100,620); await boot(pg,URL); E=pg.evaluate; await E(PREP); await E("LQ_JUNGLE.setSetting('readTime','short')"); await until_reading(pg); total=await E("LQ_JUNGLE.reading.total"); await E(f"LQ_JUNGLE.advance({total}+0.5)")
    ok("in a timed choice the run starts by itself when the time is over",not await E("LQ_JUNGLE.reading") and await E("LQ_JUNGLE.state")=="playing"); await b.close()
    b,pg,logs=await launch(p,1100,620); await boot(pg,URL); E=pg.evaluate; await E(PREP); await E("LQ_JUNGLE.setLanguage('hi')"); got=await until_reading(pg)
    ok("Hindi: hint, Listen and Ready! are in Hindi",got and 'तैयार' in await E("document.getElementById('readHint').innerText") and 'सुनो' in await E("document.getElementById('listenBtn').innerText") and 'तैयार' in await E("document.getElementById('readyBtn').innerText")); await b.close()
    old=json.dumps({"settings":{"readTime":"normal","grade":1}})
    b,pg,logs=await launch(p,1100,620); await pg.add_init_script("localStorage.setItem('learnquest.jungle.profile.v1', %s)"%json.dumps(old)); await boot(pg,URL); E=pg.evaluate
    ok("a profile saved by the earlier version (Normal, never chosen by a grown-up) moves to 'wait until Ready!'",await E("LQ_JUNGLE.profile.settings.readTime")=="ready")
    await E("LQ_JUNGLE.setSetting('readTime','normal')"); ok("... but a choice made on purpose is kept",await E("LQ_JUNGLE.profile.settings.readTime")=="normal" and await E("LQ_JUNGLE.profile.settings.readTimeChosen")==True); await b.close()
async def part_c(p):
    d=dict(p.devices['iPhone 13']); d.pop('default_browser_type',None); b=await p.chromium.launch(args=ARGS); c=await b.new_context(**d,service_workers="block"); pg=await c.new_page(); E=pg.evaluate
    await pg.goto(URL,wait_until="commit"); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=150000); await E(PREP); ok("iPhone: the runner stops for the question",await until_reading(pg))
    r=await E("(()=>{const b=document.getElementById('questionBanner').getBoundingClientRect(); const bt=['readyBtn','listenBtn'].map(i=>{const y=document.getElementById(i).getBoundingClientRect(); return y.height>=44&&y.left>=0&&y.right<=innerWidth}); return {inside:b.left>=0&&b.right<=innerWidth+1, upper:b.bottom<=innerHeight*0.66, btns:bt}})()")
    ok("iPhone: the question fits, stays in the upper part (the runner stays visible below) and both buttons are easy to tap",r['inside'] and r['upper'] and all(r['btns']),str(r))
    box=await E("(()=>{const r=document.getElementById('readyBtn').getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2]})()"); await pg.touchscreen.tap(*box); await pg.wait_for_timeout(400); ok("iPhone: a tap on 'Ready!' starts the run",not await E("LQ_JUNGLE.reading")); await b.close()
async def main():
    part=sys.argv[1] if len(sys.argv)>1 else 'a'
    async with async_playwright() as p: await {'a':part_a,'b':part_b,'c':part_c}[part](p)
    print('ALL',all(R),f'{sum(R)}/{len(R)}')
asyncio.run(main())
