import asyncio
from browser_test import *
res=[]
def ok(n,c,d=""): res.append(c); print("PASS" if c else "FAIL",n,d)
async def main():
    async with async_playwright() as p:
        b,pg,logs=await launch(p,640,360)
        await boot(pg,"http://127.0.0.1:5177/jungle-local-preview.html?quality=low&seed=9"); E=pg.evaluate; await pg.evaluate("LQ_JUNGLE.setSetting('readTime', 'off')")        # these checks run for a long time without tapping Ready!
        E=pg.evaluate
        await E("LQ_JUNGLE.stopLoop()")
        await pg.keyboard.press("Enter"); ok("Enter starts game",await E("LQ_JUNGLE.state")=="playing")
        await E("LQ_JUNGLE.director.enabled=false; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.player.invulnerable=1e9; LQ_JUNGLE.advance(1)")
        for key,exp in [("ArrowLeft",0),("d",1),("ArrowRight",2),("a",1),("A",0),("D",1)]:
            await pg.keyboard.press(key); ok(f"key {key} -> lane {exp}",await E("LQ_JUNGLE.player.laneIndex")==exp)
        await E("LQ_JUNGLE.advance(0.6)")
        for key in ["ArrowUp","w","Space"]:
            await pg.keyboard.press(key if key!="Space" else " "); ok(f"key {key} -> jump",await E("LQ_JUNGLE.player.state")=="jump"); await E("LQ_JUNGLE.advance(1.2)")
        for key in ["ArrowDown","s"]:
            await pg.keyboard.press(key); ok(f"key {key} -> slide",await E("LQ_JUNGLE.player.state")=="slide"); await E("LQ_JUNGLE.advance(1.3)")
        await pg.keyboard.press("p"); ok("P pauses",await E("LQ_JUNGLE.state")=="paused" and not await E("document.getElementById('pauseScreen').hidden"))
        await pg.keyboard.press("p"); ok("P resumes",await E("LQ_JUNGLE.state")=="playing")
        await pg.keyboard.press("Escape"); await pg.click("#resumeBtn"); ok("Resume button works",await E("LQ_JUNGLE.state")=="playing")
        # mouse swipe on canvas
        box=await pg.locator("#scene").bounding_box(); cx,cy=box['x']+300,box['y']+200
        await pg.mouse.move(cx,cy); await pg.mouse.down(); await pg.mouse.move(cx-120,cy,steps=4); await pg.mouse.up(); ok("swipe left -> lane change",await E("LQ_JUNGLE.player.laneIndex")==0)
        ok("no console errors",not [m for t,m in logs if t in('error','pageerror','warning')])
        print(all(res)); await b.close()
asyncio.run(main())
