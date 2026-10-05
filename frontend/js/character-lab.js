import { CharacterController, THREE } from "./game/character-controller.js";

const reviewParams = new URLSearchParams(location.search);
if (reviewParams.get("review") === "1") document.body.classList.add("review-embed");
const host = document.getElementById("characterStage");
const assetBadge = document.getElementById("assetBadge");
const clipInfo = document.getElementById("clipInfo");
const presetButtons = document.getElementById("presetButtons");
const stateButtons = [...document.querySelectorAll("[data-state]")];

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.25 : 1.8));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b2b1e, 10, 28);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
camera.position.set(0, 2.0, 6.6);
camera.lookAt(0, 1.35, 0);

const hemi = new THREE.HemisphereLight(0xdff8e6, 0x193428, 2.5);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff0ce, 4.2);
key.position.set(-4, 8, 5);
key.castShadow = true;
key.shadow.normalBias = .03;
key.shadow.bias = -.0002;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -5;
key.shadow.camera.right = 5;
key.shadow.camera.top = 7;
key.shadow.camera.bottom = -2;
scene.add(key);
const rim = new THREE.DirectionalLight(0x8be0ae, 2.4);
rim.position.set(5, 4, -5);
scene.add(rim);

const ground = new THREE.Mesh(
  new THREE.CylinderGeometry(3.15, 3.6, 0.34, 48),
  new THREE.MeshStandardMaterial({ color: 0x173f2d, roughness: 0.95, metalness: 0.02 })
);
ground.position.y = -0.2;
ground.receiveShadow = true;
scene.add(ground);

const ring = new THREE.Mesh(
  new THREE.TorusGeometry(2.75, 0.035, 8, 80),
  new THREE.MeshBasicMaterial({ color: 0x6fc98b, transparent: true, opacity: 0.5 })
);
ring.rotation.x = Math.PI / 2;
ring.position.y = 0.01;
scene.add(ring);

for (let i = 0; i < 24; i += 1) {
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.025 + Math.random() * 0.035, 6, 5),
    new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xf3cf7b : 0x7ad99a, transparent: true, opacity: 0.7 })
  );
  const angle = Math.random() * Math.PI * 2;
  const radius = 2 + Math.random() * 2.6;
  dot.position.set(Math.cos(angle) * radius, 0.4 + Math.random() * 3.2, Math.sin(angle) * radius);
  dot.userData.floatSeed = Math.random() * Math.PI * 2;
  scene.add(dot);
}

const presets = window.LQCharacters?.presets || [
  { id: "human_boy_v1", gender: "boy", icon: "👦🏽", label: { en: "Boy Explorer" }, model: "/assets/jungle/runtime/Boy_Final_Animated.rt.glb" },
  { id: "human_girl_v1", gender: "girl", icon: "👧🏽", label: { en: "Girl Explorer" }, model: "/assets/jungle/runtime/Girl_Mia_Animated.rt.glb" },
];

let controller = null;
let activePreset = null;
let activeState = "idle";
let autoRotate = false;
let actionTimer = null;
let targetRotation = ({front:0,left:Math.PI/2,back:Math.PI,right:-Math.PI/2})[reviewParams.get("view")] || 0;
let currentRotation = targetRotation;
let targetZoom = 6.6;
let dragging = false;
let dragX = 0;
let loadGeneration = 0;

function presetLabel(preset) {
  return preset.label?.en || preset.id;
}

function renderPresetButtons() {
  presetButtons.innerHTML = "";
  presets.forEach((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `preset-btn${activePreset?.id === preset.id ? " active" : ""}`;
    button.innerHTML = `<span class="icon">${preset.gender === "girl" ? "G" : "B"}</span><strong>${presetLabel(preset)}</strong>`;
    button.onclick = () => loadPreset(preset);
    presetButtons.appendChild(button);
  });
}

function setState(state) {
  clearTimeout(actionTimer);
  activeState = state;
  stateButtons.forEach((button) => button.classList.toggle("active", button.dataset.state === state));
  controller?.setState(state, { immediate: true });
}

