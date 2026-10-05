import * as THREE from "three";
import { LANES, PLAYER } from "./config.js";
import { AnimationController } from "./animation-controller.js";

const G = (8 * PLAYER.jumpApex) / (PLAYER.jumpAirTime * PLAYER.jumpAirTime);
const JUMP_V = (G * PLAYER.jumpAirTime) / 2;
const FAST_FALL_V = -13;

/**
 * Owns the player's lane, jump arc, slide and hit/fall state plus the character animation.
 * Forward motion belongs to the world scroller; this object never moves along Z.
 */
export class PlayerController {
  constructor({ scene, logger = console }) {
    this.logger = logger;
    this.group = new THREE.Group(); this.group.name = "Player";
    scene.add(this.group);
    this.model = null; this.anim = null;
    this.laneIndex = 1; this.x = 0; this.y = 0; this.vy = 0;
    this.state = "idle";
    this.slideTimer = 0; this.hitTimer = 0; this.invulnerable = 0;
    this.queuedSlide = false; this.jumpLocked = false;
    this.lean = 0; this.alive = true;
    this.events = new EventTarget();
    this.runTimeScale = 1.4; this.speed = 0;
    this.hitDuration = PLAYER.hitDuration;
  }

  /** Install (or swap) the character. `clips` must be fresh clones. */
  setCharacter(model, clips, name) {
    if (this.model) { this.anim?.dispose(); this.group.remove(this.model); }
    this.model = model;
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    this.group.add(model);
    this.anim = new AnimationController(model, clips, { logger: this.logger, name });
    this.anim.onFinished((alias) => this._onClipFinished(alias));
    const hit = this.anim.has("HIT") ? this.anim.duration("HIT") : 1.6;
    this.hitDuration = Math.max(PLAYER.hitDuration, hit / 2.2);
    this.reset();
  }

  reset() {
    this.laneIndex = 1; this.x = LANES[1]; this.y = 0; this.vy = 0;
    this.slideTimer = 0; this.hitTimer = 0; this.invulnerable = 0; this.queuedSlide = false;
    this.alive = true; this.lean = 0; this.state = "idle";
    this.group.position.set(this.x, 0, 0); this.group.rotation.set(0, 0, 0);
    if (this.model) this.model.visible = true;
    this.anim?.play("IDLE", { fade: 0.25 });
  }

  startRun() {
    if (!this.alive) return;
    this.state = "run";
    this.anim?.play("RUN", { fade: 0.22, timeScale: this.runTimeScale });
  }

  get grounded() { return this.y <= 0.0001 && this.vy <= 0; }
  get sliding() { return this.state === "slide" && this.slideTimer > 0.12 && this.slideTimer < PLAYER.slideDuration - 0.12; }
  get height() { return this.sliding ? PLAYER.slideHeight : PLAYER.standHeight; }

  moveLane(dir) {
    if (!this.alive || this.state === "idle") return false;
    const next = Math.max(0, Math.min(LANES.length - 1, this.laneIndex + dir));
    if (next === this.laneIndex) return false;
    this.laneIndex = next;
    this.events.dispatchEvent(new CustomEvent("lane", { detail: { lane: next } }));
    return true;
  }

  jump() {
    if (!this.alive || this.state === "idle" || this.jumpLocked) return false;
    if (!this.grounded) return false;
    this.vy = JUMP_V; this.y = 0.001;
    this.slideTimer = 0; this.queuedSlide = false;
    this.state = "jump";
    const ph = this.anim?.jumpPhases;
    const ts = ph ? ph.airborne / PLAYER.jumpAirTime : Math.max(0.6, this.anim.duration("JUMP") / (PLAYER.jumpAirTime * 1.6));
    const start = ph ? Math.max(0, ph.takeoff - 0.06) : 0;
    this.anim?.play("JUMP", { fade: 0.08, timeScale: ts, startTime: start });
    this.events.dispatchEvent(new CustomEvent("jump"));
    return true;
  }

