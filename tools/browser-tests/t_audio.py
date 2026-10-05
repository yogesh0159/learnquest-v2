import asyncio, json, base64, struct, wave
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(c); print("PASS" if c else "FAIL",n,d)
JS_RENDER = """async()=>{
 const {AudioManager}=await import('/js/game/jungle-run/audio-manager.js'); const {SFX}=await import('/js/game/jungle-run/sound-recipes.js');
 const stat=(buf)=>{const d=buf.getChannelData(0); let pk=0,sum=0,nan=false; for(let i=0;i<d.length;i++){const v=d[i]; if(!Number.isFinite(v)) nan=true; const a=Math.abs(v); if(a>pk)pk=a; sum+=v*v;}
   const tail=d.slice(Math.floor(d.length*0.97)); let tp=0; for(const v of tail) tp=Math.max(tp,Math.abs(v)); return {peak:pk,rms:Math.sqrt(sum/d.length),nan,tailPeak:tp};};
 const out={sfx:{},music:{}};
 for(const name of Object.keys(SFX)){
   const ctx=new OfflineAudioContext(2,44100*4,44100); const a=new AudioManager({context:ctx,storage:null}); a.play(name,{combo:3});
   out.sfx[name]=stat(await ctx.startRendering()); }
 for(const mood of ['run','quiz']){
   const ctx=new OfflineAudioContext(2,44100*34,44100); const a=new AudioManager({context:ctx,storage:null}); a.musicBus.gain.value=0.55; a.mood=mood; a.bpm=108;
   for(let i=0;i<16;i++) a.scheduleBar(i*(60/108)*4); out.music[mood]=stat(await ctx.startRendering()); out.music[mood].voices=a.synth.active; }
 return out; }"""
async def main():
    async with async_playwright() as p:
        b,pg,logs=await launch(p,640,360)
        await boot(pg,"http://127.0.0.1:5177/jungle-local-preview.html?quality=low")
        r=await pg.evaluate(JS_RENDER)
        for n,s in r['sfx'].items():
            ok(f"sfx '{n}' audible, not clipping, no NaN, ends silent", s['peak']>0.03 and s['peak']<=1.0 and not s['nan'] and s['tailPeak']<0.003, f"peak {s['peak']:.2f} rms {s['rms']:.3f} tail {s['tailPeak']:.4f}")
        for m,s in r['music'].items():
            ok(f"music '{m}' audible, no clipping, no NaN", s['peak']>0.05 and s['peak']<=1.0 and not s['nan'], f"peak {s['peak']:.2f} rms {s['rms']:.3f}")
        ok("quiz mood is calmer than run mood",r['music']['quiz']['rms']<r['music']['run']['rms']*0.8,f"{r['music']['quiz']['rms']:.3f} vs {r['music']['run']['rms']:.3f}")
        # live behaviour
        E=pg.evaluate
        ok("audio is locked before any gesture",await E("!LQ_JUNGLE.audio.ready"))
        await E("LQ_JUNGLE.stopLoop()")
        await pg.keyboard.press("Enter"); await pg.wait_for_timeout(400)
        st=await E("({ready:LQ_JUNGLE.audio.ready,state:LQ_JUNGLE.audio.ctx&&LQ_JUNGLE.audio.ctx.state,music:LQ_JUNGLE.audio.musicOn})")
        ok("first key press unlocks audio and starts music",st['ready'] and st['state']=='running' and st['music'],str(st))
        await pg.wait_for_timeout(1500); ok("music scheduler is producing bars",await E("LQ_JUNGLE.audio.stats.bars")>=1,str(await E("LQ_JUNGLE.audio.stats.bars")))
        await E("LQ_JUNGLE.director.enabled=false; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.collectibles.clear(); LQ_JUNGLE.player.invulnerable=0; LQ_JUNGLE.advance(1)")
        await pg.keyboard.press("ArrowLeft"); await pg.keyboard.press("ArrowUp"); await E("LQ_JUNGLE.advance(1.2)"); await pg.keyboard.press("ArrowDown")
        await E("LQ_JUNGLE.advance(1.3)")
        await pg.wait_for_timeout(120)
        for i in range(4): await E(f"LQ_JUNGLE.collectibles.spawn('coin',LQ_JUNGLE.player.x,1.0,-{2+i*0.2})")
        await E("LQ_JUNGLE.advance(0.5)")
        await E("LQ_JUNGLE.obstacles.spawn('rock',LQ_JUNGLE.player.x,-3); LQ_JUNGLE.advance(0.7)")
        pl=await E("LQ_JUNGLE.audio.stats.played"); print("   played:",pl)
        for k in ['lane','jump','slide','coin','hit']: ok(f"event plays '{k}'",pl.get(k,0)>=1)
        # mute
        await pg.keyboard.press("m"); ok("M mutes",await E("LQ_JUNGLE.audio.muted") and await E("document.getElementById('soundBtn').classList.contains('off')"))
        n0=sum((await E("LQ_JUNGLE.audio.stats.played")).values()); await E("LQ_JUNGLE.audio.play('jump')"); ok("muted = no new sounds",sum((await E("LQ_JUNGLE.audio.stats.played")).values())==n0)
        ok("mute persisted to localStorage",json.loads(await E("localStorage.getItem('learnquest.jungle.audio')"))['muted']==True)
        await pg.keyboard.press("m"); ok("M unmutes",not await E("LQ_JUNGLE.audio.muted"))
        # rate limit / voice cap
        d0=await E("LQ_JUNGLE.audio.stats.dropped"); await E("for(let i=0;i<500;i++) LQ_JUNGLE.audio.play('coin')"); ok("rapid spam is rate-limited (no audio overload)",await E("LQ_JUNGLE.audio.stats.dropped")>d0+400 and await E("LQ_JUNGLE.audio.synth.active")<=90,str(await E("LQ_JUNGLE.audio.synth.active")))
        # pause/resume + game over
        await pg.keyboard.press("p"); await pg.wait_for_timeout(200); ok("pause suspends audio",await E("LQ_JUNGLE.audio.ctx.state")=="suspended")
        await pg.keyboard.press("p"); await pg.wait_for_timeout(300); ok("resume restarts audio",await E("LQ_JUNGLE.audio.ctx.state")=="running")
        await E("LQ_JUNGLE.stats.lives=1; LQ_JUNGLE.player.invulnerable=0; LQ_JUNGLE.obstacles.clear(); LQ_JUNGLE.obstacles.spawn('rock',LQ_JUNGLE.player.x,-3); LQ_JUNGLE.advance(4)")
        ok("game over stops music and plays jingle",(await E("LQ_JUNGLE.state"))=="gameover" and not await E("LQ_JUNGLE.audio.musicOn") and (await E("LQ_JUNGLE.audio.stats.played")).get('gameover',0)>=1)
        await pg.keyboard.press("Enter"); await pg.wait_for_timeout(200); ok("restart brings the music back",await E("LQ_JUNGLE.audio.musicOn"))
        errs=[(t,m[:120]) for t,m in logs if t in('error','pageerror','warning')]; ok("no console errors/warnings",not errs,str(errs[:3]))
        print("ALL",all(R),f"{sum(R)}/{len(R)}"); await b.close()
asyncio.run(main())
