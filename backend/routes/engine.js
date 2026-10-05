// /api/engine/*  -  the game engine on the server (Python worker when available, JavaScript otherwise; identical answers).
const express = require("express");
const asyncRoute = require("../utils/async-route");

const SUBJECTS = ["math", "patterns", "compare", "spelling", "science", "shapes"];
const TIERS = ["minimal", "low", "balanced", "high", "ultra"];
const fail = (res, message) => res.status(400).json({ error: message });
const int = (v, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };
const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };

function cleanFacts(f) {
  if (!f || typeof f !== "object") return null;
  const out = { gpu: String(f.gpu ?? "").slice(0, 200), touch: !!f.touch, mobile: !!f.mobile, saveData: !!f.saveData };
  const put = (key, lo, hi, optional = true) => { if (f[key] == null) return optional; const n = num(f[key], lo, hi); if (n == null) return false; out[key] = n; return true; };
  if (!put("screenW", 100, 20000) || !put("screenH", 100, 20000) || !put("dpr", 0.5, 10) || !put("deviceMemory", 0, 1024) || !put("cores", 0, 1024) || !put("maxTexture", 0, 65536) || !put("refreshHz", 1, 1000)) return null;
  if (f.battery && typeof f.battery === "object") { const level = num(f.battery.level, 0, 1); if (level == null) return null; out.battery = { charging: !!f.battery.charging, level }; }
  return out;
}

function questionParams(src) {
  const seed = Number(src.seed ?? 1); const level = int(src.level ?? 1, 1, 4); const subject = String(src.subject ?? "math");
  if (!Number.isInteger(seed) || seed < -2147483648 || seed > 4294967295) return { error: "seed must be an integer (32-bit)" };
  if (level == null) return { error: "level must be 1-4" };
  if (!SUBJECTS.includes(subject)) return { error: `subject must be one of ${SUBJECTS.join(", ")}` };
  return { seed, level, subject };
}

module.exports = function createEngineRouter(engine) {
  const router = express.Router();

  router.get("/status", asyncRoute(async (req, res) => { await engine.init(); res.json(engine.status()); }));

  router.post("/device/analyse", asyncRoute(async (req, res) => {
    const facts = cleanFacts(req.body?.facts); if (!facts) return fail(res, "facts: expected gpu, screenW, screenH, dpr, deviceMemory, cores ... with sensible numbers");
    res.json({ ...(await engine.call("device.analyse", { facts })), engine: engine.status().active });
  }));

  router.post("/device/calibrate", asyncRoute(async (req, res) => {
    const b = req.body || {}; if (!TIERS.includes(b.start) || !TIERS.includes(b.cap)) return fail(res, `start and cap must be one of ${TIERS.join(", ")}`);
    const probes = {}; for (const t of TIERS) { const m = b.probes?.[t]; if (!m) continue; const frames = num(m.frames, 0, 1e6), avgFps = num(m.avgFps, 0, 1e5), p95Ms = num(m.p95Ms, 0, 1e6); if (frames == null || avgFps == null || p95Ms == null) return fail(res, `probes.${t}: numbers expected`); probes[t] = { frames, avgFps, p95Ms }; }
    res.json({ ...(await engine.call("device.calibrate", { start: b.start, cap: b.cap, refreshHz: num(b.refreshHz, 1, 1000) ?? 60, probes })), engine: engine.status().active });
  }));

  // Questions WITHOUT answers (so the browser cannot read them from here); /verify checks a chosen option.
  router.get("/questions", asyncRoute(async (req, res) => {
    const p = questionParams(req.query); if (p.error) return fail(res, p.error);
    const from = int(req.query.from ?? 0, 0, 1e6), count = int(req.query.count ?? 5, 1, 20); if (from == null || count == null) return fail(res, "from 0-1000000, count 1-20");
    const calls = Array.from({ length: count }, (_, i) => ({ method: "question.at", params: { ...p, index: from + i } }));
    const list = await engine.call("batch", { calls });
    res.json({ seed: p.seed, subject: p.subject, level: p.level, engine: engine.status().active, questions: list.map((q, i) => ({ index: from + i, text: q.text, options: q.options.map((o) => o.label), spoken: q.spoken })) });
  }));

  router.post("/verify", asyncRoute(async (req, res) => {
    const p = questionParams(req.body || {}); if (p.error) return fail(res, p.error);
    const index = int(req.body?.index, 0, 1e6), chosenIndex = int(req.body?.chosenIndex, 0, 2); if (index == null || chosenIndex == null) return fail(res, "index 0-1000000 and chosenIndex 0-2 are required");
    res.json({ ...(await engine.call("question.verify", { ...p, index, chosenIndex })), engine: engine.status().active });
  }));

  router.get("/benchmark", asyncRoute(async (req, res) => {
    if (process.env.LQ_EXPLORER !== "1" && process.env.ENGINE_BENCH !== "1") return res.status(404).json({ error: "not found" });
    res.json({ perCallMs: await engine.benchmark(int(req.query.n ?? 200, 20, 2000) ?? 200), note: "question.at, JavaScript in-process vs Python worker (includes the pipe round trip)" });
  }));

  return router;
};
