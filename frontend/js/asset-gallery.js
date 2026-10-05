import * as THREE from "three";
import { GLTFLoader } from "/vendor/three-addons/loaders/GLTFLoader.js";
import { OrbitControls } from "/vendor/three-addons/controls/OrbitControls.js";

const $ = (id) => document.getElementById(id);
const RT = "/assets/jungle/runtime/", SRC = "/source-assets/";
const GROUPS = [
  ["Your model: girl.glb (high detail)", [["girl.glb (your file)", SRC + "characters/girl.glb", "High-detail master of the girl: 1.27 million triangles, no skeleton, no animations. The game uses the animated, lighter version of this same girl (\"Girl explorer (Mia)\" below), because a running character needs a skeleton."]]],
  ["Game models (optimised runtime copies)", [["Road tile (Bridge)", RT + "Bridge.rt.glb"], ["Tree", RT + "tree.rt.glb"], ["Bush cluster", RT + "bush_cluster.rt.glb"], ["Rock cluster", RT + "Stone_Sanctua.rt.glb"], ["Temple torch", RT + "jungle_temple_tourch.rt.glb"], ["Coin", RT + "Coin.rt.glb"], ["Golden Enigma", RT + "Golden_Enigma.rt.glb"], ["Question board", RT + "question_board.rt.glb"], ["Boy explorer", RT + "Boy_Final_Animated.rt.glb"], ["Girl explorer (Mia)", RT + "Girl_Mia_Animated.rt.glb"]]],
  ["Original sources (untouched, heavy)", [["Bridge", SRC + "3d/Bridge.glb"], ["tree", SRC + "3d/tree.glb"], ["bush_cluster", SRC + "3d/bush_cluster.glb"], ["Stone_Sanctua", SRC + "3d/Stone_Sanctua.glb"], ["jungle_temple_tourch (720k tris)", SRC + "3d/jungle_temple_tourch.glb"], ["Coin (193k tris)", SRC + "3d/Coin.glb"], ["Golden_Enigma", SRC + "3d/Golden_Enigma.glb"], ["question board", SRC + "3d/question board.glb"], ["Boy Final animated", SRC + "characters/LearnQuest_Boy_Final_Animated_v1.glb"], ["Girl Mia animated", SRC + "characters/Meshy_AI_Mia_s_First_Day_All_Animations.glb"]]],
];
const NOTES = new Map(GROUPS.flatMap(([, items]) => items.filter((i) => i[2]).map((i) => [i[1], i[2]])));
for (const [title, items] of GROUPS) {
  $("list").insertAdjacentHTML("beforeend", `<h4>${title}</h4>`);
  for (const [name, url] of items) { const b = document.createElement("button"); b.textContent = name; b.addEventListener("click", () => load(name, url, b)); $("list").appendChild(b); }
}

const renderer = new THREE.WebGLRenderer({ canvas: $("view"), antialias: true }); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color("#6a7f8a");
scene.add(new THREE.HemisphereLight(0xffffff, 0x445544, 2.0)); const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(3, 6, 5); scene.add(sun);
const cam = new THREE.PerspectiveCamera(40, 1, 0.01, 2000); const orbit = new OrbitControls(cam, $("view")); orbit.enableDamping = true;
const grid = new THREE.GridHelper(10, 20, 0xffffff, 0x889999); scene.add(grid); const axes = new THREE.AxesHelper(1); axes.visible = false; scene.add(axes);
let current = null, mixer = null, boxHelper = null, clips = [], action = null, loadToken = 0;
const loader = new GLTFLoader(); const clock = { t: performance.now() };

