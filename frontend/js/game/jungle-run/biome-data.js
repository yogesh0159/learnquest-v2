/**
 * Day/night "biomes" driven by distance. Every parameter is interpolated, so the world slowly
 * drifts from sunny jungle -> golden sunset -> starry night -> pink dawn and back (2400 m loop).
 * Only colours and light intensities change, so it costs nothing per frame.
 */
export const BIOMES = Object.freeze([
  { id: "day",    name: "Sunny Jungle",  fog: 0xc4ead8, near: 34, far: 108, sky: [1, 1, 1],          hemi: 0xdff6ff, hemiI: 1.0,  sun: 0xfff0cf, sunI: 2.4, env: 0.55, ground: [1, 1, 1],       torch: 1.0, fireflies: 0.18, exposure: 1.05 },
  { id: "sunset", name: "Golden Sunset", fog: 0xf0b88a, near: 30, far: 100, sky: [2.4, 0.72, 0.38], hemi: 0xffc890, hemiI: 0.95, sun: 0xff9040, sunI: 2.3, env: 0.45, ground: [1.18, 0.86, 0.6], torch: 1.4, fireflies: 0.4,  exposure: 1.0 },
  { id: "night",  name: "Firefly Night", fog: 0x101c34, near: 20, far: 84,  sky: [0.09, 0.13, 0.3], hemi: 0x5f7ac0, hemiI: 0.42, sun: 0x8fa8ff, sunI: 0.55, env: 0.12, ground: [0.3, 0.4, 0.56], torch: 2.4, fireflies: 1.0,  exposure: 1.15 },
  { id: "dawn",   name: "Misty Dawn",    fog: 0xe8d0e0, near: 30, far: 100, sky: [1.4, 1.0, 1.25],   hemi: 0xffe6f0, hemiI: 0.9,  sun: 0xffc8d8, sunI: 1.8, env: 0.5,  ground: [0.95, 1, 0.95],  torch: 1.2, fireflies: 0.5,  exposure: 1.05 },
]);
export const BIOME_LENGTH = 600;     // metres per biome
export const BIOME_BLEND = 200;      // the last 200 m of each biome fade into the next
const smooth = (x) => x * x * (3 - 2 * x);

/** Pure helper (unit-testable): which biomes and how much blend at a distance. */
export function biomeAt(distance) {
  const d = Math.max(0, distance); const i = Math.floor(d / BIOME_LENGTH) % BIOMES.length; const t = d % BIOME_LENGTH;
  const blend = t > BIOME_LENGTH - BIOME_BLEND ? smooth((t - (BIOME_LENGTH - BIOME_BLEND)) / BIOME_BLEND) : 0;
  return { from: i, to: (i + 1) % BIOMES.length, blend, dominant: blend > 0.5 ? (i + 1) % BIOMES.length : i };
}

