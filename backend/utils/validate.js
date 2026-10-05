// Small dependency-free validation helpers shared across routes.
// Keeps request-parsing rules consistent instead of re-implementing
// ad-hoc String()/Number() checks in every route file.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN_RE = /^\d{4}$/;

function asString(value, { trim = true, maxLength = 500 } = {}) {
  let str = typeof value === "string" ? value : value == null ? "" : String(value);
  if (trim) str = str.trim();
  if (maxLength && str.length > maxLength) str = str.slice(0, maxLength);
  return str;
}

function isNonEmptyString(value, { minLength = 1, maxLength = 500 } = {}) {
  const str = asString(value, { maxLength: maxLength + 1 });
  return str.length >= minLength && str.length <= maxLength;
}

function isValidEmail(value) {
  const str = asString(value, { maxLength: 255 }).toLowerCase();
  return EMAIL_RE.test(str) && str.length <= 255;
}

function isValidPin(value) {
  return PIN_RE.test(asString(value, { trim: true, maxLength: 8 }));
}

function isValidPassword(value, { minLength = 6 } = {}) {
  const str = typeof value === "string" ? value : "";
  return str.length >= minLength && str.length <= 200;
}

function clampInt(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function isOneOf(value, allowed) {
  return allowed.includes(value);
}

module.exports = {
  asString,
  isNonEmptyString,
  isValidEmail,
  isValidPin,
  isValidPassword,
  clampInt,
  isOneOf,
};
