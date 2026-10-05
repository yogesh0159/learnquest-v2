import * as THREE from "three";
import { ASSET_REGISTRY, LANES, QUESTIONS } from "./config.js";
import { generateQuestion, levelForProgress, pickSubject } from "./question-generator.js";
import { i18n, t } from "./i18n.js";
import { localizeQuestion } from "./question-i18n.js";
import { seededFor, range } from "./rng.js";

const LANE_COLORS = ["#2f9bff", "#2fbf6a", "#ff9a2f"];
const roundRect = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const FONT = '"Baloo 2","Trebuchet MS","Segoe UI","Nirmala UI","Mangal","Noto Sans Devanagari",Arial,sans-serif';

/** Shapes next to the colour so the three lanes are distinguishable without colour vision. */
function drawShape(g, kind, x, y, r, fill = "#fff") {
  g.fillStyle = fill; g.beginPath();
  if (kind === 0) g.arc(x, y, r, 0, Math.PI * 2);
  else if (kind === 1) { g.moveTo(x, y - r); g.lineTo(x + r * 1.05, y + r * 0.8); g.lineTo(x - r * 1.05, y + r * 0.8); g.closePath(); }
  else g.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  g.fill();
}
/** Largest font (<= size) so the text fits maxW; returns the lines to draw (wraps to two lines when needed). */
export function fitText(g, text, maxW, size, minSize, family = FONT) {
  const width = (t, s) => { g.font = `800 ${s}px ${family}`; return g.measureText(t).width; };
  let single = null; for (let s = size; s >= minSize; s -= 6) if (width(text, s) <= maxW) { single = { lines: [text], size: s }; break; }
  const words = text.split(" ");
  let two = null;
  if (words.length > 1) {
    let best = null;
    for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(" "), b = words.slice(i).join(" "); const w = Math.max(width(a, 100), width(b, 100)); if (!best || w < best.w) best = { a, b, w }; }
    for (let s = Math.min(size, 120); s >= 40; s -= 4) if (Math.max(width(best.a, s), width(best.b, s)) <= maxW) { two = { lines: [best.a, best.b], size: s }; break; }
    two ||= { lines: [best.a, best.b], size: 40 };
  }
  // Prefer one line; wrap only when that gives clearly bigger (easier to read) text.
  if (single && (!two || single.size * 1.1 >= two.size)) return single;
  return two || single || { lines: [text], size: minSize };
}

/**
 * Question-zone system. The GLB supplies only the physical board; the question and three answer
 * plaques are painted at runtime onto a CanvasTexture plane in front of the blank wooden panel,
 * and the three answers are also laid on the road, one per lane. Running through a lane answers.
 */
export class QuestionManager {
  constructor({ scene, assets, track, runSeed = 1, logger = console, getConfig = () => ({ subjects: ["math"], grade: 1 }) }) {
    this.getConfig = getConfig; this.lastSubject = "";
    this.scene = scene; this.assets = assets; this.track = track; this.logger = logger; this.runSeed = runSeed;
    this.state = "idle"; this.question = null; this.seg = null; this.nextIndex = QUESTIONS.firstSegment;
    this.correctCount = 0; this.asked = 0; this.lastText = ""; this.listeners = {};
    this.speedFactorNow = 1; this.feedback = null;

    this.group = new THREE.Group(); this.group.name = "QuestionZone"; this.group.visible = false; scene.add(this.group);
    this.board = assets.instantiate("board"); if (this.board) this.group.add(this.board);
    this.board?.position.set(0, 0, QUESTIONS.boardOffsetZ);
    this._buildPanel(); this._buildPads();
    track.reserved.add(this.nextIndex);
    track.on("spawn", (s) => this._onSpawn(s));
    track.on("recycle", (s) => { if (this.seg === s) this._release(); });
  }

  on(evt, fn) { this.listeners[evt] = fn; return this; }
  _emit(evt, data) { this.listeners[evt]?.(data); }

