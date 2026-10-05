const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { normalizedProgress } = require("../routes/missions");

test("mission progress exposes attempts, mistakes, accuracy and completion evidence", () => {
  assert.deepEqual(normalizedProgress([{ mission_id: "market", skill: "change", attempts: 5, correct: 3, sessions_completed: 2, last_practised_at: "2026-09-11" }]), [{
    missionId: "market", skill: "change", attempts: 5, correct: 3, mistakes: 2,
    accuracy: 60, sessionsCompleted: 2, lastPractisedAt: "2026-09-11",
  }]);
});

test("mission API records an attempt before server-authoritative progress advances", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "routes", "missions.js"), "utf8");
  assert.match(source, /INSERT INTO mission_attempts/);
  assert.match(source, /evaluation\.correct \? requestedStep \+ 1 : requestedStep/);
  assert.match(source, /Mission step is out of order/);
  assert.doesNotMatch(source, /UPDATE children SET (?:xp|coins)/);
});

test("both database dialects persist mission evidence independently", () => {
  for (const file of ["schema.sqlite.sql", "schema.mysql.sql"]) {
    const source = fs.readFileSync(path.join(__dirname, "..", "db", file), "utf8");
    assert.match(source, /CREATE TABLE IF NOT EXISTS mission_sessions/);
    assert.match(source, /CREATE TABLE IF NOT EXISTS mission_attempts/);
    assert.match(source, /UNIQUE(?: KEY \w+)?\s*\(session_id, step_index, attempt_number\)/);
  }
});
