import * as THREE from "three";
import { mulberry32 } from "./rng.js";

/** Procedural ground (no ground GLB was supplied): mottled moss/grass, tileable. */
export function makeGroundTexture(size = 512) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"); const rng = mulberry32(7);
  g.fillStyle = "#2f7a3f"; g.fillRect(0, 0, size, size);
  const wrap = (x, y, r, col) => {
    g.fillStyle = col;
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.fill(); }
  };
  const cols = ["#2a6e38", "#37864a", "#3f9453", "#245f33", "#4a9b52", "#5d8f3c"];
  for (let i = 0; i < 1400; i++) wrap(rng() * size, rng() * size, 2 + rng() * 8, cols[Math.floor(rng() * cols.length)] + "66");
  for (let i = 0; i < 700; i++) { g.strokeStyle = rng() > .5 ? "#6bbd62aa" : "#1f5a2caa"; g.lineWidth = 1.2; const x = rng() * size, y = rng() * size; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - .5) * 8, y - 4 - rng() * 8); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function makeGlowTexture(inner = "255,214,120", size = 128) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"); const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, `rgba(${inner},1)`); grad.addColorStop(0.25, `rgba(${inner},0.55)`); grad.addColorStop(1, `rgba(${inner},0)`);
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Soft sky dome gradient (vertex colours, follows the camera). */
export function makeSkyDome() {
  const geo = new THREE.SphereGeometry(112, 24, 16);
  const pos = geo.attributes.position; const cols = new Float32Array(pos.count * 3);
  const top = new THREE.Color(0x6fc4f2), mid = new THREE.Color(0xbfeadb), low = new THREE.Color(0xcfeedd), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 112;
    if (h > 0.12) c.copy(mid).lerp(top, Math.min(1, (h - 0.12) / 0.7)); else c.copy(low).lerp(mid, Math.max(0, (h + 0.2) / 0.32));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -10; m.frustumCulled = false; m.name = "SkyDome";
  return m;
}
