/** Small deterministic RNG helpers (no dependencies) used by spawners and tests. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mix a run seed with an integer index so each recycled segment is repeatable. */
export function seededFor(runSeed, index) {
  return mulberry32((Math.imul(runSeed | 0, 2654435761) ^ Math.imul(index | 0, 40503) ^ 0x9e3779b9) >>> 0);
}

export const range = (rng, min, max) => min + (max - min) * rng();
export const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length];
export const chance = (rng, p) => rng() < p;
export function shuffle(rng, list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
