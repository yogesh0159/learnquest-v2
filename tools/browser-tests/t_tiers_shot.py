import asyncio, base64
from browser_test import *
async def main():
    async with async_playwright() as p:
        for q in ["high","balanced","low"]:
            b,pg,logs=await launch(p,960,540)
            await boot(pg,f"http://127.0.0.1:5177/jungle-local-preview.html?quality={q}&seed=4242&drs=0"); E=pg.evaluate
            await E("LQ_JUNGLE.stopLoop(); LQ_JUNGLE.start(); LQ_JUNGLE.director.enabled=false; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.collectibles.clear(); LQ_JUNGLE.player.invulnerable=1e9; LQ_JUNGLE.advance(8); LQ_JUNGLE.collectibles.spawn('coin',0,1.05,-9); LQ_JUNGLE.collectibles.spawn('coin',2.2,1.05,-14); LQ_JUNGLE.obstacles.spawn('rock',-2.2,-16); LQ_JUNGLE.advance(0.2)")
            d=await E("LQ_JUNGLE.renderOnce()"); open(f"shots/70_tier_{q}.png","wb").write(base64.b64decode(d.split(",")[1]))
            print(q,[ (t,m[:100]) for t,m in logs if t in("error","pageerror","warning")], await E("({tier:LQ_JUNGLE.qualityId,scale:LQ_JUNGLE.renderScale,gpuClass:LQ_JUNGLE.gpuClass,blob:LQ_JUNGLE.blob.visible})"))
            await b.close()
asyncio.run(main())
