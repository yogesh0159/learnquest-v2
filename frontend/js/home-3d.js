/**
 * LearnQuest home page: premium UI + a live 3D hero.
 *
 *  - The page is complete and fast WITHOUT any 3D (an illustration sits in the hero).
 *  - On a good device the real game assets (road, trees, torches, coins, the Boy explorer and the cap-and-glasses teacher chasing him) are
 *    loaded after the first paint and rendered live; weak devices (software GL, old cards, phones on mobile data, data-saver, reduced motion)
 *    keep the illustration. If the 3D scene is too slow it removes itself.
 *  - ?home3d=1 forces the 3D scene, ?home3d=0 turns it off.
 */
import * as THREE from "three";
import { GLTFLoader } from "/vendor/three-addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "/vendor/three-addons/utils/SkeletonUtils.js";
import { RoomEnvironment } from "/vendor/three-addons/environments/RoomEnvironment.js";
import { ASSET_REGISTRY as A } from "./game/jungle-run/config.js";
import { normalizeModel } from "./game/jungle-run/asset-manager.js";
import { AnimationController } from "./game/jungle-run/animation-controller.js";
import { analyseDevice, collectBrowserFacts, tierIndex } from "./game/jungle-run/device-profile.js";

/* ============================================================================================ texts (English / Hindi / Marathi) */
const H = {
  en: { nav_play: "Play", nav_parents: "Parents", nav_kids: "Kids", cta_play: "\u25B6 Play game", cta_more: "Learn more", free_note: "Try 3 free runs, no sign-up needed.", pages_note: "Playing on the free web page: your progress is saved on this device.", nav_how: "How it works", nav_team: "Explorers", nav_platforms: "Play anywhere", eyebrow: "Now with a friendly teacher", trust_langs: "languages", trust_subjects: "subjects", trust_quality: "adapts to your device", trust_offline: "works offline",
    how_title: "How the adventure works", how_1_t: "Run & collect", how_1_b: "Dash through the jungle, dodge rocks and collect golden coins.", how_2_t: "Answer at the board", how_2_b: "Run through the right lane to answer Maths, patterns, spelling, science and shapes.", how_3_t: "A teacher helps you", how_3_b: "A friendly teacher runs behind you. Caught? Answer her rescue question and run free!",
    team_title: "Meet the explorers", team_boy: "Boy explorer", team_boy_b: "Quick, brave and always ready to run.", team_girl: "Girl explorer", team_girl_b: "Light on her feet, sharp with every answer.", team_teacher: "The Teacher", team_teacher_b: "Cap, glasses and a book. Asks, helps and cheers you on.",
    plat_title: "Play anywhere", plat_sub: "One game for phones, tablets, laptops and desktops. Install it and play offline.", plat_note: "The picture quality adapts to your device, up to 4K.", cta_title: "Ready to run?", cta_btn: "\u25B6 Play game", chip_3d: "Live 3D scene", chip_light: "Light mode" },
  hi: { nav_play: "खेलो", nav_parents: "पेरेंट्स", nav_kids: "बच्चे", cta_play: "\u25B6 गेम खेलो", cta_more: "और जानो", free_note: "3 दौड़ें मुफ़्त आज़माइए, साइन-अप की ज़रूरत नहीं।", pages_note: "मुफ़्त वेब पेज पर खेल रहे हैं: आपकी प्रगति इसी डिवाइस पर सेव होती है।", nav_how: "कैसे खेलें", nav_team: "खिलाड़ी", nav_platforms: "कहीं भी खेलो", eyebrow: "अब एक दोस्ताना टीचर के साथ", trust_langs: "भाषाएँ", trust_subjects: "विषय", trust_quality: "आपके डिवाइस के हिसाब से", trust_offline: "ऑफ़लाइन भी चलता है",
    how_title: "यह एडवेंचर कैसे चलता है", how_1_t: "दौड़ो और इकट्ठा करो", how_1_b: "जंगल में दौड़ो, पत्थरों से बचो और सुनहरे सिक्के इकट्ठा करो।", how_2_t: "बोर्ड पर जवाब दो", how_2_b: "सही लेन में दौड़कर गणित, पैटर्न, स्पेलिंग, विज्ञान और आकृतियों के जवाब दो।", how_3_t: "टीचर मदद करती हैं", how_3_b: "एक दोस्ताना टीचर तुम्हारे पीछे दौड़ती हैं। पकड़ लिया? उनका बचाव-सवाल हल करो और आज़ाद दौड़ो!",
    team_title: "खिलाड़ियों से मिलो", team_boy: "लड़का खिलाड़ी", team_boy_b: "तेज़, बहादुर और हमेशा दौड़ने को तैयार।", team_girl: "लड़की खिलाड़ी", team_girl_b: "फुर्तीली और हर जवाब में तेज़।", team_teacher: "टीचर", team_teacher_b: "टोपी, चश्मा और किताब। पूछती हैं, मदद करती हैं और हौसला बढ़ाती हैं।",
    plat_title: "कहीं भी खेलो", plat_sub: "फ़ोन, टैबलेट, लैपटॉप और डेस्कटॉप के लिए एक ही गेम। इंस्टॉल करो और ऑफ़लाइन खेलो।", plat_note: "तस्वीर की क्वालिटी आपके डिवाइस के हिसाब से अपने आप बदलती है, 4K तक।", cta_title: "दौड़ने के लिए तैयार?", cta_btn: "\u25B6 गेम खेलो", chip_3d: "लाइव 3D सीन", chip_light: "हल्का मोड" },
  mr: { nav_play: "खेळा", nav_parents: "पालक", nav_kids: "मुले", cta_play: "\u25B6 गेम खेळा", cta_more: "अधिक जाणून घ्या", free_note: "3 धावा मोफत वापरून पाहा, साइन-अप नको.", pages_note: "मोफत वेब पेजवर खेळत आहात: तुमची प्रगती याच डिव्हाइसवर सेव्ह होते.", nav_how: "कसे खेळायचे", nav_team: "खेळाडू", nav_platforms: "कुठेही खेळा", eyebrow: "आता मित्रत्वाच्या टीचरसह", trust_langs: "भाषा", trust_subjects: "विषय", trust_quality: "तुमच्या डिव्हाइसनुसार", trust_offline: "ऑफलाइनही चालते",
    how_title: "हे साहस कसे चालते", how_1_t: "धावा आणि गोळा करा", how_1_b: "जंगलात धावा, दगडांपासून वाचा आणि सोनेरी नाणी गोळा करा.", how_2_t: "बोर्डवर उत्तर द्या", how_2_b: "योग्य लेनमधून धावून गणित, पॅटर्न, स्पेलिंग, विज्ञान आणि आकारांची उत्तरे द्या.", how_3_t: "टीचर मदत करतात", how_3_b: "एक मित्रत्वाची टीचर तुमच्या मागे धावते. पकडले? तिचा सुटका-प्रश्न सोडवा आणि मोकळे धावा!",
    team_title: "खेळाडूंना भेटा", team_boy: "मुलगा खेळाडू", team_boy_b: "चपळ, धाडसी आणि नेहमी धावायला तयार.", team_girl: "मुलगी खेळाडू", team_girl_b: "चपळ आणि प्रत्येक उत्तरात हुशार.", team_teacher: "टीचर", team_teacher_b: "टोपी, चष्मा आणि पुस्तक. विचारतात, मदत करतात आणि प्रोत्साहन देतात.",
    plat_title: "कुठेही खेळा", plat_sub: "फोन, टॅबलेट, लॅपटॉप आणि डेस्कटॉपसाठी एकच गेम. इंस्टॉल करा आणि ऑफलाइन खेळा.", plat_note: "चित्राची क्वालिटी तुमच्या डिव्हाइसनुसार आपोआप बदलते, 4K पर्यंत.", cta_title: "धावायला तयार?", cta_btn: "\u25B6 गेम खेळा", chip_3d: "लाइव्ह 3D सीन", chip_light: "हलका मोड" },
};
const lang = () => { try { return localStorage.getItem("lq_lang") || "en"; } catch { return "en"; } };
export function applyHomeTexts() {
  const d = H[lang()] || H.en;
  document.querySelectorAll("[data-h]").forEach((el) => { const v = d[el.dataset.h] ?? H.en[el.dataset.h]; if (v != null) el.textContent = v; });
}
document.addEventListener("lq:i18n-ready", applyHomeTexts);
document.addEventListener("lq:lang-changed", applyHomeTexts);
applyHomeTexts();

