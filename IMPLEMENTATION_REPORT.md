# IMPLEMENTATION_REPORT.md - LearnQuest Jungle Run 3D (fully integrated)

Upgraded **in place**: `LearnQuest_Jungle_Local_Node24_WindowsFix_v3`. No new project was created and no original file was removed.
See `ASSET_INVENTORY.md` for the per-GLB analysis and `TEST_REPORT.md` for what was actually run.

## 1. What was integrated
| GLB | Role in game |
|---|---|
| `Bridge.glb` | Endless road. 10 recycled tiles, each **9.0 m x 12 m** (see section 9), 3 lanes at x = -2.2 / 0 / +2.2 |
| `tree.glb` | Near and far roadside trees (random yaw / scale, always outside the road) |
| `bush_cluster.glb` | Roadside bushes + dressing on the slide-beam obstacle |
| `Stone_Sanctua.glb` | Roadside rocks **and** the jump-or-dodge rock obstacle |
| `jungle_temple_tourch.glb` | Torches every 2nd tile, both sides, flame preserved, pooled warm lights + flicker |
| `Coin.glb` | Collectible coins (score), spinning + bobbing |
| `Golden_Enigma.glb` | Special token: slower spin, pulsing emissive + halo, counter + x2 coins for 8 s |
| `question board.glb` | Physical board; **question and answers are drawn at runtime** on a CanvasTexture plane |
| `LearnQuest_Boy_Final_Animated_v1.glb` | Boy player (default) |
| `Meshy_AI_Mia_s_First_Day_All_Animations.glb` | Girl player |

Not used at runtime (documented): 5 high-resolution master characters and the superseded "old" boy rig. See inventory.

## 2. Architecture (all under `frontend/js/game/jungle-run/`)
| Module | Responsibility |
|---|---|
| `config.js` | Every tunable + **ASSET_REGISTRY** (url, source, fallback, fit/normalisation per asset) |
| `asset-manager.js` | **AssetManager**: each GLB loads once, progress %, normalisation, walk-surface raycast, fallback file -> procedural fallback, clear errors, `instantiate()` (clone / SkeletonUtils.clone) |
| `animation-aliases.js` | Pure alias resolver (RUN/JUMP/SLIDE/HIT/FALL/VICTORY/IDLE/...); case/space/underscore tolerant, scored, excludes look-alikes |
| `root-motion.js` | Pure root-motion neutraliser (Hips position track only; rotations untouched) |
| `animation-controller.js` | **AnimationController**: mixer, crossfades, per-clip root-motion handling, jump take-off/landing detected from the clip's own hips curve |
| `player-controller.js` | **CharacterController**: smooth lanes, ballistic jump, slide, hit/invulnerability blink, fall; air-slide fast-fall |
| `track-manager.js` | **EndlessTrackManager**: ring of tiles, recycle by moving, spawn/recycle events |
| `environment-manager.js` | **EnvironmentManager**: pooled decor slots re-randomised per recycled tile, torches, 6-light pool with flicker |
| `collectible-manager.js` / `obstacle-manager.js` / `spawn-director.js` | **CollectibleManager**, pooled obstacles, fair pattern generator |
| `question-generator.js` / `question-manager.js` | **QuestionManager**: reusable generator (add/sub/mul, subject registry) + zone system |
| `collision-manager.js` | **CollisionManager**: AABB / lane-distance only |
| `tutorial.js`, `report.js`, `powerup-manager.js`, `profile.js`, `achievements.js`, `question-banks.js`, `speech.js`, `biome-data.js`, `biome-manager.js` | Updates 3-5 (below) |
| `audio-manager.js`, `sound-recipes.js` | **AudioManager** + procedural sound design (Update 2) |
| `camera-rig.js`, `fx-manager.js`, `hud.js`, `textures.js` | Chase camera, pooled particles, DOM HUD, procedural ground/sky/glow |
| `game-manager.js` | **GameManager**: state machine, scoring, lives, quality tiers, lab mode, test hooks |

Reused existing core modules: `InputController`, `RuntimeQualityManager`, `jungle-config.js` (`JUNGLE_TRACK`).

