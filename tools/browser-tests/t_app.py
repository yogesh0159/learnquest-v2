import asyncio, json, sys
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
URL="http://127.0.0.1:5177/jungle-local-preview.html?seed=4242&quality=low&calibrate=0&notutorial=1&drs=0"
async def phone(p,name,landscape=False):
    d=dict(p.devices[name]); d.pop('default_browser_type',None)
    if landscape:
        d['viewport']={'width':d['viewport']['height'],'height':d['viewport']['width']}
        if 'screen' in d: d['screen']={'width':d['screen']['height'],'height':d['screen']['width']}
    b=await p.chromium.launch(args=ARGS); c=await b.new_context(**d, service_workers="block"); pg=await c.new_page(); logs=[]
    pg.on("console",lambda m: logs.append((m.type,m.text))); pg.on("pageerror",lambda e: logs.append(("pageerror",str(e))))
    await pg.goto(URL,wait_until="commit"); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=150000); await pg.evaluate("LQ_JUNGLE.stopLoop()")
    tag=f"{name} {'landscape' if landscape else 'portrait'}"
    pl=await pg.evaluate("LQ_PLATFORM"); ok(f"[{tag}] detected as {name.split()[0]}: os, phone/tablet, touch",pl['touch'] and pl['os']==('ios' if 'iPhone' in name else 'android') and pl['phone'],str(pl))
    ov=await pg.evaluate("({sw:document.documentElement.scrollWidth,iw:innerWidth,sh:document.documentElement.scrollHeight,ih:innerHeight})"); ok(f"[{tag}] the page never scrolls sideways or up/down (no overflow)",ov['sw']<=ov['iw'] and ov['sh']<=ov['ih']+1,str(ov))
    cv=await pg.evaluate("(()=>{const c=LQ_JUNGLE.canvas.getBoundingClientRect(); return {w:Math.round(c.width),h:Math.round(c.height),iw:innerWidth,ih:innerHeight}})()"); ok(f"[{tag}] the 3D view fills the whole screen",abs(cv['w']-cv['iw'])<=1 and abs(cv['h']-cv['ih'])<=1,str(cv))
    await pg.evaluate("document.getElementById('menuScreen').scrollTop=0"); card=await pg.evaluate("(()=>{const r=document.querySelector('#menuScreen .card').getBoundingClientRect(); return {l:r.left,t:r.top,r:r.right,b:r.bottom,iw:innerWidth,ih:innerHeight,scroll:document.querySelector('#menuScreen .card').scrollHeight>document.querySelector('#menuScreen .card').clientHeight}})()")
    ok(f"[{tag}] the menu card fits the screen (scrolls inside itself when it is taller)",card['l']>=0 and card['r']<=card['iw']+1 and card['t']>=0 and card['b']<=card['ih']+1,str(card))
    await pg.evaluate("LQ_JUNGLE.start(); LQ_JUNGLE.director.enabled=false; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.track.reserved.clear(); LQ_JUNGLE.questions.nextIndex=1e9; LQ_JUNGLE.advance(0.5)")
    ok(f"[{tag}] no Fullscreen button on a phone (it would sit on top of the score chips)",await pg.evaluate("document.getElementById('fsBtn').hidden"))
    chips=await pg.evaluate("(()=>{const q=[...document.querySelectorAll('#hud .chips > *')].filter(e=>e.offsetParent!==null).map(e=>e.getBoundingClientRect()); const btn=['pauseBtn','soundBtn'].map(id=>document.getElementById(id).getBoundingClientRect()); let over=0; for(const c of q) for(const b of btn) if(c.left<b.right&&c.right>b.left&&c.top<b.bottom&&c.bottom>b.top) over++; return over})()"); ok(f"[{tag}] the score chips and the pause / sound buttons do not overlap",chips==0,str(chips))
    pad=await pg.evaluate("[...document.querySelectorAll('#touchPad button')].map(b=>{const r=b.getBoundingClientRect(); return [Math.round(r.width),r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&r.top>=0, getComputedStyle(b).display!=='none']})")
    ok(f"[{tag}] four big touch buttons (at least 60 px) are on screen",len(pad)==4 and all(w>=60 and fit and vis for w,fit,vis in pad),str(pad))
    hud=await pg.evaluate("[...document.querySelectorAll('#hud .chips > *, #pauseBtn, #soundBtn')].filter(e=>e.offsetParent!==null||e.id==='soundBtn').map(e=>{const r=e.getBoundingClientRect(); return r.right<=innerWidth+1&&r.left>=-1}).every(Boolean)"); ok(f"[{tag}] score/distance/hearts and the buttons are not cut off at the edges",hud)
    await pg.touchscreen.tap(*(await pg.evaluate("(()=>{const r=document.getElementById('tLeft').getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2]})()"))); ok(f"[{tag}] a finger tap on the left button changes lane",await pg.evaluate("LQ_JUNGLE.player.laneIndex")==0)
    await pg.touchscreen.tap(*(await pg.evaluate("(()=>{const r=document.getElementById('tJump').getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2]})()"))); ok(f"[{tag}] a finger tap on jump jumps",await pg.evaluate("LQ_JUNGLE.player.state")=="jump")
    errs=[(t,m[:120]) for t,m in logs if t in('pageerror',)]; ok(f"[{tag}] no script errors",not errs,str(errs[:2]))
    await pg.screenshot(path=f"shots/80_{tag.replace(' ','_')}.png",timeout=120000) if False else None
    await b.close()
