import * as THREE from "three";
import { AnimationController } from "./animation-controller.js";
import { TeacherBrain } from "./teacher-brain.js";
import { generateQuestion, levelForProgress, pickSubject } from "./question-generator.js";
import { localizeQuestion } from "./question-i18n.js";
import { seededFor } from "./rng.js";
import { t, i18n } from "./i18n.js";

const SHAPES = ["\u25CF", "\u25B2", "\u25A0"];                      // circle / triangle / square: the same shapes and colours as the lanes on the question board

/**
 * The friendly teacher who runs behind the child (Temple Run / Subway Surfers style): a stumble brings her right behind him; a second stumble or a wrong answer and she grabs him.
 * She re-uses the already loaded Boy model (no extra download) dressed as a teacher: graduation cap, round glasses, a book in her hand.
 * Weak devices: on the "minimal" level there is no extra character; everything else (speech bubbles, rescue questions) still works.
 */
export class TeacherManager {
  constructor({ game }) {
    this.game = game; const p = game.profile.settings;
    this.brain = new TeacherBrain({ enabled: p.teacherChase !== false, gentle: p.grade === 1 ? 0.8 : 1, rng: () => Math.random() });
    this.group = null; this.anim = null; this.x = 0; this.off = 0; this.sign = -1; this.zNow = this.brain.k.farZ; this.alias = ""; this.loading = null;
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
  reset() { this.brain.reset(); this.brain.gentle = this.game.profile.settings.grade === 1 ? 0.8 : 1; this.x = this.game.player?.x || 0; this.zNow = this.brain.k.farZ + 0.8; this.off = 0; this.beat = 0; this.pending = null; this.panelShown = false; this.prevState = "far"; this.vis = false; this.alias = ""; this.q = null; this.serial = 0; this.hideRescue(); this.hideBubble(); this.setVisible(false); }
  onRunStart() { this._syncVisible(); const l = this.brain.startLine(); if (l && this.enabled) this.say(l); }
  _syncVisible() { this.setVisible(this.enabled && ["playing", "rescue", "gameover"].includes(this.game.state)); }
  setVisible(v) { this.vis = !!v; this._applyVis(); if (!v) { this.hideBubble(); this.game.hud?.teacherChip(""); } }
  _applyVis() { const on = this.vis && this.zNow < 8.6; if (this.group) this.group.visible = on && this.game.quality.teacherModel; if (this.blob) this.blob.visible = on && this.game.quality.blob && this.game.quality.teacherModel; }   // out of sight behind the camera while she is far
  canCatch() { const g = this.game; return this.enabled && g.state === "playing" && g.player.alive && g.stats.lives > 0 && !g.tutorial.active && g.director.enabled; }

  /** The runner stumbled over an obstacle.  First time: she runs right up behind him.  Again while she is close: she grabs him. */
  onHit(reason) {
    if (!this.enabled) return; const r = this.brain.event("hit", { reason });
    if (r.line && !r.caught) this.say(r.line);
    if (r.caught) { if (this.canCatch()) this.startCatch("hit"); else this.brain.state = "close"; }
  }
  /** A wrong answer at a question board: she grabs him at once and shows the right answer. */
  onWrong(result) {
    if (!this.enabled) return; const r = this.brain.event("wrong");
    if (r.caught) { if (this.canCatch()) this.startCatch("wrong", result); else this.brain.state = "close"; }
  }
  /** "correct", "enigma" ... : she drops back. */
  event(name, detail) { if (!this.enabled) return; const r = this.brain.event(name, detail); if (r.line) this.say(r.line); }

  update(dt, ctx = {}) {
    const g = this.game; if (!this.enabled) return;
    this.brain.update(dt, ctx);
    if (this.group) {
      const st = this.brain.state, caught = st === "caught";
      this.x += (g.player.x - this.x) * (1 - Math.exp(-(caught ? 8 : 3.4) * dt));
      this.zNow += (this.brain.z - this.zNow) * (1 - Math.exp(-(caught ? 7 : st === "close" ? 5 : 2.2) * dt));
      // she runs a little to the side (towards the lane with more room) so the child stays visible; right behind him when she is close
      const px = g.player.x; if (px < -1) this.sign = 1; else if (px > 1) this.sign = -1;
      this.off += (this.sign * this.brain.side - this.off) * (1 - Math.exp(-4 * dt));
      const gx = Math.max(-2.9, Math.min(2.9, this.x + this.off));
      this.group.position.set(gx, 0, this.zNow); if (this.blob) this.blob.position.set(gx, 0.03, this.zNow); this._applyVis();
      const talking = g.state === "rescue" || g.state === "gameover"; const want = talking ? "TALK" : "RUN";
      if (want !== this.alias) { this.alias = want; if (!this.anim.play(want, { fade: 0.2, timeScale: want === "RUN" ? 1.3 : 1 })) this.anim.play(talking ? "IDLE" : "RUN", { fade: 0.2 }); }
      if (want === "RUN") this.anim.play("RUN", { fade: 0.2, timeScale: Math.max(0.8, (g.speed / 9) * 1.25 * this.brain.speedFactor) });
      this.anim.update(dt);
    }
    this._tickBubble(dt); this._tickState();
    if (this.beat > 0) { this.beat -= dt; if (this.beat <= 0) this._showPanel(); }       // the grab is seen for a moment first, then she explains
  }
  /** a small hint in the top bar while she is close, and a message when she runs into view or falls back */
  _tickState() {
    const g = this.game, b = this.brain, st = b.state;
    g.hud.teacherChip(this.enabled && st === "close" && g.state === "playing" ? t("hud.teacher.close", { s: Math.max(1, Math.ceil(b.closeLeft)) }) : "");
    if (st !== this.prevState) {
      if (this.prevState === "far" && st === "close") g.hud.toast(t("t.teacherNear"), "bad", 2600);
      if (this.prevState === "close" && st === "far" && g.state === "playing") g.hud.toast(t("t.teacherAway"), "good", 2200);
      this.prevState = st;
    }
  }

  /* ------------------------------------------------------------------- speech bubble (a corner of the screen, never on the road) */
  say(line) {
    const key = `teacher.l.${line.kind}${line.variant || 1}`; const text = t(key); if (!text || text === key) return;
    this.bubble.textContent = `\u{1F393} ${text}`; this.bubble.hidden = false; this.bubbleTimer = 2.8;
    if (this.game.profile.settings.tts && line.kind !== "caught") this.game.speaker.speak(text);
  }
  hideBubble() { this.bubble.hidden = true; this.bubbleTimer = 0; }
  _tickBubble(dt) { if (this.bubble.hidden) return; this.bubbleTimer -= dt; if (this.bubbleTimer <= 0 || this.game.state === "menu") this.hideBubble(); }

  /* ------------------------------------------------------------------ the catch scene */
  startCatch(kind, info) {
    const g = this.game; if (g.state !== "playing") return;
    g.state = "rescue"; this.serial++; this.answered = false; this.kind = kind; this.hideBubble(); g.hud.teacherChip(""); this.panelShown = false;
    this.pending = { kind, info }; this.beat = 1.15;                                                // she runs up and grabs him; the panel comes after the beat
    g.player.state = "idle"; g.player.anim?.play("IDLE", { fade: 0.2 }); g.audio.play(kind === "wrong" ? "wrong" : "hit"); g.vibrate(60);
    g.hud.toast(t(kind === "wrong" ? "t.caughtWrong" : "t.caughtHit"), "bad", 3200); this.say({ kind: "caught", variant: 1 });
    g.events.dispatchEvent(new CustomEvent("teacher-caught", { detail: { serial: this.serial, kind } }));
  }
  _showPanel() {
    const g = this.game; if (g.state !== "rescue" || !this.pending) return; const { kind, info } = this.pending; this.pending = null; this.panelShown = true;
    this.p.root.classList.toggle("explain", kind === "wrong"); this.p.title.textContent = t("teacher.catch.title"); this.p.why.textContent = t(`teacher.why.${kind}`); this.p.say.textContent = t(`teacher.ask.${kind}`);
    if (kind === "wrong") {
      const q = info.question; const loc = localizeQuestion(q, t, i18n.lang); this.q = q; this.loc = loc; this.p.q.textContent = loc.text;
      this.p.answer.textContent = info.correctLabel; this.p.fb.className = "fb"; this.p.fb.textContent = loc.explanation; this.p.tip.textContent = ""; this.p.opts.innerHTML = "";
      this.p.go.hidden = false; this.p.go.textContent = t("teacher.go"); this.p.root.hidden = false; g.speaker.speak(`${t("teacher.ask.wrong")} ${info.correctLabel}. ${loc.explanation}`);
      this.holdTimer = setTimeout(() => this.finishCatch(false), 12000);
    } else {
      const rng = seededFor(g.runSeed, 7000 + this.serial); const s = g.profile.settings;
      const subject = pickSubject(rng, s.subjects, this.lastSubject); this.lastSubject = subject;
      const q = generateQuestion({ subject, level: levelForProgress(g.stats.correct, s.grade), rng }); this.q = q; const loc = localizeQuestion(q, t, i18n.lang); this.loc = loc;
      this.p.q.textContent = loc.text; this.p.answer.textContent = ""; this.p.fb.textContent = ""; this.p.fb.className = "fb"; this.p.tip.textContent = t("teacher.keys");
      this.p.go.hidden = true; this.p.opts.innerHTML = ""; q.options.forEach((o, i) => { const b = document.createElement("button"); b.className = `opt o${i}`; b.dataset.i = String(i); b.innerHTML = `<i>${SHAPES[i]}</i><b></b><kbd>${i + 1}</kbd>`; b.querySelector("b").textContent = o.label; b.addEventListener("click", () => this.answer(i)); this.p.opts.appendChild(b); });
      this.p.root.hidden = false; g.audio.play("question"); g.audio.setMood("quiz"); g.speaker.speak(`${t("teacher.ask.hit")} ${loc.spoken}`);
    }
  }
  _key(e) {
    const g = this.game; if (g.state !== "rescue" || e.repeat || !this.panelShown) return;
    if (this.kind === "wrong") { if (["Enter", " ", "ArrowUp", "ArrowDown", "1", "2", "3"].includes(e.key)) { e.preventDefault(); this.finishCatch(false); } return; }
    if (this.answered) return;
    const map = { 1: 0, 2: 1, 3: 2, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 1, ArrowRight: 2, a: 0, A: 0, s: 1, S: 1, d: 2, D: 2 }; const k = e.key in map ? map[e.key] : undefined;
    if (k !== undefined && k < (this.q?.options.length || 0)) { e.preventDefault(); this.answer(k); }
  }
  /** the escape question after a second stumble: a right answer wins the lost heart back */
  answer(i) {
    const g = this.game; if (g.state !== "rescue" || this.kind !== "hit" || this.answered || !this.q || !this.panelShown) return; this.answered = true;
    const q = this.q, ok = i === q.correctIndex;
    this.p.opts.querySelectorAll("button").forEach((b, k) => { b.disabled = true; b.classList.toggle("right", k === q.correctIndex); b.classList.toggle("wrong", k === i && !ok); });
    this.p.fb.className = `fb ${ok ? "ok" : "bad"}`; this.p.fb.textContent = `${ok ? t("board.correct") : t("board.oops")}  ${this.loc.explanation}`;
    this.p.say.textContent = t(ok ? "teacher.l.rescued1" : "teacher.l.oops1");
    g._onAnswer({ question: q, subject: q.subject, chosenLabel: q.options[i].label, correctLabel: q.options[q.correctIndex].label, correct: ok, source: "teacher" }, { noPenalty: true });   // same scoring, streak, review and report as a board question
    if (ok && g.stats.lives < g.stats.maxLives) { g.stats.lives++; g.hud.toast(t("teacher.heartBack"), "gold", 2200); setTimeout(() => g.audio.play("lifeUp"), 300); }
    this.rescueResult = ok; this.holdTimer = setTimeout(() => this.finishCatch(ok), 1800);
  }
  finishCatch(ok) {
    const g = this.game; if (g.state !== "rescue") return; clearTimeout(this.holdTimer); this.beat = 0; this.pending = null; this.hideRescue();
    const line = this.brain.release(this.kind === "hit" ? !!ok : null); g.state = "playing"; g.lastTs = performance.now();
    if (g.player.alive) { g.player.startRun(); g.player.invulnerable = Math.max(g.player.invulnerable, 1.6); }
    g.audio.setMood("run"); this.q = null; this.alias = ""; if (line) this.say(line);
    g.hud.banner("");
  }
  hideRescue() { clearTimeout(this.holdTimer); this.p.root.hidden = true; this.panelShown = false; }

  onGameOver() { this.hideRescue(); this.brain.state = "far"; }

  /* ------------------------------------------------------------------------ DOM */
  _buildDom() {
    const bubble = document.createElement("div"); bubble.id = "teacherBubble"; bubble.hidden = true; bubble.setAttribute("role", "status");
    (document.getElementById("msgLane") || document.body).appendChild(bubble); this.bubble = bubble;
    const root = document.createElement("div"); root.id = "rescue"; root.hidden = true; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
    root.innerHTML = '<div class="card"><div class="who"><span class="face">\u{1F393}</span><b class="title"></b></div><p class="why"></p><p class="say"></p><h2 class="q"></h2><div class="ans"></div><div class="opts"></div><p class="fb"></p><button class="go primary" hidden></button><small class="tip"></small></div>';
    document.body.appendChild(root);
    this.p = { root, title: root.querySelector(".title"), why: root.querySelector(".why"), say: root.querySelector(".say"), q: root.querySelector(".q"), answer: root.querySelector(".ans"), opts: root.querySelector(".opts"), fb: root.querySelector(".fb"), go: root.querySelector(".go"), tip: root.querySelector(".tip") };
    this.p.go.addEventListener("click", () => this.finishCatch(false));
  }
}
