/* LearnQuest service worker: installable app + offline play.
 *  - shell (pages, scripts, styles, three.js, wasm, icons) is cached when the app is first opened   -> cache  lq-shell-<version>
 *  - 3D models are cached the first time they are used (or all at once from Settings)             -> cache  lq-assets-<assetsVersion>
 *  - /api/* is NEVER cached (accounts, progress and answers always come from the server)
 *  - scripts, styles, translations: network first (revalidated, so a new deploy is never mixed with old files), the saved copy offline;  pages: network first, saved copy offline, offline.html as the last resort
 * A new version takes over immediately; the page shows "A new version is ready - Reload now" (a running game is never reloaded by itself). */
const MANIFEST_URL = "/precache-manifest.json";
const META = "lq-meta";                                   // keeps the manifest of the active version (the service worker can be stopped and restarted at any time, also while offline)
let current;
const names = (m) => ({ shell: `lq-shell-${m.version}`, assets: `lq-assets-${m.assetsVersion}`, runtime: "lq-runtime-v1" });
const readMeta = async (key) => { const hit = await (await caches.open(META)).match(key); return hit ? hit.json() : null; };
const manifest = () => (current ||= readMeta("/__manifest/current"));

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const r = await fetch(MANIFEST_URL, { cache: "no-store" }); const text = await r.text(); const m = JSON.parse(text);
    await (await caches.open(META)).put("/__manifest/pending", new Response(text, { headers: { "content-type": "application/json" } }));
    const c = await caches.open(names(m).shell);
    const urls = m.shell.map((e) => e.url).concat(["/offline.html"]);
    await Promise.all(urls.map(async (u) => { const res = await fetch(new Request(u, { cache: "reload" })); if (res.ok) await c.put(u, res); }));
    self.skipWaiting();                                                                // take over at once: files are fetched fresh anyway, so a running page is never left on mixed versions
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const meta = await caches.open(META); const pending = await meta.match("/__manifest/pending");
    if (pending) await meta.put("/__manifest/current", pending);                       // the new version becomes the active one only now
    current = null; const m = await manifest(); const keep = new Set(Object.values(names(m)).concat([META]));
    for (const k of await caches.keys()) if (k.startsWith("lq-") && !keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => { if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting(); });

const isModel = (url) => /\.(glb|gltf|bin|ktx2|webp|png|jpg|jpeg|mp3|ogg|wav)$/i.test(url.pathname) && url.pathname.startsWith("/assets/");

self.addEventListener("fetch", (event) => {
  const req = event.request; if (req.method !== "GET") return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (url.pathname === MANIFEST_URL) {                                                    // fresh when online, the saved copy of the active version when offline
    event.respondWith(fetch(req).catch(async () => { const m = await manifest(); return m ? new Response(JSON.stringify(m), { headers: { "content-type": "application/json" } }) : Response.error(); }));
    return;
  }
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js" || url.pathname.startsWith("/__") || req.headers.has("range")) return;   // always the network

  event.respondWith((async () => {
    const m = await manifest().catch(() => null); if (!m) return fetch(req);
    const n = names(m);
    if (req.mode === "navigate") {                                                        // pages: network first, then the saved copy
      try { const r = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 4000))]); return r; }
      catch { const hit = await caches.match(req, { ignoreSearch: true }); return hit || (await caches.match("/offline.html")) || Response.error(); }
    }
    const shellCache = await caches.open(n.shell); const shellHit = await shellCache.match(req, { ignoreSearch: true });
    if (shellHit) {                                                                       // pages, scripts, styles, translations: ALWAYS the latest when online (one revalidation, usually a 304), the saved copy offline
      try { const r = await Promise.race([fetch(new Request(req, { cache: "no-cache" })), new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 3500))]); if (r.ok && r.type === "basic") shellCache.put(req, r.clone()); return r; }
      catch { return shellHit; }
    }
    if (isModel(url)) {                                                                   // models & images: cache first, fill on first use
      const c = await caches.open(n.assets); const hit = await c.match(req); if (hit) return hit;
      const r = await fetch(req); if (r.ok && r.type === "basic") c.put(req, r.clone()); return r;
    }
    const c = await caches.open(n.runtime); const hit = await c.match(req);                // everything else: serve the copy, refresh it in the background
    const fresh = fetch(req).then((r) => { if (r.ok && r.type === "basic") c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await fresh) || Response.error();
  })());
});
