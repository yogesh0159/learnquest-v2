// Builds low-triangle LOD copies of the runtime GLBs.  Foliage UV islands stop the normal simplifier at ~80%, so the
// far LODs use meshoptimizer's "sloppy" simplifier (it ignores topology), which is fine for objects seen from far away.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import fs from 'fs'; import path from 'path';
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const DIR = process.argv[2];
const tris = (doc) => { let t=0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const i=p.getIndices(); t += i ? i.getCount()/3 : p.getAttribute('POSITION').getCount()/3; } return Math.round(t); };
const JOBS = [
  { src: 'tree.rt.glb',                 out: 'tree.lod.rt.glb',                 sloppy: 0.22 },
  { src: 'bush_cluster.rt.glb',         out: 'bush_cluster.lod.rt.glb',         sloppy: 0.20 },
  { src: 'Stone_Sanctua.rt.glb',        out: 'Stone_Sanctua.lod.rt.glb',        sloppy: 0.25 },
  { src: 'jungle_temple_tourch.rt.glb', out: 'jungle_temple_tourch.lod.rt.glb', sloppy: 0.30 },
  { src: 'Bridge.rt.glb',               out: 'Bridge.lod.rt.glb',               sloppy: 0.30 },
  { src: 'Coin.rt.glb',                 out: 'Coin.rt.glb',                     regular: 0.28, inplace: true },   // 8.7k -> ~2.4k, normal map keeps the emboss
];
const only = process.argv[3] ? process.argv[3].split(',') : null;
for (const j of JOBS) {
  if (only && !only.includes(j.out)) continue;
  const doc = await io.read(path.join(DIR, j.src)); const before = tris(doc);
  if (j.sloppy) {
    for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices(); const pos = prim.getAttribute('POSITION'); if (!idx || !pos) continue;
      const target = Math.max(60, Math.floor(idx.getCount() * j.sloppy / 3) * 3);
      const [out] = MeshoptSimplifier.simplifySloppy(new Uint32Array(idx.getArray()), new Float32Array(pos.getArray()), 3, null, target, 0.12);
      idx.setArray(out.length < 65536 * 3 && pos.getCount() < 65536 ? new Uint16Array(out) : new Uint32Array(out));
    }
    await doc.transform(prune(), dedup());
  } else if (j.regular) {
    await doc.transform(weld({ tolerance: 0.0001 }), simplify({ simplifier: MeshoptSimplifier, ratio: j.regular, error: 0.02 }), prune(), dedup());
  }
  const outPath = path.join(DIR, j.out); await io.write(outPath, doc);
  console.log(`${j.out.padEnd(34)} ${String(before).padStart(7)} -> ${String(tris(doc)).padStart(6)} tris | ${(fs.statSync(outPath).size/1e6).toFixed(2)} MB`);
}
