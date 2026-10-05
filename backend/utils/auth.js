const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  // Fail fast instead of silently running a child-facing app on a guessable
  // shared secret. A warning was easy to miss in Railway deploy logs.
  throw new Error(
    "JWT_SECRET is required when NODE_ENV=production. Set it in your Railway service variables before deploying."
  );
}

const JWT_SECRET = process.env.JWT_SECRET || "learnquest_dev_secret_change_me";

// bcrypt hash prefixes ($2a$, $2b$, $2y$) — used to detect whether a stored
// PIN/password value is already hashed (for the legacy-PIN migration).
const BCRYPT_HASH_RE = /^\$2[aby]\$/;

function isBcryptHash(value) {
  return typeof value === "string" && BCRYPT_HASH_RE.test(value);
}

async function hashPin(pin) {
  // A 4-digit PIN has low entropy regardless of cost factor, so a lighter
  // cost (8) keeps child login snappy while still removing plaintext storage
  // and rainbow-table risk from a DB leak.
  return bcrypt.hash(String(pin), 8);
}

async function verifyPin(pin, hashOrPlain) {
  if (isBcryptHash(hashOrPlain)) {
    return bcrypt.compare(String(pin), hashOrPlain);
  }
  // Legacy plaintext PIN (pre-upgrade record that hasn't been migrated yet).
  return String(pin) === String(hashOrPlain);
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function requireAuth(role) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing auth token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (role && decoded.role !== role) {
        return res.status(403).json({ error: `Requires ${role} role` });
      }
      req.user = decoded;
      next();
    } catch (e) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

module.exports = { signToken, requireAuth, hashPin, verifyPin, isBcryptHash };
