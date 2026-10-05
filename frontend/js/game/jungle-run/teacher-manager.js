import * as THREE from "three";
import { AnimationController } from "./animation-controller.js";
import { TeacherBrain } from "./teacher-brain.js";
import { generateQuestion, levelForProgress, pickSubject } from "./question-generator.js";
import { localizeQuestion } from "./question-i18n.js";
import { seededFor } from "./rng.js";
import { t, i18n } from "./i18n.js";

const SHAPES = ["\u25CF", "\u25B2", "\u25A0"];                      // circle / triangle / square: the same shapes and colours as the lanes on the question board

/**
 * The friendly teacher who runs behind the child, and asks the "rescue question" when she catches up.
 * She re-uses the already loaded Boy model (no extra download) dressed as a teacher: graduation cap, round glasses, a book in her hand.
 * Weak devices: on the "minimal" level there is no extra character; everything else (speech bubbles, rescue questions) still works.
 */
export class TeacherManager {
  constructor({ game }) {
    this.game = game; const p = game.profile.settings;
    this.brain = new TeacherBrain({ enabled: p.teacherChase !== false, gentle: p.grade === 1 ? 0.8 : 1, rng: () => Math.random() });
    this.group = null; this.anim = null; this.x = 0; this.off = 0; this.sign = -1; this.zNow = this.brain.k.safeZ; this.alias = ""; this.loading = null;
    this.q = null; this.answered = false; this.serial = 0; this.lastSubject = ""; this.bubbleTimer = 0; this.rescueResult = null;
    this._buildDom();
    window.addEventListener("keydown", (e) => this._key(e));
  }

  get enabled() { return this.brain.enabled; }
  setEnabled(v) { this.brain.setEnabled(v); if (!v) { this.setVisible(false); this.hideBubble(); } else if (this.game.state === "playing") this.setVisible(true); }

