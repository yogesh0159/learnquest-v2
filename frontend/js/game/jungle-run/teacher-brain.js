/**
 * The teacher's behaviour (pure logic, no graphics) - the Temple Run / Subway Surfers chase, made friendly and educational.
 *
 *   far     out of sight behind the camera (the screen shows a small "teacher is behind you" hint only when she is close)
 *   close   after a stumble she runs into view, right behind him, for 18 seconds
 *   caught  she has grabbed the runner (the game stops for a moment)
 *
 *   hit an obstacle .......... far -> close (for `closeSeconds`);  already close -> CAUGHT  (escape question: right = heart back)
 *   wrong answer ............. CAUGHT at once (she shows the right answer and explains it)
 *   right answer / Enigma .... she drops back (a right answer also shortens the time she stays close)
 *   it adapts: a child who answers well gets a quicker teacher, one who struggles a patient one.
 */
export const TEACHER_TUNING = Object.freeze({
  farZ: 9.5, closeZ: 1.8, caughtZ: 0.9,         // metres behind the runner: far = behind the camera (out of sight, like the guards in Temple Run), close = right behind him
  farSide: 0, closeSide: 0.3, caughtSide: 0.85,    // how far to the side she runs (a little, so the child stays visible)
  closeSeconds: 18, afterCatchClose: 8,         // how long she stays right behind after a stumble / after letting go
  correctShortens: 6, graceAtStart: 5,          // a right answer takes 6 s off; no catch in the first 5 s
  lineGap: 4.5,                                 // seconds between spoken lines
});

/** how many text variants exist for each line (keys teacher.l.<kind><n> in i18n.js) */
export const TEACHER_LINES = Object.freeze({ start: 1, near: 2, close: 2, praise: 2, caught: 1, rescued: 1, oops: 1 });

export class TeacherBrain {
  constructor({ enabled = true, gentle = 1, tuning = TEACHER_TUNING, rng = Math.random } = {}) {
    this.enabled = enabled; this.gentle = gentle; this.k = tuning; this.rng = rng; this.reset();
  }
  reset() { this.state = "far"; this.closeLeft = 0; this.grace = this.k.graceAtStart; this.t = 0; this.lastLineAt = -99; this.recent = []; this.catches = 0; this.catchesRight = 0; }
  setEnabled(v) { this.enabled = !!v; }

  /** 0.6 patient ... 1.25 quick, from the last answers (Grade 1 starts gentler). */
  get pace() {
    const n = this.recent.length; if (n < 3) return this.gentle;
    const acc = this.recent.reduce((a, b) => a + b, 0) / n;
    return (acc <= 0.4 ? 0.6 : acc <= 0.7 ? 0.85 : acc >= 0.9 && n >= 4 ? 1.2 : 1) * this.gentle;
  }
  get z() { return this.state === "caught" ? this.k.caughtZ : this.state === "close" ? this.k.closeZ : this.k.farZ; }
  get side() { return this.state === "caught" ? this.k.caughtSide : this.state === "close" ? this.k.closeSide : this.k.farSide; }
  get closeness() { return this.state === "caught" ? 1 : this.state === "close" ? 0.7 : 0.15; }     // for animation speed and the debug view
  get mood() { return this.state === "far" ? "calm" : this.state === "close" ? "near" : "close"; }
  get speedFactor() { return this.state === "far" ? 1 : 1.25; }

  /** @returns {{caught:string|null, line:object|null}} caught = "hit" | "wrong" when she grabs the runner now */
  event(name, detail = {}) {
    const out = { caught: null, line: null };
    if (!this.enabled) return out;
    switch (name) {
      case "hit":                                                         // stumbled over an obstacle
        if (this.state === "close" && this.grace <= 0) { this.state = "caught"; this.catches++; out.caught = "hit"; out.line = { kind: "caught", variant: 1 }; }
        else { this.state = "close"; this.closeLeft = this.k.closeSeconds * (this.pace < 1 ? 0.75 : this.pace > 1 ? 1.2 : 1); out.line = this._say("close"); }
        break;
      case "wrong":                                                       // wrong answer at a question board: caught at once
        this.recent.push(0); this.recent = this.recent.slice(-6);
        if (this.state !== "caught") { this.state = "caught"; this.catches++; out.caught = "wrong"; out.line = { kind: "caught", variant: 1 }; }
        break;
      case "correct":
        this.recent.push(1); this.recent = this.recent.slice(-6);
        if (this.state === "close") { this.closeLeft -= this.k.correctShortens; if (this.closeLeft <= 0) this.state = "far"; }
        out.line = this._say("praise");
        break;
      case "enigma": if (this.state === "close") this.state = "far"; break;
      default: break;
    }
    return out;
  }

  /** @param {{hold?:boolean}} ctx hold = the tutorial runs: she only jogs behind and never grabs */
  update(dt, ctx = {}) {
    if (!this.enabled) return { line: null };
    this.t += dt; this.grace = Math.max(0, this.grace - dt);
    if (this.state === "close") { this.closeLeft -= dt; if (this.closeLeft <= 0) { this.state = "far"; } }
    return { line: null };
  }

  /** the scene is over: the runner is free again, she stays right behind for a moment */
  release(correct) {
    if (correct != null) { this.catchesRight += correct ? 1 : 0; this.recent.push(correct ? 1 : 0); this.recent = this.recent.slice(-6); }
    this.state = "close"; this.closeLeft = this.k.afterCatchClose; this.lastLineAt = this.t;
    return correct == null ? null : { kind: correct ? "rescued" : "oops", variant: 1 };
  }
  startLine() { return this._say("start", true); }

  _say(kind, force = false) {
    if (!force && this.t - this.lastLineAt < this.k.lineGap) return null;
    this.lastLineAt = this.t; const n = TEACHER_LINES[kind] || 1;
    return { kind, variant: 1 + Math.floor(this.rng() * n) % n };
  }
}
