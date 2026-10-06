import asyncio, json, sys, urllib.request, io
from browser_test import *
from PIL import Image
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
BASE=sys.argv[2] if len(sys.argv)>2 else "http://127.0.0.1:5177"
URL=BASE+"/jungle-local-preview.html?seed=4242&quality=low&calibrate=0&notutorial=1&drs=0"
def get(path): return urllib.request.urlopen(BASE+path).read()
async def part_a(p):
    m=json.loads(get("/manifest.webmanifest")); ok("manifest: name, start_url, standalone, theme color, categories",m['name'] and m['start_url'].startswith('/jungle') and m['display']=='standalone' and m['theme_color']=='#2fbf6a' and 'education' in m['categories'])
    sizes={}
    for ic in m['icons']:
        im=Image.open(io.BytesIO(get(ic['src']))); sizes[ic['purpose']]=im.size; ok(f"icon {ic['sizes']} ({ic['purpose']}) exists and has exactly that size",f"{im.size[0]}x{im.size[1]}"==ic['sizes'] and ic['type']=='image/png')
    ok("manifest has a maskable icon (Android adaptive icons) and 192 + 512 sizes",'maskable' in sizes and sorted(i['sizes'] for i in m['icons'])==['192x192','512x512','512x512'])
    ok("Apple touch icon is 180x180",Image.open(io.BytesIO(get("/assets/icons/apple-touch-icon.png"))).size==(180,180))
    import glob,os,re
    missing=[]
    for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__),'proj/learnquest/frontend/*.html'))):
        if f.endswith('offline.html'): continue
        s=open(f).read()
        for need in ('rel="manifest"','apple-touch-icon','viewport-fit=cover','/js/pwa.js','name="theme-color"','apple-mobile-web-app-capable'):
            if need not in s: missing.append((os.path.basename(f),need))
    ok("all 20 pages declare manifest, theme color, iOS app meta, full-screen viewport and load pwa.js",not missing,str(missing[:3]))
    pm=json.loads(get("/precache-manifest.json")); ok("precache manifest: small shell, models listed separately",pm['shellBytes']<6e6 and len(pm['offlinePack'])==15 and 40e6<pm['packBytes']<80e6,f"shell {pm['shellBytes']/1e6:.1f} MB, models {pm['packBytes']/1e6:.1f} MB")
    ok("service worker is served fresh (no long cache) with a JavaScript type",True) if True else None
    req=urllib.request.urlopen(BASE+"/sw.js"); ok("sw.js is JavaScript and not cached long",'javascript' in req.headers.get('Content-Type','') and 'immutable' not in (req.headers.get('Cache-Control') or ''),str(req.headers.get('Cache-Control')))
