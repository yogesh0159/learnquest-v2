import * as THREE from "three";
import { GLTFAssetCache, exactObjectBounds } from "./gltf-cache.js";
import { JUNGLE_ASSETS, JUNGLE_TRACK } from "./jungle-config.js";

function setMaterialColorSpace(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (material?.map) material.map.colorSpace = THREE.SRGBColorSpace;
    }
  });
}

function normalizePathVisual(root, track = JUNGLE_TRACK) {
  root.updateMatrixWorld(true);
  let { box, size } = exactObjectBounds(root);

  // Future replacement GLBs are normalized automatically if their export scale
  // is slightly different. The current supplied asset is already exact.
  const sx = size.x > 0.0001 ? track.width / size.x : 1;
  const sy = size.y > 0.0001 ? track.height / size.y : 1;
  const sz = size.z > 0.0001 ? track.length / size.z : 1;
  const needsScale = Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01 || Math.abs(sz - 1) > 0.01;
  if (needsScale) root.scale.multiply(new THREE.Vector3(sx, sy, sz));

  root.updateMatrixWorld(true);
  ({ box } = exactObjectBounds(root));
  const cx = (box.min.x + box.max.x) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;

  // Center the modular tile and place the intended stone running surface at y=0.
  root.position.x -= cx;
  root.position.z -= cz;
  root.position.y -= box.min.y + track.surfaceOffset;
  root.updateMatrixWorld(true);
  setMaterialColorSpace(root);
  return root;
}

export class EndlessPathSystem {
  constructor({
    scene,
    track = JUNGLE_TRACK,
    asset = JUNGLE_ASSETS.pathStraight01,
    tileCount = track.tileCount,
    startZ = track.initialStartZ,
    shoulderColor = 0x2f7d4a,
    decorateTile = null,
    fallbackFactory = null,
    logger = console,
  } = {}) {
    if (!scene) throw new Error("EndlessPathSystem requires a Three.js scene");
    this.scene = scene;
    this.track = track;
    this.asset = asset;
    this.tileCount = tileCount;
    this.startZ = startZ;
    this.shoulderColor = shoulderColor;
    this.decorateTile = decorateTile;
    this.fallbackFactory = fallbackFactory;
    this.logger = logger;
    this.assets = new GLTFAssetCache({ logger });
    this.tiles = [];
    this.usingFallback = false;
    this.assetTemplate = null;
  }

  async init() {
    try {
      this.assetTemplate = normalizePathVisual(await this.assets.clone(this.asset.url), this.track);
      this.usingFallback = false;
    } catch (error) {
      this.usingFallback = true;
      this.logger.warn?.("Jungle path GLB failed; using procedural fallback.", error);
    }

    for (let i = 0; i < this.tileCount; i++) {
      const tile = this.createTile(i);
      tile.position.z = this.startZ - i * this.track.length;
      this.scene.add(tile);
      this.tiles.push(tile);
    }
    return this;
  }

  createTile(index) {
    const tile = new THREE.Group();
    tile.name = `JunglePathTile_${String(index + 1).padStart(2, "0")}`;

    let visual = null;
    if (this.assetTemplate) {
      visual = this.assetTemplate.clone(true);
      visual.name = "Path_Straight_01";
    } else if (typeof this.fallbackFactory === "function") {
      visual = this.fallbackFactory(index);
      visual.name ||= "ProceduralPathFallback";
    }
    if (visual) tile.add(visual);

    // Ground shoulders remain procedural until their final Meshy foliage/terrain
    // assets are supplied. This guarantees that the player never sees void beside the path.
    const shoulderMaterial = new THREE.MeshStandardMaterial({ color: this.shoulderColor, roughness: 1, metalness: 0 });
    const shoulderGeometry = new THREE.BoxGeometry(this.track.shoulderWidth, 0.22, this.track.length + 0.04);
    const offsetX = this.track.width * 0.5 + this.track.shoulderWidth * 0.5;
    const left = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
    const right = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
    left.position.set(-offsetX, -0.25, 0);
    right.position.set(offsetX, -0.25, 0);
    left.receiveShadow = right.receiveShadow = true;
    left.name = "JungleShoulderLeft";
    right.name = "JungleShoulderRight";
    tile.add(left, right);

    this.decorateTile?.(tile, index);
    return tile;
  }

  update(dt, speed) {
    if (!this.tiles.length) return;
    let farthest = Math.min(...this.tiles.map((tile) => tile.position.z));
    for (const tile of this.tiles) {
      tile.position.z += speed * dt;
      if (tile.position.z > this.track.recycleZ) {
        tile.position.z = farthest - this.track.length;
        farthest = tile.position.z;
      }
    }
  }

  diagnostics() {
    return {
      tileCount: this.tiles.length,
      usingFallback: this.usingFallback,
      assetUrl: this.asset.url,
      dimensions: { width: this.track.width, height: this.track.height, length: this.track.length },
      lanes: [...this.track.lanes],
    };
  }

  dispose() {
    for (const tile of this.tiles) this.scene.remove(tile);
    this.tiles.length = 0;
    this.assets.clear();
  }
}
