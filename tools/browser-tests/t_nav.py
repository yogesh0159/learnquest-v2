import asyncio, sys
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
URL="http://127.0.0.1:5177/jungle-local-preview.html?seed=4242&quality=low&calibrate=0&notutorial=1&drs=0&freeplays=off"
async def main():
    async with async_playwright() as p:
        b,pg,logs=await launch(p,1000,600); await boot(pg,URL); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop(); LQ_JUNGLE.start()")
        await E("LQ_JUNGLE.stats.lives=0; LQ_JUNGLE._gameOver()"); await pg.wait_for_function("LQ_JUNGLE.state==='gameover'",timeout=10000)
        links=await E("[...document.querySelectorAll('#gameOverScreen .menu-nav > *')].map(a=>a.tagName+':'+(a.getAttribute('href')||a.id)).join()")
        ok("'Great run!' screen has ways out: Back to menu, Home, Parents, Kids",links=="BUTTON:menuBtn,A:index.html,A:parent.html,A:child-login.html",links)
        await pg.click("#menuBtn"); await pg.wait_for_function("LQ_JUNGLE.state==='menu'",timeout=5000)
        st=await E("({menu:!document.getElementById('menuScreen').hidden,over:document.getElementById('gameOverScreen').hidden,hud:document.getElementById('hud').hidden,teacher:LQ_JUNGLE.teacher.group?LQ_JUNGLE.teacher.group.visible:false})")
        ok("'Back to menu' shows the start screen and clears the run (no HUD, no old results, no teacher)",st['menu'] and st['over'] and st['hud'] and not st['teacher'],str(st))
        await pg.click("#playBtn"); await pg.wait_for_function("LQ_JUNGLE.state==='playing'",timeout=20000); ok("and Play starts a fresh run from there",await E("LQ_JUNGLE.stats.distance")<5)
        await E("LQ_JUNGLE.pause()"); ok("the pause screen has Back to menu and Home too",await E("[...document.querySelectorAll('#pauseScreen .menu-nav > *')].map(a=>a.id||a.getAttribute('href')).join()")=="menuBtn2,index.html")
        await pg.click("#menuBtn2"); await pg.wait_for_function("LQ_JUNGLE.state==='menu'",timeout=5000); ok("... and its Back to menu works",await E("!document.getElementById('pauseScreen').offsetParent"))
        await E("LQ_JUNGLE.setLanguage('hi')"); ok("Hindi labels",'मेनू' in await E("document.getElementById('menuBtn').textContent"))
        errs=[(t,m[:140]) for t,m in logs if t in('error','pageerror','warning')]; ok("no console errors",not errs,str(errs[:2])); await b.close()
        d=dict(p.devices['iPhone 13']); d.pop('default_browser_type',None); b=await p.chromium.launch(args=ARGS); c=await b.new_context(**d,service_workers="block"); pg=await c.new_page(); E=pg.evaluate
        await pg.goto(URL,wait_until="commit"); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=150000); await E("LQ_JUNGLE.stopLoop(); LQ_JUNGLE.start(); LQ_JUNGLE.stats.lives=0; LQ_JUNGLE._gameOver()"); await pg.wait_for_function("LQ_JUNGLE.state==='gameover'",timeout=10000)
        r=await E("(()=>[...document.querySelectorAll('#gameOverScreen .menu-nav > *')].map(a=>{const r=a.getBoundingClientRect(); return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight+400}))()"); ok("iPhone: the buttons fit the screen",all(r),str(r)); await b.close()
    print('ALL',all(R),f'{sum(R)}/{len(R)}')
asyncio.run(main())
