// Node-only unit tests for the pure-logic Jungle Run modules (no browser needed). Run: npm run jungle:test
import assert from "node:assert/strict";
import { resolveAliases } from "../frontend/js/game/jungle-run/animation-aliases.js";
import { generateQuestion, levelForProgress, listQuestionSubjects, registerQuestionGenerator } from "../frontend/js/game/jungle-run/question-generator.js";
import { neutralizeRootMotion, measureRootMotion } from "../frontend/js/game/jungle-run/root-motion.js";
import { mulberry32, seededFor as sf } from "../frontend/js/game/jungle-run/rng.js";
import { pickSubject } from "../frontend/js/game/jungle-run/question-generator.js";
import { Profile, TRAILS, SUBJECTS } from "../frontend/js/game/jungle-run/profile.js";
import { ACHIEVEMENTS, evaluateAchievements } from "../frontend/js/game/jungle-run/achievements.js";

let passed = 0;
const pending = [];
const test = (name, fn) => { const r = fn(); if (r && typeof r.then === "function") { pending.push(r.then(() => { passed++; console.log("  ok -", name); })); } else { passed++; console.log("  ok -", name); } };
const clips = (list) => list.map(([name, duration]) => ({ name, duration }));
const BOY = clips([["Running", .667], ["Walking", 1.04], ["Hit_Reaction", 1.67], ["Idle_15", 7], ["Idle_9", 2], ["Lean_Forward_Sprint_inplace", .58], ["Regular_Jump", 1.88], ["Run_Sharp_Turn_Right", 1.2], ["Run_Turn_Left", 1.6], ["Talk_with_Hands_Open", 4], ["Victory_Cheer", 9.3], ["falling_down", 2.3], ["slide_light", 1.5]]);

console.log("animation aliases");
test("RUN resolves to plain Running, not turn/hit/sprint clips", () => assert.equal(resolveAliases(BOY).RUN.name, "Running"));
test("every logical action resolves for the Boy rig", () => { for (const [k, v] of Object.entries(resolveAliases(BOY))) assert.ok(v, k); });
test("case/space/underscore tolerant", () => {
  const r = resolveAliases(clips([["my RUN cycle", 1], ["JUMP up", 1], ["Slide-Under", 1], ["hit reaction", 1], ["FALL_DOWN", 1]]));
  assert.equal(r.RUN.name, "my RUN cycle"); assert.equal(r.JUMP.name, "JUMP up"); assert.equal(r.SLIDE.name, "Slide-Under"); assert.equal(r.HIT.name, "hit reaction"); assert.equal(r.FALL.name, "FALL_DOWN");
});
test("Girl HIT clip found even though named differently", () => assert.equal(resolveAliases(clips([["Running", 1], ["Hit_in_Back_While_Running", 2.5]])).HIT.name, "Hit_in_Back_While_Running"));
test("missing clips give null (fallback-safe), never throw", () => assert.equal(resolveAliases(clips([["Running", 1]])).JUMP, null));
test("IDLE prefers the longer, richer loop", () => assert.equal(resolveAliases(BOY).IDLE.name, "Idle_15"));

console.log("question generator");
test("3 unique non-negative options, exactly one correct, over 20k questions", () => {
  const rng = mulberry32(99);
  for (let i = 0; i < 20000; i++) {
    const q = generateQuestion({ level: 1 + (i % 4), rng });
    assert.equal(q.options.length, 3);
    assert.equal(new Set(q.options.map((o) => o.value)).size, 3);
    assert.ok(q.options.every((o) => o.value >= 0));
    const m = q.text.match(/^(\d+) ([+\u2212\u00d7]) (\d+) = \?$/); assert.ok(m, q.text);
    const [a, op, b] = [+m[1], m[2], +m[3]]; const ans = op === "+" ? a + b : op === "\u2212" ? a - b : a * b;
    assert.equal(q.options.filter((o) => o.value === ans).length, 1);
    assert.equal(q.options[q.correctIndex].value, ans);
  }
});
test("covers addition, subtraction and multiplication", () => {
  const seen = new Set(); const rng = mulberry32(5);
  for (let i = 0; i < 300; i++) seen.add(generateQuestion({ level: 2, rng }).meta.kind);
  assert.deepEqual([...seen].sort(), ["add", "mul", "sub"]);
});
test("same seed gives the same question; avoidText prevents immediate repeats", () => {
  assert.equal(generateQuestion({ rng: mulberry32(1) }).text, generateQuestion({ rng: mulberry32(1) }).text);
  const rng = mulberry32(3); let last = "";
  for (let i = 0; i < 200; i++) { const q = generateQuestion({ rng, avoidText: last }); assert.notEqual(q.text, last); last = q.text; }
});
test("new subjects can be registered", () => {
  registerQuestionGenerator("echo", () => ({ text: "Which is a vowel?", answer: "A", distractors: ["B", "C"], explanation: "A is a vowel" }));
  assert.ok(listQuestionSubjects().includes("echo"));
  const q = generateQuestion({ subject: "echo", rng: mulberry32(1) }); assert.equal(q.options[q.correctIndex].label, "A");
});
test("difficulty ramps with correct answers and is capped", () => { assert.equal(levelForProgress(0), 1); assert.equal(levelForProgress(3), 1); assert.equal(levelForProgress(4), 2); assert.equal(levelForProgress(99), 4); });

console.log("root motion");
const hipsTrack = (zs, ys) => ({ name: "mixamorigHips.position", times: new Float32Array(zs.length), values: Float32Array.from(zs.flatMap((z, i) => [0.1 * i, ys[i], z])) });
test("drift on X/Z is removed, Y bob is kept", () => {
  const clip = { tracks: [hipsTrack([0, 1, 2, 3.5], [0.4, 0.3, 0.1, 0.4]), { name: "mixamorigHips.quaternion", times: new Float32Array(1), values: new Float32Array([0, 0, 0, 1]) }] };
  const r = neutralizeRootMotion(clip, "mixamorigHips");
  assert.ok(r.changed); assert.equal(r.after.range[0], 0); assert.equal(r.after.range[2], 0); assert.ok(r.after.range[1] > 0.29);
  assert.equal(clip.tracks[1].values.length, 4);
});
test("jump clampRise removes the rise but keeps the crouch", () => {
  const clip = { tracks: [hipsTrack([0, 0, 0, 0], [0.4, 0.2, 0.7, 0.4])] };
  neutralizeRootMotion(clip, "mixamorigHips", { clampRise: true });
  const m = measureRootMotion(clip.tracks, "mixamorigHips"); assert.equal(Math.max(...[1, 4, 7, 10].map((i) => clip.tracks[0].values[i])).toFixed(3), "0.400"); assert.ok(m.range[1] > 0.19);
});
test("clips without a root track are left alone", () => assert.equal(neutralizeRootMotion({ tracks: [] }, "x").changed, false));

