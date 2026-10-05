// Verifies the C / C++ WebAssembly core against the JavaScript reference (exact equality) and measures the speed difference.
// Run: npm run native:test
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadNativeCore, selfTest } from "../frontend/js/game/jungle-run/native-core.js";
import * as R from "../frontend/js/game/jungle-run/native-reference.js";

const bytes = fs.readFileSync(new URL("../frontend/wasm/lq_core.wasm", import.meta.url));
const core = await loadNativeCore({ fetchBytes: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), logger: { info() {}, warn(m) { console.log(m); } } });
assert.ok(core, "WebAssembly core failed to load or its self-test failed");
let passed = 0; const test = (name, fn) => { fn(); passed++; console.log("  ok -", name); };
const rnd = R.createRng(12345); const U = (a, b) => a + (b - a) * rnd.next();
const sameArr = (a, b, what) => { for (let i = 0; i < b.length; i++) if (!Object.is(a[i], b[i]) && !(a[i] === b[i])) assert.fail(`${what}[${i}]: wasm ${a[i]} != js ${b[i]}`); };

console.log("native core: C / C++ WebAssembly vs JavaScript reference");
test(`module is tiny and self-contained (${core.bytes} bytes, no imports)`, () => { assert.ok(core.bytes < 8192); assert.equal(WebAssembly.Module.imports(new WebAssembly.Module(bytes)).length, 0); });
test("start-up self-test passes", () => assert.equal(selfTest(core), ""));
test("fast sine: identical to the JS version on 100,000 inputs, and within 1e-7 of Math.sin", () => {
  let worst = 0; for (let i = 0; i < 100000; i++) { const x = U(-2000, 2000); const a = core.exports.fast_sin_export(x), b = R.fastSin(x); assert.ok(Object.is(a, b), `x=${x}`); worst = Math.max(worst, Math.abs(b - Math.sin(x))); } assert.ok(worst < 1e-7, `worst ${worst}`);
});
test("random generator: identical xorshift sequence for 100,000 draws and several seeds", () => {
  for (const seed of [1, 7, 2463534242, 4294967295, 99999]) { core.seedRng(seed); const r = R.createRng(seed); for (let i = 0; i < 20000; i++) assert.ok(Object.is(core.exports.rnd_export(), r.next()), `seed ${seed} draw ${i}`); }
});
test("ambient particles: identical positions after 300 random worlds x 120 steps", () => {
  for (let w = 0; w < 300; w++) {
    const n = 1 + Math.floor(rnd.next() * 200); const A = R.makeAmbientBuffers(); const seed = 1 + Math.floor(rnd.next() * 1e6); const ra = R.createRng(seed); core.seedRng(seed);
    for (let i = 0; i < n; i++) { const v = [U(-17, 17), U(0.4, 5), U(-70, 8), U(0, 6.28)]; for (const B of [A, core.ambient]) { B.base[i * 3] = v[0]; B.base[i * 3 + 1] = v[1]; B.base[i * 3 + 2] = v[2]; B.seed[i] = v[3]; } }
    for (let s = 0; s < 120; s++) { const t = s * 0.016 + w, dz = U(0, 1.2); R.ambientStep(A, n, t, dz, ra); core.ambient.step(n, t, dz); }
    sameArr(core.ambient.pos, A.pos.subarray(0, n * 3), "pos"); sameArr(core.ambient.base, A.base.subarray(0, n * 3), "base");
  }
});
test("effect particles: identical positions, colours and lifetimes after 300 random bursts x 100 steps", () => {
  for (let w = 0; w < 300; w++) {
    const n = 1 + Math.floor(rnd.next() * 400); const F = R.makeFxBuffers();
    for (let i = 0; i < n; i++) { const j = i * 3; const life = U(0.05, 1.5); const v = [U(-3, 3), U(0, 3), U(-5, 1), U(-5, 5), U(-1, 6), U(-3, 3), U(0, 1), U(0, 1), U(0, 1)]; for (const B of [F, core.fx]) { B.pos[j] = v[0]; B.pos[j + 1] = v[1]; B.pos[j + 2] = v[2]; B.vel[j] = v[3]; B.vel[j + 1] = v[4]; B.vel[j + 2] = v[5]; B.base[j] = v[6]; B.base[j + 1] = v[7]; B.base[j + 2] = v[8]; B.life[i] = B.maxLife[i] = life; } }
    for (let s = 0; s < 100; s++) { const dt = U(0.004, 0.05), dz = U(0, 1.5); R.fxStep(F, n, dt, dz); core.fx.step(n, dt, dz); }
    for (const k of ["pos", "col", "vel", "life"]) sameArr(core.fx[k], F[k].subarray(0, k === "life" ? n : n * 3), k);
  }
});
test("collectible collisions (C++): identical hits on 200,000 random situations", () => {
  const items = new Float64Array(R.MAX_ITEMS * R.ITEM_STRIDE), out = new Int32Array(R.MAX_ITEMS);
  for (let c = 0; c < 200000; c++) {
    const n = Math.floor(rnd.next() * 100); for (let i = 0; i < n; i++) { const v = [U(-3, 3), U(-0.5, 3), U(-14, 3), rnd.next() < 0.1 ? 1 : 0, rnd.next() < 0.05 ? 1 : 0]; items.set(v, i * R.ITEM_STRIDE); core.collide.items.set(v, i * R.ITEM_STRIDE); }
    const px = [-2.2, 0, 2.2, U(-3, 3)][c & 3], py = rnd.next() < 0.5 ? 0 : U(0, 1.8), h = rnd.next() < 0.7 ? 1.55 : 0.75, rz = U(0.8, 1.8);
    const a = R.collideCollectibles(items, n, px, py, h, rz, out), b = core.collide.collectibles(n, px, py, h, rz);
    assert.equal(b, a, `case ${c}`); for (let i = 0; i < a; i++) assert.equal(core.collide.hits[i], out[i]);
  }
});
test("obstacle collisions (C++): identical result on 200,000 random situations (rocks, beams, jumping, sliding)", () => {
  const obs = new Float64Array(R.MAX_OBSTACLES * R.OBS_STRIDE);
  for (let c = 0; c < 200000; c++) {
    const n = Math.floor(rnd.next() * 12); for (let i = 0; i < n; i++) { const beam = rnd.next() < 0.4; const v = [[-2.2, 0, 2.2][Math.floor(rnd.next() * 3)] + U(-0.3, 0.3), U(-8, 4), beam ? 0.95 : 0.68, beam ? 0.4 : 0.62, beam ? 0.98 : 0, beam ? 1.3 : 1.05]; obs.set(v, i * R.OBS_STRIDE); core.collide.obstacles.set(v, i * R.OBS_STRIDE); }
    const px = [-2.2, 0, 2.2, U(-3, 3)][c & 3], py = rnd.next() < 0.5 ? 0 : U(0, 1.9), h = rnd.next() < 0.7 ? 1.55 : 0.75;
    assert.equal(core.collide.obstacle(n, px, py, 0.42, 0.35, h), R.collideObstacle(obs, n, px, py, 0.42, 0.35, h), `case ${c}`);
  }
});

