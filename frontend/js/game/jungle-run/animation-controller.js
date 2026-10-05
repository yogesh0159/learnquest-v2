import * as THREE from "three";
import { resolveAliases } from "./animation-aliases.js";
import { neutralizeRootMotion, isRootPositionTrack } from "./root-motion.js";

const TAG = "[LearnQuest]";
const LOOPING = new Set(["RUN", "SPRINT", "WALK", "IDLE", "TALK", "VICTORY"]);
// Aliases whose airborne rise is supplied by the controller, not the clip.
const CLAMP_RISE = new Set(["JUMP"]);

/** Find the take-off / peak / landing times of a jump clip from its (original) root-bone height curve. */
export function analyzeJumpPhases(times, ys) {
  const n = ys.length; if (n < 5) return null;
  const y0 = ys[0];
  let peak = 0; for (let i = 0; i < n; i++) if (ys[i] > ys[peak]) peak = i;
  if (ys[peak] - y0 < 0.02) return null;           // no clear airborne rise
  let crouch = 0; for (let i = 0; i <= peak; i++) if (ys[i] < ys[crouch]) crouch = i;
  let takeoff = crouch; while (takeoff < peak && ys[takeoff] < y0) takeoff++;
  let landing = peak; while (landing < n - 1 && ys[landing] > y0) landing++;
  const t = (i) => times[Math.min(n - 1, Math.max(0, i))];
  return { takeoff: t(takeoff), peak: t(peak), landing: t(landing), airborne: Math.max(0.1, t(landing) - t(takeoff)) };
}

export class AnimationController {
  /**
   * @param {THREE.Object3D} model  instantiated character (skinned)
   * @param {THREE.AnimationClip[]} clips  *cloned* clips (they are modified here)
   */
  constructor(model, clips, { logger = console, name = "character" } = {}) {
    this.model = model;
    this.logger = logger;
    this.name = name;
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = new Map();
    this.aliasMap = {};
    this.current = null;
    this.currentAlias = null;
    this.finishedHandlers = new Set();
    this.rootBone = null;
    this.jumpPhases = null;
    this.rootMotionReport = [];
    this.clipsByName = new Map(clips.map((c) => [c.name, c]));
    this.originals = new Map(clips.map((c) => [c.name, c.clone()]));   // untouched copies (Lab: compare with/without root-motion removal)
    this.rawActions = new Map();

    let bones = [];
    model.traverse((o) => { if (o.isSkinnedMesh && o.skeleton) bones = bones.concat(o.skeleton.bones); });
    this.rootBone = bones.find((b) => !(b.parent && b.parent.isBone)) || bones[0] || null;
    this.rootBoneName = this.rootBone?.name || null;

    this.aliasMap = resolveAliases(clips.map((c) => ({ name: c.name, duration: c.duration })));
    const byName = new Map(clips.map((c) => [c.name, c]));
    this.clipDurations = {};

    for (const [alias, hit] of Object.entries(this.aliasMap)) {
      if (!hit) { this.logger.warn?.(`${TAG} Animation ${alias} has no matching clip in ${name} (safe fallback will be used)`); continue; }
      const clip = byName.get(hit.name);
      if (CLAMP_RISE.has(alias) && this.rootBoneName) {
        const tr = clip.tracks.find((t) => isRootPositionTrack(t.name, this.rootBoneName));
        if (tr) {
          const ys = []; for (let i = 0; i < tr.values.length; i += 3) ys.push(tr.values[i + 1]);
          this.jumpPhases = analyzeJumpPhases(Array.from(tr.times), ys);
        }
      }
      if (this.rootBoneName) {
        const r = neutralizeRootMotion(clip, this.rootBoneName, { clampRise: CLAMP_RISE.has(alias) });
        if (r.changed) this.rootMotionReport.push({ alias, clip: hit.name, netBefore: r.before.net.map((v) => +v.toFixed(3)), netAfter: r.after.net.map((v) => +v.toFixed(3)) });
      }
      const action = this.mixer.clipAction(clip);
      action.setLoop(LOOPING.has(alias) ? THREE.LoopRepeat : THREE.LoopOnce, LOOPING.has(alias) ? Infinity : 1);
      action.clampWhenFinished = !LOOPING.has(alias);
      this.actions.set(alias, action);
      this.clipDurations[alias] = clip.duration;
      this.logger.info?.(`${TAG} Animation ${alias} mapped to ${hit.name}`);
    }
    // Clips without a logical alias (turns, talk...) get the same X/Z pinning so they are safe to preview in the Lab.
    const aliased = new Set(Object.values(this.aliasMap).filter(Boolean).map((h) => h.name));
    for (const clip of clips) if (!aliased.has(clip.name) && this.rootBoneName) neutralizeRootMotion(clip, this.rootBoneName);
    // Safe fallbacks so every logical action can always play something sensible.
    this.fallbackOrder = {
      SPRINT: ["RUN"], WALK: ["RUN"], HIT: ["FALL", "IDLE"], FALL: ["HIT", "IDLE"], VICTORY: ["IDLE"],
      SLIDE: ["RUN"], JUMP: ["RUN"], TALK: ["IDLE"], IDLE: ["RUN"], RUN: ["WALK", "IDLE"],
    };
    this.mixer.addEventListener("finished", (e) => {
      const alias = [...this.actions].find(([, a]) => a === e.action)?.[0];
      if (alias) this.finishedHandlers.forEach((fn) => fn(alias));
    });
  }

