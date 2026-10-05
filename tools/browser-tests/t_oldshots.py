import asyncio, json, urllib.request
from browser_test import *
BASE="http://127.0.0.1:4000"
def call(method,path,body=None,token=None):
    req=urllib.request.Request(BASE+"/api"+path, data=json.dumps(body).encode() if body else None, method=method, headers={"Content-Type":"application/json", **({"Authorization":"Bearer "+token} if token else {})}); return json.load(urllib.request.urlopen(req))
try: pt=call("POST","/auth/parent/login",{"email":"demo.parent@learnquest.local","password":"Demo@1234"})["token"]
except Exception: pt=call("POST","/auth/parent/signup",{"name":"Demo Parent","email":"demo.parent@learnquest.local","password":"Demo@1234"})["token"]
kids=call("GET","/auth/child/list",token=pt)["children"]
for n,a in [("Aarav","human_boy_v1"),("Mia","human_girl_v1")]:
    if not any(k["name"]==n for k in kids): call("POST","/auth/child/create",{"name":n,"age":8,"language":"en","avatar":a,"pin":"1234","className":"Grade 3"},pt)
kids=call("GET","/auth/child/list",token=pt)["children"]
async def shot(p, path, out, avatar=None, wait=9000):
    kid=next(k for k in kids if k.get('avatar')==avatar)
    tok=call("POST","/auth/child/login",{"childId":kid["id"],"pin":"1234"})["token"]
    b,pg,logs=await launch(p,960,540); await pg.add_init_script(f"localStorage.setItem('lq_token','{tok}');localStorage.setItem('lq_role','child');")
    await pg.goto(BASE+"/"+path,wait_until="commit"); await pg.wait_for_timeout(wait)
    if 'jungle-game' in path:
        try: await pg.click('text=Start Jungle Run',timeout=15000); await pg.wait_for_timeout(5000)
        except Exception as e: print('start click failed',str(e)[:60])
    try: await pg.screenshot(path=out,timeout=120000)
    except Exception as e: print("screenshot failed",str(e)[:80])
    errs=[m[:140] for t,m in logs if t in("error","pageerror") and "ERR_FAILED" not in m]; print(path,"errors:",errs[:3]); await b.close()
async def main():
    async with async_playwright() as p:
        await shot(p,"jungle-game.html?level=jungle_lvl_1","shots/41_old_runner_boy.png",avatar="human_boy_v1",wait=10000)
        await shot(p,"jungle-game.html?level=jungle_lvl_1","shots/42_old_runner_girl.png",avatar="human_girl_v1",wait=10000)
asyncio.run(main())
