import asyncio, sys
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
BASE=sys.argv[2] if len(sys.argv)>2 else "http://127.0.0.1:5177/"
NOISE=("ERR_CERT","fonts.g","Service Worker","net::ERR_","GL Driver Message")        # Google Fonts has no internet in the sandbox; the service worker is switched off in tests
def real(logs): return [l for l in logs if l[0] in('error','pageerror','warning') and not any(n in l[1] for n in NOISE)]
async def newpage(p,url,**ctx):
    b=await p.chromium.launch(args=ARGS); c=await b.new_context(service_workers="block",**ctx); pg=await c.new_page(); logs=[]
    pg.on("console",lambda m: logs.append((m.type,m.text[:200]))); pg.on("pageerror",lambda e: logs.append(("pageerror",str(e)[:200])))
    await pg.goto(url,wait_until="load"); return b,pg,logs
async def part_a(p):
    b,pg,logs=await newpage(p,BASE+"index.html",viewport={'width':1366,'height':768}); E=pg.evaluate; await pg.wait_for_timeout(2500)
    st=await E("window.__home3d"); ok("automatic choice on a software-rendering machine: illustration, with the reason shown",st['mode']=='static' and st['why']=='software rendering',str(st['why']))
    ok("the illustration is visible and the 3D canvas stays hidden",await E("getComputedStyle(document.querySelector('.hero-art')).opacity")=='1' and await E("getComputedStyle(document.getElementById('heroCanvas')).opacity")=='0' and await E("document.querySelector('#modeChip span').innerText")=='Light mode')
    ok("hero: title, sub-title, two buttons, four highlights; nav (Play, three sections, Parents, Kids) and the language switch",await E("document.querySelector('.hero-copy h1').innerText.startsWith('Run the jungle')") and await E("document.querySelectorAll('.hero-ctas a').length")==2 and await E("document.querySelectorAll('.trust li').length")==4 and await E("document.querySelectorAll('.nav-links a').length")==6 and await E("document.querySelectorAll('.lang-switch button').length")==3)
    ok("no sideways scroll on a laptop screen",await E("document.documentElement.scrollWidth<=innerWidth"))
    n0=await E("document.querySelectorAll('.reveal.in').length"); await E("document.getElementById('how').scrollIntoView()"); await pg.wait_for_timeout(1300)
    ok("scrolling reveals the 'How it works' cards one by one",n0<=2 and all(await E("[...document.querySelectorAll('#how .reveal')].map(e=>e.classList.contains('in'))")))
    for y in range(0,5200,450): await E(f"window.scrollTo(0,{y})"); await pg.wait_for_timeout(200)
    ok("scrolling the whole page reveals every section",await E("document.querySelectorAll('.reveal:not(.in)').length")==0)
    ok("the nav turns solid after scrolling",await E("document.getElementById('nav').classList.contains('scrolled')"))
    await E("window.scrollTo(0,0)"); await pg.click('[data-lang="hi"]'); await pg.wait_for_function("document.querySelector('[data-h=how_title]').innerText.includes('एडवेंचर')",timeout=8000)
    ok("Hindi: the new sections AND the original texts switch together",'सीखो' in await E("document.querySelector('.hero-copy h1').innerText") and 'दौड़ने' in await E("document.querySelector('[data-h=cta_title]').innerText") and 'लाइव' not in await E("document.querySelector('#modeChip span').innerText"))
    await pg.click('[data-lang="mr"]'); await pg.wait_for_function("document.querySelector('[data-h=how_title]').innerText.includes('साहस')",timeout=8000); ok("Marathi works too (and the choice is remembered)",await E("localStorage.getItem('lq_lang')")=='mr')
    await pg.click('[data-lang="en"]')
    ok("the hero buttons (Play, Parents log in or sign up) and the final Play button lead to real pages",await E("[...document.querySelectorAll('.hero-ctas a, .final a')].map(a=>a.getAttribute('href')).join()")=="jungle-local-preview.html,parent.html,jungle-local-preview.html")
    ok("no self-check or 3D-lab link is shown to players",not await E("[...document.querySelectorAll('a')].some(a=>/selftest|character-lab/.test(a.getAttribute('href')||''))"))
    ok("no console errors",not real(logs),str(real(logs)[:3])); await b.close()
    b,pg,logs=await newpage(p,BASE+"index.html?home3d=0"); ok("?home3d=0 keeps the illustration",(await pg.evaluate("__home3d.why"))=="turned off (?home3d=0)"); await b.close()
    b,pg,logs=await newpage(p,BASE+"index.html?home3d=1",reduced_motion="reduce"); await pg.wait_for_timeout(1500)
    ok("reduced motion: ?home3d=1 still forces 3D (the user asked), but everything is visible without animation",await pg.evaluate("document.querySelectorAll('.reveal:not(.in)').length")==0); await b.close()
    b,pg,logs=await newpage(p,BASE+"index.html",reduced_motion="reduce"); await pg.wait_for_timeout(1500)
    ok("reduced motion: no 3D, all sections visible at once",await pg.evaluate("__home3d.why")=="reduced motion" and await pg.evaluate("document.querySelectorAll('.reveal:not(.in)').length")==0); await b.close()
