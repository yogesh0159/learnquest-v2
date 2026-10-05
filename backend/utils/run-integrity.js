const crypto = require("crypto");

const EVENT_LIMITS = Object.freeze({
  coin: { minIntervalMs: 45, maxPerEvent: 1 },
  key: { minIntervalMs: 1200, maxPerEvent: 1 },
  obstacle: { minIntervalMs: 180, maxPerEvent: 1 },
});

function createRunToken() { return crypto.randomBytes(32).toString("base64url"); }
function hashRunToken(token) { return crypto.createHash("sha256").update(String(token || "")).digest("hex"); }
function tokenMatches(token, expectedHash) {
  const actual = Buffer.from(hashRunToken(token), "hex");
  const expected = Buffer.from(String(expectedHash || ""), "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function validateRunEvent({ type, amount, sequence, previousSequence, elapsedMs, previousEventElapsedMs, previousEventType }) {
  const limit = EVENT_LIMITS[type];
  if (!limit) return { ok: false, reason: "Unsupported run event" };
  if (!Number.isInteger(sequence) || sequence !== Number(previousSequence || 0) + 1) return { ok: false, reason: "Run event is out of order" };
  if (!Number.isInteger(amount) || amount < 1 || amount > limit.maxPerEvent) return { ok: false, reason: "Invalid run event amount" };
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return { ok: false, reason: "Invalid event time" };
  if (previousEventType === type && previousEventElapsedMs != null && elapsedMs - previousEventElapsedMs < limit.minIntervalMs) return { ok: false, reason: "Run event rate is not possible" };
  return { ok: true };
}

function validateCompletionTelemetry(stats, serverElapsedSeconds) {
  const elapsed = Math.max(1, Number(serverElapsedSeconds || 1));
  const distance = Number(stats.distance || 0);
  const score = Number(stats.score || 0);
  const combo = Number(stats.combo || 0);
  const obstacles = Number(stats.obstacles || 0);
  if (distance > elapsed * 40 + 80) return { ok: false, reason: "Distance exceeds run duration" };
  if (obstacles > elapsed * 4 + 10) return { ok: false, reason: "Obstacle rate exceeds run duration" };
  if (combo > obstacles + Number(stats.verifiedCoins || 0) + Number(stats.verifiedKeys || 0) * 2 + 5) return { ok: false, reason: "Combo exceeds verified run events" };
  if (score > distance * 80 + Number(stats.verifiedCoins || 0) * 100 + Number(stats.verifiedKeys || 0) * 500 + obstacles * 250 + 5000) return { ok: false, reason: "Score exceeds verified run activity" };
  return { ok: true };
}

module.exports = { EVENT_LIMITS, createRunToken, hashRunToken, tokenMatches, validateRunEvent, validateCompletionTelemetry };
