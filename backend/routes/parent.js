const express = require("express");
const { nanoid } = require("nanoid");
const db = require("../db");
const { requireAuth } = require("../utils/auth");
const asyncRoute = require("../utils/async-route");

const router = express.Router();

async function ownsChild(parentId, childId, dbApi = db) {
  return dbApi.one("SELECT id FROM children WHERE id = ? AND parent_id = ?", [childId, parentId]);
}

function pct(correct, attempted) {
  const a = Number(attempted || 0);
  return a ? Math.round((Number(correct || 0) / a) * 100) : null;
}

function buildLearningPlan({ subjectStats, topicStats, last7 }) {
  const weekly = last7.reduce((acc, row) => {
    acc.questionsAttempted += Number(row.questions_attempted || 0);
    acc.questionsCorrect += Number(row.questions_correct || 0);
    acc.gameMinutes += Number(row.minutes_game || 0);
    const active = Number(row.questions_attempted || 0) > 0 || Number(row.minutes_game || 0) > 0;
    if (active) acc.activeDays += 1;
    return acc;
  }, { questionsAttempted: 0, questionsCorrect: 0, gameMinutes: 0, activeDays: 0 });
  weekly.accuracy = pct(weekly.questionsCorrect, weekly.questionsAttempted);

  const normalizedSubjects = subjectStats.map((row) => ({
    subject: row.name_en,
    attempted: Number(row.attempted || 0),
    correct: Number(row.correct || 0),
    accuracy: pct(row.correct, row.attempted),
  }));

  const normalizedTopics = topicStats.map((row) => ({
    topic: row.topic,
    subject: row.subject,
    attempted: Number(row.attempted || 0),
    correct: Number(row.correct || 0),
    accuracy: pct(row.correct, row.attempted),
  }));

  const focusTopics = normalizedTopics
    .filter((row) => row.attempted >= 2 && row.accuracy !== null && row.accuracy < 70)
    .sort((a, b) => (a.accuracy - b.accuracy) || (b.attempted - a.attempted))
    .slice(0, 3);

  const strongSubjects = normalizedSubjects
    .filter((row) => row.attempted >= 4 && row.accuracy !== null && row.accuracy >= 80)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 3);

  let momentum = "building";
  if (weekly.activeDays >= 5) momentum = "strong";
  else if (weekly.activeDays <= 1) momentum = "needs_routine";

  let dailyPracticeMinutes = 10;
  if (focusTopics.length >= 2) dailyPracticeMinutes = 15;
  else if (weekly.questionsAttempted < 12) dailyPracticeMinutes = 12;

  return {
    weekly,
    focusTopics,
    strongSubjects,
    momentum,
    dailyPracticeMinutes,
    hasEnoughData: weekly.questionsAttempted >= 5,
  };
}

