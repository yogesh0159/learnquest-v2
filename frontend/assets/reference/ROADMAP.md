# LearnQuest — reference-driven development roadmap

Status: M01 complete; M02 in progress (Boy supporting art sheet v1); M03–M10 pending.
Working branch: `upgrade/realworld-v1`. Keep `main` unchanged until final release approval.
Visual authority: `learnquest-target.png`, supplied by the user on 2026-09-28.

## What this image actually specifies

The sheet is a visual target, not evidence that production assets exist. Its
“Game Ready”, “Rigged”, and “Optimized” labels describe the desired result; they
do not certify the current code or a model extracted from this image.

### Character identity

Boy: stylized child proportions, large expressive brown eyes, round cheeks,
small nose, asymmetrical swept dark-brown hair, blue zip hoodie over a light
shirt, orange zipper/drawstrings/backpack straps, beige cuffed cargo trousers,
red/black/white sneakers, dark navy backpack with orange trim and LQ mark.
Girl: similarly stylized child, large brown eyes, long brown high ponytail with
pink tie, pink zip hoodie, pale shirt, dark fitted trousers, pink/white sneakers,
purple backpack with LQ mark. The Girl is not a recolored Boy mesh.

Preserve front/side/back silhouettes, head/body ratio, face identity, clothing
folds, hands, shoes, straps, backpack shape and hair volume. The earlier khaki
explorers remain temporary gameplay proxies; they do NOT meet this target.

### Motion

Visible labels: Idle, Run, Sprint, Jump, Slide, Dodge Left, Dodge Right, Hit,
Fall, Victory. Land and transitions are also needed for real gameplay, although
not separately illustrated. The reference depicts action poses, not full motion
curves. Earlier MP4s can inform motion only; their khaki wardrobe does not override
the new blue/pink identity. Do not mirror asymmetric artwork for right-dodge.

### Three world compositions

1. Jungle Run: third-person rear camera, warm stone-block runway, mossy ruins,
   layered dense foliage, vines, lanterns, golden coins; upper-left star progress,
   upper-right three hearts, parchment-style suspended arithmetic card.
2. Word Bridge: rear/three-quarter Girl camera, separated wooden platforms over
   clear blue water, rocky ruin columns, hanging foliage, bright distant sky,
   coins aligned with the traversable route, a spelling card with BOOK tiles.
3. Maths Kingdom: rear Boy camera, luminous purple/blue castle towers, warm lit
   windows, stone bridge/runway, glowing +, −, ×, ÷ symbols and magical particles.
4. Completion: dark navy backdrop, victory character, three gold stars, Learned /
   Solved / Unlocked Next confirmation, a green Continue button. This is an end
   screen, not a fourth playable world.

The top character turnarounds, wireframe panel and promotional footer belong to
the reference sheet/review tools; they should not crowd the actual game HUD.

## Current implementation vs target

| Area | Current verified build | Work still needed |
|---|---|---|
| Characters | Two original articulated-part GLBs, 14 clips; load/fallback work | Custom smooth skinned hoodie characters, detailed faces/hair/outfits |
| Jungle | Playable procedural three-lane runner | Matching environment art, camera, lighting, HUD and gates |
| Word Bridge | A separate measurement Bridge Builder mission exists | The illustrated 3D spelling/platform world does not exist yet |
| Maths Kingdom | Playable procedural castle runner | Matching castle silhouette, magic effects, path and lighting |
| Hearts | Normal runner has crash-oriented rules; boss has separate lives | Decide and implement a consistent server-validated 3-heart design |
| Learning | Server validation, learning focus, age groups, progression | In-world parchment presentation, spelling input, clear feedback |
| Completion | Rewards/results flows exist | Reference-style victory scene and presentation |
| QA | 62 tests, character preview and local startup verified previously | World E2E, real phones, asset budgets, preview deployment and restore test |

## Execution order and acceptance gates

### M01 — Reference baseline and review workspace [complete]
- Preserve the unmodified reference and its SHA-256; record visible facts separately
  from assumptions about gameplay.
