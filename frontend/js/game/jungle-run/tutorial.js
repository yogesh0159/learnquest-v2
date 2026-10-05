/**
 * First-run coach. A tiny state machine: each step waits for the player to do the thing (or times out, so a
 * child is never stuck), shows a short "Nice!" and moves on. Pure logic; the game wires events in and renders text.
 */
export const TUTORIAL_STEPS = Object.freeze([
  { id: "lane",  wait: "lane",  timeout: 14, text: "Press \u2190 \u2192 (or swipe) to change lane", touch: "Swipe left or right, or tap \u25C0 \u25B6 to change lane" },
  { id: "jump",  wait: "jump",  timeout: 14, text: "Press \u2191 or Space to JUMP", touch: "Swipe up or tap \u2B06 to JUMP" },
  { id: "slide", wait: "slide", timeout: 14, text: "Press \u2193 to SLIDE", touch: "Swipe down or tap \u2B07 to SLIDE" },
  { id: "coin",  wait: "coin",  timeout: 16, text: "Run into the coins to collect them!", touch: "Run into the coins to collect them!" },
  { id: "quiz",  wait: null,    timeout: 5,  text: "Questions appear on a board. Run through the lane with the RIGHT answer!", touch: "Questions appear on a board. Run through the lane with the RIGHT answer!" },
]);

export class Tutorial {
  constructor({ steps = TUTORIAL_STEPS, onStep = () => {}, onPraise = () => {}, onDone = () => {} } = {}) {
    Object.assign(this, { steps, onStep, onPraise, onDone }); this.index = -1; this.t = 0; this.praise = 0; this.active = false;
  }
  start() { this.active = true; this.index = -1; this._next(); }
  get step() { return this.steps[this.index] || null; }
  _next() {
    this.index++; this.t = 0; this.praise = 0;
    if (this.index >= this.steps.length) { this.active = false; this.onDone({ skipped: false }); return; }
    this.onStep(this.step, this.index, this.steps.length);
  }
  /** Game events: "lane" | "jump" | "slide" | "coin". */
  notify(evt) { if (this.active && this.step?.wait === evt && !this.praise) { this.praise = 0.9; this.onPraise(this.step); } }
  update(dt) {
    if (!this.active || !this.step) return;                               // not started yet / already past the last step
    if (this.praise > 0) { this.praise -= dt; if (this.praise <= 0) { this.praise = 0; this._next(); } return; }
    this.t += dt; if (this.t >= this.step.timeout) this._next();     // never leave a child stuck
  }
  skip() { if (!this.active) return; this.active = false; this.onDone({ skipped: true }); }
}
