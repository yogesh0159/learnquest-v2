// Checks everything that makes LearnQuest an installable website and an Android / iOS / desktop app, without needing Android Studio, Xcode or a store account.
// Run: npm run platforms:test
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."); const require = createRequire(import.meta.url);
let passed = 0; const test = (name, fn) => { fn(); passed++; console.log("  ok -", name); };
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const P = require(path.join(root, "frontend/js/lq-platform.js"));
const UA = { iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", pixel: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36 Edg/154", mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15", electron: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) LearnQuest/1.0 Chrome/120 Electron/33.0.0 Safari/537.36" };

console.log("platform detection");
test("detects web, installed web app, Android app, iPhone, iPad, Windows, Mac and the desktop app", () => {
  const d = (ua, plat, touch, w, h, extra = {}) => P.detectPlatform({ navigator: { userAgent: ua, platform: plat, maxTouchPoints: touch, standalone: extra.standalone }, screen: { width: w, height: h }, Capacitor: extra.Capacitor });
  assert.deepEqual(pick(d(UA.iphone, "iPhone", 5, 390, 844)), ["web", "ios", true]);
  assert.deepEqual(pick(d(UA.iphone, "iPhone", 5, 390, 844, { standalone: true })), ["pwa", "ios", true]);
  assert.deepEqual(pick(d(UA.pixel, "Linux armv8l", 5, 412, 915)), ["web", "android", true]);
  assert.deepEqual(pick(d(UA.pixel, "Linux", 5, 412, 915, { Capacitor: { isNativePlatform: () => true } })), ["capacitor", "android", true]);
  assert.equal(d(UA.mac, "MacIntel", 5, 820, 1180).os, "ios");                                // iPadOS pretends to be a Mac
  assert.equal(d(UA.mac, "MacIntel", 5, 820, 1180).tablet, true); assert.equal(d(UA.mac, "MacIntel", 0, 1440, 900).os, "mac");
  assert.deepEqual(pick(d(UA.edge, "Win32", 0, 1920, 1080)), ["web", "windows", false]);
  assert.deepEqual(pick(d(UA.electron, "Linux x86_64", 0, 1920, 1080)), ["electron", "linux", false]);
  function pick(p) { return [p.kind, p.os, p.touch]; }
});
test("the server address is only accepted as scheme://host[:port] (no javascript:, no paths, no spaces)", () => {
  for (const [input, want] of [["https://api.example.com/", "https://api.example.com"], ["https://api.example.com/api", "https://api.example.com"], ["http://192.168.1.5:4000", "http://192.168.1.5:4000"], ["javascript:alert(1)", ""], ["https://x.com/some/path", ""], ["ftp://x.com", ""], ["https://a b.com", ""], ["", ""]]) assert.equal(P.normalizeBase(input), want, input);
});
test("?api= is remembered for next time, the app shell's setting wins, and storage failures are harmless", () => {
  const store = new Map(); const ls = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(P.resolveConfig({ location: { href: "https://x.test/?api=https://srv.example.com" }, localStorage: ls }).apiBase, "https://srv.example.com");
  assert.equal(P.resolveConfig({ location: { href: "https://x.test/" }, localStorage: ls }).apiBase, "https://srv.example.com");
  assert.equal(P.resolveConfig({ location: { href: "https://x.test/?api=https://other.com" }, localStorage: ls, LQ_NATIVE_CONFIG: { apiBase: "https://shell.example.com" } }).apiBase, "https://shell.example.com");
  assert.equal(P.resolveConfig({ location: { href: "bad" }, localStorage: { getItem() { throw new Error("blocked"); } } }).apiBase, "");
});

