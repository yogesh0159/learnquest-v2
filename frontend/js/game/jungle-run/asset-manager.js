import * as THREE from "three";
import { GLTFLoader } from "/vendor/three-addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "/vendor/three-addons/utils/SkeletonUtils.js";
import { ASSET_REGISTRY } from "./config.js";

const TAG = "[LearnQuest]";

export class AssetLoadError extends Error {
  constructor(key, url, cause) {
    super(`Asset "${key}" failed to load from ${url}: ${cause?.message || cause}`);
    this.name = "AssetLoadError"; this.assetKey = key; this.url = url; this.cause = cause;
  }
}

function countTriangles(root) {
  let tris = 0; let meshes = 0; let skinned = false;
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes++; skinned ||= !!o.isSkinnedMesh;
    const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return { tris: Math.round(tris), meshes, skinned };
}

/** Wrap a loaded scene so its bounding box obeys the registry `fit` spec. Returns the wrapper + metrics. */
export function normalizeModel(scene, fit) {
  const scaler = new THREE.Group(); scaler.name = "normalize-scale";
  const yawer = new THREE.Group(); yawer.name = "normalize-yaw";
  yawer.rotation.y = fit.yaw || 0;
  yawer.add(scene); scaler.add(yawer);
  const box = new THREE.Box3(); const size = new THREE.Vector3();
  const measure = () => { scaler.updateMatrixWorld(true); box.setFromObject(scaler); box.getSize(size); return size; };

  measure();
  const raw = size.clone();
  if (fit.mode === "height") scaler.scale.setScalar(fit.value / Math.max(1e-6, size.y));
  else if (fit.mode === "maxDim") scaler.scale.setScalar(fit.value / Math.max(size.x, size.y, size.z, 1e-6));
  else if (fit.mode === "width") scaler.scale.setScalar(fit.value / Math.max(1e-6, size.x));
  else if (fit.mode === "box") scaler.scale.set(fit.size[0] / Math.max(1e-6, size.x), fit.size[1] / Math.max(1e-6, size.y), fit.size[2] / Math.max(1e-6, size.z));
  measure();

  // Re-centre XZ, then place the anchor (bottom or centre) on y = 0.
  const cx = (box.min.x + box.max.x) / 2; const cz = (box.min.z + box.max.z) / 2;
  const y = fit.anchor === "center" ? (box.min.y + box.max.y) / 2 : box.min.y;
  scaler.position.set(-cx, -y, -cz);

  const root = new THREE.Group();
  root.add(scaler);
  root.updateMatrixWorld(true);
  const finalBox = new THREE.Box3().setFromObject(root);
  return { root, scaler, rawSize: raw, size: finalBox.getSize(new THREE.Vector3()), box: finalBox };
}

/** Raycast straight down the road centre to find where the walkable surface really is. */
function findWalkSurfaceY(root) {
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, -1, 0));
  const hits = ray.intersectObject(root, true);
  return hits.length ? hits[0].point.y : null;
}

export class AssetManager {
  /**
   * @param {{renderer?: THREE.WebGLRenderer, logger?: Console, onProgress?: (p:{loaded:number,total:number,fraction:number,label:string})=>void}} opts
   */
  constructor({ renderer = null, logger = console, onProgress = () => {} } = {}) {
    this.renderer = renderer;
    this.logger = logger;
    this.onProgress = onProgress;
    this.loader = new GLTFLoader();
    this.entries = new Map();     // key -> { root, info, clips, usedFallback, status }
    this.pending = new Map();     // key -> Promise (so each GLB loads once, even under concurrent requests)
    this.progress = new Map();    // key -> { loaded, total }
    this.fallbackFactories = new Map();
    this.failures = []; this.textures = new Set();
  }

  registerFallback(key, factory) { this.fallbackFactories.set(key, factory); }

  has(key) { return this.entries.has(key); }
  info(key) { return this.entries.get(key)?.info || null; }
  clips(key) { return this.entries.get(key)?.clips || []; }

  _emitProgress(label) {
    let loaded = 0; let total = 0;
    for (const p of this.progress.values()) { loaded += p.loaded; total += p.total || p.loaded; }
    this.onProgress({ loaded, total, fraction: total ? Math.min(1, loaded / total) : 0, label });
  }