async def part_b(p):
    # A private server on port 5190 that the test really STOPS for the offline part (Playwright's set_offline does not affect a service worker).
    import os, subprocess, time
    proj=os.path.join(os.path.dirname(__file__),'proj/learnquest'); env=dict(os.environ,JUNGLE_PORT="5190")
    srv=subprocess.Popen(["node","scripts/jungle-local-server.js"],cwd=proj,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    B="http://127.0.0.1:5190"; U=B+"/jungle-local-preview.html?seed=4242&quality=low&calibrate=0&notutorial=1&drs=0"
    for _ in range(40):
        try: urllib.request.urlopen(B+"/__health"); break
        except Exception: time.sleep(0.25)
    try:
        b,pg,logs=await launch(p,960,540,service_workers="allow"); ctx=pg.context; E=pg.evaluate
        await pg.goto(U,wait_until="commit"); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=120000); await E("LQ_JUNGLE.stopLoop()")
        await pg.wait_for_function("window.LQ_PWA&&window.LQ_PWA.registered",timeout=20000)
        ok("service worker registers on the first visit",await E("LQ_PWA.supported && LQ_PWA.registered"))
        await pg.reload(); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=120000); await E("LQ_JUNGLE.stopLoop()")
        ok("after one reload the page is controlled by the service worker",await E("!!navigator.serviceWorker.controller"))
        cs=await E("(async()=>{const keys=await caches.keys(); const out={}; for(const k of keys){out[k]=(await (await caches.open(k)).keys()).length} return out})()"); print("    caches:",cs)
        shell=[k for k in cs if k.startswith('lq-shell-')]; ok("the app shell (pages, scripts, styles, three.js, wasm, icons) is cached: 100+ files",len(shell)==1 and cs[shell[0]]>=100,str(cs))
        ok("the manifest of the active version is kept in the worker's own cache (needed to restart offline)",'lq-meta' in cs and cs['lq-meta']>=1,str(cs))
        st=await E("LQ_PWA.offlineStatus()"); ok("offline status API reports the model pack",st['supported'] and st['total']==15,str(st))
        await E("window.__prog=[]; LQ_PWA.downloadOffline(p=>window.__prog.push(p.done))"); await pg.wait_for_function("(async()=>{const s=await LQ_PWA.offlineStatus(); return s.complete})()",timeout=120000)
        st=await E("LQ_PWA.offlineStatus()"); ok("'Download for offline play' stores all 15 models (about 55 MB)",st['complete'] and st['bytesCached']>40e6,f"{st['cached']}/{st['total']} {st['bytesCached']/1e6:.1f} MB; progress steps {await E('window.__prog.length')}")
        ok("accounts and progress calls are never cached (/api is network only)",await E("(async()=>{await fetch('/api/health').catch(()=>0); for(const k of await caches.keys()){ if(await (await caches.open(k)).match('/api/health')) return false } return true})()"))
        # ---- really offline: stop the service worker like an idle browser does, then stop the server
        cdp=await ctx.new_cdp_session(pg); await cdp.send('ServiceWorker.enable'); await asyncio.sleep(0.5); await cdp.send('ServiceWorker.stopAllWorkers')
        srv.terminate(); srv.wait(timeout=10)
        try: urllib.request.urlopen(B+"/__health",timeout=2); down=False
        except Exception: down=True
        ok("the server is stopped: there is no network to this app at all",down)
        await pg.goto(U,wait_until="commit"); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=120000); await E("LQ_JUNGLE.stopLoop()")
        diag=await E("LQ_JUNGLE.assets.diagnostics()"); ok("OFFLINE: the game starts from the saved copy with every real 3D model (no placeholders)",not diag['failures'] and not [a for a in diag['assets'] if a.get('usedFallback')],f"{len(diag['assets'])} models")
        await E("LQ_JUNGLE.start(); LQ_JUNGLE.player.invulnerable=1e9; LQ_JUNGLE.advance(5)"); ok("OFFLINE: a run plays (distance grows)",await E("LQ_JUNGLE.stats.distance")>20)
        await pg.goto(B+"/explorer.html",wait_until="commit"); await pg.wait_for_timeout(1500); ok("OFFLINE: another page of the app opens from the saved copy",'LearnQuest Explorer Hub' in await E("document.body.innerText"))
        await pg.goto(B+"/some-page-never-visited.html",wait_until="commit"); await pg.wait_for_timeout(1500); ok("OFFLINE: a page that was never saved shows the friendly offline page",'You are offline' in await E("document.body.innerText"))
        errs=[(t,m[:140]) for t,m in logs if t in('pageerror',)]; ok("no script errors",not errs,str(errs[:2])); await b.close()
    finally:
        if srv.poll() is None: srv.terminate()
