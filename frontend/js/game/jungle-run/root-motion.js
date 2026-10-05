/**
 * Root-motion neutralisation.
 *
 * Mixamo-style clips bake translation into the hips ("root") bone. The game controller owns
 * all world movement, so this module rewrites the hips *position* track in place:
 *   - X/Z are pinned to the first keyframe (no drifting, no double forward motion),
 *   - Y is kept (bobbing, crouching, sliding low) except for `clampRise` clips (jump), where the
 *     rise above the standing height is removed because the controller supplies the arc.
 * Only the root bone's position track is touched; every rotation track is left intact so the
 * skeletal animation quality is preserved.
 *
 * Works on any object with `{ name, times, values }` (THREE.KeyframeTrack or a plain test double).
 */
export function isRootPositionTrack(trackName, rootBoneName) {
  const dot = trackName.lastIndexOf(".");
  if (dot < 0) return false;
  const node = trackName.slice(0, dot);
  const prop = trackName.slice(dot + 1);
  return prop === "position" && node === rootBoneName;
}

/** Measure net displacement of a root position track (used for the report / tests). */
export function measureRootMotion(tracks, rootBoneName) {
  const t = tracks.find((tr) => isRootPositionTrack(tr.name, rootBoneName));
  if (!t) return null;
  const v = t.values; const n = v.length / 3;
  const range = [0, 0, 0]; const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[i * 3 + k]); max[k] = Math.max(max[k], v[i * 3 + k]); }
  for (let k = 0; k < 3; k++) range[k] = max[k] - min[k];
  return { net: [v[(n - 1) * 3] - v[0], v[(n - 1) * 3 + 1] - v[1], v[(n - 1) * 3 + 2] - v[2]], range, start: [v[0], v[1], v[2]] };
}

/**
 * @param {{tracks: {name:string, values: ArrayLike<number>}[]}} clip
 * @param {string} rootBoneName
 * @param {{clampRise?: boolean}} [opts]
 * @returns {{changed:boolean, before:object|null, after:object|null}}
 */
export function neutralizeRootMotion(clip, rootBoneName, { clampRise = false } = {}) {
  const track = clip.tracks.find((tr) => isRootPositionTrack(tr.name, rootBoneName));
  if (!track) return { changed: false, before: null, after: null };
  const before = measureRootMotion(clip.tracks, rootBoneName);
  const v = track.values; const n = v.length / 3;
  const x0 = v[0]; const y0 = v[1]; const z0 = v[2];
  for (let i = 0; i < n; i++) {
    v[i * 3] = x0;
    v[i * 3 + 2] = z0;
    if (clampRise && v[i * 3 + 1] > y0) v[i * 3 + 1] = y0;
  }
  return { changed: true, before, after: measureRootMotion(clip.tracks, rootBoneName) };
}
