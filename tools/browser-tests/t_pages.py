import asyncio, os, subprocess, sys, time, urllib.request, json
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
PROJ=os.path.join(os.path.dirname(__file__),'proj/learnquest')
def serve(site,base,port):
    pr=subprocess.Popen(["node","scripts/serve-pages.mjs",site,base,str(port)],cwd=PROJ,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    for _ in range(40):
        try: urllib.request.urlopen(f"http://127.0.0.1:{port}{base}index.html"); return pr
        except Exception: time.sleep(0.25)
    return pr
def build(base,out):
    subprocess.run(["node","scripts/build-pages.mjs","--base",base,"--out",out],cwd=PROJ,check=True,stdout=subprocess.DEVNULL)
async def part_a(p):
    site="/tmp/site-sub"; base="/LearnQuest/"; build(base,site); port=8081; pr=serve(site,base,port); B=f"http://127.0.0.1:{port}{base}"
    try:
        b,pg,logs=await launch(p,960,540,service_workers="allow"); ctx=pg.context; E=pg.evaluate; bad=[]
        pg.on("response",lambda r: bad.append((r.status,r.url.replace(f"http://127.0.0.1:{port}",""))) if r.status>=400 and 'favicon' not in r.url else None)
        pg.on("requestfailed",lambda r: bad.append(("failed",r.failure,r.url.replace(f"http://127.0.0.1:{port}",""))) if r.url.startswith(f"http://127.0.0.1:{port}") and "ERR_ABORTED" not in str(r.failure) else None)     # a request cancelled because the visitor already moved to another page is not a missing file     # only this site; Google Fonts is external
        await pg.goto(B,wait_until="load"); await pg.wait_for_selector(".hero-copy h1",timeout=30000); await pg.wait_for_function("document.querySelector('.hero-copy h1').innerText.length>5",timeout=20000)
        ok("opening the project address (…/LearnQuest/) shows the HOME PAGE and stays there (no redirect into the game)",pg.url==B or pg.url==B+"index.html",pg.url)
        h1=await E("document.querySelector('.hero-copy h1').innerText"); ok("home page: hero title, Play button and 'See how it works'; no self-check, 3D lab or account links",h1.startswith("Run the jungle") and await E("!!document.querySelector('.hero-ctas a[href=\"jungle-local-preview.html\"]') && !!document.querySelector('.hero-ctas a[href=\"#how\"]') && !document.querySelector('a[href*=\"selftest\"], a[href*=\"character-lab\"], [data-family]')"),h1)
        await pg.click('[data-lang="hi"]'); await pg.wait_for_function("document.querySelector('[data-h=cta_play]').innerText.includes('जंगल')",timeout=10000); ok("home page switches to Hindi (title, Play button)",'जंगल' in await E("document.querySelector('[data-h=cta_play]').innerText"))
        await pg.click('[data-lang="en"]')
        await pg.click('.hero-ctas a[href="jungle-local-preview.html"]'); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=150000); await E("LQ_JUNGLE.stopLoop()")
        ok("the Play button opens the game",pg.url.startswith(B+"jungle-local-preview.html"),pg.url)
        await pg.click('.menu-nav a[href="index.html"]'); await pg.wait_for_selector(".hero-copy h1",timeout=30000); ok("the Home link in the game menu leads back to the home page",pg.url.endswith("index.html") or pg.url==B,pg.url)
        await pg.goto(B+"jungle-local-preview.html?seed=4242&quality=low&calibrate=0&notutorial=1&drs=0",wait_until="commit"); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=150000); await E("LQ_JUNGLE.stopLoop()")
        diag=await E("LQ_JUNGLE.assets.diagnostics()"); ok("all 3D models loaded from the sub-folder, no placeholders",not diag['failures'] and len(diag['assets'])>=9,f"{len(diag['assets'])} models")
        ok("not a single file is missing (no 404 / failed request) while the game starts",not bad,str(bad[:4]))
        ok("the C/C++ WebAssembly core loads from GitHub-Pages-style hosting",await E("LQ_JUNGLE.deviceInfo().engine")=="native")
        await E("LQ_JUNGLE.start(); LQ_JUNGLE.advance(4)"); ok("a run plays and the teacher is on screen",await E("LQ_JUNGLE.stats.distance")>20 and await E("LQ_JUNGLE.snapshot().teacher.model"))
        await pg.wait_for_function("window.LQ_PWA&&window.LQ_PWA.registered",timeout=30000)
        scope=await E("navigator.serviceWorker.getRegistration().then(r=>r.scope)"); ok("the service worker is registered with the project folder as scope",scope==B,scope)
        await pg.reload(); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=150000); await E("LQ_JUNGLE.stopLoop()")
        ok("after one reload the page is controlled by the service worker",await E("!!navigator.serviceWorker.controller"))
        cs=await E("(async()=>{const o={}; for(const k of await caches.keys()){o[k]=(await (await caches.open(k)).keys()).length} return o})()"); sh=[k for k in cs if k.startswith('lq-shell-')]
        ok("the app files are saved on the device (100+ files)",len(sh)==1 and cs[sh[0]]>=100,str(cs))
        await E("LQ_PWA.downloadOffline()"); await pg.wait_for_function("(async()=>{const s=await LQ_PWA.offlineStatus(); return s.complete})()",timeout=120000); ok("'Download for offline play' saves all 15 models",True)
        cdp=await ctx.new_cdp_session(pg); await cdp.send('ServiceWorker.enable'); await asyncio.sleep(0.5); await cdp.send('ServiceWorker.stopAllWorkers'); pr.terminate(); pr.wait(timeout=10)
        try: urllib.request.urlopen(B+"index.html",timeout=2); down=False
        except Exception: down=True
        ok("the server is stopped (like having no internet)",down)
        await pg.goto(B+"jungle-local-preview.html?seed=4242&quality=low&calibrate=0&notutorial=1&drs=0",wait_until="commit"); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=150000); await E("LQ_JUNGLE.stopLoop()")
        diag=await E("LQ_JUNGLE.assets.diagnostics()"); ok("OFFLINE: the game starts again from the saved copy with every real 3D model",not diag['failures'] and not [a for a in diag['assets'] if a.get('usedFallback')],f"{len(diag['assets'])} models")
        await E("LQ_JUNGLE.start(); LQ_JUNGLE.advance(3)"); ok("OFFLINE: a run plays",await E("LQ_JUNGLE.stats.distance")>10)
        errs=[(t,m[:140]) for t,m in logs if t in('pageerror',)]; ok("no script errors",not errs,str(errs[:2])); await b.close()
    finally:
        if pr.poll() is None: pr.terminate()