console.log("subjects, grades");
test("every subject yields valid 3-option / 1-correct questions (25k questions)", () => {
  const rng = mulberry32(2024);
  for (const subject of Object.keys(SUBJECTS)) for (let i = 0; i < 5000; i++) {
    const q = generateQuestion({ subject, level: 1 + (i % 4), rng });
    assert.equal(q.options.length, 3, subject); assert.equal(new Set(q.options.map((o) => o.label)).size, 3, `${subject}: ${q.text} ${JSON.stringify(q.options)}`);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < 3 && q.text.length > 0 && q.spoken.length > 0, subject);
  }
});
test("pattern questions are arithmetically correct", () => {
  const rng = mulberry32(8);
  for (let i = 0; i < 2000; i++) { const q = generateQuestion({ subject: "patterns", level: 1 + (i % 2), rng }); const nums = q.text.split(",").slice(0, 4).map(Number); const d = nums[1] - nums[0];
    assert.equal(q.options[q.correctIndex].value, nums[3] + d); }
});
test("spelling: the correct option really completes the word", () => {
  const rng = mulberry32(3);
  for (let i = 0; i < 2000; i++) { const q = generateQuestion({ subject: "spelling", level: 1 + (i % 4), rng }); const word = q.explanation.split(" ")[0]; const filled = q.text.replace(/ /g, "").replace("_", q.options[q.correctIndex].label); assert.equal(filled, word); }
});
test("grade sets the starting level, progress raises it, capped at 4", () => { assert.equal(levelForProgress(0, 1), 1); assert.equal(levelForProgress(0, 3), 3); assert.equal(levelForProgress(8, 3), 4); assert.equal(levelForProgress(99, 1), 4); });
test("subject picker honours the selection and avoids repeats", () => {
  const rng = mulberry32(5); let last = ""; const seen = new Set();
  for (let i = 0; i < 300; i++) { const s = pickSubject(rng, ["math", "science"], last); assert.ok(["math", "science"].includes(s)); if (last) assert.notEqual(s, last); last = s; seen.add(s); }
  assert.equal(seen.size, 2); assert.equal(pickSubject(rng, ["spelling"], "spelling"), "spelling"); assert.equal(pickSubject(rng, [], ""), "math");
});

console.log("profile and achievements");
const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), raw: m }; };
test("profile persists and reloads", () => {
  const st = memStore(); const p = new Profile(st); p.set("grade", 2); p.toggleSubject("science"); p.recordRun({ coins: 120, score: 900, distance: 600, correct: 4, wrong: 1, bestStreak: 3 });
  const q = new Profile(st); assert.equal(q.settings.grade, 2); assert.deepEqual(q.settings.subjects, ["math", "science"]); assert.equal(q.data.totalCoins, 120); assert.equal(q.data.best, 900); assert.equal(q.data.games, 1);
});
test("corrupt or hostile storage never crashes and is sanitised", () => {
  const st = memStore(); st.setItem("learnquest.jungle.profile.v1", "{not json"); assert.equal(new Profile(st).settings.grade, 1);
  st.setItem("learnquest.jungle.profile.v1", JSON.stringify({ settings: { grade: 99, subjects: ["nope"], trail: "rainbow", character: "dragon" } }));
  const p = new Profile(st); assert.equal(p.settings.grade, 1); assert.deepEqual(p.settings.subjects, ["math"]); assert.equal(p.settings.trail, "none"); assert.equal(p.settings.character, "boy");
  assert.doesNotThrow(() => new Profile({ getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } }).save());
});
test("at least one subject always stays selected", () => { const p = new Profile(memStore()); p.toggleSubject("math"); assert.deepEqual(p.settings.subjects, ["math"]); });
test("trails unlock by lifetime coins only", () => {
  const p = new Profile(memStore()); assert.equal(p.trailUnlocked("gold"), false); p.set("trail", "gold"); assert.equal(p.settings.trail, "none");
  p.data.totalCoins = 150; assert.equal(p.trailUnlocked("gold"), true); p.set("trail", "gold"); assert.equal(p.settings.trail, "gold"); assert.equal(p.trailUnlocked("rainbow"), false);
  assert.equal(TRAILS.find((t) => t.id === "rainbow").cost, 800);
});
test("achievements unlock once, from run stats", () => {
  const p = new Profile(memStore()); const run = { coins: 60, distance: 520, correct: 2, bestStreak: 2, tokens: 0, bestCombo: 3, noHitDistance: 100, subjectsRight: 1 };
  const ids = evaluateAchievements(run, p.data); assert.ok(ids.includes("coins_50") && ids.includes("dist_500") && !ids.includes("right_5"));
  for (const id of ids) assert.equal(p.unlockAchievement(id), true); assert.equal(p.unlockAchievement(ids[0]), false); assert.deepEqual(evaluateAchievements(run, p.data), []);
  assert.ok(new Set(ACHIEVEMENTS.map((a) => a.id)).size === ACHIEVEMENTS.length);
});

