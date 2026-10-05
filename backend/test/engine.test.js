const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { EngineService } = require('../engine/engine-service');
const js = require('../engine/js-provider');
const createEngineRouter = require('../routes/engine');

const quiet = { info() {}, warn() {}, error() {} };
const golden = fs.readFileSync(path.resolve(__dirname, '../../native/golden/golden_questions.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const FACTS = [
  { gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)', screenW: 3840, screenH: 2160, dpr: 1, deviceMemory: 8, cores: 12, maxTexture: 16384 },
  { gpu: 'ANGLE (NVIDIA, NVIDIA GeForce GT 730 (0x00001287) Direct3D11 vs_5_0 ps_5_0, D3D11)', screenW: 1920, screenH: 1080, dpr: 1, deviceMemory: 16, cores: 16 },
  { gpu: 'ANGLE (Intel, Intel(R) HD Graphics 520 (0x00001916) Direct3D11 vs_5_0 ps_5_0, D3D11)', screenW: 1280, screenH: 720, dpr: 1.65, deviceMemory: 8, cores: 4 },
  { gpu: 'Mali-G52', screenW: 800, screenH: 1280, dpr: 1.5, deviceMemory: 2, cores: 8, touch: true, mobile: true, maxTexture: 4096 },
  { gpu: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)', screenW: 1280, screenH: 720, dpr: 1, deviceMemory: 4, cores: 1 },
  { gpu: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11)', screenW: 1920, screenH: 1080, dpr: 1, deviceMemory: 8, cores: 8, battery: { charging: false, level: 0.1 } },
];
const probesFor = (fps) => Object.fromEntries(Object.entries(fps).map(([t, f]) => [t, f == null ? null : { frames: 60, avgFps: f, p95Ms: f >= 55 ? 18 : 40 }]));

let python; // a started Python provider, or null when this machine has no Python
test.before(async () => {
  const { PythonProvider } = require('../engine/python-provider');
  const p = new PythonProvider({ logger: quiet });
  try { await p.start(); python = p; } catch { python = null; }
});
test.after(async () => { await python?.stop(); });

test('JavaScript engine reproduces all 960 golden questions and their verification', async () => {
  for (const r of golden) {
    const q = await js.call('question.at', { seed: r.seed, index: r.index, subject: r.subject, level: r.level });
    assert.deepEqual(q, r.q, `${r.subject} L${r.level} seed ${r.seed} #${r.index}`);
  }
  const g = golden[0]; assert.equal((await js.call('question.verify', { ...g, chosenIndex: g.q.correctIndex })).correct, true);
  assert.equal((await js.call('question.verify', { ...g, chosenIndex: (g.q.correctIndex + 1) % 3 })).correct, false);
});

test('Python engine gives exactly the same 960 questions as JavaScript (skipped when Python is not installed)', async (t) => {
  if (!python) return t.skip('no Python on this machine');
  const calls = golden.map((r) => ({ method: 'question.at', params: { seed: r.seed, index: r.index, subject: r.subject, level: r.level } }));
  const out = await python.call('batch', { calls });
  assert.equal(out.length, golden.length);
  for (let i = 0; i < golden.length; i++) assert.deepEqual(out[i], golden[i].q, `${golden[i].subject} L${golden[i].level} #${golden[i].index}`);
});

test('Python and JavaScript agree on device analysis (render sizes per level) and on calibration decisions', async (t) => {
  if (!python) return t.skip('no Python on this machine');
  for (const facts of FACTS) assert.deepEqual(await python.call('device.analyse', { facts }), await js.call('device.analyse', { facts }), facts.gpu);
  const tables = [{ high: 60, ultra: 60 }, { high: 38, balanced: 60 }, { high: 10, balanced: 12, low: 15, minimal: 30 }, {}, { high: 60 }, { balanced: 22, low: 30, minimal: 55 }];
  for (const [start, cap] of [['high', 'ultra'], ['balanced', 'high'], ['ultra', 'ultra'], ['low', 'balanced']]) for (const fps of tables) {
    const params = { start, cap, refreshHz: 60, probes: probesFor(fps) };
    assert.deepEqual(await python.call('device.calibrate', params), await js.call('device.calibrate', params), JSON.stringify({ start, cap, fps }));
  }
});

test('GT 730 from a real report is an entry-level card: capped at Balanced (1920x1080), never 4K', async () => {
  const r = await js.call('device.analyse', { facts: FACTS[1] });
  assert.deepEqual([r.gpuClass, r.cap, r.start], ['entry', 'balanced', 'balanced']); assert.deepEqual(r.sizes.balanced, { w: 1920, h: 1080 }); assert.deepEqual(new Set(Object.values(r.sizes).map((s) => s.w)).size > 1, true);
  const big = await js.call('device.analyse', { facts: FACTS[0] }); assert.deepEqual(big.sizes.ultra, { w: 3840, h: 2160 }); assert.deepEqual(big.sizes.high, { w: 2560, h: 1440 });
});

test('auto mode picks Python when it passes its self-test, and reports why', async (t) => {
  if (!python) return t.skip('no Python on this machine');
  const svc = new EngineService({ provider: 'auto', logger: quiet }); await svc.init();
  assert.equal(svc.status().active, 'python'); assert.equal(svc.status().selfTest.mismatches.length, 0); assert.ok(svc.status().selfTest.cases >= 8);
  const q = await svc.call('question.at', { seed: 42, index: 3, subject: 'math', level: 2 }); assert.deepEqual(q, await js.call('question.at', { seed: 42, index: 3, subject: 'math', level: 2 }));
  assert.ok(svc.status().stats.python.calls >= 1); await svc.stop();
});

test('without a usable Python the service silently uses JavaScript (API keeps working)', async () => {
  const old = process.env.ENGINE_PYTHON; process.env.ENGINE_PYTHON = path.join(__dirname, 'no-such-python-binary');
  try {
    const svc = new EngineService({ provider: 'auto', logger: quiet }); const s = await svc.init();
    assert.equal(s.active, 'js'); assert.match(s.reason, /Python not used/);
    assert.equal((await svc.call('question.verify', { seed: 1, index: 0, subject: 'math', level: 1, chosenIndex: 0 })).correctIndex >= 0, true);
    const forced = new EngineService({ provider: 'js', logger: quiet }); assert.equal((await forced.init()).active, 'js'); await svc.stop(); await forced.stop();
  } finally { old === undefined ? delete process.env.ENGINE_PYTHON : (process.env.ENGINE_PYTHON = old); }
});

test('if the Python worker dies the request is still answered (JavaScript), and the worker is paused after repeated failures', async (t) => {
  if (!python) return t.skip('no Python on this machine');
  const svc = new EngineService({ provider: 'auto', logger: quiet, failureLimit: 2, cooldownMs: 600000 }); await svc.init(); assert.equal(svc.status().active, 'python');
  svc.python.proc.kill(); await new Promise((r) => setTimeout(r, 200));
  const expected = await js.call('question.at', { seed: 9, index: 1, subject: 'shapes', level: 2 });
  assert.deepEqual(await svc.call('question.at', { seed: 9, index: 1, subject: 'shapes', level: 2 }), expected);
  assert.deepEqual(await svc.call('question.at', { seed: 9, index: 1, subject: 'shapes', level: 2 }), expected);
  const st = svc.status(); assert.ok(st.stats.python.fallbacks >= 2); assert.equal(st.pythonPaused, true);
  assert.deepEqual(await svc.call('question.at', { seed: 9, index: 1, subject: 'shapes', level: 2 }), expected); await svc.stop();
});

function listen(engine) {
  const app = express(); app.use(express.json()); app.use('/api/engine', createEngineRouter(engine)); app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
  return new Promise((resolve) => { const server = http.createServer(app).listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}/api/engine` })); });
}
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('HTTP API: status, questions without answers, server-side verification, device analysis, validation errors', async () => {
  const engine = new EngineService({ provider: 'auto', logger: quiet }); const { server, base } = await listen(engine);
  try {
    const status = await (await fetch(`${base}/status`)).json(); assert.ok(['python', 'js'].includes(status.active)); assert.equal(status.languages.javascript, true);
    const qs = await (await fetch(`${base}/questions?seed=42&subject=math&level=2&from=0&count=5`)).json();
    assert.equal(qs.questions.length, 5); assert.ok(qs.questions.every((q) => q.options.length === 3 && typeof q.text === 'string'));
    assert.ok(!JSON.stringify(qs).includes('correctIndex') && !JSON.stringify(qs).includes('explanation'), 'the question list must not leak the answers');
    const expected = golden.find((g) => g.seed === 42 && g.subject === 'math' && g.level === 2 && g.index === 3); assert.deepEqual(qs.questions[3].options, expected.q.options.map((o) => o.label));
    const right = await (await post(`${base}/verify`, { seed: 42, subject: 'math', level: 2, index: 3, chosenIndex: expected.q.correctIndex })).json(); assert.equal(right.correct, true);
    const wrong = await (await post(`${base}/verify`, { seed: 42, subject: 'math', level: 2, index: 3, chosenIndex: (expected.q.correctIndex + 1) % 3 })).json(); assert.equal(wrong.correct, false); assert.equal(wrong.correctIndex, expected.q.correctIndex);
    const dev = await (await post(`${base}/device/analyse`, { facts: FACTS[1] })).json(); assert.deepEqual([dev.gpuClass, dev.cap], ['entry', 'balanced']);
    const cal = await (await post(`${base}/device/calibrate`, { start: 'high', cap: 'ultra', probes: probesFor({ high: 60, ultra: 60 }) })).json(); assert.equal(cal.tier, 'ultra');
    for (const [url, body] of [[`${base}/verify`, { seed: 1, subject: 'math', level: 9, index: 0, chosenIndex: 0 }], [`${base}/verify`, { seed: 1, subject: 'bogus', level: 1, index: 0, chosenIndex: 0 }], [`${base}/verify`, { seed: 1, subject: 'math', level: 1, index: 0, chosenIndex: 7 }], [`${base}/device/analyse`, { facts: { gpu: 'x', screenW: -5 } }], [`${base}/device/calibrate`, { start: 'huge', cap: 'ultra' }]]) assert.equal((await post(url, body)).status, 400, JSON.stringify(body));
    assert.equal((await fetch(`${base}/questions?seed=1&count=500`)).status, 400); assert.equal((await fetch(`${base}/benchmark`)).status, 404);
  } finally { server.close(); await engine.stop(); }
});
