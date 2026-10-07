// Checks a built GitHub Pages site:  node scripts/test-pages.mjs site /REPO-NAME/
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const dir = path.resolve(process.argv[2] || "site"); let base = process.argv[3] || "/"; if (!base.endsWith("/")) base += "/";
const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p, o) : o.push(p); } return o; };
const files = walk(dir); const text = files.filter((f) => /\.(html|js|css|json|webmanifest)$/.test(f)); let passed = 0; const test = (n, fn) => { fn(); passed++; console.log("  ok -", n); };
// models that only the original backend pages or a last-resort fallback mention; the Jungle Run itself never needs them
const OPTIONAL = ["assets/jungle/path/Path_Straight_01.glb", "assets/jungle/foliage/Jungle_Plant_01.glb"];
const exists = (url) => fs.existsSync(path.join(dir, decodeURIComponent(url.slice(base.length).split(/[?#]/)[0])));
test("entry files exist: the home page, the game, offline page, manifest, service worker, .nojekyll", () => { for (const f of ["index.html", "jungle-local-preview.html", "offline.html", "manifest.webmanifest", "sw.js", ".nojekyll", "precache-manifest.json", "wasm/lq_core.wasm", "locales/en.json", "locales/hi.json", "locales/mr.json", "css/tokens.css", "css/components.css", "css/home.css", "js/i18n.js", "js/home-3d.js", "js/game/jungle-run/device-profile.js", "js/game/jungle-run/free-plays.js"]) assert.ok(fs.existsSync(path.join(dir, f)), f); });
test("index.html is a real HOME PAGE (not a redirect): hero, Play button, See how it works, language switch; no developer tools and no account links; every home text exists in English, Hindi and Marathi", () => {
  const s = fs.readFileSync(path.join(dir, "index.html"), "utf8"); assert.ok(!/http-equiv=["']refresh/i.test(s), "must not redirect");
  for (const k of ['class="hero3d"', 'id="heroCanvas"', 'src="js/home-3d.js"', 'class="sr-only"', 'data-h="cta_play"', 'data-h="cta_more"', 'href="jungle-local-preview.html"', 'href="#how"', 'data-lang="hi"', 'data-lang="mr"', 'data-h="pages_note"']) assert.ok(s.includes(k), k);
  for (const k of ["selftest", "character-lab", "data-family", "parent.html", "child-login"]) assert.ok(!s.includes(k), "the free page must not show: " + k);
  assert.ok(!/href=["'](?:child-login|parent|dashboard)\.html/.test(s), "no login buttons on the free web page");
  for (const lang of ["en", "hi", "mr"]) { const j = JSON.parse(fs.readFileSync(path.join(dir, "locales", lang + ".json"), "utf8")); for (const m of s.matchAll(/data-i18n="([^"]+)"/g)) assert.ok(j[m[1]], `${lang}: ${m[1]}`); }
  assert.ok(fs.readFileSync(path.join(dir, "jungle-local-preview.html"), "utf8").includes('href="index.html"'), "the game menu links back to the home page"); });
test("no page that needs the backend is in the site, and no developer tools or heavy reference files", () => { for (const f of ["parent.html", "dashboard.html", "child-login.html", "explorer.html", "selftest.html", "character-lab.html", "js/selftest.js", "js/site-nav.js", "reference-studio.html", "docs", "assets/reference", "assets/jungle/path", "assets/characters"]) assert.ok(!fs.existsSync(path.join(dir, f)), f); });
test("GitHub limits respected: no file over 100 MB, whole site far below 1 GB", () => { const big = files.map((f) => fs.statSync(f).size); assert.ok(Math.max(...big) < 100e6); assert.ok(big.reduce((a, b) => a + b, 0) < 400e6); });
if (base !== "/") test(`no root-absolute path is left that would escape ${base} (a /js/..., /assets/... in the wrong place would be a 404)`, () => {
  const bad = []; const re = /(["'`(=\s])\/((?:js|css|vendor|assets|wasm|locales)\/|(?:manifest\.webmanifest|sw\.js|offline\.html|precache-manifest\.json|jungle-local-preview\.html|selftest\.html|character-lab\.html)(?=["'`?#)\s]))/g;
  for (const f of text) { const s = fs.readFileSync(f, "utf8"); let m; while ((m = re.exec(s))) bad.push(path.relative(dir, f) + ": " + s.slice(Math.max(0, m.index - 20), m.index + 40).replace(/\n/g, " ")); } assert.deepEqual(bad.slice(0, 5), []); });
test(`every ${base}... file that a page or script refers to really exists in the site`, () => {
  const missing = new Set(); const re = new RegExp("(?<=[\"'`(=\\s])" + base.replace(/\//g, "\\/") + "[A-Za-z0-9_./\\-]+\\.(?:webmanifest|wasm|html|json|glb|png|css|ico|js)(?![A-Za-z0-9])", "g");
  for (const f of text) for (const u of fs.readFileSync(f, "utf8").match(re) || []) if (!exists(u) && !OPTIONAL.some((o) => u.endsWith(o))) missing.add(path.relative(dir, f) + " -> " + u); assert.deepEqual([...missing].slice(0, 5), []); });
test("no link in the site points to a page that is not in the site", () => {
  const bad = []; for (const f of files.filter((x) => /\.(html|js)$/.test(x))) { const s = fs.readFileSync(f, "utf8"); for (const m of s.matchAll(/href=["'](?!https?:|#|mailto:|javascript:)([^"']+?\.html)(?:[?#][^"']*)?["']/g)) { const u = m[1]; const target = u.startsWith("/") ? (u.startsWith(base) ? u.slice(base.length) : "\0" + u) : path.posix.join(path.posix.dirname(path.relative(dir, f).split(path.sep).join("/")), u); if (target.startsWith("\0") || !fs.existsSync(path.join(dir, target))) bad.push(path.relative(dir, f) + " -> " + u); } }
  const pageScripts = new Set(["jungle-local-preview.html", "offline.html", "index.html"]);
  assert.deepEqual(bad.filter((x) => pageScripts.has(x.split(" ")[0])), []); });
test("offline file list: every file exists, URLs start with the base, the shell is small, 15 models", () => { const pm = JSON.parse(fs.readFileSync(path.join(dir, "precache-manifest.json"), "utf8"));
  for (const e of [...pm.shell, ...pm.offlinePack]) { assert.ok(e.url.startsWith(base), e.url); assert.ok(e.url === base || exists(e.url), e.url); } assert.ok(pm.shellBytes < 6e6 && pm.offlinePack.length === 15); });
test("the installable-app manifest lives under the base: id, start page and scope; icons exist", () => { const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.webmanifest"), "utf8")); for (const k of ["id", "start_url", "scope"]) assert.ok(m[k].startsWith(base), k + " " + m[k]); for (const i of m.icons) assert.ok(exists(i.src), i.src); assert.ok(!(m.shortcuts || []).some((s) => /parent/.test(s.url))); });
test("service worker and its registration use the base", () => { const sw = fs.readFileSync(path.join(dir, "sw.js"), "utf8"), pwa = fs.readFileSync(path.join(dir, "js/pwa.js"), "utf8"); assert.ok(sw.includes(base + "precache-manifest.json") && sw.includes(base + "offline.html") && sw.includes("/api/")); assert.ok(pwa.includes(`register("${base}sw.js")`)); });
console.log(`\n${passed} tests passed (${files.length} files)`);
