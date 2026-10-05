import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup, textureCompress, getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs'; import path from 'path';

await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const SRC = process.argv[2], OUT = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });

// ratio: fraction of triangles to keep (null = untouched geometry)
const JOBS = [
  { file: '3d/Bridge.glb',                    out: 'Bridge.rt.glb',            ratio: 0.5,  tex: [2048,1024,1024] },
  { file: '3d/tree.glb',                      out: 'tree.rt.glb',              ratio: 0.45, error: 0.06, tex: [2048,1024,1024] },
  { file: '3d/bush_cluster.glb',              out: 'bush_cluster.rt.glb',      ratio: 0.4, error: 0.06, tex: [1024,512,512]  },
  { file: '3d/Stone_Sanctua.glb',             out: 'Stone_Sanctua.rt.glb',     ratio: 0.4, error: 0.05, tex: [1024,1024,512] },
  { file: '3d/jungle_temple_tourch.glb',      out: 'jungle_temple_tourch.rt.glb', ratio: 0.03, tex: [1024,1024,512] },
  { file: '3d/Coin.glb',                      out: 'Coin.rt.glb',              ratio: 0.045, tex: [1024,512,512]  },
  { file: '3d/Golden_Enigma.glb',             out: 'Golden_Enigma.rt.glb',     ratio: null, tex: [1024,1024,512] },
  { file: '3d/question board.glb',            out: 'question_board.rt.glb',    ratio: null, tex: [2048,1024,512] },
  { file: 'L Q 3D models/LearnQuest_Boy_Final_Animated_v1.glb', out: 'Boy_Final_Animated.rt.glb', ratio: null, skinned: true, tex: [2048,1024,1024] },
  { file: 'L Q 3D models/Meshy_AI_Mia_s_First_Day_All_Animations.glb', out: 'Girl_Mia_Animated.rt.glb', ratio: null, skinned: true, tex: [2048,1024,1024] },
];
const only = process.argv[4] ? process.argv[4].split(',') : null;
const tris = (doc) => { let t=0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const i=p.getIndices(); t += i ? i.getCount()/3 : p.getAttribute('POSITION').getCount()/3; } return Math.round(t); };

for (const j of JOBS) {
  if (only && !only.includes(j.out)) continue;
  const inPath = path.join(SRC, j.file);
  const doc = await io.read(inPath);
  const before = tris(doc), sizeBefore = fs.statSync(inPath).size;
  if (j.ratio != null) {
    await doc.transform(
      weld({ tolerance: 0.0001 }),
      simplify({ simplifier: MeshoptSimplifier, ratio: j.ratio, error: j.error ?? 0.02, lockBorder: false }),
    );
  }
  const slots = ['baseColorTexture','normalTexture','metallicRoughnessTexture'];
  const steps = [];
  slots.forEach((s, i) => steps.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [j.tex[i], j.tex[i]], slots: new RegExp('^' + s + '$'), quality: s === 'baseColorTexture' ? 90 : 88 })));
  await doc.transform(...(j.skinned ? [] : [prune()]), dedup(), ...steps);
  const outPath = path.join(OUT, j.out);
  await io.write(outPath, doc);
  const after = tris(doc), sizeAfter = fs.statSync(outPath).size;
  console.log(`${j.out.padEnd(32)} tris ${String(before).padStart(8)} -> ${String(after).padStart(7)} | ${(sizeBefore/1e6).toFixed(1).padStart(5)} MB -> ${(sizeAfter/1e6).toFixed(2).padStart(6)} MB | tex ${j.tex.join('/')}`);
}
