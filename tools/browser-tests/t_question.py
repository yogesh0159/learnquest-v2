import asyncio, json, base64
from browser_test import *
async def shot(pg, name):
    d=await pg.evaluate("window.LQ_JUNGLE.renderOnce()")
    open(f"shots/{name}.png","wb").write(base64.b64decode(d.split(",")[1]))
async def ev(pg, js): return await pg.evaluate(js)
async def run(p, seed, lane_mode):
    b,pg,logs=await launch(p,960,540)
    await boot(pg,f"http://127.0.0.1:5177/jungle-local-preview.html?quality=balanced&seed={seed}")
    await ev(pg,"LQ_JUNGLE.stopLoop(); LQ_JUNGLE.start(); LQ_JUNGLE.player.invulnerable=9999;")
    # advance until a zone exists and pads are ~32 m away
    for _ in range(400):
        await ev(pg,"LQ_JUNGLE.advance(0.25)")
        z=await ev(pg,"LQ_JUNGLE.questions.hasZone ? LQ_JUNGLE.questions.padZ : null")
        if z is not None and z>-34: break
    snap=await ev(pg,"LQ_JUNGLE.snapshot()"); print("zone",snap['zone'],"padZ",z)
    q=await ev(pg,"LQ_JUNGLE.questions.question"); print("Q:",q['text'],[o['label'] for o in q['options']],"correctIdx",q['correctIndex'])
    await shot(pg,f"05_board_far_{lane_mode}")
    await ev(pg,"LQ_JUNGLE.advance(1.2)"); await shot(pg,f"05b_board_near_{lane_mode}")
    target = q['correctIndex'] if lane_mode=="right" else (q['correctIndex']+1)%3
    await ev(pg,f"LQ_JUNGLE.player.laneIndex={target}")
    before=await ev(pg,"({lives:LQ_JUNGLE.stats.lives,score:LQ_JUNGLE.stats.score})")
    for _ in range(80):
        await ev(pg,"LQ_JUNGLE.advance(0.1)")
        st=await ev(pg,"LQ_JUNGLE.questions.state")
        if st=="answered": break
    await ev(pg,"LQ_JUNGLE.advance(0.3)"); await shot(pg,f"06_answered_{lane_mode}")
    after=await ev(pg,"({lives:LQ_JUNGLE.stats.lives,score:Math.floor(LQ_JUNGLE.stats.score),correct:LQ_JUNGLE.stats.correct,wrong:LQ_JUNGLE.stats.wrong,anim:LQ_JUNGLE.player.anim.currentAlias})")
    print(lane_mode,"before",before,"after",after)
    for t,m in logs:
        if t in('error','warning','pageerror','reqfail') or 'Question zone' in m or 'Answer lane' in m: print("  LOG",t,m[:200])
    await b.close()
async def main():
    async with async_playwright() as p:
        await run(p,4242,"right"); await run(p,4242,"wrong")
asyncio.run(main())
