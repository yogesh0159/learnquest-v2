import { LANES, SEGMENT_LENGTH } from "./config.js";
import { seededFor, pick, chance, range } from "./rng.js";

/**
 * Decides what each recycled segment contains. Rules that keep the game fair:
 *  - never more than 2 of 3 lanes blocked inside one segment, and obstacles are staggered in Z,
 *  - segments around a question board contain coins only,
 *  - the first segments of a run are obstacle-free.
 */
export class SpawnDirector {
  constructor({ track, collectibles, obstacles, runSeed = 1 }) {
    this.track = track; this.collectibles = collectibles; this.obstacles = obstacles; this.runSeed = runSeed;
    this.enabled = false; this.sinceEnigma = 0; this.lastFreeLane = 1;
    track.on("spawn", (seg) => this.onSegment(seg));
  }
  reset(seed) { this.runSeed = seed; this.sinceEnigma = 0; this.lastFreeLane = 1; this.collectibles.clear(); this.obstacles.clear(); }

  onSegment(seg) {
    if (!this.enabled) return;
    const idx = seg.index; const zc = seg.group.position.z;
    if (zc > 0) return;                       // never spawn inside the camera/player area
    const rng = seededFor(this.runSeed, idx + 977);
    const safe = idx < 3 || this.track.reservedNear(idx);
    const L = SEGMENT_LENGTH;
    const coinRow = (lane, z0, n, step = 1.7, y = 1.05) => { for (let i = 0; i < n; i++) this.collectibles.spawn("coin", LANES[lane], y, z0 - i * step); };

    this.sinceEnigma++;
    const roll = rng();
    if (safe) { if (!this.track.isReserved(idx) && roll < 0.8) coinRow(pick(rng, [0, 1, 2]), zc + 4, 5); return; }

    if (roll < 0.22) { coinRow(pick(rng, [0, 1, 2]), zc + 4.5, 5); }
    else if (roll < 0.45) {                    // rock + arc of coins over it (rewards jumping)
      const lane = pick(rng, [0, 1, 2]); const zr = zc - range(rng, 0, 2);
      this.obstacles.spawn("rock", LANES[lane], zr);
      for (let i = -2; i <= 2; i++) this.collectibles.spawn("coin", LANES[lane], 1.1 + (1 - (i * i) / 4) * 1.15, zr + i * 1.5);
      const other = pick(rng, [0, 1, 2].filter((l) => l !== lane)); coinRow(other, zc + 5, 4);
    } else if (roll < 0.62) {                  // overhead beam: slide under it
      const lane = pick(rng, [0, 1, 2]); this.obstacles.spawn("beam", LANES[lane], zc - range(rng, 0, 2));
      coinRow(pick(rng, [0, 1, 2].filter((l) => l !== lane)), zc + 4, 5);
    } else if (roll < 0.78) {                  // two rocks staggered in z with a free lane
      const free = pick(rng, [0, 1, 2]); const blocked = [0, 1, 2].filter((l) => l !== free);
      this.obstacles.spawn("rock", LANES[blocked[0]], zc + 2.8); this.obstacles.spawn("rock", LANES[blocked[1]], zc - 3.2);
      coinRow(free, zc + 4.5, 6, 1.4);
    } else if (roll < 0.9) { coinRow(1, zc + 5, 4); }
    if (this.sinceEnigma >= 9 && chance(rng, 0.7)) { this.collectibles.spawn("enigma", LANES[pick(rng, [0, 1, 2])], 1.25, zc - 4.5); this.sinceEnigma = 0; }
  }
}
