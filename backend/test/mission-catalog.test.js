const test = require("node:test");
const assert = require("node:assert/strict");
const { SUPPORTED_MISSIONS, SUPPORTED_AGES, publicMission, evaluateMissionAnswer } = require("../learning/mission-catalog");

test("all three missions expose three age-tuned playable interactions without answers", () => {
  for (const missionId of SUPPORTED_MISSIONS) {
    for (const ageGroup of SUPPORTED_AGES) {
      const mission = publicMission(missionId, ageGroup, "en");
      assert.equal(mission.steps.length, 3);
      assert.equal(mission.ageGroup, ageGroup);
      assert.ok(mission.objective);
      mission.steps.forEach((step) => {
        assert.ok(step.skill);
        assert.equal(step.options.length, 3);
        assert.equal(Object.hasOwn(step, "answer"), false);
      });
    }
  }
});

test("mission answers are validated server-side with useful correction feedback", () => {
  const wrong = evaluateMissionAnswer({ missionId: "market", ageGroup: "7-9", stepIndex: 0, answerId: "24", language: "en" });
  assert.equal(wrong.correct, false);
  assert.equal(wrong.correctAnswer, "₹36");
  assert.match(wrong.explanation, /12 \+ 12 \+ 12/);
  const correct = evaluateMissionAnswer({ missionId: "bridge", ageGroup: "10-12", stepIndex: 0, answerId: "4m", language: "hi" });
  assert.equal(correct.correct, true);
  assert.match(correct.explanation, /400/);
});

test("invalid missions, steps and option ids are rejected", () => {
  assert.equal(publicMission("unknown", "7-9", "en"), null);
  assert.equal(evaluateMissionAnswer({ missionId: "market", ageGroup: "7-9", stepIndex: 99, answerId: "x" }), null);
  assert.equal(evaluateMissionAnswer({ missionId: "market", ageGroup: "7-9", stepIndex: 0, answerId: "forged" }), null);
});

test("mission content falls back to English while preserving multilingual fields", () => {
  const hindi = publicMission("road_language", "4-6", "hi");
  const fallback = publicMission("road_language", "4-6", "unsupported");
  assert.notEqual(hindi.title, fallback.title);
  assert.equal(fallback.title, "Road & Language");
});
