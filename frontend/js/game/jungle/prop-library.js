import * as THREE from "three";
import { GLTFAssetCache, exactObjectBounds } from "./gltf-cache.js";
import { JUNGLE_ASSETS } from "./jungle-config.js";

const DEFAULT_TARGET_HEIGHTS = Object.freeze({
  tree01: 5.5,
  bush01: 1.45,
  plant01: 1.55,
  torch01: 1.8,
  rock01: 1.55,
  coinQuestion01: 0.72,
  mathGate01: 4.4,
});

function normalizeProp(root, targetHeight) {
  root.updateMatrixWorld(true);
  let { box, size } = exactObjectBounds(root);
  if (targetHeight && size.y > 0.0001) root.scale.multiplyScalar(targetHeight / size.y);
  root.updateMatrixWorld(true);
  ({ box } = exactObjectBounds(root));
  const centerX = (box.min.x + box.max.x) * 0.5;
  const centerZ = (box.min.z + box.max.z) * 0.5;
  root.position.x -= centerX;
  root.position.z -= centerZ;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);
  return root;
}

export class JunglePropLibrary {
  constructor({ assets = JUNGLE_ASSETS, logger = console } = {}) {
    this.assets = assets;
    this.logger = logger;
    this.cache = new GLTFAssetCache({ logger });
    this.templates = new Map();
  }

  async preloadEnabled() {
    const entries = Object.entries(this.assets).filter(([key, asset]) => key !== "pathStraight01" && asset?.enabled);
    await Promise.all(entries.map(async ([key, asset]) => {
      try {
        const template = await this.cache.clone(asset.url);
        normalizeProp(template, DEFAULT_TARGET_HEIGHTS[key]);
        this.templates.set(key, template);
      } catch (error) {
        this.logger.warn?.(`Optional jungle asset ${key} was not loaded; procedural fallback remains active.`, error);
      }
    }));
    return this;
  }

  has(key) { return this.templates.has(key); }
  clone(key) { return this.templates.get(key)?.clone(true) || null; }
  clear() { this.templates.clear(); this.cache.clear(); }
}
