const test = require("node:test");
const assert = require("node:assert/strict");
const { createRunToken, hashRunToken, tokenMatches, validateRunEvent, validateCompletionTelemetry } = require("../utils/run-integrity");

test("run tokens are random and compared against only their stored hashes", () => {
  const first = createRunToken();
  const second = createRunToken();
  assert.notEqual(first, second);
  assert.equal(tokenMatches(first, hashRunToken(first)), true);
  assert.equal(tokenMatches(second, hashRunToken(first)), false);
});

test("run events reject duplicates, gaps, unsupported types, batches, and impossible rates", () => {
  const base = { type: "key", amount: 1, sequence: 2, previousSequence: 1, elapsedMs: 5000, previousEventElapsedMs: 3000, previousEventType: "key" };
  assert.equal(validateRunEvent(base).ok, true);
  assert.equal(validateRunEvent({ ...base, sequence: 1 }).ok, false);
  assert.equal(validateRunEvent({ ...base, sequence: 3 }).ok, false);
  assert.equal(validateRunEvent({ ...base, type: "xp" }).ok, false);
  assert.equal(validateRunEvent({ ...base, amount: 50 }).ok, false);
  assert.equal(validateRunEvent({ ...base, elapsedMs: 3100 }).ok, false);
  assert.equal(validateRunEvent({ ...base, elapsedMs: 3100, previousEventType: "coin" }).ok, true);
});

test("completion telemetry rejects forged distance, obstacle, combo, and score claims", () => {
  const valid = { distance: 500, score: 12000, combo: 25, obstacles: 10, verifiedCoins: 20, verifiedKeys: 2 };
  assert.equal(validateCompletionTelemetry(valid, 30).ok, true);
  assert.equal(validateCompletionTelemetry({ ...valid, distance: 5000 }, 30).ok, false);
  assert.equal(validateCompletionTelemetry({ ...valid, obstacles: 500 }, 30).ok, false);
  assert.equal(validateCompletionTelemetry({ ...valid, combo: 500 }, 30).ok, false);
  assert.equal(validateCompletionTelemetry({ ...valid, score: 9999999 }, 30).ok, false);
});
