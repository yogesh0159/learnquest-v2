import { CharacterController } from "./game/character-controller.js";
import { InputController } from "./game/core/input-controller.js";
import { classifyRunnerCollision, closestLaneIndex } from "./game/core/collision-system.js";
import { loadThreeEngine } from "./game/core/asset-manager.js";
import { disposeObject3D, resizeRunnerView, runnerQualityProfile, hintedQualityTier, deviceCapTier, RuntimeQualityManager } from "./game/core/performance-manager.js";
import { GameLoop } from "./game/core/game-loop.js";
import { LearningFocus } from "./game/core/learning-focus.js";
import { equippedRewardsBySlot, initialRewardState } from "./game/core/reward-system.js";

const $ = (id) => document.getElementById(id);
const ui = {
  host: $("threeHost"), loading: $("loadingBadge"), startOverlay: $("startOverlay"), startBtn: $("startBtn"),
  introTitle: $("introTitle"), introMission: $("introMission"), pauseOverlay: $("pauseOverlay"), resumeBtn: $("resumeBtn"),
  resultOverlay: $("resultOverlay"), resultModal: $("resultModal"), levelBadge: $("levelBadge"), score: $("scoreHud"),
  coins: $("coinHud"), keys: $("keyHud"), speed: $("speedHud"), progress: $("progressBar"), missionText: $("missionText"),
  missionStats: $("missionStats"), questionPanel: $("questionPanel"), questionTopic: $("questionTopic"), questionText: $("questionText"),
  questionOptions: $("questionOptions"), feedback: $("feedbackFlash"), feedbackIcon: $("feedbackIcon"), feedbackTitle: $("feedbackTitle"),
  feedbackText: $("feedbackText"), combo: $("comboToast"), sound: $("soundBtn"), pause: $("pauseBtn"),
  left: $("leftBtn"), right: $("rightBtn"), jump: $("jumpBtn"), slide: $("slideBtn"),
  thinkTimeStatus: $("thinkTimeStatus"), ready: $("readyBtn"),
};

requireChildAuth();

const params = new URLSearchParams(location.search);
const levelId = params.get("level");
if (!levelId) location.href = "world-maths_kingdom.html";

let THREE;
try { THREE = await loadThreeEngine(); }
catch (threeLoadError) {
  ui.loading.textContent = "3D engine could not load. Check your internet connection and refresh.";
  ui.startBtn.textContent = "3D engine unavailable";
  console.error(threeLoadError);
  throw threeLoadError;
}

const LANES = [-3.15, 0, 3.15];
const ROAD_WIDTH = 10.6;
const TILE_LENGTH = 14;
const TILE_COUNT = 11;
const SPAWN_Z = -92;
const PLAYER_Z = 2.1;
const COLLISION_Z_MIN = 0.4;
const COLLISION_Z_MAX = 3.35;

const levelThemes = [
  { sky: 0xd9c9f2, fog: 0xe5daf5, ground: 0x557048, road: 0x8d8492, grass: 0x5d8b56, accent: 0xf1c65b, name: "Castle Gate" },
  { sky: 0xd8d3f4, fog: 0xe8e3f6, ground: 0x65724b, road: 0x908494, grass: 0x668b4e, accent: 0xffcc63, name: "Number Market" },
  { sky: 0xbfd7ef, fog: 0xd8e6f4, ground: 0x4e6650, road: 0x8a7465, grass: 0x527d56, accent: 0x6ecbe5, name: "Fraction Bridge" },
  { sky: 0xe6d9ef, fog: 0xeee5f3, ground: 0x65704f, road: 0x8e8690, grass: 0x6b925d, accent: 0xe4a8e8, name: "Shape Courtyard" },
  { sky: 0xd6c5ed, fog: 0xe5daf0, ground: 0x574a66, road: 0x7f7582, grass: 0x5e7451, accent: 0xf0bd58, name: "Multiplication Tower" },
  { sky: 0x51506a, fog: 0x3c3b52, ground: 0x2f3340, road: 0x55535f, grass: 0x3c4c42, accent: 0xc895ff, name: "Division Dungeon" },
  { sky: 0x8eb1c4, fog: 0xb7c8d2, ground: 0x554d42, road: 0x746f6f, grass: 0x526851, accent: 0xffc85d, name: "Clockwork Hall" },
  { sky: 0xc7e2d2, fog: 0xdcece2, ground: 0x55644b, road: 0x8b8a83, grass: 0x4f8b5f, accent: 0x78d8a0, name: "Geometry Garden" },
  { sky: 0xdbc8ee, fog: 0xe8def1, ground: 0x4f4658, road: 0x766e79, grass: 0x596849, accent: 0xffd36f, name: "Royal Equation Hall" },
  { sky: 0x7d526f, fog: 0x85687e, ground: 0x342d35, road: 0x59505a, grass: 0x41443a, accent: 0xff914d, name: "Dragon Tower" },
];

function levelConfig(level, child) {
  const n = Number(level.level_number || 1);
  const ageMod = child.age_group === "4-6" ? 0.84 : child.age_group === "10-12" ? 1.10 : 1;
  const isBoss = Number(level.is_boss || 0) === 1;
  return {
    number: n,
    theme: levelThemes[Math.min(levelThemes.length - 1, n - 1)],
    baseSpeed: (12.8 + (n - 1) * 0.66) * ageMod,
    maxSpeed: (20.8 + n * 0.58) * ageMod,
    length: isBoss ? 780 : 470 + n * 34,
    obstacleSpacing: Math.max(10.8, 18.0 - n * 0.58),
    coinSpacing: 8.2,
    keyTarget: isBoss ? 4 : n <= 3 ? 2 : n <= 6 ? 3 : 4,
    coinTarget: isBoss ? 45 : n === 1 ? 18 : n <= 3 ? 22 : n <= 6 ? 28 : 36,
    questionCount: Math.max(3, Number(level.questions_required || 3)),
    isBoss,
    bossHp: Number(level.boss_hp || 6),
  };
}

class RunnerAudio {
  constructor() { this.ctx = null; this.muted = false; }
  async unlock() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }
  tone(freq = 440, duration = .08, type = "sine", volume = .05, slide = 0) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now); osc.stop(now + duration);
  }
  coin() { this.tone(760,.07,"sine",.045,170); }
  key() { this.tone(520,.10,"triangle",.06,260); setTimeout(()=>this.tone(900,.12,"sine",.04,80),70); }
  jump() { this.tone(260,.12,"triangle",.035,180); }
  slide() { this.tone(150,.08,"square",.025,-30); }
  correct() { this.tone(560,.12,"sine",.06,220); setTimeout(()=>this.tone(860,.16,"triangle",.05,160),85); }
  wrong() { this.tone(180,.28,"sawtooth",.055,-90); }
  hit() { this.tone(110,.35,"square",.07,-55); }
  shield() { this.tone(420,.2,"sine",.05,420); }
  win() { [520,660,820,1040].forEach((f,i)=>setTimeout(()=>this.tone(f,.18,"triangle",.05,80),i*90)); }
}