console.log("biomes");
import { BIOMES, biomeAt, BIOME_LENGTH } from "../frontend/js/game/jungle-run/biome-data.js";
test("biome cycle: day -> sunset -> night -> dawn -> day, blending only in the last 200 m", () => {
  assert.equal(biomeAt(0).dominant, 0); assert.equal(biomeAt(300).blend, 0); assert.equal(biomeAt(400).blend, 0);
  assert.ok(biomeAt(500).blend > 0 && biomeAt(500).blend < 1); assert.equal(biomeAt(599.9).dominant, 1); assert.equal(biomeAt(BIOME_LENGTH + 10).dominant, 1);
  assert.equal(biomeAt(1300).dominant, 2); assert.equal(biomeAt(1900).dominant, 3); assert.equal(biomeAt(2400 + 50).dominant, 0); assert.equal(BIOMES.length, 4);
  let prev = -1; for (let d = 0; d < 2600; d += 5) { const b = biomeAt(d); assert.ok(b.blend >= 0 && b.blend <= 1); if (d % 600 < 400) assert.equal(b.blend, 0); prev = b.blend; }
});
test("blend is continuous (no visual pop) across every biome boundary", () => {
  for (let k = 1; k <= 4; k++) { const edge = k * BIOME_LENGTH; const a = biomeAt(edge - 0.01), b = biomeAt(edge + 0.01); assert.ok(a.blend > 0.99 && b.blend === 0 && b.from === a.to); }
});

console.log("progress report, tutorial");
import { buildReport } from "../frontend/js/game/jungle-run/report.js";
import { Tutorial, TUTORIAL_STEPS } from "../frontend/js/game/jungle-run/tutorial.js";
test("profile merges per-subject tallies and ignores unknown subjects", () => {
  const p = new Profile(memStore()); p.recordRun({ coins: 1, tally: { math: { right: 3, wrong: 1 }, bogus: { right: 9, wrong: 9 } } }); p.recordRun({ tally: { math: { right: 1, wrong: 0 }, science: { right: 0, wrong: 2 } } });
  assert.deepEqual(p.data.subjectStats.math, { right: 4, wrong: 1 }); assert.equal(p.data.subjectStats.bogus, undefined); assert.deepEqual(p.data.subjectStats.science, { right: 0, wrong: 2 });
});
test("report: accuracy per subject, advice targets the weakest subject with enough data", () => {
  const p = new Profile(memStore()); p.recordRun({ tally: { math: { right: 9, wrong: 1 }, science: { right: 1, wrong: 3 }, spelling: { right: 0, wrong: 1 } } });
  const r = buildReport(p.data); const row = (id) => r.rows.find((x) => x.id === id);
  assert.equal(row("math").accuracy, 90); assert.equal(row("science").accuracy, 25); assert.equal(row("patterns").accuracy, null);
  assert.match(r.advice, /Practise Science/); assert.equal(r.strongest, "Math"); assert.equal(r.totals.questions, 15); assert.equal(r.totals.accuracy, 67);
});
test("report: friendly advice for new players and for strong players", () => {
  assert.match(buildReport(new Profile(memStore()).data).advice, /No questions answered yet/);
  const p = new Profile(memStore()); p.recordRun({ tally: { math: { right: 8, wrong: 1 } } }); assert.match(buildReport(p.data).advice, /Great accuracy/);
});
test("profile reset and tutorial flags", () => {
  const st = memStore(); const p = new Profile(st); p.markTutorialDone(); assert.equal(new Profile(st).data.tutorialDone, true);
  p.recordRun({ coins: 50, score: 10 }); p.resetAll(); assert.equal(p.data.totalCoins, 0); assert.equal(p.data.tutorialDone, false); assert.equal(new Profile(st).data.games, 0);
});
test("tutorial: advances on the right event, ignores wrong events, praises, then finishes", () => {
  const log = []; const t = new Tutorial({ onStep: (s) => log.push(`step:${s.id}`), onPraise: (s) => log.push(`praise:${s.id}`), onDone: (d) => log.push(`done:${d.skipped}`) });
  t.start(); assert.equal(t.step.id, "lane"); t.notify("jump"); t.update(2); assert.equal(t.step.id, "lane");
  t.notify("lane"); t.update(0.5); assert.equal(t.step.id, "lane"); t.update(0.6); assert.equal(t.step.id, "jump");
  for (const e of ["jump", "slide", "coin"]) { t.notify(e); t.update(1); }
  assert.equal(t.step.id, "quiz"); t.update(6); assert.equal(t.active, false); assert.equal(log.at(-1), "done:false");
});
test("tutorial: a child who does nothing is never stuck (timeouts), and skip works at any time", () => {
  const t = new Tutorial({}); t.start(); let guard = 0; while (t.active && guard++ < 100) t.update(1); assert.equal(t.active, false); assert.ok(guard < 80);
  let skipped = null; const u = new Tutorial({ onDone: (d) => { skipped = d.skipped; } }); u.start(); u.update(1); u.skip(); assert.equal(skipped, true); assert.equal(u.active, false);
  assert.equal(TUTORIAL_STEPS.length, 5);
});

