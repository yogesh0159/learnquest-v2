import { MissionSystem } from "./game/learning/mission-system.js";

requireChildAuth();
const picker = document.getElementById("missionPicker");
const panel = document.getElementById("interactionPanel");
const scene = document.getElementById("worldScene");
const sceneArt = document.getElementById("sceneArt");
const caption = document.getElementById("sceneCaption");
const evidence = document.getElementById("evidence");
let pendingNext = null;
let focusedOption = 0;

const icons = { market: "🛒", bridge: "🌉", road_language: "🛣️" };
const sceneNames = { market: "scene-market", bridge: "scene-bridge", road: "scene-road" };

const system = new MissionSystem({
  apiClient: api,
  onRender: renderStep,
  onFeedback: showFeedback,
  onComplete: showComplete,
});

function updateEvidence(progress = {}) {
  evidence.innerHTML = `<span class="evidence-pill">Attempts ${progress.attempts || 0}</span><span class="evidence-pill">Correct ${progress.correct || 0}</span><span class="evidence-pill">Mistakes ${progress.mistakes || 0}</span>`;
}

function renderStep(snapshot) {
  if (!snapshot.step) return;
  pendingNext = null; focusedOption = 0;
  const { mission, step, progress, busy } = snapshot;
  scene.className = `world-scene ${sceneNames[mission.scene]}`;
  caption.textContent = `${mission.title} · ${step.skill.replaceAll("_", " ")}`;
  updateEvidence(progress);
  const pct = Math.round((progress.currentStep / progress.totalSteps) * 100);
  panel.innerHTML = `<div class="objective-label">Step ${progress.currentStep + 1} of ${progress.totalSteps} · ${mission.ageGroup}</div><div class="mission-progress"><span style="width:${pct}%"></span></div><h2>${step.prompt}</h2><div class="mission-options">${step.options.map((choice, index) => `<button class="mission-option" data-answer="${choice.id}" ${busy ? "disabled" : ""}>${choice.label}<span class="key-hint">Key ${index + 1}</span></button>`).join("")}</div><p class="muted" style="margin-top:12px">Every choice is recorded as learning evidence. Rewards and cosmetics cannot change the answer.</p>`;
  panel.querySelectorAll("[data-answer]").forEach((button) => { button.onclick = () => system.answer(button.dataset.answer); });
}

function showFeedback(result) {
  return new Promise((resolve) => {
    updateEvidence(result.progress);
    sceneArt.classList.remove("bump", "shake");
    void sceneArt.offsetWidth;
    sceneArt.classList.add(result.correct ? "bump" : "shake");
    panel.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    const feedback = document.createElement("div");
    feedback.className = `feedback-card ${result.correct ? "" : "wrong"}`;
    feedback.innerHTML = `<strong>${result.correct ? "✅ The world responds!" : `🌱 Try again · correct choice: ${result.correctAnswer}`}</strong><p>${result.explanation}</p><button class="btn btn-secondary btn-sm next-button">${result.completed ? "See evidence" : result.correct ? "Next part" : "Try this part again"}</button>`;
    panel.appendChild(feedback);
    pendingNext = () => { pendingNext = null; resolve(); };
    feedback.querySelector("button").onclick = pendingNext;
    feedback.querySelector("button").focus();
  });
}

function showComplete(result, snapshot) {
  updateEvidence(result.progress);
  sceneArt.classList.add("bump");
  caption.textContent = `${snapshot.mission.title} complete`;
  panel.innerHTML = `<div class="completion"><div class="trophy">🏆</div><div class="objective-label">Mission evidence saved</div><h2>Route complete!</h2><p>You solved ${result.progress.correct} world problems in ${result.progress.attempts} attempts, with ${result.progress.mistakes} learning ${result.progress.mistakes === 1 ? "mistake" : "mistakes"} explained.</p><button class="btn btn-primary" id="replayMission">Play this mission again</button></div>`;
  panel.querySelector("#replayMission").onclick = () => startMission(snapshot.mission.id);
}

async function startMission(id) {
  picker.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.mission === id));
  panel.innerHTML = `<div class="center">Loading world…</div>`;
  try { await system.start(id); } catch (error) { panel.innerHTML = `<div class="completion"><h2>Could not start</h2><p>${error.message}</p></div>`; }
}

document.addEventListener("keydown", (event) => {
  if (pendingNext && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); pendingNext(); return; }
  const buttons = [...panel.querySelectorAll(".mission-option:not(:disabled)")];
  if (!buttons.length) return;
  if (/^[1-3]$/.test(event.key)) { event.preventDefault(); buttons[Number(event.key) - 1]?.click(); return; }
  if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) {
    event.preventDefault(); focusedOption = (focusedOption + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length; buttons[focusedOption].focus();
  }
});

async function load() {
  try {
    const data = await api.missions();
    document.getElementById("ageCopy").textContent = `Built for age ${data.ageGroup}: choose a place, solve its real problem and watch the world respond. Your learning evidence is saved.`;
    picker.innerHTML = data.missions.map((mission) => `<button class="mission-choice" data-mission="${mission.id}"><span class="icon">${icons[mission.id]}</span><strong>${mission.title}</strong><small>${mission.objective}</small></button>`).join("");
    picker.querySelectorAll("button").forEach((button) => { button.onclick = () => startMission(button.dataset.mission); });
    await startMission(data.missions[0].id);
  } catch (error) { panel.innerHTML = `<div class="completion"><h2>Could not load missions</h2><p>${error.message}</p></div>`; }
}
load();
