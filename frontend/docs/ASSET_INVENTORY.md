# ASSET_INVENTORY.md - LearnQuest Jungle Run

All numbers below were **measured from the GLB files** (accessor bounds, node transforms, skins, animation tracks), then confirmed by rendering each model from 4 angles. Nothing was guessed from filenames.
Meshy exports were all normalised to ~1.9 units with the origin at the bounding-box centre, so every model is re-fitted at load time (see "Runtime normalisation").

## A. Environment / prop GLBs (`3d/`)

| File | Size | Tris (src) | Source bbox (x,y,z) | What it really is (from geometry) | Runtime copy | Tris (runtime) |
|---|---|---|---|---|---|---|
| `Bridge.glb` | 22.0 MB | 29,936 | 1.90 x 0.20 x 1.01 | Stone walkway tile with parapet walls on its +-Z sides; **long axis is X**, so it needs a 90 deg yaw. Same model the old `Path_Straight_01.glb` was made from. | `Bridge.rt.glb` (2.0 MB) | 14,967 |
| `tree.glb` | 28.2 MB | 30,641 | 1.78 x 1.90 x 1.17 | Upright jungle tree with fern/rock base | `tree.rt.glb` (3.4 MB) | 24,856 |
| `bush_cluster.glb` | 26.8 MB | 30,794 | 1.90 x 1.21 x 1.35 | Banana-leaf bush cluster | `bush_cluster.rt.glb` (2.5 MB) | 26,756 |
| `Stone_Sanctua.glb` | 28.4 MB | 25,819 | 1.86 x 1.35 x 1.71 | Mossy rock pile (solid, no arch) | `Stone_Sanctua.rt.glb` (2.5 MB) | 21,946 |
| `jungle_temple_tourch.glb` | 28.7 MB | **720,600** | 0.74 x 1.91 x 0.91 | Carved stone pedestal torch, **flame is baked geometry** in the top ~15% | `jungle_temple_tourch.rt.glb` (1.1 MB) | 21,618 |
| `Coin.glb` | 11.9 MB | **192,752** | 1.90 x 1.90 x 0.43 | Upright disc facing +-Z, embossed "?" | `Coin.rt.glb` (0.5 MB) | 8,672 |
| `Golden_Enigma.glb` | 28.3 MB | 9,612 | 1.90 x 1.90 x 0.63 | Ornate golden medallion, spiral sun on one face, "?" on the other, ivy | `Golden_Enigma.rt.glb` (1.5 MB) | 9,612 |
| `question board.glb` | 27.1 MB | 28,144 | 1.91 x 1.08 x 0.48 | Wooden board between two carved pillars with baked torch flames. **Panel is blank wood (no text baked in).** | `question_board.rt.glb` (3.4 MB) | 28,144 |

None of these 8 files contains animations, skins or bones. All use one baked PBR material (base colour 2048 px, normal 2048 px, metallic-roughness **4096 px**), which is why they are 11-28 MB each.

## B. Character GLBs (`L Q 3D models/`)

| File | Size | Tris | Skin/joints | Clips | Used? |
|---|---|---|---|---|---|
| `LearnQuest_Boy_Final_Animated_v1.glb` | 21.6 MB | 76,003 | 1 skin / 28 joints | 13 | **YES - Boy runtime rig** -> `Boy_Final_Animated.rt.glb` (6.3 MB) |
| `Meshy_AI_Mia_s_First_Day_All_Animations.glb` | 53.1 MB | 293,361 | 1 skin / 66 joints | 13 | **YES - Girl runtime rig** -> `Girl_Mia_Animated.rt.glb` (31.5 MB) |
| `LearnQuest_Boy_Rigged_Animated_v1 old.glb` | 20.6 MB | 76,003 | 1 skin | 2 | No - superseded by Final_v1 (kept in `source_assets/`) |
| `boy.glb` / `girl.glb` | 49.2 / 44.3 MB | 1.45M / 1.28M | none (static) | 0 | No - static masters |
| `Boy_Original_Animated.glb` | 68.9 MB | 1,451,614 | skinned | 13 | No - master, see below |
| `Girl_Original_Animated.glb` / `..._4Influences.glb` | 79.6 MB each | 1,276,110 | skinned | 13 | No - master, see below |

