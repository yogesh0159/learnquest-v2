import { JUNGLE_TRACK } from "../jungle/jungle-config.js";

export { JUNGLE_TRACK };
export const LANES = JUNGLE_TRACK.lanes;           // [-2.2, 0, 2.2]
export const SEGMENT_LENGTH = JUNGLE_TRACK.length; // 12 m
// The supplied Bridge.glb has ~1.3 m thick parapet walls on each side (measured by raycast: the flat walkway is only
// ~62% of the tile width). With a 6.6 m tile the side lanes (+-2.2) stood ON the walls, so the tile is widened until
// the lane centres (+ the character's half width) sit on the flat walkway. Lane coordinates stay -2.2 / 0 / +2.2.
export const ROAD_WIDTH = 9.0;
export const PATH_HALF_WIDTH = ROAD_WIDTH / 2;

export const GAME = Object.freeze({
  segmentCount: 10,
  firstSegmentZ: SEGMENT_LENGTH,   // one segment behind/under the player so the road never ends at his feet
  recycleZ: 14.5,                  // segment centre passes this => it is fully behind the camera
  playerZ: 0,
  baseSpeed: 10,
  maxSpeed: 17,
  speedPerMeter: 0.0045,
  lives: 3,
  maxLives: 5,
  invulnerableSeconds: 1.8,
  coinValue: 10,
  enigmaValue: 100,
  correctAnswerValue: 100,
  distanceScore: 0.5,
});

export const PLAYER = Object.freeze({
  height: 1.7,                // runtime character height in metres (uniform scale of the supplied rig)
  laneSmoothing: 15,          // exponential smoothing factor for lane changes
  jumpApex: 1.65,
  jumpAirTime: 0.80,
  slideDuration: 1.0,
  hitDuration: 0.95,
  halfWidth: 0.42,
  halfDepth: 0.35,
  standHeight: 1.55,
  slideHeight: 0.75,
});

export const CAMERA = Object.freeze({
  fov: 60,
  fovPortrait: 72,
  offset: { x: 0, y: 3.55, z: 6.9 },
  lookAhead: { y: 1.15, z: -9 },
  followX: 0.55,
  lookFollowX: 0.7,
  smoothing: 6.5,
});

export const QUESTIONS = Object.freeze({
  firstSegment: 13,
  gapMin: 15,
  gapMax: 19,
  slowFactor: 0.72,
  slowStartDistance: 70,
  boardOffsetZ: -1.2,          // board position inside its host segment (m from segment centre)
  padOffsetZ: 3.4,             // answer pads sit this far in front of the board
  jumpLockHalfRange: 3.0,      // the board panel hangs over the lanes: jumping is paused right beneath it
});

// Five quality levels. maxPixels is the render-resolution budget: the game draws at the display's native size, but never more
// than this many pixels (3840x2160 = 4K, 2560x1440 = 2K, 1920x1080 = Full HD, 1280x720 = HD). Adaptive resolution can lower it further.
// lodNear: objects nearer than this many metres use the full model, farther ones the low-triangle LOD.
// The road is 10 tiles (~108 m) long, so the view distance is not extended above 1.0.
export const QUALITY = Object.freeze({
  ultra:    { id: "ultra", teacherModel: true,    maxPixels: 3840 * 2160, shadows: true,  shadowMap: 2048, shadowSpan: 1.35, shadowDecor: true,  decor: 1.0,  lights: 6, glow: true,  cheap: false, lodNear: 60, view: 1.0,  blob: false, aniso: 16, ambient: true },
  high:     { id: "high", teacherModel: true,     maxPixels: 2560 * 1440, shadows: true,  shadowMap: 1536, shadowSpan: 1.0,  shadowDecor: false, decor: 1.0,  lights: 4, glow: true,  cheap: false, lodNear: 42, view: 1.0,  blob: false, aniso: 8,  ambient: true },
  balanced: { id: "balanced", teacherModel: true, maxPixels: 1920 * 1080, shadows: false, shadowMap: 512,  shadowSpan: 1.0,  shadowDecor: false, decor: 0.6,  lights: 2, glow: true,  cheap: true,  lodNear: 26, view: 0.85, blob: true,  aniso: 4,  ambient: true },
  low:      { id: "low", teacherModel: true,      maxPixels: 1280 * 720,  shadows: false, shadowMap: 512,  shadowSpan: 1.0,  shadowDecor: false, decor: 0.35, lights: 1, glow: false, cheap: true,  lodNear: 18, view: 0.7,  blob: true,  aniso: 2,  ambient: true },
  minimal:  { id: "minimal", teacherModel: false,  maxPixels: 960 * 540,   shadows: false, shadowMap: 512,  shadowSpan: 1.0,  shadowDecor: false, decor: 0.2,  lights: 0, glow: false, cheap: true,  lodNear: 12, view: 0.55, blob: true,  aniso: 1,  ambient: false },
});