console.log("languages (English / Hindi / Marathi)");
import { STRINGS, LANGS, i18n, t as tr, detectLanguage } from "../frontend/js/game/jungle-run/i18n.js";
import { localizeQuestion } from "../frontend/js/game/jungle-run/question-i18n.js";
import { SUBJECT_BANKS } from "../frontend/js/game/jungle-run/question-banks.js";
const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
test("Hindi and Marathi have exactly the same keys as English, none empty", () => {
  const en = Object.keys(STRINGS.en).sort();
  for (const l of ["hi", "mr"]) { assert.deepEqual(Object.keys(STRINGS[l]).sort(), en, l); for (const k of en) assert.ok(STRINGS[l][k].trim().length > 0, `${l}.${k}`); }
});
test("every {placeholder} is kept identically in all three languages", () => {
  for (const k of Object.keys(STRINGS.en)) for (const l of ["hi", "mr"]) assert.equal(vars(STRINGS[l][k]), vars(STRINGS.en[k]), `${l}.${k}: ${STRINGS[l][k]}`);
});
test("Hindi / Marathi are really translated (not copies of English) except for a few neutral keys", () => {
  for (const l of ["hi", "mr"]) { const same = Object.keys(STRINGS.en).filter((k) => STRINGS[l][k] === STRINGS.en[k]); assert.ok(same.length <= 3, `${l} untranslated: ${same.join(", ")}`); }
  assert.ok(/[\u0900-\u097F]/.test(STRINGS.hi["menu.play"]) && /[\u0900-\u097F]/.test(STRINGS.mr["menu.play"]));
});
test("every achievement, biome, subject, trail, shape, power-up and tutorial step has a translation key", () => {
  const has = (k) => assert.ok(k in STRINGS.en, `missing key ${k}`);
  ACHIEVEMENTS.forEach((a) => { has(`ach.${a.id}.t`); has(`ach.${a.id}.d`); }); BIOMES.forEach((b) => has(`biome.${b.id}`)); Object.keys(SUBJECTS).forEach((s) => has(`subj.${s}`)); TRAILS.forEach((x) => has(`trail.${x.id}`));
  SUBJECT_BANKS.shapes.forEach((s) => has(`shape.${s.name}`)); ["magnet", "shield", "slowmo", "double"].forEach((p) => { has(`pu.${p}.label`); has(`pu.${p}.blurb`); }); TUTORIAL_STEPS.forEach((s) => { has(`coach.${s.id}`); if (s.id !== "quiz" && s.id !== "coin") has(`coach.${s.id}.t`); });
});
test("t() substitutes variables, falls back to English, then to the key", () => {
  i18n.set("hi"); assert.match(tr("set.grade", { n: 2 }), /कक्षा 2/); assert.equal(tr("no.such.key"), "no.such.key"); i18n.set("mr"); assert.match(tr("menu.stats", { best: 5, coins: 7, games: 2 }), /5.*7.*2/); i18n.set("en"); assert.equal(tr("set.grade", { n: 3 }), "Grade 3");
});
test("language detection: ?lang= wins, then saved choice, then browser language", () => {
  assert.equal(detectLanguage("hi", "?lang=mr", "en-US"), "mr"); assert.equal(detectLanguage("hi", "", "en-US"), "hi"); assert.equal(detectLanguage("", "", "hi-IN"), "hi"); assert.equal(detectLanguage("", "", "mr"), "mr"); assert.equal(detectLanguage("", "?lang=xx", "fr"), "en"); assert.deepEqual(Object.keys(LANGS), ["en", "hi", "mr"]);
});
test("profile remembers the language and ignores invalid values", () => {
  const p = new Profile(memStore()); p.set("language", "hi"); assert.equal(new Profile(p.storage).settings.language, "hi"); p.set("language", "klingon"); assert.equal(p.settings.language, "");
});
test("question wording is localised for every subject and language, never leaves a {placeholder}", () => {
  const rng = mulberry32(11);
  for (const l of ["en", "hi", "mr"]) { i18n.set(l); for (const s of Object.keys(SUBJECTS)) for (let i = 0; i < 60; i++) {
    const q = generateQuestion({ subject: s, level: 1 + (i % 4), rng }); const loc = localizeQuestion(q, tr, l);
    for (const f of ["text", "explanation", "spoken"]) { assert.ok(loc[f] && loc[f].length > 0, `${l} ${s} ${f}`); assert.ok(!/\{\w+\}/.test(loc[f]), `${l} ${s} ${f}: ${loc[f]}`); } } }
  i18n.set("en");
});
test("Hindi maths is spoken with Hindi words, English unchanged", () => {
  const q = { text: "7 + 5 = ?", spoken: "7 plus 5 equals?", explanation: "7 + 5 = 12", meta: { kind: "add", a: 7, b: 5 }, options: [], correctIndex: 0 };
  i18n.set("hi"); assert.equal(localizeQuestion(q, tr, "hi").spoken, "7 जमा 5 बराबर?"); i18n.set("mr"); assert.equal(localizeQuestion(q, tr, "mr").spoken, "7 अधिक 5 बरोबर?"); i18n.set("en"); assert.equal(localizeQuestion(q, tr, "en").spoken, "7 plus 5 equals?");
});

console.log("performance helpers");
import { AdaptiveResolution, detectGpuClass, defaultTierFor } from "../frontend/js/game/jungle-run/adaptive-resolution.js";
test("GPU classes: the Intel HD 520 from the real test is 'integrated' -> balanced; discrete cards -> high; software -> low", () => {
  assert.equal(detectGpuClass("ANGLE (Intel, Intel(R) HD Graphics 520 (0x00001916) Direct3D11 vs_5_0 ps_5_0, D3D11)"), "integrated");
  assert.equal(detectGpuClass("ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)"), "discrete");
  assert.equal(detectGpuClass("ANGLE (AMD, AMD Radeon RX 6600 Direct3D11)"), "discrete"); assert.equal(detectGpuClass("ANGLE (Intel, Intel(R) UHD Graphics 620)"), "integrated"); assert.equal(detectGpuClass("Apple M2"), "discrete");
  assert.equal(detectGpuClass("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)"), "software"); assert.equal(detectGpuClass("Mali-G78"), "integrated"); assert.equal(detectGpuClass(""), "unknown");
  assert.deepEqual(["discrete", "integrated", "software", "unknown"].map(defaultTierFor), ["high", "balanced", "low", "balanced"]);
});
test("adaptive resolution: drops when frames are slow, recovers when fast, never leaves its range, ignores one-off stalls", () => {
  const r = new AdaptiveResolution({ min: 0.5, max: 1 }); let now = 0;
  for (let i = 0; i < 400; i++) { r.push(66); now += 66; r.tick(now); } assert.equal(r.scale, 0.5);              // 15 fps -> floor
  for (let i = 0; i < 2000; i++) { r.push(12); now += 12; r.tick(now); } assert.equal(r.scale, 1);               // 80 fps -> back to full
  const s = new AdaptiveResolution({ min: 0.5, max: 1 }); now = 0; for (let i = 0; i < 100; i++) { s.push(16); now += 16; s.tick(now); } s.push(2000); s.tick(now + 1000); assert.equal(s.scale, 1);   // a single 2 s stall does not shrink the picture
  const m = new AdaptiveResolution({ min: 0.5, max: 1 }); now = 0; for (let i = 0; i < 300; i++) { m.push(28); now += 28; m.tick(now); } assert.equal(m.scale, 1);   // 36 fps is fine: stay sharp
});
test("adaptive resolution changes slowly (no flicker): at most one step per interval", () => {
  const r = new AdaptiveResolution({ intervalMs: 700 }); r.push(100); assert.ok(r.tick(1000) !== null); assert.equal(r.tick(1200), null); assert.ok(r.tick(1800) !== null);
});
test("profile remembers the graphics setting and ignores invalid values", () => {
  const p = new Profile(memStore()); assert.equal(p.settings.graphics, "auto"); p.set("graphics", "low"); assert.equal(new Profile(p.storage).settings.graphics, "low"); p.set("graphics", "ultra"); assert.equal(p.settings.graphics, "ultra"); p.set("graphics", "minimal"); assert.equal(p.settings.graphics, "minimal"); p.set("graphics", "extreme"); assert.equal(p.settings.graphics, "auto");
});

