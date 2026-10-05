/**
 * JavaScript reference of the native core (native/c/kernels.c and native/cpp/collide.cpp).
 *
 * Two jobs: (1) it is the fallback used when WebAssembly is unavailable or switched off, and (2) it is the specification the C and C++
 * code are tested against - same double-precision arithmetic, same order, same constants, so the results are identical bit for bit.
 */
export const AMB_MAX = 256, FX_MAX = 512, MAX_ITEMS = 128, MAX_OBSTACLES = 64, ITEM_STRIDE = 5, OBS_STRIDE = 6;

const TWO_PI = 6.283185307179586, INV_TWO_PI = 0.15915494309189535, PI = 3.141592653589793, HALF_PI = 1.5707963267948966;
const C3 = -0.16666666666666666, C5 = 0.008333333333333333, C7 = -0.0001984126984126984, C9 = 2.7557319223985893e-06, C11 = -2.505210838544172e-08;

/** Polynomial sine, max error ~6e-8. */
export function fastSin(x) {
  x = x - TWO_PI * Math.floor(x * INV_TWO_PI + 0.5);
  if (x > HALF_PI) x = PI - x; else if (x < -HALF_PI) x = -PI - x;
  const x2 = x * x;
  return x * (1.0 + x2 * (C3 + x2 * (C5 + x2 * (C7 + x2 * (C9 + x2 * C11)))));
}

/** Deterministic xorshift32 -> [0,1). */
export function createRng(seed = 2463534242) {
  let s = (seed >>> 0) || 2463534242;
  return { seed(v) { s = (v >>> 0) || 2463534242; }, next() { let x = s; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s = x >>> 0; return s / 4294967296; } };
}

export const makeAmbientBuffers = (n = AMB_MAX) => ({ pos: new Float32Array(n * 3), base: new Float32Array(n * 3), seed: new Float32Array(n) });
export const makeFxBuffers = (n = FX_MAX) => ({ pos: new Float32Array(n * 3), col: new Float32Array(n * 3), vel: new Float32Array(n * 3), base: new Float32Array(n * 3), life: new Float32Array(n), maxLife: new Float32Array(n) });

export function ambientStep(B, n, t, dz, rng) {
  const { pos, base, seed } = B;
  for (let i = 0; i < n; i++) {
    let z = base[i * 3 + 2] + dz;
    if (z > 8.0) { z -= 78.0; base[i * 3] = (rng.next() - 0.5) * 34.0; }
    base[i * 3 + 2] = z;
    const s = seed[i];
    pos[i * 3] = base[i * 3] + fastSin(t * 0.7 + s) * 0.6;
    pos[i * 3 + 1] = base[i * 3 + 1] + fastSin(t * 1.1 + s * 2.0) * 0.35;
    pos[i * 3 + 2] = z;
  }
}

export function fxStep(B, n, dt, dz) {
  const { pos, col, vel, base, life, maxLife } = B;
  for (let i = 0; i < n; i++) {
    if (life[i] <= 0) continue;
    life[i] = life[i] - dt;
    const j = i * 3;
    if (life[i] <= 0) { pos[j + 1] = -999.0; continue; }
    vel[j + 1] = vel[j + 1] - 6.0 * dt;
    pos[j] = pos[j] + vel[j] * dt;
    pos[j + 1] = pos[j + 1] + vel[j + 1] * dt;
    pos[j + 2] = pos[j + 2] + (vel[j + 2] * dt + dz);
    const f = life[i] / maxLife[i];
    col[j] = base[j] * f; col[j + 1] = base[j + 1] * f; col[j + 2] = base[j + 2] * f;
  }
}

/** items: Float64Array [x, y, z, kind(0 coin / 1 enigma), collected] x n. Writes hit indices into `out`, returns how many. */
export function collideCollectibles(items, n, px, py, height, reachZ, out) {
  let count = 0;
  for (let i = 0; i < n && i < MAX_ITEMS; i++) {
    const o = i * ITEM_STRIDE;
    if (items[o + 4] !== 0) continue;
    const enigma = items[o + 3] !== 0;
    const rx = enigma ? 0.95 : 0.75;
    if (Math.abs(items[o] - px) > rx) continue;
    if (Math.abs(items[o + 2]) > reachZ + (enigma ? 0.3 : 0.0)) continue;
    if (items[o + 1] < py - 0.35 || items[o + 1] > py + height + 0.35) continue;
    out[count++] = i;
  }
  return count;
}

/** obstacles: Float64Array [x, z, halfX, halfZ, yBottom, yTop] x n. Returns the first obstacle index hit, or -1. */
export function collideObstacle(obstacles, n, px, py, halfW, halfD, height) {
  for (let i = 0; i < n && i < MAX_OBSTACLES; i++) {
    const o = i * OBS_STRIDE;
    if (Math.abs(obstacles[o] - px) > obstacles[o + 2] + halfW * 0.8) continue;
    if (Math.abs(obstacles[o + 1]) > obstacles[o + 3] + halfD) continue;
    if (py + height <= obstacles[o + 4] + 0.02 || py >= obstacles[o + 5] - 0.05) continue;
    return i;
  }
  return -1;
}
