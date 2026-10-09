/**
 * Reading time.  When a question appears the runner stops and WAITS, so nobody has to read while running (and hit something).
 *  - "ready" (the default): he waits until the child taps "Ready!" (or presses Enter / Space) - small children read slowly, so there is no clock at all;
 *  - "long" / "normal" / "short": the run starts by itself after a time that depends on the question (a longer story = more time) and on the class
 *    (Grade 1 gets 60 % more, Grade 2 30 % more); "Ready!" still starts it earlier;
 *  - "off": no pause (for fast readers).
 */
export const READ_MODES = Object.freeze({ off: 0, ready: Infinity, short: 0.7, normal: 1, long: 1.6 });
export const READ_MIN = 6, READ_MAX = 45;

/** @param {number} chars length of the question text the child has to read  @param {number} grade 1..  @param {string} mode ready|long|normal|short|off  @returns {number} seconds, Infinity (wait for Ready!) or 0 (no pause) */
export function readSeconds(chars, grade = 1, mode = "ready") {
  const mult = READ_MODES[mode] ?? Infinity; if (mult === 0 || mult === Infinity) return mult;
  const base = 4 + 0.14 * Math.max(0, chars | 0);
  const s = base * (grade <= 1 ? 1.6 : grade === 2 ? 1.3 : 1) * mult;
  return Math.round(Math.min(READ_MAX, Math.max(READ_MIN, s)) * 10) / 10;
}
