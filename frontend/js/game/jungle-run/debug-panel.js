/** F9 (or ?tools=1): hands-on test tools. Only changes the running game / local profile, never the code. */
export class DebugPanel {
  constructor({ game }) {
    this.game = game; this.el = null; this.timer = null;
    window.addEventListener("keydown", (e) => { if (e.key === "F9") { e.preventDefault(); this.toggle(); } });
  }
  toggle() { this.el && !this.el.hidden ? this.close() : this.open(); }
  close() { if (this.el) this.el.hidden = true; clearInterval(this.timer); }
  open() {
    if (!this.el) this._build();
    this.el.hidden = false; this._status(); clearInterval(this.timer); this.timer = setInterval(() => this._status(), 400);
  }
  _build() {
    const g = this.game; const el = this.el = document.createElement("aside"); el.id = "debugPanel";
    const btn = (label, fn, cls = "") => { const b = document.createElement("button"); b.textContent = label; b.className = cls; b.addEventListener("click", (e) => { e.stopPropagation(); fn(b); b.blur(); }); return b; };
    const group = (title, ...items) => { const d = document.createElement("div"); d.className = "dg"; const h = document.createElement("h5"); h.textContent = title; d.append(h, ...items); el.appendChild(d); return d; };
    const head = document.createElement("div"); head.className = "dh"; head.innerHTML = "<b>Test tools</b> <small>F9 to hide</small>"; head.appendChild(btn("\u2715", () => this.close())); el.appendChild(head);
    this.status = document.createElement("pre"); this.status.className = "ds"; el.appendChild(this.status);
    group("Run control", btn("Start / restart run", () => g.start()), btn("God mode: off", (b) => { g.god = !g.god; b.textContent = `God mode: ${g.god ? "ON" : "off"}`; }),
      btn("+1 life", () => { g.stats.lives = Math.min(g.stats.maxLives + 4, g.stats.lives + 1); }), btn("Lives = 5", () => { g.stats.maxLives = Math.max(5, g.stats.maxLives); g.stats.lives = 5; }), btn("End run (game over)", () => { g.stats.lives = 0; g.player.die(); g.dying = 0.3; }));
    group("Speed", ...[0.5, 1, 1.5, 2].map((m) => btn(`x${m}`, () => { g.speedMultiplier = m; })));
    group("Power-ups", ...["magnet", "shield", "slowmo", "double"].map((id) => btn(id, () => { g.power.give(id); g.hud.toast(`Power-up: ${id}`, "gold", 1200); g.audio.play("powerup"); })), btn("clear", () => g.power.reset()));
    group("Put in front of me", ...[["coins ×6", "coin"], ["coins (3 lanes)", "coins"], ["Golden Enigma", "enigma"], ["rock (jump)", "rock"], ["beam (slide)", "beam"]].map(([l, k]) => btn(l, () => g.devSpawn(k))));
    const sel = document.createElement("select"); for (const s of ["mixed", "math", "patterns", "spelling", "science", "shapes"]) { const o = document.createElement("option"); o.value = s; o.textContent = s; sel.appendChild(o); }
    group("Question board", sel, btn("Board soon", () => g.forceQuestion(sel.value)), btn("Fast-forward 8 s (safe)", () => { const inv = g.player.invulnerable; g.player.invulnerable = 1e9; g.advance(8); g.player.invulnerable = inv; }));
    group("World", ...["Day", "Sunset", "Night", "Dawn"].map((n, i) => btn(n, () => g.setBiome(i))), btn("+300 m", () => { g.stats.distance += 300; }), btn("Teacher: run up close", () => { g.teacher.brain.state = "close"; g.teacher.brain.closeLeft = 20; }), btn("Teacher grabs me", () => { g.teacher.brain.grace = 0; g.teacher.brain.state = "close"; g.teacher.onHit("debug"); }));
    group("Profile (this browser)", btn("Unlock everything", () => g.unlockEverything()), btn("+1000 coins", () => { g.profile.data.totalCoins += 1000; g.profile.save(); g.refreshMenuStats(); }), btn("Replay tutorial next run", () => g.profile.resetTutorial()));
    group("Views", btn("Lab view (F2)", () => g.toggleLab()), btn("Sound on/off (M)", () => g.audio.toggleMute()));
    document.body.appendChild(el);
  }
  _status() {
    const s = this.game.snapshot();
    this.status.textContent = `${s.state} | ${s.character} | lives ${s.lives} | ${s.speed} m/s | ${Math.round(s.distance)} m\nbiome ${s.biome} | power ${s.power.join(",") || "-"} | combo ${s.combo}\nFPS ${s.fps} | calls ${s.render.calls} | tris ${(s.render.triangles / 1e6).toFixed(2)}M`;
  }
}
