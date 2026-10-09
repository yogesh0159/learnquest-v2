import * as THREE from "three";
import { RoomEnvironment } from "/vendor/three-addons/environments/RoomEnvironment.js";
import { InputController } from "../core/input-controller.js";
import { AdaptiveResolution } from "./adaptive-resolution.js";
import { loadNativeCore } from "./native-core.js";
import { AppLifecycle } from "./app-lifecycle.js";
import { TeacherManager } from "./teacher-manager.js";
import { analyseDevice, calibrateTiers, collectBrowserFacts, renderSizeFor, deviceSignature, DEVICE_MODEL_VERSION, readDeviceCache, writeDeviceCache, clearDeviceCache, TIER_ORDER, tierIndex, stepDown } from "./device-profile.js";
import { AssetManager } from "./asset-manager.js";
import { ASSET_REGISTRY, BOOT_ASSETS, GAME, LANES, PLAYER, QUALITY, QUESTIONS } from "./config.js";
import { EndlessTrackManager } from "./track-manager.js";
import { EnvironmentManager } from "./environment-manager.js";
import { CollectibleManager } from "./collectible-manager.js";
import { ObstacleManager } from "./obstacle-manager.js";
import { SpawnDirector } from "./spawn-director.js";
import { CollisionManager } from "./collision-manager.js";
import { QuestionManager } from "./question-manager.js";
import { PlayerController } from "./player-controller.js";
import { CameraRig } from "./camera-rig.js";
import { FxManager } from "./fx-manager.js";
import { Hud } from "./hud.js";
import { AudioManager } from "./audio-manager.js";
import { PowerUpManager, POWERUPS } from "./powerup-manager.js";
import { Profile, TRAILS } from "./profile.js";
import { evaluateAchievements, achievementById } from "./achievements.js";
import { Speaker } from "./speech.js";
import { i18n, t, detectLanguage, LANGS, STRINGS } from "./i18n.js";
import { readSeconds } from "./question-reading.js";
import { localizeQuestion } from "./question-i18n.js";
import { Tutorial } from "./tutorial.js";
import { BiomeManager, AmbientFx } from "./biome-manager.js";
import { BIOMES, BIOME_LENGTH } from "./biome-data.js";
import { DebugPanel } from "./debug-panel.js";
import { makeGroundTexture, makeSkyDome } from "./textures.js";

const TAG = "[LearnQuest]";
const FOG = 0xc4ead8;
const BEST_KEY = "learnquest.jungle.best";

