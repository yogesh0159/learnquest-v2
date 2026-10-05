import { SFX, Synth, scheduleBar } from "./sound-recipes.js";

const STORE_KEY = "learnquest.jungle.audio";
const MIN_GAP = { coin: 0.035, lane: 0.09, click: 0.05, default: 0.06 };   // seconds between identical sfx
const MASTER_GAIN = 1.5;                                                 // make-up gain (the synthesised sounds are deliberately mixed low; the compressor guards against clipping)
const MAX_VOICES = 80;                                                   // hard cap on simultaneous oscillators/noise sources

/**
 * Audio engine: master -> compressor -> speakers, with separate music and sfx buses.
 * Browsers only allow audio after a user gesture, so nothing is created until `unlock()` is called
 * from a key press / click. Every call is safe before that (it simply does nothing).
 */
export class AudioManager {
  constructor({ context = null, storage = globalThis.localStorage, logger = console } = {}) {
    this.ctx = context; this.logger = logger; this.storage = storage;
    this.settings = { muted: false, music: 0.55, sfx: 0.9 };
    try { Object.assign(this.settings, JSON.parse(storage?.getItem(STORE_KEY) || "{}")); } catch { /* corrupt or unavailable storage */ }
    this.musicOn = false; this.mood = "run"; this.bpm = 108; this.bar = 0; this.nextBarTime = 0; this.timer = null;
    this.last = new Map(); this.stats = { played: {}, dropped: 0, bars: 0 };
    this.listeners = new Set(); this.comboCount = 0; this.comboAt = -9;
    if (context) this._build();
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _changed() { this.listeners.forEach((fn) => fn(this.settings)); }
  _save() { try { this.storage?.setItem(STORE_KEY, JSON.stringify(this.settings)); } catch { /* ignore */ } }
  get ready() { return !!this.ctx; }
  get muted() { return this.settings.muted; }

  _build() {
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.settings.muted ? 0 : MASTER_GAIN;
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 5; this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
    // Safety limiter after the compressor so overlapping effects can never clip the speakers.
    this.limiter = c.createDynamicsCompressor(); this.limiter.threshold.value = -2; this.limiter.knee.value = 0; this.limiter.ratio.value = 20; this.limiter.attack.value = 0.001; this.limiter.release.value = 0.08;
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.settings.sfx;
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0;
    this.sfxBus.connect(this.master); this.musicBus.connect(this.master); this.master.connect(this.comp); this.comp.connect(this.limiter); this.limiter.connect(c.destination);
    this.synth = new Synth(c);
  }

  /** Call from any user gesture. Idempotent. */
  async unlock() {
    if (!this.ctx) {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctor) { this.logger.warn?.("[LearnQuest] WebAudio is not available: the game will run silently"); return false; }
      try { this.ctx = new Ctor({ latencyHint: "interactive" }); this._build(); } catch (e) { this.logger.warn?.("[LearnQuest] Audio init failed:", e.message); this.ctx = null; return false; }
      this.logger.info?.("[LearnQuest] Audio ready");
    }
    if (this.ctx.state === "suspended" && this.ctx.resume && !this.heldSuspended) { try { await this.ctx.resume(); } catch { /* still blocked */ } }
    if (this.wantMusic && !this.musicOn) this.startMusic();
    return this.ctx.state === "running";
  }

  /* ------------------------------------------------------------------ sfx */
  play(name, opts = {}) {
    if (!this.ctx || this.settings.muted || this.settings.sfx <= 0 || !SFX[name]) return false;
    const now = this.ctx.currentTime; const gap = MIN_GAP[name] ?? MIN_GAP.default;
    if (now - (this.last.get(name) ?? -9) < gap) { this.stats.dropped++; return false; }
    if (this.synth.active > MAX_VOICES) { this.stats.dropped++; return false; }
    this.last.set(name, now);
    if (name === "coin") {                                   // chained coins climb the scale, reset after a pause
      this.comboCount = now - this.comboAt < 0.9 ? this.comboCount + 1 : 0; this.comboAt = now; opts = { ...opts, combo: this.comboCount };
    }
    SFX[name](this.synth, this.sfxBus, now + 0.005, opts);
    this.stats.played[name] = (this.stats.played[name] || 0) + 1;
    return true;
  }

  /* ---------------------------------------------------------------- music */
  startMusic() {
    this.wantMusic = true;
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true; this.bar = 0; this.nextBarTime = this.ctx.currentTime + 0.1;
    const g = this.musicBus.gain; g.cancelScheduledValues(this.ctx.currentTime); g.setValueAtTime(g.value, this.ctx.currentTime);
    g.linearRampToValueAtTime(this.settings.music, this.ctx.currentTime + 1.2);
    this.timer = setInterval(() => this._pump(), 50); this._pump();
  }
  stopMusic(fade = 1) {
    this.wantMusic = false;
    if (!this.ctx || !this.musicOn) return;
    const t = this.ctx.currentTime; const g = this.musicBus.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + fade);
    this.musicOn = false; clearInterval(this.timer); this.timer = null;
  }
  setMood(mood) { this.mood = mood; }
  /** Music speeds up a little with run speed (10 m/s -> 108 bpm, 17 m/s -> ~125 bpm). */
  setSpeed(speed) { this.bpm = Math.max(96, Math.min(126, 100 + (speed - 10) * 2.6)); }

  _pump() {
    if (!this.ctx || this.ctx.state !== "running") return;
    while (this.nextBarTime < this.ctx.currentTime + 0.45) {
      this.scheduleBar(this.nextBarTime); this.nextBarTime += (60 / this.bpm) * 4;
    }
  }
  /** Public so tests can render the music offline. */
  scheduleBar(t) { scheduleBar(this.synth, this.musicBus, t, this.bar++, { bpm: this.bpm, mood: this.mood }); this.stats.bars++; }

  /* -------------------------------------------------------------- controls */
  setMuted(m) {
    this.settings.muted = !!m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : MASTER_GAIN, this.ctx.currentTime, 0.02);
    this._save(); this._changed();
  }
  toggleMute() { this.setMuted(!this.settings.muted); if (!this.settings.muted) this.play("click"); return this.settings.muted; }
  setVolume(kind, v) {
    v = Math.max(0, Math.min(1, v)); this.settings[kind] = v;
    if (this.ctx) { (kind === "music" ? this.musicBus : this.sfxBus).gain.setTargetAtTime(kind === "music" && !this.musicOn ? 0 : v, this.ctx.currentTime, 0.03); }
    this._save(); this._changed();
  }
  // heldSuspended stops unlock() (which runs on every key press) from undoing a deliberate pause.
  suspend() { this.heldSuspended = true; if (this.ctx?.state === "running") this.ctx.suspend(); }
  resume() { this.heldSuspended = false; if (this.ctx?.state === "suspended") this.ctx.resume(); }
  dispose() { clearInterval(this.timer); this.ctx?.close?.(); }
}
