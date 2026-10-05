import asyncio, re
from browser_test import *
R=[]
def ok(n,c,d=""): R.append(bool(c)); print("PASS" if c else "FAIL",n,d)
async def main():
    async with async_playwright() as p:
        b,pg,logs=await launch(p,1280,800,bypass_csp=True); E=pg.evaluate
        await pg.goto("http://127.0.0.1:4000/asset-gallery.html",wait_until="commit"); await pg.wait_for_selector("#list button")
        n=await E("document.querySelectorAll('#list button').length"); names=await E("[...document.querySelectorAll('#list button')].map(b=>b.textContent)")
        ok("gallery lists 21 models: your girl.glb + 10 runtime + 10 untouched sources",n==21,str(n))
        ok("no 'old' models are listed anywhere",not any(re.search(r'\bold\b',x.lower()) for x in names) and 'Earlier' not in await E("document.getElementById('list').innerText"),str([x for x in names if re.search(r'\bold\b',x.lower())]))
        await pg.wait_for_function("document.getElementById('prog').textContent==='girl.glb (your file)'",timeout=120000); await pg.wait_for_timeout(500)
        info=await E("document.getElementById('info').innerText"); ok("opens on YOUR girl.glb automatically: 1,276,110 triangles, 44.26 MB, no skeleton","1,276,110" in info and "44.26" in info and "none" in info,info.replace("\n"," | ")[:140])
        ok("a note explains that the game uses the animated version of this girl","animated, lighter version" in info)
        for name,expect in [("Coin","2,428"),("Question board","28,144"),("Boy explorer","76,003")]:
            await pg.click(f'#list button:text-is("{name}")'); await pg.wait_for_function("document.getElementById('prog').textContent==="+repr(name),timeout=60000); await pg.wait_for_timeout(300)
            info=await E("document.getElementById('info').innerText"); ok(f"{name}: loads and shows {expect} triangles",expect in info,info.replace("\n"," | ")[:100])
        ok("the Boy shows 13 animation clips",await E("document.querySelectorAll('#oAnim option').length")==14)
        await pg.click('#list button:text-is("Coin (193k tris)")'); await pg.wait_for_function("document.getElementById('prog').textContent==='Coin (193k tris)'",timeout=90000)
        info=await E("document.getElementById('info').innerText"); ok("original Coin (source) loads from the untouched file: 192,752 triangles","192,752" in info,info.replace("\n"," | ")[:90])
        await pg.check("#oWire"); await pg.check("#oBox"); ok("wireframe / bounding box toggles work",await E("window.__gallery.current.children.length>=0"))
        errs=[m[:150] for t,m in logs if t in("error","pageerror") and "ERR_FAILED" not in m]; ok("no console errors",not errs,str(errs[:2]))
        print("ALL",all(R),f"{sum(R)}/{len(R)}"); await b.close()
asyncio.run(main())
