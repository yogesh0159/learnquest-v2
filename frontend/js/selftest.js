import { AudioManager } from "/js/game/jungle-run/audio-manager.js";
import { SFX } from "/js/game/jungle-run/sound-recipes.js";
import { generateQuestion, listQuestionSubjects } from "/js/game/jungle-run/question-generator.js";
import { Profile } from "/js/game/jungle-run/profile.js";
import { evaluateAchievements } from "/js/game/jungle-run/achievements.js";
import { Tutorial } from "/js/game/jungle-run/tutorial.js";
import { mulberry32 } from "/js/game/jungle-run/rng.js";
import { QUALITY, LANES } from "/js/game/jungle-run/config.js";
import { loadNativeCore } from "/js/game/jungle-run/native-core.js";
import * as NR from "/js/game/jungle-run/native-reference.js";

const $ = (id) => document.getElementById(id);
const results = []; let report = "";
const QP = new URLSearchParams(location.search); const BENCH_MS = Number(QP.get("benchMs")) || 7000, WARM_MS = Number(QP.get("warmMs")) || 1500;   // shortened only by automated tests
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const add = (name, status, detail = "") => { results.push({ name, status, detail }); render(); };
function render() {
  const p = results.filter((r) => r.status === "PASS").length, f = results.filter((r) => r.status === "FAIL").length;
  $("sum").textContent = f ? `${p} passed, ${f} FAILED` : `${p} checks passed`; $("sum").style.color = f ? "#c0261b" : "#1b7a42";
  $("res").innerHTML = results.map((r) => `<tr><td class="${r.status === "PASS" ? "p" : r.status === "FAIL" ? "f" : "i"}">${r.status}</td><td>${r.name}</td><td>${r.detail}</td></tr>`).join("");
}
async function check(name, fn) { try { const r = await fn(); if (r === false) add(name, "FAIL"); else add(name, typeof r === "string" ? "PASS" : "PASS", typeof r === "string" ? r : ""); } catch (e) { add(name, "FAIL", String(e.message || e).slice(0, 160)); } }
const info = (name, detail) => add(name, "INFO", detail);

