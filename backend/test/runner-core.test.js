const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function importCore(name) {
  const file = path.resolve(__dirname, `../../frontend/js/game/core/${name}.js`);
  return import(pathToFileURL(file));
}

test('collision system preserves jump, slide, collectible, and gate rules', async () => {
  const { classifyRunnerCollision } = await importCore('collision-system');
  const bounds = { zMin: .4, zMax: 3.35, playerZ: 2.1, laneRadius: 1.25, magnetRadius: 4.2, gateRadius: .9, jumpHeight: 1.05 };
  const state = { playerX: 0, jumpY: 0, sliding: false, magnetActive: false, invulnerable: false };
  const entity = (category, kind, x = 0, z = 2.1) => ({ category, kind, group: { position: { x, z } } });

  assert.deepEqual(classifyRunnerCollision(entity('obstacle', 'jump'), state, bounds), { type: 'crash', kind: 'jump' });
  assert.equal(classifyRunnerCollision(entity('obstacle', 'jump'), { ...state, jumpY: 1.06 }, bounds).type, 'none');
  assert.equal(classifyRunnerCollision(entity('obstacle', 'slide'), { ...state, sliding: true }, bounds).type, 'none');
  assert.equal(classifyRunnerCollision(entity('collectible', 'coin', 3.15), { ...state, magnetActive: true }, bounds).type, 'collect');
  assert.equal(classifyRunnerCollision(entity('gate'), state, bounds).type, 'gate');
});

test('closest lane and equipped reward helpers preserve runner state', async () => {
  const { closestLaneIndex } = await importCore('collision-system');
  const { equippedRewardsBySlot, initialRewardState } = await importCore('reward-system');
  assert.equal(closestLaneIndex(2.8, [-3.15, 0, 3.15]), 2);
  const equipped = equippedRewardsBySlot([{ slot: 'power', reward_id: 'reward_coin_magnet' }]);
  assert.deepEqual(initialRewardState(equipped), { shieldCharges: 0, magnetTimer: 12, doubleScoreTimer: 0 });
});

test('game loop caps frame delta and cancels cleanly', async () => {
  const { GameLoop } = await importCore('game-loop');
  let scheduled;
  let cancelled;
  const updates = [];
  const loop = new GameLoop({
    clock: { getDelta: () => .2 },
    update: (delta) => updates.push(delta),
    render: () => {},
    requestFrame: (callback) => { scheduled = callback; return 7; },
    cancelFrame: (id) => { cancelled = id; },
  });
  loop.start();
  scheduled();
  assert.deepEqual(updates, [.035]);
  loop.stop();
  assert.equal(cancelled, 7);
});

test('game loop default frame APIs retain the browser global receiver', async () => {
  const { GameLoop } = await importCore('game-loop');
  const originalRequestFrame = globalThis.requestAnimationFrame;
  const originalCancelFrame = globalThis.cancelAnimationFrame;
  let scheduled;
  let cancelled;

  globalThis.requestAnimationFrame = function requestAnimationFrame(callback) {
    assert.equal(this, globalThis);
    scheduled = callback;
    return 11;
  };
  globalThis.cancelAnimationFrame = function cancelAnimationFrame(id) {
    assert.equal(this, globalThis);
    cancelled = id;
  };

  try {
    const loop = new GameLoop({
      clock: { getDelta: () => .01 },
      update: () => {},
      render: () => {},
    });
    loop.start();
    assert.equal(typeof scheduled, 'function');
    loop.stop();
    assert.equal(cancelled, 11);
  } finally {
    if (originalRequestFrame === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = originalRequestFrame;
    if (originalCancelFrame === undefined) delete globalThis.cancelAnimationFrame;
    else globalThis.cancelAnimationFrame = originalCancelFrame;
  }
});

test('learning focus gives every child exactly five free seconds', async () => {
  const { FREE_THINK_TIME_SECONDS, completedPaidSeconds } = await importCore('learning-focus');
  assert.equal(FREE_THINK_TIME_SECONDS, 5);
  assert.equal(completedPaidSeconds(5), 0);
  assert.equal(completedPaidSeconds(5.99), 0);
  assert.equal(completedPaidSeconds(6), 1);
  assert.equal(completedPaidSeconds(7), 2);
  assert.equal(completedPaidSeconds(10), 5);
});

test('learning focus freezes forward updates, permits lane choice, and resumes without submitting', async () => {
  const { LearningFocus } = await importCore('learning-focus');
  let distance = 10;
  let score = 20;
  let lane = 1;
  let answersSubmitted = 0;
  let resumed = 0;
  const focus = new LearningFocus({ onReady: () => { resumed++; } });
  const update = (seconds) => {
    if (focus.active) { focus.tick(seconds); return; }
    distance += 12 * seconds;
    score += 9 * seconds;
  };

  focus.start();
  lane = 2; // Lane input remains independent of forward simulation.
  update(2);
  assert.deepEqual({ distance, score, lane }, { distance: 10, score: 20, lane: 2 });
  assert.equal(focus.ready(), true);
  assert.equal(answersSubmitted, 0);
  assert.equal(resumed, 1);
  update(1);
  assert.deepEqual({ distance, score }, { distance: 22, score: 29 });
});

test('learning focus remains frozen after free time and is wired into both runners', async () => {
  const fs = require('node:fs');
  const { LearningFocus } = await importCore('learning-focus');
  const focus = new LearningFocus();
  focus.start();
  focus.tick(5);
  assert.equal(focus.active, true);

  for (const runner of ['jungle-runner.js', 'kingdom-runner.js']) {
    const source = fs.readFileSync(path.resolve(__dirname, `../../frontend/js/${runner}`), 'utf8');
    assert.match(source, /new LearningFocus/);
    assert.match(source, /if \(this\.learningFocus\.active\)/);
    assert.match(source, /this\.learningFocus\.start\(\)/);
    const runnerSource = source.slice(source.search(/class \w+Runner/));
    const jumpGuard = runnerSource.match(/jump\(\) \{([\s\S]*?)\n  \}/)?.[1] || '';
    const slideGuard = runnerSource.match(/slide\(\) \{([\s\S]*?)\n  \}/)?.[1] || '';
    assert.match(jumpGuard, /this\.learningFocus\.active/);
    assert.match(slideGuard, /this\.learningFocus\.active/);
    assert.match(jumpGuard, /this\.jumpVelocity=8\.6/);
    assert.match(slideGuard, /this\.sliding=true/);
  }
});

test('learning focus charges only confirmed complete extra seconds and stops safely', async () => {
  const { LearningFocus, EXTRA_THINK_TIME_COST_PER_SECOND } = await importCore('learning-focus');
  assert.equal(EXTRA_THINK_TIME_COST_PER_SECOND, 10);
  let balance = 20;
  let calls = 0;
  const focus = new LearningFocus({ onCharge: async () => {
    calls++;
    if (balance < 10) return { afforded: false, balance };
    balance -= 10;
    return { afforded: true, balance, paidSeconds: calls };
  }});
  focus.start({ balance });
  focus.tick(5.9);
  await new Promise(setImmediate);
  assert.equal(calls, 0, 'no partial extra second is charged');
  focus.tick(.1);
  await new Promise(setImmediate);
  assert.deepEqual({ calls, balance, active: focus.active }, { calls: 1, balance: 10, active: true });
  focus.tick(1);
  await new Promise(setImmediate);
  assert.deepEqual({ calls, balance }, { calls: 2, balance: 0 });
  focus.tick(1);
  await new Promise(setImmediate);
  assert.deepEqual({ calls, balance, active: focus.active }, { calls: 3, balance: 0, active: false });
  focus.tick(10);
  await new Promise(setImmediate);
  assert.equal(calls, 3, 'ending focus stops future charges');
});

test('runner controls reserve Enter for focus and never use Space to resume', async () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/js/game/core/input-controller.js'), 'utf8');
  assert.match(source, /event\.key === "Enter" && this\.actions\.ready/);
  assert.doesNotMatch(source, /\["Enter", " "\]/);
});

