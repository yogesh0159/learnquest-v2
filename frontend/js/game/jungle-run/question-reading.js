/**
 * Reading time: when a question appears the runner stops and waits, so nobody has to read while running (and hit something).
 * The time depends on the question: longer story = more time; Grade 1 gets a little extra; the player can choose Off / Short / Normal / Long in Settings
 * and can always press "Ready!" (Enter / Space) to start earlier.
 */
export const READ_MODES = Object.freeze({ off: 0, short: 0.7, normal: 1, long: 1.5 });
export const READ_MIN = 3, READ_MAX = 10;

/** @param {number} chars length of the question text the child has to read  @param {number} grade 1..  @param {string} mode off|short|normal|long */
export function readSeconds(chars, grade = 1, mode = "normal") {
  const mult = READ_MODES[mode] ?? 1; if (!mult) return 0;
  const base = 2.2 + 0.038 * Math.max(0, chars | 0);
  const s = base * (grade <= 1 ? 1.25 : 1) * mult;
  return Math.round(Math.min(READ_MAX * mult, Math.max(READ_MIN * Math.min(1, mult), s)) * 10) / 10;
}