  slide() {
    if (!this.alive || this.state === "idle") return false;
    if (!this.grounded) { this.vy = Math.min(this.vy, FAST_FALL_V); this.queuedSlide = true; return true; }  // fast-fall, then slide on landing
    this._beginSlide();
    return true;
  }
  _beginSlide() {
    this.state = "slide"; this.slideTimer = PLAYER.slideDuration; this.queuedSlide = false;
    this.anim?.play("SLIDE", { fade: 0.08, timeScale: this.anim.duration("SLIDE") / PLAYER.slideDuration });
    this.events.dispatchEvent(new CustomEvent("slide"));
  }

  /** Obstacle / wrong answer. Returns false while invulnerable (so callers don't double-count). */
  hit() {
    if (!this.alive || this.invulnerable > 0) return false;
    this.invulnerable = 1.8;
    this.hitTimer = this.hitDuration;
    this.slideTimer = 0; this.queuedSlide = false;
    this.state = "hit";
    this.anim?.play("HIT", { fade: 0.08, timeScale: this.anim.duration("HIT") / this.hitDuration });
    this.events.dispatchEvent(new CustomEvent("hit"));
    return true;
  }

  die() {
    if (!this.alive) return;
    this.alive = false; this.state = "fall"; this.vy = 0; this.slideTimer = 0;
    this.anim?.play("FALL", { fade: 0.1, timeScale: 1.1 });
  }

  /** Lab viewer: play any raw clip; the game state machine is bypassed until startRun()/reset(). */
  labPlay(name, opts = {}) { this.state = "lab"; return this.anim?.playRaw(name, opts); }

  celebrate() { this.anim?.play("VICTORY", { fade: 0.25, timeScale: 1 }); this.state = "victory"; }
  idle() { this.anim?.play("IDLE", { fade: 0.3 }); this.state = "idle"; }

  _onClipFinished(alias) {
    if (alias === "HIT" && this.state === "hit") this._resumeRun();
    if (alias === "SLIDE" && this.state === "slide") this._resumeRun();
  }
  _resumeRun() { this.state = "run"; this.anim?.play("RUN", { fade: 0.2, timeScale: this.runTimeScale }); }

  update(dt, speed) {
    this.speed = speed;
    this.runTimeScale = THREE.MathUtils.clamp(speed / 6.5, 0.9, 2.6);

    // Lane smoothing: critically-damped style exponential approach, never a teleport.
    const targetX = LANES[this.laneIndex];
    const prevX = this.x;
    this.x += (targetX - this.x) * (1 - Math.exp(-PLAYER.laneSmoothing * dt));
    const vx = (this.x - prevX) / Math.max(dt, 1e-4);
    this.lean += ((THREE.MathUtils.clamp(vx / 9, -1, 1)) - this.lean) * (1 - Math.exp(-14 * dt));

    // Vertical: ballistic arc owned here (the clip's own rise was removed).
    if (this.y > 0 || this.vy > 0) {
      this.vy -= G * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0;
        if (this.state === "jump") {
          if (this.queuedSlide) this._beginSlide(); else { this.state = "run"; this.anim?.play("RUN", { fade: 0.18, timeScale: this.runTimeScale }); }
        }
      }
    }
    if (this.state === "slide") { this.slideTimer -= dt; if (this.slideTimer <= 0 && !this.anim?.has("SLIDE")) this._resumeRun(); }
    if (this.state === "hit") { this.hitTimer -= dt; if (this.hitTimer <= -0.2) this._resumeRun(); }
    if (this.invulnerable > 0) {
      this.invulnerable = Math.max(0, this.invulnerable - dt);
      if (this.model) this.model.visible = this.invulnerable <= 0 || Math.floor(this.invulnerable * 14) % 2 === 0;
    } else if (this.model && !this.model.visible && this.alive) this.model.visible = true;

    if (this.state === "run") this.anim?.setTimeScale(this.runTimeScale);

    this.group.position.set(this.x, this.y, 0);
    // Banking into the turn: roll about the travel axis and a slight yaw toward the new lane.
    this.group.rotation.z = -this.lean * 0.16;
    this.group.rotation.y = -this.lean * 0.22;
    this.anim?.update(dt);
  }

  bounds() {
    return { x: this.x, y: this.y, halfW: PLAYER.halfWidth, halfD: PLAYER.halfDepth, height: this.height };
  }
}