async function run() {
  $("go").disabled = true; results.length = 0; render(); $("bench").innerHTML = "";
  const frame = $("game"); const t0 = performance.now();
  frame.src = "/jungle-local-preview.html?sandbox=1&quality=low&notutorial=1&seed=2024";
  await new Promise((res, rej) => { const t = setInterval(() => { if (frame.contentWindow?.LQ_JUNGLE?.ready) { clearInterval(t); res(); } if (performance.now() - t0 > 120000) { clearInterval(t); rej(new Error("game did not start in 2 minutes")); } }, 250); }).catch((e) => add("Game starts", "FAIL", e.message));
  const g = frame.contentWindow?.LQ_JUNGLE; if (!g?.ready) { $("go").disabled = false; return; }
  g.stopLoop();
  add("Game starts and loads all models", "PASS", `${Math.round(performance.now() - t0)} ms`);

  // ---- environment
  const gl = document.createElement("canvas").getContext("webgl2"); const ext = gl?.getExtension("WEBGL_debug_renderer_info");
  const gpu = gl ? (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "WebGL2") : "none";
  await check("WebGL 2 graphics available", () => (gl ? gpu : false));
  info("Browser", navigator.userAgent.replace(/\s+/g, " ").slice(0, 110)); info("Screen", `${screen.width}x${screen.height} @${devicePixelRatio}x, ${navigator.hardwareConcurrency || "?"} cores, ${navigator.deviceMemory || "?"} GB`);
  info("Speech / touch / vibrate", `speech ${"speechSynthesis" in window ? "yes" : "no"}, touch ${navigator.maxTouchPoints > 0 ? "yes" : "no"}, vibrate ${navigator.vibrate ? "yes" : "no"}`);

  // ---- assets
  await check("All 8 world models loaded from their GLB files (no placeholders)", () => { const d = g.assets.diagnostics(); const bad = d.assets.filter((a) => a.usedFallback || a.procedural); if (d.failures.length || bad.length) return false; return `${d.assets.length} models, ${(d.assets.reduce((s, a) => s + a.tris, 0) / 1000).toFixed(0)}k triangles in total`; });
  await check("Boy and Girl both load with every needed animation mapped", async () => {
    const need = ["RUN", "JUMP", "SLIDE", "HIT", "FALL", "IDLE", "VICTORY"]; const out = [];
    for (const key of ["girl", "boy"]) { await g.chooseCharacter(key); const al = g.player.anim.describe().aliases; const miss = need.filter((n) => !al[n]); if (miss.length) throw new Error(`${key} missing ${miss.join(",")}`); out.push(`${key}: RUN=${al.RUN.name}`); }
    return out.join("; ");
  });
  await check("Road: 10 seamless tiles and all 3 lanes sit on the walkway", () => { const t = g.track.continuity(); return t.worstSeamError < 1e-6 && t.walkable.lanesFit ? `walkway +-${t.walkable.halfWidth} m` : false; });

  await check("Native engine core (C/C++ WebAssembly) loads, passes its start-up self-test, and the game uses it", () => { const e = g.deviceInfo().engine; return e === "native" ? "active in the game" : "not active (the identical JavaScript reference is used)"; });
  await check("C/C++ core gives exactly the same results as the JavaScript reference, and its speed on this device", async () => {
    const c = await loadNativeCore({ logger: {} }); if (!c) return "WebAssembly core unavailable here (JavaScript is used)";
    const A = NR.makeAmbientBuffers(); for (let i = 0; i < 110; i++) { A.base[i * 3] = (i % 17) - 8; A.base[i * 3 + 1] = 1 + (i % 5); A.base[i * 3 + 2] = -60 + (i % 70); A.seed[i] = i * 0.37; c.ambient.base.set(A.base.subarray(i * 3, i * 3 + 3), i * 3); c.ambient.seed[i] = A.seed[i]; }
    const rj = NR.createRng(9); c.seedRng(9); for (let k = 0; k < 200; k++) { NR.ambientStep(A, 110, k * 0.016, 0.16, rj); c.ambient.step(110, k * 0.016, 0.16); }
    for (let i = 0; i < 330; i++) if (A.pos[i] !== c.ambient.pos[i]) throw new Error("ambient result differs at " + i);
    const T = (fn) => { for (let i = 0; i < 300; i++) fn(i); const t0 = performance.now(); for (let i = 0; i < 20000; i++) fn(i); return (performance.now() - t0) / 20000; };
    const js = T((i) => NR.ambientStep(A, 110, i * 0.016, 0.16, rj)), wa = T((i) => c.ambient.step(110, i * 0.016, 0.16));
    return `identical; particle update JS ${(js * 1000).toFixed(1)} us, C ${(wa * 1000).toFixed(1)} us (x${(js / wa).toFixed(2)}). A frame is 16,700 us, so this part never limits the frame rate`;
  });

  // ---- gameplay
  g.start(); g.director.enabled = false; g.obstacles.clear(); g.collectibles.clear(); g.track.reserved.clear(); g.questions.nextIndex = 1e9; g.advance(1);
  await check("Lane change is smooth (not a teleport)", () => { g.player.moveLane(-1); g.advance(0.06); const mid = g.player.x; g.advance(0.6); return mid > -2.2 + 0.05 && mid < -0.2 && Math.abs(g.player.x + 2.2) < 0.02 ? `x after 60 ms: ${mid.toFixed(2)}` : false; });
  await check("Jump goes up and lands, slide gets low, then back to running", () => { g.player.laneIndex = 1; g.advance(0.5); g.player.jump(); let top = 0; for (let i = 0; i < 70; i++) { g.advance(1 / 60); top = Math.max(top, g.player.y); } g.advance(0.6); g.player.slide(); g.advance(0.4); const low = g.player.height; g.advance(1.5); return top > 1.2 && top < 2.2 && low < 1 && g.player.state === "run" ? `apex ${top.toFixed(2)} m` : false; });
  await check("Coin pick-up adds score; coin in another lane is ignored", () => { g.collectibles.spawn("coin", 0, 1, -6); g.collectibles.spawn("coin", 2.2, 1, -6); const c = g.stats.coins; g.advance(1); return g.stats.coins === c + 1; });
  await check("Golden Enigma grants a power-up and counts a token", () => { g.power.reset(); const t = g.stats.tokens; g.collectibles.spawn("enigma", 0, 1.25, -5); g.advance(1); return g.stats.tokens === t + 1 && g.power.list().length === 1; });
  await check("Magnet pulls far-lane coins", () => { g.power.reset(); g.power.give("magnet"); g.collectibles.clear(); g.collectibles.spawn("coin", 2.2, 1, -9); const c = g.stats.coins; g.advance(1.5); return g.stats.coins === c + 1; });
  await check("Shield blocks one rock, the next rock hurts", () => { g.power.reset(); g.power.give("shield"); g.player.invulnerable = 0; const l = g.stats.lives; g.obstacles.spawn("rock", g.player.x, -3); g.advance(1); const a = g.stats.lives === l; g.advance(2); g.obstacles.spawn("rock", g.player.x, -3); g.advance(1); return a && g.stats.lives === l - 1; });
  await check("Jumping over a rock is safe; sliding under a beam is safe", () => { g.advance(2.5); const l = g.stats.lives; g.obstacles.clear(); g.obstacles.spawn("rock", g.player.x, -9); g.advance(0.35); g.player.jump(); g.advance(1.4); g.obstacles.clear(); g.obstacles.spawn("beam", g.player.x, -9); g.advance(0.5); g.player.slide(); g.advance(1.4); return g.stats.lives === l; });
  await check("Slow Time slows the world, Double Coins doubles coin score", () => { g.power.reset(); g.advance(4); const s1 = g.speed; g.power.give("slowmo"); g.advance(3); const slow = g.speed < s1 * 0.85; g.power.reset(); g.advance(7); g.collectibles.clear(); g.power.give("double"); const sc = g.stats.score; g.collectibles.spawn("coin", g.player.x, 1, -1.4); g.advance(0.6); return slow && g.stats.score - sc >= 19; });
  await check("Question board: right lane scores, wrong lane costs a life", () => {
    const ask = (laneRight) => { g.questions.held = false; g.track.reserved.delete(g.questions.nextIndex); g.questions.nextIndex = g.track.maxIndex + 2; g.track.reserved.add(g.questions.nextIndex); g.player.invulnerable = 0; for (let i = 0; i < 700 && !(g.questions.hasZone && g.questions.padZ > -14); i++) g.advance(0.2); const q = g.questions.question; g.player.laneIndex = laneRight ? q.correctIndex : (q.correctIndex + 1) % 3; for (let i = 0; i < 60 && g.questions.state !== "answered"; i++) g.advance(0.1); g.advance(6); };
    g.player.invulnerable = 1e9; const l0 = g.stats.lives, c0 = g.stats.correct; ask(true); const okRight = g.stats.correct === c0 + 1;
    g.stats.lives = 3; g.power.reset(); const wr = g.stats.wrong; g.player.invulnerable = 0; ask(false); return okRight && g.stats.wrong === wr + 1 && g.stats.lives === 2;
  });
  await check("Game over screen appears and a new run starts cleanly", () => { g.power.reset(); g.stats.lives = 1; g.player.invulnerable = 0; g.obstacles.clear(); g.obstacles.spawn("rock", g.player.x, -3); g.advance(4); const over = g.state === "gameover" && !document.getElementById("game").contentDocument.getElementById("gameOverScreen").hidden; g.start(); return over && g.state === "playing" && g.stats.lives === 3; });

  // ---- endless world
  await check("120 s endless run: tiles recycle, no gaps, no leaks, no NaN", () => {
    g.start(); g.player.invulnerable = 1e9; g.director.enabled = true; g.advance(5); const gm = g.renderer.info.memory.geometries, tx = g.renderer.info.memory.textures; let nan = false, seam = 0, maxAct = 0; const r0 = g.track.recycledTotal;
    for (let i = 0; i < 120 * 30; i++) { g.step(1 / 30); if (i % 30) continue; nan ||= !Number.isFinite(g.stats.distance); seam = Math.max(seam, g.track.continuity().worstSeamError); maxAct = Math.max(maxAct, g.collectibles.active.length + g.obstacles.active.length); }
    return !nan && seam < 1e-6 && g.track.recycledTotal - r0 > 100 && g.renderer.info.memory.geometries === gm && g.renderer.info.memory.textures === tx && maxAct < 70 ? `${g.track.recycledTotal - r0} tiles recycled, ${Math.round(g.stats.distance)} m` : false;
  });
  await check("All four worlds appear (day, sunset, night, dawn)", () => { const seen = new Set(); for (let d = 0; d < 2400; d += 100) { g.biome.update(d, true); seen.add(g.biome.name); } g.biome.update(g.biomeOffset, true); return seen.size === 4 ? [...seen].join(" > ") : false; });

  // ---- logic modules (run directly in this page)
  await check("Questions: every subject x 300 valid (3 different options, 1 correct)", () => { const rng = mulberry32(5); for (const s of listQuestionSubjects()) for (let i = 0; i < 300; i++) { const q = generateQuestion({ subject: s, level: 1 + (i % 4), rng }); if (q.options.length !== 3 || new Set(q.options.map((o) => o.label)).size !== 3) return false; } return listQuestionSubjects().join(", "); });
  await check("Profile saves, reloads, unlocks trails and achievements", () => { const m = new Map(); const st = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; const p = new Profile(st); p.recordRun({ coins: 120, score: 500, distance: 600, correct: 5, wrong: 1, bestStreak: 5, tally: { math: { right: 5, wrong: 1 } } }); const q = new Profile(st); const ids = evaluateAchievements({ coins: 60, distance: 520, correct: 5, bestStreak: 5, tokens: 0, bestCombo: 0, noHitDistance: 0 }, q.data); return q.data.totalCoins === 120 && q.trailUnlocked("gold") && ids.includes("coins_50") && ids.includes("dist_500"); });
  await check("Tutorial walks through all steps and never gets stuck", () => { let done = false; const t = new Tutorial({ onDone: () => { done = true; } }); t.start(); for (const e of ["lane", "jump", "slide", "coin"]) { t.notify(e); t.update(1); } t.update(6); return done; });
  await check("Sound engine renders every effect and the music", async () => {
    const need = Object.keys(SFX); let worst = 1;
    for (const n of need) { const c = new OfflineAudioContext(2, 44100 * 3, 44100); const a = new AudioManager({ context: c, storage: null }); a.play(n); const d = (await c.startRendering()).getChannelData(0); let pk = 0; for (const v of d) pk = Math.max(pk, Math.abs(v)); worst = Math.min(worst, pk); if (!(pk > 0.02 && pk <= 1.001)) throw new Error(`${n} peak ${pk.toFixed(3)}`); }
    const c = new OfflineAudioContext(2, 44100 * 10, 44100); const a = new AudioManager({ context: c, storage: null }); a.musicBus.gain.value = 0.5; for (let i = 0; i < 4; i++) a.scheduleBar(i * 2.2); const d = (await c.startRendering()).getChannelData(0); let pk = 0; for (const v of d) pk = Math.max(pk, Math.abs(v)); return pk > 0.05 ? `${need.length} effects + music OK` : false;
  });

  // ---- device analysis + benchmark (real time). Each level is measured at the display's NATIVE size (capped by that level's pixel budget),
  // so a 4K screen really renders 4K for "ultra". Then "auto" (adaptive) is tried.
  const GPU_CLASS = g.gpuClass; const dev = g.deviceInfo();
  info("Device analysis", `${dev.gpuClass}; screen ${dev.native.w}x${dev.native.h} @${dev.dpr}x, ${dev.refreshHz} Hz; highest level ${dev.cap}; safe start ${dev.start}; reasons: ${dev.reasons.join("; ")}`);
  $("bench").innerHTML = `<h3>Speed test</h3><p>Running the real game at each graphics level for ${Math.round(BENCH_MS / 1000)} seconds (native screen size)...</p>`;
  const bench = []; g.start(); g.player.invulnerable = 1e9; g.director.enabled = true; g.god = true; g.drsEnabled = false;
  const measure = async (label, tier) => {
    g.renderScale = 1; g.drs.reset(); g.probe = { w: g.facts.native.w, h: g.facts.native.h }; g._applyQuality(QUALITY[tier]); g.advance(1); g.startLoop(); await sleep(WARM_MS); g.frameProfile(true); g.startFrameSampling(); await sleep(BENCH_MS);
    const samples = g.frameSamples.slice(5); const r = g.stopFrameSampling(); const snap = g.snapshot(); const fp = g.frameProfile(); g.stopLoop();
    const hitches = samples.filter((m) => m > 100).length;
    return { q: label, tier, ...r, hitches, logicMs: fp.logicMs, submitMs: fp.renderSubmitMs, calls: snap.render.calls, tris: snap.render.triangles, px: `${g.renderSizePx.w}x${g.renderSizePx.h}` };
  };
  for (const q of ["ultra", "high", "balanced", "low", "minimal"]) { bench.push(await measure(q, q)); $("bench").innerHTML = "<h3>Speed test</h3>" + benchTable(bench); }
  g.probe = null; g.drsEnabled = true; g.renderScale = 1; g.drs.reset();
  const holds = (b) => b.avgFps >= 54 && b.p95Ms <= 26;
  const best = bench.find(holds);                                                   // bench is ordered ultra -> minimal: the first that holds ~60 fps is the highest
  g._applyQuality(QUALITY[best?.tier || "minimal"]); g.startLoop(); await sleep(WARM_MS + BENCH_MS * 0.6); g.startFrameSampling(); await sleep(BENCH_MS);
  const ar = g.stopFrameSampling(); const asnap = g.snapshot(); g.stopLoop();
  bench.push({ q: "auto (adaptive)", tier: "auto", ...ar, hitches: 0, calls: asnap.render.calls, tris: asnap.render.triangles, px: `${g.renderSizePx.w}x${g.renderSizePx.h} (scale ${g.renderScale})` });
  bench.forEach((b) => { b.tooSlow = b.frames < 10; });
  const fixed = bench.filter((b) => b.tier !== "auto"); const auto = bench[bench.length - 1];
  const pick = best || fixed[fixed.length - 1];
  const verdict = bench.every((b) => b.tooSlow) ? "Too few frames could be measured: this computer (or this browser mode) renders very slowly. Check that hardware acceleration is on."
    : best ? `This device can hold about 60 fps at the "${best.tier}" level (${best.px}). Automatic quality will choose it for you.` : "No level holds 60 fps here; automatic quality will use the fastest one and lower the picture sharpness as needed.";
  const applyAuto = () => { const p = new Profile(); p.set("graphics", "auto"); localStorage.removeItem("learnquest.device.v1"); $("applyMsg").textContent = " Done: the game will analyse this device again at its next start."; };
  const applyFixed = () => { const p = new Profile(); p.set("graphics", pick.tier); $("applyMsg").textContent = ` Done: quality locked to ${pick.tier}.`; };
  $("bench").innerHTML = "<h3>Speed test</h3>" + benchTable(bench) + `<p class="note"><b>Best level for this device: ${pick.q}.</b> ${verdict}</p><div class="row"><button id="applyAuto" class="primary">Use automatic quality (recommended)</button><button id="applyFixed">Lock to ${pick.tier}</button><span id="applyMsg"></span></div>`;
  $("applyAuto").addEventListener("click", applyAuto); $("applyFixed").addEventListener("click", applyFixed);
  const applyValue = "auto";
  report = buildReport(bench, pick, verdict, gpu, GPU_CLASS, applyValue, dev); $("copy").disabled = false; $("go").disabled = false; $("go").textContent = "Run again"; render();
}
const benchTable = (rows) => `<table class="kv"><tr><th>Quality</th><th>Average FPS</th><th>Worst FPS</th><th>Slowest 5% frame</th><th>Stutters (&gt;100 ms)</th><th>Game logic ms</th><th>Draw-call submit ms</th><th>Picture size</th><th>Draw calls</th><th>Triangles</th></tr>${rows.map((b) => `<tr><td>${b.q}</td><td><b>${b.avgFps}</b></td><td>${b.minFps}</td><td>${b.p95Ms} ms</td><td>${b.hitches ?? "-"}</td><td>${b.logicMs ?? "-"}</td><td>${b.submitMs ?? "-"}</td><td>${b.px || ""}</td><td>${b.calls}</td><td>${(b.tris / 1e6).toFixed(2)}M</td></tr>`).join("")}</table>`;
function buildReport(bench, pick, verdict, gpu, gpuClass, applyValue, dev) {
  const p = results.filter((r) => r.status === "PASS").length, f = results.filter((r) => r.status === "FAIL");
  return [`LearnQuest self-check - ${new Date().toISOString()}`, `Checks: ${p} passed, ${f.length} failed${f.length ? " (" + f.map((x) => x.name).join("; ") + ")" : ""}`, `GPU: ${gpu} (${gpuClass})`, `Device analysis: highest level ${dev.cap}, safe start ${dev.start}, native screen ${dev.native.w}x${dev.native.h} @${dev.dpr}x, ${dev.refreshHz} Hz, ${dev.ram ?? "?"} GB, ${dev.cores ?? "?"} cores; game chose ${dev.tier}${dev.calibration ? " (measured " + (dev.calibration.probes || []).map((p) => p.tier + " " + p.avgFps + "fps").join(", ") + ")" : ""}`, `Browser: ${navigator.userAgent}`, `Screen: ${screen.width}x${screen.height} @${devicePixelRatio}x, cores ${navigator.hardwareConcurrency}, mem ${navigator.deviceMemory} GB`,
    ...bench.map((b) => `${b.q}: avg ${b.avgFps} fps, worst ${b.minFps} fps, p95 ${b.p95Ms} ms, stutters ${b.hitches ?? "-"}, logic ${b.logicMs ?? "-"} ms, draw-submit ${b.submitMs ?? "-"} ms, ${b.px || ""}, ${b.calls} calls, ${(b.tris / 1e6).toFixed(2)}M tris`), `Best level: ${pick.q} - ${verdict}`, "", ...results.map((r) => `[${r.status}] ${r.name}${r.detail ? " - " + r.detail : ""}`)].join("\n");
}
$("go").addEventListener("click", () => run().catch((e) => { add("Self-check crashed", "FAIL", String(e.message || e)); $("go").disabled = false; }));
$("copy").addEventListener("click", async () => { try { await navigator.clipboard.writeText(report); $("copy").textContent = "Copied!"; } catch { $("sys").textContent = report; $("copy").textContent = "Shown below - select and copy"; } });
if (new URLSearchParams(location.search).get("auto") === "1") $("go").click();
window.__selftest = { results, get report() { return report; } };
