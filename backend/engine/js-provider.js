// In-process engine (JavaScript). Always available; also the reference every other provider is checked against.
const path = require("path");
const { pathToFileURL } = require("url");

const base = path.resolve(__dirname, "../../frontend/js/game/jungle-run");
let modules;
const load = () => (modules ||= Promise.all(["device-profile.js", "question-service.js"].map((f) => import(pathToFileURL(path.join(base, f))))).then(([device, questions]) => ({ device, questions })));

async function call(method, params = {}) {
  const { device: D, questions: Q } = await load();
  switch (method) {
    case "ping": return { engine: "js", node: process.version, version: "1" };
    case "device.analyse": {
      const a = D.analyseDevice(params.facts || {}); const tex = a.facts.maxTexture || 16384; const sizes = {};
      for (const t of D.TIER_ORDER) { const r = D.renderSizeFor(t, a.facts.native.w, a.facts.native.h, tex); sizes[t] = { w: r.w, h: r.h }; }
      return { gpuClass: a.gpuClass, cap: a.cap, start: a.start, native: a.facts.native, sizes };
    }
    case "device.calibrate": {
      const probes = params.probes || {};
      const r = await D.calibrateTiers({ start: params.start || "balanced", cap: params.cap || "high", refreshHz: Number(params.refreshHz) || 60, maxProbes: Number(params.maxProbes) || 5,
        measure: async (tier) => { const m = probes[tier]; return m ? { frames: Number(m.frames) || 0, avgFps: Number(m.avgFps) || 0, p95Ms: Number(m.p95Ms) || 0 } : { frames: 0, avgFps: 0, p95Ms: 0 }; } });
      return { tier: r.tier, conclusive: r.conclusive, probed: r.probes.map((p) => p.tier) };
    }
    case "question.at": return Q.questionAt({ seed: params.seed ?? 1, index: params.index ?? 0, subject: params.subject || "math", level: Number(params.level) || 1 });
    case "question.verify": return Q.verifyAnswer({ seed: params.seed ?? 1, index: params.index ?? 0, subject: params.subject || "math", level: Number(params.level) || 1, chosenIndex: params.chosenIndex ?? -1 });
    case "batch": { const out = []; for (const c of params.calls || []) out.push(await call(c.method, c.params || {})); return out; }
    default: throw new Error(`unknown method ${method}`);
  }
}

module.exports = { name: "js", call, async start() { await load(); return { ok: true }; }, async stop() {} };
