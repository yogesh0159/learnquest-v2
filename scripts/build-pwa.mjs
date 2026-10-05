// Builds frontend/precache-manifest.json: every file the installed web app needs offline, with a content hash.
//   shell        small files (pages, scripts, styles, icons, three.js, wasm) cached when the app is first opened
//   offlinePack  the 3D models; cached on demand while playing, or all at once from Settings -> "Download for offline play"
// Run: node scripts/build-pwa.mjs          (--check only verifies that the committed manifest is up to date)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fe = path.join(root, "frontend");
const three = path.join(root, "node_modules", "three");
const sha = (buf) => crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12);
const walk = (dir, out = []) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); e.isDirectory() ? walk(p, out) : out.push(p); } return out; };
const entry = (url, file) => { const b = fs.readFileSync(file); return { url, hash: sha(b), bytes: b.length }; };

const shell = [], pack = [], seen = new Set();
const add = (list, url, file) => { if (!seen.has(url) && fs.existsSync(file)) { seen.add(url); list.push(entry(url, file)); } };

for (const file of walk(fe).sort()) {
  const rel = path.relative(fe, file).split(path.sep).join("/"); const url = "/" + rel;
  if (rel.startsWith("docs/") || rel === "precache-manifest.json" || rel === "sw.js" || rel === "assets/icons/icon-1024.png") continue;
  if (rel.startsWith("assets/jungle/runtime/") && rel.endsWith(".glb")) { add(pack, url, file); continue; }
  if (rel.startsWith("assets/") && !rel.startsWith("assets/icons/")) continue;            // other models: cached on demand only
  add(shell, url, file);
}
// three.js and the add-ons the game imports (found by reading the frontend, then their relative imports)
const addons = new Set(); for (const f of walk(path.join(fe, "js")).concat(fs.readdirSync(fe).filter((n) => n.endsWith(".html")).map((n) => path.join(fe, n)))) { for (const m of fs.readFileSync(f, "utf8").matchAll(/\/vendor\/three-addons\/([A-Za-z0-9_\/.\-]+\.js)/g)) addons.add(m[1]); }
const jsm = path.join(three, "examples", "jsm"); const queue = [...addons]; const done = new Set();
while (queue.length) { const rel = queue.pop(); if (done.has(rel)) continue; done.add(rel); const file = path.join(jsm, rel); if (!fs.existsSync(file)) continue; add(shell, "/vendor/three-addons/" + rel, file);
  for (const m of fs.readFileSync(file, "utf8").matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)) queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1]))); }
for (const f of ["three.module.js", "three.core.js"]) add(shell, "/vendor/three/" + f, path.join(three, "build", f));
add(shell, "/", path.join(fe, "index.html"));

const manifest = { version: sha(shell.map((e) => e.url + e.hash).join("|")), assetsVersion: sha(pack.map((e) => e.url + e.hash).join("|")), shellBytes: shell.reduce((s, e) => s + e.bytes, 0), packBytes: pack.reduce((s, e) => s + e.bytes, 0), shell, offlinePack: pack };
const out = path.join(fe, "precache-manifest.json"); const text = JSON.stringify(manifest, null, 1) + "\n";
if (process.argv.includes("--check")) {
  const old = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : null;
  if (!old || old.version !== manifest.version || old.assetsVersion !== manifest.assetsVersion) { console.error("precache-manifest.json is out of date: run `node scripts/build-pwa.mjs`"); process.exit(1); }
  console.log(`precache manifest is up to date (${shell.length} shell files ${(manifest.shellBytes / 1e6).toFixed(1)} MB, ${pack.length} models ${(manifest.packBytes / 1e6).toFixed(1)} MB)`); process.exit(0);
}
fs.writeFileSync(out, text);
console.log(`precache-manifest.json: ${shell.length} shell files (${(manifest.shellBytes / 1e6).toFixed(1)} MB), ${pack.length} models (${(manifest.packBytes / 1e6).toFixed(1)} MB), version ${manifest.version}`);
