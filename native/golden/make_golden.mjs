// Writes native/golden/golden.txt: inputs and the JavaScript results for the engine kernels and the device logic.
// The Python and Java ports (native/python, native/java) must reproduce every line exactly.  Run: node native/golden/make_golden.mjs
import fs from "node:fs";
import * as R from "../../frontend/js/game/jungle-run/native-reference.js";
import { analyseDevice, renderSizeFor, passes, calibrateTiers, TIER_ORDER } from "../../frontend/js/game/jungle-run/device-profile.js";

const rng = R.createRng(2024); const U = (a, b) => a + (b - a) * rng.next(); const I = (a, b) => a + Math.floor(rng.next() * (b - a + 1));
const L = []; const P = (...t) => L.push(t.map((v) => (typeof v === "boolean" ? (v ? 1 : 0) : v)).join(" "));
const arr = (a, n) => Array.from(a.subarray ? a.subarray(0, n) : a.slice(0, n));

for (let i = 0; i < 400; i++) { const x = U(-3000, 3000); P("SIN", x, R.fastSin(x)); }
for (const seed of [1, 7, 2463534242, 4294967295]) { const r = R.createRng(seed); const v = []; for (let i = 0; i < 300; i++) v.push(r.next()); P("RNG", seed, v.length, ...v); }
for (let w = 0; w < 20; w++) {
  const n = I(1, 60), steps = 30, seed = I(1, 1e6), t0 = w * 1.3, dz = 0.2 + w * 0.05; const A = R.makeAmbientBuffers(); const init = [];
  for (let i = 0; i < n; i++) { const v = [U(-17, 17), U(0.4, 5), U(-70, 8), U(0, 6.28)]; A.base[i * 3] = v[0]; A.base[i * 3 + 1] = v[1]; A.base[i * 3 + 2] = v[2]; A.seed[i] = v[3]; init.push(A.base[i * 3], A.base[i * 3 + 1], A.base[i * 3 + 2], A.seed[i]); }
  const r = R.createRng(seed); for (let s = 0; s < steps; s++) R.ambientStep(A, n, s * 0.016 + t0, dz, r);
  P("AMB", n, steps, seed, t0, dz, "|", ...init, "|", ...arr(A.pos, n * 3), "|", ...arr(A.base, n * 3));
}
for (let w = 0; w < 20; w++) {
  const n = I(1, 80), steps = 40, dt = 0.016, dz = 0.1 + w * 0.04; const F = R.makeFxBuffers(); const init = [];
  for (let i = 0; i < n; i++) { const j = i * 3, life = U(0.05, 1.2); const v = [U(-3, 3), U(0, 3), U(-5, 1), U(-5, 5), U(-1, 6), U(-3, 3), U(0, 1), U(0, 1), U(0, 1)]; for (let k = 0; k < 3; k++) { F.pos[j + k] = v[k]; F.vel[j + k] = v[3 + k]; F.base[j + k] = v[6 + k]; } F.life[i] = F.maxLife[i] = life; init.push(F.pos[j], F.pos[j + 1], F.pos[j + 2], F.vel[j], F.vel[j + 1], F.vel[j + 2], F.base[j], F.base[j + 1], F.base[j + 2], F.life[i]); }
  for (let s = 0; s < steps; s++) R.fxStep(F, n, dt, dz);
  P("FX", n, steps, dt, dz, "|", ...init, "|", ...arr(F.pos, n * 3), "|", ...arr(F.col, n * 3), "|", ...arr(F.life, n));
}
for (let c = 0; c < 400; c++) {
  const n = I(0, 30), items = new Float64Array(R.MAX_ITEMS * R.ITEM_STRIDE), out = new Int32Array(R.MAX_ITEMS); const flat = [];
  for (let i = 0; i < n; i++) { const v = [U(-3, 3), U(-0.5, 3), U(-14, 3), rng.next() < 0.1 ? 1 : 0, rng.next() < 0.05 ? 1 : 0]; items.set(v, i * 5); flat.push(...v); }
  const px = [-2.2, 0, 2.2, U(-3, 3)][c & 3], py = rng.next() < 0.5 ? 0 : U(0, 1.8), h = rng.next() < 0.7 ? 1.55 : 0.75, rz = U(0.8, 1.8);
  const k = R.collideCollectibles(items, n, px, py, h, rz, out); P("COLL", n, px, py, h, rz, "|", ...flat, "|", k, ...arr(out, k));
}
for (let c = 0; c < 400; c++) {
  const n = I(0, 8), obs = new Float64Array(R.MAX_OBSTACLES * R.OBS_STRIDE); const flat = [];
  for (let i = 0; i < n; i++) { const beam = rng.next() < 0.4; const v = [[-2.2, 0, 2.2][I(0, 2)] + U(-0.3, 0.3), U(-8, 4), beam ? 0.95 : 0.68, beam ? 0.4 : 0.62, beam ? 0.98 : 0, beam ? 1.3 : 1.05]; obs.set(v, i * 6); flat.push(...v); }
  const px = [-2.2, 0, 2.2, U(-3, 3)][c & 3], py = rng.next() < 0.5 ? 0 : U(0, 1.9), h = rng.next() < 0.7 ? 1.55 : 0.75;
  P("OBS", n, px, py, 0.42, 0.35, h, "|", ...flat, "|", R.collideObstacle(obs, n, px, py, 0.42, 0.35, h));
}
// ---- device logic. Device lines are TAB separated because GPU names contain spaces.
const GPUS = ["ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)", "ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11)", "ANGLE (NVIDIA, NVIDIA GeForce GT 730 (0x00001287) Direct3D11 vs_5_0 ps_5_0, D3D11)", "ANGLE (Intel, Intel(R) HD Graphics 520 (0x00001916) Direct3D11 vs_5_0 ps_5_0, D3D11)", "ANGLE (Intel, Intel(R) UHD Graphics 620)", "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)", "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)", "ANGLE (AMD, AMD Radeon RX 580 Direct3D11)", "ANGLE (AMD, AMD Radeon HD 7570 Direct3D11)", "ANGLE (Qualcomm, Adreno (TM) 619, OpenGL ES 3.2)", "Mali-G52", "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)", "ANGLE (NVIDIA, NVIDIA GeForce GT 1030 Direct3D11)", "ANGLE (NVIDIA, NVIDIA GeForce MX150 Direct3D11)", "ANGLE (NVIDIA, NVIDIA GeForce GTX 750 Ti Direct3D11)", "ANGLE (NVIDIA, NVIDIA GeForce 940MX Direct3D11)", "ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11)", "ANGLE (NVIDIA, NVIDIA Quadro K620 Direct3D11)", "Unknown GPU", ""];
for (let c = 0; c < 120; c++) {
  const f = { gpu: GPUS[I(0, GPUS.length - 1)], screenW: [412, 800, 1280, 1366, 1440, 1920, 2560, 3840][I(0, 7)], screenH: [915, 720, 800, 900, 1080, 1440, 2160][I(0, 6)], dpr: [1, 1.25, 1.5, 1.65, 2, 2.6][I(0, 5)], deviceMemory: [null, 1, 2, 4, 6, 8, 16][I(0, 6)], cores: [null, 1, 2, 4, 8, 16][I(0, 5)], maxTexture: [null, 2048, 4096, 8192, 16384][I(0, 4)], touch: rng.next() < 0.2, mobile: rng.next() < 0.2, saveData: rng.next() < 0.1, battery: rng.next() < 0.3 ? { charging: rng.next() < 0.5, level: [0.05, 0.19, 0.2, 0.8][I(0, 3)] } : null };
  const a = analyseDevice(f);
  L.push(["DEVICE", f.gpu, f.screenW, f.screenH, f.dpr, f.deviceMemory ?? "null", f.cores ?? "null", f.maxTexture ?? "null", +f.touch, +f.mobile, +f.saveData, f.battery ? +f.battery.charging : "null", f.battery ? f.battery.level : "null", a.gpuClass, a.cap, a.start, a.facts.native.w, a.facts.native.h].join("\t"));
}
for (let c = 0; c < 200; c++) { const tier = TIER_ORDER[I(0, 4)], nw = I(300, 8000), nh = I(300, 5000), mt = [4096, 8192, 16384][I(0, 2)]; const r = renderSizeFor(tier, nw, nh, mt); P("RSZ", tier, nw, nh, mt, r.w, r.h); }
for (let c = 0; c < 150; c++) { const m = { frames: I(0, 80), avgFps: U(5, 150), p95Ms: U(5, 80) }, hz = [30, 60, 75, 120, 144][I(0, 4)]; P("PASS", m.frames, m.avgFps, m.p95Ms, hz, +passes(m, hz)); }
for (let c = 0; c < 150; c++) {
  const start = TIER_ORDER[I(0, 4)], cap = TIER_ORDER[I(0, 4)], fps = {}; for (const t of TIER_ORDER) fps[t] = rng.next() < 0.12 ? null : U(8, 90);
  const log = []; const res = await calibrateTiers({ start, cap, refreshHz: 60, measure: async (tier) => { log.push(tier); const f = fps[tier]; return f == null ? { frames: 0, avgFps: 0, p95Ms: 0 } : { frames: 60, avgFps: f, p95Ms: f >= 55 ? 18 : 40 }; } });
  P("CAL", start, cap, ...TIER_ORDER.map((t) => (fps[t] == null ? "null" : fps[t])), "|", res.tier, +res.conclusive, log.join(","));
}
fs.writeFileSync(new URL("./golden.txt", import.meta.url), L.join("\n") + "\n");
console.log(`golden.txt: ${L.length} records`);