export class GameManager {
  constructor({ canvas, logger = console, params = new URLSearchParams(location.search) }) {
    this.canvas = canvas; this.logger = logger; this.params = params;
    this.hud = new Hud();
    this.state = "boot";                 // boot | menu | playing | paused | gameover
    // ?sandbox=1 keeps profile + audio settings in memory only (used by the self-check so it can never touch real progress).
    this.sandbox = params.get("sandbox") === "1";
    const mem = new Map(); const store = this.sandbox ? { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) } : globalThis.localStorage;
    this.store = store; this.profile = new Profile(store); if (this.sandbox && params.get("tutorial") !== "1") this.profile.data.tutorialDone = true;
    this.characterKey = ["boy", "girl"].includes(params.get("character")) ? params.get("character") : this.profile.settings.character;
    i18n.set(detectLanguage(this.profile.settings.language || (() => { try { return localStorage.getItem("lq_lang") || ""; } catch { return ""; } })(), location.search, navigator.language));   // the language chosen on the home page carries over until the player picks one in the game
    this.speaker = new Speaker(); this.speaker.enabled = !!this.profile.settings.tts; this.speaker.lang = LANGS[i18n.lang].speech;
    // Test/explorer URL options (never saved to the profile): ?subjects=science,spelling &grade=3 &biomeStart=1200 &lives=5 &god=1 &tools=1
    const subj = (params.get("subjects") || "").split(",").filter(Boolean);
    this.override = { subjects: subj.length ? subj : null, grade: [1, 2, 3].includes(Number(params.get("grade"))) ? Number(params.get("grade")) : null };
    this.biomeOffset = Number(params.get("biomeStart")) || 0; this.startLives = Math.max(1, Math.min(9, Number(params.get("lives")) || GAME.lives)); this.god = params.get("god") === "1";
    this.touch = !!globalThis.matchMedia?.("(pointer: coarse)").matches || params.get("touch") === "1";
    this.tutorial = new Tutorial({
      onStep: (s, i, n) => this._coach(s, i, n), onPraise: () => { this.hud.coach(t("t.nice")); this.audio.play("lifeUp"); this.vibrate(20); },
      onDone: (d) => this._tutorialDone(d),
    });
    this.review = []; this.runAchievements = []; this.achTimer = 0; this.trailTimer = 0; this.hitMark = 0; this.subjectsRight = new Set();
    this.qualityId = "balanced"; this.quality = QUALITY.balanced;      // replaced in _initRenderer once the graphics card is known
    this.prof = { n: 0, logic: 0, misc: 0, render: 0, frame: 0 };
    this.renderScale = 1; this.drsEnabled = params.get("drs") !== "0"; this.drs = new AdaptiveResolution({ min: 0.5, max: 1 });
    this.speedMultiplier = 1; this.lab = params.get("lab") === "1";
    this.stats = this._freshStats(); this.speed = 0; this.reading = null; this.hud?.reading?.(false); this.runSeed = (Math.random() * 1e9) | 0;
    this.frameMs = 16; this.lastTs = 0; this.fps = 0; this.fpsAcc = 0; this.fpsN = 0;
    this.audio = new AudioManager({ logger, storage: store }); this.audio.wantMusic = true; if (this.sandbox) this.audio.settings.muted = true;   // music starts on the first click / key press
    this.specialHandlers = []; this.events = new EventTarget(); this.fixedStep = false; this.ready = false;
  }

  _freshStats() { return { score: 0, coins: 0, tokens: 0, distance: 0, lives: this.startLives ?? GAME.lives, maxLives: Math.max(GAME.maxLives, this.startLives ?? 0), tally: {}, multiplier: 1, multiplierLeft: 0, correct: 0, wrong: 0, streak: 0, hits: 0, combo: 0, bestCombo: 0, bestStreak: 0, powerUps: 0, power: [], noHitDistance: 0, subjectsRight: 0 }; }
  log(...a) { this.logger.info?.(TAG, ...a); }

  /* ------------------------------------------------------------------ boot */
  async boot() {
    this.hud.show("loading", true);
    await this._detectDevice();
    // The C / C++ core (WebAssembly). Optional: any problem -> the identical JavaScript reference runs instead.
    this.native = (this.params.get("wasm") !== "0" && this.profile.settings.nativeCore !== false) ? await loadNativeCore({ logger: { info: (m) => this.log(m.replace(/^\[LearnQuest\] /, "")), warn: (m) => this.logger.warn?.(m) } }) : null;
    this._initRenderer();
    this.assets = new AssetManager({ renderer: this.renderer, logger: this.logger, onProgress: (p) => this.hud.progress(p) });
    this._registerFallbacks();
    this.log("Loading path...");
    await this.assets.loadMany(BOOT_ASSETS);
    this.log("Loading character...");
    await this._loadCharacter(this.characterKey, true);
    this._buildWorld();
    this._bindInput();
    this.lifecycle = new AppLifecycle({ game: this });
    addEventListener("keydown", (e) => { if (this.reading && !e.repeat && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopImmediatePropagation(); this.skipReading(); } }, true);
    this.teacher = new TeacherManager({ game: this }); await this.teacher.load();                  // the friendly teacher who runs behind the child                  // pause when the app is left, keep the screen awake, back button, iOS audio, GPU context loss
    this._applyQuality(this.quality);
    await this.calibrate();
    this.prewarm();
    this.hud.show("loading", false); this.hud.show("menu", true);
    this.state = "menu"; this.ready = true;
    const failures = this.assets.diagnostics().failures;
    if (failures.length) this.hud.toast(t("t.missing", { x: failures.map((f) => f.key).join(", ") }), "bad", 5000);
    this.log("Jungle ready");
    this.lastTs = performance.now();
    this.renderer.setAnimationLoop((ts) => this._frame(ts));
  }

  /** Step 1 of "analyse before running": collect facts about this device and decide the starting level / ceiling. */
  async _detectDevice() {
    this.hud.device(t("load.analyse"));
    this.rawFacts = await collectBrowserFacts();
    this.device = analyseDevice(this.rawFacts); this.facts = this.device.facts; this.gpu = this.facts.gpu; this.gpuClass = this.device.gpuClass;
    const pick = (v) => (TIER_ORDER.includes(v) ? v : null);
    const explicit = pick(this.params.get("quality")) || pick(this.profile.settings.graphics);
    this.autoGraphics = !explicit; this.signature = deviceSignature(this.facts, DEVICE_MODEL_VERSION);
    this.cached = this.autoGraphics ? readDeviceCache(this.store, this.signature) : null;
    this.deviceTier = this.cached ? this.cached.tier : this.device.start;
    this.qualityId = explicit || this.deviceTier; this.quality = QUALITY[this.qualityId];
    const f = this.facts;
    this.hud.device(t("load.facts", { gpu: this.gpu.replace(/^ANGLE \((.*)\)$/, "$1").slice(0, 70), w: f.native.w, h: f.native.h, ram: f.deviceMemory ? `${f.deviceMemory} GB` : "?", cores: f.cores || "?", hz: f.refreshHz }));
    this.log(`Device: ${this.gpu} (${this.gpuClass}); screen ${f.native.w}x${f.native.h} @${f.dpr}; ${f.deviceMemory ?? "?"} GB; ${f.cores ?? "?"} cores; ${f.refreshHz} Hz -> up to ${this.device.cap}, start ${this.device.start}${this.cached ? `, cached result ${this.cached.tier}` : ""}`);
    this.log(`Device reasons: ${this.device.reasons.join("; ")}`);
  }

  _initRenderer() {
    // MSAA only where it helps and is cheap: strong GPUs on screens up to 2K (at 4K the pixels are too dense to see jagged edges).
    const wantAA = (this.gpuClass === "discrete" || tierIndex(this.qualityId) >= tierIndex("high")) && this.facts.native.pixels <= 2560 * 1440 * 1.05;
    this.log(`Graphics: quality ${this.qualityId}${this.autoGraphics ? " (automatic)" : " (chosen)"}; antialias ${wantAA ? "on" : "off"}`);
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: wantAA, powerPreference: "high-performance" });
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = r;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(FOG);
    this.scene.fog = new THREE.Fog(FOG, 34, 108);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 125);
    this.sky = makeSkyDome(); this.scene.add(this.sky);
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.55; pm.dispose();
    this.hemi = new THREE.HemisphereLight(0xdff6ff, 0x3b5a2a, 1.0); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0cf, 2.4); this.sun.position.set(-9, 17, 9); this.sun.target.position.set(0, 0, -4);
    this.sun.castShadow = true; const sc = this.sun.shadow.camera; sc.left = -13; sc.right = 13; sc.top = 20; sc.bottom = -16; sc.near = 1; sc.far = 50;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.cameraRig = new CameraRig(this.camera);
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  _registerFallbacks() {
    const box = (w, h, d, color) => () => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color })); m.position.y = h / 2; g.add(m); return g; };
    this.assets.registerFallback("tree", box(1.2, 6, 1.2, 0x2f7d3a)); this.assets.registerFallback("bush", box(2, 1.2, 2, 0x3f9b4f));
    this.assets.registerFallback("rock", box(1.4, 1.1, 1.4, 0x6c6f66)); this.assets.registerFallback("torch", box(0.7, 2.4, 0.7, 0x8a6b45));
    this.assets.registerFallback("coin", () => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24), new THREE.MeshStandardMaterial({ color: 0xffc928, metalness: .8, roughness: .3 })); m.rotation.x = Math.PI / 2; g.add(m); return g; });
    this.assets.registerFallback("enigma", () => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.18, 12, 28), new THREE.MeshStandardMaterial({ color: 0xffb020, metalness: .8, roughness: .3 })); g.add(m); return g; });
    this.assets.registerFallback("board", box(11, 4, 0.4, 0x6a4a2a));
  }

  async _loadCharacter(key, first = false) {
    await this.assets.load(key);
    if (!this.assets.has(key)) throw new Error(`Character "${key}" could not be loaded`);
    if (first) {
      this.player = new PlayerController({ scene: this.scene, logger: this.logger });
      this.player.events.addEventListener("jump", () => { this.audio.play("jump"); this.tutorial.notify("jump"); });
      this.player.events.addEventListener("slide", () => { this.audio.play("slide"); this.tutorial.notify("slide"); });
      this.player.events.addEventListener("lane", () => { this.audio.play("lane"); this.tutorial.notify("lane"); });
    }
    const model = this.assets.instantiate(key);
    this.player.setCharacter(model, this.assets.cloneClips(key), key);
    this.characterKey = key;
    this.log(`Character loaded: ${ASSET_REGISTRY[key].label}`);
  }

  _buildWorld() {
    const groundTex = makeGroundTexture();
    this.track = new EndlessTrackManager({ scene: this.scene, assets: this.assets, groundTexture: groundTex, logger: this.logger });
    this.env = new EnvironmentManager({ scene: this.scene, assets: this.assets, track: this.track, quality: this.quality, runSeed: this.runSeed });
    this.collectibles = new CollectibleManager({ scene: this.scene, assets: this.assets });
    this.obstacles = new ObstacleManager({ scene: this.scene, assets: this.assets });
    this.director = new SpawnDirector({ track: this.track, collectibles: this.collectibles, obstacles: this.obstacles, runSeed: this.runSeed });
    this.questions = new QuestionManager({ scene: this.scene, assets: this.assets, track: this.track, runSeed: this.runSeed, logger: this.logger, getConfig: () => ({ subjects: this.override.subjects || this.profile.settings.subjects, grade: this.override.grade || this.profile.settings.grade }) });
    this.collision = new CollisionManager({ native: this.native });
    this.power = new PowerUpManager({ playerGroup: this.player.group }); this.comboTimer = 0;
    this.fx = new FxManager({ scene: this.scene, native: this.native });
    const bc = document.createElement("canvas"); bc.width = bc.height = 64; const bg = bc.getContext("2d"); const gr = bg.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(0.6, "rgba(0,0,0,.28)"); gr.addColorStop(1, "rgba(0,0,0,0)"); bg.fillStyle = gr; bg.fillRect(0, 0, 64, 64);
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), transparent: true, depthWrite: false, fog: false }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.03; this.blob.renderOrder = 2; this.blob.name = "BlobShadow"; this.scene.add(this.blob);
    this.questions.on("question", (q) => { const loc = localizeQuestion(q, t, i18n.lang); this.hud.banner(loc.story || loc.text); this.audio.play("question"); this.speaker.speak(loc.spokenStory || loc.spoken); this._beginReading(loc); });
    this.questions.on("answer", (r) => this._onAnswer(r));
    this.questions.on("zone-end", () => this.hud.banner(""));
    this.ambient = new AmbientFx({ scene: this.scene, native: this.native });
    const params = this.params;
    this.biome = new BiomeManager({ scene: this.scene, sky: this.sky, hemi: this.hemi, sun: this.sun, renderer: this.renderer, groundMat: this.track.groundMat, env: this.env,
      onEnter: (b) => { if (this.state === "playing") { this.hud.toast(t(`biome.${b.id}`), "gold", 2200); this.log(`Entering biome: ${b.name}`); } } });
    this.track.init(); this.applyAccessibility(); this.refreshMenuStats();
    this.debug = new DebugPanel({ game: this }); if (params.get("tools") === "1") this.debug.open();
    this.player.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  _bindInput() {
    const $b = (id) => document.getElementById(id);
    this.input = new InputController({
      canvas: this.canvas, buttons: { left: $b("tLeft"), right: $b("tRight"), jump: $b("tJump"), slide: $b("tSlide") },
      actions: {
        moveLane: (d) => this.state === "playing" && this.player.moveLane(d),
        jump: () => this.state === "playing" && this.player.jump(),
        slide: () => this.state === "playing" && this.player.slide(),
        togglePause: () => this.togglePause(),
        pauseWhenHidden: () => { if (this.state === "playing") this.pause(); },
        ready: () => { if (this.state === "menu" || this.state === "gameover") { this.requestStart(); return true; } return false; },
      },
    });
    this.input.bind();
    window.addEventListener("keydown", (e) => {
      if (e.key === "F2") this.toggleLab();
      else if ((e.key === "m" || e.key === "M") && !e.repeat) this.audio.toggleMute();
    });
    const unlock = () => this.audio.unlock();
    ["pointerdown", "keydown", "touchstart"].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
  }

  /* ------------------------------------------------------------- lifecycle */
  async chooseCharacter(key) {
    if (key === this.characterKey || !ASSET_REGISTRY[key]) return;
    this.hud.toast(t("t.loading"), "good", 800);
    await this._loadCharacter(key);
    this.profile.set("character", key);
    this.player.reset();
  }

  /** The Play buttons and the Enter key come through here, so the "3 free runs" gate (set by the page) can stop a run. */
  async requestStart() {
    if (this._gating) return false; this._gating = true;
    try { if (this.playGate && !(await this.playGate())) return false; this.start(); return true; } finally { this._gating = false; }
  }

  start() {
    this.tutorial.active = false; this.hud.coach("");
    this._resetRun();
    this.hud.show("menu", false); this.hud.show("gameOver", false); this.hud.show("pause", false); this.hud.show("over", false); this.hud.show("hud", true);
    this.state = "playing"; this.player.startRun(); this.speed = GAME.baseSpeed * 0.6; this.teacher?.onRunStart();
    this.audio.setMood("run"); this.audio.startMusic(); this.audio.play("click");
    if ((this.params.get("tutorial") === "1" || !this.profile.data.tutorialDone) && this.params.get("notutorial") !== "1") {      // first run: guided, no obstacles / questions yet
      this.director.enabled = false; this.questions.hold(true); this.tutorial.start(); this.log("Tutorial started");
    }
    this.log("Run started");
  }

  _resetRun() {
    this.reading = null; this.hud.reading(false); this.hud.teacherChip("");            // a new run never starts inside an old question pause
    this.runSeed = (Math.random() * 1e9) | 0;
    if (this.params.get("seed")) this.runSeed = Number(this.params.get("seed")) | 0;
    this.stats = this._freshStats(); this.speed = 0; this.review = []; this.runAchievements = []; this.achTimer = 0; this.hitMark = 0; this.subjectsRight = new Set(); this.speaker.cancel();
    this.env.runSeed = this.runSeed; this.director.enabled = false;
    this.questions.reset(this.runSeed); this.director.reset(this.runSeed);
    this.player.reset(); this.fx.burst(0, -999, 0, 0); this.power.reset(); this.comboTimer = 0; this.teacher?.reset();
    this.track.reset();
    this.director.enabled = true;
    // Populate the visible road now (initial segments were spawned before the director was enabled).
    this.track.segments.forEach((s) => this.director.onSegment(s));
    this.hud.banner(""); this.cameraRig.snap(this.player); this.biome.update(this.biomeOffset, true);
  }

  pause() { if (this.state === "playing") { this.state = "paused"; this.hud.show("pause", true); this.audio.suspend(); } }
  resume() { if (this.state === "paused") { this.state = "playing"; this.hud.show("pause", false); this.lastTs = performance.now(); this.audio.resume(); } }
  togglePause() { this.state === "playing" ? this.pause() : this.resume(); }

  _gameOver() {
    this.state = "gameover"; this.teacher?.onGameOver();
    const s = this.stats; const score = Math.floor(s.score);
    // Evaluate with games+1 / lifetime coins before merging the run, so 'First Steps' and totals are exact.
    const before = { ...this.profile.data, games: this.profile.data.games + 1 };
    for (const id of evaluateAchievements(s, before)) if (this.profile.unlockAchievement(id)) this.runAchievements.push(id);
    const rec = this.profile.recordRun(s); const newBest = rec.newBest; const best = rec.best;
    this.refreshMenuStats();
    this.hud.el.overStats.innerHTML = `<div><b>${score}</b><span>${t("over.score")}${newBest ? " " + t("over.newbest") : ""}</span></div><div><b>${s.coins}</b><span>${t("over.coins")}</span></div><div><b>${s.tokens}</b><span>${t("over.tokens")}</span></div><div><b>${Math.floor(s.distance)} m</b><span>${t("over.distance")}</span></div><div><b>${s.correct}/${s.correct + s.wrong}</b><span>${t("over.right")}</span></div>`;
    this._renderReview();
    this.hud.show("over", true); this.hud.banner("");
    if (s.correct >= 3) this.player.celebrate(); else this.player.idle();
    this.audio.stopMusic(1.4); this.audio.play(s.correct >= 3 ? "victory" : "gameover");
    this.events.dispatchEvent(new CustomEvent("gameover", { detail: { ...s, best } }));
  }

  /* -------------------------------------------------------------- gameplay */
  onSpecialToken(handler) { this.specialHandlers.push(handler); }

  _defaultSpecial() {
    this.stats.tokens++; this.stats.score += GAME.enigmaValue;
    const id = this.power.grant(); this.stats.powerUps++;
    const info = POWERUPS[id];
    this.hud.toast(`${info.icon} ${t(`pu.${id}.label`)}! ${t(`pu.${id}.blurb`)}`, "gold", 2400);
    this.audio.play("powerup");
    this.fx.burst(this.player.x, 1.0, 0, 30, { color: new THREE.Color(info.color).getHex(), speed: 4, up: 3, life: 0.9 });
    return id;
  }

  _collect(item) {
    const p = this.player;
    if (item.kind === "coin") {
      this.tutorial.notify("coin"); this.stats.coins++; this.comboTimer = 1.3; this.stats.combo++; this.stats.bestCombo = Math.max(this.stats.bestCombo, this.stats.combo);
      this.stats.score += (GAME.coinValue + 2 * Math.floor(this.stats.combo / 5)) * this.power.coinMultiplier(); this.audio.play("coin"); if (this.stats.combo % 5 === 0) this.teacher?.event("coins5");
      this.fx.burst(item.x, item.y, 0, 7, { color: 0xffd34a, speed: 2.2, up: 2.4, life: 0.5 });
    } else {
      this.fx.burst(item.x, item.y, 0, 34, { color: 0xffc23a, speed: 4.5, up: 3.5, life: 0.9 });
      this._defaultSpecial(); this.audio.play("enigma"); this.teacher?.event("enigma");
      for (const h of this.specialHandlers) { try { h({ game: this, item }); } catch (e) { this.logger.error?.(TAG, "special handler failed", e); } }
      this.events.dispatchEvent(new CustomEvent("special-token", { detail: { x: item.x } }));
    }
    this.collectibles.release(item);
    this.events.dispatchEvent(new CustomEvent("collect", { detail: { kind: item.kind } }));
    return p;
  }

  _loseLife(reason) {
    if (this.god) return false;                      // test tools: god mode
    if (this.player.alive && this.player.invulnerable <= 0 && this.power.consumeShield()) {     // shield absorbs the mistake
      this.player.invulnerable = 1.1; this.stats.combo = 0;
      this.fx.burst(this.player.x, 0.9, 0, 26, { color: 0x66ccff, speed: 4.5, up: 2, life: 0.7 });
      this.audio.play("shield"); this.hud.toast(t("t.shield"), "good", 1600); this.teacher?.event("shield");
      this.events.dispatchEvent(new CustomEvent("shield-block", { detail: { reason } }));
      return false;
    }
    if (!this.player.hit()) return false;
    this.stats.combo = 0; this.hitMark = this.stats.distance;
    this.stats.lives--; this.stats.hits++; this.stats.streak = 0;
    this.fx.burst(this.player.x, 0.8, 0, 16, { color: 0xff8a5a, speed: 3, up: 1.5, life: 0.5 });
    this.audio.play("hit"); this.vibrate(70);
    if (this.stats.lives <= 0) { this.player.die(); this.dying = 1.7; }
    if (reason !== "wrong-answer") this.teacher?.onHit(reason);            // a stumble: she runs up behind him; a second stumble while she is close: she grabs him
    this.events.dispatchEvent(new CustomEvent("hit", { detail: { reason } }));
    return true;
  }

  _onAnswer(r, opts = {}) {
    const s = this.stats;
    const loc = localizeQuestion(r.question, t, i18n.lang);
    this.review.push({ text: loc.text, subject: r.subject, chosen: r.chosenLabel, correct: r.correctLabel, ok: r.correct, explanation: loc.explanation });
    (s.tally[r.subject] ||= { right: 0, wrong: 0 })[r.correct ? "right" : "wrong"]++;
    this.vibrate(r.correct ? 25 : 90);
    if (r.correct) { this.subjectsRight.add(r.subject); s.subjectsRight = this.subjectsRight.size; }
    else this.speaker.speak(t("sp.answer", { x: r.correctLabel }));
    if (r.correct) {
      this.teacher?.event("correct"); s.correct++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); s.score += GAME.correctAnswerValue;
      this.fx.burst(this.player.x, 1.2, 0, 50, { color: 0x6dff9a, speed: 5, up: 4, life: 1.1 });
      this.hud.toast(t("t.correct"), "good"); this.audio.play("correct");
      for (let lane = 0; lane < 3; lane++) for (let i = 0; i < 5; i++) this.collectibles.spawn("coin", LANES[lane], 1.05, -9 - i * 1.8);
      if (s.streak % 3 === 0 && s.lives < s.maxLives) { s.lives++; this.hud.toast(t("t.streak"), "gold", 2200); setTimeout(() => this.audio.play("lifeUp"), 450); }
    } else {
      s.wrong++; this.audio.play("wrong");
      if (!opts.noPenalty) { const lost = this._loseLife("wrong-answer"); if (lost && this.player.alive && this.stats.lives > 0) this.teacher?.onWrong(r); }       // she grabs him only when a heart really went (a shield or protection saves him from her too)       // a wrong answer: she grabs him and shows the right answer
      if (!this.teacher?.enabled) this.hud.toast(t("t.wrong", { x: localizeQuestion(r.question, t, i18n.lang).explanation }), "bad", 2400);
    }
    setTimeout(() => this.hud.banner(""), 2200);
    this.events.dispatchEvent(new CustomEvent("answer", { detail: r }));
  }

  _targetSpeed() {
    const base = Math.min(GAME.maxSpeed, GAME.baseSpeed + this.stats.distance * GAME.speedPerMeter);
    return base * this.questions.speedFactorNow * this.speedMultiplier * this.power.speedFactor();
  }

  /** One simulation step (also driven by tests via advance()). */
  /* ---------------------------------------------------------------- reading time: the runner waits while the question is read */
  _beginReading(loc) {
    if (this.state !== "playing" || this.tutorial.active || !this.player.alive) return;
    const mode = this.params.get("readtime") || this.profile.settings.readTime;                  // ?readtime=off|ready|short|normal|long overrides the saved choice (demos, tests)
    const secs = readSeconds((loc.spokenStory || loc.text || "").length, this.profile.settings.grade, mode); if (secs <= 0) return;
    const timed = Number.isFinite(secs);                                                      // "ready" mode: no clock, he waits until the child taps Ready!
    this.reading = { left: secs, total: secs, timed, say: loc.spokenStory || loc.spoken }; this.player.state = "idle"; this.player.anim?.play("IDLE", { fade: 0.25 }); this.teacher?.hideBubble(); this.hud.teacherChip("");
    this.hud.reading(true, 0, timed ? t("q.reading", { s: Math.ceil(secs) }) : t("q.reading.ready"), timed); this.audio.setMood("quiz"); this.events.dispatchEvent(new CustomEvent("reading", { detail: { seconds: secs } }));
  }
  /** "Ready!" (button, Enter or Space): start before the time is over */
  skipReading() { if (this.reading) this._endReading(); }
  /** "Listen": say the question aloud again (even when "read aloud" is off in Settings) */
  listenReading() { if (this.reading?.say) this.speaker.speak(this.reading.say, true); }
  _endReading() {
    if (!this.reading) return; this.reading = null; this.hud.reading(false);
    if (this.player.alive) { this.player.startRun(); this.player.invulnerable = Math.max(this.player.invulnerable, 1.0); this.speed = Math.max(this.speed, GAME.baseSpeed * 0.5); }
    this.audio.setMood("run"); this.lastTs = performance.now();
  }
  _stepReading(dt) {
    const r = this.reading, p = this.player; if (r.timed) r.left -= dt; this.speed *= Math.exp(-7 * dt);
    p.update(dt, 0); this.env.update(dt); this.fx.update(dt, 0); this.ambient.update(dt, 0, this.biome.state.fireflies, this.reducedMotion); this.teacher?.update(dt, { hold: true });
    if (r.timed) { this.hud.reading(true, 1 - Math.max(0, r.left) / r.total, t("q.reading", { s: Math.max(1, Math.ceil(r.left)) }), true); if (r.left <= 0) this._endReading(); }
  }
  /** back to the start screen (from "Great run!" or the pause screen) */
  toMenu() {
    if (this.state !== "gameover" && this.state !== "paused") return; this.reading = null; this.hud.reading(false);
    for (const s of ["over", "gameOver", "pause", "hud"]) this.hud.show(s, false); this.hud.banner(""); this.hud.teacherChip(""); this._resetRun();
    this.state = "menu"; this.audio.setMood("quiz"); this.hud.show("menu", true); this.events.dispatchEvent(new CustomEvent("menu"));
  }

  step(dt) {
    const p = this.player;
    if (this.state === "playing" && this.reading) { this._stepReading(dt); }
    else if (this.state === "playing") {
      const target = this._targetSpeed();
      this.speed += (target - this.speed) * (1 - Math.exp(-3 * dt));
      const dz = this.speed * dt;
      this.stats.distance += dz; this.stats.score += dz * GAME.distanceScore;
      this.stats.noHitDistance = this.stats.distance - this.hitMark;
      this._tickTrail(dt); this._tickAchievements(dt);
      if (this.tutorial.active) this.tutorial.update(dt);
      this.power.update(dt);
      this.stats.multiplier = this.power.coinMultiplier(); this.stats.multiplierLeft = this.power.remaining("double"); this.stats.power = this.power.list();
      if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.stats.combo = 0; }
      if (this.power.has("magnet")) this.collectibles.attract(p.x, p.y, dt);
      p.update(dt, this.speed);
      if (this.teacher) { const hold = this.tutorial.active || !this.director.enabled; this.teacher.update(dt, { hold }); }
      this.audio.setSpeed(this.speed); this.audio.setMood(this.questions.active && -this.questions.padZ < 90 ? "quiz" : "run");
      this.track.update(dz); this.collectibles.update(dt, dz); this.obstacles.update(dz); this.questions.update(dt, p);
      this.fx.update(dt, dz); this.env.update(dt, p.x);
      this.biome.update(this.stats.distance + this.biomeOffset); this.ambient.update(dt, dz, this.biome.state.fireflies, this.reducedMotion);
      this._speedLines();
      for (const it of this.collision.collectibles(p, this.collectibles.active, this.speed, dt)) this._collect(it);
      if (p.alive) { const o = this.collision.obstacle(p, this.obstacles.active); if (o) this._loseLife(o.kind); }
      if (!p.alive) { this.dying -= dt; if (this.dying <= 0) this._gameOver(); }
    } else if (this.state === "rescue") {                       // the teacher caught up: the world waits while the child answers
      this.speed *= Math.exp(-6 * dt); p.update(dt, 0); this.env.update(dt); this.fx.update(dt, 0); this.ambient.update(dt, 0, this.biome.state.fireflies, this.reducedMotion); this.teacher.update(dt, { hold: true });
    } else if (this.state === "gameover") {
      this.speed *= Math.exp(-4 * dt); p.update(dt, this.speed); this.env.update(dt); this.ambient.update(dt, this.speed * dt, this.biome.state.fireflies, this.reducedMotion);
      const dz = this.speed * dt; this.track.update(dz); this.collectibles.update(dt, dz); this.obstacles.update(dz); this.fx.update(dt, dz); this.teacher?.update(dt, { hold: true });
    } else if (this.state === "menu") {
      p.update(dt, 0); this.env.update(dt); this.fx.update(dt, 0); this.teacher?.setVisible(false); this.ambient.update(dt, 0, this.biome.state.fireflies, this.reducedMotion); this.audio.setMood("quiz");   // calm music on the menu
    }
    this.cameraRig.update(dt, p, this.speed);
    this.sky.position.copy(this.camera.position);
    if (this.blob) { this.blob.visible = this.quality.blob && this.state !== "boot"; this.blob.position.x = this.player.x; const k = 1 - Math.min(0.55, this.player.y / 3); this.blob.scale.setScalar(k); this.blob.material.opacity = k; }
    this.hud.update(this.stats);
  }

  /** Deterministic fast-forward for automated tests: simulates without rendering. */
  advance(seconds, stepDt = 1 / 60) { for (let t = 0; t < seconds; t += stepDt) this.step(stepDt); }

  /* ---------------------------------------------------------------- render */
  _frame(ts) {
    const raw = (ts - this.lastTs) / 1000; this.lastTs = ts;
    const dt = Math.min(0.05, Math.max(0, raw));
    this.frameMs = raw * 1000; if (this.frameSamples && raw > 0 && raw < 1) this.frameSamples.push(raw * 1000);
    const pa = performance.now();
    if (this.state !== "paused" && this.state !== "boot" && !this.fixedStep) this.step(dt);
    const pb = performance.now();
    this.fpsAcc += raw; this.fpsN++;
    if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; if (this.labEl) this.labEl.update?.(); }
    if (this.state === "playing") {
      if (this.drsEnabled && !this.fixedStep && raw > 0) {
        this.drs.push(raw * 1000); const r = this.drs.tick(ts); if (r !== null) { this.renderScale = r; this.resize(); }
        // Already at the lowest sharpness and still slow for several seconds: this level is too heavy right now -> one level down.
        if (this.autoGraphics && this.renderScale <= 0.55 && this.drs.ema > 40) { this.slowFor = (this.slowFor || 0) + raw; if (this.slowFor > 5 && tierIndex(this.qualityId) > 0) { this.slowFor = 0; this.renderScale = 1; this.drs.reset(); this.drs.ema = null; this._applyQuality(QUALITY[stepDown(this.qualityId)]); this.log(`Too slow even at reduced sharpness: dropped to ${this.qualityId}`); } } else this.slowFor = 0;
      }
    }
    if (this.lab && this.orbit) this.orbit.update();
    const pc = performance.now();
    this.renderer.render(this.scene, this.camera);
    const pd = performance.now(); const P = this.prof; P.n++; P.logic += pb - pa; P.misc += pc - pb; P.render += pd - pc; P.frame += raw * 1000;
  }

  /** Where does a frame go?  logic = game update (JS / C / C++), render = CPU time to submit the draw calls; the rest of the frame is the GPU working. */
  frameProfile(reset = false) { const P = this.prof, n = Math.max(1, P.n); const r = { frames: P.n, logicMs: +(P.logic / n).toFixed(3), renderSubmitMs: +(P.render / n).toFixed(3), frameMs: +(P.frame / n).toFixed(2) }; r.gpuOrWaitMs = +Math.max(0, r.frameMs - r.logicMs - r.renderSubmitMs).toFixed(2); r.logicShare = +(100 * r.logicMs / Math.max(0.001, r.frameMs)).toFixed(2); if (reset) this.prof = { n: 0, logic: 0, misc: 0, render: 0, frame: 0 }; return r; }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth || window.innerWidth), h = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    // Render size = the display's native size, capped by this level's pixel budget (4K / 2K / Full HD / HD / 540p), times the adaptive scale.
    const dpr = window.devicePixelRatio || 1; const nat = this.probe || { w: w * dpr, h: h * dpr };
    const rs = renderSizeFor(this.qualityId, nat.w, nat.h, this.facts?.maxTexture || 8192);
    const bw = Math.max(1, Math.round(rs.w * this.renderScale)), bh = Math.max(1, Math.round(rs.h * this.renderScale));
    this.renderer.setPixelRatio(1); this.renderer.setSize(bw, bh, false); this.renderSizePx = { w: bw, h: bh };
    this.cameraRig.setAspect(w / h);
  }

  _applyQuality(q) {
    this.quality = q; this.qualityId = q.id;
    this.renderer.shadowMap.enabled = q.shadows; this.sun.castShadow = q.shadows;
    this.sun.shadow.mapSize.set(q.shadowMap, q.shadowMap); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
    this.env?.setQuality(q); this.teacher?.applyQuality(q);
    if (this.biome) this.biome.viewScale = q.view;
    this.camera.far = 125 * q.view + 6; this.camera.updateProjectionMatrix(); this.sky.scale.setScalar(Math.min(1, q.view * 0.95));
    this.drs.setMax(1); this.renderScale = Math.min(this.renderScale, 1); if (this.blob) this.blob.visible = q.blob;
    const sc = this.sun.shadow.camera; sc.left = -13 * q.shadowSpan; sc.right = 13 * q.shadowSpan; sc.top = 20 * q.shadowSpan; sc.bottom = -16 * q.shadowSpan; sc.far = 50 * q.shadowSpan; sc.updateProjectionMatrix();
    this.assets?.setAnisotropy?.(q.aniso); if (this.ambient) this.ambient.points.visible = q.ambient;
    this.events.dispatchEvent(new CustomEvent("quality-changed", { detail: { tier: q.id } }));
    this.resize();
    this.log(`Quality tier: ${q.id}`);
  }

  /** Settings -> Graphics: "auto" (the analysed level for this device) or a fixed level. */
  setGraphics(value) {
    this.profile.set("graphics", value);
    this.autoGraphics = value === "auto"; this.renderScale = 1; this.drs.reset();
    this._applyQuality(QUALITY[this.autoGraphics ? this.deviceTier : value]);
    this.events.dispatchEvent(new CustomEvent("graphics-changed", { detail: { tier: this.qualityId } }));
  }

  /* ----------------------------------------------------------------- device calibration */
  /** Draw the real game scene for ~1.3 s at `tier`, at the display's native resolution, and measure the frame rate. */
  async measureTier(tier, ms = 1300) {
    this.renderScale = 1; this.probe = { w: this.facts.native.w, h: this.facts.native.h };
    this._applyQuality(QUALITY[tier]);
    const times = await new Promise((resolve) => {
      const out = []; let last = performance.now(); const t0 = last; let guard = setTimeout(() => resolve(out), ms + 2500);
      const tick = (now) => {
        out.push(now - last); last = now; this.step(1 / 60); this.renderer.render(this.scene, this.camera);
        if (now - t0 < ms) requestAnimationFrame(tick); else { clearTimeout(guard); resolve(out); }
      };
      requestAnimationFrame(tick);
    });
    this.probe = null;
    if (times.length === 0 || document.hidden) return { frames: 0, avgFps: 0, p95Ms: 0 };
    const body = times.length >= 20 ? times.slice(8) : times.slice(Math.min(2, times.length - 1));       // skip the warm-up (shader compile) frames
    const sorted = [...body].sort((a, b) => a - b); const avg = body.reduce((a, b) => a + b, 0) / body.length;
    const m = { frames: Math.max(body.length, body.length >= 3 ? 8 : 0), avgFps: +(1000 / avg).toFixed(1), p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1), slow: body.length < 8 };
    return m;
  }

  /**
   * Pick the best level for this device by testing it for real. Skipped (the safe starting level stays) when the player chose a
   * level, a result for this exact device is cached, the tab is hidden, or only a software renderer exists (use ?calibrate=1 to force).
   */
  async calibrate({ force = false, measure = null } = {}) {
    const skip = !force && (!this.autoGraphics || this.cached || this.params.get("calibrate") === "0" || document.hidden
      || (this.gpuClass === "software" && this.params.get("calibrate") !== "1") || (this.sandbox && this.params.get("calibrate") !== "1"));
    if (skip) { this.calibration = this.cached || null; return this.calibration; }
    const startTier = this.device.start; const refreshHz = this.facts.refreshHz;
    const result = await calibrateTiers({
      start: startTier, cap: this.device.cap, refreshHz, measure: measure || ((tier) => this.measureTier(tier)),
      onProbe: (tier, i, n) => this.hud.device(t("load.probe", { tier: t(`gfx.${tier}`), i, n })),
    });
    this.renderScale = 1; this.probe = null; this.drs.reset();
    this.deviceTier = result.tier;
    const record = { signature: this.signature, tier: result.tier, conclusive: result.conclusive, probes: result.probes.map((p) => ({ tier: p.tier, avgFps: p.avgFps, p95Ms: p.p95Ms, pass: p.pass })), date: new Date().toISOString(), gpu: this.gpu, native: this.facts.native, version: DEVICE_MODEL_VERSION };
    if (result.conclusive) writeDeviceCache(this.store, record);
    this.calibration = record;
    if (this.autoGraphics) this._applyQuality(QUALITY[result.tier]); else this.resize();
    this.hud.device(t("load.picked", { tier: t(`gfx.${result.tier}`) }));
    this.log(`Calibration: ${result.probes.map((p) => `${p.tier} ${p.avgFps} fps${p.pass ? " OK" : " too slow"}`).join(" | ")} -> ${result.tier}`);
    return record;
  }

  /** Settings -> "Analyse this device again". */
  async retestDevice() {
    clearDeviceCache(this.store); this.cached = null; this.profile.set("graphics", "auto"); this.autoGraphics = true;
    this.hud.toast(t("dev.retesting"), "good", 6000);
    const wasState = this.state; this.state = "menu";
    const rec = await this.calibrate({ force: true }); this.state = wasState; this.resize();
    this.hud.toast(t("load.picked", { tier: t(`gfx.${this.qualityId}`) }), "gold", 3000);
    this.events.dispatchEvent(new CustomEvent("graphics-changed", { detail: { tier: this.qualityId } }));
    return rec;
  }

  /** Everything the Settings / Hub "Your device" panel shows. */
  deviceInfo() {
    const f = this.facts, rs = this.renderSizePx || {};
    return { gpu: this.gpu, gpuClass: this.gpuClass, native: f.native, dpr: f.dpr, ram: f.deviceMemory, cores: f.cores, refreshHz: f.refreshHz, cap: this.device.cap, start: this.device.start, tier: this.qualityId, auto: this.autoGraphics, deviceTier: this.deviceTier, renderW: rs.w, renderH: rs.h, calibration: this.calibration || this.cached || null, reasons: this.device.reasons, engine: this.native ? "native" : "js" };
  }

  /** Compile every shader and upload every texture now, so nothing stutters the first time it appears in a run. */
  prewarm() {
    const t0 = performance.now(); const hidden = [];
    this.scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    try {
      this.renderer.compile(this.scene, this.camera);
      this.scene.traverse((o) => { if (o.isMesh || o.isPoints) for (const m of [].concat(o.material)) for (const k of ["map", "normalMap", "metalnessMap", "roughnessMap", "emissiveMap"]) if (m?.[k]) this.renderer.initTexture(m[k]); });
    } catch (e) { this.logger.warn?.(TAG, "prewarm skipped:", e.message); }
    for (const o of hidden) o.visible = false;
    this.log(`Shaders and textures prepared in ${Math.round(performance.now() - t0)} ms`);
  }

  async toggleLab() {
    this.lab = !this.lab;
    if (this.lab && !this.orbit) {
      const { OrbitControls } = await import("/vendor/three-addons/controls/OrbitControls.js");
      this.orbit = new OrbitControls(this.camera, this.canvas); this.orbit.target.set(0, 1.2, -4); this.orbit.enableDamping = true;
    }
    if (this.orbit) this.orbit.enabled = this.lab;
    if (this.lab && this.state === "menu") this.labView("front");   // after OrbitControls exists, so its target is set too
    this.cameraRig.enabled = !this.lab;
    document.body.classList.toggle("lab", this.lab);
  }

  /** Real-time FPS sampling for the self-check benchmark. */
  startFrameSampling() { this.frameSamples = []; }
  stopFrameSampling() {
    const f = (this.frameSamples || []).slice(5); this.frameSamples = null;            // ignore the first frames (shader warm-up)
    if (!f.length) return { frames: 0, avgFps: 0, minFps: 0, p95Ms: 0 };
    const sorted = [...f].sort((a, b) => a - b); const avg = f.reduce((a, b) => a + b, 0) / f.length;
    return { frames: f.length, avgFps: +(1000 / avg).toFixed(1), minFps: +(1000 / sorted[sorted.length - 1]).toFixed(1), p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1) };
  }
  /** Test/automation helpers: stop the RAF loop, then step + render on demand and grab the canvas. */
  stopLoop() { this.renderer.setAnimationLoop(null); this.fixedStep = true; }
  startLoop() { this.fixedStep = false; this.lastTs = performance.now(); this.renderer.setAnimationLoop((ts) => this._frame(ts)); }
  renderOnce() { if (this.lab && this.orbit) this.orbit.update(); this.renderer.render(this.scene, this.camera); return this.canvas.toDataURL("image/png"); }

  /* --------------------------------------------------- profile, rewards, access */
  /* ------------------------------------------------------------ test tools */
  setBiome(index) { this.biomeOffset = index * BIOME_LENGTH - this.stats.distance; this.biome.update(this.stats.distance + this.biomeOffset, true); this.hud.toast(t(`biome.${BIOMES[index].id}`), "gold", 1500); }
  /** Put something in front of the player: coin | enigma | rock | beam | coins (three lanes). */
  devSpawn(kind) {
    const x = LANES[this.player.laneIndex];
    if (kind === "coin") for (let i = 0; i < 6; i++) this.collectibles.spawn("coin", x, 1.05, -12 - i * 1.6);
    else if (kind === "coins") for (let l = 0; l < 3; l++) for (let i = 0; i < 4; i++) this.collectibles.spawn("coin", LANES[l], 1.05, -12 - i * 1.7);
    else if (kind === "enigma") this.collectibles.spawn("enigma", x, 1.25, -14);
    else if (kind === "rock") this.obstacles.spawn("rock", x, -16);
    else if (kind === "beam") this.obstacles.spawn("beam", x, -16);
  }
  /** Make the next question board appear soon, optionally from one subject. */
  forceQuestion(subject = null) {
    this.override.subjects = subject && subject !== "mixed" ? [subject] : null;
    this.questions.held = false; const q = this.questions;
    if (!q.seg) { this.track.reserved.delete(q.nextIndex); q.nextIndex = this.track.maxIndex + 2; this.track.reserved.add(q.nextIndex); }
  }
  unlockEverything() {
    const d = this.profile.data; d.totalCoins = Math.max(d.totalCoins, 1000);
    import("./achievements.js").then(({ ACHIEVEMENTS }) => { for (const a of ACHIEVEMENTS) d.achievements[a.id] ||= Date.now(); this.profile.save(); this.refreshMenuStats(); });
    this.profile.save(); this.refreshMenuStats();
  }
  vibrate(ms) { if (!this.reducedMotion) try { navigator.vibrate?.(ms); } catch { /* unsupported */ } }
  _coach(step, index, total) {
    this.hud.coach(this.touch && i18n.lang && `coach.${step.id}.t` in STRINGS.en ? t(`coach.${step.id}.t`) : t(`coach.${step.id}`), `${index + 1}/${total}`);
    if (step.id === "coin") for (let lane = 0; lane < 3; lane++) for (let k = 0; k < 5; k++) this.collectibles.spawn("coin", LANES[lane], 1.05, -13 - k * 1.8 - lane * 0.6);
  }
  _tutorialDone({ skipped }) {
    this.hud.coach(""); this.profile.markTutorialDone(); this.log(`Tutorial ${skipped ? "skipped" : "completed"}`);
    this.director.enabled = true; this.questions.hold(false);
    this.track.segments.forEach((seg) => { if (seg.group.position.z < -30) this.director.onSegment(seg); });   // fill the road ahead that was kept empty
  }
  skipTutorial() { this.tutorial.skip(); }
  _speedLines() {
    const el = this.speedEl ||= document.getElementById("speedLines"); if (!el) return;
    const o = this.reducedMotion ? 0 : Math.max(0, Math.min(1, (this.speed - 12) / 5)) * 0.4;
    if (Math.abs((this._sl ?? -1) - o) > 0.02) { this._sl = o; el.style.opacity = o.toFixed(2); }
  }
  _tickTrail(dt) {
    const t = TRAILS.find((x) => x.id === this.profile.settings.trail); if (!t || !t.color) return;
    this.trailTimer -= dt; if (this.trailTimer > 0) return; this.trailTimer = 0.035;
    const color = t.color === "rainbow" ? new THREE.Color().setHSL((performance.now() / 700) % 1, 0.9, 0.6).getHex() : t.color;
    this.fx.burst(this.player.x + (Math.random() - 0.5) * 0.3, 0.12 + Math.random() * 0.5 + this.player.y, 0.35, 1, { color, speed: 0.5, up: 0.5, life: 0.55 });
  }
  _tickAchievements(dt) {
    this.achTimer += dt; if (this.achTimer < 1) return; this.achTimer = 0;
    for (const id of evaluateAchievements(this.stats, this.profile.data)) {
      if (!this.profile.unlockAchievement(id)) continue; this.runAchievements.push(id);
      const a = achievementById(id); this.hud.toast(`${a.icon} ${t(`ach.${id}.t`)}!`, "gold", 2400); this.audio.play("lifeUp");
    }
  }
  _renderReview() {
    const missed = this.review.filter((r) => !r.ok);
    const rv = this.hud.el.overReview;
    if (rv) rv.innerHTML = this.review.length === 0 ? "" : (missed.length === 0
      ? `<h3>${t("rv.perfect")}</h3>`
      : `<h3>${t("rv.practise")}</h3>` + missed.slice(0, 5).map((r) => `<div class="rv"><b>${r.text}</b><span>${t("rv.chose", { a: `<i>${r.chosen}</i>`, b: `<u>${r.correct}</u>` })}</span><small>${r.explanation}</small></div>`).join(""));
    const ag = this.hud.el.overAch;
    if (ag) ag.innerHTML = this.runAchievements.length ? `<h3>${t("rv.ach")}</h3>` + this.runAchievements.map((id) => { const a = achievementById(id); return `<span class="ach">${a.icon} ${t(`ach.${id}.t`)}</span>`; }).join("") : "";
  }
  refreshMenuStats() {
    const d = this.profile.data; const el = this.hud.el.menuStats;
    if (el) el.textContent = d.games ? t("menu.stats", { best: d.best, coins: d.totalCoins, games: d.games }) : t("menu.welcome");
    this.events.dispatchEvent(new CustomEvent("profile-changed"));
  }
  /** Settings that need live effects (read-aloud, reduced motion, big text). */
  applyAccessibility() {
    const st = this.profile.settings;
    this.reducedMotion = st.reducedMotion ?? !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    this.speaker.enabled = !!st.tts;
    if (this.fx) this.fx.density = this.reducedMotion ? 0.3 : 1;
    if (this.cameraRig) this.cameraRig.reduceMotion = this.reducedMotion;
    document.body.classList.toggle("reduce-motion", this.reducedMotion);
    document.body.classList.toggle("bigtext", !!st.bigText); document.body.classList.toggle("touch", this.touch);
  }
  /** Switch the whole game to English / Hindi / Marathi, live. */
  setLanguage(lang) {
    this.profile.set("language", lang); i18n.set(detectLanguage(lang, "", "")); try { localStorage.setItem("lq_lang", lang); } catch { /* storage blocked */ }   // ... and back: the home page and the other pages follow
    this.speaker.lang = LANGS[i18n.lang].speech; i18n.apply(document); this.hud.last = {};
    this.refreshMenuStats(); this.questions?.draw?.(this.questions.feedback);
    if (this.questions?.question) { const l2 = localizeQuestion(this.questions.question, t, i18n.lang); this.hud.banner(l2.story || l2.text); }
    this.events.dispatchEvent(new CustomEvent("language-changed", { detail: { lang: i18n.lang } }));
  }
  setSetting(key, value) { if (key === "readTime") this.profile.set("readTimeChosen", true); this.profile.set(key, value); if (key === "readTime" && this.reading && value === "off") this.skipReading(); if (key === "teacherChase") this.teacher?.setEnabled(!!value); this.applyAccessibility(); if (key === "tts" && value) this.speaker.speak(t("sp.on")); }

  /* ---------------------------------------------------------- Lab: characters */
  labCharacters() { return ["boy", "girl"].map((k) => ({ key: k, label: ASSET_REGISTRY[k].label, active: k === this.characterKey })); }
  async labSelectCharacter(key) { await this.chooseCharacter(key); this.labView("front"); this.player.state = "idle"; this.player.anim?.play("IDLE"); }
  labClips() { return this.player.anim ? this.player.anim.listClips() : []; }
  labPlay(name, opts) { if (this.state !== "menu") this.log("Lab clips play best from the menu screen"); return this.player.labPlay(name, opts); }
  labStop() { this.player.reset(); }
  labRigInfo() {
    const info = this.assets.info(this.characterKey) || {}; const d = this.player.anim?.describe() || {};
    return { character: this.characterKey, triangles: info.tris, heightM: info.size?.[1], file: info.url, rootBone: d.rootBone, clips: info.animations, jump: d.jumpPhases, rootMotion: d.rootMotion };
  }
  /** Orbit-camera presets around the character: front shows the face, back is the in-game view. */
  labView(preset = "front") {
    const t = new THREE.Vector3(this.player.x, 0.95, 0); const d = { front: [0, 1.2, -3.6], back: [0, 1.6, 4.2], side: [4, 1.2, 0], top: [0.01, 5, 0.01] }[preset] || [0, 1.2, -3.6];
    this.camera.position.set(t.x + d[0], d[1], t.z + d[2]); if (this.orbit) { this.orbit.target.copy(t); this.orbit.update(); } else this.camera.lookAt(t);
  }

  snapshot() {
    const p = this.player;
    return {
      biome: this.biome?.name, power: this.power.list().map((p) => p.id), state: this.state, character: this.characterKey, lane: p.laneIndex, x: +p.x.toFixed(3), y: +p.y.toFixed(3), playerState: p.state, anim: p.anim?.currentAlias,
      speed: +this.speed.toFixed(2), ...this.stats, fps: this.fps, quality: this.qualityId, renderScale: this.renderScale, gpu: this.gpu, gpuClass: this.gpuClass, device: { cap: this.device?.cap, start: this.device?.start, tier: this.deviceTier }, renderPx: this.renderSizePx, teacher: this.teacher ? { closeness: +this.teacher.brain.closeness.toFixed(2), state: this.teacher.brain.state, rescues: this.teacher.brain.catches, model: !!this.teacher.group } : null, native: !!this.native, frameProfile: this.frameProfile(),
      track: this.track.continuity(), segmentsRecycled: this.track.recycledTotal,
      activeCoins: this.collectibles.active.filter((c) => c.kind === "coin").length, activeEnigma: this.collectibles.active.filter((c) => c.kind === "enigma").length,
      activeObstacles: this.obstacles.active.length, zone: this.questions.hasZone ? { state: this.questions.state, text: this.questions.question?.text, boardZ: +this.questions.boardZ.toFixed(1) } : null,
      render: { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures },
    };
  }
}