  /* ------------------------------------------------------------------ model */
  async load() {
    const g = this.game;
    if (this.group || this.loading) return this.loading;
    if (!g.quality.teacherModel) return null;
    this.loading = (async () => {
      try {
        await g.assets.load("boy"); if (!g.assets.has("boy")) return;
        const model = g.assets.instantiate("boy"); const clips = g.assets.cloneClips("boy");
        this._dress(model);
        model.traverse((o) => { if (o.isMesh) { o.castShadow = !!g.quality.shadows; o.receiveShadow = false; } });
        this.group = new THREE.Group(); this.group.name = "Teacher"; this.group.add(model); this.group.scale.setScalar(1.06); this.group.visible = false; g.scene.add(this.group);
        this.anim = new AnimationController(model, clips, { logger: g.logger, name: "teacher" });
        this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), g.blob.material); this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.03; this.blob.renderOrder = 2; this.blob.visible = false; g.scene.add(this.blob);
        g.log?.("Teacher loaded (Boy model + cap, glasses, book)");
      } catch (e) { g.logger.warn?.("[LearnQuest] teacher model unavailable:", e.message); } finally { this.loading = null; }
    })();
    return this.loading;
  }

  /** Cap on the head, round glasses on the face, a book in the right hand. Positions were measured on the Boy model (normalised to 1.7 m). */
  _dress(model) {
    model.updateMatrixWorld(true);
    const bone = (re) => { let r = null; model.traverse((o) => { if (!r && o.isBone && re.test(o.name)) r = o; }); return r; };
    const head = bone(/Head$/), hand = bone(/RightHand$/); if (!head) return;
    const tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3();
    const attach = (b, obj, pos, rot) => {                              // pos is in model space; the object then follows the bone
      const wp = new THREE.Vector3(...pos).applyMatrix4(model.matrixWorld); b.worldToLocal(wp); obj.position.copy(wp);
      obj.quaternion.copy(b.getWorldQuaternion(tmpQ).clone().invert().multiply(model.getWorldQuaternion(new THREE.Quaternion()))); if (rot) obj.quaternion.multiply(rot);
      obj.scale.setScalar(model.getWorldScale(tmpV).x / b.getWorldScale(new THREE.Vector3()).x); b.add(obj);
    };
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    // graduation cap
    const cap = new THREE.Group(); const navy = mat(0x1d2c5e), gold = mat(0xf5b301);
    const skull = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.23, 0.09, 20), navy); const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.028, 0.5), navy); board.position.y = 0.075; board.rotation.y = Math.PI / 4;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6), gold); cord.position.set(0.23, -0.03, 0.04); const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), gold); tuft.position.set(0.23, -0.14, 0.04);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), gold); knob.position.y = 0.1; cap.add(skull, board, cord, tuft, knob); attach(head, cap, [0.008, 1.645, 0.0]);
    // round glasses
    const glasses = new THREE.Group(); const frame = new THREE.MeshBasicMaterial({ color: 0x20150a });
    for (const sx of [-1, 1]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.012, 8, 28), frame); ring.position.x = sx * 0.12; glasses.add(ring); }
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6), frame); bridge.rotation.z = Math.PI / 2; glasses.add(bridge); attach(head, glasses, [0.008, 1.385, -0.305]);
    // book
    if (hand) { const book = new THREE.Group(); const cover = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.045), mat(0xc0392b)); const pages = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.21, 0.036), mat(0xfff4d6)); pages.position.x = 0.012; book.add(cover, pages); attach(hand, book, [0.33, 0.83, -0.1], new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.4, 0, 0.2))); }
  }

  applyQuality(q) {
    if (this.group) this.group.traverse((o) => { if (o.isMesh) o.castShadow = !!q.shadows; });
    if (q.teacherModel && !this.group && this.enabled) this.load().then(() => this._syncVisible());
    if (!q.teacherModel) this.setVisible(false);
  }

  /* ------------------------------------------------------------------ state */
  reset() { this.brain.reset(); this.brain.gentle = this.game.profile.settings.grade === 1 ? 0.8 : 1; this.x = this.game.player?.x || 0; this.zNow = this.brain.z + 0.8; this.alias = ""; this.q = null; this.serial = 0; this.hideRescue(); this.hideBubble(); this.setVisible(false); }
  onRunStart() { this._syncVisible(); const l = this.brain.startLine(); if (l && this.enabled) this.say(l); }
  _syncVisible() { this.setVisible(this.enabled && ["playing", "rescue", "gameover"].includes(this.game.state)); }
  setVisible(v) { if (this.group) this.group.visible = v && this.game.quality.teacherModel; if (this.blob) this.blob.visible = v && this.game.quality.blob && this.game.quality.teacherModel; if (!v) this.hideBubble(); }
  canRescue() { const g = this.game; return this.enabled && g.state === "playing" && g.player.alive && !g.tutorial.active && g.director.enabled; }

  /** Gameplay events from GameManager: "hit", "correct", "enigma", "coins5". */
  event(name, detail) { if (!this.enabled) return; const line = this.brain.event(name, detail); if (line) this.say(line); }

  update(dt, ctx = {}) {
    const g = this.game; if (!this.enabled) return;
    const res = this.brain.update(dt, ctx); if (res.line && res.line.kind !== "caught") this.say(res.line);
    if (this.group) {
      this.x += (g.player.x - this.x) * (1 - Math.exp(-3.4 * dt));
      this.zNow += (this.brain.z - this.zNow) * (1 - Math.exp(-3.5 * dt));
      // She runs a little to the side (towards the lane with more room) so the child stays fully visible; directly behind only when she is about to catch up.
      const px = g.player.x; if (px < -1) this.sign = 1; else if (px > 1) this.sign = -1;
      const sideWant = this.sign * 1.15 * Math.pow(1 - Math.min(1, this.brain.closeness), 0.7); this.off += (sideWant - this.off) * (1 - Math.exp(-4 * dt));
      const gx = Math.max(-2.9, Math.min(2.9, this.x + this.off));
      this.group.position.set(gx, 0, this.zNow); if (this.blob) this.blob.position.set(gx, 0.03, this.zNow);
      const talking = g.state === "rescue" || g.state === "gameover"; const want = talking ? "TALK" : "RUN";
      if (want !== this.alias) { this.alias = want; if (!this.anim.play(want, { fade: 0.2, timeScale: want === "RUN" ? 1.3 : 1 })) this.anim.play(talking ? "IDLE" : "RUN", { fade: 0.2 }); }
      if (want === "RUN") this.anim.play("RUN", { fade: 0.2, timeScale: Math.max(0.8, (g.speed / 9) * 1.25 * this.brain.speedFactor) });
      this.anim.update(dt);
    }
    this._placeBubble(dt);
    return res;
  }

  /* ------------------------------------------------------------------- speech bubble */
  say(line) {
    const key = `teacher.l.${line.kind}${line.variant || 1}`; const text = t(key); if (!text || text === key) return;
    this.bubble.textContent = text; this.bubble.hidden = false; this.bubbleTimer = line.kind === "caught" ? 6 : 2.6;
    if (this.game.profile.settings.tts && line.kind !== "caught") this.game.speaker.speak(text);
  }
  hideBubble() { this.bubble.hidden = true; this.bubbleTimer = 0; }
  _placeBubble(dt) {
    if (this.bubble.hidden) return; this.bubbleTimer -= dt; if (this.bubbleTimer <= 0 || this.game.state === "menu") return this.hideBubble();
    const g = this.game; const w = innerWidth, h = innerHeight;
    let tx, ty;
    if (this.group && this.group.visible) { const v = new THREE.Vector3(this.group.position.x, 1.7, this.zNow).project(g.camera); tx = (v.x * 0.5 + 0.5) * w; ty = (-v.y * 0.5 + 0.5) * h; if (v.z > 1) { tx = w * 0.25; ty = h * 0.7; } }
    else { tx = w * 0.3; ty = h * 0.72; }                                                                           // no model on weak devices: the bubble sits at the lower left
    const bw = this.bubble.offsetWidth || 200, bh = this.bubble.offsetHeight || 40; const dir = this.sign || 1;      // the bubble goes on the outer side, so it never covers the child
    let x = tx + dir * (bw / 2 + Math.min(90, w * 0.1)); x = Math.min(w - bw / 2 - 8, Math.max(bw / 2 + 8, x)); const y = Math.min(h - 120, Math.max(90 + bh / 2, ty - 20));
    this.bubble.className = dir > 0 ? "r" : "l"; this.bubble.style.left = `${x}px`; this.bubble.style.top = `${y}px`;
  }

  /* ------------------------------------------------------------------ rescue question */
  startRescue() {
    const g = this.game; if (g.state !== "playing") return;
    g.state = "rescue"; this.serial++; this.answered = false;
    const rng = seededFor(g.runSeed, 7000 + this.serial); const s = g.profile.settings;
    const subject = pickSubject(rng, s.subjects, this.lastSubject); this.lastSubject = subject;
    const q = generateQuestion({ subject, level: levelForProgress(g.stats.correct, s.grade), rng }); this.q = q; const loc = localizeQuestion(q, t, i18n.lang); this.loc = loc;
    this.p.title.textContent = t("teacher.caught"); this.p.say.textContent = t("teacher.l.caught1"); this.p.q.textContent = loc.text; this.p.fb.textContent = ""; this.p.fb.className = "fb"; this.p.hint.textContent = t("teacher.keys");
    this.p.opts.innerHTML = ""; q.options.forEach((o, i) => { const b = document.createElement("button"); b.className = `opt o${i}`; b.dataset.i = String(i); b.innerHTML = `<i>${SHAPES[i]}</i><b></b><kbd>${i + 1}</kbd>`; b.querySelector("b").textContent = o.label; b.addEventListener("click", () => this.answer(i)); this.p.opts.appendChild(b); });
    this.p.root.hidden = false; g.hud.show("hud", true);
    g.audio.play("question"); g.audio.setMood("quiz"); g.vibrate(40); g.speaker.speak(`${t("teacher.l.caught1")} ${loc.spoken}`);
    g.player.state = "idle"; g.player.anim?.play("IDLE", { fade: 0.2 }); this.hideBubble();                // the panel already carries her line
    g.events.dispatchEvent(new CustomEvent("teacher-caught", { detail: { serial: this.serial, subject } }));
  }
  _key(e) {
    if (this.game.state !== "rescue" || this.answered || e.repeat) return;
    const map = { 1: 0, 2: 1, 3: 2, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 1, ArrowRight: 2, a: 0, A: 0, s: 1, S: 1, d: 2, D: 2 }; const k = e.key in map ? map[e.key] : undefined;
    if (k !== undefined && k < (this.q?.options.length || 0)) { e.preventDefault(); this.answer(k); }
  }
  answer(i) {
    const g = this.game; if (g.state !== "rescue" || this.answered || !this.q) return; this.answered = true;
    const q = this.q, ok = i === q.correctIndex;
    this.p.opts.querySelectorAll("button").forEach((b, k) => { b.disabled = true; b.classList.toggle("right", k === q.correctIndex); b.classList.toggle("wrong", k === i && !ok); });
    this.p.fb.className = `fb ${ok ? "ok" : "bad"}`; this.p.fb.textContent = `${ok ? t("board.correct") : t("board.oops")}  ${this.loc.explanation}`;
    this.p.say.textContent = t(ok ? "teacher.l.rescued1" : "teacher.l.oops1");
    g._onAnswer({ question: q, subject: q.subject, chosenLabel: q.options[i].label, correctLabel: q.options[q.correctIndex].label, correct: ok, source: "teacher" });   // same scoring, streak, review and report as a board question
    this.rescueResult = ok; setTimeout(() => this.finishRescue(), 1700);
  }
  finishRescue() {
    const g = this.game; if (g.state !== "rescue") return; this.hideRescue();
    const line = this.brain.rescueDone(!!this.rescueResult); g.state = "playing"; g.lastTs = performance.now();
    if (g.player.alive) { g.player.startRun(); g.player.invulnerable = Math.max(g.player.invulnerable, 1.4); }
    g.audio.setMood("run"); this.q = null; this.alias = ""; this.say(line);
  }
  hideRescue() { this.p.root.hidden = true; }

  onGameOver() { this.hideRescue(); this.brain.state = "chase"; }

  /* ------------------------------------------------------------------------ DOM */
  _buildDom() {
    const bubble = document.createElement("div"); bubble.id = "teacherBubble"; bubble.hidden = true; bubble.setAttribute("role", "status"); document.body.appendChild(bubble); this.bubble = bubble;
    const root = document.createElement("div"); root.id = "rescue"; root.hidden = true; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
    root.innerHTML = '<div class="card"><div class="who"><span class="face">\u{1F9D1}\u200D\u{1F3EB}</span><b class="title"></b></div><p class="say"></p><h2 class="q"></h2><div class="opts"></div><p class="fb"></p><small class="tip"></small></div>';
    document.body.appendChild(root);
    this.p = { root, title: root.querySelector(".title"), say: root.querySelector(".say"), q: root.querySelector(".q"), opts: root.querySelector(".opts"), fb: root.querySelector(".fb"), hint: root.querySelector(".tip") };
  }
}
