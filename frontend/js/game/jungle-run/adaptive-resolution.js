/**
 * Dynamic resolution + GPU class helpers (pure logic, unit-testable).
 *
 * Integrated GPUs (e.g. Intel HD 520) are limited by how many pixels they shade. Instead of asking the child to pick a
 * quality level, the renderer watches its own frame time and quietly lowers / raises the render resolution to stay smooth.
 */
export class AdaptiveResolution {
  constructor({ min = 0.5, max = 1, targetMs = 33, upMs = 21, intervalMs = 700, down = 0.88, up = 1.06 } = {}) {
    Object.assign(this, { min, max, targetMs, upMs, intervalMs, down, up });
    this.scale = max; this.ema = null; this.lastChange = 0;
  }
  /** Feed one frame time in ms (outliers such as tab switches or one-off compile stalls are clamped). */
  push(ms) { const v = Math.min(120, Math.max(1, ms)); this.ema = this.ema == null ? v : this.ema * 0.9 + v * 0.1; }
  /** @returns {number|null} the new scale when it should change, else null */
  tick(nowMs) {
    if (this.ema == null || nowMs - this.lastChange < this.intervalMs) return null;
    let next = this.scale;
    if (this.ema > this.targetMs) next = Math.max(this.min, this.scale * this.down);
    else if (this.ema < this.upMs) next = Math.min(this.max, this.scale * this.up);
    next = Math.round(next * 100) / 100;
    if (next === this.scale) return null;
    this.scale = next; this.lastChange = nowMs; return next;
  }
  setMax(max) { this.max = max; this.scale = Math.min(this.scale, max); }
  reset() { this.scale = this.max; this.ema = null; }
}

/**
 * Classify the GPU from the WEBGL_debug_renderer_info string.
 *  software   : CPU rendering              -> low
 *  entry      : old / entry-level discrete cards (GeForce GT 7xx, GT 1030, MX, old Quadro/Radeon HD). A real report from a
 *               GeForce GT 730 at 1080p measured only 28 fps on High, so these must not start on High -> balanced
 *  discrete   : GTX / RTX / Radeon RX / Apple M -> high
 *  integrated : Intel / Mali / Adreno ...        -> balanced
 */
export function detectGpuClass(renderer = "") {
  const s = String(renderer).toLowerCase();
  if (/swiftshader|llvmpipe|software|microsoft basic/.test(s)) return "software";
  if (/geforce\s*(gt|gts|mx)\s*\d|\bgt\s?\d{3,4}\b|geforce\s*(gtx\s*)?[6-7]\d{2}\b|geforce\s*(gtx\s*)?10[0-3]0\b|geforce\s*(8|9)\d{2}(m|mx)?\b|quadro\s*[kpmnv]?\d{2,4}\b|radeon\s*(hd\s*\d{4}|r[2-5]\b|r7\s*2\d{2})|nvidia\s*nvs|geforce\s*mx/.test(s)) return "entry";
  if (/nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|arc a\d|apple m\d|apple gpu/.test(s)) return "discrete";
  if (/intel|uhd|hd graphics|iris|mali|adreno|powervr|vega \d|radeon\(tm\) graphics|radeon graphics|videocore/.test(s)) return "integrated";
  return "unknown";
}
export const defaultTierFor = (cls) => ({ discrete: "high", entry: "balanced", integrated: "balanced", software: "low", unknown: "balanced" }[cls] || "balanced");
