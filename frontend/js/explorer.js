import { AudioManager } from "/js/game/jungle-run/audio-manager.js";
import { SFX } from "/js/game/jungle-run/sound-recipes.js";
import { generateQuestion, listQuestionSubjects, levelForProgress } from "/js/game/jungle-run/question-generator.js";
import { Profile, SUBJECTS, TRAILS } from "/js/game/jungle-run/profile.js";
import { ACHIEVEMENTS } from "/js/game/jungle-run/achievements.js";
import { buildReport } from "/js/game/jungle-run/report.js";
import { mulberry32 } from "/js/game/jungle-run/rng.js";
import { analyseDevice, collectBrowserFacts, renderSizeFor, deviceSignature, readDeviceCache, clearDeviceCache, DEVICE_MODEL_VERSION, TIER_ORDER } from "/js/game/jungle-run/device-profile.js";

const $ = (id) => document.getElementById(id);
const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; };
const PROFILE_KEY = "learnquest.jungle.profile.v1";
let backend = { up: false, db: "" };

/* ------------------------------------------------------------------ tabs */
const sections = [...document.querySelectorAll("main > section")];
sections.forEach((s) => { const b = document.createElement("button"); b.textContent = s.dataset.tab; b.addEventListener("click", () => show(s.id)); b.dataset.for = s.id; $("tabs").appendChild(b); });
function show(id) { sections.forEach((s) => s.classList.toggle("on", s.id === id)); document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.for === id)); history.replaceState(null, "", "#" + id.replace("tab-", "")); }
show(sections.find((s) => "#" + s.id.replace("tab-", "") === location.hash)?.id || "tab-start");

/* ---------------------------------------------------------------- status */
async function status() {
  $("bServer").textContent = `server ${location.host}`; $("bServer").className = "badge ok";
  try { const r = await fetch("/api/health", { cache: "no-store" }); const j = await r.json(); backend = { up: !!j.ok, db: j.database }; } catch { backend = { up: false }; }
  $("bApi").textContent = backend.up ? `full backend ON (${backend.db})` : "backend OFF (Jungle-only server)"; $("bApi").className = "badge " + (backend.up ? "ok" : "warn");
  try {
    const c = document.createElement("canvas"); const gl = c.getContext("webgl2"); const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    $("bGpu").textContent = gl ? "graphics: " + (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL).slice(0, 60) : "WebGL2 OK") : "WebGL2 missing!"; $("bGpu").className = "badge " + (gl ? "ok" : "bad");
  } catch { $("bGpu").textContent = "graphics: unknown"; $("bGpu").className = "badge warn"; }
  const p = new Profile(); $("bProfile").textContent = `profile: ${p.data.games} runs, ${p.data.totalCoins} coins`; $("bProfile").className = "badge ok";
  renderPages();
}

