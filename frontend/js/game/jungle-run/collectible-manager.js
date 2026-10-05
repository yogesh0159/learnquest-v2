import * as THREE from "three";
import { makeGlowTexture } from "./textures.js";

/**
 * Pooled coins + Golden Enigma tokens. GLBs are loaded once by the AssetManager; here every
 * pooled item is a clone sharing geometry/materials. Items scroll with the world and are
 * released back to the pool when collected or when they pass behind the camera.
 */
export class CollectibleManager {
  constructor({ scene, assets, coinPool = 48, enigmaPool = 4 }) {
    this.scene = scene; this.assets = assets; this.time = 0;
    this.root = new THREE.Group(); this.root.name = "Collectibles"; scene.add(this.root);
    this.free = { coin: [], enigma: [] }; this.active = [];
    this.glowTex = makeGlowTexture("255,210,90");
    for (let i = 0; i < coinPool; i++) this.free.coin.push(this._make("coin"));
    for (let i = 0; i < enigmaPool; i++) this.free.enigma.push(this._make("enigma"));
    // Enigma glow: material emissive pulse shared by all enigma clones.
    this.enigmaMats = [];
    const tpl = assets.instantiate("enigma");
    tpl?.traverse((o) => { if (o.isMesh) { const m = Array.isArray(o.material) ? o.material : [o.material]; this.enigmaMats.push(...m); } });
  }

  _make(kind) {
    const holder = new THREE.Group(); holder.visible = false; holder.name = kind;
    const model = this.assets.instantiate(kind); if (model) holder.add(model);
    if (kind === "enigma") {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffc94a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
      glow.scale.setScalar(2.4); glow.position.z = -0.05; glow.name = "glow"; holder.add(glow);
    }
    this.root.add(holder);
    return { kind, holder, model, x: 0, y: 0, z: 0, phase: 0, collected: false };
  }

  spawn(kind, x, y, z) {
    const it = this.free[kind].pop();
    if (!it) return null;                       // pool exhausted: skip silently (bounded memory)
    it.x = x; it.y = y; it.z = z; it.phase = Math.random() * 6.28; it.collected = false;
    it.holder.position.set(x, y, z); it.holder.visible = true; it.holder.scale.setScalar(1);
    this.active.push(it);
    return it;
  }

  release(it) {
    it.holder.visible = false; it.collected = true;
    const i = this.active.indexOf(it); if (i >= 0) this.active.splice(i, 1);
    this.free[it.kind].push(it);
  }

  clear() { [...this.active].forEach((it) => this.release(it)); }

  /** Magnet power-up: coins in front of the player glide toward him. */
  attract(px, py, dt, { reachZ = 16 } = {}) {
    const k = 1 - Math.exp(-7 * dt);
    for (const it of this.active) {
      if (it.kind !== "coin" || it.z < -reachZ || it.z > 1.5) continue;
      it.x += (px - it.x) * k; it.y += (py + 0.9 - it.y) * k; it.z += (0 - it.z) * k * 0.25;
    }
  }

  update(dt, dz) {
    this.time += dt;
    const t = this.time;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const it = this.active[i];
      it.z += dz;
      if (it.z > 5) { this.release(it); continue; }   // before it reaches the camera (6.9 m), so missed coins never loom at the screen edge
      if (it.kind === "coin") {
        it.holder.rotation.y = t * 3.4 + it.phase;
        it.holder.position.set(it.x, it.y + Math.sin(t * 3 + it.phase) * 0.08, it.z);
      } else {
        it.holder.rotation.y = t * 1.5 + it.phase;
        const pulse = 1 + 0.07 * Math.sin(t * 4 + it.phase);
        it.holder.scale.setScalar(pulse);
        it.holder.position.set(it.x, it.y + Math.sin(t * 2.2 + it.phase) * 0.14, it.z);
        const glow = it.holder.getObjectByName("glow");
        if (glow) { glow.material.opacity = 0.3 + 0.2 * Math.sin(t * 5 + it.phase); glow.scale.setScalar(2.3 + 0.4 * Math.sin(t * 3 + it.phase)); }
      }
    }
    const e = 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(t * 5));
    for (const m of this.enigmaMats) { if (m.emissive) { m.emissive.setRGB(1, 0.62, 0.12); m.emissiveIntensity = e; } }
  }
}