router.get("/dashboard/:childId", requireAuth("parent"), asyncRoute(async (req, res) => {
  if (!(await ownsChild(req.user.id, req.params.childId))) {
    return res.status(403).json({ error: "Not your child profile" });
  }

  const childRow = await db.one("SELECT * FROM children WHERE id = ?", [req.params.childId]);
  const subjectStats = await db.all(`
    SELECT s.id AS subject_id, s.name_en,
      COUNT(ql.id) AS attempted,
      COALESCE(SUM(ql.correct), 0) AS correct
    FROM question_log ql
    JOIN questions q ON q.id = ql.question_id
    JOIN subjects s ON s.id = q.subject_id
    WHERE ql.child_id = ?
    GROUP BY s.id, s.name_en
  `, [req.params.childId]);

  const topicStats = await db.all(`
    SELECT q.topic, s.name_en AS subject,
      COUNT(ql.id) AS attempted,
      COALESCE(SUM(ql.correct), 0) AS correct
    FROM question_log ql
    JOIN questions q ON q.id = ql.question_id
    JOIN subjects s ON s.id = q.subject_id
    WHERE ql.child_id = ?
    GROUP BY q.topic, s.name_en
    HAVING COUNT(ql.id) >= 2
  `, [req.params.childId]);

  const weakTopics = topicStats
    .map((row) => {
      const attempted = Number(row.attempted || 0);
      const correct = Number(row.correct || 0);
      return { ...row, attempted, correct, accuracy: attempted ? Math.round((correct / attempted) * 100) : 0 };
    })
    .filter((row) => row.accuracy < 60)
    .sort((a, b) => a.accuracy - b.accuracy || b.attempted - a.attempted);

  const last7 = await db.all(`
    SELECT * FROM daily_activity WHERE child_id = ?
    ORDER BY activity_date DESC LIMIT 7
  `, [req.params.childId]);

  const runnerRows = await db.all(`
    SELECT l.world_id, w.name_en AS world_name, w.sort_order AS world_sort_order,
      l.level_number, l.name_en, s.best_score, s.best_stars, s.best_accuracy, s.runs_completed
    FROM level_run_stats s
    JOIN game_levels l ON l.id = s.level_id
    JOIN worlds w ON w.id = l.world_id
    WHERE s.child_id = ?
    ORDER BY w.sort_order ASC, l.level_number ASC
  `, [req.params.childId]);
  const runTotals = await db.one(`
    SELECT COUNT(*) AS total_runs, COALESCE(SUM(obstacles_dodged), 0) AS obstacles_dodged,
      COALESCE(MAX(score), 0) AS best_score, COALESCE(MAX(stars_earned), 0) AS best_stars
    FROM game_runs WHERE child_id = ?
  `, [req.params.childId]);
  const missionRows = await db.all(`
    SELECT a.mission_id, a.skill, COUNT(*) AS attempts, COALESCE(SUM(a.correct), 0) AS correct,
      MAX(a.answered_at) AS last_practised_at,
      COUNT(DISTINCT CASE WHEN ms.status = 'completed' THEN ms.id END) AS sessions_completed
    FROM mission_attempts a JOIN mission_sessions ms ON ms.id = a.session_id
    WHERE a.child_id = ? GROUP BY a.mission_id, a.skill ORDER BY a.mission_id, a.skill
  `, [req.params.childId]);

  const normalizedStats = subjectStats.map((row) => ({
    subject: row.name_en,
    attempted: Number(row.attempted || 0),
    correct: Number(row.correct || 0),
  }));
  const totalAttempted = normalizedStats.reduce((sum, row) => sum + row.attempted, 0);
  const totalCorrect = normalizedStats.reduce((sum, row) => sum + row.correct, 0);
  const learningPlan = buildLearningPlan({ subjectStats, topicStats, last7 });

  res.json({
    child: {
      id: childRow.id,
      name: childRow.name,
      age: Number(childRow.age),
      language: childRow.language,
      avatar: childRow.avatar,
      xp: Number(childRow.xp || 0),
      coins: Number(childRow.coins || 0),
      overall_level: Number(childRow.overall_level || 1),
      streak_count: Number(childRow.streak_count || 0),
    },
    overallAccuracy: totalAttempted ? Math.round((totalCorrect / totalAttempted) * 100) : null,
    subjectStats: normalizedStats.map((row) => ({
      ...row,
      accuracy: row.attempted ? Math.round((row.correct / row.attempted) * 100) : null,
    })),
    weakTopics,
    learningPlan,
    last7Days: last7,
    runner: {
      totalRuns: Number(runTotals?.total_runs || 0),
      obstaclesDodged: Number(runTotals?.obstacles_dodged || 0),
      bestScore: Number(runTotals?.best_score || 0),
      bestStars: Number(runTotals?.best_stars || 0),
      levels: runnerRows.map((r) => ({
        world_id: r.world_id, world_name: r.world_name,
        level_number: Number(r.level_number), name: r.name_en, best_score: Number(r.best_score || 0),
        best_stars: Number(r.best_stars || 0), best_accuracy: Number(r.best_accuracy || 0), runs_completed: Number(r.runs_completed || 0),
      })),
    },
    realWorldMissions: missionRows.map((row) => {
      const attempts = Number(row.attempts || 0);
      const correct = Number(row.correct || 0);
      return {
        missionId: row.mission_id, skill: row.skill, attempts, correct,
        mistakes: Math.max(0, attempts - correct),
        accuracy: attempts ? Math.round((correct / attempts) * 100) : null,
        sessionsCompleted: Number(row.sessions_completed || 0),
        lastPractisedAt: row.last_practised_at || null,
      };
    }),
  });
}));