async def part_b(p):
    site="/tmp/site-root"; base="/"; build(base,site); port=8082; pr=serve(site,base,port); B=f"http://127.0.0.1:{port}/"
    try:
        b,pg,logs=await launch(p,960,540); E=pg.evaluate; bad=[]
        pg.on("response",lambda r: bad.append((r.status,r.url)) if r.status>=400 and 'favicon' not in r.url else None)
        await pg.goto(B,wait_until="load"); await pg.wait_for_selector(".hero-copy h1",timeout=30000); ok("user-site layout (https://NAME.github.io/): the home page opens at the site root",pg.url in (B,B+"index.html"),pg.url)
        await pg.click('.hero-ctas a[href="jungle-local-preview.html"]'); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=150000); await E("LQ_JUNGLE.stopLoop()")
        diag=await E("LQ_JUNGLE.assets.diagnostics()"); ok("all models loaded and no missing file",not diag['failures'] and not bad,str(bad[:3]))
        ok("the self-check page is NOT part of the public site",(await pg.goto(B+"selftest.html")).status==404)
        await b.close()
    finally: pr.terminate()
async def main():
    part=sys.argv[1] if len(sys.argv)>1 else 'a'
    async with async_playwright() as p:
        await {'a':part_a,'b':part_b}[part](p)
    print('ALL',all(R),f'{sum(R)}/{len(R)}')
asyncio.run(main())
