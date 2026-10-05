const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret";
const parentRoutes = require("../routes/parent");
const { buildLearningPlan } = parentRoutes;

test("buildLearningPlan aggregates a seven-day learning snapshot", () => {
  const plan = buildLearningPlan({
    subjectStats: [
      { name_en: "Maths", attempted: 10, correct: 9 },
      { name_en: "English", attempted: 5, correct: 3 },
    ],
    topicStats: [
      { topic: "Fractions", subject: "Maths", attempted: 4, correct: 2 },
      { topic: "Vocabulary", subject: "English", attempted: 3, correct: 1 },
    ],
    last7: [
      { questions_attempted: 5, questions_correct: 4, minutes_game: 14 },
      { questions_attempted: 4, questions_correct: 3, minutes_game: 12 },
      { questions_attempted: 3, questions_correct: 2, minutes_game: 10 },
    ],
  });

  assert.equal(plan.weekly.questionsAttempted, 12);
  assert.equal(plan.weekly.questionsCorrect, 9);
  assert.equal(plan.weekly.accuracy, 75);
  assert.equal(plan.weekly.gameMinutes, 36);
  assert.equal(plan.weekly.activeDays, 3);
  assert.equal(plan.hasEnoughData, true);
  assert.equal(plan.focusTopics[0].topic, "Vocabulary");
  assert.equal(plan.strongSubjects[0].subject, "Maths");
});

test("buildLearningPlan recommends a routine when evidence is sparse", () => {
  const plan = buildLearningPlan({
    subjectStats: [],
    topicStats: [],
    last7: [{ questions_attempted: 1, questions_correct: 1, minutes_game: 2 }],
  });

  assert.equal(plan.hasEnoughData, false);
  assert.equal(plan.momentum, "needs_routine");
  assert.ok(plan.dailyPracticeMinutes >= 10);
});

test("buildLearningPlan marks five active days as strong momentum", () => {
  const activeDay = { questions_attempted: 2, questions_correct: 2, minutes_game: 5 };
  const plan = buildLearningPlan({
    subjectStats: [{ name_en: "GK", attempted: 10, correct: 8 }],
    topicStats: [],
    last7: [activeDay, activeDay, activeDay, activeDay, activeDay],
  });

  assert.equal(plan.momentum, "strong");
  assert.equal(plan.weekly.activeDays, 5);
});
