/**
 * Device analysis: facts about the computer / phone -> the highest quality level it can sensibly run -> a render size.
 * Pure logic (the browser parts only collect facts), so it is unit-tested with many sample devices.
 *
 * Levels (render budget): ultra = up to 4K, high = up to 2K (1440p), balanced = Full HD, low = HD (720p), minimal = 540p.
 * The decision has three steps: (1) static analysis gives a safe starting level and a ceiling (cap),
 * (2) a short calibration on the real game scene tries higher levels and keeps the best one that holds the frame rate,
 * (3) adaptive resolution keeps adjusting while playing.
 */
import { detectGpuClass } from "./adaptive-resolution.js";
import { QUALITY } from "./config.js";

export const TIER_ORDER = Object.freeze(["minimal", "low", "balanced", "high", "ultra"]);
export const tierIndex = (t) => TIER_ORDER.indexOf(t);
export const lowerOf = (a, b) => (tierIndex(a) <= tierIndex(b) ? a : b);
export const stepDown = (t, n = 1) => TIER_ORDER[Math.max(0, tierIndex(t) - n)];

const CAP_BY_CLASS = { software: "low", entry: "balanced", integrated: "high", unknown: "high", discrete: "ultra" };
const START_BY_CLASS = { software: "low", entry: "balanced", integrated: "balanced", unknown: "balanced", discrete: "high" };

/** Facts collected by the browser (or invented by tests). All fields optional except gpu/screen. */
export function normalizeFacts(f = {}) {
  const dpr = Number(f.dpr) > 0 ? Number(f.dpr) : 1;
  const sw = Number(f.screenW) || 1280, sh = Number(f.screenH) || 720;
  const nw = Math.round(sw * dpr), nh = Math.round(sh * dpr);
  return {
    gpu: String(f.gpu || ""), dpr, screenW: sw, screenH: sh, native: { w: nw, h: nh, pixels: nw * nh },
    deviceMemory: Number(f.deviceMemory) || null, cores: Number(f.cores) || null, refreshHz: Number(f.refreshHz) || 60,
    touch: !!f.touch, mobile: !!f.mobile, saveData: !!f.saveData, battery: f.battery || null,
    maxTexture: Number(f.maxTexture) || null, maxSamples: Number(f.maxSamples) || null, maxAniso: Number(f.maxAniso) || null,
  };
}

/** Static analysis -> { gpuClass, cap, start, reasons }.  `cap` is the highest level calibration may try. */
export function analyseDevice(raw) {
  const f = normalizeFacts(raw); const reasons = []; const gpuClass = detectGpuClass(f.gpu);
  let cap = CAP_BY_CLASS[gpuClass]; let start = START_BY_CLASS[gpuClass];
  reasons.push(`graphics card is ${gpuClass} -> up to ${cap}`);
  const limit = (tier, why) => { const next = lowerOf(cap, tier); if (next !== cap) reasons.push(`${why} -> up to ${tier}`); cap = next; };
  if (f.deviceMemory != null) { if (f.deviceMemory <= 1) limit("minimal", "1 GB memory"); else if (f.deviceMemory <= 2) limit("low", "2 GB memory"); else if (f.deviceMemory <= 4) limit("balanced", `${f.deviceMemory} GB memory`); else if (f.deviceMemory <= 6) limit("high", `${f.deviceMemory} GB memory`); }
  if (f.cores != null) { if (f.cores <= 2) limit("low", `${f.cores} CPU cores`); else if (f.cores <= 4) limit("high", `${f.cores} CPU cores`); }
  if (f.maxTexture != null) { if (f.maxTexture < 4096) limit("low", `max texture ${f.maxTexture}`); else if (f.maxTexture < 8192) limit("high", `max texture ${f.maxTexture}`); }
  if (f.touch || f.mobile) limit(f.deviceMemory && f.deviceMemory >= 6 ? "high" : "balanced", "phone / tablet (heat, battery, memory limits of the app)");   // even a strong phone GPU (Apple, Adreno) is capped at 2K
  if (f.saveData) limit("balanced", "data saver");
  if (f.battery && f.battery.charging === false && f.battery.level != null && f.battery.level < 0.2) { limit(stepDown(cap), "low battery"); }
  start = lowerOf(start, cap);
  return { gpuClass, cap, start, reasons, facts: f };
}

/** Pixel size the game renders at for a tier on a display of native size (nw x nh): native, but never over the tier's budget. */
export function renderSizeFor(tier, nw, nh, maxTexture = 16384) {
  const budget = (QUALITY[tier] || QUALITY.balanced).maxPixels;
  let fit = Math.min(1, Math.sqrt(budget / Math.max(1, nw * nh)));
  fit = Math.min(fit, maxTexture / Math.max(nw, nh));
  return { w: Math.max(1, Math.round(nw * fit)), h: Math.max(1, Math.round(nh * fit)), fit };
}

/** Does a measured level hold the frame rate?  Needs ~60 fps (or the display's rate if lower), few long frames. */
export function passes(m, refreshHz = 60) {
  const target = Math.min(refreshHz || 60, 60);
  return !!m && m.frames >= 8 && m.avgFps >= target * 0.9 && m.p95Ms <= 26;
}