/* ------------------------------------------------------------- all pages */
const PAGES = [
  ["Jungle Run 3D", "The new endless runner with the real 3D models, questions, power-ups.", "/jungle-local-preview.html", false],
  ["Jungle Run + test tools", "Same game with the F9 cheat panel open.", "/jungle-local-preview.html?tools=1", false],
  ["Characters & animations (Lab)", "Boy and Girl, every animation clip, camera views.", "/jungle-local-preview.html?lab=1&tools=1", false],
  ["3D asset gallery", "Orbit every GLB, runtime vs original, wireframe, clips.", "/asset-gallery.html", false],
  ["Self-check & speed test", "About 25 automatic checks + real FPS on your PC.", "/selftest.html", false],
  ["Home page", "LearnQuest landing page.", "/index.html", false],
  ["Parent sign-in / sign-up", "Create or log into a parent account.", "/parent.html", true],
  ["Create child profile", "Add a child with avatar and PIN.", "/profile-setup.html", true],
  ["Child login", "Pick a child and enter the PIN.", "/child-login.html", true],
  ["Child dashboard", "XP, coins, levels, subjects (child login needed).", "/dashboard.html", true],
  ["Jungle world map", "Level map of the Jungle world (child).", "/world-jungle.html", true],
  ["Maths Kingdom map", "Level map of Maths Kingdom (child).", "/world-maths_kingdom.html", true],
  ["Jungle Runner 3D (original) - level 1", "The original backend-connected runner. Child login needed; the map picks other levels.", "/jungle-game.html?level=jungle_lvl_1", true],
  ["Maths Kingdom 3D game - level 1", "The maths world game (child login needed).", "/maths-kingdom-game.html?level=maths_kingdom_lvl_1", true],
  ["Reward shop", "Unlock and equip rewards with coins (child).", "/rewards.html", true],
  ["My tasks", "Tasks set by the parent (child).", "/tasks.html", true],
  ["RealWorld missions", "Missions for the real world (child).", "/realworld-missions.html", true],
  ["Parent dashboard", "Progress, tasks and learning plan (parent login).", "/parent-dashboard.html", true],
  ["Original 3D Explorer Lab", "The earlier character inspector.", "/character-lab.html", false],
  ["Reference studio", "Character reference tool.", "/reference-studio.html", false],
];
function renderPages() {
  $("pageGrid").innerHTML = ""; $("startNote").textContent = backend.up ? "Full backend is running: every page below works. Use 'Demo accounts' to sign in quickly." : "Only the Jungle-only server is running, so pages tagged 'needs backend' cannot sign in. Close this and run START_EXPLORER_ALL.bat to test them.";
  $("startNote").style.display = backend.up ? "none" : "block";
  for (const [name, desc, url, needs] of PAGES) $("pageGrid").appendChild(h(`<div class="card"><b>${name}</b><small>${desc}</small>${needs ? `<span class="tag ${backend.up ? "" : "off"}">${backend.up ? "needs login" : "needs backend"}</span>` : ""}<a class="btn" href="${url}" target="_blank">Open &#8599;</a></div>`));
}

