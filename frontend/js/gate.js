/**
 * openGateModal(level, onComplete)
 * level: a jungleLevels row from /api/child/me (has is_boss, boss_hp, questions_required, gate_subject_id)
 * onComplete(resultFromServer): called after the child passes or exhausts attempts and closes the modal
 */
async function openGateModal(level, onComplete) {
  const isBoss = level.is_boss === 1;
  const requiredCorrect = isBoss ? level.boss_hp : level.questions_required;
  const fetchCount = isBoss ? level.boss_hp + 3 : level.questions_required;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal" id="gateModal"><div class="center" style="padding:40px 0;">${t("common_loading")}</div></div>`;
  document.body.appendChild(backdrop);

  let questions = [];
  try {
    const res = await api.questions(level.gate_subject_id, fetchCount);
    questions = res.questions;
  } catch (e) {
    backdrop.querySelector(".modal").innerHTML = `<p>${e.message}</p><button class="btn btn-secondary" id="closeErr">${t("common_close")}</button>`;
    backdrop.querySelector("#closeErr").onclick = () => backdrop.remove();
    return;
  }

  const modal = backdrop.querySelector("#gateModal");
  const answers = []; // { questionId, selectedIndex }
  let qi = 0;
  let correctSoFar = 0;
  let finished = false;

  function bossHpBar() {
    if (!isBoss) return "";
    const remaining = Math.max(0, level.boss_hp - correctSoFar);
    const hearts = "❤️".repeat(remaining) + "🖤".repeat(level.boss_hp - remaining);
    return `<div class="center" style="margin-bottom:10px;"><div style="font-weight:700;font-family:var(--font-display);">${t("boss_hp_label")}</div><div style="font-size:1.4rem;">${hearts}</div></div>`;
  }

  function renderQuestion() {
    if (finished) return;
    if (isBoss && correctSoFar >= requiredCorrect) return finish(true);
    if (qi >= questions.length) return finish(correctSoFar >= requiredCorrect);

    const q = questions[qi];
    const dots = questions.map((_, i) => {
      const cls = i < qi ? "done" : i === qi ? "current" : "";
      return `<div class="dot ${cls}"></div>`;
    }).join("");

    modal.innerHTML = `
      ${bossHpBar()}
      <div class="gate-header">
        <span class="lock-emoji">${isBoss ? "👹" : "🔒"}</span>
        <h3 style="margin:0;">${isBoss ? t("boss_title") : t("gate_title")}</h3>
      </div>
      <p class="muted" style="margin-bottom:14px;">${t("gate_instruction")}</p>
      ${isBoss ? "" : `<div class="progress-dots">${dots}</div>`}
      <div style="font-weight:700; font-size:1.1rem; margin-bottom:14px; font-family:var(--font-display); color:var(--canopy-dark);">${q.question}</div>
      <div id="optionsWrap"></div>
      <div id="feedbackWrap"></div>
    `;

    const optionsWrap = modal.querySelector("#optionsWrap");
    q.options.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = opt;
      btn.onclick = () => submitAnswer(q, idx, btn, optionsWrap);
      optionsWrap.appendChild(btn);
    });
  }

  async function submitAnswer(q, idx, btn, optionsWrap) {
    optionsWrap.querySelectorAll("button").forEach((b) => (b.disabled = true));
    btn.classList.add("selected");
    answers.push({ questionId: q.id, selectedIndex: idx });

    // We don't know correctness client-side (server withholds it) until final
    // submission, but for a responsive per-question feel in the boss fight /
    // gate we do a lightweight local check using a same-request pattern:
    // send this single answer immediately via the same gate endpoint isn't
    // ideal, so instead we optimistically move on and reveal correctness
    // using the authoritative server result once the whole set is submitted.
    qi += 1;
    optionsWrap.insertAdjacentHTML("beforeend", `<div class="center muted" style="margin-top:8px;">${t("common_loading")}</div>`);
    setTimeout(() => renderQuestion(), 350);
  }

  async function finish(localGuessPassed) {
    finished = true;
    modal.innerHTML = `<div class="center" style="padding:30px 0;">${t("common_loading")}</div>`;
    try {
      const result = await api.gateAttempt({ levelId: level.id, answers, runCoins: Number(level.run_coins || 0) });
      showResult(result);
    } catch (e) {
      modal.innerHTML = `<p>${e.message}</p><button class="btn btn-secondary" id="closeErr2">${t("common_close")}</button>`;
      modal.querySelector("#closeErr2").onclick = () => { backdrop.remove(); };
    }
  }

  function showResult(result) {
    correctSoFar = result.correctCount;
    const wrongExplanations = result.results.filter((r) => !r.correct);
    modal.innerHTML = `
      <div class="center">
        <div style="font-size:2.4rem;">${result.passed ? "🔓" : "🌱"}</div>
        <h2>${result.passed ? t("gate_passed_title") : t("gate_failed_title")}</h2>
        <p class="muted">${result.correctCount} / ${result.results.length} — +${result.xpEarned} XP, +${result.coinsEarned} ${t("dashboard_coins")}</p>
        ${!result.passed ? `<p>${t("gate_failed_body")}</p>` : ""}
      </div>
      ${wrongExplanations.length ? `<div class="explanation-box">${wrongExplanations.map(w => w.explanation).join("<br>")}</div>` : ""}
      <div class="center mt-24" style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
        ${!result.passed ? `<button class="btn btn-primary" id="retryBtn">${t("gate_retry")}</button>` : ""}
        <button class="btn btn-secondary" id="doneBtn">${result.passed ? t("gate_continue") : t("gate_back_to_map")}</button>
      </div>
    `;
    modal.querySelector("#doneBtn").onclick = () => {
      backdrop.remove();
      onComplete(result);
    };
    const retryBtn = modal.querySelector("#retryBtn");
    if (retryBtn) {
      retryBtn.onclick = () => {
        backdrop.remove();
        openGateModal(level, onComplete);
      };
    }
  }

  renderQuestion();
}
