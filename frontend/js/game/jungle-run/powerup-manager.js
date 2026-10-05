import * as THREE from "three";
import { shuffle } from "./rng.js";

/**
 * Golden Enigma rewards. Each Enigma grants the next power-up from a shuffled bag, so a child
 * sees all four before any repeats. Effects are queried by the game loop (speedFactor, coinMultiplier,
 * magnet, shield) so adding a new power-up means adding one entry here.
 */
export const POWERUPS = Object.freeze({
  magnet: { label: "Coin Magnet", icon: "\u{1F9F2}", duration: 10, color: "#ff6b6b", blurb: "Coins fly to you!" },
  shield: { label: "Shield", icon: "\u{1F6E1}\uFE0F", duration: 18, color: "#5bc0ff", blurb: "Blocks the next mistake" },
  slowmo: { label: "Slow Time", icon: "\u23F3", duration: 6, color: "#b78cff", blurb: "Everything slows down" },
  double: { label: "Double Coins", icon: "\u2728", duration: 8, color: "#ffd23f", blurb: "Coins are worth x2" },
});
const SLOW_FACTOR = 0.62;

export class PowerUpManager {
  constructor({ playerGroup }) {
    this.active = {}; this.bag = []; this.time = 0; this.granted = 0;
    this.shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.shieldMesh.position.y = 0.88; this.shieldMesh.visible = false; this.shieldMesh.name = "ShieldBubble"; this.shieldMesh.renderOrder = 4;
    playerGroup.add(this.shieldMesh);
  }

  /** @returns {string} id of the granted power-up */
  grant(rng = Math.random) {
    if (!this.bag.length) this.bag = shuffle(rng, Object.keys(POWERUPS));
    const id = this.bag.pop();
    this.give(id);
    return id;
  }
  give(id) { this.active[id] = POWERUPS[id].duration; this.granted++; }
  has(id) { return (this.active[id] || 0) > 0; }
  remaining(id) { return Math.max(0, this.active[id] || 0); }
  consumeShield() { if (!this.has("shield")) return false; delete this.active.shield; return true; }
  speedFactor() { return this.has("slowmo") ? SLOW_FACTOR : 1; }
  coinMultiplier() { return this.has("double") ? 2 : 1; }
  list() { return Object.keys(this.active).filter((k) => this.has(k)).map((k) => ({ id: k, ...POWERUPS[k], left: this.active[k] })); }
  reset() { this.active = {}; this.bag = []; this.shieldMesh.visible = false; }

  update(dt) {
    this.time += dt;
    for (const k of Object.keys(this.active)) { this.active[k] -= dt; if (this.active[k] <= 0) delete this.active[k]; }
    const sh = this.has("shield");
    this.shieldMesh.visible = sh;
    if (sh) {
      const left = this.active.shield; const blink = left < 3 ? (Math.floor(this.time * 8) % 2 ? 0.4 : 1) : 1;   // flicker when about to expire
      this.shieldMesh.scale.setScalar(1 + 0.05 * Math.sin(this.time * 6));
      this.shieldMesh.material.opacity = (0.16 + 0.07 * Math.sin(this.time * 4)) * blink;
    }
  }
}
