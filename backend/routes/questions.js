const express = require("express");
const db = require("../db");
const { requireAuth } = require("../utils/auth");
const asyncRoute = require("../utils/async-route");

const router = express.Router();

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function localizeOption(option, lang) {
  if (option && typeof option === "object") {
    return option[lang] || option.en || Object.values(option)[0] || "";
  }
  return String(option ?? "");
}

function rankAdaptiveQuestions(rows, topicStats = [], recentQuestionIds = []) {
  const recent = new Set(recentQuestionIds.map(String));
  const statsByTopic = new Map(topicStats.map((row) => {
    const attempted = Number(row.attempted || 0);
    const correct = Number(row.correct || 0);
    const accuracy = attempted ? correct / attempted : null;
    return [String(row.topic), { attempted, correct, accuracy }];
  }));

  return rows
    .map((question, index) => {
      const stats = statsByTopic.get(String(question.topic));
      let priority = 0;
      // Unseen topics get exploration weight. Repeated weak topics get the
      // strongest weight so practice follows actual evidence, not a fixed path.
      if (!stats || stats.attempted === 0) priority += 55;
      else {
        priority += Math.max(0, 100 - Math.round((stats.accuracy || 0) * 100));
        // Keep sampling topics with little evidence, while allowing a proven
        // high-mastery topic to move behind them instead of being rewarded
        // merely because it has accumulated many attempts.
        priority += Math.max(0, 20 - stats.attempted * 2);
      }
      if (recent.has(String(question.id))) priority -= 70;
      const difficultyBoost = question.difficulty === "hard" ? 2 : question.difficulty === "medium" ? 1 : 0;
      priority += difficultyBoost;
      // Tiny deterministic tie breaker preserves variety after the caller
      // shuffles rows without making mastery selection hard to test.
      priority += (index % 7) / 100;
      return { question, priority };
    })
    .sort((a, b) => b.priority - a.priority)
    .map((item) => item.question);
}

async function pickAdaptiveRows(childId, subject, rows, wanted) {
  const topicStats = await db.all(`
    SELECT q.topic, COUNT(ql.id) AS attempted, COALESCE(SUM(ql.correct), 0) AS correct
    FROM question_log ql
    JOIN questions q ON q.id = ql.question_id
    WHERE ql.child_id = ? AND q.subject_id = ?
    GROUP BY q.topic
  `, [childId, subject]);

  const recentRows = await db.all(`
    SELECT ql.question_id
    FROM question_log ql
    JOIN questions q ON q.id = ql.question_id
    WHERE ql.child_id = ? AND q.subject_id = ?
    ORDER BY ql.answered_at DESC
    LIMIT 8
  `, [childId, subject]);

  // Shuffle before ranking so exact ties rotate naturally between sessions.
  return rankAdaptiveQuestions(
    shuffle(rows),
    topicStats,
    recentRows.map((row) => row.question_id)
  ).slice(0, Math.min(wanted, rows.length));
}

router.get("/", requireAuth("child"), asyncRoute(async (req, res) => {
  const subject = String(req.query.subject || "").trim();
  const wanted = Math.min(10, Math.max(1, Number(req.query.count || 3)));
  const runnerMode = String(req.query.runner || "") === "1";
  const adaptiveMode = String(req.query.adaptive || "") === "1";
  if (!subject) return res.status(400).json({ error: "subject query param required" });

  const child = await db.one("SELECT age_group, language FROM children WHERE id = ?", [req.user.id]);
  if (!child) return res.status(404).json({ error: "Child not found" });

  const rows = await db.all(
    "SELECT * FROM questions WHERE subject_id = ? AND age_group = ?",
    [subject, child.age_group]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: "No questions available for this subject and age group" });
  }

  const picked = adaptiveMode
    ? await pickAdaptiveRows(req.user.id, subject, rows, wanted)
    : shuffle(rows).slice(0, Math.min(wanted, rows.length));
  const lang = ["en", "hi", "mr"].includes(child.language) ? child.language : "en";

  const payload = picked.map((q) => {
    const rawOptions = JSON.parse(q.options_json);
    const localized = rawOptions.map((option) => localizeOption(option, lang));

    if (runnerMode) {
      const correctIndex = Number(q.correct_index);
      const wrongIndexes = localized.map((_, index) => index).filter((index) => index !== correctIndex);
      const chosenIndexes = shuffle([correctIndex, ...shuffle(wrongIndexes).slice(0, 2)]);
      return {
        id: q.id,
        topic: q.topic,
        difficulty: q.difficulty,
        question: q[`question_${lang}`] || q.question_en,
        options: chosenIndexes.map((originalIndex) => ({
          text: localized[originalIndex],
          originalIndex,
        })),
        xp_reward: Number(q.xp_reward || 0),
      };
    }

    return {
      id: q.id,
      topic: q.topic,
      difficulty: q.difficulty,
      question: q[`question_${lang}`] || q.question_en,
      options: localized,
      xp_reward: Number(q.xp_reward || 0),
    };
  });

  res.json({
    questions: payload,
    mode: runnerMode ? "runner" : "standard",
    selection: adaptiveMode ? "adaptive" : "random",
  });
}));

module.exports = router;
module.exports.rankAdaptiveQuestions = rankAdaptiveQuestions;