class KingdomRunner {
  constructor({ THREE, state, level, questions }) {
    this.T = THREE;
    this.state = state;
    this.child = state.child;
    this.level = level;
    this.questions = questions;
    this.config = levelConfig(level, this.child);
    this.audio = new RunnerAudio();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.config.theme.sky);
    this.scene.fog = new THREE.Fog(this.config.theme.fog, 30, 115);
    this.clock = new THREE.Clock();
    this.renderer = null;
    this.camera = null;
    this.player = null;
    this.playerParts = {};
    this.characterController = null;
    this.characterStateTimer = 0;
    this.wasAirborne = false;
    this.pet = null;
    this.dragon = null;
    this.roadTiles = [];
    this.entities = [];
    this.particles = [];
    this.runId = null;
    this.runToken = null;
    this.runEventSequence = 0;
    this.runEventQueue = Promise.resolve();
    this.runIntegrityError = null;
    this.running = false;
    this.paused = false;
    this.ended = false;
    this.answerPending = false;
    this.startedAt = 0;
    this.distance = 0;
    this.score = 0;
    this.coins = 0;
    this.keys = 0;
    this.obstaclesDodged = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.correctAnswers = 0;
    this.answersAttempted = 0;
    this.bossHpRemaining = this.config.bossHp;
    this.bossLives = this.config.isBoss ? 4 : 1;
    this.questionIndex = 0;
    this.activeQuestion = null;
    this.questionGateResolved = false;
    this.nextObstacleAt = 24;
    this.nextCoinAt = 10;
    this.nextKeyAt = Math.max(60, this.config.length / (this.config.keyTarget + 1));
    this.keySpawnCount = 0;
    this.questionDistances = this.makeQuestionDistances();
    this.speed = this.config.baseSpeed;
    this.targetLane = 1;
    this.playerX = LANES[1];
    this.jumpY = 0;
    this.jumpVelocity = 0;
    this.sliding = false;
    this.slideTimer = 0;
    this.invulnerableTimer = 0;
    this.shieldCharges = 0;
    this.magnetTimer = 0;
    this.doubleScoreTimer = 0;
    this.boostTimer = 0;
    this.stepAccumulator = 0;
    this.lastTime = performance.now();
    this.resizeObserver = null;
    this.inputController = null;
    this.selectedAnswerLane = null;
    this.focusStartPromise = null;
    this.learningFocus = new LearningFocus({
      onChange: ({ active, freeRemaining, paid, balance, message }) => {
        if (message) ui.thinkTimeStatus.textContent = message;
        else if (active && !paid) ui.thinkTimeStatus.textContent = `🧠 Think Time — ${freeRemaining}s · Choose an answer lane`;
        else if (active) ui.thinkTimeStatus.textContent = `⏱ Extra Think Time · -10 coins/sec · 🪙 ${balance ?? "…"}`;
        ui.ready.disabled = !active || this.selectedAnswerLane === null;
        ui.ready.hidden = !active;
      },
      onCharge: async () => {
        await this.focusStartPromise;
        return api.runnerFocusCharge(this.focusPayload());
      },
      onReady: () => {
        if (this.activeQuestion) api.runnerFocusEnd(this.focusPayload()).catch(() => {});
      },
    });
    this.gameLoop = new GameLoop({
      clock: this.clock,
      update: (dt, rawDt) => { this.qualityManager?.recordFrame(rawDt * 1000);if(this.running&&!this.paused&&!this.ended&&!this.answerPending)this.update(dt); },
      render: (dt) => { this.animateVisuals(dt);this.renderer.render(this.scene,this.camera); },
    });
    this.equipped = equippedRewardsBySlot(state.equippedRewards);
    Object.assign(this, initialRewardState(this.equipped));
  }

  makeQuestionDistances() {
    const count = Math.max(1, this.questions.length);
    const start = this.config.length * .20;
    const end = this.config.length * .82;
    if (count === 1) return [this.config.length * .55];
    return Array.from({ length: count }, (_, i) => start + (end - start) * (i / (count - 1)));
  }

  initRenderer() {
    const T = this.T;
    const quality = runnerQualityProfile();
    this.qualityManager = new RuntimeQualityManager({ initialTier: hintedQualityTier(), cap: deviceCapTier(), onChange: (profile) => this.applyQualityProfile(profile) });
    this.renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(quality.pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    ui.host.innerHTML = "";
    ui.host.appendChild(this.renderer.domElement);

    this.camera = new T.PerspectiveCamera(62, window.innerWidth / window.innerHeight, .1, 240);
    this.camera.position.set(0, 4.35, 9.2);
    this.camera.lookAt(0, 1.1, -10);

    const hemi = new T.HemisphereLight(0xeaf7ef, 0x1d382c, 2.15);
    this.scene.add(hemi);
    const sun = new T.DirectionalLight(0xfff0c7, 3.0);
    sun.position.set(-12, 20, 8);
    sun.castShadow = true;
    this.sunLight = sun;
    sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -10;
    this.scene.add(sun);

    this.buildSkyDetails();
    this.buildLeafParticles();
    this.buildRoad();
    this.buildPlayer();
    if (this.config.isBoss) this.buildDragon();
    this.bindControls();
    this.onResize();
    window.addEventListener("resize", () => this.onResize(), { passive: true });
    window.addEventListener("pagehide", () => this.dispose(), { once: true });
    this.gameLoop.start();
  }

  applyQualityProfile(profile) {
    if (!this.renderer) return;
    this.renderer.setPixelRatio(profile.pixelRatio ?? Math.min(window.devicePixelRatio || 1, profile.pixelRatioCap));
    this.renderer.shadowMap.enabled = profile.shadows;
    if (this.sunLight) this.sunLight.castShadow = profile.shadows;
  }

  mat(color, roughness = .78, metalness = .03) {
    return new this.T.MeshStandardMaterial({ color, roughness, metalness });
  }

  buildSkyDetails() {
    const T = this.T;
    const glowColor = this.config.number >= 9 ? 0xffb15f : 0xffefb0;
    const sun = new T.Mesh(new T.SphereGeometry(4.8, 24, 16), new T.MeshBasicMaterial({ color: glowColor, transparent:true, opacity:.62 }));
    sun.position.set(-24, 21, -92);
    this.scene.add(sun);

    // Distant castle silhouette makes World 2 feel like a destination rather
    // than a recoloured jungle track.
    const castle = new T.Group();
    const stone = this.mat(this.config.number === 6 ? 0x353342 : 0x655b78,.96);
    const keep = new T.Mesh(new T.BoxGeometry(12,7,4),stone); keep.position.y=3.2; castle.add(keep);
    [-7.4,7.4].forEach(x=>{
      const tower=new T.Mesh(new T.CylinderGeometry(2.1,2.4,10,8),stone);tower.position.set(x,4.6,0);castle.add(tower);
      const roof=new T.Mesh(new T.ConeGeometry(2.8,3.7,8),this.mat(0x75445f,.82));roof.position.set(x,11.0,0);castle.add(roof);
    });
    const gate=new T.Mesh(new T.BoxGeometry(3.5,5,.8),this.mat(0x2e2834,.98));gate.position.set(0,1.8,2.05);castle.add(gate);
    castle.position.set(0,0,-105); castle.scale.setScalar(1.25); this.scene.add(castle);

    for (let i=0;i<11;i++) {
      const cloud = new T.Group();
      const mat = new T.MeshBasicMaterial({ color: 0xffffff, transparent:true, opacity:this.config.number===6 ? .08 : .24 });
      for (let j=0;j<3;j++) {
        const puff = new T.Mesh(new T.SphereGeometry(2 + Math.random()*1.25, 10, 8), mat);
        puff.position.set((j-1)*2.0, Math.random()*.55, Math.random()*.45); cloud.add(puff);
      }
      cloud.position.set((Math.random()-.5)*56, 14+Math.random()*9, -35-Math.random()*90); this.scene.add(cloud);
    }
  }

  buildLeafParticles() {
    const T=this.T;
    const colors=[0xffd56d,0xd7a8ff,0xffffff];
    for(let i=0;i<32;i++){
      const mat=new T.MeshBasicMaterial({color:colors[i%colors.length],transparent:true,opacity:.48});
      const sparkle=new T.Mesh(new T.OctahedronGeometry(.10+Math.random()*.08,0),mat);
      sparkle.position.set((Math.random()-.5)*25,1+Math.random()*10,-8-Math.random()*100);
      sparkle.userData={speed:.7+Math.random()*1.6,drift:(Math.random()-.5)*.45,phase:Math.random()*6};
      this.scene.add(sparkle);this.particles.push(sparkle);
    }
  }

  buildRoad() {
    const T = this.T;
    for (let i=0;i<TILE_COUNT;i++) {
      const tile = new T.Group();
      tile.position.z = 7 - i*TILE_LENGTH;
      const road = new T.Mesh(new T.BoxGeometry(ROAD_WIDTH, .35, TILE_LENGTH+.08), this.mat(this.config.theme.road, .96));
      road.position.y = -.28; road.receiveShadow = true; tile.add(road);

      const shoulderMat = this.mat(this.config.theme.grass, 1);
      const left = new T.Mesh(new T.BoxGeometry(16, .28, TILE_LENGTH), shoulderMat);
      const right = left.clone(); left.position.set(-13.3,-.34,0); right.position.set(13.3,-.34,0); tile.add(left,right);

      // Cut the royal road into visible stone blocks.
      const seamMat = this.mat(this.config.number===6?0x292735:0x67616d,.98);
      for(let z=-5.6;z<=5.6;z+=2.15){
        const seam=new T.Mesh(new T.BoxGeometry(ROAD_WIDTH-.18,.028,.075),seamMat);seam.position.set(0,-.07,z);tile.add(seam);
      }
      for (const x of [-1.77,1.77]) {
        const laneLine=new T.Mesh(new T.BoxGeometry(.065,.028,TILE_LENGTH),this.mat(0xd2b86b,.72));laneLine.position.set(x,-.065,0);tile.add(laneLine);
      }

      if (this.config.number === 3) {
        const plankMat=this.mat(0x7c5a3a,.94);
        for(let z=-6.1;z<6.2;z+=1.0){const plank=new T.Mesh(new T.BoxGeometry(ROAD_WIDTH-.18,.10,.78),plankMat);plank.position.set(0,-.05,z);tile.add(plank);}
        const railMat=this.mat(0x5a493f,.96);
        [-5.15,5.15].forEach(x=>{const rail=new T.Mesh(new T.CylinderGeometry(.055,.055,TILE_LENGTH,7),railMat);rail.rotation.x=Math.PI/2;rail.position.set(x,1.02,0);tile.add(rail);});
      }
      if (this.config.number >= 9) {
        const carpet=new T.Mesh(new T.BoxGeometry(2.75,.035,TILE_LENGTH-.1),this.mat(this.config.number===10?0x7d2537:0x6b2f78,.78));carpet.position.set(0,-.055,0);tile.add(carpet);
        const trim=this.mat(0xe2b54f,.55,.25);[-1.33,1.33].forEach(x=>{const strip=new T.Mesh(new T.BoxGeometry(.07,.04,TILE_LENGTH-.1),trim);strip.position.set(x,-.03,0);tile.add(strip);});
      }

      this.decorateTile(tile, i);
      this.scene.add(tile); this.roadTiles.push(tile);
    }
  }

  decorateTile(tile, seed) {
    const T = this.T;
    const variant = this.config.number;
    const rng = (n) => { const x = Math.sin((seed+1)*9283.17 + n*77.23)*43758.5453; return x-Math.floor(x); };
    const sideXs = [-8.4,-11.4,8.4,11.4];
    sideXs.forEach((x, idx) => {
      const z = -5 + rng(idx)*10;
      let prop;
      if (variant === 6) prop = this.makeCaveRock(1.15+rng(idx+10)*.45);
      else if ([1,5,7,9,10].includes(variant)) prop = this.makeRuinPillar(.72+rng(idx+8)*.38);
      else prop = this.makeTree(.82+rng(idx+5)*.42, false);
      prop.position.set(x,0,z); prop.rotation.y = rng(idx+12)*Math.PI*2; tile.add(prop);
    });

    // Moat / river under the Fraction Bridge.
    if (variant === 3) {
      const waterMat = new T.MeshStandardMaterial({ color:0x3f9fbf, roughness:.28, metalness:.05, transparent:true, opacity:.78 });
      [-10.6,10.6].forEach(x=>{const water=new T.Mesh(new T.PlaneGeometry(10,TILE_LENGTH),waterMat);water.rotation.x=-Math.PI/2;water.position.set(x,-.13,0);tile.add(water);});
    }

    // Geometry Garden adds bright mathematical sculptures beside the track.
    if (variant === 4 || variant === 8) {
      const shapes=[new T.BoxGeometry(.7,.7,.7),new T.SphereGeometry(.48,10,8),new T.ConeGeometry(.48,.9,6)];
      for(let i=0;i<3;i++){
        const shape=new T.Mesh(shapes[(seed+i)%shapes.length],this.mat([0xe2a7e8,0x72c99b,0xf0bd58][i],.7));
        shape.position.set(i%2?-6.8:6.8,.55,-4+i*3.5);shape.rotation.set(.2*i,.5*i,.1);tile.add(shape);
      }
    }

    // Clockwork Hall uses slow-looking gear decorations (visual only).
    if (variant === 7) {
      for(let i=0;i<2;i++){
        const gear=new T.Mesh(new T.TorusGeometry(.72,.16,8,14),this.mat(0xc59742,.45,.35));gear.position.set(i?-6.8:6.8,1.1,-2+i*4);gear.rotation.y=Math.PI/2;tile.add(gear);
      }
    }
  }

  makeTree(scale=1, coconut=false) {
    const T=this.T;const g=new T.Group();
    const trunk=new T.Mesh(new T.CylinderGeometry(.23,.32,2.8,8),this.mat(0x68503b,.95));trunk.position.y=1.3;g.add(trunk);
    const green=this.mat(this.config.number===8?0x3f8a58:0x4f8053,.9);
    const lower=new T.Mesh(new T.SphereGeometry(1.05,10,8),green);lower.scale.set(1.0,.72,1.0);lower.position.y=2.8;g.add(lower);
    const upper=new T.Mesh(new T.ConeGeometry(.72,1.6,8),green);upper.position.y=4.0;g.add(upper);
    const pot=new T.Mesh(new T.CylinderGeometry(.55,.42,.72,8),this.mat(0x9b6d4e,.9));pot.position.y=.34;g.add(pot);
    g.scale.setScalar(scale);return g;
  }

  makeRuinPillar(scale=1) {
    const T=this.T;const g=new T.Group();const stone=this.mat(this.config.number===10?0x4b424d:0x777083,.97);
    const tower=new T.Mesh(new T.CylinderGeometry(.72,.86,4.8,8),stone);tower.position.y=2.35;tower.castShadow=true;g.add(tower);
    const rim=new T.Mesh(new T.CylinderGeometry(.94,.94,.42,8),stone);rim.position.y=4.75;g.add(rim);
    for(let i=0;i<4;i++){
      const merlon=new T.Mesh(new T.BoxGeometry(.38,.48,.38),stone);const a=i*Math.PI/2;merlon.position.set(Math.cos(a)*.62,5.12,Math.sin(a)*.62);g.add(merlon);
    }
    const banner=new T.Mesh(new T.PlaneGeometry(.72,1.35),new T.MeshStandardMaterial({color:this.config.number===10?0xa5383b:0x6d3f91,side:T.DoubleSide,roughness:.8}));banner.position.set(0,3.1,.78);g.add(banner);
    g.scale.setScalar(scale);return g;
  }

  makeCaveRock(scale=1) {
    const T=this.T;const g=new T.Group();const dark=this.mat(0x3d3b49,.98);
    const wall=new T.Mesh(new T.BoxGeometry(2.2,4.4,1.5),dark);wall.position.y=2.0;wall.castShadow=true;g.add(wall);
    const cap=new T.Mesh(new T.BoxGeometry(2.55,.45,1.8),dark);cap.position.y=4.35;g.add(cap);
    const torch=new T.Mesh(new T.SphereGeometry(.18,8,6),new T.MeshStandardMaterial({color:0xffb24d,emissive:0xff7a22,emissiveIntensity:1.2}));torch.position.set(0,2.4,.86);g.add(torch);
    g.scale.setScalar(scale);return g;
  }

  buildPlayer() {
    const preset = window.LQCharacters?.get(this.child.avatar);
    if (preset) {
      this.characterController = new CharacterController({ scene: this.scene, preset });
      this.player = this.characterController.root;
      this.characterController.setRotationY(Math.PI);
      this.player.position.set(this.playerX, 0, PLAYER_Z);
      this.characterController.load().then(() => {
        this.characterController?.setState(this.running ? "run" : "idle", { immediate: true });
      });
      this.buildHumanRewardVisuals();
      if (["reward_pet_parrot","reward_baby_dragon"].includes(this.equipped.pet?.reward_id)) this.buildParrot();
      if (this.shieldCharges > 0) this.createShieldVisual();
      return;
    }
    const T = this.T;
    const root = new T.Group();
    root.position.set(this.playerX,0,PLAYER_Z);
    this.scene.add(root);
    this.player = root;

    const skin = this.mat(0xf1b58e,.72);
    const outfitId = this.equipped.outfit?.reward_id;
    const shirtColor = outfitId === "reward_royal_cape" ? 0x673b91 : outfitId === "reward_jungle_cape" ? 0x8b2f3c : 0xe5a93e;
    const shirt = this.mat(shirtColor,.75);
    const shorts = this.mat(0x2c4a43,.86);
    const dark = this.mat(0x2b332d,.9);

    const torso = new T.Mesh(new T.CapsuleGeometry(.48,.82,6,10), shirt); torso.position.y=1.65; torso.castShadow=true; root.add(torso);
    const head = new T.Mesh(new T.SphereGeometry(.48,16,12),skin); head.position.y=2.68; head.castShadow=true; root.add(head);
    const hair = new T.Mesh(new T.SphereGeometry(.50,12,8,0,Math.PI*2,0,Math.PI*.48),dark); hair.position.set(0,2.83,0); root.add(hair);
    const eyeMat = new T.MeshBasicMaterial({color:0x17231d});
    [-.16,.16].forEach(x=>{const eye=new T.Mesh(new T.SphereGeometry(.045,8,6),eyeMat);eye.position.set(x,2.72,.44);root.add(eye);});
    if (this.equipped.character?.reward_id === "reward_forest_fox") {
      const foxMat=this.mat(0xd87835,.8);
      [-.31,.31].forEach(x=>{const ear=new T.Mesh(new T.ConeGeometry(.18,.46,5),foxMat);ear.position.set(x,3.24,-.02);ear.rotation.z=x<0?.16:-.16;root.add(ear);});
      const tail=new T.Mesh(new T.ConeGeometry(.22,1.0,8),foxMat);tail.position.set(-.48,1.25,-.45);tail.rotation.z=1.05;tail.rotation.x=.25;root.add(tail);this.playerParts.tail=tail;
    }

    const limbGeo = new T.CapsuleGeometry(.13,.65,5,8);
    const legGeo = new T.CapsuleGeometry(.15,.78,5,8);
    const leftArm = new T.Mesh(limbGeo,skin), rightArm=leftArm.clone();
    leftArm.position.set(-.58,1.78,0); rightArm.position.set(.58,1.78,0); root.add(leftArm,rightArm);
    const leftLeg = new T.Mesh(legGeo,shorts), rightLeg=leftLeg.clone();
    leftLeg.position.set(-.25,.68,0); rightLeg.position.set(.25,.68,0); root.add(leftLeg,rightLeg);
    const shoeGeo = new T.BoxGeometry(.36,.22,.65);
    const leftShoe = new T.Mesh(shoeGeo,dark), rightShoe=leftShoe.clone();
    leftShoe.position.set(-.25,.16,.12); rightShoe.position.set(.25,.16,.12); root.add(leftShoe,rightShoe);
    this.playerParts={...this.playerParts,torso,head,leftArm,rightArm,leftLeg,rightLeg,leftShoe,rightShoe};

    if (["reward_jungle_cape","reward_royal_cape"].includes(this.equipped.outfit?.reward_id)) {
      const royal = this.equipped.outfit?.reward_id === "reward_royal_cape";
      const cape = new T.Mesh(new T.PlaneGeometry(1.0,1.28), new T.MeshStandardMaterial({color:royal?0x673b91:0x8b2f3c,side:T.DoubleSide,roughness:.8}));
      cape.position.set(0,1.7,-.5); cape.rotation.x=-.12; root.add(cape); this.playerParts.cape=cape;
      if (royal) {
        const clasp=new T.Mesh(new T.TorusGeometry(.14,.045,7,14),this.mat(0xf1c65b,.35,.45));clasp.position.set(0,2.08,.43);clasp.rotation.x=Math.PI/2;root.add(clasp);
      }
    }
    if (["reward_wooden_sword","reward_crystal_sword"].includes(this.equipped.weapon?.reward_id)) {
      const crystal=this.equipped.weapon?.reward_id === "reward_crystal_sword";
      const sword = new T.Group();
      const bladeMat=crystal?new T.MeshStandardMaterial({color:0x91dfff,emissive:0x3f9fc4,emissiveIntensity:.45,metalness:.55,roughness:.22}):this.mat(0x9b6b3f,.8);
      const blade = new T.Mesh(new T.BoxGeometry(.12,1.05,.12),bladeMat); blade.position.y=.52; sword.add(blade);
      const guard = new T.Mesh(new T.BoxGeometry(.5,.1,.12),this.mat(crystal?0xe4b84e:0x5d3b22,.55,.3)); sword.add(guard);
      sword.position.set(.72,1.25,-.12); sword.rotation.z=-.35; root.add(sword); this.playerParts.sword=sword;
    }
    if (["reward_pet_parrot","reward_baby_dragon"].includes(this.equipped.pet?.reward_id)) this.buildParrot();
    if (this.shieldCharges>0) this.createShieldVisual();
  }

  buildHumanRewardVisuals() {
    const T=this.T,root=this.player;
    if (["reward_jungle_cape","reward_royal_cape"].includes(this.equipped.outfit?.reward_id)) {
      const royal=this.equipped.outfit.reward_id==="reward_royal_cape";
      const cape=new T.Mesh(new T.PlaneGeometry(1,1.25),new T.MeshStandardMaterial({color:royal?0x673b91:0x8b2f3c,side:T.DoubleSide,roughness:.8}));
      cape.position.set(0,1.7,-.48);cape.rotation.x=-.12;root.add(cape);this.playerParts.cape=cape;
    }
    if (["reward_wooden_sword","reward_crystal_sword"].includes(this.equipped.weapon?.reward_id)) {
      const crystal=this.equipped.weapon.reward_id==="reward_crystal_sword",sword=new T.Group();
      const blade=new T.Mesh(new T.BoxGeometry(.12,1,.12),crystal?new T.MeshStandardMaterial({color:0x91dfff,emissive:0x3f9fc4,emissiveIntensity:.45,metalness:.55,roughness:.22}):this.mat(0x9b6b3f,.8));blade.position.y=.5;sword.add(blade);
      sword.add(new T.Mesh(new T.BoxGeometry(.48,.1,.12),this.mat(crystal?0xe4b84e:0x5d3b22,.85)));
      sword.position.set(.72,1.25,-.12);sword.rotation.z=-.35;root.add(sword);this.playerParts.sword=sword;
    }
    if (this.equipped.character?.reward_id==="reward_forest_fox") {
      const foxMat=this.mat(0xd87835,.8);
      [-.31,.31].forEach(x=>{const ear=new T.Mesh(new T.ConeGeometry(.18,.46,5),foxMat);ear.position.set(x,3.05,-.02);ear.rotation.z=x<0?.16:-.16;root.add(ear);});
      const tail=new T.Mesh(new T.ConeGeometry(.22,1,8),foxMat);tail.position.set(-.48,1.25,-.45);tail.rotation.set(.25,0,1.05);root.add(tail);this.playerParts.tail=tail;
    }
  }

  buildParrot() {
    const T=this.T; const g=new T.Group();
    if (this.equipped.pet?.reward_id === "reward_baby_dragon") {
      const bodyMat=this.mat(0x6f59a8,.72),wingMat=this.mat(0xb482d9,.7),hornMat=this.mat(0xf0d8a1,.65);
      const body=new T.Mesh(new T.SphereGeometry(.30,12,8),bodyMat);body.scale.set(.9,1.25,.9);g.add(body);
      const head=new T.Mesh(new T.SphereGeometry(.24,12,8),bodyMat);head.position.set(0,.42,.08);g.add(head);
      [-.22,.22].forEach(x=>{const horn=new T.Mesh(new T.ConeGeometry(.06,.24,6),hornMat);horn.position.set(x,.65,0);g.add(horn);});
      [-1,1].forEach(sign=>{const wing=new T.Mesh(new T.ConeGeometry(.18,.62,5),wingMat);wing.rotation.z=sign*1.15;wing.position.set(sign*.31,.15,-.04);g.add(wing);});
      const tail=new T.Mesh(new T.ConeGeometry(.08,.6,7),bodyMat);tail.rotation.x=-1.05;tail.position.set(0,-.28,-.3);g.add(tail);
    } else {
      const body=new T.Mesh(new T.SphereGeometry(.27,12,8),this.mat(0xd83b48,.78)); body.scale.set(.8,1.2,.8); g.add(body);
      const wing=new T.Mesh(new T.ConeGeometry(.18,.55,7),this.mat(0x2f8f62,.75)); wing.rotation.z=-1.2; wing.position.set(.24,0,0); g.add(wing);
      const beak=new T.Mesh(new T.ConeGeometry(.10,.28,8),this.mat(0xf3b33d,.72)); beak.rotation.x=Math.PI/2; beak.position.set(0,.06,.27); g.add(beak);
    }
    g.position.set(-1.15,2.45,2.25); this.scene.add(g); this.pet=g;
  }

  createShieldVisual() {
    const T=this.T;
    if (this.shieldMesh) this.scene.remove(this.shieldMesh);
    this.shieldMesh=new T.Mesh(new T.SphereGeometry(1.25,18,12),new T.MeshBasicMaterial({color:0x70d6ff,transparent:true,opacity:.17,wireframe:true}));
    this.shieldMesh.position.copy(this.player.position); this.shieldMesh.position.y=1.45; this.scene.add(this.shieldMesh);
  }

  buildDragon() {
    const T=this.T; const g=new T.Group();
    const scales=this.mat(0x7b3552,.76), belly=this.mat(0xe2a45d,.72), dark=this.mat(0x3a2030,.88), wingMat=this.mat(0x9a526e,.74), horn=this.mat(0xf1d3a0,.68);
    const body=new T.Mesh(new T.SphereGeometry(1.0,16,12),scales);body.scale.set(1.0,1.35,.9);body.position.y=2.0;g.add(body);
    const chest=new T.Mesh(new T.SphereGeometry(.68,14,10),belly);chest.scale.set(.75,1.2,.35);chest.position.set(0,1.85,.72);g.add(chest);
    const head=new T.Mesh(new T.SphereGeometry(.72,16,11),scales);head.scale.set(1.05,.8,1.15);head.position.set(0,3.55,.25);g.add(head);
    const snout=new T.Mesh(new T.BoxGeometry(.72,.38,.85),belly);snout.position.set(0,3.38,.92);g.add(snout);
    [-.26,.26].forEach(x=>{const eye=new T.Mesh(new T.SphereGeometry(.075,8,6),new T.MeshBasicMaterial({color:0xffd36a}));eye.position.set(x,3.68,.92);g.add(eye);});
    [-.42,.42].forEach(x=>{const h=new T.Mesh(new T.ConeGeometry(.12,.6,7),horn);h.position.set(x,4.18,.02);h.rotation.z=x<0?.18:-.18;g.add(h);});
    [-1,1].forEach(sign=>{
      const wing=new T.Mesh(new T.ConeGeometry(.8,2.7,5),wingMat);wing.scale.set(1.45,.8,.28);wing.position.set(sign*1.25,2.45,-.18);wing.rotation.z=sign*1.15;wing.rotation.y=sign*.25;g.add(wing);
      const leg=new T.Mesh(new T.CapsuleGeometry(.22,.75,5,8),scales);leg.position.set(sign*.58,.8,.08);g.add(leg);
    });
    const tail=new T.Mesh(new T.ConeGeometry(.32,2.6,9),scales);tail.rotation.x=-1.15;tail.position.set(0,1.5,-1.45);g.add(tail);
    for(let i=0;i<4;i++){const spike=new T.Mesh(new T.ConeGeometry(.11,.42,6),horn);spike.rotation.x=-.9;spike.position.set(0,2.3+i*.42,-.78+i*.08);g.add(spike);}
    g.position.set(0,0,-27); g.scale.setScalar(1.35); this.scene.add(g); this.dragon=g;
  }

  bindControls() {
    this.inputController = new InputController({
      canvas: this.renderer.domElement,
      buttons: { left: ui.left, right: ui.right, jump: ui.jump, slide: ui.slide },
      actions: {
        moveLane: (direction) => this.moveLane(direction),
        jump: () => this.jump(),
        slide: () => this.slide(),
        ready: () => this.lockAnswerAndContinue(),
        togglePause: () => { if (this.running && !this.ended) this.togglePause(); },
        pauseWhenHidden: () => {
          if(this.running&&!this.ended&&!this.paused){
            this.paused=true;ui.pauseOverlay.classList.remove("hidden");ui.pause.textContent="▶";this.clock.getDelta();
          }
        },
      },
    });
    this.inputController.bind();
    ui.pause.onclick=()=>this.togglePause(); ui.resumeBtn.onclick=()=>this.togglePause(false);
    ui.ready.onclick=()=>this.lockAnswerAndContinue();
    ui.sound.onclick=()=>{this.audio.muted=!this.audio.muted;ui.sound.textContent=this.audio.muted?"🔇":"🔊";};
  }

  async startRun() {
    if (this.running || this.ended) return;
    await this.audio.unlock();
    ui.startBtn.disabled=true; ui.startBtn.textContent="Starting…";
    try {
      const start=await api.runnerStart({levelId:this.level.id});
      this.runId=start.runId; this.runToken=start.runToken; this.startedAt=Date.now(); this.running=true; this.paused=false;
      ui.startOverlay.classList.add("hidden"); ui.pause.disabled=false;
      this.audio.tone(430,.15,"triangle",.04,120);
    } catch(e) {
      ui.startBtn.disabled=false; ui.startBtn.textContent="Start Run"; showToast(e.message);
    }
  }

  togglePause(forcePause) {
    if (!this.running || this.ended || this.answerPending) return;
    this.paused = typeof forcePause === "boolean" ? forcePause : !this.paused;
    ui.pauseOverlay.classList.toggle("hidden", !this.paused);
    ui.pause.textContent = this.paused ? "▶" : "⏸";
    this.clock.getDelta();
  }

  moveLane(dir) {
    if(!this.running||this.paused||this.ended||this.answerPending)return;
    this.targetLane=Math.max(0,Math.min(2,this.targetLane+dir));
    if(this.learningFocus.active)this.selectedAnswerLane=this.targetLane;
    if (this.characterController) {
      this.characterController.setState(dir < 0 ? "dodgeLeft" : "dodgeRight");
      this.characterStateTimer=.24;
    }
    this.highlightQuestionLane();
  }
  focusPayload() {
    return { runId:this.runId, runToken:this.runToken, questionId:this.activeQuestion?.id };
  }
  lockAnswerAndContinue() {
    if (!this.learningFocus.active || this.selectedAnswerLane === null) return false;
    return this.learningFocus.ready();
  }
  jump() {
    if(!this.running||this.paused||this.ended||this.answerPending||this.learningFocus.active)return;
    if(this.jumpY<=.03&&!this.sliding){this.jumpVelocity=8.6;this.audio.jump();this.characterController?.setState("jump");}
  }
  slide() {
    if(!this.running||this.paused||this.ended||this.answerPending||this.learningFocus.active)return;
    if(this.jumpY<.2){this.sliding=true;this.slideTimer=.72;this.audio.slide();this.characterController?.setState("slide");}
  }

  update(dt) {
    if (this.learningFocus.active) {
      this.learningFocus.tick(dt);
      this.playerX += (LANES[this.targetLane]-this.playerX)*Math.min(1,dt*13);
      this.player.position.x=this.playerX;
      this.highlightQuestionLane();
      return;
    }
    const progress=Math.min(1,this.distance/this.config.length);
    const boostMul=this.boostTimer>0?1.22:1;
    this.speed=Math.min(this.config.maxSpeed*boostMul,(this.config.baseSpeed*(1+progress*.42)+this.combo*.025)*boostMul);
    this.distance+=this.speed*dt;
    this.score+=Math.round(this.speed*dt*(9+(this.doubleScoreTimer>0?8:0))*(1+Math.min(2,this.combo*.035)));
    if(this.magnetTimer>0)this.magnetTimer-=dt;if(this.doubleScoreTimer>0)this.doubleScoreTimer-=dt;if(this.boostTimer>0)this.boostTimer-=dt;if(this.invulnerableTimer>0)this.invulnerableTimer-=dt;
    this.stepAccumulator+=dt;if(this.stepAccumulator>.34&&this.jumpY<.05&&!this.sliding){this.stepAccumulator=0;this.audio.tone(78,.035,"sine",.008,-8);}

    this.playerX += (LANES[this.targetLane]-this.playerX)*Math.min(1,dt*13);
    this.player.position.x=this.playerX;
    if(this.jumpY>0||this.jumpVelocity>0){this.jumpVelocity-=24*dt;this.jumpY+=this.jumpVelocity*dt;if(this.jumpY<=0){this.jumpY=0;this.jumpVelocity=0;}}
    this.player.position.y=this.jumpY;
    if(this.sliding){this.slideTimer-=dt;if(this.slideTimer<=0){this.sliding=false;if(!this.characterController)this.player.scale.y=1;}else if(!this.characterController)this.player.scale.y=.58;}

    this.moveRoad(dt);
    this.spawnGameplay();
    this.moveEntities(dt);
    this.updateHud();
    this.maybeQuestionGate();

    if(this.distance>=this.config.length&&!this.activeQuestion&&this.questionIndex>=this.questions.length){this.finishRun();}
  }

  animateVisuals(dt) {
    const t=performance.now()*.001;
    if(this.player){
      const runAmp=this.running&&!this.paused&&!this.ended?Math.min(1,this.speed/14):.15;
      const phase=t*(8+this.speed*.22);
      if(!this.sliding&&!this.characterController){
        this.playerParts.leftArm.rotation.x=Math.sin(phase)*.7*runAmp; this.playerParts.rightArm.rotation.x=-Math.sin(phase)*.7*runAmp;
        this.playerParts.leftLeg.rotation.x=-Math.sin(phase)*.72*runAmp; this.playerParts.rightLeg.rotation.x=Math.sin(phase)*.72*runAmp;
      }
      if(this.characterController){
        const airborne=this.jumpY>.03||this.jumpVelocity>0;
        if(this.wasAirborne&&!airborne){this.characterController.setState("land");this.characterStateTimer=.18;}
        this.wasAirborne=airborne;
        this.characterStateTimer=Math.max(0,this.characterStateTimer-dt);
        if(this.characterStateTimer===0){
          const state=this.ended?this.characterController.state:this.sliding?"slide":airborne?"jump":this.running&&!this.paused?(this.speed>this.config.baseSpeed*1.3?"sprint":"run"):"idle";
          this.characterController.setState(state);
        }
        this.characterController.update(dt,{speed:this.speed/this.config.baseSpeed,lateral:LANES[this.targetLane]-this.playerX,airborne,sliding:this.sliding});
      }
      this.player.rotation.z=(LANES[this.targetLane]-this.playerX)*-.055;
      this.camera.position.x += (this.playerX*.12-this.camera.position.x)*Math.min(1,dt*4);
      this.camera.position.y = 4.35 + Math.sin(t*8)*.025*(this.running?1:0);
      this.camera.lookAt(this.playerX*.06,1.2,-10);
      if(this.playerParts.cape)this.playerParts.cape.rotation.x=-.12+Math.sin(t*6)*.08;
      if(this.playerParts.tail)this.playerParts.tail.rotation.y=Math.sin(t*7)*.18;
    }
    if(this.pet){this.pet.position.x=this.playerX-1.15;this.pet.position.y=2.4+this.jumpY+Math.sin(t*5)*.15;this.pet.rotation.z=Math.sin(t*7)*.1;}
    if(this.shieldMesh){this.shieldMesh.position.set(this.playerX,1.45+this.jumpY,PLAYER_Z);this.shieldMesh.rotation.y+=dt*1.5;}
    for(const leaf of this.particles){
      leaf.position.z += (this.running&&!this.paused&&!this.ended?this.speed*.18:0)*dt;
      leaf.position.x += leaf.userData.drift*dt; leaf.rotation.x+=dt*leaf.userData.speed; leaf.rotation.z+=dt*.7;
      if(leaf.position.z>12){leaf.position.z=-95-Math.random()*20;leaf.position.x=(Math.random()-.5)*26;leaf.position.y=1+Math.random()*10;}
    }
    if(this.dragon){this.dragon.position.x=Math.sin(t*.9)*1.2;this.dragon.rotation.y=Math.sin(t*.7)*.12;}
  }

  moveRoad(dt) {
    let farthest=Math.min(...this.roadTiles.map(t=>t.position.z));
    for(const tile of this.roadTiles){
      tile.position.z+=this.speed*dt;
      if(tile.position.z>14){tile.position.z=farthest-TILE_LENGTH;farthest=tile.position.z;}
    }
  }

  spawnGameplay() {
    if(!this.activeQuestion&&this.distance>=this.nextObstacleAt&&this.distance<this.config.length-34){
      this.spawnObstaclePattern(); this.nextObstacleAt=this.distance+this.config.obstacleSpacing*(.8+Math.random()*.42);
    }
    if(!this.activeQuestion&&this.distance>=this.nextCoinAt&&this.distance<this.config.length-18){
      this.spawnCoinLine(); this.nextCoinAt=this.distance+this.config.coinSpacing*(.8+Math.random()*.5);
    }
    const keyGap=this.config.length/(this.config.keyTarget+1);
    if(this.keySpawnCount<this.config.keyTarget+2&&this.distance>=this.nextKeyAt&&this.distance<this.config.length-25){
      this.spawnKey(); this.keySpawnCount++; this.nextKeyAt+=keyGap*.72;
    }
    if(Math.random()<.0013&&this.distance>80&&this.distance<this.config.length-70)this.spawnPowerup();
  }

  moveEntities(dt) {
    for(let i=this.entities.length-1;i>=0;i--){
      const e=this.entities[i]; e.group.position.z+=this.speed*dt;
      if(e.spin)e.group.rotation.y+=dt*e.spin;
      if(e.float)e.group.position.y=e.baseY+Math.sin(performance.now()*.004+e.phase)*e.float;
      if(e.kind==="swing")e.group.position.x=LANES[e.lane]+Math.sin(performance.now()*.003+e.phase)*1.1;
      this.checkEntity(e);
      if(e.group.position.z>12){
        if(e.category==="obstacle"&&!e.hit&&!e.counted){this.obstaclesDodged++;this.recordRunEvent("obstacle");this.combo++;this.maxCombo=Math.max(this.maxCombo,this.combo);this.score+=45+this.combo*3;e.counted=true;this.showCombo();}
        this.scene.remove(e.group);this.disposeGroup(e.group);this.entities.splice(i,1);
      }
    }
  }

  checkEntity(e) {
    const collision=classifyRunnerCollision(e,{
      playerX:this.playerX,jumpY:this.jumpY,sliding:this.sliding,
      magnetActive:this.magnetTimer>0,invulnerable:this.invulnerableTimer>0,
    },{zMin:COLLISION_Z_MIN,zMax:COLLISION_Z_MAX,playerZ:PLAYER_Z,laneRadius:1.25,magnetRadius:4.2,gateRadius:.9,jumpHeight:1.05});
    if(collision.type==="collect"){e.done=true;this.collect(e);}
    else if(collision.type==="gate")this.resolveQuestionGate();
    else if(collision.type==="crash"){e.hit=true;this.crash(collision.kind);}
  }

  collect(e) {
    if(e.type==="coin"){this.coins++;this.recordRunEvent("coin");this.score+=25*(this.doubleScoreTimer>0?2:1);this.combo++;this.maxCombo=Math.max(this.maxCombo,this.combo);this.audio.coin();}
    else if(e.type==="key"){this.keys++;this.recordRunEvent("key");this.score+=180;this.combo+=2;this.maxCombo=Math.max(this.maxCombo,this.combo);this.audio.key();this.showFeedback("🔶","Royal Seal!",`${this.keys}/${this.config.keyTarget} royal seals collected.`,true,650);}
    else if(e.type==="shield"){this.shieldCharges++;this.createShieldVisual();this.audio.shield();this.showFeedback("🛡️","Shield Ready","One crash can be blocked.",true,850);}
    else if(e.type==="magnet"){this.magnetTimer=9;this.showFeedback("🧲","Coin Magnet","Nearby coins fly to you for 9 seconds.",true,850);}
    else if(e.type==="double"){this.doubleScoreTimer=9;this.showFeedback("⚡","Focus Boost","Double score for 9 seconds.",true,850);}
    else if(e.type==="boost"){this.boostTimer=6;this.showFeedback("💨","Speed Rush","Run 22% faster for 6 seconds. Stay sharp!",true,850);}
    e.group.position.z=999;e.done=true;this.showCombo();
  }

  spawnObstaclePattern() {
    const r=Math.random(); const level=this.config.number;
    if(r<.22){this.spawnObstacle("lane",Math.floor(Math.random()*3));}
    else if(r<.42){this.spawnObstacle("jump",Math.floor(Math.random()*3));}
    else if(r<.61&&level>=2){this.spawnObstacle("slide",Math.floor(Math.random()*3));}
    else if(r<.80&&level>=3){const safe=Math.floor(Math.random()*3);for(let lane=0;lane<3;lane++)if(lane!==safe)this.spawnObstacle("lane",lane,SPAWN_Z-(Math.random()*.5));}
    else if(level>=4){this.spawnObstacle(level>=6&&Math.random()>.55?"swing":"pit",Math.floor(Math.random()*3));}
    else this.spawnObstacle("jump",Math.floor(Math.random()*3));
  }

  spawnObstacle(kind,lane,z=SPAWN_Z) {
    const T=this.T; const g=new T.Group(); g.position.set(LANES[lane],0,z);
    if(kind==="jump"){
      // Rolling royal barrel — jump over it.
      const wood=this.mat(0x7a5135,.94),band=this.mat(0x4d4850,.46,.45);
      const barrel=new T.Mesh(new T.CylinderGeometry(.62,.62,1.45,12),wood);barrel.rotation.z=Math.PI/2;barrel.position.y=.56;barrel.castShadow=true;g.add(barrel);
      [-.48,.48].forEach(x=>{const ring=new T.Mesh(new T.TorusGeometry(.62,.065,8,16),band);ring.rotation.y=Math.PI/2;ring.position.x=x;g.add(ring);});
    } else if(kind==="slide"){
      // Low portcullis beam — slide under it.
      const stone=this.mat(0x666071,.96),iron=this.mat(0x423d48,.42,.42);
      [-1.12,1.12].forEach(x=>{const p=new T.Mesh(new T.BoxGeometry(.28,3.5,.42),stone);p.position.set(x,1.55,0);g.add(p);});
      const bar=new T.Mesh(new T.BoxGeometry(2.55,.26,.38),iron);bar.position.y=1.78;g.add(bar);
      for(let x=-.9;x<=.9;x+=.45){const spike=new T.Mesh(new T.ConeGeometry(.09,.48,6),iron);spike.position.set(x,1.47,0);spike.rotation.z=Math.PI;g.add(spike);}
    } else if(kind==="pit"){
      // Broken drawbridge / moat gap — jump.
      const water=new T.Mesh(new T.BoxGeometry(2.55,.08,4.3),new T.MeshStandardMaterial({color:0x256c91,roughness:.25,metalness:.05,emissive:0x12364b,emissiveIntensity:.12}));water.position.y=-.10;g.add(water);
      const edge=this.mat(0x4e3c32,.98);[-2.0,2.0].forEach(zz=>{const e=new T.Mesh(new T.BoxGeometry(2.6,.18,.24),edge);e.position.set(0,.02,zz);g.add(e);});
      for(let x=-.9;x<=.9;x+=.6){const plank=new T.Mesh(new T.BoxGeometry(.38,.08,1.0),this.mat(0x7b5638,.96));plank.position.set(x,.02,-1.6);plank.rotation.y=(x+.9)*.25;g.add(plank);}
    } else if(kind==="swing"){
      // Hanging mace moves left/right on harder levels.
      const metal=this.mat(0x4b4753,.38,.5);
      const ball=new T.Mesh(new T.IcosahedronGeometry(.68,1),metal);ball.position.y=1.05;ball.castShadow=true;g.add(ball);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;const spike=new T.Mesh(new T.ConeGeometry(.11,.42,6),metal);spike.position.set(Math.cos(a)*.72,1.05+Math.sin(a)*.72,0);spike.rotation.z=a-Math.PI/2;g.add(spike);}
      const chain=new T.Mesh(new T.CylinderGeometry(.035,.035,5.0,6),metal);chain.position.y=3.5;g.add(chain);
    } else {
      // Knight shield barricade — change lane.
      const stand=this.mat(0x5d4a3b,.9),metal=this.mat(0x6d6480,.38,.4),gold=this.mat(0xe2b54f,.42,.35);
      const post=new T.Mesh(new T.BoxGeometry(.25,1.45,.28),stand);post.position.y=.72;g.add(post);
      const shield=new T.Mesh(new T.CylinderGeometry(1.05,.82,.24,6),metal);shield.rotation.x=Math.PI/2;shield.position.y=1.35;shield.scale.set(.92,1.0,1.2);shield.castShadow=true;g.add(shield);
      const crestV=new T.Mesh(new T.BoxGeometry(.12,1.2,.12),gold);crestV.position.set(0,1.35,.22);g.add(crestV);
      const crestH=new T.Mesh(new T.BoxGeometry(.9,.12,.12),gold);crestH.position.set(0,1.35,.22);g.add(crestH);
    }
    this.scene.add(g);this.entities.push({group:g,category:"obstacle",kind,lane,phase:Math.random()*6});
  }

  spawnCoinLine() {
    const lane=Math.floor(Math.random()*3); const count=3+Math.floor(Math.random()*4);
    for(let i=0;i<count;i++)this.spawnCollectible("coin",lane,SPAWN_Z-i*3.1, i%3===1?.75:.38);
  }

  spawnKey() {
    const lane=Math.floor(Math.random()*3); this.spawnCollectible("key",lane,SPAWN_Z,1.0);
    const other=(lane+1+(Math.random()>.5?0:1))%3; this.spawnCoinArc(other,SPAWN_Z-5);
  }

  spawnPowerup() {
    const types=["shield","magnet","double","boost"];this.spawnCollectible(types[Math.floor(Math.random()*types.length)],Math.floor(Math.random()*3),SPAWN_Z,1.05);
  }

  spawnCoinArc(lane,z) { for(let i=0;i<5;i++)this.spawnCollectible("coin",lane,z-i*2.4,.45+Math.sin(i/4*Math.PI)*1.1); }

  spawnCollectible(type,lane,z,y=.5) {
    const T=this.T;const g=new T.Group();g.position.set(LANES[lane],y,z);
    if(type==="coin"){
      const coin=new T.Mesh(new T.CylinderGeometry(.36,.36,.10,18),new T.MeshStandardMaterial({color:0xffc23c,metalness:.58,roughness:.26,emissive:0x5a3900,emissiveIntensity:.14}));coin.rotation.x=Math.PI/2;g.add(coin);
      const crown=new T.Mesh(new T.TorusGeometry(.20,.035,7,15),this.mat(0xffe6a3,.32,.35));crown.rotation.x=Math.PI/2;g.add(crown);
    } else if(type==="key"){
      // World 2 uses royal number seals while retaining the backend `keys`
      // counter for compatibility with saved missions/statistics.
      const gold=new T.MeshStandardMaterial({color:0xffd465,metalness:.55,roughness:.26,emissive:0x6a4300,emissiveIntensity:.12});
      const seal=new T.Mesh(new T.OctahedronGeometry(.48,0),gold);seal.scale.set(1,.82,.35);g.add(seal);
      const ring=new T.Mesh(new T.TorusGeometry(.55,.055,8,20),this.mat(0xffefae,.32,.4));ring.rotation.x=Math.PI/2;g.add(ring);
      const dot=new T.Mesh(new T.SphereGeometry(.10,8,6),this.mat(0x71449a,.55));dot.position.z=.25;g.add(dot);
    } else {
      const colors={shield:0x65c7ff,magnet:0xef5f73,double:0xffd166,boost:0xa879ff};const orb=new T.Mesh(new T.IcosahedronGeometry(.48,1),new T.MeshStandardMaterial({color:colors[type],emissive:colors[type],emissiveIntensity:.35,roughness:.35}));g.add(orb);
      const halo=new T.Mesh(new T.TorusGeometry(.66,.05,8,24),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.65}));halo.rotation.x=Math.PI/2;g.add(halo);
    }
    this.scene.add(g);this.entities.push({group:g,category:"collectible",type,lane,spin:2.6,float:.12,baseY:y,phase:Math.random()*6});
  }

  maybeQuestionGate() {
    if(this.activeQuestion||this.answerPending||this.questionIndex>=this.questions.length)return;
    if(this.distance>=this.questionDistances[this.questionIndex])this.spawnQuestionGate(this.questions[this.questionIndex]);
  }

  spawnQuestionGate(question) {
    this.activeQuestion=question;this.questionGateResolved=false;this.combo=0;
    // Give every lane a fair, hazard-free approach into the learning checkpoint.
    for (let i=this.entities.length-1;i>=0;i--) {
      const e=this.entities[i];
      if(e.category!=="obstacle")continue;
      this.scene.remove(e.group);this.disposeGroup(e.group);this.entities.splice(i,1);
    }
    ui.questionTopic.textContent=`🧠 ${question.topic || "Knowledge Gate"}`;
    ui.questionText.textContent=question.question;
    ui.questionOptions.innerHTML="";
    const labels=["LEFT","CENTER","RIGHT"];
    question.options.slice(0,3).forEach((opt,i)=>{
      const div=document.createElement("button");div.type="button";div.className="question-option";div.dataset.lane=String(i);div.setAttribute("aria-label",`${labels[i]}: ${opt.text}`);div.innerHTML=`<b>${labels[i]}</b><span>${this.escapeHtml(opt.text)}</span>`;div.onclick=()=>this.selectLane(i);ui.questionOptions.appendChild(div);
      this.spawnAnswerGate(i,opt.text,opt.originalIndex);
    });
    ui.questionPanel.classList.add("show");
    this.selectedAnswerLane=null;
    this.jumpVelocity=0;this.jumpY=0;this.sliding=false;this.slideTimer=0;this.player.position.y=0;
    if(!this.characterController)this.player.scale.y=1;
    ui.ready.disabled=true;
    this.learningFocus.start();
    this.focusStartPromise=api.runnerFocusStart(this.focusPayload()).then(({balance})=>{
      if(this.learningFocus.active){this.learningFocus.balance=balance;this.learningFocus.notify();}
    }).catch(()=>{if(this.learningFocus.active)this.learningFocus.finish("Time to choose!");});
    this.highlightQuestionLane();
    this.nextObstacleAt=Math.max(this.nextObstacleAt,this.distance+38);
  }

  spawnAnswerGate(lane,text,originalIndex) {
    const T=this.T;const g=new T.Group();g.position.set(LANES[lane],0,SPAWN_Z+18);
    const archMat=this.mat(lane===0?0x5a478e:lane===1?0x8c6131:0x74476f,.72);
    [-1.05,1.05].forEach(x=>{const p=new T.Mesh(new T.BoxGeometry(.22,3.7,.28),archMat);p.position.set(x,1.75,0);p.castShadow=true;g.add(p);});
    const top=new T.Mesh(new T.BoxGeometry(2.35,.28,.28),archMat);top.position.y=3.5;g.add(top);
    const panel=new T.Mesh(new T.PlaneGeometry(2.0,1.05),new T.MeshBasicMaterial({map:this.makeTextTexture(text,lane),transparent:true}));panel.position.set(0,2.45,.17);g.add(panel);
    this.scene.add(g);this.entities.push({group:g,category:"gate",lane,originalIndex,gateSetResolved:false});
  }

  makeTextTexture(text,lane) {
    const canvas=document.createElement("canvas");canvas.width=512;canvas.height=260;const c=canvas.getContext("2d");
    const fills=["#493472","#805522","#67355f"];c.fillStyle=fills[lane];c.fillRect(0,0,512,260);c.strokeStyle="#ffe4a3";c.lineWidth=8;c.strokeRect(5,5,502,250);
    c.fillStyle="#fff";c.textAlign="center";c.textBaseline="middle";c.font="bold 54px Arial";
    const words=String(text).split(/\s+/);const lines=[];let line="";for(const word of words){const test=(line+" "+word).trim();if(c.measureText(test).width>440&&line){lines.push(line);line=word;}else line=test;}if(line)lines.push(line);
    const shown=lines.slice(0,3);shown.forEach((ln,i)=>c.fillText(ln,256,130+(i-(shown.length-1)/2)*62));
    const tex=new this.T.CanvasTexture(canvas);tex.colorSpace=this.T.SRGBColorSpace;return tex;
  }

  async resolveQuestionGate() {
    if(this.questionGateResolved||!this.activeQuestion||this.answerPending)return;
    this.learningFocus.finish();
    this.questionGateResolved=true;this.answerPending=true;
    const chosenLane=this.closestLane();const gate=this.entities.find(e=>e.category==="gate"&&e.lane===chosenLane&&!e.done);
    if(!gate){this.answerPending=false;return;}
    try {
      const result=await api.runnerAnswer({runId:this.runId,runToken:this.runToken,questionId:this.activeQuestion.id,selectedIndex:gate.originalIndex});
      this.answersAttempted++;
      if(result.correct){
        this.correctAnswers++;this.combo+=3;this.maxCombo=Math.max(this.maxCombo,this.combo);this.score+=250+this.combo*12;this.audio.correct();
        if(this.dragon){ this.bossHpRemaining=Math.max(0,this.bossHpRemaining-1); this.flashDragonHit(); }
        this.showFeedback("✅",`Checkpoint ${this.questionIndex+1} cleared!`,result.explanation||"Great focus!",true,1050);
        this.clearGates();this.questionIndex++;this.activeQuestion=null;ui.questionPanel.classList.remove("show");
        setTimeout(()=>{if(!this.ended)this.answerPending=false;},850);
      } else {
        this.audio.wrong();
        this.showFeedback("❌","Wrong lane",`Correct answer: ${result.correctAnswer}. ${result.explanation||""}`,false,1500);
        this.clearGates();ui.questionPanel.classList.remove("show");
        if(this.shieldCharges>0){
          this.consumeShield("Knowledge shield saved your run!");this.questionIndex++;this.activeQuestion=null;
          setTimeout(()=>{if(!this.ended)this.answerPending=false;},1250);
        } else if(this.config.isBoss && this.bossLives > 1){
          this.bossLives--; this.questionIndex++; this.activeQuestion=null; this.combo=0;
          this.showFeedback("❤️",`Dragon strike! ${this.bossLives} lives left`,result.explanation||"Focus on the next answer lane.",false,1250);
          setTimeout(()=>{if(!this.ended)this.answerPending=false;},1150);
        } else {
          if(this.config.isBoss) this.bossLives=0;
          setTimeout(()=>this.crash("wrong-answer"),1050);
        }
      }
    } catch(e){
      this.showFeedback("⚠️","Connection problem",e.message,false,1200);this.questionGateResolved=false;this.answerPending=false;
    }
  }

  clearGates() {
    for(const e of this.entities.filter(x=>x.category==="gate")){e.done=true;e.group.position.z=999;}
  }

  selectLane(lane) {
    if(!this.running||this.paused||this.ended||this.answerPending)return;
    this.targetLane=Math.max(0,Math.min(2,lane));
    if(this.learningFocus.active)this.selectedAnswerLane=this.targetLane;
    this.highlightQuestionLane();
  }

  highlightQuestionLane() {
    if(!ui.questionPanel.classList.contains("show"))return;
    ui.ready.disabled=!this.learningFocus.active||this.selectedAnswerLane===null;
    for(const option of ui.questionOptions.querySelectorAll(".question-option")){
      option.classList.toggle("active",Number(option.dataset.lane)===(this.learningFocus.active?this.selectedAnswerLane:this.targetLane));
    }
  }

  closestLane() {
    return closestLaneIndex(this.playerX,LANES);
  }

  consumeShield(message) {
    if(this.shieldCharges<=0)return false;this.shieldCharges--;this.invulnerableTimer=1.8;this.audio.shield();
    if(this.shieldCharges<=0&&this.shieldMesh){this.scene.remove(this.shieldMesh);this.disposeGroup(this.shieldMesh);this.shieldMesh=null;}
    this.showFeedback("🛡️","Shield Saved You",message,true,900);return true;
  }

  crash(kind) {
    if(this.ended||this.invulnerableTimer>0)return;
    if(this.shieldCharges>0){this.consumeShield("You hit an obstacle, but the shield broke instead.");return;}
    this.ended=true;this.running=false;this.audio.hit();
    if(this.characterController)this.characterController.setState("hit");else this.player.rotation.z=.65;
    const names={jump:"You needed to JUMP over the royal barrel.",slide:"You needed to SLIDE under the portcullis.",lane:"You needed to change lane around the knight shield.",pit:"You needed to JUMP over the broken drawbridge.",swing:"You needed to dodge the swinging mace.","wrong-answer":"The maths answer lane was incorrect."};
    setTimeout(()=>this.showCrashResult(names[kind]||"The kingdom challenge caught you. Keep your focus and try again!"),450);
    if(this.runId)api.runnerCrash({ runId: this.runId, runToken: this.runToken, ...this.statsPayload() }).catch(()=>{});
  }

  async finishRun() {
    if(this.ended||this.answerPending)return;this.answerPending=true;
    if(this.keys<this.config.keyTarget){
      this.ended=true;this.running=false;this.answerPending=false;
      await api.runnerCrash({ runId: this.runId, runToken: this.runToken, ...this.statsPayload() }).catch(()=>{});
      this.showMissionFail();return;
    }
    try {
      const result=await this.flushRunEvents().then(()=>api.runnerComplete({runId:this.runId,runToken:this.runToken,...this.statsPayload()}));
      this.ended=true;this.running=false;this.answerPending=false;
      if(result.passed){this.audio.win();this.characterController?.setState("victory");this.showWinResult(result);}else this.showServerFail(result);
    } catch(e){this.answerPending=false;this.showFeedback("⚠️","Could not save run",e.message,false,1500);}
  }

  recordRunEvent(type) {
    if (!this.runId || this.runIntegrityError) return;
    const sequence = ++this.runEventSequence;
    this.runEventQueue = this.runEventQueue
      .then(() => api.runnerEvent({ runId: this.runId, runToken: this.runToken, sequence, type, amount: 1 }))
      .catch((error) => { this.runIntegrityError = error; });
  }

  async flushRunEvents() {
    await this.runEventQueue;
    if (this.runIntegrityError) throw new Error("Run verification was interrupted. Please retry this level.");
  }

  statsPayload() {
    return {distance:Math.round(this.distance),score:Math.round(this.score),coins:this.coins,keys:this.keys,obstaclesDodged:this.obstaclesDodged,maxCombo:this.maxCombo,durationSeconds:Math.max(1,Math.round((Date.now()-this.startedAt)/1000))};
  }

  showCrashResult(reason) {
    ui.resultModal.innerHTML=`
      <div style="font-size:48px;">💥🏰</div><h2>Run Over — Focus Again!</h2><p class="sub">${this.escapeHtml(reason)}</p>
      <div class="result-grid"><div class="result-stat"><b>${Math.round(this.distance)}m</b><span>Distance</span></div><div class="result-stat"><b>${this.score}</b><span>Score</span></div><div class="result-stat"><b>${this.coins}</b><span>Coins found</span></div><div class="result-stat"><b>${this.maxCombo}</b><span>Best combo</span></div></div>
      <div class="runner-action-row"><button class="runner-big-btn" id="retryBtn">Run Again</button><a class="runner-big-btn secondary" href="world-maths_kingdom.html" style="display:inline-flex;align-items:center;text-decoration:none;">Back to Map</a></div>`;
    ui.resultOverlay.classList.remove("hidden");$("retryBtn").onclick=()=>location.reload();
  }

  showMissionFail() {
    ui.resultModal.innerHTML=`
      <div style="font-size:48px;">🔶🏰</div><h2>Mission Incomplete</h2><p class="sub">You reached the finish, but collected ${this.keys}/${this.config.keyTarget} royal seals. Explore every lane and keep your focus.</p>
      <div class="result-grid"><div class="result-stat"><b>${this.keys}/${this.config.keyTarget}</b><span>Royal seals</span></div><div class="result-stat"><b>${this.coins}</b><span>Coins</span></div><div class="result-stat"><b>${this.correctAnswers}/${this.answersAttempted}</b><span>Learning</span></div><div class="result-stat"><b>${this.score}</b><span>Score</span></div></div>
      <div class="runner-action-row"><button class="runner-big-btn" id="retryBtn">Retry Mission</button><a class="runner-big-btn secondary" href="world-maths_kingdom.html" style="display:inline-flex;align-items:center;text-decoration:none;">Back to Map</a></div>`;
    ui.resultOverlay.classList.remove("hidden");$("retryBtn").onclick=()=>location.reload();
  }

  showWinResult(result) {
    const stars="⭐".repeat(result.stars)+"☆".repeat(Math.max(0,3-result.stars));
    const nextId=result.newlyUnlockedLevelId;
    const nextHref=nextId?.startsWith("maths_kingdom_")?`maths-kingdom-game.html?level=${encodeURIComponent(nextId)}`:"dashboard.html";
    const nextButton=nextId?`<a class="runner-big-btn" href="${nextHref}" style="display:inline-flex;align-items:center;text-decoration:none;">Play Next Level →</a>`:"";
    ui.resultModal.innerHTML=`
      <div style="font-size:48px;">🏆👑</div><h2>${this.config.isBoss?"Number Dragon Defeated!":"Mission Complete!"}</h2><div class="result-stars">${stars}</div>
      <p class="sub">Great run! You conquered the Maths Kingdom and passed the learning gates.</p>
      <div class="result-grid"><div class="result-stat"><b>+${result.xpEarned}</b><span>XP</span></div><div class="result-stat"><b>+${result.coinsEarned}</b><span>Coins</span></div><div class="result-stat"><b>${result.accuracy}%</b><span>Accuracy</span></div><div class="result-stat"><b>${this.maxCombo}</b><span>Best combo</span></div></div>
      <p style="margin:14px 0 0;opacity:.82;">⭐ Complete · ⭐ 80%+ accuracy · ⭐ key mission + coin target</p>
      <div class="runner-action-row">${nextButton}<button class="runner-big-btn secondary" id="replayBtn">Replay</button><a class="runner-big-btn secondary" href="world-maths_kingdom.html" style="display:inline-flex;align-items:center;text-decoration:none;">Kingdom Map</a></div>`;
    ui.resultOverlay.classList.remove("hidden");$("replayBtn").onclick=()=>location.reload();
  }

  showServerFail(result) {
    const learning=result.learningPassed?"Learning gate passed":"Need more correct learning answers";
    const mission=result.missionPassed?"Royal seal mission passed":`Need ${result.keyTarget} royal seals`;
    ui.resultModal.innerHTML=`<div style="font-size:48px;">🧠🔶</div><h2>Almost There!</h2><p class="sub">${learning}. ${mission}.</p><div class="runner-action-row"><button class="runner-big-btn" id="retryBtn">Try Again</button><a class="runner-big-btn secondary" href="world-maths_kingdom.html" style="display:inline-flex;align-items:center;text-decoration:none;">Back to Map</a></div>`;
    ui.resultOverlay.classList.remove("hidden");$("retryBtn").onclick=()=>location.reload();
  }

  showFeedback(icon,title,text,good=true,duration=900) {
    ui.feedbackIcon.textContent=icon;ui.feedbackTitle.textContent=title;ui.feedbackText.textContent=text||"";ui.feedback.className=`${good?"good":"bad"} show`;
    clearTimeout(this.feedbackTimer);this.feedbackTimer=setTimeout(()=>{ui.feedback.className="";},duration);
  }

  showCombo() {
    if(this.combo<2)return;ui.combo.textContent=`🔥 Focus Combo x${this.combo}`;ui.combo.classList.add("show");clearTimeout(this.comboTimer);this.comboTimer=setTimeout(()=>ui.combo.classList.remove("show"),700);
  }

  flashDragonHit() {
    if(!this.dragon)return;const original=this.dragon.scale.x;this.dragon.scale.setScalar(original*1.12);setTimeout(()=>this.dragon&&this.dragon.scale.setScalar(original),120);
  }

  updateHud() {
    ui.score.textContent=String(Math.round(this.score));ui.coins.textContent=String(this.coins);ui.keys.textContent=String(this.keys);
    ui.speed.textContent=`${(this.speed/this.config.baseSpeed).toFixed(1)}x`;ui.progress.style.width=`${Math.min(100,(this.distance/this.config.length)*100).toFixed(1)}%`;
    ui.missionStats.textContent=this.config.isBoss
      ? `🐉 HP ${this.bossHpRemaining}/${this.config.bossHp} · ❤️ ${this.bossLives} · 🔶 ${this.keys}/${this.config.keyTarget} · 🪙 ${this.coins}/${this.config.coinTarget}${this.shieldCharges?` · 🛡️ ${this.shieldCharges}`:""}`
      : `🔶 ${this.keys}/${this.config.keyTarget} · 🪙 ${this.coins}/${this.config.coinTarget}${this.shieldCharges?` · 🛡️ ${this.shieldCharges}`:""}`;
  }

  onResize() {
    resizeRunnerView(this.renderer,this.camera,window.innerWidth,window.innerHeight);
  }

  disposeGroup(group) {
    disposeObject3D(group);
  }

  dispose() {
    this.gameLoop.stop();
    this.inputController?.dispose();
    this.inputController=null;
    this.characterController?.dispose();
    this.characterController=null;
    this.renderer?.dispose?.();
    this.resizeObserver?.disconnect?.();
  }

  escapeHtml(value) { return String(value??"").replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch])); }
}

