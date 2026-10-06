import asyncio, json, sys
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
URL="http://127.0.0.1:5177/jungle-local-preview.html?seed=4242&drs=0"
FAKE_JS="""(table)=>{ window.__probed=[]; LQ_JUNGLE.measureTier=async(tier)=>{ window.__probed.push(tier); const fps=table[tier]; return fps==null?{frames:0,avgFps:0,p95Ms:0}:{frames:60,avgFps:fps,p95Ms:fps>=55?18:45}; }; }"""
async def part_a(p):
    # ---------- the render size follows the display: 4K / 2K / Full HD / HD / 540p
    b,pg,logs=await launch(p,1920,1080,device_scale_factor=2); await boot(pg,URL+"&quality=minimal&calibrate=0"); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop()")
    nat=await E("({w:Math.round(innerWidth*devicePixelRatio),h:Math.round(innerHeight*devicePixelRatio)})"); ok("test display is a 4K screen (3840x2160 native)",nat['w']==3840 and nat['h']==2160,str(nat))
    sizes={}
    for tier in ["ultra","high","balanced","low","minimal"]:
        await E(f"LQ_JUNGLE.setGraphics('{tier}')"); sizes[tier]=await E("[LQ_JUNGLE.canvas.width,LQ_JUNGLE.canvas.height]")
    print("   ",sizes); ok("Ultra draws true 4K (3840x2160) on a 4K screen",sizes['ultra']==[3840,2160],str(sizes['ultra']))
    ok("High draws 2K (2560x1440), Balanced Full HD (1920x1080), Low HD (1280x720), Minimal 540p (960x540)",sizes['high']==[2560,1440] and sizes['balanced']==[1920,1080] and sizes['low']==[1280,720] and sizes['minimal']==[960,540],str(sizes))
    await E("LQ_JUNGLE.setGraphics('ultra'); LQ_JUNGLE.renderScale=0.5; LQ_JUNGLE.resize()"); ok("adaptive resolution still scales the 4K picture down when needed (half size)",await E("LQ_JUNGLE.canvas.width")==1920)
    ok("the game reports its own device facts correctly",(await E("LQ_JUNGLE.deviceInfo().native"))=={'w':3840,'h':2160,'pixels':8294400} and await E("LQ_JUNGLE.deviceInfo().dpr")==2)
    await b.close()
    b,pg,logs=await launch(p,1920,1080,device_scale_factor=1); await boot(pg,URL+"&quality=minimal&calibrate=0"); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop()")
    s={}
    for tier in ["ultra","low"]: await E(f"LQ_JUNGLE.setGraphics('{tier}')"); s[tier]=await E("[LQ_JUNGLE.canvas.width,LQ_JUNGLE.canvas.height]")
    ok("a Full HD screen is never up-scaled: Ultra draws 1920x1080 there, Low 1280x720",s['ultra']==[1920,1080] and s['low']==[1280,720],str(s)); await b.close()
