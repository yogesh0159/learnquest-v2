/**
 * Animation alias resolution. The runner asks for logical actions (RUN, JUMP, ...) and this
 * module finds the best matching clip name in whatever GLB is loaded. It never hardcodes an
 * exact clip name: matching is case-insensitive and tolerant of spaces/underscores/camelCase.
 */
export const tokenize = (name) =>
  String(name || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

// include: a clip must contain at least one of these tokens (prefix match: "run" matches "running")
// exclude: any of these tokens disqualifies the clip
// prefer: tokens that raise the score ; durationBias: 'long' | 'short' tie-breaker
export const ALIAS_RULES = Object.freeze({
  RUN:        { include: ["run", "running"], exclude: ["turn", "sharp", "hit", "back", "while", "sprint", "lean", "jump"], prefer: ["running"] },
  SPRINT:     { include: ["sprint"], exclude: ["turn"], prefer: ["inplace", "in", "place"] },
  WALK:       { include: ["walk", "walking"], exclude: ["turn"] },
  IDLE:       { include: ["idle", "stand"], exclude: [], durationBias: "long" },
  JUMP:       { include: ["jump", "leap", "hop"], exclude: [], prefer: ["regular"] },
  SLIDE:      { include: ["slide", "slid"], exclude: [] },
  HIT:        { include: ["hit", "hurt", "damage", "stumble"], exclude: [], prefer: ["reaction"] },
  FALL:       { include: ["fall", "falling", "faint", "knock"], exclude: [] },
  VICTORY:    { include: ["victory", "cheer", "win", "celebrate"], exclude: [] },
  TURN_LEFT:  { include: ["turn"], require: ["left"], exclude: [] },
  TURN_RIGHT: { include: ["turn"], require: ["right"], exclude: [] },
  TALK:       { include: ["talk", "speak", "wave"], exclude: [] },
});

const tokenMatches = (tokens, wanted) => tokens.some((t) => t === wanted || t.startsWith(wanted));

export function scoreClipForAlias(clipName, duration, rule) {
  const tokens = tokenize(clipName);
  if (rule.exclude?.some((x) => tokenMatches(tokens, x))) return -Infinity;
  if (rule.require && !rule.require.every((x) => tokenMatches(tokens, x))) return -Infinity;
  if (!rule.include.some((x) => tokenMatches(tokens, x))) return -Infinity;
  let score = 100;
  // Whole-token matches beat prefix matches; fewer unrelated tokens means a more "pure" clip.
  if (rule.include.some((x) => tokens.includes(x))) score += 15;
  score += (rule.prefer || []).filter((x) => tokenMatches(tokens, x)).length * 25;
  score -= Math.max(0, tokens.length - 1) * 4;
  if (rule.durationBias === "long") score += Math.min(duration || 0, 10);
  if (rule.durationBias === "short") score -= Math.min(duration || 0, 10);
  return score;
}

/**
 * @param {{name:string,duration:number}[]} clips
 * @returns {Record<string, {name:string, duration:number} | null>}
 */
export function resolveAliases(clips, rules = ALIAS_RULES) {
  const result = {};
  for (const [alias, rule] of Object.entries(rules)) {
    let best = null; let bestScore = -Infinity;
    for (const clip of clips) {
      const s = scoreClipForAlias(clip.name, clip.duration, rule);
      if (s > bestScore) { best = clip; bestScore = s; }
    }
    result[alias] = Number.isFinite(bestScore) ? { name: best.name, duration: best.duration } : null;
  }
  return result;
}
