import * as THREE from "three";
import { buildReferenceExplorer, poseReferenceExplorer } from "./reference-explorer.mjs";
import { GLTFLoader } from "/vendor/three-addons/loaders/GLTFLoader.js";

const DEFAULT_CLIP_ALIASES = Object.freeze({
  idle: ["idle", "breathing", "stand"],
  run: ["run", "running", "jog"],
  sprint: ["sprint", "fast_run", "run_fast"],
  jump: ["jump", "jump_start", "takeoff"],
  land: ["land", "landing"],
  slide: ["slide", "sliding", "duck"],
  dodgeLeft: ["dodge_left", "strafe_left", "left"],
  dodgeRight: ["dodge_right", "strafe_right", "right"],
  hit: ["hit", "impact", "hurt"],
  fall: ["fall", "death", "knockdown"],
  victory: ["victory", "celebrate", "celebration", "win"],
  turnLeft: ["turn_left"],
  turnRight: ["turn_right"],
  gesture: ["gesture", "wave"],
});

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pickClip(clips, aliases) {
  const normalized = clips.map((clip) => ({ clip, name: normalizeName(clip.name) }));
  for (const alias of aliases) {
    const exact = normalized.find((item) => item.name === alias);
    if (exact) return exact.clip;
  }
  for (const alias of aliases) {
    const fuzzy = normalized.find((item) => item.name.includes(alias));
    if (fuzzy) return fuzzy.clip;
  }
  return null;
}

function setShadows(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    if (obj.material?.map) obj.material.map.colorSpace = THREE.SRGBColorSpace;
  });
}

function fitCharacter(root, targetHeight = 2.85) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  if (size.y > 0.001) {
    const scale = targetHeight / size.y;
    root.scale.multiplyScalar(scale);
  }
  root.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(root);
  const center = fitted.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= fitted.min.y;
}

export class CharacterController {
  constructor({ scene, preset, targetHeight = 2.85, logger = console } = {}) {
    if (!scene) throw new Error("CharacterController requires a Three.js scene");
    this.scene = scene;
    this.preset = preset || { id: "human_boy_v1", gender: "boy", model: null };
    this.targetHeight = targetHeight;
    this.logger = logger;
    this.root = new THREE.Group();
    this.root.name = `character_${this.preset.id || "explorer"}`;
    this.visual = null;
    this.collider = null;
    this.mixer = null;
    this.actions = new Map();
    this.activeAction = null;
    this.state = "idle";
    this.stateTime = 0;
    this.runPhase = 0;
    this.assetMode = "loading";
    this.lastAssetError = null;
    this.disposed = false;
    this.scene.add(this.root);
    this._buildCollider();
  }

  _buildCollider() {
    const geometry = new THREE.CapsuleGeometry(0.4, 1.25, 5, 10);
    const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    this.collider = new THREE.Mesh(geometry, material);
    this.collider.position.y = 1.25;
    this.collider.visible = false;
    this.collider.name = "player_gameplay_collider";
    this.root.add(this.collider);
  }

  async load() {
    if (this.preset.model) {
      try {
        await this._loadGltf(this.preset.model);
        if (this.disposed) return { mode: "disposed", clips: [] };
        this.assetMode = "gltf";
        this.setState("idle", { immediate: true });
        return { mode: this.assetMode, model: this.preset.model, clips: [...this.actions.keys()] };
      } catch (error) {
        this.lastAssetError = error;
        this.logger.warn?.("Explorer GLB unavailable; using procedural fallback", error);
      }
    }
    if (this.disposed) return { mode: "disposed", clips: [] };
    this._loadFallback();
    this.assetMode = "procedural";
    this.setState("idle", { immediate: true });
    return { mode: this.assetMode, model: null, clips: [] };
  }

  async _loadGltf(url) {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene || gltf.scenes?.[0];
    if (!model) throw new Error(`GLB has no scene: ${url}`);
    if (this.disposed) {
      this._disposeVisual(model);
      return;
    }
    setShadows(model);
    fitCharacter(model, this.targetHeight);
    this.visual = model;
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);

    for (const [state, aliases] of Object.entries(DEFAULT_CLIP_ALIASES)) {
      const clip = pickClip(gltf.animations || [], aliases);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      if (["jump", "land", "hit", "fall", "victory", "dodgeLeft", "dodgeRight", "turnLeft", "turnRight", "gesture"].includes(state)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions.set(state, action);
    }

    if (!this.actions.has("run") && gltf.animations?.length) {
      this.actions.set("run", this.mixer.clipAction(gltf.animations[0]));
    }
  }

  _loadFallback() {
    const model = buildReferenceExplorer(this.preset);
    fitCharacter(model, this.targetHeight);
    this.visual = model;
    this.root.add(model);
  }

  setPosition(x, y, z) {
    this.root.position.set(x, y, z);
  }

  setRotationY(radians) {
    this.root.rotation.y = radians;
  }

  setState(nextState, { immediate = false } = {}) {
    if (!nextState || (this.state === nextState && !immediate)) return;
    this.state = nextState;
    this.stateTime = 0;

    if (!this.mixer) return;
    const next = this.actions.get(nextState) || this.actions.get(nextState === "sprint" ? "run" : "idle") || this.actions.get("run");
    if (!next || (next === this.activeAction && !immediate)) return;
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(1);
    if (this.activeAction && !immediate) next.crossFadeFrom(this.activeAction, 0.14, true);
    else next.play();
    if (!next.isRunning()) next.play();
    this.activeAction = next;
  }

  update(dt, { speed = 1, lateral = 0, airborne = false, sliding = false } = {}) {
    const safeDt = Math.min(0.05, Math.max(0, Number(dt) || 0));
    this.stateTime += safeDt;
    if (this.mixer) {
      const runAction = this.actions.get(this.state === "sprint" ? "sprint" : "run");
      if (runAction && ["run", "sprint"].includes(this.state)) runAction.timeScale = Math.min(1.65, Math.max(0.75, speed));
      this.mixer.update(safeDt);
    } else {
      this._updateProcedural(safeDt, { speed, lateral, airborne, sliding });
    }
  }

  _updateProcedural(dt, { speed, lateral, airborne, sliding }) {
    this.runPhase += dt * Math.min(1.65, Math.max(.75, speed));
    const state = sliding ? "slide" : airborne ? "jump" : this.state;
    const time = ["run", "sprint"].includes(state) ? this.runPhase : this.stateTime;
    poseReferenceExplorer(this.visual, state, time, { lateral });
  }

  _disposeVisual(root) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    root.traverse((obj) => {
      if (!obj.isMesh) return;
      if (obj.geometry) geometries.add(obj.geometry);
      (Array.isArray(obj.material) ? obj.material : [obj.material]).filter(Boolean).forEach(mat => materials.add(mat));
    });
    materials.forEach(mat => Object.values(mat).forEach(value => { if (value?.isTexture) textures.add(value); }));
    textures.forEach(t => t.dispose());
    materials.forEach(m => m.dispose());
    geometries.forEach(g => g.dispose());
  }

  dispose() {
    if (this.mixer && this.visual) this.mixer.uncacheRoot(this.visual);
    this.disposed = true;
    this._disposeVisual(this.root);
    this.scene.remove(this.root);
  }
}

export { THREE };