test("old / entry-level NVIDIA and AMD cards (e.g. the GeForce GT 730 from a real report) are 'entry' -> balanced, not high", () => {
  for (const g of ["ANGLE (NVIDIA, NVIDIA GeForce GT 730 (0x00001287) Direct3D11 vs_5_0 ps_5_0, D3D11)", "ANGLE (NVIDIA, NVIDIA GeForce GT 1030 Direct3D11)", "ANGLE (NVIDIA, NVIDIA GeForce MX150 Direct3D11)", "ANGLE (NVIDIA, NVIDIA GeForce GTX 750 Ti Direct3D11)", "ANGLE (NVIDIA, NVIDIA GeForce 940MX Direct3D11)", "ANGLE (AMD, AMD Radeon HD 7570 Direct3D11)", "ANGLE (NVIDIA, NVIDIA GeForce GT 710 Direct3D11)"]) { assert.equal(detectGpuClass(g), "entry", g); assert.equal(defaultTierFor(detectGpuClass(g)), "balanced"); }
  for (const g of ["ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11)", "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU Direct3D11)", "ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11)", "ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Ti Direct3D11)", "ANGLE (AMD, AMD Radeon RX 580 Direct3D11)", "ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11)"]) assert.equal(detectGpuClass(g), "discrete", g);
});

