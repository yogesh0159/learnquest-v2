export const JUNGLE_TRACK = Object.freeze({
  width: 6.6,
  height: 0.4,
  length: 12,
  // The generated GLB includes the low stone side borders in its full 0.4 m height.
  // The walkable stone surface sits roughly 0.18 m above the model's lowest point.
  surfaceOffset: 0.18,
  lanes: Object.freeze([-2.2, 0, 2.2]),
  tileCount: 11,
  initialStartZ: 6,
  recycleZ: 13,
  shoulderWidth: 8,
});

export const JUNGLE_ASSETS = Object.freeze({
  pathStraight01: Object.freeze({
    id: "path_straight_01",
    url: "/assets/jungle/path/Path_Straight_01.glb",
    enabled: true,
    dimensions: Object.freeze({ width: 6.6, height: 0.4, length: 12 }),
  }),
  tree01: Object.freeze({ id: "tree_01", url: "/assets/jungle/foliage/Jungle_Tree_01.glb", enabled: false }),
  bush01: Object.freeze({ id: "bush_01", url: "/assets/jungle/foliage/Jungle_Bush_01.glb", enabled: false }),
  plant01: Object.freeze({ id: "plant_01", url: "/assets/jungle/foliage/Jungle_Plant_01.glb", enabled: false }),
  torch01: Object.freeze({ id: "torch_01", url: "/assets/jungle/props/Jungle_Torch_01.glb", enabled: false }),
  rock01: Object.freeze({ id: "rock_01", url: "/assets/jungle/obstacles/Jungle_Rock_01.glb", enabled: false }),
  coinQuestion01: Object.freeze({ id: "coin_question_01", url: "/assets/jungle/collectibles/Question_Coin_01.glb", enabled: false }),
  mathGate01: Object.freeze({ id: "math_gate_01", url: "/assets/jungle/gates/Math_Gate_01.glb", enabled: false }),
});

export function laneX(index) {
  const safe = Math.max(0, Math.min(JUNGLE_TRACK.lanes.length - 1, Number(index) || 0));
  return JUNGLE_TRACK.lanes[safe];
}