  _buildPanel() {
    const spec = ASSET_REGISTRY.board; const info = this.assets.info("board");
    const s = spec.fit.value / (info?.rawSize?.[0] || 1.905);       // model units -> metres
    this.panelW = spec.panel.width * s; this.panelH = spec.panel.height * s;
    this.panelY = spec.panel.centerYFromBottom * s;
    // Median front-face depth of the wooden panel (ignores stray vine hits).
    let z = 0.12 * s;
    if (this.board) {
      this.group.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(); const hits = [];
      for (const fx of [-0.4, -0.2, 0, 0.2, 0.4]) for (const fy of [-0.12, 0, 0.12]) {
        ray.set(new THREE.Vector3(fx * this.panelW, this.panelY + fy * this.panelH, QUESTIONS.boardOffsetZ + 8), new THREE.Vector3(0, 0, -1));
        const h = ray.intersectObject(this.board, true)[0]; if (h) hits.push(h.point.z - QUESTIONS.boardOffsetZ);
      }
      if (hits.length) { hits.sort((a, b) => a - b); const med = hits[Math.floor(hits.length / 2)]; z = Math.min(hits[hits.length - 1], med + 0.4); }   // clear the centre support post, ignore stray vines
    }
    this.canvas = document.createElement("canvas"); this.canvas.width = 1500; this.canvas.height = Math.round(1500 * this.panelH / this.panelW);
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    this.panel = new THREE.Mesh(new THREE.PlaneGeometry(this.panelW, this.panelH), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, toneMapped: false, depthWrite: false }));
    this.panel.position.set(0, this.panelY, QUESTIONS.boardOffsetZ + z + 0.04); this.panel.renderOrder = 5; this.panel.name = "QuestionPanel";
    this.group.add(this.panel);
  }

  _buildPads() {
    this.pads = [];
    for (let i = 0; i < 3; i++) {
      const c = document.createElement("canvas"); c.width = c.height = 256;
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(LANES[i], 0.035, QUESTIONS.padOffsetZ); m.renderOrder = 3;
      this.group.add(m); this.pads.push({ mesh: m, canvas: c, tex });
    }
  }

  _drawPad(i, label, mode = "idle") {
    const { canvas: c, tex } = this.pads[i]; const g = c.getContext("2d"); g.clearRect(0, 0, 256, 256);
    const col = mode === "right" ? "#25c05a" : mode === "wrong" ? "#e5483f" : LANE_COLORS[i];
    g.fillStyle = "rgba(20,30,20,.55)"; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.fill();
    g.lineWidth = 16; g.strokeStyle = col; g.stroke();
    drawShape(g, i, 128, 52, 20, col);
    const f = fitText(g, label, 190, 118, 34); g.fillStyle = "#fff"; g.font = `800 ${f.size}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 8; g.strokeStyle = "rgba(0,0,0,.55)"; f.lines.forEach((ln, k) => { const y = 142 + (k - (f.lines.length - 1) / 2) * f.size * 0.95; g.strokeText(ln, 128, y); g.fillText(ln, 128, y); });
    tex.needsUpdate = true;
  }

  /** Paint the board: question on top, three lane-aligned answer plaques below. */
  draw(result = null) {
    const q = this.question; const c = this.canvas; const g = c.getContext("2d"); const W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    if (!q) { this.tex.needsUpdate = true; return; }
    g.textAlign = "center"; g.textBaseline = "middle";
    const loc = localizeQuestion(q, t, i18n.lang);
    const title = result ? (result.correct ? t("board.correct") + "  " + loc.explanation : t("board.oops") + "  " + loc.explanation) : loc.text;
    const tf = fitText(g, title, W * 0.76, result ? 120 : 210, 70);
    g.font = `800 ${tf.size}px ${FONT}`; g.lineJoin = "round"; g.lineWidth = Math.max(10, tf.size * 0.1); g.strokeStyle = "#2c1a0a";
    g.fillStyle = result ? (result.correct ? "#9bffb0" : "#ffb4a8") : "#fff2bd";
    tf.lines.forEach((ln, k) => { const y = H * (tf.lines.length === 1 ? 0.33 : 0.2 + k * 0.2); g.strokeText(ln, W / 2, y); g.fillText(ln, W / 2, y); });
    const pw = this.panelW;
    q.options.forEach((o, i) => {
      const cx = W / 2 + (LANES[i] / pw) * W; const w = 410, h = 180, y = H * 0.74;
      const isCorrect = i === q.correctIndex, chosen = result && result.laneIndex === i;
      let fill = LANE_COLORS[i];
      if (result) fill = isCorrect ? "#25c05a" : chosen ? "#e5483f" : "#6b6b6b";
      g.fillStyle = "rgba(25,12,0,.55)"; roundRect(g, cx - w / 2 + 6, y - h / 2 + 10, w, h, 44); g.fill();
      g.fillStyle = fill; roundRect(g, cx - w / 2, y - h / 2, w, h, 44); g.fill();
      g.lineWidth = 10; g.strokeStyle = "#fff6"; g.stroke();
      drawShape(g, i, cx - w / 2 + 38, y - h / 2 + 38, 17, "rgba(255,255,255,.95)");
      const lf = fitText(g, o.label, w - 50, 150, 52); g.fillStyle = "#fff"; g.font = `800 ${lf.size}px ${FONT}`;
      g.lineWidth = 12; g.strokeStyle = "rgba(0,0,0,.45)";
      lf.lines.forEach((ln, k) => { const yy = y + 8 + (k - (lf.lines.length - 1) / 2) * lf.size * 0.92; g.strokeText(ln, cx, yy); g.fillText(ln, cx, yy); });
    });
    this.tex.needsUpdate = true;
  }

  _onSpawn(seg) {
    if (this.held || seg.index !== this.nextIndex || this.seg) return;
    this.seg = seg; this.state = "approach"; this.asked++;
    const rng = seededFor(this.runSeed, seg.index + 31337);
    const cfg = this.getConfig(); const subject = pickSubject(rng, cfg.subjects, this.lastSubject); this.lastSubject = subject;
    this.question = generateQuestion({ subject, level: levelForProgress(this.correctCount, cfg.grade), rng, avoidText: this.lastText });
    this.lastText = this.question.text;
    this.question.options.forEach((o, i) => this._drawPad(i, o.label));
    this.draw(); this.group.visible = true; this.feedback = null; this.announced = false;
    this.logger.info?.(`[LearnQuest] Question zone on segment ${seg.index} (${subject}): ${this.question.text}  options ${this.question.options.map((o) => o.label).join(" / ")}`);
    this._schedule(seg.index);
  }

  _schedule(from) {
    const rng = seededFor(this.runSeed, from + 4242);
    this.nextIndex = from + Math.round(range(rng, QUESTIONS.gapMin, QUESTIONS.gapMax));
    this.track.reserved.add(this.nextIndex);
  }

  _release() {
    this.track.reserved.delete(this.seg.index);
    this.seg = null; this.state = "idle"; this.group.visible = false; this.question = null;
    this._emit("zone-end");
  }

  /** Tutorial: no question board until released; the next one then appears a few tiles ahead. */
  hold(on) {
    this.held = !!on;
    if (!on) { this.track.reserved.delete(this.nextIndex); this.nextIndex = this.track.maxIndex + 7; this.track.reserved.add(this.nextIndex); }
  }

  get active() { return this.state === "approach"; }
  get hasZone() { return !!this.seg; }
  /** Z of the board plane in world coordinates (negative = ahead of the player). */
  get boardZ() { return this.seg ? this.seg.group.position.z + QUESTIONS.boardOffsetZ : -Infinity; }
  get padZ() { return this.seg ? this.seg.group.position.z + QUESTIONS.padOffsetZ : -Infinity; }

  update(dt, player) {
    this.speedFactorNow = 1;
    player.jumpLocked = false;
    if (!this.seg) return;
    this.group.position.z = this.seg.group.position.z;
    const ahead = -this.padZ;
    if (this.state === "approach") {
      if (!this.announced && ahead < 85) { this.announced = true; this._emit("question", this.question); }
      if (ahead < QUESTIONS.slowStartDistance && ahead > -2) {
        const t = THREE.MathUtils.clamp(ahead / QUESTIONS.slowStartDistance, 0, 1);
        this.speedFactorNow = QUESTIONS.slowFactor + (1 - QUESTIONS.slowFactor) * t * t;
      }
      if (this.padZ >= -0.2) this._resolve(player);
    }
    if (Math.abs(this.boardZ) < QUESTIONS.jumpLockHalfRange + 1) player.jumpLocked = true;
  }

  _resolve(player) {
    const lane = LANES.reduce((best, x, i) => (Math.abs(x - player.x) < Math.abs(LANES[best] - player.x) ? i : best), 0);
    const q = this.question; const correct = lane === q.correctIndex;
    this.state = "answered";
    if (correct) this.correctCount++;
    const result = { correct, laneIndex: lane, correctIndex: q.correctIndex, question: q, explanation: q.explanation, subject: q.subject, chosenLabel: q.options[lane].label, correctLabel: q.options[q.correctIndex].label };
    this.feedback = result; this.draw(result);
    q.options.forEach((o, i) => this._drawPad(i, o.label, i === q.correctIndex ? "right" : i === lane ? "wrong" : "idle"));
    this.logger.info?.(`[LearnQuest] Answer lane ${lane} (${q.options[lane].label}) is ${correct ? "CORRECT" : "WRONG"} for ${q.text}`);
    this._emit("answer", result);
  }

  reset(seed) {
    this.runSeed = seed; this.held = false; this.state = "idle"; this.seg = null; this.question = null; this.group.visible = false;
    this.track.reserved.clear(); this.nextIndex = QUESTIONS.firstSegment; this.track.reserved.add(this.nextIndex);
    this.correctCount = 0; this.asked = 0; this.lastText = ""; this.lastSubject = ""; this.feedback = null;
  }
}
