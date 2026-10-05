import * as THREE from "three";
import { makeAmbientBuffers, ambientStep, createRng } from "./native-reference.js";

import { BIOMES, biomeAt } from "./biome-data.js";

export class BiomeManager {
  constructor({ scene, sky, hemi, sun, renderer, groundMat, env, onEnter = () => {} }) {
    Object.assign(this, { scene, sky, hemi, sun, renderer, groundMat, env, onEnter });
    this.current = -1; this.state = { fireflies: 0.18, torch: 1 };
    this._a = new THREE.Color(); this._b = new THREE.Color();
    this.update(0, true);
  }
  _lerpColor(target, ca, cb, k) { this._a.set(ca); this._b.set(cb); target.copy(this._a).lerp(this._b, k); }
  update(distance, silent = false) {
    const { from, to, blend, dominant } = biomeAt(distance); const A = BIOMES[from], B = BIOMES[to], k = blend;
    this._lerpColor(this.scene.fog.color, A.fog, B.fog, k); this.scene.background.copy(this.scene.fog.color);
    this.scene.fog.near = (A.near + (B.near - A.near) * k) * (this.viewScale || 1); this.scene.fog.far = (A.far + (B.far - A.far) * k) * (this.viewScale || 1);
    const mix = (a, b) => a + (b - a) * k;
    this.sky.material.color.setRGB(mix(A.sky[0], B.sky[0]), mix(A.sky[1], B.sky[1]), mix(A.sky[2], B.sky[2]));
    this._lerpColor(this.hemi.color, A.hemi, B.hemi, k); this.hemi.intensity = mix(A.hemiI, B.hemiI);
    this._lerpColor(this.sun.color, A.sun, B.sun, k); this.sun.intensity = mix(A.sunI, B.sunI);
    this.scene.environmentIntensity = mix(A.env, B.env);
    this.groundMat.color.setRGB(mix(A.ground[0], B.ground[0]), mix(A.ground[1], B.ground[1]), mix(A.ground[2], B.ground[2]));
    this.renderer.toneMappingExposure = mix(A.exposure, B.exposure);
    this.state.torch = mix(A.torch, B.torch); this.state.fireflies = mix(A.fireflies, B.fireflies);
    if (this.env) this.env.torchBoost = this.state.torch;
    if (dominant !== this.current) { this.current = dominant; if (!silent) this.onEnter(BIOMES[dominant]); }
  }
  get name() { return BIOMES[this.current]?.name; }
}

/** Fireflies (night) / pollen (day): one pooled additive Points cloud that scrolls with the world. */
export class AmbientFx {
  /** `native`: the C/C++ WebAssembly core. Its buffers ARE the geometry (no copying); without it the identical JS reference runs. */
  constructor({ scene, count = 110, native = null }) {
    this.native = native; this.B = native ? native.ambient : makeAmbientBuffers(count); const seedJs = Math.floor(Math.random() * 4e9) + 1, seedWasm = Math.floor(Math.random() * 4e9) + 1;   // always two draws, so the rest of the game's randomness is the same with or without the native core
    this.rng = createRng(seedJs); if (native) native.seedRng(seedWasm);
    this.n = count; this.t = 0; this.opacity = 0.2; this.base = this.B.base; this.seed = this.B.seed;
    const pos = this.B.pos;
    for (let i = 0; i < count; i++) { this.base[i * 3] = (Math.random() - 0.5) * 34; this.base[i * 3 + 1] = 0.4 + Math.random() * 4.5; this.base[i * 3 + 2] = -70 + Math.random() * 78; this.seed[i] = Math.random() * 6.28; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setDrawRange(0, count);
    const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d"); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "rgba(255,255,200,1)"); gr.addColorStop(0.4, "rgba(255,240,140,.5)"); gr.addColorStop(1, "rgba(255,240,140,0)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    this.mat = new THREE.PointsMaterial({ size: 0.28, map: new THREE.CanvasTexture(c), color: 0xfff2a0, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false; this.points.name = "Ambient"; scene.add(this.points);
  }
  update(dt, dz, intensity = 0.2, reduced = false) {
    this.t += dt;
    if (this.native) this.native.ambient.step(this.n, this.t, dz); else ambientStep(this.B, this.n, this.t, dz, this.rng);
    this.points.geometry.attributes.position.needsUpdate = true;
    this.mat.opacity = (reduced ? 0.35 : 1) * intensity * (0.8 + 0.2 * Math.sin(this.t * 3));
    this.points.visible = this.mat.opacity > 0.02;
  }
}
