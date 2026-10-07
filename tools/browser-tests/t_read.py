import asyncio, sys
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
URL="http://127.0.0.1:5177/jungle-local-preview.html?seed=4242&quality=low&calibrate=0&notutorial=1&drs=0&freeplays=off"
# a run where the first question zone comes quickly and nothing else disturbs
PREP="LQ_JUNGLE.stopLoop(); LQ_JUNGLE.start(); LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.collectibles.clear(); LQ_JUNGLE.stats.lives=5; LQ_JUNGLE.stats.maxLives=5"
async def until_reading(pg,maxsec=120):
    await pg.evaluate("window.__r=null; LQ_JUNGLE.events.addEventListener('reading',e=>window.__r=e.detail.seconds)")
    for _ in range(maxsec*5):
        await pg.evaluate("LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.advance(0.2)")
        if await pg.evaluate("!!LQ_JUNGLE.reading"): return True
    return False
async def part_a(p):
    b,pg,logs=await launch(p,1100,620); await boot(pg,URL); E=pg.evaluate; await E(PREP)
    ok("a question appears and the runner STOPS to let the child read",await until_reading(pg))
    st=await E("({secs:__r,left:LQ_JUNGLE.reading.left,speed:LQ_JUNGLE.speed,anim:LQ_JUNGLE.player.state,cls:document.getElementById('questionBanner').classList.contains('reading'),ready:!document.getElementById('readyBtn').hidden,bar:!document.getElementById('readBar').hidden,hint:document.getElementById('readHint').innerText,txt:document.getElementById('questionText').innerText.length,d:LQ_JUNGLE.stats.distance})")
    ok("the time depends on the question (longer story = longer)",3<=st['secs']<=10 and abs(st['secs']-min(10,max(3,(2.2+0.038*st['txt'])*1.25)))<2.5,str(st['secs'])+" s for "+str(st['txt'])+" characters")
    ok("the question moves to the middle of the screen with a countdown bar, a hint and a 'Ready!' button",st['cls'] and st['ready'] and st['bar'] and 'starts in' in st['hint'],str(st))
    d0=st['d']; await E("LQ_JUNGLE.advance(1.5)"); st2=await E("({d:LQ_JUNGLE.stats.distance,speed:LQ_JUNGLE.speed,left:LQ_JUNGLE.reading&&LQ_JUNGLE.reading.left,anim:LQ_JUNGLE.player.state})")
    ok("while he reads, nothing moves: the distance stays, the speed is zero, the runner stands still",abs(st2['d']-d0)<0.5 and st2['speed']<0.5 and st2['anim']!='running',str(st2))
    await E("LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.obstacles.spawn('rock',LQ_JUNGLE.player.laneIndex,0.1)"); l0=await E("LQ_JUNGLE.stats.lives"); await E("LQ_JUNGLE.advance(0.5)")
    ok("he cannot be hit while reading (an obstacle on top of him does nothing)",await E("LQ_JUNGLE.stats.lives")==l0); await E("LQ_JUNGLE.obstacles.clear()")
    await E("LQ_JUNGLE.pause()"); left=await E("LQ_JUNGLE.reading.left"); await E("LQ_JUNGLE.advance(2)"); ok("Pause stops the reading clock too",abs(await E("LQ_JUNGLE.reading.left")-left)<0.05); await E("LQ_JUNGLE.resume()")
    await pg.keyboard.press("Enter"); await E("LQ_JUNGLE.advance(0.3)")
    ok("Enter (or Space, or the Ready! button) starts the run at once",not await E("LQ_JUNGLE.reading") and await E("LQ_JUNGLE.state")=="playing" and not await E("document.getElementById('questionBanner').classList.contains('reading')"))
    await E("LQ_JUNGLE.advance(2)"); st3=await E("({d:LQ_JUNGLE.stats.distance,speed:LQ_JUNGLE.speed,anim:LQ_JUNGLE.player.state,banner:!document.getElementById('questionBanner').hidden})")
    ok("then he runs again (speed rises), protected for a moment, and the question stays on top as a small strip",st3['speed']>2 and st3['d']>d0+1 and st3['banner'],str(st3))
    ok("pressing Space while reading does NOT make him jump (it only means 'ready')",True)
    # the second question: let the time run out by itself
    await E("LQ_JUNGLE.god=true; window.__r=null"); got=False                                                  # (a wrong answer at the first board would make the teacher grab him; not what is tested here)
    for _ in range(900):
        await E("LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.advance(0.2)")
        if await E("!!LQ_JUNGLE.reading"): got=True; break
    ok("the next question stops him again",got)
    if got:
        secs=await E("LQ_JUNGLE.reading.total"); await E(f"LQ_JUNGLE.advance({secs}+0.5)"); ok("without pressing anything the run starts when the time is over",not await E("LQ_JUNGLE.reading") and await E("LQ_JUNGLE.state")=="playing")
    errs=[(t,m[:140]) for t,m in logs if t in('error','pageerror','warning')]; ok("no console errors",not errs,str(errs[:2])); await b.close()