Why the masters are not used at runtime: the pack's own README says they are full-detail masters "not an optimized mobile-game budget". At 1.3-1.45M triangles a single character costs more than the entire rest of the scene. The Boy_Final / Mia rigs are the runtime-sized, hand-weighted rigs from the same pack.
Both runtime characters: face **+Z**, feet on y ~ 0, 1.22-1.25 m tall in the file, **no root bone offset** (origin at feet).

### Animation clips (identical set in both rigs, except two)
Running 0.67 s, Walking 1.04 s, Idle_15 7.0 s, Idle_9 2.0 s, Regular_Jump 1.88 s, slide_light 1.5 s, falling_down 2.29 s, Victory_Cheer 9.33 s, Talk_with_Hands_Open, Run_Turn_Left 1.63 s, Run_Sharp_Turn_Right 1.21 s.
Boy only: `Hit_Reaction` 1.67 s, `Lean_Forward_Sprint_inplace` 0.58 s.
Girl only: `Hit_in_Back_While_Running` 2.5 s, `Lean_Forward_Sprint` 0.58 s.
Every clip animates all joints, including **translation tracks on every bone**, so root motion was inspected on the Hips bone.

| Clip | Hips net displacement in the file (m, x/y/z) | Handling |
|---|---|---|
| Running, Walking, Idle | ~0 (small bob) | X/Z pinned, Y bob kept |
| Regular_Jump | y arc +0.30 above standing, crouch -0.17 | X/Z pinned; **rise removed**, crouch/landing dips kept (the controller supplies the arc) |
| slide_light | **z +3.44 to +3.48** | Z pinned, low Y kept |
| Hit_Reaction | x 0.6 | pinned |
| Hit_in_Back_While_Running | **z +2.35** | pinned |
| falling_down | ~0.3-0.5 m drift on X and Z, body sinks ~0.1 m | X/Z pinned |
| Run_Turn_Left / Run_Sharp_Turn_Right | 1-2 m curved | mapped, pinned, **not used** (they rotate the body ~90 deg) |

## C. Old project assets (untouched)
`frontend/assets/jungle/path/Path_Straight_01.glb` (6.6 x 0.4 x 12, same model as Bridge) is kept as an automatic **fallback**. `assets/characters/boy-explorer.glb` / `girl-explorer.glb` (1 MB, 14 clips) are kept as automatic fallbacks for the characters.

## D. Runtime normalisation (per asset, in `config.js` ASSET_REGISTRY)
| Key | Rule | Resulting size (m) |
|---|---|---|
| path | yaw 90 deg, non-uniform fit to **9.0** x 0.4 x 12 (was 6.6; side walls eat ~1.5 m per side), walkway top found by **raycast** and placed at y = 0 | 9.0 x 0.4 x 12 |
| tree | uniform, height 6.4, bottom-centre pivot | 5.98 x 6.4 x 3.92 |
| bush | height 1.5 | 2.36 x 1.5 x 1.67 |
| rock | height 1.2 (obstacle uses 1.05 m collider) | 1.66 x 1.2 x 1.51 |
| torch | height 2.5, flame at 86% of height | 0.96 x 2.5 x 1.19 |
| coin | largest side 0.85, centred | 0.85 x 0.85 x 0.19 |
| enigma | largest side 1.35, centred | 1.35 x 1.35 x 0.45 |
| board | width 11.4, bottom-centre; text plane auto-placed by raycast | 11.4 x 6.48 x 2.84 |
| boy / girl | uniform height 1.7, yaw 180 deg (so the camera sees the back) | 0.74 x 1.7 x 0.57 |

