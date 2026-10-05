import { analyseDevice, renderSizeFor, readDeviceCache, deviceSignature, TIER_ORDER, tierIndex, DEVICE_MODEL_VERSION } from "../jungle-run/device-profile.js";
import { QUALITY } from "../jungle-run/config.js";

// The original runners share the same five levels as the new Jungle Run (minimal < low < balanced < high < ultra).
export const QUALITY_PROFILES = Object.freeze({
  minimal: { tier: "minimal", lowPower: true, pixelRatioCap: .75, shadowMapSize: 256, shadows: false, particleScale: .2 },
  low: { tier: "low", lowPower: true, pixelRatioCap: 1, shadowMapSize: 256, shadows: false, particleScale: .3 },
  balanced: { tier: "balanced", lowPower: false, pixelRatioCap: 1.35, shadowMapSize: 768, shadows: true, particleScale: .65 },
  high: { tier: "high", lowPower: false, pixelRatioCap: 1.75, shadowMapSize: 1024, shadows: true, particleScale: 1 },
  ultra: { tier: "ultra", lowPower: false, pixelRatioCap: 3, shadowMapSize: 2048, shadows: true, particleScale: 1 },
});

/** Synchronous device analysis for pages that cannot wait for the full calibration (graphics card, memory, cores, screen). */
export function deviceAnalysis(view = window, device = navigator) {
  try {
    const f = { dpr: view.devicePixelRatio || 1, screenW: view.screen?.width || view.innerWidth, screenH: view.screen?.height || view.innerHeight, deviceMemory: device.deviceMemory, cores: device.hardwareConcurrency, gpu: device.__gpu };
    f.touch = (device.maxTouchPoints || 0) > 0 && !!view.matchMedia?.("(pointer: coarse)").matches; f.mobile = !!device.userAgentData?.mobile || /Android|iPhone|iPad|Mobile/i.test(device.userAgent || "");
    if (f.gpu == null && view.document?.createElement) {
      const gl = view.document.createElement("canvas").getContext("webgl2"); const ext = gl?.getExtension("WEBGL_debug_renderer_info");
      f.gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ""; if (gl) { f.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE); gl.getExtension("WEBGL_lose_context")?.loseContext(); }
    }
    return analyseDevice(f);
  } catch { return null; }
}

/** Starting level: the result the new Jungle Run measured on this very device, else the static analysis. */
export function hintedQualityTier(view = window, device = navigator) {
  const a = deviceAnalysis(view, device);
  if (!a) return (view.innerWidth < 700 || (device.hardwareConcurrency && device.hardwareConcurrency <= 4)) ? "balanced" : "high";
  const cached = readDeviceCache(view.localStorage, deviceSignature(a.facts, DEVICE_MODEL_VERSION));
  return cached ? cached.tier : a.start;
}
/** Highest level this device may step up to while playing. */
export function deviceCapTier(view = window, device = navigator) { return deviceAnalysis(view, device)?.cap || "high"; }

export function runnerQualityProfile(view = window, device = navigator, tier = hintedQualityTier(view, device)) {
  const profile = QUALITY_PROFILES[tier] || QUALITY_PROFILES.balanced;
  const dpr = view.devicePixelRatio || 1, w = view.innerWidth || 1280, h = view.innerHeight || Math.round(w * 0.5625);
  const budget = renderSizeFor(QUALITY[tier] ? tier : "balanced", w * dpr, h * dpr).w / w;       // native size, capped by the level's pixel budget (4K / 2K / Full HD / HD / 540p)
  return { ...profile, pixelRatio: Math.min(dpr, profile.pixelRatioCap, budget) };
}

export class RuntimeQualityManager {
  constructor({ initialTier = "balanced", cap = "high", sampleSize = 45, onChange = () => {} } = {}) {
    this.tier = QUALITY_PROFILES[initialTier] ? initialTier : "balanced";
    this.cap = QUALITY_PROFILES[cap] ? cap : "high";
    this.sampleSize = sampleSize;
    this.onChange = onChange;
    this.samples = [];
    this.cooldown = 0;
  }

  recordFrame(frameMs) {
    if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 1000) return this.tier;
    this.samples.push(frameMs);
    if (this.samples.length < this.sampleSize) return this.tier;
    const average = this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length;
    this.samples.length = 0;
    if (this.cooldown > 0) { this.cooldown -= 1; return this.tier; }
    const i = tierIndex(this.tier);
    const next = average > 30 ? TIER_ORDER[Math.max(0, i - 1)] : average < 18 ? TIER_ORDER[Math.min(tierIndex(this.cap), i + 1)] : this.tier;
    if (next !== this.tier) {
      this.tier = next; this.cooldown = 2;
      const view = typeof window !== "undefined" ? window : { innerWidth: 1000, devicePixelRatio: 1 };
      this.onChange(runnerQualityProfile(view, typeof navigator !== "undefined" ? navigator : {}, next));
    }
    return this.tier;
  }
}

export function resizeRunnerView(renderer, camera, width, height) {
  if (!renderer || !camera) return;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.fov = width < 700 ? 68 : 62;
  camera.updateProjectionMatrix();
}

export function disposeObject3D(group) {
  group?.traverse?.((object) => {
    object.geometry?.dispose?.();
    if (!object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      material.map?.dispose?.();
      material.dispose?.();
    });
  });
}
