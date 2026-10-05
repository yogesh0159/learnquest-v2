import asyncio
from browser_test import *
async def main():
    async with async_playwright() as p:
        b,pg,logs=await launch(p,800,500,service_workers="allow"); ctx=pg.context
        csp=[]; pg.on("console",lambda m: csp.append(m.text) if ("Content Security Policy" in m.text or "Refused" in m.text) else None)
        await pg.goto("http://127.0.0.1:4000/index.html",wait_until="commit"); await pg.wait_for_timeout(9000)
        sws=ctx.service_workers; print("service workers on the strict-CSP backend:",len(sws),[w.url.split('/')[-1] for w in sws]); print("CSP violations:",csp[:2])
        keys=await sws[0].evaluate("caches.keys()") if sws else []; print("caches:",keys)
        print("RESULT", "PASS" if len(sws)>=1 and not csp and any(k.startswith('lq-shell-') for k in keys) else "FAIL")
        await b.close()
asyncio.run(main())