/* ============================================================================================ page motion */
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const nav = document.getElementById("nav");
const onScroll = () => nav.classList.toggle("scrolled", scrollY > 24);
addEventListener("scroll", onScroll, { passive: true }); onScroll();

const io = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }, { threshold: 0.14, rootMargin: "0px 0px -6% 0px" });
document.querySelectorAll(".reveal:not(.in)").forEach((el) => (reduced ? el.classList.add("in") : io.observe(el)));

if (!reduced && matchMedia("(hover: hover)").matches) {              // 3D tilt on cards (mouse only)
  document.querySelectorAll(".tilt").forEach((card) => {
    card.addEventListener("pointermove", (e) => { const r = card.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; card.style.transform = `perspective(800px) rotateX(${(-y * 9).toFixed(2)}deg) rotateY(${(x * 11).toFixed(2)}deg) translateZ(6px)`; });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
  });
}

/* ============================================================================================ 3D hero */
const state = (window.__home3d = { mode: "static", level: "none", why: "", ready: false, fps: 0, dpr: 0, frames: 0 });
const chip = document.getElementById("modeChip");
function setMode(mode, why = "") {
  state.mode = mode; state.why = why; document.body.dataset.home3d = mode === "3d" ? "on" : "off";
  const span = chip?.querySelector("span"); if (span) { span.dataset.h = mode === "3d" ? "chip_3d" : "chip_light"; applyHomeTexts(); }
}
setMode("static", "starting");

