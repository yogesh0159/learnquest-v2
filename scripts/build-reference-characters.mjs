import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { GLTFExporter } from '../backend/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
const source = await readFile(new URL('../frontend/js/game/reference-explorer.mjs', import.meta.url),'utf8');
const threeURL = new URL('../backend/node_modules/three/build/three.module.js', import.meta.url).href;
const {buildReferenceExplorer,createReferenceClips} = await import(`data:text/javascript;base64,${Buffer.from(source.replace("from 'three'",`from '${threeURL}'`)).toString('base64')}`);
// GLTFExporter uses the browser FileReader interface for its binary buffer.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();}); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();}); }
};
const folder=new URL('../frontend/assets/characters/',import.meta.url); await mkdir(folder,{recursive:true});
for(const gender of ['boy','girl']){
 const model=buildReferenceExplorer({gender});
 const animations=createReferenceClips(model);
 model.userData.animationType='articulated-node-rig';
 model.userData.source='Original geometry inspired by supplied LearnQuest character references';
 const binary=await new GLTFExporter().parseAsync(model,{binary:true,animations,onlyVisible:true});
 await writeFile(new URL(`${gender}-explorer.glb`,folder),Buffer.from(binary));
 console.log(`${gender}: ${binary.byteLength} bytes; ${animations.length} animation clips`);
}
