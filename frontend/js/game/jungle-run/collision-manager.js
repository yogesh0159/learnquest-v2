import { MAX_ITEMS, MAX_OBSTACLES, ITEM_STRIDE, OBS_STRIDE } from "./native-reference.js";

/**
 * Lightweight AABB / lane-distance tests. No mesh-vs-mesh work; decor never participates.
 * With the native core the tests run in C++ (WebAssembly; native/cpp/collide.cpp); otherwise the identical JS below runs.
 * Both give exactly the same answers (tested on 400,000 random situations).
 */
export class CollisionManager {
  constructor({ native = null } = {}) { this.native = native; }
  collectibles(player, items, speed, dt) {
    const p = player.bounds(); const out = [];
    const reachZ = 0.85 + speed * dt * 0.5;
    if (this.native && items.length <= MAX_ITEMS) {
      const buf = this.native.collide.items;
      for (let i = 0; i < items.length; i++) { const it = items[i], o = i * ITEM_STRIDE; buf[o] = it.x; buf[o + 1] = it.y; buf[o + 2] = it.z; buf[o + 3] = it.kind === "enigma" ? 1 : 0; buf[o + 4] = it.collected ? 1 : 0; }
      const n = this.native.collide.collectibles(items.length, p.x, p.y, p.height, reachZ);
      for (let i = 0; i < n; i++) out.push(items[this.native.collide.hits[i]]);
      return out;
    }
    for (const it of items) {
      if (it.collected) continue;
      const rx = it.kind === "enigma" ? 0.95 : 0.75;
      if (Math.abs(it.x - p.x) > rx) continue;
      if (Math.abs(it.z) > reachZ + (it.kind === "enigma" ? 0.3 : 0)) continue;
      if (it.y < p.y - 0.35 || it.y > p.y + p.height + 0.35) continue;
      out.push(it);
    }
    return out;
  }
  obstacle(player, obstacles) {
    const p = player.bounds();
    if (this.native && obstacles.length <= MAX_OBSTACLES) {
      const buf = this.native.collide.obstacles;
      for (let i = 0; i < obstacles.length; i++) { const o = obstacles[i], k = i * OBS_STRIDE; buf[k] = o.x; buf[k + 1] = o.z; buf[k + 2] = o.halfX; buf[k + 3] = o.halfZ; buf[k + 4] = o.yBottom; buf[k + 5] = o.yTop; }
      const idx = this.native.collide.obstacle(obstacles.length, p.x, p.y, p.halfW, p.halfD, p.height);
      return idx >= 0 ? obstacles[idx] : null;
    }
    for (const o of obstacles) {
      if (Math.abs(o.x - p.x) > o.halfX + p.halfW * 0.8) continue;
      if (Math.abs(o.z) > o.halfZ + p.halfD) continue;
      if (p.y + p.height <= o.yBottom + 0.02 || p.y >= o.yTop - 0.05) continue;
      return o;
    }
    return null;
  }
}
