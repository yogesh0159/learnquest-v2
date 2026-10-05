export function closestLaneIndex(playerX, lanes) {
  let closest = 0;
  let closestDistance = Infinity;
  lanes.forEach((laneX, index) => {
    const distance = Math.abs(playerX - laneX);
    if (distance < closestDistance) {
      closest = index;
      closestDistance = distance;
    }
  });
  return closest;
}

/**
 * Pure collision classification shared by every runner world. Visual meshes
 * are only used for their current coordinates; gameplay state remains the
 * source of truth for jump, slide, magnet, and invulnerability behavior.
 */
export function classifyRunnerCollision(entity, state, bounds) {
  const z = entity.group.position.z;
  if (entity.done || z < bounds.zMin || z > bounds.zMax) return { type: "none" };

  const laneDistance = Math.abs(entity.group.position.x - state.playerX);
  const nearPlayer = laneDistance < bounds.laneRadius;
  if (entity.category === "collectible") {
    const inMagnetRange = state.magnetActive && laneDistance < bounds.magnetRadius;
    return nearPlayer || inMagnetRange ? { type: "collect" } : { type: "none" };
  }
  if (entity.category === "gate") {
    const atGate = Math.abs(z - bounds.playerZ) < bounds.gateRadius;
    return !entity.gateSetResolved && atGate ? { type: "gate" } : { type: "none" };
  }
  if (entity.category !== "obstacle" || !nearPlayer || state.invulnerable) return { type: "none" };

  const clearedByJump = ["jump", "pit"].includes(entity.kind) && state.jumpY > bounds.jumpHeight;
  const clearedBySlide = entity.kind === "slide" && state.sliding;
  return clearedByJump || clearedBySlide ? { type: "none" } : { type: "crash", kind: entity.kind };
}
