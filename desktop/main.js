const { app, BrowserWindow, Menu, shell, session } = require("electron");
const path = require("path");
const fs = require("fs");
const { createServer, listen, PREFERRED_PORT } = require("./server");

// Which server do accounts / progress use?  LQ_API_BASE, or "apiBase" in <user data>/config.json (e.g. https://yourgame.up.railway.app). Empty = offline game only.
function apiBase() {
  if (process.env.LQ_API_BASE) return process.env.LQ_API_BASE;
  try { return JSON.parse(fs.readFileSync(path.join(app.getPath("userData"), "config.json"), "utf8")).apiBase || ""; } catch { return ""; }
}
const boundsFile = () => path.join(app.getPath("userData"), "window.json");
const loadBounds = () => { try { return JSON.parse(fs.readFileSync(boundsFile(), "utf8")); } catch { return {}; } };

// Use the graphics card even if the browser would have blocked it, and let sound play without a click first.
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
if (process.env.LQ_DESKTOP_SOFTWARE_GL) { app.commandLine.appendSwitch("use-gl", "angle"); app.commandLine.appendSwitch("use-angle", "swiftshader"); app.commandLine.appendSwitch("enable-unsafe-swiftshader"); }

if (!app.requestSingleInstanceLock()) app.quit();

let win, port;
async function createWindow() {
  const server = createServer(path.join(__dirname, "app")); port = await listen(server, PREFERRED_PORT);
  const b = loadBounds();
  win = new BrowserWindow({ width: b.width || 1280, height: b.height || 720, x: b.x, y: b.y, minWidth: 800, minHeight: 480, backgroundColor: "#cfeedd", show: false, autoHideMenuBar: true, title: "LearnQuest Jungle Run",
    icon: path.join(__dirname, "build", "icon.png"), fullscreen: !!b.fullscreen,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false, additionalArguments: [`--lq-api-base=${apiBase()}`] } });
  win.once("ready-to-show", () => win.show());
  win.on("close", () => { try { fs.writeFileSync(boundsFile(), JSON.stringify({ ...win.getNormalBounds(), fullscreen: win.isFullScreen() })); } catch { /* read-only profile */ } });
  // Only the game itself may load in this window; web links open in the normal browser.
  const local = (u) => u.startsWith(`http://127.0.0.1:${port}/`);
  win.webContents.on("will-navigate", (e, u) => { if (!local(u)) { e.preventDefault(); shell.openExternal(u); } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (!local(url)) shell.openExternal(url); return { action: local(url) ? "allow" : "deny" }; });
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(["fullscreen", "screen-wake-lock", "media"].includes(permission) || permission === "clipboard-sanitized-write"));
  await win.loadURL(`http://127.0.0.1:${port}/${process.env.LQ_DESKTOP_START || "jungle-local-preview.html"}${process.env.LQ_DESKTOP_QUERY || "?source=desktop"}`);
  if (process.env.LQ_DESKTOP_SELFTEST) runSelfTest();
}

// Automatic check used when building / testing the app: wait for the game, write a report and a screenshot, quit.
async function runSelfTest() {
  const out = process.env.LQ_DESKTOP_SELFTEST; const wc = win.webContents; const t0 = Date.now(); let report = { ok: false };
  try {
    for (let i = 0; i < 240; i++) { if (await wc.executeJavaScript("!!(window.LQ_JUNGLE && window.LQ_JUNGLE.ready)")) break; await new Promise((r) => setTimeout(r, 500)); }
    report = await wc.executeJavaScript(`(() => { const g = window.LQ_JUNGLE; if (!g) return { ok: false, why: "game did not start" }; g.stopLoop(); g.start(); g.player.invulnerable = 1e9; g.advance(3);
      return { ok: true, platform: window.LQ_PLATFORM, config: window.LQ_CONFIG, engine: g.deviceInfo().engine, quality: g.qualityId, gpu: g.gpu, distance: Math.round(g.stats.distance), models: g.assets.diagnostics().assets.length, failures: g.assets.diagnostics().failures.length, sw: !!(window.LQ_PWA && window.LQ_PWA.supported) }; })()`);
    report.seconds = Math.round((Date.now() - t0) / 1000); report.electron = process.versions.electron; report.port = port;
    const img = await wc.capturePage(); fs.writeFileSync(out + ".png", img.toPNG());
  } catch (e) { report = { ok: false, why: String(e) }; }
  fs.writeFileSync(out, JSON.stringify(report, null, 1)); app.quit();
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "Game", submenu: [{ label: "Play Jungle Run", click: () => win.loadURL(`http://127.0.0.1:${port}/jungle-local-preview.html?source=desktop`) }, { label: "Parent / child accounts", click: () => win.loadURL(`http://127.0.0.1:${port}/index.html`) }, { type: "separator" }, { role: "quit" }] },
    { label: "View", submenu: [{ role: "togglefullscreen", accelerator: "F11" }, { role: "reload" }, { role: "resetZoom" }] },
  ]));
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