/**
 * Per-asset runtime configuration: where the optimized GLB lives, where the untouched source is,
 * and how to normalise scale / orientation / pivot. `fit.mode`:
 *   height : uniform scale so the bounding-box height == value
 *   maxDim : uniform scale so the largest bounding-box side == value
 *   width  : uniform scale so the bounding-box width (x) == value
 *   box    : non-uniform scale to exactly [x, y, z]
 * `yaw` rotates the model before measuring. `anchor`: 'bottom' (feet on y=0) or 'center'.
 */
const RT = "/assets/jungle/runtime";
export const ASSET_REGISTRY = Object.freeze({
  path: {
    label: "Bridge / mossy stone road", critical: true,
    url: `${RT}/Bridge.rt.glb`, lodUrl: `${RT}/Bridge.lod.rt.glb`, source: "source_assets/3d/Bridge.glb",
    fallbackUrl: "/assets/jungle/path/Path_Straight_01.glb", fallbackFit: { mode: "box", size: [ROAD_WIDTH, 0.4, 12], yaw: 0, anchor: "bottom" },
    fit: { mode: "box", size: [ROAD_WIDTH, JUNGLE_TRACK.height, JUNGLE_TRACK.length], yaw: Math.PI / 2, anchor: "bottom" },
    walkSurface: { raycast: true, fraction: JUNGLE_TRACK.surfaceOffset / JUNGLE_TRACK.height },
  },
  tree:  { label: "Jungle tree", url: `${RT}/tree.rt.glb`, lodUrl: `${RT}/tree.lod.rt.glb`, source: "source_assets/3d/tree.glb", fit: { mode: "height", value: 6.4, anchor: "bottom" } },
  bush:  { label: "Bush cluster", url: `${RT}/bush_cluster.rt.glb`, lodUrl: `${RT}/bush_cluster.lod.rt.glb`, source: "source_assets/3d/bush_cluster.glb", fit: { mode: "height", value: 1.5, anchor: "bottom" } },
  rock:  { label: "Stone sanctuary rocks", url: `${RT}/Stone_Sanctua.rt.glb`, lodUrl: `${RT}/Stone_Sanctua.lod.rt.glb`, source: "source_assets/3d/Stone_Sanctua.glb", fit: { mode: "height", value: 1.2, anchor: "bottom" } },
  torch: { label: "Jungle temple torch", url: `${RT}/jungle_temple_tourch.rt.glb`, lodUrl: `${RT}/jungle_temple_tourch.lod.rt.glb`, source: "source_assets/3d/jungle_temple_tourch.glb", fit: { mode: "height", value: 2.5, anchor: "bottom" }, flameHeightFraction: 0.86, flameGlow: true },
  coin:  { label: "Question coin", url: `${RT}/Coin.rt.glb`, source: "source_assets/3d/Coin.glb", fit: { mode: "maxDim", value: 0.85, anchor: "center" } },
  enigma:{ label: "Golden Enigma token", url: `${RT}/Golden_Enigma.rt.glb`, source: "source_assets/3d/Golden_Enigma.glb", fit: { mode: "maxDim", value: 1.35, anchor: "center" } },
  board: {
    label: "Question board", url: `${RT}/question_board.rt.glb`, source: "source_assets/3d/question board.glb", flameGlow: true,
    fit: { mode: "width", value: 11.4, anchor: "bottom" },
    // Blank wooden panel inside the frame, in model units relative to the model's bounding-box centre.
    panel: { centerX: 0.0, centerYFromBottom: 0.568, width: 1.28, height: 0.5 },
  },
  boy: {
    label: "Boy explorer", critical: false, character: true,
    url: `${RT}/Boy_Final_Animated.rt.glb`, source: "source_assets/characters/LearnQuest_Boy_Final_Animated_v1.glb",
    fit: { mode: "height", value: PLAYER.height, yaw: Math.PI, anchor: "bottom" },
  },
  girl: {
    label: "Girl explorer", critical: false, character: true,
    url: `${RT}/Girl_Mia_Animated.rt.glb`, source: "source_assets/characters/Meshy_AI_Mia_s_First_Day_All_Animations.glb",
    fit: { mode: "height", value: PLAYER.height, yaw: Math.PI, anchor: "bottom" },
  },
});

/** Assets needed before the first frame (the character is loaded on demand when chosen). */
export const BOOT_ASSETS = ["path", "tree", "bush", "rock", "torch", "coin", "enigma", "board"];