/* ------------------------------------------------------- demo accounts */
const FAMILY = { parent: { name: "Demo Parent", email: "demo.parent@learnquest.local", password: "Demo@1234" }, kids: [{ name: "Aarav", age: 8, avatar: "human_boy_v1", className: "Grade 3" }, { name: "Mia", age: 5, avatar: "human_girl_v1", className: "KG" }, { name: "Riya", age: 11, avatar: "human_girl_v1", className: "Grade 6" }] };
const AVATAR = { human_boy_v1: "\u{1F466}\u{1F3FD}", human_girl_v1: "\u{1F467}\u{1F3FD}" };   // the real Boy / Girl explorers (3D models)
const api = async (path, { method = "GET", body, token } = {}) => {
  const r = await fetch("/api" + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || `HTTP ${r.status}`); e.status = r.status; throw e; } return j;
};
const log = (t) => { $("famLog").textContent += t + "\n"; };
async function makeFamily() {
  $("famLog").textContent = ""; $("famLinks").innerHTML = "";
  if (!backend.up) { log("The full backend is not running. Close this window and run START_EXPLORER_ALL.bat."); return; }
  let token;
  try { token = (await api("/auth/parent/login", { method: "POST", body: { email: FAMILY.parent.email, password: FAMILY.parent.password } })).token; log("Parent account already existed: signed in."); }
  catch (e) {
    if (e.status !== 401) { log("Sign-in failed: " + e.message); return; }
    try { token = (await api("/auth/parent/signup", { method: "POST", body: FAMILY.parent })).token; log("Parent account created."); } catch (e2) { log("Sign-up failed: " + e2.message); return; }
  }
  let kids = (await api("/auth/child/list", { token })).children;
  for (const k of FAMILY.kids) if (!kids.some((c) => c.name === k.name)) { await api("/auth/child/create", { method: "POST", token, body: { ...k, language: "en", pin: "1234" } }); log(`Child ${k.name} created.`); }
  kids = (await api("/auth/child/list", { token })).children;
  const first = kids.find((c) => c.name === "Aarav") || kids[0];
  if (first && !(await api(`/parent/tasks/${first.id}`, { token })).tasks?.length) { for (const t of [["Tidy your room", "15 minutes", 20], ["Read for 10 minutes", "Any book", 15], ["Help set the table", "Before dinner", 10]]) await api("/parent/tasks", { method: "POST", token, body: { childId: first.id, title: t[0], description: t[1], rewardValue: t[2] } }); log("3 tasks assigned to " + first.name + "."); }
  try { const u = await api("/explorer/unlock-levels", { method: "POST", token }); log(`All game levels unlocked for ${u.children} children (${u.changed} changes), so every world can be opened.`); } catch (e) { log("Could not unlock levels: " + e.message); }
  log(`Ready: ${kids.length} children. Use the buttons below.`);
  $("famLinks").appendChild(h(`<button class="primary">Open as PARENT &rarr; dashboard</button>`)).addEventListener("click", () => { localStorage.setItem("lq_token", token); localStorage.setItem("lq_role", "parent"); window.open("/parent-dashboard.html", "_blank"); });
  for (const c of kids) $("famLinks").appendChild(h(`<button>${AVATAR[c.avatar] || c.avatar} Open as ${c.name} &rarr; dashboard</button>`)).addEventListener("click", async () => {
    try { const r = await api("/auth/child/login", { method: "POST", body: { childId: c.id, pin: "1234" } }); localStorage.setItem("lq_token", r.token); localStorage.setItem("lq_role", "child"); window.open("/dashboard.html", "_blank"); }
    catch (e) { log(`Could not log in as ${c.name}: ${e.message} (was the PIN changed?)`); }
  });
}
$("mkFamily").addEventListener("click", () => makeFamily().catch((e) => log("Error: " + e.message)));
$("signOut").addEventListener("click", () => { localStorage.removeItem("lq_token"); localStorage.removeItem("lq_role"); log("Signed out of the LearnQuest session."); });

/* ------------------------------------------------------------ Jungle Run */
const runUrl = () => {
  const q = new URLSearchParams(); const v = (id) => $(id).value;
  if (v("rChar")) q.set("character", v("rChar")); if (v("rLang")) q.set("lang", v("rLang")); if (v("rQual")) q.set("quality", v("rQual")); if (v("rGrade")) q.set("grade", v("rGrade")); if (v("rSubj")) q.set("subjects", v("rSubj"));
  if (v("rBiome") !== "0") q.set("biomeStart", v("rBiome")); if (v("rLives")) q.set("lives", v("rLives"));
  if ($("rTools").checked) q.set("tools", "1"); if ($("rGod").checked) q.set("god", "1"); if ($("rLab").checked) q.set("lab", "1"); if ($("rTouch").checked) q.set("touch", "1");
  if ($("rTut").checked) q.set("tutorial", "1"); else q.set("notutorial", "1");
  const u = "/jungle-local-preview.html" + ([...q].length ? "?" + q : ""); $("rGo").href = u; $("rUrl").textContent = location.origin + u; return u;
};
document.querySelectorAll("#tab-run select, #tab-run input").forEach((e) => e.addEventListener("input", runUrl)); runUrl();

