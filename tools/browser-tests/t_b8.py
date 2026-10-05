import asyncio, json, sys
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
SEED="(()=>{let a=12345;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}})()"   # the game picks random power-ups with Math.random: seed it so two runs can be compared
URL="http://127.0.0.1:5177/jungle-local-preview.html?seed=777&drs=0&quality=low&calibrate=0&notutorial=1"
SCENARIO="""()=>{ const g=LQ_JUNGLE; g.stopLoop(); g.start(); g.questions.nextIndex=1e9; g.track.reserved.clear(); g.power.reset(); g.player.invulnerable=0;
  const lanes=[0,2,1,0,2,1,1,0,2,2,0,1]; for(let k=0;k<lanes.length;k++){ g.player.laneIndex=lanes[k]; if(k%3===1) g.player.jump(); if(k%4===2) g.player.slide(); g.advance(2.5);} 
  const s=g.stats; return {coins:s.coins,lives:s.lives,score:Math.round(s.score),distance:Math.round(s.distance*100)/100,hits:s.hits,tokens:s.tokens,combo:s.bestCombo}; }"""
async def main():
    part=sys.argv[1] if len(sys.argv)>1 else 'a'
    async with async_playwright() as p:
        if part=='a':
            b,pg,logs=await launch(p,640,360); await pg.add_init_script(SEED); await boot(pg,URL); E=pg.evaluate
            ok("native C/C++ core is loaded and used by default",await E("LQ_JUNGLE.deviceInfo().engine")=="native" and any("Native core (C/C++ WebAssembly" in m and "active" in m for t,m in logs),[m for t,m in logs if "Native core" in m][:1] and [m for t,m in logs if "Native core" in m][0][:110])
            z=await E("(()=>{const g=LQ_JUNGLE; const mem=g.native.exports.memory.buffer; return {ambient:g.ambient.B.pos.buffer===mem, fx:g.fx.pos.buffer===mem, attr:g.ambient.points.geometry.attributes.position.array.buffer===mem, fxAttr:g.fx.points.geometry.attributes.color.array.buffer===mem, draw:g.ambient.points.geometry.drawRange.count}})()")
            ok("particle buffers live inside WebAssembly memory and three.js draws them directly (zero copy)",z['ambient'] and z['fx'] and z['attr'] and z['fxAttr'] and z['draw']==110,str(z))
            nat=await E(SCENARIO); print("    native:",nat)
            await E("LQ_JUNGLE.fx.burst(0,1,0,40,{life:1})"); await E("LQ_JUNGLE.advance(0.3)"); alive=await E("(()=>{const f=LQ_JUNGLE.fx; let n=0; for(let i=0;i<f.n;i++) if(f.life[i]>0) n++; return n})()"); ok("effect bursts animate in the C core (particles alive and fading)",alive>20,str(alive))
            amb=await E("(()=>{const p=LQ_JUNGLE.ambient.B.pos; let ok=true; for(let i=0;i<330;i++) if(!Number.isFinite(p[i])) ok=false; return ok})()"); ok("ambient particles stay finite after a long run",amb)
            fp=await E("LQ_JUNGLE.frameProfile()"); ok("frame profiler reports where the time goes (logic / draw-call submit / frame)",fp['frames']>=0 and 'logicMs' in fp and 'renderSubmitMs' in fp,str(fp))
            errs=[(t,m[:140]) for t,m in logs if t in('error','pageerror','warning')]; ok("no console errors/warnings",not errs,str(errs[:3])); await b.close()
            b,pg,logs=await launch(p,640,360); await pg.add_init_script(SEED); await boot(pg,URL+"&wasm=0"); E=pg.evaluate
            ok("?wasm=0 switches to the JavaScript reference",await E("LQ_JUNGLE.deviceInfo().engine")=="js" and not await E("!!LQ_JUNGLE.native"))
            js=await E(SCENARIO); print("    js:    ",js); ok("gameplay is IDENTICAL with the C/C++ core and with JavaScript (coins, lives, score, distance, hits, combo over a 30 s scripted run)",nat==js,f"{nat} vs {js}"); 
            await E("LQ_JUNGLE.setSetting('nativeCore', false)"); await pg.reload(); await pg.wait_for_function("window.LQ_JUNGLE&&window.LQ_JUNGLE.ready",timeout=120000)
            ok("the Settings switch turns the native core off for the next start",await pg.evaluate("LQ_JUNGLE.deviceInfo().engine")=="js"); await b.close()
        else:
            b,pg,logs=await launch(p,640,360); await pg.goto("http://127.0.0.1:4000/jungle-local-preview.html?seed=777&quality=low&calibrate=0&notutorial=1",wait_until="commit"); await pg.wait_for_timeout(25000)
            ok("on the full backend (strict security headers) the WebAssembly core is allowed and active",any("Native core (C/C++ WebAssembly" in m and "active" in m for t,m in logs),str([m[:100] for t,m in logs if "Native core" in m or "Refused" in m][:2]))
            errs=[(t,m[:140]) for t,m in logs if t in('error','pageerror') and 'ERR_FAILED' not in m]; ok("no CSP / console errors",not errs,str(errs[:2])); await b.close()
    print('ALL',all(R),f'{sum(R)}/{len(R)}')
asyncio.run(main())
