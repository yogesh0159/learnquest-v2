import { FreePlays, FREE_PLAYS, backendReachable, accountUrl } from "./game/jungle-run/free-plays.js";
import { GameManager } from "./game/jungle-run/game-manager.js";
import { QUALITY } from "./game/jungle-run/config.js";
import { SUBJECTS, TRAILS } from "./game/jungle-run/profile.js";
import { ACHIEVEMENTS } from "./game/jungle-run/achievements.js";
import { buildReport } from "./game/jungle-run/report.js";
import { i18n, t, LANGS } from "./game/jungle-run/i18n.js";

const TAG = "[LearnQuest]";
const $ = (id) => document.getElementById(id);
const showFatal = (msg) => {
  console.error(`${TAG} FATAL: ${msg}`);
  const box = $("errorBox"); if (box) { box.hidden = false; $("errorText").textContent = msg; }
  const load = $("loadingScreen"); if (load) load.hidden = true;
};
window.addEventListener("error", (e) => console.error(`${TAG} Uncaught:`, e.message));
window.addEventListener("unhandledrejection", (e) => console.error(`${TAG} Unhandled rejection:`, e.reason?.message || e.reason));

async function main() {
  if (!document.createElement("canvas").getContext("webgl2")) { showFatal("This browser does not support WebGL 2. Please use a recent Chrome, Edge or Firefox."); return; }
  const game = new GameManager({ canvas: $("scene") });
  window.LQ_JUNGLE = game;
  try { await game.boot(); } catch (error) { showFatal(`${error.message}\nCheck that the local server is running and the asset files exist.`); return; }

  document.querySelectorAll("[data-character]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.character === game.characterKey);
    btn.addEventListener("click", async () => {
      await game.chooseCharacter(btn.dataset.character);
      document.querySelectorAll("[data-character]").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });
  // ---- three free runs without an account, then a parent account (and a child profile) -------------------------------
  const fp = new FreePlays();
  const paintFree = () => { const el = $("freeLeft"); if (!el) return; el.hidden = !fp.limited; if (fp.limited) el.textContent = t(fp.left > 0 ? "free.left" : "free.none", { n: fp.left, max: FREE_PLAYS }); };
  const showGate = () => new Promise(async (resolve) => {
    const apiBase = (window.LQ_CONFIG && window.LQ_CONFIG.apiBase) || ""; const server = await backendReachable(apiBase);
    const box = document.createElement("div"); box.id = "freeGate"; box.className = "screen"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    const url = accountUrl(apiBase); const childUrl = `${apiBase}${apiBase ? "/" : ""}child-login.html`;
    box.innerHTML = `<div class="card"><h1>${t("free.title")}</h1><p>${t(server ? "free.body" : "free.noserver", { max: FREE_PLAYS })}</p>${server
      ? `<a class="primary btn" href="${url}">${t("free.parent")}</a><p class="small"><a href="${childUrl}">${t("free.child")}</a></p><p class="small" id="freeCount"></p>`
      : `<button class="primary" id="freeGuest">${t("free.guest")}</button><p class="small"><a href="index.html">${t("menu.home")}</a></p>`}</div>`;
    document.body.appendChild(box); game.audio?.play?.("question");
    if (server) { let s = 4; const c = box.querySelector("#freeCount"); const tick = () => { c.textContent = t("free.redirect", { s }); if (s-- <= 0) location.href = url; else box._t = setTimeout(tick, 1000); }; tick(); box.querySelector("a.primary").addEventListener("click", () => clearTimeout(box._t)); resolve(false); }
    else box.querySelector("#freeGuest").addEventListener("click", () => { box.remove(); resolve(true); });
  });
  game.playGate = async () => { if (fp.canPlay()) { fp.record(); paintFree(); return true; } return showGate(); };
  paintFree(); game.events.addEventListener("menu", () => { paintFree(); document.body.classList.remove("has-question"); });
  $("playBtn").addEventListener("click", () => game.requestStart());
  $("coachSkip").addEventListener("click", () => game.skipTutorial());
  $("againBtn").addEventListener("click", () => game.requestStart());
  $("menuBtn")?.addEventListener("click", () => game.toMenu()); $("menuBtn2")?.addEventListener("click", () => game.toMenu()); $("readyBtn")?.addEventListener("click", () => game.skipReading());
  $("resumeBtn").addEventListener("click", () => game.resume());
  $("pauseBtn")?.addEventListener("click", () => game.togglePause());
  $("labBtn")?.addEventListener("click", () => game.toggleLab());

  // ---- Settings & rewards (menu) -----------------------------------------------------------------------------------
  const settingsBody = $("settingsBody");
  const deviceHtml = () => {
    const d = game.deviceInfo(); const c = d.calibration;
    const row = (k, v) => `<tr><th>${t(k)}</th><td>${v}</td></tr>`;
    return `<details class="adv"><summary>${t("dev.title")}</summary><table class="devtable">${row("dev.gpu", `${d.gpu.replace(/^ANGLE \((.*)\)$/, "$1").slice(0, 60)}`)}${row("dev.screen", `${d.native.w}x${d.native.h}`)}${row("dev.refresh", `${d.refreshHz} Hz`)}${row("dev.ram", d.ram ? `${d.ram} GB` : "?")}${row("dev.cores", d.cores || "?")}${row("dev.limit", t(`gfx.${d.cap}`))}${row("dev.draws", `${d.renderW}x${d.renderH} (${t(`gfx.${d.tier}`)})`)}</table>
      <small>${c && c.date ? t("dev.measured", { date: new Date(c.date).toLocaleDateString() }) + ": " + (c.probes || []).map((p) => `${t(`gfx.${p.tier}`).split(" (")[0]} ${p.avgFps} fps`).join(" \u00b7 ") : t("dev.notyet")}</small>
      <div class="row"><button data-act="retest">${t("dev.retest")}</button></div></details>`;
  };
  /* ---- app: install / offline pack / update (js/pwa.js) ---- */
  let offline = null; let dl = null;
  const refreshOffline = () => (window.LQ_PWA?.offlineStatus ? window.LQ_PWA.offlineStatus().then((s) => { offline = s; if (settingsBody.isConnected) renderSettings(); }) : null);
  const appHtml = () => {
    const A = window.LQ_PWA || {}, P = window.LQ_PLATFORM || {}; if (!A.supported && P.kind !== "web") return "";
    const mb = offline?.bytesTotal ? Math.round(offline.bytesTotal / 1e6) : 55; const rows = [];
    if (A.updateReady) rows.push(`<div class="row"><b>${t("app.update")}</b><button data-act="update" class="primary">${t("app.update.btn")}</button></div>`);
    if (A.installed || P.standalone) rows.push(`<div class="row"><small>\u2705 ${t("app.installed")}</small></div>`);
    else if (A.canInstall) rows.push(`<div class="row"><button data-act="install" class="primary">${t("app.install")}</button></div>`);
    else if (A.iosHint) rows.push(`<div class="row"><small>${t("app.ios")}</small></div>`);
    if (A.supported) {
      if (dl) rows.push(`<div class="row"><small>${t("app.offline.progress", { done: dl.done, total: dl.total })}</small><progress max="${dl.total}" value="${dl.done}"></progress></div>`);
      else if (offline?.complete) rows.push(`<div class="row"><small>\u2705 ${t("app.offline.ready", { mb })}</small></div>`);
      else if (offline?.supported) rows.push(`<div class="row"><button data-act="offline">${t("app.offline.get", { mb })}</button><small>${offline.cached}/${offline.total}</small></div>`);
      else if (offline && !offline.supported) rows.push(`<div class="row"><small>${t("app.offline.none")}</small></div>`);
    }
    return rows.length ? `<div class="appbox"><h4>${t("app.title")} \u00b7 ${t("app.offline")}</h4>${rows.join("")}</div>` : "";
  };
  const advice = (r) => t(r.adviceKey, { ...r.adviceVars, subject: r.adviceVars.id ? t(`subj.${r.adviceVars.id}`) : "" });
  const reportHtml = () => {
    const r = buildReport(game.profile.data); const s = r.totals;
    return `<div class="rep-advice">${advice(r)}</div>` + r.rows.map((x) => `<div class="rep-row"><span>${t(`subj.${x.id}`)}</span><span class="rep-bar"><i style="width:${x.accuracy ?? 0}%"></i></span><span>${x.accuracy == null ? "-" : x.accuracy + "%"} <small>(${x.total})</small></span></div>`).join("")
      + `<small>${t("rep.summary", { games: s.games, q: s.questions, acc: s.accuracy ?? "-", streak: s.bestStreak, best: s.best })}</small>`;
  };
  const printReport = () => {
    const r = buildReport(game.profile.data); const s = r.totals;
    $("printReport").innerHTML = `<h1>${t("pr.title")}</h1><p>${t("pr.line", { date: new Date().toLocaleDateString(), games: s.games, coins: s.coins, best: s.best, dist: s.bestDistance, ach: s.achievements })}</p>
      <table><tr><th>${t("pr.subject")}</th><th>${t("pr.right")}</th><th>${t("pr.wrong")}</th><th>${t("pr.acc")}</th></tr>${r.rows.map((x) => `<tr><td>${t(`subj.${x.id}`)}</td><td>${x.right}</td><td>${x.wrong}</td><td>${x.accuracy == null ? "-" : x.accuracy + "%"}</td></tr>`).join("")}</table>
      <p><b>${t("pr.advice")}:</b> ${advice(r)} ${r.strongestId ? t("pr.strong", { s: t(`subj.${r.strongestId}`) }) : ""}</p><p>${t("pr.overall", { q: s.questions, acc: s.accuracy ?? "-" })}</p>`;
    window.print();
  };
  const renderSettings = () => {
    const p = game.profile, st = p.settings, d = p.data; const unlocked = ACHIEVEMENTS.filter((a) => d.achievements[a.id]).length;
    settingsBody.innerHTML = `
      <h4>${t("set.class")}</h4><div class="row">${[1, 2, 3].map((g) => `<button data-grade="${g}" class="${st.grade === g ? "on" : ""}">${t("set.grade", { n: g })}</button>`).join("")}</div>
      <h4>${t("set.subjects")}</h4><div class="row">${Object.keys(SUBJECTS).map((id) => `<button data-subject="${id}" class="${st.subjects.includes(id) ? "on" : ""}">${t(`subj.${id}`)}</button>`).join("")}</div>
      <h4>${t("set.help")}</h4>
      <label><input type="checkbox" data-opt="tts" ${st.tts ? "checked" : ""} ${game.speaker.supported ? "" : "disabled"} /> ${t("set.tts")} ${game.speaker.supported ? "" : t("set.tts.no")}</label>
      <label><input type="checkbox" data-opt="reducedMotion" ${game.reducedMotion ? "checked" : ""} /> ${t("set.motion")}</label>
      <label><input type="checkbox" data-opt="bigText" ${st.bigText ? "checked" : ""} /> ${t("set.bigtext")}</label>
      <label>${t("set.readtime")} <select data-opt="readTime">${["off", "short", "normal", "long"].map((v) => `<option value="${v}" ${(st.readTime || "normal") === v ? "selected" : ""}>${t("read." + v)}</option>`).join("")}</select></label>
      <label><input type="checkbox" data-opt="teacherChase" ${st.teacherChase !== false ? "checked" : ""} /> ${t("teacher.setting")}</label>
      <h4>${t("set.graphics")} <small>${t("gfx.now", { tier: t(`gfx.${game.qualityId}`) })}</small></h4>
      <div class="row">${["auto", "ultra", "high", "balanced", "low", "minimal"].map((v) => `<button data-gfx="${v}" class="${(st.graphics || "auto") === v ? "on" : ""}">${t(`gfx.${v}`)}</button>`).join("")}</div>
      ${deviceHtml()}${appHtml()}
      <h4>${t("set.trail")} <small>${t("set.trail.hint", { n: d.totalCoins })}</small></h4>
      <div class="row">${TRAILS.map((x) => { const ok = p.trailUnlocked(x.id); return `<button data-trail="${x.id}" class="${st.trail === x.id ? "on" : ""} ${ok ? "" : "locked"}" ${ok ? "" : "disabled"}>${ok ? "" : "\u{1F512} "}${t(`trail.${x.id}`)}${ok || !x.cost ? "" : " (" + x.cost + ")"}</button>`; }).join("")}</div>
      <h4>${t("set.report")}</h4>${reportHtml()}
      <div class="row"><button data-act="print">${t("set.print")}</button><button data-act="tutorial">${t("set.tutorial")}</button><button data-act="reset" class="danger">${t("set.reset")}</button></div>
      <h4>${t("set.ach", { a: unlocked, b: ACHIEVEMENTS.length })}</h4>
      <div class="ach-grid">${ACHIEVEMENTS.map((a) => `<div class="ach-card ${d.achievements[a.id] ? "" : "locked"}"><b>${a.icon} ${t(`ach.${a.id}.t`)}</b>${t(`ach.${a.id}.d`)}</div>`).join("")}</div>`;
  };
  settingsBody.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return; game.audio.play("click");
    if (b.dataset.act === "print") return printReport();
    if (b.dataset.act === "install") { window.LQ_PWA.install().then(renderSettings); return; }
    if (b.dataset.act === "update") { window.LQ_PWA.applyUpdate(); return; }
    if (b.dataset.act === "offline") { dl = { done: 0, total: offline?.total || 15 }; renderSettings(); window.LQ_PWA.downloadOffline((p) => { dl = p; renderSettings(); }).then(() => { dl = null; return refreshOffline(); }).catch(() => { dl = null; game.hud.toast(t("app.offline.err"), "bad", 3500); renderSettings(); }); return; }
    if (b.dataset.act === "retest") { b.disabled = true; b.textContent = t("dev.retesting"); game.retestDevice().finally(renderSettings); return; }
    if (b.dataset.act === "tutorial") { game.profile.resetTutorial(); b.textContent = t("set.tutorial.done"); return; }
    if (b.dataset.act === "reset") { if (confirm(t("set.reset.confirm"))) { game.profile.resetAll(); game.applyAccessibility(); game.setLanguage(""); game.refreshMenuStats(); } return; }
    if (b.dataset.grade) game.setSetting("grade", Number(b.dataset.grade));
    else if (b.dataset.subject) { game.profile.toggleSubject(b.dataset.subject); }
    else if (b.dataset.trail) game.setSetting("trail", b.dataset.trail);
    else if (b.dataset.gfx) game.setGraphics(b.dataset.gfx);
    renderSettings();
  });
  settingsBody.addEventListener("change", (e) => { const o = e.target.dataset.opt; if (o) { game.setSetting(o, e.target.type === "checkbox" ? e.target.checked : e.target.value); renderSettings(); } });
  game.events.addEventListener("profile-changed", renderSettings);

  // ---- Language (English / Hindi / Marathi) --------------------------------------------------------------------------
  const paintLang = () => document.querySelectorAll("[data-lang]").forEach((b) => b.classList.toggle("active", b.dataset.lang === i18n.lang));
  document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => { game.audio.play("click"); game.setLanguage(b.dataset.lang); }));
  const paintQuality = () => { const rs = game.renderSizePx || {}; $("qualityBadge").textContent = t("menu.quality", { tier: t(`gfx.${game.qualityId}`), w: rs.w || "?", h: rs.h || "?" }); };
  game.events.addEventListener("language-changed", () => { paintLang(); paintQuality(); renderSettings(); });
  game.events.addEventListener("quality-changed", () => { paintQuality(); });
  game.events.addEventListener("graphics-changed", () => { paintQuality(); renderSettings(); });
  window.addEventListener("resize", paintQuality);
  i18n.apply(document); paintLang(); paintQuality(); renderSettings();
  window.addEventListener("lq-pwa", () => renderSettings()); refreshOffline();
  const fs = $("fsBtn"); if (fs && game.lifecycle?.fullscreenAvailable && !(window.LQ_PLATFORM && window.LQ_PLATFORM.phone)) { fs.hidden = false; fs.addEventListener("click", () => game.lifecycle.toggleFullscreen()); }

  // ---- Lab panel: character viewer + world/audio tools -------------------------------------------------------------
  const speed = $("labSpeed"); speed?.addEventListener("input", () => { game.speedMultiplier = Number(speed.value); $("labSpeedVal").textContent = `x${Number(speed.value).toFixed(1)}`; });
  $("labQuality")?.addEventListener("change", (e) => game._applyQuality(QUALITY[e.target.value] || game.quality));
  $("labClose").addEventListener("click", () => game.toggleLab());
  const fillClips = () => {
    const sel = $("labClip"); sel.innerHTML = "";
    for (const c of game.labClips()) { const o = document.createElement("option"); o.value = c.name; o.textContent = `${c.name}  (${c.duration}s)${c.aliases.length ? "  \u2192 " + c.aliases.join(" / ") : ""}`; sel.appendChild(o); }
    const run = [...sel.options].find((o) => /^running$/i.test(o.value)); if (run) sel.value = run.value;
    const r = game.labRigInfo();
    $("labRig").textContent = [`${game.labCharacters().find((c) => c.active)?.label}  |  ${r.triangles?.toLocaleString()} tris  |  ${r.heightM} m tall  |  ${r.clips} clips`, `file: ${r.file}`, `root bone: ${r.rootBone}`,
      ...(r.rootMotion || []).filter((m) => Math.abs(m.netBefore[0]) + Math.abs(m.netBefore[2]) > 0.05).map((m) => `${m.alias.padEnd(7)} ${m.clip}: root drift x ${m.netBefore[0]}  z ${m.netBefore[2]} m  ->  removed`)].join("\n");
  };
  const fillChars = () => {
    const box = $("labChars"); box.innerHTML = "";
    for (const c of game.labCharacters()) {
      const b = document.createElement("button"); b.textContent = c.label; b.classList.toggle("active", c.active);
      b.addEventListener("click", async () => { await game.labSelectCharacter(c.key); fillChars(); fillClips(); document.querySelectorAll("[data-character]").forEach((x) => x.classList.toggle("active", x.dataset.character === c.key)); });
      box.appendChild(b);
    }
  };
  const playClip = () => game.labPlay($("labClip").value, { loop: $("labLoop").checked, timeScale: Number($("labClipSpeed").value), original: $("labOrigRoot").checked });
  $("labPlayClip").addEventListener("click", playClip); $("labClip").addEventListener("change", playClip); $("labOrigRoot").addEventListener("change", playClip);
  $("labClipSpeed").addEventListener("input", (e) => { $("labClipSpeedVal").textContent = `x${Number(e.target.value).toFixed(1)}`; game.player.anim?.setTimeScale(Number(e.target.value)); });
  $("labStopClip").addEventListener("click", () => game.labStop());
  document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => game.labView(b.dataset.view)));
  fillChars(); fillClips();
  const sound = $("soundBtn");
  const paintSound = () => { sound.innerHTML = game.audio.muted ? "&#128263;" : "&#128266;"; sound.classList.toggle("off", game.audio.muted); };
  sound.addEventListener("click", () => { game.audio.toggleMute(); sound.blur(); });
  sound.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") e.stopPropagation(); });
  game.audio.onChange(paintSound); paintSound();
  $("labMusic")?.addEventListener("input", (e) => game.audio.setVolume("music", Number(e.target.value)));
  $("labSfx")?.addEventListener("input", (e) => game.audio.setVolume("sfx", Number(e.target.value)));
  for (const id of ["playBtn", "againBtn", "resumeBtn"]) $(id).addEventListener("click", () => game.audio.play("click"));
  game.labEl = { update: () => { if (!document.body.classList.contains("lab")) return; const s = game.snapshot(); $("labStats").textContent = `FPS ${s.fps} | draw calls ${s.render.calls} | tris ${s.render.triangles.toLocaleString()} | geo ${s.render.geometries} | tex ${s.render.textures} | recycled ${s.segmentsRecycled} | tier ${s.quality}`; } };
  if (game.lab) { game.lab = false; game.toggleLab(); }
  const q = new URLSearchParams(location.search);
  if (q.get("autostart") === "1") game.start();
}
main();
