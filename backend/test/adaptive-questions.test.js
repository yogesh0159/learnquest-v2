const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret";
const questionRoutes = require("../routes/questions");
const { rankAdaptiveQuestions } = questionRoutes;

const rows = [
  { id: "q-weak", topic: "Fractions", difficulty: "medium" },
  { id: "q-strong", topic: "Addition", difficulty: "medium" },
  { id: "q-new", topic: "Money", difficulty: "easy" },
];

test("adaptive ranking prioritises weak topics over strong topics", () => {
  const ranked = rankAdaptiveQuestions(rows, [
    { topic: "Fractions", attempted: 6, correct: 2 },
    { topic: "Addition", attempted: 8, correct: 8 },
    { topic: "Money", attempted: 1, correct: 1 },
  ], []);
  assert.equal(ranked[0].id, "q-weak");
  assert.equal(ranked[ranked.length - 1].id, "q-strong");
});

test("adaptive ranking explores an unseen topic", () => {
  const ranked = rankAdaptiveQuestions(rows, [
    { topic: "Fractions", attempted: 4, correct: 4 },
    { topic: "Addition", attempted: 4, correct: 4 },
  ], []);
  assert.equal(ranked[0].id, "q-new");
});

test("adaptive ranking de-prioritises a recently seen question", () => {
  const ranked = rankAdaptiveQuestions(rows, [
    { topic: "Fractions", attempted: 6, correct: 2 },
    { topic: "Addition", attempted: 8, correct: 8 },
    { topic: "Money", attempted: 1, correct: 1 },
  ], ["q-weak"]);
  assert.notEqual(ranked[0].id, "q-weak");
});
