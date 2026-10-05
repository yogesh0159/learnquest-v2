const express = require("express");
const db = require("../db");
const { requireAuth } = require("../utils/auth");
const asyncRoute = require("../utils/async-route");

const router = express.Router();

router.get("/me", requireAuth("child"), asyncRoute(async (req, res) => {
  const child = await db.one("SELECT * FROM children WHERE id = ?", [req.user.id]);
  if (!child) return res.status(404).json({ error: "Child not found" });

  const worlds = await db.all("SELECT * FROM worlds ORDER BY sort_order");
  const levels = await db.all("SELECT * FROM game_levels ORDER BY world_id, level_number");
  const progress = await db.all("SELECT * FROM child_level_progress WHERE child_id = ?", [child.id]);
  const runStats = await db.all("SELECT * FROM level_run_stats WHERE child_id = ?", [child.id]);
  const equipped = await db.all(`
    SELECT e.slot, e.reward_id, r.type, r.emoji, r.name_en
    FROM child_equipped_rewards e
    JOIN rewards r ON r.id = e.reward_id
    WHERE e.child_id = ?
  `, [child.id]);

  const progressByLevel = Object.fromEntries(progress.map((p) => [p.level_id, p.status]));
  const statsByLevel = Object.fromEntries(runStats.map((s) => [s.level_id, s]));

  const levelsWithStatus = levels.map((level) => {
    const stats = statsByLevel[level.id];
    return {
      ...level,
      is_boss: Number(level.is_boss || 0),
      questions_required: Number(level.questions_required || 0),
      boss_hp: level.boss_hp == null ? null : Number(level.boss_hp),
      status: progressByLevel[level.id] || "locked",
      best_score: Number(stats?.best_score || 0),
      best_stars: Number(stats?.best_stars || 0),
      best_distance: Number(stats?.best_distance || 0),
      best_coins: Number(stats?.best_coins || 0),
      best_combo: Number(stats?.best_combo || 0),
      best_accuracy: Number(stats?.best_accuracy || 0),
      runs_completed: Number(stats?.runs_completed || 0),
    };
  });

  const levelsByWorld = {};
  for (const level of levelsWithStatus) {
    if (!levelsByWorld[level.world_id]) levelsByWorld[level.world_id] = [];
    levelsByWorld[level.world_id].push(level);
  }

  const worldsForChild = worlds.map((w) => {
    const worldLevels = levelsByWorld[w.id] || [];
    const implemented = Number(w.is_active || 0) === 1;
    const hasUnlockedProgress = worldLevels.some((level) => level.status === "unlocked" || level.status === "completed");
    const completedLevels = worldLevels.filter((level) => level.status === "completed").length;
    return {
      ...w,
      is_active: implemented ? 1 : 0,
      is_unlocked: implemented && (w.id === "jungle" || hasUnlockedProgress) ? 1 : 0,
      sort_order: Number(w.sort_order || 0),
      completed_levels: completedLevels,
      total_levels: worldLevels.length,
    };
  });

  res.json({
    child: {
      id: child.id,
      name: child.name,
      age: Number(child.age),
      age_group: child.age_group,
      language: child.language,
      avatar: child.avatar,
      xp: Number(child.xp || 0),
      coins: Number(child.coins || 0),
      overall_level: Number(child.overall_level || 1),
      streak_count: Number(child.streak_count || 0),
    },
    worlds: worldsForChild,
    levelsByWorld,
    jungleLevels: levelsByWorld.jungle || [],
    mathsKingdomLevels: levelsByWorld.maths_kingdom || [],
    equippedRewards: equipped.map((r) => ({
      slot: r.slot,
      reward_id: r.reward_id,
      type: r.type,
      emoji: r.emoji,
      name: r.name_en,
    })),
  });
}));

router.put("/me", requireAuth("child"), asyncRoute(async (req, res) => {
  const fields = [];
  const values = [];
  if (["en", "hi", "mr"].includes(req.body?.language)) {
    fields.push("language = ?");
    values.push(req.body.language);
  }
  if (req.body?.avatar) {
    fields.push("avatar = ?");
    values.push(String(req.body.avatar).slice(0, 32));
  }
  if (fields.length === 0) return res.status(400).json({ error: "Nothing to update" });

  values.push(req.user.id);
  await db.run(`UPDATE children SET ${fields.join(", ")} WHERE id = ?`, values);
  res.json({ ok: true });
}));

module.exports = router;