async function decide() {
  const q = new URLSearchParams(location.search).get("home3d");
  if (q === "0") return { ok: false, why: "turned off (?home3d=0)" };
  const force = q === "1"; const c = navigator.connection || {};
  if (!force) {
    if (reduced) return { ok: false, why: "reduced motion" };
    if (c.saveData) return { ok: false, why: "data saver" };
    if (c.type === "cellular") return { ok: false, why: "mobile data" };
  }
  let facts, a;
  try { facts = await collectBrowserFacts({ measureRefreshMs: 120 }); a = analyseDevice(facts); } catch (e) { return { ok: false, why: "device check failed" }; }
  if (!facts.gpu || facts.gpu === "none") return { ok: false, why: "no WebGL2" };
  if (force) return { ok: true, force: true, level: new URLSearchParams(location.search).get("level") || (tierIndex(a.cap) >= tierIndex("high") ? "full" : "lite"), a };
  if (a.gpuClass === "software") return { ok: false, why: "software rendering" };
  if (tierIndex(a.cap) < tierIndex("balanced")) return { ok: false, why: `device level ${a.cap}` };
  const strong = tierIndex(a.cap) >= tierIndex("high") && a.gpuClass === "discrete" && !facts.mobile;
  return { ok: true, level: strong ? "full" : "lite", a };
}

const loader = new GLTFLoader();
const loadGltf = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Graduation cap, round glasses and a book on the (cloned) Boy: positions measured on the model's bones. */
function dressAsTeacher(model) {
  model.updateMatrixWorld(true);
  const bone = (re) => { let r = null; model.traverse((o) => { if (!r && o.isBone && re.test(o.name)) r = o; }); return r; };
  const head = bone(/Head$/), hand = bone(/RightHand$/); if (!head) return;
  const qa = new THREE.Quaternion(), v = new THREE.Vector3();
  const attach = (b, obj, pos, rot) => {
    const wp = new THREE.Vector3(...pos).applyMatrix4(model.matrixWorld); b.worldToLocal(wp); obj.position.copy(wp);
    obj.quaternion.copy(b.getWorldQuaternion(qa).clone().invert().multiply(model.getWorldQuaternion(new THREE.Quaternion()))); if (rot) obj.quaternion.multiply(rot);
    obj.scale.setScalar(model.getWorldScale(v).x / b.getWorldScale(new THREE.Vector3()).x); b.add(obj);
  };
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const cap = new THREE.Group(), navy = mat(0x1d2c5e), gold = mat(0xf5b301);
  const skull = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.23, 0.09, 18), navy), board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.028, 0.5), navy); board.position.y = 0.075; board.rotation.y = Math.PI / 4;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6), gold); cord.position.set(0.23, -0.03, 0.04); const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), gold); tuft.position.set(0.23, -0.14, 0.04);
  cap.add(skull, board, cord, tuft); attach(head, cap, [0.008, 1.645, 0.0]);
  const glasses = new THREE.Group(), frame = new THREE.MeshBasicMaterial({ color: 0x20150a });
  for (const sx of [-1, 1]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.012, 8, 24), frame); ring.position.x = sx * 0.12; glasses.add(ring); }
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6), frame); bridge.rotation.z = Math.PI / 2; glasses.add(bridge); attach(head, glasses, [0.008, 1.385, -0.305]);
  if (hand) { const book = new THREE.Group(); book.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.045), mat(0xc0392b)), new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.21, 0.036), mat(0xfff4d6))); attach(hand, book, [0.33, 0.83, -0.1], new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.4, 0, 0.2))); }
}

