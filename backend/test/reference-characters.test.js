const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const expected=['Idle','Run','Sprint','Jump','Land','Slide','Dodge_Left','Dodge_Right','Hit','Fall','Victory','Turn_Left','Turn_Right','Gesture'];
for (const gender of ['boy','girl']) {
 test(`${gender} shipped GLB loads, binds all 14 clips and stays finite through transitions`, async()=>{
  const THREE=await import('three');
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const bytes=fs.readFileSync(path.resolve(__dirname,`../../frontend/assets/characters/${gender}-explorer.glb`));
  assert.equal(bytes.readUInt32LE(0),0x46546c67);
  assert.ok(bytes.length<2*1024*1024,'mobile asset should stay under 2 MB');
  const model=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  assert.deepEqual(model.animations.map(c=>c.name),expected);
  const mixer=new THREE.AnimationMixer(model.scene);
  for(const clip of model.animations){
   for(const track of clip.tracks){
    const parsed=THREE.PropertyBinding.parseTrackName(track.name);
    assert.ok(THREE.PropertyBinding.findNode(model.scene,parsed.nodeName),`missing target ${track.name}`);
   }
   mixer.stopAllAction();const action=mixer.clipAction(clip);action.reset().play();
   for(let i=0;i<12;i++){
    mixer.update(clip.duration/12);model.scene.updateMatrixWorld(true);
    model.scene.traverse(n=>assert.ok(n.matrixWorld.elements.every(Number.isFinite)));
   }
  }
  // Dodge animations must rotate the rig, never mirror character/accessory artwork.
  for(const clip of model.animations.filter(c=>c.name.startsWith('Dodge'))){
   for(const track of clip.tracks.filter(t=>t.name.endsWith('.scale')))assert.ok([...track.values].every(v=>v>0));
  }
 });
}
test('fallback and GLB source share reference wardrobe and reset after fall/victory',async()=>{
 const file=path.resolve(__dirname,'../../frontend/js/game/reference-explorer.mjs');
 const three=pathToFileURL(require.resolve('three')).href;
 const src=fs.readFileSync(file,'utf8').replace("from 'three'",`from '${three}'`);
 const {buildReferenceExplorer,poseReferenceExplorer}=await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
 for(const gender of ['boy','girl']){
  const model=buildReferenceExplorer({gender});const rig=model.userData.referenceRig;
  assert.ok(model.getObjectByName('BackpackBody'));assert.ok(model.getObjectByName('BootL'));
  poseReferenceExplorer(model,'fall',1);assert.ok(rig.hips.position.y<.5);
  poseReferenceExplorer(model,'victory',1);poseReferenceExplorer(model,'idle',0);
  assert.equal(rig.hips.position.y,1.1);assert.equal(rig.hips.rotation.x,0);
  assert.ok(Math.abs(rig.arms[0].rotation.z)<.1);
 }
});
