/** Thin DOM HUD: only writes to the DOM when a value actually changes. */
import { t } from "./i18n.js";

export class Hud {
  constructor(doc = document) {
    const $ = (id) => doc.getElementById(id);
    this.el = {
      score: $("hudScore"), coins: $("hudCoins"), tokens: $("hudTokens"), distance: $("hudDistance"), hearts: $("hudHearts"),
      multi: $("hudMulti"), combo: $("hudCombo"), streak: $("hudStreak"), power: $("hudPower"), banner: $("questionBanner"), teacher: $("hudTeacher"), readBar: $("readBar"), readyBtn: $("readyBtn"), listenBtn: $("listenBtn"), readHint: $("readHint"), bannerText: $("questionText"), toast: $("toast"),
      loading: $("loadingScreen"), loadBar: $("loadBar"), loadText: $("loadText"), menu: $("menuScreen"), pause: $("pauseScreen"),
      over: $("gameOverScreen"), overStats: $("overStats"), error: $("errorBox"), errorText: $("errorText"), hud: $("hud"), best: $("bestScore"), loadDevice: $("loadDevice"), coach: $("coach"), coachText: $("coachText"), coachStep: $("coachStep"), overReview: $("overReview"), overAch: $("overAch"), menuStats: $("menuStats"),
    };
    this.last = {}; this.toastTimer = 0;
  }
  _set(key, el, value) { if (this.last[key] !== value && el) { el.textContent = value; this.last[key] = value; } }
  update(s) {
    this._set("score", this.el.score, String(Math.floor(s.score)));
    this._set("coins", this.el.coins, String(s.coins));
    this._set("tokens", this.el.tokens, String(s.tokens));
    this._set("distance", this.el.distance, `${Math.floor(s.distance)} m`);
    const hearts = "\u2764".repeat(Math.max(0, s.lives)) + "\u2661".repeat(Math.max(0, s.maxLives - s.lives));
    this._set("hearts", this.el.hearts, hearts);
    if (this.el.combo) { const on = s.combo >= 3; this._set("combo", this.el.combo, on ? t("hud.combo", { n: s.combo }) : ""); this.el.combo.hidden = !on; }
    if (this.el.streak) { const on = s.streak >= 2; this._set("streak", this.el.streak, on ? t("hud.streak", { n: s.streak }) : ""); this.el.streak.hidden = !on; }
    if (this.el.power) {
      const key = (s.power || []).map((p) => `${p.id}:${Math.ceil(p.left)}`).join("|");
      if (this.last.power !== key) {
        this.last.power = key; this.el.power.hidden = !key;
        this.el.power.innerHTML = (s.power || []).map((p) => `<span class="pw" style="--c:${p.color}">${p.icon} ${t(`pu.${p.id}.label`)} <b>${Math.ceil(p.left)}s</b></span>`).join("");
      }
    }
    if (this.el.multi) { const on = s.multiplier > 1; this._set("multi", this.el.multi, on ? t("hud.multi", { n: s.multiplier, s: Math.ceil(s.multiplierLeft) }) : ""); this.el.multi.hidden = !on; }
  }
  progress(p) {
    if (this.el.loadBar) this.el.loadBar.style.width = `${Math.round(p.fraction * 100)}%`;
    this._set("loadText", this.el.loadText, t("load.text", { label: p.label || t("load.assets"), pct: Math.round(p.fraction * 100) }));
  }
  show(name, on = true) { const e = this.el[name]; if (e) e.hidden = !on; }
  coach(text, step = "") { if (!this.el.coach) return; this.el.coach.hidden = !text; this.el.coachText.textContent = text || ""; if (this.el.coachStep) this.el.coachStep.textContent = step; }
  device(text) { if (this.el.loadDevice) this.el.loadDevice.textContent = text; }
  banner(text) { if (!this.el.banner) return; this.el.banner.hidden = !text; document.body.classList.toggle("has-question", !!text); this._set("banner", this.el.bannerText, text || ""); }
  /** "teacher is close" hint in the top bar */
  teacherChip(text) { const el = this.el.teacher; if (!el || this._tc === text) return; this._tc = text; el.hidden = !text; el.textContent = text || ""; }
  /** reading time: the banner grows to the middle of the screen with a countdown bar and a "Ready!" button */
  reading(on, frac = 0, hint = "", timed = true) {
    const b = this.el.banner; if (!b) return; b.classList.toggle("reading", !!on);
    if (this.el.readBar) { this.el.readBar.hidden = !on || !timed; this.el.readBar.firstElementChild.style.width = `${Math.round(frac * 100)}%`; }
    if (this.el.readyBtn) this.el.readyBtn.hidden = !on; if (this.el.listenBtn) this.el.listenBtn.hidden = !on;
    if (this.el.readHint) { this.el.readHint.hidden = !on; if (on && this._rh !== hint) { this._rh = hint; this.el.readHint.textContent = hint; } }
  }
  toast(text, kind = "good", ms = 1700) {
    const t = this.el.toast; if (!t) return;
    t.textContent = text; t.className = `toast ${kind}`; t.hidden = false;
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }
  error(message) { if (this.el.error) { this.el.error.hidden = false; this.el.errorText.textContent = message; } }
}
