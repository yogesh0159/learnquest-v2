// Chooses and supervises the engine provider.
//   ENGINE_PROVIDER = auto (default: Python if it starts and passes the self-test, else JavaScript) | python | js
// Safety: the JavaScript engine is always loaded. Every Python answer used at start-up is compared with it; a worker that is missing,
// slow, crashing or wrong is switched off (circuit breaker) and requests are answered by JavaScript, so the API never depends on Python.
const js = require("./js-provider");
const { PythonProvider } = require("./python-provider");

const SELF_TEST = [
  { method: "question.at", params: { seed: 42, index: 3, subject: "math", level: 2 } }, { method: "question.at", params: { seed: 7, index: 0, subject: "spelling", level: 3 } },
  { method: "question.at", params: { seed: 4294967295, index: 9, subject: "science", level: 4 } }, { method: "question.at", params: { seed: -5, index: 2, subject: "patterns", level: 3 } },
  { method: "question.at", params: { seed: 123456, index: 1, subject: "compare", level: 2 } }, { method: "question.at", params: { seed: 1, index: 4, subject: "shapes", level: 1 } },
  { method: "question.verify", params: { seed: 42, index: 3, subject: "math", level: 2, chosenIndex: 1 } },
  { method: "device.analyse", params: { facts: { gpu: "ANGLE (NVIDIA, NVIDIA GeForce GT 730 Direct3D11)", screenW: 1920, screenH: 1080, dpr: 1, deviceMemory: 16, cores: 16 } } },
  { method: "device.analyse", params: { facts: { gpu: "ANGLE (Intel, Intel(R) HD Graphics 520)", screenW: 1280, screenH: 720, dpr: 1.65, deviceMemory: 8, cores: 4, maxTexture: 16384 } } },
  { method: "device.calibrate", params: { start: "high", cap: "ultra", probes: { high: { frames: 60, avgFps: 60, p95Ms: 18 }, ultra: { frames: 60, avgFps: 31, p95Ms: 40 } } } },
];

class EngineService {
  constructor({ provider = process.env.ENGINE_PROVIDER || "auto", logger = console, failureLimit = 3, cooldownMs = 60000 } = {}) {
    this.wanted = provider; this.logger = logger; this.failureLimit = failureLimit; this.cooldownMs = cooldownMs;
    this.python = null; this.active = "js"; this.reason = ""; this.failures = 0; this.pausedUntil = 0; this.selfTest = null;
    this.stats = { js: { calls: 0, ms: 0, errors: 0 }, python: { calls: 0, ms: 0, errors: 0, fallbacks: 0 } };
    this.ready = null;
  }

  init() { return (this.ready ||= this._init()); }

  async _init() {
    await js.start();
    if (this.wanted === "js") { this.reason = "ENGINE_PROVIDER=js"; return this.status(); }
    try {
      this.python = new PythonProvider({ logger: this.logger });
      const info = await this.python.start();
      const mismatches = [];
      for (const t of SELF_TEST) { const a = JSON.stringify(await js.call(t.method, t.params)); const b = JSON.stringify(await this.python.call(t.method, t.params)); if (a !== b) mismatches.push(t.method); }
      this.selfTest = { cases: SELF_TEST.length, mismatches };
      if (mismatches.length) throw new Error(`self-test: Python differs from JavaScript on ${mismatches.join(", ")}`);
      this.active = "python"; this.reason = `Python ${info.python} (${info.exe}) passed ${SELF_TEST.length} self-test cases`;
    } catch (e) {
      this.active = "js"; this.reason = `Python not used: ${e.message}`; await this.python?.stop(); this.python = null;
      if (this.wanted === "python") this.logger.warn?.(`[engine] ENGINE_PROVIDER=python but ${this.reason}; using JavaScript`);
    }
    this.logger.info?.(`[engine] active: ${this.active} - ${this.reason}`);
    return this.status();
  }

  async call(method, params = {}) {
    await this.init();
    if (this.active === "python" && Date.now() >= this.pausedUntil) {
      const t0 = process.hrtime.bigint();
      try { const r = await this.python.call(method, params); this.stats.python.calls++; this.stats.python.ms += Number(process.hrtime.bigint() - t0) / 1e6; this.failures = 0; return r; }
      catch (e) {
        if (/^(ValueError|KeyError|TypeError)/.test(e.message)) { this.stats.python.errors++; throw e; }         // a bad request, not a broken worker
        this.stats.python.errors++; this.stats.python.fallbacks++; this.failures++;
        this.logger.warn?.(`[engine] Python failed (${e.message}); answering with JavaScript`);
        if (this.failures >= this.failureLimit) { this.pausedUntil = Date.now() + this.cooldownMs; this.logger.warn?.(`[engine] Python paused for ${this.cooldownMs / 1000}s`); this._restartLater(); }
      }
    }
    const t0 = process.hrtime.bigint();
    try { return await js.call(method, params); } finally { this.stats.js.calls++; this.stats.js.ms += Number(process.hrtime.bigint() - t0) / 1e6; }
  }

  _restartLater() {
    setTimeout(async () => { try { await this.python?.stop(); const p = new PythonProvider({ logger: this.logger }); await p.start(); this.python = p; this.failures = 0; this.pausedUntil = 0; this.logger.info?.("[engine] Python restarted"); } catch (e) { this.logger.warn?.(`[engine] Python restart failed: ${e.message}`); this.active = "js"; this.reason = `Python stopped: ${e.message}`; } }, this.cooldownMs).unref?.();
  }

  status() {
    const avg = (s) => (s.calls ? +(s.ms / s.calls).toFixed(3) : null);
    return { requested: this.wanted, active: this.active, reason: this.reason, pythonPaused: Date.now() < this.pausedUntil, selfTest: this.selfTest, languages: { javascript: true, python: !!this.python, java: false },
      stats: { js: { calls: this.stats.js.calls, avgMs: avg(this.stats.js) }, python: { calls: this.stats.python.calls, avgMs: avg(this.stats.python), errors: this.stats.python.errors, fallbacks: this.stats.python.fallbacks } } };
  }

  /** Time the same request through each provider that is running (for the benchmark endpoint / tests). */
  async benchmark(n = 200) {
    await this.init(); const params = { seed: 42, index: 0, subject: "math", level: 2 }; const out = {};
    const time = async (p) => { for (let i = 0; i < 20; i++) await p.call("question.at", { ...params, index: i }); const t0 = process.hrtime.bigint(); for (let i = 0; i < n; i++) await p.call("question.at", { ...params, index: i }); return +(Number(process.hrtime.bigint() - t0) / 1e6 / n).toFixed(4); };
    out.js_ms_per_call = await time(js); if (this.python) out.python_ms_per_call = await time(this.python);
    return out;
  }

  async stop() { await this.python?.stop(); }
}

module.exports = { EngineService, SELF_TEST };
