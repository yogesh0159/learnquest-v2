// One-off migration for the security upgrade that moved child PINs from
// plaintext to bcrypt hashes.
//
// Safe to run multiple times (idempotent):
//   - Widens the MySQL `children.pin` column if it's still the old VARCHAR(16).
//   - Hashes any child PIN that isn't already a bcrypt hash.
//
// Not required before deploying: routes/auth.js already upgrades a child's
// PIN to a bcrypt hash automatically the first time they log in after the
// upgrade. Run this manually only if you want every existing child's PIN
// hashed immediately instead of waiting for their next login, e.g.:
//   node db/migrate.js
require("dotenv").config();
const db = require("./index");
const { hashPin, isBcryptHash } = require("../utils/auth");
const logger = require("../utils/logger");

async function widenMysqlPinColumn() {
  if (db.getDialect() !== "mysql") return;
  try {
    await db.run("ALTER TABLE children MODIFY COLUMN pin VARCHAR(255) NOT NULL");
    logger.info("Widened children.pin column to VARCHAR(255)");
  } catch (err) {
    logger.warn({ err: err.message }, "Could not widen children.pin column (may already be correct size)");
  }
}

async function hashLegacyPins() {
  const children = await db.all("SELECT id, pin FROM children");
  let migrated = 0;
  for (const child of children) {
    if (isBcryptHash(child.pin)) continue;
    const hashed = await hashPin(child.pin);
    await db.run("UPDATE children SET pin = ? WHERE id = ?", [hashed, child.id]);
    migrated += 1;
  }
  logger.info({ migrated, total: children.length }, "Legacy PIN migration complete");
}

async function main() {
  await db.init();
  await widenMysqlPinColumn();
  await hashLegacyPins();
  await db.close();
}

main().catch((err) => {
  logger.error({ err: err.message }, "Migration failed");
  process.exit(1);
});