## 3. Phase notes
- **Road (3)**: tiles move and are *moved to the far end* when `z > 14.5`; verified over a 180 s simulated run: 220 recycles, worst seam error 1.3e-13 m, geometry/texture counts constant.
- **Scenery (4)**: decor x is computed from each object's own radius so nothing enters |x| < 3.65 m; bottom of every model is on the ground. Seeded RNG per tile index.
- **Torches (5)**: real GLB with baked flame. 6 un-shadowed PointLights are *reassigned* to the nearest torches (count never changes, so no shader recompiles), fading in/out by distance, with layered-sine flicker. The flame texels are made self-lit by a small material patch so tone-mapping cannot wash them out. Lightweight halo sprite.
- **Coins / Enigma (6,7)**: pooled clones sharing one geometry + material; spawn per recycled tile. Enigma fires a modular hook: `game.onSpecialToken(({game,item}) => ...)` and a DOM event `special-token`; default effect = +100, token count, x2 coins for 8 s.
- **Question board (8,14)**: zone is bound to a reserved tile (every 15-19 tiles, first at tile 13). The board shows `7 + 5 = ?` and three lane-coloured answers aligned with the lanes; the same three answers are painted on the road in each lane; a HUD banner repeats the question. Running through a lane answers (evaluated when the pads reach the player). Correct: +100, burst, 15 bonus coins, extra heart every 3 correct. Wrong: lose a heart + HIT animation + the correct answer shown. Difficulty ramps (level = 1 + correct/3, max 4). Speed eases to 72% while approaching. Jump is paused for ~3 m directly under the board panel (it hangs over the lanes at 1.9 m).
- **Characters (9-11)**: alias map is computed from the loaded GLB at runtime and logged, e.g. `Animation RUN mapped to Running`. Root motion removed as listed in the inventory. Jump clip is time-scaled so its airborne phase equals the 0.8 s physics air-time; slide clip scaled to 1.0 s; hit clip to 0.95 s (girl's 2.5 s clip is capped at 2.2x). Lane changes use procedural bank/yaw (the supplied turn clips rotate the body ~90 deg, so they are mapped but intentionally unused).
- **Camera (12)**: 3.55 m up, 6.9 m behind, looks 9 m ahead; exponential smoothing, 55% lateral follow, slight speed FOV kick, no shake.
- **Performance (16)**: see section 5.

## 4. Controls
| Action | Keys |
|---|---|
| Lane left / right | `Left` / `A`, `Right` / `D` (or swipe) |
| Jump | `Up` / `W` / `Space` (or swipe up) |
| Slide | `Down` / `S` (or swipe down); pressed in the air = fast-fall then slide |
| Start / restart | `Enter` or the Play button |
| Pause | `P` / `Esc` |
| Lab view (orbit camera, speed slider, quality, live stats) | `F2` or the "Lab view" link; `?lab=1` |
URL options: `?character=girl`, `?quality=high|balanced|low`, `?seed=123`, `?autostart=1`.

## 5. Optimisation (originals are never modified)
Runtime copies are in `frontend/assets/jungle/runtime/` (53 MB vs ~300 MB of sources), rebuilt with `tools/asset-pipeline/optimize.mjs`.
- Textures: WebP, base 2048/1024, normal 1024/512, metallic-roughness **4096 -> 1024/512** (GPU memory per model fell from ~130 MB to ~15-35 MB).
- Geometry: torch 720,600 -> 21,618 tris, coin 192,752 -> 8,672 (visually compared before/after; indistinguishable at game scale). Tree/bush/rock only fell 12-20% because thin leaf UV islands lock border vertices.
- Characters: textures only; **geometry untouched** (Mia stays 293k tris).
- Runtime: one load per GLB, pooled clones, no per-frame allocation, fixed light count, shadows only for sun (player + obstacles), `PCFShadowMap`, fog + far plane 125 m, quality tiers with automatic step-down.
- Measured scene load (renderer.info, includes the shadow pass), mid-run: high 2.30M tris / 152 calls, balanced 1.68M / 127, low 1.40M / 113.
- **Heaviest asset: `Girl_Mia_Animated.rt.glb` (31.5 MB, 293k tris, 66 joints).** Fine on any discrete/modern GPU, may be slow on old integrated GPUs; use `?character=boy` or `?quality=low` there.

## 6. Files
**Added**: `frontend/js/game/jungle-run/*` (20 JS modules), `frontend/assets/jungle/runtime/*.rt.glb` (10), `source_assets/` (originals + `SOURCE_MANIFEST.json` with sha256), `tools/asset-pipeline/`, `scripts/test-jungle-run.mjs`, the three reports, `frontend/js/legacy/jungle-local-preview.legacy.js` (old preview, kept).
**Modified**: `frontend/jungle-local-preview.html`, `frontend/css/jungle-local-preview.css`, `frontend/js/jungle-local-preview.js`, `scripts/jungle-local-server.js`, `START_JUNGLE_LOCAL.bat`, `package.json` (+`jungle:test`), `frontend/js/game/jungle/jungle-config.js` (placeholder URLs now point at the real runtime GLBs), `frontend/assets/jungle/manifest.json` (+runtime note), `LOCAL_JUNGLE_QUICK_START.txt`.
**Unchanged**: everything else, including the backend, other game pages, and `validate-project.js` (still passes, 470 checks).

## 7. Startup (Windows)
1. Extract the ZIP. 2. Double-click `LearnQuest_Jungle_Local_Node24_WindowsFix_v3\learnquest\START_JUNGLE_LOCAL.bat`.
It checks for Node >= 24, runs `npm install --ignore-scripts` only if Three.js is missing (it is bundled), starts the server, waits for `/__health`, then opens `http://127.0.0.1:5177/jungle-local-preview.html`. The window stays open; Ctrl+C stops it. No Python, no node-gyp, no backend/database needed. Port override: `set JUNGLE_PORT=5178`. The server also answers on `http://localhost:5177` (IPv4 and IPv6 loopback).

## 8. Known limitations (honest list)
1. **Not run on real Windows / real Node 24 / a real GPU.** Everything was executed on Node 22.22 in a Linux sandbox with headless Chromium on software WebGL. Code uses nothing newer than Node 18 APIs, but the `.bat` launcher is untested on Windows. Real FPS is unmeasured.
2. No GLB exists for ground, sky or an overhead obstacle; these are small procedural pieces (ground, sky, beam, shield bubble, fireflies).
3. Run/lane turn clips (`Run_Turn_*`) and `Talk`/`Walk`/`Sprint` are mapped but unused in gameplay.
4. Jumping is paused for a few metres directly under the question board.
5. The 5 master characters + the "old" boy are not used and the 5 masters (~322 MB) are **not copied** into this ZIP (they are unchanged in your original ZIP; checksums in `SOURCE_MANIFEST.json`).
6. Sound is synthesised (no recorded audio): it is clean and child-friendly but not studio quality. It was verified by measurement (levels, clipping, silence tails), **not by listening**; please listen to `audio_preview.wav` / play the game and tell me what to adjust.
7. Flame look relies on a texture-colour heuristic (saturated orange); if the torch texture is repainted the thresholds in `asset-manager.js` `_applyFlameGlow` may need a tweak.

## 9. Update 1 - side-lane bug fix (road width)
**Problem reported:** in the left and right lanes the character ran off the road; only the centre lane was correct.
**Cause (measured, not guessed):** the supplied `Bridge.glb` has thick parapet walls along both sides. Raycasting the tile showed the flat walkway is only about +-2.0 m wide on a 6.6 m tile and the surface rises 0.19 m from |x| = 2.2, i.e. exactly where the side lanes were, so the character stood on the walls.
**Fix:** lanes stay at -2.2 / 0 / +2.2; the road tile is widened to `ROAD_WIDTH = 9.0` (one constant in `config.js`), which gives a flat walkway of +-2.95 m. Torches, trees, bushes, rocks and the board pillars use the same constant and moved outwards with it. The game now measures the walkway at start-up and logs `Road walkable half-width 2.95 m, lanes need 2.62 m -> all 3 lanes are on the road` (a warning if it ever does not fit).
**Also fixed:** a hairline of ground was visible at every tile joint; a sand-coloured strip under each joint now hides it.
**Trade-off:** the stones are stretched about 36% sideways compared with the original proportions; if you prefer the exact 6.6 m road, set `ROAD_WIDTH = 6.6` and change `LANES` to about +-1.45 instead.

## 10. Update 2 - sound and music
New: `audio-manager.js`, `sound-recipes.js` (~300 lines, **no audio files**, everything is synthesised with WebAudio).
- **Music**: a looping C - Am - F - G progression in C-major pentatonic (bass, marimba melody, soft pad, shaker/kick/log-drum, distant bird chirps). It speeds up slightly with run speed (108 -> ~125 bpm). A calm mood (no drums, sparse melody) plays on the menu and while a question board is approaching, so children can think.
- **Effects**: coin (pitch climbs for chained coins), Golden Enigma sparkle, jump, slide, lane swish, hit, correct, wrong, extra heart, question chime, button click, game-over and victory jingles.
- **Controls**: speaker button (top right) or `M` mutes; mute state and volumes are saved in `localStorage`; music/effects sliders are in the Lab panel (F2). Pausing (P) freezes the music; game over fades it out.
- **Safety**: browsers block audio until the first key press/click, so nothing plays before that (this is automatic: your first click or Enter starts the music). Rate-limiting and a voice cap (80) stop rapid events from overloading the audio thread; master compressor + limiter prevent clipping.
- **Bug found by the new tests and fixed**: pressing P paused the game but the music kept playing, because the same key press also triggered the auto-unlock, which resumed the paused audio.

## 11. Update 3 - Lab character viewer
`F2` (or the "Lab view" link) now opens a panel that lists the two running characters, **Boy explorer** and **Girl explorer**. For the selected character it shows every clip in the GLB (13 each) with its duration and the logical action it maps to (e.g. `Running (0.667s) -> RUN`), plays any clip with loop and speed controls, offers Front / Back / Side / Top camera presets, and prints rig info (triangles, height, root bone, and the root drift that was removed per clip). The **"original root motion"** checkbox plays the untouched clip so you can see what the gameplay version had to fix (measured: `slide_light` drifts 4.0 m, the gameplay version 0.007 m).

## 12. Update 4 - gameplay and learning features
- **Golden Enigma power-ups** (`powerup-manager.js`): Coin Magnet (10 s), Shield (absorbs the next hit or wrong answer, up to 18 s), Slow Time (6 s, world x0.62), Double Coins (8 s). A shuffled bag gives all four before any repeats; adding one is a single entry. The `game.onSpecialToken()` hook still works.
- **Combo / streak**: consecutive coins (within 1.3 s) build a combo that adds +2 per 5 coins; right-answer streaks are shown.
- **Subjects and grades**: Math, Patterns, Spelling, Science, Shapes (content in `question-banks.js`, easy to extend). Settings let the player pick Grade 1-3 and any mix of subjects; difficulty rises every 4 right answers (max level 4). Long questions auto-wrap on the board.
- **End-of-run review**: the game-over screen lists each missed question, what was chosen, the right answer and a short explanation.
- **Profile and rewards** (`profile.js`, `achievements.js`): best score, lifetime coins, games, settings and 12 achievements are saved in `localStorage` (corrupt or blocked storage is handled). 4 running trails (none / gold / leaf / rainbow) unlock with lifetime coins at 0 / 100 / 300 / 800.
- **Accessibility**: optional read-aloud (browser speech), reduce-motion (also follows the OS setting), bigger text, and a circle / triangle / square shape beside each lane colour on the board and road pads.

## 13. Update 5 - visuals
- **Biomes** (`biome-data.js`, `biome-manager.js`): Sunny Jungle -> Golden Sunset -> Firefly Night -> Misty Dawn, 600 m each with a 200 m smooth fade, looping every 2400 m. Fog, sky, sun, hemisphere light, ground tint, exposure and torch brightness all interpolate; the player gets a banner when a new area starts.
- **Fireflies / pollen** and **speed lines** at high speed (both off with reduce-motion).
- Robustness: the local server now keeps connections alive for 65 s and the asset loader retries a failed GLB twice before using a fallback.

## 14. Honest status after these updates
- Tested only in headless Chromium on software rendering, Node 22, Linux. Not tested: real PC/GPU frame rate, the Windows `.bat`, Node 24, Safari/Firefox, touch devices, real speakers or a real speech voice (read-aloud was verified with a stand-in speech engine).
- Visual taste (biome colours, trail looks, sounds) is for you to judge; screenshots were reviewed but not on your screen.
- Not done: a Victory-clip celebration during a run (a 9 s clip does not suit a running character), tree/bush instancing, a lighter Girl model and mesh compression. These need frame-rate measurements on a real PC first.
- Settings and progress are stored per browser (`localStorage`); clearing browser data resets them.

## 15. Update 6 - tutorial, touch controls, progress report
- **First-run tutorial** (`tutorial.js`): a short coach bar at the top asks the child to change lane, jump, slide, collect coins, and explains the question board (5 steps, "Nice!" after each). During it there are no obstacles and no question board; every step times out after 14-16 s so nobody gets stuck, and a **Skip** button ends it. It is remembered in the profile; Settings has "Show tutorial again". `?notutorial=1` disables it.
- **Touch devices**: on phones/tablets (`pointer: coarse`, or `?touch=1`) four large buttons appear (left, right, jump, slide) next to the existing swipe gestures; the keyboard hint is hidden. The phone vibrates briefly on a hit, a right/wrong answer and the like (not when reduce-motion is on).
- **Progress report** (`report.js`): the game now remembers right/wrong answers per subject. Settings shows an accuracy bar per subject, practise advice (the weakest subject with at least 3 answers, below 70%), and totals. **Print / save report** produces a clean one-page printable version (use the browser's "Save as PDF"). **Reset all progress** asks for confirmation first.

## 16. Update 7 - Explorer: the whole app, testable on one computer
**Goal:** open and test *everything* locally (accounts, dashboards, rewards, both worlds, the Jungle Run, profile, sound, 3D models), not just the run.
- **Full backend without native modules.** `backend/db/index.js` uses `better-sqlite3` when it is installed and otherwise the new `backend/db/sqlite-driver.js` (Node's built-in `node:sqlite`). `better-sqlite3` is now an *optional* dependency; MySQL/Railway behaviour is unchanged. The pure-JavaScript backend packages (13 MB) ship in `backend/node_modules`, so nothing needs installing. The backend's own 62 tests pass on this driver.
- **`START_EXPLORER_ALL.bat`** (`npm run explorer`) starts frontend + API + database on `127.0.0.1:4000` and opens the hub. Data goes to `backend/learnquest-explorer.sqlite` (delete the file for a clean start); a real database is never touched.
- **Explorer Hub** `/explorer.html`: all 20 pages, one-click demo family (parent + Aarav, Mia, Riya + 3 tasks) and one-click parent / child sign-in, Jungle Run link builder, profile editor (edit, unlock everything, fresh player, import / export), sound board, question lab, documents.
- **In-game test tools (F9)** and URL options (`tools`, `god`, `lives`, `grade`, `subjects`, `biomeStart`, `tutorial`, `touch`, `sandbox`).
- **3D asset gallery** `/asset-gallery.html`: runtime copies, the untouched originals (served from `source_assets`), the older project models; wireframe, bounding box, clips, triangle / texture / size info.
- **Self-check and speed test** `/selftest.html`: 21 automatic checks of the real game in a private sandbox (`?sandbox=1` keeps profile and audio settings in memory) plus a real-time FPS benchmark for high / balanced / low, with a copy-able report and a recommended quality.
- **Fixes found while doing this**: the backend's security policy blocked `blob:` connections, which three.js uses for GLB textures (allowed in explorer mode only; production headers untouched); the self-check page now reports "too few frames" instead of hanging when a computer renders extremely slowly.
- **Safety net**: `original_v3_backup/` holds the original version of every pre-existing file this work changed (14 files, including `TEST_REPORT.md` and `LOCAL_JUNGLE_QUICK_START.txt`, which I had earlier overwritten by mistake). `scripts/validate-project.js` was changed in one line to accept `better-sqlite3` as an optional dependency.

## 17. Update 8 - gallery shows your model, no old models
The 3D gallery now has 21 entries (your `girl.glb`, 10 runtime copies, 10 untouched sources), opens on your `girl.glb`, and shows a note explaining that the game runs the animated version of the same girl. The old explorers and the old road are gone from the gallery, and the old explorers are no longer used as silent fallbacks in the game. `girl.glb` was added to `source_assets/characters/` (+44 MB to the ZIP).

## 18. Update 9 - the original pages use the new characters too
Earlier updates only replaced the old explorers in the *new* Jungle Run and the gallery. The original pages still used them. Now:
- `character-presets.js` and `character-lab.js` point to the new runtime models, so the original Jungle Runner, Maths Kingdom, the 3D Explorer Lab and the Reference Studio show the new Boy and Girl.
- `game/character-controller.js` (the original controller, still compatible with any GLB) now removes baked-in root motion (the slide clip would otherwise carry the character 3.5 m forward), re-times the jump / slide / hit / fall clips to the runner's own timings (jump 0.9 s, slide 0.72 s, hit 0.9 s), keeps the character running for a lane dodge or landing instead of borrowing the body-turning clips, and falls back to running when a state has no clip.
- The Hub's demo children use the real Boy / Girl presets (they used emoji avatars before, which the original runner draws as a procedural fox).
- Originals of the three changed files are in `original_v3_backup/`.

## 19. Update 10 - original runners really played, and Hindi / Marathi
**Original runners, played.** The original Jungle Runner (Boy and Girl) and Maths Kingdom (Boy and Girl) were driven with real key presses and a deterministic game clock: run, jump (Regular_Jump), landing back to running, slide (slide_light), lane change without a body-turn clip, and the character staying on the runner's position.
**Bug found on the way:** `maths-kingdom-game.html?level=maths_kingdom_lvl_1` is *locked* for a new child (it opens after the Jungle world is finished) and silently redirects to the dashboard, so my earlier Hub check "opens with no errors" proved nothing. Fixes: the Hub now checks that the game page is really open, and in explorer mode only, `POST /api/explorer/unlock-levels` (parent login required, `routes/explorer.js`, mounted only when `LQ_EXPLORER=1`) unlocks every level of the parent's children; "Create / repair demo family" calls it.
**Languages.** The Jungle Run now speaks English, Hindi (हिन्दी) and Marathi (मराठी):
- `i18n.js` holds ~170 strings x 3 languages; `question-i18n.js` localises prompts, explanations and the spoken text of questions. Maths, patterns, comparisons and shapes are fully localised; **science facts and spelling words are English content and stay English** (labelled "English" in the subject list).
- The language is chosen from `?lang=`, then the saved choice, then the browser language. The menu has three language buttons that switch everything live; the choice is saved in the profile; read-aloud uses `hi-IN` / `mr-IN`; the board and page use fonts with Devanagari fallbacks.
- The translations were written by me and have not been reviewed by a native speaker. All text is in `i18n.js`.
- The Hub's link builder (`?lang=`) and profile editor have a language option.

## 20. Update 11 - performance for integrated GPUs
**Evidence.** Your real self-check (Windows, Edge, Intel HD Graphics 520, 1280x720 window at 1.65x display scaling) passed all 21 functional checks but ran at high 15.4 / balanced 21 / low 24 fps average with stutters down to 2.7 fps. "High" was rendering 2112x1188 pixels.
**Where the frame went** (visible triangles, measured): coins 295k (34 x 8.7k), trees 420k, torches 173k, bushes 350k, road tiles 150k, 53k for the two bushes on every slide beam.
**Changes**
- Assets: see ASSET_INVENTORY section H (coin 2.4k, far-LODs 4-7k, Girl 132k). Roadside objects and road tiles switch between the full model and the LOD by distance; rocks too.
- Quality levels (`config.js`): high = max render scale 1.25, real shadows, 4 torch lights; balanced = 1.0, no shadow pass (a soft blob shadow under the player), 2 lights, cheap shading; low = 0.8, 1 light, cheaper everything, shorter view distance. Cheap shading = diffuse (Lambert) materials with the same textures for scenery and road.
- **Adaptive resolution** (`adaptive-resolution.js`): the picture is made less sharp (down to half) when frames take longer than ~33 ms and sharp again when there is time to spare; changes at most once per 0.7 s and ignores one-off stalls.
- **Graphics card detection**: Intel / integrated graphics start on *balanced*, discrete NVIDIA / AMD / Apple on *high*, software renderers on *low*. Settings -> Graphics (Auto / High / Balanced / Low) overrides it and is saved; `?quality=` also overrides.
- **Pre-warm**: all shaders are compiled and all textures uploaded before the menu appears, so nothing stutters when a power-up, the board, an Enigma or a new world first appears.
- Self-check (`/selftest.html`): measures each level at a fixed resolution (with stutter counts and picture size), then "auto"; the "Apply ... to my game" button saves the recommendation to your real profile.
**Visible triangles** (frustum-culled, standard scene): high 2.27M -> 1.14M, balanced 1.68M -> 0.80M, low 1.51M -> 0.52M; draw calls (low) 129 -> 100.
**What is NOT proven:** the real frame-rate gain on your Intel HD 520. Only triangles, draw calls, pixels and shader behaviour were measured here; please run `/selftest.html` again and send the new report.

## 21. Update 12 - a second real report: GeForce GT 730 (old entry-level card)
A second self-check (Windows, Edge, **NVIDIA GeForce GT 730**, 1920x1080 at 1x, 16 cores, 16 GB *system* RAM) passed all 21 functional checks; it ran high 28.4 / balanced 33.6 / low 43.9 fps with stutters (worst 6-8 fps). It came from the **build before the performance update** (2.39M / 2.02M / 1.48M triangles, no stutter / picture-size columns), so it does not show the new improvements yet.
Finding: the GT 730 is a 2014 entry-level card, much weaker than the name "NVIDIA" suggests, but the graphics-card detection called every "GeForce" a strong discrete card and would have started it on **High** (28 fps). Fix: a new class **entry** (GeForce GT/GTS/MX, GT 1030, GTX 6xx/7xx, 8xx/9xx"M/MX", old Quadro, Radeon HD / R2-R5) starts on **Balanced** (with adaptive resolution); GTX 10xx/16xx, RTX, Radeon RX and Apple M stay on High. Settings -> Graphics still overrides it. Unit-tested with the real GT 730 string.

## 22. Update 13 - automatic device analysis and quality (up to 4K)
**Requirement:** before the game runs, analyse the device (GPU, memory, RAM, whole device) and load the quality it can run smoothly: 4K on a device that can, 2K on one that can, low on a very weak one.
**How it works**
1. *Facts* (`device-profile.js`, collected while the loading screen shows "Checking your device..."): graphics card and its class, display native resolution (screen size x display scale), refresh rate (measured), memory, CPU cores, WebGL limits (texture size), touch / phone, battery state, data-saver.
2. *Static analysis* gives the **highest level this device may use** and a **safe starting level**: software renderer -> up to Low; old / entry cards (GeForce GT, MX ...) -> Balanced; Intel / integrated -> High; GTX / RTX / Radeon RX / Apple M -> Ultra; then lowered by 1 GB / 2 GB / 4 GB / 6 GB memory, 2 or 4 CPU cores, texture limit < 4096 / 8192, phones and tablets, data saver, and battery under 20%.
3. *Calibration on the real game scene*: starting from the safe level the game draws itself at the display's **native resolution** for ~1.3 s per level and tries higher levels while ~60 fps (or the display rate if lower) holds with few long frames, up to the ceiling; if the start level is too slow it steps down until one holds (floor: Minimal). At most 5 tests (a few seconds), only the first time.
4. *Cache*: the result is saved per device (GPU + native screen + scale + memory + cores + model version) and applied instantly at the next start; a different device / screen is measured again. A level chosen by the player always wins; Settings -> Graphics -> "Analyse this device again" re-measures.
5. *While playing*: adaptive resolution (down to half sharpness) and, if that is not enough for 5 s, one level down.
**Levels** (`config.js` QUALITY): render budget Ultra 3840x2160 / High 2560x1440 / Balanced 1920x1080 / Low 1280x720 / Minimal 960x540 (always native size, never up-scaled, never above the GPU's texture limit). Ultra also has 2048 shadow maps with tree shadows, 6 torch lights and 16x texture filtering; High 1536 shadows, 4 lights; Balanced and below have no shadow pass, cheaper shading and fewer / simpler objects; Minimal has no torch lights or glow. MSAA is used only on strong GPUs up to 2K (at 4K the pixels are too dense for jagged edges to show).
**Where it shows:** loading screen, menu badge ("Quality: Ultra (up to 4K) . 3840x2160"), Settings -> "Your device" panel, Hub -> Device tab, self-check (five levels at native size + device analysis in the report).
**Original runners** (`jungle-runner.js`, `kingdom-runner.js`) now share the same analysis through `performance-manager.js` (five levels, 4K budget, start level from the device cache or the static analysis, may step up only to the device ceiling). They do not run the full calibration; they adapt from live frame times as before. Originals are in `original_v3_backup/`.
**Limits (please read):** browsers do not expose video memory, so VRAM is inferred from the GPU's name class plus the measured frame rate, not read; `navigator.deviceMemory` is RAM rounded and capped by the browser. Runtime textures are 1024-2048 px (the sources are not used), so Ultra improves resolution, shadows, lights and filtering, not texture detail; the road is ~108 m long so the view distance is not extended.

## 23. Update 14 - core engine in C, C++, Python and Java (measured, not assumed)
**Request:** convert the critical / core game engine to Python, Java, C and C++ to make the game lighter, smoother and more scalable.
**First, measurement** (`tools/browser-tests/t_profile.py`): the *entire* game-logic update (player, road, scenery, coins, obstacles, questions, effects, collision, camera, HUD) costs **0.091 ms per frame**, about 0.5% of a 16.7 ms frame, even on the slow software-rendering test machine. Your two real self-check reports (Intel HD 520, GeForce GT 730) show the frame is limited by the **GPU drawing the picture**. So rewriting the logic in another language cannot raise the frame rate; what does is lower resolution, fewer triangles, cheaper shading and fewer draw calls (Updates 11 and 13).
**What was built anyway, and how it is proven**
- **C** (`native/c/kernels.c`): the bulk particle loops (fireflies / pollen, sparkles and bursts) and the random number generator, compiled to WebAssembly. The particle arrays live *inside* the WebAssembly memory and three.js draws them directly (zero copy).
- **C++** (`native/cpp/collide.cpp`): the collectible and obstacle collision rules, in the same WebAssembly module (2.9 KB, no imports).
- **JavaScript reference** (`native-reference.js`): the specification, the fallback, and the oracle. C / C++ results are **bit-for-bit identical** to it (sine, random numbers, 300 random particle worlds, 200,000 random collision situations each), and the game plays identically with `?wasm=0` (same coins, lives, score, distance and hits over a 30 s scripted run, once `Math.random` is seeded; see the correction in TEST_REPORT.md).
- Safety: a start-up self-test compares WebAssembly with JavaScript; a missing, corrupt, blocked or tampered module (tested by flipping one constant in the compiled code) makes the game use the JavaScript. Settings -> "Native engine core" and `?wasm=0` switch it off. On the full backend the CSP allows `'wasm-unsafe-eval'` only in explorer mode.
- **Python** (`native/python/lq_core.py`) and **Java** (`native/java/LqCore.java`): ports of the same pure logic (particle kernels, collisions, device analysis, render-size budgets, quality calibration) for servers, analytics, Android / desktop reuse. They cannot run in a browser. Each reproduces all **1,864** golden records written by the JavaScript reference exactly (including float32 rounding).
- Tools: `sh native/run_all_tests.sh` (all four languages), `sh native/build.sh` (rebuild WebAssembly; needs clang + wasm-ld), `npm run native:test`.
- **Frame profiler** (`GameManager.frameProfile()`): average game-logic ms, draw-call-submit ms and frame ms; the self-check prints them per quality level, so a real PC shows whether time goes to logic or to the GPU.
**Measured speed of the C/C++ kernels vs JavaScript:** ambient particles x1.10, effect particles x1.07, collision x0.95-1.09 (about one microsecond per call). The browser's JIT already compiles these loops to native-quality code, so there is no measurable gain. Python and Java would be slower in the browser (they need an interpreter / VM shipped as WebAssembly) and are not used there.
**Not done on purpose:** a rewrite of the renderer, the question generator or the HUD in another language (no gain, large risk); rewriting the Node backend in Java / C++ (it is input / output bound, so it would not scale better).

## 24. Update 15 - the engine in the backend (Python worker, JavaScript fallback)
**Request:** integrate the main engine in Python and into the backend; use Java / Python in the backend only if needed.
- **Python engine** (`native/python`): `lq_core.py` (kernels, collisions, device analysis, render-size budgets, calibration), new `questions.py` (the whole question engine: seeded RNG, six subjects, banks, option shuffling) and `engine_server.py` (a JSON-lines worker). The question port reproduces **960 / 960** JavaScript questions exactly (all subjects, levels 1-4, 8 seeds incl. negative and 32-bit edge seeds); with the other kernels the Python test now covers 3,784 records.
- **Backend integration** (`backend/engine/*`, `backend/routes/engine.js`, mounted at `/api/engine`): provider selection (Python when it passes a 10-case self-test against JavaScript, else JavaScript), per-request fallback, a circuit breaker (3 failures -> Python paused 60 s, then restarted), timeouts, call statistics.
- **What the server can now do:** make a question from `(seed, index, subject, level)` without storing anything, check an answer **without trusting the browser** (the question list never contains the answers), analyse a device (class, highest level, safe start, exact render size at every level) and decide a quality level from measured probes. These are the pieces a server needs for answer verification, teacher / parent reports and device statistics.
- **Hub -> "Backend engine"**: status, "analyse THIS device on the server" (compared with the browser's own analysis), 5 server-made questions with server-side checking, and a JavaScript-vs-Python speed comparison.
- **Java was not integrated, on purpose:** no backend feature needs it, and it would add a JVM dependency for no gain. The Java port stays in `native/java` (Android / desktop reuse), verified with the same golden vectors.
- **Honest performance note:** the Python worker is *slower* than the in-process JavaScript (about 0.07 ms vs 0.01 ms per question, including the pipe) and the backend is input / output bound, so this does not make the backend faster or more scalable; it adds a second, verified implementation and optional Python availability. Without Python the API behaves identically.

## 25. Update 16 - website, Android, iPhone and desktop apps
**Request:** make the game work properly and smoothly as a live web app, an Android app, an OS (desktop) app and an iOS app. See `PLATFORMS.md` for the steps.
**Design:** one game (JavaScript + WebGL + the C/C++ WebAssembly core) in four shells; Python / Java / C / C++ are not needed per platform.
- **Platform layer** (`js/lq-platform.js`): detects website / installed web app / Android-iOS app (Capacitor) / desktop app (Electron) and the OS; resolves the server address (`window.LQ_NATIVE_CONFIG` from the app shell > `?api=` (remembered) > saved > same site); only `scheme://host[:port]` is accepted. `js/api.js` now prefixes `/api` with that address (original saved in `original_v3_backup/`). Backend: `APP_ORIGINS=1` opens CORS for exactly the app origins; a browser's same-origin POST is always accepted.
- **Installable web app:** `manifest.webmanifest`, icons (192, 512, maskable, Apple touch, favicon), `sw.js`, `js/pwa.js`, `offline.html`, `scripts/build-pwa.mjs` (writes `precache-manifest.json`, 120 shell files = 3.2 MB, 15 models = 54.9 MB). The shell is cached on the first visit; models are cached when used or all at once ("Download for offline play"); `/api` is never cached; pages are network-first with a saved copy offline; a new version waits for the player's "Reload now"; the active version's manifest is kept in the worker's own cache so it can restart offline. All 20 pages carry the manifest, theme colour, iOS app meta tags and `viewport-fit=cover`.
- **App behaviour** (`app-lifecycle.js`): leaving the app / hiding the tab / losing the GPU context pauses a run and silences sound; Wake Lock during runs; Android back button (pause / resume / exit); silent-audio loop on iOS so the hardware silent switch does not mute the game; fullscreen button on desktop browsers. Settings -> App: install, offline download, update (English / Hindi / Marathi). Mobile CSS: no scroll / zoom / selection / long-press menu while playing, dynamic viewport height, safe-area padding.
- **Quality:** phones and tablets are capped at 2K (Balanced below 6 GB RAM) whatever their GPU class (iPhone's "Apple GPU" is a strong GPU but heat and memory limit an app); identical rule in JavaScript, Python and Java (golden vectors regenerated, all identical).
- **Android** (`mobile/android`) and **iOS** (`mobile/ios`): generated with Capacitor 6; app id `com.learnquest.junglerun`; launcher icons (all densities, adaptive, round) and splash from the game's coin icon; Android: vibrate + wake-lock permissions, full-screen immersive `MainActivity`, screen kept on, media plays without a first tap, backups off, `fullSensor` rotation; iOS: landscape + portrait, status bar hidden, full screen, no export prompt. `npm run mobile:android|ios` copies the game (`mobile/scripts/sync-web.mjs`, 58 MB) and opens Android Studio / Xcode.
- **Desktop** (`desktop/`): Electron 33 main process (sandboxed window, no Node in the page, navigation limited to the game, single instance, remembers window size, F11 fullscreen, GPU switches), a local-only static server on `127.0.0.1:47655`, server address from `LQ_API_BASE` or `config.json`, builders for Windows (NSIS + portable), macOS (dmg + zip), Linux (AppImage + deb).
- **App bundle contents** (`scripts/app-files.mjs`): the game and family pages; not the Explorer Hub, asset gallery, self-check, reference studio, documentation, the 19 MB fallback road, reference images or old explorer models (101 MB -> 58 MB).
**Not done / cannot be done in this environment:** building the APK / AAB, the IPA, or the Windows / macOS installers; code signing and store submission; testing on real phones and tablets; testing in WebKit (the iOS engine - its browser could not be installed here).

## 26. Update 17 - the teacher who runs behind the child (Temple Run / Subway Surfers style, built for learning)
**Question:** a chaser behind the runner, a teacher at the question board that asks, or something else - what is best and unique?
**Decision:** one friendly teacher doing both jobs. A pure chaser only adds tension and a board-only teacher adds none; combining them ties the chase to learning, which is what makes it different from the endless runners it is inspired by.
- **Behaviour** (`teacher-brain.js`, pure and unit-tested): she runs 3.7 m (far) to 1.6 m (about to catch) behind the child. The distance is driven by learning: a hit +0.35, a wrong answer +0.45; a right answer -0.40, a Golden Enigma -0.30, every 5 coins -0.04; she gains ground very slowly (0.012/s) when nothing happens. She cannot catch in the first 7 s or 14 s after a rescue, and keeps her distance near a question board and during the tutorial. **Adaptive:** a child who answers well (>= 90%) meets a quicker teacher (x1.2), one who struggles (<= 40%) a patient one (x0.6); Grade 1 is gentler (x0.8).
- **Rescue question instead of "game over":** when she catches up the world stops (no time pressure; lane keys are ignored) and she asks a question from the child's chosen subjects and grade, spoken aloud if read-aloud is on. Right: free, she drops back to 0.28, 1.4 s of protection. Wrong: one heart lost, she stays at 0.55, the run continues (on the last heart the run ends normally). The answer is scored exactly like a board question: streak, review at the end of the run, subject accuracy in the parent report.
- **The teacher also asks at the boards:** the board question is shown as "Teacher: ..." (English / Hindi / Marathi), with the same voice. No second model is needed.
- **Look** (`teacher-manager.js`): the already loaded Boy model (no extra download, +77k triangles = about 12% of a frame) dressed with a graduation cap with tassel, round glasses and a book in the right hand - positions measured on the model's head and hand bones, so they follow the animation. She follows the child's lane a little late, runs faster the closer she is, and talks with the Talk animation during the question. Speech bubbles ("The bell is ringing! Run to class!", "Wait for me!", "Well done!" ...) follow her head on screen.
- **Weak devices:** the Minimal quality level loads no teacher model (bubble and rescue question still work); a higher level loads it on demand.
- **Choice:** Settings -> "Teacher chase" turns the whole thing off; the debug panel (F9) has "Teacher catches me" / "Teacher far". 17 new text lines x 3 languages.
**Limits:** the balance numbers (how fast she gains, how far she drops back) are my estimates and need testing with real children; the character is the Boy model with accessories, not a purpose-made teacher; the teacher lines in Hindi / Marathi are not reviewed by a native speaker.

## 27. Update 18 - run live from GitHub (GitHub Pages)
**Request:** link with GitHub and run the game live directly from GitHub.
**What is and is not possible:** I cannot sign in to or push to the user's GitHub account (no credentials), so the repository, the push and the Pages switch are done by the user (`GITHUB_PAGES.md`, 5 commands). Everything else is prepared and tested.
- `scripts/build-pages.mjs --base /REPO/ --out site`: builds the static site (game, self-check, 3D lab, installable-app files, only the three.js files that are used, 124 files, 58 MB, largest file 21 MB). GitHub serves a project site from a sub-folder (`/REPO/`), the code uses root paths (`/js/...`, `/assets/...`), so all of them are moved under the base (19 files); a user site (`NAME.github.io`) uses `/`. Pages that need the Node backend are left out and links to them point at the game. The offline file list is generated for the site with the base in every URL.
- `.github/workflows/pages.yml`: on every push to `main` - `npm ci --omit=dev --ignore-scripts` (three.js only; the root `postinstall` that installs the backend is skipped), offline list, build with the base taken from the repository name, `scripts/test-pages.mjs`, then GitHub's official configure / upload / deploy Pages actions. Setup: Settings -> Pages -> Source: GitHub Actions.
- `scripts/test-pages.mjs` (9 checks): entry files, no backend pages / heavy files, GitHub size limits, no root path that would escape the base, every referenced file exists, no link to a missing page, offline list, installable-app manifest under the base, service worker base.
- `scripts/serve-pages.mjs`: serves a built site exactly like Pages (only under the base, 404 elsewhere, 10-minute cache, no custom headers) for local preview and for the browser test.
- `.gitignore`: `source_assets/` (328 MB masters) and build folders are not uploaded -> the repository is 456 files, about 67 MB.
**Limits:** GitHub Pages cannot run the Node backend (accounts, dashboards, the Explorer Hub stay on Railway); Pages is free only for public repositories; the actual GitHub run (Actions, deploy, the live address) could not be performed here.

## 28. Update 19 - premium experience: Subway-style teacher, three free runs, navigation, story questions, clean wording
- **Teacher (Temple Run / Subway Surfers logic)** - `teacher-brain.js` is now a three-state chase: *far* (a few steps behind, beside the child) -> *close* (right behind him for 14 s after a first stumble) -> *caught*. A **second stumble while she is close** grabs him: the world stops, she asks an escape question, a right answer wins the lost heart back. A **wrong answer at a board** grabs him at once and shows the right answer big with its explanation and a "Run again!" button. Right answers (6 s each) and Mystery coins send her back. She adapts to the child (x0.6 ... x1.2), never grabs in the tutorial or on the last heart, and a shield / protection saves him from her too. 26 browser checks + 7 unit tests.
- **Messages never on the road** - one message lane in the top-left corner (toasts, coach text, the teacher's speech); the question banner is a slim strip; coach text had almost no contrast and now does; the key hint moved to the bottom-right; phones get their own offsets.
- **Three free runs** - `free-plays.js`: Play, Play again and Enter count on this device; the 4th run is stopped. With a LearnQuest server (`/api/health` answers) the player sees a short countdown and is taken to `parent.html?signup=1&from=game` (Sign Up tab opened, a note explains: parent account, then a child profile); without a server (plain web page) nobody is locked out ("Continue as guest"). A signed-in parent or child plays without limit; `?freeplays=off|reset`. The language chosen on the home page now carries into the game and back.
- **Navigation everywhere** - `js/site-nav.js` (Home, Play, Parents, Kids) on 11 pages, a navigation row in the game menu, Home on the pause screen, Play / Parents / Kids in the home navigation. The two old full-screen games keep their own controls.
- **Home page** - headline "Run the jungle. Learn as you play." (+ Hindi, Marathi), buttons Play Jungle Run and Parents: log in or sign up, "Try 3 free runs". The self-check and the 3D lab are developer tools: they are no longer linked and are not part of the public GitHub Pages site (the Explorer Hub still has them).
- **Story questions** - every question is a jungle "gate" (Monkey Maths, Treasure Gate, Banana Bridge, Parrot Post, Tiger Gate, Mystery Path, Secret Code, Giant's Choice, Tiny Gate, Shape / Word / Science Gate) in English, Hindi and Marathi, in the banner and in the voice. The board keeps the short sum; the generator, the Python port and the golden vectors are unchanged.
- **Clean wording** - engine / GPU / CPU details moved into "Advanced (for grown-ups)"; the native-engine switch is gone from Settings; "Golden Enigma" became "Mystery coins"; picture quality is Best / High / Medium / Low / Lowest; plain loading texts; Settings & progress.
- **Service-worker fix** - app files (scripts, styles, translations) are fetched fresh when online (the saved copy is only for offline), a new version takes over at once, and the page is told; the home page reloads itself. This removed a mixed old/new version problem that showed raw text keys.

## 29. Update 20 - feedback round (live test on GitHub Pages)
- **Teacher, clearer**: far = out of sight behind the camera (like the guards in Temple Run); after a stumble she runs into view right behind him and a red chip "Teacher is right behind you! 14s" and a corner message say so; a second stumble or a wrong answer shows the grab first (about a second, a message says what happened), then the panel gives the **reason** ("You stumbled twice in a row, so the teacher caught up with you!" / "That was a wrong answer...") before the escape question or the right answer. The ZWJ teacher emoji (shown as two pictures on some PCs) is now the single-codepoint cap.
- **Reading time** (`question-reading.js`): when a question appears the runner stops; the question moves to the middle with a countdown bar and a "Ready!" button (Enter / Space / tap); 3-10 s from the length of the question (Grade 1 x1.25); no hits while reading; Settings: No pause / Short / Normal / Long.
- **Back to menu and Home** on the "Great run!" and Pause screens (`game.toMenu()`).
- **Home page**: no big headline (a hidden "LearnQuest" heading stays for screen readers); buttons "Play game" and "Learn more" (Hindi, Marathi too); everything else unchanged.

## 30. Update 21 - small children get all the time they need to read
- **Default: no clock.** When a question appears the runner stops and waits until the child taps **Ready!** (or presses Enter / Space). A **Listen** button says the question aloud again (also when "read aloud" is off). Settings -> *Time to read questions*: Wait until I tap Ready (default) / Long / Normal / Short / No pause. The timed choices depend on the length of the question and the class (Grade 1 gets +60 %, Grade 2 +30 %): a typical story question gives a Grade 1 child about 26 s on Normal, never less than 12 s on Short. `?readtime=off|ready|short|normal|long` overrides the saved choice (demos, tests).
- Profiles saved by the earlier version with "Normal" that nobody chose on purpose move to "wait until Ready".
- **Bugs found and fixed:** a new run could start inside an old question pause (the reset did not clear it); choosing "Normal" was immediately undone by the migration (flag order).