router.post("/tasks", requireAuth("parent"), asyncRoute(async (req, res) => {
  const childId = String(req.body?.childId || "");
  const title = String(req.body?.title || "").trim().slice(0, 160);
  const description = String(req.body?.description || "").trim().slice(0, 1000);
  const rewardType = "coins";
  const rewardValue = Math.max(0, Math.min(10000, Number(req.body?.rewardValue || 0)));

  if (!(await ownsChild(req.user.id, childId))) return res.status(403).json({ error: "Not your child profile" });
  if (!title) return res.status(400).json({ error: "title is required" });

  const id = `task_${nanoid(10)}`;
  await db.run(`
    INSERT INTO parent_tasks (id, parent_id, child_id, title, description, reward_type, reward_value)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, req.user.id, childId, title, description, rewardType, rewardValue]);

  res.status(201).json({ ok: true, taskId: id });
}));

router.post("/tasks/:id/review", requireAuth("parent"), asyncRoute(async (req, res) => {
  const decision = String(req.body?.decision || "").trim().toLowerCase();
  if (!["approve", "reject"].includes(decision)) {
    return res.status(400).json({ error: "decision must be approve or reject" });
  }

  const result = await db.transaction(async (tx) => {
    const task = await tx.one(
      "SELECT * FROM parent_tasks WHERE id = ? AND parent_id = ?",
      [req.params.id, req.user.id]
    );
    if (!task) { const err = new Error("Task not found"); err.status = 404; throw err; }

    if (decision === "reject") {
      if (task.status === "completed") {
        const err = new Error("Approved tasks cannot be sent back"); err.status = 409; throw err;
      }
      if (task.status !== "submitted") {
        return { ok: true, status: task.status, noChange: true };
      }
      await tx.run(
        "UPDATE parent_tasks SET status = ?, completed_at = NULL WHERE id = ? AND parent_id = ?",
        ["pending", task.id, req.user.id]
      );
      return { ok: true, status: "pending", rewardReleased: false };
    }

    if (task.status === "completed") {
      const child = await tx.one("SELECT coins FROM children WHERE id = ?", [task.child_id]);
      return { ok: true, status: "completed", alreadyApproved: true, newCoins: Number(child?.coins || 0) };
    }
    if (task.status !== "submitted") {
      const err = new Error("The child must submit this task before it can be approved");
      err.status = 409;
      throw err;
    }

    // The status transition and reward happen in the same transaction. Because
    // only submitted tasks can reach this branch, repeated approval cannot pay twice.
    await tx.run(
      "UPDATE parent_tasks SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ? AND parent_id = ?",
      ["completed", task.id, req.user.id]
    );
    if (task.reward_type === "coins") {
      await tx.run(
        "UPDATE children SET coins = coins + ? WHERE id = ?",
        [Math.max(0, Number(task.reward_value || 0)), task.child_id]
      );
    }
    const child = await tx.one("SELECT coins FROM children WHERE id = ?", [task.child_id]);
    return {
      ok: true,
      status: "completed",
      rewardReleased: true,
      rewardType: task.reward_type,
      rewardValue: Number(task.reward_value || 0),
      newCoins: Number(child?.coins || 0),
    };
  });

  res.json(result);
}));

router.get("/tasks/:childId", requireAuth("parent"), asyncRoute(async (req, res) => {
  if (!(await ownsChild(req.user.id, req.params.childId))) return res.status(403).json({ error: "Not your child profile" });
  const tasks = await db.all(
    "SELECT * FROM parent_tasks WHERE child_id = ? ORDER BY created_at DESC",
    [req.params.childId]
  );
  res.json({ tasks });
}));

module.exports = router;
module.exports.buildLearningPlan = buildLearningPlan;
