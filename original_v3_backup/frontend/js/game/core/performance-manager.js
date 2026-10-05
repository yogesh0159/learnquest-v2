export const QUALITY_PROFILES = Object.freeze({
  high: { tier: "high", lowPower: false, pixelRatioCap: 1.75, shadowMapSize: 1024, shadows: true, particleScale: 1 },
  balanced: { tier: "balanced", lowPower: false, pixelRatioCap: 1.35, shadowMapSize: 768, shadows: true, particleScale: .65 },
  low: { tier: "low", lowPower: true, pixelRatioCap: 1, shadowMapSize: 256, shadows: false, particleScale: .3 },
});

export function hintedQualityTier(view = window, device = navigator) {
  if (view.innerWidth < 700 || (device.hardwareConcurrency && device.hardwareConcurrency <= 4)) return "balanced";
  return "high";
}

export function runnerQualityProfile(view = window, device = navigator, tier = hintedQualityTier(view, device)) {
  const profile = QUALITY_PROFILES[tier] || QUALITY_PROFILES.balanced;
  return { ...profile, pixelRatio: Math.min(view.devicePixelRatio || 1, profile.pixelRatioCap) };
}

export class RuntimeQualityManager {
  constructor({ initialTier = "balanced", sampleSize = 45, onChange = () => {} } = {}) {
    this.tier = QUALITY_PROFILES[initialTier] ? initialTier : "balanced";
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
    const next = average > 30 ? (this.tier === "high" ? "balanced" : "low")
      : average < 18 ? (this.tier === "low" ? "balanced" : "high") : this.tier;
    if (next !== this.tier) { this.tier = next; this.cooldown = 2; this.onChange(runnerQualityProfile({ innerWidth: 1000, devicePixelRatio: 1 }, {}, next)); }
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