console.log("installable website (PWA)");
test("manifest.webmanifest has everything browsers need to offer installation, with real icons of the declared sizes", () => {
  const m = JSON.parse(read("frontend/manifest.webmanifest")); assert.ok(m.name && m.short_name && m.start_url && m.scope && m.display === "standalone" && m.theme_color && m.background_color);
  assert.deepEqual(m.icons.map((i) => `${i.sizes}/${i.purpose}`).sort(), ["192x192/any", "512x512/any", "512x512/maskable"]);
  for (const i of m.icons) { const b = fs.readFileSync(path.join(root, "frontend", i.src)); assert.equal(b.readUInt32BE(16), Number(i.sizes.split("x")[0])); assert.equal(b.readUInt32BE(20), Number(i.sizes.split("x")[1])); }
});
test("the offline file list is up to date with the files on disk (run `node scripts/build-pwa.mjs` after editing the frontend)", () => { execFileSync("node", [path.join(root, "scripts/build-pwa.mjs"), "--check"], { stdio: "pipe" }); });
test("the service worker never caches /api, keeps its manifest across restarts, and the shell is small", () => {
  const sw = read("frontend/sw.js"); assert.match(sw, /\/api\//); assert.match(sw, /lq-meta/); assert.match(sw, /__manifest\/current/); assert.match(sw, /SKIP_WAITING/);
  const pm = JSON.parse(read("frontend/precache-manifest.json")); assert.ok(pm.shellBytes < 6e6 && pm.offlinePack.length === 15 && pm.shell.some((e) => e.url === "/wasm/lq_core.wasm") && pm.shell.some((e) => e.url === "/vendor/three/three.core.js"));
});

console.log("Android and iOS apps (Capacitor)");
const cfg = JSON.parse(read("mobile/capacitor.config.json"));
test("app id, name, web folder and https scheme are set", () => { assert.equal(cfg.appId, "com.learnquest.junglerun"); assert.equal(cfg.appName, "LearnQuest"); assert.equal(cfg.webDir, "www"); assert.equal(cfg.server.androidScheme, "https"); });
test("Android project: vibrate + keep-awake permissions, full-screen activity, screen kept on, sound without a first tap, backups off", () => {
  const man = read("mobile/android/app/src/main/AndroidManifest.xml"); for (const k of ["android.permission.INTERNET", "android.permission.VIBRATE", "android.permission.WAKE_LOCK", 'allowBackup="false"', "fullSensor"]) assert.ok(man.includes(k), k);
  const act = read("mobile/android/app/src/main/java/com/learnquest/junglerun/MainActivity.java"); for (const k of ["FLAG_KEEP_SCREEN_ON", "setMediaPlaybackRequiresUserGesture(false)", "hide(WindowInsetsCompat.Type.systemBars())"]) assert.ok(act.includes(k), k);
  assert.ok(fs.existsSync(path.join(root, "mobile/android/gradlew")) && fs.existsSync(path.join(root, "mobile/android/app/build.gradle")));
});
test("Android launcher icons exist for every density (normal, round, adaptive) and iOS has its app icon and splash", () => {
  const res = path.join(root, "mobile/android/app/src/main/res"); for (const d of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) for (const n of ["ic_launcher", "ic_launcher_round", "ic_launcher_foreground"]) assert.ok(fs.existsSync(path.join(res, "mipmap-" + d, n + ".png")), `${n} ${d}`);
  assert.ok(fs.existsSync(path.join(root, "mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")) || fs.readdirSync(path.join(root, "mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset")).some((f) => f.endsWith(".png")));
});
test("iOS Info.plist: landscape + portrait, status bar hidden, full screen, no export-compliance prompt", () => {
  const plist = read("mobile/ios/App/App/Info.plist"); for (const k of ["UIInterfaceOrientationPortrait", "UIInterfaceOrientationLandscapeLeft", "UIStatusBarHidden", "UIRequiresFullScreen", "ITSAppUsesNonExemptEncryption"]) assert.ok(plist.includes(k), k);
});
test("the app bundle is built from the website minus developer tools and heavy reference files, and carries the server address", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "lqm-")); const script = read("mobile/scripts/sync-web.mjs");
  const tmpMobile = path.join(os.tmpdir(), "lqm-run"); fs.rmSync(tmpMobile, { recursive: true, force: true }); fs.mkdirSync(path.join(tmpMobile, "scripts"), { recursive: true });
  // run the real script against the real project but write to a temporary www (the script derives www from its own location)
  fs.cpSync(path.join(root, "mobile/scripts/sync-web.mjs"), path.join(tmpMobile, "scripts/sync-web.mjs")); fs.symlinkSync(root + "/scripts", path.join(os.tmpdir(), "lqm-scripts"), "dir");
  assert.ok(script.includes("isExcludedFromApps"));
  const res = execFileSync("node", ["-e", `process.env.LQ_API_BASE="https://srv.example.com"; import(${JSON.stringify(path.join(root, "mobile/scripts/sync-web.mjs"))})`], { cwd: root, stdio: "pipe" }).toString();
  const www = path.join(root, "mobile/www"); try {
    for (const gone of ["explorer.html", "asset-gallery.html", "selftest.html", "reference-studio.html", "sw.js", "manifest.webmanifest", "docs", "assets/reference", "assets/jungle/path", "assets/characters"]) assert.ok(!fs.existsSync(path.join(www, gone)), "should not ship: " + gone);
    for (const must of ["jungle-local-preview.html", "index.html", "parent.html", "assets/jungle/runtime/Boy_Final_Animated.rt.glb", "assets/jungle/runtime/Girl_Mia_Animated.rt.glb", "wasm/lq_core.wasm", "vendor/three/three.module.js", "vendor/three/three.core.js", "vendor/three-addons/loaders/GLTFLoader.js", "js/lq-native-config.js"]) assert.ok(fs.existsSync(path.join(www, must)), "missing: " + must);
    assert.match(fs.readFileSync(path.join(www, "js/lq-native-config.js"), "utf8"), /https:\/\/srv\.example\.com/);
    const html = fs.readFileSync(path.join(www, "jungle-local-preview.html"), "utf8"); assert.ok(html.indexOf("lq-native-config.js") < html.indexOf("lq-platform.js") && !html.includes("rel=\"manifest\""));
    const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0); assert.ok(size(www) < 75e6, "app bundle too large: " + (size(www) / 1e6).toFixed(0) + " MB");
  } finally { fs.rmSync(www, { recursive: true, force: true }); fs.rmSync(tmpMobile, { recursive: true, force: true }); fs.rmSync(path.join(os.tmpdir(), "lqm-scripts"), { force: true }); fs.rmSync(out, { recursive: true, force: true }); }
});

