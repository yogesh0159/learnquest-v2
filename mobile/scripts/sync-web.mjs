// Copies the game into mobile/www (what the Android / iOS apps contain).
//   LQ_API_BASE=https://yourgame.up.railway.app  node scripts/sync-web.mjs     -> the address the app uses for accounts / progress ("" = offline game only)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)); const mobile = path.resolve(here, ".."); const root = path.resolve(mobile, "..");
const www = path.join(mobile, "www"); fs.rmSync(www, { recursive: true, force: true });
import { isExcludedFromApps } from "../../scripts/app-files.mjs";
const fe = path.join(root, "frontend");
const APP_ONLY_SKIP = new Set(["manifest.webmanifest", "offline.html"]);                          // installable-website files; an app has its files inside
const copyDir = (from, to) => { fs.mkdirSync(to, { recursive: true }); for (const e of fs.readdirSync(from, { withFileTypes: true })) { const a = path.join(from, e.name), b = path.join(to, e.name); const rel = path.relative(fe, a).split(path.sep).join("/"); if (isExcludedFromApps(rel) || APP_ONLY_SKIP.has(rel)) continue; e.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b); } };
copyDir(fe, www);
const manifest = JSON.parse(fs.readFileSync(path.join(root, "frontend", "precache-manifest.json"), "utf8")); const three = path.join(root, "node_modules", "three");
for (const { url } of manifest.shell.filter((e) => e.url.startsWith("/vendor/"))) {
  const src = url.startsWith("/vendor/three-addons/") ? path.join(three, "examples", "jsm", url.slice("/vendor/three-addons/".length)) : path.join(three, "build", url.slice("/vendor/three/".length));
  const dst = path.join(www, url.slice(1)); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst);
}
// the server address, set BEFORE any other script runs (read by js/lq-platform.js)
const apiBase = (process.env.LQ_API_BASE || "").trim().replace(/\/+$/, "");
fs.writeFileSync(path.join(www, "js", "lq-native-config.js"), `window.LQ_NATIVE_CONFIG = ${JSON.stringify({ apiBase })};\n`);
let pages = 0;
for (const f of fs.readdirSync(www).filter((n) => n.endsWith(".html"))) {
  const p = path.join(www, f); let s = fs.readFileSync(p, "utf8");
  s = s.replace(/<link rel="manifest"[^>]*>\s*/g, "").replace(/<script src="\/js\/pwa.js" defer><\/script>\s*/g, "");          // installable-website bits are not used inside an app
  s = s.replace("<head>", '<head>\n<script src="/js/lq-native-config.js"></script>'); fs.writeFileSync(p, s); pages++;
}
const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`mobile/www ready: ${pages} pages, ${(size(www) / 1e6).toFixed(0)} MB, server address: ${apiBase || "(none: offline game only)"}`);