/**
 * Find the best level. `measure(tier)` resolves to {frames, avgFps, p95Ms}.
 *  start passes -> try higher levels (up to cap) while they pass; start fails -> go down until one passes (floor: minimal).
 *  An inconclusive measurement (frames < 8: hidden tab, stalled GPU) stops the search and keeps the best level proven so far.
 */
export async function calibrateTiers({ start, cap, measure, refreshHz = 60, maxProbes = 5, onProbe = () => {} }) {
  const probes = []; let probesLeft = maxProbes;
  const run = async (tier) => { onProbe(tier, probes.length + 1, maxProbes); const m = await measure(tier); const ok = passes(m, refreshHz); probes.push({ tier, ...m, pass: ok, conclusive: (m?.frames || 0) >= 8 }); probesLeft--; return probes[probes.length - 1]; };
  let idx = tierIndex(lowerOf(start, cap)); let best = null;
  let p = await run(TIER_ORDER[idx]);
  if (!p.conclusive) return { tier: lowerOf(start, cap), probes, conclusive: false };
  if (p.pass) {
    best = idx;
    while (probesLeft > 0 && idx < tierIndex(cap)) { idx++; p = await run(TIER_ORDER[idx]); if (!p.conclusive || !p.pass) break; best = idx; }
  } else {
    while (probesLeft > 0 && idx > 0) { idx--; p = await run(TIER_ORDER[idx]); if (!p.conclusive) break; if (p.pass) { best = idx; break; } }
    if (best == null) best = probes.some((q) => !q.conclusive) ? idx : 0;
  }
  return { tier: TIER_ORDER[best ?? idx], probes, conclusive: true };
}

/* ------------------------------------------------------------------ cache */
export const DEVICE_KEY = "learnquest.device.v1";
export const DEVICE_MODEL_VERSION = "2";   // bump when the quality model changes so every device is analysed again
export const deviceSignature = (f, version = "1") => [f.gpu, `${f.native.w}x${f.native.h}`, f.dpr, f.deviceMemory, f.cores, version].join("|");
export function readDeviceCache(storage, signature) {
  try { const c = JSON.parse(storage?.getItem(DEVICE_KEY) || "null"); if (c && c.signature === signature && TIER_ORDER.includes(c.tier)) return c; } catch { /* corrupt */ }
  return null;
}
export function writeDeviceCache(storage, record) { try { storage?.setItem(DEVICE_KEY, JSON.stringify(record)); } catch { /* blocked */ } }
export function clearDeviceCache(storage) { try { storage?.removeItem(DEVICE_KEY); } catch { /* ignore */ } }

/* ----------------------------------------------------------- browser facts */
/** Collect facts from the real browser. Everything is best-effort: a missing API never breaks the game. */
export async function collectBrowserFacts({ measureRefreshMs = 450, win = globalThis.window, nav = globalThis.navigator } = {}) {
  const f = { dpr: win?.devicePixelRatio || 1, screenW: win?.screen?.width, screenH: win?.screen?.height, deviceMemory: nav?.deviceMemory, cores: nav?.hardwareConcurrency };
  try {
    const gl = win.document.createElement("canvas").getContext("webgl2"); const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    f.gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : (gl ? "WebGL2" : "none");
    if (gl) { f.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE); f.maxSamples = gl.getParameter(gl.MAX_SAMPLES); const an = gl.getExtension("EXT_texture_filter_anisotropic"); f.maxAniso = an ? gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1; gl.getExtension("WEBGL_lose_context")?.loseContext(); }
  } catch { f.gpu = f.gpu || "unknown"; }
  // (the MacIntel + touch term below is iPadOS, which pretends to be a Mac)
  try { f.touch = (nav.maxTouchPoints || 0) > 0 && !!win.matchMedia?.("(pointer: coarse)").matches; f.mobile = !!nav.userAgentData?.mobile || /Android|iPhone|iPad|Mobile/i.test(nav.userAgent || "") || (nav.platform === "MacIntel" && (nav.maxTouchPoints || 0) > 1); f.saveData = !!nav.connection?.saveData; } catch { /* ignore */ }
  try { const b = await Promise.race([nav.getBattery?.(), new Promise((r) => setTimeout(() => r(null), 400))]); if (b) f.battery = { charging: b.charging, level: b.level }; } catch { /* ignore */ }
  f.refreshHz = await measureRefreshRate(win, measureRefreshMs);
  return f;
}

/** Display refresh rate from requestAnimationFrame spacing (60 when the tab is hidden / unmeasurable). */
export function measureRefreshRate(win = globalThis.window, ms = 450) {
  return new Promise((resolve) => {
    if (!win?.requestAnimationFrame || win.document?.hidden) return resolve(60);
    const t = []; let last = 0; const t0 = win.performance.now();
    const tick = (now) => { if (last) t.push(now - last); last = now; if (now - t0 < ms && t.length < 60) win.requestAnimationFrame(tick); else { t.sort((a, b) => a - b); const med = t.length >= 5 ? t[Math.floor(t.length / 2)] : 16.7; const hz = 1000 / med; resolve([30, 48, 50, 60, 75, 90, 100, 120, 144, 165, 240].reduce((b, c) => (Math.abs(c - hz) < Math.abs(b - hz) ? c : b), 60)); } };
    win.requestAnimationFrame(tick); setTimeout(() => resolve(60), ms + 800);
  });
}
