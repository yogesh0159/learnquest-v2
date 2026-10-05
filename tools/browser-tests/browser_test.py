import asyncio, sys, json
from playwright.async_api import async_playwright
ARGS=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]
async def launch(p, w=1280, h=720, tutorial_done=True, **ctx):
    ctx.setdefault('service_workers','block')      # the app's service worker is only active in the PWA tests
    b=await p.chromium.launch(args=ARGS); c=await b.new_context(viewport={'width':w,'height':h}, **ctx); pg=await c.new_page()
    await c.route("**/*", lambda r: r.continue_() if r.request.url.startswith(("http://127.0.0.1", "http://localhost", "data:", "blob:")) else r.abort())   # no internet in tests: fail external fonts/CDNs fast
    if ctx.get('service_workers')!='allow': await pg.add_init_script("try{Object.defineProperty(Navigator.prototype,'serviceWorker',{get(){return undefined},configurable:true})}catch(e){}")   # no service worker in the ordinary tests (the PWA tests turn it on)
    if tutorial_done:   # existing suites test normal gameplay: pretend the child already did the tutorial (only if no profile saved yet)
        await pg.add_init_script("try{ if(!localStorage.getItem('learnquest.jungle.profile.v1')) localStorage.setItem('learnquest.jungle.profile.v1', JSON.stringify({tutorialDone:true})); }catch(e){}")
    logs=[]
    pg.on("console",lambda m: logs.append((m.type,m.text)))
    pg.on("pageerror",lambda e: logs.append(("pageerror",str(e))))
    pg.on("requestfailed",lambda r: logs.append(("reqfail",r.url+" :: "+str(r.failure))))
    return b,pg,logs
async def boot(pg, url, timeout=120000):
    await pg.goto(url); await pg.wait_for_function("window.LQ_JUNGLE && window.LQ_JUNGLE.ready===true", timeout=timeout)