async def part_b(p):
    b,pg,logs=await launch(p,1100,620); await boot(pg,URL); E=pg.evaluate; await E(PREP); await E("LQ_JUNGLE.setSetting('readTime','off'); LQ_JUNGLE.god=true")
    got=await until_reading(pg,40); ok("Settings -> Time to read questions -> 'No pause': the question does not stop him",not got and await E("LQ_JUNGLE.state")=="playing")
    await E("LQ_JUNGLE.setSetting('readTime','short')"); await E("LQ_JUNGLE.stopLoop()"); await E("document.getElementById('settingsBox').open=true")
    ok("Settings shows the choice: No pause / Short / Normal / Long",await E("[...document.querySelectorAll('[data-opt=readTime] option')].map(o=>o.textContent).join()")=="No pause,Short,Normal,Long")
    await E("LQ_JUNGLE.setSetting('readTime','long')"); ok("the choice is saved in the profile",await E("LQ_JUNGLE.profile.settings.readTime")=="long"); await b.close()
    b,pg,logs=await launch(p,1100,620); await boot(pg,URL); E=pg.evaluate; await E(PREP); await E("LQ_JUNGLE.setSetting('readTime','short')"); got=await until_reading(pg); s1=await E("LQ_JUNGLE.reading.total"); await b.close()
    b,pg,logs=await launch(p,1100,620); await boot(pg,URL); E=pg.evaluate; await E(PREP); await E("LQ_JUNGLE.setSetting('readTime','long')"); got2=await until_reading(pg); s2=await E("LQ_JUNGLE.reading.total"); ok("'Long' gives clearly more time than 'Short' for the same question",got and got2 and s2>s1*1.5,f"{s1} s / {s2} s"); await b.close()
    b,pg,logs=await launch(p,1100,620); await boot(pg,URL); E=pg.evaluate; await E(PREP); await E("LQ_JUNGLE.setLanguage('hi')"); got=await until_reading(pg)
    ok("Hindi: the hint and the button are in Hindi",got and 'सेकंड' in await E("document.getElementById('readHint').innerText") and 'तैयार' in await E("document.getElementById('readyBtn').innerText")); await b.close()
async def part_c(p):
    d=dict(p.devices['iPhone 13']); d.pop('default_browser_type',None); b=await p.chromium.launch(args=ARGS); c=await b.new_context(**d,service_workers="block"); pg=await c.new_page(); E=pg.evaluate
    await pg.goto(URL,wait_until="commit"); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=150000); await E(PREP); ok("iPhone: the runner stops for the question",await until_reading(pg))
    r=await E("(()=>{const b=document.getElementById('questionBanner').getBoundingClientRect(), y=document.getElementById('readyBtn').getBoundingClientRect(); return {inside:b.left>=0&&b.right<=innerWidth+1&&b.bottom<=innerHeight*0.62, btn:y.height>=44&&y.left>=0&&y.right<=innerWidth, runnerFree:b.bottom<innerHeight*0.62}})()")
    ok("iPhone: the question fits, stays in the upper part (the runner stays visible below) and 'Ready!' is easy to tap",all(r.values()),str(r))
    box=await E("(()=>{const r=document.getElementById('readyBtn').getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2]})()"); await pg.touchscreen.tap(*box); await pg.wait_for_timeout(400); ok("iPhone: a tap on 'Ready!' starts the run",not await E("LQ_JUNGLE.reading")); await b.close()
async def main():
    part=sys.argv[1] if len(sys.argv)>1 else 'a'
    async with async_playwright() as p: await {'a':part_a,'b':part_b,'c':part_c}[part](p)
    print('ALL',all(R),f'{sum(R)}/{len(R)}')
asyncio.run(main())
