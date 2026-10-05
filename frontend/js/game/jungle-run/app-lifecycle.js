/**
 * Behaviour an installed app needs and a plain web page does not:
 *  - leaving the app (home button, app switcher, tab hidden, screen off) pauses a running game and silences the sound
 *  - the screen stays awake while a run is in progress (Wake Lock)
 *  - Android back button (Capacitor): pause / resume / leave
 *  - iOS: Web Audio is muted by the hardware silent switch unless an <audio> element is "playing" -> a silent loop is started on the first touch
 *  - the GPU may take the WebGL context away while the app is in the background -> pause, then recover
 *  - fullscreen button where the browser allows it
 * Every step is optional: a missing API never breaks the game.
 */
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export class AppLifecycle {
  constructor({ game, platform = window.LQ_PLATFORM || {}, doc = document, win = window }) {
    this.game = game; this.P = platform; this.doc = doc; this.win = win; this.wakeLock = null; this.pausedByLeave = false; this.iosAudio = null; this.events = [];
    this._bind();
  }
  _on(target, type, fn, opts) { target.addEventListener(type, fn, opts); this.events.push([target, type, fn, opts]); }
  dispose() { for (const [t, ty, fn, o] of this.events) t.removeEventListener(ty, fn, o); this.events = []; this.releaseWakeLock(); }

  _bind() {
    const g = this.game;
    this._on(this.doc, "visibilitychange", () => (this.doc.hidden ? this.onLeave() : this.onReturn()));
    this._on(this.win, "pagehide", () => this.onLeave());
    this._on(this.win, "pageshow", (e) => { if (e.persisted) this.onReturn(); });
    this._on(this.win, "blur", () => { if (this.P.kind === "capacitor") this.onLeave(); });
    // GPU context taken away (typical on phones after the app was in the background)
    this._on(g.canvas, "webglcontextlost", (e) => { e.preventDefault(); this.onLeave(); g.log?.("Graphics context lost: paused"); });
    this._on(g.canvas, "webglcontextrestored", () => { g.log?.("Graphics context restored"); g.hud?.toast?.("OK", "good", 800); });
    // native shell events (Capacitor App plugin) when running as an Android / iOS app
    const App = this.win.Capacitor?.Plugins?.App;
    if (App?.addListener) {
      App.addListener("appStateChange", ({ isActive }) => (isActive ? this.onReturn() : this.onLeave()));
      App.addListener("backButton", () => this.onBack());
    }
    // iOS audio session, first touch only
    const unlock = () => { this.unlockIosAudio(); this.win.removeEventListener("pointerdown", unlock, true); this.win.removeEventListener("keydown", unlock, true); };
    this.win.addEventListener("pointerdown", unlock, true); this.win.addEventListener("keydown", unlock, true);
    // keep the screen on during runs
    this._wl = setInterval(() => (g.state === "playing" ? this.requestWakeLock() : this.releaseWakeLock()), 1500);
  }

  onLeave() {
    const g = this.game;
    if (g.state === "playing") { g.pause(); this.pausedByLeave = true; }
    else g.audio?.suspend?.();
    this.releaseWakeLock();
  }
  onReturn() {
    const g = this.game;
    if (g.state !== "paused" && g.state !== "playing") g.audio?.resume?.();            // menu / game over: sound may come back
    this.pausedByLeave = false;                                                        // a paused run stays paused until the player taps Resume
  }
  onBack() {
    const g = this.game;
    if (g.state === "playing") g.pause();
    else if (g.state === "paused") g.resume();
    else this.win.Capacitor?.Plugins?.App?.exitApp?.();
  }

  async requestWakeLock() {
    if (this.wakeLock || this.doc.hidden || !this.win.navigator?.wakeLock) return;
    try { this.wakeLock = await this.win.navigator.wakeLock.request("screen"); this.wakeLock.addEventListener?.("release", () => { this.wakeLock = null; }); } catch { this.wakeLock = null; }
  }
  releaseWakeLock() { const w = this.wakeLock; this.wakeLock = null; try { w?.release?.(); } catch { /* already released */ } }

  unlockIosAudio() {
    if (this.P.os !== "ios") return;
    try { if (this.win.navigator.audioSession) this.win.navigator.audioSession.type = "playback"; } catch { /* old iOS */ }
    try { const a = this.doc.createElement("audio"); a.src = SILENT_WAV; a.loop = true; a.setAttribute("playsinline", ""); a.volume = 0.01; a.play?.().catch(() => {}); this.iosAudio = a; } catch { /* ignore */ }
  }

  get fullscreenAvailable() { return !!(this.doc.fullscreenEnabled && this.P.kind === "web"); }
  toggleFullscreen() {
    try { if (this.doc.fullscreenElement) this.doc.exitFullscreen(); else this.doc.documentElement.requestFullscreen({ navigationUI: "hide" }); } catch { /* not allowed */ }
  }
}