async function boot() {
  try {
    const state=await api.childMe();
    const level=state.mathsKingdomLevels.find((l)=>l.id===levelId);
    if(!level||level.status==="locked"){location.href="world-maths_kingdom.html";return;}
    const count=Math.max(3,Number(level.questions_required||3));
    const q=await api.runnerQuestions(level.gate_subject_id,count);
    const game=new KingdomRunner({THREE,state,level,questions:q.questions});
    game.initRenderer();
    ui.levelBadge.textContent=`👑 Level ${level.level_number} · ${level[`name_${state.child.language}`]||level.name_en}`;
    ui.introTitle.textContent=Number(level.is_boss||0)===1?"Dragon Tower — Boss Run":`Level ${level.level_number}: ${level[`name_${state.child.language}`]||level.name_en}`;
    ui.introMission.textContent=`Mission: collect ${game.config.keyTarget} royal seal${game.config.keyTarget===1?"":"s"}, ${game.config.coinTarget}+ coins, survive every obstacle, and pass ${game.config.isBoss?game.config.bossHp:Math.ceil(game.config.questionCount*2/3)} learning challenges.`;
    ui.missionText.textContent=game.config.isBoss?"Defeat the Number Dragon":"Reach the royal tower without crashing";
    game.updateHud();
    ui.loading.classList.add("hidden");ui.startBtn.disabled=false;ui.startBtn.textContent="Start Royal Quest";ui.startBtn.onclick=()=>game.startRun();
    window.__learnQuestRunner=game;
  } catch(error) {
    console.error(error);ui.loading.textContent=`Game could not start: ${error.message}`;ui.startBtn.textContent="Game unavailable";
  }
}

boot();
