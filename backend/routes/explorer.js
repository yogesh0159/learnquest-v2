// LOCAL EXPLORER ONLY (mounted by server.js when LQ_EXPLORER=1). Lets a signed-in parent unlock every level for
// their own children so all worlds can be tested without first playing through the Jungle. Never mounted in production.
const express = require("express");
const { nanoid } = require("nanoid");
const db = require("../db");
const { requireAuth } = require("../utils/auth");
const asyncRoute = require("../utils/async-route");

const router = express.Router();

router.post("/unlock-levels", requireAuth("parent"), asyncRoute(async (req, res) => {
  const children = await db.all("SELECT id FROM children WHERE parent_id = ?", [req.user.id]);
  const levels = await db.all("SELECT id FROM game_levels");
  let changed = 0;
  for (const child of children) {
    for (const level of levels) {
      const row = await db.one("SELECT id, status FROM child_level_progress WHERE child_id = ? AND level_id = ?", [child.id, level.id]);
      if (!row) { await db.run("INSERT INTO child_level_progress (id, child_id, level_id, status) VALUES (?, ?, ?, ?)", [`clp_${nanoid(10)}`, child.id, level.id, "unlocked"]); changed++; }
      else if (row.status === "locked") { await db.run("UPDATE child_level_progress SET status = ? WHERE id = ?", ["unlocked", row.id]); changed++; }
    }
  }
  res.json({ ok: true, children: children.length, levels: levels.length, changed });
}));

module.exports = router;
