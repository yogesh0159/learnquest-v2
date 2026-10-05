/** Data-driven achievements: add an entry and it is evaluated live and at the end of every run. */
export const ACHIEVEMENTS = Object.freeze([
  { id: "first_run",   icon: "\u{1F331}", title: "First Steps",       desc: "Finish your first run",              test: (r, p) => p.games >= 1 },
  { id: "coins_50",    icon: "\u{1FA99}", title: "Coin Collector",    desc: "Collect 50 coins in one run",        test: (r) => r.coins >= 50 },
  { id: "coins_150",   icon: "\u{1F4B0}", title: "Treasure Hunter",   desc: "Collect 150 coins in one run",       test: (r) => r.coins >= 150 },
  { id: "total_500",   icon: "\u{1F3C6}", title: "Rich Explorer",     desc: "Collect 500 coins in total",         test: (r, p) => p.totalCoins + r.coins >= 500 },
  { id: "dist_500",    icon: "\u{1F45F}", title: "Fast Feet",         desc: "Run 500 m in one run",               test: (r) => r.distance >= 500 },
  { id: "dist_1500",   icon: "\u{1F680}", title: "Jungle Marathon",   desc: "Run 1500 m in one run",              test: (r) => r.distance >= 1500 },
  { id: "right_5",     icon: "\u{1F4A1}", title: "Bright Mind",       desc: "Answer 5 questions right in a run",  test: (r) => r.correct >= 5 },
  { id: "streak_5",    icon: "\u{1F525}", title: "On Fire",           desc: "5 right answers in a row",           test: (r) => r.bestStreak >= 5 },
  { id: "enigma_3",    icon: "\u{1F52E}", title: "Enigma Master",     desc: "Collect 3 Golden Enigmas in a run",  test: (r) => r.tokens >= 3 },
  { id: "clean_300",   icon: "\u{1F6E1}\uFE0F", title: "Untouchable", desc: "Run 300 m without getting hit",      test: (r) => r.noHitDistance >= 300 },
  { id: "combo_20",    icon: "\u26A1",    title: "Combo King",        desc: "Collect 20 coins in a row",          test: (r) => r.bestCombo >= 20 },
  { id: "all_rounder", icon: "\u{1F308}", title: "All-Rounder",       desc: "Answer right in 3 different subjects", test: (r) => (r.subjectsRight || 0) >= 3 },
]);

/** @returns {string[]} ids newly satisfied (and not already unlocked) */
export function evaluateAchievements(run, profileData) {
  return ACHIEVEMENTS.filter((a) => !profileData.achievements?.[a.id] && a.test(run, profileData)).map((a) => a.id);
}
export const achievementById = (id) => ACHIEVEMENTS.find((a) => a.id === id);
