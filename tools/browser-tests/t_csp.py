import asyncio
from browser_test import *
BASE="http://127.0.0.1:4000"
async def main():
    async with async_playwright() as p:
        b,pg0,logs0=await launch(p,960,540,tutorial_done=False); ctx=pg0.context; bad=[]
        for path,wait in [("explorer.html",1500),("asset-gallery.html",1500),("selftest.html",1500),("jungle-local-preview.html?quality=low&tools=1",9000),("index.html",1000),("parent.html",1000),("child-login.html",1000),("profile-setup.html",1000),("character-lab.html",6000),("reference-studio.html",3000)]:
            pg=await ctx.new_page(); logs=[]; pg.on("console",lambda m,logs=logs: logs.append((m.type,m.text))); pg.on("pageerror",lambda e,logs=logs: logs.append(("pageerror",str(e))))
            await pg.goto(BASE+"/"+path, wait_until="commit"); await pg.wait_for_timeout(wait)
            errs=[m[:200] for t,m in logs if (t in("error","pageerror") and "ERR_FAILED" not in m) or "Content Security Policy" in m]
            print(("OK  " if not errs else "BAD "),path,errs[:1]); 
            if errs: bad.append(path)
            await pg.close()
        print("ALL CLEAN" if not bad else f"PROBLEMS: {bad}"); await b.close()
asyncio.run(main())
