import asyncio, json, urllib.request, sys
from browser_test import *
BASE="http://127.0.0.1:4000"; R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
def call(method,path,body=None,token=None):
    req=urllib.request.Request(BASE+"/api"+path, data=json.dumps(body).encode() if body else None, method=method, headers={"Content-Type":"application/json", **({"Authorization":"Bearer "+token} if token else {})}); return json.load(urllib.request.urlopen(req))
try: pt=call("POST","/auth/parent/login",{"email":"demo.parent@learnquest.local","password":"Demo@1234"})["token"]
except Exception: pt=call("POST","/auth/parent/signup",{"name":"Demo Parent","email":"demo.parent@learnquest.local","password":"Demo@1234"})["token"]
kids=call("GET","/auth/child/list",token=pt)["children"]
for n,a in [("Aarav","human_boy_v1"),("Mia","human_girl_v1")]:
    if not any(k["name"]==n for k in kids): call("POST","/auth/child/create",{"name":n,"age":8,"language":"en","avatar":a,"pin":"1234","className":"Grade 3"},pt)
kids=call("GET","/auth/child/list",token=pt)["children"]
print("unlock:",call("POST","/explorer/unlock-levels",{},pt))
async def play(p, game, level, avatar, tag):
    kid=next(k for k in kids if k.get("avatar")==avatar); tok=call("POST","/auth/child/login",{"childId":kid["id"],"pin":"1234"})["token"]
    b,pg,logs=await launch(p,960,540,bypass_csp=True); await pg.add_init_script(f"localStorage.setItem('lq_token','{tok}');localStorage.setItem('lq_role','child');")
    await pg.goto(f"{BASE}/{game}?level={level}",wait_until="commit")
    await pg.wait_for_function("window.__learnQuestRunner && window.__learnQuestRunner.characterController && window.__learnQuestRunner.characterController.assetMode",timeout=90000)
    await pg.wait_for_function("!document.getElementById('startBtn').disabled",timeout=60000); await pg.click("#startBtn"); await pg.wait_for_timeout(2500)
    sim=lambda sec: pg.evaluate("(sec)=>{const r=__learnQuestRunner; for(let i=0;i<Math.round(sec*60);i++){ r.update(1/60); r.animateVisuals(1/60); }}",sec)   # deterministic game time (the software renderer is far slower than real time)
    cc=lambda: pg.evaluate("(()=>{const c=__learnQuestRunner.characterController; return {mode:c.assetMode, state:c.state, clip:c.activeAction&&c.activeAction.getClip().name, model:c.preset.model.split('/').pop(), running:__learnQuestRunner.running}})()")
    await sim(1.5); s=await cc(); ok(f"{tag}: real 3D model, run state",s['mode']=="gltf" and s['state'] in("run","sprint") and 'rt.glb' in s['model'] and s['running'],str(s))
    await pg.keyboard.press("ArrowUp"); await sim(0.3); s=await cc(); ok(f"{tag}: jump plays the jump clip",s['state']=="jump" and s['clip']=="Regular_Jump",str(s)); await pg.screenshot(path=f"shots/50_{tag}_jump.png",timeout=120000)
    await sim(2.0); s=await cc(); ok(f"{tag}: lands back into running",s['state'] in("run","sprint") and s['clip'] in("Running","Lean_Forward_Sprint_inplace"),str(s))
    await pg.keyboard.press("ArrowDown"); await sim(0.25); s=await cc(); ok(f"{tag}: slide plays the slide clip",s['state']=="slide" and s['clip']=="slide_light",str(s)); await pg.screenshot(path=f"shots/51_{tag}_slide.png",timeout=120000)
    await sim(1.2); await pg.keyboard.press("ArrowLeft"); await sim(0.15); s=await cc(); ok(f"{tag}: lane change keeps running (no body-turn clip)",s['clip'] in("Running","Lean_Forward_Sprint_inplace") or s['state'] in("run","sprint","dodgeLeft"),str(s))
    pos=await pg.evaluate("(()=>{const r=__learnQuestRunner; const c=r.characterController; let h=null; c.visual.traverse(o=>{if(o.isBone&&/Hips$/.test(o.name)&&!h)h=o}); const v=new (c.root.position.constructor)(); h.getWorldPosition(v); return {hipsX:+v.x.toFixed(2),hipsZ:+v.z.toFixed(2),rootX:+c.root.position.x.toFixed(2),rootZ:+c.root.position.z.toFixed(2)}})()")
    ok(f"{tag}: character stays on the runner's position (hips within 0.6 m of root)",abs(pos['hipsX']-pos['rootX'])<0.6 and abs(pos['hipsZ']-pos['rootZ'])<0.6,str(pos))
    errs=[m[:150] for t,m in logs if t in("error","pageerror") and "ERR_FAILED" not in m]; ok(f"{tag}: no console errors",not errs,str(errs[:2])); await b.close()
async def main():
    which=sys.argv[1] if len(sys.argv)>1 else "all"
    async with async_playwright() as p:
        if which=="jungle_boy": await play(p,"jungle-game.html","jungle_lvl_1","human_boy_v1","jungle_boy")
        if which=="jungle_girl": await play(p,"jungle-game.html","jungle_lvl_1","human_girl_v1","jungle_girl")
        if which in("jungle","all"):
            await play(p,"jungle-game.html","jungle_lvl_1","human_boy_v1","jungle_boy"); await play(p,"jungle-game.html","jungle_lvl_1","human_girl_v1","jungle_girl")
        if which in("maths","all"):
            await play(p,"maths-kingdom-game.html","maths_kingdom_lvl_1","human_boy_v1","maths_boy"); await play(p,"maths-kingdom-game.html","maths_kingdom_lvl_1","human_girl_v1","maths_girl")
        print("ALL",all(R),f"{sum(R)}/{len(R)}")
asyncio.run(main())
