import * as THREE from "three";
import { GLTFLoader } from "/vendor/three-addons/loaders/GLTFLoader.js";

function prepareObject(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (material?.map) material.map.colorSpace = THREE.SRGBColorSpace;
    }
  });
  return root;
}

export class GLTFAssetCache {
  constructor({ logger = console } = {}) {
    this.loader = new GLTFLoader();
    this.cache = new Map();
    this.logger = logger;
  }

  async template(url) {
    if (!url) throw new Error("GLTF asset URL is required");
    if (!this.cache.has(url)) {
      this.cache.set(url, new Promise((resolve, reject) => {
        this.loader.load(
          url,
          (gltf) => resolve(prepareObject(gltf.scene)),
          undefined,
          (error) => reject(new Error(`Could not load ${url}: ${error?.message || error}`)),
        );
      }));
    }
    return this.cache.get(url);
  }

  async clone(url) {
    const root = await this.template(url);
    return root.clone(true);
  }

  clear() {
    this.cache.clear();
  }
}

export function exactObjectBounds(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  return { box, size: box.getSize(new THREE.Vector3()), center: box.getCenter(new THREE.Vector3()) };
}
