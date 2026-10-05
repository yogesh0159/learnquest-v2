import * as THREE from "three";
import { makeGlowTexture } from "./textures.js";
import { makeFxBuffers, fxStep } from "./native-reference.js";

/** One pooled additive Points system for pick-up sparkles, correct-answer bursts and hit puffs. */
export class FxManager {
  constructor({ scene, capacity = 220, native = null }) {
    this.native = native; this.B = native ? native.fx : makeFxBuffers(capacity);   // with the native core these arrays live inside WebAssembly memory
    this.n = capacity; this.cursor = 0; this.density = 1;
    this.pos = this.B.pos; this.col = this.B.col; this.vel = this.B.vel; this.life = this.B.life; this.maxLife = this.B.maxLife; this.base = this.B.base;
    for (let i = 0; i < capacity; i++) this.pos[i * 3 + 1] = -999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3)); geo.setDrawRange(0, capacity);
    this.mat = new THREE.PointsMaterial({ size: 0.34, map: makeGlowTexture("255,255,255", 64), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false; this.points.name = "FX"; scene.add(this.points);
  }
  burst(x, y, z, count, { color = 0xffd25a, speed = 3, up = 2.2, life = 0.8 } = {}) {
    const c = new THREE.Color(color);
    count = count > 0 ? Math.max(1, Math.round(count * this.density)) : 0;
    for (let k = 0; k < count; k++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % this.n;
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      this.pos.set([x, y, z], i * 3);
      this.vel.set([Math.cos(a) * s, up * (0.3 + Math.random()), Math.sin(a) * s * 0.6], i * 3);
      this.col.set([c.r, c.g, c.b], i * 3); this.base.set([c.r, c.g, c.b], i * 3);
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.6);
    }
  }
  update(dt, dz) {
    if (this.native) this.native.fx.step(this.n, dt, dz); else fxStep(this.B, this.n, dt, dz);
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