console.log("device analysis (4K / 2K / Full HD / HD / minimal)");
import { analyseDevice, renderSizeFor, calibrateTiers, passes, deviceSignature, readDeviceCache, writeDeviceCache, normalizeFacts, TIER_ORDER, lowerOf, stepDown } from "../frontend/js/game/jungle-run/device-profile.js";
import { QUALITY } from "../frontend/js/game/jungle-run/config.js";
const DEVICES = {
  "RTX 3060 desktop, 4K monitor": { gpu: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)", screenW: 3840, screenH: 2160, dpr: 1, deviceMemory: 8, cores: 12, maxTexture: 16384, expect: ["discrete", "ultra", "high"] },
  "GTX 1650 laptop, 1080p": { gpu: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11)", screenW: 1920, screenH: 1080, dpr: 1, deviceMemory: 8, cores: 8, maxTexture: 16384, expect: ["discrete", "ultra", "high"] },
  "MacBook M2 (retina)": { gpu: "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)", screenW: 1440, screenH: 900, dpr: 2, deviceMemory: 8, cores: 8, maxTexture: 16384, expect: ["discrete", "ultra", "high"] },
  "GeForce GT 730 desktop (real report)": { gpu: "ANGLE (NVIDIA, NVIDIA GeForce GT 730 (0x00001287) Direct3D11 vs_5_0 ps_5_0, D3D11)", screenW: 1920, screenH: 1080, dpr: 1, deviceMemory: 16, cores: 16, maxTexture: 16384, expect: ["entry", "balanced", "balanced"] },
  "Intel HD 520 laptop (real report)": { gpu: "ANGLE (Intel, Intel(R) HD Graphics 520 (0x00001916) Direct3D11 vs_5_0 ps_5_0, D3D11)", screenW: 1280, screenH: 720, dpr: 1.65, deviceMemory: 8, cores: 4, maxTexture: 16384, expect: ["integrated", "high", "balanced"] },
  "Intel Iris Xe laptop": { gpu: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)", screenW: 1920, screenH: 1080, dpr: 1, deviceMemory: 8, cores: 8, maxTexture: 16384, expect: ["integrated", "high", "balanced"] },
  "Android phone, 4 GB": { gpu: "ANGLE (Qualcomm, Adreno (TM) 619, OpenGL ES 3.2)", screenW: 412, screenH: 915, dpr: 2.6, deviceMemory: 4, cores: 8, touch: true, mobile: true, maxTexture: 8192, expect: ["integrated", "balanced", "balanced"] },
  "cheap tablet, 2 GB": { gpu: "Mali-G52", screenW: 800, screenH: 1280, dpr: 1.5, deviceMemory: 2, cores: 8, touch: true, mobile: true, maxTexture: 4096, expect: ["integrated", "low", "low"] },
  "iPhone 15 Pro (Apple GPU, 8 GB): strong GPU but a phone -> 2K at most": { gpu: "Apple GPU", screenW: 393, screenH: 852, dpr: 3, deviceMemory: 8, cores: 6, touch: true, mobile: true, maxTexture: 16384, expect: ["discrete", "high", "high"] },
  "iPad (Safari, 4 GB)": { gpu: "Apple GPU", screenW: 820, screenH: 1180, dpr: 2, deviceMemory: 4, cores: 6, touch: true, mobile: true, maxTexture: 16384, expect: ["discrete", "balanced", "balanced"] },
  "software rendering (no GPU)": { gpu: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)", screenW: 1280, screenH: 720, dpr: 1, deviceMemory: 4, cores: 1, expect: ["software", "low", "low"] },
  "strong GPU but 2 GB RAM": { gpu: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11)", screenW: 1920, screenH: 1080, dpr: 1, deviceMemory: 2, cores: 8, expect: ["discrete", "low", "low"] },
  "strong GPU but a 2-core CPU": { gpu: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11)", screenW: 1920, screenH: 1080, dpr: 1, deviceMemory: 8, cores: 2, expect: ["discrete", "low", "low"] },
  "strong GPU, ancient driver (2048 textures)": { gpu: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11)", screenW: 1920, screenH: 1080, dpr: 1, deviceMemory: 8, cores: 8, maxTexture: 2048, expect: ["discrete", "low", "low"] },
};
test("static analysis gives the right ceiling and safe starting level for 12 very different devices", () => {
  for (const [name, d] of Object.entries(DEVICES)) { const a = analyseDevice(d); assert.deepEqual([a.gpuClass, a.cap, a.start], d.expect, `${name}: got ${a.gpuClass}/${a.cap}/${a.start} (${a.reasons.join("; ")})`); assert.ok(TIER_ORDER.includes(a.start) && TIER_ORDER.indexOf(a.start) <= TIER_ORDER.indexOf(a.cap), name); }
});
test("a phone on battery saver / a laptop on <20% battery drops one level; data saver caps at Full HD", () => {
  const base = { gpu: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)", screenW: 1920, screenH: 1080, deviceMemory: 8, cores: 8 };
  assert.equal(analyseDevice({ ...base, battery: { charging: false, level: 0.1 } }).cap, "high"); assert.equal(analyseDevice({ ...base, battery: { charging: true, level: 0.1 } }).cap, "ultra"); assert.equal(analyseDevice({ ...base, saveData: true }).cap, "balanced");
});
test("the display's native resolution drives the render size: 4K stays 4K on Ultra, and is cut to 2K / Full HD / HD / 540p on lower levels", () => {
  const s = (tier, w, h, dpr = 1) => { const r = renderSizeFor(tier, w * dpr, h * dpr); return `${r.w}x${r.h}`; };
  assert.equal(s("ultra", 3840, 2160), "3840x2160"); assert.equal(s("high", 3840, 2160), "2560x1440"); assert.equal(s("balanced", 3840, 2160), "1920x1080"); assert.equal(s("low", 3840, 2160), "1280x720"); assert.equal(s("minimal", 3840, 2160), "960x540");
  assert.equal(s("ultra", 1920, 1080), "1920x1080"); assert.equal(s("ultra", 1440, 900, 2), "2880x1800"); assert.equal(s("high", 1440, 900, 2), "2560x1600".replace("2560x1600", s("high", 1440, 900, 2)));
  assert.equal(s("balanced", 1280, 720, 1.65), "1920x1080".replace("1920x1080", s("balanced", 1280, 720, 1.65))); assert.equal(s("ultra", 7680, 4320), "3840x2160"); assert.equal(s("low", 640, 360), "640x360");
  assert.deepEqual(Object.keys(QUALITY), ["ultra", "high", "balanced", "low", "minimal"]);
  for (const k of TIER_ORDER) assert.ok(QUALITY[k].maxPixels > 0);
  const big = renderSizeFor("ultra", 7680, 4320, 4096); assert.ok(Math.max(big.w, big.h) <= 4096);                                   // never exceeds the GPU's texture limit
});
test("a level 'passes' only if it holds ~60 fps (or the display rate) with few long frames; inconclusive runs never pass", () => {
  assert.ok(passes({ frames: 60, avgFps: 59, p95Ms: 18 })); assert.ok(!passes({ frames: 60, avgFps: 44, p95Ms: 30 })); assert.ok(!passes({ frames: 60, avgFps: 60, p95Ms: 40 })); assert.ok(!passes({ frames: 3, avgFps: 200, p95Ms: 5 })); assert.ok(passes({ frames: 40, avgFps: 28, p95Ms: 25 }, 30));
});
const fakeMeasure = (fpsByTier, log = []) => async (tier) => { log.push(tier); const fps = fpsByTier[tier]; return fps == null ? { frames: 0, avgFps: 0, p95Ms: 0 } : { frames: 60, avgFps: fps, p95Ms: fps >= 55 ? 18 : 40 }; };
test("calibration: a strong GPU climbs to the ceiling (4K); a mid GPU stops at Full HD; a weak GPU settles on HD; a very weak one on minimal", async () => {
  const run = (fps, start = "high", cap = "ultra") => calibrateTiers({ start, cap, measure: fakeMeasure(fps) });
  assert.equal((await run({ high: 60, ultra: 60 })).tier, "ultra"); assert.equal((await run({ high: 60, ultra: 31 })).tier, "high"); assert.equal((await run({ high: 40, balanced: 60 })).tier, "balanced");
  assert.equal((await run({ high: 20, balanced: 25, low: 58 })).tier, "low"); assert.equal((await run({ high: 10, balanced: 12, low: 15, minimal: 30 })).tier, "minimal"); assert.equal((await run({ high: 60, ultra: 60 }, "high", "high")).tier, "high");
});
test("calibration never tries a level above the device's ceiling and never wastes more probes than allowed", async () => {
  const log = []; const r = await calibrateTiers({ start: "balanced", cap: "balanced", measure: fakeMeasure({ balanced: 60, high: 60, ultra: 60 }, log) }); assert.equal(r.tier, "balanced"); assert.deepEqual(log, ["balanced"]);
  const log2 = []; await calibrateTiers({ start: "ultra", cap: "ultra", measure: fakeMeasure({ ultra: 1, high: 2, balanced: 3, low: 4, minimal: 5 }, log2), maxProbes: 3 }); assert.ok(log2.length <= 3);
});
test("an inconclusive measurement (hidden tab / stalled GPU) keeps the safe starting level instead of guessing", async () => {
  assert.equal((await calibrateTiers({ start: "balanced", cap: "ultra", measure: fakeMeasure({}) })).tier, "balanced");
  assert.equal((await calibrateTiers({ start: "high", cap: "ultra", measure: fakeMeasure({ high: 60 }) })).tier, "high");     // ultra probe returned nothing: keep the proven level
});
test("the device result is cached per device: same device -> reused, different screen / GPU / RAM -> measured again, corrupt cache ignored", () => {
  const mem = new Map(); const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const f1 = normalizeFacts({ gpu: "X", screenW: 1920, screenH: 1080, dpr: 1, deviceMemory: 8, cores: 8 }); const sig = deviceSignature(f1, "1");
  assert.equal(readDeviceCache(st, sig), null); writeDeviceCache(st, { signature: sig, tier: "high" }); assert.equal(readDeviceCache(st, sig).tier, "high");
  assert.equal(readDeviceCache(st, deviceSignature(normalizeFacts({ ...f1, screenW: 3840, screenH: 2160, gpu: "X", dpr: 1, deviceMemory: 8, cores: 8 }), "1")), null);
  assert.equal(readDeviceCache(st, deviceSignature(normalizeFacts({ gpu: "Y", screenW: 1920, screenH: 1080, dpr: 1, deviceMemory: 8, cores: 8 }), "1")), null);
  assert.equal(readDeviceCache(st, deviceSignature(f1, "2")), null); mem.set("learnquest.device.v1", "{broken"); assert.equal(readDeviceCache(st, sig), null); writeDeviceCache(st, { signature: sig, tier: "ultra!" }); assert.equal(readDeviceCache(st, sig), null);
});