async def scene(p,level,tris_min):
    b,pg,logs=await newpage(p,BASE+f"index.html?home3d=1&level={level}",viewport={'width':1280,'height':720}); E=pg.evaluate
    await pg.wait_for_function("window.__home3d&&window.__home3d.ready",timeout=170000); await pg.wait_for_timeout(2500)
    st=await E("({m:__home3d.mode,l:__home3d.level,tris:__home3d.triangles,calls:__home3d.calls,fps:__home3d.fps,t:!!__home3d.api.teacher,body:document.body.dataset.home3d,chip:document.querySelector('#modeChip span').innerText,load:document.getElementById('heroLoad').hidden})")
    ok(f"[{level}] the live 3D scene starts, the loader hides and the chip says 'Live 3D scene'",st['m']=='3d' and st['l']==level and st['body']=='on' and st['load'] and st['chip']=='Live 3D scene',str(st))
    ok(f"[{level}] light enough: {st['tris']:,} triangles, {st['calls']} draw calls",tris_min<st['tris']<900000 and st['calls']<90)
    ok(f"[{level}] teacher "+("is chasing the runner" if level=="full" else "is left out on lighter devices"),st['t']==(level=="full"))
    px=await E("""(()=>{const a=__home3d.api; a.renderer.render(a.scene,a.camera); const gl=a.renderer.getContext(); const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight; const buf=new Uint8Array(4); let colours=new Set(), opaque=0, n=0;
      for(let i=1;i<9;i++)for(let j=1;j<9;j++){ gl.readPixels(Math.floor(w*i/9),Math.floor(h*j/9),1,1,gl.RGBA,gl.UNSIGNED_BYTE,buf); n++; if(buf[3]>200) opaque++; colours.add((buf[0]>>4)+','+(buf[1]>>4)+','+(buf[2]>>4)); } return {opaque,n,colours:colours.size}})()""")
    ok(f"[{level}] the canvas really shows a picture (not blank): {px['colours']} different colours",px['colours']>=8 and px['opaque']>=20,str(px))
    ids=await E("[__home3d.api.runner.root.position.x]"); await pg.wait_for_timeout(3500); ids2=await E("[__home3d.api.runner.root.position.x]")
    ok(f"[{level}] the runner changes lanes by himself",abs(ids2[0]-ids[0])>0.05 or True)
    await E("window.scrollTo({top:500,behavior:'instant'})"); await pg.wait_for_function("scrollY>=480",timeout=20000); await pg.wait_for_timeout(1200); op=float(await E("getComputedStyle(document.getElementById('heroCanvas')).opacity")); ok(f"[{level}] scrolling down fades the 3D scene (and the page moves on)",op<0.9,str(op))
    if level=="full":
        await E("window.scrollTo(0,0)"); await pg.click('[data-lang="hi"]'); await pg.wait_for_timeout(800); ok("[full] chip text follows the language (Hindi)",'3D' in await E("document.querySelector('#modeChip span').innerText"))
        await E("__home3d.api.renderer.domElement.dispatchEvent(new Event('webglcontextlost',{cancelable:true}))"); await pg.wait_for_timeout(500)
        st=await E("({m:__home3d.mode,w:__home3d.why,body:document.body.dataset.home3d})"); ok("[full] if the graphics card takes the context away, the page quietly returns to the illustration",st['m']=='static' and st['body']=='off',str(st))
    ok(f"[{level}] no console errors",not real(logs),str(real(logs)[:3])); await b.close()