async def part_a(p):
    await phone(p,'iPhone 13',True)
async def part_a0(p):
    await phone(p,'iPhone 13')
async def part_b(p):
    await phone(p,'Pixel 7')
async def part_c(p):
    init="""window.__cap={}; window.__exited=0; window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'android',Plugins:{App:{addListener:(n,f)=>{window.__cap[n]=f; return {remove(){}}},exitApp:()=>{window.__exited++}}}};
      window.__wl={req:0,rel:0}; Object.defineProperty(navigator,'wakeLock',{value:{request:async()=>{window.__wl.req++; const l=new EventTarget(); l.release=()=>{window.__wl.rel++}; return l}},configurable:true});"""
    b,pg,logs=await launch(p,900,500); await pg.add_init_script(init); E=pg.evaluate
    await pg.goto(URL,wait_until="commit"); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=150000); await E("LQ_JUNGLE.stopLoop()")
    ok("inside the Android app shell the platform is 'capacitor' (and the service worker stays out of the way)",await E("LQ_PLATFORM.kind")=="capacitor" and await E("LQ_PWA.supported")==False)
    ok("the browser Fullscreen button is hidden inside an app (the app is already fullscreen)",await E("document.getElementById('fsBtn').hidden"))
    await E("LQ_JUNGLE.start(); LQ_JUNGLE.player.invulnerable=1e9; LQ_JUNGLE.advance(1)"); await pg.wait_for_timeout(2000)
    ok("the screen is kept awake during a run (Wake Lock requested)",await E("window.__wl.req")>=1,str(await E("window.__wl")))
    await E("window.__cap.appStateChange({isActive:false})"); st=await E("LQ_JUNGLE.state"); ok("leaving the app (home button / app switcher) pauses the run",st=="paused" and await E("LQ_JUNGLE.audio.ctx?.state!=='running'"),st)
    await pg.wait_for_timeout(1800); ok("... and releases the screen lock",await E("window.__wl.rel")>=1,str(await E("window.__wl")))
    await E("window.__cap.appStateChange({isActive:true})"); ok("coming back keeps the run paused until the player taps Resume",await E("LQ_JUNGLE.state")=="paused")
    await E("window.__cap.backButton()"); ok("Android back button resumes a paused game",await E("LQ_JUNGLE.state")=="playing")
    await E("window.__cap.backButton()"); ok("Android back button pauses a running game",await E("LQ_JUNGLE.state")=="paused")
    await E("LQ_JUNGLE.resume(); LQ_JUNGLE.state='menu'; window.__cap.backButton()"); ok("Android back button on the menu leaves the app",await E("window.__exited")==1)
    # browser tab hidden / visible
    await E("LQ_JUNGLE.start(); LQ_JUNGLE.advance(0.2)"); await E("Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange'))"); ok("hiding the tab / locking the phone pauses the run",await E("LQ_JUNGLE.state")=="paused")
    await E("Object.defineProperty(document,'hidden',{value:false,configurable:true}); document.dispatchEvent(new Event('visibilitychange'))"); ok("showing it again does not restart the run by itself",await E("LQ_JUNGLE.state")=="paused")
    # GPU context lost (phones do this when the app was in the background)
    await E("LQ_JUNGLE.resume(); LQ_JUNGLE.advance(0.1)"); await E("LQ_JUNGLE.canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}))"); ok("losing the graphics context pauses the game instead of crashing",await E("LQ_JUNGLE.state")=="paused")
    errs=[(t,m[:120]) for t,m in logs if t in('pageerror',)]; ok("no script errors",not errs,str(errs[:2])); await b.close()
    # iOS: silent-switch workaround
    d=dict(p.devices['iPhone 13']); d.pop('default_browser_type',None); b=await p.chromium.launch(args=ARGS); c=await b.new_context(**d, service_workers="block"); pg=await c.new_page()
    await pg.add_init_script("window.__played=0; HTMLMediaElement.prototype.play=function(){window.__played++; return Promise.resolve()};")
    await pg.goto(URL,wait_until="commit"); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=150000); await pg.evaluate("LQ_JUNGLE.stopLoop()")
    await pg.touchscreen.tap(100,100); await pg.wait_for_timeout(300); ok("iPhone: the first touch starts the silent audio loop that stops the silent switch from muting the game",await pg.evaluate("window.__played")>=1)
    await pg.evaluate("document.getElementById('settingsBox').open=true"); await b.close()
    # desktop browser: fullscreen button visible
    b,pg,logs=await launch(p,900,500); await boot(pg,URL); ok("desktop browser: the Fullscreen button is available",not await pg.evaluate("document.getElementById('fsBtn').hidden")); await b.close()
async def main():
    part=sys.argv[1] if len(sys.argv)>1 else 'a'
    async with async_playwright() as p:
        await {'a':part_a,'a0':part_a0,'b':part_b,'c':part_c}[part](p)
    print('ALL',all(R),f'{sum(R)}/{len(R)}')
asyncio.run(main())
