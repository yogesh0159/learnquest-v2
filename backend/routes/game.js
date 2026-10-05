const express = require("express");
const { nanoid } = require("nanoid");
const db = require("../db");
const { requireAuth } = require("../utils/auth");
const asyncRoute = require("../utils/async-route");
const { createRunToken, hashRunToken, tokenMatches, validateRunEvent, validateCompletionTelemetry } = require("../utils/run-integrity");
const { EXTRA_THINK_TIME_COST_PER_SECOND, completedPaidSeconds } = require("../utils/think-time");

const router = express.Router();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function clampNumber(value, min, max, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function missionForLevel(levelNumber, isBoss = false, worldId = "jungle") {
  const n = Number(levelNumber || 1);
  if (worldId === "maths_kingdom") {
    if (isBoss) return { keyTarget: 4, coinTarget: 45, label: "Defeat the Number Dragon" };
    if (n === 1) return { keyTarget: 2, coinTarget: 18, label: "Enter the Maths Kingdom" };
    if (n <= 3) return { keyTarget: 2, coinTarget: 22, label: "Collect the royal number seals" };
    if (n <= 6) return { keyTarget: 3, coinTarget: 28, label: "Cross the castle challenge halls" };
    return { keyTarget: 4, coinTarget: 36, label: "Reach the Dragon Tower" };
  }
  if (isBoss) return { keyTarget: 3, coinTarget: 35, label: "Defeat the Jungle Guardian" };
  if (n === 1) return { keyTarget: 1, coinTarget: 12, label: "Learn the runner controls" };
  if (n <= 3) return { keyTarget: 2, coinTarget: 18, label: "Collect the golden keys" };
  if (n <= 6) return { keyTarget: 3, coinTarget: 24, label: "Survive the jungle trail" };
  return { keyTarget: 3, coinTarget: 30, label: "Reach the ancient temple" };
}

async function bumpStreak(tx, child) {
  const today = todayStr();
  const lastActive = child.last_active_date ? String(child.last_active_date).slice(0, 10) : null;
  if (lastActive === today) return Number(child.streak_count || 0);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = lastActive === yesterday ? Number(child.streak_count || 0) + 1 : 1;
  await tx.run("UPDATE children SET streak_count = ?, last_active_date = ? WHERE id = ?", [newStreak, today, child.id]);
  return newStreak;
}

async function ensureDailyActivity(tx, childId) {
  const date = todayStr();
  let existing = await tx.one(
    "SELECT * FROM daily_activity WHERE child_id = ? AND activity_date = ?",
    [childId, date]
  );
  if (!existing) {
    const id = `da_${nanoid(10)}`;
    await tx.run(
      "INSERT INTO daily_activity (id, child_id, activity_date) VALUES (?, ?, ?)",
      [id, childId, date]
    );
    existing = await tx.one("SELECT * FROM daily_activity WHERE id = ?", [id]);
  }
  return existing;
}

async function logDailyQuestion(tx, childId, correct) {
  const row = await ensureDailyActivity(tx, childId);
  await tx.run(`
    UPDATE daily_activity
    SET questions_attempted = questions_attempted + 1,
        questions_correct = questions_correct + ?
    WHERE id = ?
  `, [correct ? 1 : 0, row.id]);
}

async function logDailyGameMinutes(tx, childId, durationSeconds) {
  const row = await ensureDailyActivity(tx, childId);
  const minutes = Math.min(60, Math.max(1, Math.ceil(clampNumber(durationSeconds, 1, 3600, 60) / 60)));
  await tx.run(
    "UPDATE daily_activity SET minutes_game = minutes_game + ? WHERE id = ?",
    [minutes, row.id]
  );
}

async function unlockNextLevel(tx, childId, level) {
  let nextLevel = await tx.one(
    "SELECT * FROM game_levels WHERE world_id = ? AND level_number = ?",
    [level.world_id, Number(level.level_number) + 1]
  );

  // If this was the final level of a world, continue into the next implemented
  // world. This keeps progression seamless as new worlds are activated later.
  if (!nextLevel) {
    const currentWorld = await tx.one("SELECT sort_order FROM worlds WHERE id = ?", [level.world_id]);
    if (currentWorld) {
      const nextWorld = await tx.one(
        "SELECT * FROM worlds WHERE is_active = 1 AND sort_order > ? ORDER BY sort_order ASC LIMIT 1",
        [Number(currentWorld.sort_order || 0)]
      );
      if (nextWorld) {
        nextLevel = await tx.one(
          "SELECT * FROM game_levels WHERE world_id = ? ORDER BY level_number ASC LIMIT 1",
          [nextWorld.id]
        );
      }
    }
  }

  if (!nextLevel) return null;

  const nextProgress = await tx.one(
    "SELECT * FROM child_level_progress WHERE child_id = ? AND level_id = ?",
    [childId, nextLevel.id]
  );

  if (!nextProgress) {
    await tx.run(
      "INSERT INTO child_level_progress (id, child_id, level_id, status) VALUES (?, ?, ?, ?)",
      [`clp_${nanoid(10)}`, childId, nextLevel.id, "unlocked"]
    );
    return nextLevel.id;
  }

  if (nextProgress.status === "locked") {
    await tx.run(
      "UPDATE child_level_progress SET status = ? WHERE child_id = ? AND level_id = ?",
      ["unlocked", childId, nextLevel.id]
    );
    return nextLevel.id;
  }

  return null;
}

async function updateBestStats(tx, childId, levelId, stats) {
  const existing = await tx.one(
    "SELECT * FROM level_run_stats WHERE child_id = ? AND level_id = ?",
    [childId, levelId]
  );

  if (!existing) {
    await tx.run(`
      INSERT INTO level_run_stats
      (id, child_id, level_id, best_score, best_stars, best_distance, best_coins, best_combo, best_accuracy, runs_completed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `lrs_${nanoid(10)}`,
      childId,
      levelId,
      stats.score,
      stats.stars,
      stats.distance,
      stats.coins,
      stats.combo,
      stats.accuracy,
      stats.completed ? 1 : 0,
    ]);
    return;
  }

  await tx.run(`
    UPDATE level_run_stats
    SET best_score = ?, best_stars = ?, best_distance = ?, best_coins = ?,
        best_combo = ?, best_accuracy = ?, runs_completed = runs_completed + ?, updated_at = CURRENT_TIMESTAMP
    WHERE child_id = ? AND level_id = ?
  `, [
    Math.max(Number(existing.best_score || 0), stats.score),
    Math.max(Number(existing.best_stars || 0), stats.stars),
    Math.max(Number(existing.best_distance || 0), stats.distance),
    Math.max(Number(existing.best_coins || 0), stats.coins),
    Math.max(Number(existing.best_combo || 0), stats.combo),
    Math.max(Number(existing.best_accuracy || 0), stats.accuracy),
    stats.completed ? 1 : 0,
    childId,
    levelId,
  ]);
}

async function getPlayableRun(tx, runId, childId) {
  const run = await tx.one(
    "SELECT * FROM game_runs WHERE id = ? AND child_id = ?",
    [runId, childId]
  );
  if (!run) {
    const err = new Error("Run not found");
    err.status = 404;
    throw err;
  }
  return run;
}

function requireRunToken(run, token) {
  if (!tokenMatches(token, run.integrity_token_hash)) {
    const err = new Error("Run integrity token is invalid"); err.status = 403; throw err;
  }
}

async function verifiedFocusData(tx, body, childId) {
  const runId = String(body?.runId || "").trim();
  const questionId = String(body?.questionId || "").trim();
  if (!runId || !questionId) { const err = new Error("runId and questionId are required"); err.status = 400; throw err; }
  const run = await getPlayableRun(tx, runId, childId);
  requireRunToken(run, body?.runToken);
  if (run.status !== "active") { const err = new Error("This run is no longer active"); err.status = 409; throw err; }
  const level = await tx.one("SELECT * FROM game_levels WHERE id = ?", [run.level_id]);
  const child = await tx.one("SELECT * FROM children WHERE id = ?", [childId]);
  const question = await tx.one("SELECT * FROM questions WHERE id = ?", [questionId]);
  if (!level || !child || !question || question.subject_id !== level.gate_subject_id || question.age_group !== child.age_group) {
    const err = new Error("Question does not belong to this run"); err.status = 400; throw err;
  }
  const answered = await tx.one("SELECT id FROM game_run_answers WHERE run_id = ? AND question_id = ?", [runId, questionId]);
  if (answered) { const err = new Error("This checkpoint is already resolved"); err.status = 409; throw err; }
  return { run, child, questionId };
}

router.post("/runner/focus/start", requireAuth("child"), asyncRoute(async (req, res) => {
  const result = await db.transaction(async (tx) => {
    const { run, child, questionId } = await verifiedFocusData(tx, req.body, req.user.id);
    await tx.run("UPDATE game_run_think_time SET active = 0, ended_at = CURRENT_TIMESTAMP WHERE run_id = ? AND active = 1 AND question_id <> ?", [run.id, questionId]);
    let focus = await tx.one("SELECT * FROM game_run_think_time WHERE run_id = ? AND question_id = ?", [run.id, questionId]);
    if (!focus) {
      await tx.run("INSERT INTO game_run_think_time (id, run_id, question_id, started_at_ms) VALUES (?, ?, ?, ?)", [`gtt_${nanoid(12)}`, run.id, questionId, Date.now()]);
      focus = await tx.one("SELECT * FROM game_run_think_time WHERE run_id = ? AND question_id = ?", [run.id, questionId]);
    }
    if (!Number(focus.active)) { const err = new Error("Learning Focus has already ended"); err.status = 409; throw err; }
    return { balance: Number(child.coins || 0), paidSeconds: Number(focus.paid_seconds || 0) };
  });
  res.json(result);
}));

router.post("/runner/focus/charge", requireAuth("child"), asyncRoute(async (req, res) => {
  const result = await db.transaction(async (tx) => {
    const { run, questionId } = await verifiedFocusData(tx, req.body, req.user.id);
    // A harmless update takes a row lock in MySQL and serializes retries; SQLite
    // transactions are serialized by the adapter. The client never supplies cost.
    await tx.run("UPDATE game_run_think_time SET paid_seconds = paid_seconds WHERE run_id = ? AND question_id = ?", [run.id, questionId]);
    const focus = await tx.one("SELECT * FROM game_run_think_time WHERE run_id = ? AND question_id = ?", [run.id, questionId]);
    if (!focus || !Number(focus.active)) { const err = new Error("Learning Focus is not active"); err.status = 409; throw err; }
    const chargeable = completedPaidSeconds(Date.now() - Number(focus.started_at_ms));
    let paidSeconds = Number(focus.paid_seconds || 0);
    if (chargeable > paidSeconds) {
      const deduction = await tx.run("UPDATE children SET coins = coins - ? WHERE id = ? AND coins >= ?", [EXTRA_THINK_TIME_COST_PER_SECOND, req.user.id, EXTRA_THINK_TIME_COST_PER_SECOND]);
      if (!deduction.changes) {
        await tx.run("UPDATE game_run_think_time SET active = 0, ended_at = CURRENT_TIMESTAMP WHERE id = ?", [focus.id]);
        const child = await tx.one("SELECT coins FROM children WHERE id = ?", [req.user.id]);
        return { afforded: false, balance: Number(child.coins || 0), paidSeconds };
      }
      paidSeconds++;
      await tx.run("UPDATE game_run_think_time SET paid_seconds = ? WHERE id = ?", [paidSeconds, focus.id]);
    }
    const child = await tx.one("SELECT coins FROM children WHERE id = ?", [req.user.id]);
    return { afforded: true, balance: Number(child.coins || 0), paidSeconds };
  });
  res.json(result);
}));

router.post("/runner/focus/end", requireAuth("child"), asyncRoute(async (req, res) => {
  await db.transaction(async (tx) => {
    const { run, questionId } = await verifiedFocusData(tx, req.body, req.user.id);
    await tx.run("UPDATE game_run_think_time SET active = 0, ended_at = CURRENT_TIMESTAMP WHERE run_id = ? AND question_id = ? AND active = 1", [run.id, questionId]);
  });
  res.json({ ended: true });
}));

router.post("/runner/start", requireAuth("child"), asyncRoute(async (req, res) => {
  const levelId = String(req.body?.levelId || "").trim();
  if (!levelId) return res.status(400).json({ error: "levelId is required" });

  const result = await db.transaction(async (tx) => {
    const level = await tx.one("SELECT * FROM game_levels WHERE id = ?", [levelId]);
    if (!level) {
      const err = new Error("Level not found"); err.status = 404; throw err;
    }

    const progress = await tx.one(
      "SELECT * FROM child_level_progress WHERE child_id = ? AND level_id = ?",
      [req.user.id, levelId]
    );
    if (!progress || progress.status === "locked") {
      const err = new Error("This level is locked"); err.status = 403; throw err;
    }

    await tx.run(
      "UPDATE game_runs SET status = 'abandoned', finished_at = CURRENT_TIMESTAMP WHERE child_id = ? AND status = 'active'",
      [req.user.id]
    );
    const runId = `run_${nanoid(14)}`;
    const runToken = createRunToken();
    await tx.run(
      "INSERT INTO game_runs (id, child_id, level_id, status, integrity_token_hash) VALUES (?, ?, ?, ?, ?)",
      [runId, req.user.id, levelId, "active", hashRunToken(runToken)]
    );

    return {
      runId,
      runToken,
      mission: missionForLevel(level.level_number, Number(level.is_boss || 0) === 1, level.world_id),
      questionCount: Number(level.questions_required || 3),
      isBoss: Number(level.is_boss || 0) === 1,
      bossHp: Number(level.boss_hp || 5),
    };
  });

  res.status(201).json(result);
}));

router.post("/runner/answer", requireAuth("child"), asyncRoute(async (req, res) => {
  const runId = String(req.body?.runId || "").trim();
  const questionId = String(req.body?.questionId || "").trim();
  const selectedIndex = Number(req.body?.selectedIndex);
  if (!runId || !questionId || !Number.isInteger(selectedIndex)) {
    return res.status(400).json({ error: "runId, questionId and selectedIndex are required" });
  }

  const result = await db.transaction(async (tx) => {
    const run = await getPlayableRun(tx, runId, req.user.id);
    requireRunToken(run, req.body?.runToken);
    if (run.status !== "active") {
      const err = new Error("This run is no longer active"); err.status = 409; throw err;
    }

    const level = await tx.one("SELECT * FROM game_levels WHERE id = ?", [run.level_id]);
    const child = await tx.one("SELECT * FROM children WHERE id = ?", [req.user.id]);
    const question = await tx.one("SELECT * FROM questions WHERE id = ?", [questionId]);
    if (!level || !child || !question) {
      const err = new Error("Runner data not found"); err.status = 404; throw err;
    }
    if (question.subject_id !== level.gate_subject_id || question.age_group !== child.age_group) {
      const err = new Error("Question does not belong to this level"); err.status = 400; throw err;
    }

    await tx.run(
      "UPDATE game_run_think_time SET active = 0, ended_at = CURRENT_TIMESTAMP WHERE run_id = ? AND question_id = ? AND active = 1",
      [runId, questionId]
    );

    const duplicate = await tx.one(
      "SELECT * FROM game_run_answers WHERE run_id = ? AND question_id = ?",
      [runId, questionId]
    );
    if (duplicate) {
      return {
        correct: Number(duplicate.correct || 0) === 1,
        duplicate: true,
        explanation: "Already answered in this run.",
      };
    }

    const correct = selectedIndex === Number(question.correct_index);
    await tx.run(`
      INSERT INTO game_run_answers (id, run_id, question_id, selected_index, correct)
      VALUES (?, ?, ?, ?, ?)
    `, [`gra_${nanoid(12)}`, runId, questionId, selectedIndex, correct ? 1 : 0]);

    await tx.run(`
      INSERT INTO question_log (id, child_id, question_id, level_id, correct)
      VALUES (?, ?, ?, ?, ?)
    `, [`ql_${nanoid(10)}`, child.id, question.id, level.id, correct ? 1 : 0]);
    await logDailyQuestion(tx, child.id, correct);

    const lang = ["en", "hi", "mr"].includes(child.language) ? child.language : "en";
    const options = JSON.parse(question.options_json);
    const rawCorrect = options[Number(question.correct_index)];
    const correctAnswer = rawCorrect && typeof rawCorrect === "object"
      ? (rawCorrect[lang] || rawCorrect.en || Object.values(rawCorrect)[0])
      : String(rawCorrect ?? "");

    return {
      correct,
      duplicate: false,
      explanation: question[`explanation_${lang}`] || question.explanation_en,
      correctAnswer,
      xpPotential: correct ? Number(question.xp_reward || 0) : 0,
    };
  });

  res.json(result);
}));

router.post("/runner/event", requireAuth("child"), asyncRoute(async (req, res) => {
  const runId = String(req.body?.runId || "").trim();
  const type = String(req.body?.type || "").trim();
  const amount = Number(req.body?.amount);
  const sequence = Number(req.body?.sequence);
  if (!runId) return res.status(400).json({ error: "runId is required" });
  const result = await db.transaction(async (tx) => {
    const run = await getPlayableRun(tx, runId, req.user.id);
    requireRunToken(run, req.body?.runToken);
    if (run.status !== "active") { const err = new Error("This run is no longer active"); err.status = 409; throw err; }
    const elapsedMs = Math.max(0, Date.now() - new Date(run.started_at).getTime());
    const check = validateRunEvent({ type, amount, sequence, previousSequence: run.event_sequence, elapsedMs, previousEventElapsedMs: run.last_event_elapsed_ms, previousEventType: run.last_event_type });
    if (!check.ok) { const err = new Error(check.reason); err.status = 409; throw err; }
    const column = { coin: "verified_coins", key: "verified_keys", obstacle: "verified_obstacles" }[type];
    await tx.run(`UPDATE game_runs SET event_sequence = ?, ${column} = ${column} + ?, last_event_elapsed_ms = ?, last_event_type = ? WHERE id = ?`, [sequence, amount, elapsedMs, type, run.id]);
    return { accepted: true, sequence };
  });
  res.json(result);
}));

router.post("/runner/crash", requireAuth("child"), asyncRoute(async (req, res) => {
  const runId = String(req.body?.runId || "").trim();
  if (!runId) return res.status(400).json({ error: "runId is required" });

  const result = await db.transaction(async (tx) => {
    const run = await getPlayableRun(tx, runId, req.user.id);
    requireRunToken(run, req.body?.runToken);
    if (run.status !== "active") return { ok: true, alreadyClosed: true };

    const distance = clampNumber(req.body?.distance, 0, 10000);
    const score = clampNumber(req.body?.score, 0, 10000000);
    const coins = clampNumber(req.body?.coins, 0, 500);
    const keys = clampNumber(req.body?.keys, 0, 20);
    const obstacles = clampNumber(req.body?.obstaclesDodged, 0, 1000);
    const combo = clampNumber(req.body?.maxCombo, 0, 1000);
    const durationSeconds = clampNumber(req.body?.durationSeconds, 1, 3600, 60);

    await tx.run(`
      UPDATE game_runs
      SET status = 'crashed', distance_run = ?, score = ?, run_coins = ?, keys_collected = ?,
          obstacles_dodged = ?, max_combo = ?, finished_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [distance, score, coins, keys, obstacles, combo, run.id]);
    await logDailyGameMinutes(tx, req.user.id, durationSeconds);

    const answers = await tx.all("SELECT correct FROM game_run_answers WHERE run_id = ?", [run.id]);
    const correct = answers.filter((a) => Number(a.correct || 0) === 1).length;
    const accuracy = answers.length ? Math.round((correct / answers.length) * 100) : 0;
    await updateBestStats(tx, req.user.id, run.level_id, {
      score, stars: 0, distance, coins, combo, accuracy, completed: false,
    });

    return { ok: true };
  });

  res.json(result);
}));

