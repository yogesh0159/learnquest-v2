import asyncio, sys
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
BASE=sys.argv[2] if len(sys.argv)>2 else "http://127.0.0.1:5177"
URL=BASE+"/jungle-local-preview.html?seed=4242&quality=low&calibrate=0&notutorial=1&drs=0"
async def play(pg,button):
    await pg.click(button); await pg.wait_for_function("LQ_JUNGLE.state==='playing'",timeout=20000)
async def end(pg):
    await pg.evaluate("LQ_JUNGLE.stopLoop(); LQ_JUNGLE.stats.lives=0; LQ_JUNGLE._gameOver()"); await pg.wait_for_function("LQ_JUNGLE.state==='gameover'",timeout=10000)
async def part_a(p):
    b,pg,logs=await launch(p,960,540); E=pg.evaluate; await boot(pg,URL); await E("LQ_JUNGLE.stopLoop()")
    ok("a visitor without an account sees how many free runs are left",await E("document.getElementById('freeLeft').innerText")=="Free runs left: 3 of 3",await E("document.getElementById('freeLeft').innerText"))
    await play(pg,"#playBtn"); await end(pg); ok("run 1 counted (menu button)",await E("localStorage.getItem('lq_free_plays')")=="1")
    await play(pg,"#againBtn"); await end(pg); ok("run 2 counted (Play again)",await E("localStorage.getItem('lq_free_plays')")=="2")
    await play(pg,"#againBtn"); await end(pg); ok("run 3 counted",await E("localStorage.getItem('lq_free_plays')")=="3")
    await pg.click("#againBtn"); await pg.wait_for_selector("#freeGate",timeout=15000)
    t=await E("document.querySelector('#freeGate').innerText"); ok("4th run: the game stops and explains (no server here, so nobody is locked out)","free runs are used up" in t and "Continue as guest" in t and await E("LQ_JUNGLE.state")=="gameover",t.replace("\n"," | ")[:150])
    await pg.click("#freeGuest"); await pg.wait_for_function("LQ_JUNGLE.state==='playing'",timeout=20000); ok("'Continue as guest' lets the run start",await E("!document.getElementById('freeGate')"))
    ok("the counter does not grow for guests past the limit (still 3)",await E("localStorage.getItem('lq_free_plays')")=="3")
    errs=[(t,m[:140]) for t,m in logs if t in('pageerror',)]; ok("no script errors",not errs,str(errs[:2])); await b.close()
    # Enter key also goes through the gate; a signed-in parent plays without a limit; ?freeplays=off
    b,pg,logs=await launch(p,960,540); E=pg.evaluate; await pg.add_init_script("localStorage.setItem('lq_free_plays','3')"); await boot(pg,URL); await E("LQ_JUNGLE.stopLoop()")
    await pg.keyboard.press("Enter"); await pg.wait_for_selector("#freeGate",timeout=15000); ok("the Enter key is stopped by the gate too",await E("LQ_JUNGLE.state")=="menu"); await b.close()
    b,pg,logs=await launch(p,960,540); E=pg.evaluate; await pg.add_init_script("localStorage.setItem('lq_free_plays','9'); localStorage.setItem('lq_token','t'); localStorage.setItem('lq_role','parent')"); await boot(pg,URL); await E("LQ_JUNGLE.stopLoop()")
    ok("a signed-in parent: no limit, and the free-runs line is hidden",await E("document.getElementById('freeLeft').hidden")); await play(pg,"#playBtn"); ok("... and plays",True); await b.close()
    b,pg,logs=await launch(p,960,540); E=pg.evaluate; await pg.add_init_script("localStorage.setItem('lq_free_plays','9')"); await boot(pg,URL+"&freeplays=off"); await E("LQ_JUNGLE.stopLoop()"); await play(pg,"#playBtn"); ok("?freeplays=off turns the limit off",True); await b.close()
    b,pg,logs=await launch(p,960,540); E=pg.evaluate; await pg.add_init_script("localStorage.setItem('lq_free_plays','3'); localStorage.setItem('lq_lang','hi')"); await boot(pg,URL); await E("LQ_JUNGLE.stopLoop()"); await pg.click("#playBtn"); await pg.wait_for_selector("#freeGate",timeout=15000)
    t=await E("document.querySelector('#freeGate').innerText"); ok("the gate speaks Hindi",'मुफ़्त' in t and 'मेहमान' in t,t[:80].replace("\n"," ")); await b.close()
async def part_b(p):
    # the full app: a server exists -> the 4th run sends the player to create a parent account
    b,pg,logs=await launch(p,960,540,bypass_csp=True); E=pg.evaluate; await pg.add_init_script("localStorage.setItem('lq_free_plays','3')"); await boot(pg,BASE+"/jungle-local-preview.html?seed=4242&quality=low&calibrate=0&notutorial=1&drs=0"); await E("LQ_JUNGLE.stopLoop()")
    await pg.click("#playBtn"); await pg.wait_for_selector("#freeGate",timeout=15000); t=await E("document.querySelector('#freeGate').innerText")
    ok("with a server: the gate offers 'Create parent account' and 'I already have a child ID' and counts down",'Create parent account' in t and 'child ID' in t and 'sign up in' in t,t.replace("\n"," | ")[:170])
    await pg.wait_for_url("**/parent.html**",timeout=15000); ok("after a few seconds the player lands on the parent sign-up page",'signup=1' in pg.url and 'from=game' in pg.url,pg.url)
    await pg.wait_for_selector("#tabSignup",timeout=15000); await pg.wait_for_timeout(800)
    ok("the Sign Up tab is already open and a note explains what happens next",await E("document.getElementById('tabSignup').classList.contains('active')") and 'free runs' in await E("document.body.innerText"),"")
    ok("the shared navigation bar is on the page (Home, Play, Parents, Kids)",await E("[...document.querySelectorAll('.sitenav a')].map(a=>a.getAttribute('href')).join()")=="index.html,jungle-local-preview.html,parent.html,child-login.html")
    await b.close()
async def main():
    part=sys.argv[1] if len(sys.argv)>1 else 'a'
    async with async_playwright() as p: await {'a':part_a,'b':part_b}[part](p)
    print('ALL',all(R),f'{sum(R)}/{len(R)}')
asyncio.run(main())