/* --------------------------------------------------------------- profile */
const loadP = () => new Profile();
function renderProfile() {
  const p = loadP(); const d = p.data, s = d.settings;
  $("pForm").innerHTML = "";
  const num = (key, label, val) => `<label>${label}<input type="number" data-k="${key}" value="${val}" min="0"></label>`;
  $("pForm").innerHTML = num("totalCoins", "Total coins", d.totalCoins) + num("best", "Best score", d.best) + num("bestDistance", "Best distance (m)", d.bestDistance) + num("games", "Runs played", d.games) + num("bestStreak", "Best answer streak", d.bestStreak)
    + `<label>Grade<select data-s="grade">${[1, 2, 3].map((g) => `<option ${s.grade === g ? "selected" : ""}>${g}</option>`).join("")}</select></label>`
    + `<label>Language<select data-s="language">${[["", "automatic"], ["en", "English"], ["hi", "हिन्दी"], ["mr", "मराठी"]].map(([v, n]) => `<option value="${v}" ${s.language === v ? "selected" : ""}>${n}</option>`).join("")}</select></label>`
    + `<label>Explorer<select data-s="character">${["boy", "girl"].map((c) => `<option ${s.character === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>`
    + `<label>Running trail<select data-s="trail">${TRAILS.map((t) => `<option value="${t.id}" ${s.trail === t.id ? "selected" : ""}>${t.label} (${t.cost} coins)</option>`).join("")}</select></label>`
    + `<label>Subjects<select data-s="subjects" multiple size="5">${Object.entries(SUBJECTS).map(([id, n]) => `<option value="${id}" ${s.subjects.includes(id) ? "selected" : ""}>${n}</option>`).join("")}</select></label>`
    + [["tts", "Read questions aloud"], ["bigText", "Bigger text"], ["tutorialDone", "Tutorial already done"]].map(([k, l]) => `<label class="chk"><input type="checkbox" data-c="${k}" ${(k === "tutorialDone" ? d.tutorialDone : s[k]) ? "checked" : ""}> ${l}</label>`).join("");
  $("pAch").innerHTML = ACHIEVEMENTS.map((a) => `<div class="ach ${d.achievements[a.id] ? "got" : "locked"}" data-a="${a.id}"><b>${a.icon} ${a.title}</b><br><small>${a.desc}</small></div>`).join("");
  const r = buildReport(d);
  $("pReport").innerHTML = `<div class="note">${r.advice}</div>` + r.rows.map((x) => `<div class="rep-row"><span>${x.name}</span><span class="rep-bar"><i style="width:${x.accuracy ?? 0}%"></i></span><span>${x.accuracy == null ? "-" : x.accuracy + "%"} (${x.total})</span></div>`).join("");
  const keys = Object.keys(localStorage).filter((k) => /^(learnquest|lq_)/.test(k)); $("pRaw").textContent = keys.map((k) => `${k} = ${localStorage.getItem(k).slice(0, 400)}`).join("\n\n") || "(nothing stored yet)";
  $("bProfile").textContent = `profile: ${d.games} runs, ${d.totalCoins} coins`;
}
function readForm(p) {
  document.querySelectorAll("#pForm [data-k]").forEach((i) => { p.data[i.dataset.k] = Math.max(0, Number(i.value) || 0); });
  document.querySelectorAll("#pForm [data-s]").forEach((i) => { p.data.settings[i.dataset.s] = i.multiple ? [...i.selectedOptions].map((o) => o.value) : (i.dataset.s === "grade" ? Number(i.value) : i.value); });
  document.querySelectorAll("#pForm [data-c]").forEach((i) => { if (i.dataset.c === "tutorialDone") p.data.tutorialDone = i.checked; else p.data.settings[i.dataset.c] = i.checked; });
  const t = TRAILS.find((x) => x.id === p.data.settings.trail); if (t && p.data.totalCoins < t.cost) p.data.totalCoins = t.cost;     // a chosen trail must be unlocked
  if (!p.data.settings.subjects.length) p.data.settings.subjects = ["math"];
}
$("pSave").addEventListener("click", () => { const p = loadP(); readForm(p); p._sanitize(); p.save(); renderProfile(); status(); });
$("pAch").addEventListener("click", (e) => { const c = e.target.closest("[data-a]"); if (!c) return; const p = loadP(); const id = c.dataset.a; if (p.data.achievements[id]) delete p.data.achievements[id]; else p.data.achievements[id] = Date.now(); p.save(); renderProfile(); });
$("pUnlock").addEventListener("click", () => { const p = loadP(); p.data.totalCoins = Math.max(p.data.totalCoins, 1000); ACHIEVEMENTS.forEach((a) => { p.data.achievements[a.id] ||= Date.now(); }); p.data.settings.subjects = Object.keys(SUBJECTS); p.data.settings.grade = 3; p.save(); renderProfile(); });
$("pFresh").addEventListener("click", () => { if (confirm("Reset the player profile in this browser to a brand-new player?")) { localStorage.removeItem(PROFILE_KEY); localStorage.removeItem("learnquest.jungle.audio"); renderProfile(); status(); } });
$("pExport").addEventListener("click", () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(loadP().data, null, 2)], { type: "application/json" })); a.download = "learnquest-profile.json"; a.click(); });
$("pImport").addEventListener("change", async (e) => { try { const data = JSON.parse(await e.target.files[0].text()); localStorage.setItem(PROFILE_KEY, JSON.stringify(data)); renderProfile(); status(); } catch { alert("That file is not a valid LearnQuest profile."); } });
renderProfile();

/* ----------------------------------------------------------------- sound */
const audio = new AudioManager(); const unlock = () => audio.unlock();
for (const name of Object.keys(SFX)) $("sfxGrid").appendChild(h(`<button>${name}</button>`)).addEventListener("click", async () => { await unlock(); audio.play(name, { combo: 2 }); });
$("mPlay").addEventListener("click", async () => { await unlock(); audio.setMood($("mMood").value); audio.bpm = Number($("mBpm").value); audio.startMusic(); });
$("mStop").addEventListener("click", () => audio.stopMusic(0.4));
$("mMood").addEventListener("change", () => audio.setMood($("mMood").value)); $("mBpm").addEventListener("input", () => { audio.bpm = Number($("mBpm").value); $("mBpmV").textContent = $("mBpm").value; });
$("mVol").addEventListener("input", (e) => audio.setVolume("music", Number(e.target.value))); $("sVol").addEventListener("input", (e) => audio.setVolume("sfx", Number(e.target.value)));

/* ------------------------------------------------------------- questions */
for (const s of listQuestionSubjects()) $("qSubj").appendChild(h(`<option value="${s}">${SUBJECTS[s] || s}</option>`));
$("qGo").addEventListener("click", () => {
  const subject = $("qSubj").value, grade = Number($("qGrade").value), prog = Number($("qProg").value), n = Number($("qN").value); const level = levelForProgress(prog, grade); const rng = mulberry32((Math.random() * 1e9) | 0); let last = "", bad = 0;
  const rows = []; for (let i = 0; i < n; i++) { const q = generateQuestion({ subject, level, rng, avoidText: last }); last = q.text; if (q.options.length !== 3 || new Set(q.options.map((o) => o.label)).size !== 3) bad++; rows.push(q); }
  $("qTable").innerHTML = "<tr><th>#</th><th>Question</th><th>Options (left / middle / right lane)</th><th>Correct</th></tr>" + rows.map((q, i) => `<tr class="ok"><td>${i + 1}</td><td>${q.text}</td><td>${q.options.map((o, k) => (k === q.correctIndex ? `<b>${o.label}</b>` : o.label)).join(" &nbsp;/&nbsp; ")}</td><td>${["left", "middle", "right"][q.correctIndex]}: ${q.options[q.correctIndex].label}</td></tr>`).join("");
  $("qInfo").textContent = `Difficulty level ${level}. ${bad ? bad + " invalid!" : "All " + n + " questions valid (3 different options, exactly one correct)."}`;
});

/* ------------------------------------------------------------------ docs */
const DOCS = [["How to use this (start here)", "/docs/EXPLORER_GUIDE.md"], ["Implementation report", "/docs/IMPLEMENTATION_REPORT.md"], ["Asset inventory", "/docs/ASSET_INVENTORY.md"], ["Test report", "/docs/TEST_REPORT.md"], ["Original v3 test report (kept)", "/docs/TEST_REPORT_ORIGINAL_v3.md"]];
for (const [label, url] of DOCS) $("docBtns").appendChild(h(`<button>${label}</button>`)).addEventListener("click", async () => { $("docView").textContent = "Loading..."; try { const r = await fetch(url); $("docView").textContent = r.ok ? await r.text() : `Not found: ${url}`; } catch (e) { $("docView").textContent = "Could not load: " + e.message; } });

/* ---------------------------------------------------------------- device */
async function analyseHere() {
  $("devTable").innerHTML = "<tr><td>Analysing...</td></tr>";
  const raw = await collectBrowserFacts(); const a = analyseDevice(raw); const f = a.facts; const cache = readDeviceCache(localStorage, deviceSignature(f, DEVICE_MODEL_VERSION));
  const row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
  const sizes = TIER_ORDER.slice().reverse().map((t) => { const r = renderSizeFor(t, f.native.w, f.native.h, f.maxTexture || 8192); return `${t}: ${r.w}x${r.h}`; }).join(" &nbsp;|&nbsp; ");
  $("devTable").innerHTML = row("Graphics card", `${f.gpu} <b>(${a.gpuClass})</b>`) + row("Screen (native)", `${f.native.w} x ${f.native.h} (${f.screenW}x${f.screenH} at ${f.dpr}x)`) + row("Refresh rate", `${f.refreshHz} Hz`) + row("Memory / CPU cores", `${f.deviceMemory ?? "?"} GB / ${f.cores ?? "?"}`) + row("WebGL limits", `texture ${f.maxTexture}, MSAA ${f.maxSamples}x, anisotropy ${f.maxAniso}x`) + row("App type / operating system", (() => { const P = window.LQ_PLATFORM || {}; const kinds = { web: "website in a browser", pwa: "installed web app", capacitor: "Android / iOS app", electron: "desktop app" }; return `<b>${kinds[P.kind] || P.kind}</b> on <b>${P.os}</b>${P.phone ? " (phone)" : P.tablet ? " (tablet)" : ""}${P.standalone ? ", fullscreen app window" : ""}`; })()) + row("Offline / install", (() => { const A = window.LQ_PWA || {}; return A.supported ? `service worker ${A.registered ? "active" : "starting"}; ${A.installed ? "installed" : A.canInstall ? "can be installed (use Settings in the game)" : "install not offered by this browser right now"}` : "not available here (needs https or localhost; apps carry their own files)"; })()) + row("Server for accounts", (window.LQ_CONFIG && window.LQ_CONFIG.apiBase) || "this website itself") + row("Touch / mobile / battery", `${f.touch} / ${f.mobile} / ${f.battery ? Math.round(f.battery.level * 100) + "%" + (f.battery.charging ? " charging" : "") : "n/a"}`)
    + row("Highest level for this device", `<b>${a.cap}</b>`) + row("Safe starting level", `<b>${a.start}</b>`) + row("Game would draw at", sizes) + row("Saved measurement", cache ? `<b>${cache.tier}</b> (${(cache.probes || []).map((p) => `${p.tier} ${p.avgFps} fps${p.pass ? " ok" : " slow"}`).join(", ")}) on ${new Date(cache.date).toLocaleString()}` : "none yet: it is measured the first time you open the game");
  $("devReasons").textContent = a.reasons.join("\n");
}
$("devRun").addEventListener("click", analyseHere); $("devClear").addEventListener("click", () => { clearDeviceCache(localStorage); analyseHere(); });
document.querySelector('#tabs button[data-for="tab-device"]').addEventListener("click", analyseHere);

/* --------------------------------------------------------- server engine */
for (const s of listQuestionSubjects()) $("enSubj").appendChild(h(`<option value="${s}">${SUBJECTS[s] || s}</option>`));
const eng = async (path, body) => { const r = await fetch("/api/engine" + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`); return j; };
const enRow = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
const noBackend = () => { $("enTable").innerHTML = enRow("Backend", "not running: start START_EXPLORER_ALL.bat to use the server engine"); };
$("enStatus").addEventListener("click", async () => { try { const s = await eng("/status"); $("enTable").innerHTML = enRow("Active engine", `<b>${s.active}</b> (requested: ${s.requested})`) + enRow("Why", s.reason) + enRow("Python self-test", s.selfTest ? `${s.selfTest.cases} cases, ${s.selfTest.mismatches.length} differences` : "not run") + enRow("Calls so far", `JavaScript ${s.stats.js.calls} (avg ${s.stats.js.avgMs ?? "-"} ms) &middot; Python ${s.stats.python.calls} (avg ${s.stats.python.avgMs ?? "-"} ms, ${s.stats.python.errors} errors, ${s.stats.python.fallbacks} fallbacks)`) + enRow("Python paused", s.pythonPaused); } catch { noBackend(); } });
$("enDevice").addEventListener("click", async () => {
  try {
    const raw = await collectBrowserFacts(); const facts = { gpu: raw.gpu, screenW: raw.screenW, screenH: raw.screenH, dpr: raw.dpr, deviceMemory: raw.deviceMemory, cores: raw.cores, maxTexture: raw.maxTexture, refreshHz: raw.refreshHz, touch: raw.touch, mobile: raw.mobile, saveData: raw.saveData, battery: raw.battery };
    const srv = await eng("/device/analyse", { facts }); const loc = analyseDevice(raw); const same = srv.gpuClass === loc.gpuClass && srv.cap === loc.cap && srv.start === loc.start;
    $("enTable").innerHTML = enRow("Server engine used", `<b>${srv.engine}</b>`) + enRow("Server says", `${srv.gpuClass}, highest level <b>${srv.cap}</b>, safe start <b>${srv.start}</b>`) + enRow("This browser says", `${loc.gpuClass}, ${loc.cap}, ${loc.start}`) + enRow("Same answer?", same ? "<b>yes</b>" : "<b>NO</b>") + enRow("Game would draw at", Object.entries(srv.sizes).reverse().map(([t, s]) => `${t}: ${s.w}x${s.h}`).join(" | "));
  } catch (e) { $("enTable").innerHTML = enRow("Error", e.message); }
});
$("enBench").addEventListener("click", async () => { try { const b = await eng("/benchmark?n=300"); $("enTable").innerHTML = enRow("JavaScript, in the server process", `${b.perCallMs.js_ms_per_call} ms per question`) + enRow("Python worker (incl. pipe)", b.perCallMs.python_ms_per_call != null ? `${b.perCallMs.python_ms_per_call} ms per question` : "Python is not running") + enRow("Note", b.note); } catch (e) { $("enTable").innerHTML = enRow("Error", e.message); } });
$("enQs").addEventListener("click", async () => {
  try {
    const p = { seed: Number($("enSeed").value), subject: $("enSubj").value, level: Number($("enLevel").value) };
    const r = await eng(`/questions?seed=${p.seed}&subject=${p.subject}&level=${p.level}&from=0&count=5`); $("enMsg").textContent = `made by the ${r.engine} engine`; $("enQuestions").innerHTML = "";
    for (const q of r.questions) {
      const card = h(`<div class="card"><b>${q.index + 1}. ${q.text}</b><div class="row"></div><small></small></div>`);
      q.options.forEach((label, k) => card.querySelector(".row").appendChild(h(`<button>${label}</button>`)).addEventListener("click", async () => { const v = await eng("/verify", { ...p, index: q.index, chosenIndex: k }); card.querySelector("small").innerHTML = v.correct ? "<b>Correct</b> (checked by the server)" : `Wrong. The server says option ${v.correctIndex + 1}. ${v.explanation}`; }));
      $("enQuestions").appendChild(card);
    }
  } catch { noBackend(); }
});

status(); setInterval(() => { try { const p = new Profile(); $("bProfile").textContent = `profile: ${p.data.games} runs, ${p.data.totalCoins} coins`; } catch { /* ignore */ } }, 3000);
