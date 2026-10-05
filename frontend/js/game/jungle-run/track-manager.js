import * as THREE from "three";
import { GAME, SEGMENT_LENGTH, ROAD_WIDTH, LANES } from "./config.js";
import { PLAYER } from "./config.js";

/**
 * Endless road: a fixed ring of path tiles that scroll toward the camera and are *recycled*
 * (moved to the far end) once they pass behind it. No objects are created or destroyed after init.
 */
export class EndlessTrackManager {
  constructor({ scene, assets, groundTexture, count = GAME.segmentCount, logger = console }) {
    this.scene = scene; this.assets = assets; this.logger = logger; this.count = count;
    this.segments = []; this.listeners = new Map(); this.lodDist = 45;
    this.maxIndex = -1; this.reserved = new Set(); this.recycledTotal = 0;
    this.root = new THREE.Group(); this.root.name = "TrackRoot"; scene.add(this.root);
    groundTexture.repeat.set(70 / 7, SEGMENT_LENGTH / 7);
    this.groundMat = new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 1, metalness: 0 });
    this.groundGeo = new THREE.PlaneGeometry(70, SEGMENT_LENGTH + 0.04);
    this.groundGeo.rotateX(-Math.PI / 2);
    // The tile's end bevel leaves a hairline of ground showing at every joint: a sand-coloured strip just below the
    // walking surface fills it (3 cm under y = 0, so it can never z-fight with the tile).
    this.seamGeo = new THREE.PlaneGeometry(ROAD_WIDTH * 0.66, 0.9); this.seamGeo.rotateX(-Math.PI / 2);
    this.seamMat = new THREE.MeshStandardMaterial({ color: 0xb98a55, roughness: 1 });
  }

  on(evt, fn) { (this.listeners.get(evt) || this.listeners.set(evt, []).get(evt)).push(fn); return this; }
  _emit(evt, seg) { for (const fn of this.listeners.get(evt) || []) fn(seg); }
  isReserved(index) { return this.reserved.has(index); }
  reservedNear(index) { return this.reserved.has(index - 1) || this.reserved.has(index) || this.reserved.has(index + 1); }

  init() {
    this.logger.info?.("[LearnQuest] Building endless road segments...");
    for (let i = 0; i < this.count; i++) {
      const group = new THREE.Group(); group.name = `Segment_${i}`;
      const path = this.assets.instantiate("path"); path.name = "PathTile";
      path.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; } });
      const ground = new THREE.Mesh(this.groundGeo, this.groundMat);
      ground.position.y = -0.12; ground.receiveShadow = true; ground.name = "Ground";
      const seam = new THREE.Mesh(this.seamGeo, this.seamMat); seam.position.set(0, -0.03, SEGMENT_LENGTH / 2); seam.name = "SeamFill";
      const pathFar = this.assets.hasLod("path") ? this.assets.instantiate("path", { lod: true }) : null;
      if (pathFar) { pathFar.visible = false; pathFar.name = "PathTileFar"; pathFar.traverse((o) => { if (o.isMesh) o.receiveShadow = true; }); group.add(pathFar); }
      group.add(ground, path, seam);
      this.root.add(group);
      const seg = { group, path, pathFar, ground, index: i, slot: i, far: false };
      this.segments.push(seg);
      this._emit("create", seg);
    }
    this.walkable = this.measureWalkable();
    this.reset();
  }

  /** Raycast across the tile: where is the road flat (walkable) and do all three lanes fit on it? */
  measureWalkable() {
    const seg = this.segments[0]; seg.group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const isFlat = (x) => { ray.set(new THREE.Vector3(x, 5, seg.group.position.z), new THREE.Vector3(0, -1, 0)); const h = ray.intersectObject(seg.path, true)[0]; return !!h && Math.abs(h.point.y) < 0.06; };
    // Walk outward from the road centre until the surface stops being flat (that is where the parapet wall starts).
    const edge = (dir) => { let x = 0; while (Math.abs(x) < ROAD_WIDTH / 2 && isFlat(x + dir * 0.05)) x += dir * 0.05; return Math.abs(x); };
    const half = Math.min(edge(-1), edge(1));
    const need = Math.max(...LANES.map(Math.abs)) + PLAYER.halfWidth;
    const result = { halfWidth: +half.toFixed(2), neededHalfWidth: +need.toFixed(2), lanesFit: half >= need };
    (result.lanesFit ? this.logger.info : this.logger.warn)?.call(this.logger, `[LearnQuest] Road walkable half-width ${result.halfWidth} m, lanes need ${result.neededHalfWidth} m -> ${result.lanesFit ? "all 3 lanes are on the road" : "LANES DO NOT FIT, widen ROAD_WIDTH"}`);
    return result;
  }

  /** Far road tiles use the cheaper LOD (the stone detail is not visible from 45+ m). */
  refreshLod() { for (const s of this.segments) this._lod(s); }
  _lod(s) { if (!s.pathFar) return; const far = s.group.position.z < -this.lodDist; if (far !== s.far) { s.far = far; s.path.visible = !far; s.pathFar.visible = far; } }

  reset() {
    this.maxIndex = this.count - 1;
    this.segments.forEach((seg, i) => { seg.index = i; seg.group.position.z = GAME.firstSegmentZ - i * SEGMENT_LENGTH; this._lod(seg); });
    this.segments.forEach((seg) => this._emit("spawn", seg));
  }

  /** Scroll everything by dz metres toward the camera; recycle tiles that fell behind. */
  update(dz) {
    let minZ = Infinity;
    for (const s of this.segments) { s.group.position.z += dz; if (s.group.position.z < minZ) minZ = s.group.position.z; this._lod(s); }
    for (const s of this.segments) {
      if (s.group.position.z > GAME.recycleZ) {
        this._emit("recycle", s);
        s.group.position.z = minZ - SEGMENT_LENGTH; minZ = s.group.position.z;
        s.index = ++this.maxIndex; this.recycledTotal++; this._lod(s);
        this._emit("spawn", s);
      }
    }
  }

  /** Continuity check used by tests: max gap/overlap between neighbouring tiles. */
  continuity() {
    const zs = this.segments.map((s) => s.group.position.z).sort((a, b) => a - b);
    let worst = 0; for (let i = 1; i < zs.length; i++) worst = Math.max(worst, Math.abs(zs[i] - zs[i - 1] - SEGMENT_LENGTH));
    return { tiles: zs.length, worstSeamError: worst, nearestZ: zs[zs.length - 1], farthestZ: zs[0], width: ROAD_WIDTH, walkable: this.walkable };
  }
}