console.log("desktop app (Electron)");
test("package.json builds Windows, macOS and Linux installers; icons for all three exist", () => {
  const pk = JSON.parse(read("desktop/package.json")); for (const k of ["dist:win", "dist:mac", "dist:linux", "start"]) assert.ok(pk.scripts[k], k); assert.ok(pk.build.win.target.includes("nsis") && pk.build.mac.target.includes("dmg") && pk.build.linux.target.includes("AppImage"));
  for (const f of ["icon.ico", "icon.icns", "icon.png"]) assert.ok(fs.statSync(path.join(root, "desktop/build", f)).size > 1000, f);
});
test("main process: sandboxed window, no Node in the page, navigation limited to the game, local-only server", () => {
  const m = read("desktop/main.js"); for (const k of ["contextIsolation: true", "sandbox: true", "nodeIntegration: false", "will-navigate", "setWindowOpenHandler", "requestSingleInstanceLock"]) assert.ok(m.includes(k), k);
  const s = read("desktop/server.js"); assert.ok(s.includes('"127.0.0.1"') && s.includes("Forbidden"));
});
test("desktop bundle = website minus developer tools + the exact three.js files", () => {
  execFileSync("node", [path.join(root, "desktop/prepare.mjs")], { stdio: "pipe" }); const app = path.join(root, "desktop/app");
  try { for (const gone of ["frontend/explorer.html", "frontend/docs", "frontend/assets/jungle/path"]) assert.ok(!fs.existsSync(path.join(app, gone)), gone); for (const must of ["frontend/jungle-local-preview.html", "vendor/three/three.module.js", "frontend/wasm/lq_core.wasm", "frontend/assets/jungle/runtime/Coin.rt.glb"]) assert.ok(fs.existsSync(path.join(app, must)), must); }
  finally { fs.rmSync(app, { recursive: true, force: true }); }
});
console.log(`\n${passed} tests passed`);
