import * as THREE from "three";
import { CAMERA, LANES } from "./config.js";

/** Temple-Run style chase camera: behind and above, looking down the road, exponentially smoothed. */
export class CameraRig {
  constructor(camera) {
    this.camera = camera; this.pos = new THREE.Vector3(0, CAMERA.offset.y, CAMERA.offset.z); this.look = new THREE.Vector3(0, CAMERA.lookAhead.y, CAMERA.lookAhead.z);
    this.enabled = true; this.reduceMotion = false; this.fovKick = 0; this.tmp = new THREE.Vector3(); this.baseFov = CAMERA.fov;
    this.snap({ x: 0, y: 0 });
  }
  setAspect(aspect) {
    this.baseFov = aspect < 0.85 ? CAMERA.fovPortrait : CAMERA.fov;
    this.camera.aspect = aspect; this.camera.fov = this.baseFov; this.camera.updateProjectionMatrix();
  }
  _targets(p) {
    const lift = Math.min(p.y * 0.35, 0.6);
    const pos = this.tmp.set(p.x * CAMERA.followX + CAMERA.offset.x, CAMERA.offset.y + lift, CAMERA.offset.z);
    const look = new THREE.Vector3(p.x * CAMERA.lookFollowX, CAMERA.lookAhead.y + p.y * 0.2, CAMERA.lookAhead.z);
    return { pos, look };
  }
  snap(p) { const t = this._targets(p); this.pos.copy(t.pos); this.look.copy(t.look); this._apply(); }
  update(dt, p, speed = 10) {
    if (!this.enabled) return;
    const t = this._targets(p); const k = 1 - Math.exp(-CAMERA.smoothing * dt);
    this.pos.lerp(t.pos, k); this.look.lerp(t.look, k);
    const targetKick = this.reduceMotion ? 0 : THREE.MathUtils.clamp((speed - 10) * 0.5, 0, 4);
    this.fovKick += (targetKick - this.fovKick) * (1 - Math.exp(-2 * dt));
    this.camera.fov = this.baseFov + this.fovKick; this.camera.updateProjectionMatrix();
    this._apply();
  }
  _apply() { this.camera.position.copy(this.pos); this.camera.lookAt(this.look); }
}