function resize() { const w = $("view").clientWidth, h = $("view").clientHeight; renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

async function fileSize(url) { try { const r = await fetch(url, { method: "HEAD" }); return Number(r.headers.get("content-length")) || 0; } catch { return 0; } }

async function load(name, url, button) {
  const token = ++loadToken; document.querySelectorAll("#list button").forEach((b) => b.classList.toggle("on", b === button));
  $("prog").textContent = `Loading ${name}...`; $("info").textContent = "Loading...";
  const size = await fileSize(url);
  let gltf;
  try { gltf = await new Promise((res, rej) => loader.load(url, res, (e) => { if (e.lengthComputable && token === loadToken) $("prog").textContent = `Loading ${name}... ${Math.round((100 * e.loaded) / e.total)}%`; }, rej)); }
  catch (e) { if (token === loadToken) { $("prog").textContent = `FAILED: ${name}`; $("info").innerHTML = `<b>Could not load</b><br>${url}<br>${e.message || e}<br><small>Original sources need the Explorer launcher (they are served from source_assets).</small>`; } return; }
  if (token !== loadToken) return;
  if (current) { scene.remove(current); current.traverse((o) => { o.geometry?.dispose?.(); }); }
  if (boxHelper) { scene.remove(boxHelper); boxHelper = null; }
  current = gltf.scene; scene.add(current); clips = gltf.animations; mixer = clips.length ? new THREE.AnimationMixer(current) : null; action = null;
  const box = new THREE.Box3().setFromObject(current); const sz = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const r = Math.max(sz.x, sz.y, sz.z) || 1; cam.position.set(ctr.x + r * 1.3, ctr.y + r * 0.7, ctr.z + r * 2.1); cam.near = r / 200; cam.far = r * 200; cam.updateProjectionMatrix(); orbit.target.copy(ctr); orbit.update();
  grid.scale.setScalar(r / 5); grid.position.y = box.min.y; axes.scale.setScalar(r * 0.6); axes.position.set(box.min.x, box.min.y, box.min.z);
  boxHelper = new THREE.Box3Helper(box, 0xffd23f); boxHelper.visible = $("oBox").checked; scene.add(boxHelper);
  let tris = 0, verts = 0, meshes = 0, joints = 0; const mats = new Set(), texs = new Set();
  current.traverse((o) => { if (!o.isMesh) return; meshes++; const g = o.geometry; verts += g.attributes.position.count; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; if (o.isSkinnedMesh) joints = Math.max(joints, o.skeleton.bones.length);
    for (const m of [].concat(o.material)) { mats.add(m); for (const k of ["map", "normalMap", "metalnessMap", "roughnessMap", "emissiveMap", "aoMap"]) if (m[k]) texs.add(m[k]); } });
  setWire($("oWire").checked);
  const texInfo = [...texs].map((t) => t.image ? `${t.image.width}x${t.image.height}` : "?").join(", ");
  const note = NOTES.get(url) ? `<p class="note">${NOTES.get(url)}</p>` : "";
  $("oAnim").innerHTML = `<option value="">(none)</option>` + clips.map((c, i) => `<option value="${i}">${c.name} (${c.duration.toFixed(2)}s)</option>`).join("");
  $("prog").textContent = name;
  $("info").innerHTML = `<h3>${name}</h3><table class="kv"><tr><th>File</th><td>${url.split("/").pop()}</td></tr><tr><th>Size</th><td>${size ? (size / 1e6).toFixed(2) + " MB" : "?"}</td></tr><tr><th>Triangles</th><td>${Math.round(tris).toLocaleString()}</td></tr><tr><th>Vertices</th><td>${verts.toLocaleString()}</td></tr><tr><th>Meshes</th><td>${meshes}</td></tr><tr><th>Materials</th><td>${mats.size}</td></tr><tr><th>Textures</th><td>${texs.size}${texInfo ? "<br>" + texInfo : ""}</td></tr><tr><th>Bounding box</th><td>${sz.x.toFixed(2)} x ${sz.y.toFixed(2)} x ${sz.z.toFixed(2)}</td></tr><tr><th>Skeleton</th><td>${joints ? joints + " joints" : "none"}</td></tr><tr><th>Animations</th><td>${clips.length ? clips.map((c) => `${c.name} ${c.duration.toFixed(2)}s`).join("<br>") : "none"}</td></tr></table>${note}`;
  const idle = clips.findIndex((c) => /idle|run/i.test(c.name)); if (clips.length) { $("oAnim").value = String(idle >= 0 ? idle : 0); playClip(); }
}
function playClip() { if (!mixer) return; mixer.stopAllAction(); const i = $("oAnim").value; if (i === "") { action = null; return; } action = mixer.clipAction(clips[Number(i)]); action.play(); }
function setWire(on) { current?.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) m.wireframe = on; }); }
$("oWire").addEventListener("change", (e) => setWire(e.target.checked)); $("oBox").addEventListener("change", (e) => { if (boxHelper) boxHelper.visible = e.target.checked; });
$("oAxes").addEventListener("change", (e) => { axes.visible = e.target.checked; }); $("oGrid").addEventListener("change", (e) => { grid.visible = e.target.checked; });
$("oBg").addEventListener("change", (e) => { scene.background = new THREE.Color(e.target.value); }); $("oAnim").addEventListener("change", playClip);
renderer.setAnimationLoop(() => { const now = performance.now(); const dt = Math.min(0.05, (now - clock.t) / 1000); clock.t = now; if (mixer && !$("oPause").checked) mixer.update(dt * Number($("oSpeed").value)); orbit.update(); renderer.render(scene, cam); });
const auto = new URLSearchParams(location.search).get("model") || "girl.glb (your file)"; document.querySelectorAll("#list button").forEach((b) => { if (b.textContent === auto) b.click(); });   // opens on your girl.glb
window.__gallery = { load: (name) => [...document.querySelectorAll("#list button")].find((b) => b.textContent === name)?.click(), get current() { return current; } };
