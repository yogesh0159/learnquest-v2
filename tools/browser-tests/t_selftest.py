import asyncio, json, sys
from browser_test import *
async def main():
    async with async_playwright() as p:
        b,pg,logs=await launch(p,1280,900)
        await pg.goto("http://127.0.0.1:4000/selftest.html?auto=1&benchMs=1500&warmMs=500",wait_until="commit")
        for i in range(300):
            await asyncio.sleep(2)
            try:
                st=await pg.evaluate("({done:!document.getElementById('copy').disabled, n:window.__selftest.results.length, sum:document.getElementById('sum').textContent})")
            except Exception as e: st={"done":False,"err":str(e)[:80]}
            print(i*2,st,flush=True)
            if st.get("done"): break
        rep=await pg.evaluate("window.__selftest.report")
        open("/tmp/selftest_report.txt","w").write(rep); print(rep)
        errs=[m[:150] for t,m in logs if t in("error","pageerror") and "ERR_FAILED" not in m]; print("console errors:",errs[:5])
        await b.close()
asyncio.run(main())
