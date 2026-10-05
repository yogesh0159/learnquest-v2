import * as THREE from "three";
import { OrbitControls } from "/vendor/three-addons/controls/OrbitControls.js";
import { EndlessPathSystem } from "./game/jungle/endless-path.js";
import { JUNGLE_TRACK } from "./game/jungle/jungle-config.js";

const stage = document.getElementById("stage");
const assetStatus = document.getElementById("assetStatus");
const speedInput = document.getElementById("speed");
const speedOut = document.getElementById("speedOut");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const laneButtons = [...document.querySelectorAll("[data-lane]")];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd7bd);
scene.fog = new THREE.Fog(0xb8dec9, 34, 105);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 240);
camera.position.set(8.5, 5.6, 10.5);
camera.lookAt(0, 0.8, -10);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.9, -10);
controls.enableDamping = true;
controls.minDistance = 5;
controls.maxDistance = 28;
controls.maxPolarAngle = Math.PI * 0.48;

scene.add(new THREE.HemisphereLight(0xf4fff7, 0x244332, 2.2));
const sun = new THREE.DirectionalLight(0xffefd0, 3.1);
sun.position.set(-9, 16, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -18; sun.shadow.camera.right = 18; sun.shadow.camera.top = 18; sun.shadow.camera.bottom = -12;
scene.add(sun);

function material(color, roughness = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}

function makeTree(seed = 0) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.25,.45,3.9,7), material(0x765035,.96));
  trunk.position.y = 1.7; trunk.castShadow = true; g.add(trunk);
  const leafMat = material(seed % 2 ? 0x2f7d48 : 0x3f934f,.9);
  for(let i=0;i<4;i++){
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15,1), leafMat);
    crown.scale.set(1.15,.8,1.1); crown.position.set((i-1.5)*.42,3.65+(i%2)*.28,(i%2-.5)*.42); crown.castShadow=true; g.add(crown);
  }
  return g;
}

function makeBush() {
  const g = new THREE.Group(); const mat = material(0x3a8c47,.92);
  for(let i=0;i<5;i++){
    const p=new THREE.Mesh(new THREE.IcosahedronGeometry(.56,1),mat);p.scale.set(1.1,.7,.9);p.position.set((i-2)*.38,.4+(i%2)*.15,(i%2-.5)*.35);g.add(p);
  }
  return g;
}

function makeTorch() {
  const g = new THREE.Group();
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(.45,1.05,.45), material(0x8b6c45,.96)); pedestal.position.y=.46; g.add(pedestal);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.34,.22,.20,10), material(0x6f5134,.8)); bowl.position.y=1.08; g.add(bowl);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(.16,10,8), new THREE.MeshStandardMaterial({color:0xffc547,emissive:0xff7a18,emissiveIntensity:2.4,roughness:.45})); flame.scale.set(.72,1.7,.72); flame.position.y=1.38; g.add(flame);
  const light = new THREE.PointLight(0xff9f43, 1.7, 7, 2); light.position.y=1.45; g.add(light);
  return g;
}

function decorateLocalTile(tile, index) {
  const near = JUNGLE_TRACK.width/2 + 1.15;
  const far = JUNGLE_TRACK.width/2 + 3.2;
  const positions = [
    [-far,-4.0],[far,-2.7],[-near,3.5],[near,4.4]
  ];
  positions.forEach(([x,z],i)=>{
    const tree = makeTree(index+i); tree.position.set(x,0,z); tree.rotation.y=(index*1.7+i)*.7; tree.scale.setScalar(.82+(i%2)*.13); tile.add(tree);
  });
  const bushL = makeBush(), bushR = makeBush();
  bushL.position.set(-near+.15,0,-.6); bushR.position.set(near-.15,0,1.3); tile.add(bushL,bushR);
  if(index%2===0){const t1=makeTorch(),t2=makeTorch();t1.position.set(-JUNGLE_TRACK.width/2-.35,0,-3.8);t2.position.set(JUNGLE_TRACK.width/2+.35,0,-3.8);tile.add(t1,t2);}
}

function fallbackPath() {
  const g = new THREE.Group();
  const road = new THREE.Mesh(new THREE.BoxGeometry(JUNGLE_TRACK.width,.22,JUNGLE_TRACK.length),material(0x826444,.98));
  road.position.y=-.11; road.receiveShadow=true; g.add(road); return g;
}

const path = new EndlessPathSystem({
  scene,
  tileCount: 9,
  startZ: 7,
  shoulderColor: 0x2c7445,
  decorateTile: decorateLocalTile,
  fallbackFactory: fallbackPath,
});
await path.init();
const d = path.diagnostics();
assetStatus.textContent = d.usingFallback ? "⚠ procedural fallback" : "✓ real Meshy GLB loaded";
assetStatus.style.color = d.usingFallback ? "#ffd166" : "#9af2ad";

const player = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(.34,.8,6,10),material(0x2578df,.7)); body.position.y=1.25; player.add(body);
const head = new THREE.Mesh(new THREE.SphereGeometry(.34,16,12),material(0xf1b58e,.7)); head.position.y=2.05; player.add(head);
const pack = new THREE.Mesh(new THREE.BoxGeometry(.62,.72,.25),material(0xf08a34,.75)); pack.position.set(0,1.35,.33); player.add(pack);
player.position.set(0,0,2.1); scene.add(player);

let running = true;
let speed = Number(speedInput.value);
let targetLane = 1;
const clock = new THREE.Clock();

function selectLane(index) {
  targetLane = Math.max(0,Math.min(2,index));
  laneButtons.forEach((b,i)=>b.classList.toggle("active",i===targetLane));
}
laneButtons.forEach((button)=>button.addEventListener("click",()=>selectLane(Number(button.dataset.lane))));
window.addEventListener("keydown",(event)=>{
  if(["ArrowLeft","a","A"].includes(event.key)) selectLane(targetLane-1);
  if(["ArrowRight","d","D"].includes(event.key)) selectLane(targetLane+1);
  if(event.key===" "){running=!running;pauseBtn.textContent=running?"Pause":"Run";}
});
speedInput.addEventListener("input",()=>{speed=Number(speedInput.value);speedOut.textContent=`${speed.toFixed(1)} m/s`;});
pauseBtn.addEventListener("click",()=>{running=!running;pauseBtn.textContent=running?"Pause":"Run";});
resetBtn.addEventListener("click",()=>{camera.position.set(8.5,5.6,10.5);controls.target.set(0,.9,-10);controls.update();});

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.05);
  if(running) path.update(dt,speed);
  const targetX=JUNGLE_TRACK.lanes[targetLane];
  player.position.x += (targetX-player.position.x)*Math.min(1,dt*9);
  body.rotation.z=(targetX-player.position.x)*-.08;
  controls.update();
  renderer.render(scene,camera);
}
animate();

addEventListener("resize",()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
});
