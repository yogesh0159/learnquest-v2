const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("child login to runner learning completion browser path remains wired", () => {
  const api = fs.readFileSync(path.join(__dirname, "../../frontend/js/api.js"), "utf8");
  const login = fs.readFileSync(path.join(__dirname, "../../frontend/child-login.html"), "utf8");
  const jungle = fs.readFileSync(path.join(__dirname, "../../frontend/js/jungle-runner.js"), "utf8");
  const maths = fs.readFileSync(path.join(__dirname, "../../frontend/js/kingdom-runner.js"), "utf8");
  assert.match(login, /api\.childLogin/);
  for (const call of ["runnerStart", "runnerEvent", "runnerAnswer", "runnerComplete"]) assert.match(api, new RegExp(`${call}:`));
  for (const runner of [jungle, maths]) {
    assert.match(runner, /runToken=start\.runToken/);
    assert.match(runner, /runnerAnswer\(\{runId:this\.runId,runToken:this\.runToken/);
    assert.match(runner, /flushRunEvents\(\).*runnerComplete/);
  }
});

test("login to all three server-validated RealWorld mission completions remains wired", () => {
  const client = fs.readFileSync(path.join(__dirname, "../../frontend/js/realworld-missions.js"), "utf8");
  const system = fs.readFileSync(path.join(__dirname, "../../frontend/js/game/learning/mission-system.js"), "utf8");
  const catalog = require("../learning/mission-catalog");
  assert.deepEqual(catalog.SUPPORTED_MISSIONS, ["market", "bridge", "road_language"]);
  assert.match(system, /missionStart/);
  assert.match(system, /missionAnswer/);
  assert.match(system, /result\.completed/);
  assert.match(client, /onComplete: showComplete/);
});