test('static cache policy revalidates runtime code while preserving immutable assets', () => {
  const fs = require('node:fs');
  const server = fs.readFileSync(path.resolve(__dirname, '../server.js'), 'utf8');
  assert.match(server, /\(\?:js\|mjs\|css\|json\)/);
  assert.match(server, /no-cache, must-revalidate/);
  assert.match(server, /glb\|gltf\|bin\|ktx2\|webp\|png\|jpe\?g\|woff2\?/);
  assert.match(server, /public, max-age=604800, immutable/);
  assert.match(server, /filePath\.endsWith\("\.html"\)[\s\S]*?"no-cache"/);
  assert.match(server, /req\.path\.startsWith\("\/api\/"\)[\s\S]*?"no-store"/);
});

test('both worlds select cards, clear queued movement, and lock without submitting', () => {
  const fs = require('node:fs');
  for (const runner of ['jungle-runner.js', 'kingdom-runner.js']) {
    const source = fs.readFileSync(path.resolve(__dirname, `../../frontend/js/${runner}`), 'utf8');
    assert.match(source, /div\.onclick=\(\)=>this\.selectLane\(i\)/);
    assert.match(source, /this\.jumpVelocity=0;this\.jumpY=0;this\.sliding=false/);
    const lock = source.match(/lockAnswerAndContinue\(\) \{([\s\S]*?)\n  \}/)?.[1] || '';
    assert.match(lock, /selectedAnswerLane === null/);
    assert.match(lock, /learningFocus\.ready/);
    assert.doesNotMatch(lock, /runnerAnswer|resolveQuestionGate/);
    assert.match(source, /classifyRunnerCollision/);
  }
});

test('asset loader tries locations in order and returns the first success', async () => {
  const { loadModuleWithFallback } = await importCore('asset-manager');
  const attempted = [];
  const loaded = await loadModuleWithFallback(['local', 'fallback'], async (url) => {
    attempted.push(url);
    if (url === 'local') throw new Error('missing');
    return { source: url };
  });
  assert.deepEqual(attempted, ['local', 'fallback']);
  assert.deepEqual(loaded, { source: 'fallback' });
});

test('runtime quality uses measured frame time and preserves a low-power tier', async () => {
  const { RuntimeQualityManager, runnerQualityProfile } = await importCore('performance-manager');
  const changes = [];
  const manager = new RuntimeQualityManager({ initialTier: 'high', sampleSize: 3, onChange: (profile) => changes.push(profile.tier) });
  [35, 38, 34].forEach((ms) => manager.recordFrame(ms));
  assert.equal(manager.tier, 'balanced');
  // Cooldown prevents oscillation; repeated slow sample windows eventually
  // choose the playable no-shadow fallback based on measurements.
  for (let window = 0; window < 3; window++) [40, 42, 38].forEach((ms) => manager.recordFrame(ms));
  assert.equal(manager.tier, 'low');
  assert.equal(runnerQualityProfile({ innerWidth: 400, devicePixelRatio: 3 }, { hardwareConcurrency: 2 }, manager.tier).shadows, false);
  assert.deepEqual(changes, ['balanced', 'low']);
});