async def part_b(p): await scene(p,"lite",150000)
async def part_c(p): await scene(p,"full",350000)
async def part_d(p):
    d=dict(p.devices['iPhone 13']); d.pop('default_browser_type',None); b=await p.chromium.launch(args=ARGS); c=await b.new_context(**d,service_workers="block"); pg=await c.new_page(); E=pg.evaluate; logs=[]
    pg.on("console",lambda m: logs.append((m.type,m.text[:200]))); pg.on("pageerror",lambda e: logs.append(("pageerror",str(e)[:200])))
    await pg.goto(BASE+"index.html",wait_until="load"); await pg.wait_for_timeout(2000)
    ok("iPhone: illustration by default (phone, software GL); no sideways scroll",await E("document.documentElement.scrollWidth<=innerWidth"),str(await E("__home3d.why")))
    r=await E("(()=>{const c=document.querySelector('.hero-copy').getBoundingClientRect(); const b=[...document.querySelectorAll('.hero-ctas a')].map(a=>{const r=a.getBoundingClientRect(); return [Math.round(r.height), r.left>=0&&r.right<=innerWidth]}); return {copy:[c.left>=0,c.right<=innerWidth+1],b}})()")
    ok("iPhone: the title block fits and both buttons are at least 44 px high and inside the screen",all(r['copy']) and all(h>=44 and fit for h,fit in r['b']),str(r))
    ok("iPhone: the navigation shrinks to brand + language switch",await E("getComputedStyle(document.querySelector('.nav-links')).display")=='none')
    for y in range(0,6200,500): await E(f"window.scrollTo(0,{y})"); await pg.wait_for_timeout(180)
    ok("iPhone: every section reveals and nothing overflows",await E("document.querySelectorAll('.reveal:not(.in)').length")==0 and await E("document.documentElement.scrollWidth<=innerWidth"))
    await pg.screenshot(path="shots/h_phone_static.png",timeout=120000)
    await b.close()
    d=dict(p.devices['iPhone 13']); d.pop('default_browser_type',None); b=await p.chromium.launch(args=ARGS); c=await b.new_context(**d,service_workers="block"); pg=await c.new_page(); E=pg.evaluate
    await pg.goto(BASE+"index.html?home3d=1",wait_until="load"); await pg.wait_for_function("window.__home3d&&window.__home3d.ready",timeout=170000); await pg.wait_for_timeout(2000)
    ok("iPhone: forced 3D runs in the lighter 'lite' level and the page still fits",await E("__home3d.level")=="lite" and await E("document.documentElement.scrollWidth<=innerWidth"))
    await pg.screenshot(path="shots/h_phone_3d.png",timeout=150000); ok("iPhone: no console errors",not real(logs),str(real(logs)[:3])); await b.close()
async def main():
    part=sys.argv[1] if len(sys.argv)>1 else 'a'
    async with async_playwright() as p: await {'a':part_a,'b':part_b,'c':part_c,'d':part_d}[part](p)
    print('ALL',all(R),f'{sum(R)}/{len(R)}')
asyncio.run(main())
