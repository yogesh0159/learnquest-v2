const rateLimit = require("express-rate-limit");

// General ceiling for all API traffic — generous, just stops runaway/abusive
// clients (a real game session legitimately fires many requests/minute).
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down and try again shortly." },
});

// Tight limiter for auth endpoints. Child PIN is only 4 digits (10,000
// combinations), so this is the main defense against a brute-force guess.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});

// Extra-tight limiter specifically for child PIN login, keyed by childId so
// one child's lockout doesn't affect siblings sharing a device/IP.
const pinLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.childId || "")}`,
  message: { error: "Too many PIN attempts. Please wait a few minutes and try again." },
});

module.exports = { apiLimiter, authLimiter, pinLoginLimiter };