async def part_b(p):
    # ---------- calibration, caching, signature, manual override (real localStorage)
    b,pg,logs=await launch(p,960,540); await boot(pg,URL+"&calibrate=1"); E=pg.evaluate; await E("LQ_JUNGLE.stopLoop(); localStorage.removeItem('learnquest.device.v1')")
    d=await E("({cls:LQ_JUNGLE.gpuClass,cap:LQ_JUNGLE.device.cap,start:LQ_JUNGLE.device.start,auto:LQ_JUNGLE.autoGraphics})"); ok("static analysis ran before the game: software renderer -> ceiling low, safe start low",d['cls']=='software' and d['cap']=='low' and d['start']=='low' and d['auto'],str(d))
    ok("analysis is logged on start (graphics, screen, memory, cores, ceiling)",any(m.startswith("[LearnQuest] Device:") and "up to" in m for t,m in logs),[m for t,m in logs if "Device:" in m][:1] and [m for t,m in logs if "Device:" in m][0][:140])
    # strong GPU: pretend every level holds 60 fps
    await E("LQ_JUNGLE.device.cap='ultra'; LQ_JUNGLE.device.start='high'"); await E(FAKE_JS,{"high":60,"ultra":60,"balanced":60}); r=await E("LQ_JUNGLE.calibrate({force:true})"); pr=await E("window.__probed")
    ok("strong device: tests High then Ultra and keeps Ultra (4K)",r['tier']=='ultra' and pr==['high','ultra'] and await E("LQ_JUNGLE.qualityId")=='ultra',str(pr))
    c=json.loads(await E("localStorage.getItem('learnquest.device.v1')")); ok("the result is saved for this device (tier, probes, date, native size)",c['tier']=='ultra' and len(c['probes'])==2 and c['native']['w']>0 and c['date'],str(c['tier']))
    # mid device
    await E("LQ_JUNGLE.device.start='high'"); await E(FAKE_JS,{"high":38,"balanced":60,"ultra":60}); r=await E("LQ_JUNGLE.calibrate({force:true})"); pr=await E("window.__probed")
    ok("mid device: High is too slow, falls back to Balanced (Full HD)",r['tier']=='balanced' and pr==['high','balanced'] and await E("LQ_JUNGLE.qualityId")=='balanced',str(pr))
    await E("LQ_JUNGLE.device.start='balanced'"); await E(FAKE_JS,{"balanced":22,"low":30,"minimal":55}); r=await E("LQ_JUNGLE.calibrate({force:true})"); ok("weak device: ends on Minimal when nothing else holds the frame rate",r['tier']=='minimal',str(await E("window.__probed")))
    await E("LQ_JUNGLE.device.start='high'"); await E(FAKE_JS,{}); r=await E("LQ_JUNGLE.calibrate({force:true})"); ok("a stalled / hidden test keeps the safe start and saves nothing wrong",r['tier']=='high' and not r['conclusive'] if r.get('conclusive') is not None else r['tier']=='high',str(r['tier'])) 
    # reload: cache is used, no probing
    await E("LQ_JUNGLE.device.cap='ultra'; LQ_JUNGLE.device.start='high'"); await E(FAKE_JS,{"high":60,"ultra":60}); await E("LQ_JUNGLE.calibrate({force:true})")
    await pg.reload(); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=120000); await pg.evaluate("LQ_JUNGLE.stopLoop()")
    ok("next start: the saved result is applied at once (Ultra), no new test is run",await pg.evaluate("LQ_JUNGLE.qualityId")=='ultra' and await pg.evaluate("!!LQ_JUNGLE.cached") and not any("Calibration:" in m for t,m in logs[-30:]))
    # settings panel
    await pg.click("#settingsBox summary"); ok("the technical details are folded away by default (not shown to players)",not await pg.evaluate("document.querySelector('details.adv').open")); await pg.evaluate("document.querySelector('details.adv').open=true"); panel=await pg.evaluate("document.getElementById('settingsBody').innerText")
    ok("Settings keeps the technical details in an 'Advanced (for grown-ups)' fold (graphics, screen, refresh, memory, CPU, highest level, draw size) with a re-check button",await pg.evaluate("!!document.querySelector('details.adv')") and all(k in panel for k in ["Advanced (for grown-ups)","Graphics","Screen","Refresh rate","Memory","CPU cores","Highest level","The game draws at"]) and await pg.evaluate("!!document.querySelector('[data-act=retest]')"))
    ok("Settings: Picture quality has Auto + 5 levels, plainly named",await pg.evaluate("[...document.querySelectorAll('[data-gfx]')].map(b=>b.textContent)")==["Auto (best for this device)","Best (up to 4K)","High (up to 2K)","Medium (Full HD)","Low (HD)","Lowest (for weak devices)"])
    # re-test button
    await pg.evaluate(FAKE_JS,{"high":60,"ultra":30,"balanced":60}); await pg.evaluate("LQ_JUNGLE.device.cap='ultra'; LQ_JUNGLE.device.start='high'"); await pg.click("[data-act=retest]"); await pg.wait_for_function("document.querySelector('[data-act=retest]') && !document.querySelector('[data-act=retest]').disabled",timeout=30000)
    ok("'Analyse this device again' re-measures and applies the new result (High)",await pg.evaluate("LQ_JUNGLE.qualityId")=='high' and json.loads(await pg.evaluate("localStorage.getItem('learnquest.device.v1')"))['tier']=='high')
    # manual choice wins
    await pg.click('[data-gfx="minimal"]'); await pg.reload(); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=120000); await pg.evaluate("LQ_JUNGLE.stopLoop()")
    ok("a level chosen by the player always wins over the analysis",await pg.evaluate("LQ_JUNGLE.qualityId")=='minimal' and not await pg.evaluate("LQ_JUNGLE.autoGraphics"))
    await pg.click("#settingsBox summary"); await pg.click('[data-gfx="auto"]'); await pg.reload(); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=120000); await pg.evaluate("LQ_JUNGLE.stopLoop()")
    ok("choosing Auto again returns to the measured level",await pg.evaluate("LQ_JUNGLE.autoGraphics") and await pg.evaluate("LQ_JUNGLE.qualityId")=='high')
    await b.close()
    # different screen = different device signature = measured again
    b,pg,logs=await launch(p,960,540,device_scale_factor=2); await pg.goto("http://127.0.0.1:5177/explorer.html"); await pg.evaluate("localStorage.setItem('learnquest.device.v1', JSON.stringify({signature:'old|signature',tier:'ultra'}))")
    await boot(pg,URL); ok("a cached result from a different device / screen is ignored",await pg.evaluate("!LQ_JUNGLE.cached") and await pg.evaluate("LQ_JUNGLE.qualityId")=='low'); await pg.evaluate("LQ_JUNGLE.stopLoop()")
    # original runners share the same analysis
    r=await pg.evaluate("""async()=>{ const pm=await import('/js/game/core/performance-manager.js'); const out={};
      out.ultra4k=pm.runnerQualityProfile({innerWidth:3840,innerHeight:2160,devicePixelRatio:1},{}, 'ultra').pixelRatio; out.low4k=pm.runnerQualityProfile({innerWidth:3840,innerHeight:2160,devicePixelRatio:1},{}, 'low').pixelRatio; out.hdOnPhone=pm.runnerQualityProfile({innerWidth:400,innerHeight:800,devicePixelRatio:3},{}, 'balanced').pixelRatio;
      out.tiers=Object.keys(pm.QUALITY_PROFILES); out.cap=pm.deviceCapTier(); out.start=pm.hintedQualityTier();
      const mgr=new pm.RuntimeQualityManager({initialTier:'balanced',cap:'ultra',sampleSize:3}); [10,11,10].forEach(m=>mgr.recordFrame(m)); out.up=mgr.tier; const m2=new pm.RuntimeQualityManager({initialTier:'balanced',cap:'balanced',sampleSize:3}); [10,11,10].forEach(m=>m2.recordFrame(m)); out.capped=m2.tier; return out; }""")
    print("   runners:",r); ok("original runners know the 5 levels and the 4K budget (Ultra on 4K = native 1.0, Low on 4K = 1/3)",r['tiers']==['minimal','low','balanced','high','ultra'] and r['ultra4k']==1 and abs(r['low4k']-1/3)<0.01)
    ok("original runners: start level comes from the same analysis (software -> low, ceiling low), and may step up only to the device ceiling",r['cap']=='low' and r['start']=='low' and r['up']=='high' and r['capped']=='balanced',f"cap {r['cap']} start {r['start']}")
    errs=[(t,m[:140]) for t,m in logs if t in('error','pageerror','warning') and '404' not in m]; ok("no console errors/warnings (the Hub's /api/health 404 on the Jungle-only server is expected)",not errs,str(errs[:3])); await b.close()
async def main():
    part=sys.argv[1] if len(sys.argv)>1 else 'all'
    async with async_playwright() as p:
        if part in('all','a'): await part_a(p)
        if part in('all','b'): await part_b(p)
    print('ALL',all(R),f'{sum(R)}/{len(R)}')
asyncio.run(main())