  _fetchOnce(key, url) {
    return new Promise((resolve, reject) => {
      this.loader.load(url, resolve, (e) => {
        if (e.lengthComputable) { this.progress.set(key, { loaded: e.loaded, total: e.total }); this._emitProgress(ASSET_REGISTRY[key]?.label || key); }
      }, reject);
    });
  }

  /** Network blips (a dropped keep-alive connection, a busy disk) are retried before we give up on a file. */
  async _fetchGltf(key, url, retries = 2) {
    for (let attempt = 0; ; attempt++) {
      try { return await this._fetchOnce(key, url); }
      catch (error) {
        if (attempt >= retries) throw error;
        this.logger.warn?.(`${TAG} ${key}: load failed (${error?.message || error}), retry ${attempt + 1}/${retries}...`);
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
  }

  /** Make the baked flame texels (saturated orange/yellow) self-lit so sun + tone mapping cannot wash them out. */
  _applyFlameGlow(root) {
    const seen = new Set();
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m || seen.has(m) || !m.map) continue; seen.add(m);
        m.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader
            .replace("#include <map_fragment>", `#include <map_fragment>
              float lqSat = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)) - min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
              float lqFlame = smoothstep(0.62, 0.85, lqSat) * step(diffuseColor.b + 0.25, diffuseColor.r) * step(diffuseColor.g, diffuseColor.r + 0.01);
              vec3 lqFlameCol = diffuseColor.rgb;
              diffuseColor.rgb *= (1.0 - 0.6 * lqFlame);`)
            .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
              totalEmissiveRadiance += lqFlameCol * lqFlame * 0.7;`);
        };
        m.customProgramCacheKey = () => "lq-flame-glow";
        m.needsUpdate = true;
      }
    });
  }

  _prepare(root) {
    const aniso = this.renderer ? Math.min(8, this.renderer.capabilities.getMaxAnisotropy()) : 1;
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (o.isSkinnedMesh) o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        for (const slot of ["map", "normalMap", "metalnessMap", "roughnessMap", "emissiveMap"]) {
          const t = m?.[slot]; if (t) { t.anisotropy = aniso; this.textures.add(t); }
        }
      }
    });
  }

  /** Optional low-triangle copy: same transform as the main model, and it SHARES the main model's materials (no extra textures on the GPU). */
  async _loadLod(entry, mainGltf, norm, spec) {
    try {
      const lod = await this._fetchGltf(entry.key + ":lod", spec.lodUrl);
      const a = [], b = []; mainGltf.scene.traverse((o) => o.isMesh && a.push(o)); lod.scene.traverse((o) => o.isMesh && b.push(o));
      if (a.length !== b.length) throw new Error(`LOD has ${b.length} meshes, expected ${a.length}`);
      b.forEach((m, i) => { const own = m.material; m.material = a[i].material; for (const mm of [].concat(own)) { mm.map?.dispose?.(); mm.dispose?.(); } });
      const yaw = new THREE.Group(); yaw.rotation.copy(norm.scaler.children[0].rotation); yaw.add(lod.scene);
      const scl = new THREE.Group(); scl.scale.copy(norm.scaler.scale); scl.position.copy(norm.scaler.position); scl.add(yaw);
      entry.lodRoot = new THREE.Group(); entry.lodRoot.add(scl);
      entry.info.lodTris = countTriangles(entry.lodRoot).tris;
      this.logger.info?.(`${TAG} ${spec.label}: LOD ready (${entry.info.lodTris.toLocaleString()} tris)`);
    } catch (error) { this.logger.warn?.(`${TAG} ${entry.key}: LOD unavailable (${error.message}); using the full model at every distance`); }
  }

  /** Sharper textures at grazing angles on strong GPUs (the road is always seen at a shallow angle). */
  setAnisotropy(n) {
    const max = this.renderer ? this.renderer.capabilities.getMaxAnisotropy() : 1; const v = Math.max(1, Math.min(n, max));
    for (const t of this.textures) if (t.anisotropy !== v) { t.anisotropy = v; t.needsUpdate = true; }
  }

  /** Load one registry asset (once). Resolves with the cache entry; never rejects for non-critical assets. */
  load(key) {
    if (this.entries.has(key)) return Promise.resolve(this.entries.get(key));
    if (this.pending.has(key)) return this.pending.get(key);
    const spec = ASSET_REGISTRY[key];
    if (!spec) return Promise.reject(new Error(`Unknown asset key "${key}"`));
    const p = this._load(key, spec).finally(() => this.pending.delete(key));
    this.pending.set(key, p);
    return p;
  }

  async _load(key, spec) {
    this.logger.info?.(`${TAG} Loading ${key} (${spec.label})...`);
    const attempts = [{ url: spec.url, fit: spec.fit, fallback: false }];
    if (spec.fallbackUrl) attempts.push({ url: spec.fallbackUrl, fit: spec.fallbackFit || spec.fit, fallback: true });
    let lastError = null;
    for (const attempt of attempts) {
      try {
        const gltf = await this._fetchGltf(key, attempt.url);
        this._prepare(gltf.scene);
        if (spec.flameGlow) this._applyFlameGlow(gltf.scene);
        const norm = normalizeModel(gltf.scene, attempt.fit);
        const stats = countTriangles(norm.root);
        const info = { key, url: attempt.url, usedFallback: attempt.fallback, ...stats, rawSize: norm.rawSize.toArray().map((n) => +n.toFixed(3)), size: norm.size.toArray().map((n) => +n.toFixed(3)), animations: gltf.animations.length };
        if (spec.walkSurface) {
          const hit = spec.walkSurface.raycast ? findWalkSurfaceY(norm.root) : null;
          const surface = hit ?? (norm.box.min.y + spec.walkSurface.fraction * norm.size.y);
          norm.scaler.position.y -= surface;     // walkway top becomes y = 0
          norm.root.updateMatrixWorld(true);
          info.walkSurfaceRaw = +surface.toFixed(3);
          info.walkSurfaceMethod = hit == null ? "fraction-fallback" : "raycast";
        }
        const entry = { key, root: norm.root, info, clips: gltf.animations, spec, lodRoot: null };
        if (spec.lodUrl && !attempt.fallback) await this._loadLod(entry, gltf, norm, spec);
        this.entries.set(key, entry);
        this.logger.info?.(`${TAG} ${spec.label} loaded${attempt.fallback ? " (FALLBACK file)" : ""} - ${info.tris.toLocaleString()} tris, size ${info.size.join(" x ")} m${info.animations ? `, ${info.animations} clips` : ""}`);
        if (attempt.fallback) this.logger.warn?.(`${TAG} ${key}: primary file ${spec.url} failed, using ${attempt.url}`);
        return entry;
      } catch (error) {
        lastError = new AssetLoadError(key, attempt.url, error);
        this.logger.error?.(`${TAG} ASSET FAILED: ${lastError.message}`);
      }
    }
    this.failures.push({ key, label: spec.label, url: spec.url, message: lastError?.message });
    const factory = this.fallbackFactories.get(key);
    if (factory && !spec.critical) {
      const root = factory();
      const entry = { key, root, info: { key, url: "procedural-fallback", usedFallback: true, procedural: true, ...countTriangles(root) }, clips: [], spec };
      this.entries.set(key, entry);
      this.logger.warn?.(`${TAG} ${key}: using procedural fallback because the GLB failed. Game will continue.`);
      return entry;
    }
    if (spec.critical) throw lastError;
    this.logger.warn?.(`${TAG} ${key}: non-critical asset unavailable and no fallback registered.`);
    return null;
  }

  async loadMany(keys) {
    return Promise.all(keys.map((k) => this.load(k).catch((e) => { if (ASSET_REGISTRY[k]?.critical) throw e; return null; })));
  }

  /** A fresh instance. Static models share geometry/materials; skinned models get their own skeleton. */
  instantiate(key, { lod = false } = {}) {
    const e = this.entries.get(key);
    if (!e) return null;
    if (lod && e.lodRoot) return e.lodRoot.clone(true);
    return e.info.skinned ? SkeletonUtils.clone(e.root) : e.root.clone(true);
  }
  hasLod(key) { return !!this.entries.get(key)?.lodRoot; }

  /** Cloned animation clips (character GLBs): callers may mutate them (root motion). */
  cloneClips(key) { return (this.entries.get(key)?.clips || []).map((c) => c.clone()); }

  diagnostics() {
    return { assets: [...this.entries.values()].map((e) => e.info), failures: [...this.failures] };
  }
}
