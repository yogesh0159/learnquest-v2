/** Persistent player profile (localStorage). Pure logic + injectable storage so it is unit-testable. */
import { LANGS } from "./i18n.js";

const KEY = "learnquest.jungle.profile.v1";

export const SUBJECTS = Object.freeze({
  math: "Math", patterns: "Patterns", spelling: "Spelling", science: "Science", shapes: "Shapes",
});

// Cosmetic running trails, unlocked by lifetime coins (no purchases, nothing is "spent").
export const TRAILS = Object.freeze([
  { id: "none", label: "No trail", cost: 0, color: null },
  { id: "gold", label: "Gold dust", cost: 100, color: 0xffd23f },
  { id: "leaf", label: "Leaf sparkle", cost: 300, color: 0x6dff9a },
  { id: "rainbow", label: "Rainbow", cost: 800, color: "rainbow" },
]);

const DEFAULTS = () => ({
  totalCoins: 0, best: 0, bestDistance: 0, games: 0, bestStreak: 0, correctTotal: 0, wrongTotal: 0, achievements: {}, tutorialDone: false, subjectStats: {},
  settings: { character: "boy", grade: 1, subjects: ["math"], tts: false, reducedMotion: null, bigText: false, trail: "none", language: "", graphics: "auto", nativeCore: true, teacherChase: true },
});

export class Profile {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage; this.data = DEFAULTS();
    try {
      const saved = JSON.parse(storage?.getItem(KEY) || "null");
      if (saved && typeof saved === "object") {
        this.data = { ...this.data, ...saved, settings: { ...this.data.settings, ...(saved.settings || {}) }, achievements: { ...(saved.achievements || {}) } };
      }
    } catch { /* corrupt storage: start fresh */ }
    this._sanitize();
  }
  _sanitize() {
    const s = this.data.settings; this.data.tutorialDone = !!this.data.tutorialDone;
    if (!this.data.subjectStats || typeof this.data.subjectStats !== "object") this.data.subjectStats = {};
    for (const k of Object.keys(this.data.subjectStats)) { const v = this.data.subjectStats[k]; if (!(k in SUBJECTS) || !v) delete this.data.subjectStats[k]; else { v.right = Math.max(0, +v.right || 0); v.wrong = Math.max(0, +v.wrong || 0); } }
    s.grade = [1, 2, 3].includes(Number(s.grade)) ? Number(s.grade) : 1;
    s.subjects = (Array.isArray(s.subjects) ? s.subjects : []).filter((x) => x in SUBJECTS);
    if (!s.subjects.length) s.subjects = ["math"];
    if (!TRAILS.some((t) => t.id === s.trail) || !this.trailUnlocked(s.trail)) s.trail = "none";
    if (!["boy", "girl"].includes(s.character)) s.character = "boy";
    s.nativeCore = s.nativeCore !== false; s.teacherChase = s.teacherChase !== false;
    if (!["auto", "ultra", "high", "balanced", "low", "minimal"].includes(s.graphics)) s.graphics = "auto";
    if (!(s.language in LANGS)) s.language = "";            // "" = decide from the URL / browser language
  }
  save() { try { this.storage?.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage full / blocked */ } }
  get settings() { return this.data.settings; }
  set(key, value) { this.data.settings[key] = value; this._sanitize(); this.save(); }
  toggleSubject(id) {
    const s = this.data.settings.subjects; const i = s.indexOf(id);
    if (i >= 0) { if (s.length > 1) s.splice(i, 1); } else s.push(id);      // always keep at least one subject
    this.save(); return [...s];
  }
  trailUnlocked(id) { const t = TRAILS.find((x) => x.id === id); return !!t && this.data.totalCoins >= t.cost; }

  /** Merge the stats of a finished run. Returns what changed so the UI can celebrate it. */
  recordRun(run) {
    const d = this.data; const prevBest = d.best;
    d.games++; d.totalCoins += run.coins || 0; d.correctTotal += run.correct || 0; d.wrongTotal += run.wrong || 0;
    d.best = Math.max(d.best, Math.floor(run.score || 0)); d.bestDistance = Math.max(d.bestDistance, Math.floor(run.distance || 0));
    d.bestStreak = Math.max(d.bestStreak, run.bestStreak || 0);
    for (const [id, t] of Object.entries(run.tally || {})) {            // per-subject right/wrong for the progress report
      if (!(id in SUBJECTS)) continue; const s = (d.subjectStats[id] ||= { right: 0, wrong: 0 }); s.right += t.right || 0; s.wrong += t.wrong || 0;
    }
    this.save();
    return { newBest: Math.floor(run.score || 0) > prevBest && prevBest >= 0, best: d.best };
  }
  markTutorialDone() { this.data.tutorialDone = true; this.save(); }
  resetTutorial() { this.data.tutorialDone = false; this.save(); }
  /** Wipe everything (parent button). Returns a fresh default profile in place. */
  resetAll() { this.data = DEFAULTS(); this._sanitize(); this.save(); }
  unlockAchievement(id) { if (this.data.achievements[id]) return false; this.data.achievements[id] = Date.now(); this.save(); return true; }
}
