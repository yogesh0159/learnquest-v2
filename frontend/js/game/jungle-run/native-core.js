import { AMB_MAX, FX_MAX, MAX_ITEMS, MAX_OBSTACLES, ITEM_STRIDE, OBS_STRIDE, createRng, makeAmbientBuffers, makeFxBuffers, ambientStep, fxStep, collideCollectibles, collideObstacle } from "./native-reference.js";

/**
 * Loads the C / C++ core compiled to WebAssembly (frontend/wasm/lq_core.wasm, sources in native/).
 * Returns null when WebAssembly is unavailable, the file is missing, or the start-up self-test finds any difference from the JS
 * reference - in every such case the game simply keeps using the JavaScript reference code, which gives identical results.
 */
export async function loadNativeCore({ url = "/wasm/lq_core.wasm", logger = console, instantiate = WebAssembly.instantiate.bind(WebAssembly), fetchBytes = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); } } = {}) {
  try {
    const bytes = await fetchBytes(url);
    const { instance } = await instantiate(bytes, {});
    const x = instance.exports; const mem = x.memory.buffer;
    const f32 = (ptr, n) => new Float32Array(mem, ptr, n); const f64 = (ptr, n) => new Float64Array(mem, ptr, n);
    const core = {
      ambient: { pos: f32(x.amb_pos_ptr(), AMB_MAX * 3), base: f32(x.amb_base_ptr(), AMB_MAX * 3), seed: f32(x.amb_seed_ptr(), AMB_MAX), step: (n, t, dz) => x.ambient_step(n, t, dz) },
      fx: { pos: f32(x.fx_pos_ptr(), FX_MAX * 3), col: f32(x.fx_col_ptr(), FX_MAX * 3), vel: f32(x.fx_vel_ptr(), FX_MAX * 3), base: f32(x.fx_base_ptr(), FX_MAX * 3), life: f32(x.fx_life_ptr(), FX_MAX), maxLife: f32(x.fx_maxlife_ptr(), FX_MAX), step: (n, dt, dz) => x.fx_step(n, dt, dz) },
      collide: { items: f64(x.items_ptr(), MAX_ITEMS * ITEM_STRIDE), obstacles: f64(x.obstacles_ptr(), MAX_OBSTACLES * OBS_STRIDE), hits: new Int32Array(mem, x.hits_ptr(), MAX_ITEMS), collectibles: x.collide_collectibles, obstacle: x.collide_obstacle },
      seedRng: x.rng_seed, exports: x, bytes: bytes.byteLength,
    };
    const problem = selfTest(core);
    if (problem) { logger.warn?.(`[LearnQuest] Native core disabled: self-test failed (${problem}); using the JavaScript reference`); return null; }
    logger.info?.(`[LearnQuest] Native core (C/C++ WebAssembly, ${bytes.byteLength} bytes) active: self-test passed`);
    return core;
  } catch (e) { logger.info?.(`[LearnQuest] Native core not used (${e.message}); using the JavaScript reference`); return null; }
}

/** Run the same small scenarios through WebAssembly and the JS reference; returns "" when identical. */
export function selfTest(core) {
  const same = (a, b) => { for (let i = 0; i < b.length; i++) if (!(a[i] === b[i])) return false; return true; };
  // ambient
  const A = makeAmbientBuffers(32); const ra = createRng(7); core.seedRng(7);
  for (let i = 0; i < 32; i++) { const v = [(i * 1.37) % 20 - 10, 0.5 + (i % 5), -60 + i * 2.3, i * 0.31]; for (const [arr, w] of [[A.base, null], [core.ambient.base, null]]) { arr[i * 3] = v[0]; arr[i * 3 + 1] = v[1]; arr[i * 3 + 2] = v[2]; } A.seed[i] = core.ambient.seed[i] = v[3]; }
  for (let s = 0; s < 40; s++) { ambientStep(A, 32, s * 0.016, 0.9, ra); core.ambient.step(32, s * 0.016, 0.9); }
  if (!same(core.ambient.pos, A.pos.subarray(0, 96)) || !same(core.ambient.base, A.base.subarray(0, 96))) return "ambient particles differ";
  // fx
  const F = makeFxBuffers(32);
  for (let i = 0; i < 32; i++) { const j = i * 3; for (const B of [F, core.fx]) { B.pos[j] = i * 0.1; B.pos[j + 1] = 1 + i * 0.05; B.pos[j + 2] = -i * 0.2; B.vel[j] = 0.3 * i; B.vel[j + 1] = 2; B.vel[j + 2] = -0.4 * i; B.base[j] = 1; B.base[j + 1] = 0.5; B.base[j + 2] = 0.2; B.life[i] = B.maxLife[i] = 0.2 + i * 0.03; } }
  for (let s = 0; s < 60; s++) { fxStep(F, 32, 0.016, 0.7); core.fx.step(32, 0.016, 0.7); }
  if (!same(core.fx.pos, F.pos.subarray(0, 96)) || !same(core.fx.col, F.col.subarray(0, 96)) || !same(core.fx.life, F.life.subarray(0, 32))) return "effect particles differ";
  // collisions
  const items = new Float64Array(MAX_ITEMS * ITEM_STRIDE), out = new Int32Array(MAX_ITEMS);
  for (let i = 0; i < 20; i++) { const v = [(i % 3 - 1) * 2.2, 0.5 + (i % 4) * 0.7, -2 + i * 0.25, i % 5 === 0 ? 1 : 0, i % 7 === 0 ? 1 : 0]; items.set(v, i * ITEM_STRIDE); core.collide.items.set(v, i * ITEM_STRIDE); }
  const n1 = collideCollectibles(items, 20, 0, 0, 1.55, 1.1, out), n2 = core.collide.collectibles(20, 0, 0, 1.55, 1.1);
  if (n1 !== n2 || !same(core.collide.hits.subarray(0, n2), out.subarray(0, n1))) return "collectible collision differs";
  const obs = new Float64Array(MAX_OBSTACLES * OBS_STRIDE); for (let i = 0; i < 8; i++) { const v = [(i % 3 - 1) * 2.2, -3 + i * 0.7, 0.68, 0.62, 0, 1.05]; obs.set(v, i * OBS_STRIDE); core.collide.obstacles.set(v, i * OBS_STRIDE); }
  if (collideObstacle(obs, 8, 0, 0, 0.42, 0.35, 1.55) !== core.collide.obstacle(8, 0, 0, 0.42, 0.35, 1.55)) return "obstacle collision differs";
  return "";
}
