import * as THREE from "three";
import { JUNGLE_TRACK, SEGMENT_LENGTH, PATH_HALF_WIDTH } from "./config.js";
import { seededFor, range, chance } from "./rng.js";
import { makeGlowTexture } from "./textures.js";

const TORCH_EDGE_X = PATH_HALF_WIDTH + 0.62;    // torch centre; its inner edge clears the 3.3 m parapet
const MIN_CLEAR_X = PATH_HALF_WIDTH + 0.35;     // nothing decorative may extend inside this (keeps all 3 lanes open)

/**
 * Pooled roadside scenery. Every segment owns a fixed set of decor "slots" built once from the
 * cached GLB templates (clone() shares geometry + materials). When a segment is recycled the
 * slots are only re-randomised, so there is no allocation and no leak at runtime.
 */
export class EnvironmentManager {
  constructor({ scene, assets, track, quality, runSeed = 1 }) {
    this.scene = scene; this.assets = assets; this.track = track; this.quality = quality; this.runSeed = runSeed;
    this.slots = new Map();                 // segment -> { decor: [], torches: [] }
    this.torchRefs = [];                    // flattened for light assignment
    this.time = 0;
    this.glowTex = makeGlowTexture("255,170,70");
    this.lights = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight(0xff9a3c, 0, 11, 2); l.castShadow = false; l.name = `TorchLight_${i}`; l.position.set(0, -50, 0);
      scene.add(l); this.lights.push({ light: l, torch: null, base: 0, fade: 0 });
    }
    this.flameFrac = 0.86; this.torchBoost = 1; this.meta = new WeakMap(); this._std = new WeakMap(); this._cheap = new WeakMap(); this._lodTick = 0;
    track.on("create", (seg) => this._build(seg));
    track.on("spawn", (seg) => this._populate(seg));
  }

  setQuality(q) {
    this.quality = q; this.track.lodDist = q.lodNear * 1.7;
    this.track.segments.forEach((s) => { this._populate(s); this._applyMaterials(s.path, q.cheap); if (s.pathFar) this._applyMaterials(s.pathFar, q.cheap); const sl = this.slots.get(s); if (sl) for (const d of sl.decor) { this._applyMaterials(d.obj, q.cheap); const near = this.meta.get(d.obj)?.near; near?.traverse((o) => { if (o.isMesh) o.castShadow = !!q.shadowDecor && d.role.startsWith("tree"); }); } });
    this.track.refreshLod();
  }

  /** Cheaper (diffuse-only) shading for scenery on weaker GPUs: same textures, no PBR / environment lookups. */
  _applyMaterials(root, cheap) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (!this._std.has(o)) this._std.set(o, o.material);
      const std = this._std.get(o);
      if (!cheap) { o.material = std; return; }
      let c = this._cheap.get(std);
      if (!c) { c = new THREE.MeshLambertMaterial({ map: std.map, color: std.color, side: std.side }); this._cheap.set(std, c); }
      o.material = c;
    });
  }

  /** Full model near the camera, low-triangle LOD farther away (decided from the object's world distance). */
  _lodSwap(obj, segZ) {
    const m = this.meta.get(obj); if (!m?.far || !obj.visible) return;
    const useNear = segZ + obj.position.z > -this.quality.lodNear;
    if (m.isNear !== useNear) { m.isNear = useNear; m.near.visible = useNear; m.far.visible = !useNear; }
  }
  updateLod() {
    for (const [seg, s] of this.slots) { const z = seg.group.position.z; for (const d of s.decor) this._lodSwap(d.obj, z); for (const t of s.torches) if (t.active) this._lodSwap(t.obj, z); }
  }

  _wrapper(key) {
    const g = new THREE.Group(); const near = this.assets.instantiate(key);
    const far = this.assets.hasLod(key) ? this.assets.instantiate(key, { lod: true }) : null;
    if (near) g.add(near);
    if (far) { far.visible = false; g.add(far); }
    this.meta.set(g, { near, far, isNear: true });
    g.visible = false; return g;
  }

  _build(seg) {
    const decor = []; const torches = [];
    for (const side of [-1, 1]) {
      const defs = [["tree", "treeNear"], ["tree", "treeFar"], ["bush", "bushA"], ["bush", "bushB"], ["rock", "rock"]];
      for (const [key, role] of defs) {
        const obj = this._wrapper(key); obj.name = `${role}_${side < 0 ? "L" : "R"}`;
        seg.group.add(obj); decor.push({ obj, role, side, key });
      }
      const t = this._wrapper("torch"); t.name = `torch_${side < 0 ? "L" : "R"}`;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xff6a12, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(2.2); glow.position.y = (this.assets.info("torch")?.size?.[1] || 2.5) * this.flameFrac; t.add(glow);
      t.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      seg.group.add(t);
      const ref = { obj: t, glow, seg, side, phase: Math.random() * 100, active: false };
      torches.push(ref); this.torchRefs.push(ref);
    }
    this.slots.set(seg, { decor, torches });
  }

  _populate(seg) {
    const s = this.slots.get(seg); if (!s) return;
    const rng = seededFor(this.runSeed, seg.index);
    const q = this.quality.decor; const reserved = this.track.isReserved(seg.index);
    const treeInfo = this.assets.info("tree")?.size || [6, 6.4, 4];
    for (const d of s.decor) {
      const o = d.obj; o.visible = false; const side = d.side;
      let p = 0; let x = 0; let scale = 1; let radius = 1;
      const z = range(rng, -SEGMENT_LENGTH / 2 + 1.2, SEGMENT_LENGTH / 2 - 1.2);
      switch (d.role) {
        case "treeNear": p = 0.95 * Math.min(1, q + 0.25); scale = range(rng, 0.85, 1.2); radius = (treeInfo[0] / 2) * scale; x = MIN_CLEAR_X + radius + range(rng, 0.4, 2.2); break;
        case "treeFar":  p = 0.6 * q; scale = range(rng, 1.0, 1.45); radius = (treeInfo[0] / 2) * scale; x = MIN_CLEAR_X + radius + range(rng, 5, 11); break;
        case "bushA":    p = 0.9 * Math.min(1, q + 0.2); scale = range(rng, 0.8, 1.35); radius = 1.1 * scale; x = MIN_CLEAR_X + radius + range(rng, 0.2, 1.4); break;
        case "bushB":    p = 0.5 * q; scale = range(rng, 0.9, 1.6); radius = 1.2 * scale; x = MIN_CLEAR_X + radius + range(rng, 2.5, 6); break;
        case "rock":     p = 0.4 * q; scale = range(rng, 0.8, 1.7); radius = 0.9 * scale; x = MIN_CLEAR_X + radius + range(rng, 0.6, 5); break;
      }
      let show = chance(rng, p);
      if (reserved && d.role !== "treeFar" && d.role !== "treeNear") show = false;   // keep space around the board pillars
      if (reserved && (d.role === "treeNear" || d.role === "treeFar")) { x = Math.max(x, 9.5 + (treeInfo[0] / 2) * scale); }
      if (!show) continue;
      o.position.set(side * x, -0.04, z);
      o.rotation.y = rng() * Math.PI * 2;
      o.scale.setScalar(scale);
      o.visible = true; const m = this.meta.get(o); if (m) m.isNear = undefined; this._lodSwap(o, seg.group.position.z);
    }
    // One torch pair every second segment, glyph face turned toward the road.
    for (const t of s.torches) {
      const on = seg.index % (this.quality.id === "low" ? 4 : 2) === 0 && !(reserved) && q > 0.3;
      t.active = on; t.obj.visible = on;
      if (!on) continue;
      t.obj.position.set(t.side * TORCH_EDGE_X, -0.06, -SEGMENT_LENGTH / 2 + 3.2 + (t.side > 0 ? 0.9 : 0));
      t.obj.rotation.y = t.side < 0 ? Math.PI / 2 : -Math.PI / 2; const tm = this.meta.get(t.obj); if (tm) tm.isNear = undefined; this._lodSwap(t.obj, seg.group.position.z);
    }
  }

  update(dt, playerX = 0) {
    this.time += dt; if ((this._lodTick++ % 3) === 0) this.updateLod();
    const tmp = new THREE.Vector3(); const cand = [];
    for (const t of this.torchRefs) {
      if (!t.active) continue;
      t.obj.getWorldPosition(tmp);
      const flick = 0.82 + 0.18 * Math.sin(this.time * 11 + t.phase) * Math.sin(this.time * 7.3 + t.phase * 1.7) + 0.06 * Math.sin(this.time * 23 + t.phase);
      t.glow.scale.setScalar(1.5 * (0.9 + 0.2 * flick)); t.glow.material.opacity = this.quality.glow ? (0.07 + 0.08 * flick) * this.torchBoost : 0.0;
      if (tmp.z < 10 && tmp.z > -48) cand.push({ t, z: tmp.z, x: tmp.x, y: tmp.y, flick });
    }
    cand.sort((a, b) => Math.abs(a.z + 8) - Math.abs(b.z + 8));
    const n = Math.min(this.quality.lights, this.lights.length);
    for (let i = 0; i < this.lights.length; i++) {
      const slot = this.lights[i]; const c = i < n ? cand[i] : null;
      if (!c) { slot.light.intensity *= 0.85; if (slot.light.intensity < 0.05) slot.light.intensity = 0; continue; }
      const flameY = c.y + (this.assets.info("torch")?.size?.[1] || 2.5) * this.flameFrac;
      slot.light.position.set(c.x * 0.55, flameY + 1.1, c.z + 0.3);   // above/inboard of the flame so the flame mesh itself is not blown out
      const fade = THREE.MathUtils.smoothstep(c.z, -48, -30) * (1 - THREE.MathUtils.smoothstep(c.z, 4, 10));
      slot.light.intensity = 26 * this.torchBoost * c.flick * fade;
    }
  }
}
