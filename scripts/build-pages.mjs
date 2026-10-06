// Builds the static site that GitHub Pages serves:   node scripts/build-pages.mjs --base /REPO-NAME/ --out site
//   --base  "/"            for a user site (https://USER.github.io/)
//           "/REPO-NAME/"  for a project site (https://USER.github.io/REPO-NAME/)  <- every root path (/js/.., /assets/..) is moved under it
// The site contains the game (Jungle Run), the self-check page, the 3D lab, the installable-app files and the offline file list.
// Pages that need the Node backend (accounts, parent dashboard ...) are left out: GitHub Pages cannot run a server.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."); const fe = path.join(root, "frontend");
const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def; };
let base = arg("--base", process.env.PAGES_BASE || "/"); if (!base.startsWith("/")) base = "/" + base; if (!base.endsWith("/")) base += "/";
const out = path.resolve(root, arg("--out", "site"));

const PAGES = ["jungle-local-preview.html", "offline.html"];                       // players get the game; the self-check and the 3D lab are developer tools
const SKIP_DIRS = ["assets/reference", "assets/jungle/reference", "assets/jungle/path", "assets/characters", "docs"];
const SKIP_FILES = new Set(["js/explorer.js", "js/asset-gallery.js", "js/reference-studio.js", "js/selftest.js", "js/character-lab.js", "js/site-nav.js", "precache-manifest.json"]);
const TEXT = /\.(html|js|mjs|css|json|webmanifest|svg|txt)$/i;
const sha = (b) => crypto.createHash("sha1").update(b).digest("hex").slice(0, 12);
const rel = (p, r) => path.relative(r, p).split(path.sep).join("/");

fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const copyDir = (from, to) => { for (const e of fs.readdirSync(from, { withFileTypes: true })) { const a = path.join(from, e.name), b = path.join(to, e.name), r = rel(a, fe);
  if (SKIP_DIRS.some((d) => r === d || r.startsWith(d + "/")) || SKIP_FILES.has(r)) continue;
  if (e.isDirectory()) { fs.mkdirSync(b, { recursive: true }); copyDir(a, b); } else if (!r.includes("/") && !PAGES.includes(r) && !["manifest.webmanifest", "sw.js", "index.html"].includes(r)) continue; else fs.copyFileSync(a, b); } };
copyDir(fe, out);
// three.js: exactly the files the game imports (listed by the app's own offline manifest)
const pm = JSON.parse(fs.readFileSync(path.join(fe, "precache-manifest.json"), "utf8")); const three = path.join(root, "node_modules", "three");
for (const { url } of pm.shell.filter((e) => e.url.startsWith("/vendor/"))) { const src = url.startsWith("/vendor/three-addons/") ? path.join(three, "examples", "jsm", url.slice(21)) : path.join(three, "build", url.slice(14)); const dst = path.join(out, url.slice(1)); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }

// the installable-app shortcut to the parent page does not exist here
const mf = path.join(out, "manifest.webmanifest"); const m = JSON.parse(fs.readFileSync(mf, "utf8")); m.shortcuts = (m.shortcuts || []).filter((s) => !/parent/.test(s.url)); fs.writeFileSync(mf, JSON.stringify(m, null, 2));

// links to pages that need the backend (or are developer tools) do not exist here: point them at the game, or drop them
const DEAD = "(?:explorer|profile-setup|reference-studio|parent|parent-dashboard|dashboard|child-login|rewards|tasks|realworld-missions|world-jungle|world-maths_kingdom|jungle-game|maths-kingdom-game|asset-gallery)";
for (const page of [...PAGES, "index.html"].filter((p) => p.endsWith(".html"))) { const f = path.join(out, page); if (!fs.existsSync(f)) continue; let s = fs.readFileSync(f, "utf8");
  s = s.replace(new RegExp(`\\s*<p>\\s*<a href="/?${DEAD}\\.html">[^<]*</a>\\s*</p>`, "g"), "");                                  // a whole line that only links to a missing page
  s = s.replace(new RegExp(`href="/?${DEAD}\\.html"`, "g"), 'href="jungle-local-preview.html"').replace("&larr; Hub", "&larr; Game").replace("\u2190 Back to Profile", "\u2190 Back to the game");
  fs.writeFileSync(f, s); }