## E. Fallback / procedural pieces (no GLB existed)
Ground plane (canvas-painted moss texture), sky dome (vertex gradient), the overhead **beam obstacle** crossbar and posts (dressed with the real bush GLB), glow sprites and particle sparkles.

## F. Update 8 - your `girl.glb`, and what was removed from the gallery
* **`girl.glb` (provided again by you, two identical copies, SHA-256 `478911f4...`)** is stored untouched at `source_assets/characters/girl.glb` and is the first model the 3D gallery opens. Measured: 44.26 MB, **1,276,110 triangles**, 681,272 vertices, one material, three 2048x2048 textures, 0.75 x 1.90 x 0.70 units, **no skeleton and no animations** (a static high-detail master).
* Rendered side by side with the game's girl, it is the **same character**. The game cannot run a static model, so it uses the animated, lighter version of this girl (`Meshy_AI_Mia_s_First_Day_All_Animations.glb`, 293k triangles, 13 clips).
* **Removed from the gallery and the game:** the earlier-project `boy-explorer.glb` / `girl-explorer.glb` (the soldier-style characters), the old road entry and "Boy old rig". Their files are still inside the project (nothing deleted), but they are no longer listed, and the game no longer falls back to them: if a runtime character file is missing the game now shows a clear error instead of silently showing a different character. (The road still has its invisible same-looking fallback.)

## G. Update 9 - where the old explorers were still used, and what happens now
An audit of the whole project found the old `boy-explorer.glb` / `girl-explorer.glb` were still loaded by the **original pages** (through `character-presets.js` and `character-lab.js`): the original Jungle Runner (`jungle-game.html`), Maths Kingdom (`maths-kingdom-game.html`), the 3D Explorer Lab (`character-lab.html`) and the Reference Studio. They now load the new characters (`Boy_Final_Animated.rt.glb`, `Girl_Mia_Animated.rt.glb`).
Still present on disk but **not used by any page**: `frontend/assets/characters/boy-explorer.glb`, `girl-explorer.glb` (nothing was deleted). `Path_Straight_01.glb` (old road) is only the hidden same-looking fallback of the new road and what the validator checks for; the original runner draws its own procedural world.
The orange fox ears and tail seen on the characters in the original runner are **not** an old model: they are the "Forest Fox" cosmetic reward that the original `seed.js` equips for every new child (changeable in the reward shop).

## H. Update 11 - performance copies (originals untouched)
Measured on an Intel HD Graphics 520 laptop (your self-check report: high 15 fps, balanced 21, low 24), the frame was dominated by foliage and tiny repeated objects. New runtime files in `frontend/assets/jungle/runtime/` (built by `tools/asset-pipeline/make_lods.mjs` and `mia_lite.mjs`; the sources in `source_assets/` are unchanged):
| File | Triangles | Used for |
|---|---|---|
| `Coin.rt.glb` | 8,672 -> **2,428** | every coin (34 are on screen at once) |
| `tree.lod.rt.glb` | 24,856 -> **4,748** | trees farther than 18-38 m (depends on graphics level) |
| `bush_cluster.lod.rt.glb` | 26,756 -> **4,420** | bushes far away, and the bushes on the slide beam |
| `Stone_Sanctua.lod.rt.glb` | 21,946 -> **5,002** | rocks far away |
| `jungle_temple_tourch.lod.rt.glb` | 21,618 -> **6,382** | torches far away |
| `Bridge.lod.rt.glb` | 14,967 -> **4,284** | road tiles beyond 31-65 m |
| `Girl_Mia_Animated.rt.glb` | 293,361 -> **132,012** | the Girl, everywhere (a 0.3 ratio version showed face artefacts, so 0.45 was used) |
LOD copies are made with meshoptimizer's "sloppy" simplifier (the normal one stalls at ~80% on foliage) and **share the full model's materials and textures**, so they add no GPU texture memory.
