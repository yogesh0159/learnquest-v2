const express = require("express");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const db = require("../db");
const { signToken, requireAuth, hashPin, verifyPin } = require("../utils/auth");
const asyncRoute = require("../utils/async-route");
const { authLimiter, pinLoginLimiter } = require("../utils/rate-limit");
const { isNonEmptyString, isValidEmail, isValidPassword, isValidPin, isOneOf, asString } = require("../utils/validate");

const router = express.Router();

function ageGroupFor(age) {
  if (age >= 4 && age <= 6) return "4-6";
  if (age >= 7 && age <= 9) return "7-9";
  if (age >= 10 && age <= 12) return "10-12";
  return null;
}

router.post("/parent/signup", authLimiter, asyncRoute(async (req, res) => {
  const name = asString(req.body?.name, { maxLength: 120 });
  const email = asString(req.body?.email, { maxLength: 255 }).toLowerCase();
  const password = String(req.body?.password || "");

  if (!isNonEmptyString(name, { maxLength: 120 }) || !isValidEmail(email) || !isValidPassword(password)) {
    return res.status(400).json({ error: "Valid name, email, and a password of at least 6 characters are required" });
  }

  const existing = await db.one("SELECT id FROM parents WHERE email = ?", [email]);
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const id = `parent_${nanoid(10)}`;
  const passwordHash = await bcrypt.hash(password, 10);
  await db.run(
    "INSERT INTO parents (id, name, email, password_hash) VALUES (?, ?, ?, ?)",
    [id, name, email, passwordHash]
  );

  const token = signToken({ id, role: "parent", name });
  res.status(201).json({ token, parent: { id, name, email } });
}));

router.post("/parent/login", authLimiter, asyncRoute(async (req, res) => {
  const email = asString(req.body?.email, { maxLength: 255 }).toLowerCase();
  const password = String(req.body?.password || "");
  const parent = email ? await db.one("SELECT * FROM parents WHERE email = ?", [email]) : null;

  // Always run bcrypt.compare, even with no matching row, against a dummy
  // hash — this keeps response timing consistent so an attacker can't use
  // timing differences to enumerate which emails are registered.
  const hashToCheck = parent?.password_hash || "$2a$10$CwTycUXWue0Thq9StjUM0uJ8vJ8j5G2wJvZ8YQ5Q5Z5Q5Q5Q5Q5Q5";
  const passwordOk = await bcrypt.compare(password, hashToCheck);

  if (!parent || !passwordOk) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken({ id: parent.id, role: "parent", name: parent.name });
  res.json({ token, parent: { id: parent.id, name: parent.name, email: parent.email } });
}));

router.post("/child/create", requireAuth("parent"), asyncRoute(async (req, res) => {
  const name = asString(req.body?.name, { maxLength: 120 });
  const age = Number(req.body?.age);
  const language = isOneOf(req.body?.language, ["en", "hi", "mr"]) ? req.body.language : "en";
  const avatar = asString(req.body?.avatar || "🦊", { maxLength: 32 });
  const pin = asString(req.body?.pin, { maxLength: 8 });
  const className = asString(req.body?.className, { maxLength: 80 });
  const ageGroup = ageGroupFor(age);

  if (!isNonEmptyString(name, { maxLength: 120 }) || !ageGroup || !isValidPin(pin)) {
    return res.status(400).json({ error: "Valid name, age (4-12), and a 4-digit PIN are required" });
  }

  // A valid JWT can become stale if a database is reset/replaced while the
  // browser still has the old session. Check the parent before inserting so
  // the foreign-key constraint never turns this into a generic 500 error.
  const parent = await db.one("SELECT id FROM parents WHERE id = ?", [req.user.id]);
  if (!parent) {
    return res.status(401).json({
      error: "Your parent session is no longer valid. Please sign in again.",
      code: "STALE_PARENT_SESSION",
    });
  }

  const id = `child_${nanoid(10)}`;
  const pinHash = await hashPin(pin);
  await db.transaction(async (tx) => {
    await tx.run(`
      INSERT INTO children (id, parent_id, name, age, age_group, class, language, avatar, pin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, req.user.id, name, age, ageGroup, className || null, language, avatar, pinHash]);

    const level1 = await tx.one("SELECT id FROM game_levels WHERE world_id = ? AND level_number = 1", ["jungle"]);
    if (level1) {
      await tx.run(
        "INSERT INTO child_level_progress (id, child_id, level_id, status) VALUES (?, ?, ?, ?)",
        [`clp_${nanoid(10)}`, id, level1.id, "unlocked"]
      );
    }

    const starterReward = await tx.one("SELECT id FROM rewards WHERE id = ?", ["reward_forest_fox"]);
    if (starterReward) {
      await tx.run(
        "INSERT INTO child_rewards (id, child_id, reward_id) VALUES (?, ?, ?)",
        [`cr_${nanoid(10)}`, id, starterReward.id]
      );
      await tx.run(
        "INSERT INTO child_equipped_rewards (id, child_id, slot, reward_id) VALUES (?, ?, ?, ?)",
        [`cer_${nanoid(10)}`, id, "character", starterReward.id]
      );
    }
  });

  res.status(201).json({ child: { id, name, age, age_group: ageGroup, language, avatar } });
}));

router.get("/child/list", requireAuth("parent"), asyncRoute(async (req, res) => {
  const children = await db.all(
    "SELECT id, name, age, age_group, language, avatar, xp, coins, overall_level, streak_count FROM children WHERE parent_id = ? ORDER BY created_at ASC",
    [req.user.id]
  );
  res.json({ children });
}));

router.post("/child/login", pinLoginLimiter, asyncRoute(async (req, res) => {
  const childId = asString(req.body?.childId, { maxLength: 64 });
  const pin = asString(req.body?.pin, { maxLength: 8 });
  const child = childId ? await db.one("SELECT * FROM children WHERE id = ?", [childId]) : null;

  // Compare against a dummy bcrypt hash when the child doesn't exist, so
  // response timing doesn't leak whether a given childId is valid.
  const DUMMY_PIN_HASH = "$2a$08$CwTycUXWue0Thq9StjUM0uJ8vJ8j5G2wJvZ8YQ5Q5Z5Q5Q5Q5Q5Q5";
  const pinOk = await verifyPin(pin, child ? child.pin : DUMMY_PIN_HASH);

  if (!child || !pinOk) {
    return res.status(401).json({ error: "Invalid child ID or PIN" });
  }

  // Transparently upgrade a legacy plaintext PIN to a bcrypt hash the first
  // time this child logs in successfully after the security upgrade.
  if (!child.pin.startsWith("$2")) {
    const upgradedHash = await hashPin(pin);
    await db.run("UPDATE children SET pin = ? WHERE id = ?", [upgradedHash, child.id]);
  }

  const token = signToken({ id: child.id, role: "child", name: child.name, parentId: child.parent_id });
  res.json({
    token,
    child: {
      id: child.id,
      name: child.name,
      age: child.age,
      age_group: child.age_group,
      language: child.language,
      avatar: child.avatar,
      xp: Number(child.xp || 0),
      coins: Number(child.coins || 0),
      overall_level: Number(child.overall_level || 1),
      streak_count: Number(child.streak_count || 0),
    },
  });
}));

module.exports = router;