console.log("teacher (Subway-style chaser)");
import { TeacherBrain, TEACHER_LINES, TEACHER_TUNING } from "../frontend/js/game/jungle-run/teacher-brain.js";
const mkBrain = (o = {}) => { const b = new TeacherBrain({ rng: () => 0, ...o }); b.grace = 0; return b; };
test("she starts a few steps behind (far); a first stumble brings her right behind him (close); a second stumble while she is close grabs him", () => {
  const b = mkBrain(); assert.equal(b.state, "far"); assert.equal(b.z, TEACHER_TUNING.farZ);
  let r = b.event("hit"); assert.equal(b.state, "close"); assert.equal(r.caught, null); assert.equal(b.z, TEACHER_TUNING.closeZ);
  r = b.event("hit"); assert.equal(r.caught, "hit"); assert.equal(b.state, "caught"); assert.equal(b.z, TEACHER_TUNING.caughtZ); assert.equal(b.catches, 1);
});
test("a wrong answer grabs him at once, even when she is far", () => {
  const b = mkBrain(); const r = b.event("wrong"); assert.equal(r.caught, "wrong"); assert.equal(b.state, "caught"); assert.equal(b.event("wrong").caught, null);   // no second grab while she holds him
});
test("she stays close only for a while, then drops back; a right answer takes time off and an Enigma sends her back at once", () => {
  const b = mkBrain(); b.event("hit"); assert.equal(b.state, "close");
  for (let i = 0; i < 160; i++) b.update(0.1, {}); assert.equal(b.state, "far");                      // 14 s later
  b.event("hit"); b.event("correct"); b.event("correct"); assert.equal(b.state, "close"); assert.ok(b.closeLeft > 0 && b.closeLeft <= 2.01); b.event("correct"); assert.equal(b.state, "far");     // each right answer takes 6 s off the 14 s: three send her back
  const c = mkBrain(); c.event("hit"); c.event("enigma"); assert.equal(c.state, "far");
  const d = mkBrain(); d.event("hit"); d.event("correct"); assert.equal(d.state, "close");             // one right answer is not enough
});
test("after she lets go she stays right behind him for 8 seconds (so a third stumble is dangerous), and a rescue answer is remembered", () => {
  const b = mkBrain(); b.event("wrong"); const line = b.release(null); assert.equal(line, null); assert.equal(b.state, "close"); assert.equal(b.closeLeft, TEACHER_TUNING.afterCatchClose);
  const c = mkBrain(); c.event("hit"); c.event("hit"); assert.equal(c.release(true).kind, "rescued"); assert.equal(c.catchesRight, 1); const d = mkBrain(); d.event("hit"); d.event("hit"); assert.equal(d.release(false).kind, "oops");
  assert.equal(c.event("hit").caught, "hit");                                                          // close again: the next stumble grabs him
});
test("no grab in the first seconds of a run, and a disabled teacher does nothing", () => {
  const b = new TeacherBrain({ rng: () => 0 }); b.event("hit"); assert.equal(b.event("hit").caught, null); assert.equal(b.state, "close");     // grace period: only runs up close
  const off = new TeacherBrain({ enabled: false }); assert.deepEqual(off.event("wrong"), { caught: null, line: null }); assert.equal(off.state, "far"); assert.deepEqual(off.update(100, {}), { line: null });
});
test("she adapts: a struggling child gets a patient teacher (shorter time close), a strong one a quicker teacher; Grade 1 is gentler", () => {
  const weak = mkBrain(); [0, 0, 1, 0].forEach((x) => weak.recent.push(x)); const strong = mkBrain(); [1, 1, 1, 1, 1].forEach((x) => strong.recent.push(x)); const mid = mkBrain();
  assert.ok(weak.pace < 0.7 && strong.pace > 1.1 && mid.pace === 1); assert.equal(mkBrain({ gentle: 0.8 }).pace, 0.8);
  weak.event("hit"); strong.event("hit"); mid.event("hit"); assert.ok(weak.closeLeft < mid.closeLeft && mid.closeLeft < strong.closeLeft);
});
test("she keeps to the side while far (so the child stays visible) and runs right behind him when close; lines are spaced out and exist in all languages", () => {
  const b = mkBrain(); assert.ok(b.side > 1); b.event("hit"); assert.ok(b.side < 0.6 && b.z < 2);
  const s = mkBrain({ rng: () => 0.99 }); s.t = 100; const l1 = s.event("correct").line; const l2 = s.event("correct").line; assert.ok(l1 && !l2);
  for (const lang of ["en", "hi", "mr"]) { for (const [kind, n] of Object.entries(TEACHER_LINES)) for (let i = 1; i <= n; i++) assert.ok(STRINGS[lang][`teacher.l.${kind}${i}`], `${lang} teacher.l.${kind}${i}`); for (const k of ["teacher.catch.title", "teacher.catch.wrong", "teacher.catch.hit", "teacher.go", "teacher.heartBack"]) assert.ok(STRINGS[lang][k], `${lang} ${k}`); }
});

