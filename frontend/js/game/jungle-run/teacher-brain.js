/**
 * The teacher's behaviour (pure logic, no graphics): how close she is, when she "catches" the runner, and what she says.
 *
 * Design: she is a friendly teacher running behind the child ("the bell is ringing, run to class!"), not a monster.
 *   closeness 0 = far behind, 1 = caught.  It is driven by LEARNING, not only by stumbling:
 *     mistakes bring her closer   (obstacle +0.35, wrong answer +0.45)
 *     good play pushes her back   (right answer -0.40, Golden Enigma -0.30, every 5 coins -0.04)
 *   When she catches up she does not end the run: she asks a RESCUE QUESTION (right = free again, wrong = one heart).
 *   It adapts: a child who answers well gets a quicker teacher, one who struggles gets a patient one.
 */
export const TEACHER_TUNING = Object.freeze({
  safeZ: 3.7, catchZ: 1.6,                      // metres behind the runner when far / when she is about to catch
  startCloseness: 0.18, creepPerSec: 0.012,     // she very slowly gains ground when nothing happens
  gain: { hit: 0.35, wrong: 0.45 }, relief: { correct: 0.40, enigma: 0.30, coins5: 0.04 },
  graceAtStart: 7, graceAfterRescue: 14,        // seconds in which she cannot catch
  afterRescue: { right: 0.28, wrong: 0.55 },
  lineGap: 5.5,                                 // seconds between spoken lines
});

/** how many text variants exist for each line (keys teacher.l.<kind><n> in i18n.js) */
export const TEACHER_LINES = Object.freeze({ start: 1, near: 2, close: 2, praise: 2, caught: 1, rescued: 1, oops: 1 });

export class TeacherBrain {
  constructor({ enabled = true, gentle = 1, tuning = TEACHER_TUNING, rng = Math.random } = {}) {
    this.enabled = enabled; this.gentle = gentle; this.k = tuning; this.rng = rng; this.reset();
  }
  reset() {
    this.closeness = this.k.startCloseness; this.grace = this.k.graceAtStart; this.state = "chase"; this.t = 0; this.lastLineAt = -99;
    this.recent = []; this.rescues = 0; this.rescuesRight = 0; this.flags = { near: false, close: false };
  }
  setEnabled(v) { this.enabled = !!v; }

  /** 0.6 patient ... 1.25 quick, from the last answers. */
  get pace() {
    const n = this.recent.length; if (n < 3) return this.gentle;
    const acc = this.recent.reduce((a, b) => a + b, 0) / n;
    const f = acc <= 0.4 ? 0.6 : acc <= 0.7 ? 0.85 : acc >= 0.9 && n >= 4 ? 1.2 : 1;
    return f * this.gentle;
  }
  /** distance behind the runner, metres */
  get z() { const c = Math.pow(Math.min(1, Math.max(0, this.closeness)), 1.25); return this.k.safeZ + (this.k.catchZ - this.k.safeZ) * c; }
  get mood() { return this.closeness >= 0.8 ? "close" : this.closeness >= 0.55 ? "near" : "calm"; }
  get speedFactor() { return 1 + 0.3 * this.closeness; }

  /** @returns {{kind:string}|null} a line she wants to say */
  event(name, detail = {}) {
    if (!this.enabled) return null;
    const add = (v) => { this.closeness = Math.min(1, this.closeness + v * this.pace); };
    const sub = (v) => { this.closeness = Math.max(0, this.closeness - v); };
    switch (name) {
      case "hit": add(detail.reason === "wrong-answer" ? this.k.gain.wrong : this.k.gain.hit); if (detail.reason === "wrong-answer") this.recent.push(0); break;
      case "correct": sub(this.k.relief.correct); this.recent.push(1); return this._say("praise");
      case "enigma": sub(this.k.relief.enigma); break;
      case "coins5": sub(this.k.relief.coins5); break;
      default: break;
    }
    this.recent = this.recent.slice(-6);
    return null;
  }

  /** @param {{hold?:boolean}} ctx hold = a question board is near or the tutorial runs: she keeps her distance */
  update(dt, ctx = {}) {
    const out = { caught: false, line: null };
    if (!this.enabled || this.state !== "chase") return out;
    this.t += dt; this.grace = Math.max(0, this.grace - dt);
    if (!ctx.hold) this.closeness = Math.min(1, this.closeness + this.k.creepPerSec * this.pace * dt);
    if (this.closeness < 0.4) { this.flags.near = false; this.flags.close = false; }
    if (this.closeness >= 1) {
      if (ctx.hold || this.grace > 0) this.closeness = 0.97;
      else { this.state = "caught"; out.caught = true; out.line = { kind: "caught", variant: 1 }; return out; }
    }
    if (this.closeness >= 0.8 && !this.flags.close) { this.flags.close = true; out.line = this._say("close"); }
    else if (this.closeness >= 0.55 && !this.flags.near) { this.flags.near = true; out.line = this._say("near"); }
    return out;
  }

  /** the child answered the rescue question */
  rescueDone(correct) {
    this.rescues++; if (correct) this.rescuesRight++;
    this.closeness = correct ? this.k.afterRescue.right : this.k.afterRescue.wrong; this.grace = this.k.graceAfterRescue; this.state = "chase";
    this.flags.near = this.flags.close = false; this.recent.push(correct ? 1 : 0); this.recent = this.recent.slice(-6);
    this.lastLineAt = this.t; return { kind: correct ? "rescued" : "oops", variant: 1 };
  }
  startLine() { return this._say("start", true); }

  _say(kind, force = false) {
    if (!force && this.t - this.lastLineAt < this.k.lineGap) return null;
    this.lastLineAt = this.t; const n = TEACHER_LINES[kind] || 1;
    return { kind, variant: 1 + Math.floor(this.rng() * n) % n };
  }
}
