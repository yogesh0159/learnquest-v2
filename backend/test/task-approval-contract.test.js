const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const tasksSource = fs.readFileSync(path.join(__dirname, "..", "routes", "tasks.js"), "utf8");
const parentSource = fs.readFileSync(path.join(__dirname, "..", "routes", "parent.js"), "utf8");

test("child task submission does not directly pay coins", () => {
  assert.match(tasksSource, /status\s*=\s*\?/);
  assert.match(tasksSource, /submitted/);
  assert.doesNotMatch(tasksSource, /UPDATE children SET coins = coins \+/);
});

test("parent review endpoint owns the reward release", () => {
  assert.match(parentSource, /\/tasks\/:id\/review/);
  assert.match(parentSource, /decision must be approve or reject/);
  assert.match(parentSource, /task\.status !== "submitted"/);
  assert.match(parentSource, /UPDATE children SET coins = coins \+/);
});

test("parent approval is guarded against duplicate payout", () => {
  assert.match(parentSource, /task\.status === "completed"/);
  assert.match(parentSource, /alreadyApproved: true/);
});