async function start3D(level, a, forced = false) {
  const hero = document.getElementById("top"), canvas = document.getElementById("heroCanvas"), loadBar = document.getElementById("heroLoad");
  const full = level === "full";
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: full, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.06; renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xcdf0d9, 26, 92);
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight(0xeaffea, 0x3a6b3a, 1.15)); const sun = new THREE.DirectionalLight(0xfff1cf, 2.3); sun.position.set(-6, 10, 7); scene.add(sun);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 160); const camBase = new THREE.Vector3(0, 2.9, 6.4), look = new THREE.Vector3(0, 1.3, -5);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), new THREE.MeshStandardMaterial({ color: 0x4aa862, roughness: 1, metalness: 0 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; scene.add(ground);

  // ---- assets: the game's own full-detail models (the cheap "LOD" copies are for far objects only and look smeared close-up), about 13 MB in total ----
  let done = 0; const want = full ? 6 : 5; loadBar.hidden = false;
  const tick = () => { done++; loadBar.firstElementChild.style.width = `${Math.round((100 * done) / want)}%`; };
  const get = async (url) => { const g = await loadGltf(url); tick(); return g; };
  const [road, tree, coin, boy, torch] = await Promise.all([get(A.path.url), get(A.tree.url), get(A.coin.url), get(A.boy.url), full ? get(A.torch.url) : (tick(), null)]);
  const proto = (g, key) => normalizeModel(g.scene, A[key].fit).root;

  // ---- world pieces that scroll towards the camera ----
  const SPEED = 9, TILE = 12, TILES = 8, LANES = [-2.2, 0, 2.2];
  const roadProto = proto(road, "path"); const tiles = []; for (let i = 0; i < TILES; i++) { const t = roadProto.clone(true); t.position.z = 8 - i * TILE; scene.add(t); tiles.push(t); }
  const treeProto = proto(tree, "tree"); const trees = []; const perSide = full ? 6 : 3, rowGap = (TILE * TILES) / perSide;
  for (const side of [-1, 1]) for (let i = 0; i < perSide; i++) { const t = treeProto.clone(true); t.position.set(side * rand(8.5, 15), 0, 10 - i * rowGap - rand(0, 4)); t.scale.setScalar(rand(0.75, 1.15)); t.rotation.y = rand(0, 6.28); scene.add(t); trees.push(t); }
  const torches = []; if (torch) { const tp = proto(torch, "torch"); for (const side of [-1, 1]) for (let i = 0; i < 2; i++) { const t = tp.clone(true); t.position.set(side * 5.8, 0, 2 - i * 40); scene.add(t); torches.push(t); } }
  const coinProto = proto(coin, "coin"); const groups = [];
  for (let g = 0; g < 4; g++) { const grp = new THREE.Group(); grp.userData = { lane: LANES[g % 3], coins: [] }; for (let c = 0; c < 5; c++) { const m = coinProto.clone(true); m.position.set(0, 1.15, -c * 1.15); m.userData.alive = true; grp.add(m); grp.userData.coins.push(m); } grp.position.set(grp.userData.lane, 0, -14 - g * 20); scene.add(grp); groups.push(grp); }

  // ---- characters ----
  const mkRunner = (clone) => { const src = clone ? SkeletonUtils.clone(boy.scene) : boy.scene; const root = normalizeModel(src, A.boy.fit).root; scene.add(root); const ctl = new AnimationController(root, boy.animations, { logger: { warn() {}, info() {}, log() {} }, name: clone ? "teacher" : "runner" }); ctl.play("RUN", { fade: 0, timeScale: clone ? 1.05 : 1.2 }); return { root, ctl }; };
  const runner = mkRunner(false); runner.root.position.set(0, 0, 0);
  let teacher = null; if (full) { teacher = mkRunner(true); dressAsTeacher(teacher.root); teacher.root.position.set(1.2, 0, 2.5); }

  // ---- sparkles (coin pick-ups) and floating motes ----
  const sprite = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,220,90,.9)"); g.addColorStop(1, "rgba(255,200,40,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const N = 90, sp = { pos: new Float32Array(N * 3), vel: new Float32Array(N * 3), life: new Float32Array(N), next: 0 }; sp.pos.fill(-999);
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute("position", new THREE.BufferAttribute(sp.pos, 3));
  const sparkles = new THREE.Points(spGeo, new THREE.PointsMaterial({ map: sprite, size: 0.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sparkles.frustumCulled = false; scene.add(sparkles);
  const M = full ? 70 : 36, motes = { pos: new Float32Array(M * 3) }; for (let i = 0; i < M; i++) motes.pos.set([rand(-12, 12), rand(0.3, 6), rand(-40, 6)], i * 3);
  const moGeo = new THREE.BufferGeometry(); moGeo.setAttribute("position", new THREE.BufferAttribute(motes.pos, 3));
  const moteObj = new THREE.Points(moGeo, new THREE.PointsMaterial({ map: sprite, size: 0.22, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })); moteObj.frustumCulled = false; scene.add(moteObj);
  const burst = (x, y, z) => { for (let k = 0; k < 10; k++) { const i = sp.next++ % N; sp.pos.set([x, y, z], i * 3); sp.vel.set([rand(-1.6, 1.6), rand(1, 3), rand(-1.2, 1.2)], i * 3); sp.life[i] = 0.7; } };

  // ---- size, pointer parallax, scroll dolly ----
  let W = 0, Hh = 0, dpr = Math.min(devicePixelRatio || 1, full ? 1.75 : 1.25); const dprCap = dpr;
  const resize = () => { const r = canvas.getBoundingClientRect(); W = Math.max(2, Math.round(r.width)); Hh = Math.max(2, Math.round(r.height)); renderer.setPixelRatio(dpr); renderer.setSize(W, Hh, false); camera.aspect = W / Hh;
    const wide = camera.aspect > 1.15; camera.fov = wide ? 48 : 56; camBase.z = wide ? 6.4 : 7.4;
    if (wide) camera.setViewOffset(W, Hh, -W * 0.17, 0, W, Hh); else camera.clearViewOffset();   // phones: the scene has its own area above the text
    camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(canvas); resize();
  const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
  if (!reduced) addEventListener("pointermove", (e) => { ptr.x = (e.clientX / innerWidth - 0.5) * 2; ptr.y = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });

  // ---- main loop (pauses when the hero is off-screen or the tab is hidden) ----
  let visible = true, last = performance.now(), ema = 0.016, adaptT = 0, runnerX = 0, targetLane = 0, laneT = 1.6, mx = 0, t = 0, stopped = false;
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { threshold: 0.02 }).observe(hero);
  const fail = (why) => { stopped = true; try { renderer.dispose(); } catch { /* ignore */ } setMode("static", why); loadBar.hidden = true; };
  let first = true;
  const frame = (now) => {
    if (stopped) return; requestAnimationFrame(frame);
    if (document.hidden || !visible) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; if (dt <= 0) return;
    ema += (dt - ema) * 0.08; state.fps = Math.round(1 / ema); state.frames++;
    // keep it smooth: lower the resolution, and give up (illustration again) if the device cannot cope
    adaptT += dt; if (adaptT > 1.6 && state.frames > 40) { adaptT = 0; if (ema > 0.036 && dpr > 0.7) { dpr = Math.max(0.7, dpr - 0.25); resize(); } else if (ema > 0.05 && !forced) return fail("too slow"); else if (ema < 0.019 && dpr < dprCap) { dpr = Math.min(dprCap, dpr + 0.125); resize(); } }
    state.dpr = dpr;
    const dz = SPEED * dt;
    for (const r of tiles) { r.position.z += dz; if (r.position.z > 14) r.position.z -= TILE * TILES; }
    for (const r of trees) { r.position.z += dz; if (r.position.z > 14) { r.position.z -= TILE * TILES; r.position.x = Math.sign(r.position.x) * rand(8.5, 15); } }
    for (const r of torches) { r.position.z += dz; if (r.position.z > 12) r.position.z -= 80; }
    for (const g of groups) { g.position.z += dz; if (g.position.z > 8) { g.position.z -= 80; g.userData.lane = LANES[(Math.random() * 3) | 0]; g.position.x = g.userData.lane; for (const c of g.userData.coins) { c.userData.alive = true; c.visible = true; c.scale.setScalar(1); } }
      for (const c of g.userData.coins) { if (!c.userData.alive) continue; c.rotation.y += dt * 3.2; c.position.y = 1.15 + Math.sin(t * 3 + c.position.z) * 0.07; const wz = g.position.z + c.position.z; if (wz > -0.3 && wz < 1.1 && Math.abs(g.position.x - runnerX) < 1.3) { c.userData.alive = false; c.visible = false; burst(g.position.x, 1.2, wz); } } }
    // the runner looks for the next coins and changes lane; the teacher runs beside and a little behind
    laneT -= dt; if (laneT <= 0) { laneT = rand(2.2, 3.4); const nxt = groups.filter((g) => g.position.z < -6 && g.position.z > -34).sort((p, q) => q.position.z - p.position.z)[0]; targetLane = nxt ? nxt.userData.lane : LANES[(Math.random() * 3) | 0]; }
    const px = runnerX; runnerX += (targetLane - runnerX) * (1 - Math.exp(-5 * dt)); const vx = (runnerX - px) / dt;
    runner.root.position.x = runnerX; runner.root.rotation.z = clamp(-vx * 0.03, -0.25, 0.25); runner.root.position.y = Math.abs(Math.sin(t * 9.6)) * 0.035; runner.ctl.update(dt);
    if (teacher) { const side = runnerX > 0.5 ? -1 : 1; const tx = clamp(runnerX + side * 1.15, -3.2, 3.2); teacher.root.position.x += (tx - teacher.root.position.x) * (1 - Math.exp(-2.6 * dt)); teacher.root.position.z = 2.5 + Math.sin(t * 0.9) * 0.3; teacher.ctl.update(dt); }
    for (let i = 0; i < N; i++) { if (sp.life[i] > 0) { sp.life[i] -= dt; const j = i * 3; sp.vel[j + 1] -= 5 * dt; sp.pos[j] += sp.vel[j] * dt; sp.pos[j + 1] += sp.vel[j + 1] * dt; sp.pos[j + 2] += sp.vel[j + 2] * dt + dz; if (sp.life[i] <= 0) sp.pos[j + 1] = -999; } } spGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < M; i++) { const j = i * 3; motes.pos[j + 2] += dz * 0.9; motes.pos[j + 1] += Math.sin(t + i) * 0.004; if (motes.pos[j + 2] > 8) { motes.pos[j + 2] -= 48; motes.pos[j] = rand(-12, 12); } } moGeo.attributes.position.needsUpdate = true;
    // camera: gentle pointer parallax + a slow dolly while the page scrolls away from the hero
    const prog = clamp(scrollY / Math.max(1, Hh), 0, 1); ptr.sx += (ptr.x - ptr.sx) * 0.05; ptr.sy += (ptr.y - ptr.sy) * 0.05;
    camera.position.set(camBase.x + ptr.sx * 0.7, camBase.y - ptr.sy * 0.25 + prog * 0.8, camBase.z + prog * 2.4); camera.lookAt(look.x + ptr.sx * 0.5, look.y, look.z);
    canvas.style.opacity = String(1 - prog * 0.85);
    renderer.render(scene, camera);
    if (first) { first = false; loadBar.hidden = true; setMode("3d", level); setTimeout(() => { canvas.style.transition = "none"; }, 1100);   // the fade-in is done; from now on the opacity follows the scroll directly
      state.ready = true; state.triangles = renderer.info.render.triangles; state.calls = renderer.info.render.calls; document.dispatchEvent(new CustomEvent("home3d-ready")); }
  };
  state.level = level; state.api = { scene, camera, renderer, runner, teacher };
  requestAnimationFrame(frame);
  renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); fail("graphics context lost"); });
}

(async () => {
  try {
    const d = await decide();
    if (!d.ok) { setMode("static", d.why); return; }
    // the page is already painted; start the scene when the browser is idle
    await new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 1200 }) : setTimeout(r, 400)));
    await start3D(d.level, d.a, !!d.force);
  } catch (e) {
    console.info("[LearnQuest] home page 3D not used:", e && e.message ? e.message : e);
    setMode("static", "error"); const lb = document.getElementById("heroLoad"); if (lb) lb.hidden = true;
  }
})();
