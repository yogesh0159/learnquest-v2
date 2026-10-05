const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret";
const gameRoutes = require("../routes/game");
const { clampNumber, missionForLevel } = gameRoutes;

test("clampNumber clamps within bounds and rounds", () => {
  assert.equal(clampNumber(5.6, 0, 10), 6);
  assert.equal(clampNumber(-5, 0, 10), 0);
  assert.equal(clampNumber(500, 0, 10), 10);
});

test("clampNumber falls back on non-numeric input", () => {
  assert.equal(clampNumber("abc", 0, 10, 3), 3);
  assert.equal(clampNumber(undefined, 0, 10, 7), 7);
});

test("missionForLevel returns the boss mission for boss levels", () => {
  const mission = missionForLevel(10, true);
  assert.equal(mission.label, "Defeat the Jungle Guardian");
  assert.equal(mission.keyTarget, 3);
});

test("missionForLevel scales targets up for later normal levels", () => {
  const early = missionForLevel(1, false);
  const late = missionForLevel(9, false);
  assert.ok(late.coinTarget >= early.coinTarget);
});

test("missionForLevel returns Maths Kingdom targets and boss label", () => {
  const early = missionForLevel(1, false, "maths_kingdom");
  const boss = missionForLevel(10, true, "maths_kingdom");
  assert.equal(early.keyTarget, 2);
  assert.equal(boss.keyTarget, 4);
  assert.equal(boss.coinTarget, 45);
  assert.equal(boss.label, "Defeat the Number Dragon");
});
