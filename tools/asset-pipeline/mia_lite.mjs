import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import fs from 'fs';
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const tris = (doc) => { let t=0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const i=p.getIndices(); t += i ? i.getCount()/3 : p.getAttribute('POSITION').getCount()/3; } return Math.round(t); };
for (const [ratio, err] of [[0.45, 0.01], [0.3, 0.02]]) {
  const doc = await io.read('/home/claude/work/proj/learnquest/frontend/assets/jungle/runtime/Girl_Mia_Animated.rt.glb'); const b = tris(doc);
  await doc.transform(weld({ tolerance: 0.00005 }), simplify({ simplifier: MeshoptSimplifier, ratio, error: err, lockBorder: false }), dedup());
  const out = `/home/claude/work/lod_build/Girl_Mia_lite_${ratio}.glb`; await io.write(out, doc);
  console.log(ratio, b, '->', tris(doc), (fs.statSync(out).size/1e6).toFixed(1)+' MB', 'skins', doc.getRoot().listSkins().length);
}
