import * as THREE from "three";

/**
 * Pooled lane obstacles.
 *  - rock : the supplied Stone_Sanctua GLB. Jump over it or change lane.
 *  - beam : overhead log across one lane, slide under it. No GLB exists for this, so it is a
 *           minimal wooden crossbar + posts, dressed with the supplied bush GLB.
 */
export class ObstacleManager {
  constructor({ scene, assets, rockPool = 8, beamPool = 4 }) {
    this.assets = assets; this.root = new THREE.Group(); this.root.name = "Obstacles"; scene.add(this.root);
    this.free = { rock: [], beam: [] }; this.active = [];
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a26, roughness: 0.9 });
    this.beamGeo = new THREE.CylinderGeometry(0.16, 0.16, 2.0, 10); this.beamGeo.rotateZ(Math.PI / 2);
    this.postGeo = new THREE.CylinderGeometry(0.1, 0.13, 1.35, 8);
    this.wood = wood;
    for (let i = 0; i < rockPool; i++) this.free.rock.push(this._makeRock());
    for (let i = 0; i < beamPool; i++) this.free.beam.push(this._makeBeam());
  }
  _makeRock() {
    const holder = new THREE.Group(); holder.visible = false; holder.name = "rockObstacle";
    const m = this.assets.instantiate("rock"); if (m) { m.scale.setScalar(1.0); holder.add(m); m.traverse((o) => { if (o.isMesh) { o.castShadow = true; } }); }
    const far = this.assets.hasLod("rock") ? this.assets.instantiate("rock", { lod: true }) : null; if (far) { far.visible = false; holder.add(far); }
    this.root.add(holder);
    return { kind: "rock", near: m, far, holder, x: 0, z: 0, halfX: 0.68, halfZ: 0.62, yBottom: 0, yTop: 1.05 };
  }
  _makeBeam() {
    const holder = new THREE.Group(); holder.visible = false; holder.name = "beamObstacle";
    const bar = new THREE.Mesh(this.beamGeo, this.wood); bar.position.y = 1.12; bar.castShadow = true;
    for (const sx of [-0.92, 0.92]) { const p = new THREE.Mesh(this.postGeo, this.wood); p.position.set(sx, 0.67, 0); p.castShadow = true; holder.add(p);
      const b = this.assets.instantiate("bush", { lod: true }); if (b) { b.scale.setScalar(0.5); b.position.set(sx * 1.02, 0.95, 0.05); holder.add(b); } }
    holder.add(bar);
    this.root.add(holder);
    return { kind: "beam", holder, x: 0, z: 0, halfX: 0.95, halfZ: 0.4, yBottom: 0.98, yTop: 1.3 };
  }
  spawn(kind, x, z) {
    const o = this.free[kind].pop(); if (!o) return null;
    o.x = x; o.z = z; o.holder.position.set(x, 0, z); o.holder.rotation.y = kind === "rock" ? Math.random() * Math.PI * 2 : 0; o.holder.visible = true;
    this.active.push(o); return o;
  }
  release(o) { o.holder.visible = false; const i = this.active.indexOf(o); if (i >= 0) this.active.splice(i, 1); this.free[o.kind].push(o); }
  clear() { [...this.active].forEach((o) => this.release(o)); }
  update(dz) { for (let i = this.active.length - 1; i >= 0; i--) { const o = this.active[i]; o.z += dz; o.holder.position.z = o.z; if (o.far) { const near = o.z > -26; if (o.near.visible !== near) { o.near.visible = near; o.far.visible = !near; } } if (o.z > 12) this.release(o); } }
}