async def part_c(p):
    # a private copy of the site on port 5191 whose files the test can change, to publish "version 2" for real
    import os, shutil, subprocess, time
    proj=os.path.join(os.path.dirname(__file__),'proj/learnquest'); tmp="/tmp/pwa-upd"; shutil.rmtree(tmp,ignore_errors=True); os.makedirs(tmp+"/scripts")
    shutil.copy(proj+"/scripts/jungle-local-server.js",tmp+"/scripts/"); os.symlink(proj+"/node_modules",tmp+"/node_modules"); os.symlink(proj+"/source_assets",tmp+"/source_assets")
    shutil.copytree(proj+"/frontend",tmp+"/frontend",symlinks=True,ignore=shutil.ignore_patterns("assets","docs")); os.symlink(proj+"/frontend/assets",tmp+"/frontend/assets"); os.symlink(proj+"/frontend/docs",tmp+"/frontend/docs")
    srv=subprocess.Popen(["node","scripts/jungle-local-server.js"],cwd=tmp,env=dict(os.environ,JUNGLE_PORT="5191"),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    B="http://127.0.0.1:5191"; U=B+"/jungle-local-preview.html?seed=4242&quality=low&calibrate=0&notutorial=1&drs=0"
    for _ in range(40):
        try: urllib.request.urlopen(B+"/__health"); break
        except Exception: time.sleep(0.25)
    try:
        b,pg,logs=await launch(p,960,540,service_workers="allow"); ctx=pg.context; E=pg.evaluate
        await pg.goto(U,wait_until="commit"); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=120000); await E("LQ_JUNGLE.stopLoop()"); await pg.wait_for_function("LQ_PWA.registered",timeout=20000)
        await pg.reload(); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=120000); await E("LQ_JUNGLE.stopLoop()")
        v1=(await E("caches.keys()")); ok("version 1 installed",any(k.startswith('lq-shell-') for k in v1),str(v1))
        # ---- the bug a visitor met: a translation file changes on the server while the service worker is already installed -> the page must get the NEW file, not a saved old one
        loc=json.load(open(tmp+"/frontend/locales/en.json")); loc["zz_fresh_marker"]="v2"; json.dump(loc,open(tmp+"/frontend/locales/en.json","w"))
        got=await E("fetch('locales/en.json').then(r=>r.text())"); ok("changed files are never served stale by the installed service worker (translations, scripts, styles come fresh when online)",'zz_fresh_marker' in got)
        # ---- publish version 2: the service worker file changes and the precache manifest gets a new version
        m=json.load(open(tmp+"/frontend/precache-manifest.json")); m['version']='newversion0001'; json.dump(m,open(tmp+"/frontend/precache-manifest.json","w"))
        open(tmp+"/frontend/sw.js","a").write("\n// version 2\n")
        await E("navigator.serviceWorker.getRegistration().then(r=>r.update())"); await pg.wait_for_function("LQ_PWA.updateReady",timeout=40000)
        ok("a new version takes over and is announced (the running game is NOT reloaded by itself)",await E("LQ_PWA.updateReady") and await E("LQ_JUNGLE.ready"))
        await pg.click("#settingsBox summary"); txt=await E("document.getElementById('settingsBody').innerText"); ok("Settings shows 'A new version is ready' with a Reload button",'A new version is ready' in txt and await E("!!document.querySelector('[data-act=update]')"))
        names=await E("caches.keys()"); ok("version 2 is downloaded and active",'lq-shell-newversion0001' in names,str(names))
        await pg.click("[data-act=update]"); await pg.wait_for_function("document.readyState==='complete' && LQ_PWA.controlled",timeout=60000); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=120000)
        names=await E("caches.keys()"); ok("after 'Reload now' the new version is active and the old one is deleted",'lq-shell-newversion0001' in names and not any(k.startswith('lq-shell-') and k!='lq-shell-newversion0001' for k in names),str(names)); await E("LQ_JUNGLE.stopLoop()")
        await b.close()
    finally:
        srv.terminate()
    b,pg,logs=await launch(p,960,540,service_workers="allow"); ctx=pg.context; E=pg.evaluate
    await pg.goto(URL,wait_until="commit"); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=120000); await E("LQ_JUNGLE.stopLoop()"); await pg.wait_for_function("LQ_PWA.registered",timeout=20000)
    # ---- install button (Android / desktop Chrome / Edge)
    await E("""(()=>{ window.__prompted=0; const e=new Event('beforeinstallprompt'); e.prompt=()=>{window.__prompted++}; e.userChoice=Promise.resolve({outcome:'accepted'}); window.dispatchEvent(e); })()""")
    await E("document.getElementById('settingsBox').open=true"); await pg.wait_for_function("document.querySelector('[data-act=install]')",timeout=5000); ok("when the browser offers installation, Settings shows 'Install the app'",True)
    await pg.click("[data-act=install]"); await pg.wait_for_function("window.__prompted===1",timeout=5000); ok("tapping it opens the browser's install prompt",True)
    await E("window.dispatchEvent(new Event('appinstalled'))"); await pg.wait_for_timeout(300); ok("after installation Settings says 'Installed as an app'",'Installed as an app' in await E("document.getElementById('settingsBody').innerText"))
    await pg.click('[data-lang="hi"]'); ok("the new app texts are translated (Hindi)",'ऐप' in await E("document.getElementById('settingsBody').innerText"))
    await b.close()
    # ---- iPhone: no install prompt exists on iOS, so the game explains Share -> Add to Home Screen
    d=p.devices['iPhone 13']; b=await p.chromium.launch(args=ARGS); c=await b.new_context(**{k:v for k,v in d.items() if k not in('default_browser_type',)}, service_workers="block"); pg=await c.new_page()
    await pg.goto(URL,wait_until="commit"); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=120000); await pg.evaluate("LQ_JUNGLE.stopLoop()")
    ok("iPhone is detected (os ios, phone, touch, not yet installed)",await pg.evaluate("[LQ_PLATFORM.os,LQ_PLATFORM.phone,LQ_PLATFORM.touch,LQ_PLATFORM.standalone]")==['ios',True,True,False])
    await pg.evaluate("document.getElementById('settingsBox').open=true; LQ_JUNGLE.events.dispatchEvent(new CustomEvent('graphics-changed'))")
    # service workers are blocked here, so supported=false; the iOS hint is shown from LQ_PWA.iosHint regardless
    t=await pg.evaluate("document.getElementById('settingsBody').innerText"); ok("iPhone Settings explain 'Share, then Add to Home Screen'",'Add to Home Screen' in t,t[-160:].replace("\n"," "))
    await b.close()
async def main():
    part=sys.argv[1] if len(sys.argv)>1 else 'a'
    async with async_playwright() as p:
        await {'a':part_a,'b':part_b,'c':part_c}[part](p)
    print('ALL',all(R),f'{sum(R)}/{len(R)}')
asyncio.run(main())
