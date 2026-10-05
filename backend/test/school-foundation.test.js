const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { schoolFeatureEnabled } = require("../utils/features");

test("school schema is opt-in and accepts only an explicit true flag", () => {
  assert.equal(schoolFeatureEnabled({}), false);
  assert.equal(schoolFeatureEnabled({ SCHOOL_FEATURE_ENABLED: "false" }), false);
  assert.equal(schoolFeatureEnabled({ SCHOOL_FEATURE_ENABLED: "true" }), true);
});

test("school membership minimises child data and leaderboards default off", () => {
  const schema = fs.readFileSync(path.join(__dirname, "../db/school-schema.sqlite.sql"), "utf8");
  const membership = schema.match(/CREATE TABLE IF NOT EXISTS class_memberships[\s\S]*?\);/)[0];
  assert.match(membership, /child_id TEXT NOT NULL/);
  assert.doesNotMatch(membership, /name|email|pin|photo|birth|address/i);
  assert.match(schema, /leaderboard_enabled INTEGER NOT NULL DEFAULT 0/);
});