test("a missing, corrupt or tampered module never breaks the game: the loader returns null and JavaScript is used", async () => {});
{
  const quiet = { info() {}, warn() {} };
  assert.equal(await loadNativeCore({ fetchBytes: async () => { throw new Error("HTTP 404"); }, logger: quiet }), null);
  assert.equal(await loadNativeCore({ fetchBytes: async () => new Uint8Array([1, 2, 3, 4]).buffer, logger: quiet }), null);
  const bad = new Uint8Array(bytes); const needle = new Uint8Array(new Float64Array([0.6]).buffer); let at = -1;
  for (let i = 0; i < bad.length - 8; i++) { let m = true; for (let k = 0; k < 8; k++) if (bad[i + k] !== needle[k]) { m = false; break; } if (m) { at = i; break; } }
  assert.ok(at > 0, "constant not found"); bad.set(new Uint8Array(new Float64Array([0.61]).buffer), at);       // a "bug" in the compiled code
  assert.equal(await loadNativeCore({ fetchBytes: async () => bad.buffer, logger: quiet }), null);
  passed++; console.log("  ok - missing / corrupt / tampered module -> loader returns null (JavaScript takes over)");
}
console.log(`\n${passed} tests passed\n\nspeed (this machine, Node ${process.versions.node}; ms per call, lower is better):`);
const bench = (label, fnJs, fnWasm, iters) => {
  for (let i = 0; i < 2000; i++) { fnJs(i); fnWasm(i); }
  const t0 = performance.now(); for (let i = 0; i < iters; i++) fnJs(i); const js = (performance.now() - t0) / iters;
  const t1 = performance.now(); for (let i = 0; i < iters; i++) fnWasm(i); const wa = (performance.now() - t1) / iters;
  console.log(`  ${label.padEnd(44)} JS ${js.toFixed(5)} ms | WASM ${wa.toFixed(5)} ms | x${(js / wa).toFixed(2)}`); return { js, wa };
};
{
  const A = R.makeAmbientBuffers(); for (let i = 0; i < 110; i++) { A.base[i * 3] = U(-17, 17); A.base[i * 3 + 1] = U(0.4, 5); A.base[i * 3 + 2] = U(-70, 8); A.seed[i] = U(0, 6.28); }
  const ra = R.createRng(3); bench("ambient particles (110)", (i) => R.ambientStep(A, 110, i * 0.016, 0.16, ra), (i) => core.ambient.step(110, i * 0.016, 0.16), 60000);
  const F = R.makeFxBuffers(); for (let i = 0; i < 220; i++) { F.life[i] = F.maxLife[i] = 100000; F.vel[i * 3 + 1] = 1; core.fx.life[i] = core.fx.maxLife[i] = 100000; core.fx.vel[i * 3 + 1] = 1; }
  bench("effect particles (220)", (i) => R.fxStep(F, 220, 0.016, 0.16), (i) => core.fx.step(220, 0.016, 0.16), 60000);
  const items = new Float64Array(R.MAX_ITEMS * R.ITEM_STRIDE), out = new Int32Array(R.MAX_ITEMS);
  const fill = (dst, i) => { for (let k = 0; k < 50; k++) { const o = k * 5; dst[o] = (k % 3 - 1) * 2.2; dst[o + 1] = 1.05; dst[o + 2] = -k * 0.9 + (i % 7) * 0.01; dst[o + 3] = 0; dst[o + 4] = 0; } };
  bench("collectible collision (50 items, incl. copy-in)", (i) => { fill(items, i); R.collideCollectibles(items, 50, 0, 0, 1.55, 1.1, out); }, (i) => { fill(core.collide.items, i); core.collide.collectibles(50, 0, 0, 1.55, 1.1); }, 200000);
}