- Add `/reference-studio.html`: target sheet, zoom/pan, current prototype viewer,
  front/left/back/right views, wireframe inspection and milestone checklist.
- Clearly label the current characters as prototypes, not target-matched art.
- Gate: reference opens; comparison controls work on desktop/mobile; no gameplay
  or reward rules are altered by this planning/inspection milestone.

### M02 — Final character art, Boy first then Girl [in progress]
1. Establish consistent front/left/right/back orthographic drawings, dimensions,
   and a neutral A-pose. Resolve ambiguities caused by perspective in the sheet.
2. Sculpt Boy head/body/hair; compare untextured silhouette before adding detail.
3. Build hoodie, cuffs, trousers, sneakers, backpack/straps and separate accessories.
4. Retopologize with loops suitable for elbows, knees, shoulders, mouth and hands.
5. UV unwrap; paint base colour, roughness and normals. Use the reference palette.
6. Repeat the full identity workflow for Girl, including ponytail/tie and outfit.
7. Export inspection GLBs and side-by-side front/side/back renders before rigging.
- Gate: user reviews matched-camera turnarounds; no placeholder primitive face,
  wrong wardrobe or visibly detached joints accepted as final art.
- Required capability: a real modeling/sculpting and texture workflow. A PNG/MP4
  is not a 3D model; exact mesh recovery is not guaranteed. Do not substitute an
  AI-generated still image or a renamed procedural proxy for the finished model.

### M03 — Skeleton, skinning and animation
1. Humanoid bones, stable root/hips hierarchy and fixed ground origin/forward axis.
2. Skin weights and extreme-pose checks for shoulders/elbows/knees/hoodie/straps.
3. Build the ten visible actions plus Land; keep root displacement owned by game
   physics for jumps, dodges and forward travel.
4. Add hair/hood/backpack follow-through without collisions or excessive motion.
5. Tune blends, cancel/restart behavior, foot contact and loop seams.
- Gate: every clip and transition viewed from all four sides; no foot sliding,
  skin collapse, accessory mirroring or visual/collider mismatch.

### M04 — Jungle visual vertical slice
1. Build one short complete playable stretch, not all levels at once.
2. Match rear camera height/FOV/character scale/path width to the screenshot.
3. Model reusable stone tiles, broken edges, moss, ruin arches, vines, roots,
   broad-leaf plants and lanterns; arrange near/mid/far depth layers.
4. Add warm/cool light balance, fog depth, contact shadows, restrained particles.
5. Place readable coins and jump/slide/lane hazards with safe spawn distances.
6. Add the parchment arithmetic gate and three-heart/star HUD presentation.
- Gate: actual live gameplay screenshot reviewed beside Jungle panel; run/jump/
  slide/dodge still work; hazards do not overlap a reading gate.

### M05 — Word Bridge playable world
1. Implement reusable platform/gap geometry with continuous collision bounds.
2. Add blue water, banks, ruined towers, sky depth and coin trajectories.
3. Design spelling interaction (tile selection/order) with readable focus mode.
4. Add server-side word answer validation, run events, retries and unlock evidence.
5. Add mobile touch, keyboard and accessible answer controls.
- Gate: correct word permits progress; incorrect answers follow agreed life rules;
  refresh/replay cannot duplicate rewards; this is not a reskin of measurement quiz.

### M06 — Maths Kingdom visual vertical slice
1. Match castle silhouette, tower layering, bridge width and camera composition.
2. Build reusable walls/towers/arches/windows with mobile LODs.
3. Add purple-blue ambience, warm windows, animated arithmetic symbols and subtle
   bloom/particles with a low-quality alternative.
4. Integrate existing maths gates, hazards and rewards without client-side scoring.
- Gate: matching live composition plus readable questions on small screens.

### M07 — Unified learning, HUD, hearts and completion
1. Resolve rules not inferable from a still: heart loss on obstacle vs wrong answer,
   recovery/checkpoints, star thresholds, Word Bridge placement in unlock order.
