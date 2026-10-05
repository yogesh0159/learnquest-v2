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

const PAGES = ["jungle-local-preview.html", "selftest.html", "character-lab.html", "offline.html"];
const SKIP_DIRS = ["assets/reference", "assets/jungle/reference", "assets/jungle/path", "assets/characters", "docs"];
const SKIP_FILES = new Set(["js/explorer.js", "js/asset-gallery.js", "js/reference-studio.js", "precache-manifest.json"]);
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

// texts that exist only on the free web page (the Play / device-speed buttons and the note) are added to the site's own copy of the translations
const PAGES_TEXTS = {
  en: { home_cta_play: "\u25B6 Play Jungle Run", home_cta_speed: "Check my device speed", home_link_lab: "3D lab", home_pages_note: "Playing on the free web page: your progress is saved on this device. Kid and parent accounts need the LearnQuest server." },
  hi: { home_cta_play: "\u25B6 \u091C\u0902\u0917\u0932 \u0930\u0928 \u0916\u0947\u0932\u094B", home_cta_speed: "\u092E\u0947\u0930\u0947 \u0921\u093F\u0935\u093E\u0907\u0938 \u0915\u0940 \u0938\u094D\u092A\u0940\u0921 \u091C\u093E\u0901\u091A\u094B", home_link_lab: "3D \u0932\u0948\u092C", home_pages_note: "\u092E\u0941\u092B\u093C\u094D\u0924 \u0935\u0947\u092C \u092A\u0947\u091C \u092A\u0930 \u0916\u0947\u0932 \u0930\u0939\u0947 \u0939\u0948\u0902: \u0906\u092A\u0915\u0940 \u092A\u094D\u0930\u0917\u0924\u093F \u0907\u0938\u0940 \u0921\u093F\u0935\u093E\u0907\u0938 \u092A\u0930 \u0938\u0947\u0935 \u0939\u094B\u0924\u0940 \u0939\u0948\u0964 \u092C\u091A\u094D\u091A\u094B\u0902 \u0914\u0930 \u092E\u093E\u0924\u093E-\u092A\u093F\u0924\u093E \u0915\u0947 \u0905\u0915\u093E\u0909\u0902\u091F \u0915\u0947 \u0932\u093F\u090F LearnQuest \u0938\u0930\u094D\u0935\u0930 \u091A\u093E\u0939\u093F\u090F\u0964" },
  mr: { home_cta_play: "\u25B6 \u091C\u0902\u0917\u0932 \u0930\u0928 \u0916\u0947\u0933\u093E", home_cta_speed: "\u092E\u093E\u091D\u094D\u092F\u093E \u0921\u093F\u0935\u094D\u0939\u093E\u0907\u0938\u091A\u0940 \u0917\u0924\u0940 \u0924\u092A\u093E\u0938\u093E", home_link_lab: "3D \u0932\u0945\u092C", home_pages_note: "\u092E\u094B\u092B\u0924 \u0935\u0947\u092C \u092A\u0947\u091C\u0935\u0930 \u0916\u0947\u0933\u0924 \u0906\u0939\u093E\u0924: \u0924\u0941\u092E\u091A\u0940 \u092A\u094D\u0930\u0917\u0924\u0940 \u092F\u093E\u091A \u0921\u093F\u0935\u094D\u0939\u093E\u0907\u0938\u0935\u0930 \u0938\u0947\u0935\u094D\u0939 \u0939\u094B\u0924\u0947. \u092E\u0941\u0932\u093E\u0902\u091A\u094D\u092F\u093E \u0906\u0923\u093F \u092A\u093E\u0932\u0915\u093E\u0902\u091A\u094D\u092F\u093E \u0916\u093E\u0924\u094D\u092F\u093E\u0902\u0938\u093E\u0920\u0940 LearnQuest \u0938\u0930\u094D\u0935\u094D\u0939\u0930 \u0932\u093E\u0917\u0924\u094B." },
};
for (const [lang, texts] of Object.entries(PAGES_TEXTS)) { const f = path.join(out, "locales", lang + ".json"); fs.writeFileSync(f, JSON.stringify({ ...JSON.parse(fs.readFileSync(f, "utf8")), ...texts }, null, 2) + "\n"); }

// home page: the project's own home page (hero, features, 3 languages). Its two login buttons point at pages that need the backend, so here they become
// "Play Jungle Run" and "Check my device speed"; the game menu gets a Home link back.
{ const f = path.join(out, "index.html"); let s = fs.readFileSync(f, "utf8");
  const cta = /<div class="hero-ctas">[\s\S]*?<\/div>/;
  if (!cta.test(s)) throw new Error("home page: hero buttons block not found");
  s = s.replace(cta, `<div class="hero-ctas">
        <a class="btn btn-primary" href="jungle-local-preview.html" data-i18n="home_cta_play">\u25B6 Play Jungle Run</a>
        <a class="btn btn-ghost" href="selftest.html" data-i18n="home_cta_speed">Check my device speed</a>
      </div>
      <p class="sub" style="margin:22px auto 0;font-size:.9rem"><a href="character-lab.html" data-i18n="home_link_lab">3D lab</a></p>
      <p class="sub" style="margin:10px auto 0;font-size:.85rem;opacity:.8" data-i18n="home_pages_note">Playing on the free web page: your progress is saved on this device. Kid and parent accounts need the LearnQuest server.</p>`);
  fs.writeFileSync(f, s);
  const g = path.join(out, "jungle-local-preview.html"); let h = fs.readFileSync(g, "utf8"); const lab = 'data-i18n="menu.lab">Lab view</a>';
  if (!h.includes(lab)) throw new Error("game menu: Lab view link not found");
  fs.writeFileSync(g, h.replace(lab, lab + ' &middot; <a href="index.html" aria-label="Home" title="Home">\u{1F3E0}</a>')); }

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