router.post("/runner/complete", requireAuth("child"), asyncRoute(async (req, res) => {
  const runId = String(req.body?.runId || "").trim();
  if (!runId) return res.status(400).json({ error: "runId is required" });

  const response = await db.transaction(async (tx) => {
    const run = await getPlayableRun(tx, runId, req.user.id);
    requireRunToken(run, req.body?.runToken);
    if (run.status !== "active") {
      const err = new Error("This run is already finished"); err.status = 409; throw err;
    }

    const level = await tx.one("SELECT * FROM game_levels WHERE id = ?", [run.level_id]);
    const child = await tx.one("SELECT * FROM children WHERE id = ?", [req.user.id]);
    const progress = await tx.one(
      "SELECT * FROM child_level_progress WHERE child_id = ? AND level_id = ?",
      [req.user.id, run.level_id]
    );
    if (!level || !child || !progress) {
      const err = new Error("Level progress not found"); err.status = 404; throw err;
    }

    const distance = clampNumber(req.body?.distance, 0, 10000);
    const score = clampNumber(req.body?.score, 0, 10000000);
    const runCoins = clampNumber(run.verified_coins, 0, 120);
    const keys = clampNumber(run.verified_keys, 0, 20);
    const obstacles = clampNumber(req.body?.obstaclesDodged, 0, 1000);
    const combo = clampNumber(req.body?.maxCombo, 0, 1000);
    const durationSeconds = clampNumber(req.body?.durationSeconds, 1, 3600, 60);
    const serverDurationSeconds = Math.max(1, Math.floor((Date.now() - new Date(run.started_at).getTime()) / 1000));
    const telemetry = validateCompletionTelemetry({ distance, score, combo, obstacles, verifiedCoins: runCoins, verifiedKeys: keys }, serverDurationSeconds);
    if (!telemetry.ok) { const err = new Error(telemetry.reason); err.status = 409; throw err; }

    const answerRows = await tx.all(`
      SELECT a.correct, q.xp_reward
      FROM game_run_answers a
      JOIN questions q ON q.id = a.question_id
      WHERE a.run_id = ?
    `, [run.id]);
    const attempted = answerRows.length;
    const correctCount = answerRows.filter((a) => Number(a.correct || 0) === 1).length;
    const questionXp = answerRows.reduce(
      (sum, a) => sum + (Number(a.correct || 0) === 1 ? Number(a.xp_reward || 0) : 0),
      0
    );

    const isBoss = Number(level.is_boss || 0) === 1;
    const configuredRequired = isBoss
      ? Number(level.boss_hp || 5)
      : Math.max(1, Math.ceil(Number(level.questions_required || 3) * 2 / 3));
    const requiredCorrect = Math.max(1, configuredRequired);
    const learningPassed = attempted >= requiredCorrect && correctCount >= requiredCorrect;

    const mission = missionForLevel(level.level_number, isBoss, level.world_id);
    const missionPassed = keys >= mission.keyTarget;
    const passed = learningPassed && missionPassed;
    const accuracy = attempted ? Math.round((correctCount / attempted) * 100) : 0;
    const wasCompleted = progress.status === "completed";

    let stars = 0;
    let bonusXp = 0;
    let completionCoins = 0;
    let newlyUnlockedLevelId = null;

    if (passed) {
      stars = 1;
      if (accuracy >= 80) stars += 1;
      if (keys >= mission.keyTarget && runCoins >= mission.coinTarget) stars += 1;

      if (!wasCompleted) {
        bonusXp = isBoss ? 250 : 120;
        completionCoins = isBoss ? 300 : 60;
      } else {
        bonusXp = isBoss ? 70 : 30;
        completionCoins = isBoss ? 80 : 20;
      }

      await tx.run(`
        UPDATE child_level_progress
        SET status = 'completed', attempts = attempts + 1, completed_at = CURRENT_TIMESTAMP
        WHERE child_id = ? AND level_id = ?
      `, [child.id, level.id]);
      newlyUnlockedLevelId = await unlockNextLevel(tx, child.id, level);
    } else {
      await tx.run(
        "UPDATE child_level_progress SET attempts = attempts + 1 WHERE child_id = ? AND level_id = ?",
        [child.id, level.id]
      );
    }

    const collectibleCoins = passed ? runCoins : 0;
    const keyBonus = passed ? Math.min(30, keys * 5) : 0;
    const totalXp = passed ? questionXp + bonusXp : 0;
    const totalCoins = passed ? completionCoins + collectibleCoins + keyBonus : 0;

    if (passed) {
      await tx.run(
        "UPDATE children SET xp = xp + ?, coins = coins + ? WHERE id = ?",
        [totalXp, totalCoins, child.id]
      );
    }
    const updated = await tx.one("SELECT xp, coins FROM children WHERE id = ?", [child.id]);
    const overallLevel = Math.max(1, Math.floor(Number(updated.xp || 0) / 200) + 1);
    await tx.run("UPDATE children SET overall_level = ? WHERE id = ?", [overallLevel, child.id]);
    const streak = passed ? await bumpStreak(tx, child) : Number(child.streak_count || 0);

    await tx.run(`
      UPDATE game_runs
      SET status = ?, distance_run = ?, score = ?, run_coins = ?, keys_collected = ?,
          obstacles_dodged = ?, max_combo = ?, stars_earned = ?, finished_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [passed ? "completed" : "mission_failed", distance, score, runCoins, keys, obstacles, combo, stars, run.id]);

    await logDailyGameMinutes(tx, child.id, durationSeconds);
    await updateBestStats(tx, child.id, level.id, {
      score, stars, distance, coins: runCoins, combo, accuracy, completed: passed,
    });

    return {
      passed,
      learningPassed,
      missionPassed,
      correctCount,
      attempted,
      requiredCorrect,
      accuracy,
      keyTarget: mission.keyTarget,
      coinTarget: mission.coinTarget,
      stars,
      xpEarned: totalXp,
      coinsEarned: totalCoins,
      newXp: Number(updated.xp || 0),
      newCoins: Number(updated.coins || 0),
      overallLevel,
      streak,
      newlyUnlockedLevelId,
      bossHpRemaining: isBoss ? Math.max(0, Number(level.boss_hp || 5) - correctCount) : null,
    };
  });

  res.json(response);
}));

// Legacy 2D gate endpoint kept for backwards compatibility with older clients.
router.post("/gate/attempt", requireAuth("child"), asyncRoute(async (req, res) => {
  const levelId = String(req.body?.levelId || "").trim();
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const runCoins = Math.min(10, Math.max(0, Number(req.body?.runCoins || 0)));

  if (!levelId || answers.length === 0) {
    return res.status(400).json({ error: "levelId and answers[] are required" });
  }

  const response = await db.transaction(async (tx) => {
    const level = await tx.one("SELECT * FROM game_levels WHERE id = ?", [levelId]);
    if (!level) { const err = new Error("Level not found"); err.status = 404; throw err; }
    const child = await tx.one("SELECT * FROM children WHERE id = ?", [req.user.id]);
    if (!child) { const err = new Error("Child not found"); err.status = 404; throw err; }
    const progress = await tx.one(
      "SELECT * FROM child_level_progress WHERE child_id = ? AND level_id = ?",
      [child.id, level.id]
    );
    if (!progress || progress.status === "locked") {
      const err = new Error("This level is locked"); err.status = 403; throw err;
    }

    let correctCount = 0;
    let xpFromQuestions = 0;
    const results = [];
    const seen = new Set();
    for (const answer of answers) {
      const questionId = String(answer?.questionId || "");
      if (!questionId || seen.has(questionId)) continue;
      seen.add(questionId);
      const q = await tx.one("SELECT * FROM questions WHERE id = ?", [questionId]);
      if (!q || q.subject_id !== level.gate_subject_id || q.age_group !== child.age_group) continue;
      const isCorrect = Number(answer?.selectedIndex) === Number(q.correct_index);
      if (isCorrect) { correctCount += 1; xpFromQuestions += Number(q.xp_reward || 0); }
      await tx.run(
        "INSERT INTO question_log (id, child_id, question_id, level_id, correct) VALUES (?, ?, ?, ?, ?)",
        [`ql_${nanoid(10)}`, child.id, q.id, level.id, isCorrect ? 1 : 0]
      );
      await logDailyQuestion(tx, child.id, isCorrect);
      results.push({ questionId: q.id, correct: isCorrect, correctIndex: Number(q.correct_index) });
    }

    if (!results.length) { const err = new Error("No valid answers were submitted"); err.status = 400; throw err; }
    const isBoss = Number(level.is_boss || 0) === 1;
    const requiredCorrect = Math.min(
      isBoss ? Number(level.boss_hp || 5) : Math.max(1, Math.ceil(Number(level.questions_required || 3) * 2 / 3)),
      results.length
    );
    const passed = correctCount >= requiredCorrect;
    let newlyUnlockedLevelId = null;
    let bonusXp = 0;
    let completionCoins = 0;
    if (passed) {
      const wasCompleted = progress.status === "completed";
      bonusXp = wasCompleted ? 20 : (isBoss ? 200 : 100);
      completionCoins = wasCompleted ? 10 : (isBoss ? 300 : 50);
      await tx.run(
        "UPDATE child_level_progress SET status = 'completed', attempts = attempts + 1, completed_at = CURRENT_TIMESTAMP WHERE child_id = ? AND level_id = ?",
        [child.id, level.id]
      );
      newlyUnlockedLevelId = await unlockNextLevel(tx, child.id, level);
    } else {
      await tx.run("UPDATE child_level_progress SET attempts = attempts + 1 WHERE child_id = ? AND level_id = ?", [child.id, level.id]);
    }

    const totalXp = passed ? xpFromQuestions + bonusXp : 0;
    const totalCoins = passed ? completionCoins + runCoins : 0;
    if (passed) await tx.run("UPDATE children SET xp = xp + ?, coins = coins + ? WHERE id = ?", [totalXp, totalCoins, child.id]);
    const updated = await tx.one("SELECT xp, coins FROM children WHERE id = ?", [child.id]);
    const overallLevel = Math.max(1, Math.floor(Number(updated.xp || 0) / 200) + 1);
    await tx.run("UPDATE children SET overall_level = ? WHERE id = ?", [overallLevel, child.id]);
    const streak = passed ? await bumpStreak(tx, child) : Number(child.streak_count || 0);

    return {
      passed, correctCount, requiredCorrect, results, xpEarned: totalXp, coinsEarned: totalCoins,
      newXp: Number(updated.xp || 0), newCoins: Number(updated.coins || 0), overallLevel,
      streak, newlyUnlockedLevelId,
      bossHpRemaining: isBoss ? Math.max(0, Number(level.boss_hp || 5) - correctCount) : null,
    };
  });

  res.json(response);
}));

module.exports = router;
// Exposed for unit testing (see test/game-helpers.test.js) — these are pure
// functions with no DB/request dependency, so attaching them to the router
// export lets them be tested in isolation without spinning up Express.
module.exports.clampNumber = clampNumber;
module.exports.missionForLevel = missionForLevel;