async function loadPreset(preset) {
  const generation = ++loadGeneration;
  activePreset = preset;
  renderPresetButtons();
  assetBadge.className = "stage-badge";
  assetBadge.textContent = `Loading ${presetLabel(preset)}…`;
  clipInfo.textContent = "Inspecting character asset and animation clips…";

  controller?.dispose();
  controller = new CharacterController({ scene, preset, targetHeight: 2.85 });
  const loadingController = controller;
  controller.setPosition(0, 0, 0);
  controller.setRotationY(0);

  const result = await loadingController.load();
  if (generation !== loadGeneration) { loadingController.dispose(); return; }
  if (reviewParams.get("wireframe") === "1") controller.visual?.traverse(obj => {
    if (obj.isMesh) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(material => { material.wireframe = true; });
  });
  setState(activeState);
  if (result.mode === "gltf") {
    assetBadge.className = "stage-badge ok";
    assetBadge.textContent = `3D Explorer ready · ${presetLabel(preset)}`;
    clipInfo.textContent = result.clips.length
      ? `${result.clips.length} moves ready. Choose a move above to preview it.`
      : "GLB loaded. Add named clips (run/jump/slide/etc.) for full animation mapping.";
  } else {
    assetBadge.className = "stage-badge fallback";
    assetBadge.textContent = `3D Explorer ready · ${presetLabel(preset)}`;
    clipInfo.textContent = "Using the lightweight explorer. All preview controls remain available.";
  }
}

stateButtons.forEach((button) => {
  button.onclick = () => {
    const state = button.dataset.state;
    setState(state);
    const durations = {jump:800,land:240,hit:550,victory:2000,dodgeLeft:550,dodgeRight:550,turnLeft:600,turnRight:600,gesture:1600};
    if (durations[state]) actionTimer = window.setTimeout(() => setState("idle"), durations[state]);
  };
});

renderer.domElement.addEventListener("pointerdown", (event) => {
  dragging = true;
  dragX = event.clientX;
  renderer.domElement.setPointerCapture?.(event.pointerId);
});
renderer.domElement.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  const dx = event.clientX - dragX;
  dragX = event.clientX;
  targetRotation += dx * 0.012;
});
renderer.domElement.addEventListener("pointerup", () => { dragging = false; });
renderer.domElement.addEventListener("pointercancel", () => { dragging = false; });
renderer.domElement.addEventListener("wheel", (event) => {
  event.preventDefault();
  targetZoom = THREE.MathUtils.clamp(targetZoom + event.deltaY * 0.004, 4.8, 8.8);
}, { passive: false });

function resize() {
  const rect = host.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);
resize();

document.getElementById("frontView").onclick = () => { targetRotation = 0; autoRotate = false; document.getElementById("rotateView").setAttribute("aria-pressed", "false"); };
document.getElementById("backView").onclick = () => { targetRotation = Math.PI; autoRotate = false; document.getElementById("rotateView").setAttribute("aria-pressed", "false"); };
document.getElementById("rotateView").onclick = event => { autoRotate = !autoRotate; event.currentTarget.setAttribute("aria-pressed", String(autoRotate)); };
const pointers = new Map();
let pinchDistance = 0;
renderer.domElement.addEventListener("pointerdown", e => { pointers.set(e.pointerId, {x:e.clientX,y:e.clientY}); });
renderer.domElement.addEventListener("pointermove", e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
  if(pointers.size===2){
    dragging=false;
    const [a,b]=[...pointers.values()];const distance=Math.hypot(a.x-b.x,a.y-b.y);
    if(pinchDistance)targetZoom=THREE.MathUtils.clamp(targetZoom+(pinchDistance-distance)*.02,4.8,8.8);
    pinchDistance=distance;
  }
});
for(const type of ["pointerup","pointercancel"])renderer.domElement.addEventListener(type,e=>{pointers.delete(e.pointerId);pinchDistance=0;});
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  currentRotation += (targetRotation - currentRotation) * Math.min(1, dt * 8);
  if (!dragging && autoRotate) targetRotation += dt * 0.35;

  const state = activeState;
  controller?.setRotationY(currentRotation);
  if(controller) controller.root.position.y = state === "jump" ? Math.sin(Math.min(1, controller.stateTime/.8)*Math.PI)*.55 : 0;
  controller?.update(dt, {
    speed: state === "sprint" ? 1.45 : 1,
    lateral: state === "dodgeLeft" ? -1 : state === "dodgeRight" ? 1 : 0,
    airborne: state === "jump",
    sliding: state === "slide",
  });

  camera.position.z += (targetZoom - camera.position.z) * Math.min(1, dt * 8);
  camera.lookAt(0, 1.35, 0);
  ring.rotation.z += dt * 0.16;
  const now = performance.now() * 0.001;
  scene.children.forEach((obj) => {
    if (obj.userData.floatSeed == null) return;
    obj.position.y += Math.sin(now * 1.2 + obj.userData.floatSeed) * dt * 0.025;
    obj.rotation.y += dt * 0.8;
  });
  renderer.render(scene, camera);
}
frame();

const requested = new URLSearchParams(location.search).get("character");
loadPreset(presets.find((p) => p.id === requested) || presets[0]);
