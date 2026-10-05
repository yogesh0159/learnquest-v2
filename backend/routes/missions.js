const express = require("express");
const { nanoid } = require("nanoid");
const db = require("../db");
const { requireAuth } = require("../utils/auth");
const asyncRoute = require("../utils/async-route");
const { SUPPORTED_MISSIONS, publicMission, evaluateMissionAnswer } = require("../learning/mission-catalog");

const router = express.Router();

function normalizedProgress(rows) {
  return rows.map((row) => {
    const attempts = Number(row.attempts || 0);
    const correct = Number(row.correct || 0);
    return {
      missionId: row.mission_id,
      skill: row.skill,
      attempts,
      correct,
      mistakes: Math.max(0, attempts - correct),
      accuracy: attempts ? Math.round((correct / attempts) * 100) : null,
      sessionsCompleted: Number(row.sessions_completed || 0),
      lastPractisedAt: row.last_practised_at || null,
    };
  });
}

router.get("/", requireAuth("child"), asyncRoute(async (req, res) => {
  const child = await db.one("SELECT age_group, language FROM children WHERE id = ?", [req.user.id]);
  if (!child) return res.status(404).json({ error: "Child profile not found" });
  res.json({
    ageGroup: child.age_group,
    language: child.language,
    missions: SUPPORTED_MISSIONS.map((id) => publicMission(id, child.age_group, child.language)),
  });
}));

router.post("/:missionId/start", requireAuth("child"), asyncRoute(async (req, res) => {
  const missionId = String(req.params.missionId || "");
  const response = await db.transaction(async (tx) => {
    const child = await tx.one("SELECT age_group, language FROM children WHERE id = ?", [req.user.id]);
    const mission = child && publicMission(missionId, child.age_group, child.language);
    if (!mission) { const err = new Error("Mission not found"); err.status = 404; throw err; }

    await tx.run(
      "UPDATE mission_sessions SET status = 'abandoned', finished_at = CURRENT_TIMESTAMP WHERE child_id = ? AND status = 'active'",
      [req.user.id]
    );
    const sessionId = `ms_${nanoid(14)}`;
    await tx.run(`
      INSERT INTO mission_sessions (id, child_id, mission_id, age_group, language, total_steps)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [sessionId, req.user.id, missionId, child.age_group, child.language, mission.steps.length]);
    return { sessionId, mission, progress: { currentStep: 0, totalSteps: mission.steps.length, attempts: 0, correct: 0, mistakes: 0 } };
  });
  res.status(201).json(response);
}));

router.post("/:missionId/answer", requireAuth("child"), asyncRoute(async (req, res) => {
  const missionId = String(req.params.missionId || "");
  const sessionId = String(req.body?.sessionId || "").trim();
  const answerId = String(req.body?.answerId || "").trim();
  const requestedStep = Number(req.body?.stepIndex);
  if (!sessionId || !answerId || !Number.isInteger(requestedStep)) {
    return res.status(400).json({ error: "sessionId, stepIndex and answerId are required" });
  }

  const response = await db.transaction(async (tx) => {
    const session = await tx.one(
      "SELECT * FROM mission_sessions WHERE id = ? AND child_id = ? AND mission_id = ?",
      [sessionId, req.user.id, missionId]
    );
    if (!session) { const err = new Error("Mission session not found"); err.status = 404; throw err; }
    if (session.status !== "active") { const err = new Error("Mission session is already finished"); err.status = 409; throw err; }
    if (requestedStep !== Number(session.current_step)) {
      const err = new Error("Mission step is out of order"); err.status = 409; throw err;
    }

    const evaluation = evaluateMissionAnswer({ missionId, ageGroup: session.age_group, stepIndex: requestedStep, answerId, language: session.language });
    if (!evaluation) { const err = new Error("Answer does not belong to this mission step"); err.status = 400; throw err; }

    const previous = await tx.one("SELECT COUNT(*) AS count FROM mission_attempts WHERE session_id = ? AND step_index = ?", [session.id, requestedStep]);
    const attemptNumber = Number(previous?.count || 0) + 1;
    await tx.run(`
      INSERT INTO mission_attempts
      (id, session_id, child_id, mission_id, age_group, language, step_index, skill, answer_id, correct, attempt_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [`ma_${nanoid(14)}`, session.id, req.user.id, missionId, session.age_group, session.language, requestedStep, evaluation.skill, answerId, evaluation.correct ? 1 : 0, attemptNumber]);

    const nextStep = evaluation.correct ? requestedStep + 1 : requestedStep;
    const completed = evaluation.correct && nextStep >= Number(session.total_steps);
    await tx.run(`
      UPDATE mission_sessions SET current_step = ?, attempts = attempts + 1,
        correct = correct + ?, mistakes = mistakes + ?, status = ?,
        finished_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE finished_at END
      WHERE id = ?
    `, [nextStep, evaluation.correct ? 1 : 0, evaluation.correct ? 0 : 1, completed ? "completed" : "active", completed ? 1 : 0, session.id]);

    const updated = await tx.one("SELECT * FROM mission_sessions WHERE id = ?", [session.id]);
    return {
      correct: evaluation.correct,
      explanation: evaluation.explanation,
      correctAnswer: evaluation.correctAnswer,
      attemptNumber,
      completed,
      progress: {
        currentStep: Number(updated.current_step), totalSteps: Number(updated.total_steps), attempts: Number(updated.attempts),
        correct: Number(updated.correct), mistakes: Number(updated.mistakes),
      },
    };
  });
  res.json(response);
}));

router.get("/progress/me", requireAuth("child"), asyncRoute(async (req, res) => {
  const rows = await db.all(`
    SELECT a.mission_id, a.skill, COUNT(*) AS attempts, COALESCE(SUM(a.correct), 0) AS correct,
      MAX(a.answered_at) AS last_practised_at,
      COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) AS sessions_completed
    FROM mission_attempts a JOIN mission_sessions s ON s.id = a.session_id
    WHERE a.child_id = ? GROUP BY a.mission_id, a.skill ORDER BY a.mission_id, a.skill
  `, [req.user.id]);
  res.json({ skills: normalizedProgress(rows) });
}));

module.exports = router;
module.exports.normalizedProgress = normalizedProgress;