  onFinished(fn) { this.finishedHandlers.add(fn); return () => this.finishedHandlers.delete(fn); }
  has(alias) { return this.actions.has(alias); }
  resolve(alias) {
    if (this.actions.has(alias)) return alias;
    for (const alt of this.fallbackOrder[alias] || []) if (this.actions.has(alt)) return alt;
    return null;
  }
  duration(alias) { return this.clipDurations[this.resolve(alias)] || 1; }

  /** Crossfade to an alias. Returns the alias actually played (or null). */
  play(alias, { fade = 0.16, timeScale = 1, startTime = 0 } = {}) {
    const real = this.resolve(alias);
    if (!real) return null;
    const next = this.actions.get(real);
    if (next === this.current && LOOPING.has(real)) { next.setEffectiveTimeScale(timeScale); return real; }
    next.reset();
    next.enabled = true;
    next.time = startTime;
    next.setEffectiveTimeScale(timeScale);
    next.setEffectiveWeight(1);
    if (this.current && this.current !== next) next.crossFadeFrom(this.current, fade, false);
    else next.fadeIn(fade);
    next.play();
    this.current = next; this.currentAlias = real;
    return real;
  }

  setTimeScale(ts) { if (this.current) this.current.setEffectiveTimeScale(ts); }
  update(dt) { this.mixer.update(dt); }
  dispose() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model); }
  /** Every clip in the file with the logical actions that map to it (used by the Lab viewer). */
  listClips() {
    const aliasesFor = (name) => Object.entries(this.aliasMap).filter(([, v]) => v && v.name === name).map(([k]) => k);
    return [...this.clipsByName.values()].map((c) => ({ name: c.name, duration: +c.duration.toFixed(3), tracks: c.tracks.length, aliases: aliasesFor(c.name) }));
  }

  /** Play any clip by its raw name. `original: true` plays the untouched clip (root motion included). */
  playRaw(name, { fade = 0.2, timeScale = 1, loop = true, original = false } = {}) {
    const clip = original ? this.originals.get(name) : this.clipsByName.get(name);
    if (!clip) return null;
    const key = `${original ? "o:" : "n:"}${name}`;
    let a = this.rawActions.get(key);
    if (!a) { a = this.mixer.clipAction(clip, original ? this.model : undefined); this.rawActions.set(key, a); }
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1); a.clampWhenFinished = !loop;
    a.reset(); a.enabled = true; a.setEffectiveTimeScale(timeScale); a.setEffectiveWeight(1);
    if (this.current && this.current !== a) a.crossFadeFrom(this.current, fade, false); else a.fadeIn(fade);
    a.play(); this.current = a; this.currentAlias = `RAW:${name}`;
    return a;
  }

  describe() { return { rootBone: this.rootBoneName, aliases: this.aliasMap, jumpPhases: this.jumpPhases, rootMotion: this.rootMotionReport }; }
}