// move every root-absolute path under the base
const ROOT_DIRS = "js|css|vendor|assets|wasm|locales"; const ROOT_FILES = "manifest\\.webmanifest|sw\\.js|offline\\.html|precache-manifest\\.json|jungle-local-preview\\.html|selftest\\.html|character-lab\\.html|index\\.html";
const re = new RegExp(`(["'\`(=\\s])/((?:${ROOT_DIRS})/|(?:${ROOT_FILES})(?=["'\`?#)\\s]))`, "g"); let rewritten = 0;
const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p, o) : o.push(p); } return o; };
if (base !== "/") for (const f of walk(out)) if (TEXT.test(f)) { const s = fs.readFileSync(f, "utf8"); const t = s.replace(re, (_, pre, tail) => `${pre}${base}${tail}`); if (t !== s) { fs.writeFileSync(f, t); rewritten++; } }
// the manifest's own ids / scope / start page
if (base !== "/") { const mm = JSON.parse(fs.readFileSync(mf, "utf8")); for (const k of ["id", "start_url", "scope"]) if (mm[k] && mm[k].startsWith("/") && !mm[k].startsWith(base)) mm[k] = base + mm[k].slice(1); fs.writeFileSync(mf, JSON.stringify(mm, null, 2)); }
else { const mm = JSON.parse(fs.readFileSync(mf, "utf8")); fs.writeFileSync(mf, JSON.stringify(mm, null, 2)); }

// home page: the project's own home page (hero, features, 3 languages). Its two login buttons point at pages that need the backend, so here they become
// "Play Jungle Run" and "Check my device speed"; the game menu gets a Home link back.
{ const f = path.join(out, "index.html"); let s = fs.readFileSync(f, "utf8");
  const cta = /<div class="hero-ctas">[\s\S]*?<\/div>/;
  if (!cta.test(s)) throw new Error("home page: hero buttons block not found");
  s = s.replace(cta, `<div class="hero-ctas">
        <a class="btn btn-primary" href="jungle-local-preview.html" data-h="cta_play">\u25B6 Play Jungle Run</a>
        <a class="btn btn-ghost" href="#how" data-h="cta_more">See how it works</a>
      </div>
      <p class="sub" style="margin:18px 0 0;font-size:.9rem;opacity:.85" data-h="pages_note">Playing on the free web page: your progress is saved on this device.</p>`);
  s = s.replace(/\s*<a [^>]*data-family[^>]*>[^<]*<\/a>/g, "").replace(/\s*<p [^>]*data-family[^>]*>[\s\S]*?<\/p>/g, "");     // accounts (Parents / Kids / free-runs note) need the backend
  fs.writeFileSync(f, s);
  const g = path.join(out, "jungle-local-preview.html"); let h = fs.readFileSync(g, "utf8");
  fs.writeFileSync(g, h.replace(/\s*<a [^>]*data-family[^>]*>[^<]*<\/a>/g, "")); }

// no Jekyll
fs.writeFileSync(path.join(out, ".nojekyll"), "");

// offline file list for this site (small files = shell, 3D models = offline pack), URLs include the base
const shell = [], pack = []; const entry = (f) => { const b = fs.readFileSync(f); return { url: base + rel(f, out), hash: sha(b), bytes: b.length }; };
for (const f of walk(out).sort()) { const r = rel(f, out); if (r === "precache-manifest.json" || r === "sw.js" || r === ".nojekyll" || r === "assets/icons/icon-1024.png") continue;
  if (r.startsWith("assets/jungle/runtime/") && r.endsWith(".glb")) pack.push(entry(f)); else if (r.startsWith("assets/") && !r.startsWith("assets/icons/")) continue; else shell.push(entry(f)); }
shell.push({ ...entry(path.join(out, "index.html")), url: base });
const manifest = { version: sha(shell.map((e) => e.url + e.hash).join("|")), assetsVersion: sha(pack.map((e) => e.url + e.hash).join("|")), shellBytes: shell.reduce((s, e) => s + e.bytes, 0), packBytes: pack.reduce((s, e) => s + e.bytes, 0), shell, offlinePack: pack };
fs.writeFileSync(path.join(out, "precache-manifest.json"), JSON.stringify(manifest, null, 1) + "\n");

const files = walk(out); const total = files.reduce((s, f) => s + fs.statSync(f).size, 0); const biggest = files.map((f) => [fs.statSync(f).size, rel(f, out)]).sort((a, b) => b[0] - a[0])[0];
console.log(`site/ ready: base "${base}", ${files.length} files, ${(total / 1e6).toFixed(0)} MB (largest ${(biggest[0] / 1e6).toFixed(1)} MB ${biggest[1]}), ${rewritten} files re-pathed, offline list ${shell.length} + ${pack.length} models`);
