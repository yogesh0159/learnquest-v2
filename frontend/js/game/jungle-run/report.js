import { SUBJECTS } from "./profile.js";

/** Turn saved profile data into a parent/teacher-friendly summary (pure, unit-testable). */
export function buildReport(data) {
  const rows = Object.entries(SUBJECTS).map(([id, name]) => {
    const s = data.subjectStats?.[id] || { right: 0, wrong: 0 }; const total = s.right + s.wrong;
    return { id, name, right: s.right, wrong: s.wrong, total, accuracy: total ? Math.round((100 * s.right) / total) : null };
  });
  const asked = rows.reduce((n, r) => n + r.total, 0); const right = rows.reduce((n, r) => n + r.right, 0);
  const enough = rows.filter((r) => r.total >= 3).sort((a, b) => a.accuracy - b.accuracy);
  let advice, adviceKey, adviceVars = {};
  if (!asked) { advice = "No questions answered yet. Play a few runs to see progress here."; adviceKey = "rep.none"; }
  else if (!enough.length) { advice = "Keep playing: a few more questions are needed for useful advice."; adviceKey = "rep.few"; }
  else if (enough[0].accuracy < 70) { advice = `Practise ${enough[0].name}: ${enough[0].accuracy}% right so far (${enough[0].right} of ${enough[0].total}).`; adviceKey = "rep.practise"; adviceVars = { id: enough[0].id, acc: enough[0].accuracy, r: enough[0].right, t: enough[0].total }; }
  else { advice = `Great accuracy in every subject so far. Try a higher grade in Settings.`; adviceKey = "rep.great"; }
  const strongest = [...enough].sort((a, b) => b.accuracy - a.accuracy)[0];
  return {
    rows, advice, adviceKey, adviceVars, strongestId: (strongest && strongest.accuracy >= 70) ? strongest.id : null, strongest: strongest && strongest.accuracy >= 70 ? strongest.name : null,
    totals: { games: data.games || 0, coins: data.totalCoins || 0, best: data.best || 0, bestDistance: data.bestDistance || 0, bestStreak: data.bestStreak || 0, questions: asked, accuracy: asked ? Math.round((100 * right) / asked) : null, achievements: Object.keys(data.achievements || {}).length },
  };
}
