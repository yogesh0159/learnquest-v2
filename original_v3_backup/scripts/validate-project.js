const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const cp = require('child_process');

const root = path.resolve(__dirname, '..');
const ok = [];
function assert(condition, message) { if (!condition) throw new Error(message); ok.push(message); }
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function checkSyntax(rel, moduleMode = false) {
  const source = read(rel);
  const tmp = path.join(os.tmpdir(), `lq-${path.basename(rel).replace(/[^a-z0-9]/gi,'_')}-${Date.now()}${moduleMode ? '.mjs' : '.js'}`);
  fs.writeFileSync(tmp, source);
  const result = cp.spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
  fs.unlinkSync(tmp);
  assert(result.status === 0, `JavaScript syntax: ${rel}${result.stderr ? `\n${result.stderr}` : ''}`);
}

function collectJsFiles(absDir) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(path.relative(root, full));
    }
  }
  walk(absDir);
  return files;
}

try {
  // Packages / pinned engine
  const rootPkg = JSON.parse(read('package.json'));
  const backendPkg = JSON.parse(read('backend/package.json'));
  assert(rootPkg.engines?.node === '24.x', 'Root package pins Node 24.x');
  assert(backendPkg.engines?.node === '24.x', 'Backend package pins Node 24.x');
  assert(rootPkg.dependencies?.three === '0.185.1' && backendPkg.dependencies?.three === '0.185.1', 'Three.js is pinned to 0.185.1 at root and backend');
  assert(/^\^13\./.test(backendPkg.dependencies?.['better-sqlite3'] || ''), 'better-sqlite3 is upgraded to Node-24-compatible 13.x');
  assert(Boolean(backendPkg.dependencies?.mysql2), 'MySQL driver is present');
  assert(rootPkg.scripts?.['jungle:local'] === 'node scripts/jungle-local-server.js', 'Local-only Jungle lab script is configured');
  assert(fs.existsSync(path.join(root, 'frontend/assets/jungle/path/Path_Straight_01.glb')), 'Dimensioned Jungle path GLB is present');
  const jungleManifest = JSON.parse(read('frontend/assets/jungle/manifest.json'));
  assert(jungleManifest.track?.width === 6.6 && jungleManifest.track?.length === 12, 'Jungle manifest uses 6.6m x 12m modular track');
  assert(JSON.stringify(jungleManifest.track?.lanes) === JSON.stringify([-2.2,0,2.2]), 'Jungle manifest uses three 2.2m lane centers');

  // Backend and all browser JS syntax, including nested RealWorld modules.
  collectJsFiles(path.join(root, 'backend')).forEach((f) => checkSyntax(f));
  collectJsFiles(path.join(root, 'frontend', 'js')).forEach((f) => checkSyntax(f, true));

  // Inline scripts and local asset links.
  const htmlFiles = fs.readdirSync(path.join(root, 'frontend')).filter((n) => n.endsWith('.html'));
  for (const name of htmlFiles) {
    const rel = `frontend/${name}`;
    const html = read(rel);
    const inlineRe = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
    let m; let index = 0;
    while ((m = inlineRe.exec(html))) {
      const attrs = m[1] || '';
      const body = m[2] || '';
      if (/\bsrc\s*=/i.test(attrs) || !body.trim()) continue;
      const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
      const scriptType = String(typeMatch?.[1] || '').toLowerCase();
      if (scriptType === 'importmap' || scriptType === 'application/json' || scriptType === 'application/ld+json') continue;
      const tmp = path.join(os.tmpdir(), `lq-inline-${name}-${index++}.mjs`);
      fs.writeFileSync(tmp, body);
      const result = cp.spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
      fs.unlinkSync(tmp);
      assert(result.status === 0, `Inline JavaScript syntax: ${rel}`);
    }

    const refRe = /\b(?:src|href)=["']([^"']+)["']/gi;
    while ((m = refRe.exec(html))) {
      const ref = m[1];
      if (/^(?:https?:|mailto:|tel:|#|data:)/i.test(ref)) continue;
      const clean = ref.split(/[?#]/)[0];
      if (!clean) continue;
      // /vendor/* is served from node_modules by Express rather than frontend/.
      if (clean.startsWith('/vendor/')) continue;
      const target = clean.startsWith('/') ? path.join(root, 'frontend', clean.replace(/^\//,'')) : path.resolve(path.dirname(path.join(root, rel)), clean);
      assert(fs.existsSync(target), `Local asset exists: ${rel} -> ${ref}`);
    }
  }

  // Seed content semantic checks without loading app dependencies.
  const seed = read('backend/db/seed.js');
  const start = seed.indexOf('const subjects');
  const end = seed.indexOf('async function upsertById');
  assert(start >= 0 && end > start, 'Seed content section is readable');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(seed.slice(start, end) + ';globalThis.__seed={subjects,questions,worlds,jungleLevels,mathsKingdomLevels,rewards};', ctx);
  const data = ctx.__seed;
  assert(data.subjects.length === 3, 'Seed has 3 learning subjects');
  assert(data.questions.length >= 90, 'Seed has at least 90 learning questions after Maths Kingdom expansion');
  assert(data.worlds.length === 4, 'Seed has 4 worlds');
  assert(data.jungleLevels.length === 10, 'Seed has 10 Jungle levels');
  assert(data.jungleLevels[data.jungleLevels.length - 1].is_boss === 1, 'Level 10 is the Jungle Guardian boss');
  assert(data.mathsKingdomLevels.length === 10, 'Seed has 10 Maths Kingdom levels');
  assert(data.mathsKingdomLevels[data.mathsKingdomLevels.length - 1].is_boss === 1, 'Maths Kingdom Level 10 is the Number Dragon boss');
  assert(data.worlds.find((w) => w.id === 'maths_kingdom')?.is_active === 1, 'Maths Kingdom is implemented and active');
  assert(data.rewards.length >= 9, 'Seed has at least 9 rewards');
  const counts = {};
  for (const q of data.questions) {
    assert(Array.isArray(q.options) && q.options.length >= 3, `Question has options: ${q.question_en}`);
    assert(Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < q.options.length, `Question correct index valid: ${q.question_en}`);
    const key = `${q.subject_id}|${q.age_group}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  for (const subject of ['maths','english','gk']) for (const age of ['4-6','7-9','10-12']) {
    assert((counts[`${subject}|${age}`] || 0) >= 8, `At least 8 ${subject} questions for age ${age}`);
  }
  for (const age of ['4-6','7-9','10-12']) {
    assert((counts[`maths|${age}`] || 0) >= 14, `Maths Kingdom has at least 14 maths questions for age ${age}`);
  }

  // Database schema coverage.
  for (const file of ['backend/db/schema.sqlite.sql','backend/db/schema.mysql.sql']) {
    const sql = read(file);
    const tables = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-zA-Z0-9_]+)/gi)].map((x) => x[1]);
    assert(new Set(tables).size === 19, `${file} defines 19 tables`);
    for (const required of ['parents','children','questions','game_levels','child_level_progress','game_runs','game_run_answers','game_run_think_time','level_run_stats','child_equipped_rewards','mission_sessions','mission_attempts']) {
      assert(tables.includes(required), `${file} includes ${required}`);
    }
  }

  // Existing runner integration checks.
  const runner = read('frontend/js/jungle-runner.js');
  const assetManager = read('frontend/js/game/core/asset-manager.js');
  assert(runner.includes('loadThreeEngine') && assetManager.includes('/vendor/three/three.module.js'), 'Runner prefers locally served Three.js through the asset manager');
  assert(assetManager.includes('three@0.185.1'), 'Runner CDN fallback matches pinned Three.js');
  const inputController = read('frontend/js/game/core/input-controller.js');
  assert(runner.includes('InputController') && inputController.includes('moveLane(-1)') && inputController.includes('moveLane(1)') && inputController.includes('actions.jump()') && inputController.includes('actions.slide()'), 'Runner includes reusable lane, jump and slide controls');
  assert(runner.includes('runnerAnswer') && runner.includes('spawnAnswerGate'), 'Runner learning gates are integrated');
  assert(runner.includes('crash("wrong-answer")'), 'Wrong learning lane can end the run');
  assert(!runner.toLowerCase().includes('phaser'), 'Legacy Phaser engine is not used by the 3D runner');
  const kingdomRunner = read('frontend/js/kingdom-runner.js');
  assert(kingdomRunner.includes('loadThreeEngine'), 'Maths Kingdom uses the shared Three.js asset loader');
  assert(kingdomRunner.includes('state.mathsKingdomLevels'), 'Maths Kingdom loads its own level progression');
  assert(kingdomRunner.includes('spawnAnswerGate') && kingdomRunner.includes('runnerAnswer'), 'Maths Kingdom learning gates are integrated');
  assert(kingdomRunner.includes('InputController'), 'Maths Kingdom uses reusable runner controls');
  const collisionSystem = read('frontend/js/game/core/collision-system.js');
  assert(runner.includes('classifyRunnerCollision') && kingdomRunner.includes('classifyRunnerCollision'), 'Both worlds use reusable collision classification');
  assert(collisionSystem.includes('closestLaneIndex') && collisionSystem.includes('magnetActive') && collisionSystem.includes('jumpHeight'), 'Collision helpers preserve lane, magnet, and jump rules');
  const performanceManager = read('frontend/js/game/core/performance-manager.js');
  assert(runner.includes('runnerQualityProfile') && kingdomRunner.includes('runnerQualityProfile'), 'Both worlds use shared performance quality selection');
  assert(performanceManager.includes('disposeObject3D') && performanceManager.includes('resizeRunnerView'), 'Performance helpers cover cleanup and camera resize');
  const gameLoop = read('frontend/js/game/core/game-loop.js');
  assert(runner.includes('new GameLoop') && kingdomRunner.includes('new GameLoop'), 'Both worlds use the reusable update and render lifecycle');
  assert(gameLoop.includes('cancelFrame') && runner.includes('this.gameLoop.stop()') && kingdomRunner.includes('this.gameLoop.stop()'), 'Runner loops are cancelled during cleanup');
  const rewardSystem = read('frontend/js/game/core/reward-system.js');
  assert(runner.includes('initialRewardState') && kingdomRunner.includes('initialRewardState'), 'Both worlds initialize equipment through the reusable reward system');
  assert(rewardSystem.includes('reward_magic_sparkle') && rewardSystem.includes('reward_coin_magnet') && rewardSystem.includes('reward_focus_charm'), 'Reusable reward state preserves shield, magnet, and focus powers');
  assert(kingdomRunner.includes('buildDragon()'), 'Maths Kingdom includes the Number Dragon boss');
  const dashboard = read('frontend/dashboard.html');
  assert(dashboard.includes('is_unlocked') && dashboard.includes('world-maths_kingdom.html') === false, 'Dashboard uses per-child world unlock state');

  // RealWorld V1 foundation checks.
  const characterController = read('frontend/js/game/character-controller.js');
  assert(characterController.includes('GLTFLoader') && characterController.includes('procedural'), 'RealWorld CharacterController supports GLB plus procedural fallback');
  assert(characterController.includes('player_gameplay_collider'), 'Character visual and gameplay collider are separated');
  const characterPresets = read('frontend/js/character-presets.js');
  assert(characterPresets.includes('human_boy_v1') && characterPresets.includes('human_girl_v1'), 'Boy and girl explorer presets exist');
  const characterLab = read('frontend/character-lab.html');
  assert(characterLab.includes('type="importmap"') && characterLab.includes('character-lab.js'), '3D explorer lab is wired with a Three.js import map');
  const realWorldPage = read('frontend/realworld-missions.html');
  const missionClient = read('frontend/js/realworld-missions.js');
  const missionSystem = read('frontend/js/game/learning/mission-system.js');
  assert(realWorldPage.includes('realworld-missions.js') && realWorldPage.includes('missionPicker'), 'RealWorld mission page is wired to its interaction runtime');
  assert(missionClient.includes('Key ${index + 1}') && missionClient.includes('document.addEventListener("keydown"'), 'RealWorld missions support touch/click and keyboard choices');
  assert(missionSystem.includes('missionAnswer') && missionSystem.includes('onFeedback'), 'Reusable MissionSystem submits evidence and delivers feedback');
  assert(dashboard.includes('realworld-missions.html'), 'Child dashboard links to RealWorld missions without replacing existing worlds');

  // Production hotfix and security regression checks.
  const dbIndex = read('backend/db/index.js');
  assert(dbIndex.includes('ALTER TABLE children MODIFY COLUMN pin VARCHAR(255) NOT NULL'), 'Existing MySQL children.pin is widened automatically');
  const authRoute = read('backend/routes/auth.js');
  assert(authRoute.includes('STALE_PARENT_SESSION'), 'Stale parent sessions are rejected before child insert');
  const apiClient = read('frontend/js/api.js');
  assert(apiClient.includes('res.status === 401 && auth') && apiClient.includes('clearSession()'), 'Authenticated 401 responses clear stale browser sessions');
  const serverSource = read('backend/server.js');
  assert(serverSource.includes('https://fonts.googleapis.com') && serverSource.includes('https://fonts.gstatic.com'), 'CSP allows configured Google Fonts');
  assert(serverSource.includes('https://cdn.jsdelivr.net') && serverSource.includes('https://unpkg.com'), 'CSP allows Three.js CDN fallbacks');
  assert(!serverSource.includes('"unsafe-eval"') && !serverSource.includes("'unsafe-eval'"), 'CSP does not allow unsafe-eval');
  assert(serverSource.includes('corsOptions = { origin: false }'), 'Production defaults to same-origin when ALLOWED_ORIGINS is empty');
  assert(serverSource.includes('/vendor/three-addons'), 'Official Three.js add-ons are served locally');
  const profileSetup = read('frontend/profile-setup.html');
  assert(profileSetup.includes('id="createProfileBtn"') && profileSetup.includes('submitBtn.disabled = true'), 'Child profile form prevents duplicate submissions');
  assert(profileSetup.includes('human_boy_v1') || profileSetup.includes('character-presets.js'), 'Profile setup supports RealWorld explorer selection');

  console.log(`✅ LearnQuest validation passed (${ok.length} checks).`);
} catch (error) {
  console.error('❌ LearnQuest validation failed:', error.message);
  process.exit(1);
}