2. Implement those rules consistently on server and client with migrations only
   when necessary; retain existing user progress.
3. Match stars/hearts, parchment cards, typography, selected-answer feedback and
   the three-star victory/Continue composition.
4. Keep age groups, English/Hindi/Marathi, learning focus, parent analytics and
   actual persisted unlock state integrated.
- Gate: Continue only unlocks a level after server confirmation; repeated calls
  cannot grant rewards twice; text fits long translations and mobile screens.

### M08 — Full levels, audio and polish
1. Extend approved vertical slices into authored levels with gradual difficulty.
2. Add clear tutorials and safe practice sequences for each movement/learning rule.
3. Add licensed/original footsteps, coins, jumps, correct/incorrect and victory
   audio; mute, volume, reduced motion and pause behavior.
4. Review every route for unreachable coins, unfair hazards and progression locks.
- Gate: all worlds playable from a fresh account and existing save without skips.

### M09 — Performance, robustness and device QA
- Starting budgets (validate by profiling, not promises): final characters roughly
  20k–40k triangles on normal tier; mobile LOD roughly 8k–15k; mostly 1K textures,
  2K only where visible. Aim for <=8 materials per character. Profile total scene
  draw calls, memory, texture decode, loading and thermal behavior.
- Target 60 FPS on capable devices, stable 30 FPS on supported low tier. Measure
  real Android/iOS hardware, not only headless Chromium screenshots.
- Add LOD/instancing/pooling, compressed meshes/textures only after compatibility
  testing; keep fallback for failed assets and lost WebGL context.
- E2E: login/profile -> all worlds -> learning -> failure/retry -> completion ->
  persisted rewards; network interruption, resume, orientation and audio unlock.
- Gate: recorded device/scene results and regression suite; no blanket “optimized”
  claim based solely on a GLB filename or file size.

### M10 — Preview acceptance and release
1. Build a full ZIP from the verified `upgrade/realworld-v1` commit.
2. Test Railway preview health, MySQL migrations, assets, cache behavior and saves.
3. Capture matching-camera gameplay videos/screenshots for all three worlds and
   final character turnarounds; review remaining differences explicitly.
4. Confirm backup/restore and rollback before production promotion.
5. Merge/deploy `main` only after explicit release approval.
- Gate: no placeholder final art, no missing world, no unverified “exact match”.

## How work continues across sessions

Each session completes a bounded milestone/task, records code commit, tests,
visual evidence, unresolved differences and next task on this same branch.
No automatic multi-day background work is implied. Time/effort estimates are
revised after the final art pipeline and first vertical slice are validated.
Do not create a new branch per milestone unless technically required and explained.

Next task: M02.1 — produce the blue/pink character turnaround and proportion
specification, then build and review the actual sculpted mesh. Do not recolor the
current khaki proxy and call M02 complete.

## M01 verification — 2026-09-29
- Historical Node 20 build: 62 tests passed; 434 project validation checks passed. Current runtime target is Node 24.x.
- Real Express server + Chromium: target image loaded; 10 milestones rendered;
  zoom/reset, Boy/Girl switch, camera controls and wireframe controls passed.
- Embedded GLB viewer loads under actual CSP headers. Only character-lab.html
  permits same-origin embedding; dashboard retains frame-ancestors 'none'.
- Desktop and 390px mobile viewport inspected; no horizontal page overflow and
  zero JavaScript page errors. Physical-device performance remains pending M09.

## M02.1 progress — 2026-09-29
- Generated `boy-turnaround-v1.png` using built-in ImageGen with the original
  concept as input. Corrected the initial duplicated side view.
- Added `BOY_MODEL_SPEC.md`: reference hierarchy, anatomical conventions,
  wardrobe/component list and mesh acceptance gates.
- This is a supporting 2D art reference, not an orthographically measured mesh,
  GLB, rig or implementation of the final in-game character. M02 remains open.
- Next: actual Boy mesh construction with front/side/back silhouette comparison.