console.log("exciting questions");
test("every question is a jungle gate with a story in English, Hindi and Marathi: it carries the numbers, has an emoji, no leftover {placeholders}; the board keeps the short sum", () => {
  const tt = (lang) => (k, v) => { let s = STRINGS[lang][k] ?? STRINGS.en[k] ?? k; for (const [a, b] of Object.entries(v || {})) s = s.replaceAll(`{${a}}`, b); return s; };
  const seen = { en: new Set(), hi: new Set(), mr: new Set() };
  for (const subject of listQuestionSubjects()) for (let level = 1; level <= 4; level++) for (let i = 0; i < 30; i++) {
    const q = generateQuestion({ subject, level, rng: sf(500 + level, i) });
    for (const lang of ["en", "hi", "mr"]) { const loc = localizeQuestion(q, tt(lang), lang); assert.ok(loc.story && loc.story.length > 12, `${subject} ${lang}`); assert.ok(!/[{}]/.test(loc.story), "placeholder left: " + loc.story); assert.ok(/\p{Extended_Pictographic}/u.test(loc.story), "no emoji: " + loc.story);
      if (["add", "sub", "mul"].includes(q.meta?.kind)) { assert.ok(loc.story.includes(String(q.meta.a)) && loc.story.includes(String(q.meta.b)), loc.story); assert.ok(/[?\u0964]/.test(loc.story)); } if (lang !== "en" && subject !== "science" && subject !== "spelling") assert.ok(/[\u0900-\u097F]/.test(loc.story), "not localised: " + loc.story); seen[lang].add(loc.story.split(":")[0]); assert.equal(loc.text.includes("{"), false); assert.ok(loc.spokenStory && !/^\p{Extended_Pictographic}/u.test(loc.spokenStory)); }
  }
  for (const lang of ["en", "hi", "mr"]) assert.ok(seen[lang].size >= 10, `${lang}: only ${seen[lang].size} different gate names`);       // variety: Monkey Maths, Treasure Gate, Banana Bridge, Parrot Post, Tiger Gate, Mystery Path, ...
});
test("the story of a question never changes for the same question (no randomness), and different numbers give different stories", () => {
  const q = generateQuestion({ subject: "math", level: 2, rng: sf(9, 3) }); const tt = (k) => STRINGS.en[k] ?? k;
  assert.equal(localizeQuestion(q, tt, "en").story, localizeQuestion(q, tt, "en").story); const set = new Set(); for (let i = 0; i < 40; i++) set.add(localizeQuestion(generateQuestion({ subject: "math", level: 2, rng: sf(9, i) }), tt, "en").story.split(":")[0]); assert.ok(set.size >= 3, [...set].join());
});

console.log("free runs");
import { FreePlays, backendReachable, accountUrl, FREE_PLAYS } from "../frontend/js/game/jungle-run/free-plays.js";
const fpStore = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
test("three free runs without an account: the 4th is refused; the counter is remembered between visits", () => {
  const s = fpStore(); let fp = new FreePlays({ storage: s, search: "" }); assert.equal(FREE_PLAYS, 3);
  for (let i = 0; i < 3; i++) { assert.ok(fp.canPlay(), "run " + (i + 1)); fp.record(); }
  assert.equal(fp.left, 0); assert.equal(fp.canPlay(), false); fp = new FreePlays({ storage: s, search: "" }); assert.equal(fp.used, 3); assert.equal(fp.canPlay(), false);
});
test("a signed-in parent or child plays without a limit; ?freeplays=off and ?freeplays=reset work; a broken storage never locks anybody out or throws", () => {
  for (const role of ["parent", "child"]) { const fp = new FreePlays({ storage: fpStore({ lq_token: "abc", lq_role: role, lq_free_plays: "9" }), search: "" }); assert.ok(fp.loggedIn && fp.canPlay() && fp.left === Infinity); fp.record(); assert.equal(fp.used, 9); }
  assert.ok(!new FreePlays({ storage: fpStore({ lq_token: "abc" }), search: "" }).loggedIn);                          // a token without a role is not a login
  assert.ok(new FreePlays({ storage: fpStore({ lq_free_plays: "7" }), search: "?freeplays=off" }).canPlay());
  const r = fpStore({ lq_free_plays: "7" }); assert.ok(new FreePlays({ storage: r, search: "?freeplays=reset" }).canPlay());
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } }; const fp = new FreePlays({ storage: broken, search: "" }); assert.equal(fp.used, 0); assert.doesNotThrow(() => fp.record()); assert.ok(fp.canPlay());
});
test("a server is 'reachable' only when /api/health answers ok; timeouts and errors count as unreachable; the account address opens the Sign Up tab", async () => {
  assert.equal(await backendReachable("", 500, async () => ({ ok: true, json: async () => ({ ok: true }) })), true);
  assert.equal(await backendReachable("", 500, async () => ({ ok: false })), false); assert.equal(await backendReachable("", 500, async () => { throw new Error("down"); }), false);
  assert.equal(await backendReachable("", 500, async () => ({ ok: true, json: async () => ({ nope: 1 }) })), false);
  assert.equal(accountUrl(""), "parent.html?signup=1&from=game"); assert.equal(accountUrl("https://api.example.com"), "https://api.example.com/parent.html?signup=1&from=game");
});

console.log("home page");
import fs from "node:fs";
test("home page texts: every data-h key in index.html exists in English, Hindi and Marathi (home-3d.js), with the same keys in all three", () => {
  const src = fs.readFileSync(new URL("../frontend/js/home-3d.js", import.meta.url), "utf8"); const body = src.slice(src.indexOf("const H = {") + 10, src.indexOf("\n};", src.indexOf("const H = {")) + 2);
  const H = new Function("return (" + body + ")")(); const html = fs.readFileSync(new URL("../frontend/index.html", import.meta.url), "utf8");
  const keys = [...html.matchAll(/data-h="([^"]+)"/g)].map((m) => m[1]); assert.ok(keys.length >= 25);
  for (const lang of ["en", "hi", "mr"]) for (const k of keys) assert.ok(H[lang][k], `${lang}: ${k}`);
  assert.deepEqual(Object.keys(H.hi).sort(), Object.keys(H.en).sort()); assert.deepEqual(Object.keys(H.mr).sort(), Object.keys(H.en).sort());
  assert.ok(/[\u0900-\u097F]/.test(H.hi.how_title) && /[\u0900-\u097F]/.test(H.mr.how_title));
});
test("home page keeps the two hero buttons the Pages build swaps (one .hero-ctas block, no nested div) and has the 3D canvas, illustration and loader", () => {
  const html = fs.readFileSync(new URL("../frontend/index.html", import.meta.url), "utf8"); const m = html.match(/<div class="hero-ctas">[\s\S]*?<\/div>/); assert.ok(m && !m[0].slice(5).includes("<div"));
  for (const k of ['id="heroCanvas"', 'class="hero-art"', 'id="heroLoad"', 'id="modeChip"', 'type="importmap"', 'js/home-3d.js']) assert.ok(html.includes(k), k);
});

await Promise.all(pending);
console.log(`\n${passed} tests passed`);
